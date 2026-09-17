-- 구매 옵션 등록 응답이 유실돼 같은 폼을 다시 제출해도 동일 옵션을 중복 생성하지 않는다.
-- 금액 등 내용이 달라지면 같은 상품명도 별도 옵션으로 등록할 수 있다.
do $test$
declare
  s uuid := pg_temp.store();
  v_ingredient uuid := pg_temp.ing('대파');
  vendor_id uuid;
  body jsonb;
  first_id uuid;
  replay_id uuid;
  changed_id uuid;
  before_count bigint;
  before_changes bigint;
begin
  select id into vendor_id from public.vendors where store_id = s and not hidden order by id limit 1;
  body := jsonb_build_object(
    'id', '',
    'ingredient_id', v_ingredient,
    'purchase_name', '응답 유실 대파 1kg',
    'vendor_id', vendor_id,
    'volume', 1000,
    'base_unit', 'g',
    'amount', 4000,
    'url', 'https://example.com/retry-scallion'
  );

  select count(*) into before_changes
    from public.entity_change_events
   where store_id = s and entity_id = v_ingredient and title = '구매 링크 추가';
  first_id := public.save_purchase_option(s, body);
  select count(*) into before_count
    from public.purchase_options
   where store_id = s and ingredient_id = v_ingredient and purchase_name = '응답 유실 대파 1kg';

  replay_id := public.save_purchase_option(s, body);
  perform pg_temp.eq_t('같은 구매 옵션 재시도는 기존 ID 반환', replay_id::text, first_id::text);
  perform pg_temp.eq(
    '같은 구매 옵션 재시도는 행을 늘리지 않음',
    (select count(*) from public.purchase_options where store_id = s and ingredient_id = v_ingredient and purchase_name = '응답 유실 대파 1kg'),
    before_count
  );
  perform pg_temp.eq(
    '같은 구매 옵션 재시도는 추가 이력을 늘리지 않음',
    (select count(*) from public.entity_change_events where store_id = s and entity_id = v_ingredient and title = '구매 링크 추가'),
    before_changes + 1
  );

  changed_id := public.save_purchase_option(s, body || jsonb_build_object('amount', 4500));
  perform pg_temp.ok('금액이 다른 옵션은 별도 ID로 등록', changed_id <> first_id);
  perform pg_temp.eq(
    '금액이 다른 옵션까지 합쳐 두 행',
    (select count(*) from public.purchase_options where store_id = s and ingredient_id = v_ingredient and purchase_name = '응답 유실 대파 1kg'),
    before_count + 1
  );
  perform pg_temp.eq(
    '금액이 다른 별도 옵션은 추가 이력을 한 건 남김',
    (select count(*) from public.entity_change_events where store_id = s and entity_id = v_ingredient and title = '구매 링크 추가'),
    before_changes + 2
  );
end $test$;
