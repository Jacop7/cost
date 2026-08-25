-- ════════════════════════════════════════════════════════════════
-- 0120 · `has_basis` 가 너무 거칠었다 — 영업 중 새로 만든 메뉴가 샌다
--
-- 0119 는 이렇게 물었다: "그날 스냅샷에 메뉴가 **하나라도** 있나?"
-- 그 질문으로는 이걸 못 잡는다 —
--
--     영업 중에 새 메뉴를 만든다
--     → 기존 메뉴들의 스냅샷이 있으므로 has_basis = true
--     → 그런데 **새 메뉴는 스냅샷에 없다**. 필요 재료가 0건으로 계산된다
--     → 부족 경고 없이 저장된다
--     → 저장하면서 그제야 새 메뉴의 스냅샷이 추가된다(add_to_day_basis)
--
-- 결국 0119 가 막으려던 바로 그 구멍(첫 판매의 부족 경고 누락)이 메뉴 단위로 남는다.
--
-- 물어야 할 것은 **"이번에 파는 메뉴 전부가 스냅샷에 있나"** 다.
-- 하나라도 없으면 그 메뉴의 필요량을 못 재므로, `부족 0건` 은 믿을 수 없다.
--
-- ⚠ `want` 가 비면(메뉴 없이 기타 매출만) 잴 것이 없으므로 true 다.
--   "못 쟀다"가 아니라 "잴 게 없다"이고, 화면은 어차피 경고를 안 띄운다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sale_shortages';

  if v_def is null then
    raise exception '0120: sale_shortages 가 없습니다' using errcode = '45003';
  end if;
  if position('0120b' in v_def) > 0 then return; end if;

  -- 0119 가 넣은 거친 판정을 통째로 들어낸다.
  -- ⚠ 여러 줄이라 정규식으로 잡는다(파일 CRLF ↔ 서버 LF, 0084).
  -- `'has_basis',` 부터 다음 칸인 `'ingredient_count'` 앞까지를 통째로 갈아 끼운다.
  -- 0119 판이든 0120 첫 판이든 상관없이 잡힌다.
  v_new := regexp_replace(v_def,
    $re$    'has_basis',[\s\S]*?(?=    'ingredient_count')$re$,
    $rep$    -- 0120b · **이번에 파는 메뉴 전부**가 그날 스냅샷에 있어야 잰 것이다.
    --   하나라도 없으면(영업 중 새로 만든 메뉴) 그 메뉴의 필요량이 0 으로 나오고,
    --   `부족 0건` 은 "넉넉하다"가 아니라 "못 쟀다"가 된다.
    -- ⚠ `coalesce(... , false)` 가 **없으면 안 된다.** 스냅샷에 없는 메뉴는
    --   `jsonb_typeof` 가 null 이고 `null = 'object'` 는 null 인데, `bool_and` 는
    --   null 을 **그냥 건너뛴다**. 그래서 첫 판에서는 없는 메뉴를 세고도 true 가 나왔다.
    'has_basis', (select coalesce(bool_and(coalesce(
         jsonb_typeof(day_snapshot(p_store, p_date) #> array['recipes', w.recipe_id::text]) = 'object'
       , false)), true) from want w),
$rep$);
  if v_new = v_def then
    raise exception '0120: has_basis 칸을 못 찾았습니다' using errcode = '45003';
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
   where n.nspname = 'public' and p.proname = 'sale_shortages';

  if position('0120b' in v_def) = 0 or position('bool_and' in v_def) = 0 then
    raise exception '0120: 메뉴별 판정이 안 들어갔습니다' using errcode = '45003';
  end if;
  -- null 을 false 로 눕히는 coalesce 가 반드시 있어야 한다. 없으면 bool_and 가 건너뛴다.
  if position('bool_and(coalesce(' in v_def) = 0 then
    raise exception '0120: null 처리가 빠졌습니다 — bool_and 가 없는 메뉴를 건너뜁니다'
      using errcode = '45003';
  end if;
  -- 거친 판정이 남아 있으면 안 된다 — 둘이 같이 있으면 어느 쪽이 이길지 모른다.
  if position('jsonb_typeof(day_snapshot(p_store, p_date) -> ''recipes'')' in v_def) > 0 then
    raise exception '0120: 0119 의 거친 판정이 남아 있습니다' using errcode = '45003';
  end if;
  if position('day_ingredient_needs' in v_def) = 0 or position('ingredient_count' in v_def) = 0 then
    raise exception '0120: 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
