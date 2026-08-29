# P0-5-RPC-LEAST-PRIVILEGE-004 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `6c30ebbb2ba3063d9107bdc50f923d8b031039c1`

## 요약

predecessor Finding 4건을 같은 ID로 재검수했다. (1) P05-SEC-EVIDENCE-HASH-MISMATCH → VERIFIED: 증거 문서가 검증 commit e8e22db의 Git blob OID·SHA-256을 기록했고, 0174(a0f7e51e/f3d4f111…)·34번(b61c514f/fb7c34b3…)·admin-acl-audit.sql(526abbd2/09fa1ece…)·admin-acl-audit.test.mjs(0b670ad8/dcaadd9a…)가 이번 봉인 input_files와 정확히 일치한다. metric 21개는 test.mjs EXPECTED_METRICS 21개와 같고, 사보타주 5종이 기록됐으며 P0-5-6은 인간 결정으로 보류를 명시했다. (2) P05-SEC-FACADE-CROSS-STORE-TEST-GAP → VERIFIED: 34번이 authenticated 실제 역할로 get_settings(foreign_store) null·save_category(foreign_store) 42501·ingredient_detail(foreign_ingredient) null을 행동으로 단언하고, 증거는 executor BYPASSRLS 사보타주가 get_settings 교차 매장 단언에서 실패했음을 기록한다. (3) P05-SEC-EXECUTOR-BLANKET-EXECUTE → OPEN 유지: 감사 metric rpc_executor_privileged_maintenance=0, 34번·16번의 executor 유지보수 definer 0개·새 함수 자동 미공개 단언, README 설계 근거는 확인됐다. 그러나 실제 회수를 수행한다는 20260829000175_rpc_executor_narrowing.sql이 artifact_paths·input_files에 없어 스냅샷에 존재하지 않고, 봉인된 0174는 여전히 일괄 grant(85행)와 executor 기본 EXECUTE(26–27행)를 담고 있다. 수용 기준 1(명시적 revoke)을 검수 대상에서 확인할 수 없다. (4) P05-SEC-HOSTED-ADMIN-OPTION-NOTE는 인간 결정대로 스테이징 전 보류(OPEN, Improvement).

새 Finding 2건: P05-SEC-0175-OUTSIDE-PACKET(Major) — R3 권한 변경 migration 0175가 SECURITY 경로 검수 집합 밖에 있어 과도 회수·사후조건·기본 권한 회수 방식을 독립 검수하지 못했다. 증거 문서의 blob OID 63347d89…를 봉인한 successor packet이 필요하다. P05-SEC-PURGE-42501-NONDISCRIMINATING(Minor) — 34번 38–39행의 purge_archived_store 직접 호출 42501 단언은 0173 함수 몸통 자체가 예약 없음에 42501(PURGE_NOT_SCHEDULED)을 던지므로 executor에 EXECUTE가 다시 열려도 통과한다. 권한 회귀는 카운트 단언이 잡지만 행동 단언은 판별력이 없다. 종합 판정 CHANGES_REQUIRED.

## Findings

### P05-SEC-EVIDENCE-HASH-MISMATCH — Major / VERIFIED

- 범주: POLICY
- 검증 엔진: FABLE
- 영향: 증거 문서의 SHA가 검수 대상 blob과 일치해 34/34·metric 21·사보타주 결과가 봉인된 감사 스크립트에 대해 성립한다. P0-5-6은 인간 결정으로 보류가 명시돼 판정 불가 상태가 정직하게 기록됐다. 단, 0175 행은 packet 밖이라 별도 Finding으로 다룬다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:69, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:23, packages/db/scripts/admin-acl-audit.test.mjs:34, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:52, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:7
- 완료 조건: target commit(또는 그 이후 동일 artifact 해시)에서 pnpm verify 6/6, DB 34/34, ACL metric을 재실행하고 증거 문서의 파일 SHA-256이 봉인 blob과 일치해야 한다. / 증거 문서에 사보타주 3종이 현재 34번·감사 SQL에서 실패로 잡힌 기록을 포함해야 한다. / P0-5-6은 스테이징 동일 SHA 적용 후 --remote audit 결과로 별도 증거를 남기거나, 인간 결정으로 보류 상태를 명시해야 한다.
- 필요한 테스트: 동일 커밋 pnpm verify 6/6 재실행 및 SHA 대조 / admin-acl-audit.test.mjs fresh DB metric 21개 통과

