\echo '--- 43 국제 세금 shadow read ---'

set local role postgres;

do $t$
declare
  v_item uuid;
  v_date date;
  v_market uuid;
  v_tax uuid;
  v_primary uuid;
  v_result jsonb;
  v_line jsonb;
  v_snapshot_count bigint;
  v_event_count bigint;
begin
  select i.id,d.sale_date into v_item,v_date
    from daily_sales_items i join daily_sales d on d.id=i.daily_sales_id
   where i.store_id=pg_temp.store() and i.recipe_id=pg_temp.rcp('제육볶음')
   order by d.sale_date desc limit 1;
  update daily_sales_items set unit_price=12000,unit_tax=tax_of(12000,'included','[{"name":"부가세","rate":9.0909090909}]'),
    qty_hall=1,qty_delivery=0,qty_takeout=0 where id=v_item;
  insert into store_market_profiles(store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_date) returning id into v_market;
  insert into store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_tax;
  insert into store_tax_components(store_id,tax_profile_id,kind,name,rate_pct,jurisdiction_level,calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_tax,'primary','부가세',10,'national','primary_tax_exclusive',array['taxable'::tax_treatment])
  returning id into v_primary;
  insert into channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_primary,'hall','merchant'),(pg_temp.store(),v_primary,'delivery','merchant'),(pg_temp.store(),v_primary,'takeout','merchant');

  select count(*) into v_snapshot_count from daily_sales_item_tax_snapshots;
  select count(*) into v_event_count from sales_tax_events;
  v_result:=international_tax_shadow_compare(pg_temp.store(),v_date);
  select x into v_line from jsonb_array_elements(v_result->'lines') x
   where x->>'daily_sales_item_id'=v_item::text and x->>'sales_channel_code'='hall';
  perform pg_temp.ok('shadow는 legacy 1,090.909…원과 국제 반올림 1,091원을 같은 입력으로 비교한다',
    v_line->>'status'='compared'
    and abs((v_line->>'legacy_tax_total')::numeric-1090.909090908)<0.000001
    and (v_line->>'international_tax_total')::numeric=1091
    and (v_line->>'delta')::numeric<>0);
  perform pg_temp.ok('shadow read는 snapshot·이벤트를 전혀 쓰지 않는다',
    (select count(*) from daily_sales_item_tax_snapshots)=v_snapshot_count
    and (select count(*) from sales_tax_events)=v_event_count);
  perform pg_temp.ok('shadow 응답은 비교·건너뜀 수와 합계를 함께 낸다',
    (v_result->>'comparable_lines')::integer>=1
    and jsonb_typeof(v_result->'lines')='array');
end
$t$;

set local role margincook_rpc_executor;
select pg_temp.raises('앱 RPC 실행 역할은 전 매장 shadow 대조를 부를 수 없다',
  format('select international_tax_shadow_compare(%L,%L)',pg_temp.store(),pg_temp.today()),'42501');
select pg_temp.ok('shadow 대조는 service_role 전용이다',
  has_function_privilege('service_role','public.international_tax_shadow_compare(uuid,date)','execute')
  and not has_function_privilege('authenticated','public.international_tax_shadow_compare(uuid,date)','execute'));
