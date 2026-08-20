-- ════════════════════════════════════════════════════════════════
-- 16 · 수정 내역 보관 30일 (0076)
--
-- 사장님: "사용자는 최근 7일 확인 → 서버는 30일 보관 → 핵심 장부는 영구 보존"
--
-- 이 정책이 안전한 이유는 하나다:
--   **수정 내역을 통째로 지워도 재고·단가·손익이 하나도 안 움직인다.**
-- 그게 사실인지 여기서 확인한다. 사실이 아니라면 지우면 안 되는 데이터다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing  uuid := pg_temp.ing('대파');
  v_rcp  uuid := pg_temp.rcp('제육볶음');
  v_day  date := business_day();
  -- 지우기 전 계산값
  v_price0 numeric;  v_stock0 numeric;  v_mat0 numeric;  v_profit0 numeric;
  v_ledger0 int;     v_orders0 int;     v_ptrend0 int;   v_ftrend0 int;
  v_snap0  jsonb;
  v_n      int;
begin
  begin perform open_business_day(pg_temp.store()); exception when others then null; end;

  -- 내역이 쌓이도록 몇 가지를 실제로 바꾼다.
  perform quick_inbound(pg_temp.store(), v_ing, 1000, 6000, 2, null, v_day, 'T16-A');
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12500, 'base_servings', 10));
  perform pg_temp.ok('내역이 쌓였다',
    (select count(*) from entity_change_events where store_id = pg_temp.store()) > 0);

  -- ── 지우기 전 값을 모두 잡는다 ──────────────────────────────
  v_price0  := base_unit_price(v_ing);
  v_stock0  := stock_total_base(v_ing);
  select material_cost, profit into v_mat0, v_profit0
    from recipe_list(pg_temp.store()) where id = v_rcp;
  select count(*) into v_ledger0 from inventory_events where store_id = pg_temp.store();
  select count(*) into v_orders0 from order_records where store_id = pg_temp.store();
  select count(*) into v_ptrend0 from price_trends where store_id = pg_temp.store();
  select count(*) into v_ftrend0 from profit_trends where store_id = pg_temp.store();
  v_snap0 := (select snapshot from business_days
               where store_id = pg_temp.store() and business_date = v_day);

  -- ── 수정 내역을 **전부** 나이 들게 한 뒤 청소한다 ───────────
  -- ⚠ 직접 delete 하면 RLS 에 막혀 0건이 지워지고 조용히 성공한다.
  --   실제 청소 경로(purge_entity_changes)를 그대로 쓴다.
  -- ⚠ 이 원장은 SELECT·INSERT 만 열려 있다 — 사용자가 자기 이력을 고치거나
  --   골라 지울 수 없어야 하기 때문이다. 그래서 **나이를 들리는 것도 막힌다.**
  --   시험용으로만 잠깐 권한을 되돌린다(트랜잭션 안이라 롤백된다).
  execute 'reset role';
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '40 days'
   where store_id = pg_temp.store();
  execute 'set local role authenticated';
  v_n := purge_entity_changes(30);
  perform pg_temp.ok('청소가 실제로 지운다', v_n > 0);
  perform pg_temp.eq('내역이 비었다',
    (select count(*) from entity_change_events where store_id = pg_temp.store()), 0, 0);

  -- ── 계산 근거는 하나도 안 움직여야 한다 ─────────────────────
  perform pg_temp.eq('기준단가 그대로',  base_unit_price(v_ing), v_price0, 0.000001);
  perform pg_temp.eq('재고 그대로',      stock_total_base(v_ing), v_stock0, 0.000001);
  perform pg_temp.eq('레시피 재료비 그대로',
    (select material_cost from recipe_list(pg_temp.store()) where id = v_rcp), v_mat0, 0.000001);
  perform pg_temp.eq('레시피 순이익 그대로',
    (select profit from recipe_list(pg_temp.store()) where id = v_rcp), v_profit0, 0.000001);

  perform pg_temp.eq('재고 원장 그대로',
    (select count(*) from inventory_events where store_id = pg_temp.store()), v_ledger0, 0);
  perform pg_temp.eq('구매·입고 이력 그대로',
    (select count(*) from order_records where store_id = pg_temp.store()), v_orders0, 0);
  perform pg_temp.eq('가격 추이 그대로',
    (select count(*) from price_trends where store_id = pg_temp.store()), v_ptrend0, 0);
  perform pg_temp.eq('손익 추이 그대로',
    (select count(*) from profit_trends where store_id = pg_temp.store()), v_ftrend0, 0);
  perform pg_temp.ok('그날 영업 기준(스냅샷)도 그대로',
    (select snapshot from business_days
      where store_id = pg_temp.store() and business_date = v_day) = v_snap0);

  -- 마스터의 갱신 시각도 남는다 — "마지막으로 언제 고쳤나"는 여기로도 안다.
  perform pg_temp.ok('레시피 updated_at 은 남는다',
    (select updated_at from recipes where id = v_rcp) is not null);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 30일이 지난 것만 지운다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing uuid := pg_temp.ing('양파');
  v_day date := business_day();
  v_old uuid;
  v_new int;
  v_n   int;
begin
  begin perform open_business_day(pg_temp.store()); exception when others then null; end;

  perform quick_inbound(pg_temp.store(), v_ing, 1000, 2000, 1, null, v_day, 'T16-B');
  select count(*) into v_new from entity_change_events where store_id = pg_temp.store();
  perform pg_temp.ok('새 내역이 있다', v_new > 0);

  -- 한 건만 40일 전으로 밀어 놓는다.
  select id into v_old from entity_change_events
   where store_id = pg_temp.store() order by occurred_at desc limit 1;
  -- ⚠ 이 원장은 SELECT·INSERT 만 열려 있다 — 사용자가 자기 이력을 고치거나
  --   골라 지울 수 없어야 하기 때문이다. 그래서 **나이를 들리는 것도 막힌다.**
  --   시험용으로만 잠깐 권한을 되돌린다(트랜잭션 안이라 롤백된다).
  execute 'reset role';
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '40 days'
   where id = v_old;
  execute 'set local role authenticated';
  v_n := purge_entity_changes(30);
  perform pg_temp.eq('40일 지난 것만 지워진다', v_n, 1, 0);
  perform pg_temp.eq('나머지는 남는다',
    (select count(*) from entity_change_events where store_id = pg_temp.store()), v_new - 1, 0);

  -- 29일 된 것은 살아 있어야 한다 — 경계에서 하루 일찍 지우면 안 된다.
  execute 'reset role';
  update entity_change_events
     set occurred_at = clock_timestamp() - interval '29 days'
   where id = (select id from entity_change_events
                where store_id = pg_temp.store() order by occurred_at desc limit 1);
  execute 'set local role authenticated';
  perform pg_temp.eq('29일 된 것은 안 지운다', purge_entity_changes(30), 0, 0);

  -- ⚠ 청소가 실패해도 영업 시작이 막히면 안 된다 — 곁일이다.
  perform pg_temp.ok('영업 시작에 청소가 붙어 있다',
    pg_get_functiondef('public.open_business_day(uuid,date)'::regprocedure)
      like '%purge_entity_changes%');
end $t$;
