# P0-5-RPC-LEAST-PRIVILEGE-003 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `bebf4488306d0d6e4b3fe49169cde0298717e459`

## 요약

0174 설계 자체는 건전하다. sikjae_rpc_executor는 NOLOGIN·NOBYPASSRLS이고 authenticated→executor 멤버십이 없어 앱이 SET ROLE로 전환할 수 없으며, executor가 authenticated를 INHERIT하므로 `to authenticated` RLS 정책이 executor definer facade 안에서도 그대로 적용된다. 표 소유자는 postgres라 executor에 RLS가 강제되고, auth.uid()는 요청 GUC를 읽어 definer 전환 후에도 원 사용자를 식별한다. my_store_ids() 인라인은 0173의 정의(owner_id = auth.uid() and archived_at is null)와 동일 술어이며, 사후조건이 잔존 호출·소유 facade의 prosecdef/search_path·64개 정확 시그니처·미래 함수 기본 권한을 실제 객체로 검증한다. 함수 몸통에 동적 SQL(execute format)이 없어 definer 승격 후 주입 경로도 확인되지 않았다.

그러나 세 가지를 요구한다. (1) Major: 증거 문서가 구현 커밋 59077f01을 가리키고, admin-acl-audit.sql·.test.mjs의 SHA-256(7f08…, 226f…)이 이번 봉인 대상 blob(069ea4…, 198ff1…)과 다르다. 즉 34/34·metric 20개·사보타주 3종은 검수 대상과 다른 감사 스크립트로 얻은 결과이며, 원격 적용도 없어 P0-5-6은 증거상 판정 불가다. 같은 target commit에서 증거를 재생성해야 한다. (2) Minor: `grant execute on all functions … to sikjae_rpc_executor`와 기본 권한이 purge_archived_store·schedule_store_purge·purge_entity_changes·close_due_business_days 같은 postgres definer 유지보수 함수까지 실행 역할에 열어 최소 권한 원칙에 어긋난다. 현재 facade 몸통이 이를 부르지 않아 즉시 우회로는 아니지만, 60여 facade의 실행 컨텍스트가 매장 파괴 함수 실행권을 가질 이유가 없다. (3) Minor: 34번은 authenticated로 facade를 통과한 교차 매장 거부(P0-5-4의 핵심 성질)를 재지 않고 stores 직접 SELECT만 확인한다. 사보타주도 플래그 검사에 그쳐 executor에 bypassrls가 붙었을 때 행동 단언이 잡는지 증거가 없다. 운영 참고: PG16+ 호스티드에서 `grant authenticated to sikjae_rpc_executor`는 postgres의 ADMIN OPTION에 의존하므로 스테이징 적용 시 rpc_executor_role=1을 먼저 확인해야 한다.

## Findings

### P05-SEC-EVIDENCE-HASH-MISMATCH — Major / OPEN

- 범주: POLICY
- 영향: 34/34·ACL metric 20개·사보타주 3종 통과 주장이 검수 대상 커밋의 감사 스크립트에 대해 성립한다는 보장이 없다. P0-5-6(원격 audit 4개 metric 0)은 원격 실행이 없어 판정 불가다. 로컬 검증 게이트 불변식상 동일 SHA 증거가 필요하다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:3, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:59, packages/db/scripts/admin-acl-audit.test.mjs:34, COLLABORATION_LOG:0
- 완료 조건: target commit bebf4488(또는 그 이후 동일 artifact 해시)에서 pnpm verify 6/6, DB 34/34, ACL metric 20개를 재실행하고 증거 문서의 파일 SHA-256이 봉인 blob과 일치해야 한다. / 증거 문서에 사보타주 3종(내부 RPC 재개방·원장 UPDATE 재개방·역방향 멤버십)이 현재 34번·감사 SQL에서 실패로 잡힌 로그를 포함해야 한다. / P0-5-6은 스테이징 동일 SHA 적용 후 --remote audit 결과(facade_rpc_missing·unapproved_authenticated_rpc·rls_disabled_app_tables·ledger_write_paths=0)로 별도 증거를 남기거나, 인간 결정으로 보류 상태를 명시해야 한다.
- 필요한 테스트: 동일 커밋 pnpm verify 6/6 재실행 및 SHA 대조 / admin-acl-audit.test.mjs fresh DB 값 20개 통과

### P05-SEC-EXECUTOR-BLANKET-EXECUTE — Minor / OPEN

