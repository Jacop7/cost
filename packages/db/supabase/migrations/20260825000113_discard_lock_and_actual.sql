-- ════════════════════════════════════════════════════════════════
-- 0113 · 폐기가 **빼려던 양**을 원장에 적었다 (경합에서 원장 합 ≠ 잔액)
--
-- 동시성 감사에서 나왔다. 내가 만든 버그는 아니지만, 내 테스트가 전역으로
-- 주장하는 불변식 `원장 합 = 잔액` 에 뚫린 구멍이라 여기서 막는다.
--
-- 예전 흐름 —
--     v_before  := stock_total_base(p_ingredient);        ← **잠금 없이** 읽는다
--     v_discard := greatest(v_before - p_remain_volume, 0);
--     perform consume_stock(p_ingredient, v_discard);     ← 반환값을 **버린다**
--     insert into inventory_events (... count_delta ...) values (..., -v_discard, ...);
--
-- `consume_stock` 은 안에서 `for update` 로 다시 읽는다. 그 사이 재고가 줄었으면
-- **덜 빼고**, 원장에는 여전히 `v_discard` 가 적힌다. 둘이 갈린다.
--
-- 실측(결정적으로 재현. 세션2 가 행을 잠그고 앉아 창을 벌렸다):
--     출발 3,000g · 세션1 은 `남은 양 1,000` 으로 2,000g 을 뺄 셈
--     세션2 가 그 사이 재고를 50g 으로 떨어뜨리고 커밋
--     세션1 의 consume_stock 은 50g 만 뺐는데 원장에는 2,000g 을 적었다
--     → 최종 잔액 0 · 원장 합 −1,950   (1,950g 어긋남)
--
-- ⚠ 0106 이 만든 게 아니다. 자르는 동작 자체는 예전부터 있었다.
--   다만 0106 이 바닥을 0 으로 깔면서 **덜 빼는 경우가 더 흔해졌다** —
--   음수 재고에서 예전엔 거꾸로 늘었고(그건 그것대로 틀렸다) 이제는 0 을 뺀다.
--   어느 쪽이든 원장이 갈리는 건 같으므로, 여기서 원인을 끊는다.
--
-- 고치는 방법 둘을 **함께** 쓴다.
--   ① 먼저 잠그고 나서 계산한다 → v_discard 가 스테일일 수 없다
--   ② 그래도 원장에는 **실제로 빠진 양**(consume_stock 의 반환값)을 적는다
--      ①만 해도 값은 같아지지만, ② 는 "원장은 사실을 적는다"는 규칙 자체다.
--      나중에 누가 ① 을 걷어내도 원장은 안 거짓말한다.
--
-- ⚠ 폐기가 음수로 못 내려가는 정책은 그대로다(기획안 §5.6).
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text; v_step text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e2_discard';

  if v_def is null then
    raise exception '0113: e2_discard 가 없습니다' using errcode = '45003';
  end if;
  if position('v_taken   numeric' in v_def) > 0 then return; end if;

  -- ── ① 실제로 빠진 양을 담을 자리 ──────────────────────────
  v_step := 'v_taken 선언';
  v_new := replace(v_def,
    $x$  v_discard numeric;$x$,
    $x$  v_discard numeric;
  v_taken   numeric;   -- 실제로 빠진 양. 빼려던 양(v_discard)과 다를 수 있다(0113).$x$);
  if v_new = v_def then
    raise exception '0113: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;
  v_def := v_new;

  -- ── ② 먼저 잠그고 나서 읽는다 ─────────────────────────────
  v_step := '잠금 후 읽기';
  v_new := replace(v_def,
    $x$  v_before  := coalesce(stock_total_base(p_ingredient), 0);$x$,
    $x$  -- ⚠ **먼저 잠근다**(0113). 잠금 밖에서 읽으면 아래 consume_stock 이 다시 읽을 때
  --   값이 달라져 있을 수 있고, 그러면 빼려던 양과 실제로 빠진 양이 갈린다.
  perform 1 from public.inventory_states where ingredient_id = p_ingredient for update;
  v_before  := coalesce(stock_total_base(p_ingredient), 0);$x$);
  if v_new = v_def then
    raise exception '0113: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;
  v_def := v_new;

  -- ── ③ 반환값을 받는다 ─────────────────────────────────────
  v_step := '소진 반환값';
  v_new := replace(v_def,
    $x$  perform consume_stock(p_ingredient, v_discard);$x$,
    $x$  v_taken := consume_stock(p_ingredient, v_discard);
  -- 뺄 게 없으면 사건이 아니다. 0g 짜리 폐기 행은 real_loss_rate 를 망친다(0044 의 교훈).
  if coalesce(v_taken, 0) <= 0 then
    return jsonb_build_object(
      'ingredient_id', p_ingredient, 'discarded', 0, 'skipped', true,
      'stock', stock_total_base(p_ingredient), 'unit_price', base_unit_price(p_ingredient));
  end if;$x$);
  if v_new = v_def then
    raise exception '0113: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;
  v_def := v_new;

  -- ── ④ 원장에는 **실제로 빠진 양**을 적는다 ────────────────
  v_step := '원장 기록';
  v_new := replace(v_def,
    $x$       values (v_store, p_ingredient, 'discard', -v_discard, v_discard,$x$,
    $x$       values (v_store, p_ingredient, 'discard', -v_taken, v_taken,$x$);
  if v_new = v_def then
    raise exception '0113: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e2_discard';

  if position($x$'discard', -v_taken, v_taken$x$ in v_def) = 0 then
    raise exception '0113: 원장이 아직 빼려던 양을 적습니다' using errcode = '45003';
  end if;
  if position('for update' in v_def) = 0 then
    raise exception '0113: 잠금이 안 들어갔습니다' using errcode = '45003';
  end if;
  -- 지우면 안 되는 것들 — 폐기의 본체다.
  if position('real_loss_rate' in v_def) = 0 and position('price_trends' in v_def) = 0 then
    raise exception '0113: 폐기 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
  if position('미래 날짜로는 폐기할 수 없습니다' in v_def) = 0
     or position('남은 양은 0 이상이어야 합니다' in v_def) = 0 then
    raise exception '0113: 입력 가드를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
