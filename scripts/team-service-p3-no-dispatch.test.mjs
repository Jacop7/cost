import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { importsOf } from './team-service-admission.mjs';
import { read, runP3Admission, sha256, validateP3Bundle, verifyP3Observation } from './team-service-p3-admission.mjs';

const bundlePath = process.env.AC24_P3_BUNDLE_PATH ?? 'docs/team/service-flow-p3-admission-bundle.json';
const bundle = JSON.parse(read(bundlePath));
const runId = process.env.AC24_RUN_ID ?? 'AC24-P3-LOCAL';
assert.match(runId, /^AC24-P3-[A-Z0-9-]+$/);

test('AC-24 P3 entry bundle is exact, no-send and does not validate future implementation', () => {
  const sources = validateP3Bundle(bundle);
  assert.equal(sources.size, bundle.modules.length, 'AC-24-A1');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  assert.equal(head.status, 0);
  assert.equal(head.stdout.trim(), bundle.bundle_commit);
  const script = `import {runP3Admission,read} from './scripts/team-service-p3-admission.mjs'; console.log(JSON.stringify(await runP3Admission(JSON.parse(read(${JSON.stringify(bundlePath)})))));`;
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 15000, env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH },
  });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(verifyP3Observation(result, bundle), true);
  for (const bad of [
    { ...result, normal_dispatch_attempts: 1 },
    { ...result, actual_provider_calls: 1 },
    { ...result, scenario_ids: [] },
    { ...result, import_closure: [] },
    { ...result, entry_validates_future_implementation: true },
    { ...result, normal: { ...result.normal, non_human_role_count: 9 } },
  ]) assert.throws(() => verifyP3Observation(bad, bundle));
  assert.equal(result.normal.p3_entry_status, 'READY', 'AC-24-A3');
  assert.equal(result.normal.non_human_role_count, 10, 'AC-06-A01');
  assert.equal(result.normal.effect_key_equivalent_across_routes, true, 'AC-03');
  assert.equal(result.normal_dispatch_attempts, 0, 'AC-24-A2');
  assert.equal(result.actual_provider_calls, 0, 'AC-24-A2');
  assert.equal(result.service_ready, false, 'AC-24-A4');
  console.log(`AC24_P3_OBSERVATION ${JSON.stringify({
    ...result,
    run_id: runId,
    snapshot: 'WORKING_TREE_HASHED',
    allowlist_sha256: sha256(read(bundlePath)),
    test_sha256: sha256(read('scripts/team-service-p3-no-dispatch.test.mjs')),
    runner_sha256: sha256(read('scripts/team-service-p3-admission.mjs')),
  })}`);
});

test('AC-24 P3 rejects omitted, extra, drifted and dynamic bundle inputs', () => {
  assert.throws(() => validateP3Bundle({ ...bundle, target_modules: [] }));
  assert.throws(() => validateP3Bundle({ ...bundle, scenario_ids: [] }));
  assert.throws(() => validateP3Bundle({ ...bundle, modules: bundle.modules.slice(1) }), /MISSING_IMPORT/);
  assert.throws(() => validateP3Bundle({
    ...bundle, modules: [...bundle.modules, { path: 'scripts/unused.mjs', sha256: '0'.repeat(64) }],
  }), /EXTRA_OR_MISSING/);
  assert.throws(() => validateP3Bundle(bundle, () => Buffer.from('changed')), /SOURCE_DRIFT/);
  assert.throws(() => importsOf("import('node:http')"), /DYNAMIC_IMPORT/);
});

test('AC-24 P3 target negative fixture is denied inside the same VM', () => {
  const negativePath = 'scripts/team-service-admission-negative-fixture.mjs';
  const negative = {
    ...bundle,
    scenario: negativePath,
    modules: [
      ...bundle.modules.filter((module) => module.path !== bundle.scenario),
      { path: negativePath, sha256: sha256(read(negativePath)) },
    ],
  };
  validateP3Bundle(negative);
  const encoded = JSON.stringify(JSON.stringify(negative));
  const script = `import assert from 'node:assert/strict'; import {runP3Admission} from './scripts/team-service-p3-admission.mjs'; await assert.rejects(()=>runP3Admission(JSON.parse(${encoded})),/NO_DISPATCH:fetch/); console.log('TARGET_NEGATIVE_DENIED');`;
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 15000, env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /TARGET_NEGATIVE_DENIED/);
});
