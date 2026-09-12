set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare u uuid; s uuid; r uuid; ing uuid; mat uuid; day_id uuid; d date; m jsonb; t jsonb; p jsonb;
 body jsonb; q jsonb; frozen jsonb; before_trends bigint; method public.business_close_method; clock_definition text;
begin
 foreach method in array array['manual'::public.business_close_method,'auto'::public.business_close_method] loop
  u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('공통 적용 시험 '||method,'Asia/Seoul')->>'store_id')::uuid;
  d:=public.store_local_date(s);
  m:=public.save_store_market_profile(s,'{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}',null,null);
  p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[{"code":"standard","name":"일반","treatment":"taxable","active":true}]}';
  t:=public.save_store_tax_profile(s,p,null,null);
  set local role postgres;
  insert into public.ingredients(store_id,name,base_unit,per_volume) values(s,'적용 대파','g',1000) returning id into ing;
  perform pg_temp.as_owner(u);
  perform public.quick_inbound(s,ing,1000,4000,1,null,d,gen_random_uuid()::text);
  mat:=public.save_material(s,'{"name":"용기","unit_cost":300}'::jsonb);
  perform public.save_fixed_costs(s,to_char(d,'YYYY-MM'),100000,'[{"key":"rent","total":20000}]');
  body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
    'name','기준 메뉴','price',12000,'base_servings',10,'target_profit_rate',30,
    'lines',jsonb_build_array(jsonb_build_object('ingredient_id',ing,'input_qty',1000)),
    'extras',jsonb_build_array(jsonb_build_object('material_id',mat,'name','용기','qty',1,'amount',300)));
  r:=public.save_recipe(s,body);
  perform pg_temp.ok(method||' 영업 전 수정 즉시 반영',public.recipe_detail(r)->>'application_mode'='immediate' and (public.recipe_detail(r)->>'material_cost')::numeric=400);
  set local role postgres;
  -- Retained legacy fields still have to agree with the frozen price when no
  -- international quote is rendered. This does not replace the international quote.
  update public.settings set tax_items='[{"name":"기존 세금","rate":5}]' where store_id=s;
  update public.recipes set tax_items='[{"name":"기존 세금","rate":5}]' where id=r;
  frozen:=public.build_day_snapshot(s,d);
  insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
    values(s,d,'open',clock_timestamp()+interval '1 hour',frozen) returning id into day_id;
  select count(*) into before_trends from public.profit_trends where recipe_id=r;
  if method='auto' then
    -- Simulate the SERVER crossing midnight while yesterday's business day stays open.
    clock_definition:=pg_get_functiondef('public.store_local_date(uuid,timestamp with time zone)'::regprocedure);
    execute format('create or replace function public.store_local_date(p_store uuid,p_at timestamp with time zone default now()) returns date language sql stable as %L','select '||quote_literal((d+1)::text)||'::date');
  end if;
  perform pg_temp.as_owner(u);
  body:=body||jsonb_build_object('patch','full','id',r,'expected_revision','1','request_id',gen_random_uuid()::text,
    'price',15000,'base_servings',5,'lines',jsonb_build_array(jsonb_build_object('ingredient_id',ing,'input_qty',1500)));
  perform public.save_recipe(s,body);
  perform public.save_material(s,jsonb_build_object('id',mat,'name','용기','unit_cost',500));
  perform public.save_fixed_costs(s,to_char(d,'YYYY-MM'),100000,'[{"key":"rent","total":30000}]');
  p:=jsonb_set(p,'{components,0,rate_pct}','20');
  t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  if method='auto' then
    perform pg_temp.ok('전날 영업이 열려 있어도 오늘 미개장 날짜를 건너뛰지 않음',(t->>'effective_from')::date=d+1);
  end if;
  perform public.quick_inbound(s,ing,1000,8000,1,null,public.store_local_date(s),gen_random_uuid()::text);
  q:=public.recipe_detail(r);
  perform pg_temp.ok(method||' 편집에는 최신 저장값이 보존된다',(q->>'price')::numeric=15000 and (q->>'material_cost')::numeric=1800 and (q->>'extra_cost')::numeric=500);
  perform pg_temp.ok(method||' 재고 입고는 대기하지 않는다',public.stock_total_base(ing)=2000);
  perform pg_temp.ok(method||' 상세 원가 손익은 시작 기준을 사용',q->>'application_mode'='after_close' and (q#>>'{effective,price}')::numeric=12000 and (q#>>'{effective,material_cost}')::numeric=400 and (q#>>'{effective,extra_cost}')::numeric=300 and (q#>>'{effective,fixed_rate}')::numeric=0.2 and (q#>>'{effective,lines,0,stock_total}')::numeric=2000);
  perform pg_temp.ok(method||' 구형 세금 내역도 시작 가격과 항목 사용',
    q#>>'{effective,tax_breakdown,0,name}'='기존 세금' and (q#>>'{effective,tax_breakdown,0,amount}')::numeric=600);
  perform pg_temp.ok(method||' 목록과 세금도 시작 기준을 사용',(select price=12000 and material_cost=400 and extra_cost=300 and fixed_cost=2400 and tax=1091 from public.recipe_list(s) where id=r) and (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=1091);
  if method='auto' then
    perform pg_temp.ok('자정 이후에도 실제 서버 날짜와 열린 영업일의 세금 기준을 구분',
      (public.recipe_tax_app_state(s,r)#>>'{quote_context,local_date}')::date=d+1
      and (public.recipe_tax_app_state(s,r)#>>'{quote_context,quote_date}')::date=d);
  end if;
  q:=public.recipe_price_simulation(s,r,12000);
  perform pg_temp.ok(method||' 판매가 시뮬레이션의 원가도 유지',(q#>>'{one,material}')::numeric=400 and (q#>>'{one,extra}')::numeric=300 and (q#>>'{one,fixed}')::numeric=2400 and (q->>'base_servings')::numeric=10);
  q:=public.recipe_price_recommendation(s,r);
  perform pg_temp.ok(method||' 추천 견적은 상세와 동일한 기준',(q#>>'{one,material}')::numeric=400 and (q#>>'{one,extra}')::numeric=300 and (q#>>'{one,fixed}')::numeric=2400);
  set local role postgres;
  if method='manual' then
    -- Deployment over an older opening snapshot: retain saved-menu amounts, but
    -- never substitute a live material unit cost for an unavailable opening price.
    update public.business_days set snapshot=snapshot-'materials'-'fixed_revenue'-'fixed_total' where id=day_id;
    perform pg_temp.as_owner(u);
    q:=public.recipe_draft_preview(s,jsonb_build_object('recipe_id',r,'price',body->'price','base_servings',body->'base_servings','target_profit_rate',body->'target_profit_rate','lines',body->'lines','extras',jsonb_build_array(jsonb_build_object('material_id',mat,'qty',1,'amount',500))));
    perform pg_temp.ok('구형 시작 기준에 부자재 단가가 없으면 임의의 현재 단가를 쓰지 않음',
      q#>'{one,extra}'='null'::jsonb and (q#>'{basis,missing_material_price_ids}') ? mat::text);
    perform pg_temp.ok('구형 기준의 저장 메뉴 추천은 기록된 부자재 합계를 유지',
      (public.recipe_price_recommendation(s,r)#>>'{one,extra}')::numeric=300);
    set local role postgres;
    update public.business_days set snapshot=frozen where id=day_id;
  end if;
  if method='auto' then
    -- A delayed close across a month boundary must not relabel the frozen cost month.
    execute format('create or replace function public.store_local_date(p_store uuid,p_at timestamp with time zone default now()) returns date language sql stable as %L','select '||quote_literal((d+32)::text)||'::date');
    perform pg_temp.as_owner(u);
    perform pg_temp.ok('월 경계에서도 시뮬레이션/추천 기준 월은 시작 영업일',
      public.recipe_price_simulation(s,r,12000)#>>'{basis,fixed_month}'=to_char(d,'YYYY-MM')
      and public.recipe_price_recommendation(s,r)#>>'{basis,fixed_month}'=to_char(d,'YYYY-MM'));
    set local role postgres;
    execute format('create or replace function public.store_local_date(p_store uuid,p_at timestamp with time zone default now()) returns date language sql stable as %L','select '||quote_literal((d+1)::text)||'::date');
  end if;
  update public.business_days set status='break' where id=day_id;
  perform pg_temp.ok(method||' 브레이크도 동일한 대기 기준',(public.recipe_detail(r)#>>'{effective,price}')::numeric=12000);
  perform pg_temp.ok(method||' 적용 전 손익 변동을 기록하지 않음',(select count(*)=before_trends from public.profit_trends where recipe_id=r));
  perform public.close_business_day_row(day_id,method);
  perform pg_temp.as_owner(u);
  q:=public.recipe_detail(r);
  perform pg_temp.ok(method||' 종료하면 추가 저장 없이 최신 기준으로 전환',q->>'application_mode'='immediate' and not(q?'effective') and (select price=15000 and material_cost=1800 and extra_cost=500 and fixed_cost=4500 and tax=2500 and profit=5700 from public.recipe_list(s) where id=r));
  set local role postgres;
  perform pg_temp.ok(method||' 마감한 판매 기준 불변',(select snapshot-'closing'=frozen from public.business_days where id=day_id));
  perform pg_temp.ok(method||' 종료 적용 손익 기록은 한 번만 생성',(select count(*)=before_trends+1 from public.profit_trends where recipe_id=r));
  perform pg_temp.ok(method||' 다음 영업 시작 스냅샷도 새 세금을 사용',
    (public.build_day_snapshot(s,public.next_unopened_business_date(s))#>>array['recipes',r::text,'tax'])::numeric=2500);
  perform pg_temp.ok(method||' 앱 직접 내부 기준 호출 차단',not has_function_privilege('authenticated','public.active_menu_business_basis(uuid)','execute') and not has_function_privilege('authenticated','public.with_effective_menu_detail(jsonb)','execute'));
  if method='auto' then execute clock_definition; end if;
 end loop;
end $test$;

-- Same-price composition changes and pure unit-cost changes have different sources.
do $cause_test$
declare u uuid; s uuid; r uuid; ing uuid; d date; day_id uuid; body jsonb; kind text;
begin
 foreach kind in array array['recipe','material'] loop
  set local role postgres;
  u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('원인 귀속 '||kind,'Asia/Seoul')->>'store_id')::uuid;
  d:=public.store_local_date(s);
  set local role postgres;
  insert into public.ingredients(store_id,name,base_unit,per_volume) values(s,'원인 식재료','g',1000) returning id into ing;
  perform pg_temp.as_owner(u);
  perform public.quick_inbound(s,ing,1000,1000,1,null,d,gen_random_uuid()::text);
  body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
    'name','원인 메뉴','price',1000,'base_servings',1,'target_profit_rate',30,
    'lines',jsonb_build_array(jsonb_build_object('ingredient_id',ing,'input_qty',10)),'extras','[]'::jsonb);
  r:=public.save_recipe(s,body);
  set local role postgres;
  insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
    values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into day_id;
  perform pg_temp.as_owner(u);
  if kind='recipe' then
    perform public.save_recipe(s,body||jsonb_build_object('patch','full','id',r,'expected_revision','1','request_id',gen_random_uuid()::text,
      'lines',jsonb_build_array(jsonb_build_object('ingredient_id',ing,'input_qty',20))));
  else
    perform public.quick_inbound(s,ing,1000,3000,1,null,d,gen_random_uuid()::text);
  end if;
  perform public.transition_business_state(s,'end');
  set local role postgres;
  perform pg_temp.ok('종료 적용 원인 분리 '||kind,
    (select cause::text=kind from public.profit_trends where recipe_id=r order by occurred_at desc,id desc limit 1));
 end loop;
end $cause_test$;