### P05-SEC-EXECUTOR-BLANKET-EXECUTE — Minor / OPEN

- 범주: SECURITY
- 영향: 감사 metric·시험 단언·README는 수용 기준 2·3을 충족하고 증거는 통과를 기록하지만, 수용 기준 1(executor에서 유지보수 definer 명시 revoke와 기본 EXECUTE 회수)을 수행하는 migration이 봉인 packet 밖이다. 검수자는 회수 범위가 과도하거나 부족한지, 사후조건이 있는지 확인하지 못했다.
- 근거: packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:84, packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:24, packages/db/scripts/admin-acl-audit.sql:215, packages/db/tests/34_rpc_least_privilege.sql:27, packages/db/tests/16_change_retention.sql:290, packages/db/README.md:112, COLLABORATION_LOG:0
- 완료 조건: executor의 EXECUTE는 facade가 실제로 호출하는 내부 도우미로 한정하거나, 최소한 purge_*·schedule_store_purge·close_due_business_days 등 postgres definer 유지보수 함수는 executor에서 명시적으로 revoke해야 하며 그 migration이 검수 packet에 포함돼야 한다. / admin-acl-audit에 executor가 유지보수·RLS 우회 함수를 실행할 수 없음을 재는 metric(expected=0)을 추가하고 34번에 동일 단언을 넣어야 한다. / 기본 권한 자동 개방 범위에 대한 설계 근거를 README 또는 마이그레이션 주석에 기록해야 한다.
- 필요한 테스트: set local role sikjae_rpc_executor 후 purge_archived_store·schedule_store_purge·close_due_business_days 호출이 42501 / 기존 34/34 회귀 통과

### P05-SEC-FACADE-CROSS-STORE-TEST-GAP — Minor / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: P0-5-4의 핵심 성질(definer 전환 후에도 facade가 다른 매장 행에 닿지 못함)이 앱 실제 역할에서 행동으로 증명되고, BYPASSRLS 회귀도 행동 단언으로 잡힌다.
- 근거: packages/db/tests/34_rpc_least_privilege.sql:41, packages/db/tests/34_rpc_least_privilege.sql:96, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:62
- 완료 조건: 34번에 authenticated로 get_settings(foreign_store) 및 save_category(foreign_store, …) 호출이 거부(또는 빈 결과)됨을 단언해야 한다. / 사보타주 증거에 alter role sikjae_rpc_executor bypassrls 후 위 단언이 실패하는 기록을 추가해야 한다.
- 필요한 테스트: authenticated facade 교차 매장 거부 2건 / executor bypassrls 사보타주 행동 실패 증거

### P05-SEC-HOSTED-ADMIN-OPTION-NOTE — Improvement / OPEN

- 범주: OPERATIONS
- 영향: 스테이징 적용 시 권한 부족으로 마이그레이션이 중단될 수 있다. 사후조건이 롤백을 보장하지만 배포 절차가 막힌다.
- 근거: packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:19, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:7
- 완료 조건: 스테이징 동일 SHA 적용 후 rpc_executor_role=1과 사후조건 통과를 기록한다.
- 필요한 테스트: 없음

### P05-SEC-0175-OUTSIDE-PACKET — Major / OPEN

