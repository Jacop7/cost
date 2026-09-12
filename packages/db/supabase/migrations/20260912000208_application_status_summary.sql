-- Application status is independent of the last edit's classification.
-- No financial values or historical events are changed here.
begin;
do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('public.last_entity_change(uuid,text,uuid)'::regprocedure);
  if position('v_at timestamptz;' in definition)=0 or position('if v_ev.id is not null then' in definition)=0 then
    raise exception '0208: last change anchors missing';
  end if;
  definition:=replace(definition,'v_at timestamptz;','v_at timestamptz; v_pending boolean;');
  definition:=replace(definition,'if v_ev.id is not null then',
    'select exists(select 1 from public.entity_change_events e
       where e.store_id=p_store and e.entity_type=p_entity_type and e.entity_id=p_entity_id
         and e.affects_sales and public.entity_change_state(e) in (''not_reflected'',''partial''))
     or (p_entity_type=''recipe'' and exists(
       select 1 from public.business_days d join public.store_configuration_changes c on c.store_id=d.store_id
       where d.store_id=p_store and d.status in (''open'',''break'')
         and d.snapshot#>array[''recipes'',p_entity_id::text] is not null
         and c.application_mode=''next_business''
         and c.occurred_at>coalesce((d.snapshot#>>array[''recipes'',p_entity_id::text,''basis_at''])::timestamptz,d.opened_at)
         and (c.kind=''tax'' or (c.kind=''fixed_cost'' and c.month=to_char(d.business_date,''YYYY-MM''))
           or (c.kind=''material'' and exists(select 1 from public.recipe_extra_costs x
             where x.recipe_id=p_entity_id and x.material_id::text=c.after_value->>''material_id'')))))
     into v_pending;
  if v_ev.id is not null then');
  definition:=replace(definition,'''has_history'', true','''has_pending_change'',v_pending,''has_history'', true');
  definition:=replace(definition,'''has_history'', false','''has_pending_change'',v_pending,''has_history'', false');
  execute definition;

  definition:=pg_get_functiondef('public.store_configuration_history(uuid,text,text,text)'::regprocedure);
  if position('return jsonb_build_object(''items'',v_items' in definition)=0 then
    raise exception '0208: configuration summary anchor missing';
  end if;
  execute replace(definition,'return jsonb_build_object(''items'',v_items',
    'return jsonb_build_object(''has_pending_change'',exists(
       select 1 from public.business_days d join public.store_configuration_changes c on c.store_id=d.store_id
       where d.store_id=p_store and d.status in (''open'',''break'')
         and c.kind=p_kind and (p_month is null or c.month=p_month)
         and c.application_mode=''next_business'' and c.occurred_at>d.opened_at),''items'',v_items');
end $patch$;
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
