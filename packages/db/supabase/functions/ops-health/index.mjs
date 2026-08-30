const json = (body, status) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** 길이까지 포함해 토큰 비교 시간이 값의 앞부분 일치 여부에 좌우되지 않게 한다. */
export function safeEqual(left, right) {
  const a = new TextEncoder().encode(String(left ?? ''));
  const b = new TextEncoder().encode(String(right ?? ''));
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function serviceKeyOf(env) {
  const keyMap = env.get('SUPABASE_SECRET_KEYS');
  if (keyMap) {
    try {
      const parsed = JSON.parse(keyMap);
      if (typeof parsed?.default === 'string' && parsed.default) return parsed.default;
    } catch {
      return null;
    }
  }
  return env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
}

export async function handleOpsHealth(req, env, fetchImpl = fetch) {
  if (req.method !== 'GET') return json({ status: 'method_not_allowed' }, 405);

  const expectedToken = env.get('OPS_HEALTH_TOKEN');
  const suppliedToken = req.headers.get('x-ops-health-token');
  if (!expectedToken || !safeEqual(suppliedToken, expectedToken)) {
    return json({ status: 'unauthorized' }, 401);
  }

  const url = env.get('SUPABASE_URL');
  const key = serviceKeyOf(env);
  if (!url || !key) return json({ status: 'unavailable' }, 503);

  try {
    const headers = { apikey: key, 'content-type': 'application/json' };
    // legacy service_role JWT는 PostgREST Authorization에도 싣는다. 새 sb_secret 키는 apikey만 쓴다.
    if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
    const response = await fetchImpl(`${url}/rest/v1/rpc/ops_health_status`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    if (!response.ok) return json({ status: 'unavailable' }, 503);
    const body = await response.json();
    const cron = body?.cron;
    const rpc = body?.rpc;
    const cronOk = cron?.monitored === true && cron?.healthy === true;
    if (!body || !['ok', 'degraded'].includes(body.status)
        || typeof cron?.monitored !== 'boolean' || typeof cron?.healthy !== 'boolean'
        || !Array.isArray(cron?.jobs) || typeof rpc?.warning !== 'boolean'
        || (body.status === 'ok') !== cronOk) {
      return json({ status: 'unavailable' }, 503);
    }
    return json(body, cronOk ? 200 : 503);
  } catch {
    return json({ status: 'unavailable' }, 503);
  }
}

if (typeof Deno !== 'undefined') {
  Deno.serve((req) => handleOpsHealth(req, Deno.env));
}
