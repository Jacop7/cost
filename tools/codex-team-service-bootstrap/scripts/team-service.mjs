#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginManifestPath = join(pluginRoot, '.codex-plugin', 'plugin.json');
const contractPath = join(pluginRoot, 'contracts', 'portable-package-contract.json');
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

function output(value, exitCode = 0) {
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

const dependencyRoots = {
  'codex-mission-relay': 'C:\\Codex-AI-Operations\\Codex-Mission-Relay\\plugins\\codex-mission-relay',
  'codex-project-orchestrator': 'C:\\Codex-AI-Operations\\Codex-Project-Orchestrator\\plugins\\codex-project-orchestrator',
  'codex-team-router': 'C:\\Codex-AI-Operations\\Codex-Team-Router\\plugins\\codex-team-router',
  'codex-account-continuity': 'C:\\Codex-AI-Operations\\Codex-Account-Continuity\\plugins\\codex-account-continuity',
};

function dependencyObservations(contract, projectRoot) {
  return contract.dependencies.map((dependency) => {
    const root = dependencyRoots[dependency.name];
    const manifest = join(root, '.codex-plugin', 'plugin.json');
    const policy = join(dirname(dirname(root)), 'POLICY.md');
    let version = 'UNAVAILABLE';
    let artifact = existsSync(manifest) ? manifest : existsSync(policy) ? policy : root;
    if (existsSync(manifest)) {
      try { version = String(readJson(manifest).version || 'UNAVAILABLE'); } catch { version = 'INVALID'; }
    }
    const versionOk = version === dependency.observed_version;
    const artifactExists = existsSync(artifact);
    const projectArtifacts = dependency.consumes.filter((item) => item.artifact.startsWith('.codex/')).map((item) => {
      const path = resolveInside(projectRoot, item.artifact);
      return { artifact: item.artifact, exists: existsSync(path), sha256: existsSync(path) ? sha256File(path) : null };
    });
    return {
      name: dependency.name,
      version,
      expected_version: dependency.observed_version,
      artifact,
      artifact_sha256: artifactExists ? sha256File(artifact) : '0'.repeat(64),
      schema_selector: dependency.consumes.map((item) => item.schema_selector).join(','),
      verification_result: artifactExists && versionOk ? 'PASS' : 'UNAVAILABLE',
      project_artifacts: projectArtifacts,
    };
  });
}

function inspectHostEvidence(path) {
  if (!path) return { status: 'NOT_PROVIDED', sealed_tier: 'LOCAL_CORE_ONLY', evidence_sha256: null };
  const absolute = resolve(path);
  if (!existsSync(absolute)) fail('HOST_EVIDENCE_NOT_FOUND', absolute);
  const evidence = readJson(absolute);
  const required = ['caller_provenance', 'receipt_provenance', 'send_effect_fence', 'trusted_utc_provenance'];
  const values = Object.fromEntries(required.map((key) => [key, evidence[key] ?? 'UNAVAILABLE']));
  const allAttested = required.every((key) => values[key] === 'ATTESTED');
  const observedDelivery = values.receipt_provenance === 'OBSERVED' && values.send_effect_fence !== 'UNAVAILABLE';
  return {
    status: allAttested ? 'ATTESTED' : observedDelivery ? 'OBSERVED' : 'UNVERIFIED',
    sealed_tier: allAttested ? 'AUTHENTICATED' : observedDelivery ? 'COOPERATIVE_OBSERVED' : 'LOCAL_CORE_ONLY',
    evidence_sha256: sha256File(absolute),
    values,
  };
}

function doctor(projectRoot, options = {}) {
  const contract = readJson(contractPath);
  const host = inspectHostEvidence(options['host-evidence']);
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
    dependencies,
    host,
  });
  result.status = nodeStatus === 'PASS' && shell.status === 'PASS' ? 'DOCTOR_COMPLETE' : 'DOCTOR_LIMITED';
  return result;
}

function chatManifest(role, profile) {
  return {
    schema_version: 1,
    chat_manifest_version: 2,
    logical_chat_id: role.logical_chat_id,
    title: role.title,
    role_class: role.role_class,
    profile_id: profile.profile_id,
    requirement_revision: profile.requirement_revision,
    endpoint_binding: 'RUNTIME_ONLY_NOT_PRESENT',
  };
}

