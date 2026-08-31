# INTL-1B-IMPLEMENTATION-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`

## 요약

0179 스키마는 INTL-1B 요구 구조를 충실히 구현했다. 시장·세금 프로필의 매장 경계(복합 FK id+store_id)·적용 구간 비중첩(advisory lock+trigger)·5개국 국가·통화·업무 로케일 조합 check, 기본세 1개 제약, 카테고리/override 배타 저장, 항목×채널 납부 주체, snapshot 원본 등식 guard, append-only 이벤트 원장, 앱 롤 직접 권한 0건과 capability 비활성, 0090 tax_of 불변 사후조건을 확인했다. DB enum 11종과 TypeScript 상수의 값·순서 parity, 시험 38, upgrade 시나리오 ⑮의 전후 불변 판별, ACL 감사의 원장 13종 목록 확장, RPC 허용 목록 66 불변, 문서의 게이트 미완 명시(INTL-1B-008 충족)도 확인했다. 그러나 두 가지 Major 틈이 있다. (1) sales_tax_events는 stores·daily_sales_items를 on delete cascade로 참조하는데 cascade 삭제도 행 단위 BEFORE DELETE 트리거를 발화시켜 42501로 중단되므로, 이벤트가 쌓인 뒤에는 공식 보존 정책 문인 purge_archived_store와 판매행 삭제 경로가 영구 실패할 수 있다. 공식 삭제 의미론을 스키마 단계에서 결정·시험해야 한다. (2) 프로필·구성 항목 내용을 revision 변경 없이 UPDATE하는 것을 막는 장치가 없어 (profile_id, revision)이 내용을 유일하게 식별하지 못하고, snapshot 원본 등식 guard와 INTL-1B-001/002의 revision 보존 주장이 무력화될 수 있다. 시장 프로필 기간 축소 시 내부 세금 프로필 재검증도 없다. 추가로 required_evidence가 약속한 교차 매장 차단을 시험 38이 직접 재지 않는 Minor TEST_GAP과, guard의 minor_unit 매핑(KRW=0, 그 외 2)이 LAUNCH_MARKETS.minorUnit과 이중 소스인데 parity 시험이 대조하지 않는 Improvement가 있다. 제안 편집 3건(내용 불변 guard, 삭제 의미론 결정 주석, 교차 매장 raises 시험)을 첨부했다.

## Findings

### INTL1B-EVENTS-CASCADE-PURGE-CONFLICT — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 이벤트가 한 줄이라도 기록된 뒤에는 stores·daily_sales_items의 cascade 삭제(계정 삭제·폐점 후 물리 삭제, 판매행 삭제 경로)가 append-only 트리거의 42501로 전부 중단된다. 지금은 표가 비어 있어 잠복하지만 INTL-1D 쓰기 시작과 동시에 보존 정책(purge_archived_store)과 정면 충돌하는 설계 결함이 이 스키마 단계에 고정된다.
- 근거: packages/db/supabase/migrations/20260831000179_international_tax_schema.sql:265, packages/db/supabase/migrations/20260831000179_international_tax_schema.sql:459, packages/db/tests/34_rpc_least_privilege.sql:27, AGENTS.md:61
- 완료 조건: 승인된 삭제 경로(매장 purge 등)와 append-only 원장의 공존 의미론을 명시적으로 결정한다(공식 purge 경로 한정 우회, 또는 on delete restrict + 문서화된 보존 정책 등). / sales_tax_events 행이 존재하는 매장에서 공식 삭제 절차가 결정된 의미론대로 동작함을 DB 시험이 판별한다. / 결정 내용이 0179(또는 후속 migration)와 packages/db/README.md 원장 목록에 반영된다.
- 필요한 테스트: sales_tax_events가 있는 매장의 purge_archived_store(또는 공식 삭제 경로) 동작 시험 / daily_sales_items 삭제 경로와 세금 이벤트 공존 시험

