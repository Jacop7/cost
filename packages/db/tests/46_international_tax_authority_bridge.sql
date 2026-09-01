-- ═══════════════════════════════════════════════════════════════
-- 46 · INTL-1F 국제 세금 확정값과 기존 손익 합계의 단일 권위
-- ═══════════════════════════════════════════════════════════════

do $authority$
declare
  v_date date;
  v_sales uuid;
  v_item uuid;
  v_recipe uuid;
  v_market uuid;
  v_tax uuid;
  v_component uuid;
  v jsonb;
  v_qty numeric;
  v_tax_total numeric;
begin
  execute 'reset role';
  select max(sale_date) into v_date from daily_sales where store_id=pg_temp.store();
  select i.id,i.recipe_id,i.daily_sales_id into v_item,v_recipe,v_sales
    from daily_sales_items i join daily_sales d on d.id=i.daily_sales_id
   where i.store_id=pg_temp.store() and d.sale_date=v_date
     and i.qty_hall+i.qty_delivery+i.qty_takeout>0
   order by i.id limit 1;
  if v_item is null then raise exception '46: 판매행 픽스처가 없습니다'; end if;

  insert into store_market_profiles(
    store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_date)
  returning id into v_market;
  insert into store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_tax;
  insert into store_tax_components(
    store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_tax,'primary','primary','부가세',10,'national',
    'primary_tax_exclusive',array['taxable'::tax_treatment]) returning id into v_component;
  insert into channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_component,'hall','merchant'),
        (pg_temp.store(),v_component,'delivery','merchant'),
        (pg_temp.store(),v_component,'takeout','merchant');
  insert into tax_category_catalog(store_id,tax_profile_id,code,name,treatment)
  values(pg_temp.store(),v_tax,'standard','일반 과세','taxable');
  insert into international_tax_activation_boundaries(
    store_id,activation_date,minimum_app_version,reason)
  values(pg_temp.store(),v_date,'0.2.0','release_cutover');
  perform set_config('margincook.international_tax_force','owner_test',true);
  perform set_config('margincook.international_tax_activation_test','on',true);

  v:=apply_international_tax_for_sales_item(v_item,true);
  select sum(final_quantity),sum(tax_total) into v_qty,v_tax_total
    from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item;
  perform pg_temp.ok('메뉴 국제 세금 합계가 기존 손익 unit_tax에 그대로 연결된다',
    (v->>'enabled')::boolean and v_qty>0
    and abs((select unit_tax*v_qty from daily_sales_items where id=v_item)-v_tax_total)<0.000001
    and (select unit_tax_calculation_version='international_tax_v1'
           from daily_sales_items where id=v_item));

  update daily_sales set etc_items='[{"name":"음료","channel":"hall","price":1000,"qty":1}]'::jsonb,
    etc_revenue=1000 where id=v_sales;
  v:=apply_international_tax_for_daily_sales(v_sales);
  perform pg_temp.ok('기타매출도 KRW 구성별 반올림 세액과 프로필 판본을 함께 굳힌다',
    (v->>'tax_total')::numeric=91
    and (select etc_tax=91 and etc_tax_calculation_version='international_tax_v1'
          and etc_tax_snapshot#>>'{tax_profile_revision}'='1'
          and jsonb_array_length(etc_tax_snapshot->'lines')=1
         from daily_sales where id=v_sales));

  v:=recipe_tax_app_state(pg_temp.store(),v_recipe);
  perform pg_temp.ok('메뉴 현재 세금도 DB numeric quote로 반환한다',
    v->'quote' is not null and (v#>>'{quote,tax_total}')::numeric>0
    and v->>'currency_code'='KRW' and (v->>'minor_unit')::integer=0);
  v:=international_tax_app_state(pg_temp.store());
  perform pg_temp.ok('세금 설정 응답은 저장에 필요한 구성 안정 키를 준다',
    v#>>'{tax_profile,components,0,config_key}'='primary');
  execute 'set local role margincook_rpc_executor';
end
$authority$;

do $acl$
begin
  perform pg_temp.ok('기타매출 계산 몸통은 앱 역할에 직접 열리지 않는다',
    not has_function_privilege('authenticated',
      'public.apply_international_tax_for_daily_sales(uuid)','execute'));
end
$acl$;
