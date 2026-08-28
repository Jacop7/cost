# P1-1-REMOTE-ACL-AUDIT-001 Fable 검수 — r003

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 모드: `RECHECK`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `d5aeafd7098836c73e29c362386b8250f8476431`

## 요약

P1-1 원격 ACL 읽기 전용 audit 도구 FABLE-SEC 재검수(r003). 이전 필수 finding 5건과 선택 1건을 스냅샷 원문으로 대조한 결과 모두 수용 기준을 충족해 VERIFIED로 기록한다. (1) MISSING-METRIC-FAIL-OPEN: admin-acl.sh 153~177행이 seen 추적·duplicate_metric·16개 필수 metric(platform_default_open 포함) missing_metric 검사를 bash 내장만으로 수행하고, test.sh 210~223행이 부분·빈·중복 출력 사보타주를 exit 1로 고정한다. (2) RLS-LEDGER-WRITE-PATH-GAP: audit SQL 80~90행 rls_disabled_app_tables(프로브 제외), 111~134행 ledger_write_paths(README 권위 데이터 10개 표, GRANT×RLS 비활성 또는 PUBLIC/롤 대상 쓰기 정책)를 추가했고 셸 165행이 0을 요구하며 성공 문구(186행)는 측정 범위로 한정됐다. 개발 DB 실측 0/32/87은 README·브랜치 §4.5·서버-확장 서문에 배포 차단·P0-5 연결로 숨김 없이 기록됐다. (3) SIGNATURE-SEARCH-PATH: SQL 4행 set local search_path 고정, anon_rpc·unapproved가 prokind ('f','p')로 확장, Codex가 호출자 search_path=pg_catalog 조건에서 통과를 확인했다. (4) TEST-GAP-ALLOWLIST-REALDB: SQL 45~47행 create_store 비-mobile 예외 명시, 7행 시험 파일·verify ④ 지정, 본 검수에서 evidence 훅 10개의 .rpc 이름 61개 유일 집합 + create_store = allowlist 62개가 양방향 일치함을 재확인했다. (5) DOC-AUDIT-MODE-STALE: README 27~30행 구조표 갱신; AGENTS.md 138행은 reference라 별도 동기화 작업으로 남긴다(스냅샷은 UNCHANGED). (6) SQLPATH-SSL: 슬래시 없는 호출 처리·기대 경로 출력·verify-full 권장 문서화 완료. 새 항목 1건(Improvement, 비차단): 게이트를 지탱하는 admin-acl-audit.test.mjs와 verify ④ hunk가 이 패킷의 artifact에 없어 소스가 봉인·검수되지 않았다. 잔여 위험 방향은 모두 실패 폐쇄이므로 PASS를 막지 않지만 다음 패킷에서 봉인을 요청한다. 실제 호스티드 audit 미실행과 32/87 축소는 사람 결정대로 별도 R3(P0-5) 과제이며, PASS는 도구 구현 검수 통과일 뿐 원격 ACL 게이트(gate_state)는 OPEN으로 유지된다.

## Findings

### P1-1-SEC-AUDIT-MISSING-METRIC-FAIL-OPEN — Major / VERIFIED

- 범주: SECURITY
- 영향: 이전: metric 누락·중복·빈 출력이 거짓 초록을 만들 수 있었다. 현재: 정확한 16개 metric 집합이 각 1회 존재해야만 exit 0이며, 부분 출력·SQL 회귀는 실패 폐쇄된다.
- 근거: packages/db/scripts/admin-acl.sh:153, packages/db/scripts/admin-acl.sh:179, packages/db/scripts/admin-acl.test.sh:151, packages/db/scripts/admin-acl.test.sh:210
- 완료 조건: audit 모드는 정확히 기대하는 metric 집합(현재 16개)이 각각 한 번씩 존재해야만 exit 0이며, 누락·중복·빈 출력은 exit 1과 사유(missing_metric=/duplicate_metric=)를 stderr에 낸다. / platform_default_open 행이 없으면 '알 수 없음'으로 성공하지 않고 실패한다. / 검사는 자격증명 환경에서 grep 등 자식 프로세스를 띄우지 않고 bash 내장만 사용한다.
- 필요한 테스트: admin-acl.test.sh ⑤ audit_partial: exit 1과 missing_metric= 확인(210~213행 존재) / admin-acl.test.sh ⑤ audit_empty: exit 1 확인(215~218행 존재) / admin-acl.test.sh ⑤ audit_duplicate: exit 1 확인(220~223행 존재)

