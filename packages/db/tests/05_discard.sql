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

-- ⚠ 오늘 영업일이 열려 있어야 판매를 적을 수 있다.
--   날이 바뀌면 아무도 안 연 채 테스트가 돈다 — 실제로 08-23 아침에 이 파일이 빨개졌다.
--   07·12 와 같은 수로 여기서 연다. 트랜잭션 안이라 곧 되돌려진다.
-- ⚠ 여기를 `exception when others then null` 로 감싸지 않는다. 그러면 헬퍼가 확인한
--   사후조건("오늘 영업일이 정확히 하나, 상태는 open|break")까지 통째로 삼킨다 —
--   못 열어도 조용히 지나가고 저 아래 판매가 `아직 영업을 시작하지 않았어요` 로 죽는다.
--   여는 실패는 여기서 크게 터져야 어디가 잘못됐는지 보인다.
do $open$ begin
  perform pg_temp.open_today();   -- 닫혀 있어도 열어 준다(프렐류드 헬퍼)
end $open$;

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

  -- ── 폐기 삭제는 최근 7일치만 (0086) ────────────────────────
  -- 사장님 결정: 오입력은 며칠 안에 알아챈다. 지난달 폐기를 오늘 지우면
  -- 이미 확정된 월 손익·로스율이 소급해서 흔들린다.
  --
  -- ⚠ 화면이 ⋮ 를 감추는 건 안내일 뿐이다. 경계는 **서버**가 지킨다.
  select id into v_ev from inventory_events
   where ingredient_id = v_daepa and type = 'discard' order by seq desc limit 1;

  perform pg_temp.eq_t('기간 제한은 한 곳에서 정한다', discard_delete_days()::text, '7');

  perform e2_discard_reverted(v_ev, '테스트');
  perform pg_temp.eq('지우면 재고가 돌아온다', stock_total_base(v_daepa), b_stock, 0.0001);
  perform pg_temp.eq('그래도 기준단가는 그대로', base_unit_price(v_daepa), b_price, 0.0001);
  perform pg_temp.ok('원장은 지우지 않는다 — 상쇄 이벤트를 쌓는다',
    exists (select 1 from inventory_events where reverses_event_id = v_ev));
  perform pg_temp.ok('stock_history 가 지운 걸 표시한다',
    (select reverted from stock_history(v_daepa) where id = v_ev) is true);
  perform pg_temp.eq('지운 폐기는 로스율에서 빠진다',
    (ingredient_loss(v_daepa)->>'storage_amount')::numeric, 0, 0.0001);

  -- 두 번 눌러도 한 번만 상쇄된다. 동시 요청은 유니크 인덱스가 막는다.
  declare
    s_stock  numeric := stock_total_base(v_daepa);
    s_events bigint  := (select count(*) from inventory_events where ingredient_id = v_daepa);
    v_again  jsonb;
  begin
    v_again := e2_discard_reverted(v_ev, '두번째');
    perform pg_temp.ok('두 번째는 already_reverted',
      (v_again->>'already_reverted')::boolean is true);
    perform pg_temp.eq('두 번째에 재고 불변', stock_total_base(v_daepa), s_stock, 0);
    perform pg_temp.eq('두 번째에 이벤트 불변',
      (select count(*) from inventory_events where ingredient_id = v_daepa), s_events, 0);
  end;
  perform pg_temp.ok('상쇄 유니크 인덱스가 있다',
    exists (select 1 from pg_indexes
             where tablename = 'inventory_events' and indexname = 'inventory_events_reverses_uk'));

  -- ── 7일이 지나면 거절한다 ──────────────────────────────────
  declare v_old uuid;
  begin
    insert into inventory_events
      (store_id, ingredient_id, type, count_delta, volume_delta, occurred_at, note, unit_normalized)
    values
      -- ⚠ 폐기의 volume_delta 는 **버린 양(양수)** 이다. count_delta 만 음수다.
      --   (inventory_events_discard_positive_ck 가 지킨다.)
      (pg_temp.store(), v_daepa, 'discard', -50, 50,
       (business_day() - discard_delete_days())::timestamptz, '오래된 폐기', true)
    returning id into v_old;

    perform pg_temp.raises('7일 지난 폐기는 못 지운다',
      format('select e2_discard_reverted(%L, %L)', v_old, '테스트'), '22000');
  end;

  -- ── ② 조리 폐기는 판매분과 갈라져 기록된다 (0041) ───────────
  -- 이전에는 "제육볶음 18개 소진 (폐기 2개 포함)" 한 줄로 뭉쳐 있어서
  -- 재고 내역에서 왜 나갔는지 구분할 수 없었다.
  select sum(amount) into v_need
    from recipe_ingredient_needs(v_rcp, 1) where ingredient_id = v_daepa;

  perform pg_temp.e10(pg_temp.store(), v_day, v_rcp, 1, 0, 0, 0);
  select it.id into v_item from daily_sales_items it
    join daily_sales d on d.id = it.daily_sales_id
   where d.store_id = pg_temp.store() and d.sale_date = v_day and it.recipe_id = v_rcp;
  perform e9_sales_reverted(v_item);
  b_stock := stock_total_base(v_daepa);

  perform pg_temp.e10(pg_temp.store(), v_day, v_rcp, 20, 0, 0, 3);

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
  perform pg_temp.e10(pg_temp.store(), v_day, v_rcp, 0, 0, 0, 4);  -- 조리 폐기 4인분

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

  -- ── 조리 폐기는 여기서 못 지운다 ───────────────────────────
  -- 주인은 그 날 매출이다. 여기서 지우면 매출은 "버렸다"인데 재고는 반영 안 된 채 굳는다.
  select ev.id into v_ev from inventory_events ev
   where ev.ingredient_id = v_daepa and ev.type = 'discard' and ev.waste
   order by ev.seq desc limit 1;
  perform pg_temp.raises('조리 폐기 삭제는 거부',
    format('select e2_discard_reverted(%L, %L)', v_ev, '테스트'), '22000');

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


