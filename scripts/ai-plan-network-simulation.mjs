import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const PLAN_DOCS = Object.freeze({
  team: 'docs/팀구성_상세기획안.md',
  ontology: 'docs/AI-지식-온톨로지-기획안.md',
  orchestration: 'docs/AI-오케스트레이션-상세기획안.md',
  directory: 'docs/디렉터리-문서신경망-재설계-기획안.md',
  quality: 'docs/AI-품질-학습-자율성-평가기획안.md',
});

// 탐색 링크는 어느 문서에서 시작해도 전체 계약에 닿도록 순환을 허용한다.
const REQUIRED_REFERENCES = Object.freeze({
  team: ['ontology', 'orchestration', 'directory', 'quality'],
  ontology: ['team'],
  orchestration: ['team', 'ontology'],
  directory: ['team', 'ontology', 'orchestration'],
  quality: ['team', 'ontology', 'orchestration', 'directory'],
});

// 권위와 depends_on 방향은 탐색 링크와 달리 순환하면 안 된다.
const AUTHORITY_DEPENDENCIES = Object.freeze({
  team: [],
  ontology: ['team'],
  orchestration: ['team', 'ontology'],
  directory: ['team', 'ontology', 'orchestration'],
  quality: ['team', 'ontology', 'orchestration', 'directory'],
});

const REQUIRED_CLAUSES = Object.freeze({
  team: [
    /## 1\. 운영 모델 요약/,
    /ADD \| SUPERSEDE_PROPOSAL \| NEW_TASK \| STATUS_ONLY/,
    /Task별 단조 증가 `seq`와 직전 항목 hash/,
    /queue ledger\s*→\s*Task/,
    /ROLE_CONTEXTS\.md/,
    /TEAM_LEARNING\.md/,
    /docs\/team\/roles\/\*\.md/,
    /SOLAR-DEV-DB.*SOLAR-OPS/s,
  ],
  ontology: [
    /## 3\. 지식 노드/,
    /## 4\. 관계 모델/,
    /## 6\. 다중 채팅 요청 정규화/,
    /risk_level\/risk_basis/,
    /request_dispositions\[\].*Task별 seq.*직전\/item hash/,
    /docs-graph-check/,
    /\| `POINTS_TO` \| 권위를 만들지 않는 탐색 링크/,
    /\| `FINDING` \| `docs\/ai-review\/tasks\/\*\/rounds\/rNNN\/review\.json`/,
    /\| `ROUTES_TO` \| 정규화된 요청을 기존 또는 신규 Task에 배치/,
  ],
  orchestration: [
    /## 3\. 사용자 요청 수신/,
    /## 4\. 여러 채팅과 작업 연속성/,
    /## 5\. Task Graph/,
    /request_dispositions\[\].*전용 append/,
    /## 8\. 제작·검증·감사 루프/,
    /RUN_FAILED/,
  ],
  directory: [
    /경로·README·생성 색인·문서 그래프 검사\s*\|\s*디렉터리 기획안/,
    /품질 평가·Learning 승격·강등·자율성 단계\s*\|\s*평가 기획안/,
    /Learning 인스턴스 단일 장부\s*\|\s*`docs\/team\/TEAM_LEARNING\.md`/,
    /역할별 실행 manifest\s*\|\s*`docs\/team\/roles\/\*\.md`/,
    /## 8\. 생성 색인과 검사기/,
    /## 9\. 파일 이동 계약/,
    /queue ledger lock과 Task lock/,
    /NORMALIZED_REQUEST ─NORMALIZES→ REQUEST_INPUT/,
    /NORMALIZED_REQUEST ─ROUTES_TO→ TASK/,
    /SOURCE ─IMPLEMENTS→ DECISION/,
    /LEARNING ─APPLIES_TO→ 허용 route/,
  ],
  quality: [
    /## 4\. 평가 스위트/,
    /## 6\. Learning 승격·재사용·폐기/,
    /CANDIDATE \| VERIFIED \| RETIRED/,
    /## 8\. 자율성 단계/,
    /즉시 한 단계 내린다/,
    /## 13\. 사보타주 목록/,
    /RUN_FAILED/,
  ],
});

const OWNER_BRIDGES = Object.freeze([
  ['ontology', /권위 우선순위의 단일 소유자는 `팀구성_상세기획안\.md`/],
  ['orchestration', /판정 enum과 의미의 단일 소유자는 `AI-지식-온톨로지-기획안\.md`/],
  ['directory', /온톨로지의 노드·관계를 그대로 사용한다/],
  ['quality', /오케스트레이션 기획안 §8\.2가 단일 소유/],
  ['team', /평가 기획안\s*§8이 정의하는 route별 현재 자율성 단계/],
]);

const DISPOSITIONS = new Set(['ADD', 'SUPERSEDE_PROPOSAL', 'NEW_TASK', 'STATUS_ONLY']);
const AUTONOMY_STEPS = ['A0', 'A1', 'A2', 'A3', 'A4'];
const TASK_ROLE_IDS = new Set([
  'HUMAN-CHIEF', 'AI-DEPUTY-ORCHESTRATOR', 'SOLAR', 'SOLAR-AI-DEPUTY', 'SOLAR-ORCH',
  'SOLAR-ARCH', 'SOLAR-DEV-DB', 'SOLAR-DEV-CORE', 'SOLAR-DEV-MOBILE',
  'SOLAR-DEV-INTEGRATION', 'SOLAR-OPS', 'CODEX', 'CODEX-QA', 'CODEX-FUNCTION-QA',
  'FABLE-STRATEGY', 'FABLE-ARCH', 'FABLE-SEC', 'FABLE-FINAL',
]);
const HUMAN_APPROVER_IDS = new Set(['human-owner']);
const PLAN_METADATA_FIELDS = Object.freeze([
  'doc_id', 'doc_type', 'status', 'authority', 'owner', 'approver', 'version',
  'depends_on', 'supersedes', 'verified_by', 'review_by',
]);

const TASK_CONTRACT_FIELDS = Object.freeze([
  'roleId', 'route', 'reviewerRole', 'predecessorReview', 'requirementIds',
  'requestInputId', 'normalizedRequestId', 'objective', 'inScope', 'outOfScope',
  'acceptanceCriteria', 'roles', 'invariantIds', 'humanDecisions', 'dependsOn',
  'conversationRefs', 'lastVerifiedSha', 'agentsMdBlobSha', 'fixedDecisions',
  'openDecisions', 'openFindings', 'riskLevel', 'riskBasis', 'assumptions',
  'appliedLearningIds', 'excludedLearningIds', 'domainInvariants', 'artifactPaths',
  'referencePaths', 'evidencePaths', 'excludedPaths', 'nextSafeAction',
  'stopConditions', 'userOwnedChanges', 'activeBranch', 'worktreeState',
  'untrackedInScopePaths', 'requiredOutputs', 'requiredTestsEvidence',
  'knownRisks', 'humanQuestions',
]);

const CENTRAL_AUTHORITY = Object.freeze({
  '사람·AI 역할·승인': '팀 구성안',
  '지식 관계·다중 채팅 정규화': '온톨로지 기획안',
  '요청 수신·업무 정의·라우팅': '오케스트레이션 기획안',
  '경로·README·생성 색인·문서 그래프 검사': '디렉터리 기획안',
  '품질 평가·Learning 승격·강등·자율성 단계': '평가 기획안',
  'Learning 인스턴스 단일 장부': 'docs/team/TEAM_LEARNING.md',
  '역할별 실행 manifest': 'docs/team/roles/*.md',
});

export class SimulationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'SimulationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new SimulationError(code, message);
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function hashDispositionItem(entry) {
  const payload = {
    seq: entry.seq,
    kind: entry.kind,
    evidence_conversation_ref: entry.evidenceConversationRef,
    observed_at: entry.observedAt,
    requires_human_approval: entry.requiresHumanApproval,
    decision_id: entry.decisionId ?? null,
    previous_hash: entry.previousHash,
  };
  if (entry.changePayloadSha256) payload.change_payload_sha256 = entry.changePayloadSha256;
  return sha(JSON.stringify(payload));
}

export function classifyRequest({
  statusOnly = false,
  changesOutcome = false,
  cancelsWork = false,
  reducesScope = false,
  sameArtifact = true,
  sameRisk = true,
  sameReleaseCycle = true,
}) {
  if (changesOutcome || cancelsWork || reducesScope) return 'SUPERSEDE_PROPOSAL';
  if (statusOnly) return 'STATUS_ONLY';
  if (!sameArtifact || !sameRisk || !sameReleaseCycle) return 'NEW_TASK';
  return 'ADD';
}

function artifactRoot(path) {
  const canonical = posix.normalize(String(path)
    .replaceAll('\\', '/')
    .replace(/\/\*\*$/, '')
    .replace(/\/$/, ''))
    .replace(/^\.\//, '')
    .split('/')
    .map((segment) => segment.replace(/[. ]+$/g, '').toLowerCase())
    .join('/');
  const wildcardAt = canonical.search(/[?*[\]]/);
  if (wildcardAt < 0) return canonical;
  const literalPrefix = canonical.slice(0, wildcardAt);
  return literalPrefix.slice(0, literalPrefix.lastIndexOf('/') + 1).replace(/\/$/, '');
}

function isSafeRepoRelative(path) {
  const raw = String(path ?? '').replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || /^[a-z]:/i.test(raw)) return false;
  const normalized = posix.normalize(raw);
  return normalized !== '..' && !normalized.startsWith('../');
}

function navigableMarkdown(content) {
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function artifactOverlaps(left, right) {
  const a = artifactRoot(left);
  const b = artifactRoot(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function taskContractSha256(task) {
  return sha(JSON.stringify(Object.fromEntries(
    TASK_CONTRACT_FIELDS.map((field) => [field, clone(task[field])]),
  )));
}

function appendAudit(state, event) {
  const previousHash = state.audit.at(-1)?.auditHash ?? 'GENESIS';
  const payload = {
    ...clone(event), auditSeq: state.audit.length + 1, auditPreviousHash: previousHash,
  };
  const auditHash = sha(JSON.stringify(payload));
  state.audit.push({ ...payload, auditHash });
  return state.audit.at(-1);
}

function validateAuditChain(state) {
  let previousHash = 'GENESIS';
  state.audit.forEach((entry, index) => {
    assert.equal(entry.auditSeq, index + 1, '감사 사건 seq가 연속이어야 합니다.');
    assert.equal(entry.auditPreviousHash, previousHash, '감사 사건 이전 hash가 어긋났습니다.');
    const { auditHash, ...payload } = entry;
    assert.equal(auditHash, sha(JSON.stringify(payload)), `감사 사건 hash가 어긋났습니다: ${index + 1}:${entry.type}`);
    previousHash = auditHash;
  });
}

export function loadPlanDocuments(overrides = {}) {
  return Object.fromEntries(Object.entries(PLAN_DOCS).map(([id, path]) => [
    id,
    overrides[id] ?? readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'),
  ]));
}

function assertStronglyConnected(edges) {
  const ids = Object.keys(edges);
  for (const source of ids) {
    const seen = new Set([source]);
    const queue = [source];
    while (queue.length) {
      const current = queue.shift();
      for (const target of edges[current]) {
        if (seen.has(target)) continue;
        seen.add(target);
        queue.push(target);
      }
    }
    assert.deepEqual([...seen].sort(), [...ids].sort(), `${source}에서 다섯 문서 전체로 도달할 수 없습니다.`);
  }
}

function assertAcyclic(edges) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) assert.fail(`권위/의존 그래프 순환: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of edges[id]) visit(target);
    visiting.delete(id);
    visited.add(id);
  };
  Object.keys(edges).forEach(visit);
}

function assertCentralAuthorityTable(content) {
  const section = content.match(/### 5\.1 반드시 존재하는 중앙 노드\n([\s\S]*?)\n### 5\.2/)?.[1];
  assert.ok(section, '중앙 권위 표를 찾을 수 없습니다.');
  const rows = new Map();
  for (const line of section.split('\n')) {
    const match = line.match(/^\|\s*([^|-][^|]*?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!match || match[1].trim() === '주제') continue;
    const topic = match[1].trim();
    assert.equal(rows.has(topic), false, `중앙 권위 주제가 중복됐습니다: ${topic}`);
    rows.set(topic, match[2].trim().replaceAll('`', ''));
  }
  for (const [topic, owner] of Object.entries(CENTRAL_AUTHORITY)) {
    assert.equal(rows.get(topic), owner, `중앙 권위 불일치: ${topic} → ${owner}`);
  }
}

function parsePlanMetadata(id, content) {
  const starts = [...navigableMarkdown(content).matchAll(/^---\n(?=doc_id:)/gm)];
  assert.equal(starts.length, 1, `${id} plan metadata는 정확히 하나여야 합니다.`);
  assert.equal(starts[0].index, 0, `${id} plan metadata는 문서 첫 블록이어야 합니다.`);
  const end = content.indexOf('\n---\n', 4);
  assert.ok(end > 4, `${id} plan metadata 닫힘 표식이 없습니다.`);
  const body = content.slice(4, end);
  const metadata = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    assert.ok(match, `${id} plan metadata 형식 오류: ${line}`);
    assert.equal(Object.hasOwn(metadata, match[1]), false, `${id} plan metadata 필드 중복: ${match[1]}`);
    metadata[match[1]] = match[2].trim();
  }
  assert.deepEqual(Object.keys(metadata).sort(), [...PLAN_METADATA_FIELDS].sort(), `${id} plan metadata 필드 집합이 어긋났습니다.`);
  assert.equal(metadata.doc_id, id, `${id} doc_id가 파일 역할과 어긋났습니다.`);
  assert.equal(metadata.doc_type, 'ai_governance_plan', `${id} doc_type이 어긋났습니다.`);
  assert.ok(metadata.authority && metadata.owner && metadata.version, `${id} 권위·소유자·판본이 필요합니다.`);
  assert.equal(metadata.approver, 'HUMAN-CHIEF', `${id} 최종 승인자는 사람이어야 합니다.`);
  const allowedStatuses = id === 'team'
    ? ['CONFIRMED', 'ACTIVE', 'SUPERSEDED', 'RETIRED', 'HISTORICAL']
    : ['DRAFT', 'REVIEWED', 'ACTIVE', 'SUPERSEDED', 'RETIRED', 'HISTORICAL'];
  assert.ok(allowedStatuses.includes(metadata.status), `${id} 상태 enum 위반: ${metadata.status}`);
  const parseList = (field) => {
    const raw = metadata[field];
    const list = raw === '[]'
      ? []
      : raw.replace(/^\[/, '').replace(/\]$/, '').split(',').map((item) => item.trim()).filter(Boolean);
    assert.equal(`[${list.join(', ')}]`, raw, `${id} ${field} canonical 형식이 아닙니다.`);
    assert.equal(new Set(list).size, list.length, `${id} ${field} 대상이 중복됐습니다.`);
    return list;
  };
  const dependsOn = parseList('depends_on');
  const supersedes = parseList('supersedes');
  const verifiedBy = parseList('verified_by');
  assert.ok(verifiedBy.every((role) => TASK_ROLE_IDS.has(role)), `${id} verified_by 역할이 등록되지 않았습니다.`);
  assert.match(metadata.review_by, /^\d{4}-\d{2}-\d{2}$/, `${id} review_by는 YYYY-MM-DD여야 합니다.`);
  assert.equal(Number.isNaN(Date.parse(`${metadata.review_by}T00:00:00Z`)), false, `${id} review_by 날짜가 유효하지 않습니다.`);
  if (['CONFIRMED', 'ACTIVE'].includes(metadata.status)) {
    assert.ok(verifiedBy.length > 0, `${id} 현재 권위 상태는 verified_by가 필요합니다.`);
  }
  for (const target of supersedes) {
    assert.match(target, new RegExp(`^${id}@[0-9]+\\.[0-9]+(?:\\.[0-9]+)?$`),
      `${id} supersedes는 같은 권위의 이전 doc_id@version만 가리켜야 합니다: ${target}`);
    assert.notEqual(target, `${id}@${metadata.version}`, `${id}는 현재 판본을 supersedes할 수 없습니다.`);
  }
  const visible = navigableMarkdown(content.slice(end + 5));
  const statusLine = visible.match(/^> 상태:\s*(.+)$/m)?.[1] ?? '';
  if (metadata.status === 'DRAFT') assert.match(statusLine, /초안|DRAFT/, `${id} 본문 상태가 metadata DRAFT와 어긋났습니다.`);
  if (metadata.status === 'REVIEWED') assert.match(statusLine, /REVIEWED/, `${id} 본문 상태가 metadata REVIEWED와 어긋났습니다.`);
  if (metadata.status === 'ACTIVE') assert.match(statusLine, /ACTIVE/, `${id} 본문 상태가 metadata ACTIVE와 어긋났습니다.`);
  if (metadata.status === 'CONFIRMED') assert.match(statusLine, /확정/, `${id} 본문 상태가 metadata CONFIRMED와 어긋났습니다.`);
  if (['SUPERSEDED', 'RETIRED', 'HISTORICAL'].includes(metadata.status)) {
    assert.match(statusLine, new RegExp(metadata.status), `${id} 본문 상태가 metadata ${metadata.status}와 어긋났습니다.`);
  }
  return { ...metadata, dependsOn, supersedes, verifiedBy };
}