### P1-1-SEC-AUDIT-RLS-LEDGER-WRITE-PATH-GAP — Major / VERIFIED

- 범주: SECURITY
- 영향: 이전: RLS 비활성 표와 원장 표 직접 쓰기 경로를 재지 않아 AGENTS 서버 계산 권위·원장 쓰기 경로 불변식에 대해 거짓 초록이 가능했다. 현재: 두 경로를 측정해 실패시키고, 개발 DB의 32건 직접 쓰기 경로를 숨기지 않고 P0-5 R3 축소 과제로 연결했다. 축소 자체는 사람 승인 대상이며 이 audit-only 범위 밖이다.
- 근거: packages/db/scripts/admin-acl-audit.sql:80, packages/db/scripts/admin-acl-audit.sql:111, packages/db/scripts/admin-acl.sh:165, packages/db/README.md:100, docs/브랜치-DB-운영-기획안.md:259, docs/서버-확장-아키텍처-기획안.md:26, packages/db/scripts/admin-acl.test.sh:225
- 완료 조건: audit SQL에 rls_disabled_app_tables(expected=0) metric을 추가하고 admin-acl.sh가 0을 요구한다. / audit SQL에 ledger_write_paths(expected=0) metric을 추가하고 admin-acl.sh가 0을 요구한다. 원장 표 목록은 README 권위 데이터와 일치시킨다. / 개발 DB 실측에서 두 metric이 0이 아니면 숨기지 않고 87개 항목과 같은 방식으로 문서·P0-5에 연결한다. / 성공 문구는 측정 범위로 한정한다.
- 필요한 테스트: admin-acl.test.sh ⑤ shim 행에 두 metric 추가, 1 이상이면 exit 1 확인(225~233행 존재) / 개발 DB 원시 metric 재실행 결과 기록(Codex 장부: rls_disabled_app_tables=0, ledger_write_paths=32)

### P1-1-SEC-AUDIT-SIGNATURE-SEARCH-PATH — Minor / VERIFIED

- 범주: CODE
- 영향: 이전: 호스티드 롤별 search_path 차이로 allowlist 62개가 통째로 불일치(거짓 빨강)될 수 있었고 procedure가 감사 밖이었다. 현재: 시그니처 텍스트가 환경과 무관하며 CALL 가능한 procedure도 집계된다.
- 근거: packages/db/scripts/admin-acl-audit.sql:1, packages/db/scripts/admin-acl-audit.sql:173, packages/db/scripts/admin-acl-audit.sql:207, COLLABORATION_LOG:0
- 완료 조건: audit 트랜잭션 시작 직후 set local search_path = pg_catalog, public 을 고정한다. / anon_rpc·unapproved_authenticated_rpc는 prokind in ('f','p')를 대상으로 한다.
- 필요한 테스트: 호출자 search_path='pg_catalog' 상태로 audit SQL을 실행해도 facade_rpc_missing=0(Codex 장부 확인)

### P1-1-SEC-AUDIT-TEST-GAP-ALLOWLIST-REALDB — Minor / VERIFIED

- 범주: TEST_GAP
- 영향: 이전: allowlist↔앱 소스 자동 대조와 audit SQL 실제 실행 시험이 없었다. 현재: SQL이 예외를 명시하고 verify ④가 실제 DB 실행·rollback·양방향 대조를 수행한다(시험 소스 봉인은 별도 Improvement 항목).
- 근거: packages/db/scripts/admin-acl-audit.sql:6, packages/db/scripts/admin-acl-audit.sql:45, packages/db/scripts/admin-acl-audit.sql:12, packages/db/README.md:30, COLLABORATION_LOG:0
- 완료 조건: verify ④ 또는 DB 스위트에서 fresh DB에 admin-acl-audit.sql을 실행해 16개 metric 행이 나오고 실행 뒤 public._acl_probe_postgres가 없음을 확인한다. / apps/mobile/src에서 .rpc 이름 집합을 추출해 allowlist와 양방향 diff하거나, create_store처럼 앱 밖 호출만 있는 항목은 SQL에 호출처를 적는다.
- 필요한 테스트: fresh DB audit SQL 실행 시험(Codex 장부 통과) / allowlist↔앱 rpc 이름 diff 시험(Codex 장부 통과, 본 검수 수동 대조 일치)

