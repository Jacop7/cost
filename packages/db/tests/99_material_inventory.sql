-- Normal inventory applies to all newly registered and migrated materials.
do $test$
declare s uuid:=pg_temp.store(); i uuid; r uuid; o uuid; v uuid; day date; n bigint;
begin
  perform pg_temp.raises('구형 클라이언트의 재고 제외 등록 거부',
    format('select save_ingredient(%L::uuid,%L::jsonb)',s,
      '{"name":"재고 제외 시도","base_unit":"ea","per_volume":1,"purchase_price":10,"stock_tracking":false}'), '55000');
  i:=save_ingredient(s,'{"name":"재고 통합 용기","base_unit":"ea","per_volume":1,"purchase_price":10}');
  perform pg_temp.ok('새 재료는 재고 추적', (select stock_tracking from ingredients where id=i));
  perform pg_temp.eq('등록이 임의 입고 원장을 만들지 않음',(select count(*) from inventory_events where ingredient_id=i),0);
  select id into v from vendors where store_id=s limit 1;
  o:=e7_place_order(s,i,v,null,1,20,10,pg_temp.today());
  perform e1_confirm_inbound(o,10,'inventory-unification-inbound');
  perform pg_temp.eq('입고한 10개 반영',stock_total_base(i),10);
  perform pg_temp.eq('입고 단가가 이관 기준단가를 갱신',current_ingredient_unit_price(i),20);
  perform e5_stock_adjusted(i,8,false,'재고 실사 검산');
  perform pg_temp.eq('재고 수정은 기존 원장으로 8개',stock_total_base(i),8);
  insert into recipes(store_id,name,price,base_servings) values(s,'재고 통합 메뉴',1000,1) returning id into r;
  insert into recipe_lines(store_id,recipe_id,ingredient_id,input_qty) values(s,r,i,2);
  day:=pg_temp.open_today();
  perform pg_temp.e10(s,day,r,3);
  perform pg_temp.eq('메뉴 3개 판매 × 사용량 2개 차감',stock_total_base(i),2);
  select count(*) into n from inventory_events where ingredient_id=i;
  perform pg_temp.e10(s,day,r,3);
  perform pg_temp.eq('동일 판매 저장은 원장 추가 없음',(select count(*) from inventory_events where ingredient_id=i),n);
  perform pg_temp.e10(s,day,r,1);
  perform pg_temp.eq('판매 수량 감소는 실제 차감분만 복원',stock_total_base(i),6);
  perform pg_temp.e10(s,day,r,5);
  perform pg_temp.eq('재고 부족도 숨기지 않고 음수 차감',stock_total_base(i),-2);
  perform pg_temp.e10(s,day,r,0);
  perform pg_temp.eq('판매 취소 후 실사 재고 복원',stock_total_base(i),8);
  perform pg_temp.eq('재고 상태와 원장 합계 일치',stock_total_base(i),
    (select sum(count_delta) from inventory_events where ingredient_id=i));
end $test$;
