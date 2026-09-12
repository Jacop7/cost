-- Append-only material edits share the existing settings history reader and ACL.
begin;
alter table public.store_configuration_changes
  drop constraint store_configuration_changes_kind_check,
  add constraint store_configuration_changes_kind_check check(kind in ('tax','fixed_cost','material')),
  drop constraint store_configuration_changes_source_check,
  add constraint store_configuration_changes_source_check check(source in ('market','tax_profile','legacy_tax','fixed_cost','material'));

create function public.record_material_configuration_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_before jsonb; v_after jsonb; v_before_category text; v_after_category text;
begin
  if row(old.name,old.category_id,old.unit_cost,old.unit_label,old.memo,old.active)
     is not distinct from row(new.name,new.category_id,new.unit_cost,new.unit_label,new.memo,new.active) then return new; end if;
  select name into v_before_category from public.categories where id=old.category_id and store_id=old.store_id;
  select name into v_after_category from public.categories where id=new.category_id and store_id=new.store_id;
  v_before:=jsonb_build_object('material_id',old.id,'name',old.name,'category_id',old.category_id,
    'category_name',v_before_category,'unit_cost',old.unit_cost,'unit_label',old.unit_label,'memo',old.memo,'active',old.active);
  v_after:=jsonb_build_object('material_id',new.id,'name',new.name,'category_id',new.category_id,
    'category_name',v_after_category,'unit_cost',new.unit_cost,'unit_label',new.unit_label,'memo',new.memo,'active',new.active);
  insert into public.store_configuration_changes(store_id,kind,source,actor_id,before_value,after_value,application_mode)
  values(new.store_id,'material','material',auth.uid(),v_before,v_after,
    case when old.unit_cost is distinct from new.unit_cost and exists(
      select 1 from public.business_days where store_id=new.store_id and status in ('open','break')
    ) then 'next_business' else 'immediate' end);
  return new;
end $$;
revoke all on function public.record_material_configuration_change() from public,anon,authenticated,service_role;
create trigger material_configuration_history
  after update of name,category_id,unit_cost,unit_label,memo,active on public.materials
  for each row execute function public.record_material_configuration_change();

do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('public.store_configuration_history(uuid,text,text,text)'::regprocedure);
  if position('p_kind not in (''tax'',''fixed_cost'')' in definition)=0 then
    raise exception '0207: configuration reader kind guard not found';
  end if;
  execute replace(definition,'p_kind not in (''tax'',''fixed_cost'')','p_kind not in (''tax'',''fixed_cost'',''material'')');
end $patch$;
comment on function public.record_material_configuration_change() is
  'Material edit/deactivation snapshots from 0207 onward. No insert/backfill. Existing menu financial propagation remains authoritative.';
select public.assert_no_rpc_overloads();
commit;
