import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkDocsGraph } from './docs-graph-check.mjs';

const planPaths = [
  ['docs/팀구성_상세기획안.md', 'team', 'team_roles_approval'],
  ['docs/AI-지식-온톨로지-기획안.md', 'ontology', 'knowledge_relations_request_normalization'],
  ['docs/AI-오케스트레이션-상세기획안.md', 'orchestration', 'request_intake_task_routing'],
  ['docs/디렉터리-문서신경망-재설계-기획안.md', 'directory', 'directory_readme_document_graph'],
  ['docs/AI-품질-학습-자율성-평가기획안.md', 'quality', 'quality_learning_autonomy_evaluation'],
];

const roleFiles = {
  ORCHESTRATION: ['ORCHESTRATION.md', ['CTX-ORCH']],
  SOLAR: ['SOLAR.md', ['CTX-SOLAR']],
  CODEX: ['CODEX.md', ['CTX-CODEX']],
  'INDEPENDENT-AUDIT': ['INDEPENDENT-AUDIT.md', ['CTX-AUDIT']],
  OPERATIONS: ['OPERATIONS.md', ['CTX-OPS']],
};

const teamFiles = {
  'ALL-TEAMS-ROOM': '00-all-teams-room.md',
  'PRODUCT-MOBILE': '01-product-mobile.md',
  'DATA-BACKEND': '02-data-backend.md',
  'SERVER-SUPABASE-OPERATIONS': '03-server-supabase-operations.md',
  'QUALITY-REVIEW': '04-quality-review.md',
  'KNOWLEDGE-ORCHESTRATION': '05-knowledge-orchestration.md',
};

function put(root, path, text) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text.replace(/\r\n/g, '\n'), 'utf8');
}

