
## SOLAR_RESPONSE · turn-s002 · r002

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f002`
- reply_to_review_sha256: `02f3fae5cf8ab275e2c3e0fc5f97ef25a229b25b4b9cd9897ee1071e7e286d57`
- target_commit_sha: `d5aeafd7098836c73e29c362386b8250f8476431`
- changed_artifact_paths: `packages/db/scripts/admin-acl.sh`, `packages/db/scripts/admin-acl.test.sh`, `packages/db/scripts/admin-acl-audit.sql`, `packages/db/README.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`
- artifact_hashes: `[{ path: packages/db/scripts/admin-acl.sh, sha256: d7f7e1f9bf3eb6d4ebb2279585402cd47343b78bcec228b0edf09e07ddd460e2, change_type: MODIFIED }, { path: packages/db/scripts/admin-acl.test.sh, sha256: 84984e5fa8e022e9e0a263a9ba7ecb6cb463fe7f494298c960999042da6aabfc, change_type: MODIFIED }, { path: packages/db/scripts/admin-acl-audit.sql, sha256: c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4, change_type: ADDED }, { path: packages/db/README.md, sha256: f46e95c8fee6a2d38821407c478634187bc0fbd3e176fd0506d464300072c8cd, change_type: MODIFIED }, { path: docs/브랜치-DB-운영-기획안.md, sha256: 3dfe4f9a48ba0d75c25e0cd53545b47508a85eeab792bf7ef6c3b90fb633b21f, change_type: MODIFIED }, { path: docs/서버-확장-아키텍처-기획안.md, sha256: bd797cc7be58c140301ce06a2d86340ee7fa9234545cb7ad33ca60eaa4444030, change_type: MODIFIED }]`

### P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN

- disposition: `APPLIED`
- 적용 위치: `admin-acl.sh`, `admin-acl.test.sh`
- 적용 내용: 16개 필수 metric의 존재·비어 있지 않은 값·정확히 한 번 출현을 검사한다. 누락·빈 값·중복은 모두 실패하며 성공 문구도 측정 범위로 한정했다.
- 실행한 테스트: 누락·빈 값·중복 metric 셸 사보타주가 각각 비정상 종료하고 정상 16개 입력만 통과한다.
- 필요한 재검수: 부분 출력이나 중복 행이 더는 거짓 초록을 만들 수 없는지 확인.

### P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP

- disposition: `APPLIED`
- 적용 위치: `admin-acl-audit.sql`, 운영 문서 3종
- 적용 내용: 앱 소유 public 표 중 RLS 비활성 수와 권위 원장 10개 표의 anon/authenticated 직접 쓰기 경로를 별도 metric으로 측정한다. 개발 DB 실측은 `rls_disabled_app_tables=0`, `ledger_write_paths=32`이며 32건은 숨기지 않고 별도 R3 `P0-5` 축소 작업과 배포 차단으로 연결했다.
- 반박 또는 부분 적용 근거: 이번 audit-only 범위는 권한 자체를 변경하지 않는다. 32건 축소는 사람 승인 대상 R3 migration이다.
- 필요한 재검수: 탐지 범위와 실패 폐쇄, 문서의 미종결 보안 부채 표기가 일치하는지 확인.

### P1-1-SEC-AUDIT-SIGNATURE-SEARCH-PATH

- disposition: `APPLIED`
- 적용 위치: `admin-acl-audit.sql`
- 적용 내용: 트랜잭션 첫 줄에 `search_path=pg_catalog,public`을 고정하고 routine 검사를 function과 procedure 모두로 확장했다.
- 실행한 테스트: 호출자 search_path를 `pg_catalog`로 둔 실제 DB 회귀검사가 16개 metric과 facade 시그니처 대조를 통과한다.
- 필요한 재검수: regprocedure 및 prokind 판정이 호출자 세션 설정에 기대지 않는지 확인.

### P1-1-SEC-AUDIT-TEST-GAP-ALLOWLIST-REALDB

- disposition: `APPLIED`
- 적용 위치: `packages/db/scripts/admin-acl-audit.test.mjs`, `scripts/verify.mjs` ④ 단계, `admin-acl.test.sh`
- 적용 내용: 실제 DB에서 audit SQL을 실행해 16개 metric·rollback probe 부재를 검사하고, TypeScript AST로 모바일 `.rpc()` 61개와 SQL facade 허용 목록을 양방향 대조한다. 비-mobile 예외는 `create_store(text,text)` 한 건과 소비자 `onboarding`을 SQL에 명시했다.
- 실행한 테스트: 개발 DB와 새 DB verify ④에서 실제 회귀검사 통과; 모바일 RPC 61개·비-mobile 예외 1개; 호출자 search_path `pg_catalog` 조건 포함.
- 필요한 재검수: 신규 지원 시험은 후속 commit 독립 감사에서 소스까지 봉인한다. 이 회차에서는 실행 증거와 artifact의 explicit exception/metric 계약을 재검수한다.

### P1-1-SEC-DOC-AUDIT-MODE-STALE

- disposition: `APPLIED`
- 적용 위치: `packages/db/README.md`, `AGENTS.md` ACL 절, 두 운영 기획안, `docs/작업큐.md`
- 적용 내용: audit 구현 완료와 호스티드 미실행을 구분하고 실측 0/32/87, P0-5 연결, SSL `verify-full` 권장을 동기화했다.
- 반박 또는 부분 적용 근거: AGENTS와 작업큐에는 병행 팀 구성안 변경이 있어 ACL hunk만 P1-1 커밋에 선택적으로 포함한다.
- 필요한 재검수: 공식 artifact 문서의 상태 구분과 패키지 README 명령이 실제 도구와 일치하는지 확인.

### P1-1-SEC-AUDIT-SQLPATH-SSL-HARDENING

- disposition: `APPLIED`
- 적용 위치: `admin-acl.sh`, `packages/db/README.md`
- 적용 내용: slashless 경로에서도 자식 프로세스 없이 paired SQL을 찾고, 실패 시 기대 경로를 출력한다. 원격 운영은 `verify-full`과 신뢰 CA 파일 사용을 권장한다.
- 필요한 재검수: 경로 실패가 무진단 종료되지 않고 비밀번호 격리 계약을 해치지 않는지 확인.

- 사람 결정 유지: 실제 호스티드 audit는 접근 가능한 자격이 없어 미실행이다. `ledger_write_paths=32`, `unapproved_authenticated_rpc=87` 축소는 별도 P0-5 R3 승인 전에는 변경하지 않는다.
- next_review_request: `CODEX_EVIDENCE`
