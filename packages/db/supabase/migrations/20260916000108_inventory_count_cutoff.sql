-- 0108 · 전 매장 절대 실사와 재고 컷오프
begin;

alter table public.stores
  add column if not exists inventory_cutoff_business_date date not null default date '1900-01-01',
  add column if not exists legacy_inventory_cutoff_business_date date not null default date '1900-01-01',
  add column if not exists inventory_recount_required boolean not null default false;

-- 앱 롤은 stores를 직접 수정할 수 없다. 내부 RPC 소유자는 아래 두 열의 column grant와
-- 이 자기 매장 정책이 모두 맞을 때만 실사 컷오프 상태를 갱신한다.
drop policy if exists stores_inventory_cutoff_internal on public.stores;
create policy stores_inventory_cutoff_internal on public.stores
for update to costkeep_rpc_executor
using (owner_id=auth.uid() and archived_at is null)
with check (owner_id=auth.uid() and archived_at is null);

create table public.inventory_store_write_state (
  store_id uuid primary key references public.stores(id) on delete cascade,
  revision bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp()
);
insert into public.inventory_store_write_state(store_id)
select id from public.stores on conflict (store_id) do nothing;

create or replace function public.inventory_write_state_seed_store()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  insert into public.inventory_store_write_state(store_id) values (new.id)
  on conflict (store_id) do nothing;
  return new;
end $fn$;
create trigger stores_inventory_write_state_seed
after insert on public.stores for each row execute function public.inventory_write_state_seed_store();

create table public.inventory_count_sessions (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null check (status in ('active','completed','cancelled','expired','invalidated')),
  observation_started_at timestamptz not null,
  expires_at timestamptz not null,
  cutoff_business_date date not null,
  target_ingredient_ids uuid[] not null,
  stock_state jsonb not null,
  store_write_revision bigint not null,
  event_sequence_high_watermark bigint not null,
  created_by uuid,
  completed_at timestamptz,
  cancelled_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default clock_timestamp()
);
create unique index inventory_count_sessions_active_uidx
  on public.inventory_count_sessions(store_id) where status='active';

create table public.inventory_count_batches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.inventory_count_sessions(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  counted_at timestamptz not null,
  observation_started_at timestamptz not null,
  cutoff_business_date date not null,
  event_sequence_high_watermark bigint not null,
  request_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  unique (store_id,request_key)
);

create table public.inventory_count_lines (
  batch_id uuid not null references public.inventory_count_batches(id) on delete restrict,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  counted_quantity numeric not null check (counted_quantity >= 0),
  before_quantity numeric not null,
  event_id uuid not null unique references public.inventory_events(id) on delete restrict,
  primary key (batch_id,ingredient_id)
);

alter table public.inventory_events
  add column if not exists reported_count_delta numeric,
  add column if not exists stock_effect text not null default 'normal',
  add column if not exists absorbed_by_count_batch_id uuid references public.inventory_count_batches(id) on delete restrict,
  add column if not exists resolved_by_count_batch_id uuid references public.inventory_count_batches(id) on delete restrict,
  add column if not exists economic_revision integer not null default 0;

update public.inventory_events
set reported_count_delta=count_delta
where reported_count_delta is null;

alter table public.inventory_events
  add constraint inventory_events_stock_effect_ck
  check (stock_effect in ('normal','absorbed','resolved_by_count')) not valid;

