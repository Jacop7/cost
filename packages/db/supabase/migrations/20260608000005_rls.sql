-- ════════════════════════════════════════════════════════════════
-- 0005 · RLS 정책 — 전 도메인 테이블 store_id 격리
-- 정책: 행의 store_id 가 내가 소유한 매장 집합(my_store_ids)에 속할 때만 접근.
-- stores 자체 정책은 0001 에서 정의.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  store_scoped text[] := array[
    'categories','vendors','brands','ingredients','purchase_options',
    'inventory_states','inventory_events','order_records','order_candidates',
    'recipe_calc_runs','price_trends',
    'recipes','recipe_lines','recipe_extra_costs','profit_trends',
    'fixed_costs_monthly','monthly_pl','settings'
  ];
begin
  foreach t in array store_scoped loop
    execute format('alter table %I enable row level security;', t);

    execute format($f$
      create policy %1$s_select on %1$I for select
        using (store_id in (select public.my_store_ids()));
    $f$, t);

    execute format($f$
      create policy %1$s_insert on %1$I for insert
        with check (store_id in (select public.my_store_ids()));
    $f$, t);

    execute format($f$
      create policy %1$s_update on %1$I for update
        using (store_id in (select public.my_store_ids()))
        with check (store_id in (select public.my_store_ids()));
    $f$, t);

    execute format($f$
      create policy %1$s_delete on %1$I for delete
        using (store_id in (select public.my_store_ids()));
    $f$, t);
  end loop;
end $$;
