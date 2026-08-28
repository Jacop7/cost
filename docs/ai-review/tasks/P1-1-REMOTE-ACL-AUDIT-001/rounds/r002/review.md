# P1-1-REMOTE-ACL-AUDIT-001 Fable 검수 — r002

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `d5aeafd7098836c73e29c362386b8250f8476431`

## 요약

P1-1 원격 ACL 읽기 전용 audit 도구(FABLE-SEC 초기 검수). 잘된 점: (1) 비밀번호 격리 — `-p` 부트스트랩, `scrub_env` 후 exec, argv 무비밀번호, PGPASSFILE 계약은 설계·시험(①~④) 모두 건전하다. (2) 앱 소스 대조 — 10개 evidence 훅의 `supabase.rpc` 이름 61개 전부가 allowlist에 있고, 내부 몸통 11개 목록은 tests/16 254~271행과 이름 단위로 일치한다. (3) 87개 미승인 함수와 플랫폼 기본 권한 예외를 문서(README·브랜치 §4.5·서버-확장 서문)가 배포 차단·P0-5 연결로 서로 다른 상태로 기록한다. 변경 필요: [Major] audit 게이트가 metric 행이 비거나 일부만 오면 `failed`가 비어 exit 0으로 '애플리케이션 ACL이 닫혀 있습니다'를 출력한다(필수 metric 존재·중복 검사 없음, 시험도 없음). [Major] RLS 비활성 public 표와 원장 표(inventory_events 등)의 앱 롤 직접 쓰기 경로(GRANT+정책)를 측정하지 않아 AGENTS 서버 계산 권위·원장 쓰기 경로 불변식에 대해 거짓 초록이 가능하다. [Minor] `regprocedure::text` 비교가 세션 search_path에 의존하고 procedure(prokind 'p')를 제외한다. [Minor] allowlist↔앱 소스 자동 대조와 admin-acl-audit.sql의 실제 DB 실행 시험이 없으며 `create_store` 호출처가 패킷에 없다. [Minor] AGENTS.md 138~139행과 README 27행이 audit 모드 부재/미언급으로 구현과 어긋난다(AGENTS.md는 별도 작업 요청). 원격 실측 미수행은 사람 결정대로 상태 분리 기록이 돼 있어 문제 삼지 않는다. 원격 게이트 자체는 미해결 상태로 유지한다.

## Findings

### P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN — Major / OPEN

- 범주: SECURITY
- 영향: 호스티드 배포의 대체 ACL 게이트가 SQL 파일 회귀·출력 손실만으로 통과한다. 87개 미승인 RPC 같은 배포 차단 사유가 metric 누락으로 조용히 사라질 수 있다.
- 근거: packages/db/scripts/admin-acl.sh:150, packages/db/scripts/admin-acl.test.sh:177, packages/db/scripts/admin-acl-audit.sql:41
- 완료 조건: audit 모드는 정확히 기대하는 metric 집합(현재 14개)이 각각 한 번씩 존재해야만 exit 0이며, 누락·중복·빈 출력은 exit 1과 사유(missing_metric=/duplicate_metric=)를 stderr에 낸다. / platform_default_open 행이 없으면 '알 수 없음'으로 성공하지 않고 실패한다. / 검사는 자격증명 환경에서 grep 등 자식 프로세스를 띄우지 않고 bash 내장만 사용한다.
- 필요한 테스트: admin-acl.test.sh ⑤에 metric 일부만 내는 shim 분기(audit_partial) 추가: exit 1과 missing_metric= 확인 / admin-acl.test.sh ⑤에 빈 출력 shim 분기 추가: exit 1 확인 / 같은 metric 두 행(하나 정상·하나 실패) 분기: exit 1 확인

### P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP — Major / OPEN

