
## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED`, `P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED`, `P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION`
- 실제 DB 사보타주: fresh DB에서 `close_business_day(uuid)` 실행 권한을 authenticated에 열면 `blocked_internal_rpc=1`, 임의 public 함수를 anon에 열면 `anon_rpc=1`, 임의 함수를 authenticated에 열어 부채를 88로 늘리면 `unapproved_authenticated_rpc=88 ceiling=87`로 각각 exit 1. 모두 제거 뒤 기준선 16 metric·61 mobile RPC·1 exception 통과.
- AST 사보타주: `supabase.rpc(rpcName)` 임시 소스는 파일·줄과 함께 실패했고, 치환 없는 템플릿 리터럴은 정상 수집됐다. SQL에서 `rls_disabled_app_tables` metric 제거, metric 중복, rollback을 commit으로 교체하면 각각 누락·중복·잔존 probe로 실패했다.
- 허용 목록 사보타주: `business_day_state` 제거는 모바일 호출 누락으로, 앱에서 쓰지 않는 `assert_my_store` 추가는 미사용 허용 RPC로, 비-mobile 예외에 허용 목록 밖 이름 추가는 부분집합 위반으로 각각 exit 1 했다.
- 복구 검증: `admin-acl-audit.sql` SHA-256은 `c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4`, `_acl_probe_postgres` 없음, `fresh_*` DB 0개, `git diff --check` 통과.
- 최종 전체 검증: `corepack pnpm verify` exit 0. ① 타입 ② DB 32/32·core 177(2 skip)·mobile 189 ③ ACL 보안 ④ 새 DB 32/32+감사 값 단언+2세션 경합+locale parity ⑤ 업그레이드 8/8 ⑥ 웹 번들 전부 통과. 로그에는 `VERIFY_EXIT=0`이 기록됐다.
- 보안 관측값: `rls_disabled_app_tables=0`, `ledger_write_paths=32`, `unapproved_authenticated_rpc=87`. 이번 시험은 32/87 증가를 차단하며 축소는 허용한다.
- 비밀정보·제외: 원격 자격증명을 사용하지 않았다. `.claude/settings.json`과 미추적 채팅 정리 문서는 변경·스테이징·검증 근거에서 제외했다.
- next_review_request: `FABLE_RECHECK`
