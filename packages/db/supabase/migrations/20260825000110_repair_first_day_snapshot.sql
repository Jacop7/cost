-- ════════════════════════════════════════════════════════════════
-- 0110 · 개업 첫날 스냅샷의 재료비가 0 이었다
--
-- 측정: 2026-07-30 하루만 메뉴 7종 전부 `unit_material_cost = 0` 인데
--       매출은 600,000원이다. 그날 손익은 재료비 없이 잡혀 있었다.
--
-- 원인은 **시드의 순서**다(seed.sql 에서 고쳤다).
--     open_business_day()   ← 여기서 그날 값을 굳히고
--     e7_place_order() …    ← 그다음에 개업 재고를 넣었다
--   기준단가는 `쓴 돈 ÷ 들어온 양`(0072)이고 '쓴 돈'은 발주 기록에서 온다.
--   개업 전에는 발주가 하나도 없으니 모든 단가가 null 이고, 그 상태로 영업을
--   시작하면 재료비 0 이 스냅샷에 **얼어붙는다.** 스냅샷은 하루 동안 고정이라
--   나중에 입고해도 그날은 영영 0 이다.
--   이튿날부터는 전날 단가가 남아 있어 멀쩡했다 — 그래서 하루짜리 구멍이었다.
--
-- ⚠ 스냅샷을 고치는 건 **원칙적으로 하면 안 되는 일**이다(0048: 그날 값은 잠긴다).
--   여기서만 예외로 두는 이유는 그 값이 '그날의 값'이 아니라 **없는 값**이었기
--   때문이다. 0 은 "재료비가 0원이었다"는 기록이 아니라 "못 구했다"는 흔적이다.
--
-- ⚠ 지어내지 않는다. 그날 발주 기록에서 나온 `day_unit_price(store, 그날, 재료)`
--   를 쓴다 — 순서만 바로잡은 시드가 만들어 냈을 바로 그 값이다.
--   검산: 대파 4.00원/g · 돼지고기 앞다리 13.00원/g 로 그날도 지금과 같다.
--
-- ⚠ 한 번만 돈다. 이미 0 이 아니면 아무것도 안 한다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare
  bd      record;
  v_snap  jsonb;
  v_rid   text;
  v_entry jsonb;
  v_lines jsonb;
  v_mat   numeric;
  v_fixed int := 0;
begin
  for bd in
    select id, store_id, business_date, snapshot
      from business_days
     where snapshot is not null
       -- 재료비가 전부 0 인 날만. 정상적인 날은 건드리지 않는다.
       and not exists (
         select 1 from jsonb_each(snapshot->'recipes') e
          where coalesce((e.value->>'material_cost')::numeric, 0) <> 0)
       and exists (select 1 from jsonb_each(snapshot->'recipes'))
  loop
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
       and ds.store_id = bd.store_id
       and ds.sale_date = bd.business_date
       and it.recipe_id is not null;

    v_fixed := v_fixed + 1;
    raise notice '0110: % 스냅샷 재료비를 그날 단가로 다시 채웠습니다', bd.business_date;
  end loop;

  if v_fixed = 0 then
    raise notice '0110: 고칠 날이 없습니다 (이미 정상)';
  end if;
end
$mig$;

-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare v_bad int;
begin
  -- 판 게 있는데 재료비가 0 인 날이 남아 있으면 안 된다.
  select count(*) into v_bad
    from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
   where it.recipe_id is not null
     and coalesce(it.unit_material_cost, 0) = 0
     and (it.qty_hall + it.qty_delivery + it.qty_takeout) > 0;
  if v_bad > 0 then
    raise exception '0110: 재료비 0 인 판매 줄이 % 개 남았습니다', v_bad using errcode = '45003';
  end if;

  -- 검산값이 움직이면 안 된다. 대파는 그날도 지금도 4.00원/g 이다.
  if round(day_unit_price(
       (select id from stores limit 1), '2026-07-30'::date,
       (select id from ingredients where name = '대파' limit 1)), 2) <> 4.00 then
    raise exception '0110: 대파 기준단가가 움직였습니다' using errcode = '45003';
  end if;
end
$chk$;
