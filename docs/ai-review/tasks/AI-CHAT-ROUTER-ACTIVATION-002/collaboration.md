# AI-CHAT-ROUTER-ACTIVATION-002 공동 작업 장부

> 이 장부의 비-Fable 턴은 `pnpm fable:append`로만 추가한다. Fable은 지정된 봉인 snapshot을
> 읽기 전용으로 검수하며 제품·정책 파일을 직접 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `.codex/team-router/activation-decision.json`, `.codex/team-router/activation-receipt.json`, `.codex/team-router/policy.json`, `docs/team/DECISIONS.md`, `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`, `scripts/fable-review.mjs`, `docs/ai-review/README.md`
- 충족해야 할 요구사항·불변식: exact approval·policy·design·model plan·artifact·review SHA 결속, exact edge, source generation, SENT_UNCONFIRMED/DELIVERED 분리, runtime ACL, non-production-only
- 이번에 바꾼 내용: active Decision/receipt, initial endpoint binding, prepare-dispatch, delivery receipt, sabotage tests, Claude Code 2.1.259 검증 allowlist를 추가했다.
- 집중 검토 질문: 변조를 충분히 차단하는가, raw endpoint가 새는가, app acceptance를 delivery로 과장하는가, DB·Supabase·git·staging·production 권한이 열리는가?
- 실행한 테스트·현재 증거: Router 34/34, Fable wrapper 52 bundles, active policy VALID, 11 chats·21 edges VALID, protected ACL, endpoint 11개 generation 1.
- 사람 결정이 필요한 항목: 없음. exact activation과 USD 4.00 soft cap 위험 수용 완료.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자는 정확히 `실제 자동 라우팅 활성화를 승인합니다`라고 승인했다.
- 허용 범위·기한: 승인된 11개 채팅의 allowlist 비운영 메시지 운반과 Fable 읽기 전용 검수 1회.
- 금지: human relay, 자동 새 작업 생성, 제품·DB·Supabase·git·staging·production·비밀·배포 mutation과 사람 게이트 대체.
- 승인자·시각: `HUMAN-CHIEF · 2026-09-04T07:02:35+09:00`
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- verified_input_files_sha256: `WORKING_TREE_HASHED snapshot에서 runner가 계산·봉인`
- artifact_hashes: `activation-receipt.json 및 구현 증거 001의 exact SHA 표`
- finding_ids: `[]`
- 실행 명령: Router unittest; Fable wrapper self-test; validate-policy; validate-manifests; Windows Get-Acl
- 종료 코드·결과: 34/34, 52 bundles, ACTIVE_DISPATCH/humanRelay false, 11 chats·21 edges, ACL protected, 11 endpoints generation 1.
- 미실행 항목과 이유: 첫 실제 비운영 dispatch는 이 검수의 필수 OPEN Finding 0 확인 전이라 미실행.
- next_review_request: `FABLE_REVIEW`
