const SHA256_RE = /^[0-9a-f]{64}$/;
const GIT_OID_RE = /^[0-9a-f]{40}$/;
const TASK_ID_RE = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

export const PRIMARY_REVIEWER_ENGINE = 'FABLE';
export const FALLBACK_REVIEWER_ENGINE = 'OPUS_FALLBACK';
export const PRIMARY_MODEL_ID = 'claude-fable-5';
export const FALLBACK_MODEL_ID = 'claude-opus-5';
export const DEFAULT_TASK_CAP_USD = '4.00';
export const FALLBACK_REASONS = new Set([
  'MODEL_BUDGET_EXHAUSTED',
  'MODEL_RATE_LIMITED',
  'MODEL_CAPACITY_UNAVAILABLE',
]);

const PROVIDER_REASON_MAP = new Map([
  ['model_budget_exhausted', 'MODEL_BUDGET_EXHAUSTED'],
  ['model_rate_limited', 'MODEL_RATE_LIMITED'],
  ['model_capacity_unavailable', 'MODEL_CAPACITY_UNAVAILABLE'],
]);

export function normalizeUsd(value, label = '금액') {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`${label}은 소수 둘째 자리까지의 문자열 금액이어야 합니다.`);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10) {
    throw new Error(`${label}은 0.00~10.00 범위여야 합니다.`);
  }
  return amount.toFixed(2);
}

