
<!-- fable-review:r001 sha256=829d90fbb9e9f391c218eb6c71fdde4cbc3c2e12a6d93d44c764d2d79868bf0d -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `829d90fbb9e9f391c218eb6c71fdde4cbc3c2e12a6d93d44c764d2d79868bf0d`
- target_commit_sha: `a4fd66c4e9452000f32ac5786769e777f7af624f`
- input_files_sha256: `093d62c4736ed457f246b006a1ffe4b7641d03645137d532a964a5571592c891`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TL-FIRST-SECURITY-PACKET-FIELDS-UNSCANNED
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

predecessor r001의 Finding 5건을 같은 finding_id로 재확인했다. 5건 모두 수용 기준이 target commit 코드와 자체시험에서 충족돼 VERIFIED로 기록한다.

(1) TL-REGISTRY-SAME-COMMIT-TRUST: loadLearningContext가 baseline↔target 장부 blob을 비교해 변경 시 artifact/reference 선언을 강제하고(미선언 65), 최초 도입은 artifact 포함을 요구하며, 적용 ID의 항목이 같은 Task에서 바뀌면 거부한다. manifest는 learning_registry_blob_oid·sha256·assignment_sha256·target_date를 봉인하고 staging 비교(4678행)가 STALE 75로 대조한다. 자체시험(6077~6140행)이 숨김 장부·CANDIDATE→VERIFIED 승격·manifest 해시 변조를 모두 부정 시험한다.
(2) TL-CLEANROOM-SCAN-INCOMPLETE: 표식 정규식에 LRN- ID 패턴이 추가됐고, 최초 SECURITY는 collaboration.md 전체를, FINAL_INDEPENDENT는 independent_request·requirements·human_decisions·required_evidence까지 검사한다. SECURITY 후속 프롬프트의 trusted_task_packet과 metadata에서 excluded 사유 본문이 제거된다(자체시험 6172행).
(3) TL-APPEND-CLEANROOM-LATE-FAIL: append 경로가 normalizeManualTurn 직후, 어떤 파일도 쓰기 전에 assertLearningAppendCandidate로 후보 장부 전체를 검사하며, 거부 메시지가 턴 ID와 표식을 명시한다.
(4) TL-EXPIRY-COMMITTER-DATE-ONLY: 판정일은 commit 날짜와 실행 UTC 날짜 중 늦은 쪽이며 manifest learning_target_date에 봉인되고 README·ROLE_CONTEXTS에 명시됐다.
(5) TL-SUCCESSOR-AND-TEST-GAPS: fallback_review에 learning_assignment_sha256이 조건부 필수 키로 추가되고 predecessor와 적용·제외 집합 동일성과 hash를 모두 대조한다. excluded 순서 변조 76, FINAL 프롬프트 LRN- 부재 시험이 추가됐다. protocol 1.1과 장부 없는 commit의 1.2 Task는 null 반환·조건부 키로 호환이 유지된다(1-7).

새 Finding 1건(Minor)을 낸다. 요구 1-2는 "최초 SECURITY의 실제 전체 입력" 차단을 명시하지만, task 필드(requirements·human_decisions·required_evidence) 검사는 FINAL_INDEPENDENT에만 적용되고 최초 SECURITY 프롬프트의 trusted_task_packet에는 같은 필드가 검사 없이 통째로 들어간다. 한 줄 수준의 수정이며 proposed_edits에 제안했다. 아울러 작업큐·기획안의 완료 조건 문구가 여전히 SOLAR_REQUEST만 언급해 넓어진 계약보다 좁게 서술돼 있어 정렬 편집을 제안한다.

참고: 자체시험 묶음 50개(test 호출 수 정적 확인)와 protocol 1.2 계약 22/22, verify 6/6의 실제 실행 증거는 이번 패킷의 evidence_paths·공동 장부에 없다. VERIFIED는 코드·자체시험 정적 확인에 따른 로컬 판정이며, Codex 실행 증거와 게이트 종결은 별도로 남는다.

### 공동 편집 제안 색인

- TL-EDIT-FIRST-SECURITY-FIELD-SCAN: COMMENT `scripts/fable-review.mjs` ·       ['independent_request', [task.independent_request]], · 원문은 review.md 참조
- TL-EDIT-ROLE-CONTEXTS-CLEANROOM-SCOPE: REPLACE `docs/team/ROLE_CONTEXTS.md` ·   비어 있어야 한다. 최종 독립 감사의 요청·요구·사람 결정·필수 증거와 두 경로의 공동 장부 전체에도 · 원문은 review.md 참조
- TL-EDIT-WORKQUEUE-CLEANROOM-SCOPE: REPLACE `docs/작업큐.md` · - `SECURITY` route r001의 `SOLAR_REQUEST` 장부에 Learning ID·학습 요약이 있으면 실행기가 · 원문은 review.md 참조
- TL-EDIT-PLAN-CLEANROOM-SCOPE: REPLACE `docs/팀구성_상세기획안.md` · `SECURITY` Task의 두 필드 및 `SOLAR_REQUEST` 학습 표식을 비워 둔다. 보안 후속 Task에는 검증된 ID · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
