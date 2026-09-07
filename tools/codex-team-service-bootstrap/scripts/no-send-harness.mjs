#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const pluginRoot = resolve(dirname(scriptPath), '..');
const harnessRoot = resolve(pluginRoot, 'harness');
const allowedBuiltins = new Set(['node:crypto', 'node:path', 'node:url']);
const stubbedBuiltins = new Set(['node:fs', 'node:fs/promises']);
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function parseWorkerOutput(text) {
  const value = JSON.parse(text);
  if (value.status !== 'PASS_LOCAL_NO_SEND_HARNESS') throw new Error(`NO_SEND_HARNESS_FAILED:${value.status}`);
  return value;
}

export function runNoSendHarness() {
  const stdout = execFileSync(process.execPath, [
    '--experimental-vm-modules', scriptPath, '--worker',
  ], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  return parseWorkerOutput(stdout);
}

async function syntheticBuiltin(vm, context, specifier) {
  if (stubbedBuiltins.has(specifier)) {
    const exports = specifier === 'node:fs/promises'
      ? { readFile: async (path) => path === 'fixture:payload' ? 'fixture-payload' : Promise.reject(new Error('NO_DISPATCH:fs')) }
      : { readFileSync: (path) => {
        if (path !== 'fixture:payload') throw new Error('NO_DISPATCH:fs');
        return 'fixture-payload';
      } };
    const module = new vm.SyntheticModule(Object.keys(exports), function evaluate() {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context, identifier: specifier });
    await module.link(() => { throw new Error('NO_DISPATCH:stub-import'); });
    await module.evaluate();
    return module;
  }
  if (!allowedBuiltins.has(specifier)) throw new Error(`NO_DISPATCH:import:${specifier}`);
  const namespace = await import(specifier);
  const module = new vm.SyntheticModule(Object.keys(namespace), function evaluate() {
    for (const name of Object.keys(namespace)) this.setExport(name, namespace[name]);
  }, { context, identifier: specifier });
  await module.link(() => { throw new Error('NO_DISPATCH:builtin-import'); });
  await module.evaluate();
  return module;
}

async function executeFixture(vm, fileName, counters) {
  const absolute = resolve(harnessRoot, fileName);
  if (dirname(absolute) !== harnessRoot) throw new Error('NO_DISPATCH:fixture-path');
  const source = readFileSync(absolute, 'utf8');
  const context = vm.createContext({
    fetch: async () => {
      counters.negative_fake_attempts += 1;
      throw new Error('NO_DISPATCH:fetch');
    },
  });
  const module = new vm.SourceTextModule(source, {
    context,
    identifier: pathToFileURL(absolute).href,
    initializeImportMeta(meta) { meta.url = pathToFileURL(absolute).href; },
    importModuleDynamically() { throw new Error('NO_DISPATCH:dynamic-import'); },
  });
  await module.link((specifier) => syntheticBuiltin(vm, context, specifier));
  await module.evaluate();
  const run = module.namespace.default;
  if (typeof run !== 'function') throw new Error(`NO_DISPATCH:fixture-export:${basename(absolute)}`);
  await run();
  return { path: `harness/${fileName}`, sha256: sha256(source) };
}

async function worker() {
  const vm = await import('node:vm');
  if (typeof vm.SourceTextModule !== 'function' || typeof vm.SyntheticModule !== 'function') {
    throw new Error('VM_MODULES_UNAVAILABLE');
  }
  const counters = { normal_dispatch_attempts: 0, negative_fake_attempts: 0, actual_provider_calls: 0 };
  const closure = [];
  closure.push(await executeFixture(vm, 'no-send-normal.mjs', counters));
  let forbiddenCallResult = null;
  try {
    await executeFixture(vm, 'no-send-forbidden.mjs', counters);
  } catch (error) {
    forbiddenCallResult = error.message;
    closure.push({
      path: 'harness/no-send-forbidden.mjs',
      sha256: sha256(readFileSync(resolve(harnessRoot, 'no-send-forbidden.mjs'), 'utf8')),
    });
  }
  let dynamicImportResult = null;
  try {
    await executeFixture(vm, 'no-send-dynamic-import.mjs', counters);
  } catch (error) {
    dynamicImportResult = error.message;
    closure.push({
      path: 'harness/no-send-dynamic-import.mjs',
      sha256: sha256(readFileSync(resolve(harnessRoot, 'no-send-dynamic-import.mjs'), 'utf8')),
    });
  }
  const pass = forbiddenCallResult === 'NO_DISPATCH:fetch'
    && dynamicImportResult === 'NO_DISPATCH:dynamic-import'
    && counters.normal_dispatch_attempts === 0
    && counters.negative_fake_attempts > 0
    && counters.actual_provider_calls === 0;
  const result = {
    schema_version: 1,
    kind: 'TEAM_SERVICE_NO_SEND_HARNESS_OBSERVATION',
    closure_pinned: true,
    closure,
    ...counters,
    forbidden_call_result: forbiddenCallResult,
    dynamic_import_result: dynamicImportResult,
    target_internal_forbidden_call_fixture: forbiddenCallResult === 'NO_DISPATCH:fetch'
      ? 'REJECTED_BEFORE_EFFECT' : 'FAILED',
    status: pass ? 'PASS_LOCAL_NO_SEND_HARNESS' : 'FAILED_CLOSED',
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!pass) process.exitCode = 1;
}

if (process.argv.includes('--worker')) {
  worker().catch((error) => {
    process.stdout.write(`${JSON.stringify({ status: 'FAILED_CLOSED', code: error.code || 'NO_SEND_HARNESS_ERROR', message: error.message })}\n`);
    process.exitCode = 1;
  });
} else if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  process.stdout.write(`${JSON.stringify(runNoSendHarness(), null, 2)}\n`);
}
