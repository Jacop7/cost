import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PLAN_DOCS = Object.freeze([
  'docs/팀구성_상세기획안.md',
  'docs/AI-지식-온톨로지-기획안.md',
  'docs/AI-오케스트레이션-상세기획안.md',
  'docs/디렉터리-문서신경망-재설계-기획안.md',
  'docs/AI-품질-학습-자율성-평가기획안.md',
]);

const ACTIVATED_PLAN_DOCS = Object.freeze(PLAN_DOCS.slice(1));

const CENTRAL_PATHS = Object.freeze([
  'docs/team/README.md',
  'docs/team/DECISIONS.md',
  'docs/team/RELEASE_GATE.md',
  'docs/team/ROLE_CONTEXTS.md',
  'docs/team/TEAM_LEARNING.md',
  'docs/team/handoffs/README.md',
]);

const OPERATIONS_PATHS = Object.freeze([
  'docs/operations/RUNBOOK_RELEASE.md',
  'docs/operations/RUNBOOK_INCIDENT.md',
  'docs/operations/RUNBOOK_RECOVERY.md',
  'docs/operations/DATA_CORRECTION_POLICY.md',
  'docs/operations/MONITORING_CATALOG.md',
  'docs/operations/SUPPORT_PLAYBOOK.md',
  'docs/operations/PILOT_PLAN.md',
]);

const ROLE_FILES = Object.freeze({
  ORCHESTRATION: 'docs/team/roles/ORCHESTRATION.md',
  SOLAR: 'docs/team/roles/SOLAR.md',
  CODEX: 'docs/team/roles/CODEX.md',
  'INDEPENDENT-AUDIT': 'docs/team/roles/INDEPENDENT-AUDIT.md',
  OPERATIONS: 'docs/team/roles/OPERATIONS.md',
});

const TEAM_FILES = Object.freeze({
  'ALL-TEAMS-ROOM': 'docs/team/teams/00-all-teams-room.md',
  'PRODUCT-MOBILE': 'docs/team/teams/01-product-mobile.md',
  'DATA-BACKEND': 'docs/team/teams/02-data-backend.md',
  'SERVER-SUPABASE-OPERATIONS': 'docs/team/teams/03-server-supabase-operations.md',
  'QUALITY-REVIEW': 'docs/team/teams/04-quality-review.md',
  'KNOWLEDGE-ORCHESTRATION': 'docs/team/teams/05-knowledge-orchestration.md',
});

const REQUIRED_ROLE_FIELDS = Object.freeze([
  'role_id',
  'context_ids',
  'context_refs',
  'allowed_routes',
  'input_allowlist',
  'authority_links',
  'required_outputs',
  'verification_checklist',
  'handoff_in',
  'handoff_out',
  'stop_conditions',
  'human_escape',
]);

const REQUIRED_TEAM_FIELDS = Object.freeze([
  'team_id',
  'display_name',
  'task_types',
  'role_ids',
  'authority_links',
  'announcement_chat',
  'temporary_task_condition',
  'handoff_in',
  'handoff_out',
  'chat_is_approval_authority',
]);

const FORBIDDEN_MANIFEST_FIELDS = Object.freeze([
  'current_task',
  'plugin_state',
  'token_threshold',
  'model_selector',
  'shared_hook',
]);

export class DocsGraphError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DocsGraphError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new DocsGraphError(code, message);
}

function canonicalText(value) {
  return value.replace(/\r\n/g, '\n');
}

export function canonicalSha256(value) {
  return createHash('sha256').update(canonicalText(value)).digest('hex');
}

function safePath(rootDir, path) {
  if (!path || isAbsolute(path)) fail('UNSAFE_PATH', `절대 경로를 manifest에 둘 수 없습니다: ${path}`);
  const target = resolve(rootDir, normalize(path));
  const rel = relative(rootDir, target);
  if (rel.startsWith('..') || isAbsolute(rel)) fail('UNSAFE_PATH', `저장소 밖 경로입니다: ${path}`);
  return target;
}

function readRequired(rootDir, path) {
  const target = safePath(rootDir, path);
  if (!existsSync(target)) fail('MISSING_FILE', `필수 문서가 없습니다: ${path}`);
  return canonicalText(readFileSync(target, 'utf8'));
}

