# TEAM-LEARNING-IMPL-003 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `6f3fb154d65099be678686c39ddb5a701755f854`

## 요약

predecessor TEAM-LEARNING-IMPL-002/r001의 Finding 6건을 같은 finding_id·previous_finding_id로 재확인했다. 6건 모두 target commit 6f3fb15의 코드·문서·자체시험에서 수용 기준이 충족돼 VERIFIED로 기록하며, 미해결 필수 Finding은 없다.

(1) TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED(유일한 OPEN): assertLearningCleanRoom의 task 필드 루프가 `task.route === 'FINAL_INDEPENDENT'`에서 `mustBeClean`(687행)으로 바뀌어 최초 SECURITY에도 independent_request·requirements·human_decisions·required_evidence 검사가 적용되고, 오류 메시지가 `${task.route} ${field}`로 route를 표기한다(696행). 자체시험 6047~6053행이 최초 SECURITY human_decisions의 'LRN-ORCH-TEST-001'을 65·'SECURITY human_decisions' 메시지로 거부하고, 6054행이 predecessor 있는 SECURITY 후속의 ID 나열을 계속 허용함을 양성 시험한다(요구 1-1·1-3). ROLE_CONTEXTS 36~38행, README 283~285행, 작업큐 232~234행, 기획안 937~940행이 '두 경로의 Task 요청·요구·사람 결정·필수 증거와 공동 장부 전체'로 통일됐다.
(2) 회귀 없음(요구 1-4): 장부 delta·manifest 봉인(632~656, 706~721, 4672~4678, 5272행), 전체 장부 스캔과 SECURITY 프롬프트 excluded 축약(675~686, 2632~2641행), append 사전 차단(702~704, 4193~4194행), 만료 두 날짜 합성(657행), fallback successor 학습 집합 hash 대조(2953~2961, 3019행, protocol-v12.mjs 63~75행)가 모두 유지되고 해당 자체시험(6057~6147, 6149~6208, 6386~6392행)도 그대로 있다. 실행 순서도 loadLearningContext→assertLearningCleanRoom이 engine 계약·predecessor 로드보다 먼저 수행된다(5058~5059행).
(3) 호환(요구 1-5): protocol 1.1은 loadLearningContext가 null을 반환하고(620행), 장부 없는 commit의 1.2 Task는 학습 필드가 없을 때만 null로 통과한다(622~627행). fallback 템플릿은 learning_assignment_sha256을 포함한다.

참고: 자체시험 test 호출 50개와 protocol 1.2 계약 22/22는 정적 확인했고, `corepack pnpm verify 6/6`과 실제 실행 로그는 이번 패킷의 evidence_paths·공동 장부에 없다. VERIFIED는 코드·자체시험 정적 확인에 따른 로컬 판정이며 Codex 실행 증거 확인과 게이트 종결은 별도로 남는다(gate_state OPEN). 사소한 정리 사항으로 687행 `if (mustBeClean)`은 679행 조기 반환 뒤라 항상 참이어서 중복이나 동작에는 영향이 없다.

## Findings

### TL-REGISTRY-SAME-COMMIT-TRUST — Major / VERIFIED

- 범주: ARCHITECTURE
- 검증 엔진: FABLE
- 영향: predecessor에서 VERIFIED된 장부 봉인 계약이 이번 commit에서 회귀하지 않았다.
- 근거: scripts/fable-review.mjs:632, scripts/fable-review.mjs:706, scripts/fable-review.mjs:4672, scripts/fable-review.mjs:6084
- 완료 조건: baseline과 target의 docs/team/TEAM_LEARNING.md blob이 다르면 해당 경로가 task.artifact_paths(또는 reference_paths)에 있어야 하고, 없으면 exit 65로 실패 폐쇄한다. / 적용 ID의 장부 항목이 baseline↔target 사이에 변경됐으면 같은 Task에서 적용할 수 없다(장부가 baseline에 없던 최초 도입 commit은 artifact 포함 조건으로만 허용). / manifest에 learning_registry_blob_oid와 sha256을 기록하고 staging manifest 비교에 포함한다.
- 필요한 테스트: self-test: 장부가 변경됐는데 allowed_paths에 없는 Task가 65로 거부된다 / self-test: 같은 commit에서 CANDIDATE→VERIFIED로 바뀐 항목을 적용하면 거부된다 / self-test: manifest의 learning_registry 해시가 target 장부와 다르면 STALE 75