-- ════════════════════════════════════════════════════════════════
-- 폐기 원장은 **실제로 빠진 양**을 적는다 (0113)
--
-- 동시성 감사에서 나왔다. 예전엔 이랬다 —
--     v_before  := stock_total_base(...);       ← 잠금 없이 읽고
--     perform consume_stock(..., v_discard);    ← 반환값을 버리고
--     insert ... count_delta = -v_discard       ← **빼려던 양**을 적었다
--
-- 실측(결정적 재현): 출발 3,000g, `남은 양 1,000` 으로 2,000g 을 뺄 셈이었는데
-- 그 사이 다른 세션이 재고를 50g 으로 떨어뜨렸다. 실제로는 50g 만 빠졌는데
-- 원장에는 2,000g 이 적혔다 — 최종 잔액 0 vs 원장 합 −1,950 (1,950g 어긋남).
--
-- 이제 잠그고 나서 계산하고, 원장에는 consume_stock 이 실제로 뺀 양을 적는다.
-- 여기서는 **불변식**을 못 박는다 — 경합 없이도 성립해야 하는 관계다.
-- ════════════════════════════════════════════════════════════════
do $t$
declare
  v_i    uuid := pg_temp.ing('청양고추');
  v_day  date := business_day();
  v_st0  numeric; v_led0 numeric;
  v_st1  numeric; v_led1 numeric;
  v_res  jsonb;
begin
  perform e5_stock_adjusted(v_i, 1000, false, 'T05 기준 맞추기');
  v_st0 := stock_total_base(v_i);
  select coalesce(sum(count_delta), 0) into v_led0 from inventory_events where ingredient_id = v_i;

  -- 400g 을 남긴다 → 600g 폐기
  v_res := e2_discard(v_i, 400, v_day);
  v_st1 := stock_total_base(v_i);
  select coalesce(sum(count_delta), 0) into v_led1 from inventory_events where ingredient_id = v_i;

  perform pg_temp.eq('폐기 후 재고', v_st1, 400, 0.001);
  perform pg_temp.eq('반환한 폐기량', (v_res->>'discarded')::numeric, 600, 0.001);
  -- ⚠ 이 한 줄이 0113 의 핵심이다. 원장에 적힌 양과 실제로 줄어든 양이 같아야 한다.
  perform pg_temp.eq('원장에 적힌 양 = 실제로 줄어든 양', v_led0 - v_led1, v_st0 - v_st1, 0.001);

  -- 같은 `남은 양` 으로 다시 부르면 더 뺄 게 없다 — 멱등하다.
  v_res := e2_discard(v_i, 400, v_day);
  perform pg_temp.ok('같은 남은 양으로 다시 부르면 건너뛴다', (v_res->>'skipped')::boolean);
  perform pg_temp.eq('재고가 두 번 빠지지 않는다', stock_total_base(v_i), 400, 0.001);
  perform pg_temp.eq('0g 짜리 폐기 행을 만들지 않는다',
    (select coalesce(sum(count_delta), 0) from inventory_events where ingredient_id = v_i), v_led1, 0.001);

  -- 지금보다 많이 남기라는 건 폐기가 아니다. 재고를 **늘리면 안 된다**.
  v_res := e2_discard(v_i, 900, v_day);
  perform pg_temp.ok('남은 양이 지금보다 크면 건너뛴다', (v_res->>'skipped')::boolean);
  perform pg_temp.eq('폐기가 재고를 늘리지 않는다', stock_total_base(v_i), 400, 0.001);
end $t$;
