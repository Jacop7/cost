-- ═══════════════════════════════════════════════════════════════
-- 45 · INTL-1F 국제 세금 활성일 이전 과거 정정 차단
-- ═══════════════════════════════════════════════════════════════

do $boundary$
declare
  v_min date;
  v_max date;
  v_old_item uuid;
  v_new_item uuid;
  v_market uuid;
  v_tax uuid;
  v_component uuid;
  v jsonb;
begin
  execute 'reset role';
  select min(d.sale_date),max(d.sale_date) into v_min,v_max
    from daily_sales d where d.store_id=pg_temp.store();
  if v_min>=v_max then raise exception '45: 경계를 가를 판매일 픽스처가 부족합니다'; end if;
  select i.id into v_old_item from daily_sales_items i join daily_sales d on d.id=i.daily_sales_id
   where i.store_id=pg_temp.store() and d.sale_date=v_min order by i.id limit 1;
  select i.id into v_new_item from daily_sales_items i join daily_sales d on d.id=i.daily_sales_id
   where i.store_id=pg_temp.store() and d.sale_date=v_max order by i.id limit 1;
  insert into store_market_profiles(
    store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_min) returning id into v_market;
  insert into store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_min) returning id into v_tax;
  insert into store_tax_components(
    store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_tax,'primary','primary','VAT',10,'national',
    'primary_tax_exclusive',array['taxable'::tax_treatment]) returning id into v_component;
  insert into channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_component,'hall','merchant'),
        (pg_temp.store(),v_component,'delivery','merchant'),
        (pg_temp.store(),v_component,'takeout','merchant');
  insert into international_tax_activation_boundaries(
    store_id,activation_date,minimum_app_version,reason)
  values(pg_temp.store(),v_max,'0.2.0','release_cutover');
  perform set_config('margincook.international_tax_force','owner_test',true);
  perform set_config('margincook.international_tax_activation_test','on',true);

  v:=apply_international_tax_for_sales_item(v_old_item,true);
  perform pg_temp.ok('활성일 전 과거 정정은 국제 snapshot을 새로 만들지 않는다',
    v->>'reason'='before_activation'
    and not exists(select 1 from daily_sales_item_tax_snapshots where daily_sales_item_id=v_old_item));
  v:=apply_international_tax_for_sales_item(v_new_item,true);
  perform pg_temp.ok('활성일 당일 판매부터 국제 snapshot을 만든다',
    (v->>'enabled')::boolean
    and exists(select 1 from daily_sales_item_tax_snapshots where daily_sales_item_id=v_new_item));
  perform pg_temp.raises('한 번 기록한 활성 경계는 옮길 수 없다',format(
    'update international_tax_activation_boundaries set activation_date=%L::date where store_id=%L::uuid',
    v_min,pg_temp.store()),'42501');
  execute 'set local role margincook_rpc_executor';
end
$boundary$;

do $acl$
begin
  perform pg_temp.ok('활성 경계 표와 계산 몸통은 앱 롤에 닫혀 있다',
    not has_table_privilege('authenticated','public.international_tax_activation_boundaries','select')
    and not has_function_privilege('authenticated',
      'public.apply_international_tax_for_sales_item_body(uuid,boolean)','execute'));
end
$acl$;