### INTL1B-PROFILE-REVISION-MUTABILITY — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: 미래 RPC나 결함 있는 executor 코드가 rate_pct·통화·기준 등 내용을 revision 상승 없이 갱신하면 같은 (profile_id, revision)의 판매 스냅샷 간 감사 추적이 무너진다. INTL-1B가 스스로 주장하는 'revision을 매장별로 보존'하는 저장 경계가 DB 수준에서 강제되지 않아 후속 계산·감사가 갈릴 틈이 된다.
- 근거: packages/db/supabase/migrations/20260831000179_international_tax_schema.sql:68, packages/db/supabase/migrations/20260831000179_international_tax_schema.sql:296, packages/db/supabase/migrations/20260831000179_international_tax_schema.sql:400
- 완료 조건: 시장·세금 프로필의 내용 열(effective_to 마감 제외)을 revision 상승 없이 UPDATE하면 실패 폐쇄하는 guard를 추가한다. / store_tax_components의 값 열(sort_order 등 표시 열 제외)의 UPDATE를 새 프로필 revision으로만 허용하도록 강제한다. / 시장 프로필 기간 축소 시 내부 세금 프로필이 범위를 벗어나면 거부하거나 재검증한다. / DB 시험 38이 revision 불변 내용 변경 거부를 판별한다.
- 필요한 테스트: revision 동일 상태의 프로필 내용 UPDATE 거부 시험 / 구성 항목 값 UPDATE 거부 시험 / 시장 프로필 기간 축소 시 내부 세금 프로필 이탈 거부 시험

### INTL1B-TEST-CROSS-STORE-GAP — Minor / OPEN

- 범주: TEST_GAP
- 영향: 복합 FK(id, store_id)와 guard가 교차 매장 참조를 구조적으로 막고는 있으나, 이를 판별하는 회귀 시험이 없어 후속 리팩터링(예: 복합 unique 제거)이 조용히 경계를 무너뜨려도 시험이 통과한다.
- 근거: packages/db/tests/38_international_tax_schema.sql:197, COLLABORATION_LOG:0
- 완료 조건: 다른 매장의 market/tax profile·component를 참조하는 snapshot·component snapshot insert가 거부되는 raises 시험을 38에 추가한다. / 다른 세금 프로필 소속 카테고리를 참조하는 menu_tax_overrides insert 거부 시험을 추가한다.
- 필요한 테스트: 교차 매장 프로필 참조 snapshot insert 거부 / 교차 프로필 카테고리 override insert 거부

### INTL1B-MINORUNIT-DUAL-SOURCE — Improvement / OPEN

- 범주: CODE
- 영향: 새 통화 추가 시 DB guard와 TypeScript metadata가 서로 다르게 갱신돼도 자동 검증이 잡지 못한다. 지금은 값이 일치해 동작 문제는 없다.
- 근거: packages/db/supabase/migrations/20260831000179_international_tax_schema.sql:313, packages/types/src/international.ts:56
- 완료 조건: internationalDbParity 시험이 통화별 minor_unit 매핑을 DB guard 기준값과 대조하거나, 매핑을 단일 소스(예: DB 함수/카탈로그)로 통합한다.
- 필요한 테스트: 통화별 minor_unit DB↔TypeScript parity 시험

## 공동 편집 제안

### E1-PROFILE-VERSION-IMMUTABLE — ADD

- 대상: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`
- 위치: for each row execute function public.guard_tax_profile_range();
- 연결 Finding: INTL1B-PROFILE-REVISION-MUTABILITY
- 이유: snapshot guard의 'revision = 현재 프로필 revision' 등식이 의미를 갖도록 revision 불변 내용 변경을 실패 폐쇄한다. effective_to 마감(구간 종료)만 revision 상승 없이 허용하고, 구성 항목은 표시용 sort_order 외의 값 변경을 거부한다. 시장 프로필 기간 축소 시 내부 세금 프로필 재검증은 별도 결정이 필요하다.

    
    -- ── 판본이 가리키는 내용은 불변이다. 새 내용은 새 revision으로만 들어온다 ──────
    create or replace function public.guard_profile_version_immutable()
    returns trigger
    language plpgsql
    set search_path = public
    as $$
    begin
      if new.revision = old.revision
         and (to_jsonb(new) - 'effective_to') is distinct from (to_jsonb(old) - 'effective_to') then
        raise exception '프로필 내용은 revision을 올리지 않고 바꿀 수 없어요'
          using errcode = '23514', detail = 'PROFILE_CONTENT_REQUIRES_NEW_REVISION';
      end if;
      return new;
    end;
    $$;
    create trigger store_market_profiles_version_guard
    before update on public.store_market_profiles
    for each row execute function public.guard_profile_version_immutable();
    create trigger store_tax_profiles_version_guard
    before update on public.store_tax_profiles
    for each row execute function public.guard_profile_version_immutable();
    
    create or replace function public.guard_tax_component_immutable()
    returns trigger
    language plpgsql
    set search_path = public
    as $$
    begin
      if (to_jsonb(new) - 'sort_order') is distinct from (to_jsonb(old) - 'sort_order') then
        raise exception '세금 구성 항목 값은 새 세금 프로필 revision으로만 바꿀 수 있어요'
          using errcode = '23514', detail = 'TAX_COMPONENT_REQUIRES_NEW_PROFILE_REVISION';
      end if;
      return new;
    end;
    $$;
    create trigger store_tax_components_immutable_guard
    before update on public.store_tax_components
    for each row execute function public.guard_tax_component_immutable();

### E2-EVENTS-DELETE-SEMANTICS-DECISION — COMMENT

- 대상: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`
- 위치: create trigger sales_tax_events_immutable_truncate
- 연결 Finding: INTL1B-EVENTS-CASCADE-PURGE-CONFLICT
- 이유: append-only 불변식과 매장 물리 삭제 보존 정책의 충돌은 INTL-1D 쓰기 시작 전에 스키마 소유 단계에서 결정돼야 한다.

    결정 필요: store_id·daily_sales_item_id의 on delete cascade는 cascade 삭제 시에도 이 BEFORE DELETE 행 트리거를 발화시켜 42501로 부모 삭제 전체를 중단시킨다. 이벤트가 쌓인 뒤에는 purge_archived_store(보존 종료 물리 삭제)와 판매행 삭제 경로가 영구 실패한다. (a) 공식 purge 경로에서만 허용되는 명시적 우회(예: 트리거가 검사하는 승인 GUC 또는 purge 몸통의 선삭제 절차), 또는 (b) on delete restrict + 문서화된 보존·삭제 정책 중 하나를 스키마 단계에서 결정하고, sales_tax_events가 존재하는 매장의 공식 삭제 절차 DB 시험을 추가해 주세요.

