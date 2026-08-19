-- ════════════════════════════════════════════════════════════════
-- 05 · 로스·원장 회귀 (0038 · 0040)
--
-- 출발점: "폐기를 했는데 왜 기준단가가 내려가지? 올라가야 하는 거 아니야?"
-- 0038 은 이 지적에서 나온 **산수 버그 6건**을 고쳤다. 전부 조용히 틀리는 종류라
-- 화면만 봐서는 알 수 없어서 여기 못 박는다.
--
-- ⚠ 미결(의도적으로 단언하지 않음)
--   "폐기가 기준단가를 올려야 하는가"는 아직 결정되지 않았다. 현재는 실측 로스율이
--   추정치를 **통째로 대체**하므로, 측정값이 추정보다 작으면 단가가 내려간다.
--   실측: 대파 1,940g 폐기 → 실측 0.400% → 4.7059 → 4.0161 (−14.7%).
--   이 방향성은 사장님 결정 대기 중이라 테스트가 어느 편도 들지 않는다.
--   여기서 지키는 건 "어느 쪽으로 정하든 산수는 맞아야 한다" 뿐이다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing    uuid := pg_temp.ing('청양고추');
  v_daepa  uuid := pg_temp.ing('대파');
  v_ev     uuid;
  b_events bigint;
  v_res    jsonb;
  v_purch  numeric;
  v_disc   numeric;
begin
  -- ⑥ 기준단가는 **실입고량 가중평균**이다 (폐기 없는 깨끗한 상태에서) ──
  -- 단순평균이면 3개 들어온 옵션과 100개 들어온 옵션이 같은 무게를 갖는다.
  perform pg_temp.ok('대파는 아직 실측 로스가 없다(추정 15% 적용)',
    real_loss_rate(v_daepa) is null);
  perform pg_temp.eq('기준단가 = 실입고량 가중평균 ÷ (1 − 추정로스)',
    base_unit_price(v_daepa),
    (select sum((o.amount / nullif(o.volume,0)) * o.received_qty) / nullif(sum(o.received_qty),0)
       from order_records o
      where o.ingredient_id = v_daepa and o.status in ('received','partial')
        and coalesce(o.received_qty,0) > 0)
    / (1 - (select loss_rate from ingredients where id = v_daepa) / 100),
    0.0001);

  -- ① 버릴 게 없으면 이벤트를 만들지 않는다 ────────────────────
  -- 남은 양 = 현재 재고 → 버린 게 0. 0짜리 폐기가 쌓이면 로스율 분자가 오염된다.
  select count(*) into b_events from inventory_events where ingredient_id = v_ing;
  v_res := e2_discard(v_ing, stock_total_base(v_ing));
  perform pg_temp.ok('폐기량 0 이면 skipped', (v_res->>'skipped')::boolean is true);
  perform pg_temp.eq('폐기량 0 이면 이벤트 안 생김',
    (select count(*) from inventory_events where ingredient_id = v_ing), b_events, 0);

  -- ② 실측 로스율 = 살아있는 폐기 합 ÷ **실입고량** × 100 ──────
  -- 분모에 발주량(qty)을 쓰면 아직 도착 안 한 물량까지 매입으로 잡혀 로스가 과소 산출된다.
  perform e2_discard(v_daepa, stock_total_base(v_daepa) - 100);
  select coalesce(sum(volume * received_qty), 0) into v_purch
    from order_records where ingredient_id = v_daepa and status in ('received','partial');
  select coalesce(sum(volume_delta), 0) into v_disc
    from inventory_events where ingredient_id = v_daepa and type = 'discard';
  perform pg_temp.eq('실측 로스율 = 폐기합 ÷ 실입고량 × 100',
    real_loss_rate(v_daepa), v_disc / v_purch * 100, 0.0001);

  -- ③ 한 폐기는 한 번만 되돌릴 수 있다 ────────────────────────
  -- ⚠ 행 잠금으로는 못 막는다 — inventory_events 에는 원장 보존을 위해 UPDATE 정책이
  --   없고, RLS 아래 FOR UPDATE 는 UPDATE 정책 검사에 걸려 0행을 돌려준다.
  --   유니크 인덱스(reverses_event_id)가 유일한 방어다.
  select id into v_ev from inventory_events
   where ingredient_id = v_daepa and type = 'discard' order by seq desc limit 1;
  perform e2_discard_reverted(v_ev, '테스트');

  -- 두 번째 되돌림은 예외가 아니라 **멱등한 무시**다. 사장님이 버튼을 두 번 눌러
  -- 빨간 오류를 보는 것보다, 조용히 아무 일도 안 일어나는 편이 옳다.
  declare
    s_stock  numeric := stock_total_base(v_daepa);
    s_events bigint  := (select count(*) from inventory_events where ingredient_id = v_daepa);
    v_again  jsonb;
  begin
    v_again := e2_discard_reverted(v_ev, '두번째');
    perform pg_temp.ok('두 번째 되돌림은 already_reverted',
      (v_again->>'already_reverted')::boolean is true);
    perform pg_temp.eq('두 번째 되돌림에 재고 불변', stock_total_base(v_daepa), s_stock, 0);
    perform pg_temp.eq('두 번째 되돌림에 이벤트 불변',
      (select count(*) from inventory_events where ingredient_id = v_daepa), s_events, 0);
  end;

  -- 동시 요청은 함수의 exists 검사를 둘 다 통과할 수 있다. 그때는 유니크 인덱스가 막는다.
  perform pg_temp.ok('되돌림 유니크 인덱스가 있다',
    exists (select 1 from pg_indexes
             where tablename = 'inventory_events' and indexname = 'inventory_events_reverses_uk'));

  -- ④ 되돌린 폐기는 로스율에서 빠진다 ─────────────────────────
  -- 취소했는데 로스율이 남으면 원가가 영영 틀어진 채로 굳는다.
  perform pg_temp.ok('되돌린 뒤 실측 로스율이 null 로 복귀', real_loss_rate(v_daepa) is null);
  perform pg_temp.ok('stock_history 가 되돌림을 표시한다',
    (select reverted from stock_history(v_daepa) where id = v_ev) is true);
  perform pg_temp.eq('되돌린 뒤 기준단가도 원복', base_unit_price(v_daepa), 4.7059, 0.0001);

  -- ⑤ 로스율은 null 이거나 0~100 사이 ────────────────────────
  -- 산 것보다 많이 버릴 수는 없다. 100% 이상이면 base_unit_price 가 null 이 되고
  -- 그 null 이 원가 0원으로 조용히 삼켜진다 — 측정을 포기하는 편이 안전하다.
  perform pg_temp.ok('전 식재료의 실측 로스율이 null 또는 0~100',
    not exists (select 1 from ingredients i
                 where i.store_id = pg_temp.store()
                   and real_loss_rate(i.id) is not null
                   and real_loss_rate(i.id) not between 0 and 100));

  -- ⑦ 폐기 이벤트도 기준단위로 기록된다 (0040) ────────────────
  perform pg_temp.eq('폐기 이벤트 중 단위 미통일',
    (select count(*) from inventory_events ev join ingredients i on i.id = ev.ingredient_id
      where i.store_id = pg_temp.store() and ev.type = 'discard' and not ev.unit_normalized), 0, 0);
end $t$;
