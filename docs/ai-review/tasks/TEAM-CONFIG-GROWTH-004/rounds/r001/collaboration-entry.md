
<!-- fable-review:r001 sha256=393ad0d2a11f0d1483c41ccc6b007fa1557a9943631b6b73f95b5916b6ab576b -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `393ad0d2a11f0d1483c41ccc6b007fa1557a9943631b6b73f95b5916b6ab576b`
- target_commit_sha: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`
- input_files_sha256: `dc03156ac6f5485abb297518bd339a5ca4fbb4b41f9e9030860997d55807289a`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: TCG4-ARCH-001, TCG4-ARCH-002, TCG4-ARCH-003, TCG4-ARCH-004
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

세 공식 문서(팀구성_상세기획안·ai-review/README·작업큐)와 AGENTS.md, schema-v1.json, runner 원본을 대조했다. 소진 사유 allowlist(MODEL_BUDGET_EXHAUSTED/RATE_LIMITED/CAPACITY_UNAVAILABLE)와 runner 회차 상한 budget_exhausted·인증·hash·계약 오류의 비승계 경계, RUN_FAILED+NOT_FALLBACK_ELIGIBLE/FALLBACK_UNAVAILABLE/TASK_CAP_APPROVAL_REQUIRED 구조화 사유, verdict BLOCKED 비합성, 원 reviewer_role 유지·verified_by_engine·SEC/FINAL 표본 재감사, FINAL_INDEPENDENT 클린룸(runner 2274-2276이 FINAL 경로에 장부를 전송하지 않음과 일치), AI_DEPUTY_FALLBACK_HANDOFF의 protocol 1.1 거부(runner 2975 heading 정규식에 없음), AI-REVIEW-2→TEAM-LEARNING-1 의존 순서, FABLE-FINAL 전 회차·FABLE-SEC r001 학습 주입 금지, 회차당 $2.00 상한(runner DEFAULT_MAX_BUDGET_USD)까지 세 문서와 현재 구현이 일치함을 확인했다. 앞선 16건 Finding은 predecessor_review가 null이라 개별 ID로는 대조하지 못했고 패킷 요구사항 11개 기준으로만 검토했다. 남은 문제는 (1) CLOSED 전환을 "decision commit 보호 체크 성공 뒤 최초 발견 역할의 재검수"로 정의했지만 FINAL 외 route에는 다른 commit으로 registry를 잇는 successor 계약이 없고(README §6은 FINAL_INDEPENDENT 전용, §8 소진 승계는 동일 target 전용, WORKING은 HEAD==target 강제) P0-2 완료 조건도 이를 소유하지 않아 CLOSED 경로가 실행 불가능한 정책으로 남는 점(Major), (2) README §4 루프 도식이 CLOSED를 AI 부 O 종결 결정·게이트 검증보다 앞에 두어 §9·기획안 §4.4 순서와 어긋나는 점(Minor), (3) MANDATORY_MUTUAL·CONDITIONAL 소진 successor의 task.review_mode 값이 미규정인 점(Minor), (4) TEAM-LEARNING-1의 CANDIDATE/RETIRED 거부와 AI-REVIEW-2의 미재감사 SEC/FINAL Opus 결과 게이트 사용 차단에 사보타주 시험이 없는 점(Minor)이다. 판정은 CHANGES_REQUIRED이며 gate_state는 OPEN을 유지한다.

### 공동 편집 제안 색인

- TCG4-EDIT-001: ADD `docs/작업큐.md` · - `--no-db` 결과를 전체 6단계 통과로 표시하지 않는다. · 원문은 review.md 참조
- TCG4-EDIT-002: REPLACE `docs/ai-review/README.md` · ↺ 필수 Finding이 `VERIFIED` 또는 P0-2 구축 뒤 `CLOSED`가 될 때까지 반복 · 원문은 review.md 참조
- TCG4-EDIT-003: COMMENT `docs/ai-review/README.md` · 여기서 `INITIAL`·`RECHECK`는 inherited registry 유무에 따른 승계 의미다. `FABLE-SEC`· · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