function parseValue(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      if (value.startsWith('[')) {
        const inner = value.slice(1, -1).trim();
        return inner ? inner.split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')) : [];
      }
      fail('INVALID_FRONT_MATTER_VALUE', `JSON 객체 필드가 유효하지 않습니다: ${value}`);
    }
  }
  return value.replace(/^['"]|['"]$/g, '');
}

export function parseFrontMatter(text, path = '<memory>') {
  const match = canonicalText(text).match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) fail('MISSING_FRONT_MATTER', `front matter가 없습니다: ${path}`);
  const fields = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const entry = line.match(/^([a-z][a-z0-9_]*)\s*:\s*(.*)$/);
    if (!entry) fail('INVALID_FRONT_MATTER', `단일 행 front matter 계약 위반: ${path}: ${line}`);
    if (Object.hasOwn(fields, entry[1])) fail('DUPLICATE_FIELD', `중복 필드입니다: ${path}: ${entry[1]}`);
    fields[entry[1]] = parseValue(entry[2]);
  }
  return fields;
}

function assertRequiredFields(fields, required, path) {
  for (const field of required) {
    if (!Object.hasOwn(fields, field)) fail('MISSING_FIELD', `필수 manifest 필드가 없습니다: ${path}: ${field}`);
  }
  for (const field of FORBIDDEN_MANIFEST_FIELDS) {
    if (Object.hasOwn(fields, field)) fail('POLICY_REPLICATION', `manifest가 실행 상태·판정 알고리즘을 복제합니다: ${path}: ${field}`);
  }
}

function assertStringArray(value, path, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item)) {
    fail('INVALID_ARRAY_FIELD', `비어 있지 않은 문자열 배열이어야 합니다: ${path}: ${field}`);
  }
}

function parseRegistry(text) {
  const match = text.match(/<!-- role-context-registry:v1 -->\n```json\n([\s\S]*?)\n```\n<!-- \/role-context-registry:v1 -->/);
  if (!match) fail('MISSING_CONTEXT_REGISTRY', 'ROLE_CONTEXTS.md의 v1 기계 레지스트리가 없습니다.');
  let registry;
  try {
    registry = JSON.parse(match[1]);
  } catch {
    fail('INVALID_CONTEXT_REGISTRY', 'ROLE_CONTEXTS.md의 v1 JSON이 유효하지 않습니다.');
  }
  if (registry.schema_version !== '1.0' || !Array.isArray(registry.contexts)) {
    fail('INVALID_CONTEXT_REGISTRY', 'ROLE_CONTEXTS.md schema_version 또는 contexts가 잘못됐습니다.');
  }
  if (registry.hash_algorithm !== 'sha256(context_id|version|route|autonomy_stage|decision_id|policy_hash)') {
    fail('INVALID_CONTEXT_HASH_ALGORITHM', 'ROLE_CONTEXT hash_algorithm이 고정 계약과 다릅니다.');
  }
  const contexts = new Map();
  for (const context of registry.contexts) {
    if (!context || typeof context.context_id !== 'string' || contexts.has(context.context_id)) {
      fail('DUPLICATE_CONTEXT', `ROLE_CONTEXT ID가 없거나 중복됐습니다: ${context?.context_id ?? '<missing>'}`);
    }
    if (!Number.isInteger(context.version) || context.version < 1 || !/^[0-9a-f]{64}$/.test(context.context_hash ?? '')) {
      fail('INVALID_CONTEXT_VERSION', `ROLE_CONTEXT version/hash가 잘못됐습니다: ${context.context_id}`);
    }
    if (typeof context.route !== 'string' || !context.route || !/^[0-9a-f]{64}$/.test(context.policy_hash ?? '')) {
      fail('INVALID_CONTEXT_BINDING', `ROLE_CONTEXT route/policy_hash 결속이 잘못됐습니다: ${context.context_id}`);
    }
    if (context.autonomy_stage !== 'A0') fail('UNAPPROVED_AUTONOMY', `승인 없는 route는 A0이어야 합니다: ${context.context_id}`);
    if (typeof context.decision_id !== 'string' || !context.decision_id) {
      fail('MISSING_CONTEXT_DECISION', `ROLE_CONTEXT Decision이 없습니다: ${context.context_id}`);
    }
    const expectedHash = canonicalSha256([
      context.context_id,
      context.version,
      context.route,
      context.autonomy_stage,
      context.decision_id,
      context.policy_hash,
    ].join('|'));
    if (context.context_hash !== expectedHash) fail('CONTEXT_HASH_MISMATCH', `ROLE_CONTEXT hash가 내용과 다릅니다: ${context.context_id}`);
    contexts.set(context.context_id, context);
  }
  return contexts;
}

