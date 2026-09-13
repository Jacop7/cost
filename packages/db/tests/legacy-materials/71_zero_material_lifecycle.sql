set local role postgres;
do $test$
declare stage text; u uuid; s uuid; m uuid; r uuid; r0 uuid; d date; bd uuid; body jsonb; n bigint;
  revision jsonb; trends bigint;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('0원 연결 연속 동작 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    m:=public.save_material(s,'{"name":"용기","unit_cost":300}');
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','메뉴','price',12000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,
      'extras',jsonb_build_array(jsonb_build_object('material_id',m,'qty',1)));
    r:=public.save_recipe(s,body);
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',0));
    r0:=public.save_recipe(s,body||jsonb_build_object('request_id',gen_random_uuid()::text,'name','무료 용기 메뉴'));
    perform pg_temp.ok(stage||': 처음부터 0원인 부자재도 선택 연결 유지',
      (select count(*)=1 from public.recipe_extra_costs where recipe_id=r0 and material_id=m and amount_per_serving=0));
    body:=body||jsonb_build_object('id',r,'patch','full','request_id',gen_random_uuid()::text,
      'expected_revision',public.recipe_detail(r)->'edit_revision','name','메뉴 이름 수정');
    perform public.save_recipe(s,body);
    perform pg_temp.ok(stage||': 0원 뒤 메뉴 다른 정보 수정도 연결 유지',
      (select count(*)=1 from public.recipe_extra_costs where recipe_id=r and material_id=m and amount_per_serving=0));
    select count(*) into n from public.entity_change_events where entity_id=r;
    select count(*) into trends from public.profit_trends where recipe_id=r;
    revision:=public.recipe_detail(r)->'edit_revision';
    perform public.save_recipe(s,body); -- receipt replay at zero cost
    body:=body||jsonb_build_object('request_id',gen_random_uuid()::text,'expected_revision',revision);
    perform public.save_recipe(s,body); -- semantic no-op at zero cost
    perform pg_temp.ok(stage||': 0원 연결 재요청·무변경은 판본·이력·추이 유지',
      public.recipe_detail(r)->'edit_revision'=revision
      and (select count(*)=n from public.entity_change_events where entity_id=r)
      and (select count(*)=trends from public.profit_trends where recipe_id=r));
    body:=body||jsonb_build_object('request_id',gen_random_uuid()::text,
      'extras',(body->'extras')||jsonb_build_array(jsonb_build_object('name','기타','amount',0)));
    perform public.save_recipe(s,body);
    perform pg_temp.ok(stage||': 자유입력 0원은 연결 0원과 달리 종전대로 무변경',
      public.recipe_detail(r)->'edit_revision'=revision
      and (select count(*)=1 and bool_and(material_id=m) from public.recipe_extra_costs where recipe_id=r));
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',500));
    perform pg_temp.ok(stage||': 가격 복원은 연결 메뉴 금액·자동 이력에 반영',
      (select bool_and(amount_per_serving=500) from public.recipe_extra_costs where material_id=m)
      and (select count(*)=n+1 from public.entity_change_events where entity_id=r));
    perform pg_temp.ok(stage||': 가격 복원도 영업 상태에 맞는 시점 적용',
      coalesce(public.recipe_detail(r)#>>'{effective,extra_cost}',public.recipe_detail(r)->>'extra_cost')::numeric
        =case when stage in ('open','break') then 300 else 500 end);
    body:=body||jsonb_build_object('request_id',gen_random_uuid()::text,'expected_revision',public.recipe_detail(r)->'edit_revision','extras','[]'::jsonb);
    perform public.save_recipe(s,body);
    select count(*) into n from public.entity_change_events where entity_id=r;
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',700));
    perform pg_temp.ok(stage||': 명시적 제거 후에는 가격 변경을 전파하지 않음',
      not exists(select 1 from public.recipe_extra_costs where recipe_id=r and material_id=m)
      and (select count(*)=n from public.entity_change_events where entity_id=r));
    set local role postgres;
  end loop;
  perform pg_temp.ok('새 정규화·비교 helper는 앱에 공개되지 않음',
    not has_function_privilege('authenticated','public.recipe_edit_extra_rows_v3(jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','public.recipe_edit_shape_v3(uuid,jsonb)','EXECUTE'));
end $test$;
