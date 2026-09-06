// PLAN_TEST only: evaluates the pinned cooperative reducer in a capability-limited VM.
// This is not an OS security sandbox or proof against malicious same-user code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const read = (name) => readFileSync(path.join(root, name));
const builtins = new Set(['node:crypto', 'node:path', 'node:url', 'node:fs']);
const normalize = (from, specifier) => {
  assert.ok(specifier.startsWith('./') || specifier.startsWith('../'), 'FORBIDDEN_IMPORT');
  const result = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  assert.match(result, /^scripts\/[a-z0-9-]+\.mjs$/, 'FORBIDDEN_PATH');
  return result;
};

export function importsOf(source) {
  const ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(ast.parseDiagnostics.length, 0, 'INVALID_SYNTAX');
  const imports = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      assert.ok(ts.isStringLiteral(node.moduleSpecifier), 'NON_LITERAL_IMPORT');
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, 'DYNAMIC_IMPORT_FORBIDDEN');
      if (ts.isIdentifier(node.expression)) assert.ok(!['require','eval','Function'].includes(node.expression.text), 'DYNAMIC_CODE_FORBIDDEN');
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return imports;
}

export function validateBundle(bundle, readSource = read) {
  const profiles = {
    ADMISSION: {
      kind: 'AC24_ADMISSION_FIXTURE_ONLY',
      scenarioIds: ['ADMISSION_ROUNDTRIP_STOP'],
      requiredHarness: ['scripts/team-service-workflow.test.mjs'],
    },
    FIX_BUNDLE: {
      kind: 'AC24_FIX_BUNDLE_ONLY',
      scenarioIds: ['BF-C1', 'BF-C2'],
      requiredHarness: ['scripts/team-service-workflow.test.mjs', 'scripts/team-service-bugfix.test.mjs'],
    },
  };
  const profile = profiles[bundle.profile_id];
  assert.ok(profile, 'UNSUPPORTED_PROFILE');
  assert.equal(bundle.kind, profile.kind);
  assert.match(bundle.bundle_commit, /^[a-f0-9]{40}$/);
  assert.deepEqual(bundle.target_modules, ['scripts/team-service-workflow.mjs']);
  assert.deepEqual(bundle.scenario_ids, profile.scenarioIds);
  assert.ok(['scripts/team-service-admission-scenario.mjs','scripts/team-service-admission-negative-fixture.mjs'].includes(bundle.scenario));
  assert.deepEqual(bundle.harness_files.map(f=>f.path).sort(),[
    'scripts/team-service-admission.mjs','scripts/team-service-no-dispatch.test.mjs',
    ...profile.requiredHarness].sort(), 'INCOMPLETE_HARNESS');
  assert.ok(bundle.modules.length > 0, 'EMPTY_BUNDLE');
  const pins = new Map(bundle.modules.map((m) => [m.path, m.sha256]));
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
  for (const file of bundle.harness_files) assert.equal(sha256(readSource(file.path)), file.sha256, `HARNESS_DRIFT:${file.path}`);
  return sources;
}

