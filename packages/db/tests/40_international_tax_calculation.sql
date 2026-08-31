-- ═══════════════════════════════════════════════════════════════
-- 40 · INTL-1D SQL 권위 계산·당시 프로필·목표 수량 세금 원장
-- ═══════════════════════════════════════════════════════════════

set local role postgres;

do $formula$
declare
  v_components jsonb := jsonb_build_array(
    jsonb_build_object(
      'component_id','00000000-0000-0000-0000-0000000000c1','kind','primary','name','Primary',
      'rate_pct',10,'jurisdiction_level','national','calculation_basis','primary_tax_exclusive',
      'applies_to_treatments',jsonb_build_array('taxable'),'remittance_owner','merchant'),
    jsonb_build_object(
      'component_id','00000000-0000-0000-0000-0000000000c2','kind','additional','name','Additional',
      'rate_pct',5,'jurisdiction_level','state','calculation_basis','primary_tax_inclusive',
      'applies_to_treatments',jsonb_build_array('taxable'),'remittance_owner','marketplace'));
  v jsonb;
begin
  v := calculate_international_tax('tax_inclusive',0::smallint,'taxable',12000,jsonb_build_array(v_components->0));
  perform pg_temp.ok('KR 포함가 12,000원 = 순매출 10,909원 + 기본세 1,091원',
    (v->>'listed_total')::numeric=12000 and (v->>'net_sales')::numeric=10909
    and (v->>'tax_total')::numeric=1091 and (v->>'customer_total')::numeric=12000);

  v := calculate_international_tax('tax_exclusive',2::smallint,'taxable',10,v_components);
  perform pg_temp.ok('USD 미포함 10.00 = 기본세 1.00 + 기본세 포함 추가세 0.55',
    (v->>'net_sales')::numeric=10 and (v->>'tax_total')::numeric=1.55
    and (v->>'customer_total')::numeric=11.55
    and (v#>>'{components,0,rounded_amount}')::numeric=1
    and (v#>>'{components,1,rounded_amount}')::numeric=0.55);

  v := calculate_international_tax('tax_inclusive',2::smallint,'taxable',11.55,v_components);
  perform pg_temp.ok('USD 포함가 11.55 = 순매출 10.00 + 세금 1.55',
    (v->>'net_sales')::numeric=10 and (v->>'tax_total')::numeric=1.55
    and (v->>'customer_total')::numeric=11.55);

  v := calculate_international_tax('tax_inclusive',2::smallint,'exempt',10,v_components);
  perform pg_temp.ok('면세는 의미를 보존하고 적용 대상이 아닌 세액은 0이다',
    (v->>'tax_total')::numeric=0 and (v->>'net_sales')::numeric=10);
  v_components := jsonb_set(v_components,'{1,applies_to_treatments}','["zero_rated"]'::jsonb);
  v := calculate_international_tax('tax_exclusive',2::smallint,'zero_rated',10,v_components);
  perform pg_temp.ok('0% 과세에 명시 적용된 추가세는 기본세율 0의 기준으로 계산한다',
    (v->>'tax_total')::numeric=0.50
    and (v#>>'{components,0,rounded_amount}')::numeric=0
    and (v#>>'{components,1,rounded_amount}')::numeric=0.50);
  perform pg_temp.raises('기본세가 없으면 실패 폐쇄한다',
    format('select calculate_international_tax(''tax_inclusive'',0::smallint,''taxable'',1,%L::jsonb)',
      jsonb_build_array(v_components->1)::text), '22000');
end
$formula$;

do $reconcile$
declare
  v_item uuid;
  v_date date;
  v_market uuid;
  v_tax uuid;
  v_primary uuid;
  v_new_market uuid;
  v_new_tax uuid;
  v_events integer;
  v_stamp timestamptz;
  v_result jsonb;
begin
  select i.id,ds.sale_date into v_item,v_date
    from daily_sales_items i
    join daily_sales ds on ds.id=i.daily_sales_id
   where i.store_id=pg_temp.store() and i.recipe_id=pg_temp.rcp('제육볶음')
     and ds.business_day_id is not null
   order by ds.sale_date desc limit 1;
  if v_item is null then raise exception 'FAIL  국제 세금 계산 시험 판매행이 없다'; end if;

  insert into store_market_profiles(
    store_id,country_code,currency_code,business_locale_code,price_basis,effective_from,revision)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive','-infinity',1)
  returning id into v_market;
  insert into store_tax_profiles(
    store_id,market_profile_id,default_treatment,effective_from,revision)
  values(pg_temp.store(),v_market,'taxable','-infinity',1)
  returning id into v_tax;
  insert into store_tax_components(
    store_id,tax_profile_id,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_tax,'primary','부가세',10,'national',
         'primary_tax_exclusive',array['taxable'::tax_treatment])
  returning id into v_primary;
  insert into channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_primary,'hall','merchant'),
        (pg_temp.store(),v_primary,'delivery','merchant'),
        (pg_temp.store(),v_primary,'takeout','merchant');

  update daily_sales_items set unit_price=12000,qty_hall=1,qty_delivery=0,qty_takeout=0 where id=v_item;
  perform pg_temp.ok('capability가 꺼진 실제 판매 trigger는 국제 snapshot·이벤트를 만들지 않는다',
    not exists(select 1 from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item)
    and not exists(select 1 from sales_tax_events where daily_sales_item_id=v_item));
  v_result := apply_international_tax_for_sales_item(v_item,true);
  perform pg_temp.ok('판매행 첫 계산은 당시 프로필을 굳히고 한 채널만 만든다',
    (v_result->>'changed')::boolean
    and (select count(*) from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item)=1
    and exists(select 1 from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item
      and sales_channel_code='hall' and final_quantity=1 and listed_total=12000
      and net_sales=10909 and tax_total=1091 and customer_total=12000));
  perform pg_temp.eq('첫 세금 이벤트 합은 구성 snapshot과 같다',
    (select sum(delta_amount) from sales_tax_events where daily_sales_item_id=v_item),1091,0);

  select count(*) into v_events from sales_tax_events where daily_sales_item_id=v_item;
  select updated_at into v_stamp from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item;
  v_result := apply_international_tax_for_sales_item(v_item,true);
  perform pg_temp.ok('같은 목표 재호출은 이벤트·snapshot 시각을 늘리지 않는다',
    not (v_result->>'changed')::boolean
    and (select count(*) from sales_tax_events where daily_sales_item_id=v_item)=v_events
    and (select updated_at from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item)=v_stamp);

  -- 현재 프로필을 바꿔도 기존 계산선은 원판매 snapshot으로 감소·취소한다.
  update store_tax_profiles set effective_to=v_date where id=v_tax;
  update store_market_profiles set effective_to=v_date where id=v_market;
  insert into store_market_profiles(
    store_id,country_code,currency_code,business_locale_code,price_basis,effective_from,revision)
  values(pg_temp.store(),'KR','KRW','ko-KR','tax_inclusive',v_date+1,2)
  returning id into v_new_market;
  insert into store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from,revision)
  values(pg_temp.store(),v_new_market,'taxable',v_date+1,2) returning id into v_new_tax;
  insert into store_tax_components(
    store_id,tax_profile_id,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_new_tax,'primary','새 세율',20,'national',
         'primary_tax_exclusive',array['taxable'::tax_treatment]);

  update daily_sales_items set qty_hall=0.5 where id=v_item;
  perform apply_international_tax_for_sales_item(v_item,true);
  perform pg_temp.ok('일부 감소는 새 프로필이 아니라 원판매 10% snapshot 목표와의 차이만 환입한다',
    exists(select 1 from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item
      and tax_profile_id=v_tax and tax_profile_revision=1 and final_quantity=0.5 and tax_total=545)
    and (select sum(delta_amount) from sales_tax_events where daily_sales_item_id=v_item)=545);

  update daily_sales_items set qty_hall=0 where id=v_item;
  perform apply_international_tax_for_sales_item(v_item,true);
  perform pg_temp.ok('수량 0 취소는 tombstone을 남기고 세금·납부 부채·이벤트 합을 0으로 맞춘다',
    exists(select 1 from daily_sales_items where id=v_item and qty_hall=0)
    and exists(select 1 from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item
      and final_quantity=0 and tax_total=0 and merchant_tax_liability=0 and marketplace_tax_liability=0)
    and (select coalesce(sum(delta_amount),0) from sales_tax_events where daily_sales_item_id=v_item)=0);

  begin
    update daily_sales_item_tax_component_snapshots set rounded_amount=1
     where sales_tax_snapshot_id=(select id from daily_sales_item_tax_snapshots where daily_sales_item_id=v_item);
    set constraints all immediate;
    raise exception 'FAIL  구성 snapshot과 이벤트가 어긋난 계산선을 허용했다';
  exception when check_violation then
    set constraints all deferred;
    raise notice '  ok   commit 전 구성·부채·이벤트 합 불변식이 어긋남을 거부한다';
  end;
end
$reconcile$;

select pg_temp.ok('국제 세금 계산·쓰기·검증 몸통은 앱·서비스 역할에 닫혀 있다',
  not exists (
    select 1
      from unnest(array['anon','authenticated','margincook_rpc_executor','service_role']) role_name,
           unnest(array[
             'calculate_international_tax(tax_price_basis,smallint,tax_treatment,numeric,jsonb)',
             'apply_international_tax_for_sales_item(uuid,boolean)',
             'reconcile_international_tax_after_sale_item()',
             'assert_sales_tax_line_balanced()'
           ]) signature
     where has_function_privilege(role_name,signature,'execute')
  ));

select pg_temp.ok('국제 세금 capability는 계산 몸통 뒤에도 꺼져 있다',
  not (app_capabilities()#>>'{international_tax,read_enabled}')::boolean
  and not (app_capabilities()#>>'{international_tax,write_enabled}')::boolean);
