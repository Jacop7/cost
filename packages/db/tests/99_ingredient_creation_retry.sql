-- 재료 등록 응답이 유실돼 같은 폼을 다시 제출해도 기존 재료를 찾아 완료해야 한다.
-- 같은 이름이지만 내용이 다른 별도 등록은 기존 중복 이름 오류를 유지한다.
do $test$
declare
  s uuid := pg_temp.store();
  category_id uuid;
  body jsonb;
  first_id uuid;
  replay_id uuid;
  before_count bigint;
begin
  select id into category_id
    from public.categories
   where store_id = s and kind = 'ingredient'
   order by id
   limit 1;

  body := jsonb_build_object(
    'contract_version', 3,
    'id', '',
    'name', '응답 유실 재료',
    'category_id', category_id,
    'base_unit', 'g',
    'stock_tracking', true,
    'safety_stock', 250,
    'default_vendor_id', '',
    'memo', ''
  );

  first_id := public.save_ingredient(s, body);
  select count(*) into before_count
    from public.ingredients
   where store_id = s and lower(btrim(name)) = lower('응답 유실 재료');

  replay_id := public.save_ingredient(s, body);
  perform pg_temp.eq_t('같은 등록 재시도는 기존 재료 ID 반환', replay_id::text, first_id::text);
  perform pg_temp.eq(
    '같은 등록 재시도는 재료 행을 늘리지 않음',
    (select count(*) from public.ingredients where store_id = s and lower(btrim(name)) = lower('응답 유실 재료')),
    before_count
  );
  perform pg_temp.eq(
    '같은 등록 재시도는 등록 이력을 늘리지 않음',
    (select count(*) from public.entity_change_events where store_id = s and entity_id = first_id and title = '식재료 등록'),
    1
  );

  perform pg_temp.raises(
    '같은 이름에 안전재고가 다른 등록은 별도 의도로 거절',
    format('select public.save_ingredient(%L,%L::jsonb)', s, body || jsonb_build_object('safety_stock', 500)),
    '23505'
  );
end $test$;
