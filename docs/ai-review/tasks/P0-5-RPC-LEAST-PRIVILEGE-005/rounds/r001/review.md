# P0-5-RPC-LEAST-PRIVILEGE-005 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `87be0b81735bf15a475bdc229f08ad4f5633e992`

## 요약

predecessor Finding 6건을 같은 ID로 재검수했다. (1) P05-SEC-0175-OUTSIDE-PACKET → VERIFIED: 스냅샷 migration glob에 0175가 없고 README(163개, 최신 0174)·증거 문서(163/163)가 일치한다. 회수 로직은 봉인된 0174 안에 통합됐다 — executor 대상 기본 EXECUTE 회수(26–29행), 부트스트랩 일괄 grant 직후 앱에 닫힌 postgres definer를 executor에서 회수하는 루프(113–135행), 사후조건(288–311행: 카운트 0 + purge_archived_store·schedule_store_purge·purge_entity_changes·close_due_business_days 정확한 시그니처 4개), 실제 probe 함수로 미래 함수 executor 미공개 확인(316–330행). 회수는 정확한 시그니처 나열 대신 술어 루프지만 사후조건이 시그니처를 고정하고, assert_my_store(0173:163–178)는 my_store_ids()에 의존하지 않아 회수된 my_store_ids가 facade 호출 그래프를 깨지 않는다. 0174 blob bd026a9d…/SHA 9cb317a3…가 증거 문서 73행 및 봉인 input_files와 일치한다. (2) P05-SEC-EXECUTOR-BLANKET-EXECUTE → VERIFIED: 수용 기준 1(명시 회수 migration이 packet 안)·2(metric rpc_executor_privileged_maintenance=0 + 34번 동일 단언)·3(README 112–114행·0174 주석 23–25·113–115행 설계 근거) 모두 충족. (3) P05-SEC-PURGE-42501-NONDISCRIMINATING → VERIFIED: 34번 27–35행이 prelude의 sikjae_rpc_executor 역할에서 close_due_business_days()·purge_entity_changes() 호출 42501과 purge_archived_store has_function_privilege=false를 단언한다. purge_entity_changes 몸통(0135:27–43)은 자체 42501이 없고, 증거 61행은 close_due_business_days 재개방 사보타주가 '성공했다'로 실패했음을 기록해 몸통 예외가 아닌 권한 거부를 잰다는 것이 행동으로 증명된다. (4) P05-SEC-EVIDENCE-HASH-MISMATCH·P05-SEC-FACADE-CROSS-STORE-TEST-GAP은 새 검증 commit 84c7c60의 4개 파일 blob OID·SHA-256이 봉인 input_files와 정확히 일치하고 교차 매장 행동 단언(34번 103–109행)이 유지돼 VERIFIED를 유지한다. (5) P05-SEC-HOSTED-ADMIN-OPTION-NOTE는 인간 결정대로 스테이징 원격 audit 전 OPEN(Improvement) 유지. P0-5-6은 통과로 표현하지 않는다. 필수 미해결 Finding이 없어 PASS이나, 외부 게이트·스테이징 적용 승인을 뜻하지 않는다.

## Findings

### P05-SEC-EVIDENCE-HASH-MISMATCH — Major / VERIFIED

- 범주: POLICY
- 검증 엔진: FABLE
- 영향: 증거 문서의 SHA가 봉인 blob과 일치해 34/34·metric 21·사보타주 결과가 검수 대상 artifact에 대해 성립한다. 재개방할 새 증거가 없다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:69, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:23, packages/db/scripts/admin-acl-audit.test.mjs:34, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:52, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:7
- 완료 조건: target commit(또는 그 이후 동일 artifact 해시)에서 pnpm verify 6/6, DB 34/34, ACL metric을 재실행하고 증거 문서의 파일 SHA-256이 봉인 blob과 일치해야 한다. / 증거 문서에 사보타주 3종이 현재 34번·감사 SQL에서 실패로 잡힌 기록을 포함해야 한다. / P0-5-6은 스테이징 동일 SHA 적용 후 --remote audit 결과로 별도 증거를 남기거나, 인간 결정으로 보류 상태를 명시해야 한다.
- 필요한 테스트: 동일 커밋 pnpm verify 6/6 재실행 및 SHA 대조 / admin-acl-audit.test.mjs fresh DB metric 21개 통과

