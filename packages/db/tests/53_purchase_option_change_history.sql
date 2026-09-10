do $test$
declare
  ingredient uuid := pg_temp.ing('대파');
  option_id uuid;
  payload jsonb;
  entry jsonb;
  count_before int;
  stock_before numeric := stock_total_base(ingredient);
  price_before numeric := base_unit_price(ingredient);
begin
  select count(*) into count_before from entity_change_events where entity_id = ingredient;
  payload := jsonb_build_object('ingredient_id', ingredient, 'purchase_name', '시험 구매 링크', 'volume', 1000, 'amount', 4000, 'url', 'https://example.com');
  option_id := save_purchase_option(pg_temp.store(), payload);
  entry := entity_change_history(pg_temp.store(), 'ingredient', ingredient)->'items'->0;
  perform pg_temp.eq_t('구매 링크 추가가 실제 이력 RPC로 조회됨', entry->>'title', '구매 링크 추가');
  perform pg_temp.eq_t('구매 링크는 직접 수정', entry->>'source_type', 'direct');
  perform pg_temp.ok('단가/매출 영향 아님', not (entry->>'affects_sales')::boolean);
  payload := payload || jsonb_build_object('id', option_id, 'expected_revision',
    (select edit_revision::text from purchase_options where id=option_id));
  perform save_purchase_option(pg_temp.store(), payload);
  perform pg_temp.eq('동일값 저장은 사건 추가 없음', (select count(*) from entity_change_events where entity_id=ingredient), count_before+1, 0);
  payload := payload || jsonb_build_object('expected_revision',
    (select edit_revision::text from purchase_options where id=option_id));
  perform save_purchase_option(pg_temp.store(), payload || jsonb_build_object('amount', 4500));
  entry := entity_change_history(pg_temp.store(), 'ingredient', ingredient)->'items'->0;
  perform pg_temp.eq_t('수정 제목', entry->>'title', '구매 링크 수정');
  perform pg_temp.eq('바뀐 금액 한 필드만 기록', jsonb_array_length(entry->'changes'), 1, 0);
  perform pg_temp.eq('이전 금액', (entry->'changes'->0->>'before')::numeric, 4000, 0);
  perform pg_temp.eq('이후 금액', (entry->'changes'->0->>'after')::numeric, 4500, 0);
  perform delete_purchase_option(option_id);
  entry := entity_change_history(pg_temp.store(), 'ingredient', ingredient)->'items'->0;
  perform pg_temp.eq_t('삭제도 기록 보존', entry->>'title', '구매 링크 삭제');
  perform pg_temp.ok('삭제된 링크 이름의 이전값 보존', exists(select 1 from jsonb_array_elements(entry->'changes') c where c->>'key'='purchase_name' and c->>'before'='시험 구매 링크' and c->'after'='null'::jsonb));
  perform delete_purchase_option(option_id);
  perform pg_temp.eq('중복 삭제는 추가 이력 없음', (select count(*) from entity_change_events where entity_id=ingredient), count_before+3, 0);
  perform pg_temp.eq('재고 불변', stock_total_base(ingredient), stock_before, 0);
  perform pg_temp.eq('기준 단가 불변', base_unit_price(ingredient), price_before, 0);
  perform pg_temp.raises('남의 매장 링크 변경 거부', format('select save_purchase_option(%L,%L::jsonb)', '00000000-0000-0000-0000-0000000000ff',payload), null);
end
$test$;

-- Exercise the same public facade permissions as the signed-in Expo client.
set local role authenticated;
do $client$
declare option_id uuid; entry jsonb; ingredient uuid := pg_temp.ing('대파');
begin
  option_id := save_purchase_option(pg_temp.store(), jsonb_build_object(
    'ingredient_id',ingredient,'purchase_name','앱 권한 시험 링크','volume',1000,'amount',4000,'url','https://example.com'));
  entry := entity_change_history(pg_temp.store(),'ingredient',ingredient)->'items'->0;
  perform pg_temp.eq_t('앱 사용자 권한에서도 추가 기록 조회',entry->>'title','구매 링크 추가');
  perform delete_purchase_option(option_id);
  entry := entity_change_history(pg_temp.store(),'ingredient',ingredient)->'items'->0;
  perform pg_temp.eq_t('앱 사용자 권한에서도 삭제 기록 조회',entry->>'title','구매 링크 삭제');
  perform pg_temp.raises('내부 트리거 함수는 앱 RPC로 직접 호출 불가','select capture_purchase_option_change()', '42501');
end
$client$;
