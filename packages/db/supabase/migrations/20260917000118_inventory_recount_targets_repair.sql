-- 0118 · 적용 이력에는 있으나 실물 표가 빠진 로컬/업그레이드 DB 전진 복구
begin;

create table if not exists public.inventory_recount_targets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  source_event_id uuid not null unique references public.inventory_events(id) on delete restrict,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','resolved')),
  resolved_by_count_batch_id uuid references public.inventory_count_batches(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz
);

alter table public.inventory_recount_targets enable row level security;
revoke all on public.inventory_recount_targets from public,anon,authenticated;
grant create on schema public to costkeep_rpc_executor;
alter table public.inventory_recount_targets owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

notify pgrst,'reload schema';
commit;
