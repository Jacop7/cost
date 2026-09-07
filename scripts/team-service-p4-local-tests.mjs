import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const P4_LOCAL_TEST_ALLOWLIST = Object.freeze([
  'scripts/team-service-p4-contract.test.mjs',
  'scripts/team-service-store.test.mjs',
  'scripts/team-service-driver.test.mjs',
  'scripts/team-service-runtime-acl.test.mjs',
]);

const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};

export function validateP4Allowlist() {
  requireValue(new Set(P4_LOCAL_TEST_ALLOWLIST).size === P4_LOCAL_TEST_ALLOWLIST.length, 'DUPLICATE_P4_TEST');
  requireValue(P4_LOCAL_TEST_ALLOWLIST.every((path) => /^scripts\/team-service-[a-z0-9-]+\.test\.mjs$/.test(path)), 'INVALID_P4_TEST_PATH');
  requireValue(P4_LOCAL_TEST_ALLOWLIST.every((path) => !path.includes('.live.test.')), 'LIVE_TEST_IN_P4_ALLOWLIST');
  return [...P4_LOCAL_TEST_ALLOWLIST];
}

export function runP4LocalTests({ cwd = resolve(fileURLToPath(new URL('..', import.meta.url))) } = {}) {
  const tests = validateP4Allowlist();
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      TEAM_SERVICE_LIVE_ALLOWED: '0',
      TEAM_ROUTER_RUNTIME_ALLOWED: '0',
    },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  if (process.argv.length === 3 && process.argv[2] === '--list-json') {
    process.stdout.write(`${JSON.stringify({
      tests: validateP4Allowlist(),
      dispatch_attempts: 0,
      actual_provider_calls: 0,
      real_transport_available: false,
    })}\n`);
  } else if (process.argv.length === 2) {
    process.exitCode = runP4LocalTests();
  } else {
    console.error('Usage: node scripts/team-service-p4-local-tests.mjs [--list-json]');
    process.exitCode = 2;
  }
}
