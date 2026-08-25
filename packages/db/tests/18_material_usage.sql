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
  v_day  date := business_day();
  v_left numeric;
  m2 jsonb; s2 jsonb;
begin
  -- ⚠ 이 파일 앞 블록이 영업일을 닫아 두므로 **다시 열어야** 판매가 들어간다.
  --   여는 데 실패하면 이미 종료된 날이라는 뜻이라 reopen 으로 간다.
  begin
    perform open_business_day(pg_temp.store());
  exception when others then
    begin perform reopen_business_day(pg_temp.store(), v_day); exception when others then null; end;
  end;

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
