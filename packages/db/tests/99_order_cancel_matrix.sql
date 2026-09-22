-- E12 미입고 발주 취소의 정상·재시도·부분입고 거절·매장 격리를 한 표로 고정한다.
-- 재고와 단가는 입고/취소 원장만 바꿀 수 있고, E12는 발주 상태와 후보만 바꿔야 한다.
do $test$
declare
  s uuid:=pg_temp.store(); i uuid; o uuid; result jsonb;
  before_stock numeric; before_price numeric; before_events bigint;
  before_order jsonb; before_candidate text;
begin
  i:=save_ingredient(s,
    '{"contract_version":3,"name":"E12 정상 취소","base_unit":"g","safety_stock":1000}');
  perform e5_stock_adjusted(i,0,false,'0 재고 확인');
  perform refresh_order_candidate(i);
  before_candidate:=(select status::text from order_candidates where ingredient_id=i);
  before_stock:=coalesce(stock_total_base(i),0);
  before_price:=current_ingredient_unit_price(i);
  select count(*) into before_events from inventory_events where ingredient_id=i;

  o:=e7_place_order(s,i,null,null,1000,4000,2,store_local_date(s));
  perform pg_temp.eq_t('E7 뒤 후보는 주문함',
    (select status::text from order_candidates where ingredient_id=i),'ordered');
  perform pg_temp.eq('E7은 재고 불변',coalesce(stock_total_base(i),0),before_stock);
  perform pg_temp.ok('E7은 단가 불변',current_ingredient_unit_price(i) is not distinct from before_price);
  perform pg_temp.eq('E7은 재고 원장 추가 없음',
    (select count(*) from inventory_events where ingredient_id=i),before_events,0);

  result:=e12_order_canceled(o,'사용자 취소');
  perform pg_temp.ok('첫 취소는 실제 상태 전이',(result->>'already_canceled')::boolean is false);
  perform pg_temp.eq_t('발주 원본은 canceled로 보존',(select status::text from order_records where id=o),'canceled');
  perform pg_temp.eq_t('취소 뒤 후보는 재판정',
    (select status::text from order_candidates where ingredient_id=i),before_candidate);
  perform pg_temp.eq('E12는 재고 불변',coalesce(stock_total_base(i),0),before_stock);
  perform pg_temp.ok('E12는 단가 불변',current_ingredient_unit_price(i) is not distinct from before_price);
  perform pg_temp.eq('E12는 재고 원장 추가 없음',
    (select count(*) from inventory_events where ingredient_id=i),before_events,0);

  select to_jsonb(r) into before_order from order_records r where r.id=o;
  result:=e12_order_canceled(o,'같은 취소 재시도');
  perform pg_temp.ok('같은 발주 취소 재시도는 무변경',(result->>'already_canceled')::boolean);
  perform pg_temp.ok('재시도는 발주 행도 바꾸지 않음',
    before_order=(select to_jsonb(r) from order_records r where r.id=o));
  perform pg_temp.eq('재시도는 원장 추가 없음',
    (select count(*) from inventory_events where ingredient_id=i),before_events,0);
end $test$;

do $test$
declare
  s uuid:=pg_temp.store(); i uuid; o uuid;
  before_stock numeric; before_price numeric; before_events bigint; before_order jsonb;
begin
  i:=save_ingredient(s,'{"contract_version":3,"name":"E12 부분입고 거절","base_unit":"g"}');
  o:=e7_place_order(s,i,null,null,1000,4000,2,store_local_date(s));
  perform e1_confirm_inbound(o,1,'e12-partial-inbound');
  before_stock:=stock_total_base(i);
  before_price:=current_ingredient_unit_price(i);
  select count(*) into before_events from inventory_events where ingredient_id=i;
  select to_jsonb(r) into before_order from order_records r where r.id=o;

  perform pg_temp.raises('부분 입고 발주는 E12로 취소할 수 없음',
    format('select e12_order_canceled(%L,%L)',o,'부분입고 뒤 취소'));
  perform pg_temp.ok('거절 뒤 발주 행 보존',before_order=(select to_jsonb(r) from order_records r where r.id=o));
  perform pg_temp.eq('거절 뒤 재고 보존',stock_total_base(i),before_stock);
  perform pg_temp.eq('거절 뒤 단가 보존',current_ingredient_unit_price(i),before_price);
  perform pg_temp.eq('거절 뒤 원장 보존',
    (select count(*) from inventory_events where ingredient_id=i),before_events,0);
end $test$;

set local role postgres;
do $test$
declare
  owner_a uuid:=pg_temp.owner(); owner_b uuid; store_b uuid; ingredient_b uuid; order_b uuid;
  before_order jsonb; before_events bigint;
begin
  owner_b:=pg_temp.new_owner();
  perform pg_temp.as_owner(owner_b);
  store_b:=(create_store('E12 다른 매장','Asia/Seoul')->>'store_id')::uuid;
  ingredient_b:=save_ingredient(store_b,
    '{"contract_version":3,"name":"다른 매장 발주","base_unit":"g","safety_stock":1000}');
  order_b:=e7_place_order(store_b,ingredient_b,null,null,1000,4000,1,store_local_date(store_b));
  select to_jsonb(r) into before_order from order_records r where r.id=order_b;
  select count(*) into before_events from inventory_events where ingredient_id=ingredient_b;

  perform pg_temp.as_owner(owner_a);
  perform pg_temp.raises('다른 매장 발주 취소 거절',
    format('select e12_order_canceled(%L,%L)',order_b,'권한 없는 취소'));

  perform pg_temp.as_owner(owner_b);
  perform pg_temp.ok('권한 거절 뒤 다른 매장 발주 보존',
    before_order=(select to_jsonb(r) from order_records r where r.id=order_b));
  perform pg_temp.eq('권한 거절 뒤 다른 매장 원장 불변',
    (select count(*) from inventory_events where ingredient_id=ingredient_b),before_events,0);
  perform pg_temp.eq('권한 거절 뒤 다른 매장 재고 0',coalesce(stock_total_base(ingredient_b),0),0);
  perform pg_temp.as_owner(owner_a);
end $test$;
