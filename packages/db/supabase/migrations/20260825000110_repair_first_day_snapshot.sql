-- ════════════════════════════════════════════════════════════════
-- 0110 · 데모 시드의 개업 첫날(2026-07-30) 재료비 0 **일회성 보정**
--
-- 측정: 2026-07-30 하루만 메뉴 7종 전부 `unit_material_cost = 0` 인데
--       매출은 600,000원이었다. 그날 손익은 재료비 없이 잡혀 있었다.
--
-- 원인은 **시드의 순서**다(seed.sql 에서 고쳤다 — 그게 진짜 고침이다).
--     open_business_day()   ← 여기서 그날 값을 굳히고
--     e7_place_order() …    ← 그다음에 개업 재고를 넣었다
--   기준단가는 `쓴 돈 ÷ 들어온 양`(0072)이고 '쓴 돈'은 발주 기록에서 온다.
--   개업 전에는 발주가 하나도 없으니 모든 단가가 null 이고, 그 상태로 영업을
--   시작하면 재료비 0 이 스냅샷에 **얼어붙는다.** 스냅샷은 하루 동안 고정이라
--   나중에 입고해도 그날은 영영 0 이다.
--   이튿날부터는 전날 단가가 남아 있어 멀쩡했다 — 그래서 하루짜리 구멍이었다.
--
-- ⚠⚠ 이 파일은 **이미 만들어진 데모 장부 한 날짜**만 고친다. 처음 판은
--     "재료비가 전부 0 인 영업일"을 매장·날짜 없이 훑었다. 그건 운영 공통
--     마이그레이션이 **남의 매장 과거 스냅샷을 말없이 다시 쓰는** 짓이다.
--     스냅샷은 잠긴 장부다(0048) — 일괄 손보는 도구를 남겨 두면 안 된다.
--     그래서 셋을 **전부** 만족할 때만 손댄다.
--       ① 매장  = 데모 시드 매장 그 하나
--       ② 날짜  = 2026-07-30 그 하루
--       ③ 손상  = 그날 모든 메뉴의 재료비가 0 이고,
--                 재료 줄에 `per_serving > 0` 인데 `unit_price` 가 null 인 게 있다
--     하나라도 어긋나면 **아무것도 안 한다.** 정상인 날은 물론이고,
--     사람이 실제로 0원짜리로 기록한 날도 건드리지 않는다.
--
-- ⚠ 새로 리셋하면 이 마이그레이션은 아무 일도 안 한다. 마이그레이션이 먼저 돌고
--   seed.sql 이 나중에 돌기 때문에 손댈 데이터가 아직 없다. 순서를 고친 시드가
--   애초에 멀쩡한 장부를 만든다. 이 파일은 **지금 깔려 있는 개발 DB** 전용이다.
--
-- ⚠ 값을 지어내지 않는다. 그날 발주 기록에서 나온 `day_unit_price(store, 그날, 재료)`
--   를 쓴다 — 순서만 바로잡은 시드가 만들어 냈을 바로 그 값이다.
--   검산: 대파 4.00원/g · 돼지고기 앞다리 13.00원/g 로 그날도 지금과 같다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare
  -- 데모 시드 매장. 다른 어떤 매장도 이 파일의 대상이 아니다.
  c_store  constant uuid := '00000000-0000-0000-0000-0000000000b1';
  c_date   constant date := date '2026-07-30';
  bd       record;
  v_snap   jsonb;
  v_rid    text;
  v_entry  jsonb;
  v_lines  jsonb;
  v_mat    numeric;
