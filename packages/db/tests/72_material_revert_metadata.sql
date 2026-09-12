set local role postgres;
do $test$
declare stage text; u uuid; s uuid; m uuid; r uuid; bd uuid; d date; n bigint; conf bigint; trends bigint;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('부자재 원복과 정보 변경 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    m:=public.save_material(s,'{"name":"용기","unit_cost":300}');
    r:=public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','메뉴','price',12000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,
      'extras',jsonb_build_array(jsonb_build_object('material_id',m,'qty',1))));
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    select count(*) into n from public.entity_change_events where entity_id=r;
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',500));
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',300));
    perform pg_temp.ok(stage||': A→B→A 각각 별도 자동 이력과 상관 ID',
      (select count(*)=n+2 from public.entity_change_events where entity_id=r)
      and (select count(distinct correlation_id)=2 from public.entity_change_events where entity_id=r and source_type='material')
      and (public.recipe_detail(r)->>'extra_cost')::numeric=300);
    perform pg_temp.ok(stage||': 원복도 영업 중 기록의 대기는 유지',
      (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=(stage in ('open','break')));
    select count(*) into n from public.entity_change_events where entity_id=r;
    select count(*) into trends from public.profit_trends where recipe_id=r;
    select count(*) into conf from public.store_configuration_changes where store_id=s and kind='material';
    perform public.save_material(s,jsonb_build_object('id',m,'name','용기','unit_cost',300,'unit_label','세트','memo','보관 메모'));
    perform pg_temp.ok(stage||': 메모·단위 표기는 설정 이력만 추가',
      (select count(*)=conf+1 from public.store_configuration_changes where store_id=s and kind='material')
      and (select count(*)=n from public.entity_change_events where entity_id=r)
      and (select count(*)=trends from public.profit_trends where recipe_id=r));
    if stage in ('open','break') then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 원복 뒤 종료하면 대기 해제·같은 금액 추이 없음',
        public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false'
        and (select count(*)=trends from public.profit_trends where recipe_id=r));
    end if;
    set local role postgres;
  end loop;
end $test$;
