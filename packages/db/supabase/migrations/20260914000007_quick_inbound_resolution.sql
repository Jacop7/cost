begin;

-- A lost response must not trap the next inbound behind a permanent client journal.
-- Resolving an absent request seals its key so a delayed network request cannot
-- arrive after resolution and create a second inbound. No inventory is adjusted.
create table public.quick_inbound_closed_requests (
  store_id uuid not null references public.stores(id),
  request_key text not null check (length(request_key) between 1 and 256),
  ingredient_id uuid not null references public.ingredients(id),
  actor_id uuid not null,
  closed_at timestamptz not null default now(),
  primary key(store_id, request_key)
);
alter table public.quick_inbound_closed_requests enable row level security;
create policy quick_inbound_closed_read on public.quick_inbound_closed_requests for select
  to costkeep_rpc_executor using (exists(select 1 from public.stores s
    where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
create policy quick_inbound_closed_insert on public.quick_inbound_closed_requests for insert
  to costkeep_rpc_executor with check (actor_id=auth.uid() and exists(select 1 from public.stores s
    where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
revoke all on public.quick_inbound_closed_requests from public,anon,authenticated,service_role;
grant select,insert on public.quick_inbound_closed_requests to costkeep_rpc_executor;

create function public.resolve_quick_inbound(p_store uuid, p_ingredient uuid, p_request_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ev public.inventory_events; closed_ingredient uuid;
begin
  perform public.assert_my_store(p_store);
  if p_request_key is null or length(p_request_key) not between 1 and 256 then
    raise exception '입고 요청 정보를 확인해 주세요.' using errcode='22000';
  end if;
  perform public.lock_business_scope(p_store);
  perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':quick:' || p_request_key,0));
  if not exists(select 1 from public.ingredients where id=p_ingredient and store_id=p_store) then
    raise exception '재료를 찾을 수 없어요.' using errcode='P0002';
  end if;
  select * into ev from public.inventory_events
    where store_id=p_store and idempotency_key=p_request_key limit 1;
  if found then
    if ev.ingredient_id is distinct from p_ingredient or ev.order_record_id is null then
      raise exception '입고 요청의 재료가 일치하지 않아요.' using errcode='22000';
    end if;
    return jsonb_build_object('status','recorded','order_id',ev.order_record_id);
  end if;
  select ingredient_id into closed_ingredient from public.quick_inbound_closed_requests
    where store_id=p_store and request_key=p_request_key;
  if found then
    if closed_ingredient is distinct from p_ingredient then
      raise exception '입고 요청의 재료가 일치하지 않아요.' using errcode='22000';
    end if;
  else
    insert into public.quick_inbound_closed_requests(store_id,request_key,ingredient_id,actor_id)
      values(p_store,p_request_key,p_ingredient,auth.uid());
  end if;
  return jsonb_build_object('status','not_recorded');
end $$;

-- Preserve the deployed writer verbatim except for the closed-key check. Assert
-- the exact anchor once so an unexpected predecessor cannot silently migrate.
do $migration$
declare signature regprocedure:='public.quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,date,text)'::regprocedure;
  definition text; anchor text:='perform pg_advisory_xact_lock(hashtextextended(p_store::text || '':quick:'' || p_idempotency_key,0));';
begin
  definition:=pg_get_functiondef(signature);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
    raise exception 'quick_inbound lock anchor must occur exactly once';
  end if;
  execute replace(definition,anchor,anchor || E'\n    if exists(select 1 from public.quick_inbound_closed_requests where store_id=p_store and request_key=p_idempotency_key) then\n      raise exception ''확인 완료된 이전 요청입니다. 새 입고로 등록해 주세요.'' using errcode=''45010'';\n    end if;');
end $migration$;

grant create on schema public to costkeep_rpc_executor;
alter function public.resolve_quick_inbound(uuid,uuid,text) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.resolve_quick_inbound(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.resolve_quick_inbound(uuid,uuid,text) to authenticated;
commit;
