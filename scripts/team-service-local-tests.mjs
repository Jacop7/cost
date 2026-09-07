import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIVE_TEST_PATTERN = '**/*.live.test.*';
export const LOCAL_TEST_ALLOWLIST = Object.freeze([
  'scripts/team-service-bugfix.test.mjs',
  'scripts/team-service-intake.test.mjs',
  'scripts/team-service-live-isolation.test.mjs',
  'scripts/team-service-p3-contract.test.mjs',
  'scripts/team-service-router-adapter.test.mjs',
  'scripts/team-service-workflow.test.mjs',
]);
export const P3_IMPLEMENTATION_TARGETS = Object.freeze([
  'docs/team/service-flow-p3-contract.json',
  'docs/team/service-flow-acceptance.json',
  'scripts/team-service-p3-contract.test.mjs',
  'scripts/team-service-intake.mjs',
  'scripts/team-service-intake.test.mjs',
  'scripts/team-service-workflow.mjs',
  'scripts/team-service-workflow.test.mjs',
  'scripts/team-service-intent-store.mjs',
  'scripts/team-service-router-adapter.test.mjs',
  'scripts/team-service-p2b-scenario.mjs',
  'scripts/team-service-local-tests.mjs',
  'scripts/team-service-live-isolation.test.mjs',
  'scripts/verify.mjs',
  'apps/mobile/vitest.config.ts',
]);

function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}

function validateAllowlist() {
  requireValue(new Set(LOCAL_TEST_ALLOWLIST).size === LOCAL_TEST_ALLOWLIST.length, 'DUPLICATE_LOCAL_TEST');
  requireValue(LOCAL_TEST_ALLOWLIST.every((path) => /^scripts\/[a-z0-9-]+\.test\.mjs$/.test(path)), 'INVALID_LOCAL_TEST_PATH');
  requireValue(LOCAL_TEST_ALLOWLIST.every((path) => !path.includes('.live.test.')), 'LIVE_TEST_IN_LOCAL_ALLOWLIST');
  return [...LOCAL_TEST_ALLOWLIST];
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const posix = (path) => path.split(sep).join('/');

function staticImports(source) {
  requireValue(!/\bimport\s*\(/.test(source), 'DYNAMIC_IMPORT_FORBIDDEN');
  const imports = [];
  const pattern = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) imports.push(match[1]);
  return imports;
}

function resolveProjectImport(root, importer, specifier) {
  if (!specifier.startsWith('.')) {
    requireValue(specifier.startsWith('node:') || ['vitest', 'vitest/config'].includes(specifier), `UNPINNED_PACKAGE_IMPORT:${specifier}`);
    return null;
  }
  const base = resolve(root, dirname(importer), specifier);
  const candidates = extname(base) ? [base] : [base, `${base}.mjs`, `${base}.js`, `${base}.json`, `${base}.ts`];
  const found = candidates.find((path) => existsSync(path));
  requireValue(found, 'MISSING_IMPORT');
  const projectPath = posix(relative(root, found));
  requireValue(!projectPath.startsWith('../') && projectPath !== '..', 'IMPORT_OUTSIDE_PROJECT');
  return projectPath;
}

function collectClosure(root, targets) {
  const visited = new Set();
  const queue = [...targets];
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    const absolute = resolve(root, path);
    requireValue(existsSync(absolute), 'MISSING_BUNDLE_MODULE');
    visited.add(path);
    if (/\.(?:mjs|js|ts)$/.test(path)) {
      for (const specifier of staticImports(readFileSync(absolute, 'utf8'))) {
        const imported = resolveProjectImport(root, path, specifier);
        if (imported && !visited.has(imported)) queue.push(imported);
      }
    }
  }
  return [...visited].sort();
}

