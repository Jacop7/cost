set local role postgres;
do $test$
declare stage text; u uuid; s uuid; r uuid; d date; body jsonb; n bigint; trends bigint;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('메뉴 정보 이력 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','메뉴','price',12000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,
      'extras','[{"name":"임시 비용","qty":1,"amount":300}]'::jsonb);
    r:=public.save_recipe(s,body);
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d));
      if stage='break' then update public.business_days set status='break' where store_id=s; end if;
      if stage='closed' then perform public.close_business_day_row((select id from public.business_days where store_id=s),'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    select count(*) into n from public.entity_change_events where entity_id=r;
    select count(*) into trends from public.profit_trends where recipe_id=r;
    body:=body||jsonb_build_object('patch','full','id',r,'expected_revision',public.recipe_detail(r)->'edit_revision',
      'request_id',gen_random_uuid()::text,'extras','[{"name":"명칭 수정","qty":1,"amount":300}]'::jsonb);
    perform public.save_recipe(s,body);
    perform pg_temp.ok(stage||': 임시 부자재 이름 변경은 직접 이력만 기록',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false'
      and (select count(*)=trends from public.profit_trends where recipe_id=r));
    select count(*) into n from public.entity_change_events where entity_id=r;
    perform public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','memo','id',r,
      'expected_revision',public.recipe_detail(r)->'edit_revision','request_id',gen_random_uuid()::text,'memo','메모만 수정'));
    perform pg_temp.ok(stage||': 메모는 기존 이력 제외 계약·추이 불변',
      (select count(*)=n from public.entity_change_events where entity_id=r)
      and (select count(*)=trends from public.profit_trends where recipe_id=r)
      and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
    set local role postgres;
  end loop;
end $test$;
