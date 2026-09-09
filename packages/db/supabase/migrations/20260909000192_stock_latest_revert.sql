-- PRT-092/093: same-type latest original event, store-local last 7 dates,
-- no promotion of earlier events after reversal. Existing ledgers remain append-only.
begin;

create table public.stock_event_reversal_receipts (
  event_id uuid primary key references public.inventory_events(id),
  store_id uuid not null references public.stores(id),
  reversal_event_id uuid not null unique references public.inventory_events(id),
  created_at timestamptz not null default now()
);
alter table public.stock_event_reversal_receipts enable row level security;
create policy reversal_receipts_read on public.stock_event_reversal_receipts for select
  using (store_id in (select id from public.stores where owner_id=auth.uid() and archived_at is null));
create policy reversal_receipts_insert on public.stock_event_reversal_receipts for insert
  with check (store_id in (select id from public.stores where owner_id=auth.uid() and archived_at is null));
revoke all on public.stock_event_reversal_receipts from public, anon, authenticated;
grant select, insert on public.stock_event_reversal_receipts to margincook_rpc_executor;

create function public.stock_revert_candidates(p_ingredient uuid)
returns table(event_id uuid, action text, eligible boolean)
language sql stable security definer set search_path=public,pg_temp as $fn$
  with originals as (
    select e.*, case when e.type='inbound' then '입고'
      when e.type='stocktake' then '차감' else '폐기' end as action_name
    from inventory_events e where e.ingredient_id=p_ingredient
      and e.reverses_event_id is null and e.sales_item_id is null
      and ((e.type='inbound' and e.count_delta>0)
        or (e.type='stocktake' and e.count_delta<0)
        or (e.type='discard' and not e.waste and e.count_delta<0))
  ), latest as (
    select distinct on (action_name) * from originals order by action_name,seq desc
  )
  select e.id,e.action_name,
    store_local_date(e.store_id,e.occurred_at) between store_local_date(e.store_id)-6 and store_local_date(e.store_id)
    and not exists(select 1 from inventory_events r where r.reverses_event_id=e.id)
    and not exists(select 1 from stock_event_reversal_receipts r where r.event_id=e.id)
    and (e.type<>'inbound' or exists (
      select 1 from order_records o where o.id=e.order_record_id and o.received_qty>0
        -- E11 cancels an order's entire receipt. Do not silently cancel multiple events.
        and (select count(*) from inventory_events i where i.order_record_id=o.id and i.type='inbound')=1
    ))
  from latest e;
$fn$;

create function public.revert_latest_stock_event(p_event uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  ev inventory_events%rowtype;
  v_action text;
  v_reversal uuid;
  v_seq bigint;
  v_result jsonb;
begin
  select * into ev from inventory_events where id=p_event;
  if not found then raise exception '기록을 찾을 수 없습니다' using errcode='P0002'; end if;
  -- Match E1/E11 lock order: order first, then inventory state. E2/E5 lock state.
  if ev.type='inbound' then
    perform 1 from order_records where id=ev.order_record_id for update;
  end if;
  perform 1 from inventory_states where ingredient_id=ev.ingredient_id for update;
  if not found then raise exception '재고 상태를 찾을 수 없습니다' using errcode='P0002'; end if;
  select reversal_event_id into v_reversal from stock_event_reversal_receipts where event_id=p_event;
  if found then return jsonb_build_object('event_id',p_event,'already_reverted',true); end if;
  select action into v_action from stock_revert_candidates(ev.ingredient_id) where event_id=p_event and eligible;
  if not found then
    raise exception '최근 7일 이내의 유형별 최신 기록만 취소할 수 있습니다. 내역을 새로 확인해 주세요.' using errcode='22000';
  end if;
  select coalesce(max(seq),0) into v_seq from inventory_events where ingredient_id=ev.ingredient_id;
  if ev.type='inbound' then
    v_result:=e11_inbound_reverted(ev.order_record_id,'입고 취소');
    if coalesce((v_result->>'nothing_to_revert')::boolean,false) then
      raise exception '이미 취소된 입고입니다' using errcode='22000';
    end if;
    select id into v_reversal from inventory_events where ingredient_id=ev.ingredient_id
      and order_record_id=ev.order_record_id and type='adjust' and seq>v_seq order by seq desc limit 1;
  elsif ev.type='discard' then
    perform e2_discard_reverted(p_event,'폐기 취소');
    select id into v_reversal from inventory_events where reverses_event_id=p_event;
  else
    -- Restore only this deduction's delta, never overwrite today's stock with an old balance.
    perform restore_stock(ev.ingredient_id,-ev.count_delta);
    insert into inventory_events(store_id,ingredient_id,type,count_delta,note,reverses_event_id,unit_normalized)
      values(ev.store_id,ev.ingredient_id,'adjust',-ev.count_delta,'차감 취소',p_event,true)
      returning id into v_reversal;
    perform refresh_order_candidate(ev.ingredient_id);
  end if;
  if v_reversal is null then raise exception '취소 원장 검증 실패' using errcode='22000'; end if;
  insert into stock_event_reversal_receipts(event_id,store_id,reversal_event_id)
    values(p_event,ev.store_id,v_reversal);
  return jsonb_build_object('event_id',p_event,'already_reverted',false,'action',v_action);
end;
$fn$;

grant create on schema public to margincook_rpc_executor;
alter function public.stock_revert_candidates(uuid) owner to margincook_rpc_executor;
alter function public.revert_latest_stock_event(uuid) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.stock_revert_candidates(uuid), public.revert_latest_stock_event(uuid) from public,anon;
grant execute on function public.stock_revert_candidates(uuid), public.revert_latest_stock_event(uuid) to authenticated,service_role;

-- Preserve stock_history's public signature; E11's order-level compensation is
-- linked by the append-only receipt rather than updating the old ledger row.
do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('public.stock_history(uuid,date,date)'::regprocedure);
  if position('exists (select 1 from inventory_events r where r.reverses_event_id = ev.id)' in definition)=0 then
    raise exception 'stock_history reversal expression changed';
  end if;
  definition:=replace(definition,
    'exists (select 1 from inventory_events r where r.reverses_event_id = ev.id)',
    '(exists (select 1 from inventory_events r where r.reverses_event_id = ev.id) or exists (select 1 from stock_event_reversal_receipts receipt where receipt.event_id=ev.id))');
  execute definition;
end;
$patch$;
notify pgrst,'reload schema';
commit;