export function classifyFallbackReason({ subtype, terminalReason, providerErrorCode } = {}) {
  if (subtype === 'error_max_budget_usd' || terminalReason === 'budget_exhausted') {
    return { eligible: false, reason: 'TASK_CAP_APPROVAL_REQUIRED' };
  }
  const structured = [providerErrorCode, terminalReason, subtype]
    .find((value) => PROVIDER_REASON_MAP.has(value));
  if (structured) return { eligible: true, reason: PROVIDER_REASON_MAP.get(structured) };
  return { eligible: false, reason: 'NOT_FALLBACK_ELIGIBLE' };
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}은 객체여야 합니다.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} 필드가 계약과 다릅니다.`);
}

function string(value, label, pattern) {
  if (typeof value !== 'string' || (pattern && !pattern.test(value))) throw new Error(`${label} 값이 잘못됐습니다.`);
}

const FALLBACK_KEYS = new Set([
  'from_task_id', 'from_round', 'from_run_sha256', 'reason', 'source_commit_sha',
  'handoff_base_commit_sha',
  'target_commit_sha', 'input_files_sha256', 'artifact_set_sha256',
  'finding_registry_sha256', 'inherited_finding_ids', 'collaboration_bytes',
  'collaboration_sha256', 'handoff_turn_id', 'handoff_entry_sha256',
  'handoff_run_sha256', 'spent_usd', 'remaining_usd',
]);

export function validateFallbackReview(value, task) {
  const hasLearningAssignment = Object.prototype.hasOwnProperty.call(task, 'applied_learning_ids')
    || Object.prototype.hasOwnProperty.call(task, 'excluded_learning_ids');
  const expectedKeys = new Set(FALLBACK_KEYS);
  if (hasLearningAssignment) expectedKeys.add('learning_assignment_sha256');
  exactKeys(value, expectedKeys, 'fallback_review');
  string(value.from_task_id, 'fallback_review.from_task_id', TASK_ID_RE);
  if (value.from_task_id === task.task_id) throw new Error('fallback successor는 새 Task ID여야 합니다.');
  string(value.from_round, 'fallback_review.from_round', /^r\d{3}$/);
  for (const key of ['from_run_sha256', 'input_files_sha256', 'artifact_set_sha256', 'finding_registry_sha256', 'collaboration_sha256', 'handoff_entry_sha256', 'handoff_run_sha256']) {
    string(value[key], `fallback_review.${key}`, SHA256_RE);
  }
  if (hasLearningAssignment) string(value.learning_assignment_sha256, 'fallback_review.learning_assignment_sha256', SHA256_RE);
  for (const key of ['source_commit_sha', 'handoff_base_commit_sha', 'target_commit_sha']) string(value[key], `fallback_review.${key}`, GIT_OID_RE);
  string(value.handoff_turn_id, 'fallback_review.handoff_turn_id', /^turn-o\d{3}$/);
  if (!FALLBACK_REASONS.has(value.reason)) throw new Error('fallback_reason이 소진 allowlist 밖입니다.');
  if (!Array.isArray(value.inherited_finding_ids) || new Set(value.inherited_finding_ids).size !== value.inherited_finding_ids.length) {
    throw new Error('inherited_finding_ids는 중복 없는 배열이어야 합니다.');
  }
  value.inherited_finding_ids.forEach((id) => string(id, 'inherited_finding_ids', /^[A-Z0-9][A-Z0-9_-]{2,95}$/));
  if (!Number.isSafeInteger(value.collaboration_bytes) || value.collaboration_bytes < 0) throw new Error('collaboration_bytes가 잘못됐습니다.');
  const cap = Number(normalizeUsd(task.task_budget_usd, 'task_budget_usd'));
  const spent = Number(normalizeUsd(value.spent_usd, 'fallback_review.spent_usd'));
  const remaining = Number(normalizeUsd(value.remaining_usd, 'fallback_review.remaining_usd'));
  if (Math.round((cap - spent) * 100) !== Math.round(remaining * 100) || remaining <= 0) {
    throw new Error('작업 전체 상한의 사용액·잔여액이 맞지 않습니다.');
  }
  if (value.target_commit_sha !== task.target_commit_sha) throw new Error('fallback successor가 target commit을 바꿨습니다.');
  return structuredClone(value);
}

export function validateProtocolV12Engine(task) {
  if (task.protocol_version !== '1.2') throw new Error('protocol 1.2 Task가 아닙니다.');
  normalizeUsd(task.task_budget_usd, 'task_budget_usd');
  if (task.primary_reviewer_engine !== PRIMARY_REVIEWER_ENGINE) throw new Error('primary reviewer engine은 FABLE이어야 합니다.');
  if (task.reviewer_engine === PRIMARY_REVIEWER_ENGINE) {
    if (task.reviewer_model !== PRIMARY_MODEL_ID || task.fallback_review !== null) throw new Error('Fable Task의 엔진·모델·fallback 필드가 맞지 않습니다.');
    return { engine: PRIMARY_REVIEWER_ENGINE, model: PRIMARY_MODEL_ID, fallback: null };
  }
  if (task.reviewer_engine !== FALLBACK_REVIEWER_ENGINE || task.reviewer_model !== FALLBACK_MODEL_ID) {
    throw new Error('Opus fallback 엔진·모델이 정확한 allowlist와 다릅니다.');
  }
  if (!task.fallback_review) throw new Error('Opus successor에는 fallback_review가 필요합니다.');
  return { engine: FALLBACK_REVIEWER_ENGINE, model: FALLBACK_MODEL_ID, fallback: validateFallbackReview(task.fallback_review, task) };
}

const CLOSURE_KEYS = new Set([
  'from_task_id', 'from_round', 'from_run_sha256', 'from_review_sha256',
  'finding_registry_sha256', 'decision_commit_sha', 'protected_ref',
  'check_contexts', 'checks_evidence_sha256', 'p0_2_validator_run_sha256',
]);

export function validateClosureReview(value, task) {
  exactKeys(value, CLOSURE_KEYS, 'closure_review');
  string(value.from_task_id, 'closure_review.from_task_id', TASK_ID_RE);
  if (value.from_task_id === task.task_id) throw new Error('closure successor는 새 Task ID여야 합니다.');
  string(value.from_round, 'closure_review.from_round', /^r\d{3}$/);
  for (const key of [
    'from_run_sha256', 'from_review_sha256', 'finding_registry_sha256',
    'checks_evidence_sha256', 'p0_2_validator_run_sha256',
  ]) string(value[key], `closure_review.${key}`, SHA256_RE);
  string(value.decision_commit_sha, 'closure_review.decision_commit_sha', GIT_OID_RE);
  string(value.protected_ref, 'closure_review.protected_ref', /^refs\/heads\/[A-Za-z0-9._\/-]+$/);
  if (!Array.isArray(value.check_contexts) || value.check_contexts.length === 0
    || value.check_contexts.length !== new Set(value.check_contexts).size) {
    throw new Error('closure_review.check_contexts는 중복 없는 비어 있지 않은 배열이어야 합니다.');
  }
  value.check_contexts.forEach((context) => string(context, 'closure_review.check_contexts', /^[A-Za-z0-9][A-Za-z0-9 ._\/-]{0,127}$/));
  if (task.snapshot_mode !== 'COMMIT') throw new Error('closure successor는 COMMIT snapshot이어야 합니다.');
  return structuredClone(value);
}

export function fallbackInputScope(route, { hasSuccessfulRound }) {
  if (route === 'FINAL_INDEPENDENT') return 'INDEPENDENT_REQUEST_ONLY';
  return hasSuccessfulRound ? 'FULL_PREDECESSOR_LEDGER' : 'SOLAR_REQUEST_ONLY';
}

export function effectiveFallbackReviewMode(task, inheritedFindingIds) {
  const inherited = inheritedFindingIds.length > 0;
  if (task.route === 'SECURITY') {
    if (task.review_mode !== 'SECURITY') throw new Error('SECURITY successor는 SECURITY mode를 유지해야 합니다.');
    return inherited ? 'RECHECK' : 'SECURITY';
  }
  if (task.route === 'FINAL_INDEPENDENT') {
    if (task.review_mode !== 'FINAL') throw new Error('FINAL successor는 FINAL mode를 유지해야 합니다.');
    return 'FINAL';
  }
  if (task.review_mode === 'RECHECK') throw new Error('successor task에 RECHECK를 직접 선언할 수 없습니다.');
  if (task.review_mode !== 'INITIAL') throw new Error('일반 successor task는 INITIAL mode여야 합니다.');
  return inherited ? 'RECHECK' : 'INITIAL';
}

export function assertFallbackResultBinding(result, task) {
  const expected = task.engine_contract ?? validateProtocolV12Engine(task);
  if (result.primary_reviewer_engine !== PRIMARY_REVIEWER_ENGINE
    || result.reviewer_engine !== expected.engine
    || result.reviewer_model !== expected.model) {
    throw new Error('결과의 실제 reviewer engine/model 출처가 Task와 다릅니다.');
  }
  for (const finding of result.findings ?? []) {
    const verified = finding.review_state === 'VERIFIED';
    if (verified && finding.verified_by_engine !== expected.engine) {
      throw new Error(`VERIFIED Finding의 verified_by_engine은 실제 엔진(${expected.engine})이어야 합니다.`);
    }
    if (!verified && finding.verified_by_engine !== null) {
      throw new Error('VERIFIED가 아닌 Finding에는 verified_by_engine을 기록할 수 없습니다.');
    }
  }
}
