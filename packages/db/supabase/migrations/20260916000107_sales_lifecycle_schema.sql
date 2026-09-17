-- 0107 · 매출 작성 수명주기 기반 스키마
-- 미작성 → 서버 초안 → 작성 완료를 기존 확정 원장과 병행 배포한다.
begin;

do $m$
begin
  if not exists (select 1 from pg_type where typnamespace='public'::regnamespace and typname='sales_calendar_day_kind') then
    create type public.sales_calendar_day_kind as enum ('expected','closed','unclassified');
  end if;
  if not exists (select 1 from pg_type where typnamespace='public'::regnamespace and typname='sales_calendar_source') then
    create type public.sales_calendar_source as enum ('operating_rule','manual_extra','manual_closed','migrated_ledger','migrated_unknown');
  end if;
  if not exists (select 1 from pg_type where typnamespace='public'::regnamespace and typname='sales_draft_kind') then
    create type public.sales_draft_kind as enum ('initial','amendment');
  end if;
  if not exists (select 1 from pg_type where typnamespace='public'::regnamespace and typname='sales_draft_status') then
    create type public.sales_draft_status as enum ('editing','pending_inventory_resolution','expired','discarded','finalized');
  end if;
  if not exists (select 1 from pg_type where typnamespace='public'::regnamespace and typname='sales_cutover_phase') then
    create type public.sales_cutover_phase as enum ('legacy_active','draining','freezing','active','blocked');
  end if;
  if not exists (select 1 from pg_type where typnamespace='public'::regnamespace and typname='sales_basis_quality') then
    create type public.sales_basis_quality as enum ('exact','legacy_unrecorded','estimated_current');
  end if;
end $m$;

create table public.sales_calendar_days (
  store_id uuid not null references public.stores(id) on delete cascade,
  business_date date not null,
  day_kind public.sales_calendar_day_kind not null,
  source public.sales_calendar_source not null,
  operating_rule_revision bigint,
  timezone_id text not null,
  scheduled_open_at timestamptz,
  scheduled_close_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (store_id,business_date)
);

create table public.sales_basis_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  effective_from_business_date date not null,
  revision bigint not null,
  basis_quality public.sales_basis_quality not null default 'exact',
  manifest jsonb not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_clock bigint not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  unique (store_id,effective_from_business_date,revision),
  unique (store_id,effective_from_business_date,manifest_sha256)
);
create index sales_basis_versions_resolve_idx
  on public.sales_basis_versions(store_id,effective_from_business_date desc,revision desc);

create table public.sales_basis_publisher_state (
  store_id uuid not null references public.stores(id) on delete cascade,
  source_kind text not null,
  source_id text not null,
  processed_revision text not null,
  processed_at timestamptz not null default clock_timestamp(),
  primary key (store_id,source_kind,source_id)
);

create table public.sales_lifecycle_cutover_state (
  store_id uuid primary key references public.stores(id) on delete cascade,
  phase public.sales_cutover_phase not null default 'legacy_active',
  revision integer not null default 0 check (revision >= 0),
  planned_freeze_at timestamptz,
  inventory_reference_sales_date date,
  freeze_receipt_id uuid,
  blocked_reason text,
  updated_at timestamptz not null default clock_timestamp(),
  constraint sales_cutover_block_reason_ck check ((phase='blocked') = (blocked_reason is not null))
);

create table public.sales_lifecycle_cutover_receipts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  receipt_kind text not null check (receipt_kind in ('draining_baseline','freeze','activate','blocked')),
  phase_revision integer not null,
  inventory_reference_sales_date date,
  inventory_write_revision bigint not null,
  inventory_event_sequence bigint not null,
  ledger_state_hash text not null check (ledger_state_hash ~ '^[0-9a-f]{64}$'),
  source_state_hash text not null check (source_state_hash ~ '^[0-9a-f]{64}$'),
  previous_receipt_id uuid references public.sales_lifecycle_cutover_receipts(id) on delete restrict,
  payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid,
  created_at timestamptz not null default clock_timestamp()
);
create index sales_lifecycle_cutover_receipts_store_idx
  on public.sales_lifecycle_cutover_receipts(store_id,created_at desc);

