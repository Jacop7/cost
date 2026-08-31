-- ═══════════════════════════════════════════════════════════════
-- 39 · INTL-1C 현행 세금 감사·명확한 미래 프로필·관할 카탈로그
-- ═══════════════════════════════════════════════════════════════

select pg_temp.ok('미국 50개 주와 DC, 캐나다 13개 주·준주를 제품 카탈로그가 안다',
  (select count(*) from tax_region_catalog where country_code = 'US') = 51
  and (select count(*) from tax_region_catalog where country_code = 'CA') = 13
  and exists (select 1 from tax_region_catalog
               where country_code='US' and region_code='US-CA'
                 and jurisdiction_level='state' and name='California')
  and exists (select 1 from tax_region_catalog
               where country_code='CA' and region_code='CA-ON'
                 and jurisdiction_level='province' and name='Ontario'));

set local role postgres;

-- fresh DB는 migration 뒤에 seed가 실행되므로 seed 매장은 0180의 배포 시점 감사 대상이 아니다.
-- 기존 행의 명확/수동 분기는 upgrade 시나리오 ⑯이 0179 상태에서 실제로 재현한다.
select pg_temp.ok('배포 시점 감사 행은 있으면 프로필·판본 계약이 완결돼 있다',
  not exists (
    select 1 from international_tax_migration_audits a
     where a.legacy_calculation_version <> 'legacy_effective_rate_v1'
        or (a.decision='auto_profile_created' and not exists (
          select 1 from store_tax_profile_contract p
           where p.id=a.tax_profile_id and p.market_profile_id=a.market_profile_id
             and p.country_code='KR' and p.region_code is null))
        or (a.decision='manual_review_required'
            and (cardinality(a.reason_codes)=0 or a.market_profile_id is not null or a.tax_profile_id is not null))
  ));

select pg_temp.ok('세금 프로필의 국가·지역은 저장 열이 아니라 시장 프로필 파생 조회값이다',
  not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='store_tax_profiles'
       and column_name in ('country_code','region_code')
  ));

select pg_temp.ok('기존 메뉴·기타매출 세금 합계는 legacy 판본이고 상세를 역산하지 않았다',
  not exists (select 1 from daily_sales_items where unit_tax_calculation_version <> 'legacy_effective_rate_v1')
  and not exists (select 1 from daily_sales where etc_tax_calculation_version <> 'legacy_effective_rate_v1')
  and not exists (select 1 from daily_sales_item_tax_snapshots)
  and not exists (select 1 from daily_sales_item_tax_component_snapshots)
  and not exists (select 1 from sales_tax_events));

select pg_temp.ok('이관 감사 원본은 앱·서비스·RPC 실행 역할에 닫혀 있다',
  not has_table_privilege('authenticated','international_tax_migration_audits','SELECT')
  and not has_table_privilege('anon','international_tax_migration_audits','SELECT')
  and not has_table_privilege('service_role','international_tax_migration_audits','SELECT')
  and not has_table_privilege('margincook_rpc_executor','international_tax_migration_audits','SELECT'));

select pg_temp.ok('세금 프로필 파생 조회도 capability 전에는 앱·서비스 역할에 닫혀 있다',
  not has_table_privilege('authenticated','store_tax_profile_contract','SELECT')
  and not has_table_privilege('anon','store_tax_profile_contract','SELECT')
  and not has_table_privilege('service_role','store_tax_profile_contract','SELECT'));

do $audit_immutable$
declare
  v_owner uuid;
  v_store uuid;
  v_audit uuid;
begin
  v_owner := pg_temp.new_owner();
  perform pg_temp.as_owner(v_owner);
  v_store := (create_store('이관 감사 삭제 시험', 'Asia/Seoul')->>'store_id')::uuid;
  set local role postgres;
  insert into international_tax_migration_audits(
    store_id,source_tax_items,source_recipe_mismatch_count,source_daily_sales_count,
    source_sales_item_count,source_menu_tax_total,source_etc_revenue_total,source_etc_tax_total,
    decision,reason_codes
  ) values (
    v_store,'[]',0,0,0,0,0,0,'manual_review_required',array['settings_missing']
  ) returning id into v_audit;
  perform pg_temp.raises('소유자도 이관 감사 행을 수정할 수 없다',
    format('update international_tax_migration_audits set source_etc_tax_total=1 where id=%L', v_audit),
    '42501');
  perform pg_temp.raises('소유자도 이관 감사 행을 직접 지울 수 없다',
    format('delete from international_tax_migration_audits where id=%L', v_audit),
    '42501');
  perform pg_temp.raises('소유자도 이관 감사 원본을 비울 수 없다',
    'truncate international_tax_migration_audits', '42501');

  perform pg_temp.as_owner(v_owner);
  perform archive_my_store(v_store, '이관 감사 수명주기 시험');
  set local role service_role;
  perform schedule_store_purge(
    v_store, clock_timestamp(), '운영책임자',
    'INTL-1C-AUDIT-PURGE-APPROVAL', '보존 기간 종료');
  perform purge_archived_store(v_store, 'INTL-1C-AUDIT-PURGE-BACKUP');
  set local role postgres;
  perform pg_temp.ok('승인·백업을 확인한 매장 물리 삭제는 이관 감사도 함께 지운다',
    not exists (select 1 from international_tax_migration_audits where store_id = v_store));
  perform pg_temp.as_owner(pg_temp.owner());
end
$audit_immutable$;

set local role margincook_rpc_executor;

do $regional_profile_path$
declare
  v_owner uuid;
  v_store uuid;
  v_market uuid;
  v_tax uuid;
begin
  v_owner := pg_temp.new_owner();
  perform pg_temp.as_owner(v_owner);
  v_store := (create_store('California test store', 'America/Los_Angeles')->>'store_id')::uuid;

  perform pg_temp.raises('제품 카탈로그에 없는 미국 지역은 거부한다', format(
    'insert into store_market_profiles(store_id,country_code,region_code,currency_code,business_locale_code,price_basis,effective_from) values (%L,''US'',''US-ZZ'',''USD'',''en-US'',''tax_exclusive'',%L)',
    v_store, store_local_date(v_store)), '23503');
  insert into store_market_profiles(
    store_id,country_code,region_code,currency_code,business_locale_code,price_basis,effective_from
  ) values (
    v_store,'US','US-CA','USD','en-US','tax_exclusive',store_local_date(v_store)
  ) returning id into v_market;
  insert into store_tax_profiles(
    store_id,market_profile_id,default_treatment,effective_from
  ) values (
    v_store,v_market,'taxable',store_local_date(v_store)
  ) returning id into v_tax;

  perform pg_temp.ok('지역 필수 미국 시장 프로필의 US-CA 성공 경로가 실제로 열린다',
    exists (select 1 from store_tax_profile_contract
             where id=v_tax and store_id=v_store
               and country_code='US' and region_code='US-CA'));

  perform pg_temp.as_owner(pg_temp.owner());
end
$regional_profile_path$;

select pg_temp.ok('감사·이관 뒤에도 국제 세금 읽기·쓰기는 비활성이다',
  (app_capabilities()#>>'{international_tax,read_enabled}')::boolean is false
  and (app_capabilities()#>>'{international_tax,write_enabled}')::boolean is false);
