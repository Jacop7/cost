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

  -- ── 잔고가 음수로 내려간 적이 없다 (절대원칙 6) ──────────────
  perform pg_temp.eq('재고가 음수인 식재료',
    (select count(*) from ingredients i
      where i.store_id = pg_temp.store() and stock_total_base(i.id) < 0), 0, 0);

  -- ── 원장을 순번대로 되짚어도 음수 구간이 없다 ────────────────
  -- 합계만 맞고 중간에 음수로 빠지면 "없는 재료로 요리한" 기록이다.
  perform pg_temp.eq('시점별 잔고가 음수였던 구간',
    (select count(*) from (
       select sum(ev.count_delta) over (partition by ev.ingredient_id order by ev.seq) as bal
         from inventory_events ev
         join ingredients i on i.id = ev.ingredient_id
        where i.store_id = pg_temp.store()
     ) s where s.bal < -0.0001), 0, 0);

  -- ── stock_history 가 화면에 주는 잔고도 같은 값으로 끝난다 ───
  perform pg_temp.eq('대파 stock_history 최종 잔고 = 재고',
    (select balance from stock_history(pg_temp.ing('대파')) limit 1),
    stock_total_base(pg_temp.ing('대파')), 0.0001);
end $t$;
