# TEAM-LEARNING-IMPL-002 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `a4fd66c4e9452000f32ac5786769e777f7af624f`

## 요약

predecessor r001의 Finding 5건을 같은 finding_id로 재확인했다. 5건 모두 수용 기준이 target commit 코드와 자체시험에서 충족돼 VERIFIED로 기록한다.

(1) TL-REGISTRY-SAME-COMMIT-TRUST: loadLearningContext가 baseline↔target 장부 blob을 비교해 변경 시 artifact/reference 선언을 강제하고(미선언 65), 최초 도입은 artifact 포함을 요구하며, 적용 ID의 항목이 같은 Task에서 바뀌면 거부한다. manifest는 learning_registry_blob_oid·sha256·assignment_sha256·target_date를 봉인하고 staging 비교(4678행)가 STALE 75로 대조한다. 자체시험(6077~6140행)이 숨김 장부·CANDIDATE→VERIFIED 승격·manifest 해시 변조를 모두 부정 시험한다.
(2) TL-CLEANROOM-SCAN-INCOMPLETE: 표식 정규식에 LRN- ID 패턴이 추가됐고, 최초 SECURITY는 collaboration.md 전체를, FINAL_INDEPENDENT는 independent_request·requirements·human_decisions·required_evidence까지 검사한다. SECURITY 후속 프롬프트의 trusted_task_packet과 metadata에서 excluded 사유 본문이 제거된다(자체시험 6172행).
(3) TL-APPEND-CLEANROOM-LATE-FAIL: append 경로가 normalizeManualTurn 직후, 어떤 파일도 쓰기 전에 assertLearningAppendCandidate로 후보 장부 전체를 검사하며, 거부 메시지가 턴 ID와 표식을 명시한다.
(4) TL-EXPIRY-COMMITTER-DATE-ONLY: 판정일은 commit 날짜와 실행 UTC 날짜 중 늦은 쪽이며 manifest learning_target_date에 봉인되고 README·ROLE_CONTEXTS에 명시됐다.
(5) TL-SUCCESSOR-AND-TEST-GAPS: fallback_review에 learning_assignment_sha256이 조건부 필수 키로 추가되고 predecessor와 적용·제외 집합 동일성과 hash를 모두 대조한다. excluded 순서 변조 76, FINAL 프롬프트 LRN- 부재 시험이 추가됐다. protocol 1.1과 장부 없는 commit의 1.2 Task는 null 반환·조건부 키로 호환이 유지된다(1-7).

새 Finding 1건(Minor)을 낸다. 요구 1-2는 "최초 SECURITY의 실제 전체 입력" 차단을 명시하지만, task 필드(requirements·human_decisions·required_evidence) 검사는 FINAL_INDEPENDENT에만 적용되고 최초 SECURITY 프롬프트의 trusted_task_packet에는 같은 필드가 검사 없이 통째로 들어간다. 한 줄 수준의 수정이며 proposed_edits에 제안했다. 아울러 작업큐·기획안의 완료 조건 문구가 여전히 SOLAR_REQUEST만 언급해 넓어진 계약보다 좁게 서술돼 있어 정렬 편집을 제안한다.

참고: 자체시험 묶음 50개(test 호출 수 정적 확인)와 protocol 1.2 계약 22/22, verify 6/6의 실제 실행 증거는 이번 패킷의 evidence_paths·공동 장부에 없다. VERIFIED는 코드·자체시험 정적 확인에 따른 로컬 판정이며, Codex 실행 증거와 게이트 종결은 별도로 남는다.

## Findings

### TL-REGISTRY-SAME-COMMIT-TRUST — Major / VERIFIED

- 범주: ARCHITECTURE
- 검증 엔진: FABLE
- 영향: 수용 기준 3건과 required_tests 3건이 모두 충족돼 장부 조작에 의한 CANDIDATE 주입 경로가 기계적으로 차단됐다.
- 근거: scripts/fable-review.mjs:632, scripts/fable-review.mjs:706, scripts/fable-review.mjs:4672, scripts/fable-review.mjs:5268, scripts/fable-review.mjs:6077
- 완료 조건: baseline과 target의 docs/team/TEAM_LEARNING.md blob이 다르면 해당 경로가 task.artifact_paths(또는 reference_paths)에 있어야 하고, 없으면 exit 65로 실패 폐쇄한다. / 적용 ID의 장부 항목이 baseline↔target 사이에 변경됐으면 같은 Task에서 적용할 수 없다(장부가 baseline에 없던 최초 도입 commit은 artifact 포함 조건으로만 허용). / manifest에 learning_registry_blob_oid와 sha256을 기록하고 staging manifest 비교에 포함한다.
- 필요한 테스트: self-test: 장부가 변경됐는데 allowed_paths에 없는 Task가 65로 거부된다 / self-test: 같은 commit에서 CANDIDATE→VERIFIED로 바뀐 항목을 적용하면 거부된다 / self-test: manifest의 learning_registry 해시가 target 장부와 다르면 STALE 75

