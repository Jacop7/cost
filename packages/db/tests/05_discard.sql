-- ════════════════════════════════════════════════════════════════
-- 05 · 폐기 — 실제로 버린 것만 센다 (0041)
--
-- 출발점: "폐기를 했는데 왜 기준단가가 내려가지? 올라가야 하는 거 아니야?"
-- 답: 추정 로스율이 실측에 밀려 내려앉는 구조였다. 그래서 로스율을 없앴다.
-- 이제 단가는 산 값 그대로이고, 손실은 **버릴 때만** 기록된다.
--
-- 폐기 경로는 둘이다.
--   ① 식재료 폐기(E2)      — 쉬어서 버림.        sales_item_id 없음
--   ② 조리 폐기(qty_waste) — 만들어 놓고 못 팖.  sales_item_id 있음, waste = true
-- 손익에서 ①은 원장에서, ②는 daily_sales_items 에서 집계한다 — 겹치면 이중 계산이다.
--
-- 1차 범위 밖(사장님 결정): **손질 손실**은 잡지 않는다. 대파 1kg 을 다듬어 850g 을
-- 쓰더라도 150g 은 어디에도 기록되지 않고, 장부 재고가 물리 재고보다 많아진다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_daepa uuid := pg_temp.ing('대파');
  v_ing   uuid := pg_temp.ing('청양고추');
  v_rcp   uuid := pg_temp.rcp('제육볶음');
  v_day   date := business_day();
  v_ev    uuid;
  v_res   jsonb;
  b_events bigint;
  b_stock  numeric;
  b_price  numeric;
  v_item   uuid;
  v_need   numeric;
