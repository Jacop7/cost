
## CODEX_EVIDENCE · turn-c002 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `d5aeafd7098836c73e29c362386b8250f8476431`
- verified_artifact_hashes: `admin-acl.sh=d7f7e1f9bf3eb6d4ebb2279585402cd47343b78bcec228b0edf09e07ddd460e2`, `admin-acl.test.sh=84984e5fa8e022e9e0a263a9ba7ecb6cb463fe7f494298c960999042da6aabfc`, `admin-acl-audit.sql=c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4`, `README=f46e95c8fee6a2d38821407c478634187bc0fbd3e176fd0506d464300072c8cd`, `branch-plan=3dfe4f9a48ba0d75c25e0cd53545b47508a85eeab792bf7ef6c3b90fb633b21f`, `server-plan=bd797cc7be58c140301ce06a2d86340ee7fa9234545cb7ad33ca60eaa4444030`
- finding_ids: `P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN`, `P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP`, `P1-1-SEC-AUDIT-SIGNATURE-SEARCH-PATH`, `P1-1-SEC-AUDIT-TEST-GAP-ALLOWLIST-REALDB`, `P1-1-SEC-DOC-AUDIT-MODE-STALE`, `P1-1-SEC-AUDIT-SQLPATH-SSL-HARDENING`
- 실행 명령: `bash packages/db/scripts/admin-acl.test.sh`; `node packages/db/scripts/admin-acl-audit.test.mjs postgres`; `corepack pnpm verify --no-db --no-bundle`; `corepack pnpm verify`; `git diff --check`; fresh DB 잔여 조회
- 종료 코드·결과: 최종 명령 모두 0. 실제 개발 DB 감사 계약은 metric 16개·모바일 RPC 61개·비-mobile 예외 1개, 관측값 `rls_disabled_app_tables=0`, `ledger_write_paths=32`, `unapproved_authenticated_rpc=87`. 전체 verify는 ① 타입 ② DB 32/32·core 177(2 skip)·mobile 189 ③ ACL 셸 보안 ④ 새 DB 32/32+실제 audit+2세션 경합+locale parity ⑤ 업그레이드 8/8 ⑥ 웹 번들 모두 통과. 종료 뒤 `fresh_*` DB 0개.
- 실패 보존·전진 수정: 첫 전체 verify는 새 DB 하네스에 `supabase_migrations.schema_migrations`가 없어 audit SQL이 중단되며 실패했다. migration metric만 0으로 출력하고 나머지 모든 보안 metric을 계속 측정하도록 전진 수정했다. 셸 게이트는 migration 0을 실패시키므로 거짓 초록이 아니며, 수정 뒤 두 번째 전체 verify 6/6을 끝까지 통과했다.
- 실패 폐쇄 증거: 필수 metric 누락·빈 값·중복, RLS 비활성 1건, 원장 직접 쓰기 1건, 미승인 RPC 1건을 각각 주입하면 셸 회귀시험이 실패한다. 실제 DB 검사는 호출자 search_path가 `pg_catalog`이어도 16개 유일 metric을 받고 rollback 뒤 probe가 없다. AST 대조는 앱 RPC가 SQL 허용 목록에서 빠지거나 반대 방향 잉여가 생기면 실패한다.
- 비밀정보·변경 범위: 원격 자격증명 입력은 사용하지 않았다. `.claude/settings.json`, 미추적 채팅 정리 문서, 병행 Opus/TEAM_LEARNING 문서 hunk는 변경·스테이징·검증 근거에 포함하지 않았다.
- 미실행 항목과 이유: 접근 가능한 호스티드 Supabase 자격이 없어 원격 `audit`는 미실행. 32개 원장 직접 쓰기 경로와 87개 미승인 인증 RPC 축소는 별도 P0-5 R3 사람 승인 대상이므로 이 audit-only 변경에서 권한을 수정하지 않았다.
- next_review_request: `FABLE_RECHECK`