create table public.pending_sales_inventory_resolution (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  draft_id uuid not null references public.sales_day_drafts(id) on delete restrict,
  line_id uuid not null,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  waste boolean not null default false,
  base_revision integer not null,
  basis_version_id uuid not null references public.sales_basis_versions(id) on delete restrict,
  target_hash text not null check (target_hash ~ '^[0-9a-f]{64}$'),
  delta numeric not null,
  reported_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','resolved','abandoned')),
  resolved_by_count_batch_id uuid references public.inventory_count_batches(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (draft_id,line_id,ingredient_id,waste,target_hash)
);

create table public.inventory_recount_targets (
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

-- 판매 목표와 실제 재고 반영을 분리한다. 실사가 흡수한 판매도 논리 소비량에는 남아
-- 이후 같은 수량을 다시 저장할 때 재차감되지 않는다.
create table public.sales_inventory_delta_components (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  sales_item_id uuid not null references public.daily_sales_items(id) on delete restrict,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  waste boolean not null default false,
  quantity numeric not null check (quantity>0),
  stock_effect text not null check (stock_effect in ('normal','absorbed','resolved_by_count')),
  source_event_id uuid references public.inventory_events(id) on delete restrict,
  source_event_sequence bigint not null,
  absorbed_by_count_batch_id uuid references public.inventory_count_batches(id) on delete restrict,
  resolved_by_count_batch_id uuid references public.inventory_count_batches(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);
create index sales_inventory_components_item_idx
  on public.sales_inventory_delta_components(sales_item_id,ingredient_id,waste,created_at desc,id desc);

create table public.sales_inventory_component_offsets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  component_id uuid not null references public.sales_inventory_delta_components(id) on delete restrict,
  quantity numeric not null check (quantity>0),
  inventory_event_id uuid references public.inventory_events(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);
create index sales_inventory_component_offsets_component_idx
  on public.sales_inventory_component_offsets(component_id);

-- 전환 전 판매 원장은 현재 순소비량을 normal 기준선 component로 투영한다.
insert into public.sales_inventory_delta_components(
  store_id,sales_item_id,ingredient_id,waste,quantity,stock_effect,source_event_sequence,created_at)
select e.store_id,e.sales_item_id,e.ingredient_id,e.waste,sum(-e.count_delta),'normal',max(e.seq),max(e.occurred_at)
from public.inventory_events e where e.sales_item_id is not null
group by e.store_id,e.sales_item_id,e.ingredient_id,e.waste
having sum(-e.count_delta)>1e-9;

-- 전체 실사와 실사에 흡수된 사건은 새 실사로만 전진 보정한다.
create or replace function public.stock_revert_candidates(p_ingredient uuid)
returns table(event_id uuid, action text, eligible boolean)
language sql stable security definer set search_path=public,pg_temp as $fn$
  with originals as (
    select e.*,case when e.type='inbound' then '입고'
      when e.type='stocktake' then '차감' else '폐기' end action_name
    from public.inventory_events e
    where e.ingredient_id=p_ingredient and e.reverses_event_id is null and e.sales_item_id is null
      and ((e.type='inbound' and e.count_delta>0)
        or (e.type='stocktake' and e.count_delta<0)
        or (e.type='discard' and not e.waste and e.count_delta<0))
  ), latest as (
    select distinct on (action_name) * from originals order by action_name,seq desc
  )
  select e.id,e.action_name,
    public.store_local_date(e.store_id,e.occurred_at)
      between public.store_local_date(e.store_id)-6 and public.store_local_date(e.store_id)
    and not exists(select 1 from public.inventory_events r where r.reverses_event_id=e.id)
    and not exists(select 1 from public.stock_event_reversal_receipts r where r.event_id=e.id)
    and not exists(select 1 from public.inventory_count_lines l where l.event_id=e.id)
    and e.absorbed_by_count_batch_id is null
    and not exists(
      select 1 from public.inventory_count_lines l
      join public.inventory_count_batches b on b.id=l.batch_id
      where l.ingredient_id=e.ingredient_id and e.seq<=b.event_sequence_high_watermark)
    and (e.type<>'inbound' or exists(
      select 1 from public.order_records o where o.id=e.order_record_id and o.received_qty>0
        and (select count(*) from public.inventory_events i
             where i.order_record_id=o.id and i.type='inbound'
               and not exists(select 1 from public.inventory_events r where r.reverses_event_id=i.id)
               and not exists(select 1 from public.stock_event_reversal_receipts receipt
                              where receipt.event_id=i.id))=1))
  from latest e;
$fn$;

create or replace function public.lock_store_write_scope(p_store uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  perform public.lock_business_scope(p_store);
  insert into public.inventory_store_write_state(store_id) values (p_store)
  on conflict (store_id) do nothing;
  perform 1 from public.inventory_store_write_state where store_id=p_store for update;
end $fn$;

create or replace function public.sales_recommended_date(
  p_store uuid, p_at timestamptz default clock_timestamp()
) returns date language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_local date;
  v_hours jsonb;
  v_open timestamptz;
  v_live public.business_days;
begin
  v_live:=public.current_business_day(p_store);
  if v_live.id is not null then return v_live.business_date; end if;
  v_local := public.store_local_date(p_store,p_at);
  v_hours := public.store_hours_on(p_store,v_local);
  if coalesce((v_hours->>'closed')::boolean,false) then return v_local-1; end if;
  v_open := public.scheduled_open_at(p_store,v_local);
  if v_open is not null and p_at < v_open then return v_local-1; end if;
  return v_local;
end $fn$;

create or replace function public.expire_inventory_count_session(p_store uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  update public.inventory_count_sessions
     set status='expired',invalidation_reason='SESSION_EXPIRED'
   where store_id=p_store and status='active' and expires_at <= clock_timestamp();
end $fn$;

create or replace function public.block_inventory_write_during_count()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  perform public.lock_store_write_scope(new.store_id);
  perform public.expire_inventory_count_session(new.store_id);
  if current_setting('costkeep.inventory_count_commit',true) is distinct from 'on'
     and exists(select 1 from public.sales_lifecycle_cutover_state
       where store_id=new.store_id and phase in ('freezing','blocked')) then
    raise exception '매출 전환 확인 중에는 재고를 변경할 수 없어요'
      using errcode='45044',detail='SALES_CUTOVER_WRITE_FROZEN';
  end if;
  if current_setting('costkeep.inventory_count_commit',true) is distinct from 'on'
     and exists (select 1 from public.inventory_count_sessions
                 where store_id=new.store_id and status='active') then
    raise exception '재고 실사 중에는 재고를 변경할 수 없어요'
      using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  if new.reverses_event_id is not null and exists (
    select 1 from public.inventory_events original
     where original.id=new.reverses_event_id
       and (original.stock_effect<>'normal'
         or exists(select 1 from public.inventory_count_lines own_count where own_count.event_id=original.id)
         or exists(select 1 from public.inventory_count_lines counted
           join public.inventory_count_batches batch on batch.id=counted.batch_id
            where counted.ingredient_id=original.ingredient_id
              and original.seq<=batch.event_sequence_high_watermark))) then
    raise exception '재고 실사에 포함된 내역은 취소할 수 없어요. 현재 재고를 새로 조정해 주세요'
      using errcode='45035',detail='EVENT_ABSORBED_BY_COUNT';
  end if;
  insert into public.inventory_store_write_state(store_id,revision,updated_at)
  values (new.store_id,1,clock_timestamp())
  on conflict (store_id) do update
    set revision=public.inventory_store_write_state.revision+1,
        updated_at=clock_timestamp();
  return new;
end $fn$;

create trigger inventory_events_count_guard
before insert on public.inventory_events
for each row execute function public.block_inventory_write_during_count();

create or replace function public.bump_inventory_scope_for_ingredient()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_store uuid:=coalesce(new.store_id,old.store_id);
begin
  perform public.lock_store_write_scope(v_store);
  insert into public.inventory_store_write_state(store_id,revision,updated_at)
  values (v_store,1,clock_timestamp())
  on conflict (store_id) do update
    set revision=public.inventory_store_write_state.revision+1,updated_at=clock_timestamp();
  if tg_op='DELETE' then return old; end if;
  return new;
end $fn$;
create trigger ingredients_inventory_scope_revision
after insert or update of active or delete on public.ingredients
for each row execute function public.bump_inventory_scope_for_ingredient();

create or replace function public.begin_inventory_count(p_store uuid,p_session uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_date date;
  v_from date;
  v_targets uuid[];
  v_stock jsonb;
  v_target_details jsonb;
  v_revision bigint;
  v_seq bigint;
  v_existing public.inventory_count_sessions;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  perform public.expire_inventory_count_session(p_store);
  perform public.expire_sales_drafts(p_store);

  select * into v_existing from public.inventory_count_sessions where id=p_session;
  if found then
    if v_existing.store_id <> p_store then
      raise exception '다른 매장의 실사 세션이에요' using errcode='42501',detail='COUNT_SESSION_SCOPE';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'ingredient_id',i.id,'name',i.name,'base_unit',i.base_unit,
      'stock_total',coalesce((v_existing.stock_state->i.id::text->>'stock_total')::numeric,0))
      order by i.name,i.id),'[]'::jsonb)
      into v_target_details
      from unnest(v_existing.target_ingredient_ids) target_id
      join public.ingredients i on i.id=target_id;
    return jsonb_build_object('session_id',v_existing.id,'status',v_existing.status,
      'cutoff_business_date',v_existing.cutoff_business_date,
      'target_ingredient_ids',to_jsonb(v_existing.target_ingredient_ids),
      'targets',v_target_details,
      'observation_started_at',v_existing.observation_started_at,'expires_at',v_existing.expires_at);
  end if;

  select * into v_existing from public.inventory_count_sessions
   where store_id=p_store and status='active' order by observation_started_at desc limit 1;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'ingredient_id',i.id,'name',i.name,'base_unit',i.base_unit,
      'stock_total',coalesce((v_existing.stock_state->i.id::text->>'stock_total')::numeric,0))
      order by i.name,i.id),'[]'::jsonb)
      into v_target_details
      from unnest(v_existing.target_ingredient_ids) target_id
      join public.ingredients i on i.id=target_id;
    return jsonb_build_object('session_id',v_existing.id,'status',v_existing.status,
      'cutoff_business_date',v_existing.cutoff_business_date,
      'target_ingredient_ids',to_jsonb(v_existing.target_ingredient_ids),
      'targets',v_target_details,'recovered',true,
      'observation_started_at',v_existing.observation_started_at,'expires_at',v_existing.expires_at);
  end if;
  if exists (select 1 from public.sales_day_drafts where store_id=p_store
             and status='editing'
             and business_date between greatest(
               (select inventory_cutoff_business_date+1 from public.stores where id=p_store),
               public.sales_editable_from(p_store))
             and coalesce((select inventory_reference_sales_date
               from public.sales_lifecycle_cutover_state where store_id=p_store and phase='freezing'),
               public.sales_recommended_date(p_store))) then
    raise exception '작성 중인 매출을 먼저 완료하거나 폐기해 주세요'
      using errcode='45028',detail='SALES_DRAFT_ACTIVE';
  end if;

  select case when c.phase='freezing' then c.inventory_reference_sales_date end
    into v_date from public.sales_lifecycle_cutover_state c where c.store_id=p_store;
  v_date := coalesce(v_date,public.sales_recommended_date(p_store));
  if not exists (
    select 1 from public.business_days where store_id=p_store and business_date=v_date and status='closed'
    union all
    select 1 from public.sales_calendar_days where store_id=p_store and business_date=v_date and day_kind='closed'
  ) then
    raise exception '추천 날짜의 매출 작성 또는 휴무 확정을 먼저 마쳐 주세요'
      using errcode='45029',detail='COUNT_DATE_NOT_RESOLVED';
  end if;

  select greatest(coalesce(inventory_cutoff_business_date+1,public.sales_editable_from(p_store)),
                  public.sales_editable_from(p_store))
    into v_from from public.stores where id=p_store;
  if v_from<=v_date then
    perform public.ensure_sales_calendar_range(p_store,v_from,v_date);
  end if;
  if v_from<=v_date and exists (
    select 1 from public.sales_calendar_days c
     where c.store_id=p_store and c.business_date between v_from and v_date
       and c.day_kind<>'closed'
       and not exists(select 1 from public.sales_day_heads h
         where h.store_id=p_store and h.business_date=c.business_date)
       and not exists(select 1 from public.business_days b
         where b.store_id=p_store and b.business_date=c.business_date and b.status='closed')
  ) then
    raise exception '재고 실사 전 편집 가능한 모든 영업일의 매출 작성 또는 휴무 확정을 마쳐 주세요'
      using errcode='45029',detail='COUNT_RANGE_NOT_RESOLVED';
  end if;

  select coalesce(array_agg(i.id order by i.id),'{}'::uuid[]),
         coalesce(jsonb_object_agg(i.id::text,jsonb_build_object(
           'stock_total',coalesce(s.stock_total,0),'updated_at',s.updated_at)),'{}'::jsonb)
    into v_targets,v_stock
    from public.ingredients i left join public.inventory_states s on s.ingredient_id=i.id
   where i.store_id=p_store and (
     coalesce(i.active,true)
     or exists(select 1 from public.pending_sales_inventory_resolution pending
       where pending.store_id=p_store and pending.ingredient_id=i.id
         and (pending.status='pending'
           or (pending.status='abandoned' and pending.resolved_by_count_batch_id is null)))
     or exists(select 1 from public.inventory_recount_targets target
       where target.store_id=p_store and target.ingredient_id=i.id and target.status='pending')
   );

  select revision into v_revision from public.inventory_store_write_state where store_id=p_store;
  select coalesce(max(seq),0) into v_seq from public.inventory_events where store_id=p_store;

  insert into public.inventory_count_sessions(
    id,store_id,status,observation_started_at,expires_at,cutoff_business_date,
    target_ingredient_ids,stock_state,store_write_revision,event_sequence_high_watermark,created_by)
  values (p_session,p_store,'active',clock_timestamp(),clock_timestamp()+interval '4 hours',v_date,
    v_targets,v_stock,v_revision,v_seq,auth.uid());

  select coalesce(jsonb_agg(jsonb_build_object(
    'ingredient_id',i.id,'name',i.name,'base_unit',i.base_unit,
    'stock_total',coalesce((v_stock->i.id::text->>'stock_total')::numeric,0))
    order by i.name,i.id),'[]'::jsonb)
    into v_target_details
    from unnest(v_targets) target_id
    join public.ingredients i on i.id=target_id;

  return jsonb_build_object('session_id',p_session,'status','active','cutoff_business_date',v_date,
    'target_ingredient_ids',to_jsonb(v_targets),'stock_state',v_stock,
    'targets',v_target_details,
    'observation_started_at',clock_timestamp(),'expires_at',clock_timestamp()+interval '4 hours');