### P1-1-SEC-DOC-AUDIT-MODE-STALE — Minor / VERIFIED

- 범주: POLICY
- 영향: 공식 artifact 문서 3종은 도구 상태와 일치한다. AGENTS.md 138행 동기화는 별도 작업으로 완료돼야 원격 ACL 완료 판정 기준이 하나가 된다.
- 근거: packages/db/README.md:27, packages/db/README.md:108, AGENTS.md:138
- 완료 조건: packages/db/README.md 27행이 audit·fix·check를 모두 적는다. / AGENTS.md 138~139행 갱신은 별도 작업(문서 동기화)으로 등록하고 이 회차에서 reference_path를 편집하지 않는다.
- 필요한 테스트: 없음

### P1-1-SEC-AUDIT-SQLPATH-SSL-HARDENING — Improvement / VERIFIED

- 범주: OPERATIONS
- 영향: 운영 편의·심층 방어 항목 완료. 비밀번호 격리 계약(scrub_env 후 exec, argv 무비밀번호)은 변경되지 않았다.
- 근거: packages/db/scripts/admin-acl.sh:57, packages/db/scripts/admin-acl.sh:149, packages/db/README.md:108
- 완료 조건: AUDIT_SQL_FILE 계산이 슬래시 없는 호출도 처리하거나 실패 메시지에 기대 경로를 포함한다. / 문서에 운영 접속 권장값(verify-full, CA 경로)을 적는다.
- 필요한 테스트: 없음

### P1-1-SEC-SUPPORT-TEST-UNSEALED — Improvement / OPEN

- 범주: TEST_GAP
- 영향: allowlist 드리프트와 SQL 회귀를 로컬에서 잡는 장치의 소스가 검수 밖이다. 다만 드리프트·회귀의 주요 방향(새 앱 RPC 미등록, SQL 문법 오류)은 원격 audit에서 실패 폐쇄되고 본 검수가 61+1=62 양방향 일치를 수동 확인했으므로 게이트 판정을 막지 않는다.
- 근거: packages/db/scripts/admin-acl-audit.sql:7, packages/db/README.md:30, COLLABORATION_LOG:0
- 완료 조건: 다음 패킷(후속 commit 검수 또는 이 과제의 다음 RECHECK)에서 packages/db/scripts/admin-acl-audit.test.mjs와 scripts/verify.mjs의 ④ hunk를 artifact_paths로 봉인해 소스를 검수한다. / 해당 시험이 metric 16개 정확 집합·rollback 뒤 probe 부재·allowlist 양방향 diff 실패를 각각 비정상 종료로 만드는지 소스로 확인한다.
- 필요한 테스트: 봉인된 admin-acl-audit.test.mjs에 대한 사보타주 시험(allowlist 항목 삭제·앱 RPC 추가·SQL select 삭제) 결과 기록

## 공동 편집 제안

### E12-SERVER-DOC-DUP-PHRASE — REPLACE

- 대상: `docs/서버-확장-아키텍처-기획안.md`
- 위치: 저장소 문서와 공용 RPC 변환 경계의 기준선 동기화(P1-3)는 `01c5358`에서 완료했다. 다음 서버 운영
- 연결 Finding: 없음
- 이유: 30행 끝 '다음 서버 운영'이 31행 첫머리와 중복돼 문장이 끊긴다. 의미 변경 없는 오탈자 정리.

    저장소 문서와 공용 RPC 변환 경계의 기준선 동기화(P1-3)는 `01c5358`에서 완료했다.

### E13-SQL-SUPPORT-TEST-SEAL-NOTE — COMMENT

- 대상: `packages/db/scripts/admin-acl-audit.sql`
- 위치: -- 이 파일은 admin-acl.sh --remote audit와 verify ④의 admin-acl-audit.test.mjs가 함께 사용한다.
- 연결 Finding: P1-1-SEC-SUPPORT-TEST-UNSEALED
- 이유: 게이트 지원 시험의 소스 검수를 후속 패킷에 연결한다.

    admin-acl-audit.test.mjs와 verify ④ hunk는 이 패킷의 봉인 artifact가 아니다. 다음 검수 패킷의 artifact_paths에 두 파일을 포함해 소스까지 봉인해 달라(P1-1-SEC-SUPPORT-TEST-UNSEALED).

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
