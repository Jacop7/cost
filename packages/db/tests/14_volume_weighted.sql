-- ════════════════════════════════════════════════════════════════
-- 14 · 기준단가는 양으로 가중한다 (0072)
--
-- 사장님: "양이 기본 아니야. 개수랑 이거는 구매 옵션 기록으로 남겨두고"
--
-- 지키는 불변식 하나로 정리된다:
--
--     기준단가 × 총 입고량 = 그 재료에 쓴 돈
--
-- 개당 단가를 **팩 개수**로 평균 내면 이게 깨진다. 1kg 짜리 한 개가 20kg 짜리와
-- 같은 무게를 갖기 때문이다. 그러면 원가가 실제로 쓴 돈보다 커지고,
-- 재료비 합계가 장부에 없는 돈을 만든다.
--
-- 재고도 같은 분모를 써야 성립한다 — **발주의 팩 용량**으로 환산한다.
-- 마스터 per_volume 을 쓰면 5kg 을 사도 3kg 만 늘어난다(실측 2,000g 증발).
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_st  uuid := pg_temp.store();
  v_ven uuid := (select id from vendors where store_id = pg_temp.store() limit 1);
  v_day date := business_day();
  v_i   uuid;
  v_s0  numeric;
  v_s1  numeric;
  v_p   numeric;
  v_vol numeric;
  v_amt numeric;
begin
  -- 이번 검증만을 위한 새 재료 — 기존 발주가 섞이면 무엇을 재는지 흐려진다.
  v_i := save_ingredient(v_st, jsonb_build_object(
    'name', '검증용 재료', 'base_unit', 'g', 'per_volume', 1000,
    'safety_stock', 0, 'min_order_qty', 1));

  -- ── 크기가 다른 두 건 ───────────────────────────────────────
  -- 소포장 1kg 5,300원 1개 + 대용량 20kg 80,000원 1개
  v_s0 := stock_total_base(v_i);
  perform e1_confirm_inbound(
    e7_place_order(v_st, v_i, v_ven, null, 1000, 5300, 1, v_day), 1, 'T14-A');
  perform e1_confirm_inbound(
    e7_place_order(v_st, v_i, v_ven, null, 20000, 80000, 1, v_day), 1, 'T14-B');

  v_s1 := stock_total_base(v_i);
  v_p  := base_unit_price(v_i);

  select sum(o.volume * o.received_qty), sum(o.amount * o.received_qty)
    into v_vol, v_amt
    from order_records o
   where o.ingredient_id = v_i and o.status in ('received','partial');

  -- ── 재고: 발주의 팩 용량으로 들어온다 ───────────────────────
  -- ⚠ 마스터 per_volume 은 1,000g 이다. 그걸 쓰면 2,000g 만 늘어난다.
  perform pg_temp.eq('재고는 실제 산 용량만큼 는다', v_s1 - v_s0, 21000, 0.001);
  perform pg_temp.eq('입고 총량도 같다', v_vol, 21000, 0.001);
  perform pg_temp.eq('쓴 돈', v_amt, 85300, 0.001);

  -- ── 단가: 양 가중 ───────────────────────────────────────────
  perform pg_temp.eq('기준단가 = 쓴 돈 ÷ 들어온 양', v_p, 85300.0 / 21000, 0.0001);
  -- 개수 가중이면 (5.30 + 4.00) / 2 = 4.65 가 된다. 그 값이면 안 된다.
  perform pg_temp.ok('개수 가중이 아니다', abs(v_p - 4.65) > 0.01);

  -- ⚠ 이게 이 설계의 전부다.
  perform pg_temp.eq('단가 × 총입고량 = 쓴 돈', v_p * v_vol, v_amt, 0.01);

  -- ── 개수는 사라지지 않는다 — 기록으로 남는다 ────────────────
  perform pg_temp.eq('팩 개수가 그대로 남아 있다',
    (select sum(received_qty) from order_records
      where ingredient_id = v_i and status in ('received','partial')), 2, 0);
  perform pg_temp.eq('팩 용량도 두 가지가 그대로',
    (select count(distinct volume) from order_records
      where ingredient_id = v_i and status in ('received','partial')), 2, 0);

  -- ── 입고를 취소하면 정확히 되돌아간다 ───────────────────────
  declare v_ord uuid;
  begin
    select id into v_ord from order_records
     where ingredient_id = v_i and volume = 20000 limit 1;
    perform e11_inbound_reverted(v_ord, '검증');
    perform pg_temp.eq('취소하면 그 용량만큼 빠진다',
      stock_total_base(v_i) - v_s0, 1000, 0.001);
    perform pg_temp.eq('단가도 남은 건 기준으로 되돌아간다',
      base_unit_price(v_i), 5.30, 0.0001);
  end;
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 한 가지 용량만 쓰던 기존 데이터는 값이 안 바뀐다
--
-- 팩 용량이 하나뿐이면 개수 가중과 양 가중이 같은 값을 낸다.
-- 그래서 지금 검산값이 그대로다 — 바꿔도 안전한 이유다.
-- ════════════════════════════════════════════════════════════════