export function verifyP3CompletionBundle(bundlePath, { cwd = resolve(fileURLToPath(new URL('..', import.meta.url))) } = {}) {
  const absoluteBundle = resolve(cwd, bundlePath);
  const bundle = JSON.parse(readFileSync(absoluteBundle, 'utf8'));
  requireValue(bundle?.schema_version === 1 && bundle.kind === 'TEAM_SERVICE_P3_COMPLETION_BUNDLE', 'INVALID_P3_COMPLETION_BUNDLE');
  requireValue(/^[0-9a-f]{40}$/.test(bundle.target_commit), 'INVALID_TARGET_COMMIT');
  requireValue(JSON.stringify(bundle.target_modules) === JSON.stringify(P3_IMPLEMENTATION_TARGETS), 'P3_TARGET_SET_MISMATCH');
  requireValue(Array.isArray(bundle.modules) && bundle.modules.length > 0, 'EMPTY_P3_MODULES');
  const closure = collectClosure(cwd, bundle.target_modules);
  requireValue(JSON.stringify(bundle.modules.map((item) => item.path)) === JSON.stringify(closure), 'P3_CLOSURE_MISMATCH');
  requireValue(closure.every((path) => !path.includes('.live.test.')), 'LIVE_TEST_IN_P3_BUNDLE');
  for (const module of bundle.modules) {
    requireValue(/^[0-9a-f]{64}$/.test(module.sha256), 'INVALID_MODULE_SHA256');
    const working = readFileSync(resolve(cwd, module.path));
    requireValue(sha256(working) === module.sha256, 'P3_WORKING_TREE_DRIFT');
    const committed = execFileSync('git', ['show', `${bundle.target_commit}:${module.path}`], { cwd, encoding: null });
    requireValue(sha256(committed) === module.sha256, 'P3_COMMIT_DRIFT');
  }
  return Object.freeze({
    kind: 'AC24_P3_COMPLETION_OBSERVATION',
    target_commit: bundle.target_commit,
    target_modules: [...bundle.target_modules],
    import_closure: closure,
    module_sha256: structuredClone(bundle.modules),
    scenario_ids: [...bundle.scenario_ids],
    dispatch_attempts: 0,
    actual_provider_calls: 0,
    service_ready: false,
    real_send_authorized: false,
  });
}

export function authorizeLiveLauncher(request, expected, providerFactory, { nowMs = Date.now() } = {}) {
  requireValue(request && expected && typeof request === 'object' && typeof expected === 'object', 'LIVE_AUTHORIZATION_REQUIRED');
  requireValue(request.capability === expected.capability, 'LIVE_CAPABILITY_MISMATCH');
  requireValue(request.scope === expected.scope, 'LIVE_SCOPE_MISMATCH');
  requireValue(request.bundle_sha256 === expected.bundle_sha256, 'LIVE_BUNDLE_MISMATCH');
  const decision = request.decision;
  requireValue(decision && typeof decision === 'object', 'LIVE_DECISION_REQUIRED');
  requireValue(decision.decision_id === expected.decision_id, 'LIVE_DECISION_MISMATCH');
  requireValue(decision.revoked === false, 'LIVE_DECISION_REVOKED');
  const expiresAt = Date.parse(decision.expires_at);
  requireValue(Number.isFinite(expiresAt) && expiresAt > nowMs, 'LIVE_DECISION_EXPIRED');
  requireValue(typeof providerFactory === 'function', 'LIVE_PROVIDER_FACTORY_REQUIRED');
  return providerFactory();
}

export function runLocalTests({ cwd = resolve(fileURLToPath(new URL('..', import.meta.url))) } = {}) {
  const tests = validateAllowlist();
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, TEAM_SERVICE_LIVE_ALLOWED: '0' },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  if (process.argv.length === 3 && process.argv[2] === '--list-json') {
    process.stdout.write(`${JSON.stringify({ tests: validateAllowlist(), excluded: [LIVE_TEST_PATTERN] })}\n`);
  } else if (process.argv.length === 4 && process.argv[2] === '--verify-bundle') {
    const observation = verifyP3CompletionBundle(process.argv[3]);
    const exitCode = runLocalTests();
    process.stdout.write(`# AC24_P3_COMPLETION_OBSERVATION ${JSON.stringify(observation)}\n`);
    process.exitCode = exitCode;
  } else if (process.argv.length === 2) {
    process.exitCode = runLocalTests();
  } else {
    console.error('Usage: node scripts/team-service-local-tests.mjs [--list-json]');
    process.exitCode = 2;
  }
}
