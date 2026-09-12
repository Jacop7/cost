-- Reverse order: tax first, then ingredient/menu/material/fixed, inbound and cancel.
-- One store and menu: all sources change before the same close. No synthetic old sales rewrite.
set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare stage text; u uuid; s uuid; r uuid; i uuid; material_a uuid; material_b uuid; bd uuid; d date;
  p jsonb; t jsonb; result jsonb; body jsonb; detail jsonb; snap jsonb; pending boolean;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('전체 원가 합성 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    perform public.save_store_market_profile(s,'{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}',null,null);
    p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[]}';
    t:=public.save_store_tax_profile(s,p,null,null);
    i:=public.save_ingredient(s,'{"name":"된장","base_unit":"g","per_volume":1000,"purchase_price":4000}');
    material_a:=public.save_material(s,'{"name":"기존 용기","unit_cost":100}');
    material_b:=public.save_material(s,'{"name":"새 용기","unit_cost":300}');
    perform public.save_fixed_costs(s,to_char(d,'YYYY-MM'),100000,'[{"key":"rent","total":20000}]');
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,'name','합성 메뉴',
      'price',12000,'base_servings',10,'target_profit_rate',30,'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',1000)),
      'extras',jsonb_build_array(jsonb_build_object('material_id',material_a,'qty',1)));
    r:=public.save_recipe(s,body);
    set local role postgres;
    if stage<>'before_open' then
      snap:=public.build_day_snapshot(s,d);
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',snap) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u); pending:=stage in ('open','break');
    p:=jsonb_set(p,'{components,0,rate_pct}','20');
    t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
    perform public.save_ingredient(s,jsonb_build_object('id',i,'name','된장','base_unit','g','per_volume',2000,'purchase_price',16000));
    perform pg_temp.ok(stage||': 세금 먼저 변경 후 식재료 이력은 새 순매출10000에서 순이익6700',exists(select 1 from public.entity_change_events e cross join lateral jsonb_array_elements(e.changes) c where e.entity_id=r and e.source_type='ingredient' and c->>'key'='profit' and (c->>'after')::numeric=6700));
    body:=body||jsonb_build_object('patch','full','id',r,'expected_revision',public.recipe_detail(r)->'edit_revision','request_id',gen_random_uuid()::text,
      'price',15000,'base_servings',5,'target_profit_rate',40,'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',500)),
      'extras',jsonb_build_array(jsonb_build_object('material_id',material_b,'qty',2)));
    perform public.save_recipe(s,body);
    perform pg_temp.ok(stage||': 세금 먼저 변경 후 메뉴 이력은 새 순매출12500에서 순이익8100',exists(select 1 from public.entity_change_events e cross join lateral jsonb_array_elements(e.changes) c where e.entity_id=r and e.source_type='direct' and c->>'key'='profit' and (c->>'after')::numeric=8100));
    perform public.save_material(s,jsonb_build_object('id',material_a,'name','기존 용기','unit_cost',900));
    perform public.save_material(s,jsonb_build_object('id',material_b,'name','새 용기','unit_cost',500));
    perform public.save_fixed_costs(s,to_char(d,'YYYY-MM'),100000,'[{"key":"labor","total":30000}]');
    detail:=public.recipe_detail(r);
    perform pg_temp.ok(stage||': 저장된 식재료·부자재 결합 금액과 메뉴 판매가',
      public.recipe_material_cost(r)=800 and (select sum(amount_per_serving)=1000 from public.recipe_extra_costs where recipe_id=r)
      and (detail->>'price')::numeric=15000);
    perform pg_temp.ok(stage||': 다섯 출처가 모두 메뉴 수정 내역에 연결',
      (select count(distinct source_type)=5 from public.entity_change_events where entity_id=r
        and source_type in ('ingredient','direct','material','fixed_cost','tax')));
    perform pg_temp.ok(stage||': 영업 상태에 따라 전체 구성의 같은 판본 표시',
      coalesce(detail#>>'{effective,price}',detail->>'price')::numeric=case when pending then 12000 else 15000 end
      and coalesce(detail#>>'{effective,material_cost}',detail->>'material_cost')::numeric=case when pending then 400 else 800 end
      and coalesce(detail#>>'{effective,extra_cost}',detail->>'extra_cost')::numeric=case when pending then 100 else 1000 end
      and coalesce(detail#>>'{effective,fixed_rate}',detail->>'fixed_rate')::numeric=case when pending then 0.2 else 0.3 end
      and (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=case when pending then 1091 else 2500 end
      and (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending);
    if pending then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 모든 최종 값 동시 적용·영업 시작 판본 보존',
        (select profit=6200 from public.recipe_list(s) where id=r)
        and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false'
        and (select snapshot->'recipes'=snap->'recipes' from public.business_days where id=bd));
    else
      perform pg_temp.ok(stage||': 영업 전후 최종 손익 6200원 즉시 적용',(select profit=6200 from public.recipe_list(s) where id=r));
    end if;
    result:=public.quick_inbound(s,i,4000,24000,1,null,d,gen_random_uuid()::text);
    perform pg_temp.ok(stage||': 다음 새 입고 평균6원/g을 따라 원가600·순이익6400 자동 갱신',
      public.current_ingredient_unit_price(i)=6 and (select material_cost=600 and profit=6400 from public.recipe_list(s) where id=r));
    perform pg_temp.ok(stage||': 새 입고 이력의 순이익도 새 세금 기준6400',exists(select 1 from public.entity_change_events e cross join lateral jsonb_array_elements(e.changes) c where e.entity_id=r and c->>'key'='profit' and (c->>'after')::numeric=6400));
    perform public.e11_inbound_reverted((result->>'order_id')::uuid,'시험 취소');
    perform pg_temp.ok(stage||': 취소 이력은 현재 세금 기준·입고 없는 단가0으로 순이익7000',exists(select 1 from public.entity_change_events e cross join lateral jsonb_array_elements(e.changes) c where e.entity_id=r and c->>'key'='profit' and (c->>'after')::numeric=7000));
    set local role postgres;
  end loop;
end $test$;
