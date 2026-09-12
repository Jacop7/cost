set local role postgres;
do $test$
declare u uuid:=gen_random_uuid(); s uuid; i uuid; b jsonb; old_price numeric; old_stock numeric; n bigint;
begin
  insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('안전재고 발주','Asia/Seoul')->>'store_id')::uuid;
  i:=public.save_ingredient(s,'{"contract_version":3,"name":"식재료","base_unit":"g","safety_stock":3000}');
  set local role postgres;
  update public.ingredients set min_order_qty=100,per_volume=1 where id=i;
  perform public.refresh_order_candidate(i);
  perform pg_temp.as_owner(u);
  b:=public.order_board(s)->'candidates'->0;
  perform pg_temp.eq('신규 용량 1·최소발주 100도 후보는 부족량 3000g',(b->>'shortage_total')::numeric,3000,0);
  perform pg_temp.eq('후보에 확정 구매 개수 없음',(b->>'recommended_qty')::numeric,0,0);
  perform public.save_ingredient(s,jsonb_build_object('contract_version',3,'id',i,'name','정보 수정','base_unit','g','safety_stock',3000));
  perform pg_temp.eq('폐기된 과거 최소발주 값은 보존',(select min_order_qty from public.ingredients where id=i),100,0);
  perform public.quick_inbound(s,i,300,1200,2,null,public.store_local_date(s),gen_random_uuid()::text);
  b:=public.order_board(s)->'candidates'->0;
  perform pg_temp.eq('입고 후 실제 부족량',(b->>'shortage_total')::numeric,2400,0);
  old_price:=public.current_ingredient_unit_price(i); old_stock:=public.stock_total_base(i);
  select count(*) into n from public.inventory_events where ingredient_id=i;
  perform public.refresh_order_candidate(i);
  perform pg_temp.eq('후보 갱신은 재고를 변경하지 않음',public.stock_total_base(i),old_stock,0);
  perform pg_temp.eq('후보 갱신은 단가를 변경하지 않음',public.current_ingredient_unit_price(i),old_price,0);
  perform pg_temp.ok('원장 추가 없음',(select count(*)=n from public.inventory_events where ingredient_id=i));
  perform public.quick_inbound(s,i,300,1200,8,null,public.store_local_date(s),gen_random_uuid()::text);
  perform pg_temp.eq('안전재고 충족 후 후보 해소',jsonb_array_length(public.order_board(s)->'candidates'),0,0);
end $test$;