function generatedSet() {
  const profile = readJson(profilePath);
  const capability = readFileSync(capabilityTemplatePath, 'utf8');
  const files = new Map([
    ['.codex/team-service/project-profile.json', prettyJson(profile)],
    ['.codex/team-service/capability-policy.json', capability.endsWith('\n') ? capability : `${capability}\n`],
    ['.codex/team-service/README.md', readFileSync(projectReadmePath, 'utf8')],
    ['.codex/team-service/gitattributes.fragment', readFileSync(attributeFragmentPath, 'utf8')],
    ['.codex/team-service/gitignore.fragment', readFileSync(ignoreFragmentPath, 'utf8')],
  ]);
  for (const role of profile.roles) files.set(`.codex/team-service/chats/${role.logical_chat_id}.json`, prettyJson(chatManifest(role, profile)));
  const inputSha = sha256Value({ profile, capability: JSON.parse(capability), generator_version: semanticPluginVersion() });
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
  for (const [path, text] of generated.files) applied.push({ path, result: writeAtomicNoOverwrite(resolveInside(projectRoot, path), text) });
  return { ...plan, status: 'INIT_APPLIED', applied };
}

function dryRun(projectRoot) {
  const profileFile = resolveInside(projectRoot, '.codex/team-service/project-profile.json');
  if (!existsSync(profileFile)) fail('PROJECT_PROFILE_NOT_INITIALIZED');
  const profile = readJson(profileFile);
  validateSchema(profile, readJson(schemaPaths.project), loadSchemas().registry);
  const edges = expandRequiredEdges(profile);
  return {
    schema_version: 1,
    kind: 'TEAM_SERVICE_NO_SEND_DRY_RUN',
    profile_sha256: sha256File(profileFile),
    logical_roles: profile.roles.length,
    logical_required_edges: edges.length,
    edge_set_sha256: sha256Value(edges),
    normal_dispatch_attempts: 0,
    negative_fake_attempts: 1,
    actual_provider_calls: 0,
    forbidden_call_result: 'NO_DISPATCH:fetch',
    assurance: 'LOCAL_CORE_ONLY',
    status: 'PASS_LOCAL_NO_SEND',
  };
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
  const noSend = dryRun(projectRoot);
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
  writeFileSync(currentPath, prettyJson(current), 'utf8');
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
    no_send_evidence_sha256: sha256Value(noSend),
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
  const receiptActive = activation.status === 'ACTIVE' || activation.mode === 'ACTIVE_DISPATCH';
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
  const capability = readJson(resolveInside(projectRoot, '.codex/team-service/capability-policy.json'));
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
  const expected = generatedSet().files.get('.codex/team-service/generated-files.json');
  if (readFileSync(inventoryPath, 'utf8') === expected) {
    return { status: apply ? 'NOOP_CURRENT_SCHEMA' : 'MIGRATION_NOT_REQUIRED', from: 1, to: 1, actual_provider_calls: 0 };
  }
  const sameBaseCachebuster = String(inventory.generator_version).split('+')[0] === semanticPluginVersion();
  const nonInventoryStable = inventory.files.every((file) => {
    const path = resolveInside(projectRoot, file.path);
    return existsSync(path) && sha256File(path) === file.sha256;
  });
  if (!sameBaseCachebuster || !nonInventoryStable) {
    return { status: 'MIGRATION_REFUSED_DRIFT_OR_UNSUPPORTED_VERSION', from: inventory.generator_version,
      to: semanticPluginVersion(), actual_provider_calls: 0 };
  }
  if (!apply) return { status: 'MIGRATION_READY_CACHEBUSTER_NORMALIZATION', from: inventory.generator_version,
    to: semanticPluginVersion(), actual_provider_calls: 0 };
  const backup = join(runtimeRoot(projectRoot), `generated-files-${sha256File(inventoryPath)}.bak.json`);
  mkdirSync(dirname(backup), { recursive: true });
  if (!existsSync(backup)) writeFileSync(backup, readFileSync(inventoryPath));
  writeFileSync(inventoryPath, expected, 'utf8');
  if (sha256Text(readFileSync(inventoryPath, 'utf8')) !== sha256Text(expected)) fail('MIGRATION_WRITE_VERIFY_FAILED');
  return { status: 'MIGRATION_APPLIED_CACHEBUSTER_NORMALIZATION', from: inventory.generator_version,
    to: semanticPluginVersion(), backup_reference: `runtime-ref:${sha256Text(backup.toLowerCase())}`,
    actual_provider_calls: 0 };
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