- 범주: SECURITY
- 영향: RLS가 꺼진 public 표(호스티드 Supabase 최빈 사고 유형)나 원장 표에 authenticated 쓰기 GRANT+허용 정책이 있어도 audit는 초록을 낸다. 원격 게이트가 서버 계산 권위·원장 쓰기 경로 불변식을 보증하지 못한다. 현재 개발 DB의 실제 상태는 migration이 스냅샷에 없어 확인하지 못했다.
- 근거: packages/db/scripts/admin-acl-audit.sql:53, packages/db/scripts/admin-acl.sh:174, AGENTS.md:34, packages/db/README.md:38, packages/db/tests/31_settings_lockdown.sql:159
- 완료 조건: audit SQL에 rls_disabled_app_tables(RLS 비활성이며 anon/authenticated에 SELECT/INSERT/UPDATE/DELETE 중 하나라도 있는 public 표 수, expected=0) metric을 추가하고 admin-acl.sh가 0을 요구한다. / audit SQL에 ledger_write_paths(원장·확정값 표에서 앱 롤 쓰기 GRANT가 있고 RLS 비활성 또는 해당 롤·PUBLIC 대상 쓰기 정책이 존재하는 조합 수, expected=0) metric을 추가하고 admin-acl.sh가 0을 요구한다. 원장 표 목록은 README 권위 데이터와 일치시킨다. / 개발 DB 실측에서 두 metric이 0이 아니면 숨기지 않고 87개 항목과 같은 방식으로 문서·P0-5에 연결한다. / 성공 문구는 측정 범위를 벗어난 보증(전체 ACL 폐쇄)을 하지 않도록 '측정한 항목이 닫혀 있습니다' 수준으로 한정하거나 측정 항목을 함께 출력한다.
- 필요한 테스트: admin-acl.test.sh ⑤ shim 행에 두 metric 추가, 1 이상이면 exit 1 확인 / 개발 DB 원시 metric 재실행 결과(두 metric 값)를 장부에 기록

### P1-1-SEC-AUDIT-SIGNATURE-SEARCH-PATH — Minor / OPEN

- 범주: CODE
- 영향: 실패 방향(거짓 빨강)이라 위험 은폐는 아니지만 원격 첫 실행이 환경 차이로 실패하면 수동 우회 압력이 생긴다. procedure 제외는 향후 CALL 가능한 내부 몸통이 감사 밖에 남을 수 있다.
- 근거: packages/db/scripts/admin-acl-audit.sql:140, packages/db/scripts/admin-acl-audit.sql:116
- 완료 조건: audit 트랜잭션 시작 직후 set local search_path = pg_catalog, public; 을 고정해 시그니처 텍스트가 환경과 무관하게 같다. / anon_rpc·unapproved_authenticated_rpc는 prokind in ('f','p')를 대상으로 한다(facade_rpc_missing은 그대로).
- 필요한 테스트: 로컬 fresh DB에서 PGOPTIONS 또는 alter role … set search_path='pg_catalog' 상태로 audit SQL을 실행해도 facade_rpc_missing=0

### P1-1-SEC-AUDIT-TEST-GAP-ALLOWLIST-REALDB — Minor / OPEN

- 범주: TEST_GAP
- 영향: allowlist와 앱 소스가 어긋나도(새 RPC 추가·이름 변경) 알아채는 자동 장치가 없고, audit SQL 자체의 문법·rollback 계약은 verify에서 검증되지 않는다.
- 근거: packages/db/scripts/admin-acl-audit.sql:4, packages/db/scripts/admin-acl.test.sh:131, packages/db/scripts/admin-acl-audit.sql:10
- 완료 조건: verify ④ 또는 DB 스위트에서 fresh DB에 admin-acl-audit.sql을 실행해 14개+ metric 행이 나오고 실행 뒤 public._acl_probe_postgres가 없음을 확인한다. / apps/mobile/src에서 .rpc('name') 이름 집합을 추출해 admin-acl-audit.sql allowlist 이름 집합과 양방향 diff하는 시험을 추가하거나, create_store처럼 앱 밖 호출만 있는 항목은 SQL 주석에 호출처를 적는다.
- 필요한 테스트: fresh DB audit SQL 실행 시험 / allowlist↔앱 rpc 이름 diff 시험