function assertDeclaredAuthorityDag(content) {
  const starts = [...content.matchAll(/<!-- authority-dag:start -->/g)];
  const ends = [...content.matchAll(/<!-- authority-dag:end -->/g)];
  assert.equal(starts.length, 1, '핵심 문서 권위 DAG 시작 표식은 정확히 하나여야 합니다.');
  assert.equal(ends.length, 1, '핵심 문서 권위 DAG 종료 표식은 정확히 하나여야 합니다.');
  const block = content.match(/<!-- authority-dag:start -->\n([\s\S]*?)\n<!-- authority-dag:end -->/)?.[1];
  assert.ok(block, '핵심 문서 권위 DAG 선언을 찾을 수 없습니다.');
  const declared = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^\|\s*(team|ontology|orchestration|directory|quality)\s*\|\s*([^|]*)\|$/);
    if (!match) continue;
    assert.equal(Object.hasOwn(declared, match[1]), false, `권위 DAG 노드 중복: ${match[1]}`);
    declared[match[1]] = match[2].trim() === '[]'
      ? []
      : match[2].trim().replace(/^\[/, '').replace(/\]$/, '').split(',').map((item) => item.trim()).filter(Boolean);
  }
  assert.deepEqual(declared, AUTHORITY_DEPENDENCIES, '문서 권위 DAG 선언이 단일 계약과 어긋났습니다.');
}

function assertMarkdownLinksExist(id, content) {
  const sourceDir = dirname(join(root, PLAN_DOCS[id]));
  for (const match of navigableMarkdown(content).matchAll(/\]\(([^)]+)\)/g)) {
    const raw = match[1].trim();
    if (!raw) continue;
    assert.doesNotMatch(raw, /^[a-z]:[\\/]/i, `${id} Markdown 링크가 절대 경로를 가리킵니다: ${raw}`);
    if (/^[a-z]+:/i.test(raw)) {
      assert.match(raw, /^(?:https?|mailto):/i, `${id} 허용되지 않은 Markdown URI: ${raw}`);
      continue;
    }
    const [encodedPath, encodedAnchor = ''] = raw.split('#');
    const path = decodeURIComponent(encodedPath);
    const absolute = resolve(sourceDir, path || PLAN_DOCS[id].split('/').at(-1));
    const fromRoot = relative(root, absolute);
    assert.ok(fromRoot && !fromRoot.startsWith('..') && !isAbsolute(fromRoot),
      `${id} Markdown 링크가 저장소 밖을 가리킵니다: ${raw}`);
    assert.ok(existsSync(absolute), `${id} 깨진 Markdown 링크: ${raw}`);
    if (encodedAnchor) {
      const anchor = decodeURIComponent(encodedAnchor).toLowerCase();
      const target = readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n');
      const slugs = [...navigableMarkdown(target).matchAll(/^#{1,6}\s+(.+)$/gm)].map((heading) => (
        heading[1].trim().toLowerCase()
          .replace(/<[^>]+>/g, '')
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .replace(/\s/g, '-')
      ));
      assert.ok(slugs.includes(anchor), `${id} 존재하지 않는 Markdown anchor: ${raw}`);
    }
  }
}

export function validateDocumentNetwork(documents, authorityDependencies = AUTHORITY_DEPENDENCIES) {
  const ids = Object.keys(PLAN_DOCS);
  const referenceEdges = Object.fromEntries(ids.map((id) => [id, []]));
  const metadata = {};
  for (const id of ids) {
    const content = documents[id];
    assert.equal(typeof content, 'string', `${id} 문서를 읽지 못했습니다.`);
    const navigable = navigableMarkdown(content);
    metadata[id] = parsePlanMetadata(id, content);
    for (const clause of REQUIRED_CLAUSES[id]) assert.match(navigable, clause, `${id} 필수 계약 누락: ${clause}`);
    assertMarkdownLinksExist(id, content);
    for (const target of REQUIRED_REFERENCES[id]) {
      const filename = PLAN_DOCS[target].split('/').at(-1);
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const markdownLink = new RegExp(`\\]\\((?:\\./)?${escaped}(?:#[^)]+)?\\)`);
      assert.match(navigable, markdownLink, `${id} → ${target} Markdown 참조가 없습니다.`);
      referenceEdges[id].push(target);
    }
  }
  const nonTeamStatusList = ids.filter((id) => id !== 'team').map((id) => metadata[id].status);
  if (nonTeamStatusList.some((status) => ['DRAFT', 'REVIEWED'].includes(status))) {
    assert.equal(new Set(nonTeamStatusList).size, 1, '최초 활성화 전 네 후보 기획안 상태는 원자적으로 같아야 합니다.');
  }
  const metadataDependencies = Object.fromEntries(ids.map((id) => [id, metadata[id].dependsOn]));
  assertAcyclic(authorityDependencies);
  assert.deepEqual(metadataDependencies, authorityDependencies, '각 문서 metadata 의존성이 권위 DAG와 어긋났습니다.');
  assert.equal(new Set(ids.map((id) => metadata[id].authority)).size, ids.length, '기획안 authority 주제가 중복됐습니다.');
  for (const [id, clause] of OWNER_BRIDGES) assert.match(navigableMarkdown(documents[id]), clause, `${id}의 단일 소유 위임 계약이 없습니다.`);
  const directoryNavigable = navigableMarkdown(documents.directory);
  assert.doesNotMatch(directoryNavigable, /§8\.2가 정한 다섯 문서/, '누적 문서 수를 디렉터리 기획안에 복제하면 안 됩니다.');
  assert.doesNotMatch(directoryNavigable, /REQUEST_INPUT ─NORMALIZES→/, '온톨로지의 NORMALIZES 방향을 뒤집으면 안 됩니다.');
  assertCentralAuthorityTable(directoryNavigable);
  assertDeclaredAuthorityDag(documents.directory);
  assertStronglyConnected(referenceEdges);
  assertAcyclic(metadataDependencies);
  return {
    nodeCount: ids.length,
    referenceEdges,
    referenceStronglyConnected: true,
    authorityDependencies: metadataDependencies,
    authorityAcyclic: true,
    planMetadata: metadata,
  };
}

export function createSimulationState() {
  return {
    executionBoundary: 'VIRTUAL_SIMULATION',
    clock: 1,
    queueLock: null,
    taskLocks: {},
    requestInputs: {},
    normalizedRequests: {},
    tasks: {},
    decisions: {},
    planStatus: {
      team: 'CONFIRMED', ontology: 'DRAFT', orchestration: 'DRAFT', directory: 'DRAFT', quality: 'DRAFT',
    },
    planReviewRuns: [],
    reviewTasks: {},
    codexEvidence: [],
    findings: {},
    evidenceArtifacts: {},
    protectedGates: [],
    directoryPreflights: {},
    closureSuccessors: {},
    activationCommitSha: null,
    activationDecisionId: null,
    agentsResponsibilitiesUpdated: false,
    directoryMaterialized: false,
    learning: {},
    autonomy: { default: 'A0' },
    autonomyPromotionDecisionsUsed: [],
    humanApproverIds: [...HUMAN_APPROVER_IDS],
    appliedDispositionKeys: {},
    audit: [],
  };
}

function taskOf(state, taskId) {
  const task = state.tasks[taskId];
  if (!task) fail('TASK_NOT_FOUND', taskId);
  return task;
}

function assertLeaseMatchesAudit(state, task) {
  const registered = state.audit.find((entry) => entry.type === 'TASK_REGISTERED' && entry.taskId === task.taskId);
  const lastLease = state.audit.filter((entry) => entry.type === 'LEASE' && entry.taskId === task.taskId).at(-1);
  const expectedOwner = lastLease?.actor ?? registered?.editOwner;
  const expectedSession = lastLease ? `session:${lastLease.actor}` : registered?.ownerSessionRef;
  const expectedExpiry = lastLease?.expires ?? registered?.leaseExpiresAt;
  if (!registered || task.editOwner !== expectedOwner || task.ownerSessionRef !== expectedSession
    || task.leaseExpiresAt !== expectedExpiry) {
    fail('LEASE_AUDIT_MISMATCH', task.taskId);
  }
}

function taskDispositionSnapshot(task) {
  const items = clone(task.requestDispositions);
  return {
    count: items.length,
    seq: items.at(-1)?.seq ?? 0,
    headHash: items.at(-1)?.itemHash ?? 'GENESIS',
    prefixHash: sha(JSON.stringify(items)),
  };
}

function normalizedTaskPayload(input) {
  return {
    objective: input.objective,
    inScope: input.inScope,
    outOfScope: input.outOfScope,
    acceptanceCriteria: input.acceptanceCriteria,
    route: input.route,
    riskLevel: input.riskLevel,
    riskBasis: input.riskBasis,
    artifactPaths: input.artifactPaths,
  };
}

export function recordRequestPair(state, input) {
  if (state.requestInputs[input.requestInputId] || state.normalizedRequests[input.normalizedRequestId]) {
    fail('REQUEST_EXISTS', input.requestInputId);
  }
  const payload = clone(normalizedTaskPayload(input));
  const payloadSha256 = sha(JSON.stringify(payload));
  const request = {
    requestInputId: input.requestInputId,
    conversationRef: input.conversationRef,
    observedAt: input.observedAt,
    payloadSha256,
  };
  const normalized = {
    normalizedRequestId: input.normalizedRequestId,
    requestInputId: input.requestInputId,
    payload,
    payloadSha256,
  };
  state.requestInputs[input.requestInputId] = request;
  state.normalizedRequests[input.normalizedRequestId] = normalized;
  appendAudit(state, { type: 'REQUEST_RECORDED', ...request });
  appendAudit(state, { type: 'REQUEST_NORMALIZED', ...normalized });
}

export function observeDispositionPrefix(state, taskId) {
  return taskDispositionSnapshot(taskOf(state, taskId));
}

export function acquireQueueLock(state, actor) {
  if (state.queueLock && state.queueLock !== actor) fail('QUEUE_LOCKED', state.queueLock);
  if (Object.values(state.taskLocks).some((lock) => lock.actor === actor)) fail('LOCK_ORDER', 'Task lock 보유 중 queue ledger lock 획득 금지');
  state.queueLock = actor;
  appendAudit(state, { type: 'QUEUE_LOCK', actor });
}

export function releaseQueueLock(state, actor) {
  if (state.queueLock !== actor) fail('QUEUE_LOCK_OWNER', actor);
  state.queueLock = null;
}

export function acquireTaskLock(state, actor, taskId) {
  if (state.queueLock !== actor) fail('LOCK_ORDER', 'queue ledger lock을 먼저 획득해야 함');
  const held = state.taskLocks[taskId];
  if (held && held.actor !== actor) fail('TASK_LOCKED', held.actor);
  state.taskLocks[taskId] = { actor, purpose: 'QUEUE_UPDATE' };
  appendAudit(state, { type: 'TASK_LOCK', actor, taskId, purpose: 'QUEUE_UPDATE' });
}

export function acquireCollaborationLock(state, actor, taskId) {
  if (state.queueLock) fail('LOCK_NEST', 'queue ledger lock과 collaboration lock 중첩 금지');
  const held = state.taskLocks[taskId];
  if (held && held.actor !== actor) fail('TASK_LOCKED', held.actor);
  state.taskLocks[taskId] = { actor, purpose: 'COLLABORATION_APPEND' };
  appendAudit(state, { type: 'TASK_LOCK', actor, taskId, purpose: 'COLLABORATION_APPEND' });
}

export function releaseTaskLock(state, actor, taskId) {
  if (state.taskLocks[taskId]?.actor !== actor) fail('TASK_LOCK_OWNER', taskId);
  delete state.taskLocks[taskId];
}

function assertQueueTaskLock(state, actor, taskId) {
  if (state.queueLock !== actor || state.taskLocks[taskId]?.actor !== actor
    || state.taskLocks[taskId]?.purpose !== 'QUEUE_UPDATE') {
    fail('LOCK_ORDER', 'queue ledger → Task 잠금 순서 불일치');
  }
}

function makeTaskPacket(actor, input, state) {
  const task = {
    taskId: input.taskId,
    roleId: input.roleId,
    route: input.route,
    reviewerRole: input.reviewerRole,
    predecessorReview: input.predecessorReview,
    requirementIds: [...input.requirementIds],
    requestInputId: input.requestInputId,
    normalizedRequestId: input.normalizedRequestId,
    currentState: 'DEFINED',
    objective: input.objective,
    inScope: [...input.inScope],
    outOfScope: [...input.outOfScope],
    acceptanceCriteria: [...input.acceptanceCriteria],
    roles: [...input.roles],
    invariantIds: [...input.invariantIds],
    humanDecisions: [...input.humanDecisions],
    dependsOn: [...input.dependsOn],
    conversationRefs: [input.conversationRef],
    lastVerifiedSha: input.lastVerifiedSha,
    agentsMdBlobSha: input.agentsMdBlobSha,
    fixedDecisions: [],
    openDecisions: [],
    openFindings: [],
    requestDispositions: [],
    riskLevel: input.riskLevel,
    riskBasis: input.riskBasis,
    assumptions: clone(input.assumptions),
    appliedLearningIds: [...input.appliedLearningIds],
    excludedLearningIds: clone(input.excludedLearningIds),
    domainInvariants: [...input.domainInvariants],
    artifactPaths: [...input.artifactPaths],
    referencePaths: [...input.referencePaths],
    evidencePaths: [...input.evidencePaths],
    excludedPaths: [...input.excludedPaths],
    nextSafeAction: input.nextSafeAction,
    stopConditions: [...input.stopConditions],
    userOwnedChanges: clone(input.userOwnedChanges),
    editOwner: actor,
    ownerSessionRef: `session:${actor}`,
    leaseExpiresAt: state.clock + input.leaseTtl,
    activeBranch: input.activeBranch,
    worktreeState: input.worktreeState,
    untrackedInScopePaths: [...input.untrackedInScopePaths],
    requiredOutputs: [...input.requiredOutputs],
    requiredTestsEvidence: [...input.requiredTestsEvidence],
    knownRisks: [...input.knownRisks],
    humanQuestions: [...input.humanQuestions],
    revision: 1,
    contractVersion: 1,
    contractSha256: null,
  };
  task.contractSha256 = taskContractSha256(task);
  return task;
}

export function validateTaskPacket(task) {
  const required = [
    'taskId', 'roleId', 'route', 'reviewerRole', 'predecessorReview',
    'requirementIds', 'requestInputId', 'normalizedRequestId',
    'currentState', 'objective', 'inScope', 'outOfScope', 'acceptanceCriteria', 'roles',
    'invariantIds', 'humanDecisions',
    'dependsOn', 'conversationRefs', 'lastVerifiedSha', 'agentsMdBlobSha', 'fixedDecisions',
    'openDecisions', 'openFindings', 'requestDispositions', 'riskLevel', 'riskBasis', 'assumptions',
    'appliedLearningIds', 'excludedLearningIds', 'domainInvariants',
    'artifactPaths', 'referencePaths', 'evidencePaths', 'excludedPaths', 'nextSafeAction',
    'stopConditions', 'userOwnedChanges', 'editOwner', 'ownerSessionRef', 'leaseExpiresAt',
    'activeBranch', 'worktreeState', 'untrackedInScopePaths', 'requiredOutputs',
    'requiredTestsEvidence', 'knownRisks', 'humanQuestions', 'contractVersion', 'contractSha256',
  ];
  for (const field of required) assert.ok(Object.hasOwn(task, field), `Task 필수 필드 누락: ${field}`);
  assert.match(task.riskLevel, /^R[0-3]$/);
  assert.ok(TASK_ROLE_IDS.has(task.roleId), `등록되지 않은 Task 역할: ${task.roleId}`);
  assert.ok(task.roles.every((role) => TASK_ROLE_IDS.has(role)), `등록되지 않은 참여 역할: ${task.roles.join(',')}`);
  assert.ok(task.roleId && task.route && task.requirementIds.length && task.requestInputId && task.normalizedRequestId,
    'Task Packet은 역할·요구사항·정규화 요청 결속이 필요합니다.');
  assert.ok(task.requiredOutputs.length && task.requiredTestsEvidence.length, 'Task Packet은 산출물과 증거 계약이 필요합니다.');
  assert.ok(Number.isInteger(task.contractVersion) && task.contractVersion > 0, 'Task contract 판본이 필요합니다.');
  assert.equal(task.contractSha256, taskContractSha256(task), 'Task contract hash가 현재 계약과 어긋났습니다.');
  for (const field of ['artifactPaths', 'referencePaths', 'evidencePaths', 'excludedPaths', 'untrackedInScopePaths']) {
    assert.ok(task[field].every(isSafeRepoRelative), `Task ${field}에는 저장소 상대 안전 경로만 허용됩니다.`);
  }
  for (const change of task.userOwnedChanges) {
    assert.ok(change?.path && isSafeRepoRelative(change.path) && change.disposition === 'EXCLUDE',
      '사용자 소유 변경은 안전 경로와 EXCLUDE 처리가 필요합니다.');
    assert.ok(task.excludedPaths.some((path) => artifactOverlaps(path, change.path)),
      `사용자 소유 변경이 excluded_paths에 없습니다: ${change.path}`);
    assert.equal(task.artifactPaths.some((path) => artifactOverlaps(path, change.path)), false,
      `사용자 소유 변경과 artifact_paths가 겹칩니다: ${change.path}`);
  }
  assert.ok(['DEFINED', 'IMPLEMENTED', 'REVIEWING', 'BLOCKED', 'DONE'].includes(task.currentState), 'Task 상태 enum 위반');
  assert.ok(task.riskBasis, 'riskBasis가 필요합니다.');
  for (const assumption of task.assumptions) {
    assert.ok(assumption.assumption && assumption.verifier && assumption.invalidation, 'assumption은 verifier와 invalidation을 가져야 합니다.');
  }
  validateDispositionChain(task);
  return true;
}

