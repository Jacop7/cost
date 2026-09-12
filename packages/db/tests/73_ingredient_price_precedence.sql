set local role postgres;
do $test$
declare stage text; u uuid; s uuid; i uuid; r uuid; r2 uuid; other_r uuid; bd uuid; d date;
  body jsonb; menu jsonb; snap jsonb; first_order uuid; second_order uuid; result jsonb;
  n bigint; inv bigint; trends bigint; key text; corr uuid;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('단가 우선순위 '||stage,'Asia/Seoul')->>'store_id')::uuid;
    d:=public.store_local_date(s); key:=gen_random_uuid()::text;
    body:='{"name":"된장","base_unit":"g","per_volume":1000,"purchase_price":4000,"safety_stock":0,"min_order_qty":1}';
    i:=public.save_ingredient(s,body); body:=body||jsonb_build_object('id',i);
    result:=public.quick_inbound(s,i,1000,4000,1,null,d,gen_random_uuid()::text);
    first_order:=(result->>'order_id')::uuid;
    menu:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','된장찌개','price',12000,'base_servings',1,'target_profit_rate',30,
      'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',100)),'extras','[]'::jsonb);
    r:=public.save_recipe(s,menu);
    r2:=public.save_recipe(s,menu||jsonb_build_object('name','다른 인분 메뉴','base_servings',10,'request_id',gen_random_uuid()::text));
    other_r:=public.save_recipe(s,menu||jsonb_build_object('name','무연결','lines','[]'::jsonb,'request_id',gen_random_uuid()::text));
    set local role postgres;
    update public.recipes set active=false where id=r2;
    bd:=null;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id,snapshot into bd,snap;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    select count(*) into inv from public.inventory_events where store_id=s;
    select count(*) into n from public.entity_change_events where entity_id=r;
    body:=body||'{"purchase_price":10000}'::jsonb;
    perform public.save_ingredient(s,body);
    perform pg_temp.eq(stage||': 직접 가격 변경은 현재 단가10',public.current_ingredient_unit_price(i),10,0);
    perform pg_temp.eq(stage||': 실제 입고 평균4는 보존',public.base_unit_price(i),4,0);
    perform pg_temp.ok(stage||': 직접 수정은 재고 원장·입고 결제금액 불변',
      (select count(*)=inv from public.inventory_events where store_id=s)
      and public.stock_total_base(i)=1000 and (select amount=4000 from public.order_records where id=first_order));
    perform pg_temp.ok(stage||': 연결 메뉴·다른 기준인분·판매중지 메뉴 계산 갱신',
      public.recipe_material_cost(r)=1000 and public.recipe_material_cost(r2)=100
      and (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and not exists(select 1 from public.entity_change_events where entity_id=other_r and source_type='ingredient'));
    select correlation_id into corr from public.entity_change_events where entity_id=r order by occurred_at desc,id desc limit 1;
    perform pg_temp.ok(stage||': 식재료 직접·연결 메뉴 자동 사건의 상관관계',
      (select count(*)=3 from public.entity_change_events where correlation_id=corr)
      and exists(select 1 from public.entity_change_events where entity_id=i and correlation_id=corr and source_type='direct')
      and exists(select 1 from public.entity_change_events where entity_id=r2 and correlation_id=corr and source_type='ingredient'));
    perform pg_temp.ok(stage||': 영업 상태별 현재 매출 기준 보존',
      coalesce(public.recipe_detail(r)#>>'{effective,material_cost}',public.recipe_detail(r)->>'material_cost')::numeric
        =case when stage in ('open','break') then 400 else 1000 end);
    select count(*) into n from public.entity_change_events where entity_id=r;
    select count(*) into trends from public.price_trends where ingredient_id=i;
    perform public.save_ingredient(s,body);
    perform pg_temp.ok(stage||': 같은 값 저장은 자동 이력·단가추이 중복 없음',
      (select count(*)=n from public.entity_change_events where entity_id=r)
      and (select count(*)=trends from public.price_trends where ingredient_id=i));
    result:=public.quick_inbound(s,i,1000,12000,1,null,d,key); second_order:=(result->>'order_id')::uuid;
    perform pg_temp.ok(stage||': 다음 입고는 실입고 평균8로 자동 전환',
      public.current_ingredient_unit_price(i)=8 and public.base_unit_price(i)=8 and public.recipe_material_cost(r)=800
      and (select menu_unit_price_override is null from public.ingredients where id=i));
    perform public.save_ingredient(s,body);
    perform pg_temp.eq(stage||': 입고 뒤 단순 재저장은 이전 구매 가격을 다시 적용하지 않음',public.current_ingredient_unit_price(i),8,0);
    body:=body||'{"per_volume":2000}'::jsonb; perform public.save_ingredient(s,body);
    perform pg_temp.eq(stage||': 개당 용량만 변경해도 현재 단가5',public.current_ingredient_unit_price(i),5,0);
    perform public.quick_inbound(s,i,1000,12000,1,null,d,key);
    perform pg_temp.eq(stage||': 이전 입고 응답 재시도는 새 직접 단가를 덮지 않음',public.current_ingredient_unit_price(i),5,0);
    perform public.e11_inbound_reverted(second_order);
    perform pg_temp.eq(stage||': 입고 취소는 해당 건을 뺀 평균4',public.current_ingredient_unit_price(i),4,0);
    body:=body||'{"purchase_price":0}'::jsonb; perform public.save_ingredient(s,body);
    perform pg_temp.ok(stage||': 0원은 평균으로 폴백하지 않는 유효 단가',
      public.current_ingredient_unit_price(i)=0 and public.recipe_material_cost(r)=0);
    perform public.e11_inbound_reverted(second_order);
    perform pg_temp.eq(stage||': 중복 취소는 0원 직접 단가 유지',public.current_ingredient_unit_price(i),0,0);
    perform public.e11_inbound_reverted(first_order);
    perform pg_temp.ok(stage||': 남은 입고가 없으면 단가 없음',
      public.current_ingredient_unit_price(i) is null and public.base_unit_price(i) is null);
    if stage in ('open','break') then
      perform pg_temp.ok(stage||': 모든 연속 수정에도 영업 시작 스냅샷 불변',
        (select snapshot=snap from public.business_days where id=bd));
      perform public.quick_inbound(s,i,1000,6000,1,null,d,gen_random_uuid()::text);
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 대기 해제',public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
      perform pg_temp.eq(stage||': 종료 후 새 입고 평균의 메뉴 원가 노출',
        coalesce(public.recipe_detail(r)#>>'{effective,material_cost}',public.recipe_detail(r)->>'material_cost')::numeric,600,0);
    end if;
    set local role postgres;
  end loop;
  perform pg_temp.ok('현재 단가 계산은 앱 직접 실행 불가',
    not has_function_privilege('authenticated','public.current_ingredient_unit_price(uuid)','EXECUTE')
    and not has_function_privilege('anon','public.current_ingredient_unit_price(uuid)','EXECUTE'));
end $test$;