### P1-1-SEC-DOC-AUDIT-MODE-STALE — Minor / OPEN

- 범주: POLICY
- 영향: 권위 정책 문서가 도구 상태를 다르게 말하면 원격 ACL 단계의 완료 판정 기준이 두 개가 된다.
- 근거: AGENTS.md:138, packages/db/README.md:27
- 완료 조건: packages/db/README.md 27행이 audit·fix·check를 모두 적는다. / AGENTS.md 138~139행 갱신은 별도 작업(문서 동기화)으로 등록하고 이 회차에서 reference_path를 편집하지 않는다.
- 필요한 테스트: 없음

### P1-1-SEC-AUDIT-SQLPATH-SSL-HARDENING — Improvement / OPEN

- 범주: OPERATIONS
- 영향: 운영 편의·심층 방어 항목이며 게이트 판정에는 영향이 없다.
- 근거: packages/db/scripts/admin-acl.sh:59, packages/db/scripts/admin-acl.sh:103
- 완료 조건: AUDIT_SQL_FILE 계산이 슬래시 없는 호출도 처리하거나 실패 메시지에 기대 경로를 포함한다. / 문서에 운영 접속 권장값(verify-full, CA 경로)을 적는다.
- 필요한 테스트: 없음

## 공동 편집 제안

### E1-SH-SEEN-INIT — REPLACE

- 대상: `packages/db/scripts/admin-acl.sh`
- 위치:   failed=""
- 연결 Finding: P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN
- 이유: 필수 metric 존재·중복 검사를 위한 추적 변수. bash 내장만 사용해 자격증명 환경에서 자식 프로세스를 띄우지 않는다.

      failed=""; seen=" "

### E2-SH-SEEN-TRACK — REPLACE

- 대상: `packages/db/scripts/admin-acl.sh`
- 위치:     echo "admin-acl: audit $metric=$value ($expected)"
- 연결 Finding: P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN
- 이유: 같은 metric이 두 번 오면(하나 정상·하나 실패) 은폐되지 않도록 중복을 실패로 기록한다.

        case "$seen" in *" $metric "*) failed="${failed}${failed:+, }duplicate_metric=$metric" ;; esac
        seen="$seen$metric "
        echo "admin-acl: audit $metric=$value ($expected)"

### E3-SH-REQUIRED-METRICS — ADD

- 대상: `packages/db/scripts/admin-acl.sh`
- 위치:   done <<< "$AUDIT"
- 연결 Finding: P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN, P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP
- 이유: audit 게이트를 실패 폐쇄로 만든다. 새 metric(rls_disabled_app_tables, ledger_write_paths)도 필수 목록에 포함한다.

      # 필수 metric이 하나라도 없으면 실패 — 빈 출력·SQL 파일 회귀가 초록이 되지 않는다.
      for required in migrations probe_owner probe_dangerous public_dangerous protected_objects protected_writes \
                      source_schema_grants supabase_admin_objects anon_rpc blocked_internal_rpc blocked_internal_rpc_objects \
                      facade_rpc_missing unapproved_authenticated_rpc rls_disabled_app_tables ledger_write_paths platform_default_open; do
        case "$seen" in *" $required "*) ;; *) failed="${failed}${failed:+, }missing_metric=$required" ;; esac
      done

### E4-SH-NEW-METRIC-CASE — REPLACE

- 대상: `packages/db/scripts/admin-acl.sh`
- 위치:       probe_dangerous|public_dangerous|protected_writes|source_schema_grants|supabase_admin_objects|anon_rpc|blocked_internal_rpc|facade_rpc_missing|unapproved_authenticated_rpc)
- 연결 Finding: P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP
- 이유: 새 metric 두 개를 0 기대 목록에 넣는다(unknown_metric 실패 방지).

          probe_dangerous|public_dangerous|protected_writes|source_schema_grants|supabase_admin_objects|anon_rpc|blocked_internal_rpc|facade_rpc_missing|unapproved_authenticated_rpc|rls_disabled_app_tables|ledger_write_paths)