export function registerTask(state, actor, input) {
  assertQueueTaskLock(state, actor, input.taskId);
  if (state.tasks[input.taskId]) fail('TASK_EXISTS', input.taskId);
  const request = state.requestInputs[input.requestInputId];
  const normalized = state.normalizedRequests[input.normalizedRequestId];
  const expectedPayloadSha = sha(JSON.stringify(normalizedTaskPayload(input)));
  if (!request || !normalized || normalized.requestInputId !== input.requestInputId
    || request.payloadSha256 !== expectedPayloadSha || normalized.payloadSha256 !== expectedPayloadSha) {
    fail('NORMALIZED_REQUEST_REQUIRED', input.taskId);
  }
  if (!Number.isInteger(input.leaseTtl) || input.leaseTtl <= 0) fail('LEASE_TTL_INVALID', String(input.leaseTtl));
  for (const dependency of input.dependsOn) {
    if (!state.tasks[dependency]) fail('TASK_DEPENDENCY_MISSING', `${input.taskId}:${dependency}`);
    if (dependency === input.taskId) fail('TASK_DEPENDENCY_CYCLE', input.taskId);
  }
  const conflict = Object.values(state.tasks).find((task) => (
    task.currentState !== 'DONE'
    && task.artifactPaths.some((path) => input.artifactPaths.some((candidate) => artifactOverlaps(path, candidate)))
  ));
  if (conflict) fail('ARTIFACT_LEASE_CONFLICT', `${conflict.taskId} ↔ ${input.taskId}`);
  const task = makeTaskPacket(actor, input, state);
  validateTaskPacket(task);
  state.tasks[input.taskId] = task;
  appendDisposition(state, actor, input.taskId, {
    kind: 'NEW_TASK', evidenceConversationRef: input.conversationRef, observedAt: input.observedAt,
    requiresHumanApproval: false, decisionId: input.creationDecisionId ?? null,
  });
  validateTaskPacket(task);
  appendAudit(state, {
    type: 'TASK_REGISTERED', actor, taskId: input.taskId,
    contractVersion: task.contractVersion, contractSha256: task.contractSha256,
    editOwner: task.editOwner, ownerSessionRef: task.ownerSessionRef,
    leaseExpiresAt: task.leaseExpiresAt,
  });
}

export function appendDisposition(state, actor, taskId, input) {
  if (state.queueLock !== actor) fail('QUEUE_LOCK_REQUIRED', actor);
  if (!DISPOSITIONS.has(input.kind)) fail('BAD_DISPOSITION', input.kind);
  const task = taskOf(state, taskId);
  if (task.currentState === 'DONE' && input.kind !== 'STATUS_ONLY') fail('TASK_TERMINAL', taskId);
  const beforeOtherFields = clone({ ...task, requestDispositions: undefined });
  const previous = task.requestDispositions.at(-1);
  const payload = {
    seq: (previous?.seq ?? 0) + 1,
    kind: input.kind,
    evidenceConversationRef: input.evidenceConversationRef,
    observedAt: input.observedAt,
    requiresHumanApproval: input.requiresHumanApproval,
    decisionId: input.decisionId ?? null,
    previousHash: previous?.itemHash ?? 'GENESIS',
  };
  if (input.changePayload) payload.changePayloadSha256 = sha(JSON.stringify(input.changePayload));
  if (['ADD', 'SUPERSEDE_PROPOSAL'].includes(input.kind) && !payload.changePayloadSha256) {
    fail('DISPOSITION_PAYLOAD_REQUIRED', input.kind);
  }
  const itemHash = hashDispositionItem(payload);
  task.requestDispositions.push({ ...payload, itemHash });
  const afterOtherFields = clone({ ...task, requestDispositions: undefined });
  assert.deepEqual(afterOtherFields, beforeOtherFields, 'disposition append가 Task의 다른 필드를 바꿨습니다.');
  validateDispositionChain(task);
  appendAudit(state, { type: 'DISPOSITION', actor, taskId, ...payload, itemHash });
  return task.requestDispositions.at(-1);
}

export function applyAddDisposition(state, actor, taskId, {
  dispositionSeq, observedPrefix, addInScope = [], addAcceptanceCriteria = [], addArtifactPaths = [],
}) {
  assertQueueTaskLock(state, actor, taskId);
  const task = taskOf(state, taskId);
  assertLeaseMatchesAudit(state, task);
  if (task.currentState === 'DONE') fail('TASK_TERMINAL', taskId);
  if (state.taskLocks[taskId]?.actor !== actor || task.editOwner !== actor
    || task.ownerSessionRef !== `session:${actor}` || task.leaseExpiresAt <= state.clock) {
    fail('STALE_WRITER', actor);
  }
  assert.deepEqual(taskDispositionSnapshot(task), observedPrefix, '환경 미검증: disposition prefix가 바뀌었습니다.');
  const disposition = task.requestDispositions.find((entry) => entry.seq === dispositionSeq);
  const dispositionKey = `${taskId}:${dispositionSeq}:${disposition?.itemHash ?? 'missing'}`;
  if (!disposition || disposition.kind !== 'ADD' || state.appliedDispositionKeys[dispositionKey]) {
    fail('ADD_DISPOSITION_REQUIRED', dispositionKey);
  }
  const changePayload = { addInScope, addAcceptanceCriteria, addArtifactPaths };
  if (disposition.changePayloadSha256 !== sha(JSON.stringify(changePayload))) {
    fail('DISPOSITION_PAYLOAD_MISMATCH', dispositionKey);
  }
  const sensitive = [...addInScope, ...addAcceptanceCriteria, ...addArtifactPaths]
    .some((item) => /(?:packages[\\/]db|supabase|production|운영|DB\b)/i.test(String(item)));
  if (sensitive && task.riskLevel === 'R0') fail('RISK_RECLASSIFICATION_REQUIRED', taskId);
  if (![...addInScope, ...addAcceptanceCriteria, ...addArtifactPaths].length
    || [...addInScope, ...addAcceptanceCriteria, ...addArtifactPaths].some((item) => !String(item).trim())
    || addArtifactPaths.some((path) => !isSafeRepoRelative(path))) {
    fail('ADD_PAYLOAD_INVALID', taskId);
  }
  const duplicate = addInScope.some((item) => task.inScope.includes(item))
    || addAcceptanceCriteria.some((item) => task.acceptanceCriteria.includes(item))
    || addArtifactPaths.some((item) => task.artifactPaths.some((path) => artifactRoot(path) === artifactRoot(item)));
  if (duplicate) fail('ADD_NOT_APPEND_ONLY', taskId);
  const conflict = Object.values(state.tasks).find((other) => (
    other.taskId !== taskId && other.currentState !== 'DONE'
    && other.artifactPaths.some((path) => addArtifactPaths.some((candidate) => artifactOverlaps(path, candidate)))
  ));
  if (conflict) fail('ARTIFACT_LEASE_CONFLICT', `${conflict.taskId} ↔ ${taskId}`);
  task.inScope.push(...clone(addInScope));
  task.acceptanceCriteria.push(...clone(addAcceptanceCriteria));
  task.artifactPaths.push(...clone(addArtifactPaths));
  task.contractVersion += 1;
  task.contractSha256 = taskContractSha256(task);
  task.revision += 1;
  state.appliedDispositionKeys[dispositionKey] = true;
  appendAudit(state, {
    type: 'TASK_ADD_APPLIED', actor, taskId, dispositionSeq,
    dispositionItemHash: disposition.itemHash, revision: task.revision,
    addInScope: clone(addInScope), addAcceptanceCriteria: clone(addAcceptanceCriteria),
    addArtifactPaths: clone(addArtifactPaths), contractVersion: task.contractVersion,
    contractSha256: task.contractSha256,
  });
}

export function validateDispositionChain(task) {
  let previousHash = 'GENESIS';
  task.requestDispositions.forEach((entry, index) => {
    assert.ok(DISPOSITIONS.has(entry.kind), `Task별 disposition enum 위반: ${entry.kind}`);
    if (entry.kind === 'SUPERSEDE_PROPOSAL') {
      assert.equal(entry.requiresHumanApproval, true, 'SUPERSEDE_PROPOSAL은 사람 승인이 필요합니다.');
    }
    assert.equal(entry.seq, index + 1, 'Task별 disposition seq가 연속이어야 합니다.');
    assert.equal(entry.previousHash, previousHash, 'Task별 disposition 이전 hash가 어긋났습니다.');
    const payload = {
      seq: entry.seq,
      kind: entry.kind,
      evidenceConversationRef: entry.evidenceConversationRef,
      observedAt: entry.observedAt,
      requiresHumanApproval: entry.requiresHumanApproval,
      decisionId: entry.decisionId,
      previousHash: entry.previousHash,
    };
    if (entry.changePayloadSha256) payload.changePayloadSha256 = entry.changePayloadSha256;
    assert.equal(entry.itemHash, hashDispositionItem(payload), 'Task별 disposition item hash가 어긋났습니다.');
    previousHash = entry.itemHash;
  });
  return true;
}

function assertTaskCompletionQuorum(state, task, exactSha) {
  const codexScopes = new Set(state.codexEvidence
    .filter((run) => run.subjectTaskId === task.taskId && run.exactSha === exactSha
      && run.subjectContractVersion === task.contractVersion
      && run.subjectContractSha256 === task.contractSha256)
    .map((run) => run.auditScope));
  const fablePasses = state.planReviewRuns.filter((run) => (
    run.valid && run.subjectTaskId === task.taskId && run.exactSha === exactSha
    && run.subjectContractVersion === task.contractVersion
    && run.subjectContractSha256 === task.contractSha256
    && run.reviewRoute === 'FINAL_INDEPENDENT' && run.reviewMode === 'FINAL'
    && run.reviewerRole === 'FABLE-FINAL' && run.authorRole === 'AI-DEPUTY-ORCHESTRATOR'
  ));
  const fableScopes = new Set(fablePasses.map((run) => run.auditScope));
  const fableTasks = new Set(fablePasses.map((run) => run.reviewTaskId));
  const independentRequests = new Set(fablePasses.map((run) => JSON.stringify(run.independentRequest)));
  if (!codexScopes.has('CONTRACT_AUDIT') || !codexScopes.has('ADVERSARIAL_AUDIT')
    || !fableScopes.has('WORKFLOW_FIDELITY') || !fableScopes.has('NETWORK_CLOSURE')
    || fableTasks.size < 2 || independentRequests.size < 2) {
    fail('TASK_REVIEW_QUORUM_REQUIRED', task.taskId);
  }
  const blockedDependency = task.dependsOn.find((id) => state.tasks[id]?.currentState !== 'DONE');
  if (blockedDependency) fail('TASK_DEPENDENCY_NOT_DONE', `${task.taskId}:${blockedDependency}`);
  const openRequired = Object.values(state.findings).filter((finding) => (
    finding.subjectTaskId === task.taskId && finding.required
    && ['OPEN', 'DISPUTED'].includes(finding.reviewState)
  ));
  if (openRequired.length) fail('REQUIRED_FINDINGS_OPEN', openRequired.map((item) => item.findingId).join(','));
}

export function updateTask(state, actor, taskId, patch, observedPrefix) {
  assertQueueTaskLock(state, actor, taskId);
  const task = taskOf(state, taskId);
  assertLeaseMatchesAudit(state, task);
  if (task.currentState === 'DONE') fail('TASK_TERMINAL', taskId);
  if (task.editOwner !== actor || task.ownerSessionRef !== `session:${actor}`) fail('STALE_WRITER', actor);
  if (task.leaseExpiresAt <= state.clock) fail('LEASE_EXPIRED', actor);
  assert.deepEqual(taskDispositionSnapshot(task), observedPrefix, '환경 미검증: disposition prefix가 바뀌었습니다.');
  if (Object.hasOwn(patch, 'requestDispositions')) fail('DISPOSITION_REWRITE', taskId);
  const semanticFields = [
    'objective', 'inScope', 'outOfScope', 'acceptanceCriteria', 'riskLevel', 'riskBasis',
    'nextSafeAction', 'stopConditions', 'requiredOutputs', 'requiredTestsEvidence',
    'knownRisks', 'humanQuestions',
  ];
  const allowedPatchFields = new Set(['currentState', 'lastVerifiedSha', 'supersedeDecisionId', ...semanticFields]);
  const protectedChange = Object.keys(patch).find((field) => !allowedPatchFields.has(field));
  if (protectedChange) fail('TASK_CONTROL_FIELD', protectedChange);
  const semanticChange = semanticFields.find((field) => Object.hasOwn(patch, field));
  const nextPatch = clone(patch);
  let supersedeDecision = null;
  if (semanticChange) {
    supersedeDecision = state.decisions[nextPatch.supersedeDecisionId];
    if (!supersedeDecision || supersedeDecision.status !== 'ACTIVE' || supersedeDecision.type !== 'SUPERSEDE'
      || supersedeDecision.subjectTaskId !== taskId || supersedeDecision.targetSha !== task.lastVerifiedSha
      || supersedeDecision.beforeContractSha256 !== task.contractSha256) {
      fail('SUPERSEDE_DECISION_REQUIRED', semanticChange);
    }
    const approvedPatch = Object.fromEntries(semanticFields
      .filter((field) => Object.hasOwn(nextPatch, field)).map((field) => [field, nextPatch[field]]));
    if (supersedeDecision.approvedPayloadSha256 !== sha(JSON.stringify(approvedPatch))) {
      fail('SUPERSEDE_PAYLOAD_MISMATCH', taskId);
    }
  }
  delete nextPatch.supersedeDecisionId;
  if (Object.hasOwn(patch, 'currentState')) {
    const allowed = {
      DEFINED: ['IMPLEMENTED', 'BLOCKED'], IMPLEMENTED: ['REVIEWING', 'BLOCKED'],
      REVIEWING: ['DONE', 'BLOCKED', 'IMPLEMENTED'], BLOCKED: ['IMPLEMENTED'], DONE: [],
    };
    if (!allowed[task.currentState].includes(patch.currentState)) {
      fail('TASK_STATE_TRANSITION', `${task.currentState}→${patch.currentState}`);
    }
    if (patch.currentState === 'IMPLEMENTED') authorizeAction(state, task.route, 'DOC_ASSIST');
    if (patch.currentState === 'IMPLEMENTED') {
      const blockedDependency = task.dependsOn.find((id) => state.tasks[id]?.currentState !== 'DONE');
      if (blockedDependency) fail('TASK_DEPENDENCY_NOT_DONE', `${task.taskId}:${blockedDependency}`);
    }
    if (patch.currentState === 'DONE') {
      assertTaskCompletionQuorum(state, task, patch.lastVerifiedSha ?? task.lastVerifiedSha);
    }
  }
  if (supersedeDecision) {
    supersedeDecision.status = 'RETIRED';
    appendAudit(state, {
      type: 'DECISION_CONSUMED', decisionId: patch.supersedeDecisionId,
      decisionType: 'SUPERSEDE', subjectTaskId: taskId,
    });
  }
  Object.assign(task, nextPatch);
  if (semanticChange || Object.hasOwn(nextPatch, 'lastVerifiedSha')) {
    task.contractVersion += 1;
    task.contractSha256 = taskContractSha256(task);
  }
  task.revision += 1;
  validateTaskPacket(task);
  validateDispositionChain(task);
  appendAudit(state, {
    type: 'TASK_UPDATE', actor, taskId, revision: task.revision,
    contractVersion: task.contractVersion, contractSha256: task.contractSha256,
    currentState: task.currentState, lastVerifiedSha: task.lastVerifiedSha,
  });
}

export function renewOrTransferLease(state, actor, taskId, { ttl = 5, handoffDecisionId = null } = {}) {
  assertQueueTaskLock(state, actor, taskId);
  if (!Number.isInteger(ttl) || ttl <= 0) fail('LEASE_TTL_INVALID', String(ttl));
  const task = taskOf(state, taskId);
  assertLeaseMatchesAudit(state, task);
  const sameOwner = task.editOwner === actor && task.ownerSessionRef === `session:${actor}`;
  const needsHandoff = !sameOwner || task.leaseExpiresAt <= state.clock;
  const decision = handoffDecisionId && state.decisions[handoffDecisionId];
  if (needsHandoff && (!decision || decision.status !== 'ACTIVE' || decision.type !== 'HANDOFF'
    || decision.subjectTaskId !== taskId || decision.fromActor !== task.editOwner || decision.toActor !== actor
    || decision.targetSha !== task.lastVerifiedSha)) {
    fail('HANDOFF_REQUIRED', taskId);
  }
  const conflict = Object.values(state.tasks).find((other) => (
    other.taskId !== taskId && other.currentState !== 'DONE'
    && other.artifactPaths.some((path) => task.artifactPaths.some((candidate) => artifactOverlaps(path, candidate)))
  ));
  if (conflict) fail('ARTIFACT_LEASE_CONFLICT', `${conflict.taskId} ↔ ${taskId}`);
  task.editOwner = actor;
  task.ownerSessionRef = `session:${actor}`;
  task.leaseExpiresAt = state.clock + ttl;
  if (needsHandoff) {
    decision.status = 'RETIRED';
    appendAudit(state, {
      type: 'DECISION_CONSUMED', decisionId: handoffDecisionId,
      decisionType: 'HANDOFF', subjectTaskId: taskId,
    });
  }
  appendAudit(state, { type: 'LEASE', actor, taskId, expires: task.leaseExpiresAt, handoffDecisionId });
}

