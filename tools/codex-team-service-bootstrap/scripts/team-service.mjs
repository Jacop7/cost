#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalJson,
  classifyFile,
  createSchemaRegistry,
  expandRequiredEdges,
  fail,
  prettyJson,
  readJson,
  resolveInside,
  runtimeRoot,
  safeProjectRoot,
  sha256File,
  sha256Text,
  sha256Value,
  validateSchema,
  versionInSupportedNodeRange,
  writeAtomicNoOverwrite,
} from './lib/core.mjs';
import { runNoSendHarness } from './no-send-harness.mjs';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginManifestPath = join(pluginRoot, '.codex-plugin', 'plugin.json');
const contractPath = join(pluginRoot, 'contracts', 'portable-package-contract.json');
const acceptanceMatrixPath = join(pluginRoot, 'contracts', 'acceptance-matrix.json');
const profilePath = join(pluginRoot, 'profiles', 'default-11-role-profile.json');
const capabilityTemplatePath = join(pluginRoot, 'templates', 'capability-policy.json');
const projectReadmePath = join(pluginRoot, 'templates', 'PROJECT-README.md');
const attributeFragmentPath = join(pluginRoot, 'templates', 'gitattributes.fragment');
const ignoreFragmentPath = join(pluginRoot, 'templates', 'gitignore.fragment');
const schemaPaths = {
  project: join(pluginRoot, 'schemas', 'project-profile.schema.json'),
  capability: join(pluginRoot, 'schemas', 'capability-policy.schema.json'),
  receipt: join(pluginRoot, 'schemas', 'install-receipt.schema.json'),
  generated: join(pluginRoot, 'schemas', 'generated-files.schema.json'),
  hostAdmission: join(pluginRoot, 'schemas', 'host-evidence-admission.schema.json'),
};
const tierRank = { LOCAL_CORE_ONLY: 0, COOPERATIVE_OBSERVED: 1, AUTHENTICATED: 2 };
const stageMinimum = { SIMULATION_ONLY: 'LOCAL_CORE_ONLY', PROBE_ONLY: 'COOPERATIVE_OBSERVED', PILOT: 'AUTHENTICATED' };
const semanticPluginVersion = () => String(readJson(pluginManifestPath).version).split('+')[0];

function argsOf(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) { result._.push(token); continue; }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else { result[key] = next; index += 1; }
  }
  return result;
}

const successfulStatuses = new Set([
  'USAGE', 'DOCTOR_COMPLETE', 'READY', 'INIT_APPLIED', 'PASS_LOCAL_RUNTIME', 'PASS_LOCAL_NO_SEND', 'PASS',
  'VALIDATED_NOT_ACTIVATED', 'MIGRATION_NOT_REQUIRED', 'MIGRATION_READY_CACHEBUSTER_NORMALIZATION',
  'MIGRATION_APPLIED_CACHEBUSTER_NORMALIZATION', 'MIGRATION_READY_VERSIONED', 'MIGRATION_APPLIED_VERSIONED',
  'MIGRATION_READY_CANDIDATE_RESEAL', 'MIGRATION_APPLIED_CANDIDATE_RESEAL',
  'NOOP_CURRENT_SCHEMA', 'RECOVERY_NOT_REQUIRED',
]);

function output(value, exitCode = successfulStatuses.has(value?.status) ? 0 : 1) {
  process.stdout.write(prettyJson(value));
  process.exitCode = exitCode;
  return value;
}

function loadSchemas() {
  const schemas = Object.fromEntries(Object.entries(schemaPaths).map(([key, path]) => [key, readJson(path)]));
  return { schemas, registry: createSchemaRegistry(Object.values(schemas)) };
}

function pythonVersion() {
  for (const command of ['python', 'python3']) {
    try {
      return { command, version: execFileSync(command, ['--version'], { encoding: 'utf8', windowsHide: true }).trim(), status: 'PRESENT' };
    } catch {}
  }
  return { command: null, version: null, status: 'UNAVAILABLE' };
}

function shellProbe() {
  if (process.platform !== 'win32') return { status: 'UNVERIFIED_PLATFORM', platform: process.platform };
  const marker = `TEAM_SERVICE_SHELL_${sha256Text(String(Date.now())).slice(0, 12)}`;
  for (const shell of ['pwsh', 'powershell']) {
    try {
      const stdout = execFileSync(shell, ['-NoProfile', '-NonInteractive', '-Command', `Write-Output '${marker}'; exit 0`], {
        encoding: 'utf8', windowsHide: true,
      }).trim();
      if (stdout === marker) return { status: 'PASS', shell, marker_sha256: sha256Text(marker), exit_code: 0 };
    } catch {}
  }
  return { status: 'FAIL', platform: process.platform };
}

const dependencyLocations = {
  'codex-mission-relay': { source: 'mission-relay-local', package: 'codex-mission-relay' },
  'codex-project-orchestrator': { source: 'project-orchestrator-local', package: 'codex-project-orchestrator' },
  'codex-team-router': { source: 'team-router-local', package: 'codex-team-router' },
  'codex-account-continuity': { source: 'account-continuity-local', package: 'codex-account-continuity' },
};