insert into public.sales_lifecycle_cutover_state(store_id,phase)
select id,'legacy_active'::public.sales_cutover_phase from public.stores
on conflict (store_id) do nothing;

create or replace function public.sales_lifecycle_seed_new_store()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  insert into public.sales_lifecycle_cutover_state(store_id,phase)
  -- create_store의 부트스트랩이 끝난 뒤에만 active로 올린다.
  values (new.id,'legacy_active') on conflict (store_id) do nothing;
  return new;
end $fn$;
create trigger stores_sales_lifecycle_seed
after insert on public.stores for each row execute function public.sales_lifecycle_seed_new_store();

create table public.sales_day_drafts (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  business_date date not null,
  draft_kind public.sales_draft_kind not null,
  status public.sales_draft_status not null default 'editing',
  base_ledger_revision integer not null default 0 check (base_ledger_revision >= 0),
  basis_version_id uuid not null references public.sales_basis_versions(id),
  draft_revision integer not null default 0 check (draft_revision >= 0),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  note text,
  last_saved_by uuid,
  last_saved_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint sales_day_drafts_terminal_times_ck check (
    (status='finalized') = (finalized_at is not null) and
    (status='discarded') = (discarded_at is not null)
  )
);
create unique index sales_day_drafts_active_uidx
  on public.sales_day_drafts(store_id,business_date)
  where status in ('editing','pending_inventory_resolution');
create index sales_day_drafts_store_date_idx
  on public.sales_day_drafts(store_id,business_date desc,last_saved_at desc);

create table public.sales_draft_menu_lines (
  id uuid primary key,
  draft_id uuid not null references public.sales_day_drafts(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete restrict,
  menu_name text not null,
  qty_hall numeric not null default 0 check (qty_hall >= 0),
  qty_delivery numeric not null default 0 check (qty_delivery >= 0),
  qty_takeout numeric not null default 0 check (qty_takeout >= 0),
  qty_waste numeric not null default 0 check (qty_waste >= 0),
  deleted boolean not null default false,
  sort_order integer not null default 0,
  unique (draft_id,recipe_id)
);

create table public.sales_draft_etc_lines (
  id uuid primary key,
  draft_id uuid not null references public.sales_day_drafts(id) on delete cascade,
  name text not null,
  price numeric not null check (price >= 0),
  qty numeric not null default 1 check (qty >= 0),
  channel text not null check (channel in ('hall','delivery','takeout')),
  deleted boolean not null default false,
  sort_order integer not null default 0
);

create table public.sales_draft_expense_lines (
  id uuid primary key,
  draft_id uuid not null references public.sales_day_drafts(id) on delete cascade,
  name text not null,
  amount numeric not null check (amount >= 0),
  memo text,
  deleted boolean not null default false,
  sort_order integer not null default 0
);

create table public.sales_day_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  business_date date not null,
  version_no integer not null check (version_no > 0),
  source_draft_id uuid not null references public.sales_day_drafts(id) on delete restrict,
  basis_version_id uuid not null references public.sales_basis_versions(id) on delete restrict,
  basis_quality public.sales_basis_quality not null,
  payload jsonb not null,
  summary jsonb not null,
  customer_total numeric not null check (customer_total >= 0),
  net_sales numeric not null check (net_sales >= 0),
  fixed_rate numeric,
  finalized_by uuid,
  finalized_at timestamptz not null default clock_timestamp(),
  unique (store_id,business_date,version_no),
  unique (source_draft_id)
);

create table public.sales_day_heads (
  store_id uuid not null references public.stores(id) on delete cascade,
  business_date date not null,
  current_version_id uuid not null references public.sales_day_versions(id) on delete restrict,
  ledger_revision integer not null check (ledger_revision > 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (store_id,business_date)
);

create table public.sales_command_receipts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid,
  command_kind text not null,
  request_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (store_id,command_kind,request_key)
);

