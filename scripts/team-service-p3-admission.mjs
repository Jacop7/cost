// P3 PLAN_TEST only: evaluates an exact local entry bundle in a capability-limited VM.
// This is neither OS isolation nor authorization for implementation or dispatch.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { importsOf } from './team-service-admission.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const builtins = new Set(['node:crypto', 'node:path', 'node:url', 'node:fs']);
const targetModules = ['scripts/team-service-intent-store.mjs', 'scripts/team-service-workflow.mjs'];
const scenarioIds = ['AC-01', 'AC-03', 'AC-06', 'AC-07', 'AC-22'];
const harnessPaths = [
  'scripts/team-service-p3-admission.mjs',
  'scripts/team-service-p3-no-dispatch.test.mjs',
  'scripts/team-service-p3-contract.test.mjs',
  'scripts/team-service-router-adapter.test.mjs',
  'scripts/team-service-workflow.test.mjs',
];
const scenarioPaths = new Set([
  'scripts/team-service-p3-admission-scenario.mjs',
  'scripts/team-service-admission-negative-fixture.mjs',
]);

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const read = (name) => readFileSync(path.join(root, name));
const normalize = (from, specifier) => {
  assert.ok(specifier.startsWith('./') || specifier.startsWith('../'), 'FORBIDDEN_IMPORT');
  const result = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  assert.match(result, /^scripts\/[a-z0-9-]+\.mjs$/, 'FORBIDDEN_PATH');
  return result;
};

export function validateP3Bundle(bundle, readSource = read) {
  assert.equal(bundle.kind, 'AC24_P3_ADMISSION_FIXTURE_ONLY');
  assert.equal(bundle.profile_id, 'P3');
  assert.match(bundle.bundle_commit, /^[a-f0-9]{40}$/);
  assert.deepEqual(bundle.target_modules, targetModules);
  assert.deepEqual(bundle.scenario_ids, scenarioIds);
  assert.ok(scenarioPaths.has(bundle.scenario), 'UNSUPPORTED_SCENARIO');
  assert.deepEqual(bundle.harness_files.map((file) => file.path).sort(), [...harnessPaths].sort(), 'INCOMPLETE_HARNESS');
  assert.equal(bundle.entry_validates_future_implementation, false);
  assert.equal(bundle.completion_rerun_required, true);
  assert.equal(bundle.requires_ac22, false);
  assert.ok(bundle.modules.length > 0, 'EMPTY_BUNDLE');

  const pins = new Map(bundle.modules.map((module) => [module.path, module.sha256]));
  assert.equal(pins.size, bundle.modules.length, 'DUPLICATE_MODULE');
  const sources = new Map();
  function visit(name) {
    if (sources.has(name)) return;
    assert.match(name, /^scripts\/[a-z0-9-]+\.mjs$/, 'FORBIDDEN_PATH');
    assert.ok(pins.has(name), `MISSING_IMPORT:${name}`);
    const bytes = readSource(name);
    assert.equal(sha256(bytes), pins.get(name), `SOURCE_DRIFT:${name}`);
    const source = bytes.toString('utf8');
    sources.set(name, source);
    for (const specifier of importsOf(source)) {
      if (specifier.startsWith('node:')) assert.ok(builtins.has(specifier), `FORBIDDEN_IMPORT:${specifier}`);
      else visit(normalize(name, specifier));
    }
  }
  for (const entry of [...bundle.target_modules, bundle.scenario]) visit(entry);
  assert.deepEqual([...sources.keys()].sort(), [...pins.keys()].sort(), 'EXTRA_OR_MISSING_CLOSURE');
  for (const file of bundle.harness_files) {
    assert.equal(sha256(readSource(file.path)), file.sha256, `HARNESS_DRIFT:${file.path}`);
  }
  return sources;
}