### E5-SQL-SEARCH-PATH — ADD

- 대상: `packages/db/scripts/admin-acl-audit.sql`
- 위치: begin;
- 연결 Finding: P1-1-SEC-AUDIT-SIGNATURE-SEARCH-PATH
- 이유: 호스티드 롤별 search_path 차이로 allowlist 62개가 통째로 불일치(거짓 빨강)되는 것을 막는다. 임시 표는 pg_temp가 암묵적으로 먼저 탐색되어 영향이 없다.

    -- regprocedure::text 비교가 세션 search_path에 흔들리지 않도록 고정한다(트랜잭션 끝에 원복).
    set local search_path = pg_catalog, public;

### E6-SQL-RLS-LEDGER-METRICS — ADD

- 대상: `packages/db/scripts/admin-acl-audit.sql`
- 위치:    and has_table_privilege(role_name, 'public.' || name, privilege_name);
- 연결 Finding: P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP
- 이유: 원장 쓰기 경로와 RLS 비활성 표를 측정해 '애플리케이션 ACL 폐쇄' 판정이 AGENTS 불변식을 실제로 포함하게 한다. 원장 표 목록은 README 권위 데이터 항목 기준이며 솔라가 실제 표명과 대조해 조정한다.

    
    -- RLS가 꺼진 public 표에 앱 롤 권한이 있으면 Data API로 전 행을 읽고 쓸 수 있다.
    select 'rls_disabled_app_tables' || '|' || count(*) || '|expected=0'
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
       and exists (select 1 from (values ('anon'), ('authenticated')) roles(role_name)
                    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) privileges(privilege_name)
                   where has_table_privilege(role_name, c.oid, privilege_name));
    
    -- 원장·확정값 표는 승인된 RPC만 바꾼다(AGENTS 서버 계산 권위·변경 출처 제한).
    -- 앱 롤에 쓰기 GRANT가 있고 RLS가 꺼졌거나 그 롤(또는 PUBLIC) 대상 쓰기 정책이 있으면 직접 쓰기 경로다.
    with ledger(name) as (values
      ('inventory_events'), ('inventory_states'), ('business_days'), ('daily_sales'), ('daily_sales_items'),
      ('price_trends'), ('profit_trends'), ('entity_change_events')
    )
    select 'ledger_write_paths' || '|' || count(*) || '|expected=0'
      from ledger l join pg_class c on c.oid = to_regclass('public.' || l.name)
     cross join (values ('anon'), ('authenticated')) roles(role_name)
     cross join (values ('INSERT', 'a'), ('UPDATE', 'w'), ('DELETE', 'd')) privileges(privilege_name, cmd)
     where has_table_privilege(role_name, c.oid, privilege_name)
       and (not c.relrowsecurity
         or exists (select 1 from pg_policy pol
                     where pol.polrelid = c.oid and pol.polcmd in ('*', cmd)
                       and (pol.polroles = '{0}'::oid[]
                         or (select oid from pg_roles where rolname = role_name) = any(pol.polroles))));

### E7-TEST-SHIM-ROWS — ADD

- 대상: `packages/db/scripts/admin-acl.test.sh`
- 위치: facade_rpc_missing|0|expected=0
- 연결 Finding: P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP, P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN
- 이유: shim 출력에 새 metric 행을 추가해 필수 metric 검사와 일치시킨다. rls_off 변수는 E8 case 분기에서 기본 0으로 둔다.

    rls_disabled_app_tables|$rls_off|expected=0
    ledger_write_paths|0|expected=0

### E8-TEST-SHIM-CASES — ADD

