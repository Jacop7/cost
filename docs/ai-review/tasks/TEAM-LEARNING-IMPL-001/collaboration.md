# TEAM-LEARNING-IMPL-001 공동 작업 장부

> TEAM-LEARNING-1의 기계 계약과 역할별 컨텍스트 분리를 솔라와 페이블이 함께 검수하는 append-only
> 기록이다. 이후 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `e799f42676aa607b9f7a6ce1f3739bed99fe9b5e`
- changed_artifact_paths: `scripts/fable-review.mjs`, `docs/team/TEAM_LEARNING.md`, `docs/team/ROLE_CONTEXTS.md`, `docs/ai-review/README.md`, `docs/ai-review/templates/task-v12-primary.example.json`, `docs/ai-review/templates/task-v12-fallback.example.json`, `docs/팀구성_상세기획안.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: TEAM-LEARNING-1 1~7, protocol 1.1·기존 1.2 감사 원본 호환, append-only 장부, 독립 감사 클린룸
- 이번에 바꾼 내용: 증거 기반 TEAM_LEARNING 기계 장부와 역할별 컨텍스트 규칙을 만들고 protocol 1.2 Task·manifest·result에 applied/excluded learning ID를 봉인했다. 정상 검수에는 검증된 최소 체크리스트만, 보안 후속에는 ID만 전달하며 최초 보안과 독립 종합 감사는 빈 클린룸으로 고정했다.
- 집중 검토 질문: 장부 JSON이나 Task 필드를 조작해 CANDIDATE·RETIRED·만료·충돌 학습을 주입할 수 있는가? FINAL_INDEPENDENT 또는 최초 SECURITY가 학습 표식을 받을 수 있는가? 기존 protocol 1.1·1.2 기록이 깨지는가? result·manifest의 ID echo를 변조할 수 있는가?
- 실행한 테스트·현재 증거: `fable:self-test` 46개 묶음, protocol 1.2 계약 20/20, `corepack pnpm verify` 6/6. DB 32/32·core 177·mobile 189·업그레이드 8/8·웹 번들을 포함한다.
- 적용 학습: `LRN-ORCH-CI-001`의 exact-SHA CI 대기와 main fast-forward 순서를 이후 배포 단계에 적용한다.
- 사람 결정이 필요한 항목: 없음. 사용자가 남은 기획안 작업의 자동 진행을 승인했다.
- next_review_request: `FABLE_REVIEW`

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
