import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const chatFiles = {
  'MASTER-01-HUMAN-DECISIONS': ['master-01-human-decisions.md', 'MASTER', '01 통합 작업큐 · 사람 결정', 'KNOWLEDGE-ORCHESTRATION'],
  'MASTER-02-ORCHESTRATION': ['master-02-orchestration.md', 'MASTER', '02 마스터 오케스트레이션', 'KNOWLEDGE-ORCHESTRATION'],
  'MASTER-03-DEPUTY-CONTEXT': ['master-03-deputy-context.md', 'MASTER', '03 부 오케스트레이션 · 토큰/컨텍스트 관리', 'KNOWLEDGE-ORCHESTRATION'],
  'MASTER-04-DEVELOPMENT-STAGING': ['master-04-development-staging.md', 'MASTER', '04 개발·스테이징 배포 검증', 'SERVER-SUPABASE-OPERATIONS'],
  'MASTER-05-PRODUCTION-RECOVERY': ['master-05-production-recovery.md', 'MASTER', '05 운영 배포 · 복구 게이트', 'SERVER-SUPABASE-OPERATIONS'],
  'DEPARTMENT-00-ALL-TEAMS-ROOM': ['department-00-all-teams-room.md', 'DEPARTMENT', '00 모든 팀 상황실', 'ALL-TEAMS-ROOM'],
  'DEPARTMENT-01-PRODUCT-MOBILE': ['department-01-product-mobile.md', 'DEPARTMENT', '01 Product · Mobile', 'PRODUCT-MOBILE'],
  'DEPARTMENT-02-DATA-BACKEND': ['department-02-data-backend.md', 'DEPARTMENT', '02 Data · Backend', 'DATA-BACKEND'],
  'DEPARTMENT-03-SERVER-OPERATIONS': ['department-03-server-operations.md', 'DEPARTMENT', '03 Server · Supabase · Operations', 'SERVER-SUPABASE-OPERATIONS'],
  'DEPARTMENT-04-QUALITY-REVIEW': ['department-04-quality-review.md', 'DEPARTMENT', '04 Quality · Review', 'QUALITY-REVIEW'],
  'DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION': ['department-05-knowledge-orchestration.md', 'DEPARTMENT', '05 Knowledge · Orchestration', 'KNOWLEDGE-ORCHESTRATION'],
};

