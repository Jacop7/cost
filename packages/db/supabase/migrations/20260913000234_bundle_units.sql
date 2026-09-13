-- Store-owned input templates; historical quantities are always saved in base units.
begin;
create table public.bundle_units (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (name=btrim(name) and length(name) between 1 and 20 and name !~ '[[:cntrl:]]'),
  quantity integer not null check (quantity between 1 and 1000000),
  revision integer not null default 1 check (revision>0),
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bundle_units_store_name on public.bundle_units(store_id,lower(name)) where not deleted;
alter table public.bundle_units enable row level security;
create policy bundle_units_scope on public.bundle_units to margincook_rpc_executor
  using (exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null)) with check (exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
revoke all on public.bundle_units from public,anon,authenticated,service_role;
grant select,insert,update on public.bundle_units to margincook_rpc_executor;

create function public.get_bundle_units(p_store uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.assert_my_store(p_store);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'quantity',quantity,'revision',revision) order by name,id),'[]'::jsonb)
    from public.bundle_units where store_id=p_store and not deleted);
end $$;

create function public.save_bundle_unit(p_store uuid,p_id uuid,p_name text,p_quantity integer,p_base_revision integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.bundle_units%rowtype; v_name text:=btrim(p_name);
begin
  perform public.assert_my_store(p_store);
  -- Serialize creation, name uniqueness and updates in a store without changing business state.
  perform public.lock_business_scope(p_store);
  if p_id is null or p_base_revision is null or p_base_revision<0 or p_quantity is null or p_quantity not between 1 and 1000000
    or v_name is null or length(v_name) not between 1 and 20 or v_name ~ '[[:cntrl:]]'
    or lower(v_name) in ('개','모','g','kg','ml','l','ea') then
    raise exception '묶음 이름과 1묶음 수량을 확인해 주세요' using errcode='22000';
  end if;
  select * into r from public.bundle_units where id=p_id and store_id=p_store for update;
  if not found then
    if p_base_revision<>0 then raise exception '묶음 단위가 변경됐어요. 다시 불러와 주세요' using errcode='45009'; end if;
    insert into public.bundle_units(id,store_id,name,quantity) values(p_id,p_store,v_name,p_quantity) returning * into r;
  else
    if r.deleted then raise exception '삭제된 묶음 단위예요' using errcode='45009'; end if;
    -- A lost create response may be retried with the same client id and unchanged payload.
    if p_base_revision=0 and r.revision=1 and r.name=v_name and r.quantity=p_quantity then
      return jsonb_build_object('id',r.id,'name',r.name,'quantity',r.quantity,'revision',r.revision,'changed',false);
    end if;
    if r.revision<>p_base_revision then raise exception '다른 기기에서 수정됐어요. 다시 불러와 주세요' using errcode='45009'; end if;
    if r.name=v_name and r.quantity=p_quantity then
      return jsonb_build_object('id',r.id,'name',r.name,'quantity',r.quantity,'revision',r.revision,'changed',false);
    end if;
    update public.bundle_units set name=v_name,quantity=p_quantity,revision=revision+1,updated_at=now() where id=r.id returning * into r;
  end if;
  return jsonb_build_object('id',r.id,'name',r.name,'quantity',r.quantity,'revision',r.revision,'changed',true);
exception when unique_violation then
  raise exception '같은 이름의 묶음 단위가 있어요' using errcode='22000';
end $$;

create function public.delete_bundle_unit(p_store uuid,p_id uuid,p_base_revision integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.bundle_units%rowtype;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  select * into r from public.bundle_units where id=p_id and store_id=p_store for update;
  if not found or p_base_revision is null then raise exception '묶음 단위를 다시 불러와 주세요' using errcode='45009'; end if;
  if r.deleted and r.revision=p_base_revision+1 then return jsonb_build_object('changed',false); end if;
  if r.deleted or r.revision<>p_base_revision then raise exception '다른 기기에서 수정됐어요. 다시 불러와 주세요' using errcode='45009'; end if;
  update public.bundle_units set deleted=true,revision=revision+1,updated_at=now() where id=r.id;
  return jsonb_build_object('changed',true);
end $$;
grant create on schema public to margincook_rpc_executor;
alter function public.get_bundle_units(uuid) owner to margincook_rpc_executor;
alter function public.save_bundle_unit(uuid,uuid,text,integer,integer) owner to margincook_rpc_executor;
alter function public.delete_bundle_unit(uuid,uuid,integer) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.get_bundle_units(uuid),public.save_bundle_unit(uuid,uuid,text,integer,integer),public.delete_bundle_unit(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_bundle_units(uuid),public.save_bundle_unit(uuid,uuid,text,integer,integer),public.delete_bundle_unit(uuid,uuid,integer) to authenticated,service_role;
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
