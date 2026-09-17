begin;

create table public.stock_quantity_closed_requests (
  store_id uuid not null references public.stores(id),
  request_key text not null check (length(request_key) between 1 and 256),
  ingredient_id uuid not null references public.ingredients(id),
  closed_at timestamptz not null default now(),
  primary key(store_id,request_key)
);
alter table public.stock_quantity_closed_requests enable row level security;
create policy stock_quantity_closed_read on public.stock_quantity_closed_requests for select
  to costkeep_rpc_executor using (exists(select 1 from public.stores s
    where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
create policy stock_quantity_closed_insert on public.stock_quantity_closed_requests for insert
  to costkeep_rpc_executor with check (exists(select 1 from public.stores s
    where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
revoke all on public.stock_quantity_closed_requests from public,anon,authenticated,service_role;
grant select,insert on public.stock_quantity_closed_requests to costkeep_rpc_executor;

create function public.resolve_stock_quantity(p_store uuid,p_ingredient uuid,p_request_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt public.stock_quantity_receipts; closed_ingredient uuid;
begin
  perform public.assert_my_store(p_store);
  if p_request_key is null or length(p_request_key) not between 1 and 256 then
    raise exception '재고 처리 요청을 확인해 주세요.' using errcode='22000';
  end if;
  -- Same key lock as the writer; do not take inventory or business locks in reverse order.
  perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':stock:' || p_request_key,0));
  if not exists(select 1 from public.ingredients where id=p_ingredient and store_id=p_store) then
    raise exception '재료를 찾을 수 없어요.' using errcode='P0002';
  end if;
  select * into receipt from public.stock_quantity_receipts where store_id=p_store and request_key=p_request_key;
  if found then
    if receipt.payload->>0 is distinct from p_ingredient::text then
      raise exception '처리 요청의 재료가 일치하지 않아요.' using errcode='22000';
    end if;
    return jsonb_build_object('status','recorded','kind',receipt.payload->>1);
  end if;
  select ingredient_id into closed_ingredient from public.stock_quantity_closed_requests
    where store_id=p_store and request_key=p_request_key;
  if found then
    if closed_ingredient is distinct from p_ingredient then
      raise exception '처리 요청의 재료가 일치하지 않아요.' using errcode='22000';
    end if;
  else
    insert into public.stock_quantity_closed_requests(store_id,request_key,ingredient_id)
      values(p_store,p_request_key,p_ingredient);
  end if;
  return jsonb_build_object('status','not_recorded');
end $$;

do $migration$
declare definition text;
  anchor text:='perform pg_advisory_xact_lock(hashtextextended(v_store::text || '':stock:'' || p_idempotency_key,0));';
begin
  definition:=pg_get_functiondef('public.change_stock_quantity(uuid,text,numeric,numeric,text,text)'::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
    raise exception 'change_stock_quantity lock anchor must occur exactly once';
  end if;
  execute replace(definition,anchor,anchor || E'\n  if exists(select 1 from public.stock_quantity_closed_requests where store_id=v_store and request_key=p_idempotency_key) then\n    raise exception ''확인 완료된 이전 요청입니다. 현재 재고로 다시 확인해 주세요.'' using errcode=''45010'';\n  end if;');
end $migration$;
grant create on schema public to costkeep_rpc_executor;
alter function public.resolve_stock_quantity(uuid,uuid,text) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.resolve_stock_quantity(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.resolve_stock_quantity(uuid,uuid,text) to authenticated;
commit;
