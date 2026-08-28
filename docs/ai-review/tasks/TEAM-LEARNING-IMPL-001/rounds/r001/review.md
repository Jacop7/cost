# TEAM-LEARNING-IMPL-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `e799f42676aa607b9f7a6ce1f3739bed99fe9b5e`

## 요약

TEAM-LEARNING-1 기계 계약의 핵심은 잘 잡혀 있다. 장부 파싱(정확한 키 집합·양방향 충돌·반대 레인 검증자·VERIFIED 증거 필수), Task 필드 동시 선언·중복·겹침 거부, CANDIDATE·RETIRED·만료·미등록·충돌 ID 실패 폐쇄, result schema const와 manifest 봉인, protocol 1.1 및 장부 없는 commit의 1.2 Task 보존, 일반 검수 최소 체크리스트 주입과 SECURITY 경로의 ID-only 처리는 코드와 자체시험이 일치한다. 실제 target commit의 장부를 읽은 이번 실행에서도 applied/excluded ID가 정확히 echo됐다.

그러나 집중 검토 질문에 대한 답으로 두 가지 Major를 낸다. (1) 장부는 저자가 통제하는 target commit에서 읽히는데, baseline↔target 사이의 장부 변경이 검수 입력에 포함되도록 강제하지 않고 manifest도 장부 blob 해시를 봉인하지 않는다. 같은 commit에서 CANDIDATE를 VERIFIED로 올리고 곧바로 적용해도 검수자는 이를 볼 수 없다. (2) 클린룸 검사가 collaboration.md의 SOLAR_REQUEST 구간만 훑는다. FINAL_INDEPENDENT 프롬프트에 실제로 들어가는 independent_request(8000자)는 전혀 검사하지 않고, 최초 SECURITY 프롬프트에 통째로 들어가는 CODEX_EVIDENCE·HUMAN_DECISION 등 다른 턴도 검사하지 않으며, 표식 정규식은 `LRN-…` ID 자체를 잡지 못한다. 그 밖에 append 시점 미검사로 인한 append-only 장부의 영구 실패, 만료 판정이 조작 가능한 committer date에만 의존하는 점, 시험 공백을 Minor·Improvement로 기록한다. 문서(README·ROLE_CONTEXTS·기획안·작업큐)는 구현과 일관된다.

## Findings

### TL-REGISTRY-SAME-COMMIT-TRUST — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 같은 feature commit에서 CANDIDATE 항목을 VERIFIED로 바꾸거나 review_by·conflicts_with를 수정하고 즉시 applied_learning_ids에 넣어도 실행기가 통과시키며, 장부가 artifact/reference에 없으면 검수자는 변조를 볼 수 없다. 집중 검토 질문 '장부 JSON 조작으로 CANDIDATE 주입 가능한가'에 대해 부분적으로 가능하다.
- 근거: scripts/fable-review.mjs:612, scripts/fable-review.mjs:5164, docs/team/TEAM_LEARNING.md:144
- 완료 조건: baseline과 target의 docs/team/TEAM_LEARNING.md blob이 다르면 해당 경로가 task.artifact_paths(또는 reference_paths)에 있어야 하고, 없으면 exit 65로 실패 폐쇄한다. / 적용 ID의 장부 항목이 baseline↔target 사이에 변경됐으면 같은 Task에서 적용할 수 없다(장부가 baseline에 없던 최초 도입 commit은 artifact 포함 조건으로만 허용). / manifest에 learning_registry_blob_oid와 sha256을 기록하고 staging manifest 비교(4572행 인근)에 포함한다.
- 필요한 테스트: self-test: 장부가 변경됐는데 allowed_paths에 없는 Task가 65로 거부된다 / self-test: 같은 commit에서 CANDIDATE→VERIFIED로 바뀐 항목을 적용하면 거부된다 / self-test: manifest의 learning_registry 해시가 target 장부와 다르면 STALE 75

### TL-CLEANROOM-SCAN-INCOMPLETE — Major / OPEN

- 범주: SECURITY
- 영향: FINAL_INDEPENDENT 요청문이나 최초 SECURITY 장부의 CODEX_EVIDENCE·HUMAN_DECISION 턴에 'LRN-ORCH-CI-001 적용: exact-SHA 대기'처럼 ID와 규칙 요약을 적어도 실행기가 통과시켜 클린룸 요구(1-4)가 기계적으로 보장되지 않는다.
- 근거: scripts/fable-review.mjs:634, scripts/fable-review.mjs:2546, scripts/fable-review.mjs:869, scripts/fable-review.mjs:3492, scripts/fable-review.mjs:195, scripts/fable-review.mjs:5915
- 완료 조건: FINAL_INDEPENDENT Task의 independent_request와 requirements·human_decisions·required_evidence 문자열에도 학습 표식 검사를 적용한다. / 최초 SECURITY(predecessor·fallback·closure 없음) Task는 collaboration.md의 모든 턴 구간(SOLAR_REQUEST 외 포함)을 검사한다. / LEARNING_SUMMARY_MARKER_RE에 \bLRN-[A-Z0-9][A-Z0-9_-]{2,63}\b 패턴을 추가한다. / SECURITY 후속 Task 프롬프트의 trusted_task_packet에서 excluded_learning_ids[].reason 본문을 검사하거나 제거해 ID만 전달되는 계약(1-5)을 유지한다.
- 필요한 테스트: self-test: FINAL_INDEPENDENT independent_request에 'LRN-ORCH-TEST-001' 또는 '학습 요약'이 있으면 65 거부 / self-test: 최초 SECURITY collaboration의 CODEX_EVIDENCE 턴에 학습 표식이 있으면 65 거부 / self-test: 기존 5933행 케이스처럼 predecessor가 있는 SECURITY 후속은 ID 나열을 계속 허용