- 대상: `packages/db/scripts/admin-acl.test.sh`
- 위치:   audit_rpc_open) rpc_open=1 ;;
- 연결 Finding: P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN, P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP
- 이유: metric 일부만·전혀 내지 않는 사보타주와 RLS 비활성 한 건 분기를 shim에 추가한다(기존 esac 앞에 삽입되어 case가 이어지도록 구성).

      audit_rls_off) rls_off=1 ;;
      audit_partial) printf 'migrations|2|expected=2\nprobe_owner|%s|expected=postgres\n' "$owner"; exit 0 ;;
      audit_empty) exit 0 ;;
    esac
    : "${rls_off:=0}"
    case "${PGDATABASE:-}" in

### E9-TEST-FAIL-CLOSED-CASES — ADD

- 대상: `packages/db/scripts/admin-acl.test.sh`
- 위치:   && ok "허용 목록 밖 RPC 한 건이면 실패" || bad "미승인 RPC를 통과시킴(exit $rc)"
- 연결 Finding: P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN, P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP
- 이유: 실패 폐쇄 계약(누락·빈 출력·RLS 비활성)을 회귀시험으로 고정한다.

    
    out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_partial ADMIN_DB_USER=postgres \
           bash "$ACL" --remote audit 2>&1)"; rc=$?
    [ "$rc" -eq 1 ] && has "$out" 'missing_metric=unapproved_authenticated_rpc' \
      && ok "metric 일부 누락이면 실패" || bad "metric 누락을 통과시킴(exit $rc)"
    
    out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_empty ADMIN_DB_USER=postgres \
           bash "$ACL" --remote audit 2>&1)"; rc=$?
    [ "$rc" -eq 1 ] && has "$out" 'missing_metric=' \
      && ok "빈 audit 출력이면 실패" || bad "빈 출력을 통과시킴(exit $rc)"
    
    out="$(PATH="$SHIM:$PATH" ADMIN_DB_HOST=prod.invalid ADMIN_DB_NAME=audit_rls_off ADMIN_DB_USER=postgres \
           bash "$ACL" --remote audit 2>&1)"; rc=$?
    [ "$rc" -eq 1 ] && has "$out" 'rls_disabled_app_tables=1' \
      && ok "RLS 비활성 표 한 건이면 실패" || bad "RLS 비활성을 통과시킴(exit $rc)"

### E10-README-STRUCTURE-LINE — REPLACE

- 대상: `packages/db/README.md`
- 위치:   admin-acl.sh            로컬/원격 supabase_admin 기본 ACL fix·check
- 연결 Finding: P1-1-SEC-DOC-AUDIT-MODE-STALE
- 이유: 구조 표가 audit 모드와 짝 SQL 파일을 빠뜨리지 않도록 한다.

      admin-acl.sh            로컬 fix·check, 원격 audit(읽기 전용)·fix·check
      admin-acl-audit.sql     원격 audit가 실행하는 rollback 전용 앱 롤 공격면 감사 SQL

### E11-SQL-CREATE-STORE-NOTE — COMMENT

- 대상: `packages/db/scripts/admin-acl-audit.sql`
- 위치: -- 이 파일은 admin-acl.sh --remote audit와 실제 DB 회귀검사가 함께 사용한다.
- 연결 Finding: P1-1-SEC-AUDIT-TEST-GAP-ALLOWLIST-REALDB
- 이유: allowlist의 근거를 소스와 연결해 P1-1-AUDIT-3의 양방향 대조를 사람이 재현할 수 있게 한다.

    create_store(text,text)는 apps/mobile/src/features 훅 어디에서도 supabase.rpc로 호출되지 않는다(tests/31만 직접 호출). 앱 온보딩 호출처가 있으면 그 경로를 allowlist 주석에 적고, 없으면 '앱이 직접 쓰는 facade' 정의에 맞게 별도 분류(내부/온보딩)로 표시해 달라. 또한 '실제 DB 회귀검사'가 어느 시험을 뜻하는지 파일·단계명을 적어 달라.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN, P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP, P1-1-SEC-AUDIT-SIGNATURE-SEARCH-PATH, P1-1-SEC-AUDIT-TEST-GAP-ALLOWLIST-REALDB, P1-1-SEC-DOC-AUDIT-MODE-STALE

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