- 범주: SECURITY
- 영향: 60여 개 facade의 실행 컨텍스트(executor)가 purge_archived_store·schedule_store_purge·purge_entity_changes·close_due_business_days 등 RLS 우회 유지보수 함수 실행권을 가진다. 현재 facade 몸통에 동적 SQL이 없어 즉시 악용 경로는 확인되지 않았으나, 향후 facade 결함 하나가 매장 파괴·전 매장 스윕으로 직결되는 폭발 반경을 만든다.
- 근거: packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:84, packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:26, packages/db/supabase/migrations/20260829000173_account_retention.sql:346, packages/db/supabase/migrations/20260829000173_account_retention.sql:397, packages/db/tests/_prelude.sql:373
- 완료 조건: executor의 EXECUTE는 facade가 실제로 호출하는 내부 도우미로 한정하거나, 최소한 purge_*·schedule_store_purge·close_due_business_days 등 postgres definer 유지보수 함수는 executor에서 명시적으로 revoke해야 한다. / admin-acl-audit에 executor가 유지보수·RLS 우회 함수를 실행할 수 없음을 재는 metric(expected=0)을 추가하고 34번에 동일 단언을 넣어야 한다. / 기본 권한 자동 개방 범위에 대한 설계 근거를 README 또는 마이그레이션 주석에 기록해야 한다.
- 필요한 테스트: set local role sikjae_rpc_executor 후 purge_archived_store·schedule_store_purge·close_due_business_days 호출이 42501 / 기존 34/34 회귀 통과

### P05-SEC-FACADE-CROSS-STORE-TEST-GAP — Minor / OPEN

- 범주: TEST_GAP
- 영향: P0-5-4의 핵심 성질(definer 전환 후에도 facade가 다른 매장 행을 만지지 못함)이 앱 실제 역할 시험에서 직접 증명되지 않는다. 향후 executor에 bypassrls가 붙거나 정책 roles가 바뀌어도 플래그 검사 외에 행동 단언이 없다.
- 근거: packages/db/tests/34_rpc_least_privilege.sql:43, packages/db/tests/34_rpc_least_privilege.sql:10, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:49
- 완료 조건: 34번에 authenticated로 get_settings(foreign_store) 및 save_category(foreign_store, …) 호출이 거부(또는 빈 결과)됨을 단언해야 한다. / 사보타주 증거에 `alter role sikjae_rpc_executor bypassrls` 후 위 단언이 실패하는 로그를 추가해야 한다.
- 필요한 테스트: authenticated facade 교차 매장 거부 2건 / executor bypassrls 사보타주 행동 실패 증거

### P05-SEC-HOSTED-ADMIN-OPTION-NOTE — Improvement / OPEN

- 범주: OPERATIONS
- 영향: 스테이징 적용 시 권한 부족으로 마이그레이션이 중단될 수 있으며, 실패 시 사후조건이 롤백을 보장하지만 배포 절차가 막힌다.
- 근거: packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql:19, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:6
- 완료 조건: 스테이징 동일 SHA 적용 후 rpc_executor_role=1과 사후조건 통과를 기록한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### P05-EDIT-EXECUTOR-REVOKE-MAINT — ADD

- 대상: `packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql`
- 위치:   grant execute on all functions in schema public to sikjae_rpc_executor, service_role;
- 연결 Finding: P05-SEC-EXECUTOR-BLANKET-EXECUTE
- 이유: executor의 폭발 반경을 facade가 실제로 필요로 하는 내부 도우미로 좁힌다(시그니처는 0173/0135/0137 정의와 대조 필요).

      -- 실행 역할은 RLS 우회·매장 파괴 유지보수 함수를 실행할 이유가 없다.
      revoke execute on function
        public.purge_archived_store(uuid, text),
        public.schedule_store_purge(uuid, timestamptz, text, text, text),
        public.purge_entity_changes(),
        public.close_due_business_days()
      from sikjae_rpc_executor;

### P05-EDIT-TEST34-CROSS-STORE — ADD

- 대상: `packages/db/tests/34_rpc_least_privilege.sql`
- 위치: -- ── 3. 내부 몸통은 PostgREST에서 직접 호출할 수 없다 ───────────────────────
- 연결 Finding: P05-SEC-FACADE-CROSS-STORE-TEST-GAP, P05-SEC-EXECUTOR-BLANKET-EXECUTE
- 이유: P0-5-4를 앱 실제 역할에서 행동으로 증명한다. 기대 SQLSTATE는 assert_my_store의 실제 예외 코드에 맞춰 조정한다.

    -- ── 2b. definer facade를 통해서도 다른 사장님 매장은 닿지 않는다 ───────────
    
    select pg_temp.raises('facade 경유 다른 매장 설정 조회 거부',
      format('select get_settings(%L)', current_setting('sikjae.test.foreign_store')), 'P0001');
    select pg_temp.raises('facade 경유 다른 매장 쓰기 거부',
      format('select save_category(%L, %L::jsonb)', current_setting('sikjae.test.foreign_store'),
             '{"name":"P0-5 침입","sort_order":1}'), 'P0001');
    select pg_temp.raises('실행 역할 유지보수 함수 직접 호출 거부',
      format('select purge_archived_store(%L, %L)', current_setting('sikjae.test.foreign_store'), 'x'), '42501');

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P05-SEC-EVIDENCE-HASH-MISMATCH, P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-FACADE-CROSS-STORE-TEST-GAP

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