function parseJsonMarker(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`<!-- ${escaped}:v1 -->\\n\x60\x60\x60json\\n([\\s\\S]*?)\\n\x60\x60\x60\\n<!-- \\/${escaped}:v1 -->`));
  if (!match) fail('MISSING_REGISTRY', `${name}:v1 기계 레지스트리가 없습니다.`);
  try {
    return JSON.parse(match[1]);
  } catch {
    fail('INVALID_REGISTRY', `${name}:v1 JSON이 유효하지 않습니다.`);
  }
}

function checkLearningMigration(text) {
  const legacy = parseJsonMarker(text, 'team-learning-registry');
  const verifier = parseJsonMarker(text, 'team-learning-verifier-registry');
  if (!Array.isArray(legacy.learnings) || !Array.isArray(verifier.entries)) fail('INVALID_LEARNING_MIGRATION', 'Learning 이관 배열이 없습니다.');
  const legacyById = new Map(legacy.learnings.map((item) => [item.learning_id, item]));
  const verifierById = new Map(verifier.entries.map((item) => [item.learning_id, item]));
  if (legacyById.size !== legacy.learnings.length || verifierById.size !== verifier.entries.length) {
    fail('DUPLICATE_LEARNING_ID', 'Learning ID 또는 verifier 이관 ID가 중복됐습니다.');
  }
  if ([...legacyById.keys()].sort().join('\n') !== [...verifierById.keys()].sort().join('\n')) {
    fail('LEARNING_MIGRATION_COVERAGE', '기존 Learning과 verifier 이관표가 1:1로 대응하지 않습니다.');
  }
  for (const [id, item] of legacyById) {
    const assignment = verifierById.get(id);
    for (const field of ['author_role', 'lane_owner_role', 'verifier_role', 'contract_state']) {
      if (typeof assignment[field] !== 'string' || !assignment[field]) fail('INVALID_LEARNING_ASSIGNMENT', `Learning 이관 필드가 없습니다: ${id}: ${field}`);
    }
    if (item.status === 'VERIFIED') {
      const legacyReadOnly = assignment.contract_state === 'LEGACY_READ_ONLY' && assignment.verifier_decision_id === null;
      const active = assignment.contract_state === 'ACTIVE' && typeof assignment.verifier_decision_id === 'string' && assignment.verifier_decision_id;
      if (!legacyReadOnly && !active) fail('INVALID_VERIFIED_MIGRATION', `VERIFIED Learning의 Decision 계약이 잘못됐습니다: ${id}`);
    }
    if (item.status === 'CANDIDATE' && !['CANDIDATE_UNASSIGNED', 'CANDIDATE_ASSIGNED'].includes(assignment.contract_state)) {
      fail('INVALID_CANDIDATE_MIGRATION', `CANDIDATE Learning의 이관 상태가 잘못됐습니다: ${id}`);
    }
    if (item.status === 'CANDIDATE') {
      const unassigned = assignment.contract_state === 'CANDIDATE_UNASSIGNED' && assignment.verifier_decision_id === null;
      const assigned = assignment.contract_state === 'CANDIDATE_ASSIGNED' && typeof assignment.verifier_decision_id === 'string' && assignment.verifier_decision_id;
      if (!unassigned && !assigned) fail('INVALID_CANDIDATE_DECISION', `CANDIDATE Learning의 Decision 결속이 잘못됐습니다: ${id}`);
    }
    if (item.status === 'RETIRED') {
      if (assignment.contract_state !== 'RETIRED' || typeof assignment.verifier_decision_id !== 'string' || !assignment.verifier_decision_id) {
        fail('INVALID_RETIRED_MIGRATION', `RETIRED Learning의 폐기 Decision 결속이 잘못됐습니다: ${id}`);
      }
    }
  }
}

function checkAuthorityLinks(rootDir, path, links) {
  assertStringArray(links, path, 'authority_links');
  for (const link of links) readRequired(rootDir, link);
}

function directoryOwnsRisks(directoryText) {
  return /^\|[^\n|]*(?:미해결 위험|위험 인스턴스)[^\n|]*\|\s*`?docs\/team\/RISKS\.md`?\s*\|/m.test(directoryText);
}