end $fn$;

create or replace function public.commit_inventory_count_batch(
  p_store uuid,p_session uuid,p_counts jsonb,p_request_key uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_session public.inventory_count_sessions;
  v_batch public.inventory_count_batches;
  v_hash text := encode(extensions.digest(convert_to(coalesce(p_counts,'[]'::jsonb)::text,'UTF8'),'sha256'),'hex');
  v_ids uuid[];
  v_seq bigint;
  v_revision bigint;
  v_current_targets uuid[];
  v_current_stock jsonb;
  v_row jsonb;
  v_ing uuid;
  v_qty numeric;
  v_before numeric;
  v_event uuid;
  v_rows integer;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);

  select * into v_batch from public.inventory_count_batches
   where store_id=p_store and request_key=p_request_key;
  if found then
    if v_batch.payload_hash <> v_hash then
      raise exception '같은 요청 키의 실사 내용이 달라요' using errcode='45021',detail='IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return jsonb_build_object('batch_id',v_batch.id,'duplicate',true,
      'cutoff_business_date',v_batch.cutoff_business_date,'counted_at',v_batch.counted_at);
  end if;

  select * into v_session from public.inventory_count_sessions where id=p_session for update;
  if not found or v_session.store_id<>p_store then
    raise exception '재고 실사 세션을 찾을 수 없어요' using errcode='P0002',detail='COUNT_SESSION_NOT_FOUND';
  end if;
  if v_session.status<>'active' or v_session.expires_at<=clock_timestamp() then
    update public.inventory_count_sessions set status='expired',invalidation_reason='SESSION_EXPIRED'
     where id=p_session and status='active';
    raise exception '재고 실사 세션이 만료됐어요' using errcode='45030',detail='COUNT_SESSION_EXPIRED';
  end if;

  -- 시작 뒤 휴무/영업일 분류나 매출 상태가 달라져도 오래된 관측 토큰으로
  -- 컷오프를 게시하지 않는다. 분류 RPC도 활성 실사 중에는 변경을 막지만,
  -- 완료 시점에 동일 전제를 다시 확인해 모든 쓰기 경로를 닫는다.
  if not exists (
    select 1 from public.business_days where store_id=p_store
      and business_date=v_session.cutoff_business_date and status='closed'
    union all
    select 1 from public.sales_calendar_days where store_id=p_store
      and business_date=v_session.cutoff_business_date and day_kind='closed'
  ) then
    update public.inventory_count_sessions set status='invalidated',
      invalidation_reason='COUNT_DATE_NOT_RESOLVED' where id=p_session;
    return jsonb_build_object('session_id',p_session,'status','invalidated',
      'reason','COUNT_DATE_NOT_RESOLVED');
  end if;

  select array_agg((x->>'ingredient_id')::uuid order by (x->>'ingredient_id')::uuid)
    into v_ids from jsonb_array_elements(coalesce(p_counts,'[]'::jsonb)) x;
  if coalesce(cardinality(v_ids),0) <> jsonb_array_length(coalesce(p_counts,'[]'::jsonb))
     or v_ids is distinct from (select array_agg(x order by x) from unnest(v_session.target_ingredient_ids) x) then
    raise exception '모든 대상 식재료를 한 번씩 입력해 주세요' using errcode='45031',detail='COUNT_TARGET_MISMATCH';
  end if;

  select revision into v_revision from public.inventory_store_write_state where store_id=p_store;
  select coalesce(max(seq),0) into v_seq from public.inventory_events where store_id=p_store;
  select coalesce(array_agg(i.id order by i.id),'{}'::uuid[]),
         coalesce(jsonb_object_agg(i.id::text,jsonb_build_object(
           'stock_total',coalesce(s.stock_total,0),'updated_at',s.updated_at)),'{}'::jsonb)
    into v_current_targets,v_current_stock
    from public.ingredients i left join public.inventory_states s on s.ingredient_id=i.id
   where i.store_id=p_store and (
     coalesce(i.active,true)
     or exists(select 1 from public.pending_sales_inventory_resolution pending
       where pending.store_id=p_store and pending.ingredient_id=i.id
         and (pending.status='pending'
           or (pending.status='abandoned' and pending.resolved_by_count_batch_id is null)))
     or exists(select 1 from public.inventory_recount_targets target
       where target.store_id=p_store and target.ingredient_id=i.id and target.status='pending')
   );
  if v_revision<>v_session.store_write_revision or v_seq<>v_session.event_sequence_high_watermark
     or v_current_targets is distinct from v_session.target_ingredient_ids
     or v_current_stock is distinct from v_session.stock_state then
    update public.inventory_count_sessions set status='invalidated',invalidation_reason='INVENTORY_CHANGED'
     where id=p_session;
    return jsonb_build_object('session_id',p_session,'status','invalidated','reason','INVENTORY_CHANGED');
  end if;

  insert into public.inventory_count_batches(session_id,store_id,counted_at,observation_started_at,
    cutoff_business_date,event_sequence_high_watermark,request_key,payload_hash,created_by)
  values (p_session,p_store,clock_timestamp(),v_session.observation_started_at,
    v_session.cutoff_business_date,v_session.event_sequence_high_watermark,p_request_key,v_hash,auth.uid())
  returning * into v_batch;

  update public.sales_inventory_delta_components c
     set stock_effect='absorbed',absorbed_by_count_batch_id=v_batch.id
   where c.store_id=p_store and c.stock_effect='normal'
     and c.source_event_sequence<=v_session.event_sequence_high_watermark
     and c.ingredient_id=any(v_session.target_ingredient_ids);

  perform set_config('costkeep.inventory_count_commit','on',true);
  for v_row in select * from jsonb_array_elements(p_counts) loop
    v_ing := (v_row->>'ingredient_id')::uuid;
    v_qty := (v_row->>'counted_quantity')::numeric;
    if v_qty<0 then raise exception '재고 수량은 0 이상이어야 해요' using errcode='22000'; end if;
    select coalesce(stock_total,0) into v_before from public.inventory_states where ingredient_id=v_ing for update;
    if not found then v_before:=0; end if;
    insert into public.inventory_states(ingredient_id,store_id,stock_total)
    values (v_ing,p_store,v_qty)
    on conflict (ingredient_id) do update set stock_total=excluded.stock_total,updated_at=clock_timestamp();
    insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
      stock_effect,note,occurred_at,unit_normalized)
    values (p_store,v_ing,'stocktake',v_qty-v_before,v_qty-v_before,'normal',
      '전 매장 재고 실사',v_batch.counted_at,true) returning id into v_event;
    insert into public.inventory_count_lines(batch_id,ingredient_id,counted_quantity,before_quantity,event_id)
    values (v_batch.id,v_ing,v_qty,v_before,v_event);
    perform public.refresh_order_candidate(v_ing);
  end loop;
  -- 이 플래그는 같은 트랜잭션의 후속 일반 재고 기록까지 실사 내부 쓰기로
  -- 오인하지 않도록 실사 원장 생성 직후 반드시 되돌린다.
  perform set_config('costkeep.inventory_count_commit','off',true);

  update public.inventory_count_sessions set status='completed',completed_at=v_batch.counted_at where id=p_session;
  update public.pending_sales_inventory_resolution
     set status='resolved',resolved_by_count_batch_id=v_batch.id
   where store_id=p_store and status='pending' and created_at<=v_session.observation_started_at
     and exists(select 1 from public.inventory_count_lines l
       where l.batch_id=v_batch.id and l.ingredient_id=pending_sales_inventory_resolution.ingredient_id);
  -- 폐기된 초안의 행은 감사 상태(abandoned)를 보존하되, 실측으로 해소됐다는
  -- batch 연결은 남긴다. 그렇지 않으면 비활성 재료가 실사 대상에서 사라질 수 있다.
  update public.pending_sales_inventory_resolution
     set resolved_by_count_batch_id=v_batch.id
   where store_id=p_store and status='abandoned' and resolved_by_count_batch_id is null
     and created_at<=v_session.observation_started_at
     and exists(select 1 from public.inventory_count_lines l
       where l.batch_id=v_batch.id and l.ingredient_id=pending_sales_inventory_resolution.ingredient_id);
  update public.inventory_recount_targets
     set status='resolved',resolved_by_count_batch_id=v_batch.id,resolved_at=v_batch.counted_at
   where store_id=p_store and status='pending' and created_at<=v_session.observation_started_at
     and exists(select 1 from public.inventory_count_lines l
       where l.batch_id=v_batch.id and l.ingredient_id=inventory_recount_targets.ingredient_id);
  update public.stores set inventory_cutoff_business_date=greatest(inventory_cutoff_business_date,v_session.cutoff_business_date),
    inventory_recount_required=exists(select 1 from public.pending_sales_inventory_resolution p
      where p.store_id=p_store and (p.status='pending'
        or (p.status='abandoned' and p.resolved_by_count_batch_id is null)))
      or exists(select 1 from public.inventory_recount_targets t
        where t.store_id=p_store and t.status='pending') where id=p_store;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception '매장 재고 실사 기준을 저장하지 못했어요'
      using errcode='42501',detail='COUNT_STORE_STATE_NOT_UPDATED';
  end if;

  return jsonb_build_object('batch_id',v_batch.id,'duplicate',false,
    'cutoff_business_date',v_batch.cutoff_business_date,'counted_at',v_batch.counted_at);
