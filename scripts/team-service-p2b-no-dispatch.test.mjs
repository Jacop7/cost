import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { importsOf } from './team-service-admission.mjs';
import { readFileSync } from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const bundlePath = process.env.AC24_BUNDLE_PATH ?? 'docs/team/service-flow-p2b-completion-bundle-003.json';
const bytes = (name) => readFileSync(path.join(root, name));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (from, specifier) => path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));

function validate(bundle, readSource = bytes) {
  assert.equal(bundle.kind, 'EXACT_P2B_COMPLETION_BUNDLE');
  assert.equal(bundle.gate_id, 'P2b');
  assert.equal(bundle.profile_id, 'P2B');
  assert.deepEqual(bundle.target_modules, ['scripts/team-service-intent-store.mjs']);
  assert.equal(bundle.scenario, 'scripts/team-service-p2b-scenario.mjs');
  assert.deepEqual(bundle.scenario_ids, ['AC-10']);
  const pins = new Map(bundle.modules.map((item) => [item.path, item.sha256]));
  assert.equal(pins.size, bundle.modules.length, 'DUPLICATE_MODULE');
  const closure = new Map();
  const visit = (name) => {
    if (closure.has(name)) return;
    assert.match(name, /^scripts\/[a-z0-9-]+\.mjs$/, 'FORBIDDEN_PATH');
    assert.ok(pins.has(name), `MISSING_IMPORT:${name}`);
    const sourceBytes = readSource(name);
    assert.equal(sha256(sourceBytes), pins.get(name), `SOURCE_DRIFT:${name}`);
    const source = sourceBytes.toString('utf8');
    closure.set(name, source);
    for (const specifier of importsOf(source)) {
      if (specifier.startsWith('node:')) assert.equal(specifier, 'node:crypto', `FORBIDDEN_IMPORT:${specifier}`);
      else visit(normalize(name, specifier));
    }
  };
  for (const entry of [...bundle.target_modules, bundle.scenario]) visit(entry);
  assert.deepEqual([...closure.keys()].sort(), [...pins.keys()].sort(), 'EXTRA_OR_MISSING_CLOSURE');
  for (const fixture of bundle.fixture_files) assert.equal(sha256(readSource(fixture.path)), fixture.sha256, `FIXTURE_DRIFT:${fixture.path}`);
  for (const harness of bundle.harness_files) assert.equal(sha256(readSource(harness.path)), harness.sha256, `HARNESS_DRIFT:${harness.path}`);
  return closure;
}

async function run(bundle) {
  const closure = validate(bundle);
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(`
    globalThis.attempts=[];
    globalThis.deny=(kind)=>{ attempts.push(kind); throw new Error('NO_DISPATCH:'+kind); };
    globalThis.fetch=()=>deny('fetch');
    globalThis.WebSocket=function(){ return deny('websocket'); };
    globalThis.fixtureTransport=Object.freeze({send:()=>deny('transport')});
    globalThis.structuredClone=(value)=>JSON.parse(JSON.stringify(value));
  `, context);
  const cache = new Map();
  const load = (name) => {
    if (cache.has(name)) return cache.get(name);
    if (name === 'node:crypto') {
      const module = new vm.SyntheticModule(['createHash'], function setExports() { this.setExport('createHash', createHash); }, { context, identifier: name });
      cache.set(name, module);
      return module;
    }
    assert.ok(closure.has(name), `UNPINNED_MODULE:${name}`);
    const module = new vm.SourceTextModule(closure.get(name), {
      context, identifier: name,
      initializeImportMeta(meta) { meta.url = pathToFileURL(path.join(root, name)).href; },
      importModuleDynamically() { throw new Error('DYNAMIC_IMPORT_FORBIDDEN'); },
    });
    cache.set(name, module);
    return module;
  };
  const scenario = load(bundle.scenario);
  await scenario.link((specifier, referencing) => specifier.startsWith('node:') ? load(specifier) : load(normalize(referencing.identifier, specifier)));
  await scenario.evaluate({ timeout: 2000 });
  const observation = JSON.parse(JSON.stringify(scenario.namespace.observation));
  assert.equal(vm.runInContext('attempts.length', context), 0, 'NORMAL_DISPATCH_ATTEMPT');
  for (const expression of ["fetch('https://invalid.local')", "new WebSocket('wss://invalid.local')", 'fixtureTransport.send()']) {
    assert.throws(() => vm.runInContext(expression, context), /NO_DISPATCH/);
  }
  assert.equal(vm.runInContext('attempts.length', context), 3);
  validate(bundle);
  return { observation, import_closure: [...closure.keys()].sort(), normal_dispatch_attempts: 0,
    negative_fake_attempts: 3, actual_provider_calls: 0, service_ready: false };
}

test('AC-24 P2B completion contract', async () => {
  const bundle = JSON.parse(bytes(bundlePath));
  const result = await run(bundle);
  assert.deepEqual(Object.keys(result.observation.assertions), bundle.assertion_ids);
  assert.equal(result.observation.passed, 7);
  assert.equal(result.observation.failed, 0);
  assert.equal(result.normal_dispatch_attempts, 0);
  assert.equal(result.actual_provider_calls, 0);
  assert.equal(result.negative_fake_attempts, 3);
  assert.equal(result.service_ready, false);
  console.log(`AC24_P2B_OBSERVATION ${JSON.stringify(result)}`);
});

test('AC-24 P2B rejects omitted, extra, drifted and forbidden closure', () => {
  const bundle = JSON.parse(bytes(bundlePath));
  assert.throws(() => validate({ ...bundle, modules: bundle.modules.slice(1) }), /MISSING_IMPORT/);
  assert.throws(() => validate({ ...bundle, modules: [...bundle.modules, { path: 'scripts/unused.mjs', sha256: '0'.repeat(64) }] }), /EXTRA_OR_MISSING_CLOSURE/);
  assert.throws(() => validate({ ...bundle, modules: bundle.modules.map((item, index) => index === 0 ? { ...item, sha256: '0'.repeat(64) } : item) }), /SOURCE_DRIFT/);
  const target = bundle.target_modules[0];
  const forbidden = Buffer.from("import 'node:http';");
  const altered = { ...bundle, modules: bundle.modules.map((item) => item.path === target ? { ...item, sha256: sha256(forbidden) } : item) };
  assert.throws(() => validate(altered, (name) => name === target ? forbidden : bytes(name)), /FORBIDDEN_IMPORT/);
  assert.throws(() => importsOf("import('node:http')"), /DYNAMIC_IMPORT/);
});
