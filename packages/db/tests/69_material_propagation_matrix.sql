set local role postgres;
do $test$
declare stage text; u uuid; s uuid; m uuid; r uuid; r2 uuid; r0 uuid; d date; bd uuid; body jsonb;
  n bigint; n2 bigint; n0 bigint; trends bigint; conf bigint; stamp timestamptz; pending boolean;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('부자재 전파 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    m:=public.save_material(s,'{"name":"용기","unit_cost":300}');
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','메뉴1','price',12000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,
      'extras',jsonb_build_array(jsonb_build_object('material_id',m,'qty',1)));
    r:=public.save_recipe(s,body);
    r2:=public.save_recipe(s,body||jsonb_build_object('request_id',gen_random_uuid()::text,'name','메뉴2',
      'extras',jsonb_build_array(jsonb_build_object('material_id',m,'qty',2))));
    r0:=public.save_recipe(s,body||jsonb_build_object('request_id',gen_random_uuid()::text,'name','미연결','extras','[]'::jsonb));
    perform public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','active','id',r2,
      'request_id',gen_random_uuid()::text,'expected_revision',public.recipe_detail(r2)->'edit_revision','active',false));
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u); pending:=stage in ('open','break');
    select count(*) into n from public.entity_change_events where entity_id=r;
    select count(*) into n2 from public.entity_change_events where entity_id=r2;
    select count(*) into n0 from public.entity_change_events where entity_id=r0;
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',500));
    perform pg_temp.ok(stage||': 수량별 연결 메뉴 금액 갱신',
      (select amount_per_serving=500 from public.recipe_extra_costs where recipe_id=r)
      and (select amount_per_serving=1000 from public.recipe_extra_costs where recipe_id=r2));
    perform pg_temp.ok(stage||': 연결 메뉴 각각 자동 갱신 1건·미연결 0건',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and (select count(*)=n2+1 from public.entity_change_events where entity_id=r2)
      and (select count(*)=n0 from public.entity_change_events where entity_id=r0)
      and (select count(distinct correlation_id)=1 from public.entity_change_events where source_type='material' and store_id=s)
      and (select bool_and(affects_sales) from public.entity_change_events where source_type='material' and store_id=s));
    perform pg_temp.ok(stage||': 열린 영업 금액 유지/영업 전후 즉시 적용',
      coalesce(public.recipe_detail(r)#>>'{effective,extra_cost}',public.recipe_detail(r)->>'extra_cost')::numeric=case when pending then 300 else 500 end
      and (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending);
    perform pg_temp.ok(stage||': 시작 기준에 없는 판매 중지 메뉴도 원가·이력은 갱신하고 대기는 없음',
      public.last_entity_change(s,'recipe',r2)->>'has_pending_change'='false'
      and (public.recipe_detail(r2)->>'extra_cost')::numeric=1000);
    select count(*) into trends from public.profit_trends where recipe_id in (r,r2,r0);
    select count(*) into conf from public.store_configuration_changes where store_id=s;
    select updated_at into stamp from public.materials where id=m;
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',500));
    perform pg_temp.ok(stage||': 무변경 저장은 설정 이력·메뉴 이력·추이·시각 유지',
      (select count(*)=conf from public.store_configuration_changes where store_id=s)
      and (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and (select count(*)=trends from public.profit_trends where recipe_id in (r,r2,r0))
      and (select updated_at=stamp from public.materials where id=m));
    perform public.save_material(s,jsonb_build_object('id',m,'name','새 용기','unit_cost',500));
    perform pg_temp.ok(stage||': 이름 변경은 연결 이름·정보 이력만 갱신',
      (select bool_and(name='새 용기') from public.recipe_extra_costs where material_id=m)
      and (select count(*)=n+2 from public.entity_change_events where entity_id=r)
      and (select count(*)=trends from public.profit_trends where recipe_id in (r,r2,r0))
      and exists(select 1 from public.entity_change_events where entity_id=r and title='부자재 정보 반영' and not affects_sales));
    perform pg_temp.ok(stage||': 이름 변경이 이전 단가 대기를 숨기지 않음',
      (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending);
    perform public.save_material(s,jsonb_build_object('id',m,'name','새 용기','unit_cost',0));
    perform pg_temp.ok(stage||': 0원도 실제 단가 변경으로 기록',
      (select bool_and(amount_per_serving=0) from public.recipe_extra_costs where material_id=m)
      and (select count(*)=n+3 from public.entity_change_events where entity_id=r));
    perform public.save_fixed_costs(s,to_char(d,'YYYY-MM'),100000,'[{"key":"rent","total":20000}]');
    select count(*) into trends from public.profit_trends where recipe_id in (r,r2,r0);
    perform public.save_fixed_costs(s,to_char(d,'YYYY-MM'),100000,'[{"key":"rent","total":10000},{"key":"labor","total":10000}]');
    perform pg_temp.ok(stage||': 같은 고정지출 합계 구성 변경은 추이 추가 없음',
      (select count(*)=trends from public.profit_trends where recipe_id in (r,r2,r0)));
    if pending then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 최종 0원 반영·대기 해제',
        (public.recipe_detail(r)->>'extra_cost')::numeric=0 and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
    end if;
    select count(*) into n from public.entity_change_events where entity_id=r;
    perform public.deactivate_material(m);
    perform pg_temp.ok(stage||': 마스터 비활성화는 과거 메뉴 연결을 지우지 않음',
      (select count(*)=1 from public.recipe_extra_costs where material_id=m and recipe_id=r)
      and (select count(*)=n from public.entity_change_events where entity_id=r));
    set local role postgres;
  end loop;
  perform pg_temp.ok('앱 역할은 부자재 내부 writer 직접 실행 불가',
    not has_function_privilege('authenticated','public.recipe_edit_material_apply_v3(uuid,jsonb)','EXECUTE'));
end $test$;