begin
  -- ── 기준단가는 실입고량 가중평균, 그 이상 아무것도 아니다 ────
  -- 단순평균이면 3개 들어온 옵션과 100개 들어온 옵션이 같은 무게를 갖는다.
  perform pg_temp.eq('기준단가 = 실입고량 가중평균',
    base_unit_price(v_daepa),
    (select sum((o.amount / nullif(o.volume,0)) * o.received_qty) / nullif(sum(o.received_qty),0)
       from order_records o
      where o.ingredient_id = v_daepa and o.status in ('received','partial')
        and coalesce(o.received_qty,0) > 0), 0.0001);

  -- ── ① 폐기해도 기준단가는 움직이지 않는다 ───────────────────
  -- 0041 이전에는 폐기가 실측 로스율을 만들어 단가를 끌어내렸다(4.7059 → 4.0161).
  -- 인과가 거꾸로였다. 이제 폐기는 재고와 손실에만 영향을 준다.
  b_price := base_unit_price(v_daepa);
  b_stock := stock_total_base(v_daepa);
  -- ⚠ 두 번째 인자는 **남은 양**이다(버린 양이 아니다). 100g 만 남기고 버린다.
  perform e2_discard(v_daepa, 100);
  perform pg_temp.eq('폐기 후에도 기준단가 불변', base_unit_price(v_daepa), b_price, 0.0001);
  perform pg_temp.eq('남긴 만큼만 재고가 남았다', stock_total_base(v_daepa), 100, 0.0001);

  -- ── 버릴 게 없으면 이벤트를 만들지 않는다 ───────────────────
  -- 0짜리 폐기가 쌓이면 원장이 의미 없는 줄로 늘어난다.
  select count(*) into b_events from inventory_events where ingredient_id = v_ing;
  v_res := e2_discard(v_ing, stock_total_base(v_ing));
  perform pg_temp.ok('폐기량 0 이면 skipped', (v_res->>'skipped')::boolean is true);
  perform pg_temp.eq('폐기량 0 이면 이벤트 안 생김',
    (select count(*) from inventory_events where ingredient_id = v_ing), b_events, 0);

  -- ── 폐기 되돌리기는 **없다** (0085) ────────────────────────
  -- 사장님 결정: 잘못 찍은 폐기는 재고 수정(E5)으로 맞춘다.
  -- 앱에서 지웠는데 RPC 가 남아 있으면 로그인한 클라이언트가 그대로 부를 수 있다 —
  -- 화면에 없는 기능이 API 로 열려 있는 것도 노출이다.
  --
  -- ⚠ 입고 취소(E11)는 남아 있다. 그건 **기준단가를 되돌려야** 하기 때문이다.
  --   폐기는 단가를 건드리지 않으므로(0041) 재고 수정으로 충분하다.
  perform pg_temp.ok('폐기 되돌리기 RPC 가 없다',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'e2_discard_reverted'));

  -- 상쇄 이벤트 자체는 원장 규칙으로 남는다 — 입고 취소가 쓴다.
  perform pg_temp.ok('되돌림 유니크 인덱스는 그대로',
    exists (select 1 from pg_indexes
             where tablename = 'inventory_events' and indexname = 'inventory_events_reverses_uk'));

  -- ── 잘못 찍은 폐기는 재고 수정으로 맞춘다 ───────────────────
  -- 되돌리기를 없앤 자리를 이게 대신한다. 재고는 돌아오지만 **폐기 기록은 남는다** —
  -- 그게 되돌리기와 다른 점이고, 그래서 로스율에는 계속 잡힌다.
  perform e5_stock_adjusted(v_daepa, b_stock, false, '폐기 오입력 정정');
  perform pg_temp.eq('재고 수정으로 수량은 되돌아온다',
    stock_total_base(v_daepa), b_stock, 0.0001);
  perform pg_temp.eq('그래도 기준단가는 그대로', base_unit_price(v_daepa), b_price, 0.0001);
  perform pg_temp.ok('폐기 기록은 지워지지 않는다',
    exists (select 1 from inventory_events
             where ingredient_id = v_daepa and type = 'discard' and not waste));

  -- ── ② 조리 폐기는 판매분과 갈라져 기록된다 (0041) ───────────
  -- 이전에는 "제육볶음 18개 소진 (폐기 2개 포함)" 한 줄로 뭉쳐 있어서
  -- 재고 내역에서 왜 나갔는지 구분할 수 없었다.
  select sum(amount) into v_need
    from recipe_ingredient_needs(v_rcp, 1) where ingredient_id = v_daepa;

  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 1, 0, 0, 0);
  select it.id into v_item from daily_sales_items it
    join daily_sales d on d.id = it.daily_sales_id
   where d.store_id = pg_temp.store() and d.sale_date = v_day and it.recipe_id = v_rcp;
  perform e9_sales_reverted(v_item);
  b_stock := stock_total_base(v_daepa);

  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 20, 0, 0, 3);

  perform pg_temp.eq('판매분은 consume 으로 20인분',
    (select -sum(count_delta) from inventory_events
      where sales_item_id = v_item and ingredient_id = v_daepa and not waste), v_need * 20, 0.0001);
  perform pg_temp.eq('조리 폐기는 discard 로 3인분',
    (select -sum(count_delta) from inventory_events
      where sales_item_id = v_item and ingredient_id = v_daepa and waste), v_need * 3, 0.0001);
  perform pg_temp.ok('조리 폐기 이벤트 종류가 discard',
    (select bool_and(type = 'discard') from inventory_events
      where sales_item_id = v_item and ingredient_id = v_daepa and waste and count_delta < 0));
  perform pg_temp.eq('둘을 합치면 23인분', b_stock - stock_total_base(v_daepa), v_need * 23, 0.0001);

  -- ── 손익에서 ①과 ②가 겹치지 않는다 ─────────────────────────
  -- 조리 폐기는 daily_sales_items 에서 금액으로 잡히므로, 원장에서 또 더하면 두 번 센다.
  declare
    j        jsonb := sales_summary(pg_temp.store(), v_day, v_day);
    v_direct numeric;
  begin
    -- ⚠ "0 이어야 한다"고 쓰면 안 된다. 사장님이 오늘 다른 재료를 폐기했으면
    --   그것도 정당하게 잡히기 때문이다(실제로 그래서 한 번 깨졌다).
    --   계약은 "**직접 폐기만** 들어간다" 이므로 원장에서 같은 규칙으로 세어 맞춘다.
    select coalesce(sum(ev.volume_delta * coalesce(base_unit_price(ev.ingredient_id), 0)), 0)
      into v_direct
      from inventory_events ev
     where ev.store_id = pg_temp.store()
       and ev.type = 'discard'
       and ev.sales_item_id is null          -- 조리 후 폐기 제외
       and not exists (select 1 from inventory_events r where r.reverses_event_id = ev.id)
       and (ev.occurred_at at time zone business_tz())::date = v_day;

    perform pg_temp.eq('식재료 폐기 = 직접 폐기만 (조리 폐기 안 섞임)',
      (j->>'waste_ingredient')::numeric, v_direct, 0.01);
    perform pg_temp.ok('조리 폐기는 waste_menu 로 잡힌다', (j->>'waste_menu')::numeric > 0);
    perform pg_temp.eq('폐기 손실 합계 = 식재료 + 조리',
      (j->>'waste_loss')::numeric,
      (j->>'waste_ingredient')::numeric + (j->>'waste_menu')::numeric, 0.01);
  end;

  -- ── 로스율은 완전히 사라졌다 ────────────────────────────────
  perform pg_temp.eq('real_loss_rate 함수 없음',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'real_loss_rate'), 0, 0);
  perform pg_temp.eq('loss_rate 컬럼 없음',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and column_name like '%loss%'), 0, 0);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 0042 · 로스율은 **표시 전용**으로 남는다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_daepa uuid := pg_temp.ing('대파');
  v_rcp   uuid := pg_temp.rcp('제육볶음');
  v_day   date := business_day();
  v_item  uuid;
  v_loss  jsonb;
  b_price numeric;
  b_stock numeric;
  b_loss  numeric;   -- 앞 블록의 폐기가 이미 쌓여 있다 — **상대로** 잰다
  v_ev    uuid;
