begin;
-- Older rows cannot reveal whether the user chose a default or an explicit treatment.
-- Preserve them; only new saves record that choice.
alter table public.menu_tax_overrides add column inherit_default boolean not null default false;
alter table public.menu_tax_overrides add constraint menu_tax_inherit_without_category
  check (not inherit_default or tax_category is null);
create or replace function public.tax_override_carry(p_profile uuid,p_date date)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select distinct on (recipe_id) recipe_id,store_id,tax_category,treatment,inherit_default,revision,updated_at
    from public.menu_tax_overrides where tax_profile_id=p_profile and effective_from<=p_date
    order by recipe_id,effective_from desc
  ) x
$$;
create or replace function public.restore_tax_override_carry(p_profile uuid,p_date date,p_rows jsonb)
returns void language sql security definer set search_path=pg_catalog,public as $$
  insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,tax_category,treatment,inherit_default,effective_from,revision,updated_at)
  select x.recipe_id,x.store_id,p_profile,x.tax_category,
    case when x.inherit_default then p.default_treatment else x.treatment end,
    coalesce(x.inherit_default,false),p_date,x.revision,x.updated_at
  from jsonb_to_recordset(p_rows) x(recipe_id uuid,store_id uuid,tax_category text,treatment public.tax_treatment,inherit_default boolean,revision integer,updated_at timestamptz)
  join public.store_tax_profiles p on p.id=p_profile and p.store_id=x.store_id
  where x.tax_category is null or exists(select 1 from public.tax_category_catalog c
    where c.tax_profile_id=p_profile and c.code=x.tax_category and c.active)
  on conflict do nothing
$$;
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.save_menu_tax_override(uuid,uuid,uuid,text,tax_treatment,integer)'::regprocedure);
  d:=replace(d,'v_revision integer;','v_revision integer; v_inherit boolean:=nullif(btrim(p_tax_category),'''') is null and p_treatment is null;');
  a:='if v_row.tax_category is not distinct from v_category';
  if position(a in d)=0 then raise exception '0222 inheritance comparison anchor'; end if;
  d:=replace(d,a,'if v_row.inherit_default=v_inherit and v_row.tax_category is not distinct from v_category');
  d:=replace(d,'tax_category,treatment,effective_from,revision)','tax_category,treatment,effective_from,revision,inherit_default)');
  d:=replace(d,'else null end,v_effective,1);','else null end,v_effective,1,v_inherit);');
  d:=replace(d,'else null end,v_effective,v_revision);','else null end,v_effective,v_revision,v_inherit);');
  d:=replace(d,'set tax_category=v_category,','set tax_category=v_category, inherit_default=v_inherit,');
  d:=replace(d,'''treatment'',v_row.treatment','''treatment'',case when v_row.inherit_default then null else v_row.treatment end');
  d:=replace(d,'''treatment'',case when v_category is null then v_treatment else null end','''treatment'',case when v_category is null and not v_inherit then v_treatment else null end');
  execute d;
  d:=pg_get_functiondef('public.recipe_tax_app_state(uuid,uuid)'::regprocedure);
  a:='''treatment'',v_override.treatment';
  if position(a in d)=0 then raise exception '0222 app inheritance anchor'; end if;
  execute replace(d,a,'''treatment'',case when v_override.inherit_default then null else v_override.treatment end');
  d:=pg_get_functiondef('public.tax_menu_change_basis(uuid,date,uuid)'::regprocedure);
  a:='''price_basis'',m.price_basis';
  if position(a in d)=0 then raise exception '0222 basis inheritance anchor'; end if;
  execute replace(d,a,'''inherit_default'',coalesce(o.inherit_default,true),'||a);
  d:=pg_get_functiondef('public.propagate_tax_menu_change(uuid,date,jsonb,uuid)'::regprocedure);
  a:='||public.change_line(''price_basis'',';
  if position(a in d)=0 then raise exception '0222 inheritance history anchor'; end if;
  execute replace(d,a,'||public.change_line(''tax_inheritance'',''과세 기준'',case when (a->>''inherit_default'')::boolean then ''매장 기본값'' else ''메뉴별 설정'' end,
      case when (b->>''inherit_default'')::boolean then ''매장 기본값'' else ''메뉴별 설정'' end,null,''derived'')
      '||a);
end $patch$;
notify pgrst,'reload schema';
commit;
