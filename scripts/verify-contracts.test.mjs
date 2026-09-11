import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runContractChecks } from './verify-contracts.mjs';

const run = (reply = () => true, bash = 'bash') => {
  const calls = [];
  const log = console.log;
  const error = console.error;
  try {
    console.log = console.error = () => {};
    const ok = runContractChecks((cmd, args) => {
      calls.push([cmd, ...args]);
      return reply(calls.length);
    }, bash);
    return { ok, calls };
  } finally { console.log = log; console.error = error; }
};
test('all contracts run even when the first one fails', () => {
  const pass = run();
  const failed = run(index => index !== 1);
  assert.equal(pass.ok, true);
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.calls, pass.calls);
  assert.equal(failed.calls.at(-1)[1], 'packages/db/scripts/admin-acl.test.sh');
});
test('exceptions are failures but do not conceal later checks', () => {
  const result = run(index => { if (index === 2) throw new Error('spawn failed'); return true; });
  assert.equal(result.ok, false);
  assert.deepEqual(result.calls, run().calls);
});
test('missing Bash still fails the security stage', () => assert.equal(run(() => true, null).ok, false));
test('current quality replaces historical exact snapshots, not security or native checks', () => {
  const commands = run().calls.map(parts => parts.join(' '));
  assert.ok(commands.includes('node scripts/design-token-s4-check.mjs --current'));
  assert.ok(!commands.includes('node scripts/three-surface-p0-check.mjs'));
  assert.ok(!commands.includes('node scripts/design-token-s4-check.mjs'));
  for (const required of [
    'scripts/three-surface-sync-check.mjs', 'scripts/three-surface-visual-diff-check.mjs',
    'scripts/three-surface-byte-artifacts-check.mjs', 'scripts/design-token-contrast.mjs',
    'scripts/design-token-color-usage.mjs', 'scripts/touch-target-audit.mjs',
    'scripts/native-touch-runtime-evidence-check.mjs --verify-receipt',
    'scripts/native-text-scale-evidence-check.mjs', 'scripts/protected-gate-validator.test.mjs',
    'packages/db/scripts/deploy-guard.test.mjs', 'packages/db/scripts/admin-acl-source-scan.test.mjs',
    'scripts/docs-graph-check.mjs --activation',
  ]) assert.ok(commands.includes('node ' + required), 'Required contract lost: ' + required);
});
