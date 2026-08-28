
## CODEX_EVIDENCE · turn-c002 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS`, `P1-1-SUPPORT-002-RPC-SCAN-EVASION`, `P1-1-SUPPORT-002-DEBT-VALUE-PARSING`
- 사보타주: fresh DB에 빈 `supabase_migrations.schema_migrations`를 만들면 `관측=0 장부=present 기대=2`로 exit 1. 임시 `client['rpc'](...)`와 `const callRpc=client.rpc`는 각각 파일·줄로 exit 1. `ledger_write_paths` 빈 값은 `정수가 아닙니다`로 exit 1.
- 복구: fresh DB 기준 16 metric·모바일 RPC 61·비-mobile 예외 1 통과. audit SQL SHA-256 `c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4`, 프로브 없음, fresh DB 0개.
- 최종 전체 검증: `corepack pnpm verify` exit 0. 타입, DB 32/32·core 177(2 skip)·mobile 189, ACL 보안, 새 DB+감사+경합+parity, 업그레이드 8/8, 웹 번들 6단계 전부 통과.
- next_review_request: `FABLE_RECHECK`