export function appendCollaboration(state, actor, taskId, turnType) {
  const lock = state.taskLocks[taskId];
  if (state.queueLock) fail('LOCK_NEST', 'collaboration append 중 queue ledger lock 보유 금지');
  if (!lock || lock.actor !== actor || lock.purpose !== 'COLLABORATION_APPEND') fail('TASK_LOCK_REQUIRED', taskId);
  appendAudit(state, { type: 'COLLABORATION_APPEND', actor, taskId, turnType });
}

export function advanceClock(state, ticks = 1) {
  if (!Number.isInteger(ticks) || ticks <= 0) fail('CLOCK_ADVANCE_INVALID', String(ticks));
  state.clock += ticks;
}

export function recordDecision(state, {
  decisionId, type, approver, approvedAt, targetSha,
  subjectTaskId = null, fromActor = null, toActor = null, route = null, verifierRole = null,
  approvedPayloadSha256 = null, beforeContractSha256 = null,
}) {
  const allowedTypes = new Set(['HANDOFF', 'SUPERSEDE', 'PLAN_ACTIVATION', 'LEARNING_VERIFIER', 'AUTONOMY_PROMOTION']);
  if (state.decisions[decisionId]) fail('DECISION_EXISTS', decisionId);
  if (!allowedTypes.has(type)) fail('BAD_DECISION_TYPE', type);
  if (!state.humanApproverIds?.includes(approver)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(approvedAt)
    || !/^[0-9a-f]{40}$/.test(targetSha)) {
    fail('HUMAN_REQUIRED', decisionId);
  }
  if (type === 'HANDOFF') {
    const subjectTask = state.tasks[subjectTaskId];
    if (!subjectTaskId || !fromActor || !toActor || !subjectTask
      || subjectTask.editOwner !== fromActor || subjectTask.lastVerifiedSha !== targetSha) {
      fail('HANDOFF_DECISION_BINDING', decisionId);
    }
  }
  if (type === 'SUPERSEDE') {
    const subjectTask = state.tasks[subjectTaskId];
    if (!subjectTaskId || !subjectTask || beforeContractSha256 !== subjectTask.contractSha256
      || !/^[0-9a-f]{64}$/.test(approvedPayloadSha256 ?? '')) {
      fail('SUPERSEDE_DECISION_BINDING', decisionId);
    }
  }
  if (type === 'AUTONOMY_PROMOTION') {
    const subjectTask = state.tasks[subjectTaskId];
    if (!route || !subjectTask || subjectTask.route !== route || subjectTask.lastVerifiedSha !== targetSha) {
      fail('AUTONOMY_DECISION_BINDING', decisionId);
    }
  }
  if (type === 'LEARNING_VERIFIER' && (!verifierRole || !TASK_ROLE_IDS.has(verifierRole))) {
    fail('LEARNING_VERIFIER_BINDING', decisionId);
  }
  state.decisions[decisionId] = {
    status: 'ACTIVE', type, approver, approvedAt, targetSha, subjectTaskId, fromActor, toActor, route, verifierRole,
    approvedPayloadSha256, beforeContractSha256,
  };
  appendAudit(state, {
    type: 'DECISION_RECORDED', decisionId, decisionType: type, approver, approvedAt, targetSha,
    subjectTaskId, fromActor, toActor, route, verifierRole,
    approvedPayloadSha256, beforeContractSha256,
  });
}

function assertReviewBinding({ subjectTaskId, auditScope, reviewerRole, evidenceRef }) {
  if (!subjectTaskId || !auditScope || !reviewerRole || !evidenceRef) {
    fail('REVIEW_BINDING_REQUIRED', `${subjectTaskId ?? 'null'}:${auditScope ?? 'null'}`);
  }
}

export function registerReviewTask(state, {
  reviewTaskId, subjectTaskId, exactSha, auditScope, reviewRoute,
  authorRole, reviewerRole, reviewMode, snapshotMode, independentRequest,
  taskBudgetUsd, taskContractSha256,
}) {
  if (state.reviewTasks[reviewTaskId]) fail('REVIEW_TASK_EXISTS', reviewTaskId);
  const subjectTask = state.tasks[subjectTaskId];
  if (!subjectTask || subjectTask.lastVerifiedSha !== exactSha
    || !auditScope || !reviewRoute || !authorRole || !reviewerRole
    || !['INITIAL', 'FINAL', 'SECURITY'].includes(reviewMode)
    || !['COMMIT', 'WORKTREE'].includes(snapshotMode)
    || !Number.isFinite(taskBudgetUsd) || taskBudgetUsd <= 0
    || !/^[0-9a-f]{64}$/.test(taskContractSha256 ?? '')) {
    fail('REVIEW_TASK_CONTRACT_INVALID', reviewTaskId);
  }
  if (reviewRoute === 'FINAL_INDEPENDENT') {
    if (authorRole !== 'AI-DEPUTY-ORCHESTRATOR' || reviewerRole !== 'FABLE-FINAL'
      || reviewMode !== 'FINAL' || snapshotMode !== 'COMMIT' || !independentRequest) {
      fail('FINAL_INDEPENDENT_CONTRACT_REQUIRED', reviewTaskId);
    }
  } else if (independentRequest !== null) {
    fail('REVIEW_TASK_CONTRACT_INVALID', reviewTaskId);
  }
  state.reviewTasks[reviewTaskId] = {
    reviewTaskId, subjectTaskId, exactSha, auditScope, reviewRoute,
    authorRole, reviewerRole, reviewMode, snapshotMode, independentRequest,
    taskBudgetUsd, taskContractSha256,
    subjectContractVersion: subjectTask.contractVersion,
    subjectContractSha256: subjectTask.contractSha256,
  };
  appendAudit(state, { type: 'REVIEW_TASK_REGISTERED', ...state.reviewTasks[reviewTaskId] });
}

export function recordFableRun(state, {
  roundId, terminalReason, verdict = null, exactSha, requiredFindings = [],
  subjectTaskId, auditScope, reviewerRole, evidenceRef,
  reviewerEngine, reviewerModel, cliVersion, sessionRef,
  roundBudgetUsd, taskBudgetUsd, reportedUsageUsd, structuredResultSha256,
  reviewTaskId, reviewMode, registryMode = 'INITIAL', predecessorReview = null, independentRequest = null,
  reviewRoute, authorRole, snapshotMode, taskContractSha256,
  reviewArtifactExists,
}) {
  assertReviewBinding({ subjectTaskId, auditScope, reviewerRole, evidenceRef });
  if (!state.tasks[subjectTaskId]) fail('TASK_NOT_FOUND', subjectTaskId);
  const reviewTask = state.reviewTasks[reviewTaskId];
  if (!reviewTask || reviewTask.subjectTaskId !== subjectTaskId || reviewTask.exactSha !== exactSha
    || reviewTask.auditScope !== auditScope || reviewTask.reviewRoute !== reviewRoute
    || reviewTask.authorRole !== authorRole || reviewTask.reviewerRole !== reviewerRole
    || reviewTask.reviewMode !== reviewMode || reviewTask.snapshotMode !== snapshotMode
    || reviewTask.independentRequest !== independentRequest || reviewTask.taskBudgetUsd !== taskBudgetUsd
    || reviewTask.taskContractSha256 !== taskContractSha256
    || reviewTask.subjectContractVersion !== state.tasks[subjectTaskId].contractVersion
    || reviewTask.subjectContractSha256 !== state.tasks[subjectTaskId].contractSha256) {
    fail('REVIEW_TASK_CONTRACT_MISMATCH', roundId);
  }
  if (!reviewerRole.startsWith('FABLE-') || reviewerEngine !== 'FABLE' || reviewerModel !== 'claude-fable-5'
    || !cliVersion || !sessionRef || !Number.isFinite(roundBudgetUsd) || !Number.isFinite(taskBudgetUsd)
    || !Number.isFinite(reportedUsageUsd) || reportedUsageUsd < 0 || reportedUsageUsd > roundBudgetUsd
    || roundBudgetUsd > taskBudgetUsd
    || !/^[0-9a-f]{64}$/.test(structuredResultSha256 ?? '')
    || !reviewTaskId || !['INITIAL', 'FINAL', 'SECURITY'].includes(reviewMode)
    || !['INITIAL', 'RECHECK'].includes(registryMode)
    || (terminalReason === 'completed' && !reviewArtifactExists)
    || (registryMode === 'INITIAL' && predecessorReview !== null)
    || (registryMode === 'RECHECK' && !predecessorReview)) {
    fail('FABLE_PROVENANCE_REQUIRED', roundId);
  }
  if (!/^[0-9a-f]{40}$/.test(exactSha)) fail('STALE_SHA', String(exactSha));
  if (state.tasks[subjectTaskId].lastVerifiedSha !== exactSha) fail('REVIEW_TASK_SHA_MISMATCH', roundId);
  if (state.planReviewRuns.some((run) => run.roundId === roundId)) fail('ROUND_EXISTS', roundId);
  if (state.planReviewRuns.some((run) => run.evidenceRef === evidenceRef
    || run.sessionRef === sessionRef || run.structuredResultSha256 === structuredResultSha256)) {
    fail('REVIEW_EVIDENCE_REUSED', roundId);
  }
  const taskUsage = state.planReviewRuns
    .filter((run) => run.reviewTaskId === reviewTaskId)
    .reduce((sum, run) => sum + run.reportedUsageUsd, 0) + reportedUsageUsd;
  if (taskUsage > taskBudgetUsd) fail('FABLE_TASK_BUDGET_EXCEEDED', reviewTaskId);
  if (verdict === 'CHANGES_REQUIRED' && requiredFindings.length === 0) {
    fail('REQUIRED_FINDINGS_MISSING', roundId);
  }
  for (const findingId of requiredFindings) {
    const finding = state.findings[findingId];
    if (!finding || !['OPEN', 'DISPUTED'].includes(finding.reviewState)
      || finding.discoveredByRole !== reviewerRole) {
      fail('FINDING_REGISTRY_MISMATCH', findingId);
    }
  }
  const unresolvedRequired = Object.values(state.findings)
    .filter((finding) => finding.subjectTaskId === subjectTaskId
      && finding.required && ['OPEN', 'DISPUTED'].includes(finding.reviewState));
  const valid = terminalReason === 'completed' && verdict === 'PASS'
    && requiredFindings.length === 0;
  if (terminalReason === 'completed' && !['PASS', 'CHANGES_REQUIRED'].includes(verdict)) fail('BAD_VERDICT', String(verdict));
  const run = {
    roundId,
    terminalReason,
    runState: terminalReason === 'completed' ? 'RESULT_RECEIVED' : 'RUN_FAILED',
    verdict: terminalReason === 'completed' ? verdict : null,
    exactSha,
    requiredFindings: clone(requiredFindings),
    subjectTaskId,
    auditScope,
    reviewerRole,
    evidenceRef,
    reviewerEngine,
    reviewerModel,
    cliVersion,
    sessionRef,
    roundBudgetUsd,
    taskBudgetUsd,
    reportedUsageUsd,
    structuredResultSha256,
    reviewTaskId,
    reviewMode,
    registryMode,
    predecessorReview,
    independentRequest,
    reviewRoute,
    authorRole,
    snapshotMode,
    taskContractSha256,
    reviewArtifactExists,
    subjectContractVersion: reviewTask.subjectContractVersion,
    subjectContractSha256: reviewTask.subjectContractSha256,
    unresolvedFindingIdsAtRun: unresolvedRequired.map((finding) => finding.findingId).sort(),
    valid,
  };
  state.planReviewRuns.push(run);
  appendAudit(state, { type: 'FABLE_RUN', ...run });
  return run;
}

export function registerFinding(state, {
  findingId, fingerprint, discoveredByRole, exactSha, subjectTaskId, sourceRoundId, required = true,
}) {
  if (state.findings[findingId]) fail('FINDING_EXISTS', findingId);
  const sameFingerprint = Object.values(state.findings).find((finding) => finding.fingerprint === fingerprint);
  if (sameFingerprint) fail('FINDING_ID_LAUNDERING', `${sameFingerprint.findingId} → ${findingId}`);
  if (!state.tasks[subjectTaskId] || !sourceRoundId || state.tasks[subjectTaskId].lastVerifiedSha !== exactSha) {
    fail('FINDING_BINDING_REQUIRED', findingId);
  }
  state.findings[findingId] = {
    findingId,
    fingerprint,
    discoveredByRole,
    subjectTaskId,
    sourceRoundId,
    required,
    reviewState: 'OPEN',
    openedSha: exactSha,
    fixReadySha: null,
    verifiedSha: null,
    closedSha: null,
  };
  appendAudit(state, { type: 'FINDING_OPENED', findingId, discoveredByRole, exactSha, subjectTaskId, sourceRoundId });
}

export function markFindingReady(state, { findingId, actorRole, fixSha }) {
  const finding = state.findings[findingId];
  if (!finding || finding.reviewState !== 'OPEN') fail('FINDING_STATE', findingId);
  finding.fixReadySha = fixSha;
  finding.fixActorRole = actorRole;
  appendAudit(state, { type: 'FINDING_READY', findingId, actorRole, fixSha });
}

export function verifyFinding(state, { findingId, reviewerRole, exactSha, reviewRoundId }) {
  const finding = state.findings[findingId];
  if (!finding || finding.reviewState !== 'OPEN') fail('FINDING_STATE', findingId);
  if (finding.discoveredByRole !== reviewerRole) fail('FINDING_REVIEWER_REQUIRED', findingId);
  if (!finding.fixReadySha || finding.fixReadySha !== exactSha) fail('FINDING_SHA_MISMATCH', findingId);
  const recheck = state.planReviewRuns.find((run) => run.roundId === reviewRoundId);
  if (!recheck || !recheck.valid || recheck.registryMode !== 'RECHECK'
    || recheck.predecessorReview !== finding.sourceRoundId
    || recheck.reviewerRole !== reviewerRole || recheck.subjectTaskId !== finding.subjectTaskId
    || recheck.exactSha !== exactSha) {
    fail('FINDING_RECHECK_REQUIRED', findingId);
  }
  finding.reviewState = 'VERIFIED';
  finding.verifiedSha = exactSha;
  finding.verificationRoundId = reviewRoundId;
  appendAudit(state, { type: 'FINDING_VERIFIED', findingId, reviewerRole, exactSha, reviewRoundId });
}

export function registerClosureSuccessor(state, {
  successorId, reviewerRole, exactSha, findingIds, evidenceRef, sourceRoundId,
}) {
  if (state.closureSuccessors[successorId]) fail('CLOSURE_SUCCESSOR_EXISTS', successorId);
  if (!reviewerRole || !evidenceRef || !findingIds?.length || !sourceRoundId) fail('CLOSURE_SUCCESSOR_REQUIRED', successorId);
  const findings = findingIds.map((findingId) => state.findings[findingId]);
  if (findings.some((finding) => !finding)) fail('FINDING_NOT_FOUND', findingIds.find((id) => !state.findings[id]));
  const subjectTaskId = findings[0].subjectTaskId;
  if (findings.some((finding) => finding.subjectTaskId !== subjectTaskId
    || finding.discoveredByRole !== reviewerRole || finding.reviewState !== 'VERIFIED')) {
    fail('CLOSURE_SUCCESSOR_REQUIRED', successorId);
  }
  const sourceRun = state.planReviewRuns.find((run) => run.roundId === sourceRoundId);
  if (!sourceRun || !sourceRun.valid || sourceRun.reviewerRole !== reviewerRole
    || sourceRun.exactSha !== exactSha || sourceRun.subjectTaskId !== subjectTaskId) {
    fail('CLOSURE_SUCCESSOR_REQUIRED', successorId);
  }
  const gate = state.protectedGates.find((item) => item.exactSha === exactSha && item.passed);
  if (!gate) fail('PROTECTED_GATE_REQUIRED', exactSha);
  state.closureSuccessors[successorId] = {
    successorId, reviewerRole, exactSha, findingIds: [...findingIds], evidenceRef, sourceRoundId, subjectTaskId,
  };
  appendAudit(state, {
    type: 'CLOSURE_SUCCESSOR_RECORDED', successorId, reviewerRole, exactSha, findingIds, evidenceRef, sourceRoundId, subjectTaskId,
  });
}

export function closeFinding(state, { findingId, reviewerRole, successorId }) {
  const finding = state.findings[findingId];
  if (!finding || finding.reviewState !== 'VERIFIED') fail('FINDING_STATE', findingId);
  if (finding.discoveredByRole !== reviewerRole) fail('FINDING_REVIEWER_REQUIRED', findingId);
  const successor = state.closureSuccessors[successorId];
  if (!successor || successor.reviewerRole !== reviewerRole || successor.subjectTaskId !== finding.subjectTaskId
    || !successor.findingIds.includes(findingId)) {
    fail('CLOSURE_SUCCESSOR_REQUIRED', findingId);
  }
  finding.reviewState = 'CLOSED';
  finding.closedSha = successor.exactSha;
  appendAudit(state, {
    type: 'FINDING_CLOSED', findingId, reviewerRole, exactSha: successor.exactSha, successorId,
  });
}

