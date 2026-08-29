import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  artifactSetHash,
  GateValidationError,
  validateAnchorCommit,
  validateCheckRuns,
  validateClosureSuccessor,
  validateDependencyResults,
  validateRunChain,
  validateRoundHistory,
} from './protected-gate-validator.mjs';

const oid = (char) => char.repeat(40);
const hash = (char) => char.repeat(64);
const contexts = ['verify (node 20.19.4)', 'verify (node 24)', 'full-db-required'];
const decision = oid('a');
const head = oid('b');
const checks = contexts.map((context) => ({ sha: decision, context, conclusion: 'success' }));
let passed = 0;
const jsonRaw = (value) => Buffer.from(`${JSON.stringify(value)}\n`);
const digest = (value) => createHash('sha256').update(value).digest('hex');

function ok(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok   ${name}`);
}

function rejects(name, fn, pattern) {
  assert.throws(fn, (error) => error instanceof GateValidationError && pattern.test(error.message));
  passed += 1;
  console.log(`  ok   ${name}`);
}

ok('두 선행 job success만 허용', () => {
  assert.deepEqual(validateDependencyResults(JSON.stringify({ verify: { result: 'success' }, 'full-db-required': { result: 'success' } })), {
    'full-db-required': 'success', verify: 'success',
  });
});
rejects('DB job 실패는 보호 게이트 실패', () => validateDependencyResults(JSON.stringify({ verify: { result: 'success' }, 'full-db-required': { result: 'failure' } })), /success가 아닙니다/);
rejects('필수 job 누락은 보호 게이트 실패', () => validateDependencyResults(JSON.stringify({ verify: { result: 'success' } })), /집합이 다릅니다/);

ok('정확한 decision SHA의 필수 check와 보호 ref 포함', () => validateCheckRuns({
  decisionSha: decision, requiredContexts: contexts, checkRuns: checks,
  protectedHeadSha: head, isAncestor: () => true,
}));
rejects('다른 SHA의 성공 check는 인정하지 않음', () => validateCheckRuns({
  decisionSha: decision, requiredContexts: contexts,
  checkRuns: checks.map((run) => ({ ...run, sha: oid('c') })),
  protectedHeadSha: head, isAncestor: () => true,
}), /정확한 SHA/);
rejects('실패 check는 인정하지 않음', () => validateCheckRuns({
  decisionSha: decision, requiredContexts: contexts,
  checkRuns: checks.map((run, index) => (index === 1 ? { ...run, conclusion: 'failure' } : run)),
  protectedHeadSha: head, isAncestor: () => true,
}), /필수 check/);
rejects('decision이 보호 ref에 없으면 거부', () => validateCheckRuns({
  decisionSha: decision, requiredContexts: contexts, checkRuns: checks,
  protectedHeadSha: head, isAncestor: () => false,
}), /보호 ref/);

ok('gate anchor가 decision commit의 조상', () => validateAnchorCommit(decision, head, () => true));
rejects('잘못된 gate anchor 거부', () => validateAnchorCommit(decision, head, () => false), /gate anchor/);

ok('run hash-chain 연속', () => assert.equal(validateRunChain([
  { run_sha256: hash('1'), previous_run_sha256: null },
  { run_sha256: hash('2'), previous_run_sha256: hash('1') },
]), hash('2')));
rejects('끊긴 previous_run_sha256 거부', () => validateRunChain([
  { run_sha256: hash('1'), previous_run_sha256: null },
  { run_sha256: hash('2'), previous_run_sha256: hash('9') },
]), /연속성/);

ok('COMMIT closure successor의 route·registry 유지', () => validateClosureSuccessor({
  decisionSha: decision, targetSha: head, inheritedRegistrySha: hash('3'),
  predecessorRegistrySha: hash('3'), snapshotMode: 'COMMIT', route: 'SECURITY', predecessorRoute: 'SECURITY',
}));
rejects('closure successor registry 변경 거부', () => validateClosureSuccessor({
  decisionSha: decision, targetSha: head, inheritedRegistrySha: hash('3'),
  predecessorRegistrySha: hash('4'), snapshotMode: 'COMMIT', route: 'SECURITY', predecessorRoute: 'SECURITY',
}), /registry/);
rejects('closure successor route 변경 거부', () => validateClosureSuccessor({
  decisionSha: decision, targetSha: head, inheritedRegistrySha: hash('3'),
  predecessorRegistrySha: hash('3'), snapshotMode: 'COMMIT', route: 'FINAL_INDEPENDENT', predecessorRoute: 'SECURITY',
}), /route/);
rejects('WORKING_TREE closure successor 거부', () => validateClosureSuccessor({
  decisionSha: decision, targetSha: head, inheritedRegistrySha: hash('3'),
  predecessorRegistrySha: hash('3'), snapshotMode: 'WORKING_TREE_HASHED', route: 'SECURITY', predecessorRoute: 'SECURITY',
}), /COMMIT/);

ok('모든 회차의 run/review/input/artifact 봉인 연속', () => {
  const files = [{ path: 'a.md', path_role: 'ARTIFACT', change_type: 'MODIFIED', size: 1, git_blob_oid: oid('1'), sha256: hash('a'), line_count: 1 }];
  const manifest1 = { previous_run_sha256: hash('7'), previous_review_sha256: hash('8'), input_files: files, input_files_sha256: hash('0') };
  manifest1.input_files_sha256 = hash('0');
  // inputFilesSha256는 공개 metadata JSON 자체의 hash다.
  manifest1.input_files_sha256 = digest(JSON.stringify(files));
  const manifestRaw1 = jsonRaw(manifest1);
  const reviewRaw1 = jsonRaw({ verdict: 'PASS' });
  const run1 = { run_state: 'RESULT_RECEIVED', manifest_sha256: digest(manifestRaw1), input_files_sha256: manifest1.input_files_sha256, review_sha256: digest(reviewRaw1) };
  const runRaw1 = jsonRaw(run1);
  const manifest2 = { ...manifest1, previous_run_sha256: digest(runRaw1), previous_review_sha256: run1.review_sha256 };
  const manifestRaw2 = jsonRaw(manifest2);
  const run2 = { run_state: 'RUN_FAILED', manifest_sha256: digest(manifestRaw2), input_files_sha256: manifest2.input_files_sha256, review_sha256: null };
  const result = validateRoundHistory([
    { name: 'r001', manifest: manifest1, manifestRaw: manifestRaw1, run: run1, runRaw: runRaw1, reviewRaw: reviewRaw1 },
    { name: 'r002', manifest: manifest2, manifestRaw: manifestRaw2, run: run2, runRaw: jsonRaw(run2), reviewRaw: null },
  ], { run: hash('7'), review: hash('8') });
  assert.equal(result.evidence.length, 2);
  assert.equal(result.latestReview, run1.review_sha256);
  assert.equal(result.evidence[0].artifact_set_sha256, artifactSetHash(files));
});

rejects('모든 회차 중 끊긴 run chain 거부', () => {
  const files = [];
  const input = digest(JSON.stringify(files));
  const manifest = { previous_run_sha256: null, previous_review_sha256: null, input_files: files, input_files_sha256: input };
  const raw = jsonRaw(manifest);
  const run = { run_state: 'RUN_FAILED', manifest_sha256: digest(raw), input_files_sha256: input, review_sha256: null };
  validateRoundHistory([{ name: 'r001', manifest: { ...manifest, previous_run_sha256: hash('9') }, manifestRaw: raw, run, runRaw: jsonRaw(run), reviewRaw: null }]);
}, /previous_run_sha256/);

rejects('손상된 input artifact metadata 거부', () => {
  const files = [{ path: 'a.md', path_role: 'ARTIFACT', change_type: 'MODIFIED', size: 1, git_blob_oid: oid('1'), sha256: hash('a'), line_count: 1 }];
  const manifest = { previous_run_sha256: null, previous_review_sha256: null, input_files: files, input_files_sha256: hash('0') };
  const raw = jsonRaw(manifest);
  const run = { run_state: 'RUN_FAILED', manifest_sha256: digest(raw), input_files_sha256: manifest.input_files_sha256, review_sha256: null };
  validateRoundHistory([{ name: 'r001', manifest, manifestRaw: raw, run, runRaw: jsonRaw(run), reviewRaw: null }]);
}, /metadata hash/);

console.log(`protected gate validator ${passed}/${passed} 통과`);