- 범주: POLICY
- 영향: R3 권한 변경의 핵심 회수 migration이 SECURITY 경로의 봉인 검수 집합 밖에 있어, 과도 회수(승인 facade가 필요한 도우미까지 닫힘)·부족 회수·사후조건 부재·기본 권한 회수 방식(for role postgres in schema public 두 층) 여부를 독립적으로 확인하지 못했다. 시험·metric은 결과만 재며 migration 텍스트의 검수를 대체하지 않는다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:74, packages/db/README.md:8, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:17, COLLABORATION_LOG:0, docs/작업큐.md:593
- 완료 조건: 0175를 artifact_paths에 포함한 successor packet을 봉인하고 그 blob OID가 증거 문서의 63347d89dae6d84de3f4c5d734451a2d6cf95397과 일치해야 한다. / 0175가 executor 대상 기본 EXECUTE를 alter default privileges로 회수하고 postgres definer 유지보수 함수를 정확한 시그니처로 revoke하며 사후조건(rpc_executor_privileged_maintenance=0, probe 함수로 미래 함수 executor 미공개)을 migration 안에서 검증해야 한다. / 0175가 facade 호출 그래프에 필요한 내부 도우미 EXECUTE를 유지한다는 근거(주석 또는 34/34 통과)를 같은 packet에서 확인할 수 있어야 한다.
- 필요한 테스트: 0175 포함 fresh DB 34/34 및 ACL metric 21개 / 업그레이드 경로 9/9에 0175 포함

### P05-SEC-PURGE-42501-NONDISCRIMINATING — Minor / OPEN

- 범주: TEST_GAP
- 영향: executor에 purge_archived_store EXECUTE가 다시 열려도 행동 단언은 통과한다. 카운트 단언(34번 27–36행, metric)이 회귀를 잡으므로 즉시 위험은 아니지만, 행동 단언이 판별력을 잃어 증거 문서의 '직접 호출 42501' 서술이 과대 표현이다.
- 근거: packages/db/tests/34_rpc_least_privilege.sql:38, packages/db/supabase/migrations/20260829000173_account_retention.sql:360, packages/db/tests/_prelude.sql:113, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:61
- 완료 조건: executor 직접 호출 단언은 몸통이 42501을 자체 발생시키지 않는 유지보수 함수(예: close_due_business_days(), purge_entity_changes())를 쓰거나, permission denied 메시지/PURGE_NOT_SCHEDULED detail을 구분해 권한 거부만 통과시켜야 한다. / 증거 문서의 사보타주 표는 실제로 잡은 단언(카운트)만 기재하거나 보강된 행동 단언으로 갱신해야 한다.
- 필요한 테스트: executor로 close_due_business_days() 호출 42501 / executor에 purge_archived_store EXECUTE 재부여 시 보강 단언이 실패하는 사보타주

## 공동 편집 제안

### P05-EDIT-TEST34-DISCRIMINATING-MAINT — ADD

- 대상: `packages/db/tests/34_rpc_least_privilege.sql`
- 위치:   format('select purge_archived_store(%L, %L)', pg_temp.store(), 'invalid-token'), '42501');
- 연결 Finding: P05-SEC-PURGE-42501-NONDISCRIMINATING, P05-SEC-EXECUTOR-BLANKET-EXECUTE
- 이유: executor 유지보수 함수 차단을 몸통 예외와 무관한 권한 거부로 판별한다.

    -- purge_archived_store는 예약이 없으면 몸통이 스스로 42501을 던지므로 권한 판별력이 없다.
    -- 몸통이 42501을 만들지 않는 유지보수 definer로 권한 거부 자체를 잰다.
    select pg_temp.raises('RPC 실행 역할은 전 매장 자동 마감 스윕을 부를 수 없다',
      'select close_due_business_days()', '42501');
    select pg_temp.raises('RPC 실행 역할은 전 매장 변경 이력 청소를 부를 수 없다',
      'select purge_entity_changes()', '42501');
    select pg_temp.ok('RPC 실행 역할에 purge_archived_store EXECUTE가 없다',
      not has_function_privilege('sikjae_rpc_executor', 'public.purge_archived_store(uuid,text)', 'execute'));

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-0175-OUTSIDE-PACKET, P05-SEC-PURGE-42501-NONDISCRIMINATING

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
