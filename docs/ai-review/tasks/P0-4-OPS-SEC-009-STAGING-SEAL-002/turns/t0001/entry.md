
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `379dd6cb0ce09814cfdb2671205e22ce1d965fd1`
- finding_ids: 없음 — 공식 predecessor가 없는 새 보안 검수이며 새 문제만 보고한다.
- 실행 명령: 정확한 코드 commit `ecdcd33f539e3172b6e0a593f63f38bead2b5020` 분리 checkout에서 `corepack pnpm install --frozen-lockfile --config.confirmModulesPurge=false`와 `corepack pnpm verify`; 개발 DB에서 시험 36 baseline과 한 함수 `RESET search_path`·두 함수 `RESET search_path`·`SECURITY INVOKER`·잘못된 `search_path` 네 사보타주; `corepack pnpm fable:check`.
- 종료 코드·결과: exact code commit verify 6/6 exit 0, DB 36/36, core 178, mobile 212, CLI·ACL 보안, 새 DB·2세션 경합·locale parity, 업그레이드 13/13, 웹 번들 통과. 네 사보타주는 모두 새 단언에서 FAIL로 적중했고 복구 뒤 baseline이 다시 통과했다.
- 함수 카탈로그 실측: `ops_health_status()`와 `report_client_rpc_error(text,text,text)` 모두 `prosecdef=t`, `proconfig={"search_path=pg_catalog, public, ops"}`다.
- NULL 구멍 보강: `bool_and(p.proconfig @> ...)`는 한 함수의 `proconfig=NULL`을 건너뛰므로 `bool_and(coalesce(p.proconfig, '{}'::text[]) @> ...)`로 보강했다.
- target 경계: target은 exact code commit 뒤 검증 실패 run·candidate 원본만 append-only로 추가했다. 후보는 공식 review·Finding·후속 입력으로 승격하지 않았고 제품 코드 diff는 0개다.
- 장부 상태: migration 파일·개발 DB 장부 166/166, 최신 0177, `fresh_%` 0개.
- remote_state: staging과 production은 접근·적용하지 않았다.
- next_review_request: `FABLE_REVIEW`