const chatRouting = {
  'MASTER-01-HUMAN-DECISIONS': {
    acceptsFrom: ['MASTER-02-ORCHESTRATION', 'MASTER-04-DEVELOPMENT-STAGING', 'MASTER-05-PRODUCTION-RECOVERY'],
    routeEdges: ['MASTER-02-ORCHESTRATION|REQUEST,DECISION_POINTER'],
  },
  'MASTER-02-ORCHESTRATION': {
    acceptsFrom: ['MASTER-01-HUMAN-DECISIONS', 'MASTER-03-DEPUTY-CONTEXT', 'MASTER-04-DEVELOPMENT-STAGING', 'MASTER-05-PRODUCTION-RECOVERY'],
    routeEdges: ['MASTER-01-HUMAN-DECISIONS|AGGREGATE_RESULT,VERIFIED_STATUS,DECISION_POINTER', 'MASTER-03-DEPUTY-CONTEXT|CONFIRMED_ROUTE,TASK_DISPATCH', 'MASTER-04-DEVELOPMENT-STAGING|STAGING_GATE_REQUEST', 'MASTER-05-PRODUCTION-RECOVERY|PRODUCTION_GATE_REQUEST', 'DEPARTMENT-00-ALL-TEAMS-ROOM|VERIFIED_STATUS'],
  },
  'MASTER-03-DEPUTY-CONTEXT': {
    acceptsFrom: ['MASTER-02-ORCHESTRATION', 'DEPARTMENT-01-PRODUCT-MOBILE', 'DEPARTMENT-02-DATA-BACKEND', 'DEPARTMENT-03-SERVER-OPERATIONS', 'DEPARTMENT-04-QUALITY-REVIEW', 'DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION'],
    routeEdges: ['MASTER-02-ORCHESTRATION|TASK_RESULT,REVIEW_RESULT,AGGREGATE_RESULT,VERIFIED_STATUS,DECISION_POINTER', 'DEPARTMENT-01-PRODUCT-MOBILE|TASK_DISPATCH', 'DEPARTMENT-02-DATA-BACKEND|TASK_DISPATCH', 'DEPARTMENT-03-SERVER-OPERATIONS|TASK_DISPATCH', 'DEPARTMENT-04-QUALITY-REVIEW|REVIEW_REQUEST,TASK_DISPATCH', 'DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION|TASK_DISPATCH'],
  },
  'MASTER-04-DEVELOPMENT-STAGING': {
    acceptsFrom: ['MASTER-02-ORCHESTRATION'],
    routeEdges: ['MASTER-02-ORCHESTRATION|STAGING_GATE_RESULT,DECISION_POINTER', 'MASTER-01-HUMAN-DECISIONS|DECISION_POINTER'],
  },
  'MASTER-05-PRODUCTION-RECOVERY': {
    acceptsFrom: ['MASTER-02-ORCHESTRATION'],
    routeEdges: ['MASTER-02-ORCHESTRATION|DECISION_POINTER,VERIFIED_STATUS', 'MASTER-01-HUMAN-DECISIONS|DECISION_POINTER'],
  },
  'DEPARTMENT-00-ALL-TEAMS-ROOM': { acceptsFrom: ['MASTER-02-ORCHESTRATION'], routeEdges: [] },
  'DEPARTMENT-01-PRODUCT-MOBILE': { acceptsFrom: ['MASTER-03-DEPUTY-CONTEXT'], routeEdges: ['MASTER-03-DEPUTY-CONTEXT|TASK_RESULT'] },
  'DEPARTMENT-02-DATA-BACKEND': { acceptsFrom: ['MASTER-03-DEPUTY-CONTEXT'], routeEdges: ['MASTER-03-DEPUTY-CONTEXT|TASK_RESULT'] },
  'DEPARTMENT-03-SERVER-OPERATIONS': { acceptsFrom: ['MASTER-03-DEPUTY-CONTEXT'], routeEdges: ['MASTER-03-DEPUTY-CONTEXT|TASK_RESULT'] },
  'DEPARTMENT-04-QUALITY-REVIEW': { acceptsFrom: ['MASTER-03-DEPUTY-CONTEXT'], routeEdges: ['MASTER-03-DEPUTY-CONTEXT|REVIEW_RESULT,TASK_RESULT'] },
  'DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION': { acceptsFrom: ['MASTER-03-DEPUTY-CONTEXT'], routeEdges: ['MASTER-03-DEPUTY-CONTEXT|TASK_RESULT'] },
};

const departmentTitleByTeam = Object.fromEntries(Object.values(chatFiles)
  .filter(([, group]) => group === 'DEPARTMENT')
  .map(([, , title, teamId]) => [teamId, title]));

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
  const chatEntries = Object.entries(chatFiles).map(([chatId, [filename]]) => ({
    chat_id: chatId,
    manifest_path: `docs/team/chats/${filename}`,
    role_context_ids: ['CTX-ORCH'],
  }));
  put(root, 'docs/team/ROLE_CONTEXTS.md', `# Contexts\n\n<!-- role-context-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', hash_algorithm: hashAlgorithm, contexts }, null, 2)}\n\`\`\`\n<!-- /role-context-registry:v1 -->\n\n<!-- chat-context-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', entries: chatEntries }, null, 2)}\n\`\`\`\n<!-- /chat-context-registry:v1 -->\n`);
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
      announcement_chat: departmentTitleByTeam[teamId],
      temporary_task_condition: 'sealed Task Packet and edit lease',
      handoff_in: ['verified predecessor'],
      handoff_out: ['single successor'],
      chat_is_approval_authority: false,
    }, `# ${teamId}`));
  }
  for (const [chatId, [filename, chatGroup, exactTitle, teamId]] of Object.entries(chatFiles)) {
    const routing = chatRouting[chatId];
    put(root, `docs/team/chats/${filename}`, frontMatter({
      chat_id: chatId,
      schema_version: 2,
      accepts_from: routing.acceptsFrom,
      sends_to: routing.routeEdges.map((edge) => edge.split('|')[0]),
      route_edges: routing.routeEdges,
      title: exactTitle,
      purpose: `${chatGroup} route pointer`,
      role_context_ids: ['CTX-ORCH'],
      input: ['Task pointer'],
      output: ['route pointer'],
      authority_links: ['docs/작업큐.md', 'docs/team/handoffs/README.md', 'docs/team/DECISIONS.md',
        'docs/team/roles/ORCHESTRATION.md', `docs/team/teams/${teamFiles[teamId]}`],
      allowed_routes: ['NORMAL'],
      stop_conditions: ['missing Decision'],
      handoff_in: ['HUMAN-CHIEF'],
      handoff_out: ['ORCHESTRATION'],
    }));
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

test('chat manifest v2에서 02→01 반환 edge 누락을 거부한다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const original = readFileSync(join(root, path), 'utf8');
  put(root, path, original
    .replace('"MASTER-01-HUMAN-DECISIONS",', '')
    .replace('"MASTER-01-HUMAN-DECISIONS|AGGREGATE_RESULT,VERIFIED_STATUS,DECISION_POINTER",', ''));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /routing|accepts|sends|edge/i);
}));