### TL-CLEANROOM-SCAN-INCOMPLETE — Major / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: 전체 장부 스캔·ID-only 전달 계약이 회귀 없이 유지된다.
- 근거: scripts/fable-review.mjs:195, scripts/fable-review.mjs:675, scripts/fable-review.mjs:2632, scripts/fable-review.mjs:6028, scripts/fable-review.mjs:6166
- 완료 조건: FINAL_INDEPENDENT Task의 independent_request와 requirements·human_decisions·required_evidence 문자열에도 학습 표식 검사를 적용한다. / 최초 SECURITY(predecessor·fallback·closure 없음) Task는 collaboration.md의 모든 턴 구간(SOLAR_REQUEST 외 포함)을 검사한다. / LEARNING_SUMMARY_MARKER_RE에 \bLRN-[A-Z0-9][A-Z0-9_-]{2,63}\b 패턴을 추가한다. / SECURITY 후속 Task 프롬프트의 trusted_task_packet에서 excluded_learning_ids[].reason 본문을 검사하거나 제거해 ID만 전달되는 계약을 유지한다.
- 필요한 테스트: self-test: FINAL_INDEPENDENT independent_request에 'LRN-ORCH-TEST-001' 또는 '학습 요약'이 있으면 65 거부 / self-test: 최초 SECURITY collaboration의 CODEX_EVIDENCE 턴에 학습 표식이 있으면 65 거부 / self-test: predecessor가 있는 SECURITY 후속은 ID 나열을 계속 허용

### TL-APPEND-CLEANROOM-LATE-FAIL — Minor / VERIFIED

- 범주: OPERATIONS
- 검증 엔진: FABLE
- 영향: append 사전 차단이 유지된다. 이번 mustBeClean 확장으로 append 후보 검사도 task 필드까지 같은 함수를 거친다.
- 근거: scripts/fable-review.mjs:702, scripts/fable-review.mjs:4189, scripts/fable-review.mjs:6057
- 완료 조건: fable:append가 새 턴을 붙이기 전에 후보 장부 전체에 assertLearningCleanRoom을 적용해 거부한다. / 거부 메시지가 어느 턴·표식 때문인지 명시한다.
- 필요한 테스트: self-test: 클린룸 Task에 학습 표식 턴 append 시 65 거부, 장부 무변경

### TL-EXPIRY-COMMITTER-DATE-ONLY — Minor / VERIFIED

- 범주: DATA_INTEGRITY
- 검증 엔진: FABLE
- 영향: 만료 판정 계약이 회귀하지 않았다.
- 근거: scripts/fable-review.mjs:657, scripts/fable-review.mjs:6070, docs/team/ROLE_CONTEXTS.md:27, docs/ai-review/README.md:276
- 완료 조건: 실행 시각의 UTC 날짜도 함께 비교해 review_by가 실행일보다 이르면 거부하고 manifest에 판정 기준일(learning_target_date)을 기록한다. / README 또는 ROLE_CONTEXTS에 만료 판정 기준(두 날짜 중 늦은 쪽)을 명시한다.
- 필요한 테스트: self-test: review_by가 commit 날짜 이후지만 실행일 이전이면 65 거부

### TL-SUCCESSOR-AND-TEST-GAPS — Improvement / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: successor 계약 봉인과 시험 공백 보완이 유지된다.
- 근거: scripts/fable-review/protocol-v12.mjs:63, scripts/fable-review.mjs:2953, scripts/fable-review.mjs:6188, scripts/fable-review.mjs:6386, scripts/fable-review/protocol-v12.test.mjs:40, docs/ai-review/templates/task-v12-fallback.example.json:49
- 완료 조건: fallback_review에 predecessor의 학습 ID 집합 해시를 추가해 successor와 대조한다. / excluded_learning_ids 변조·순서 변경 result가 76으로 거부됨을 시험한다. / FINAL_INDEPENDENT 프롬프트가 verified_learning_context와 LRN- 문자열을 포함하지 않음을 시험한다.
- 필요한 테스트: protocol-v12.test.mjs: successor 학습 집합 불일치 거부 / self-test: excluded 변조 76, FINAL 프롬프트 클린룸

### TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED — Minor / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: 최초 SECURITY의 실제 전체 입력(공동 장부 전체 + task 요청·요구·사람 결정·필수 증거)이 학습 클린룸으로 기계 강제되고 후속 ID-only 계약은 유지된다. 수용 기준 2건과 required_tests 1건이 충족됐다.
- 근거: scripts/fable-review.mjs:687, scripts/fable-review.mjs:6047, scripts/fable-review.mjs:5058, docs/team/ROLE_CONTEXTS.md:36, docs/ai-review/README.md:283, docs/작업큐.md:232, docs/팀구성_상세기획안.md:937
- 완료 조건: assertLearningCleanRoom의 task 필드 검사를 FINAL_INDEPENDENT 전용에서 mustBeClean(최초 SECURITY 포함)으로 확장하고, 오류 메시지에 route를 표기한다. / ROLE_CONTEXTS·README·작업큐·기획안의 클린룸 서술을 '두 경로의 공동 장부 전체와 task 요구·사람 결정·필수 증거 필드'로 통일한다.
- 필요한 테스트: self-test: 최초 SECURITY task의 human_decisions에 'LRN-ORCH-TEST-001'이 있으면 65 거부, predecessor가 있는 SECURITY 후속은 계속 허용

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