### P05-SEC-EXECUTOR-BLANKET-EXECUTE — Minor / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: 수용 기준 1·2·3이 모두 봉인 packet 안에서 확인된다. 회수는 술어 루프이지만 사후조건이 정확한 시그니처를 고정하고 34/34·metric 21 통과가 facade 호출 그래프 보존을 증명한다.
- 근거: packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:23, packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:113, packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:288, packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:316, packages/db/scripts/admin-acl-audit.sql:215, packages/db/tests/34_rpc_least_privilege.sql:27, packages/db/README.md:112
- 완료 조건: executor의 EXECUTE는 facade가 실제로 호출하는 내부 도우미로 한정하거나, 최소한 purge_*·schedule_store_purge·close_due_business_days 등 postgres definer 유지보수 함수는 executor에서 명시적으로 revoke해야 하며 그 migration이 검수 packet에 포함돼야 한다. / admin-acl-audit에 executor가 유지보수·RLS 우회 함수를 실행할 수 없음을 재는 metric(expected=0)을 추가하고 34번에 동일 단언을 넣어야 한다. / 기본 권한 자동 개방 범위에 대한 설계 근거를 README 또는 마이그레이션 주석에 기록해야 한다.
- 필요한 테스트: set local role sikjae_rpc_executor 후 purge_archived_store·schedule_store_purge·close_due_business_days 호출이 42501 / 기존 34/34 회귀 통과

### P05-SEC-FACADE-CROSS-STORE-TEST-GAP — Minor / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: P0-5-4가 앱 실제 역할에서 행동으로 증명되며 재개방할 새 증거가 없다.
- 근거: packages/db/tests/34_rpc_least_privilege.sql:48, packages/db/tests/34_rpc_least_privilege.sql:103, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:62
- 완료 조건: 34번에 authenticated로 get_settings(foreign_store) 및 save_category(foreign_store, …) 호출이 거부(또는 빈 결과)됨을 단언해야 한다. / 사보타주 증거에 alter role sikjae_rpc_executor bypassrls 후 위 단언이 실패하는 기록을 추가해야 한다.
- 필요한 테스트: authenticated facade 교차 매장 거부 2건 / executor bypassrls 사보타주 행동 실패 증거

### P05-SEC-HOSTED-ADMIN-OPTION-NOTE — Improvement / OPEN

- 범주: OPERATIONS
- 영향: 스테이징 적용 시 권한 부족으로 마이그레이션이 중단될 수 있다. 사후조건이 롤백을 보장하지만 배포 절차가 막힌다.
- 근거: packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:19, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:7
- 완료 조건: 스테이징 동일 SHA 적용 후 rpc_executor_role=1과 사후조건 통과를 기록한다.
- 필요한 테스트: 없음

### P05-SEC-0175-OUTSIDE-PACKET — Major / VERIFIED

- 범주: POLICY
- 검증 엔진: FABLE
- 영향: R3 회수 migration이 SECURITY 경로의 봉인 검수 집합 안에 들어와 회수 범위·사후조건·기본 권한 회수 방식을 독립 검수했다. 예정된 0175 blob 63347d89…는 통합으로 폐기됐고 그 대체물이 검수됐다.
- 근거: packages/db/README.md:8, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:35, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:73, packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:26, packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:116, packages/db/supabase/migrations/20260829000173_account_retention.sql:163, packages/db/tests/16_change_retention.sql:368
- 완료 조건: 0175를 artifact_paths에 포함한 successor packet을 봉인하고 그 blob OID가 증거 문서의 63347d89dae6d84de3f4c5d734451a2d6cf95397과 일치해야 한다. / 0175가 executor 대상 기본 EXECUTE를 alter default privileges로 회수하고 postgres definer 유지보수 함수를 정확한 시그니처로 revoke하며 사후조건(rpc_executor_privileged_maintenance=0, probe 함수로 미래 함수 executor 미공개)을 migration 안에서 검증해야 한다. / 0175가 facade 호출 그래프에 필요한 내부 도우미 EXECUTE를 유지한다는 근거(주석 또는 34/34 통과)를 같은 packet에서 확인할 수 있어야 한다.
- 필요한 테스트: 0175 포함 fresh DB 34/34 및 ACL metric 21개 / 업그레이드 경로 9/9에 0175 포함

### P05-SEC-PURGE-42501-NONDISCRIMINATING — Minor / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: 행동 단언이 권한 재개방을 몸통 예외와 구별해 잡으며 증거 문서의 사보타주 표도 실제 잡은 단언으로 갱신됐다.
- 근거: packages/db/tests/34_rpc_least_privilege.sql:27, packages/db/tests/_prelude.sql:17, packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql:27, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:61
- 완료 조건: executor 직접 호출 단언은 몸통이 42501을 자체 발생시키지 않는 유지보수 함수(예: close_due_business_days(), purge_entity_changes())를 쓰거나, permission denied 메시지/PURGE_NOT_SCHEDULED detail을 구분해 권한 거부만 통과시켜야 한다. / 증거 문서의 사보타주 표는 실제로 잡은 단언(카운트)만 기재하거나 보강된 행동 단언으로 갱신해야 한다.
- 필요한 테스트: executor로 close_due_business_days() 호출 42501 / executor에 purge_archived_store EXECUTE 재부여 시 보강 단언이 실패하는 사보타주

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
