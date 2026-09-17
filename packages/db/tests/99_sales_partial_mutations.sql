-- Actual public save contract used by Home/Expense: stopped historical rows are
-- preserved while a selected menu or an ancillary array is updated. Synthetic,
-- transactional fixture; the runner rolls all changes back.
do $test$
declare
  v_store uuid := pg_temp.store(); day_date date; stopped_id uuid := pg_temp.rcp('제육볶음');
  editable_id uuid := pg_temp.rcp('공기밥'); ingredient_id uuid; need numeric;
  sale_id uuid; stopped_item uuid; before_events bigint; before_stock numeric;
  revision integer; result jsonb; menu_input jsonb; extras jsonb; etc jsonb;
begin
  perform pg_temp.open_today(); day_date := pg_temp.today();
  select coalesce(d.revision,0) into revision from public.daily_sales d where d.store_id=v_store and d.sale_date=day_date;
  revision := coalesce(revision,0);
  result := public.save_sale(v_store,day_date,jsonb_build_array(
    jsonb_build_object('recipe_id',stopped_id,'qty_hall',1,'qty_delivery',0,'qty_takeout',0,'qty_waste',0),
    jsonb_build_object('recipe_id',editable_id,'qty_hall',1,'qty_delivery',0,'qty_takeout',0,'qty_waste',0)),null,null,revision);
  revision := (result->>'revision')::integer;
  select id into sale_id from public.daily_sales d where d.store_id=v_store and d.sale_date=day_date;
  select id into stopped_item from public.daily_sales_items where daily_sales_id=sale_id and recipe_id=stopped_id;
  select count(*) into before_events from public.inventory_events where sales_item_id=stopped_item;
  update public.recipes set active=false where id=stopped_id;
  menu_input := jsonb_build_array(jsonb_build_object('recipe_id',editable_id,'qty_hall',2,'qty_delivery',0,'qty_takeout',0,'qty_waste',0));
  perform pg_temp.raises('옛 전체 메뉴 재전송은 중지된 메뉴 때문에 거절됨', format(
    'select public.save_sale(%L,%L,%L::jsonb,null,null,%s)',v_store,day_date,
    menu_input || jsonb_build_array(jsonb_build_object('recipe_id',stopped_id,'qty_hall',1,'qty_delivery',0,'qty_takeout',0,'qty_waste',0)),revision),'22000');
  select n.ingredient_id,n.amount into ingredient_id,need from public.recipe_ingredient_needs(editable_id,1) n order by n.ingredient_id limit 1;
  perform pg_temp.ok('선택 메뉴의 실제 소진 재료가 있음',ingredient_id is not null and need>0);
  before_stock := public.stock_total_base(ingredient_id);
  result := public.save_sale(v_store,day_date,menu_input,null,null,revision);
  revision := (result->>'revision')::integer;
  perform pg_temp.eq('다른 정상 메뉴의 증가분1개만 소진',before_stock-public.stock_total_base(ingredient_id),need,0.0001);
  perform pg_temp.eq('중지 메뉴 판매 수량은 보존',(select qty_hall from public.daily_sales_items where id=stopped_item),1);
  perform pg_temp.eq('중지 메뉴의 소진 원장 추가 없음',(select count(*) from public.inventory_events where sales_item_id=stopped_item),before_events);
  etc := '[{"name":"부분 저장 음료","price":2000,"qty":2,"channel":"hall"}]'::jsonb;
  extras := '[{"name":"부분 저장 얼음","amount":1500}]'::jsonb;
  before_stock := public.stock_total_base(ingredient_id);
  result := public.save_sale(v_store,day_date,'[]'::jsonb,etc,extras,revision);
  perform pg_temp.eq('빈 items의 기타매출/지출 저장은 메뉴 재고 불변',public.stock_total_base(ingredient_id),before_stock,0.0001);
  perform pg_temp.eq('빈 items는 기존 정상 메뉴 판매 보존',(select qty_hall from public.daily_sales_items where daily_sales_id=sale_id and recipe_id=editable_id),2);
  perform pg_temp.eq('기타 매출 금액',(select etc_revenue from public.daily_sales where id=sale_id),4000);
  perform pg_temp.eq('추가 지출 금액',(select daily_extra from public.daily_sales where id=sale_id),1500);
  perform pg_temp.raises('응답 유실 후 이전 판본의 같은 목표 재시도는 중복 반영하지 않음',format(
    'select public.save_sale(%L,%L,''[]''::jsonb,%L::jsonb,%L::jsonb,%s)',v_store,day_date,etc,extras,revision),'45009');
  revision := (result->>'revision')::integer;
  result := public.save_sale(v_store,day_date,'[]'::jsonb,null,'[]'::jsonb,revision);
  revision := (result->>'revision')::integer;
  perform pg_temp.eq('null 기타 배열은 기존 기타매출 보존',(select etc_revenue from public.daily_sales where id=sale_id),4000);
  perform pg_temp.eq('명시 빈 지출 배열만 삭제',(select daily_extra from public.daily_sales where id=sale_id),0);
  result := public.save_sale(v_store,day_date,jsonb_build_array(jsonb_build_object('recipe_id',editable_id,'qty_hall',1,'qty_delivery',0,'qty_takeout',0,'qty_waste',0)),null,null,revision);
  perform pg_temp.eq('정상 메뉴 감소1개분만 복원',public.stock_total_base(ingredient_id)-before_stock,need,0.0001);
  perform pg_temp.eq('후속 감소에도 중지 메뉴 원장 보존',(select count(*) from public.inventory_events where sales_item_id=stopped_item),before_events);
end $test$;
