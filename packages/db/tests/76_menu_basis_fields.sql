set local role postgres;
do $test$
declare stage text; u uuid; s uuid; r uuid; bd uuid; d date; body jsonb; n bigint; pending boolean; detail jsonb;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('메뉴 기준 필드 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','메뉴','price',12000,'base_servings',10,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb);
    r:=public.save_recipe(s,body);
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u); pending:=stage in ('open','break');
    n:=(select count(*) from public.profit_trends where recipe_id=r);
    body:=body||jsonb_build_object('patch','full','id',r,'expected_revision',public.recipe_detail(r)->'edit_revision',
      'request_id',gen_random_uuid()::text,'target_profit_rate',40);
    perform public.save_recipe(s,body); detail:=public.recipe_detail(r);
    perform pg_temp.ok(stage||': 목표율만 변경해도 적용 대기 판정·시작 목표 보존',
      (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending
      and coalesce(detail#>>'{effective,target_profit_rate}',detail->>'target_profit_rate')::numeric=case when pending then 30 else 40 end);
    body:=body||jsonb_build_object('expected_revision',detail->'edit_revision','request_id',gen_random_uuid()::text,'base_servings',5);
    perform public.save_recipe(s,body); detail:=public.recipe_detail(r);
    perform pg_temp.ok(stage||': 비용 없는 메뉴의 기준 인분 변경도 시작 기준 보존',
      coalesce(detail#>>'{effective,base_servings}',detail->>'base_servings')::numeric=case when pending then 10 else 5 end);
    perform pg_temp.ok(stage||': 목표·인분만 바뀌면 손익 추이를 만들지 않음',
      (select count(*)=n from public.profit_trends where recipe_id=r));
    if pending then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      detail:=public.recipe_detail(r);
      perform pg_temp.ok(stage||': 종료 후 목표·기준 인분 적용 및 대기 해제',
        (detail->>'target_profit_rate')::numeric=40 and (detail->>'base_servings')::numeric=5
        and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
    end if;
    set local role postgres;
  end loop;
end $test$;
