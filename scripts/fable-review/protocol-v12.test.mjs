import assert from 'node:assert/strict';
import {
  DEFAULT_TASK_CAP_USD, FALLBACK_MODEL_ID, FALLBACK_REVIEWER_ENGINE,
  PRIMARY_MODEL_ID, PRIMARY_REVIEWER_ENGINE, assertFallbackResultBinding,
  classifyFallbackReason, effectiveFallbackReviewMode, fallbackInputScope,
  validateClosureReview, validateProtocolV12Engine,
} from './protocol-v12.mjs';

const hash = (char) => char.repeat(64);
const oid = (char) => char.repeat(40);
const fallback = {
  from_task_id: 'SOURCE-001', from_round: 'r002', from_run_sha256: hash('1'),
  reason: 'MODEL_RATE_LIMITED', source_commit_sha: oid('2'), target_commit_sha: oid('3'),
  handoff_base_commit_sha: oid('1'),
  input_files_sha256: hash('4'), artifact_set_sha256: hash('5'), finding_registry_sha256: hash('6'),
  inherited_finding_ids: ['FINDING-1'], collaboration_bytes: 100, collaboration_sha256: hash('7'),
  handoff_turn_id: 'turn-o001', handoff_entry_sha256: hash('8'), handoff_run_sha256: hash('9'),
  spent_usd: '1.25', remaining_usd: '2.75',
};
const task = {
  protocol_version: '1.2', task_id: 'SUCCESSOR-001', route: 'MANDATORY_MUTUAL', review_mode: 'INITIAL',
  target_commit_sha: oid('3'), primary_reviewer_engine: PRIMARY_REVIEWER_ENGINE,
  reviewer_engine: FALLBACK_REVIEWER_ENGINE, reviewer_model: FALLBACK_MODEL_ID,
  task_budget_usd: DEFAULT_TASK_CAP_USD, fallback_review: fallback,
};
const rejects = (mutate, pattern) => {
  const copy = structuredClone(task); mutate(copy);
  assert.throws(() => validateProtocolV12Engine(copy), pattern);
};

assert.deepEqual(validateProtocolV12Engine(task).model, 'claude-opus-5');
assert.deepEqual(classifyFallbackReason({ terminalReason: 'model_rate_limited' }), { eligible: true, reason: 'MODEL_RATE_LIMITED' });
assert.deepEqual(classifyFallbackReason({ subtype: 'error_max_budget_usd', terminalReason: 'budget_exhausted' }), { eligible: false, reason: 'TASK_CAP_APPROVAL_REQUIRED' });
assert.deepEqual(classifyFallbackReason({ terminalReason: 'authentication_failed' }), { eligible: false, reason: 'NOT_FALLBACK_ELIGIBLE' });
rejects((v) => { v.reviewer_model = PRIMARY_MODEL_ID; }, /엔진·모델/);
rejects((v) => { v.fallback_review.reason = 'AUTH_FAILED'; }, /allowlist/);
rejects((v) => { v.fallback_review.target_commit_sha = oid('a'); }, /target commit/);
rejects((v) => { v.fallback_review.remaining_usd = '3.00'; }, /상한/);
rejects((v) => { v.fallback_review = null; }, /fallback_review/);
{
  const learningTask = structuredClone(task);
  learningTask.applied_learning_ids = ['LRN-ORCH-TEST-001'];
  learningTask.excluded_learning_ids = [];
  learningTask.fallback_review.learning_assignment_sha256 = hash('a');
  assert.equal(validateProtocolV12Engine(learningTask).fallback.learning_assignment_sha256, hash('a'));
  delete learningTask.fallback_review.learning_assignment_sha256;
  assert.throws(() => validateProtocolV12Engine(learningTask), /필드가 계약/);
}
assert.equal(effectiveFallbackReviewMode(task, ['FINDING-1']), 'RECHECK');
{
  const directRecheck = structuredClone(task);
  directRecheck.review_mode = 'RECHECK';
  assert.throws(() => effectiveFallbackReviewMode(directRecheck, ['FINDING-1']), /RECHECK/);
}
assert.equal(fallbackInputScope('FINAL_INDEPENDENT', { hasSuccessfulRound: true }), 'INDEPENDENT_REQUEST_ONLY');
assert.equal(fallbackInputScope('SECURITY', { hasSuccessfulRound: true }), 'FULL_PREDECESSOR_LEDGER');
assert.equal(fallbackInputScope('SECURITY', { hasSuccessfulRound: false }), 'SOLAR_REQUEST_ONLY');
assert.throws(() => assertFallbackResultBinding({ primary_reviewer_engine: 'FABLE', reviewer_engine: 'OPUS_FALLBACK', reviewer_model: 'claude-opus-5', findings: [{ review_state: 'VERIFIED' }] }, task), /verified_by_engine/);
assert.doesNotThrow(() => assertFallbackResultBinding({ primary_reviewer_engine: 'FABLE', reviewer_engine: 'OPUS_FALLBACK', reviewer_model: 'claude-opus-5', findings: [{ review_state: 'VERIFIED', verified_by_engine: 'OPUS_FALLBACK' }] }, task));
const primaryTask = { engine_contract: { engine: PRIMARY_REVIEWER_ENGINE, model: PRIMARY_MODEL_ID } };
assert.throws(() => assertFallbackResultBinding({ primary_reviewer_engine: 'FABLE', reviewer_engine: 'FABLE', reviewer_model: PRIMARY_MODEL_ID, findings: [{ review_state: 'VERIFIED', verified_by_engine: 'OPUS_FALLBACK' }] }, primaryTask), /실제 엔진/);
assert.throws(() => assertFallbackResultBinding({ primary_reviewer_engine: 'FABLE', reviewer_engine: 'FABLE', reviewer_model: PRIMARY_MODEL_ID, findings: [{ review_state: 'OPEN', verified_by_engine: 'FABLE' }] }, primaryTask), /VERIFIED가 아닌/);
const closure = {
  from_task_id: 'SOURCE-001', from_round: 'r002', from_run_sha256: hash('1'),
  from_review_sha256: hash('2'), finding_registry_sha256: hash('3'),
  decision_commit_sha: oid('4'), protected_ref: 'refs/heads/main',
  check_contexts: ['verify / Node 20.19.4', 'verify / Node 24'],
  checks_evidence_sha256: hash('5'), p0_2_validator_run_sha256: hash('6'),
};
assert.equal(validateClosureReview(closure, { task_id: 'CLOSURE-001', snapshot_mode: 'COMMIT' }).decision_commit_sha, oid('4'));
assert.throws(() => validateClosureReview(closure, { task_id: 'CLOSURE-001', snapshot_mode: 'WORKING_TREE_HASHED' }), /COMMIT/);
console.log('protocol 1.2 fallback 계약 22/22 통과');
