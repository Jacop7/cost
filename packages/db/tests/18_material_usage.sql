-- ════════════════════════════════════════════════════════════════
-- 재고가 모자란 날에도 되짚기 = 손익 재료비 (0098)
--
-- 이게 0098 의 핵심이다. 예전엔 되짚기가 재고 원장을 세서, 재고가 모자라면
-- `consume_stock` 이 이벤트를 잘라 되짚기가 **적게** 나왔다
-- (실측 08-24: 소고기 1,500g 필요 · 750g 만 차감 · 22,425원 어긋남).
--
-- ⚠ 이 블록은 판매를 하나 더 넣으므로 **반드시 따로** 돈다.
--   위 블록에 끼워 넣으면 그쪽 기준 합계가 흔들려 다른 단언이 깨진다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp  uuid := pg_temp.rcp('제육볶음');
  v_ing  uuid := pg_temp.ing('대파');
  v_day  date;
  v_left numeric;
  m2 jsonb; s2 jsonb;
begin
  -- ⚠ 이 파일 앞 블록이 영업일을 닫아 두므로 **다시 열어야** 판매가 들어간다.
  --   예전엔 여기서 `when others then null` 로 삼켰다 — 그래서 못 열어도 조용히
  --   지나가고, 판매가 `아직 영업을 시작하지 않았어요` 로 죽었다(실제로 그랬다).
  --   프렐류드 헬퍼는 사후조건까지 확인하고 못 지키면 예외를 낸다.
  v_day := pg_temp.open_today();

  -- 대파를 1g 만 남기고 비운다. 조정 이벤트라 원장 합계는 그대로 맞는다.
  perform e5_stock_adjusted(v_ing, 1, false, '테스트: 재고 바닥');
  select stock_total into v_left from inventory_states where ingredient_id = v_ing;
  perform pg_temp.eq('재고를 1g 로 비웠다', coalesce(v_left, -1), 1, 0.0001);

  -- 대파를 쓰는 메뉴를 한 그릇 판다 — 필요량(25g)이 남은 재고(1g)보다 많다.
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 1, 0, 0, 0);

  m2 := sales_material_usage(pg_temp.store(), v_day, v_day);
  s2 := sales_summary(pg_temp.store(), v_day, v_day);

  perform pg_temp.eq('재고가 모자라도 되짚기 = 손익 재료비',
    (m2->>'total')::numeric, (s2->>'material_cost')::numeric, 0.01);
  perform pg_temp.ok('그래도 재료비는 0이 아니다', (s2->>'material_cost')::numeric > 0);
end $t$;


-- ════════════════════════════════════════════════════════════════
-- 판 날이 하루라도 재료비 0 이면 안 된다 (0110)
--
-- 실측: 개업 첫날(2026-07-30) 하루만 메뉴 7종 전부 `unit_material_cost = 0`
--       인데 매출은 600,000원이었다. 그날 손익은 재료비 없이 잡혀 있었다.
--
-- 시드가 `open_business_day()` 를 개업 재고보다 **먼저** 불러서, 단가가 아직
-- null 인 상태로 그날 값이 얼어붙은 것이다. 이튿날부터는 전날 단가가 남아 있어
-- 멀쩡했고 — 그래서 하루짜리 구멍을 오래 못 봤다.
--
-- 날짜를 박아 두지 않는다. **모든 날**에 대해 재는 게 이 시험의 요점이다.
-- ════════════════════════════════════════════════════════════════
do $t$
declare v_bad int; v_days int;
begin
  select count(*) into v_bad
    from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
   where ds.store_id = pg_temp.store()
     and it.recipe_id is not null
     and (it.qty_hall + it.qty_delivery + it.qty_takeout) > 0
     and coalesce(it.unit_material_cost, 0) = 0;
  perform pg_temp.eq('판매가 있는데 재료비가 0 인 줄', v_bad, 0, 0);

  -- 스냅샷 쪽도 같이 본다. 판매 줄만 고치고 스냅샷을 두면 되짚기가 다시 갈린다.
  select count(*) into v_bad
    from business_days bd
    join jsonb_each(bd.snapshot->'recipes') e on true
   where bd.store_id = pg_temp.store() and bd.snapshot is not null
     and coalesce((e.value->>'material_cost')::numeric, 0) = 0
     and exists (select 1 from jsonb_array_elements(coalesce(e.value->'lines','[]'::jsonb)) l
                  where coalesce((l->>'per_serving')::numeric, 0) > 0);
  perform pg_temp.eq('재료가 있는데 재료비가 0 인 스냅샷 메뉴', v_bad, 0, 0);

  select count(distinct sale_date) into v_days
    from daily_sales where store_id = pg_temp.store();
  perform pg_temp.ok(format('%s일치를 전부 확인했다', v_days), v_days > 20);
end $t$;
