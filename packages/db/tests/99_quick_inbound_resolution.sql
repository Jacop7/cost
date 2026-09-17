do $test$
declare s uuid:=pg_temp.store(); i uuid; i2 uuid; result jsonb; n numeric; stock numeric; key text:='resolution-absent';
begin
  i:=save_ingredient(s,'{"name":"입고 결과 확인 시험","base_unit":"g","per_volume":1}');
  i2:=save_ingredient(s,'{"name":"다른 입고 재료","base_unit":"g","per_volume":1}');
  select count(*) into n from inventory_events where store_id=s;
  result:=resolve_quick_inbound(s,i,key);
  perform pg_temp.eq_t('미반영 요청은 새 입고 없이 종료',result->>'status','not_recorded');
  perform pg_temp.eq('상태 확인으로 원장을 만들지 않음',(select count(*) from inventory_events where store_id=s),n);
  perform pg_temp.eq_t('상태 재조회도 동일 결과',resolve_quick_inbound(s,i,key)->>'status','not_recorded');
  perform pg_temp.raises('종료 뒤 늦게 도착한 이전 요청 차단',format('select quick_inbound(%L,%L,1000,4000,1,null,null,%L)',s,i,key),'45010');
  perform pg_temp.raises('종료 키를 다른 재료에 재사용 불가',format('select resolve_quick_inbound(%L,%L,%L)',s,i2,key),'22000');
  perform quick_inbound(s,i,1000,4000,1,null,null,'resolution-new-one');
  select stock_total into stock from inventory_states where ingredient_id=i;
  select count(*) into n from inventory_events where store_id=s;
  result:=resolve_quick_inbound(s,i,'resolution-new-one');
  perform pg_temp.eq_t('이미 반영된 요청은 기록 확인만 수행',result->>'status','recorded');
  perform pg_temp.raises('기록된 요청 키의 다른 재료 조회 거절',format('select resolve_quick_inbound(%L,%L,%L)',s,i2,'resolution-new-one'),'22000');
  perform pg_temp.eq('확인 중 재고 불변',(select stock_total from inventory_states where ingredient_id=i),stock);
  perform pg_temp.eq('확인 중 원장 불변',(select count(*) from inventory_events where store_id=s),n);
  perform quick_inbound(s,i,1000,4000,1,null,null,'resolution-new-one');
  perform pg_temp.eq('동일 요청 재전송은 한 번만 반영',(select stock_total from inventory_states where ingredient_id=i),stock);
  perform quick_inbound(s,i,1000,4000,1,null,null,'resolution-new-two');
  perform pg_temp.eq('같은 금액 수량의 별도 입고 허용',(select stock_total from inventory_states where ingredient_id=i),stock+1000);
  perform pg_temp.raises('다른 매장 요청 조회 차단',format('select resolve_quick_inbound(%L,%L,%L)',gen_random_uuid(),i,'other'),'42501');
  perform pg_temp.ok('앱은 종료 요청 테이블에 직접 쓰지 못함',not has_table_privilege('authenticated','public.quick_inbound_closed_requests','INSERT'));
  perform pg_temp.ok('새 RPC는 authenticated 전용',has_function_privilege('authenticated','public.resolve_quick_inbound(uuid,uuid,text)','execute')
    and not has_function_privilege('anon','public.resolve_quick_inbound(uuid,uuid,text)','execute')
    and not has_function_privilege('service_role','public.resolve_quick_inbound(uuid,uuid,text)','execute'));
end $test$;