export function recordCodexEvidence(state, {
  passId, exactSha, graphPassed, sabotagePassed, subjectTaskId, auditScope, evidenceRef,
  reviewerSessionRef, evidenceSha256,
}) {
  assertReviewBinding({ subjectTaskId, auditScope, reviewerRole: 'CODEX-QA', evidenceRef });
  if (!state.tasks[subjectTaskId]) fail('TASK_NOT_FOUND', subjectTaskId);
  if (!/^[0-9a-f]{40}$/.test(exactSha)) fail('STALE_SHA', String(exactSha));
  if (state.tasks[subjectTaskId].lastVerifiedSha !== exactSha) fail('REVIEW_TASK_SHA_MISMATCH', passId);
  if (!graphPassed || !sabotagePassed) fail('CODEX_EVIDENCE_INVALID', passId);
  if (!reviewerSessionRef || !/^[0-9a-f]{64}$/.test(evidenceSha256 ?? '')) fail('CODEX_PROVENANCE_REQUIRED', passId);
  if (state.codexEvidence.some((item) => item.passId === passId || item.evidenceRef === evidenceRef
    || item.reviewerSessionRef === reviewerSessionRef || item.evidenceSha256 === evidenceSha256)) {
    fail('REVIEW_EVIDENCE_REUSED', passId);
  }
  const subjectTask = state.tasks[subjectTaskId];
  state.codexEvidence.push({
    passId, exactSha, graphPassed, sabotagePassed, subjectTaskId, auditScope, evidenceRef,
    reviewerSessionRef, evidenceSha256,
    subjectContractVersion: subjectTask.contractVersion,
    subjectContractSha256: subjectTask.contractSha256,
  });
  appendAudit(state, { type: 'CODEX_EVIDENCE', ...state.codexEvidence.at(-1) });
}

export function approvePlanActivation(state, {
  decisionId, approver, approvedAt, reviewTargetSha, subjectTaskId,
}) {
  validateTrace(state);
  const subjectTask = state.tasks[subjectTaskId];
  if (!subjectTask || subjectTask.lastVerifiedSha !== reviewTargetSha) fail('TASK_NOT_FOUND', subjectTaskId);
  const fablePasses = state.planReviewRuns.filter((run) => (
    run.valid && run.exactSha === reviewTargetSha && run.subjectTaskId === subjectTaskId
    && run.subjectContractVersion === subjectTask.contractVersion
    && run.subjectContractSha256 === subjectTask.contractSha256
    && run.reviewRoute === 'FINAL_INDEPENDENT' && run.reviewMode === 'FINAL'
    && run.registryMode === 'INITIAL' && run.predecessorReview === null
    && run.reviewerRole === 'FABLE-FINAL' && run.authorRole === 'AI-DEPUTY-ORCHESTRATOR'
    && run.snapshotMode === 'COMMIT' && run.independentRequest && run.reviewArtifactExists
  ));
  const codexPasses = state.codexEvidence.filter((run) => (
    run.exactSha === reviewTargetSha && run.subjectTaskId === subjectTaskId
    && run.subjectContractVersion === subjectTask.contractVersion
    && run.subjectContractSha256 === subjectTask.contractSha256
  ));
  const fableScopes = new Set(fablePasses.map((run) => run.auditScope));
  const independentReviewTasks = new Set(fablePasses.map((run) => run.reviewTaskId));
  const independentRequests = new Set(fablePasses.map((run) => JSON.stringify(run.independentRequest)));
  if (!fableScopes.has('WORKFLOW_FIDELITY') || !fableScopes.has('NETWORK_CLOSURE')
    || independentReviewTasks.size < 2 || independentRequests.size < 2) {
    fail('FABLE_TWO_PASSES_REQUIRED', reviewTargetSha);
  }
  const codexScopes = new Set(codexPasses.map((run) => run.auditScope));
  if (!codexScopes.has('CONTRACT_AUDIT') || !codexScopes.has('ADVERSARIAL_AUDIT')) {
    fail('CODEX_TWO_PASSES_REQUIRED', reviewTargetSha);
  }
  const unresolved = Object.values(state.findings)
    .filter((finding) => finding.subjectTaskId === subjectTaskId
      && finding.required && ['OPEN', 'DISPUTED'].includes(finding.reviewState));
  if (unresolved.length) fail('REQUIRED_FINDINGS_OPEN', unresolved.map((finding) => finding.findingId).join(','));
  if (subjectTask.currentState !== 'DONE') fail('TASK_NOT_DONE', subjectTaskId);
  for (const id of ['ontology', 'orchestration', 'directory', 'quality']) state.planStatus[id] = 'REVIEWED';
  appendAudit(state, { type: 'PLANS_REVIEWED', reviewTargetSha, subjectTaskId });
  recordDecision(state, {
    decisionId, type: 'PLAN_ACTIVATION', approver, approvedAt,
    targetSha: reviewTargetSha, subjectTaskId,
  });
}

export function activatePlanDocuments(state, {
  decisionId,
  activationCommitSha,
  parentReviewSha,
  changedPlanIds,
  agentsResponsibilitiesUpdated,
  decisionRecordedInCommit,
}) {
  if (state.executionBoundary !== 'VIRTUAL_SIMULATION') fail('EXTERNAL_ACTIVATION_NOT_SUPPORTED', activationCommitSha);
  const decision = state.decisions[decisionId];
  if (!decision || decision.status !== 'ACTIVE' || decision.type !== 'PLAN_ACTIVATION') fail('ACTIVE_DECISION_REQUIRED', decisionId);
  if (!/^[0-9a-f]{40}$/.test(activationCommitSha) || parentReviewSha !== decision.targetSha) {
    fail('ACTIVATION_SHA_CHAIN', activationCommitSha);
  }
  const expectedPlans = ['directory', 'ontology', 'orchestration', 'quality'];
  if (expectedPlans.some((id) => state.planStatus[id] !== 'REVIEWED')) {
    fail('PLAN_NOT_REVIEWED', activationCommitSha);
  }
  if (!decisionRecordedInCommit
    || !agentsResponsibilitiesUpdated
    || JSON.stringify([...changedPlanIds].sort()) !== JSON.stringify(expectedPlans)) {
    fail('ATOMIC_ACTIVATION_REQUIRED', activationCommitSha);
  }
  const gate = state.protectedGates.find((item) => item.exactSha === activationCommitSha && item.passed);
  if (!gate || !hasExactAuditRecord(state, 'PROTECTED_GATE', 'evidenceRef', gate.evidenceRef, gate)) {
    fail('PROTECTED_GATE_REQUIRED', activationCommitSha);
  }
  for (const id of ['ontology', 'orchestration', 'directory', 'quality']) state.planStatus[id] = 'ACTIVE';
  state.activationCommitSha = activationCommitSha;
  state.activationDecisionId = decisionId;
  state.agentsResponsibilitiesUpdated = true;
  appendAudit(state, {
    type: 'PLANS_ACTIVATED', decisionId, activationCommitSha, parentReviewSha,
    changedPlanIds: [...changedPlanIds].sort(), agentsResponsibilitiesUpdated, decisionRecordedInCommit,
    virtualOnly: true,
  });
}

export function recordEvidenceArtifact(state, {
  evidenceRef, evidenceSha256, kind, exactSha, repetitions = 1, sourceCaseId = null,
}) {
  const allowedKinds = new Set(['PROTECTED_GATE', 'DIRECTORY_PREFLIGHT', 'LEARNING_SOURCE']);
  if (!evidenceRef || state.evidenceArtifacts[evidenceRef]
    || !allowedKinds.has(kind) || !/^[0-9a-f]{40}$/.test(exactSha ?? '')
    || !/^[0-9a-f]{64}$/.test(evidenceSha256 ?? '')
    || !Number.isInteger(repetitions) || repetitions <= 0
    || Object.values(state.evidenceArtifacts).some((item) => item.evidenceSha256 === evidenceSha256)) {
    fail('EVIDENCE_ARTIFACT_INVALID', evidenceRef ?? 'null');
  }
  state.evidenceArtifacts[evidenceRef] = {
    evidenceRef, evidenceSha256, kind, exactSha, repetitions, sourceCaseId,
    evidenceOrigin: 'VIRTUAL_FIXTURE',
  };
  appendAudit(state, { type: 'EVIDENCE_ARTIFACT', ...state.evidenceArtifacts[evidenceRef] });
}

function hasExactAuditRecord(state, type, key, value, record) {
  const auditEntry = state.audit.find((entry) => entry.type === type && entry[key] === value);
  if (!auditEntry) return false;
  const { auditSeq, auditPreviousHash, auditHash, type: ignoredType, ...payload } = auditEntry;
  return JSON.stringify(payload) === JSON.stringify(record);
}

export function recordProtectedGate(state, {
  exactSha, fullDbRequired, protectedGate, evidenceRef, evidenceSha256,
}) {
  if (!/^[0-9a-f]{40}$/.test(exactSha) || !evidenceRef || !/^[0-9a-f]{64}$/.test(evidenceSha256 ?? '')) {
    fail('GATE_EVIDENCE_REQUIRED', exactSha);
  }
  const artifact = state.evidenceArtifacts[evidenceRef];
  if (!artifact || artifact.kind !== 'PROTECTED_GATE' || artifact.exactSha !== exactSha
    || artifact.evidenceSha256 !== evidenceSha256) {
    fail('GATE_EVIDENCE_REQUIRED', exactSha);
  }
  if (state.protectedGates.some((gate) => gate.evidenceRef === evidenceRef || gate.evidenceSha256 === evidenceSha256)) {
    fail('GATE_EVIDENCE_REUSED', evidenceRef);
  }
  const passed = fullDbRequired === 'success' && protectedGate === 'success';
  state.protectedGates.push({
    exactSha, fullDbRequired, protectedGate, evidenceRef, evidenceSha256, passed,
    evidenceOrigin: 'VIRTUAL_FIXTURE',
  });
  appendAudit(state, { type: 'PROTECTED_GATE', ...state.protectedGates.at(-1) });
}

function canonicalPathMap(pathMap) {
  if (!Array.isArray(pathMap) || pathMap.length === 0) fail('MIGRATION_CONTRACT_REQUIRED', 'empty-path-map');
  const normalized = pathMap.map((item) => {
    if (!item?.from || !item?.to || !isSafeRepoRelative(item.from) || !isSafeRepoRelative(item.to)) {
      fail('MIGRATION_PATH_UNSAFE', JSON.stringify(item));
    }
    const from = artifactRoot(item.from);
    const to = artifactRoot(item.to);
    if (from === to) fail('MIGRATION_CONTRACT_REQUIRED', from);
    return { from, to };
  });
  const froms = normalized.map((item) => item.from);
  const tos = normalized.map((item) => item.to);
  if (new Set(froms).size !== froms.length || new Set(tos).size !== tos.length) {
    fail('MIGRATION_PATH_DUPLICATE', 'from/to');
  }
  const next = new Map(normalized.map((item) => [item.from, item.to]));
  for (const start of next.keys()) {
    const seen = new Set();
    let cursor = start;
    while (next.has(cursor)) {
      if (seen.has(cursor)) fail('MIGRATION_PATH_CYCLE', start);
      seen.add(cursor);
      cursor = next.get(cursor);
    }
  }
  return normalized;
}

export function recordDirectoryPreflight(state, {
  preflightId, exactSha, checkerEvidenceRef, pathMap, userOwnedOverlap,
  oldReferenceCount, checkerEvidenceSha256,
}) {
  if (state.directoryPreflights[preflightId]) fail('PREFLIGHT_EXISTS', preflightId);
  if (!/^[0-9a-f]{40}$/.test(exactSha) || !checkerEvidenceRef
    || !/^[0-9a-f]{64}$/.test(checkerEvidenceSha256 ?? '')) {
    fail('MIGRATION_CONTRACT_REQUIRED', preflightId);
  }
  const checkerArtifact = state.evidenceArtifacts[checkerEvidenceRef];
  if (!checkerArtifact || checkerArtifact.kind !== 'DIRECTORY_PREFLIGHT'
    || checkerArtifact.exactSha !== exactSha || checkerArtifact.evidenceSha256 !== checkerEvidenceSha256) {
    fail('MIGRATION_CONTRACT_REQUIRED', preflightId);
  }
  const normalizedPathMap = canonicalPathMap(pathMap);
  if (!Array.isArray(userOwnedOverlap) || userOwnedOverlap.length || oldReferenceCount !== 0) {
    fail('USER_OR_REFERENCE_BLOCK', preflightId);
  }
  state.directoryPreflights[preflightId] = {
    preflightId, exactSha, checkerEvidenceRef, pathMap: clone(normalizedPathMap),
    pathMapSha256: sha(JSON.stringify(normalizedPathMap)), checkerEvidenceSha256,
    userOwnedOverlap: [], oldReferenceCount,
  };
  appendAudit(state, { type: 'DIRECTORY_PREFLIGHT', ...state.directoryPreflights[preflightId] });
}

export function materializeDirectory(state, input) {
  const decision = state.decisions[input.decisionId];
  if (!decision || decision.status !== 'ACTIVE' || decision.type !== 'PLAN_ACTIVATION') {
    fail('ACTIVE_DECISION_REQUIRED', input.decisionId);
  }
  if (input.decisionId !== state.activationDecisionId) fail('ACTIVATION_DECISION_MISMATCH', input.decisionId);
  if (Object.values(state.planStatus).some((status) => !['CONFIRMED', 'ACTIVE'].includes(status))) fail('PLAN_NOT_ACTIVE', JSON.stringify(state.planStatus));
  if (!state.agentsResponsibilitiesUpdated) fail('AGENTS_UPDATE_REQUIRED', input.exactSha);
  const preflight = state.directoryPreflights[input.preflightId];
  if (!preflight || preflight.exactSha !== input.exactSha) fail('MIGRATION_CONTRACT_REQUIRED', input.exactSha);
  if (!hasExactAuditRecord(state, 'DIRECTORY_PREFLIGHT', 'preflightId', input.preflightId, preflight)) {
    fail('PREFLIGHT_AUDIT_REQUIRED', input.preflightId);
  }
  if (input.exactSha !== state.activationCommitSha) fail('STALE_SHA', input.exactSha);
  const gate = state.protectedGates.find((item) => item.exactSha === input.exactSha && item.passed);
  if (!gate) fail('PROTECTED_GATE_REQUIRED', input.exactSha);
  if (!hasExactAuditRecord(state, 'PROTECTED_GATE', 'evidenceRef', gate.evidenceRef, gate)) {
    fail('GATE_AUDIT_REQUIRED', gate.evidenceRef);
  }
  state.directoryMaterialized = true;
  appendAudit(state, { type: 'DIRECTORY_MATERIALIZED', exactSha: input.exactSha, preflightId: input.preflightId });
}

export function proposeLearning(state, learningId, {
  evidenceRefs, appliesTo, excludes, conflictsWith, supersedes, reviewBy, invalidationCondition,
  authorRole, laneOwnerRole, sourceTaskId, sourceSha,
}) {
  if (!authorRole || !laneOwnerRole) fail('LEARNING_AUTHOR_REQUIRED', learningId);
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length < 2 || new Set(evidenceRefs).size !== evidenceRefs.length
    || !Array.isArray(appliesTo) || appliesTo.length === 0 || !Array.isArray(excludes)
    || !Array.isArray(conflictsWith) || !Array.isArray(supersedes)
    || !/^\d{4}-\d{2}-\d{2}$/.test(reviewBy ?? '') || Number.isNaN(Date.parse(`${reviewBy}T00:00:00Z`))
    || !invalidationCondition?.trim()) {
    fail('LEARNING_EVIDENCE_REQUIRED', learningId);
  }
  if (state.learning[learningId]) fail('LEARNING_EXISTS', learningId);
  const sourceTask = state.tasks[sourceTaskId];
  if (!sourceTask || !/^[0-9a-f]{40}$/.test(sourceSha)
    || (sourceSha !== sourceTask.lastVerifiedSha && sourceSha !== state.activationCommitSha)) {
    fail('LEARNING_SOURCE_REQUIRED', learningId);
  }
  const sourceEvidence = evidenceRefs.map((evidenceRef) => state.evidenceArtifacts[evidenceRef]);
  if (sourceEvidence.some((evidence) => !evidence || evidence.kind !== 'LEARNING_SOURCE'
    || evidence.exactSha !== sourceSha || !evidence.sourceCaseId)
    || new Set(sourceEvidence.map((evidence) => evidence.sourceCaseId)).size < 2
    || conflictsWith.includes(learningId) || supersedes.includes(learningId)
    || supersedes.some((id) => !state.learning[id])) {
    fail('LEARNING_EVIDENCE_REQUIRED', learningId);
  }
  state.learning[learningId] = {
    status: 'CANDIDATE', evidenceRefs: [...evidenceRefs], appliesTo: [...appliesTo], excludes: [...excludes],
    conflictsWith: [...conflictsWith], supersedes: [...supersedes], reviewBy, invalidationCondition,
    authorRole, laneOwnerRole, sourceTaskId, sourceSha, verifier: null, decisionId: null, appliedTasks: [],
  };
  appendAudit(state, { type: 'LEARNING_PROPOSED', learningId, ...state.learning[learningId] });
}

