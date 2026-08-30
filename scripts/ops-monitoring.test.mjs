import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleOpsHealth, safeEqual, serviceKeyOf } from '../packages/db/supabase/functions/ops-health/index.mjs';
import { checkOpsHealth } from './check-ops-health.mjs';
import { syncOpsIssue } from './sync-ops-health-issue.mjs';

const env = (values) => ({ get: (key) => values[key] ?? null });
const request = (token = 'monitor-token', method = 'GET') =>
  new Request('https://example.test/functions/v1/ops-health', {
    method, headers: token ? { 'x-ops-health-token': token } : {},
  });

assert.equal(safeEqual('same', 'same'), true);
assert.equal(safeEqual('same', 'different'), false);
assert.equal(serviceKeyOf(env({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}' })), 'sb_secret_test');
assert.equal(serviceKeyOf(env({ SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' })), 'eyJlegacy');

let called = false;
let response = await handleOpsHealth(request(), env({}), async () => {
  called = true; throw new Error('호출되면 안 됨');
});
assert.equal(response.status, 401);
assert.deepEqual(await response.json(), { status: 'unauthorized' });
assert.equal(called, false);

called = false;
response = await handleOpsHealth(request('wrong'), env({ OPS_HEALTH_TOKEN: 'monitor-token' }), async () => {
  called = true; throw new Error('호출되면 안 됨');
});
assert.equal(response.status, 401);
assert.deepEqual(await response.json(), { status: 'unauthorized' });
assert.equal(called, false);

response = await handleOpsHealth(request(), env({ OPS_HEALTH_TOKEN: 'monitor-token' }));
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { status: 'unavailable' });

const healthyBody = {
  status: 'ok', checked_at: '2026-08-30T00:00:00Z',
  cron: { monitored: true, healthy: true, jobs: [] },
  rpc: { source: 'client_reported', warning: false, window_minutes: 15, unexpected_count: 0, affected_users: 0, fingerprints: [] },
};
let captured;
response = await handleOpsHealth(
  request(),
  env({ OPS_HEALTH_TOKEN: 'monitor-token', SUPABASE_URL: 'https://project.test', SUPABASE_SERVICE_ROLE_KEY: 'eyJlegacy' }),
  async (url, init) => { captured = { url, init }; return Response.json(healthyBody); },
);
assert.equal(response.status, 200);
assert.equal(captured.url, 'https://project.test/rest/v1/rpc/ops_health_status');
assert.equal(captured.init.headers.authorization, 'Bearer eyJlegacy');

response = await handleOpsHealth(
  request(),
  env({ OPS_HEALTH_TOKEN: 'monitor-token', SUPABASE_URL: 'https://project.test', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}' }),
  async () => Response.json({
    ...healthyBody,
    rpc: { ...healthyBody.rpc, warning: true, unexpected_count: 1, affected_users: 1 },
  }),
);
assert.equal(response.status, 200);
assert.equal((await response.json()).rpc.warning, true);

response = await handleOpsHealth(
  request(),
  env({ OPS_HEALTH_TOKEN: 'monitor-token', SUPABASE_URL: 'https://project.test', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}' }),
  async (_url, init) => {
    assert.equal(init.headers.apikey, 'sb_secret_test');
    assert.equal('authorization' in init.headers, false);
    return Response.json({ ...healthyBody, status: 'degraded' });
  },
);
assert.equal(response.status, 503);

response = await handleOpsHealth(
  request(),
  env({ OPS_HEALTH_TOKEN: 'monitor-token', SUPABASE_URL: 'https://project.test', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}' }),
  async () => new Response(JSON.stringify({ error: 'sb_secret_test eyJlegacy 내부 오류' }), { status: 500 }),
);
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { status: 'unavailable' });

response = await handleOpsHealth(
  request(),
  env({ OPS_HEALTH_TOKEN: 'monitor-token', SUPABASE_URL: 'https://project.test', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}' }),
  async () => Response.json({ ...healthyBody, cron: { ...healthyBody.cron, healthy: false } }),
);
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { status: 'unavailable' });

response = await handleOpsHealth(
  request(),
  env({ OPS_HEALTH_TOKEN: 'monitor-token', SUPABASE_URL: 'https://project.test', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test"}' }),
  async () => { throw new Error('sb_secret_test eyJlegacy fetch failure'); },
);
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { status: 'unavailable' });

const checkedOk = await checkOpsHealth({
  url: 'https://project.test/functions/v1/ops-health', token: 'monitor-token', target: 'staging',
  fetchImpl: async () => Response.json(healthyBody),
});
assert.equal(checkedOk.ok, true);
assert.equal(checkedOk.result.rpc.source, 'client_reported');
assert.equal(checkedOk.result.rpc.warning, false);

const rpcWarningBody = {
  ...healthyBody,
  rpc: { ...healthyBody.rpc, warning: true, unexpected_count: 1, affected_users: 1 },
};
const checkedWarning = await checkOpsHealth({
  url: 'https://project.test/functions/v1/ops-health', token: 'monitor-token', target: 'staging',
  fetchImpl: async () => Response.json(rpcWarningBody),
});
assert.equal(checkedWarning.ok, true);
assert.equal(checkedWarning.result.status, 'ok');
assert.equal(checkedWarning.result.rpc.warning, true);

const checkedBad = await checkOpsHealth({
  url: 'https://project.test/functions/v1/ops-health', token: 'monitor-token', target: 'staging',
  fetchImpl: async () => Response.json({ ...healthyBody, status: 'degraded' }, { status: 503 }),
});
assert.equal(checkedBad.ok, false);

const githubCalls = [];
const githubFetch = async (url, init = {}) => {
  githubCalls.push({ url, init });
  if (url.includes('/issues?')) return Response.json([]);
  return Response.json({ number: 7, state: 'open' }, { status: 201 });
};
assert.deepEqual(await syncOpsIssue({
  token: 'token', repo: 'owner/repo', healthy: false,
  result: { target: 'staging', status: 'degraded', cron: { healthy: false } },
  runUrl: 'https://run.test/1', fetchImpl: githubFetch,
}), { cron: 'created', rpc: 'unchanged' });
assert.equal(githubCalls.length, 2);
assert.match(githubCalls[0].url, /state=open&per_page=100&sort=updated&direction=desc/);
assert.match(githubCalls[1].init.body, /MarginCook/);
assert.match(githubCalls[1].init.body, /cron degraded/);

const recoveryCalls = [];
assert.deepEqual(await syncOpsIssue({
  token: 'token', repo: 'owner/repo', healthy: true,
  result: { target: 'staging', status: 'ok' }, runUrl: 'https://run.test/2',
  fetchImpl: async (url, init = {}) => {
    recoveryCalls.push({ url, init });
    if (url.includes('/issues?')) return Response.json([{ number: 9, state: 'open', title: '[ops-health] staging cron degraded' }]);
    return Response.json({ ok: true });
  },
}), { cron: 'closed', rpc: 'unchanged' });
assert.equal(recoveryCalls.length, 3);
assert.match(recoveryCalls[2].init.body, /closed/);

const warningCalls = [];
assert.deepEqual(await syncOpsIssue({
  token: 'token', repo: 'owner/repo', healthy: true,
  result: { target: 'staging', status: 'ok', rpc: rpcWarningBody.rpc },
  runUrl: 'https://run.test/3',
  fetchImpl: async (url, init = {}) => {
    warningCalls.push({ url, init });
    if (url.includes('/issues?')) return Response.json([]);
    return Response.json({ number: 10, state: 'open' }, { status: 201 });
  },
}), { cron: 'unchanged', rpc: 'created' });
assert.equal(warningCalls.length, 2);
assert.match(warningCalls[1].init.body, /rpc warning/);
assert.match(warningCalls[1].init.body, /Cron 장애나 정확한 오류율이 아닙니다/);

const workflow = readFileSync('.github/workflows/operations-health.yml', 'utf8');
assert.match(workflow, /cron: ['"]\*\/10 \* \* \* \*['"]/);
assert.match(workflow, /issues:\s*write/);
assert.match(workflow, /STAGING_OPS_HEALTH_URL/);
assert.match(workflow, /sync-ops-health-issue\.mjs/);
assert.doesNotMatch(workflow, /PRODUCTION_OPS_HEALTH/);
assert.doesNotMatch(workflow, /actions\/(checkout|setup-node)@v4/);
assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
assert.match(workflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);

console.log('ops monitoring contract 통과');
