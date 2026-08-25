-- ════════════════════════════════════════════════════════════════
-- 0124 · 월 기준도 가른다 — 매장 현지 월과 판매 장부 월
--
-- 0123 은 `business_tz()` **직접 호출**만 봤다. 그래서 "남은 하드코딩은 정확히 둘"
-- 이라고 통과했다. 그런데 `business_month()` 가 그 둘 중 하나이고, **여섯 함수가
-- 그걸 거쳐 서울을 물고 있었다** —
--
--     business_month(at) = to_char(at at time zone business_tz(), 'YYYY-MM')
--
--     e1_confirm_inbound · e11_inbound_reverted · recipe_detail
--     recipe_list · save_recipe · build_day_snapshot
--     → 전부 `fixed_cost_rate(store, business_month())`
--
-- 뉴욕 매장의 월말·월초에 **다른 달의 고정지출률**이 붙는다. 8월 31일 저녁 7시
-- (뉴욕)는 서울로 9월 1일 아침 8시라, 8월 원가에 9월 고정지출률이 들어간다.
--
-- ⚠ 처방이 자리마다 다르다. 하나로 밀면 안 된다.
--
--   ① 지금 시점의 요율이 맞는 곳 → `store_local_month(store)`
--      입고·취소·레시피 조회/저장. "지금 이 매장의 이번 달" 이 맞다.
--
--   ② **이미 날짜가 정해진 곳** → 그 날짜에서 뽑는다
--      `build_day_snapshot` 이 여기다. 그날 장부의 고정지출률은
--      **그 영업일이 속한 달**이어야 한다.
--
--      ⚠⚠ 여기를 `store_local_month(now())` 로 바꾸면 안 된다.
--        1월 31일 영업이 2월 1일 새벽까지 이어지면, 스냅샷을 만드는 시각은
--        2월인데 **장부는 1월치**다. 1월 고정지출을 써야 한다.
--        그래서 인자로 날짜를 받는다. `to_char(p_date, 'YYYY-MM')` 은
--        시간대가 아예 안 끼어든다 — 이미 매장 현지 날짜이기 때문이다.
-- ════════════════════════════════════════════════════════════════

-- ── 매장 현지 월 ──────────────────────────────────────────────
create or replace function public.store_local_month(p_store uuid, p_at timestamptz default now())
returns text language sql stable as $fn$
  select to_char(p_at at time zone public.store_timezone(p_store), 'YYYY-MM');
$fn$;

comment on function public.store_local_month(uuid, timestamptz) is
  '매장 현지 달력의 월(0124). 고정지출률 귀속 월 키다. '
  '⚠ **날짜가 이미 정해진 곳에서는 쓰지 않는다** — 거기서는 `to_char(그 날짜, ''YYYY-MM'')` 이다. '
  '영업일 스냅샷이 대표적이다: 1/31 영업이 2/1 새벽까지 이어져도 장부는 1월치다.';


-- ── ② 영업일 스냅샷은 **그 영업일의 달**을 쓴다 ───────────────
-- 인자가 늘어난다. 옛 판을 지워야 오버로드가 안 생긴다.
-- ⚠ 부르는 곳은 `open_business_day` 하나뿐이고 거기 `v_date` 가 있다(확인함).
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'build_day_snapshot';
  if v_def is null then
    raise exception '0124: build_day_snapshot 이 없습니다' using errcode = '45003';
  end if;
  if position('p_date date' in v_def) > 0 then return; end if;

  -- 인자를 더하고, 월 키를 그 날짜에서 뽑는다.
  v_new := replace(v_def,
    'build_day_snapshot(p_store uuid)',
    'build_day_snapshot(p_store uuid, p_date date)');
  if v_new = v_def then
    raise exception '0124: build_day_snapshot 시그니처를 못 찾았습니다' using errcode = '45003';
  end if;
  v_def := v_new;

  v_new := replace(v_def, 'business_month()', $x$to_char(p_date, 'YYYY-MM')$x$);
  if v_new = v_def then
    raise exception '0124: 스냅샷의 월 키를 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
  drop function if exists public.build_day_snapshot(uuid);
end
$mig$;

-- 부르는 쪽에 날짜를 넘긴다.
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_business_day';
  if position('build_day_snapshot(p_store, v_date)' in v_def) > 0 then return; end if;

  v_new := replace(v_def, 'build_day_snapshot(p_store)', 'build_day_snapshot(p_store, v_date)');
  if v_new = v_def then
    raise exception '0124: open_business_day 의 호출을 못 찾았습니다' using errcode = '45003';
  end if;
  execute v_new;
end
$mig$;


-- ── ① 나머지 다섯은 "지금 이 매장의 이번 달" ──────────────────
do $mig$
declare r record; v_def text; v_new text; v_n int := 0;
begin
  for r in
    select * from (values
      ('e1_confirm_inbound',   'o.store_id'),
      ('e11_inbound_reverted', 'o.store_id'),
      ('recipe_detail',        'r.store_id'),
      ('recipe_list',          'r.store_id'),
      ('save_recipe',          'p_store')
    ) as t(fn, store_expr)
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    if v_def is null then
      raise exception '0124: % 가 없습니다', r.fn using errcode = '45003';
    end if;
    if position('business_month()' in v_def) = 0 then continue; end if;

    v_new := replace(v_def, 'business_month()', 'store_local_month(' || r.store_expr || ')');
    execute v_new;
    v_n := v_n + 1;
  end loop;
  raise notice '0124: %개 함수의 월 기준을 매장 것으로 옮겼습니다', v_n;
end
$mig$;


-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare v_left text;
begin
  /*
   * ⚠ 이번엔 **간접 경로까지** 본다. 0123 이 직접 호출만 보고 "정확히 둘" 이라
   *   통과했던 게 바로 이 구멍이었다.
   *   `business_month(` 를 부르는 함수가 하나라도 남으면 안 된다 —
   *   그게 곧 서울 하드코딩을 물고 있다는 뜻이다.
   */
  select coalesce(string_agg(p.proname, ', ' order by p.proname), '') into v_left
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
   where n.nspname = 'public' and p.prokind = 'f' and l.lanname in ('plpgsql','sql')
     and p.prosrc like '%business_month(%' and p.proname <> 'business_month';
  if v_left <> '' then
    raise exception '0124: 아직 월 기준이 서울을 물고 있습니다 — %', v_left using errcode = '45003';
  end if;

  -- 스냅샷은 인자로 받은 날짜를 쓴다. now() 로 되돌아가면 1/31 → 2/1 새벽이 깨진다.
  select pg_get_functiondef(p.oid) into v_left
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'build_day_snapshot';
  if position($x$to_char(p_date, 'YYYY-MM')$x$ in v_left) = 0 then
    raise exception '0124: 스냅샷이 그 영업일의 달을 안 씁니다' using errcode = '45003';
  end if;
  if position('store_local_month' in v_left) > 0 then
    raise exception '0124: 스냅샷이 now() 기준 월을 씁니다 — 1/31 영업이 2/1 새벽에 깨집니다'
      using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
