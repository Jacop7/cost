-- A shared cost-only ingredient updates all linked menus, independent of inventory.
set local role postgres;
do $test$
declare stage text; u uuid; s uuid; m uuid; r uuid; r2 uuid; r0 uuid; bd uuid; d date; p jsonb;
  n bigint; n2 bigint; n0 bigint; stamp timestamptz;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(create_store('공통 재료 전파 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=store_local_date(s);
    p:='{"name":"용기","base_unit":"ea","per_volume":1,"stock_tracking":false,"purchase_price":300}';
    m:=save_ingredient(s,p); p:=p||jsonb_build_object('id',m);
    r:=pg_temp.save_recipe_fixture(s,jsonb_build_object('name','메뉴1','price',12000,'base_servings',1,'lines',jsonb_build_array(jsonb_build_object('ingredient_id',m,'input_qty',1))));
    r2:=pg_temp.save_recipe_fixture(s,jsonb_build_object('name','메뉴2','price',12000,'base_servings',1,'lines',jsonb_build_array(jsonb_build_object('ingredient_id',m,'input_qty',2))));
    r0:=pg_temp.save_recipe_fixture(s,'{"name":"미연결","price":12000,"base_servings":1,"lines":[]}');
    set local role postgres;
    if stage<>'before_open' then
      insert into business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update business_days set status='break' where id=bd; end if;
      if stage='closed' then perform close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    select count(*) into n from entity_change_events where entity_id=r;
    select count(*) into n2 from entity_change_events where entity_id=r2;
    select count(*) into n0 from entity_change_events where entity_id=r0;
    p:=p||'{"purchase_price":500}'; perform save_ingredient(s,p);
    perform pg_temp.ok(stage||': 수량별 원가 전파',(recipe_detail(r)->>'material_cost')::numeric=500 and (recipe_detail(r2)->>'material_cost')::numeric=1000);
    perform pg_temp.ok(stage||': 연결 메뉴 각각 한 번·미연결 없음',
      (select count(*)=n+1 from entity_change_events where entity_id=r) and (select count(*)=n2+1 from entity_change_events where entity_id=r2) and (select count(*)=n0 from entity_change_events where entity_id=r0));
    perform pg_temp.ok(stage||': 영업 중 시작 원가/영업 전후 최신 원가',coalesce(recipe_detail(r)#>>'{effective,material_cost}',recipe_detail(r)->>'material_cost')::numeric=case when stage in ('open','break') then 300 else 500 end);
    perform pg_temp.ok(stage||': 상태에 따른 대기',(last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=(stage in ('open','break')));
    select updated_at into stamp from ingredients where id=m;
    perform save_ingredient(s,p);
    perform pg_temp.ok(stage||': 무변경 저장은 시각과 전파 없음',(select updated_at=stamp from ingredients where id=m) and (select count(*)=n+1 from entity_change_events where entity_id=r));
    perform pg_temp.ok(stage||': 재고 원장 생성 없음',not exists(select 1 from inventory_events where ingredient_id=m));
    if stage in ('open','break') then
      set local role postgres; perform close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 적용·대기 해제',(recipe_detail(r)->>'material_cost')::numeric=500 and last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
    end if;
    set local role postgres;
  end loop;
end $test$;