test('chat manifest v2의 wildcard target을 거부한다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-03-deputy-context.md';
  const original = readFileSync(join(root, path), 'utf8');
  put(root, path, original.replaceAll('DEPARTMENT-01-PRODUCT-MOBILE', 'DEPARTMENT-*'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /routing|wildcard|논리 ID|route edge/i);
}));

test('chat manifest v2의 미등록 message kind를 거부한다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-01-human-decisions.md';
  const original = readFileSync(join(root, path), 'utf8');
  put(root, path, original.replace('REQUEST,DECISION_POINTER', 'REQUEST,DEPLOYMENT_DISPATCH'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /routing|message kind/i);
}));

test('00 상황실의 outbound route 추가를 거부한다', () => withFixture((root) => {
  const path = 'docs/team/chats/department-00-all-teams-room.md';
  const original = readFileSync(join(root, path), 'utf8');
  put(root, path, original
    .replace('sends_to: []', 'sends_to: ["MASTER-02-ORCHESTRATION"]')
    .replace('route_edges: []', 'route_edges: ["MASTER-02-ORCHESTRATION|TASK_RESULT"]'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /routing|edge/i);
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

test('필수 chat manifest 누락을 잡는다', () => withFixture((root) => {
  rmSync(join(root, 'docs/team/chats/master-02-orchestration.md'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /공식 11개 manifest만/);
}));

test('12번째 경쟁 chat manifest를 잡는다', () => withFixture((root) => {
  put(root, 'docs/team/chats/competing-policy.md', frontMatter({
    chat_id: 'COMPETING', title: '경쟁 권위', purpose: '중복', role_context_ids: ['CTX-ORCH'],
    input: ['Task'], output: ['policy'], authority_links: ['docs/작업큐.md'], allowed_routes: ['NORMAL'],
    stop_conditions: ['none'], handoff_in: ['HUMAN-CHIEF'], handoff_out: ['ORCHESTRATION'],
  }));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /공식 11개 manifest만/);
}));

test('chat title 중복을 잡는다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const text = readFileSync(join(root, path), 'utf8')
    .replace('title: 02 마스터 오케스트레이션', 'title: 01 통합 작업큐 · 사람 결정');
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /정확한 chat title이 없거나 중복/);
}));

test('chat context와 role manifest 불일치를 잡는다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const text = readFileSync(join(root, path), 'utf8').replace('["CTX-ORCH"]', '["CTX-UNKNOWN"]');
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /chat context가 role manifest\/레지스트리와 다릅니다/);
}));

test('chat manifest의 추가 필드를 잡는다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const text = readFileSync(join(root, path), 'utf8').replace('\n---\n', '\nnotes: policy copy\n---\n');
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /허용되지 않은 필드/);
}));

test('chat manifest의 본문을 잡는다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const text = `${readFileSync(join(root, path), 'utf8')}# 정책 복제\n`;
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /front matter 외 본문/);
}));

test('chat의 route 권한 상승을 잡는다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const text = readFileSync(join(root, path), 'utf8').replace('["NORMAL"]', '["OPERATIONS"]');
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /context\/role 범위를 벗어납니다/);
}));

test('chat의 필수 권위 포인터 누락을 잡는다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const text = readFileSync(join(root, path), 'utf8').replace(',"docs/team/DECISIONS.md"', '');
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /Task\/HANDOFF\/Decision\/role\/team 권위 포인터/);
}));

test('chat의 잘못된 HANDOFF endpoint를 잡는다', () => withFixture((root) => {
  const path = 'docs/team/chats/master-02-orchestration.md';
  const text = readFileSync(join(root, path), 'utf8').replace('["ORCHESTRATION"]', '["UNKNOWN-ROLE"]');
  put(root, path, text);
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /HANDOFF endpoint가 유효하지 않습니다/);
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
