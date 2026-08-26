/*
 * 0155 · 전역 날짜 함수 삭제 — business_day() · business_cutoff()
 *
 * 0154 에서 마지막 사용처(판매 다섯 함수)가 매장 컨텍스트로 옮겨 갔다.
 * 이 둘은 `settings limit 1` 위에 서 있어 매장을 안 가렸다 — 남겨 두면
 * 다음 사람이 "이미 있는 함수"로 읽고 새 코드에 다시 붙인다.
 *
 * ⚠ "시험이 쓴다"는 이유로 남기지 않는다(운영 함수 원칙). 시험의 '오늘'은
 *   pg_temp.today() 가 컨텍스트로 구한다.
 */

-- ── ① 낡은 주석 갱신 — 지운 함수를 가리키는 말은 함께 지운다 ────
create or replace function public.store_local_date(p_store uuid, p_at timestamptz default now())
returns date
language sql
stable
as $$
  -- ⚠ **영업 경계를 빼지 않는다.** 판매 영업일(sales_date)과의 차이 전부다.
  --   영업 종료 시각이 몇 시든 달력 날짜는 달력 날짜다(기획서 §4.1).
  --   판매가 속할 날은 resolve_sales_business_context 가 매장 규칙으로 구한다(0154).
  select (p_at at time zone public.store_timezone(p_store))::date;
$$;

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_operating_hours';
  v_old := '   *   (`business_cutoff()` 는 아직 settings 를 본다 — 3-3 단계다.)';
  v_new := '   *   (전역 business_cutoff 는 0155 에서 지웠다 — 날짜 권위는 매장 컨텍스트다.)';
  if position(v_old in v_def) = 0 then
    raise exception '0155: set_operating_hours 에서 옛 주석을 못 찾았습니다';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;

-- ── ② 삭제 ──────────────────────────────────────────────────────
drop function public.business_day(timestamptz);
drop function public.business_cutoff();

-- ── ③ 사후조건 — 어디에도 남지 않았다 ───────────────────────────
do $$
declare
  r record;
  v_n int;
begin
  -- 함수 본문(주석 포함) 어디에도 없다. 주석에 남으면 다음 사람이 따라간다.
  for r in
    select p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and pg_get_functiondef(p.oid) ~ 'business_day\(\)|business_cutoff\(\)'
  loop
    raise exception '0155: % 가 아직 전역 날짜 함수를 언급합니다', r.proname;
  end loop;

  -- 뷰에도 없다.
  select count(*) into v_n
    from pg_views where schemaname = 'public'
     and definition ~ 'business_day\(\)|business_cutoff\(\)';
  if v_n > 0 then
    raise exception '0155: 뷰 %개가 아직 전역 날짜 함수를 봅니다', v_n;
  end if;

  -- 함수 자체가 없다.
  select count(*) into v_n
    from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('business_day', 'business_cutoff');
  if v_n > 0 then
    raise exception '0155: 전역 날짜 함수 %개가 남아 있습니다', v_n;
  end if;
end $$;