### TL-APPEND-CLEANROOM-LATE-FAIL — Minor / OPEN

- 범주: OPERATIONS
- 영향: 클린룸 Task의 append-only 장부에 학습 표식이 담긴 SOLAR_REQUEST가 한 번 추가되면 편집이 금지돼 있어 그 Task의 모든 이후 회차가 영구히 65로 실패하고 새 Task를 만들어야 한다.
- 근거: scripts/fable-review.mjs:4029, scripts/fable-review.mjs:4956
- 완료 조건: fable:append가 새 턴을 붙이기 전에 후보 장부 전체에 assertLearningCleanRoom을 적용해 거부한다. / 거부 메시지가 어느 턴·표식 때문인지 명시한다.
- 필요한 테스트: self-test: 클린룸 Task에 학습 표식 턴 append 시 65 거부, 장부 무변경

### TL-EXPIRY-COMMITTER-DATE-ONLY — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: commit 날짜를 과거로 두면 review_by가 지난 학습도 정상 주입된다. 재현성을 위해 commit 날짜를 쓰는 것은 타당하지만 단독 기준으로는 우회 가능하다.
- 근거: scripts/fable-review.mjs:623, scripts/fable-review.mjs:587
- 완료 조건: 실행 시각(manifest started_at의 UTC 날짜)도 함께 비교해 review_by가 실행일보다 이르면 거부하고 manifest에 판정 기준일(learning_target_date)을 기록한다. / README 또는 ROLE_CONTEXTS에 만료 판정 기준(두 날짜 중 늦은 쪽)을 명시한다.
- 필요한 테스트: self-test: review_by가 commit 날짜 이후지만 실행일 이전이면 65 거부

### TL-SUCCESSOR-AND-TEST-GAPS — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 차단 결함은 아니지만 계약 봉인의 빈틈과 시험 공백이 남아 회귀 시 조기 발견이 어렵다.
- 근거: scripts/fable-review/protocol-v12.mjs:63, scripts/fable-review.mjs:6133, scripts/fable-review.mjs:5936
- 완료 조건: fallback_review에 predecessor의 학습 ID 집합 해시(또는 배열)를 추가해 successor와 대조한다. / excluded_learning_ids 변조·순서 변경 result가 76으로 거부됨을 시험한다. / FINAL_INDEPENDENT 프롬프트가 verified_learning_context와 LRN- 문자열을 포함하지 않음을 시험한다.
- 필요한 테스트: protocol-v12.test.mjs: successor 학습 집합 불일치 거부 / self-test: excluded 변조 76, FINAL 프롬프트 클린룸

## 공동 편집 제안

### TL-EDIT-CLEANROOM-SCAN — COMMENT

- 대상: `scripts/fable-review.mjs`
- 위치: function assertLearningCleanRoom(task, collaborationRaw) {
- 연결 Finding: TL-CLEANROOM-SCAN-INCOMPLETE, TL-APPEND-CLEANROOM-LATE-FAIL
- 이유: TL-CLEANROOM-SCAN-INCOMPLETE와 TL-APPEND-CLEANROOM-LATE-FAIL을 한 곳에서 해결한다.

    클린룸 검사를 (1) FINAL_INDEPENDENT의 task.independent_request·requirements·human_decisions·required_evidence 문자열, (2) 최초 SECURITY collaboration.md의 모든 턴 구간으로 확장하고, LEARNING_SUMMARY_MARKER_RE에 `\bLRN-[A-Z0-9][A-Z0-9_-]{2,63}\b`를 추가한다. 같은 함수를 fable:append 경로(4030행 인근)에서도 후보 장부에 대해 호출한다.

### TL-EDIT-ROLE-CONTEXTS-REGISTRY-RULE — ADD

- 대상: `docs/team/ROLE_CONTEXTS.md`
- 위치: - 상호 충돌 ID를 함께 적용하지 않는다.
- 연결 Finding: TL-REGISTRY-SAME-COMMIT-TRUST, TL-EXPIRY-COMMITTER-DATE-ONLY
- 이유: 실행기 강제 규칙을 역할 계약 문서에 함께 명시해 문서·코드를 일치시킨다.

    - baseline과 target 사이에 `docs/team/TEAM_LEARNING.md`가 바뀐 Task는 그 파일을 `artifact_paths`에 포함해 같은 회차에서 검수받아야 하며, 같은 commit에서 바뀐 항목은 그 Task에 적용할 수 없다. manifest는 주입에 사용한 장부 blob 해시를 봉인한다.
    - 만료 판정은 target commit 날짜와 실행일 중 늦은 날짜를 기준으로 한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: TL-REGISTRY-SAME-COMMIT-TRUST, TL-CLEANROOM-SCAN-INCOMPLETE, TL-APPEND-CLEANROOM-LATE-FAIL, TL-EXPIRY-COMMITTER-DATE-ONLY

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
