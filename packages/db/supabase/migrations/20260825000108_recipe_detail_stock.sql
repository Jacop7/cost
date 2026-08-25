-- ════════════════════════════════════════════════════════════════
-- 0108 · 레시피 상세의 재료 줄에도 재고 상태를 실어 준다
--
-- 기획안 §5.2. 줄에는 이미 `stock_total` 이 있었지만 상태를 판정할 재료가
-- 없었다 — 안전재고와 곧소진 신호가 빠져 있어서 화면이 `−750g` 을 회색으로
-- 그리거나 `소진` 뱃지를 못 달았다.
--
-- ⚠ 상태 **문자열**은 서버가 만들지 않는다. 판정은 `packages/core` 의
--   `stockStateOf` 한 곳이다(0108). 여기서 또 판정하면 두 벌이 되고,
--   두 벌은 반드시 갈린다 — 실제로 core 와 앱이 `soonOut` 을 서로 다르게
--   읽고 있었다. 서버는 **재료만** 준다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recipe_detail';

  if v_def is null then
    raise exception '0108: recipe_detail 이 없습니다' using errcode = '45003';
  end if;
  if position($x$'safety_stock', i.safety_stock$x$ in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$               'stock_total', stock_total_base(rl.ingredient_id),$x$,
    $x$               'stock_total', stock_total_base(rl.ingredient_id), 'safety_stock', i.safety_stock, 'safety_stock_is_base', i.safety_stock_is_base, 'per_volume', i.per_volume, 'soon_out', coalesce(inv.soon_out, false),$x$);
  if v_new = v_def then
    raise exception '0108: 재고 줄을 못 찾았습니다' using errcode = '45003';
  end if;
  v_def := v_new;

  -- 곧소진은 inventory_states 에 있다. 재료 줄에서 닿으려면 조인이 하나 더 필요하다.
  v_new := replace(v_def,
    $x$      left join ingredients i on i.id = rl.ingredient_id$x$,
    $x$      left join ingredients i on i.id = rl.ingredient_id
      left join inventory_states inv on inv.ingredient_id = rl.ingredient_id$x$);
  if v_new = v_def then
    raise exception '0108: 재료 조인을 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

-- 되읽어서 확인한다. execute 가 성공했다고 원하는 함수가 된 건 아니다(0102 의 교훈).
do $chk$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recipe_detail';
  if position($x$'safety_stock', i.safety_stock$x$ in v_def) = 0
     or position($x$'soon_out', coalesce(inv.soon_out, false)$x$ in v_def) = 0 then
    raise exception '0108: 재고 상태 재료가 안 실렸습니다' using errcode = '45003';
  end if;
  -- 지우면 안 되는 것 — 상세의 본체다.
  if position('profit_trends' in v_def) = 0 or position('sales_30d' in v_def) = 0 then
    raise exception '0108: 상세 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
