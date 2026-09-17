do $test$
declare s uuid:=pg_temp.store(); i uuid; o uuid; other_order uuid; result jsonb; n numeric; stock numeric;
begin
  i:=save_ingredient(s,'{"name":"부분 입고 확인 시험","base_unit":"g","per_volume":1}');
  o:=e7_place_order(s,i,null,null,1000,4000,5,null,'manual');
  other_order:=e7_place_order(s,i,null,null,1000,4000,5,null,'manual');
  select count(*) into n from inventory_events where store_id=s;
  result:=resolve_order_inbound(s,o,'order-absent');
  perform pg_temp.eq_t('미반영 요청 종료',result->>'status','not_recorded');
  perform pg_temp.eq_t('발주 scope 반환',result->>'order_id',o::text);
  perform pg_temp.eq_t('반복 확인',resolve_order_inbound(s,o,'order-absent')->>'status','not_recorded');
  perform pg_temp.eq('조회 원장 불변',(select count(*) from inventory_events where store_id=s),n);
  perform pg_temp.eq('조회 발주 불변',(select received_qty from order_records where id=o),0);
  perform pg_temp.raises('종료 키의 지연 E1 차단',format('select e1_confirm_inbound(%L,1,%L)',o,'order-absent'),'45010');
  perform pg_temp.raises('종료 키 다른 발주 조회 차단',format('select resolve_order_inbound(%L,%L,%L)',s,other_order,'order-absent'),'22000');
  result:=e1_confirm_inbound(o,1,'order-recorded');
  perform pg_temp.eq('부분 입고 1개 실제 처리',(result->>'received_qty')::numeric,1);
  select stock_total into stock from inventory_states where ingredient_id=i;
  select count(*) into n from inventory_events where store_id=s;
  perform pg_temp.eq_t('응답 유실 뒤 반영 확인',resolve_order_inbound(s,o,'order-recorded')->>'status','recorded');
  perform pg_temp.eq('재확인 원장 불변',(select count(*) from inventory_events where store_id=s),n);
  perform pg_temp.eq('재확인 재고 불변',(select stock_total from inventory_states where ingredient_id=i),stock);
  perform e1_confirm_inbound(o,2,'order-recorded');
  perform pg_temp.eq('동일 키 수정 수량은 재입고하지 않음',(select received_qty from order_records where id=o),1);
  perform pg_temp.raises('기록 키 타 발주 조회 차단',format('select resolve_order_inbound(%L,%L,%L)',s,other_order,'order-recorded'),'22000');
  perform pg_temp.raises('기록 키 타 발주 쓰기 차단',format('select e1_confirm_inbound(%L,1,%L)',other_order,'order-recorded'),'22000');
  perform e1_confirm_inbound(o,1,'order-new');
  perform pg_temp.eq('별도 입고는 같은 수량 허용',(select received_qty from order_records where id=o),2);
  result:=e1_confirm_inbound(o,9,'order-capped');
  perform pg_temp.eq('잔여량 상한 보존',(result->>'received_qty')::numeric,3);
  perform pg_temp.eq('입고 원장 총량',(select sum(count_delta) from inventory_events where order_record_id=o),5000);
  perform pg_temp.eq('재고 원장 일치',(select stock_total from inventory_states where ingredient_id=i),5000);
  perform e11_inbound_reverted(o,'시험 취소');
  perform pg_temp.eq_t('취소 후에도 이전 입고는 기록된 요청',resolve_order_inbound(s,o,'order-recorded')->>'status','recorded');
  perform pg_temp.raises('다른 매장 resolver 차단',format('select resolve_order_inbound(%L,%L,%L)',gen_random_uuid(),o,'other'),'42501');
  perform pg_temp.raises('없는 발주 resolver 차단',format('select resolve_order_inbound(%L,%L,%L)',s,gen_random_uuid(),'missing'),'P0002');
  perform pg_temp.raises('빈 키 차단',format('select resolve_order_inbound(%L,%L,%L)',s,o,''),'22000');
  perform pg_temp.ok('앱 직접 종료 테이블 쓰기 차단',not has_table_privilege('authenticated','public.order_inbound_closed_requests','INSERT'));
  perform pg_temp.ok('authenticated 전용 resolver',has_function_privilege('authenticated','public.resolve_order_inbound(uuid,uuid,text)','execute')
    and not has_function_privilege('anon','public.resolve_order_inbound(uuid,uuid,text)','execute')
    and not has_function_privilege('service_role','public.resolve_order_inbound(uuid,uuid,text)','execute'));
end $test$;