### E3-CROSS-STORE-RAISES — ADD

- 대상: `packages/db/tests/38_international_tax_schema.sql`
- 위치: do $rls$
- 연결 Finding: INTL1B-TEST-CROSS-STORE-GAP
- 이유: required_evidence의 '교차 매장 차단'을 회귀 시험으로 판별한다. foreign_store fixture 이름과 필드 채움은 기존 harness 관례에 맞게 통합 시 조정해 달라.

    -- 교차 매장·교차 프로필 참조는 복합 FK·guard가 거부해야 한다.
    do $cross$
    declare
      v_my_market uuid;
      v_my_tax uuid;
      v_my_item uuid;
      v_foreign_store uuid := current_setting('margincook.test.foreign_store', true)::uuid;
    begin
      select id into v_my_market from store_market_profiles where store_id = pg_temp.store() limit 1;
      select id into v_my_tax from store_tax_profiles where store_id = pg_temp.store() limit 1;
      select id into v_my_item from daily_sales_items where store_id = pg_temp.store() order by created_at, id limit 1;
      -- 다른 매장 store_id로 내 프로필을 참조하는 snapshot은 복합 FK가 거부한다.
      perform pg_temp.raises('다른 매장 경계로 내 프로필을 참조하는 스냅샷은 거부된다', format(
        'insert into daily_sales_item_tax_snapshots(store_id,daily_sales_item_id,sales_channel_code,market_profile_id,market_profile_revision,tax_profile_id,tax_profile_revision,country_code,currency_code,minor_unit,price_basis,treatment,calculation_version,unit_price,final_quantity,listed_total,net_sales,customer_total,tax_total,merchant_tax_liability,marketplace_tax_liability,input_snapshot,amount_snapshot) values (%L,%L,''delivery'',%L,1,%L,1,''KR'',''KRW'',0,''tax_inclusive'',''taxable'',''international_tax_v1'',100,1,100,90,100,10,10,0,''{}'',''{}'')',
        coalesce(v_foreign_store, gen_random_uuid()), v_my_item, v_my_market, v_my_tax), '23503');
      -- 존재하지 않는(다른 프로필 소속) 카테고리 코드는 복합 FK가 거부한다.
      perform pg_temp.raises('다른 세금 프로필의 카테고리 코드는 override에 쓸 수 없다', format(
        'insert into menu_tax_overrides(recipe_id,store_id,tax_profile_id,tax_category) values (%L,%L,%L,''foreign_category'')',
        pg_temp.rcp('제육볶음'), pg_temp.store(), v_my_tax), '23503');
    end
    $cross$;
    
    

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: INTL1B-EVENTS-CASCADE-PURGE-CONFLICT, INTL1B-PROFILE-REVISION-MUTABILITY, INTL1B-TEST-CROSS-STORE-GAP

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