### TL-CLEANROOM-SCAN-INCOMPLETE — Major / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: 수용 기준 4건과 required_tests 3건이 충족됐다. 최초 SECURITY task 필드 잔여 공백은 별도 신규 Finding으로 분리했다.
- 근거: scripts/fable-review.mjs:195, scripts/fable-review.mjs:675, scripts/fable-review.mjs:2632, scripts/fable-review.mjs:6028, scripts/fable-review.mjs:6159
- 완료 조건: FINAL_INDEPENDENT Task의 independent_request와 requirements·human_decisions·required_evidence 문자열에도 학습 표식 검사를 적용한다. / 최초 SECURITY(predecessor·fallback·closure 없음) Task는 collaboration.md의 모든 턴 구간(SOLAR_REQUEST 외 포함)을 검사한다. / LEARNING_SUMMARY_MARKER_RE에 \bLRN-[A-Z0-9][A-Z0-9_-]{2,63}\b 패턴을 추가한다. / SECURITY 후속 Task 프롬프트의 trusted_task_packet에서 excluded_learning_ids[].reason 본문을 검사하거나 제거해 ID만 전달되는 계약(1-5)을 유지한다.
- 필요한 테스트: self-test: FINAL_INDEPENDENT independent_request에 'LRN-ORCH-TEST-001' 또는 '학습 요약'이 있으면 65 거부 / self-test: 최초 SECURITY collaboration의 CODEX_EVIDENCE 턴에 학습 표식이 있으면 65 거부 / self-test: predecessor가 있는 SECURITY 후속은 ID 나열을 계속 허용

### TL-APPEND-CLEANROOM-LATE-FAIL — Minor / VERIFIED

- 범주: OPERATIONS
- 검증 엔진: FABLE
- 영향: append-only 장부가 영구 실패 상태로 오염되기 전에 차단된다.
- 근거: scripts/fable-review.mjs:702, scripts/fable-review.mjs:4190, scripts/fable-review.mjs:684, scripts/fable-review.mjs:6050
- 완료 조건: fable:append가 새 턴을 붙이기 전에 후보 장부 전체에 assertLearningCleanRoom을 적용해 거부한다. / 거부 메시지가 어느 턴·표식 때문인지 명시한다.
- 필요한 테스트: self-test: 클린룸 Task에 학습 표식 턴 append 시 65 거부, 장부 무변경

### TL-EXPIRY-COMMITTER-DATE-ONLY — Minor / VERIFIED

- 범주: DATA_INTEGRITY
- 검증 엔진: FABLE
- 영향: committer date 조작만으로 만료 학습을 주입하는 우회가 닫혔다. 두 날짜 합성 자체는 loadLearningContext 경로에서 직접 부정 시험되지 않으나 한 줄 로직으로 잔여 위험은 낮다.
- 근거: scripts/fable-review.mjs:657, scripts/fable-review.mjs:711, scripts/fable-review.mjs:6063, docs/team/ROLE_CONTEXTS.md:27, docs/ai-review/README.md:276
- 완료 조건: 실행 시각의 UTC 날짜도 함께 비교해 review_by가 실행일보다 이르면 거부하고 manifest에 판정 기준일(learning_target_date)을 기록한다. / README 또는 ROLE_CONTEXTS에 만료 판정 기준(두 날짜 중 늦은 쪽)을 명시한다.
- 필요한 테스트: self-test: review_by가 commit 날짜 이후지만 실행일 이전이면 65 거부

### TL-SUCCESSOR-AND-TEST-GAPS — Improvement / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: 계약 봉인 빈틈과 시험 공백이 메워졌다.
- 근거: scripts/fable-review/protocol-v12.mjs:63, scripts/fable-review.mjs:2932, scripts/fable-review.mjs:3019, scripts/fable-review.mjs:6181, scripts/fable-review.mjs:6379, scripts/fable-review.mjs:6173, scripts/fable-review/protocol-v12.test.mjs:40
- 완료 조건: fallback_review에 predecessor의 학습 ID 집합 해시를 추가해 successor와 대조한다. / excluded_learning_ids 변조·순서 변경 result가 76으로 거부됨을 시험한다. / FINAL_INDEPENDENT 프롬프트가 verified_learning_context와 LRN- 문자열을 포함하지 않음을 시험한다.
- 필요한 테스트: protocol-v12.test.mjs: successor 학습 집합 불일치 거부 / self-test: excluded 변조 76, FINAL 프롬프트 클린룸

### TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED — Minor / OPEN

- 범주: SECURITY
- 영향: 요구 1-2의 '최초 SECURITY의 실제 전체 입력' 차단에 대해, 저자가 통제하는 task.json의 requirements·human_decisions·required_evidence에 LRN- ID나 학습 요약을 적으면 최초 보안 감사 프롬프트에 검사 없이 전달된다. 장부 검사와 동일한 위협 모델이며 수정은 조건문 한 줄 수준이다.
- 근거: scripts/fable-review.mjs:687, scripts/fable-review.mjs:2632, docs/team/ROLE_CONTEXTS.md:36, docs/작업큐.md:232
- 완료 조건: assertLearningCleanRoom의 task 필드 검사를 FINAL_INDEPENDENT 전용에서 mustBeClean(최초 SECURITY 포함)으로 확장하고, 오류 메시지에 route를 표기한다. / ROLE_CONTEXTS·README·작업큐·기획안의 클린룸 서술을 '두 경로의 공동 장부 전체와 task 요구·사람 결정·필수 증거 필드'로 통일한다.
- 필요한 테스트: self-test: 최초 SECURITY task의 human_decisions에 'LRN-ORCH-TEST-001'이 있으면 65 거부, predecessor가 있는 SECURITY 후속은 계속 허용

## 공동 편집 제안

### TL-EDIT-FIRST-SECURITY-FIELD-SCAN — COMMENT

- 대상: `scripts/fable-review.mjs`
- 위치:       ['independent_request', [task.independent_request]],
- 연결 Finding: TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED
- 이유: 요구 1-2의 최초 SECURITY 전체 입력 차단을 완성한다.

    이 필드 루프를 감싸는 `if (task.route === 'FINAL_INDEPENDENT')` 조건을 제거하거나 `if (mustBeClean)`으로 바꿔 최초 SECURITY Task에도 requirements·human_decisions·required_evidence(및 null이 아닌 independent_request) 검사를 적용한다. 오류 메시지는 `${task.route} ${field}에 학습 표식(...)을 넣을 수 없습니다.`처럼 route를 표기한다. 자체시험 'independent-and-first-security-reviews-are-learning-clean-rooms'에 최초 SECURITY task.human_decisions에 'LRN-ORCH-TEST-001'이 있을 때 65 거부 케이스를 추가한다.

### TL-EDIT-ROLE-CONTEXTS-CLEANROOM-SCOPE — REPLACE

- 대상: `docs/team/ROLE_CONTEXTS.md`
- 위치:   비어 있어야 한다. 최종 독립 감사의 요청·요구·사람 결정·필수 증거와 두 경로의 공동 장부 전체에도
- 연결 Finding: TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED
- 이유: 실행기 확장 후 문서와 코드를 일치시킨다.

      비어 있어야 한다. 두 경로의 Task 요청·요구·사람 결정·필수 증거와 공동 장부 전체에도

### TL-EDIT-WORKQUEUE-CLEANROOM-SCOPE — REPLACE

- 대상: `docs/작업큐.md`
- 위치: - `SECURITY` route r001의 `SOLAR_REQUEST` 장부에 Learning ID·학습 요약이 있으면 실행기가
- 연결 Finding: TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED
- 이유: 완료 조건을 구현된 넓은 클린룸 계약과 일치시킨다(다음 줄 '실패 폐쇄함을 자체시험이 검증한다.'와 이어짐).

    - `SECURITY` route r001과 `FABLE-FINAL` 모든 회차의 공동 장부 전체와 Task 요구·사람 결정·필수 증거 필드에 Learning ID·학습 요약이 있으면 실행기와 append 경로가

### TL-EDIT-PLAN-CLEANROOM-SCOPE — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: `SECURITY` Task의 두 필드 및 `SOLAR_REQUEST` 학습 표식을 비워 둔다. 보안 후속 Task에는 검증된 ID
- 연결 Finding: TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED
- 이유: 기획안 서술을 README·ROLE_CONTEXTS와 같은 범위로 정렬한다.

    `SECURITY` Task의 두 필드를 비우고, 두 경로의 공동 장부 전체와 Task 요구·사람 결정·필수 증거에 학습 표식이 있으면 실행기와 append 경로가 거부한다. 보안 후속 Task에는 검증된 ID

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
