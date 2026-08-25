-- ════════════════════════════════════════════════════════════════
-- 15 · 빠른 입고 (0074)
--
-- 발주 없이 산 것을 바로 넣는다. 지금까지는 발주 → 입고 확정 2단계뿐이라
-- 시장에서 사 온 걸 넣으려면 있지도 않은 발주부터 만들어야 했다.
--
-- 지키는 것
--   ① 미리보기 = 확정 후 (다르면 그 화면을 두 번 다시 안 믿는다)
--   ② 두 번 눌러도 한 번만 들어간다
--   ③ 발주 기록이 남는다 — 기준단가가 거기서 나온다
--   ④ 한 트랜잭션 — 실패하면 유령 발주가 남지 않는다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_i    uuid := pg_temp.ing('고추장');
  v_day  date := business_day();
  v_pv   jsonb;
  v_res  jsonb;
  v_n0   int;
  v_s0   numeric;
begin
  v_s0 := stock_total_base(v_i);
  select count(*) into v_n0 from order_records where ingredient_id = v_i;

  -- ── ① 미리보기 = 확정 후 ────────────────────────────────────
  v_pv := quick_inbound_preview(pg_temp.store(), v_i, 5000, 23500, 1);
  perform pg_temp.eq('미리보기 · 재고 전', (v_pv->>'stock_before')::numeric, v_s0, 0.001);
  perform pg_temp.eq('미리보기 · 재고 후', (v_pv->>'stock_after')::numeric, v_s0 + 5000, 0.001);
  perform pg_temp.eq('미리보기 · 이번 입고 단가', (v_pv->>'inbound_unit_price')::numeric, 4.70, 0.0001);
  perform pg_temp.ok('영향 메뉴 수를 알려 준다', (v_pv->>'affected_recipes')::int > 0);

  v_res := quick_inbound(pg_temp.store(), v_i, 5000, 23500, 1, null, v_day, 'T15-A');

  perform pg_temp.eq('확정 후 재고 = 미리보기',
    stock_total_base(v_i), (v_pv->>'stock_after')::numeric, 0.001);
  -- ⚠ 여기가 핵심이다. 4.81 을 보고 눌렀는데 4.85 가 되면 안 된다.
  perform pg_temp.eq('확정 후 기준단가 = 미리보기',
    base_unit_price(v_i), (v_pv->>'base_price_after')::numeric, 0.000001);

  -- ── ② 두 번 눌러도 한 번 ────────────────────────────────────
  declare v_again jsonb;
  begin
    v_again := quick_inbound(pg_temp.store(), v_i, 5000, 23500, 1, null, v_day, 'T15-A');
    perform pg_temp.ok('같은 키는 중복으로 걸린다', (v_again->>'duplicate')::boolean);
    perform pg_temp.eq('재고가 두 번 늘지 않는다',
      stock_total_base(v_i), (v_pv->>'stock_after')::numeric, 0.001);
    perform pg_temp.eq('발주 기록도 한 건뿐',
      (select count(*) from order_records where ingredient_id = v_i), v_n0 + 1, 0);
  end;

  -- ── ③ 발주 기록이 남는다 ────────────────────────────────────
  perform pg_temp.eq_t('직접 넣은 것으로 표시된다',
    (select source::text from order_records where id = (v_res->>'order_id')::uuid), 'manual');
  perform pg_temp.eq('그 발주는 입고 완료다',
    (select received_qty from order_records where id = (v_res->>'order_id')::uuid), 1, 0);
  perform pg_temp.eq('팩 용량이 그대로 남는다',
    (select volume from order_records where id = (v_res->>'order_id')::uuid), 5000, 0);

  -- ── 값 검사 ─────────────────────────────────────────────────
  perform pg_temp.raises('용량 0은 거부',
    format('select quick_inbound(%L, %L, 0, 1000, 1)', pg_temp.store(), v_i), '22000');
  perform pg_temp.raises('수량 0은 거부',
    format('select quick_inbound(%L, %L, 1000, 1000, 0)', pg_temp.store(), v_i), '22000');
  perform pg_temp.raises('미래 날짜는 거부',
    format('select quick_inbound(%L, %L, 1000, 1000, 1, null, %L)',
           pg_temp.store(), v_i, v_day + 1), '22000');
  perform pg_temp.raises('남의 매장은 거부',
    format('select quick_inbound(%L, %L, 1000, 1000, 1)',
           '00000000-0000-0000-0000-0000000000ff', v_i), null);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 빠른 입고도 수정 내역을 남긴다 (0066 과 같은 길)
--
-- 사장님이 직접 고친 게 아닌데 원가가 움직인다 — 왜 그런지 보여야 한다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_i   uuid := pg_temp.ing('대파');
  v_day date := business_day();
  ev    jsonb;
begin
  -- ⚠ 닫혀 있으면 **다시 열어야** 한다. 앱에서 영업을 한 번 마치면 그날은 closed 로 남고,
  --   여는 데 실패한다. 그 상태로 두면 이 파일이 통째로 빨개진다(실제로 그랬다).
  begin
    perform open_business_day(pg_temp.store());
  exception when others then
    begin perform reopen_business_day(pg_temp.store(), business_day()); exception when others then null; end;
  end;

  perform quick_inbound(pg_temp.store(), v_i, 1000, 6000, 3, null, v_day, 'T15-B');

  ev := jsonb_path_query_first(
    entity_change_history(pg_temp.store(), 'ingredient', v_i, null, 3)->'items', '$[0]');
  perform pg_temp.eq_t('식재료 내역에 남는다', ev->>'title', '입고 단가 반영');
  perform pg_temp.eq_t('출처는 입고', ev->>'source_type', 'inbound');
  perform pg_temp.ok('연결 메뉴 수도 함께', (ev->>'affected_recipes')::int > 0);

  perform pg_temp.eq_t('연결 레시피에도 같은 묶음으로',
    (jsonb_path_query_first(
      entity_change_history(pg_temp.store(), 'recipe', pg_temp.rcp('제육볶음'), null, 3)->'items',
      '$[0]'))->>'source_type', 'ingredient');
end $t$;
