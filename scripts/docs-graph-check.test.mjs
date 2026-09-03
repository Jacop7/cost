import assert from 'node:assert/strict';
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

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'docs-graph-'));
  for (const [path, docId, authority] of planPaths) {
    const body = docId === 'directory' ? '# Directory\n\nRISKS는 아직 별도 정합화 대상이다.' : `# ${docId}`;
    put(root, path, frontMatter({ doc_id: docId, status: docId === 'team' ? 'CONFIRMED' : 'ACTIVE', authority }, body));
  }
  for (const path of ['README.md', 'DECISIONS.md', 'RELEASE_GATE.md', 'TEAM_LEARNING.md']) put(root, `docs/team/${path}`, `# ${path}\n`);
  put(root, 'docs/team/handoffs/README.md', '# HANDOFF\n');
  const contexts = Object.values(roleFiles).flatMap(([, ids]) => ids).map((contextId) => ({
    context_id: contextId,
    version: 1,
    context_hash: 'a'.repeat(64),
    autonomy_stage: 'A0',
    decision_id: 'DEC-ACTIVATION-001',
  }));
  put(root, 'docs/team/ROLE_CONTEXTS.md', `# Contexts\n\n<!-- role-context-registry:v1 -->\n\`\`\`json\n${JSON.stringify({ schema_version: '1.0', contexts }, null, 2)}\n\`\`\`\n<!-- /role-context-registry:v1 -->\n`);
  for (const [roleId, [filename, contextIds]] of Object.entries(roleFiles)) {
    put(root, `docs/team/roles/${filename}`, frontMatter({
      role_id: roleId,
      context_ids: contextIds,
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

test('필수 역할 manifest 누락을 잡는다', () => withFixture((root) => {
  rmSync(join(root, 'docs/team/roles/CODEX.md'));
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
    role_id: 'SOLAR', context_ids: ['CTX-UNKNOWN'], allowed_routes: ['NORMAL'], input_allowlist: ['Task Packet'],
    authority_links: ['docs/팀구성_상세기획안.md'], required_outputs: ['evidence'], verification_checklist: ['SHA'],
    handoff_in: ['predecessor'], handoff_out: ['successor'], stop_conditions: ['missing Decision'], human_escape: 'HUMAN-CHIEF',
  }, '# SOLAR'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /레지스트리에 없는 context/);
}));

test('소유권 미수렴 RISKS 파일 생성을 잡는다', () => withFixture((root) => {
  put(root, 'docs/team/RISKS.md', '# Unowned Risks\n');
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /RISKS.md를 만들 수 없습니다/);
}));

test('manifest의 플러그인 실행 상태 복제를 잡는다', () => withFixture((root) => {
  const path = 'docs/team/roles/OPERATIONS.md';
  put(root, path, frontMatter({
    role_id: 'OPERATIONS', context_ids: ['CTX-OPS'], allowed_routes: ['NORMAL'], input_allowlist: ['Task Packet'],
    authority_links: ['docs/팀구성_상세기획안.md'], required_outputs: ['evidence'], verification_checklist: ['SHA'],
    handoff_in: ['predecessor'], handoff_out: ['successor'], stop_conditions: ['missing Decision'], human_escape: 'HUMAN-CHIEF',
    plugin_state: 'READY',
  }, '# Operations'));
  assert.throws(() => checkDocsGraph({ rootDir: root, requireActivation: true }), /실행 상태·판정 알고리즘을 복제/);
}));
