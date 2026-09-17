begin;

-- Result lookup for an existing order's E1 is separate from quick_inbound's E7+E1.
create table public.order_inbound_closed_requests (
  store_id uuid not null references public.stores(id),
  request_key text not null check (length(request_key) between 1 and 256),
  order_id uuid not null references public.order_records(id),
  actor_id uuid not null,
  closed_at timestamptz not null default now(),
  primary key(store_id, request_key)
);
alter table public.order_inbound_closed_requests enable row level security;
create policy order_inbound_closed_read on public.order_inbound_closed_requests for select
  to costkeep_rpc_executor using (exists(select 1 from public.stores s
    where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
create policy order_inbound_closed_insert on public.order_inbound_closed_requests for insert
  to costkeep_rpc_executor with check (actor_id=auth.uid() and exists(select 1 from public.stores s
    where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
revoke all on public.order_inbound_closed_requests from public,anon,authenticated,service_role;
grant select,insert on public.order_inbound_closed_requests to costkeep_rpc_executor;

create function public.resolve_order_inbound(p_store uuid,p_order uuid,p_request_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ev public.inventory_events; closed_order uuid;
begin
  perform public.assert_my_store(p_store);
  if p_request_key is null or length(p_request_key) not between 1 and 256 then
    raise exception '입고 요청 정보를 확인해 주세요.' using errcode='22000';
  end if;
  -- Same business -> order -> key lock order as E1; absence is sealed atomically.
  perform public.lock_business_scope(p_store);
  perform 1 from public.order_records where id=p_order and store_id=p_store for update;
  if not found then raise exception '발주를 찾을 수 없어요.' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':order-inbound:' || p_request_key,0));
  select * into ev from public.inventory_events where store_id=p_store and idempotency_key=p_request_key limit 1;
  if found then
    if ev.order_record_id is distinct from p_order or ev.type::text <> 'inbound' then
      raise exception '입고 요청의 발주가 일치하지 않아요.' using errcode='22000';
    end if;
    return jsonb_build_object('status','recorded','order_id',p_order);
  end if;
  select order_id into closed_order from public.order_inbound_closed_requests where store_id=p_store and request_key=p_request_key;
  if found then
    if closed_order is distinct from p_order then
      raise exception '입고 요청의 발주가 일치하지 않아요.' using errcode='22000';
    end if;
  else
    insert into public.order_inbound_closed_requests(store_id,request_key,order_id,actor_id)
      values(p_store,p_request_key,p_order,auth.uid());
  end if;
  return jsonb_build_object('status','not_recorded','order_id',p_order);
end $$;

-- Retain existing quantity cap, financial propagation and history verbatim.
do $migration$
declare definition text;
  anchor text:='if not found then raise exception ''order % not found'', p_order; end if;';
  guard text:=$guard$
  perform public.assert_my_store(o.store_id);
  if p_idempotency_key is not null then
    if length(p_idempotency_key) not between 1 and 256 then
      raise exception '입고 요청 정보를 확인해 주세요.' using errcode='22000';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(o.store_id::text || ':order-inbound:' || p_idempotency_key,0));
    if exists(select 1 from public.order_inbound_closed_requests where store_id=o.store_id and request_key=p_idempotency_key) then
      raise exception '확인 완료된 이전 요청입니다. 새 입고로 등록해 주세요.' using errcode='45010';
    end if;
    if exists(select 1 from public.inventory_events where store_id=o.store_id and idempotency_key=p_idempotency_key
      and (order_record_id is distinct from p_order or type::text <> 'inbound')) then
      raise exception '입고 요청의 발주가 일치하지 않아요.' using errcode='22000';
    end if;
  end if;
$guard$;
begin
  definition:=pg_get_functiondef('public.e1_confirm_inbound(uuid,numeric,text,date)'::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
    raise exception 'e1_confirm_inbound order anchor must occur exactly once';
  end if;
  execute replace(definition,anchor,anchor || E'\n' || guard);
end $migration$;

grant create on schema public to costkeep_rpc_executor;
alter function public.resolve_order_inbound(uuid,uuid,text) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.resolve_order_inbound(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.resolve_order_inbound(uuid,uuid,text) to authenticated;
commit;
