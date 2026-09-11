import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  authorizeLiveLauncher,
  LIVE_TEST_PATTERN,
  LOCAL_TEST_ALLOWLIST,
  verifyP3CompletionBundle,
} from './team-service-local-tests.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('AC-22 service contract', () => {
  assert.equal(LIVE_TEST_PATTERN, '**/*.live.test.*');
  assert.ok(LOCAL_TEST_ALLOWLIST.includes('scripts/team-service-live-isolation.test.mjs'));
  assert.equal(LOCAL_TEST_ALLOWLIST.some((path) => path.includes('.live.test.')), false);

  const listed = spawnSync(process.execPath, ['scripts/team-service-local-tests.mjs', '--list-json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TEAM_SERVICE_LIVE_ALLOWED: '0' },
  });
  assert.equal(listed.status, 0, listed.stderr);
  const selection = JSON.parse(listed.stdout);
  assert.deepEqual(selection.tests, [...LOCAL_TEST_ALLOWLIST]);
  assert.deepEqual(selection.excluded, [LIVE_TEST_PATTERN]);
  assert.equal(selection.tests.some((path) => path.includes('.live.test.')), false);

  const verifySource = readFileSync(join(root, 'scripts/verify.mjs'), 'utf8');
  assert.match(verifySource, /runContractChecks\(run, BASH\)/);
  const contractsSource = readFileSync(join(root, 'scripts/verify-contracts.mjs'), 'utf8');
  assert.match(contractsSource, /check\('node', \['scripts\/team-service-local-tests\.mjs'\]\)/);
  assert.doesNotMatch(verifySource, /team-service\.live\.test/);
  assert.doesNotMatch(contractsSource, /team-service\.live\.test/);

  const vitestSource = readFileSync(join(root, 'apps/mobile/vitest.config.ts'), 'utf8');
  assert.match(vitestSource, /configDefaults\.exclude/);
  assert.match(vitestSource, /\*\*\/\*\.live\.test\.\*/);

  const markerDir = join(root, 'apps/mobile/tests/.team-service-live-isolation');
  const marker = join(markerDir, 'marker.live.test.ts');
  const control = join(markerDir, 'control.test.ts');
  mkdirSync(markerDir, { recursive: true });
  try {
    writeFileSync(marker, "throw new Error('LIVE_MARKER_LOADED');\n", 'utf8');
    writeFileSync(control, "import { expect, test } from 'vitest'; test('control', () => expect(true).toBe(true));\n", 'utf8');
    const vitest = join(root, 'node_modules/vitest/vitest.mjs');
    const probe = spawnSync(process.execPath, [vitest, 'run', `tests/${basename(markerDir)}`], {
      cwd: join(root, 'apps/mobile'),
      encoding: 'utf8',
    });
    assert.equal(probe.status, 0, `${probe.stdout}\n${probe.stderr}`);
    assert.doesNotMatch(`${probe.stdout}\n${probe.stderr}`, /LIVE_MARKER_LOADED|marker\.live\.test/);
    assert.match(`${probe.stdout}\n${probe.stderr}`, /control\.test\.ts/);
  } finally {
    rmSync(markerDir, { recursive: true, force: true });
  }

  let providerAccess = 0;
  const providerFactory = () => { providerAccess += 1; return { kind: 'LOCAL_FAKE_PROVIDER' }; };
  const expected = {
    capability: 'ACK_ONLY_WAKE_PROBE',
    scope: 'NON_PRODUCTION_PROBE_ONLY',
    bundle_sha256: 'a'.repeat(64),
    decision_id: 'DEC-LIVE-01',
  };
  const base = {
    capability: expected.capability,
    scope: expected.scope,
    bundle_sha256: expected.bundle_sha256,
  };
  assert.throws(() => authorizeLiveLauncher(base, expected, providerFactory), /LIVE_DECISION_REQUIRED/);
  assert.equal(providerAccess, 0);
  assert.throws(() => authorizeLiveLauncher({
    ...base,
    capability: 'GENERAL_DISPATCH',
    decision: { decision_id: expected.decision_id, revoked: false, expires_at: '2031-01-01T00:00:00Z' },
  }, expected, providerFactory, { nowMs: Date.parse('2030-01-01T00:00:00Z') }), /LIVE_CAPABILITY_MISMATCH/);
  assert.equal(providerAccess, 0);
  const provider = authorizeLiveLauncher({
    ...base,
    decision: { decision_id: expected.decision_id, revoked: false, expires_at: '2031-01-01T00:00:00Z' },
  }, expected, providerFactory, { nowMs: Date.parse('2030-01-01T00:00:00Z') });
  assert.equal(provider.kind, 'LOCAL_FAKE_PROVIDER');
  assert.equal(providerAccess, 1);
});

const completionBundle = process.env.P3_COMPLETION_BUNDLE_PATH;
if (completionBundle) {
  test('AC-24 P3 completion bundle is exact and remains no-send', () => {
    assert.equal(existsSync(resolve(root, completionBundle)), true);
    const observation = verifyP3CompletionBundle(completionBundle, { cwd: root });
    assert.deepEqual(observation.scenario_ids, ['AC-01', 'AC-03', 'AC-06', 'AC-07', 'AC-22']);
    assert.equal(observation.target_modules.length, 14);
    assert.equal(observation.dispatch_attempts, 0);
    assert.equal(observation.actual_provider_calls, 0);
    assert.equal(observation.service_ready, false);
    assert.equal(observation.real_send_authorized, false);
  });
}
