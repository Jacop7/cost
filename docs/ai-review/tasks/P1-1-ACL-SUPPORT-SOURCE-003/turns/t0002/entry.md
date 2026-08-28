
## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P1-1-SUPPORT-003-EVIDENCE-VERBATIM-BINDING`
- 해시 대조: V1 기록 `0596e56a…ee21`은 `git show d0051c17:packages/db/scripts/admin-acl-audit.test.mjs` SHA-256과 일치한다. V2 기록 `380afade…a6575`는 `git show 474d087f:packages/db/scripts/admin-acl-audit.test.mjs` SHA-256과 일치한다.
- 문자열 대조: 증거 문서의 metric 누락은 현재 시험의 `누락 metric: rls_disabled_app_tables`, 중복은 `중복 metric: probe_owner`와 글자 그대로 연결된다. 신규 네 행도 당시 캡처한 장부·요소 접근·별칭·빈 부채 stderr 원문을 기록했다.
- 코드 재실행 필요성: 이번 변경은 실행된 코드가 아니라 증거 문서의 판본·문자열 결속만 고쳤다. 직전 `corepack pnpm verify` 6/6 exit 0과 fresh DB 0개는 V2 판본에 연결돼 있다.
- next_review_request: `FABLE_RECHECK`