do $t$
begin
  perform pg_temp.eq('대파 기준단가', base_unit_price(pg_temp.ing('대파')), 4.0, 0.0001);
  perform pg_temp.eq('제육볶음 재료비',
    (select material_cost from recipe_list(pg_temp.store()) where id = pg_temp.rcp('제육볶음')),
    2806.40, 0.01);
  perform pg_temp.eq('제육볶음 순이익',
    (select profit from recipe_list(pg_temp.store()) where id = pg_temp.rcp('제육볶음')),
    4046.69, 0.01);

  -- 전 재료에서 두 공식이 같은 값이어야 한다(용량이 한 가지뿐이므로).
  perform pg_temp.ok('기존 재료는 두 공식이 같다',
    not exists (
      select 1
        from ingredients i
        join order_records o on o.ingredient_id = i.id and o.status in ('received','partial')
       where i.store_id = pg_temp.store()
       group by i.id
      having count(distinct o.volume) = 1
         and abs(base_unit_price(i.id)
                 - sum(o.amount * o.received_qty) / nullif(sum(o.volume * o.received_qty), 0)) > 0.0001));
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 안전재고도 기준단위다 (0073)
--
-- 재고는 0056 에서 기준단위 총량으로 통일했는데 **안전재고만 개수**로 남아
-- 비교할 때마다 `safety_stock × per_volume` 로 환산했다. 0072 이후 per_volume 은
-- **기본값**일 뿐이라 그 환산이 설 자리가 없다.
--
-- 실측된 피해 — 사장님이 "우리는 5kg 짜리 산다"며 팩 용량만 고쳤더니
-- 안전재고 기준이 3,000g → 5,000g 으로 소리 없이 바뀌었다. 안전재고는 건드리지도 않았다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_i    uuid := pg_temp.ing('고추장');
  v_safe numeric;
  v_cat  uuid;
  v_ven  uuid;
begin
  select safety_stock, category_id, default_vendor_id into v_safe, v_cat, v_ven
    from ingredients where id = v_i;

  perform pg_temp.eq('안전재고가 기준단위로 옮겨졌다', v_safe, 3000, 0.001);

  -- ── 팩 용량만 고친다 ────────────────────────────────────────
  perform save_ingredient(pg_temp.store(), jsonb_build_object(
    'id', v_i, 'name', '고추장', 'base_unit', 'g', 'per_volume', 5000,
    'safety_stock', v_safe, 'min_order_qty', 1,
    'category_id', v_cat, 'default_vendor_id', v_ven));

  perform pg_temp.eq('팩 용량을 고쳐도 안전재고는 안 움직인다',
    (select safety_stock from ingredients where id = v_i), v_safe, 0.001);

  -- ── 발주 후보 판정도 기준단위끼리 비교한다 ──────────────────
  -- 재고를 안전재고 아래로 떨어뜨리면 후보로 떠야 한다.
  perform e5_stock_adjusted(v_i, v_safe - 1, false, '검증');
  perform refresh_order_candidate(v_i);
  perform pg_temp.ok('안전재고 미달이면 후보로 뜬다',
    exists (select 1 from order_candidates c
             where c.ingredient_id = v_i
               and exists (select 1 from unnest(c.reasons) r where r::text = 'safety_stock')));

  -- 다시 채우면 사라진다.
  perform e5_stock_adjusted(v_i, v_safe + 1, false, '검증');
  perform refresh_order_candidate(v_i);
  perform pg_temp.ok('채우면 후보에서 빠진다',
    not exists (select 1 from order_candidates c
                 where c.ingredient_id = v_i
                   and exists (select 1 from unnest(c.reasons) r where r::text = 'safety_stock')));

  -- ⚠ 최소 발주량은 개수 그대로다. 발주는 팩 단위로 한다.
  perform pg_temp.eq('최소 발주량은 개수 그대로',
    (select min_order_qty from ingredients where id = v_i), 1, 0);
end $t$;