end $fn$;

create or replace function public.cancel_inventory_count(p_store uuid,p_session uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v public.inventory_count_sessions;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  update public.inventory_count_sessions set status='cancelled',cancelled_at=clock_timestamp()
   where id=p_session and store_id=p_store and status='active' returning * into v;
  if not found then raise exception '진행 중인 실사 세션이 아니에요' using errcode='45032',detail='COUNT_SESSION_NOT_ACTIVE'; end if;
  return jsonb_build_object('session_id',v.id,'status',v.status);
end $fn$;

grant create on schema public to costkeep_rpc_executor;
do $m$
declare t text;
begin
  foreach t in array array['inventory_store_write_state','inventory_count_sessions','inventory_count_batches',
    'inventory_count_lines','pending_sales_inventory_resolution','sales_inventory_delta_components',
    'sales_inventory_component_offsets','inventory_recount_targets'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I owner to costkeep_rpc_executor',t);
  end loop;
  alter function public.inventory_write_state_seed_store() owner to costkeep_rpc_executor;
  alter function public.lock_store_write_scope(uuid) owner to costkeep_rpc_executor;
  alter function public.sales_recommended_date(uuid,timestamptz) owner to costkeep_rpc_executor;
  alter function public.expire_inventory_count_session(uuid) owner to costkeep_rpc_executor;
  alter function public.block_inventory_write_during_count() owner to costkeep_rpc_executor;
  alter function public.bump_inventory_scope_for_ingredient() owner to costkeep_rpc_executor;
  alter function public.stock_revert_candidates(uuid) owner to costkeep_rpc_executor;
  alter function public.begin_inventory_count(uuid,uuid) owner to costkeep_rpc_executor;
  alter function public.commit_inventory_count_batch(uuid,uuid,jsonb,uuid) owner to costkeep_rpc_executor;
  alter function public.cancel_inventory_count(uuid,uuid) owner to costkeep_rpc_executor;
end $m$;
revoke create on schema public from costkeep_rpc_executor;

create policy inventory_count_sessions_read on public.inventory_count_sessions for select to authenticated
 using (exists(select 1 from public.stores own_store where own_store.id=inventory_count_sessions.store_id
   and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy inventory_count_batches_read on public.inventory_count_batches for select to authenticated
 using (exists(select 1 from public.stores own_store where own_store.id=inventory_count_batches.store_id
   and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy inventory_count_lines_read on public.inventory_count_lines for select to authenticated
 using (exists(select 1 from public.inventory_count_batches own_batch join public.stores own_store
   on own_store.id=own_batch.store_id where own_batch.id=inventory_count_lines.batch_id
   and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy pending_sales_inventory_resolution_read on public.pending_sales_inventory_resolution for select to authenticated
 using (exists(select 1 from public.stores own_store where own_store.id=pending_sales_inventory_resolution.store_id
   and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_inventory_delta_components_read on public.sales_inventory_delta_components for select to authenticated
 using (exists(select 1 from public.stores own_store where own_store.id=sales_inventory_delta_components.store_id
   and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy sales_inventory_component_offsets_read on public.sales_inventory_component_offsets for select to authenticated
 using (exists(select 1 from public.stores own_store where own_store.id=sales_inventory_component_offsets.store_id
   and own_store.owner_id=auth.uid() and own_store.archived_at is null));
create policy inventory_store_write_state_read on public.inventory_store_write_state for select to authenticated
 using (exists(select 1 from public.stores own_store where own_store.id=inventory_store_write_state.store_id
   and own_store.owner_id=auth.uid() and own_store.archived_at is null));

grant select on public.inventory_store_write_state,public.inventory_count_sessions,
  public.inventory_count_batches,public.inventory_count_lines,public.pending_sales_inventory_resolution,
  public.sales_inventory_delta_components,public.sales_inventory_component_offsets to authenticated;
revoke insert,update,delete,truncate on public.inventory_store_write_state,public.inventory_count_sessions,
  public.inventory_count_batches,public.inventory_count_lines,public.pending_sales_inventory_resolution,
  public.sales_inventory_delta_components,public.sales_inventory_component_offsets from anon,authenticated;
grant update(inventory_cutoff_business_date,inventory_recount_required)
  on public.stores to costkeep_rpc_executor;

revoke all on function public.lock_store_write_scope(uuid),public.sales_recommended_date(uuid,timestamptz),
  public.expire_inventory_count_session(uuid),public.block_inventory_write_during_count() from public,anon,authenticated;
revoke all on function public.bump_inventory_scope_for_ingredient() from public,anon,authenticated;
revoke all on function public.stock_revert_candidates(uuid) from public,anon;
grant execute on function public.stock_revert_candidates(uuid) to authenticated,service_role;
grant execute on function public.begin_inventory_count(uuid,uuid),
  public.commit_inventory_count_batch(uuid,uuid,jsonb,uuid),public.cancel_inventory_count(uuid,uuid) to authenticated;

select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
