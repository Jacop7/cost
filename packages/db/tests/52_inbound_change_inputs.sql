-- Runs in the test harness transaction and is rolled back (0193).
do $test$
declare
  ingredient uuid := pg_temp.ing('대파');
  event_before int;
  change jsonb;
  order_id uuid;
begin
  select count(*) into event_before from entity_change_events where entity_id = ingredient;
  perform quick_inbound(pg_temp.store(), ingredient, 1000, 9876, 2, null, pg_temp.today(), 'T43-inbound');
  select changes into change from entity_change_events
   where entity_id = ingredient and title = '입고 단가 반영'
   order by occurred_at desc, id desc limit 1;
  perform pg_temp.eq('실입고량은 팩 용량 × 실제 수량',
    (select (v->>'after')::numeric from jsonb_array_elements(change) v where v->>'key'='received_quantity'), 2000, 0);
  perform pg_temp.eq('결제금액은 팩 금액 × 실제 수량',
    (select (v->>'after')::numeric from jsonb_array_elements(change) v where v->>'key'='paid_amount'), 19752, 0);
  perform pg_temp.eq('직접 수정 2개와 자동 갱신 1개', jsonb_array_length(change), 3, 0);
  perform pg_temp.eq_t('기준 단가는 자동 갱신', change->2->>'change_kind', 'derived');
  perform pg_temp.eq_t('실입고량은 직접 수정', change->0->>'change_kind', 'direct');
  perform pg_temp.ok('신규 입력 이전 값은 없음', change->0->'before' = 'null'::jsonb);
  perform quick_inbound(pg_temp.store(), ingredient, 1000, 9876, 2, null, pg_temp.today(), 'T43-inbound');
  perform pg_temp.eq('멱등 재요청은 수정 사건을 추가하지 않음',
    (select count(*) from entity_change_events where entity_id = ingredient), event_before + 1, 0);
  order_id := e7_place_order(pg_temp.store(), ingredient, null, null, 500, 1234, 5, pg_temp.today(), 'manual');
  perform e1_confirm_inbound(order_id, 2, 'T43-partial', pg_temp.today());
  select changes into change from entity_change_events
   where entity_id = ingredient and title = '입고 단가 반영'
   order by occurred_at desc, id desc limit 1;
  perform pg_temp.eq('부분입고는 주문 총량이 아닌 실제 2팩',
    (select (v->>'after')::numeric from jsonb_array_elements(change) v where v->>'key'='received_quantity'), 1000, 0);
  perform pg_temp.eq('부분입고 금액',
    (select (v->>'after')::numeric from jsonb_array_elements(change) v where v->>'key'='paid_amount'), 2468, 0);
end
$test$;