begin
  select id, store_id, business_date, snapshot
    into bd
    from business_days
   where store_id = c_store
     and business_date = c_date
     and snapshot is not null
     -- ③-a 그날 **모든** 메뉴의 재료비가 0 이다. 하나라도 값이 있으면 정상인 날이다.
     and not exists (
       select 1 from jsonb_each(snapshot->'recipes') e
        where coalesce((e.value->>'material_cost')::numeric, 0) <> 0)
     -- ③-b 재료를 쓰는데 단가를 못 구한 흔적이 있다. 이게 '없는 값'과 '0원'을 가른다.
     and exists (
       select 1 from jsonb_each(snapshot->'recipes') e
        cross join jsonb_array_elements(coalesce(e.value->'lines', '[]'::jsonb)) l
        where coalesce((l->>'per_serving')::numeric, 0) > 0
          and l->>'unit_price' is null);

  if not found then
    raise notice '0110: 손댈 날이 없습니다 (이미 정상이거나 대상 아님) — 아무것도 하지 않았습니다';
    return;
  end if;

  v_snap := bd.snapshot;

  for v_rid, v_entry in select * from jsonb_each(bd.snapshot->'recipes') loop
    -- 줄마다 그날 단가를 다시 매긴다. per_serving 은 그대로 둔다 — 그건 맞았다.
    select coalesce(jsonb_agg(
             l || jsonb_build_object(
               'unit_price',
               day_unit_price(bd.store_id, bd.business_date, (l->>'ingredient_id')::uuid))
             order by ord), '[]'::jsonb)
      into v_lines
      from jsonb_array_elements(coalesce(v_entry->'lines', '[]'::jsonb)) with ordinality t(l, ord);

    select coalesce(sum(
             (l->>'per_serving')::numeric
             * coalesce((l->>'unit_price')::numeric, 0)), 0)
      into v_mat
      from jsonb_array_elements(v_lines) l;

    v_snap := jsonb_set(v_snap, array['recipes', v_rid],
                v_entry || jsonb_build_object('lines', v_lines, 'material_cost', v_mat));
  end loop;

  update business_days set snapshot = v_snap where id = bd.id;

  -- 판매 줄에도 같은 값을 내려 준다. 손익은 이 컬럼을 읽는다.
  update daily_sales_items it
     set unit_material_cost =
           coalesce((v_snap #>> array['recipes', it.recipe_id::text, 'material_cost'])::numeric, 0)
    from daily_sales ds
   where ds.id = it.daily_sales_id
     and ds.store_id = c_store
     and ds.sale_date = c_date
     and it.recipe_id is not null;

  raise notice '0110: % 스냅샷 재료비를 그날 단가로 다시 채웠습니다 (매장 %)', c_date, c_store;
end
$mig$;


-- ── 되읽어서 확인한다 — **보정 대상 행만** ────────────────────
-- ⚠ 전 기간을 훑지 않는다. 이 파일이 건드린 곳만 책임진다. 다른 날의 상태는
--   여기서 판단할 일이 아니고, 그건 테스트 18 이 따로 본다.
do $chk$
declare
  c_store constant uuid := '00000000-0000-0000-0000-0000000000b1';
  c_date  constant date := date '2026-07-30';
  v_bad   int;
begin
  -- 애초에 대상이 아니었으면(다른 환경·새 리셋) 확인할 것도 없다.
  if not exists (select 1 from business_days
                  where store_id = c_store and business_date = c_date) then
    return;
  end if;

  select count(*) into v_bad
    from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
   where ds.store_id = c_store
     and ds.sale_date = c_date
     and it.recipe_id is not null
     and coalesce(it.unit_material_cost, 0) = 0
     and (it.qty_hall + it.qty_delivery + it.qty_takeout) > 0;
  if v_bad > 0 then
    raise exception '0110: %  재료비 0 인 판매 줄이 % 개 남았습니다', c_date, v_bad
      using errcode = '45003';
  end if;

  -- 검산값이 움직이면 안 된다. 대파는 그날도 지금도 4.00원/g 이다.
  if round(day_unit_price(c_store, c_date,
       (select id from ingredients where store_id = c_store and name = '대파' limit 1)), 2) <> 4.00 then
    raise exception '0110: 대파 기준단가가 움직였습니다' using errcode = '45003';
  end if;
end
$chk$;
