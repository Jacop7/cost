-- Display-only count labels. Existing stock/price ledgers remain in ea.
begin;
alter table public.bundle_units add column item_unit_name text not null default '개'
  check(item_unit_name=btrim(item_unit_name) and length(item_unit_name) between 1 and 20 and item_unit_name !~ '[[:cntrl:]]');
-- One facade signature; omitted new argument preserves an existing label for old clients.
drop function public.save_bundle_unit(uuid,uuid,text,integer,integer);
create or replace function public.get_bundle_units(p_store uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.assert_my_store(p_store);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'quantity',quantity,'item_unit_name',item_unit_name,'revision',revision) order by name,id),'[]'::jsonb)
    from public.bundle_units where store_id=p_store and not deleted);
end $$;

create function public.save_bundle_unit(p_store uuid,p_id uuid,p_name text,p_quantity integer,p_base_revision integer,p_item_unit_name text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.bundle_units%rowtype; v_name text:=btrim(p_name); v_item text;
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
  v_item:=coalesce(btrim(p_item_unit_name),r.item_unit_name,'개');
  if length(v_item) not between 1 and 20 or v_item ~ '[[:cntrl:]]' then
    raise exception '낱개 단위명을 입력해 주세요' using errcode='22000';
  end if;
  if r.id is null then
    if p_base_revision<>0 then raise exception '묶음 단위가 변경됐어요. 다시 불러와 주세요' using errcode='45009'; end if;
    insert into public.bundle_units(id,store_id,name,quantity,item_unit_name) values(p_id,p_store,v_name,p_quantity,v_item) returning * into r;
  else
    if r.deleted then raise exception '삭제된 묶음 단위예요' using errcode='45009'; end if;
    -- A lost create response may be retried with the same client id and unchanged payload.
    if p_base_revision=0 and r.revision=1 and r.name=v_name and r.quantity=p_quantity and r.item_unit_name=v_item then
      return jsonb_build_object('id',r.id,'name',r.name,'quantity',r.quantity,'item_unit_name',r.item_unit_name,'revision',r.revision,'changed',false);
    end if;
    if r.revision<>p_base_revision then raise exception '다른 기기에서 수정됐어요. 다시 불러와 주세요' using errcode='45009'; end if;
    if r.name=v_name and r.quantity=p_quantity and r.item_unit_name=v_item then
      return jsonb_build_object('id',r.id,'name',r.name,'quantity',r.quantity,'item_unit_name',r.item_unit_name,'revision',r.revision,'changed',false);
    end if;
    update public.bundle_units set name=v_name,quantity=p_quantity,item_unit_name=v_item,revision=revision+1,updated_at=now() where id=r.id returning * into r;
  end if;
  return jsonb_build_object('id',r.id,'name',r.name,'quantity',r.quantity,'item_unit_name',r.item_unit_name,'revision',r.revision,'changed',true);
exception when unique_violation then
  raise exception '같은 이름의 묶음 단위가 있어요' using errcode='22000';
end $$;


grant create on schema public to margincook_rpc_executor;
alter function public.save_bundle_unit(uuid,uuid,text,integer,integer,text) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.save_bundle_unit(uuid,uuid,text,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.save_bundle_unit(uuid,uuid,text,integer,integer,text) to authenticated,service_role;
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