export function checkDocsGraph({ rootDir = DEFAULT_ROOT, requireActivation = false, requirePlannedTree = false } = {}) {
  const planMetadata = PLAN_DOCS.map((path) => {
    const text = readRequired(rootDir, path);
    return { path, text, fields: parseFrontMatter(text, path) };
  });
  const docIds = planMetadata.map(({ fields }) => fields.doc_id);
  const authorities = planMetadata.map(({ fields }) => fields.authority);
  if (docIds.some((id) => typeof id !== 'string') || new Set(docIds).size !== docIds.length) {
    fail('DUPLICATE_DOC_ID', '중앙 기획안 doc_id가 없거나 중복됐습니다.');
  }
  if (authorities.some((authority) => typeof authority !== 'string') || new Set(authorities).size !== authorities.length) {
    fail('DUPLICATE_AUTHORITY', '중앙 기획안 authority가 없거나 중복됐습니다.');
  }

  const activatedStatuses = planMetadata.filter(({ path }) => ACTIVATED_PLAN_DOCS.includes(path)).map(({ fields }) => fields.status);
  if (new Set(activatedStatuses).size !== 1 || !['DRAFT', 'ACTIVE'].includes(activatedStatuses[0])) {
    fail('NON_ATOMIC_PLAN_STATUS', '네 후속 기획안은 모두 DRAFT 또는 모두 ACTIVE여야 합니다.');
  }
  if (!requireActivation && !requirePlannedTree) {
    return { status: 'PASS', mode: 'plan', planStatus: activatedStatuses[0], checkedFiles: PLAN_DOCS.length };
  }
  if (requireActivation && activatedStatuses[0] !== 'ACTIVE') fail('ACTIVATION_REQUIRED', 'activation 검사에는 네 후속 기획안이 모두 ACTIVE여야 합니다.');
  if (requirePlannedTree && activatedStatuses[0] !== 'DRAFT') fail('DRAFT_TREE_REQUIRED', 'planned-tree 검사에는 네 후속 기획안이 모두 DRAFT여야 합니다.');
  if (requireActivation && planMetadata.some(({ fields, text }) => fields.status === 'ACTIVE' && /이 문서는\s+`?DRAFT`?다\./.test(text))) {
    fail('ACTIVE_SELF_DRAFT', 'ACTIVE 기획안 본문에 현재 상태를 부정하는 DRAFT 자기선언이 있습니다.');
  }

  for (const path of CENTRAL_PATHS) readRequired(rootDir, path);
  if (requireActivation) {
    for (const path of OPERATIONS_PATHS) readRequired(rootDir, path);
    if (existsSync(safePath(rootDir, 'docs/operations/POSTMORTEMS'))) {
      fail('PREMATURE_POSTMORTEMS', '실제 사고 전 POSTMORTEMS 경로를 물질화할 수 없습니다.');
    }
  }
  const directoryText = readRequired(rootDir, 'docs/디렉터리-문서신경망-재설계-기획안.md');
  const risksPath = safePath(rootDir, 'docs/team/RISKS.md');
  const risksOwned = directoryOwnsRisks(directoryText);
  if (risksOwned && !existsSync(risksPath)) fail('MISSING_RISKS', '수렴된 중앙 권위 표가 요구하는 RISKS.md가 없습니다.');
  if (!risksOwned && existsSync(risksPath)) fail('UNOWNED_RISKS', '중앙 권위 표가 수렴하지 않아 RISKS.md를 만들 수 없습니다.');

  const contexts = parseRegistry(readRequired(rootDir, 'docs/team/ROLE_CONTEXTS.md'));
  checkLearningMigration(readRequired(rootDir, 'docs/team/TEAM_LEARNING.md'));
  const roleIds = new Set();
  for (const [expectedRoleId, path] of Object.entries(ROLE_FILES)) {
    const fields = parseFrontMatter(readRequired(rootDir, path), path);
    assertRequiredFields(fields, REQUIRED_ROLE_FIELDS, path);
    if (fields.role_id !== expectedRoleId || roleIds.has(fields.role_id)) fail('ROLE_ID_MISMATCH', `역할 ID가 파일 계약과 다릅니다: ${path}`);
    roleIds.add(fields.role_id);
    assertStringArray(fields.context_ids, path, 'context_ids');
    assertStringArray(fields.context_refs, path, 'context_refs');
    if (fields.context_refs.length !== fields.context_ids.length) fail('CONTEXT_REF_COVERAGE', `context ID와 version/hash 참조 수가 다릅니다: ${path}`);
    const referencedIds = new Set();
    for (const reference of fields.context_refs) {
      const match = reference.match(/^(.+)@(\d+)#([0-9a-f]{64})$/);
      if (!match) fail('INVALID_CONTEXT_REF', `context 참조 형식이 잘못됐습니다: ${path}: ${reference}`);
      const context = contexts.get(match[1]);
      if (!context || context.version !== Number(match[2]) || context.context_hash !== match[3]) {
        fail('CONTEXT_REF_MISMATCH', `context version/hash가 레지스트리와 다릅니다: ${path}: ${reference}`);
      }
      referencedIds.add(match[1]);
    }
    if (referencedIds.size !== fields.context_ids.length || fields.context_ids.some((id) => !referencedIds.has(id))) {
      fail('CONTEXT_REF_COVERAGE', `context ID와 version/hash 참조가 1:1이 아닙니다: ${path}`);
    }
    for (const contextId of fields.context_ids) {
      if (!contexts.has(contextId)) fail('UNKNOWN_CONTEXT', `ROLE_CONTEXT 레지스트리에 없는 context입니다: ${path}: ${contextId}`);
    }
    for (const field of ['allowed_routes', 'input_allowlist', 'required_outputs', 'verification_checklist', 'handoff_in', 'handoff_out', 'stop_conditions']) {
      assertStringArray(fields[field], path, field);
    }
    checkAuthorityLinks(rootDir, path, fields.authority_links);
    if (fields.human_escape !== 'HUMAN-CHIEF') fail('INVALID_HUMAN_ESCAPE', `사람 escape가 HUMAN-CHIEF가 아닙니다: ${path}`);
  }

  const teamIds = new Set();
  for (const [expectedTeamId, path] of Object.entries(TEAM_FILES)) {
    const fields = parseFrontMatter(readRequired(rootDir, path), path);
    assertRequiredFields(fields, REQUIRED_TEAM_FIELDS, path);
    if (fields.team_id !== expectedTeamId || teamIds.has(fields.team_id)) fail('TEAM_ID_MISMATCH', `팀 ID가 파일 계약과 다릅니다: ${path}`);
    teamIds.add(fields.team_id);
    for (const field of ['task_types', 'role_ids', 'authority_links', 'handoff_in', 'handoff_out']) assertStringArray(fields[field], path, field);
    for (const roleId of fields.role_ids) {
      if (!roleIds.has(roleId)) fail('UNKNOWN_ROLE', `팀 manifest가 없는 역할을 참조합니다: ${path}: ${roleId}`);
    }
    checkAuthorityLinks(rootDir, path, fields.authority_links);
    if (fields.chat_is_approval_authority !== false) fail('CHAT_AUTHORITY_FORGERY', `채팅 이름은 승인 권한이 아닙니다: ${path}`);
    if (typeof fields.temporary_task_condition !== 'string' || !fields.temporary_task_condition.includes('Task Packet')) {
      fail('INVALID_TASK_CHAT_BOUNDARY', `임시 채팅 생성 조건에 Task Packet이 없습니다: ${path}`);
    }
  }

  return {
    status: 'PASS',
    mode: requirePlannedTree ? 'planned-tree' : 'activation',
    planStatus: activatedStatuses[0],
    risks: risksOwned ? 'OWNED_AND_PRESENT' : 'WITHHELD_PENDING_AUTHORITY_ALIGNMENT',
    checkedFiles: PLAN_DOCS.length + CENTRAL_PATHS.length + Object.keys(ROLE_FILES).length + Object.keys(TEAM_FILES).length
      + (requireActivation ? OPERATIONS_PATHS.length : 0),
    contextCount: contexts.size,
  };
}

function cliArgs(argv) {
  const result = { rootDir: DEFAULT_ROOT, requireActivation: false, requirePlannedTree: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--activation') result.requireActivation = true;
    else if (argv[index] === '--planned-tree') result.requirePlannedTree = true;
    else if (argv[index] === '--root') result.rootDir = resolve(argv[++index]);
    else fail('UNKNOWN_ARGUMENT', `알 수 없는 인자입니다: ${argv[index]}`);
  }
  if (result.requireActivation && result.requirePlannedTree) fail('CONFLICTING_MODE', '--activation과 --planned-tree는 함께 쓸 수 없습니다.');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(checkDocsGraph(cliArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    const code = error instanceof DocsGraphError ? error.code : 'UNEXPECTED_ERROR';
    console.error(JSON.stringify({ status: 'FAIL', code, message: error.message }, null, 2));
    process.exitCode = 1;
  }
}
