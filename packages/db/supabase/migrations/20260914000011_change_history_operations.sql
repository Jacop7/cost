-- Source, operation, and direct/derived fields describe different facts.
-- Existing rows remain untouched; unsupported history is explicitly unknown.
begin;

alter table public.entity_change_events
  add column operation text check(operation in ('create','update','delete','unknown')),
  add column operation_subject_type text check(operation_subject_type in ('ingredient','recipe','purchase_option','fixed_cost','tax','material','unknown')),
  add column operation_subject_id text;
alter table public.store_configuration_changes
  add column operation text check(operation in ('create','update','delete','unknown')),
  add column operation_subject_type text check(operation_subject_type in ('ingredient','recipe','purchase_option','fixed_cost','tax','material','unknown')),
  add column operation_subject_id text;

create function public.record_entity_change_operation(
  p_store uuid,p_entity_type text,p_entity_id uuid,p_source public.change_source,
  p_operation text,p_subject_type text,p_subject_id text,p_title text,p_changes jsonb,
  p_affects boolean default false,p_source_entity uuid default null,
  p_correlation uuid default null,p_summary text default null)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_day public.business_days; v_id uuid; v_sum text:=p_summary; v_first text; v_n int;
begin
  if coalesce(jsonb_array_length(p_changes),0)=0 then return null; end if;
  if p_operation is null or p_subject_type is null then
    raise exception 'Change operation metadata is required' using errcode='22000';
  end if;
  if v_sum is null then
    select c->>'label',count(*) over() into v_first,v_n
      from jsonb_array_elements(p_changes) c
      where coalesce(c->>'change_kind','direct')='direct' limit 1;
    if v_first is null then
      select c->>'label',count(*) over() into v_first,v_n from jsonb_array_elements(p_changes) c limit 1;
    end if;
    v_sum:=case when coalesce(v_n,0)>1 then v_first||' 외 '||(v_n-1)||'개 항목 변경' else v_first||' 변경' end;
  end if;
  v_day:=public.current_business_day(p_store);
  insert into public.entity_change_events(store_id,entity_type,entity_id,source_type,source_entity_id,
    correlation_id,title,summary,changes,affects_sales,business_day_id,actor_id,occurred_at,
    operation,operation_subject_type,operation_subject_id)
  values(p_store,p_entity_type,p_entity_id,p_source,p_source_entity,coalesce(p_correlation,gen_random_uuid()),
    p_title,v_sum,p_changes,p_affects,v_day.id,auth.uid(),clock_timestamp(),p_operation,p_subject_type,p_subject_id)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_entity_change_operation(uuid,text,uuid,public.change_source,text,text,text,text,jsonb,boolean,uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.record_entity_change_operation(uuid,text,uuid,public.change_source,text,text,text,text,jsonb,boolean,uuid,uuid,text)
  to costkeep_rpc_executor;

-- All existing entity writers describe changes to their root. The structured
-- created marker is the explicit creation branch in both validated save writers.
-- Purchase-option lifecycle and root deletion use the explicit helper below.
create or replace function public.record_entity_change(
  p_store uuid,p_entity_type text,p_entity_id uuid,p_source public.change_source,p_title text,p_changes jsonb,
  p_affects boolean default false,p_source_entity uuid default null,p_correlation uuid default null,p_summary text default null)
returns uuid language plpgsql set search_path=pg_catalog,public as $$
declare v_operation text:='update';
begin
  if p_source='direct' and jsonb_array_length(p_changes)=1 and p_changes#>>'{0,key}'='created'
    and p_changes#>'{0,before}'='null'::jsonb and p_changes#>'{0,after}' is not null
    and p_changes#>'{0,after}'<>'null'::jsonb then v_operation:='create'; end if;
  return public.record_entity_change_operation(p_store,p_entity_type,p_entity_id,p_source,v_operation,
    p_entity_type,p_entity_id::text,p_title,p_changes,p_affects,p_source_entity,p_correlation,p_summary);
end $$;

create function public.entity_change_operation_json(p_event public.entity_change_events)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
  select case
    when p_event.operation is not null then jsonb_build_object('operation',p_event.operation,
      'operation_subject_type',coalesce(p_event.operation_subject_type,'unknown'),'operation_subject_id',p_event.operation_subject_id)
    when p_event.source_type='direct' and jsonb_array_length(p_event.changes)=1
      and p_event.changes#>>'{0,key}'='created' and p_event.changes#>'{0,before}'='null'::jsonb
      and p_event.changes#>'{0,after}' is not null and p_event.changes#>'{0,after}'<>'null'::jsonb
      then jsonb_build_object('operation','create','operation_subject_type',p_event.entity_type,'operation_subject_id',p_event.entity_id::text)
    else jsonb_build_object('operation','unknown','operation_subject_type','unknown','operation_subject_id',null)
  end;
$$;
create function public.configuration_change_operation_json(p_event public.store_configuration_changes)
returns jsonb language sql stable security invoker set search_path=pg_catalog,public as $$
  select jsonb_build_object('source_type','direct') || case
    when p_event.operation is not null then jsonb_build_object('operation',p_event.operation,
      'operation_subject_type',coalesce(p_event.operation_subject_type,'unknown'),'operation_subject_id',p_event.operation_subject_id)
    -- Archived material rows have explicit old/new identity and active states.
    -- An already-inactive row or an absent state is not a deletion transition.
    when p_event.kind='material' then jsonb_build_object(
      'operation',case when p_event.before_value->'active'='true'::jsonb and p_event.after_value->'active'='false'::jsonb
        and p_event.before_value->>'material_id'=p_event.after_value->>'material_id' then 'delete' else 'unknown' end,
      'operation_subject_type','material','operation_subject_id',coalesce(p_event.after_value->>'material_id',p_event.before_value->>'material_id'))
    else jsonb_build_object('operation','unknown','operation_subject_type',case p_event.kind when 'fixed_cost' then 'fixed_cost' when 'tax' then 'tax' else 'unknown' end,
      'operation_subject_id',case when p_event.kind='fixed_cost' then p_event.month else null end)
  end;
$$;
revoke all on function public.entity_change_operation_json(public.entity_change_events),
  public.configuration_change_operation_json(public.store_configuration_changes) from public,anon,authenticated,service_role;
grant execute on function public.entity_change_operation_json(public.entity_change_events),
  public.configuration_change_operation_json(public.store_configuration_changes) to costkeep_rpc_executor;

create or replace function public.record_configuration_change(p_store uuid,p_source text,p_month text,
  p_before jsonb,p_after jsonb,p_effective date default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_before is not distinct from p_after and p_source in ('fixed_cost','legacy_tax') then return; end if;
  insert into public.store_configuration_changes(store_id,kind,source,month,actor_id,effective_from,
    before_value,after_value,application_mode,operation,operation_subject_type,operation_subject_id)
  values(p_store,case when p_source='fixed_cost' then 'fixed_cost' else 'tax' end,p_source,p_month,auth.uid(),
    p_effective,p_before,p_after,case when not exists(select 1 from public.business_days where store_id=p_store and status in ('open','break')) then 'immediate' else 'next_business' end,
    case when p_source='fixed_cost' then case when p_before is null then 'create' else 'update' end
      when p_before is null or p_before='null'::jsonb then 'unknown' else 'update' end,
    case when p_source='fixed_cost' then 'fixed_cost' else 'tax' end,
    case when p_source='fixed_cost' then p_month else null end);
end $$;

-- Patch only metadata at the existing capture/read boundaries. Financial logic,
-- correlation, application state, pagination, ownership and ACL remain intact.
do $patch$
declare d text; a text; b text; sig text;
begin
  sig:='public.capture_purchase_option_change()';
  d:=replace(pg_get_functiondef(sig::regprocedure),chr(13),'');
  a:=$old$perform record_entity_change(target.store_id, 'ingredient', target.ingredient_id, 'direct',
    case tg_op$old$;
  b:=$new$perform public.record_entity_change_operation(target.store_id, 'ingredient', target.ingredient_id, 'direct',
    case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end,
    'purchase_option',target.id::text,
    case tg_op$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 purchase capture anchor'; end if;
  execute replace(d,a,b);

  sig:='public.delete_recipe(uuid,uuid,text)';
  d:=replace(pg_get_functiondef(sig::regprocedure),chr(13),'');
  a:='deletion_base_revision=expected, edit_revision=expected+1 where id=p_recipe and store_id=p_store;';
  b:=a||$new$
  perform public.record_entity_change_operation(p_store,'recipe',p_recipe,'direct','delete','recipe',p_recipe::text,
    '메뉴 삭제',jsonb_build_array(jsonb_build_object('key','deleted','label','메뉴','before',r.name,'after',null,'unit',null,'change_kind','direct')),
    false,null,null,'메뉴 삭제');$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 menu delete anchor'; end if;
  execute replace(d,a,b);

  sig:='public.change_event_json(public.entity_change_events)';
  d:=pg_get_functiondef(sig::regprocedure);
  a:='select jsonb_build_object(';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 entity reader anchor'; end if;
  execute replace(d,a,'select public.entity_change_operation_json(p_event) || jsonb_build_object(');

  foreach sig in array array['public.store_configuration_history(uuid,text,text,text)',
    'public.ingredient_legacy_material_history(uuid,uuid,text)'] loop
    d:=pg_get_functiondef(sig::regprocedure); a:='c.source,';
    b:=$new$c.source,'direct'::text as source_type,
      public.configuration_change_operation_json(c)->>'operation' as operation,
      public.configuration_change_operation_json(c)->>'operation_subject_type' as operation_subject_type,
      public.configuration_change_operation_json(c)->>'operation_subject_id' as operation_subject_id,$new$;
    if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 configuration reader anchor: %',sig; end if;
    execute replace(d,a,b);
  end loop;
end $patch$;

create or replace function public.deactivate_ingredient(p_ingredient uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s uuid; result jsonb; target public.ingredients;
begin
  select store_id into s from public.ingredients where id=p_ingredient;
  if s is null then raise exception '재료를 찾을 수 없어요.' using errcode='P0002'; end if;
  perform public.assert_my_store(s);
  perform public.lock_business_scope(s);
  select * into target from public.ingredients where id=p_ingredient and store_id=s for no key update;
  if not found then raise exception '재료를 찾을 수 없어요.' using errcode='P0002'; end if;
  if not target.active then return; end if;
  result:=public.ingredient_delete_check(p_ingredient);
  if not (result->>'can_delete')::boolean then
    raise exception '이 재료를 사용하는 메뉴가 %개 있어요. 메뉴에서 먼저 제거해 주세요.',jsonb_array_length(result->'menu_names') using errcode='23503';
  end if;
  update public.ingredients set active=false,updated_at=now() where id=p_ingredient and store_id=s;
  delete from public.order_candidates where ingredient_id=p_ingredient and store_id=s;
  perform public.record_entity_change_operation(s,'ingredient',p_ingredient,'direct','delete','ingredient',p_ingredient::text,
    '재료 삭제',jsonb_build_array(jsonb_build_object('key','deleted','label','재료','before',target.name,'after',null,'unit',null,'change_kind','direct')),
    false,null,null,'재료 삭제');
end $$;

-- The latest summary must identify the same operation as the full event. Keep
-- legacy material identity even when its history is shown under a migrated item.
do $patch$
declare d text; a text; b text;
begin
  d:=replace(pg_get_functiondef('public.last_entity_change(uuid,text,uuid)'::regprocedure),chr(13),'');
  a:='v_ev entity_change_events; v_legacy_at timestamptz;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 last declaration anchor'; end if;
  d:=replace(d,a,a||' v_legacy_event public.store_configuration_changes;');
  a:=$old$select max(c.occurred_at) into v_legacy_at from public.material_retirement_archive a
      join public.store_configuration_changes c on c.store_id=a.store_id and c.kind='material'
       and coalesce(c.after_value->>'material_id',c.before_value->>'material_id')=a.id::text
      where a.store_id=p_store and a.ingredient_id=p_entity_id and a.disposition='migrated';$old$;
  b:=$new$select c.* into v_legacy_event from public.material_retirement_archive a
      join public.store_configuration_changes c on c.store_id=a.store_id and c.kind='material'
       and coalesce(c.after_value->>'material_id',c.before_value->>'material_id')=a.id::text
      where a.store_id=p_store and a.ingredient_id=p_entity_id and a.disposition='migrated'
      order by c.occurred_at desc,c.id desc limit 1;
    v_legacy_at:=v_legacy_event.occurred_at;$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 last legacy selection anchor'; end if;
  d:=replace(d,a,b);
  a:=$old$return jsonb_build_object('occurred_at',v_legacy_at$old$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 last legacy return anchor'; end if;
  d:=replace(d,a,$new$return public.configuration_change_operation_json(v_legacy_event) || jsonb_build_object('occurred_at',v_legacy_at$new$);
  a:=$old$return jsonb_build_object(
      'occurred_at', v_ev.occurred_at,$old$;
  b:=$new$return public.entity_change_operation_json(v_ev) || jsonb_build_object(
      'source_type',v_ev.source_type,'occurred_at', v_ev.occurred_at,$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 last event return anchor'; end if;
  d:=replace(d,a,b);
  a:=$old$return jsonb_build_object(
    'occurred_at', v_at,$old$;
  b:=$new$return jsonb_build_object(
    'operation',case when v_at is null then 'unknown' else 'create' end,
    'operation_subject_type',case when v_at is null then 'unknown' else p_entity_type end,
    'operation_subject_id',case when v_at is null then null else p_entity_id::text end,
    'source_type',case when v_at is null then null else 'direct' end,
    'occurred_at', v_at,$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0011 last fallback anchor'; end if;
  execute replace(d,a,b);
end $patch$;

comment on column public.entity_change_events.operation is 'Explicit operation for new writes; NULL legacy rows are projected conservatively without updating the ledger.';
comment on column public.entity_change_events.operation_subject_id is 'Actual operation target; a purchase option is distinct from its parent ingredient.';
comment on column public.store_configuration_changes.operation_subject_id is 'Monthly fixed-cost target uses YYYY-MM; store-wide tax has no separate subject id; legacy material keeps its original UUID.';
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
