-- ════════════════════════════════════════════════════════════════
-- 0022 · RPC 오버로드 제거 + 재발 방지 가드
--
-- 같은 사고가 세 번째다:
--   0012 — e1_confirm_inbound 가 2인자/3인자 두 개로 갈라져 **멱등·잠금·클램프 방어를 우회**할 수 있었다
--   0015 — 인자를 또 늘리며 같은 문제가 반복돼 drop 을 명시했다
--   0020 — e2_discard 에 p_occurred_at 을 더하면서 **또 구버전이 남았다**
--          (실증: `function e2_discard(uuid, integer) is not unique`)
--
-- 원인:
--   `create or replace function` 은 **인자 시그니처가 다르면 교체가 아니라 신규 생성**이다.
--   PostgREST 는 넘어온 인자 개수로 함수를 고르므로, 구버전이 남아 있으면
--   인자 하나를 빼는 것만으로 새 방어를 통째로 건너뛸 수 있다.
--
-- 조치:
--   1) 지금 남아 있는 구버전을 전부 지운다.
--   2) **전파 RPC 는 이름당 정확히 하나**임을 검사하는 가드를 둔다.
--      앞으로 인자를 늘리면 이 마이그레이션 이후의 reset 에서 즉시 실패해 드러난다.
-- ════════════════════════════════════════════════════════════════

-- 0020 이 e2_discard(uuid, numeric, date) 를 만들면서 남은 구버전
drop function if exists public.e2_discard(uuid, numeric);

-- ── 재발 방지 가드 ────────────────────────────────────────────
-- 전파 RPC 는 "무엇이 일어나는지"를 단일하게 정의해야 한다. 이름당 하나만 존재해야
-- 인자 개수에 따라 다른 동작이 선택되는 일이 없다.
do $$
declare
  r record;
  msg text := '';
begin
  for r in
    select p.proname, count(*) as c,
           string_agg(pg_get_function_identity_arguments(p.oid), ' | ') as sigs
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname ~ '^(e[0-9]+_|recompute_recipe|refresh_order_candidate|consume_stock|stock_total_base|base_unit_price|real_loss_rate|fixed_cost_rate|sales_summary|recipe_material_cost)'
     group by p.proname
    having count(*) > 1
  loop
    msg := msg || format(E'\n  %s (%s개): %s', r.proname, r.c, r.sigs);
  end loop;

  if msg <> '' then
    raise exception E'전파 RPC 오버로드가 발견됐다. 인자 개수로 다른 동작이 선택되어 방어가 우회될 수 있다.%\n\n인자를 바꿀 때는 이전 시그니처를 반드시 drop 할 것.', msg;
  end if;
end $$;

-- 앞으로를 위한 안내: 이 검사를 새 마이그레이션에서도 재사용할 수 있게 함수로 남긴다.
create or replace function public.assert_no_rpc_overloads()
returns void language plpgsql as $$
declare r record; msg text := '';
begin
  for r in
    select p.proname, count(*) as c,
           string_agg(pg_get_function_identity_arguments(p.oid), ' | ') as sigs
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname ~ '^(e[0-9]+_|recompute_recipe|refresh_order_candidate|consume_stock|stock_total_base|base_unit_price|real_loss_rate|fixed_cost_rate|sales_summary|recipe_material_cost)'
     group by p.proname having count(*) > 1
  loop
    msg := msg || format(E'\n  %s (%s개): %s', r.proname, r.c, r.sigs);
  end loop;
  if msg <> '' then
    raise exception E'전파 RPC 오버로드 발견:%', msg;
  end if;
end;
$$;

comment on function public.assert_no_rpc_overloads() is
  '전파 RPC 가 이름당 하나인지 검사한다. 인자를 바꾸는 마이그레이션 끝에서 호출할 것.';

select public.assert_no_rpc_overloads();
