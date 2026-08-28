
<!-- fable-review:r001 sha256=476c7e535636dd43a2d065a2fa5b130a12be5cd611936c8e6d7d7170976f58bc -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `476c7e535636dd43a2d065a2fa5b130a12be5cd611936c8e6d7d7170976f58bc`
- target_commit_sha: `e799f42676aa607b9f7a6ce1f3739bed99fe9b5e`
- input_files_sha256: `d59cbc4d7ce39a7203924ca279a9cbc850b1b0ff204511b191d48534389b27c0`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TL-REGISTRY-SAME-COMMIT-TRUST, TL-CLEANROOM-SCAN-INCOMPLETE, TL-APPEND-CLEANROOM-LATE-FAIL, TL-EXPIRY-COMMITTER-DATE-ONLY
- 선택 미종결 Finding: TL-SUCCESSOR-AND-TEST-GAPS
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

TEAM-LEARNING-1 기계 계약의 핵심은 잘 잡혀 있다. 장부 파싱(정확한 키 집합·양방향 충돌·반대 레인 검증자·VERIFIED 증거 필수), Task 필드 동시 선언·중복·겹침 거부, CANDIDATE·RETIRED·만료·미등록·충돌 ID 실패 폐쇄, result schema const와 manifest 봉인, protocol 1.1 및 장부 없는 commit의 1.2 Task 보존, 일반 검수 최소 체크리스트 주입과 SECURITY 경로의 ID-only 처리는 코드와 자체시험이 일치한다. 실제 target commit의 장부를 읽은 이번 실행에서도 applied/excluded ID가 정확히 echo됐다.

그러나 집중 검토 질문에 대한 답으로 두 가지 Major를 낸다. (1) 장부는 저자가 통제하는 target commit에서 읽히는데, baseline↔target 사이의 장부 변경이 검수 입력에 포함되도록 강제하지 않고 manifest도 장부 blob 해시를 봉인하지 않는다. 같은 commit에서 CANDIDATE를 VERIFIED로 올리고 곧바로 적용해도 검수자는 이를 볼 수 없다. (2) 클린룸 검사가 collaboration.md의 SOLAR_REQUEST 구간만 훑는다. FINAL_INDEPENDENT 프롬프트에 실제로 들어가는 independent_request(8000자)는 전혀 검사하지 않고, 최초 SECURITY 프롬프트에 통째로 들어가는 CODEX_EVIDENCE·HUMAN_DECISION 등 다른 턴도 검사하지 않으며, 표식 정규식은 `LRN-…` ID 자체를 잡지 못한다. 그 밖에 append 시점 미검사로 인한 append-only 장부의 영구 실패, 만료 판정이 조작 가능한 committer date에만 의존하는 점, 시험 공백을 Minor·Improvement로 기록한다. 문서(README·ROLE_CONTEXTS·기획안·작업큐)는 구현과 일관된다.

### 공동 편집 제안 색인

- TL-EDIT-CLEANROOM-SCAN: COMMENT `scripts/fable-review.mjs` · function assertLearningCleanRoom(task, collaborationRaw) { · 원문은 review.md 참조
- TL-EDIT-ROLE-CONTEXTS-REGISTRY-RULE: ADD `docs/team/ROLE_CONTEXTS.md` · - 상호 충돌 ID를 함께 적용하지 않는다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
