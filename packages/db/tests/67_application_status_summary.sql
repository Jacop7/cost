-- Cost-only materials use ingredient history; metadata edits cannot hide pending cost.
set local role postgres;
do $test$
declare u uuid:=gen_random_uuid(); s uuid; m uuid; r uuid; bd uuid; d date;
  pending_at text; n integer; p jsonb; h jsonb;
begin
  insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(create_store('통합 재료 대기 요약','Asia/Seoul')->>'store_id')::uuid; d:=store_local_date(s);
  p:='{"name":"용기","base_unit":"ea","per_volume":1,"stock_tracking":true,"purchase_price":300}';
  m:=save_ingredient(s,p); p:=p||jsonb_build_object('id',m);
  r:=pg_temp.save_recipe_fixture(s,jsonb_build_object('name','용기 메뉴','price',1000,'base_servings',1,
    'lines',jsonb_build_array(jsonb_build_object('ingredient_id',m,'input_qty',1))));
  perform pg_temp.ok('영업 전 대기 없음',last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
  set local role postgres;
  insert into business_days(store_id,business_date,status,planned_close_at,snapshot)
    values(s,d,'open',clock_timestamp()+interval '1 hour',build_day_snapshot(s,d)) returning id into bd;
  perform pg_temp.as_owner(u);
  p:=p||'{"purchase_price":500}'; perform save_ingredient(s,p);
  pending_at:=last_entity_change(s,'ingredient',m)->>'pending_occurred_at';
  perform pg_temp.ok('원가 변경의 대기 시각 있음',pending_at is not null);
  perform pg_temp.ok('연결 메뉴 대기 표시',last_entity_change(s,'recipe',r)->>'has_pending_change'='true');
  for n in 1..21 loop
    p:=p||jsonb_build_object('name','용기 '||n); perform save_ingredient(s,p);
  end loop;
  h:=last_entity_change(s,'ingredient',m);
  perform pg_temp.ok('21회 이름 변경 뒤 원가 대기와 시각 유지',h->>'pending_occurred_at'=pending_at and h->>'has_pending_change'='true');
  h:=entity_change_history(s,'ingredient',m,null,20,7);
  perform pg_temp.ok('첫 페이지 밖의 원가 변경도 대기 요약 유지',jsonb_array_length(h->'items')=20 and last_entity_change(s,'ingredient',m)->>'pending_occurred_at'=pending_at);
  set local role postgres; update business_days set status='break' where id=bd; perform pg_temp.as_owner(u);
  perform pg_temp.ok('브레이크도 대기 유지',last_entity_change(s,'ingredient',m)->>'pending_occurred_at'=pending_at);
  set local role postgres; perform close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
  perform pg_temp.ok('종료하면 재료·메뉴 대기 해제',last_entity_change(s,'ingredient',m)->>'has_pending_change'='false' and last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
  perform pg_temp.as_owner(pg_temp.owner());
  perform pg_temp.raises('다른 매장 이력 격리',format('select entity_change_history(%L::uuid,''ingredient'',%L::uuid)',s,m),'42501');
end $test$;