function dependencyOverrides() {
  if (!process.env.CODEX_TEAM_SERVICE_DEPENDENCY_ROOTS) return {};
  let value;
  try { value = JSON.parse(process.env.CODEX_TEAM_SERVICE_DEPENDENCY_ROOTS); } catch { fail('DEPENDENCY_ROOTS_JSON_INVALID'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('DEPENDENCY_ROOTS_JSON_INVALID');
  for (const [name, path] of Object.entries(value)) {
    if (!Object.hasOwn(dependencyLocations, name) || typeof path !== 'string' || !isAbsolute(path)) {
      fail('DEPENDENCY_ROOT_INVALID', name);
    }
  }
  return value;
}

function dependencyCandidates(name, expectedVersion, overrides) {
  if (Object.hasOwn(overrides, name)) return [resolve(overrides[name])];
  const location = dependencyLocations[name];
  const userRoot = homedir();
  const packageRoots = [
    join(userRoot, '.codex', 'plugins', 'cache', location.source, location.package),
    join(userRoot, '.codex', 'plugins', 'cache', 'personal', location.package),
  ];
  const candidates = [join(userRoot, 'plugins', location.package)];
  for (const packageRoot of packageRoots) {
    if (!existsSync(packageRoot)) continue;
    for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(join(packageRoot, entry.name));
    }
  }
  return candidates.sort((left, right) => {
    const leftExact = left.endsWith(expectedVersion) ? 1 : 0;
    const rightExact = right.endsWith(expectedVersion) ? 1 : 0;
    return rightExact - leftExact || left.localeCompare(right);
  });
}

function locateDependency(name, expectedVersion, overrides) {
  const attempts = [];
  for (const root of dependencyCandidates(name, expectedVersion, overrides)) {
    const manifest = join(root, '.codex-plugin', 'plugin.json');
    attempts.push(root);
    if (!existsSync(manifest)) continue;
    try {
      const version = String(readJson(manifest).version || 'UNAVAILABLE');
      if (version === expectedVersion) return { root, manifest, version, attempts };
    } catch {}
  }
  return { root: null, manifest: null, version: 'UNAVAILABLE', attempts };
}

function dependencyObservations(contract, projectRoot) {
  const overrides = dependencyOverrides();
  return contract.dependencies.map((dependency) => {
    const located = locateDependency(dependency.name, dependency.observed_version, overrides);
    const version = located.version;
    const artifact = located.manifest;
    const versionOk = version === dependency.observed_version;
    const artifactExists = Boolean(artifact && existsSync(artifact));
    const projectArtifacts = dependency.consumes.filter((item) => item.artifact.startsWith('.codex/')).map((item) => {
      const path = resolveInside(projectRoot, item.artifact);
      return { artifact: item.artifact, exists: existsSync(path), sha256: existsSync(path) ? sha256File(path) : null };
    });
    return {
      name: dependency.name,
      version,
      expected_version: dependency.observed_version,
      artifact: artifactExists ? artifact : 'UNAVAILABLE',
      artifact_sha256: artifactExists ? sha256File(artifact) : '0'.repeat(64),
      schema_selector: dependency.consumes.map((item) => item.schema_selector).join(','),
      verification_result: artifactExists && versionOk ? 'PASS' : 'INCOMPATIBLE_DEPENDENCY',
      project_artifacts: projectArtifacts,
      discovery_attempts: located.attempts.length,
    };
  });
}

function inspectHostEvidence(path, expectedSha, projectRoot, schemas, registry) {
  if (!path) return { status: 'NOT_PROVIDED', sealed_tier: 'LOCAL_CORE_ONLY', evidence_sha256: null };
  const absolute = resolve(path);
  if (!existsSync(absolute)) fail('HOST_EVIDENCE_NOT_FOUND', absolute);
  const admissionPath = resolveInside(projectRoot, '.codex/team-service/host-evidence-admission.json');
  if (!existsSync(admissionPath)) fail('HOST_EVIDENCE_ADMISSION_REQUIRED');
  const admission = readJson(admissionPath);
  validateSchema(admission, schemas.hostAdmission, registry);
  const admittedEvidencePath = resolveInside(projectRoot, admission.evidence_path);
  if (absolute !== admittedEvidencePath) fail('HOST_EVIDENCE_PATH_MISMATCH');
  const actualSha = sha256File(absolute);
  if (!expectedSha || !/^[a-f0-9]{64}$/.test(expectedSha) || expectedSha !== admission.evidence_sha256 || actualSha !== expectedSha) {
    fail('HOST_EVIDENCE_SHA_MISMATCH');
  }
  const evidence = readJson(absolute);
  if (evidence.scope_id !== admission.scope_id) fail('HOST_EVIDENCE_SCOPE_MISMATCH');
  const outcome = evidence.result || evidence.outcome || evidence.status;
  const positiveOutcomes = new Set(['HOST_BINDING_AVAILABLE_IN_SCOPE', 'CAPTURE_LINK_AVAILABLE_IN_SCOPE', 'HOST_PARTIAL_VIABLE']);
  if (!positiveOutcomes.has(outcome)) fail('HOST_EVIDENCE_NEGATIVE_CANNOT_PROMOTE', String(outcome));
  const required = ['caller_provenance', 'receipt_provenance', 'send_effect_fence', 'trusted_utc_provenance'];
  const values = Object.fromEntries(required.map((key) => [key, evidence[key] ?? 'UNAVAILABLE']));
  const allAttested = required.every((key) => values[key] === 'ATTESTED') && admission.maximum_tier === 'AUTHENTICATED';
  const observedDelivery = values.receipt_provenance === 'OBSERVED' && values.send_effect_fence !== 'UNAVAILABLE';
  return {
    status: allAttested ? 'ATTESTED' : observedDelivery ? 'OBSERVED' : 'UNVERIFIED',
    sealed_tier: allAttested ? 'AUTHENTICATED' : observedDelivery ? 'COOPERATIVE_OBSERVED' : 'LOCAL_CORE_ONLY',
    evidence_sha256: actualSha,
    admission_sha256: sha256File(admissionPath),
    decision_sha256: admission.decision_sha256,
    outcome,
    values,
  };
}

function doctor(projectRoot, options = {}) {
  const contract = readJson(contractPath);
  const { schemas, registry } = loadSchemas();
  const host = inspectHostEvidence(options['host-evidence'], options['host-evidence-sha256'], projectRoot, schemas, registry);
  const dependencies = dependencyObservations(contract, projectRoot);
  const nodeStatus = versionInSupportedNodeRange() ? 'PASS' : 'UNSUPPORTED';
  const shell = shellProbe();
  const result = {
    schema_version: 1,
    kind: 'TEAM_SERVICE_DOCTOR_READ_ONLY',
    project_root_sha256: sha256Text(projectRoot.toLowerCase()),
    plugin_manifest_sha256: sha256File(pluginManifestPath),
    contract_sha256: sha256File(contractPath),
    platform: { os: process.platform, arch: process.arch, status: process.platform === 'win32' ? 'PASS' : 'UNVERIFIED_PLATFORM' },
    node: { version: process.versions.node, supported: '>=24.15.0 <25', status: nodeStatus },
    python: pythonVersion(),
    shell,
    dependencies,
    host,
    sealed_tier: host.sealed_tier,
    actual_provider_calls: 0,
    generated_at_provenance: 'LOCAL_PROCESS_CLOCK_UNVERIFIED_TIME',
  };
  result.tier_input_sha256 = sha256Value({
    platform: result.platform,
    node: result.node,
    python: result.python,
    shell: { status: shell.status, shell: shell.shell || null, exit_code: shell.exit_code ?? null },
    dependencies: dependencies.map(({ name, version, expected_version, artifact_sha256, schema_selector,
      verification_result, project_artifacts }) => ({
      name, version, expected_version, artifact_sha256, schema_selector, verification_result, project_artifacts,
    })),
    host,
  });
  const dependenciesPass = dependencies.every((item) => item.verification_result === 'PASS');
  result.status = !dependenciesPass ? 'INCOMPATIBLE_DEPENDENCY'
    : nodeStatus === 'PASS' && shell.status === 'PASS' ? 'DOCTOR_COMPLETE' : 'DOCTOR_LIMITED';
  return result;
}

function chatManifest(role, profile, edges) {
  return {
    schema_version: 1,
    chat_manifest_version: 2,
    logical_chat_id: role.logical_chat_id,
    title: role.title,
    role_class: role.role_class,
    profile_id: profile.profile_id,
    requirement_revision: profile.requirement_revision,
    required_outgoing_edges: edges.filter((edge) => edge.source === role.logical_chat_id),
    endpoint_binding: 'RUNTIME_ONLY_NOT_PRESENT',
  };
}

function generatedSet() {
  const profile = readJson(profilePath);
  const contract = readJson(contractPath);
  const acceptanceMatrix = readJson(acceptanceMatrixPath);
  const capability = readFileSync(capabilityTemplatePath, 'utf8');
  const files = new Map([
    ['.codex/team-service/project-profile.json', prettyJson(profile)],
    ['.codex/team-service/capability-policy.json', capability.endsWith('\n') ? capability : `${capability}\n`],
    ['.codex/team-service/README.md', readFileSync(projectReadmePath, 'utf8')],
    ['.codex/team-service/gitattributes.fragment', readFileSync(attributeFragmentPath, 'utf8')],
    ['.codex/team-service/gitignore.fragment', readFileSync(ignoreFragmentPath, 'utf8')],
    ['.codex/team-service/compatibility.json', prettyJson({
      schema_version: 1,
      status: 'NOT_EXECUTED',
      dependencies: contract.dependencies.map(({ name, observed_version, supported_version }) => ({
        name, observed_version, supported_version, verification_result: 'NOT_EXECUTED',
      })),
    })],
    ['.codex/team-service/acceptance.json', prettyJson({
      schema_version: 1,
      status: 'NOT_EXECUTED_FOR_THIS_PROJECT',
      tests: contract.acceptance_tests.map((id) => ({ id, status: 'NOT_EXECUTED' })),
    })],
    ['.codex/team-service/CURRENT.json', prettyJson({
      schema_version: 1,
      status: 'INITIALIZED_SIMULATION_ONLY',
      mode: 'SIMULATION_ONLY',
      sealed_tier: 'UNSEALED_UNTIL_RUNTIME_DOCTOR',
      real_send_authorized: false,
      service_ready: false,
    })],
    ['.codex/team-service/known-open.json', prettyJson({
      schema_version: 1,
      status: 'OPEN_ITEMS_REMAIN',
      physical_second_pc: 'NOT_TESTED',
      runtime_acl_other_principal: 'BLOCKED_EXTERNAL_SECOND_PRINCIPAL',
      actual_host_roundtrip: 'NOT_AUTHORIZED',
      package_acceptance_snapshot: acceptanceMatrix.tests.map(({ id, status }) => ({ id, status })),
    })],
  ]);
  const expandedEdges = expandRequiredEdges(profile);
  for (const role of profile.roles) {
    files.set(`.codex/team-service/chats/${role.logical_chat_id}.json`, prettyJson(chatManifest(role, profile, expandedEdges)));
  }
  const inputSha = sha256Value({
    profile,
    capability: JSON.parse(capability),
    portable_contract_sha256: sha256File(contractPath),
    acceptance_matrix_sha256: sha256File(acceptanceMatrixPath),
    generator_version: semanticPluginVersion(),
  });
  const inventory = {
    schema_version: 1,
    generator_version: semanticPluginVersion(),
    input_sha256: inputSha,
    files: [...files].map(([path, text]) => ({ path, sha256: sha256Text(text), mode: 'TRACKED_PROJECT', classification: 'CREATE' })),
  };
  files.set('.codex/team-service/generated-files.json', prettyJson(inventory));
  return { files, inventory };
}

function planInit(projectRoot) {
  const generated = generatedSet();
  const plan = [];
  for (const [path, text] of generated.files) {
    plan.push({ path, sha256: sha256Text(text), classification: classifyFile(resolveInside(projectRoot, path), text) });
  }
  return {
    schema_version: 1,
    kind: 'TEAM_SERVICE_INIT_PLAN',
    project_root_sha256: sha256Text(projectRoot.toLowerCase()),
    generator_version: semanticPluginVersion(),
    files: plan,
    status: plan.some((item) => item.classification === 'CONFLICT') ? 'CONFLICT' : 'READY',
    actual_provider_calls: 0,
  };
}

function applyInit(projectRoot) {
  const plan = planInit(projectRoot);
  if (plan.status !== 'READY') return { ...plan, status: 'INIT_REFUSED_CONFLICT' };
  const generated = generatedSet();
  const applied = [];
  const created = [];
  try {
    for (const [path, text] of generated.files) {
      const absolute = resolveInside(projectRoot, path);
      const result = writeAtomicNoOverwrite(absolute, text);
      applied.push({ path, result });
      if (result === 'CREATE') created.push(absolute);
    }
    return { ...plan, status: 'INIT_APPLIED', applied };
  } catch (error) {
    for (const path of created.reverse()) if (existsSync(path)) rmSync(path, { force: true });
    throw error;
  }
}

function dryRun(projectRoot) {
  const { schemas, registry } = loadSchemas();
  const profileFile = resolveInside(projectRoot, '.codex/team-service/project-profile.json');
  if (!existsSync(profileFile)) fail('PROJECT_PROFILE_NOT_INITIALIZED');
  const profile = readJson(profileFile);
  validateSchema(profile, schemas.project, registry);
  const capabilityFile = resolveInside(projectRoot, '.codex/team-service/capability-policy.json');
  if (!existsSync(capabilityFile)) fail('CAPABILITY_POLICY_NOT_INITIALIZED');
  const capability = readJson(capabilityFile);
  validateSchema(capability, schemas.capability, registry);
  const edges = expandRequiredEdges(profile);
  const uniqueLogicalEdges = new Set(edges.map((edge) => `${edge.source}\0${edge.target}`)).size;
  const coverage = coverageAudit(projectRoot, profile, edges);
  const harness = runNoSendHarness();
  const currentPath = join(runtimeRoot(projectRoot), 'current.json');
  const sealedTier = existsSync(currentPath) ? readJson(currentPath).sealed_tier : 'LOCAL_CORE_ONLY';
  const router = routerConsistency(projectRoot, sealedTier, capability);
  return {
    schema_version: 1,
    kind: 'TEAM_SERVICE_NO_SEND_DRY_RUN',
    profile_sha256: sha256File(profileFile),
    logical_roles: profile.roles.length,
    logical_required_edge_requirements: edges.length,
    unique_logical_edges: uniqueLogicalEdges,
    edge_set_sha256: sha256Value(edges),
    coverage,
    no_send_harness_sha256: sha256Value(harness),
    normal_dispatch_attempts: harness.normal_dispatch_attempts,
    negative_fake_attempts: harness.negative_fake_attempts,
    actual_provider_calls: harness.actual_provider_calls,
    forbidden_call_result: harness.forbidden_call_result,
    dynamic_import_result: harness.dynamic_import_result,
    target_internal_forbidden_call_fixture: harness.target_internal_forbidden_call_fixture,
    router,
    assurance: 'LOCAL_CORE_ONLY',
    status: !router.consistent ? 'TIER_POLICY_INCONSISTENT'
      : coverage.status === 'ROUTER_COVERAGE_MISSING' ? 'ROUTER_COVERAGE_MISSING'
        : 'PASS_LOCAL_NO_SEND',
  };
}

function coverageAudit(projectRoot, profile, edges) {
  const chatRoot = resolveInside(projectRoot, '.codex/team-service/chats');
  const expectedIds = profile.roles.map((role) => role.logical_chat_id).sort();
  const actualIds = existsSync(chatRoot)
    ? readdirSync(chatRoot).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort()
    : [];
  const manifestMismatches = [];
  if (canonicalJson(expectedIds) !== canonicalJson(actualIds)) manifestMismatches.push('ROLE_SET_MISMATCH');
  for (const id of expectedIds) {
    const path = join(chatRoot, `${id}.json`);
    if (!existsSync(path)) continue;
    const manifest = readJson(path);
    const expected = edges.filter((edge) => edge.source === id);
    if (manifest.logical_chat_id !== id || manifest.requirement_revision !== profile.requirement_revision
      || canonicalJson(manifest.required_outgoing_edges) !== canonicalJson(expected)) {
      manifestMismatches.push(id);
    }
  }
  if (manifestMismatches.length > 0) return {
    status: 'PROFILE_MANIFEST_MISMATCH', manifest_mismatches: manifestMismatches,
  };
  const policyPath = resolveInside(projectRoot, '.codex/team-router/policy.json');
  if (!existsSync(policyPath)) return { status: 'PASS_PROFILE_MANIFEST', router_policy: 'NOT_CONFIGURED' };
  const policy = readJson(policyPath);
  const requiredKinds = [...new Set(edges.flatMap((edge) => edge.kinds))].sort();
  const allowedKinds = Array.isArray(policy.allowedMessageKinds) ? [...new Set(policy.allowedMessageKinds)].sort() : [];
  const missingKinds = requiredKinds.filter((kind) => !allowedKinds.includes(kind));
  return missingKinds.length > 0
    ? { status: 'ROUTER_COVERAGE_MISSING', missing_message_kinds: missingKinds }
    : { status: 'PASS_PROFILE_MANIFEST_ROUTER', missing_message_kinds: [] };
}

function configureAcl(path) {
  if (process.platform !== 'win32') return 'UNVERIFIED_PLATFORM';
  const user = process.env.USERNAME;
  if (!user) return 'FAIL';
  try {
    execFileSync('icacls', [path, '/inheritance:r', '/grant:r', `${user}:(OI)(CI)F`, '/grant:r', 'SYSTEM:(OI)(CI)F'], {
      encoding: 'utf8', windowsHide: true,
    });
    return 'PASS';
  } catch { return 'FAIL'; }
}

function projectHashes(projectRoot) {
  const inventoryPath = resolveInside(projectRoot, '.codex/team-service/generated-files.json');
  if (!existsSync(inventoryPath)) fail('GENERATED_INVENTORY_NOT_FOUND');
  const inventory = readJson(inventoryPath);
  return inventory.files.map((file) => {
    const path = resolveInside(projectRoot, file.path);
    if (!existsSync(path)) fail('GENERATED_FILE_MISSING', file.path);
    return { ...file, sha256: sha256File(path), classification: 'UNCHANGED' };
  });
}

function initRuntime(projectRoot, options = {}) {
  const doctorResult = doctor(projectRoot, options);
  if (doctorResult.status !== 'DOCTOR_COMPLETE') {
    return { ...doctorResult, kind: 'TEAM_SERVICE_RUNTIME_INITIALIZATION_REFUSED', status: doctorResult.status };
  }
  const noSend = dryRun(projectRoot);
  if (noSend.status !== 'PASS_LOCAL_NO_SEND') return { ...noSend, kind: 'TEAM_SERVICE_RUNTIME_INITIALIZATION_REFUSED' };
  const root = runtimeRoot(projectRoot);
  mkdirSync(root, { recursive: true });
  const aclResult = configureAcl(root);
  if (aclResult === 'FAIL') fail('RUNTIME_ACL_CONFIGURATION_FAILED', root);
  const currentPath = join(root, 'current.json');
  const previous = existsSync(currentPath) ? readJson(currentPath) : null;
  const current = {
    schema_version: 1,
    project_root_sha256: sha256Text(projectRoot.toLowerCase()),
    sealed_tier: doctorResult.sealed_tier,
    tier_input_sha256: doctorResult.tier_input_sha256,
    current_epoch: Number(previous?.current_epoch || 0),
    restore_state: 'READY',
  };
  const doctorPath = join(root, `doctor-${doctorResult.tier_input_sha256}.json`);
  if (!existsSync(doctorPath)) writeFileSync(doctorPath, prettyJson(doctorResult), { encoding: 'utf8', flag: 'wx' });
  if (previous) {
    const previousSha = sha256File(currentPath);
    if (previous.sealed_tier !== current.sealed_tier || previous.tier_input_sha256 !== current.tier_input_sha256) {
      if (options['expected-current-sha256'] !== previousSha) return {
        status: 'RUNTIME_CAS_REQUIRED', expected_current_sha256: previousSha, actual_provider_calls: 0,
      };
      const historyRoot = join(root, 'history');
      mkdirSync(historyRoot, { recursive: true });
      const historyPath = join(historyRoot, `current-${previousSha}.json`);
      if (!existsSync(historyPath)) writeFileSync(historyPath, readFileSync(currentPath), { flag: 'wx' });
      current.current_epoch = Number(previous.current_epoch || 0) + 1;
    }
  }
  if (!previous || previous.sealed_tier !== current.sealed_tier || previous.tier_input_sha256 !== current.tier_input_sha256) {
    writeFileSync(currentPath, prettyJson(current), 'utf8');
  }
  const dependencies = doctorResult.dependencies.map((item) => ({
    name: item.name,
    version: item.version,
    artifact: item.artifact,
    artifact_sha256: item.artifact_sha256,
    schema_selector: item.schema_selector,
    verification_result: item.verification_result,
  }));
  const generated = projectHashes(projectRoot);
  const previousReceiptPath = join(root, 'install-receipt.json');
  const previousReceiptSha = existsSync(previousReceiptPath) ? sha256File(previousReceiptPath) : null;
  const receipt = {
    schema_version: 1,
    receipt_id: `INSTALL_${sha256Text(projectRoot).slice(0, 16).toUpperCase()}`,
    previous_receipt_sha256: previousReceiptSha,
    plugin_version: readJson(pluginManifestPath).version,
    plugin_manifest_sha256: sha256File(pluginManifestPath),
    compatibility_sha256: sha256Value(dependencies.map(({ name, version, verification_result }) => ({ name, version, verification_result }))),
    dependency_observations: dependencies,
    project_profile_sha256: sha256File(resolveInside(projectRoot, '.codex/team-service/project-profile.json')),
    template_sha256: sha256Value([...generatedSet().files].map(([path, text]) => ({ path, sha256: sha256Text(text) }))),
    generated_file_hashes: generated,
    doctor_evidence_sha256: sha256File(doctorPath),
    sealed_tier: doctorResult.sealed_tier,
    runtime_reference: `runtime-ref:${sha256Text(root.toLowerCase())}`,
    acl_result: aclResult,
    no_send_evidence_sha256: noSend.no_send_harness_sha256,
    coverage_evidence_sha256: noSend.edge_set_sha256,
    clock_provenance: 'UNVERIFIED_TIME',
  };
  const { schemas, registry } = loadSchemas();
  validateSchema(receipt, schemas.receipt, registry);
  writeFileSync(previousReceiptPath, prettyJson(receipt), 'utf8');
  return {
    schema_version: 1,
    kind: 'TEAM_SERVICE_RUNTIME_INITIALIZED',
    runtime_reference: receipt.runtime_reference,
    sealed_tier: receipt.sealed_tier,
    receipt_sha256: sha256File(previousReceiptPath),
    acl_result: aclResult,
    actual_provider_calls: 0,
    status: 'PASS_LOCAL_RUNTIME',
  };
}

function routerConsistency(projectRoot, sealedTier, capability) {
  const policyPath = resolveInside(projectRoot, capability.router_consistency.policy_path);
  const receiptPath = resolveInside(projectRoot, capability.router_consistency.activation_receipt_path);
  if (!existsSync(policyPath) && !existsSync(receiptPath)) return { status: 'NOT_CONFIGURED', consistent: sealedTier === 'LOCAL_CORE_ONLY' };
  if (!existsSync(policyPath) || !existsSync(receiptPath)) return { status: 'TIER_POLICY_INCONSISTENT', consistent: false };
  const policy = readJson(policyPath);
  const activation = readJson(receiptPath);
  const enabled = policy.dispatchEnabled === true || policy.dispatch_enabled === true;
  const receiptActive = ['ACTIVE', 'ACTIVE_DISPATCH', 'ACTIVATION_SEALED'].includes(activation.status)
    || activation.mode === 'ACTIVE_DISPATCH';
  const consistent = sealedTier === 'AUTHENTICATED' ? enabled && receiptActive : !enabled && !receiptActive;
  return { status: consistent ? 'PASS' : 'TIER_POLICY_INCONSISTENT', consistent };
}

function verifyInstall(projectRoot) {
  const { schemas, registry } = loadSchemas();
  const base = resolveInside(projectRoot, '.codex/team-service');
  const required = ['project-profile.json', 'capability-policy.json', 'generated-files.json'];
  for (const path of required) if (!existsSync(join(base, path))) fail('PROJECT_CONTRACT_MISSING', path);
  const profile = readJson(join(base, 'project-profile.json'));
  const capability = readJson(join(base, 'capability-policy.json'));
  const inventory = readJson(join(base, 'generated-files.json'));
  validateSchema(profile, schemas.project, registry);
  validateSchema(capability, schemas.capability, registry);
  validateSchema(inventory, schemas.generated, registry);
  const runtimeClassPattern = /(?:^|\/)(?:endpoint|thread|outbox|hmac|install-receipt|activation-receipt|epoch|lock|checkpoint|raw-tool)(?:[-_.\/]|$)/i;
  const runtimeLeaks = [];
  for (const path of readdirSync(base, { recursive: true, withFileTypes: true })) {
    if (!path.isFile()) continue;
    const absolute = join(path.parentPath, path.name);
    const relativePath = relative(base, absolute).replaceAll('\\', '/');
    if (runtimeClassPattern.test(relativePath)) runtimeLeaks.push(relativePath);
  }
  if (runtimeLeaks.length > 0) return { status: 'TRACKED_RUNTIME_LEAK', runtime_leaks: runtimeLeaks, actual_provider_calls: 0 };
  const drift = inventory.files.flatMap((file) => {
    const path = resolveInside(projectRoot, file.path);
    if (!existsSync(path)) return [{ path: file.path, status: 'MISSING' }];
    const actual = sha256File(path);
    return actual === file.sha256 ? [] : [{ path: file.path, status: 'DRIFT', expected: file.sha256, actual }];
  });
  const runRoot = runtimeRoot(projectRoot);
  const receiptPath = join(runRoot, 'install-receipt.json');
  if (!existsSync(receiptPath)) return { status: 'RUNTIME_RESTORE_REQUIRED', drift, actual_provider_calls: 0 };
  const receipt = readJson(receiptPath);
  validateSchema(receipt, schemas.receipt, registry);
  const router = routerConsistency(projectRoot, receipt.sealed_tier, capability);
  if (!router.consistent) return { status: 'TIER_POLICY_INCONSISTENT', drift, router, actual_provider_calls: 0 };
  return {
    schema_version: 1,
    kind: 'TEAM_SERVICE_INSTALL_VERIFICATION',
    sealed_tier: receipt.sealed_tier,
    receipt_sha256: sha256File(receiptPath),
    drift,
    router,
    actual_provider_calls: 0,
    status: drift.length === 0 ? 'PASS' : 'DRIFTED_OR_INCOMPLETE',
  };
}

function prepareActivation(projectRoot, envelopePath) {
  if (!envelopePath || !existsSync(resolve(envelopePath))) fail('ACTIVATION_ENVELOPE_REQUIRED');
  const envelope = readJson(resolve(envelopePath));
  const required = ['candidate_manifest_sha256', 'review_receipt_sha256', 'human_decision_sha256', 'sealed_tier', 'epoch_id', 'previous_epoch', 'expected_epoch', 'stage'];
  for (const key of required) if (!Object.hasOwn(envelope, key)) fail('ACTIVATION_FIELD_REQUIRED', key);
  for (const key of ['candidate_manifest_sha256', 'review_receipt_sha256', 'human_decision_sha256']) {
    if (!/^[a-f0-9]{64}$/.test(envelope[key])) fail('ACTIVATION_HASH_INVALID', key);
  }
  const currentPath = join(runtimeRoot(projectRoot), 'current.json');
  if (!existsSync(currentPath)) fail('RUNTIME_RESTORE_REQUIRED');
  const current = readJson(currentPath);
  if (envelope.sealed_tier !== current.sealed_tier) fail('SEALED_TIER_MISMATCH');
  if (Number(envelope.expected_epoch) !== Number(current.current_epoch)) fail('REJECT_STALE_EPOCH');
  const minimum = stageMinimum[envelope.stage];
  if (!minimum || tierRank[envelope.sealed_tier] < tierRank[minimum]) fail('ACTIVATION_STAGE_ABOVE_TIER');
  const { schemas, registry } = loadSchemas();
  const capability = readJson(resolveInside(projectRoot, '.codex/team-service/capability-policy.json'));
  validateSchema(capability, schemas.capability, registry);
  const router = routerConsistency(projectRoot, current.sealed_tier, capability);
  if (!router.consistent) fail('TIER_POLICY_INCONSISTENT');
  return {
    schema_version: 1,
    kind: 'TEAM_SERVICE_ACTIVATION_VALIDATION_ONLY',
    envelope_sha256: sha256File(resolve(envelopePath)),
    current_epoch: current.current_epoch,
    stage: envelope.stage,
    sealed_tier: envelope.sealed_tier,
    router,
    actual_provider_calls: 0,
    status: 'VALIDATED_NOT_ACTIVATED',
  };
}

function migrate(projectRoot, apply) {
  const profilePathInProject = resolveInside(projectRoot, '.codex/team-service/project-profile.json');
  if (!existsSync(profilePathInProject)) return { status: 'PROJECT_CONTRACT_MISSING', actual_provider_calls: 0 };
  const version = readJson(profilePathInProject).schema_version;
  if (version !== 1) return { status: 'UNSUPPORTED_MIGRATION_PATH', from: version, to: 1, actual_provider_calls: 0 };
  const inventoryPath = resolveInside(projectRoot, '.codex/team-service/generated-files.json');
  if (!existsSync(inventoryPath)) return { status: 'GENERATED_INVENTORY_NOT_FOUND', actual_provider_calls: 0 };
  const inventory = readJson(inventoryPath);
  const generated = generatedSet();
  const expected = generated.files.get('.codex/team-service/generated-files.json');
  if (readFileSync(inventoryPath, 'utf8') === expected) {
    return { status: apply ? 'NOOP_CURRENT_SCHEMA' : 'MIGRATION_NOT_REQUIRED', from: 1, to: 1, actual_provider_calls: 0 };
  }
  const fromBase = String(inventory.generator_version).split('+')[0];
  const toBase = semanticPluginVersion();
  const nonInventoryStable = inventory.files.every((file) => {
    const path = resolveInside(projectRoot, file.path);
    return existsSync(path) && sha256File(path) === file.sha256;
  });
  if (!nonInventoryStable) {
    return { status: 'MIGRATION_REFUSED_DRIFT_OR_UNSUPPORTED_VERSION', from: inventory.generator_version,
      to: toBase, actual_provider_calls: 0 };
  }
  const sameBase = fromBase === toBase;
  const cachebusterOnly = sameBase && String(inventory.generator_version).includes('+');
  const supportedVersioned = ['0.1.0', '0.1.1'].includes(fromBase) && toBase === '0.2.0';
  if (!sameBase && !supportedVersioned) return {
    status: 'MIGRATION_REFUSED_DRIFT_OR_UNSUPPORTED_VERSION', from: inventory.generator_version,
    to: toBase, actual_provider_calls: 0,
  };
  const planStatus = cachebusterOnly ? 'MIGRATION_READY_CACHEBUSTER_NORMALIZATION'
    : sameBase ? 'MIGRATION_READY_CANDIDATE_RESEAL' : 'MIGRATION_READY_VERSIONED';
  if (!apply) return { status: planStatus, from: inventory.generator_version, to: toBase, actual_provider_calls: 0 };

  const oldInventoryBytes = readFileSync(inventoryPath);
  const oldFiles = inventory.files.map((file) => ({ file, bytes: readFileSync(resolveInside(projectRoot, file.path)) }));
  const backupRoot = join(runtimeRoot(projectRoot), 'migration-backups', sha256File(inventoryPath));
  mkdirSync(backupRoot, { recursive: true });
  const inventoryBackup = join(backupRoot, 'generated-files.json');
  if (!existsSync(inventoryBackup)) writeFileSync(inventoryBackup, oldInventoryBytes, { flag: 'wx' });
  for (const { file, bytes } of oldFiles) {
    const backupPath = resolveInside(backupRoot, file.path);
    mkdirSync(dirname(backupPath), { recursive: true });
    if (!existsSync(backupPath)) writeFileSync(backupPath, bytes, { flag: 'wx' });
  }

  const created = [];
  try {
    for (const [path, text] of generated.files) {
      if (path === '.codex/team-service/generated-files.json') continue;
      const absolute = resolveInside(projectRoot, path);
      if (!existsSync(absolute)) {
        const result = writeAtomicNoOverwrite(absolute, text);
        if (result === 'CREATE') created.push(absolute);
        continue;
      }
      if (readFileSync(absolute, 'utf8') === text) continue;
      const oldEntry = inventory.files.find((file) => file.path === path);
      if (!oldEntry || sha256File(absolute) !== oldEntry.sha256) fail('MIGRATION_REFUSED_USER_EDIT', path);
      writeFileSync(absolute, text, 'utf8');
    }
    writeFileSync(inventoryPath, expected, 'utf8');
    if (sha256Text(readFileSync(inventoryPath, 'utf8')) !== sha256Text(expected)) fail('MIGRATION_WRITE_VERIFY_FAILED');
  } catch (error) {
    for (const path of created.reverse()) if (existsSync(path)) rmSync(path, { force: true });
    for (const { file, bytes } of oldFiles) writeFileSync(resolveInside(projectRoot, file.path), bytes);
    writeFileSync(inventoryPath, oldInventoryBytes);
    throw error;
  }
  return {
    status: cachebusterOnly ? 'MIGRATION_APPLIED_CACHEBUSTER_NORMALIZATION'
      : sameBase ? 'MIGRATION_APPLIED_CANDIDATE_RESEAL' : 'MIGRATION_APPLIED_VERSIONED',
    from: inventory.generator_version,
    to: toBase,
    backup_reference: `runtime-ref:${sha256Text(backupRoot.toLowerCase())}`,
    actual_provider_calls: 0,
  };
}

function recover(projectRoot) {
  const sourcePresent = existsSync(pluginManifestPath) && existsSync(contractPath);
  const projectPresent = existsSync(resolveInside(projectRoot, '.codex/team-service/generated-files.json'));
  const runtimePresent = existsSync(join(runtimeRoot(projectRoot), 'install-receipt.json'));
  const status = !sourcePresent ? 'SOURCE_REBUILD_REQUIRED'
    : !projectPresent ? 'PROJECT_REGENERATION_REQUIRED'
      : !runtimePresent ? 'RUNTIME_RESTORE_REQUIRED'
        : 'RECOVERY_NOT_REQUIRED';
  return { schema_version: 1, kind: 'TEAM_SERVICE_RECOVERY_DIAGNOSIS', source_present: sourcePresent,
    project_present: projectPresent, runtime_present: runtimePresent, endpoint_guessing: false,
    actual_provider_calls: 0, status };
}

function usage() {
  return output({
    status: 'USAGE',
    commands: ['doctor', 'init --plan|--apply', 'init-runtime', 'dry-run', 'verify-install', 'prepare-activation --envelope <json>', 'migrate --plan|--apply', 'recover'],
  });
}

function main() {
  const parsed = argsOf(process.argv.slice(2));
  const command = parsed._[0];
  if (!command || parsed.help) return usage();
  const projectRoot = safeProjectRoot(parsed.project || '.');
  if (command === 'doctor') return output(doctor(projectRoot, parsed));
  if (command === 'init') {
    if (parsed.plan === true) return output(planInit(projectRoot));
    if (parsed.apply === true) return output(applyInit(projectRoot));
    fail('INIT_MODE_REQUIRED', '--plan or --apply');
  }
  if (command === 'init-runtime') return output(initRuntime(projectRoot, parsed));
  if (command === 'dry-run') return output(dryRun(projectRoot));
  if (command === 'verify-install') return output(verifyInstall(projectRoot));
  if (command === 'prepare-activation') return output(prepareActivation(projectRoot, parsed.envelope));
  if (command === 'migrate') return output(migrate(projectRoot, parsed.apply === true));
  if (command === 'recover') return output(recover(projectRoot));
  fail('UNKNOWN_COMMAND', command);
}

try { main(); } catch (error) {
  output({ status: 'FAILED_CLOSED', code: error.code || 'UNEXPECTED_ERROR', message: error.message, actual_provider_calls: 0 }, 1);
}
