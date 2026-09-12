set local role postgres;
do $test$
declare u uuid; s uuid; i uuid; o uuid; d date; body jsonb; other_u uuid; other_s uuid;
begin
  u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('부분 입고 단가','Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
  body:='{"name":"무연결 식재료","base_unit":"g","per_volume":1000,"purchase_price":10000}';
  i:=public.save_ingredient(s,body); body:=body||jsonb_build_object('id',i);
  o:=public.e7_place_order(s,i,null,null,2000,12000,2,d);
  perform pg_temp.eq('발주만으로 직접 수정 단가를 바꾸지 않음',public.current_ingredient_unit_price(i),10,0);
  perform public.e1_confirm_inbound(o,0.5,'partial-1',d);
  perform pg_temp.ok('부분 입고는 예정량 아닌 실제 입고량으로 평균 계산',
    public.current_ingredient_unit_price(i)=6 and public.base_unit_price(i)=6 and public.stock_total_base(i)=1000);
  body:=body||'{"purchase_price":20000,"per_volume":2000}'::jsonb;
  perform public.save_ingredient(s,body);
  perform pg_temp.eq('같은 구매 단가의 복합 변경도 직전 평균 대신 직접 기준10 적용',public.current_ingredient_unit_price(i),10,0);
  perform public.e1_confirm_inbound(o,0.5,'partial-1',d);
  perform pg_temp.eq('부분 입고 중복 응답은 직접 기준 보존',public.current_ingredient_unit_price(i),10,0);
  perform public.e1_confirm_inbound(o,1.5,'partial-2',d);
  perform pg_temp.ok('남은 실제 입고 확정은 평균으로 복귀',public.current_ingredient_unit_price(i)=6 and public.stock_total_base(i)=4000);
  body:=body||'{"purchase_price":16000}'::jsonb; perform public.save_ingredient(s,body);
  perform public.e1_confirm_inbound(o,null,null,d);
  perform pg_temp.eq('이미 전량 입고된 요청은 직접 기준8 유지',public.current_ingredient_unit_price(i),8,0);
  body:=body||'{"purchase_price":null}'::jsonb; perform public.save_ingredient(s,body);
  perform pg_temp.eq('직접 가격 없음은 남은 입고 평균으로 복귀',public.current_ingredient_unit_price(i),6,0);
  perform pg_temp.ok('무연결 식재료 변경은 가짜 메뉴 사건 생성 안 함',not exists(
    select 1 from public.entity_change_events where store_id=s and entity_type='recipe'));
  set local role postgres;
  other_u:=gen_random_uuid(); insert into auth.users(id) values(other_u); perform pg_temp.as_owner(other_u);
  other_s:=(public.create_store('다른 매장 단가','Asia/Seoul')->>'store_id')::uuid;
  perform pg_temp.ok('내부 실행 역할도 다른 매장 현재 단가를 읽지 못함',public.current_ingredient_unit_price(i) is null);
  perform pg_temp.raises('다른 매장 가격 변경 거부',format('select public.save_ingredient(%L,%L::jsonb)',s,body),'42501');
end $test$;
