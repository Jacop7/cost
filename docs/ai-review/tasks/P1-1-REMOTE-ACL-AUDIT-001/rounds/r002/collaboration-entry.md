
<!-- fable-review:r002 sha256=02f3fae5cf8ab275e2c3e0fc5f97ef25a229b25b4b9cd9897ee1071e7e286d57 -->
## FABLE_REVIEW · turn-f002 · r002

- role: `FABLE-SEC`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `02f3fae5cf8ab275e2c3e0fc5f97ef25a229b25b4b9cd9897ee1071e7e286d57`
- target_commit_sha: `d5aeafd7098836c73e29c362386b8250f8476431`
- input_files_sha256: `275d782e0235b870185936a167d521bfcc259e0049992779ed3355122906487e`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN, P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP, P1-1-SEC-AUDIT-SIGNATURE-SEARCH-PATH, P1-1-SEC-AUDIT-TEST-GAP-ALLOWLIST-REALDB, P1-1-SEC-DOC-AUDIT-MODE-STALE
- 선택 미종결 Finding: P1-1-SEC-AUDIT-SQLPATH-SSL-HARDENING
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P1-1 원격 ACL 읽기 전용 audit 도구(FABLE-SEC 초기 검수). 잘된 점: (1) 비밀번호 격리 — `-p` 부트스트랩, `scrub_env` 후 exec, argv 무비밀번호, PGPASSFILE 계약은 설계·시험(①~④) 모두 건전하다. (2) 앱 소스 대조 — 10개 evidence 훅의 `supabase.rpc` 이름 61개 전부가 allowlist에 있고, 내부 몸통 11개 목록은 tests/16 254~271행과 이름 단위로 일치한다. (3) 87개 미승인 함수와 플랫폼 기본 권한 예외를 문서(README·브랜치 §4.5·서버-확장 서문)가 배포 차단·P0-5 연결로 서로 다른 상태로 기록한다. 변경 필요: [Major] audit 게이트가 metric 행이 비거나 일부만 오면 `failed`가 비어 exit 0으로 '애플리케이션 ACL이 닫혀 있습니다'를 출력한다(필수 metric 존재·중복 검사 없음, 시험도 없음). [Major] RLS 비활성 public 표와 원장 표(inventory_events 등)의 앱 롤 직접 쓰기 경로(GRANT+정책)를 측정하지 않아 AGENTS 서버 계산 권위·원장 쓰기 경로 불변식에 대해 거짓 초록이 가능하다. [Minor] `regprocedure::text` 비교가 세션 search_path에 의존하고 procedure(prokind 'p')를 제외한다. [Minor] allowlist↔앱 소스 자동 대조와 admin-acl-audit.sql의 실제 DB 실행 시험이 없으며 `create_store` 호출처가 패킷에 없다. [Minor] AGENTS.md 138~139행과 README 27행이 audit 모드 부재/미언급으로 구현과 어긋난다(AGENTS.md는 별도 작업 요청). 원격 실측 미수행은 사람 결정대로 상태 분리 기록이 돼 있어 문제 삼지 않는다. 원격 게이트 자체는 미해결 상태로 유지한다.

### 공동 편집 제안 색인

- E1-SH-SEEN-INIT: REPLACE `packages/db/scripts/admin-acl.sh` ·   failed="" · 원문은 review.md 참조
- E2-SH-SEEN-TRACK: REPLACE `packages/db/scripts/admin-acl.sh` ·     echo "admin-acl: audit $metric=$value ($expected)" · 원문은 review.md 참조
- E3-SH-REQUIRED-METRICS: ADD `packages/db/scripts/admin-acl.sh` ·   done <<< "$AUDIT" · 원문은 review.md 참조
- E4-SH-NEW-METRIC-CASE: REPLACE `packages/db/scripts/admin-acl.sh` ·       probe_dangerous|public_dangerous|protected_writes|source_schema_grants|supabase_admin_objects|anon_rpc|blocked_internal_rpc|facade_rpc_missing|unapproved_authenticated_rpc) · 원문은 review.md 참조
- E5-SQL-SEARCH-PATH: ADD `packages/db/scripts/admin-acl-audit.sql` · begin; · 원문은 review.md 참조
- E6-SQL-RLS-LEDGER-METRICS: ADD `packages/db/scripts/admin-acl-audit.sql` ·    and has_table_privilege(role_name, 'public.' || name, privilege_name); · 원문은 review.md 참조
- E7-TEST-SHIM-ROWS: ADD `packages/db/scripts/admin-acl.test.sh` · facade_rpc_missing|0|expected=0 · 원문은 review.md 참조
- E8-TEST-SHIM-CASES: ADD `packages/db/scripts/admin-acl.test.sh` ·   audit_rpc_open) rpc_open=1 ;; · 원문은 review.md 참조
- E9-TEST-FAIL-CLOSED-CASES: ADD `packages/db/scripts/admin-acl.test.sh` ·   && ok "허용 목록 밖 RPC 한 건이면 실패" || bad "미승인 RPC를 통과시킴(exit $rc)" · 원문은 review.md 참조
- E10-README-STRUCTURE-LINE: REPLACE `packages/db/README.md` ·   admin-acl.sh            로컬/원격 supabase_admin 기본 ACL fix·check · 원문은 review.md 참조
- E11-SQL-CREATE-STORE-NOTE: COMMENT `packages/db/scripts/admin-acl-audit.sql` · -- 이 파일은 admin-acl.sh --remote audit와 실제 DB 회귀검사가 함께 사용한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->