function frontMatter(fields, body = '') {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

function fixtureContextHash(contextId) {
  return createHash('sha256').update([
    contextId, 1, 'NORMAL', 'A0', 'DEC-ACTIVATION-001', 'b'.repeat(64),
  ].join('|')).digest('hex');
}

function makeFixture(planStatus = 'ACTIVE') {
  const root = mkdtempSync(join(tmpdir(), 'docs-graph-'));
  for (const [path, docId, authority] of planPaths) {
    const body = docId === 'directory' ? '# Directory\n\nRISKS는 아직 별도 정합화 대상이다.' : `# ${docId}`;
    put(root, path, frontMatter({ doc_id: docId, status: docId === 'team' ? 'CONFIRMED' : planStatus, authority }, body));
  }
  for (const path of ['README.md', 'DECISIONS.md', 'RELEASE_GATE.md']) put(root, `docs/team/${path}`, `# ${path}\n`);
  for (const path of ['RUNBOOK_RELEASE.md', 'RUNBOOK_INCIDENT.md', 'RUNBOOK_RECOVERY.md', 'DATA_CORRECTION_POLICY.md', 'MONITORING_CATALOG.md', 'SUPPORT_PLAYBOOK.md', 'PILOT_PLAN.md']) {
    put(root, `docs/operations/${path}`, `# ${path}\n`);
  }
  put(root, 'docs/team/handoffs/README.md', '# HANDOFF\n');
  const contexts = Object.values(roleFiles).flatMap(([, ids]) => ids).map((contextId) => ({
    context_id: contextId,
    version: 1,
    route: 'NORMAL',
    autonomy_stage: 'A0',
    decision_id: 'DEC-ACTIVATION-001',
    policy_hash: 'b'.repeat(64),
  }));
  for (const context of contexts) {
    context.context_hash = fixtureContextHash(context.context_id);
  }
  const hashAlgorithm = 'sha256(context_id|version|route|autonomy_stage|decision_id|policy_hash)';
  put(root, 'docs/team/ROLE_CONTEXTS.md', `# Contexts\n\n<!-- role-context-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', hash_algorithm: hashAlgorithm, contexts }, null, 2)}\n\`\`\`\n<!-- /role-context-registry:v1 -->\n`);
  const learning = { learning_id: 'LRN-TEST-001', status: 'VERIFIED' };
  const assignment = { learning_id: 'LRN-TEST-001', author_role: 'LEGACY_UNKNOWN', lane_owner_role: 'SOLAR', verifier_role: 'CODEX-FUNCTION-QA', verifier_decision_id: null, contract_state: 'LEGACY_READ_ONLY' };
  put(root, 'docs/team/TEAM_LEARNING.md', `# Learning\n\n<!-- team-learning-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', learnings: [learning] }, null, 2)}\n\`\`\`\n<!-- /team-learning-registry:v1 -->\n\n<!-- team-learning-verifier-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', entries: [assignment] }, null, 2)}\n\`\`\`\n<!-- /team-learning-verifier-registry:v1 -->\n`);
  for (const [roleId, [filename, contextIds]] of Object.entries(roleFiles)) {
    put(root, `docs/team/roles/${filename}`, frontMatter({
      role_id: roleId,
      context_ids: contextIds,
      context_refs: contextIds.map((id) => `${id}@1#${contexts.find((context) => context.context_id === id).context_hash}`),
      allowed_routes: ['NORMAL'],
      input_allowlist: ['Task Packet'],
      authority_links: ['docs/팀구성_상세기획안.md'],
      required_outputs: ['evidence pointer'],
      verification_checklist: ['exact SHA'],
      handoff_in: ['same Task predecessor'],
      handoff_out: ['one successor'],
      stop_conditions: ['missing Decision'],
      human_escape: 'HUMAN-CHIEF',
    }, `# ${roleId}`));
  }
  for (const [teamId, filename] of Object.entries(teamFiles)) {
    put(root, `docs/team/teams/${filename}`, frontMatter({
      team_id: teamId,
      display_name: teamId,
      task_types: ['STATUS'],
      role_ids: ['ORCHESTRATION'],
      authority_links: ['docs/작업큐.md'],
      announcement_chat: teamId,
      temporary_task_condition: 'sealed Task Packet and edit lease',
      handoff_in: ['verified predecessor'],
      handoff_out: ['single successor'],
      chat_is_approval_authority: false,
    }, `# ${teamId}`));
  }
  put(root, 'docs/작업큐.md', '# Queue\n');
  return root;
}

function withFixture(run) {
  const root = makeFixture();
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('완성된 activation 문서 그래프는 통과한다', () => withFixture((root) => {
  const result = checkDocsGraph({ rootDir: root, requireActivation: true });
  assert.equal(result.status, 'PASS');
  assert.equal(result.risks, 'WITHHELD_PENDING_AUTHORITY_ALIGNMENT');
}));

test('ACTIVE 기획안의 DRAFT 자기선언을 잡는다', () => withFixture((root) => {
  put(root, 'docs/디렉터리-문서신경망-재설계-기획안.md', frontMatter({
    doc_id: 'directory', status: 'ACTIVE', authority: 'directory_readme_document_graph',
  }, '# Directory\n\n이 문서는 `DRAFT`다.'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /DRAFT 자기선언/);
}));

test('DRAFT 상태의 완성 후보 트리는 planned-tree 모드에서 통과한다', () => {
  const root = makeFixture('DRAFT');
  try {
    const result = checkDocsGraph({ rootDir: root, requirePlannedTree: true });
    assert.equal(result.mode, 'planned-tree');
    assert.equal(result.planStatus, 'DRAFT');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('필수 역할 manifest 누락을 잡는다', () => withFixture((root) => {
  rmSync(join(root, 'docs/team/roles/CODEX.md'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /필수 문서가 없습니다/);
}));

test('activation 뒤 필수 운영 진입점 누락을 잡는다', () => withFixture((root) => {
  rmSync(join(root, 'docs/operations/RUNBOOK_RECOVERY.md'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /필수 문서가 없습니다/);
}));

test('중앙 authority 중복을 잡는다', () => withFixture((root) => {
  put(root, 'docs/AI-품질-학습-자율성-평가기획안.md', frontMatter({
    doc_id: 'quality', status: 'ACTIVE', authority: 'request_intake_task_routing',
  }, '# quality'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /authority가 없거나 중복/);
}));

test('채팅 이름을 승인 권한으로 위조하면 잡는다', () => withFixture((root) => {
  const path = 'docs/team/teams/01-product-mobile.md';
  const text = frontMatter({
    team_id: 'PRODUCT-MOBILE', display_name: 'Product', task_types: ['STATUS'], role_ids: ['ORCHESTRATION'],
    authority_links: ['docs/작업큐.md'], announcement_chat: 'Product', temporary_task_condition: 'sealed Task Packet',
    handoff_in: ['verified predecessor'], handoff_out: ['single successor'], chat_is_approval_authority: true,
  }, '# Product');
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /채팅 이름은 승인 권한이 아닙니다/);
}));

test('등록되지 않은 ROLE_CONTEXT 참조를 잡는다', () => withFixture((root) => {
  const path = 'docs/team/roles/SOLAR.md';
  put(root, path, frontMatter({
    role_id: 'SOLAR', context_ids: ['CTX-UNKNOWN'], context_refs: [`CTX-UNKNOWN@1#${'a'.repeat(64)}`], allowed_routes: ['NORMAL'], input_allowlist: ['Task Packet'],
    authority_links: ['docs/팀구성_상세기획안.md'], required_outputs: ['evidence'], verification_checklist: ['SHA'],
    handoff_in: ['predecessor'], handoff_out: ['successor'], stop_conditions: ['missing Decision'], human_escape: 'HUMAN-CHIEF',
  }, '# SOLAR'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /context version\/hash가 레지스트리와 다릅니다/);
}));

test('레지스트리 내부 context_hash 변조를 잡는다', () => withFixture((root) => {
  const hashAlgorithm = 'sha256(context_id|version|route|autonomy_stage|decision_id|policy_hash)';
  const tampered = [{
    context_id: 'CTX-ORCH', version: 1, route: 'NORMAL', autonomy_stage: 'A0',
    decision_id: 'DEC-ACTIVATION-001', policy_hash: 'b'.repeat(64), context_hash: 'c'.repeat(64),
  }];
  put(root, 'docs/team/ROLE_CONTEXTS.md', `# Contexts\n\n<!-- role-context-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', hash_algorithm: hashAlgorithm, contexts: tampered }, null, 2)}\n\`\`\`\n<!-- /role-context-registry:v1 -->\n`);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /ROLE_CONTEXT hash가 내용과 다릅니다/);
}));

test('ROLE_CONTEXT의 빈 route나 잘못된 policy_hash를 잡는다', () => withFixture((root) => {
  const hashAlgorithm = 'sha256(context_id|version|route|autonomy_stage|decision_id|policy_hash)';
  const invalid = [{
    context_id: 'CTX-ORCH', version: 1, route: '', autonomy_stage: 'A0',
    decision_id: 'DEC-ACTIVATION-001', policy_hash: 'not-a-hash', context_hash: 'c'.repeat(64),
  }];
  put(root, 'docs/team/ROLE_CONTEXTS.md', `# Contexts\n\n<!-- role-context-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', hash_algorithm: hashAlgorithm, contexts: invalid }, null, 2)}\n\`\`\`\n<!-- /role-context-registry:v1 -->\n`);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /route\/policy_hash 결속이 잘못됐습니다/);
}));

test('RETIRED Learning의 폐기 Decision 누락을 잡는다', () => withFixture((root) => {
  const learning = { learning_id: 'LRN-TEST-001', status: 'RETIRED' };
  const assignment = { learning_id: 'LRN-TEST-001', author_role: 'LEGACY_UNKNOWN', lane_owner_role: 'SOLAR', verifier_role: 'CODEX-FUNCTION-QA', verifier_decision_id: null, contract_state: 'LEGACY_READ_ONLY' };
  put(root, 'docs/team/TEAM_LEARNING.md', `# Learning\n\n<!-- team-learning-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', learnings: [learning] }, null, 2)}\n\`\`\`\n<!-- /team-learning-registry:v1 -->\n\n<!-- team-learning-verifier-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', entries: [assignment] }, null, 2)}\n\`\`\`\n<!-- /team-learning-verifier-registry:v1 -->\n`);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /RETIRED Learning의 폐기 Decision 결속이 잘못됐습니다/);
}));

test('소유권 미수렴 RISKS 파일 생성을 잡는다', () => withFixture((root) => {
  put(root, 'docs/team/RISKS.md', '# Unowned Risks\n');
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /RISKS.md를 만들 수 없습니다/);
}));

test('manifest의 플러그인 실행 상태 복제를 잡는다', () => withFixture((root) => {
  const path = 'docs/team/roles/OPERATIONS.md';
  put(root, path, frontMatter({
    role_id: 'OPERATIONS', context_ids: ['CTX-OPS'], context_refs: [`CTX-OPS@1#${fixtureContextHash('CTX-OPS')}`], allowed_routes: ['NORMAL'], input_allowlist: ['Task Packet'],
    authority_links: ['docs/팀구성_상세기획안.md'], required_outputs: ['evidence'], verification_checklist: ['SHA'],
    handoff_in: ['predecessor'], handoff_out: ['successor'], stop_conditions: ['missing Decision'], human_escape: 'HUMAN-CHIEF',
    plugin_state: 'READY',
  }, '# Operations'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /실행 상태·판정 알고리즘을 복제/);
}));
