-- Real authenticated RPC contract; harness rolls all fixture changes back.
set local role authenticated;
do $test$
declare i uuid; payload jsonb; snapshot jsonb; stock0 numeric; events0 bigint; changes0 bigint;
begin
  payload := jsonb_build_object('name','메모 충돌 검사','base_unit','g','per_volume',1000,
    'safety_stock',10,'min_order_qty',1,'purchase_price',4000,'memo','원본');
  i := save_ingredient(pg_temp.store(),payload);
  select to_jsonb(t) into snapshot from ingredients t where id=i;
  select count(*) into events0 from inventory_events;
  select count(*) into changes0 from entity_change_events;
  payload := payload || jsonb_build_object('id',i);
  perform save_ingredient(pg_temp.store(),jsonb_build_object('id',i,'patch','memo','memo','새 메모','expected_memo','원본'));
  perform pg_temp.ok('메모만 변경: 나머지 식재료 필드 보존',
    (select (to_jsonb(t)-'memo'-'updated_at')=(snapshot-'memo'-'updated_at') from ingredients t where id=i));
  perform pg_temp.ok('메모 수정은 원장과 수정내역을 만들지 않음',
    (select count(*) from inventory_events)=events0 and (select count(*) from entity_change_events)=changes0);
  perform save_ingredient(pg_temp.store(),jsonb_build_object('id',i,'patch','memo','memo','새 메모','expected_memo','원본'));
  perform pg_temp.raises('오래된 메모 저장 충돌',format('select save_ingredient(%L,%L::jsonb)',pg_temp.store(),
    jsonb_build_object('id',i,'patch','memo','memo','다른 메모','expected_memo','원본')),'40001');
  perform pg_temp.raises('메모 변경 뒤 오래된 전체 폼 저장 충돌',format('select save_ingredient(%L,%L::jsonb)',pg_temp.store(),
    payload || jsonb_build_object('name','오래된 화면 이름','expected',snapshot-'updated_at')),'40001');
  perform pg_temp.ok('충돌은 새 메모를 보존', (ingredient_detail(i)->>'memo')='새 메모');
  perform pg_temp.raises('메모 조건 누락은 거부',format('select save_ingredient(%L,%L::jsonb)',pg_temp.store(),
    jsonb_build_object('id',i,'patch','memo','memo','우회')),'22000');
  select to_jsonb(t) into snapshot from ingredients t where id=i;
  perform save_ingredient(pg_temp.store(),payload || jsonb_build_object('name','다른 이름','memo','새 메모','expected',snapshot-'updated_at'));
  perform pg_temp.raises('이름 변경 뒤 오래된 전체 폼 저장 충돌',format('select save_ingredient(%L,%L::jsonb)',pg_temp.store(),
    payload || jsonb_build_object('expected',snapshot-'updated_at')),'40001');
  perform save_ingredient(pg_temp.store(),jsonb_build_object('id',i,'patch','memo','memo','','expected_memo','새 메모'));
  perform pg_temp.ok('빈 메모는 null 저장하고 이름 보존',
    (ingredient_detail(i)->>'memo') is null and (ingredient_detail(i)->>'name')='다른 이름');
  perform pg_temp.raises('다른 매장 메모 경로 차단',format('select save_ingredient(%L,%L::jsonb)',gen_random_uuid(),
    jsonb_build_object('id',i,'patch','memo','memo','침입','expected_memo',null)),'42501');
end;
$test$;