export async function runAdmission(bundle, readSource = read) {
  const sources = validateBundle(bundle, readSource);
  assert.equal(typeof vm.SourceTextModule, 'function', 'REQUIRES_EXPERIMENTAL_VM_MODULES');
  const context = vm.createContext({}, { codeGeneration:{ strings:false, wasm:false } });
  // Counter and throw are in the same realm as the target; never bind an actual provider.
  vm.runInContext(`
    globalThis.attempts = [];
    globalThis.deny = (kind) => { attempts.push(kind); throw new Error('NO_DISPATCH:' + kind); };
    globalThis.fixtureTransport = Object.freeze({send: () => deny('fake-send')});
    globalThis.fetch = () => deny('fetch');
    globalThis.WebSocket = function() { return deny('websocket'); };
    globalThis.process = Object.freeze({argv:Object.freeze([]), env:Object.freeze({})});
    globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
  `, context, { timeout:1000 });
  const cache = new Map();
  function builtin(specifier) {
    if (cache.has(specifier)) return cache.get(specifier);
    let exports;
    if (specifier === 'node:crypto') exports = {createHash};
    else if (specifier === 'node:path') exports = Object.fromEntries(['dirname','isAbsolute','join','normalize','relative','resolve'].map(k=>[k,path[k]]));
    else if (specifier === 'node:url') exports = {fileURLToPath};
    else if (specifier === 'node:fs') exports = Object.fromEntries(['existsSync','readFileSync','readdirSync'].map(k=>[k,vm.runInContext(`() => deny('fs:${k}')`,context)]));
    else throw new Error('FORBIDDEN_IMPORT');
    const module = new vm.SyntheticModule(Object.keys(exports), function() {
      for (const [key,value] of Object.entries(exports)) this.setExport(key,value);
    }, {context,identifier:specifier});
    cache.set(specifier,module);
    return module;
  }
  function local(name) {
    if (cache.has(name)) return cache.get(name);
    assert.ok(sources.has(name), 'UNPINNED_MODULE');
    const module = new vm.SourceTextModule(sources.get(name), {context, identifier:name,
      initializeImportMeta(meta) { meta.url = pathToFileURL(path.join(root,name)).href; },
      importModuleDynamically() { throw new Error('DYNAMIC_IMPORT_FORBIDDEN'); }});
    cache.set(name,module);
    return module;
  }
  const scenario = local(bundle.scenario);
  await scenario.link((specifier, referencing) => specifier.startsWith('node:')
    ? builtin(specifier) : local(normalize(referencing.identifier,specifier)));
  await scenario.evaluate({timeout:1000});
  const normal = JSON.parse(JSON.stringify(scenario.namespace.observation));
  assert.equal(vm.runInContext('attempts.length',context), 0, 'NORMAL_CAPABILITY_ATTEMPT');
  const negatives = [];
  for (const [id,expression] of [['fake-send','fixtureTransport.send()'],['fetch',"fetch('https://invalid.local')"],['websocket',"new WebSocket('wss://invalid.local')"]]) {
    assert.throws(()=>vm.runInContext(expression,context,{timeout:1000}), /NO_DISPATCH:/);
    negatives.push(id);
  }
  const fsModule = cache.get('node:fs');
  assert.throws(()=>fsModule.namespace.readFileSync('never-read'),/NO_DISPATCH:fs/);
  negatives.push('fs:readFileSync');
  assert.equal(vm.runInContext('attempts.length',context),negatives.length);
  assert.deepEqual(normal,{roundtrip_status:'COMPLETED',revision:18,stop_status:'STOPPED',legs:6});
  // Re-read all inputs after execution; no validation of a different working snapshot.
  validateBundle(bundle,readSource);
  return {kind:'AC24_NO_DISPATCH_OBSERVATION_NOT_GATE_APPROVAL',profile_id:bundle.profile_id,
    bundle_commit:bundle.bundle_commit,target_modules:bundle.target_modules,scenario_ids:bundle.scenario_ids,
    import_closure:[...sources.keys()].sort(),module_sha256:bundle.modules,
    normal_dispatch_attempts:0,negative_fake_attempts:negatives.length,negative_rejections:negatives,
    actual_provider_calls:0,normal,host_cases:['AC-13','AC-14','AC-15','AC-16','AC-17'].map(case_id=>({case_id,status:'BLOCKED_HOST'})),
    service_ready:false,admission_authorized:false,
    limitation:'Trusted cooperative fixture only, not OS isolation/host authentication/malicious-code sandbox. crypto/path/url expose host-realm objects and prototype chains; no adversarial containment claim. new Function is rejected by runtime codeGeneration, not the static call check.'};
}

export function verifyObservation(observation, bundle) {
  assert.equal(observation.kind,'AC24_NO_DISPATCH_OBSERVATION_NOT_GATE_APPROVAL');
  assert.equal(observation.profile_id,bundle.profile_id);
  assert.equal(observation.bundle_commit,bundle.bundle_commit);
  assert.deepEqual(observation.target_modules,bundle.target_modules);
  assert.deepEqual(observation.scenario_ids,bundle.scenario_ids);
  assert.deepEqual(observation.module_sha256,bundle.modules);
  assert.deepEqual(observation.import_closure,bundle.modules.map(m=>m.path).sort());
  assert.equal(observation.normal_dispatch_attempts,0);
  assert.equal(observation.actual_provider_calls,0);
  assert.equal(observation.negative_fake_attempts,4);
  assert.deepEqual(observation.negative_rejections,['fake-send','fetch','websocket','fs:readFileSync']);
  assert.deepEqual(observation.normal,{roundtrip_status:'COMPLETED',revision:18,stop_status:'STOPPED',legs:6});
  assert.deepEqual(observation.host_cases,['AC-13','AC-14','AC-15','AC-16','AC-17'].map(case_id=>({case_id,status:'BLOCKED_HOST'})));
  assert.equal(observation.service_ready,false);
  assert.equal(observation.admission_authorized,false);
  return true;
}
