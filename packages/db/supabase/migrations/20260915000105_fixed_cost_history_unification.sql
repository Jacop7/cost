-- 고정 지출 설정·월별 입력·복구를 하나의 시간순 이력으로 제공한다.
-- 필터는 화면 편의일 뿐이며 원장 사건과 복구 가능성은 서버가 판정한다.
begin;

-- 새 공개 문으로 대체된 구형 직접 호출 경로는 앱 역할에서 닫는다.
revoke execute on function public.revert_fixed_cost_reentry(uuid,uuid),
  public.save_fixed_costs(uuid,text,numeric,jsonb)
from authenticated;

create function public.fixed_cost_items_without_labels(p_items jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(value - 'label' order by ordinality),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality
$$;

revoke all on function public.fixed_cost_items_without_labels(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.fixed_cost_items_without_labels(jsonb)
  to costkeep_rpc_executor,service_role;

-- 표시명만 보존한 두 번째 UPDATE가 무변경 저장·중복 이력·중복 전파를 만들지 않게 한다.
do $patch$
declare d text; a text; b text;
begin
  d:=pg_get_functiondef('public.save_fixed_costs(uuid,text,numeric,jsonb)'::regprocedure);
  a:='if v_before_items is not distinct from v_norm and v_before_revenue is not distinct from p_total_revenue then';
  b:='if public.fixed_cost_items_without_labels(v_before_items) is not distinct from public.fixed_cost_items_without_labels(v_norm) and v_before_revenue is not distinct from p_total_revenue then';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0105 save_fixed_costs no-op anchor';
  end if;
  execute replace(d,a,b);
end $patch$;

create or replace function public.record_configuration_change(p_store uuid,p_source text,p_month text,
  p_before jsonb,p_after jsonb,p_effective date default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_source='fixed_cost' and (
    current_setting('costkeep.fixed_cost_history_suppressed',true)='on'
    or current_setting('costkeep.fixed_cost_restore',true)='on'
  ) then return; end if;
  if p_before is not distinct from p_after and p_source in ('fixed_cost','legacy_tax') then return; end if;
  insert into public.store_configuration_changes(store_id,kind,source,month,actor_id,effective_from,
    before_value,after_value,application_mode,operation,operation_subject_type,operation_subject_id)
  values(p_store,case when p_source='fixed_cost' then 'fixed_cost' else 'tax' end,p_source,p_month,auth.uid(),
    p_effective,p_before,p_after,
    case when not exists(select 1 from public.business_days where store_id=p_store and status in ('open','break'))
      then 'immediate' else 'next_business' end,
    case when p_source='fixed_cost' then case when p_before is null then 'create' else 'update' end
      when p_before is null or p_before='null'::jsonb then 'unknown' else 'update' end,
    case when p_source='fixed_cost' then 'fixed_cost' else 'tax' end,
    case when p_source='fixed_cost' then p_month else null end);
end $$;

create or replace function public.record_configuration_row_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_before jsonb; v_after jsonb;
begin
  if current_setting('costkeep.fixed_cost_restore',true)='on'
     or current_setting('costkeep.fixed_cost_history_suppressed',true)='on' then return new; end if;
  if tg_table_name='fixed_costs_monthly' then
    if tg_op='UPDATE' then v_before:=jsonb_build_object('total_revenue',old.total_revenue,'items',old.items); end if;
    v_after:=jsonb_build_object('total_revenue',new.total_revenue,'items',new.items);
    perform public.record_configuration_change(new.store_id,'fixed_cost',new.month,v_before,v_after);
  else
    v_before:=jsonb_build_object('tax_mode',old.tax_mode,'tax_items',old.tax_items);
    v_after:=jsonb_build_object('tax_mode',new.tax_mode,'tax_items',new.tax_items);
    perform public.record_configuration_change(new.store_id,'legacy_tax',null,v_before,v_after);
  end if;
  return new;
end $$;

-- 월별 저장은 표시명까지 반영한 최종 행을 한 번만 기록한다.
do $patch$
declare d text; a text; b text;
begin
  d:=pg_get_functiondef('public.save_fixed_cost_amounts_direct(uuid,text,numeric,jsonb)'::regprocedure);
  d:=regexp_replace(d,'declare','declare v_history_before jsonb; v_history_after jsonb;','i');
  a:='  v_result:=public.save_fixed_costs(p_store,p_month,p_total_revenue,v_norm);';
  b:=$new$  select jsonb_build_object('total_revenue',total_revenue,'items',items)
    into v_history_before from public.fixed_costs_monthly
    where store_id=p_store and month=p_month;
  perform set_config('costkeep.fixed_cost_history_suppressed','on',true);
  v_result:=public.save_fixed_costs(p_store,p_month,p_total_revenue,v_norm);$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0105 direct fixed save anchor';
  end if;
  d:=replace(d,a,b);
  a:=$old$  update public.fixed_costs_monthly set items=v_norm
    where store_id=p_store and month=p_month;
  return v_result;$old$;
  b:=$new$  update public.fixed_costs_monthly set items=v_norm
    where store_id=p_store and month=p_month;
  perform set_config('costkeep.fixed_cost_history_suppressed','off',true);
  select jsonb_build_object('total_revenue',total_revenue,'items',items)
    into v_history_after from public.fixed_costs_monthly
    where store_id=p_store and month=p_month;
  perform public.record_configuration_change(p_store,'fixed_cost',p_month,v_history_before,v_history_after);
  return v_result;$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0105 direct fixed history anchor';
  end if;
  execute replace(d,a,b);
end $patch$;

-- 재입력 완료 시 기간 변경 중간 사건을 만들지 않고 최종 원자 사건 한 건만 남긴다.
do $patch$
declare d text; a text; b text;
begin
  d:=pg_get_functiondef('public.save_fixed_cost_amounts(uuid,text,numeric,jsonb)'::regprocedure);
  a:=$old$  v_result:=public.save_fixed_cost_basis(
    p_store,v_session.basis_months,v_session.base_settings_revision
  );
  perform set_config('costkeep.fixed_cost_restore','on',true);$old$;
  b:=$new$  perform set_config('costkeep.fixed_cost_restore','on',true);
  v_result:=public.save_fixed_cost_basis(
    p_store,v_session.basis_months,v_session.base_settings_revision
  );$new$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0105 reentry basis event anchor';
  end if;
  execute replace(d,a,b);
end $patch$;

create function public.fixed_cost_change_type(p_event public.store_configuration_changes)
returns text language sql stable security invoker set search_path=pg_catalog,public as $$
  select case
    when coalesce((p_event.after_value->>'reverted')::boolean,false) then 'restore'
    when nullif(p_event.after_value->>'reentry_session_id','') is not null then 'settings_reentry'
    when p_event.before_value ? 'basis_months' or p_event.after_value ? 'basis_months' then 'settings_basis'
    when p_event.before_value ? 'item_configuration' or p_event.after_value ? 'item_configuration' then
      case when p_event.operation='create' then 'initial_settings' else 'settings_items' end
    when p_event.before_value ? 'total_revenue' or p_event.after_value ? 'total_revenue' then 'monthly_input'
    when p_event.before_value ? 'items' or p_event.after_value ? 'items' then 'settings_items'
    else 'unknown'
  end
$$;

create function public.fixed_cost_change_affected_months(p_event public.store_configuration_changes)
returns text[] language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_session public.fixed_cost_reentry_sessions; v_session_id uuid; v_result text[];
begin
  if jsonb_typeof(p_event.after_value->'affected_months')='array' then
    select coalesce(array_agg(value order by ordinality),'{}'::text[]) into v_result
      from jsonb_array_elements_text(p_event.after_value->'affected_months') with ordinality;
    return v_result;
  end if;
  if nullif(p_event.after_value->>'reentry_session_id','') is not null then
    v_session_id:=(p_event.after_value->>'reentry_session_id')::uuid;
    select * into v_session from public.fixed_cost_reentry_sessions where id=v_session_id and store_id=p_event.store_id;
    if found then
      select array_agg(to_char(month_value,'YYYY-MM') order by month_value)
        into v_result
      from generate_series(to_date(v_session.from_month||'-01','YYYY-MM-DD'),
        to_date(v_session.to_month||'-01','YYYY-MM-DD'),interval '1 month') month_value;
      return coalesce(v_result,'{}'::text[]);
    end if;
  end if;
  if public.fixed_cost_change_type(p_event)='monthly_input' and p_event.month is not null then
    return array[p_event.month];
  end if;
  return '{}'::text[];
end $$;

create function public.fixed_cost_change_scopes(p_event public.store_configuration_changes)
returns text[] language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_type text:=public.fixed_cost_change_type(p_event); v_scope text;
begin
  if v_type='restore' then
    v_scope:=p_event.after_value->>'reverted_scope';
    if v_scope='monthly' then return array['monthly']; end if;
    if v_scope='settings' then return array['settings']; end if;
    return array['settings','monthly'];
  end if;
  if v_type='monthly_input' then return array['monthly']; end if;
  if v_type='settings_reentry' then return array['settings','monthly']; end if;
  return array['settings'];
end $$;

create function public.fixed_cost_change_values(p_event public.store_configuration_changes,p_before boolean)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_session public.fixed_cost_reentry_sessions; v_session_id uuid; v_months jsonb; v_reverted boolean;
begin
  v_reverted:=coalesce((p_event.after_value->>'reverted')::boolean,false);
  if nullif(p_event.after_value->>'reentry_session_id','') is null then
    return case when p_before then p_event.before_value else p_event.after_value end;
  end if;
  v_session_id:=(p_event.after_value->>'reentry_session_id')::uuid;
  select * into v_session from public.fixed_cost_reentry_sessions where id=v_session_id and store_id=p_event.store_id;
  if not found then return case when p_before then p_event.before_value else p_event.after_value end; end if;
  if (p_before and not v_reverted) or (not p_before and v_reverted) then
    v_months:=v_session.before_months;
  else
    select coalesce(jsonb_agg(jsonb_build_object('month',month,'exists',true,
      'total_revenue',total_revenue,'items',items) order by month),'[]'::jsonb)
      into v_months from public.fixed_cost_reentry_months where session_id=v_session_id;
  end if;
  return coalesce(case when p_before then p_event.before_value else p_event.after_value end,'{}'::jsonb)
    ||jsonb_build_object('months',coalesce(v_months,'[]'::jsonb));
end $$;

create function public.fixed_cost_change_revert_blocker(p_event public.store_configuration_changes)
returns text language plpgsql stable security invoker set search_path=pg_catalog,public as $$
declare v_type text:=public.fixed_cost_change_type(p_event); v_latest bigint; v_session public.fixed_cost_reentry_sessions;
  v_month public.fixed_costs_monthly; v_basis smallint; v_items jsonb;
begin
  if v_type not in ('monthly_input','settings_basis','settings_reentry') then return 'unsupported'; end if;
  select max(id) into v_latest from public.store_configuration_changes
    where store_id=p_event.store_id and kind='fixed_cost';
  if v_latest is distinct from p_event.id then return 'newer_change'; end if;
  if exists(select 1 from public.fixed_cost_reentry_sessions where store_id=p_event.store_id and status='active') then
    return 'active_reentry';
  end if;
  if v_type='monthly_input' then
    select * into v_month from public.fixed_costs_monthly where store_id=p_event.store_id and month=p_event.month;
    if p_event.after_value is null or not found then return 'state_mismatch'; end if;
    if public.fixed_cost_items_without_labels(v_month.items)
         is distinct from public.fixed_cost_items_without_labels(p_event.after_value->'items')
       or v_month.total_revenue is distinct from (p_event.after_value->>'total_revenue')::numeric then
      return 'state_mismatch';
    end if;
    return null;
  end if;
  if v_type='settings_basis' then
    select fixed_cost_basis_months into v_basis from public.settings where store_id=p_event.store_id;
    if v_basis is distinct from (p_event.after_value->>'basis_months')::smallint then return 'state_mismatch'; end if;
    return null;
  end if;
  select * into v_session from public.fixed_cost_reentry_sessions
    where id=(p_event.after_value->>'reentry_session_id')::uuid and store_id=p_event.store_id;
  if not found or v_session.status<>'completed' then return 'state_mismatch'; end if;
  select fixed_cost_basis_months into v_basis from public.settings where store_id=p_event.store_id;
  v_items:=public.fixed_cost_configuration_result(p_event.store_id,v_session.target_month)->'items';
  if v_basis is distinct from v_session.basis_months or v_items is distinct from v_session.items then
    return 'state_mismatch';
  end if;
  if exists(
    select 1 from public.fixed_cost_reentry_months d
    left join public.fixed_costs_monthly f on f.store_id=p_event.store_id and f.month=d.month
    where d.session_id=v_session.id and (f.id is null or f.total_revenue is distinct from d.total_revenue
      or public.fixed_cost_items_without_labels(f.items) is distinct from public.fixed_cost_items_without_labels(d.items))
  ) then return 'state_mismatch'; end if;
  return null;
end $$;

revoke all on function public.fixed_cost_change_type(public.store_configuration_changes),
  public.fixed_cost_change_affected_months(public.store_configuration_changes),
  public.fixed_cost_change_scopes(public.store_configuration_changes),
  public.fixed_cost_change_values(public.store_configuration_changes,boolean),
  public.fixed_cost_change_revert_blocker(public.store_configuration_changes)
from public,anon,authenticated,service_role;
grant execute on function public.fixed_cost_change_type(public.store_configuration_changes),
  public.fixed_cost_change_affected_months(public.store_configuration_changes),
  public.fixed_cost_change_scopes(public.store_configuration_changes),
  public.fixed_cost_change_values(public.store_configuration_changes,boolean),
  public.fixed_cost_change_revert_blocker(public.store_configuration_changes)
to costkeep_rpc_executor,service_role;

create function public.fixed_cost_change_history(
  p_store uuid,p_scope text default 'all',p_month text default null,p_cursor text default null
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_items jsonb:='[]'::jsonb; v_cursor bigint; v_last bigint; v_counts jsonb; v_latest bigint;
  v_event public.store_configuration_changes; v_type text; v_affected text[]; v_blocker text;
begin
  perform public.assert_my_store(p_store);
  if p_scope not in ('all','settings','monthly') or p_scope is null then
    raise exception '수정 내역 필터가 올바르지 않아요' using errcode='22000';
  end if;
  if p_month is not null and (p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or to_char(to_date(p_month||'-01','YYYY-MM-DD'),'YYYY-MM')<>p_month) then
    raise exception '월 형식이 올바르지 않아요' using errcode='22000';
  end if;
  if p_cursor is not null then
    if p_cursor !~ '^[0-9]{1,19}$' then raise exception '잘못된 커서' using errcode='22000'; end if;
    v_cursor:=p_cursor::bigint;
  end if;
  select max(id) into v_latest from public.store_configuration_changes where store_id=p_store and kind='fixed_cost';
  select jsonb_build_object(
    'all',count(*),
    'settings',count(*) filter(where 'settings'=any(public.fixed_cost_change_scopes(c))),
    'monthly',count(*) filter(where 'monthly'=any(public.fixed_cost_change_scopes(c)))
  ) into v_counts from public.store_configuration_changes c
  where c.store_id=p_store and c.kind='fixed_cost'
    and (p_month is null or p_month=any(public.fixed_cost_change_affected_months(c)));

  for v_event in
    select c.* from public.store_configuration_changes c
    where c.store_id=p_store and c.kind='fixed_cost'
      and (p_scope='all' or p_scope=any(public.fixed_cost_change_scopes(c)))
      and (p_month is null or p_month=any(public.fixed_cost_change_affected_months(c)))
      and (v_cursor is null or c.id<v_cursor)
    order by c.id desc limit 20
  loop
    v_type:=public.fixed_cost_change_type(v_event);
    v_affected:=public.fixed_cost_change_affected_months(v_event);
    v_blocker:=public.fixed_cost_change_revert_blocker(v_event);
    v_items:=v_items||jsonb_build_array(
      public.configuration_change_operation_json(v_event)||jsonb_build_object(
        'id',v_event.id::text,'source',v_event.source,'month',v_event.month,
        'occurred_at',v_event.occurred_at,'effective_from',v_event.effective_from,
        'application_mode',v_event.application_mode,'before_value',public.fixed_cost_change_values(v_event,true),
        'after_value',public.fixed_cost_change_values(v_event,false),'change_type',v_type,
        'affected_months',to_jsonb(v_affected),'reversible',v_blocker is null,
        'revert_blocker',v_blocker,'latest_change_id',v_latest::text,
        'reverted_change_id',case when v_event.after_value->>'reverted_change_id' is not null
          then v_event.after_value->>'reverted_change_id'
          when v_type='restore' and v_event.after_value->>'reentry_session_id' is not null then (
            select c2.id::text from public.store_configuration_changes c2
            where c2.store_id=p_store and c2.kind='fixed_cost'
              and c2.id<v_event.id and c2.after_value->>'reentry_session_id'=v_event.after_value->>'reentry_session_id'
              and coalesce((c2.after_value->>'reverted')::boolean,false)=false
            order by c2.id desc limit 1) else null end
      )
    );
    v_last:=v_event.id;
  end loop;
  return jsonb_build_object('items',v_items,'count',coalesce((v_counts->>p_scope)::bigint,0),
    'counts',v_counts,'latest_change_id',v_latest::text,'next_cursor',case when v_last is not null and exists(
      select 1 from public.store_configuration_changes c
      where c.store_id=p_store and c.kind='fixed_cost'
        and (p_scope='all' or p_scope=any(public.fixed_cost_change_scopes(c)))
        and (p_month is null or p_month=any(public.fixed_cost_change_affected_months(c))) and c.id<v_last
    ) then v_last::text else null end);
end $$;

revoke all on function public.fixed_cost_change_history(uuid,text,text,text)
  from public,anon,service_role;
grant execute on function public.fixed_cost_change_history(uuid,text,text,text)
  to authenticated,service_role;
grant create on schema public to costkeep_rpc_executor;
alter function public.fixed_cost_change_history(uuid,text,text,text) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

-- 통합 상세의 사건 ID와 조회 당시 최신 ID를 모두 검사한 뒤 실제 복구를 실행한다.
create function public.revert_fixed_cost_change(
  p_store uuid,p_change bigint,p_expected_latest_change bigint
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.store_configuration_changes; v_latest bigint; v_type text; v_result jsonb;
  v_before jsonb; v_prev_rate numeric; v_revision integer; v_new_change bigint;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  select max(id) into v_latest from public.store_configuration_changes where store_id=p_store and kind='fixed_cost';
  if p_expected_latest_change is null or v_latest is distinct from p_expected_latest_change or p_change is distinct from v_latest then
    raise exception '이 변경 뒤에 다른 수정이 있어 바로 복구할 수 없어요'
      using errcode='45009',detail='NEWER_CHANGE_EXISTS';
  end if;
  select * into v_event from public.store_configuration_changes
    where id=p_change and store_id=p_store and kind='fixed_cost' for share;
  if not found then raise exception '복구할 고정 지출 수정 내역을 찾지 못했어요' using errcode='22000'; end if;
  v_type:=public.fixed_cost_change_type(v_event);
  if public.fixed_cost_change_revert_blocker(v_event) is not null then
    raise exception '현재 상태에서는 이 변경을 복구할 수 없어요'
      using errcode='45009',detail=upper(public.fixed_cost_change_revert_blocker(v_event));
  end if;
  if v_type='settings_reentry' then
    return public.revert_fixed_cost_reentry(p_store,(v_event.after_value->>'reentry_session_id')::uuid);
  end if;
  if v_type='monthly_input' then
    v_before:=v_event.before_value;
    v_prev_rate:=public.fixed_cost_rate(p_store,public.store_local_month(p_store));
    perform set_config('costkeep.fixed_cost_history_suppressed','on',true);
    if v_before is null then
      delete from public.fixed_costs_monthly where store_id=p_store and month=v_event.month;
      perform public.e4_fixed_cost_saved(p_store,v_event.month,v_prev_rate);
    else
      perform public.save_fixed_costs(p_store,v_event.month,(v_before->>'total_revenue')::numeric,v_before->'items');
      update public.fixed_costs_monthly set items=v_before->'items',updated_at=now()
        where store_id=p_store and month=v_event.month;
    end if;
    perform set_config('costkeep.fixed_cost_history_suppressed','off',true);
    insert into public.store_configuration_changes(store_id,kind,source,month,actor_id,effective_from,
      before_value,after_value,application_mode,operation,operation_subject_type,operation_subject_id)
    values(p_store,'fixed_cost','fixed_cost',v_event.month,auth.uid(),null,v_event.after_value,
      coalesce(v_before,'{}'::jsonb)||jsonb_build_object('reverted',true,'reverted_change_id',v_event.id,
        'reverted_scope','monthly','affected_months',jsonb_build_array(v_event.month)),
      case when not exists(select 1 from public.business_days where store_id=p_store and status in ('open','break'))
        then 'immediate' else 'next_business' end,'update','fixed_cost',v_event.month)
    returning id into v_new_change;
    return jsonb_build_object('reverted',true,'change_id',v_new_change::text,'reverted_change_id',v_event.id::text);
  end if;
  if v_type='settings_basis' then
    select revision into v_revision from public.settings where store_id=p_store;
    perform set_config('costkeep.fixed_cost_history_suppressed','on',true);
    v_result:=public.save_fixed_cost_basis(p_store,(v_event.before_value->>'basis_months')::smallint,v_revision);
    perform set_config('costkeep.fixed_cost_history_suppressed','off',true);
    insert into public.store_configuration_changes(store_id,kind,source,month,actor_id,effective_from,
      before_value,after_value,application_mode,operation,operation_subject_type,operation_subject_id)
    values(p_store,'fixed_cost','fixed_cost',v_event.month,auth.uid(),null,v_event.after_value,
      v_event.before_value||jsonb_build_object('reverted',true,'reverted_change_id',v_event.id,'reverted_scope','settings'),
      case when not exists(select 1 from public.business_days where store_id=p_store and status in ('open','break'))
        then 'immediate' else 'next_business' end,'update','fixed_cost',v_event.month)
    returning id into v_new_change;
    return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('reverted',true,'change_id',v_new_change::text,
      'reverted_change_id',v_event.id::text);
  end if;
  raise exception '이 변경은 자동 복구를 지원하지 않아요' using errcode='22000';
end $$;

revoke all on function public.revert_fixed_cost_change(uuid,bigint,bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.revert_fixed_cost_change(uuid,bigint,bigint)
  to authenticated,service_role;
alter function public.revert_fixed_cost_change(uuid,bigint,bigint) owner to postgres;

comment on function public.fixed_cost_change_history(uuid,text,text,text) is
  '고정 지출 설정·월별 입력·복구의 단일 시간순 목록. 필터는 사건을 복제하지 않으며 영향 월과 서버 복구 판정을 반환한다.';
comment on function public.revert_fixed_cost_change(uuid,bigint,bigint) is
  '조회 당시 최신 사건 ID를 CAS로 검사하고 사건의 실제 원자 범위만 복구한다.';

-- 0104가 다시 정의한 매출 채널별 고정 지출 조회도 기존 facade 경계를 유지한다.
-- 실행 역할 소유 invoker 함수는 앱 역할의 표 권한에 따라 결과가 달라지므로 공개 RPC로 쓸 수 없다.
alter function public.sales_channel_fixed(uuid,date,date) security definer;
alter function public.sales_channel_fixed(uuid,date,date) set search_path=public,pg_temp;

select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
