import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  read,
  runP4Admission,
  sha256,
  validateP4AdmissionBundle,
  verifyP4AdmissionObservation,
} from './team-service-p4-admission.mjs';

const bundlePath = process.env.AC24_P4_BUNDLE_PATH ?? 'docs/team/service-flow-p4-admission-bundle.json';
const bundle = JSON.parse(read(bundlePath));
const runId = process.env.AC24_RUN_ID ?? 'AC24-P4-LOCAL';
assert.match(runId, /^AC24-P4-[A-Z0-9-]+$/);

test('AC-24 P4 entry validates exact PLAN_TEST evidence and no implementation or send authority', () => {
  assert.equal(validateP4AdmissionBundle(bundle), true);
  const baseline = spawnSync('git', ['merge-base', '--is-ancestor', bundle.authority_commit, 'HEAD'], { encoding: 'utf8' });
  assert.equal(baseline.status, 0, 'BUNDLE_AUTHORITY_BASELINE_NOT_ANCESTOR');
  const observation = runP4Admission(bundle);
  assert.equal(verifyP4AdmissionObservation(observation, bundle), true);
  for (const changed of [
    { ...observation, normal_dispatch_attempts: 1 },
    { ...observation, actual_provider_calls: 1 },
    { ...observation, service_ready: true },
    { ...observation, p4_implementation_authorized: true },
    { ...observation, entry_validates_future_implementation: true },
    { ...observation, existing_future_implementation: ['scripts/team-service-store.mjs'] },
  ]) assert.throws(() => verifyP4AdmissionObservation(changed, bundle));
  console.log(`AC24_P4_OBSERVATION ${JSON.stringify({
    ...observation,
    run_id: runId,
    snapshot: 'COMMITTED_AUTHORITY_WITH_HASHED_PLAN_TEST_BUNDLE',
    bundle_sha256: sha256(read(bundlePath)),
    test_sha256: sha256(read('scripts/team-service-p4-no-dispatch.test.mjs')),
    runner_sha256: sha256(read('scripts/team-service-p4-admission.mjs')),
  })}`);
});

test('AC-24 P4 rejects omitted, drifted, duplicated and implementation-present inputs', () => {
  assert.throws(() => validateP4AdmissionBundle({ ...bundle, evidence: bundle.evidence.slice(1) }));
  assert.throws(() => validateP4AdmissionBundle({ ...bundle, evidence: [...bundle.evidence, bundle.evidence[0]] }));
  assert.throws(() => validateP4AdmissionBundle(bundle, () => Buffer.from('changed')), /EVIDENCE_DRIFT/);
  assert.throws(
    () => runP4Admission(bundle, read, (name) => name === 'scripts/team-service-driver.mjs'),
    /P4_IMPLEMENTATION_APPEARED_BEFORE_ADMISSION/,
  );
});

test('P4 plan contract tests pass independently without turning admission into implementation approval', () => {
  const child = spawnSync(process.execPath, ['--test', 'scripts/team-service-p4-contract.test.mjs'], {
    encoding: 'utf8',
    timeout: 15000,
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH },
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.match(child.stdout, /pass 6/);
});
