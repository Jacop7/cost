set local role postgres;
do $test$
declare stage text; u uuid; s uuid; i uuid; i2 uuid; m uuid; m2 uuid; r uuid; bd uuid; d date;
  body jsonb; snap jsonb; n bigint; trends bigint; revision jsonb; pending boolean; evt public.entity_change_events;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('같은 금액 구성 변경 '||stage,'Asia/Seoul')->>'store_id')::uuid;
    d:=public.store_local_date(s);
    i:=public.save_ingredient(s,'{"name":"기존 된장","base_unit":"g","per_volume":1000,"purchase_price":4000,"safety_stock":0,"min_order_qty":1}');
    i2:=public.save_ingredient(s,'{"name":"새 된장","base_unit":"g","per_volume":1000,"purchase_price":4000,"safety_stock":0,"min_order_qty":1}');
    perform public.quick_inbound(s,i,1000,4000,1,null,d,gen_random_uuid()::text);
    perform public.quick_inbound(s,i2,1000,4000,1,null,d,gen_random_uuid()::text);
    m:=public.save_material(s,'{"name":"기존 용기","unit_cost":300}');
    m2:=public.save_material(s,'{"name":"새 용기","unit_cost":300}');
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','된장찌개','price',12000,'base_servings',1,'target_profit_rate',30,
      'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',100)),
      'extras',jsonb_build_array(jsonb_build_object('material_id',m,'qty',1)));
    r:=public.save_recipe(s,body);
    set local role postgres;
    bd:=null;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id,snapshot into bd,snap;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    pending:=stage in ('open','break');
    select count(*) into trends from public.profit_trends where recipe_id=r;
    select count(*) into n from public.entity_change_events where entity_id=r;
    body:=body||jsonb_build_object('patch','full','id',r,'expected_revision',public.recipe_detail(r)->'edit_revision',
      'request_id',gen_random_uuid()::text,'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i2,'input_qty',100)));
    perform public.save_recipe(s,body);
    select * into evt from public.entity_change_events where entity_id=r order by occurred_at desc,id desc limit 1;
    perform pg_temp.ok(stage||': 같은 금액 식재료 교체를 직접 수정 1건으로 기록',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and evt.source_type='direct' and evt.affects_sales and evt.changes @> '[{"key":"lines","change_kind":"direct","before":"기존 된장 100g","after":"새 된장 100g"}]');
    perform pg_temp.ok(stage||': 식재료 구성 반영 시점',
      (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending);
    select count(*) into n from public.entity_change_events where entity_id=r;
    body:=body||jsonb_build_object('expected_revision',public.recipe_detail(r)->'edit_revision','request_id',gen_random_uuid()::text,
      'extras',jsonb_build_array(jsonb_build_object('material_id',m2,'qty',1)));
    perform public.save_recipe(s,body);
    select * into evt from public.entity_change_events where entity_id=r order by occurred_at desc,id desc limit 1;
    perform pg_temp.ok(stage||': 같은 금액 부자재 교체를 직접 수정 1건으로 기록',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and evt.source_type='direct' and evt.affects_sales and evt.changes @> '[{"key":"extras","change_kind":"direct"}]');
    perform pg_temp.ok(stage||': 부자재 구성 반영 시점',
      (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending);
    perform pg_temp.ok(stage||': 금액 동일한 구성 교체는 즉시 상태에서도 추이 추가 없음',
      (select count(*)=trends from public.profit_trends where recipe_id=r));
    select count(*) into n from public.entity_change_events where entity_id=r;
    select count(*) into trends from public.profit_trends where recipe_id=r;
    perform public.save_recipe(s,body); -- receipt replay
    revision:=public.recipe_detail(r)->'edit_revision';
    body:=body||jsonb_build_object('expected_revision',revision,'request_id',gen_random_uuid()::text);
    perform public.save_recipe(s,body); -- semantic no-op
    perform pg_temp.ok(stage||': 재요청·무변경은 이력·추이·판본 유지',
      (select count(*)=n from public.entity_change_events where entity_id=r)
      and (select count(*)=trends from public.profit_trends where recipe_id=r)
      and public.recipe_detail(r)->'edit_revision'=revision);
    if pending then
      perform pg_temp.ok(stage||': 진행 중 영업 기준 식재료는 보존',
        (select snapshot=snap from public.business_days where id=bd));
      set local role postgres;
      perform public.close_business_day_row(bd,'manual');
      perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 대기 해제·금액 같으면 추이 없음',
        public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false'
        and (select count(*)=trends from public.profit_trends where recipe_id=r));
    end if;
    set local role postgres;
  end loop;
  perform pg_temp.ok('앱 역할은 새 내부 helper를 직접 호출할 수 없다',
    not has_function_privilege('authenticated','public.recipe_edit_apply_v3(uuid,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.recipe_composition_labels(uuid)','EXECUTE'));
end $test$;