begin
  -- ── 폐기가 없으면 rate 는 null — 0% 로 단정하지 않는다 ──────
  -- "안 버렸다"와 "아직 모른다"는 다르다. 0% 로 쓰면 사장님이 전자로 읽는다.
  -- 시드가 바뀌어도 견디도록 폐기가 0건인 재료를 찾아서 쓴다.
  declare v_clean uuid;
  begin
    select i.id into v_clean from ingredients i
     where i.store_id = pg_temp.store()
       and not exists (select 1 from inventory_events ev
                        where ev.ingredient_id = i.id and ev.type = 'discard')
     limit 1;
    perform pg_temp.ok('폐기가 0건인 재료가 시드에 있다', v_clean is not null);
    perform pg_temp.ok('폐기 기록이 없으면 rate null',
      (ingredient_loss(v_clean)->>'rate') is null);
  end;

  -- ── 보관 폐기와 조리 폐기를 갈라서 준다 ─────────────────────
  -- ⚠ 앞 블록의 폐기는 이제 되돌려지지 않는다(0085). 절대값으로 재면 그게 섞인다.
  b_price := base_unit_price(v_daepa);
  b_stock := stock_total_base(v_daepa);
  b_loss  := coalesce((ingredient_loss(v_daepa)->>'storage_amount')::numeric, 0);
  perform e2_discard(v_daepa, b_stock - 200);          -- 보관 폐기 200
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 0, 0, 0, 4);  -- 조리 폐기 4인분

  v_loss := ingredient_loss(v_daepa);
  perform pg_temp.eq('보관 폐기량 200 이 더해졌다',
    (v_loss->>'storage_amount')::numeric - b_loss, 200, 0.0001);
  perform pg_temp.ok('조리 폐기량이 잡힌다', (v_loss->>'cooking_amount')::numeric > 0);
  perform pg_temp.eq('합계 = 보관 + 조리',
    (v_loss->>'total_amount')::numeric,
    (v_loss->>'storage_amount')::numeric + (v_loss->>'cooking_amount')::numeric, 0.0001);
  perform pg_temp.eq('로스율 = 폐기합 ÷ 실입고량 × 100',
    (v_loss->>'rate')::numeric,
    (v_loss->>'total_amount')::numeric / (v_loss->>'purchased')::numeric * 100, 0.0001);
  perform pg_temp.eq('버린 금액 = 폐기량 × 기준단가',
    (v_loss->>'total_cost')::numeric,
    (v_loss->>'total_amount')::numeric * b_price, 0.01);

  -- ── ⚠ 로스율은 기준단가에 곱해지지 않는다 ───────────────────
  -- 이 단언이 0041 의 핵심이다. 다시 물리면 폐기할수록 단가가 내려간다.
  perform pg_temp.eq('폐기가 쌓여도 기준단가 불변', base_unit_price(v_daepa), b_price, 0.0001);

  -- 되돌리기가 없으니 '되돌린 뒤 로스율' 도, '조리 폐기 되돌리기 거부' 도 검증할 게 없다.
  -- 폐기는 한 번 찍으면 로스율에 남는다 — 재고 수정은 수량만 맞춘다.
  perform pg_temp.ok('폐기는 로스율에 그대로 남는다',
    (ingredient_loss(v_daepa)->>'storage_amount')::numeric > 0);

  -- ── stock_history 가 두 폐기를 구분해 준다 ──────────────────
  perform pg_temp.ok('stock_history 가 waste 를 실어 준다',
    exists (select 1 from stock_history(v_daepa) where type = 'discard' and waste));

  -- ── ingredient_detail 이 loss 를 함께 준다 (화면 왕복 1회) ──
  perform pg_temp.ok('ingredient_detail 에 loss 가 들어 있다',
    ingredient_detail(v_daepa) ? 'loss');
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 0044 · 폐기 내역·구매 이력 전체 보기
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_daepa uuid := pg_temp.ing('대파');
  v_all   int;
  v_det   int;
