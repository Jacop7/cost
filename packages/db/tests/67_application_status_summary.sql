-- Pending application survives a later non-financial edit and pagination.
set local role postgres;
do $test$
declare u uuid:=gen_random_uuid(); s uuid; i uuid; r uuid; r2 uuid; m uuid; bd uuid;
  h jsonb; p jsonb; n integer; d date;
begin
  insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('적용 상태 요약 시험','Asia/Seoul')->>'store_id')::uuid;
  d:=public.store_local_date(s);
  i:=public.save_ingredient(s,'{"name":"된장","base_unit":"g","per_volume":3000,"purchase_price":12000,"safety_stock":0,"min_order_qty":1}');
  perform public.quick_inbound(s,i,3000,12000,1,null,d,gen_random_uuid()::text);
  m:=public.save_material(s,'{"name":"용기","unit_cost":300}');
  r:=public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
    'name','된장찌개','price',12000,'base_servings',1,'target_profit_rate',30,
    'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',100)),
    'extras',jsonb_build_array(jsonb_build_object('material_id',m,'name','용기','qty',1,'amount',300))));
  r2:=public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
    'name','부자재 단독 메뉴','price',12000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,
    'extras',jsonb_build_array(jsonb_build_object('material_id',m,'name','용기','qty',1,'amount',300))));
  perform pg_temp.ok('영업 전에는 대기가 없다',public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
  set local role postgres;
  insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
    values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
  perform pg_temp.as_owner(u);
  perform public.quick_inbound(s,i,3000,30000,1,null,d,gen_random_uuid()::text);
  perform public.save_ingredient(s,jsonb_build_object('id',i,'name','새 된장','base_unit','g','per_volume',3000,'purchase_price',12000,'safety_stock',0,'min_order_qty',1));
  h:=public.last_entity_change(s,'ingredient',i);
  perform pg_temp.ok('가격 대기 후 이름만 수정해도 대기를 유지한다',h->>'display_state'='irrelevant' and h->>'has_pending_change'='true');
  perform pg_temp.ok('변경된 식재료와 미연결인 메뉴는 대기가 아니다',public.last_entity_change(s,'recipe',r2)->>'has_pending_change'='false');
  p:=jsonb_build_object('id',m,'name','용기','unit_cost',500);
  perform public.save_material(s,p);
  perform pg_temp.ok('부자재 단가만 바뀌어도 해당 메뉴 대기를 표시한다',public.last_entity_change(s,'recipe',r2)->>'has_pending_change'='true');
  perform pg_temp.ok('부자재 가격 대기는 별도 요약으로 반환한다',public.store_configuration_history(s,'material')->>'has_pending_change'='true');
  for n in 1..21 loop
    p:=p||jsonb_build_object('memo','메모 '||n); perform public.save_material(s,p);
  end loop;
  h:=public.store_configuration_history(s,'material');
  perform pg_temp.ok('첫 페이지 밖 가격 변경도 대기 요약에 포함한다',h->>'has_pending_change'='true' and h->>'next_cursor' is not null and h#>>'{items,0,application_mode}'='immediate');
  h:=public.store_configuration_history(s,'material',null,h->>'next_cursor');
  perform pg_temp.ok('다음 페이지의 대기 요약도 일치한다',h->>'has_pending_change'='true');
  set local role postgres; update public.business_days set status='break' where id=bd; perform pg_temp.as_owner(u);
  perform pg_temp.ok('브레이크 중에도 대기를 유지한다',public.last_entity_change(s,'recipe',r)->>'has_pending_change'='true');
  set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
  perform pg_temp.ok('종료 후 메뉴 대기가 해제된다',public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
  perform pg_temp.ok('종료 후 설정 대기가 해제된다',public.store_configuration_history(s,'material')->>'has_pending_change'='false');
  perform pg_temp.as_owner(pg_temp.owner());
  perform pg_temp.raises('다른 매장 설정 요약은 조회할 수 없다',format('select public.store_configuration_history(%L::uuid,''material'')',s),'42501');
  perform pg_temp.ok('앱은 내부 최근 수정 요약 함수를 직접 호출할 수 없다',
    not has_function_privilege('authenticated','public.last_entity_change(uuid,text,uuid)','EXECUTE'));
end $test$;
