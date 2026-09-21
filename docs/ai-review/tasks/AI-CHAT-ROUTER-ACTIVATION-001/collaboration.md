# AI-CHAT-ROUTER-ACTIVATION-001 공동 작업 장부

> 이 장부의 비-Fable 턴은 `pnpm fable:append`로만 추가한다. Fable은 지정된 봉인 snapshot을
> 읽기 전용으로 검수하며 제품·정책 파일을 직접 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `.codex/team-router/activation-decision.json`, `.codex/team-router/activation-receipt.json`, `.codex/team-router/policy.json`, `docs/team/DECISIONS.md`, `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md`, `scripts/fable-review.mjs`, `docs/ai-review/README.md`
- 충족해야 할 요구사항·불변식: exact human approval·policy·design·model plan·artifact·review SHA 결속, 11개 exact edge, source endpoint generation 검증, SENT_UNCONFIRMED와 DELIVERED 분리, runtime ACL, non-production-only 경계
- 이번에 바꾼 내용: active dispatch를 별도 Decision과 receipt에 봉인하고, 초기 endpoint binding·prepare-dispatch·delivery receipt CLI 및 sabotage test를 추가했다. Claude Code 2.1.259의 기존 격리 인자 호환을 확인하고 runner allowlist와 문서를 갱신했다.
- 집중 검토 질문: 활성화 receipt가 현재 bytes 변조를 충분히 차단하는가, 원시 endpoint가 공식 산출물에 새는가, 앱 도구 acceptance를 delivery로 과장하는가, 이 Decision이 DB·Supabase·git·staging·production 권한을 잘못 여는가?
- 실행한 테스트·현재 증거: Team Router 34/34 PASS; Fable wrapper self-test 52 bundles PASS; active policy VALID; 11 chats·21 edges VALID; runtime ACL inheritance protected and only current user/SYSTEM FullControl; 11 initial endpoints generation 1 bound.
- 사람 결정이 필요한 항목: 없음. 정확한 활성화 승인문과 USD 4.00 단일-pass soft cap 위험 수용이 이미 기록됐다.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자는 정확히 `실제 자동 라우팅 활성화를 승인합니다`라고 승인했다.
- 허용 범위·기한: 11개 승인 채팅의 allowlist 비운영 메시지 운반과 이 활성화 delta의 Fable 읽기 전용 독립검수 1회.
- 금지: human relay, 자동 새 작업 생성, 제품·DB·Supabase·git·staging·production·비밀·배포 mutation, 사람 운영 게이트 대체.
- 승인자·시각: `HUMAN-CHIEF · 2026-09-04T07:02:35+09:00`
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- verified_input_files_sha256: `WORKING_TREE_HASHED task snapshot에서 runner가 계산·봉인`
- artifact_hashes: `활성화 구현 증거 001의 exact SHA 표와 activation-receipt.json에 결속`
- finding_ids: `[]`
- 실행 명령: `python -m unittest discover` Team Router; `corepack pnpm fable:review -- --self-test`; Team Router `validate-policy`; `validate-manifests`; Windows `Get-Acl`
- 종료 코드·결과: Router 34/34 PASS, wrapper 52 bundles PASS, ACTIVE_DISPATCH policy valid with humanRelay false, 11 chats·21 edges valid, ACL protected, 11 endpoints generation 1 bound.
- 미실행 항목과 이유: 첫 실제 비운영 dispatch는 이 Fable 회차에 필수 OPEN Finding이 없음을 확인하기 전이라 의도적으로 미실행했다.
- next_review_request: `FABLE_REVIEW`