begin
  -- ── 구매 이력은 잘리지 않는다 ────────────────────────────────
  -- ingredient_detail 은 화면 요약용이라 20건으로 자른다. 단가가 언제부터
  -- 올랐는지 보려면 전체가 필요하다.
  select count(*) into v_all from purchase_history(v_daepa);
  select jsonb_array_length(ingredient_detail(v_daepa)->'orders') into v_det;
  perform pg_temp.ok('구매 이력 전체 >= 상세 요약', v_all >= v_det);
  perform pg_temp.eq('구매 이력 건수 = order_records 건수',
    v_all, (select count(*) from order_records where ingredient_id = v_daepa), 0);

  -- 이 건의 단가는 **그날 그 값**이다 — 기준단가(가중평균)와 다른 개념이다.
  perform pg_temp.ok('건별 단가 = 금액 ÷ 용량',
    not exists (
      select 1 from purchase_history(v_daepa) p
       where p.volume > 0
         and abs(p.unit_price - p.amount / p.volume) > 0.0001));

  -- ── 폐기 내역이 두 종류로 갈린다 ─────────────────────────────
  -- 화면 탭(전체 / 조리 전 / 조리 후)이 이 구분 위에 선다.
  perform pg_temp.ok('stock_history 로 조리 전/후를 가를 수 있다',
    (select count(*) from stock_history(v_daepa) where type = 'discard') =
    (select count(*) from stock_history(v_daepa) where type = 'discard' and waste)
    + (select count(*) from stock_history(v_daepa) where type = 'discard' and not waste));
end $t$;
