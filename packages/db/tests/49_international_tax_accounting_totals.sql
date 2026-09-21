-- ═════════════════════════════════════════════════════════
-- 49 · 세금 별도는 순매출을 유지하고 세금을 고객 결제액에 더한다
-- ════════════════════════════════════════════════════════

select pg_temp.clear_international_tax_fixture();

do $exclusive_profit$
declare
  v_date date:=pg_temp.today();
  v_day uuid;
  v_recipe uuid:=gen_random_uuid();
  v_market uuid;
  v_profile uuid;
  v_component uuid;
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_detail jsonb;
  v_range jsonb;
  v_basis jsonb;
  v_audit jsonb;
  v_fixed_rate numeric;
  v_channel_before numeric;
  v_channel_after numeric;
  v_authority_before jsonb;
  v_authority_after jsonb;
  v_authority_menu jsonb;
  v_alloc_date date:=(date_trunc('month',v_date)-interval '1 month'+interval '5 days')::date;
  v_draft_id uuid:=gen_random_uuid();
  v_request_id uuid:=gen_random_uuid();
  v_opened jsonb;
  v_saved jsonb;
  v_final jsonb;
  v_items jsonb;
  v_alloc jsonb;
  v_hall jsonb;
  v_has_completed_version boolean;
begin
  execute 'reset role';
  insert into public.store_market_profiles(
    store_id,country_code,region_code,currency_code,business_locale_code,price_basis,effective_from)
  values(pg_temp.store(),'US','US-CA','USD','en-US','tax_exclusive',v_date)
  returning id into v_market;
  insert into public.international_tax_activation_boundaries(
    store_id,activation_date,minimum_app_version,reason)
  values(pg_temp.store(),v_date,'0.2.0','release_cutover');
  insert into public.store_tax_profiles(
    store_id,market_profile_id,default_treatment,effective_from)
  values(pg_temp.store(),v_market,'taxable',v_date) returning id into v_profile;
  insert into public.store_tax_components(
    store_id,tax_profile_id,config_key,kind,name,rate_pct,jurisdiction_level,
    calculation_basis,applies_to_treatments)
  values(pg_temp.store(),v_profile,'primary','primary','Sales tax',10,'state',
    'primary_tax_exclusive',array['taxable'::public.tax_treatment]) returning id into v_component;
  insert into public.channel_tax_remittance(
    store_id,tax_component_id,sales_channel_code,remittance_owner)
  values(pg_temp.store(),v_component,'hall','merchant'),
        (pg_temp.store(),v_component,'delivery','merchant'),
        (pg_temp.store(),v_component,'takeout','merchant');

  insert into public.recipes(id,store_id,name,price,base_servings,target_profit_rate,active)
  values(v_recipe,pg_temp.store(),'49 미포함가 메뉴',10,1,30,true);

  execute 'set local role costkeep_rpc_executor';
  perform pg_temp.open_today();
  select id into v_day from public.business_days
   where store_id=pg_temp.store() and business_date=v_date;
  -- 이미 열린 영업일에 새 메뉴를 더하는 정식 경로를 탄다.
  v_before:=public.sales_summary(pg_temp.store(),v_date,v_date);
  v_authority_before:=public.sales_authoritative_range_detail(pg_temp.store(),v_date,v_date);
  select (x->>'net_sales')::numeric into v_channel_before
    from jsonb_array_elements(public.sales_range(pg_temp.store(),v_date,v_date)->'channels') x
    where x->>'code'='hall';
  v_result:=public.e10_sale_recorded(pg_temp.store(),v_date,v_recipe,1,0,0,0,false);
  v_after:=public.sales_summary(pg_temp.store(),v_date,v_date);
  v_authority_after:=public.sales_authoritative_range_detail(pg_temp.store(),v_date,v_date);
  select exists(
    select 1 from public.sales_day_heads h
     where h.store_id=pg_temp.store() and h.business_date=v_date
  ) into v_has_completed_version;
  select (x->>'net_sales')::numeric into v_channel_after
    from jsonb_array_elements(public.sales_range(pg_temp.store(),v_date,v_date)->'channels') x
    where x->>'code'='hall';
  perform pg_temp.eq('채널별 세금 별도 판매는 확정 순매출 10을 유지한다',
    v_channel_after-v_channel_before,10,0.000001);
  select value into v_authority_menu from jsonb_array_elements(v_authority_after->'menu')
   where value->>'recipe_id'=v_recipe::text;
  perform pg_temp.eq('새 기간 메뉴 계약은 세금이 더해진 고객 결제액 11을 표시한다',
    (v_authority_menu->>'revenue')::numeric,11,0.000001);
  perform pg_temp.ok('현재 메뉴 기간 행은 삭제 메뉴로 표시하지 않는다',
    not coalesce((v_authority_menu->>'is_deleted')::boolean,true));
  perform pg_temp.eq('새 기간 채널 계약 합계는 권위 customer_total 증가분과 같다',
    (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(v_authority_after->'channels') x)
      -(select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(v_authority_before->'channels') x),
    (v_after->>'customer_total')::numeric-(v_before->>'customer_total')::numeric,0.000001);
  -- 최신 스키마의 열린 날짜에는 완료 판본이 없어 null이어야 한다. 업그레이드
  -- 픽스처는 테스트 전용 force_open으로 종료일을 되열 수 있어, 0111이 만든 과거
  -- 완료 판본이 남아 있다. 운영에서는 종료 영업일 재개점이 금지되어 있으므로 그
  -- 경우에는 봉인된 숫자 계약을 확인한다.
  perform pg_temp.ok('기간 고정 지출은 완료 판본 존재 여부에 맞는 계약을 유지한다',
    (not v_has_completed_version
      and v_authority_after->'fixed_cost_total'='null'::jsonb
      and not exists(select 1 from jsonb_array_elements(v_authority_after->'channels') x
        where x->'fixed_cost'<>'null'::jsonb))
    or
    (v_has_completed_version
      and jsonb_typeof(v_authority_after->'fixed_cost_total')='number'
      and not exists(select 1 from jsonb_array_elements(v_authority_after->'channels') x
        where x->'fixed_cost'='null'::jsonb)));
  v_detail:=public.day_menu_detail(pg_temp.store(),v_date,v_recipe);
  v_range:=public.range_menu_detail(pg_temp.store(),v_date,v_date,v_recipe);
  select coalesce(public.day_fixed_rate(pg_temp.store(),v_date),0) into v_fixed_rate;
  select value into v_basis from jsonb_array_elements(public.day_menu_basis(pg_temp.store(),v_date))
   where value->>'recipe_id'=v_recipe::text;

  perform pg_temp.eq('세금 별도 10.00의 확정 세금은 1이다',
    (v_result->>'unit_tax')::numeric,1,0.000001);
  perform pg_temp.ok('영업일 snapshot은 listed 10 · net 10 · customer 11 · tax 1을 같이 굳힌다',
    (select (snapshot#>>array['recipes',v_recipe::text,'net_sales'])::numeric=10
       and (snapshot#>>array['recipes',v_recipe::text,'customer_total'])::numeric=11
       and (snapshot#>>array['recipes',v_recipe::text,'tax'])::numeric=1
      from public.business_days where id=v_day));
  perform pg_temp.eq('세금 별도 판매는 세금을 순매출에서 차감하지 않는다',
    (v_after->>'profit')::numeric-(v_before->>'profit')::numeric,
    10-v_fixed_rate*10,0.000001);
  perform pg_temp.ok('일 메뉴 상세도 순매출·고객 결제액·세금을 구분한다',
    (v_detail->>'net_sales')::numeric=10
    and (v_detail->>'customer_total')::numeric=11
    and (v_detail->>'tax')::numeric=1
    and (v_detail->>'profit')::numeric=10-v_fixed_rate*10);
  perform pg_temp.ok('기간 메뉴 손익도 확정 순매출을 쓴다',
    (v_range->>'revenue')::numeric=10
    and (v_range->>'tax')::numeric=1
    and (v_range->>'profit')::numeric=10-v_fixed_rate*10);
  perform pg_temp.ok('판매 기준 카드도 세금 별도를 순매출에서 다시 빼지 않는다',
    (v_basis->>'tax')::numeric=1
    and (v_basis->>'profit')::numeric=10-v_fixed_rate*10);

  -- 배정된 기타 매출은 메뉴 합계에 한 번만 더하고, 확정 판본의 고정 지출은
  -- listed price가 아니라 날짜별 customer_total 비중으로 채널에 배분한다.
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=pg_temp.store();
  perform public.publish_sales_basis_version(pg_temp.store(),v_alloc_date);
  v_opened:=public.open_sales_draft(pg_temp.store(),v_alloc_date,v_draft_id);
  select jsonb_agg(case when x->>'recipe_id'=v_recipe::text
      then x||jsonb_build_object('qty_hall',1) else x end order by ord)
    into v_items
    from jsonb_array_elements(v_opened->'payload'->'items') with ordinality rows(x,ord);
  v_saved:=public.save_sales_draft(pg_temp.store(),v_draft_id,0,v_items,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','채널 기타 매출',
      'price',7,'qty',1,'channel','hall')),'[]'::jsonb);
  v_final:=public.finalize_sales_draft(pg_temp.store(),v_draft_id,1,v_request_id,
    v_saved->>'payload_hash','49 채널 배분 검증');
  -- fixture에는 해당 과거 월의 고정 지출이 없으므로 확정판본에 알려진 금액을 봉인해
  -- 채널 배분 공식 자체를 독립 검증한다.
  update public.sales_day_versions set summary=jsonb_set(summary,'{fixed_cost}','5'::jsonb,true)
   where id=(v_final->>'version_id')::uuid;
  v_alloc:=public.sales_authoritative_range_detail(pg_temp.store(),v_alloc_date,v_alloc_date);
  select value into v_hall from jsonb_array_elements(v_alloc->'channels') where value->>'code'='hall';
  perform pg_temp.eq('배정 기타 매출은 채널 합계에 한 번만 포함',
    (select sum((x->>'amount')::numeric) from jsonb_array_elements(v_alloc->'channels') x),
    (select sum((x->>'revenue')::numeric) from jsonb_array_elements(v_alloc->'menu') x)+7,0.000001);
  perform pg_temp.eq('채널 고정 지출과 미배분 합은 확정 고정 지출과 같다',
    (select sum((x->>'fixed_cost')::numeric) from jsonb_array_elements(v_alloc->'channels') x)
      +coalesce((v_alloc->>'fixed_cost_unallocated')::numeric,0),
    5,0.000001);
  perform pg_temp.eq('채널 고정 지출은 고객 결제액 비중으로 배분',
    (v_hall->>'fixed_cost')::numeric,
    5*(v_hall->>'amount')::numeric
      /(v_final#>>'{summary,customer_total}')::numeric,0.000001);

  perform pg_temp.save_recipe_fixture(pg_temp.store(),jsonb_build_object(
    'id',v_recipe,'name','49 미포함가 메뉴','price',20,'base_servings',1,
    'target_profit_rate',30,'active',true));
  select x into v_audit
    from public.entity_change_events e
    cross join lateral jsonb_array_elements(e.changes) x
   where e.entity_id=v_recipe and x->>'key'='profit'
   order by e.occurred_at desc,e.id desc limit 1;
  perform pg_temp.eq('레시피 수정 감사도 세금 별도에서 세금을 차감하지 않는다',
    (v_audit->>'after')::numeric,20-v_fixed_rate*20,0.000001);
end
$exclusive_profit$;

do $acl$
begin
  perform pg_temp.ok('회계 합계 도우미는 앱 롤에 직접 열리지 않는다',
    not has_function_privilege('authenticated','public.sales_item_accounting_totals(uuid)','execute')
    and not has_function_privilege('authenticated','public.daily_sales_etc_accounting_totals(uuid)','execute'));
  perform pg_temp.ok('입고·취소·고정지출 변경 이력도 국제 순매출 quote를 쓴다',
    position('recipe_tax_quote_for_price' in pg_get_functiondef(
      'public.e1_confirm_inbound(uuid,numeric,text,date)'::regprocedure))>0
    and position('recipe_tax_quote_for_price' in pg_get_functiondef(
      'public.e11_inbound_reverted(uuid,text)'::regprocedure))>0
    and position('pending_recipe_tax_quote' in pg_get_functiondef(
      'public.save_fixed_costs(uuid,text,numeric,jsonb)'::regprocedure))>0);
end
$acl$;
