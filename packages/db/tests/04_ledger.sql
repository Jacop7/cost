-- ════════════════════════════════════════════════════════════════
-- 04 · 재고 원장 무결성 (0034 단위 통일 · 0035 순번)
--
-- 원장은 "왜 이만큼 남았는지"의 유일한 설명이다. 합계가 재고와 다르면
-- 화면의 재고 내역은 사장님을 속이는 숫자가 된다.
--
-- 0034 이전에는 입고만 **구매단위 개수**로, 소진·폐기는 **기준단위 그램**으로
-- 쌓여 있어서 합계가 애초에 말이 안 됐다. 그 회귀를 여기서 막는다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  r       record;
  v_bad   int := 0;
  v_n     int := 0;
begin
  -- ── 전 식재료: 원장 합계 = 현재 재고 ─────────────────────────
  for r in
    select i.id, i.name, stock_total_base(i.id) as stock,
           coalesce((select sum(ev.count_delta) from inventory_events ev
                      where ev.ingredient_id = i.id), 0) as ledger
      from ingredients i where i.store_id = pg_temp.store()
  loop
    v_n := v_n + 1;
    if abs(r.stock - r.ledger) > 0.0001 then
      v_bad := v_bad + 1;
      raise warning '  원장 불일치: % — 재고 %, 원장 %', r.name, r.stock, r.ledger;
    end if;
  end loop;
  perform pg_temp.ok(format('식재료 %s종 전부 원장 합계 = 재고', v_n), v_bad = 0);

  -- ── 단위가 통일돼 있다 (0034 가 심은 표식) ───────────────────
  perform pg_temp.eq('unit_normalized 가 아닌 이벤트',
    (select count(*) from inventory_events ev
      join ingredients i on i.id = ev.ingredient_id
     where i.store_id = pg_temp.store() and ev.unit_normalized is not true), 0, 0);

  -- ── 순번이 빠짐없이 있다 (0035) ──────────────────────────────
  perform pg_temp.eq('seq 가 없는 이벤트',
    (select count(*) from inventory_events ev
      join ingredients i on i.id = ev.ingredient_id
     where i.store_id = pg_temp.store() and ev.seq is null), 0, 0);

  /*
   * ⚠ 0102 부터 **잔액은 음수가 될 수 있다.** 판매가 재고를 넘으면 부족분이 그대로 남는다.
   *   예전엔 `consume_stock` 이 이벤트를 잘라 0 에서 멈췄고, 그래서 "1,500g 이 필요했다"는
   *   사실이 원장에서 사라졌다(실측 22,425원).
   *
   *   불변식은 "음수가 없다"가 아니라 **"원장 합 = 잔액"** 이다. 그건 아래에서 본다.
   *   음수 자체는 오류가 아니라 현실과 기록의 불일치를 보존한 상태다.
   *   ⚠ 사용자 입력값(입고량·폐기량·판매 수량·단가)은 여전히 음수가 될 수 없다.
   */
  perform pg_temp.eq('원장 합과 잔액이 어긋난 식재료',
    (select count(*) from ingredients i
       join inventory_states st on st.ingredient_id = i.id
       left join (select ingredient_id, sum(count_delta) s from inventory_events group by 1) e
         on e.ingredient_id = i.id
      where i.store_id = pg_temp.store()
        and abs(st.stock_total - coalesce(e.s, 0)) > 0.001), 0, 0);

  /*
   * ── 원장을 순번대로 되짚으면 마지막 값이 잔액과 같다 ─────────
   *
   * ⚠ 예전엔 "중간에 음수 구간이 없다"를 봤다. 0102 부터 **음수 구간은 정상**이다 —
   *   판매가 재고를 넘으면 그 시점부터 잔액이 음수로 남고, 입고가 들어와야 올라온다.
   *   그걸 오류로 보면 "없는 재료로 요리한 기록"과 "아직 안 채운 기록"을 구별 못 한다.
   *
   *   불변식은 **되짚은 끝값 = 지금 잔액** 이다. 그래야 원장이 화면과 어긋나지 않는다.
   */
  perform pg_temp.eq('되짚은 끝값이 잔액과 다른 식재료',
    (select count(*) from (
       select ev.ingredient_id,
              sum(ev.count_delta) as bal
         from inventory_events ev
         join ingredients i on i.id = ev.ingredient_id
        where i.store_id = pg_temp.store()
        group by ev.ingredient_id
     ) s
     join inventory_states st on st.ingredient_id = s.ingredient_id
    where abs(st.stock_total - s.bal) > 0.0001), 0, 0);

  -- ── stock_history 가 화면에 주는 잔고도 같은 값으로 끝난다 ───
  perform pg_temp.eq('대파 stock_history 최종 잔고 = 재고',
    (select balance from stock_history(pg_temp.ing('대파')) limit 1),
    stock_total_base(pg_temp.ing('대파')), 0.0001);
end $t$;
