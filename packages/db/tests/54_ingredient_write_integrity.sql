-- Entire file runs in the harness transaction and rolls back.
select set_config('integrity.today',pg_temp.today()::text,true);
set local role authenticated;
do $test$
declare
  i uuid;
  payload jsonb;
  before_stock numeric;
  before_price numeric;
  result jsonb;
  option_id uuid;
  today date := current_setting('integrity.today')::date;
begin
  payload:=jsonb_build_object('name','저장 무결성 검사','base_unit','g','per_volume',1000,
    'safety_stock',0,'min_order_qty',1,'purchase_price',4000);
  i:=save_ingredient(pg_temp.store(),payload);
  perform pg_temp.eq('참고 구매 가격 저장·재조회', (ingredient_detail(i)->>'purchase_price')::numeric,4000,0);
  -- 0214: purchase price/capacity now supplies current menu cost, without an inbound.
  perform pg_temp.eq('구매 가격은 현재 메뉴 기준단가를 만든다', (ingredient_detail(i)->>'base_price')::numeric,4,0);
  payload:=payload || jsonb_build_object('id',i,'purchase_price',5000);
  perform save_ingredient(pg_temp.store(),payload);
  perform pg_temp.eq('참고 가격 수정 저장', (ingredient_detail(i)->>'purchase_price')::numeric,5000,0);
  perform pg_temp.ok('참고 가격 수정 내역 보존', exists(select 1 from jsonb_array_elements(
    entity_change_history(pg_temp.store(),'ingredient',i)->'items'->0->'changes') c
    where c->>'key'='purchase_price' and c->>'before'='4000' and c->>'after'='5000'));
  perform save_ingredient(pg_temp.store(),payload-'purchase_price');
  perform pg_temp.eq('다른 화면의 저장은 참고 가격을 지우지 않는다', (ingredient_detail(i)->>'purchase_price')::numeric,5000,0);
  perform pg_temp.raises('음수 참고 가격 거부',format('select save_ingredient(%L,%L::jsonb)',pg_temp.store(),payload||'{"purchase_price":-1}'::jsonb),'23514');
  perform pg_temp.raises('기준 차원 변경 거부',format('select save_ingredient(%L,%L::jsonb)',pg_temp.store(),payload||'{"base_unit":"ml"}'::jsonb),'22000');
  perform pg_temp.raises('잘못된 구매 링크 차원 거부',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),
    jsonb_build_object('ingredient_id',i,'base_unit','ml','volume',1000,'amount',4000)),'22000');
  option_id:=save_purchase_option(pg_temp.store(),jsonb_build_object('ingredient_id',i,'base_unit','g','volume',1000,'amount',4000));

  perform quick_inbound(pg_temp.store(),i,1000,4000,1,null,today,'integrity-in-1');
  result:=quick_inbound(pg_temp.store(),i,1000,4000,1,null,today,'integrity-in-1');
  perform pg_temp.ok('입고 통신 재시도는 중복 응답', (result->>'duplicate')::boolean);
  perform pg_temp.eq('재시도는 한 번만 입고', (ingredient_detail(i)->>'stock_total')::numeric,1000,0);
  perform quick_inbound(pg_temp.store(),i,1000,4000,1,null,today,'integrity-in-2');
  perform pg_temp.eq('동일한 내용의 별도 입고는 추가 반영', (ingredient_detail(i)->>'stock_total')::numeric,2000,0);
  perform pg_temp.raises('같은 키로 내용 바꿔 입고 불가',format('select quick_inbound(%L,%L,1000,5000,1,null,%L,''integrity-in-1'')',pg_temp.store(),i,today),'22000');
  perform pg_temp.raises('확인 뒤 바뀐 재고로 차감 불가',format('select change_stock_quantity(%L,''deduct'',100,1000,''조리 사용'',''stale-1'')',i),'40001');
  perform pg_temp.eq('오래된 확인은 재고 불변', (ingredient_detail(i)->>'stock_total')::numeric,2000,0);
  perform change_stock_quantity(i,'deduct',100,2000,'조리 사용','deduct-1');
  perform pg_temp.eq('차감은 요청 수량만 차감', (ingredient_detail(i)->>'stock_total')::numeric,1900,0);
  result:=change_stock_quantity(i,'deduct',100,2000,'조리 사용','deduct-1');
  perform pg_temp.ok('차감 재시도는 중복 응답', (result->>'duplicate')::boolean);
  perform pg_temp.eq('차감 중복은 재고 불변', (ingredient_detail(i)->>'stock_total')::numeric,1900,0);
  perform pg_temp.raises('폐기 사유 필수',format('select change_stock_quantity(%L,''discard'',100,1900,'''',''waste-empty'')',i),'22000');
  result:=change_stock_quantity(i,'discard',100,1900,'유통기한 경과','waste-1');
  perform pg_temp.eq('폐기도 요청 수량만 차감', (ingredient_detail(i)->>'stock_total')::numeric,1800,0);
  perform pg_temp.ok('폐기 사유가 재고 이력에 남는다',exists(select 1 from stock_history(i) e
    where e.note='유통기한 경과' and e.count_delta=-100));
  perform change_stock_quantity(i,'discard',100,1900,'유통기한 경과','waste-1');
  perform pg_temp.eq('폐기 중복은 재고 불변', (ingredient_detail(i)->>'stock_total')::numeric,1800,0);
  perform pg_temp.raises('과다 수량 거부',format('select change_stock_quantity(%L,''discard'',1900,1800,''폐기'',''too-much'')',i),'22000');
  perform pg_temp.raises('음수 수량 거부',format('select change_stock_quantity(%L,''discard'',-1,1800,''폐기'',''negative'')',i),'22000');
  perform pg_temp.raises('NaN 거부',format('select change_stock_quantity(%L,''discard'',''NaN'',1800,''폐기'',''nan'')',i),'22000');
  perform pg_temp.ok('폐기 private helper는 앱 직접 호출 불가',not has_function_privilege('authenticated','public.discard_stock_noted(uuid,numeric,date,text)','execute'));
  perform pg_temp.ok('영수증 직접 insert 불가',not has_table_privilege('authenticated','public.stock_quantity_receipts','insert'));
end;
$test$;
set local role margincook_rpc_executor;
