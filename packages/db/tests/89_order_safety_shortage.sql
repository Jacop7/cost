set local role postgres;
do $test$
declare u uuid:=gen_random_uuid(); s uuid; i uuid; i_zero uuid; b jsonb; old_price numeric; old_stock numeric; n bigint;
begin
  insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('안전재고 발주','Asia/Seoul')->>'store_id')::uuid;
  i:=public.save_ingredient(s,'{"contract_version":3,"name":"식재료","base_unit":"g","safety_stock":3000}');
  set local role postgres;
  update public.ingredients set min_order_qty=100,per_volume=1 where id=i;
  perform public.refresh_order_candidate(i);
  perform pg_temp.as_owner(u);
  perform pg_temp.eq('재고 미입력은 발주 후보에서 제외',jsonb_array_length(public.order_board(s)->'candidates'),0,0);
  perform pg_temp.ok('미입력 목록 수량은 NULL',(select stock_total is null from public.ingredient_list_v2(s) where id=i));
  perform public.e5_stock_adjusted(i,0,false,'0 재고 확인');
  b:=public.order_board(s)->'candidates'->0;
  perform pg_temp.eq('입력한 0 재고는 발주 후보',jsonb_array_length(public.order_board(s)->'candidates'),1,0);
  perform pg_temp.eq('입력한 0 재고는 목록에도 0',(select stock_total from public.ingredient_list_v2(s) where id=i),0,0);
  perform pg_temp.eq('신규 용량 1·최소발주 100도 후보는 부족량 3000g',(b->>'shortage_total')::numeric,3000,0);
  perform pg_temp.eq('후보에 확정 구매 개수 없음',(b->>'recommended_qty')::numeric,0,0);
  i_zero:=public.save_ingredient(s,'{"contract_version":3,"name":"최소재고 0","base_unit":"g","safety_stock":0}');
  perform public.e5_stock_adjusted(i_zero,0,false,'0 재고 확인');
  perform pg_temp.ok('최소재고 0도 명시적 0 재고면 경계 후보',exists(
    select 1 from jsonb_array_elements(public.order_board(s)->'candidates') c
    where c->>'ingredient_id'=i_zero::text));
  perform public.save_ingredient(s,jsonb_build_object('contract_version',3,'id',i,'name','정보 수정','base_unit','g','safety_stock',3000));
  perform pg_temp.eq('폐기된 과거 최소발주 값은 보존',(select min_order_qty from public.ingredients where id=i),100,0);
  perform public.quick_inbound(s,i,300,1200,2,null,public.store_local_date(s),gen_random_uuid()::text);
  select c into b from jsonb_array_elements(public.order_board(s)->'candidates') c
  where c->>'ingredient_id'=i::text;
  perform pg_temp.eq('입고 후 실제 부족량',(b->>'shortage_total')::numeric,2400,0);
  old_price:=public.current_ingredient_unit_price(i); old_stock:=public.stock_total_base(i);
  select count(*) into n from public.inventory_events where ingredient_id=i;
  perform public.refresh_order_candidate(i);
  perform pg_temp.eq('후보 갱신은 재고를 변경하지 않음',public.stock_total_base(i),old_stock,0);
  perform pg_temp.eq('후보 갱신은 단가를 변경하지 않음',public.current_ingredient_unit_price(i),old_price,0);
  perform pg_temp.ok('원장 추가 없음',(select count(*)=n from public.inventory_events where ingredient_id=i));
  perform public.quick_inbound(s,i,300,1200,8,null,public.store_local_date(s),gen_random_uuid()::text);
  select c into b from jsonb_array_elements(public.order_board(s)->'candidates') c
  where c->>'ingredient_id'=i::text;
  perform pg_temp.ok('최소재고와 같아도 후보 유지',b is not null);
  perform pg_temp.eq('최소재고 경계의 부족량은 0',(b->>'shortage_total')::numeric,0,0);
  perform public.quick_inbound(s,i,1,4,1,null,public.store_local_date(s),gen_random_uuid()::text);
  perform pg_temp.ok('최소재고 초과 후 후보 해소',not exists(
    select 1 from jsonb_array_elements(public.order_board(s)->'candidates') c
    where c->>'ingredient_id'=i::text));
end $test$;