create table public.prepared_mutation_commands (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid,
  command_kind text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  status text not null default 'prepared' check (status in ('prepared','applied','cancelled','expired')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  unique (store_id,command_kind,id,payload_hash)
);

grant create on schema public to costkeep_rpc_executor;
do $m$
declare t text;
begin
  foreach t in array array[
    'sales_calendar_days','sales_basis_versions','sales_basis_publisher_state','sales_lifecycle_cutover_receipts',
    'sales_lifecycle_cutover_state','sales_day_drafts','sales_draft_menu_lines',
    'sales_draft_etc_lines','sales_draft_expense_lines','sales_day_versions',
    'sales_day_heads','sales_command_receipts','prepared_mutation_commands'
  ] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $m$;

create policy sales_calendar_days_read on public.sales_calendar_days for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_calendar_days.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_basis_versions_read on public.sales_basis_versions for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_basis_versions.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_basis_publisher_state_read on public.sales_basis_publisher_state for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_basis_publisher_state.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_cutover_state_read on public.sales_lifecycle_cutover_state for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_lifecycle_cutover_state.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_cutover_receipts_read on public.sales_lifecycle_cutover_receipts for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_lifecycle_cutover_receipts.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_day_drafts_read on public.sales_day_drafts for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_day_drafts.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_draft_menu_lines_read on public.sales_draft_menu_lines for select to authenticated
  using (exists(select 1 from public.sales_day_drafts own_draft join public.stores own_store
    on own_store.id=own_draft.store_id where own_draft.id=sales_draft_menu_lines.draft_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_draft_etc_lines_read on public.sales_draft_etc_lines for select to authenticated
  using (exists(select 1 from public.sales_day_drafts own_draft join public.stores own_store
    on own_store.id=own_draft.store_id where own_draft.id=sales_draft_etc_lines.draft_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_draft_expense_lines_read on public.sales_draft_expense_lines for select to authenticated
  using (exists(select 1 from public.sales_day_drafts own_draft join public.stores own_store
    on own_store.id=own_draft.store_id where own_draft.id=sales_draft_expense_lines.draft_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_day_versions_read on public.sales_day_versions for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_day_versions.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_day_heads_read on public.sales_day_heads for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_day_heads.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_command_receipts_read on public.sales_command_receipts for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=sales_command_receipts.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null)
    and (user_id is null or user_id=auth.uid()));
create policy prepared_mutation_commands_read on public.prepared_mutation_commands for select to authenticated
  using (exists(select 1 from public.stores own_store where own_store.id=prepared_mutation_commands.store_id
    and own_store.owner_id=auth.uid() and own_store.archived_at is null)
    and (user_id is null or user_id=auth.uid()));

grant select on public.sales_calendar_days,public.sales_basis_versions,
  public.sales_basis_publisher_state,public.sales_lifecycle_cutover_state,
  public.sales_lifecycle_cutover_receipts,
  public.sales_day_drafts,public.sales_draft_menu_lines,public.sales_draft_etc_lines,
  public.sales_draft_expense_lines,public.sales_day_versions,public.sales_day_heads,
  public.sales_command_receipts,public.prepared_mutation_commands to authenticated;
revoke insert,update,delete,truncate on public.sales_calendar_days,public.sales_basis_versions,
  public.sales_basis_publisher_state,public.sales_lifecycle_cutover_state,
  public.sales_lifecycle_cutover_receipts,
  public.sales_day_drafts,public.sales_draft_menu_lines,public.sales_draft_etc_lines,
  public.sales_draft_expense_lines,public.sales_day_versions,public.sales_day_heads,
  public.sales_command_receipts,public.prepared_mutation_commands from anon,authenticated;

do $m$
declare t text;
begin
  foreach t in array array[
    'sales_calendar_days','sales_basis_versions','sales_basis_publisher_state','sales_lifecycle_cutover_receipts',
    'sales_lifecycle_cutover_state','sales_day_drafts','sales_draft_menu_lines',
    'sales_draft_etc_lines','sales_draft_expense_lines','sales_day_versions',
    'sales_day_heads','sales_command_receipts','prepared_mutation_commands'
  ] loop
    execute format('alter table public.%I owner to costkeep_rpc_executor',t);
  end loop;
  alter function public.sales_lifecycle_seed_new_store() owner to costkeep_rpc_executor;
end $m$;
revoke create on schema public from costkeep_rpc_executor;

select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
