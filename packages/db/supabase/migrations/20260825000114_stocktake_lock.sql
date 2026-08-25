-- ════════════════════════════════════════════════════════════════
-- 0114 · 실사도 잠금 밖에서 읽고 있었다 (0113 과 같은 병)
--
-- 0113 에서 폐기를 고치고 나서 같은 무늬를 찾아봤더니 실사가 걸렸다.
--
--     v_before := coalesce(stock_total_base(p_ingredient), 0);   ← **잠금 없이**
--     insert into inventory_states ... on conflict do update      ← 여기서 잠근다
--     v_after  := coalesce(stock_total_base(p_ingredient), 0);
--     insert into inventory_events (... count_delta ...) values (..., v_after - v_before, ...)
--
-- 실사는 재고를 **절대값으로** 덮어쓴다(`stock_total = p_stock_total`). 그래서
-- `v_after` 는 항상 사장님이 적은 숫자다. 문제는 `v_before` 다 —
-- 읽은 뒤 upsert 가 잠금을 잡기까지 사이에 다른 트랜잭션이 커밋하면,
-- 원장에는 **실제로 움직인 양이 아닌 값**이 적힌다.
--
--     실사 직전 재고 1,000 이라고 읽음
--     그 사이 판매가 커밋되어 400 이 됨
--     사장님이 800 으로 실사 → 실제 변화는 +400 인데 원장에는 −200 이 적힌다
--
-- 결과는 0113 과 같다 — `원장 합 ≠ 잔액`.
--
-- ⚠ `restore_stock` 은 이 병이 없다. 거기는 상대 증감(`stock_total + excluded`)이라
--   잠금 안에서 원자적으로 더하고, 반환값이 곧 실제 증가분이다. 손대지 않는다.
--
-- 고치는 법은 0113 과 같다 — **먼저 잠그고 나서 읽는다.**
-- 행이 아직 없을 수도 있으므로 빈 행을 만들어 두고 잠근다. 그래야 처음 실사
-- 두 건이 동시에 들어와도 둘 다 `v_before = 0` 으로 읽고 각자 원장을 적는 일이 없다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e5_stock_adjusted';

  if v_def is null then
    raise exception '0114: e5_stock_adjusted 가 없습니다' using errcode = '45003';
  end if;
  if position('0114' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$  v_before := coalesce(stock_total_base(p_ingredient), 0);$x$,
    $x$  -- ⚠ **먼저 잠그고 나서 읽는다**(0114). 잠금 밖에서 읽으면 아래 upsert 가 잠금을
  --   잡기까지 사이에 값이 바뀔 수 있고, 그러면 원장에 적히는 delta 가 실제 변화와 갈린다.
  --   행이 없으면 만들어 두고 잠근다 — 첫 실사 두 건이 동시에 들어오는 경우까지 막는다.
  insert into public.inventory_states (ingredient_id, store_id, stock_total, soon_out)
       values (p_ingredient, v_store, 0, false)
  on conflict (ingredient_id) do nothing;
  perform 1 from public.inventory_states where ingredient_id = p_ingredient for update;

  v_before := coalesce(stock_total_base(p_ingredient), 0);$x$);
  if v_new = v_def then
    raise exception '0114: 실사 읽기 줄을 못 찾았습니다' using errcode = '45003';
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
   where n.nspname = 'public' and p.proname = 'e5_stock_adjusted';

  if position('for update' in v_def) = 0 then
    raise exception '0114: 잠금이 안 들어갔습니다' using errcode = '45003';
  end if;
  -- 지우면 안 되는 것들 — 실사의 본체와 입력 가드다.
  if position('재고 수량은 0 이상이어야 합니다' in v_def) = 0 then
    raise exception '0114: 음수 입력 가드를 지웠습니다' using errcode = '45003';
  end if;
  if position('stocktake' in v_def) = 0 or position('refresh_order_candidate' in v_def) = 0 then
    raise exception '0114: 실사 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
