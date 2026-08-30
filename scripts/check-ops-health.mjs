import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RESULT_FILE = 'ops-health-result.json';

const safeBody = (value) => {
  if (!value || typeof value !== 'object') return { status: 'unavailable' };
  const cron = value.cron && typeof value.cron === 'object' ? value.cron : null;
  const rpc = value.rpc && typeof value.rpc === 'object' ? value.rpc : null;
  if (!['ok', 'degraded'].includes(value.status) || !cron || !rpc) {
    return { status: 'unavailable' };
  }
  return {
    status: value.status,
    checked_at: typeof value.checked_at === 'string' ? value.checked_at : null,
    cron: {
      monitored: cron.monitored === true,
      healthy: cron.healthy === true,
      jobs: Array.isArray(cron.jobs) ? cron.jobs : [],
    },
    rpc: {
      source: rpc.source === 'client_reported' ? rpc.source : 'unknown',
      window_minutes: Number(rpc.window_minutes) || 0,
      unexpected_count: Number(rpc.unexpected_count) || 0,
      affected_users: Number(rpc.affected_users) || 0,
      fingerprints: Array.isArray(rpc.fingerprints) ? rpc.fingerprints : [],
    },
  };
};

export async function checkOpsHealth({
  url,
  token,
  target,
  fetchImpl = fetch,
  signal = AbortSignal.timeout(15_000),
}) {
  if (!/^https:\/\//.test(url ?? '') || !token) {
    return { ok: false, result: { status: 'unavailable', target, reason: 'configuration' } };
  }
  try {
    const response = await fetchImpl(url, {
      headers: { 'x-ops-health-token': token },
      signal,
    });
    const raw = await response.json().catch(() => null);
    const body = safeBody(raw);
    const result = { target, http_status: response.status, ...body };
    return { ok: response.ok && body.status === 'ok', result };
  } catch {
    return { ok: false, result: { status: 'unavailable', target, reason: 'network' } };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const target = process.env.OPS_HEALTH_TARGET || 'staging';
  const checked = await checkOpsHealth({
    url: process.env.OPS_HEALTH_URL,
    token: process.env.OPS_HEALTH_TOKEN,
    target,
  });
  writeFileSync(RESULT_FILE, `${JSON.stringify(checked.result, null, 2)}\n`);
  console.log(`${checked.ok ? 'ok' : 'degraded'}  ${target} operations health`);
  process.exit(checked.ok ? 0 : 1);
}