export function verifyLearning(state, learningId, { verifier, decisionId, independent }) {
  const learning = state.learning[learningId];
  const decision = state.decisions[decisionId];
  if (!learning || learning.status !== 'CANDIDATE') fail('LEARNING_STATE', learningId);
  if (!independent || !verifier || verifier === learning.authorRole || verifier === learning.laneOwnerRole
    || !decision || decision.status !== 'ACTIVE' || decision.type !== 'LEARNING_VERIFIER'
    || decision.targetSha !== learning.sourceSha || decision.verifierRole !== verifier
    || learning.supersedes.some((id) => state.learning[id]?.status !== 'RETIRED')) {
    fail('LEARNING_NOT_VERIFIED', learningId);
  }
  learning.status = 'VERIFIED';
  learning.verifier = verifier;
  learning.decisionId = decisionId;
  decision.status = 'RETIRED';
  appendAudit(state, {
    type: 'DECISION_CONSUMED', decisionId, decisionType: 'LEARNING_VERIFIER',
    subjectTaskId: learning.sourceTaskId, learningId,
  });
  appendAudit(state, { type: 'LEARNING_VERIFIED', learningId, verifier, decisionId, sourceSha: learning.sourceSha });
}

export function applyLearning(state, learningId, { taskId, route }) {
  const learning = state.learning[learningId];
  if (!learning || learning.status !== 'VERIFIED') fail('LEARNING_NOT_VERIFIED', learningId);
  if (Date.parse(`${learning.reviewBy}T23:59:59Z`) < Date.now()) fail('LEARNING_REVIEW_EXPIRED', learningId);
  const targetTask = state.tasks[taskId];
  if (!targetTask) fail('TASK_NOT_FOUND', taskId);
  if (route !== targetTask.route) fail('LEARNING_ROUTE_MISMATCH', `${route}!=${targetTask.route}`);
  if (targetTask.route === 'FINAL_INDEPENDENT'
    || (targetTask.route === 'SECURITY' && targetTask.predecessorReview === null)
    || (targetTask.reviewerRole && targetTask.reviewerRole === learning.authorRole)) {
    fail('LEARNING_ROUTE_EXCLUDED', targetTask.route);
  }
  if (learning.excludes.includes(route)) fail('LEARNING_ROUTE_EXCLUDED', route);
  if (!learning.appliesTo.includes(route)) fail('LEARNING_OUT_OF_SCOPE', route);
  const excludedIds = targetTask.excludedLearningIds.map((item) => (
    typeof item === 'string' ? item : item?.learningId
  ));
  if (!targetTask.appliedLearningIds.includes(learningId) || excludedIds.includes(learningId)) {
    fail('LEARNING_NOT_DECLARED', `${taskId}:${learningId}`);
  }
  const declaredConflicts = learning.conflictsWith.filter((id) => targetTask.appliedLearningIds.includes(id));
  if (declaredConflicts.length > 0) fail('LEARNING_CONFLICT', `${learningId}:${declaredConflicts.join(',')}`);
  if (learning.appliedTasks.includes(taskId)) fail('LEARNING_ALREADY_APPLIED', taskId);
  learning.appliedTasks.push(taskId);
  appendAudit(state, { type: 'LEARNING_APPLIED', learningId, taskId, route });
}

export function retireLearning(state, learningId, reason) {
  const learning = state.learning[learningId];
  if (!learning || !['CANDIDATE', 'VERIFIED'].includes(learning.status) || !reason?.trim()) {
    fail('LEARNING_STATE', learningId);
  }
  learning.status = 'RETIRED';
  learning.retiredReason = reason;
  appendAudit(state, { type: 'LEARNING_RETIRED', learningId, reason });
}

const ACTION_MIN_AUTONOMY = Object.freeze({
  READ_ONLY: 'A0',
  DOC_ASSIST: 'A1',
  NONDESTRUCTIVE_IMPLEMENT: 'A2',
  VALIDATION_AUTOMATION: 'A3',
  STAGING_ASSIST: 'A4',
});

export function authorizeAction(state, route, action) {
  if (action === 'PRODUCTION_EXECUTION') fail('HUMAN_ONLY_ACTION', action);
  const required = ACTION_MIN_AUTONOMY[action];
  if (!required) fail('UNKNOWN_ACTION', action);
  const current = state.autonomy[route] ?? 'A0';
  if (AUTONOMY_STEPS.indexOf(current) < AUTONOMY_STEPS.indexOf(required)) {
    fail('AUTONOMY_INSUFFICIENT', `${route}:${current}<${required}`);
  }
  return true;
}

export function promoteAutonomy(state, route, {
  to, decisionId, evidencePassed, escapeCount, evaluationWindows, sampleCount = 0,
  userFileIncidents = 0, staleShaCount = 0, gateMisjudgments = 0,
  stagingSuccesses = 0, runbookReady = false, teamExpansionChecklistPassed = false,
  killSwitchReady = false,
}) {
  const current = state.autonomy[route] ?? 'A0';
  const currentIndex = AUTONOMY_STEPS.indexOf(current);
  const targetIndex = AUTONOMY_STEPS.indexOf(to);
  const decision = state.decisions[decisionId];
  const levelEvidenceOk = (to === 'A1' && sampleCount >= 30)
    || (to === 'A2' && evaluationWindows >= 2 && userFileIncidents === 0 && teamExpansionChecklistPassed)
    || (to === 'A3' && staleShaCount === 0 && gateMisjudgments === 0 && teamExpansionChecklistPassed)
    || (to === 'A4' && stagingSuccesses >= 2 && runbookReady && teamExpansionChecklistPassed && killSwitchReady);
  if (targetIndex !== currentIndex + 1 || !evidencePassed || escapeCount !== 0 || !levelEvidenceOk
    || !decision || decision.status !== 'ACTIVE' || decision.type !== 'AUTONOMY_PROMOTION' || decision.route !== route
    || !decision.subjectTaskId || decision.targetSha !== state.tasks[decision.subjectTaskId]?.lastVerifiedSha
    || state.autonomyPromotionDecisionsUsed.includes(decisionId)) {
    fail('AUTONOMY_PROMOTION_BLOCKED', `${current}→${to}`);
  }
  state.autonomy[route] = to;
  state.autonomyPromotionDecisionsUsed.push(decisionId);
  appendAudit(state, { type: 'AUTONOMY_PROMOTED', route, from: current, to, decisionId });
}

export function demoteAutonomy(state, route, reason, { criticalBoundaryBreach = false } = {}) {
  const current = state.autonomy[route] ?? 'A0';
  const index = AUTONOMY_STEPS.indexOf(current);
  state.autonomy[route] = criticalBoundaryBreach ? 'A0' : AUTONOMY_STEPS[Math.max(0, index - 1)];
  appendAudit(state, {
    type: 'AUTONOMY_DEMOTED', route, from: current, to: state.autonomy[route], reason,
    criticalBoundaryBreach, automationStopped: criticalBoundaryBreach, humanEscalated: criticalBoundaryBreach,
  });
}

export function validateTrace(state) {
  validateAuditChain(state);
  assert.equal(state.executionBoundary, 'VIRTUAL_SIMULATION', '시뮬레이터 증거를 외부 운영 증거로 승격할 수 없습니다.');
  assert.deepEqual(state.humanApproverIds, [...HUMAN_APPROVER_IDS], '사람 승인자 registry가 변조됐습니다.');
  for (const request of Object.values(state.requestInputs)) {
    assert.ok(hasExactAuditRecord(state, 'REQUEST_RECORDED', 'requestInputId', request.requestInputId, request),
      `요청 원본 감사 사건 누락·변조: ${request.requestInputId}`);
  }
  for (const normalized of Object.values(state.normalizedRequests)) {
    assert.ok(hasExactAuditRecord(state, 'REQUEST_NORMALIZED', 'normalizedRequestId', normalized.normalizedRequestId, normalized),
      `정규화 요청 감사 사건 누락·변조: ${normalized.normalizedRequestId}`);
    assert.ok(state.requestInputs[normalized.requestInputId], `정규화 요청의 원본이 없습니다: ${normalized.normalizedRequestId}`);
  }
  assert.equal(state.audit.filter((entry) => entry.type === 'REQUEST_RECORDED').length,
    Object.keys(state.requestInputs).length, '요청 registry와 감사 사건 수가 어긋났습니다.');
  assert.equal(state.audit.filter((entry) => entry.type === 'REQUEST_NORMALIZED').length,
    Object.keys(state.normalizedRequests).length, '정규화 요청 registry와 감사 사건 수가 어긋났습니다.');
  Object.values(state.tasks).forEach((task) => {
    validateTaskPacket(task);
    validateDispositionChain(task);
    const contractEvents = state.audit.filter((entry) => entry.taskId === task.taskId
      && ['TASK_REGISTERED', 'TASK_ADD_APPLIED', 'TASK_UPDATE'].includes(entry.type));
    const latestContractEvent = contractEvents.at(-1);
    assert.ok(latestContractEvent, `Task contract 감사 사건 누락: ${task.taskId}`);
    assert.equal(latestContractEvent.contractVersion, task.contractVersion,
      `Task contract 판본이 감사 사건과 어긋났습니다: ${task.taskId}`);
    assert.equal(latestContractEvent.contractSha256, task.contractSha256,
      `Task contract hash가 감사 사건과 어긋났습니다: ${task.taskId}`);
    assertLeaseMatchesAudit(state, task);
    if (task.currentState === 'DONE') assertTaskCompletionQuorum(state, task, task.lastVerifiedSha);
  });
  const registeredTasks = state.audit.filter((entry) => entry.type === 'TASK_REGISTERED');
  assert.equal(registeredTasks.length, Object.keys(state.tasks).length,
    'Task registry와 감사 사건 수가 어긋났습니다.');
  for (const entry of registeredTasks) {
    assert.ok(state.tasks[entry.taskId], `감사 원본의 Task가 registry에서 삭제됐습니다: ${entry.taskId}`);
  }
  for (const reviewTask of Object.values(state.reviewTasks)) {
    assert.ok(hasExactAuditRecord(state, 'REVIEW_TASK_REGISTERED', 'reviewTaskId', reviewTask.reviewTaskId, reviewTask),
      `review Task 감사 사건 누락·변조: ${reviewTask.reviewTaskId}`);
  }
  assert.equal(state.audit.filter((entry) => entry.type === 'REVIEW_TASK_REGISTERED').length,
    Object.keys(state.reviewTasks).length, 'review Task 장부와 감사 사건 수가 어긋났습니다.');
  for (const run of state.planReviewRuns) {
    const expectedValid = run.terminalReason === 'completed' && run.verdict === 'PASS'
      && run.requiredFindings.length === 0;
    assert.equal(run.valid, expectedValid, 'Fable run valid 파생값이 원본과 어긋났습니다.');
    if (run.runState === 'RUN_FAILED') {
      assert.equal(run.verdict, null, '실패한 외부 검수를 PASS로 합성하면 안 됩니다.');
      assert.equal(run.valid, false);
    }
    const auditRun = state.audit.find((entry) => entry.type === 'FABLE_RUN' && entry.roundId === run.roundId);
    assert.ok(auditRun, `Fable run 감사 사건 누락: ${run.roundId}`);
    const { auditSeq, auditPreviousHash, auditHash, type, ...auditPayload } = auditRun;
    assert.deepEqual(auditPayload, run, `Fable run 원본이 감사 사건과 어긋났습니다: ${run.roundId}`);
  }
  const auditRuns = state.audit.filter((entry) => entry.type === 'FABLE_RUN');
  assert.equal(auditRuns.length, state.planReviewRuns.length, 'Fable run 장부와 감사 사건 수가 어긋났습니다.');
  for (const evidence of state.codexEvidence) {
    const auditEvidence = state.audit.find((entry) => entry.type === 'CODEX_EVIDENCE' && entry.passId === evidence.passId);
    assert.ok(auditEvidence, `Codex 증거 감사 사건 누락: ${evidence.passId}`);
    const { auditSeq, auditPreviousHash, auditHash, type, ...auditPayload } = auditEvidence;
    assert.deepEqual(auditPayload, evidence, `Codex 증거 원본이 감사 사건과 어긋났습니다: ${evidence.passId}`);
  }
  const auditEvidenceRows = state.audit.filter((entry) => entry.type === 'CODEX_EVIDENCE');
  assert.equal(auditEvidenceRows.length, state.codexEvidence.length, 'Codex 증거 장부와 감사 사건 수가 어긋났습니다.');
  for (const evidence of Object.values(state.evidenceArtifacts)) {
    assert.ok(hasExactAuditRecord(state, 'EVIDENCE_ARTIFACT', 'evidenceRef', evidence.evidenceRef, evidence),
      `증거 artifact 감사 사건 누락·변조: ${evidence.evidenceRef}`);
  }
  assert.equal(state.audit.filter((entry) => entry.type === 'EVIDENCE_ARTIFACT').length,
    Object.keys(state.evidenceArtifacts).length, '증거 artifact 장부와 감사 사건 수가 어긋났습니다.');
  for (const gate of state.protectedGates) {
    assert.ok(hasExactAuditRecord(state, 'PROTECTED_GATE', 'evidenceRef', gate.evidenceRef, gate),
      `protected gate 감사 사건 누락·변조: ${gate.evidenceRef}`);
  }
  assert.equal(state.audit.filter((entry) => entry.type === 'PROTECTED_GATE').length,
    state.protectedGates.length, 'protected gate 장부와 감사 사건 수가 어긋났습니다.');
  for (const preflight of Object.values(state.directoryPreflights)) {
    assert.ok(hasExactAuditRecord(state, 'DIRECTORY_PREFLIGHT', 'preflightId', preflight.preflightId, preflight),
      `directory preflight 감사 사건 누락·변조: ${preflight.preflightId}`);
  }
  assert.equal(state.audit.filter((entry) => entry.type === 'DIRECTORY_PREFLIGHT').length,
    Object.keys(state.directoryPreflights).length, 'directory preflight 장부와 감사 사건 수가 어긋났습니다.');
  for (const [decisionId, decision] of Object.entries(state.decisions)) {
    const recorded = state.audit.find((entry) => entry.type === 'DECISION_RECORDED' && entry.decisionId === decisionId);
    assert.ok(recorded, `Decision 감사 사건 누락: ${decisionId}`);
    assert.ok(HUMAN_APPROVER_IDS.has(decision.approver), `등록되지 않은 사람 승인자입니다: ${decision.approver}`);
    assert.equal(recorded.decisionType, decision.type, `Decision type 결속 불일치: ${decisionId}`);
    for (const field of [
      'approver', 'approvedAt', 'targetSha', 'subjectTaskId', 'fromActor', 'toActor', 'route',
      'verifierRole', 'approvedPayloadSha256', 'beforeContractSha256',
    ]) {
      assert.equal(recorded[field], decision[field], `Decision ${field} 결속 불일치: ${decisionId}`);
    }
    if (decision.status === 'RETIRED') {
      assert.ok(state.audit.some((entry) => entry.type === 'DECISION_CONSUMED' && entry.decisionId === decisionId),
        `소비된 Decision 감사 사건 누락: ${decisionId}`);
    }
  }
  const recordedDecisions = state.audit.filter((entry) => entry.type === 'DECISION_RECORDED');
  assert.equal(recordedDecisions.length, Object.keys(state.decisions).length,
    'Decision registry와 감사 사건 수가 어긋났습니다.');
  for (const entry of recordedDecisions) {
    assert.ok(state.decisions[entry.decisionId], `감사 원본의 Decision이 registry에서 삭제됐습니다: ${entry.decisionId}`);
  }
  for (const [learningId, learning] of Object.entries(state.learning)) {
    assert.ok(['CANDIDATE', 'VERIFIED', 'RETIRED'].includes(learning.status), 'Learning 상태 enum 위반');
    assert.ok(learning.authorRole && learning.laneOwnerRole, 'Learning은 작성자와 lane 소유자를 가져야 합니다.');
    const proposed = state.audit.find((entry) => entry.type === 'LEARNING_PROPOSED'
      && entry.learningId === learningId && entry.sourceTaskId === learning.sourceTaskId && entry.sourceSha === learning.sourceSha);
    assert.ok(proposed, 'Learning 제안 감사 사건이 필요합니다.');
    for (const field of [
      'evidenceRefs', 'appliesTo', 'excludes', 'conflictsWith', 'supersedes', 'reviewBy',
      'invalidationCondition', 'authorRole', 'laneOwnerRole', 'sourceTaskId', 'sourceSha',
    ]) {
      assert.deepEqual(proposed[field], learning[field], `Learning ${field}가 제안 감사 원본과 어긋났습니다.`);
    }
    assert.equal(proposed.status, 'CANDIDATE', 'Learning 제안 상태는 CANDIDATE여야 합니다.');
    const verifiedEvents = state.audit.filter((entry) => entry.type === 'LEARNING_VERIFIED' && entry.learningId === learningId);
    const retiredEvents = state.audit.filter((entry) => entry.type === 'LEARNING_RETIRED' && entry.learningId === learningId);
    assert.ok(verifiedEvents.length <= 1 && retiredEvents.length <= 1, 'Learning 상태 전이 감사 사건이 중복됐습니다.');
    const derivedStatus = retiredEvents.length ? 'RETIRED' : verifiedEvents.length ? 'VERIFIED' : 'CANDIDATE';
    assert.equal(learning.status, derivedStatus, `Learning 현재 상태가 감사 전이와 어긋났습니다: ${learningId}`);
    if (['VERIFIED', 'RETIRED'].includes(learning.status) && verifiedEvents.length) {
      assert.ok(learning.verifier && learning.decisionId, 'VERIFIED Learning은 검증자와 Decision이 필요합니다.');
      assert.notEqual(learning.verifier, learning.authorRole, '작성자는 자기 Learning을 검증할 수 없습니다.');
      assert.notEqual(learning.verifier, learning.laneOwnerRole, 'lane 소유자는 자기 Learning을 검증할 수 없습니다.');
      assert.ok(verifiedEvents.some((entry) => entry.verifier === learning.verifier
        && entry.decisionId === learning.decisionId && entry.sourceSha === learning.sourceSha),
      'Learning 검증 감사 사건이 현재 상태와 일치해야 합니다.');
      const verifierDecision = state.decisions[learning.decisionId];
      assert.ok(verifierDecision && verifierDecision.type === 'LEARNING_VERIFIER'
        && verifierDecision.verifierRole === learning.verifier && verifierDecision.targetSha === learning.sourceSha,
      `Learning 검증자 Decision이 삭제·변조됐습니다: ${learningId}`);
    }
    const applied = state.audit.filter((entry) => entry.type === 'LEARNING_APPLIED'
      && entry.learningId && learning.appliedTasks.includes(entry.taskId)).map((entry) => entry.taskId);
    assert.deepEqual(applied.sort(), [...learning.appliedTasks].sort(), 'Learning 적용 이력과 감사 사건이 어긋났습니다.');
    if (learning.status === 'RETIRED') {
      assert.ok(state.audit.some((entry) => entry.type === 'LEARNING_RETIRED'
        && entry.learningId && entry.reason === learning.retiredReason), 'Learning 폐기 감사 사건이 필요합니다.');
    }
  }
  assert.equal(state.audit.filter((entry) => entry.type === 'LEARNING_PROPOSED').length,
    Object.keys(state.learning).length, 'Learning 장부와 제안 감사 사건 수가 어긋났습니다.');
  for (const [route, level] of Object.entries(state.autonomy)) {
    if (route === 'default') {
      assert.equal(level, 'A0', 'default 자율성은 A0이어야 합니다.');
      continue;
    }
    assert.ok(AUTONOMY_STEPS.includes(level), `자율성 단계 enum 위반: ${route}:${level}`);
    const events = state.audit.filter((entry) => ['AUTONOMY_PROMOTED', 'AUTONOMY_DEMOTED'].includes(entry.type)
      && entry.route === route);
    assert.ok(events.length > 0, `자율성 상태에 대응하는 감사 사건이 없습니다: ${route}`);
    let derived = 'A0';
    for (const event of events) {
      assert.equal(event.from, derived, `자율성 감사 전이 출발점이 어긋났습니다: ${route}`);
      if (event.type === 'AUTONOMY_PROMOTED') {
        assert.equal(AUTONOMY_STEPS.indexOf(event.to), AUTONOMY_STEPS.indexOf(derived) + 1,
          `자율성 승격은 한 단계여야 합니다: ${route}`);
        const promotionDecision = state.decisions[event.decisionId];
        assert.ok(promotionDecision && promotionDecision.type === 'AUTONOMY_PROMOTION'
          && promotionDecision.route === route, `자율성 승격 Decision이 삭제·변조됐습니다: ${route}`);
      } else if (event.criticalBoundaryBreach) {
        assert.equal(event.to, 'A0', `중대 경계 사고는 A0으로 강등해야 합니다: ${route}`);
        assert.equal(event.automationStopped, true);
        assert.equal(event.humanEscalated, true);
      } else {
        assert.equal(AUTONOMY_STEPS.indexOf(event.to), Math.max(0, AUTONOMY_STEPS.indexOf(derived) - 1),
          `일반 자율성 강등은 한 단계여야 합니다: ${route}`);
      }
      derived = event.to;
    }
    assert.equal(events.at(-1).to, level, `자율성 현재 상태가 마지막 감사 사건과 어긋났습니다: ${route}`);
  }
  for (const finding of Object.values(state.findings)) {
    assert.ok(['OPEN', 'VERIFIED', 'CLOSED', 'DISPUTED'].includes(finding.reviewState), 'Finding 상태 enum 위반');
    if (finding.reviewState === 'VERIFIED') assert.ok(finding.verifiedSha, 'VERIFIED Finding은 검증 SHA가 필요합니다.');
    if (finding.reviewState === 'CLOSED') assert.ok(finding.closedSha, 'CLOSED Finding은 closure SHA가 필요합니다.');
    const sourceRun = state.planReviewRuns.find((run) => run.roundId === finding.sourceRoundId);
    assert.ok(sourceRun, `Finding 원본 회차 누락: ${finding.findingId}`);
    assert.equal(sourceRun.subjectTaskId, finding.subjectTaskId, `Finding Task 결속 불일치: ${finding.findingId}`);
    assert.equal(sourceRun.reviewerRole, finding.discoveredByRole, `Finding 역할 결속 불일치: ${finding.findingId}`);
    assert.equal(sourceRun.exactSha, finding.openedSha, `Finding SHA 결속 불일치: ${finding.findingId}`);
    const opened = state.audit.find((entry) => entry.type === 'FINDING_OPENED' && entry.findingId === finding.findingId);
    assert.ok(opened && opened.discoveredByRole === finding.discoveredByRole
      && opened.exactSha === finding.openedSha && opened.subjectTaskId === finding.subjectTaskId
      && opened.sourceRoundId === finding.sourceRoundId, `Finding 생성 감사 사건 누락·변조: ${finding.findingId}`);
    if (finding.fixReadySha) {
      assert.ok(state.audit.some((entry) => entry.type === 'FINDING_READY'
        && entry.findingId === finding.findingId && entry.fixSha === finding.fixReadySha),
      `Finding 수정 준비 감사 사건 누락: ${finding.findingId}`);
    }
    if (['VERIFIED', 'CLOSED'].includes(finding.reviewState)) {
      assert.ok(state.audit.some((entry) => entry.type === 'FINDING_VERIFIED'
        && entry.findingId === finding.findingId && entry.exactSha === finding.verifiedSha
        && entry.reviewRoundId === finding.verificationRoundId),
      `Finding 검증 감사 사건 누락: ${finding.findingId}`);
    }
    if (finding.reviewState === 'CLOSED') {
      const closed = state.audit.find((entry) => entry.type === 'FINDING_CLOSED' && entry.findingId === finding.findingId);
      const successor = closed && state.closureSuccessors[closed.successorId];
      assert.ok(closed && closed.exactSha === finding.closedSha && successor
        && successor.subjectTaskId === finding.subjectTaskId
        && successor.findingIds.includes(finding.findingId),
      `Finding 종결 감사·successor 누락: ${finding.findingId}`);
    }
  }
  const openedFindings = state.audit.filter((entry) => entry.type === 'FINDING_OPENED');
  assert.equal(openedFindings.length, Object.keys(state.findings).length,
    'Finding registry와 감사 사건 수가 어긋났습니다.');
  for (const entry of openedFindings) {
    assert.ok(state.findings[entry.findingId], `감사 원본의 Finding이 registry에서 삭제됐습니다: ${entry.findingId}`);
  }
  for (const successor of Object.values(state.closureSuccessors)) {
    assert.ok(hasExactAuditRecord(state, 'CLOSURE_SUCCESSOR_RECORDED', 'successorId', successor.successorId, successor),
      `closure successor 감사 사건 누락·변조: ${successor.successorId}`);
  }
  assert.equal(state.audit.filter((entry) => entry.type === 'CLOSURE_SUCCESSOR_RECORDED').length,
    Object.keys(state.closureSuccessors).length, 'closure successor 장부와 감사 사건 수가 어긋났습니다.');
  if (state.directoryMaterialized) {
    assert.ok(state.agentsResponsibilitiesUpdated);
    const activationDecision = state.decisions[state.activationDecisionId];
    assert.ok(activationDecision && activationDecision.type === 'PLAN_ACTIVATION'
      && activationDecision.status === 'ACTIVE', '활성화 Decision이 registry에서 삭제·변조됐습니다.');
    const gate = state.protectedGates.find((item) => item.exactSha === state.activationCommitSha && item.passed);
    assert.ok(gate && hasExactAuditRecord(state, 'PROTECTED_GATE', 'evidenceRef', gate.evidenceRef, gate));
    const materialized = state.audit.filter((entry) => entry.type === 'DIRECTORY_MATERIALIZED');
    assert.equal(materialized.length, 1, 'directory materialization 감사 사건은 정확히 하나여야 합니다.');
    assert.equal(materialized[0].exactSha, state.activationCommitSha, 'directory materialization SHA가 어긋났습니다.');
  }
  return true;
}