export async function runP3Admission(bundle, readSource = read) {
  const sources = validateP3Bundle(bundle, readSource);
  assert.equal(typeof vm.SourceTextModule, 'function', 'REQUIRES_EXPERIMENTAL_VM_MODULES');
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(`
    globalThis.attempts = [];
    globalThis.deny = (kind) => { attempts.push(kind); throw new Error('NO_DISPATCH:' + kind); };
    globalThis.fixtureTransport = Object.freeze({send: () => deny('fake-send')});
    globalThis.fetch = () => deny('fetch');
    globalThis.WebSocket = function() { return deny('websocket'); };
    globalThis.process = Object.freeze({argv:Object.freeze([]), env:Object.freeze({})});
    globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
  `, context, { timeout: 1000 });
  const cache = new Map();
  function builtin(specifier) {
    if (cache.has(specifier)) return cache.get(specifier);
    let exports;
    if (specifier === 'node:crypto') exports = { createHash };
    else if (specifier === 'node:path') exports = Object.fromEntries(
      ['dirname', 'isAbsolute', 'join', 'normalize', 'relative', 'resolve'].map((key) => [key, path[key]]),
    );
    else if (specifier === 'node:url') exports = { fileURLToPath };
    else if (specifier === 'node:fs') exports = Object.fromEntries(
      ['existsSync', 'readFileSync', 'readdirSync'].map((key) => [key, vm.runInContext(`() => deny('fs:${key}')`, context)]),
    );
    else throw new Error('FORBIDDEN_IMPORT');
    const module = new vm.SyntheticModule(Object.keys(exports), function setExports() {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context, identifier: specifier });
    cache.set(specifier, module);
    return module;
  }
  function local(name) {
    if (cache.has(name)) return cache.get(name);
    assert.ok(sources.has(name), 'UNPINNED_MODULE');
    const module = new vm.SourceTextModule(sources.get(name), {
      context,
      identifier: name,
      initializeImportMeta(meta) { meta.url = pathToFileURL(path.join(root, name)).href; },
      importModuleDynamically() { throw new Error('DYNAMIC_IMPORT_FORBIDDEN'); },
    });
    cache.set(name, module);
    return module;
  }
  const scenario = local(bundle.scenario);
  await scenario.link((specifier, referencing) => (
    specifier.startsWith('node:') ? builtin(specifier) : local(normalize(referencing.identifier, specifier))
  ));
  await scenario.evaluate({ timeout: 1000 });
  const normal = JSON.parse(JSON.stringify(scenario.namespace.observation));
  assert.equal(vm.runInContext('attempts.length', context), 0, 'NORMAL_CAPABILITY_ATTEMPT');
  const negativeRejections = [];
  for (const [id, expression] of [
    ['fake-send', 'fixtureTransport.send()'],
    ['fetch', "fetch('https://invalid.local')"],
    ['websocket', "new WebSocket('wss://invalid.local')"],
  ]) {
    assert.throws(() => vm.runInContext(expression, context, { timeout: 1000 }), /NO_DISPATCH:/);
    negativeRejections.push(id);
  }
  const fsModule = cache.get('node:fs');
  assert.throws(() => fsModule.namespace.readFileSync('never-read'), /NO_DISPATCH:fs/);
  negativeRejections.push('fs:readFileSync');
  validateP3Bundle(bundle, readSource);
  return {
    kind: 'AC24_P3_ADMISSION_OBSERVATION_NOT_GATE_APPROVAL',
    profile_id: 'P3',
    bundle_commit: bundle.bundle_commit,
    target_modules: bundle.target_modules,
    scenario_ids: bundle.scenario_ids,
    import_closure: [...sources.keys()].sort(),
    module_sha256: bundle.modules,
    normal_dispatch_attempts: 0,
    negative_fake_attempts: negativeRejections.length,
    negative_rejections: negativeRejections,
    actual_provider_calls: 0,
    normal,
    host_cases: ['AC-13', 'AC-14', 'AC-15', 'AC-16', 'AC-17'].map((case_id) => ({ case_id, status: 'BLOCKED_HOST' })),
    service_ready: false,
    admission_authorized: false,
    entry_validates_future_implementation: false,
    completion_rerun_required: true,
  };
}

export function verifyP3Observation(observation, bundle) {
  assert.equal(observation.kind, 'AC24_P3_ADMISSION_OBSERVATION_NOT_GATE_APPROVAL');
  assert.equal(observation.profile_id, 'P3');
  assert.equal(observation.bundle_commit, bundle.bundle_commit);
  assert.deepEqual(observation.target_modules, bundle.target_modules);
  assert.deepEqual(observation.scenario_ids, bundle.scenario_ids);
  assert.deepEqual(observation.module_sha256, bundle.modules);
  assert.deepEqual(observation.import_closure, bundle.modules.map((module) => module.path).sort());
  assert.equal(observation.normal_dispatch_attempts, 0);
  assert.equal(observation.actual_provider_calls, 0);
  assert.equal(observation.negative_fake_attempts, 4);
  assert.deepEqual(observation.negative_rejections, ['fake-send', 'fetch', 'websocket', 'fs:readFileSync']);
  assert.deepEqual(observation.normal, {
    p3_entry_status: 'READY',
    preserved_exports: ['applyServiceEvent', 'createServiceWorkflow', 'nextServiceAction'],
    non_human_role_count: 10,
    effect_key_equivalent_across_routes: true,
    dispatch_attempts: 0,
  });
  assert.equal(observation.service_ready, false);
  assert.equal(observation.admission_authorized, false);
  assert.equal(observation.entry_validates_future_implementation, false);
  assert.equal(observation.completion_rerun_required, true);
  return true;
}
