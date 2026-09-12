-- Read-only status timestamps use exactly the existing pending predicates.
begin;
do $patch$
declare d text; start_at integer; end_at integer; predicate text;
begin
  d:=pg_get_functiondef('public.last_entity_change(uuid,text,uuid)'::regprocedure);
  start_at:=position('select exists(select 1 from public.entity_change_events e' in d);
  end_at:=position('into v_pending;' in d);
  if start_at=0 or end_at<=start_at or position('v_pending boolean;' in d)=0 then
    raise exception '0233 entity pending anchors missing';
  end if;
  -- Convert the existing two EXISTS sources to a union of candidate times.
  predicate:=substring(d from start_at for end_at-start_at);
  predicate:=replace(predicate,'select exists(select 1 from public.entity_change_events e',
    'select max(p.occurred_at) into v_pending_at from (select e.occurred_at from public.entity_change_events e');
  predicate:=replace(predicate,'''partial''))', '''partial'')');
  predicate:=replace(predicate,'or (p_entity_type=''recipe'' and exists(', 'union all');
  predicate:=replace(predicate,'select 1 from public.business_days d', 'select c.occurred_at from public.business_days d');
  predicate:=replace(predicate,'where d.store_id=p_store', 'where p_entity_type=''recipe'' and d.store_id=p_store');
  -- The final two closing parentheses belonged to AND EXISTS / OR groups.
  predicate:=regexp_replace(predicate, '\)\)\s*$', ') p;');
  d:=overlay(d placing predicate||E'\n  v_pending:=v_pending_at is not null;' from start_at for end_at-start_at+length('into v_pending;'));
  d:=replace(d,'v_pending boolean;', 'v_pending boolean; v_pending_at timestamptz;');
  d:=replace(d,'''has_pending_change'',v_pending', '''pending_occurred_at'',v_pending_at,''has_pending_change'',v_pending');
  execute d;

  d:=pg_get_functiondef('public.store_configuration_history(uuid,text,text,text)'::regprocedure);
  start_at:=position('exists(' in substring(d from position('return jsonb_build_object(''has_pending_change''' in d)));
  if start_at=0 then raise exception '0233 configuration pending anchor missing'; end if;
  -- Keep the original state response and independently project its latest time.
  d:=replace(d,'return jsonb_build_object(''has_pending_change''',
    'return jsonb_build_object(''pending_occurred_at'',(
       select max(c.occurred_at) from public.business_days d join public.store_configuration_changes c on c.store_id=d.store_id
       where d.store_id=p_store and d.status in (''open'',''break'')
         and c.kind=p_kind and (p_month is null or c.month=p_month)
         and c.application_mode=''next_business'' and c.occurred_at>d.opened_at),''has_pending_change''');
  execute d;
end $patch$;
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