function fieldOf(block, name) {
  return block.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
}

function listOf(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = block.match(new RegExp(`^${escaped}:\\n((?:  - .+(?:\\n|$))*)`, 'm'))?.[1] ?? '';
  return [...section.matchAll(/^  - (.+)$/gm)].map((match) => match[1].trim());
}

export function loadWorkQueue() {
  return readFileSync(join(root, 'docs/작업큐.md'), 'utf8').replace(/\r\n/g, '\n');
}

export function validateLiveTaskLedger(text, taskId = 'AI-ORCH-PLANS-SIM-1') {
  const escaped = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = text.match(new RegExp(`## ${escaped}[^\\n]*\\n[\\s\\S]*?\`\`\`yaml\\n([\\s\\S]*?)\\n\`\`\``, 'm'));
  assert.ok(section, `${taskId} Task Packet을 찾을 수 없습니다.`);
  const block = section[1];
  assert.equal(fieldOf(block, 'task_id'), taskId, 'Task heading과 YAML task_id가 어긋났습니다.');
  const requiredFields = [
    'task_id', 'role_id', 'route', 'reviewer_role', 'predecessor_review', 'requirement_ids',
    'request_input_id', 'normalized_request_id', 'current_state', 'objective', 'in_scope',
    'out_of_scope', 'acceptance_criteria', 'roles', 'invariant_ids', 'human_decisions',
    'depends_on', 'conversation_refs', 'last_verified_sha', 'agents_md_blob_sha', 'fixed_decisions',
    'open_decisions', 'open_findings', 'request_dispositions', 'risk_level', 'risk_basis', 'assumptions',
    'artifact_paths', 'reference_paths', 'evidence_paths', 'excluded_paths', 'next_safe_action',
    'stop_conditions', 'user_owned_changes', 'edit_owner', 'owner_session_ref', 'lease_expires_at',
    'active_branch', 'worktree_state', 'untracked_in_scope_paths', 'applied_learning_ids',
    'excluded_learning_ids', 'domain_invariants', 'required_outputs', 'required_tests_evidence',
    'known_risks', 'questions_requiring_human_decision',
    'candidate_manifest_sha256',
  ];
  for (const field of requiredFields) assert.match(block, new RegExp(`^${field}:`, 'm'), `실제 Task 필드 누락: ${field}`);
  const liveState = fieldOf(block, 'current_state') ?? '';
  assert.doesNotMatch(liveState, /차단|환경 미검증/);
  assert.doesNotMatch(liveState, /^(?:DONE|CLOSED|완료)$/, '보호 gate·closure successor 없는 Task를 종료 상태로 기록할 수 없습니다.');
  const roleId = fieldOf(block, 'role_id');
  assert.ok(TASK_ROLE_IDS.has(roleId), `실제 Task role_id가 등록되지 않았습니다: ${roleId}`);
  assert.equal(fieldOf(block, 'edit_owner'), roleId, '실제 Task role_id와 edit_owner가 어긋났습니다.');
  assert.match(fieldOf(block, 'last_verified_sha') ?? '', /^[0-9a-f]{40}$/);
  assert.match(fieldOf(block, 'agents_md_blob_sha') ?? '', /^[0-9a-f]{40}$/);
  assert.match(fieldOf(block, 'edit_owner') ?? '', /^(?!null$|미확인$).+/);
  assert.match(fieldOf(block, 'owner_session_ref') ?? '', /^(?!null$|미확인$).+/);
  assert.match(block, /roles:\s*\[[^\]]*FABLE-FINAL[^\]]*\]/);
  const dependsRaw = fieldOf(block, 'depends_on');
  const dependsOn = dependsRaw === '[]'
    ? []
    : dependsRaw.replace(/^\[/, '').replace(/\]$/, '').split(',').map((item) => item.trim()).filter(Boolean);
  assert.equal(`[${dependsOn.join(', ')}]`, dependsRaw, '실제 Task depends_on canonical 형식이 아닙니다.');
  for (const dependencyId of dependsOn) {
    const dependencyEscaped = dependencyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dependencySection = text.match(new RegExp(`## ${dependencyEscaped}[^\\n]*\\n[\\s\\S]*?\`\`\`yaml\\n([\\s\\S]*?)\\n\`\`\``, 'm'));
    assert.ok(dependencySection, `실제 Task 선행 항목을 찾을 수 없습니다: ${dependencyId}`);
    const dependencyState = fieldOf(dependencySection[1], 'current_state') ?? fieldOf(dependencySection[1], 'status') ?? '';
    assert.match(dependencyState, /완료|DONE|CLOSED|병합/, `미완료 선행 Task가 구현을 허용할 수 없습니다: ${dependencyId}`);
  }
  const lastVerifiedSha = fieldOf(block, 'last_verified_sha');
  const activeBranch = fieldOf(block, 'active_branch');
  const leaseExpiresAt = fieldOf(block, 'lease_expires_at');
  const actualBranch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(activeBranch, actualBranch, `Task active_branch가 실제 브랜치와 어긋났습니다: ${activeBranch} != ${actualBranch}`);
  assert.ok(Number.isFinite(Date.parse(leaseExpiresAt)) && Date.parse(leaseExpiresAt) > Date.now(), 'Task edit lease가 만료됐습니다.');
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', lastVerifiedSha, 'HEAD'], { cwd: root, stdio: 'ignore' });
  } catch {
    assert.fail(`Task last_verified_sha가 현재 HEAD의 유효한 조상이 아닙니다: ${lastVerifiedSha}`);
  }
  const actualAgentsBlob = execFileSync('git', ['hash-object', 'AGENTS.md'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(fieldOf(block, 'agents_md_blob_sha'), actualAgentsBlob, 'Task AGENTS blob이 현재 파일과 어긋났습니다.');
  const artifactPaths = listOf(block, 'artifact_paths');
  const manifestEntries = artifactPaths.filter((path) => path !== 'docs/작업큐.md').sort().map((path) => {
    assert.ok(isSafeRepoRelative(path) && existsSync(join(root, path)), `실제 Task artifact path가 없거나 안전하지 않습니다: ${path}`);
    return `${path}:${sha(readFileSync(join(root, path)))}`;
  });
  assert.equal(fieldOf(block, 'candidate_manifest_sha256'), sha(JSON.stringify(manifestEntries)),
    'mixed worktree 후보 manifest가 현재 artifact 바이트와 어긋났습니다.');
  const evidencePaths = listOf(block, 'evidence_paths');
  assert.ok(evidencePaths.length > 0, '실제 Task evidence_paths가 비어 있습니다.');
  assert.equal(new Set(evidencePaths).size, evidencePaths.length, '실제 Task evidence_paths는 고유해야 합니다.');
  for (const evidencePath of evidencePaths) {
    assert.ok(/^docs\/ai-review\/evidence\/AI-PLANS-SIM-[A-Z0-9-]+\.md$/.test(evidencePath)
      && isSafeRepoRelative(evidencePath) && existsSync(join(root, evidencePath)),
      `실제 Task evidence path가 없거나 안전하지 않습니다: ${evidencePath}`);
    const evidenceText = readFileSync(join(root, evidencePath), 'utf8');
    assert.match(evidenceText, /^# AI-PLANS-SIM-/m, `실제 Task evidence 제목 계약이 없습니다: ${evidencePath}`);
    assert.match(evidenceText, /^> Task: `AI-ORCH-PLANS-SIM-1`$/m, `실제 Task evidence Task 결속이 없습니다: ${evidencePath}`);
    assert.match(evidenceText, /^> 상태:/m, `실제 Task evidence verdict 상태가 없습니다: ${evidencePath}`);
  }

  const dispositionSection = block.match(/request_dispositions:\n([\s\S]*?)\nrisk_level:/)?.[1];
  assert.ok(dispositionSection, 'request_dispositions 구간을 찾을 수 없습니다.');
  assert.doesNotMatch(dispositionSection, /^\s+(disposition|conversation_ref|confirmed_at|human_approval_required):/m);
  const entries = dispositionSection.split(/^\s{2}- seq:\s*/m).slice(1).map((chunk) => `seq: ${chunk}`);
  assert.ok(entries.length > 0, 'request_dispositions가 비어 있습니다.');
  let previousHash = 'GENESIS';
  entries.forEach((entryBlock, index) => {
    const read = (name) => fieldOf(entryBlock, name);
    const entry = {
      seq: Number(read('seq')),
      kind: read('kind'),
      evidenceConversationRef: read('evidence_conversation_ref'),
      observedAt: read('observed_at'),
      requiresHumanApproval: read('requires_human_approval') === 'true',
      decisionId: read('decision_id') === 'null' ? null : read('decision_id'),
      previousHash: read('previous_hash'),
    };
    assert.equal(entry.seq, index + 1);
    assert.ok(DISPOSITIONS.has(entry.kind), `실제 Task disposition enum 위반: ${entry.kind}`);
    assert.equal(entry.previousHash, previousHash);
    assert.equal(read('item_hash'), hashDispositionItem(entry));
    previousHash = read('item_hash');
  });
  return { taskId, dispositionCount: entries.length, lastVerifiedSha: fieldOf(block, 'last_verified_sha') };
}

function baseTaskInput(taskId = 'AI-PLANS-PILOT-001') {
  return {
    taskId,
    roleId: 'SOLAR-ORCH',
    route: 'R0-DOCS',
    reviewerRole: null,
    predecessorReview: null,
    requirementIds: ['REQ-AI-PLANS-NETWORK'],
    requestInputId: `REQUEST:${taskId}`,
    normalizedRequestId: `NORMALIZED:${taskId}`,
    objective: '다섯 기획안 업무 네트워크 검증',
    inScope: Object.values(PLAN_DOCS),
    outOfScope: ['제품 기능', 'DB'],
    acceptanceCriteria: ['Codex 2회', 'Fable 2회', '사람 승인'],
    roles: ['HUMAN-CHIEF', 'SOLAR-AI-DEPUTY', 'CODEX-QA', 'FABLE-ARCH'],
    invariantIds: ['AGENTS:single-canonical-artifact'],
    humanDecisions: ['HUMAN-DECISION:SIMULATION-FIRST'],
    dependsOn: [],
    conversationRef: 'conversation:a:1',
    observedAt: '2026-09-02T10:00:00+09:00',
    lastVerifiedSha: 'a'.repeat(40),
    agentsMdBlobSha: 'b'.repeat(40),
    riskLevel: 'R0',
    riskBasis: '문서·검증 도구만 변경하고 제품·DB·배포는 제외한다.',
    assumptions: [{ assumption: 'Fable CLI 사용 가능', verifier: 'SOLAR-AI-DEPUTY', invalidation: '인증 실패' }],
    appliedLearningIds: [],
    excludedLearningIds: [],
    domainInvariants: ['다섯 문서 단일 권위'],
    artifactPaths: Object.values(PLAN_DOCS),
    referencePaths: ['AGENTS.md'],
    evidencePaths: ['docs/ai-review/simulations/AI-PLANS-WORKFLOW-001.md'],
    excludedPaths: ['apps/mobile/**', '.claude/settings.json'],
    nextSafeAction: '독립 시뮬레이션 실행',
    stopConditions: ['사용자 파일 겹침', 'stale SHA'],
    userOwnedChanges: [{ path: 'apps/mobile/**', disposition: 'EXCLUDE' }],
    leaseTtl: 20,
    activeBranch: 'codex/ai-team-knowledge-orchestration-plans',
    worktreeState: 'mixed',
    untrackedInScopePaths: [],
    requiredOutputs: ['시뮬레이션 구현', '독립 검수 증거'],
    requiredTestsEvidence: ['ai:plans:simulate', 'Fable 2회'],
    knownRisks: ['동일 증거 재포장'],
    humanQuestions: ['최종 활성화 승인'],
  };
}

function simulatedFableRun(roundId, fields) {
  const reviewTaskId = fields.reviewTaskId ?? `review-task:${roundId}`;
  return {
    reviewerEngine: 'FABLE',
    reviewerModel: 'claude-fable-5',
    cliVersion: '2.1.250',
    sessionRef: `session:${roundId}`,
    roundBudgetUsd: 4,
    taskBudgetUsd: 4,
    reportedUsageUsd: fields.terminalReason === 'completed' ? 1 : 0.5,
    structuredResultSha256: sha(`structured:${roundId}`),
    reviewTaskId,
    reviewMode: 'INITIAL',
    registryMode: 'INITIAL',
    predecessorReview: null,
    independentRequest: null,
    reviewRoute: 'MANDATORY_MUTUAL',
    authorRole: 'SOLAR-ORCH',
    snapshotMode: 'COMMIT',
    taskContractSha256: sha(`task-contract:${reviewTaskId}`),
    reviewArtifactExists: fields.terminalReason === 'completed',
    ...fields,
    roundId,
  };
}

function recordSimulatedFableRun(state, roundId, fields) {
  const run = simulatedFableRun(roundId, fields);
  if (!state.reviewTasks[run.reviewTaskId]) {
    registerReviewTask(state, {
      reviewTaskId: run.reviewTaskId,
      subjectTaskId: run.subjectTaskId,
      exactSha: run.exactSha,
      auditScope: run.auditScope,
      reviewRoute: run.reviewRoute,
      authorRole: run.authorRole,
      reviewerRole: run.reviewerRole,
      reviewMode: run.reviewMode,
      snapshotMode: run.snapshotMode,
      independentRequest: run.independentRequest,
      taskBudgetUsd: run.taskBudgetUsd,
      taskContractSha256: run.taskContractSha256,
    });
  }
  return recordFableRun(state, run);
}

function simulatedCodexEvidence(passId, fields) {
  return {
    reviewerSessionRef: `session:${passId}`,
    evidenceSha256: sha(`evidence:${passId}`),
    ...fields,
    passId,
  };
}

export function runHappyPathSimulation() {
  const state = createSimulationState();
  const draftReviewSha = '9'.repeat(40);
  const reviewTargetSha = 'c'.repeat(40);
  const activationCommitSha = 'd'.repeat(40);
  const taskInput = { ...baseTaskInput(), lastVerifiedSha: draftReviewSha };
  const taskId = taskInput.taskId;

  recordRequestPair(state, taskInput);
  acquireQueueLock(state, 'chat-a');
  acquireTaskLock(state, 'chat-a', taskId);
  registerTask(state, 'chat-a', taskInput);
  recordDecision(state, {
    decisionId: 'DEC-AUTONOMY-A1', type: 'AUTONOMY_PROMOTION', approver: 'human-owner',
    approvedAt: '2026-09-02T10:01:00+09:00', targetSha: draftReviewSha,
    subjectTaskId: taskId, route: taskInput.route,
  });
  promoteAutonomy(state, taskInput.route, {
    to: 'A1', decisionId: 'DEC-AUTONOMY-A1', evidencePassed: true,
    escapeCount: 0, evaluationWindows: 1, sampleCount: 30,
  });
  const observed = observeDispositionPrefix(state, taskId);
  updateTask(state, 'chat-a', taskId, { currentState: 'IMPLEMENTED' }, observed);
  releaseTaskLock(state, 'chat-a', taskId);
  releaseQueueLock(state, 'chat-a');

  acquireQueueLock(state, 'chat-b');
  appendDisposition(state, 'chat-b', taskId, {
    kind: 'STATUS_ONLY', evidenceConversationRef: 'conversation:b:4', observedAt: '2026-09-02T10:05:00+09:00', requiresHumanApproval: false,
  });
  const addDisposition = appendDisposition(state, 'chat-b', taskId, {
    kind: 'ADD', evidenceConversationRef: 'conversation:b:5', observedAt: '2026-09-02T10:06:00+09:00', requiresHumanApproval: false,
    changePayload: {
      addInScope: [],
      addAcceptanceCriteria: ['추가 요청이 동일 Task의 완료 조건에 append-only로 반영된다.'],
      addArtifactPaths: [],
    },
  });
  appendDisposition(state, 'chat-b', taskId, {
    kind: 'SUPERSEDE_PROPOSAL', evidenceConversationRef: 'conversation:b:6', observedAt: '2026-09-02T10:07:00+09:00', requiresHumanApproval: true,
    changePayload: { proposal: '목표·범위 변경은 별도 사람 Decision 뒤에만 적용한다.' },
  });
  releaseQueueLock(state, 'chat-b');
  assert.equal(state.tasks[taskId].objective, taskInput.objective, '사람 승인 전 범위가 바뀌면 안 됩니다.');

  acquireQueueLock(state, 'chat-a');
  acquireTaskLock(state, 'chat-a', taskId);
  applyAddDisposition(state, 'chat-a', taskId, {
    dispositionSeq: addDisposition.seq,
    observedPrefix: observeDispositionPrefix(state, taskId),
    addAcceptanceCriteria: ['추가 요청이 동일 Task의 완료 조건에 append-only로 반영된다.'],
  });
  releaseTaskLock(state, 'chat-a', taskId);
  releaseQueueLock(state, 'chat-a');

  const commonReview = { subjectTaskId: taskId };
  recordSimulatedFableRun(state, 'FABLE-R0-FAILED', {
    ...commonReview, reviewerRole: 'FABLE-STRATEGY',
    terminalReason: 'budget_exhausted', exactSha: draftReviewSha,
    auditScope: 'WORKFLOW_FIDELITY', evidenceRef: 'run:FABLE-R0-FAILED',
  });
  registerFinding(state, {
    findingId: 'FABLE-WORKFLOW-001', fingerprint: 'workflow:stale-prefix',
    discoveredByRole: 'FABLE-STRATEGY', exactSha: draftReviewSha,
    subjectTaskId: taskId, sourceRoundId: 'FABLE-R1-CHANGES',
  });
  recordSimulatedFableRun(state, 'FABLE-R1-CHANGES', {
    ...commonReview, reviewerRole: 'FABLE-STRATEGY',
    terminalReason: 'completed', verdict: 'CHANGES_REQUIRED',
    exactSha: draftReviewSha, requiredFindings: ['FABLE-WORKFLOW-001'],
    auditScope: 'WORKFLOW_FIDELITY', evidenceRef: 'run:FABLE-R1-CHANGES',
  });
  markFindingReady(state, { findingId: 'FABLE-WORKFLOW-001', actorRole: 'SOLAR', fixSha: reviewTargetSha });
  acquireQueueLock(state, 'chat-a');
  acquireTaskLock(state, 'chat-a', taskId);
  updateTask(state, 'chat-a', taskId, {
    currentState: 'REVIEWING', lastVerifiedSha: reviewTargetSha,
  }, observeDispositionPrefix(state, taskId));
  releaseTaskLock(state, 'chat-a', taskId);
  releaseQueueLock(state, 'chat-a');
  recordCodexEvidence(state, simulatedCodexEvidence('CODEX-R1', {
    exactSha: reviewTargetSha, graphPassed: true, sabotagePassed: true,
    subjectTaskId: taskId, auditScope: 'CONTRACT_AUDIT', evidenceRef: 'evidence:CODEX-R1',
  }));
  recordSimulatedFableRun(state, 'FABLE-R1-RECHECK', {
    ...commonReview, reviewerRole: 'FABLE-STRATEGY',
    terminalReason: 'completed', verdict: 'PASS', exactSha: reviewTargetSha,
    auditScope: 'FINDING_RECHECK', evidenceRef: 'run:FABLE-R1-RECHECK',
    reviewMode: 'INITIAL', registryMode: 'RECHECK', predecessorReview: 'FABLE-R1-CHANGES',
  });
  verifyFinding(state, {
    findingId: 'FABLE-WORKFLOW-001', reviewerRole: 'FABLE-STRATEGY',
    exactSha: reviewTargetSha, reviewRoundId: 'FABLE-R1-RECHECK',
  });
  recordSimulatedFableRun(state, 'FABLE-R1', {
    ...commonReview, reviewerRole: 'FABLE-FINAL',
    terminalReason: 'completed', verdict: 'PASS', exactSha: reviewTargetSha,
    auditScope: 'WORKFLOW_FIDELITY', evidenceRef: 'run:FABLE-R1',
    reviewRoute: 'FINAL_INDEPENDENT', authorRole: 'AI-DEPUTY-ORCHESTRATOR',
    reviewMode: 'FINAL', snapshotMode: 'COMMIT', independentRequest: 'workflow-fidelity-clean-room',
  });
  recordCodexEvidence(state, simulatedCodexEvidence('CODEX-R2', {
    exactSha: reviewTargetSha, graphPassed: true, sabotagePassed: true,
    subjectTaskId: taskId, auditScope: 'ADVERSARIAL_AUDIT', evidenceRef: 'evidence:CODEX-R2',
  }));
  recordSimulatedFableRun(state, 'FABLE-R2', {
    ...commonReview, reviewerRole: 'FABLE-FINAL',
    terminalReason: 'completed', verdict: 'PASS', exactSha: reviewTargetSha,
    auditScope: 'NETWORK_CLOSURE', evidenceRef: 'run:FABLE-R2',
    reviewRoute: 'FINAL_INDEPENDENT', authorRole: 'AI-DEPUTY-ORCHESTRATOR',
    reviewMode: 'FINAL', snapshotMode: 'COMMIT', independentRequest: 'network-closure-clean-room',
  });

  acquireQueueLock(state, 'chat-a');
  acquireTaskLock(state, 'chat-a', taskId);
  updateTask(state, 'chat-a', taskId, {
    currentState: 'DONE',
  }, observeDispositionPrefix(state, taskId));
  releaseTaskLock(state, 'chat-a', taskId);
  releaseQueueLock(state, 'chat-a');

  approvePlanActivation(state, {
    decisionId: 'DEC-AI-PLANS-ACTIVE', approver: 'human-owner',
    approvedAt: '2026-09-02T12:00:00+09:00', reviewTargetSha, subjectTaskId: taskId,
  });
  recordEvidenceArtifact(state, {
    evidenceRef: 'ci:activation', evidenceSha256: sha('ci:activation'),
    kind: 'PROTECTED_GATE', exactSha: activationCommitSha,
  });
  recordProtectedGate(state, {
    exactSha: activationCommitSha, fullDbRequired: 'success', protectedGate: 'success',
    evidenceRef: 'ci:activation', evidenceSha256: sha('ci:activation'),
  });
  activatePlanDocuments(state, {
    decisionId: 'DEC-AI-PLANS-ACTIVE',
    activationCommitSha,
    parentReviewSha: reviewTargetSha,
    changedPlanIds: ['ontology', 'orchestration', 'directory', 'quality'],
    agentsResponsibilitiesUpdated: true,
    decisionRecordedInCommit: true,
  });
  recordEvidenceArtifact(state, {
    evidenceRef: 'evidence:docs-graph-check', evidenceSha256: sha('evidence:docs-graph-check'),
    kind: 'DIRECTORY_PREFLIGHT', exactSha: activationCommitSha,
  });
  recordDirectoryPreflight(state, {
    preflightId: 'PREFLIGHT-AI-PLANS-001', exactSha: activationCommitSha,
    checkerEvidenceRef: 'evidence:docs-graph-check',
    pathMap: [{ from: 'docs/old.md', to: 'docs/plans/new.md' }],
    userOwnedOverlap: [], oldReferenceCount: 0,
    checkerEvidenceSha256: sha('evidence:docs-graph-check'),
  });
  materializeDirectory(state, {
    decisionId: 'DEC-AI-PLANS-ACTIVE', exactSha: activationCommitSha,
    preflightId: 'PREFLIGHT-AI-PLANS-001',
  });

  recordDecision(state, {
    decisionId: 'DEC-LRN-001', type: 'LEARNING_VERIFIER', approver: 'human-owner', approvedAt: '2026-09-02T12:10:00+09:00', targetSha: activationCommitSha,
    verifierRole: 'CODEX-QA',
  });
  const learningEvidenceRefs = ['workflow', 'network'].map((caseId) => {
    const evidenceRef = `simulation:happy-path:${caseId}`;
    recordEvidenceArtifact(state, {
      evidenceRef, evidenceSha256: sha(evidenceRef), kind: 'LEARNING_SOURCE',
      exactSha: activationCommitSha, sourceCaseId: caseId,
    });
    return evidenceRef;
  });
  proposeLearning(state, 'LRN-AI-PLANS-001', {
    evidenceRefs: learningEvidenceRefs, appliesTo: ['R0-DOCS'], excludes: ['SECURITY-FIRST'],
    conflictsWith: [], supersedes: [], reviewBy: '2027-02-28', invalidationCondition: 'AI plan workflow changes',
    authorRole: 'SOLAR', laneOwnerRole: 'AI-DEPUTY-ORCHESTRATOR',
    sourceTaskId: taskId, sourceSha: activationCommitSha,
  });
  verifyLearning(state, 'LRN-AI-PLANS-001', { verifier: 'CODEX-QA', decisionId: 'DEC-LRN-001', independent: true });
  acquireQueueLock(state, 'chat-c');
  acquireTaskLock(state, 'chat-c', 'AI-PLANS-SEPARATE-002');
  const separateTaskInput = {
    ...baseTaskInput('AI-PLANS-SEPARATE-002'),
    conversationRef: 'conversation:c:1',
    inScope: ['docs/ai-review/evidence/AI-PLANS-SEPARATE-002.md'],
    artifactPaths: ['docs/ai-review/evidence/AI-PLANS-SEPARATE-002.md'],
    appliedLearningIds: ['LRN-AI-PLANS-001'],
  };
  recordRequestPair(state, separateTaskInput);
  registerTask(state, 'chat-c', separateTaskInput);
  releaseTaskLock(state, 'chat-c', 'AI-PLANS-SEPARATE-002');
  releaseQueueLock(state, 'chat-c');
  applyLearning(state, 'LRN-AI-PLANS-001', { taskId: 'AI-PLANS-SEPARATE-002', route: 'R0-DOCS' });
  validateTrace(state);
  return state;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isDirectRun) {
  const network = validateDocumentNetwork(loadPlanDocuments());
  const state = runHappyPathSimulation();
  console.log(`AI 기획 문서 네트워크: ${network.nodeCount}개 노드 · 탐색 강연결=${network.referenceStronglyConnected} · 권위 DAG=${network.authorityAcyclic}`);
  console.log(`업무 시뮬레이션: ${state.audit.length}개 사건 · Task=${Object.keys(state.tasks).length}`);
  console.log('AI 기획안 업무 네트워크 시뮬레이션 통과');
}
