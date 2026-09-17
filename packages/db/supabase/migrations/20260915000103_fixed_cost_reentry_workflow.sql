-- 고정 지출 항목 구성 변경은 선택한 완료 월을 새 구성으로 모두 확인한 뒤 한 번에 반영한다.
-- 진행 중에는 기존 구성·월별 원장·메뉴 계산을 유지하고, 취소는 초안만 닫는다.
begin;

create table public.fixed_cost_reentry_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  target_month text not null check (
    target_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    and to_char(to_date(target_month || '-01','YYYY-MM-DD'),'YYYY-MM')=target_month
  ),
  basis_months smallint not null check (basis_months in (1,2,3)),
  from_month text not null,
  to_month text not null,
  before_items jsonb not null check (jsonb_typeof(before_items)='array'),
  items jsonb not null check (jsonb_typeof(items)='array'),
  base_settings_revision integer not null,
  base_configuration_revision integer not null,
  before_basis_months smallint not null check (before_basis_months in (1,2,3)),
  before_configurations jsonb not null check (jsonb_typeof(before_configurations)='array'),
  before_months jsonb not null check (jsonb_typeof(before_months)='array'),
  status text not null default 'active' check (status in ('active','completed','cancelled','reverted')),
  revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  check (from_month<=to_month)
);
create unique index fixed_cost_reentry_one_active_per_store
  on public.fixed_cost_reentry_sessions(store_id) where status='active';

create table public.fixed_cost_reentry_months (
  session_id uuid not null references public.fixed_cost_reentry_sessions(id) on delete cascade,
  month text not null check (
    month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    and to_char(to_date(month || '-01','YYYY-MM-DD'),'YYYY-MM')=month
  ),
  total_revenue numeric not null check (total_revenue>0),
  items jsonb not null check (jsonb_typeof(items)='array'),
  revision integer not null default 1 check (revision>0),
  updated_at timestamptz not null default now(),
  primary key(session_id,month)
);

alter table public.fixed_cost_reentry_sessions enable row level security;
alter table public.fixed_cost_reentry_months enable row level security;
create policy fixed_cost_reentry_sessions_rpc_all on public.fixed_cost_reentry_sessions
  for all to costkeep_rpc_executor
  using (store_id in (select id from public.stores where owner_id=auth.uid() and archived_at is null))
  with check (store_id in (select id from public.stores where owner_id=auth.uid() and archived_at is null));
create policy fixed_cost_reentry_months_rpc_all on public.fixed_cost_reentry_months
  for all to costkeep_rpc_executor
  using (session_id in (
    select id from public.fixed_cost_reentry_sessions where store_id in (
      select id from public.stores where owner_id=auth.uid() and archived_at is null
    )
  ))
  with check (session_id in (
    select id from public.fixed_cost_reentry_sessions where store_id in (
      select id from public.stores where owner_id=auth.uid() and archived_at is null
    )
  ));
revoke all on public.fixed_cost_reentry_sessions,public.fixed_cost_reentry_months
  from public,anon,authenticated,service_role;
grant select,insert,update on public.fixed_cost_reentry_sessions,public.fixed_cost_reentry_months
  to costkeep_rpc_executor,service_role;

-- 여러 월을 한 번에 전환·복구할 때 행별 자동 기록 대신 한 건의 원자 변경 이력을 남긴다.
create or replace function public.record_configuration_row_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_before jsonb; v_after jsonb;
begin
  if current_setting('costkeep.fixed_cost_restore',true)='on' then return new; end if;
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

create function public.fixed_cost_reentry_json(p_session public.fixed_cost_reentry_sessions)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  with target as (
    select to_char(to_date(p_session.target_month||'-01','YYYY-MM-DD')-make_interval(months=>offset_month),'YYYY-MM') as month_key
      from generate_series(1,p_session.basis_months) as series(offset_month)
  ), progress as (
    select coalesce(jsonb_agg(t.month_key order by t.month_key),'[]'::jsonb) target_months,
      coalesce(jsonb_agg(t.month_key order by t.month_key) filter(where d.month is not null),'[]'::jsonb) completed_months,
      count(d.month)::integer completed_count,
      min(t.month_key) filter(where d.month is null) next_month
    from target t left join public.fixed_cost_reentry_months d
      on d.session_id=p_session.id and d.month=t.month_key
  )
  select jsonb_build_object(
    'id',p_session.id,'active',p_session.status='active','status',p_session.status,
    'target_month',p_session.target_month,'basis_months',p_session.basis_months,
    'from_month',p_session.from_month,'to_month',p_session.to_month,
    'target_months',target_months,'completed_months',completed_months,
    'completed_count',completed_count,'next_month',next_month,
    'revision',p_session.revision
  ) from progress
$$;
revoke all on function public.fixed_cost_reentry_json(public.fixed_cost_reentry_sessions)
  from public,anon,authenticated,service_role;
grant execute on function public.fixed_cost_reentry_json(public.fixed_cost_reentry_sessions)
  to costkeep_rpc_executor,service_role;

-- 설정 화면과 월 입력 화면은 같은 읽기 문에서 진행 중 구성·진행률을 받는다.
create or replace function public.get_fixed_cost_configuration(p_store uuid,p_month text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb; v_session public.fixed_cost_reentry_sessions;
begin
  perform public.assert_my_store(p_store);
  v_result:=public.fixed_cost_configuration_result(p_store,p_month);
  select * into v_session from public.fixed_cost_reentry_sessions
    where store_id=p_store and status='active' order by created_at desc limit 1;
  if found then
    v_result:=v_result||jsonb_build_object('reentry',public.fixed_cost_reentry_json(v_session));
    if p_month between v_session.from_month and v_session.target_month then
      v_result:=jsonb_set(v_result,'{items}',v_session.items,true);
    end if;
  else
    v_result:=v_result||jsonb_build_object('reentry',null);
  end if;
  return v_result;
end $$;

-- 항목 변경은 계산을 건드리지 않고 재입력 작업만 만든다. 기간만 바뀌면 기존 원자 저장을 쓴다.
create or replace function public.save_fixed_cost_settings(
  p_store uuid,p_months smallint,p_items jsonb,
  p_base_settings_revision integer,p_base_configuration_revision integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_month text; v_from text; v_to text; v_current_settings integer; v_current_configuration integer:=0;
  v_before_basis smallint; v_before_items jsonb; v_before_configurations jsonb; v_before_months jsonb;
  v_items jsonb; v_basis_result jsonb; v_session public.fixed_cost_reentry_sessions;
  v_has_configuration boolean;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  v_month:=public.store_local_month(p_store);
  v_items:=public.normalize_fixed_cost_configuration(p_items);
  if p_months not in (1,2,3) or p_months is null then
    raise exception '고정 지출 기준은 최근 1~3개월 중에서 선택해 주세요' using errcode='22000';
  end if;

  select revision,fixed_cost_basis_months into v_current_settings,v_before_basis
    from public.settings where store_id=p_store for update;
  if p_base_settings_revision is null or p_base_settings_revision<>v_current_settings then
    raise exception '다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요'
      using errcode='45009',detail='REVISION_CONFLICT';
  end if;
  select revision into v_current_configuration from public.fixed_cost_item_configurations
    where store_id=p_store and effective_month=v_month for update;
  v_current_configuration:=coalesce(v_current_configuration,0);
  if p_base_configuration_revision is null or p_base_configuration_revision<>v_current_configuration then
    raise exception '다른 기기에서 고정 지출 항목이 변경됐어요. 새로고침 후 다시 저장해 주세요'
      using errcode='45009',detail='REVISION_CONFLICT';
  end if;
  v_before_items:=public.fixed_cost_configuration_result(p_store,v_month)->'items';
  select exists(select 1 from public.fixed_cost_item_configurations where store_id=p_store)
    into v_has_configuration;

  select * into v_session from public.fixed_cost_reentry_sessions
    where store_id=p_store and status='active' for update;
  if found then
    if v_session.items=v_items and v_session.basis_months=p_months then
      return jsonb_build_object('changed',false,'reentry_required',true,
        'reentry',public.fixed_cost_reentry_json(v_session));
    end if;
    raise exception '진행 중인 고정 지출 수정을 완료하거나 취소해 주세요'
      using errcode='45009',detail='REENTRY_ACTIVE';
  end if;

  v_from:=to_char(to_date(v_month||'-01','YYYY-MM-DD')-make_interval(months=>p_months),'YYYY-MM');
  v_to:=to_char(to_date(v_month||'-01','YYYY-MM-DD')-interval '1 month','YYYY-MM');

  -- 최초 항목 설정은 되돌릴 사용자 입력이 없으므로 재입력 작업으로 만들지 않는다.
  -- 선택한 기준 기간의 가장 오래된 완료 월부터 같은 입력 구조를 제공한다.
  if not v_has_configuration then
    v_basis_result:=public.save_fixed_cost_basis(p_store,p_months,p_base_settings_revision);
    insert into public.fixed_cost_item_configurations(store_id,effective_month,items,revision,updated_at)
    values(p_store,v_from,v_items,1,now())
    returning revision into v_current_configuration;
    perform public.record_configuration_change(p_store,'fixed_cost',v_month,
      jsonb_build_object('item_configuration',v_before_items),
      jsonb_build_object('item_configuration',v_items),
      to_date(v_from||'-01','YYYY-MM-DD'));
    return jsonb_build_object(
      'changed',true,'reentry_required',false,
      'settings_revision',(v_basis_result->>'revision')::integer,
      'configuration_revision',0,'effective_month',v_from,
      'months',p_months,'items',v_items);
  end if;

  if v_before_items is not distinct from v_items then
    v_basis_result:=public.save_fixed_cost_basis(p_store,p_months,p_base_settings_revision);
    return jsonb_build_object('changed',coalesce((v_basis_result->>'changed')::boolean,false),
      'reentry_required',false,'settings_revision',(v_basis_result->>'revision')::integer,
      'configuration_revision',v_current_configuration,'months',p_months,'items',v_items);
  end if;

  with target as (
    select to_char(to_date(v_month||'-01','YYYY-MM-DD')-make_interval(months=>offset_month),'YYYY-MM') as month_key
      from generate_series(0,p_months) as series(offset_month)
  ) select jsonb_agg(jsonb_build_object(
      'month',t.month_key,'exists',c.store_id is not null,'items',c.items
    ) order by t.month_key)
    into v_before_configurations from target t left join public.fixed_cost_item_configurations c
      on c.store_id=p_store and c.effective_month=t.month_key;
  with target as (
    select to_char(to_date(v_month||'-01','YYYY-MM-DD')-make_interval(months=>offset_month),'YYYY-MM') as month_key
      from generate_series(1,p_months) as series(offset_month)
  ) select jsonb_agg(jsonb_build_object(
      'month',t.month_key,'exists',f.id is not null,'total_revenue',f.total_revenue,'items',f.items
    ) order by t.month_key)
    into v_before_months from target t left join public.fixed_costs_monthly f
      on f.store_id=p_store and f.month=t.month_key;
  insert into public.fixed_cost_reentry_sessions(
    store_id,target_month,basis_months,from_month,to_month,before_items,items,
    base_settings_revision,base_configuration_revision,before_basis_months,
    before_configurations,before_months
  ) values(
    p_store,v_month,p_months,v_from,v_to,v_before_items,v_items,
    p_base_settings_revision,p_base_configuration_revision,v_before_basis,
    v_before_configurations,v_before_months
  ) returning * into v_session;

  return jsonb_build_object('changed',false,'reentry_required',true,
    'reentry',public.fixed_cost_reentry_json(v_session));
end $$;

-- 0100의 확정 저장을 직접 저장 도우미로 보존하고, 같은 공개 시그니처는 재입력 초안을 가로챈다.
alter function public.save_fixed_cost_amounts(uuid,text,numeric,jsonb)
  rename to save_fixed_cost_amounts_direct;
revoke all on function public.save_fixed_cost_amounts_direct(uuid,text,numeric,jsonb)
  from public,anon,authenticated,service_role;

create function public.fixed_cost_reentry_amounts(p_skeleton jsonb,p_items jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare
  v_expected jsonb; v_given jsonb; v_line jsonb; v_given_line jsonb;
  v_lines jsonb; v_norm jsonb:='[]'::jsonb; v_total numeric;
begin
  if public.normalize_fixed_cost_configuration(p_items)<>p_skeleton then
    raise exception '고정 지출 항목 구성이 바뀌었어요. 다시 불러와 주세요' using errcode='45009';
  end if;
  for v_expected in select value from jsonb_array_elements(p_skeleton) loop
    select value into v_given from jsonb_array_elements(p_items)
      where value->>'key'=v_expected->>'key' limit 1;
    v_lines:='[]'::jsonb;
    if v_expected->>'mode'='detail' then
      for v_line in select value from jsonb_array_elements(v_expected->'lines') loop
        select value into v_given_line from jsonb_array_elements(coalesce(v_given->'lines','[]'::jsonb))
          where value->>'name'=v_line->>'name' limit 1;
        v_total:=coalesce((v_given_line->>'amount')::numeric,0);
        if v_total<0 then raise exception '고정 지출 금액은 0 이상이어야 해요' using errcode='22000'; end if;
        v_lines:=v_lines||jsonb_build_array(jsonb_build_object('name',v_line->>'name','amount',v_total));
      end loop;
      select coalesce(sum((x->>'amount')::numeric),0) into v_total from jsonb_array_elements(v_lines) x;
    else
      v_total:=coalesce((v_given->>'total')::numeric,0);
      if v_total<0 then raise exception '고정 지출 금액은 0 이상이어야 해요' using errcode='22000'; end if;
    end if;
    v_norm:=v_norm||jsonb_build_array(v_expected||jsonb_build_object('total',v_total,'lines',v_lines));
  end loop;
  return v_norm;
end $$;
revoke all on function public.fixed_cost_reentry_amounts(jsonb,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.fixed_cost_reentry_amounts(jsonb,jsonb)
  to costkeep_rpc_executor,service_role;

create function public.save_fixed_cost_amounts(p_store uuid,p_month text,p_total_revenue numeric,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_session public.fixed_cost_reentry_sessions; v_norm jsonb; v_count integer; v_result jsonb;
  v_current_configuration integer:=0; v_config_revision integer:=0; v_draft record; g integer;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  select * into v_session from public.fixed_cost_reentry_sessions
    where store_id=p_store and status='active' for update;
  if not found then
    return public.save_fixed_cost_amounts_direct(p_store,p_month,p_total_revenue,p_items);
  end if;
  if public.store_local_month(p_store)<>v_session.target_month then
    raise exception '달이 바뀌어 수정 기간을 다시 확인해야 해요. 수정을 취소한 뒤 다시 시작해 주세요'
      using errcode='45009',detail='REENTRY_MONTH_CHANGED';
  end if;
  if p_month<v_session.from_month or p_month>v_session.to_month then
    raise exception '진행 중인 기간의 고정 지출을 먼저 입력하거나 수정을 취소해 주세요'
      using errcode='22000';
  end if;
  if coalesce(p_total_revenue,0)<=0 then
    raise exception '월 매출은 0보다 커야 해요' using errcode='22000';
  end if;
  v_norm:=public.fixed_cost_reentry_amounts(v_session.items,p_items);
  insert into public.fixed_cost_reentry_months(session_id,month,total_revenue,items)
    values(v_session.id,p_month,p_total_revenue,v_norm)
  on conflict(session_id,month) do update set
    total_revenue=excluded.total_revenue,items=excluded.items,
    revision=public.fixed_cost_reentry_months.revision+1,updated_at=now();

  select count(*) into v_count from public.fixed_cost_reentry_months where session_id=v_session.id;
  if v_count<v_session.basis_months then
    select min(m) into p_month from (
      select to_char(to_date(v_session.target_month||'-01','YYYY-MM-DD')-make_interval(months=>x),'YYYY-MM') m
        from generate_series(1,v_session.basis_months) x
      except select month from public.fixed_cost_reentry_months where session_id=v_session.id
    ) missing;
    return jsonb_build_object('reentry_active',true,'reentry_completed',false,
      'completed_count',v_count,'required_count',v_session.basis_months,'next_month',p_month,
      'reentry',public.fixed_cost_reentry_json(v_session));
  end if;

  select coalesce(revision,0) into v_current_configuration from public.fixed_cost_item_configurations
    where store_id=p_store and effective_month=v_session.target_month for update;
  if coalesce(v_current_configuration,0)<>v_session.base_configuration_revision then
    raise exception '다른 기기에서 고정 지출 항목이 변경됐어요. 수정을 취소한 뒤 다시 시작해 주세요'
      using errcode='45009',detail='REVISION_CONFLICT';
  end if;

  v_result:=public.save_fixed_cost_basis(
    p_store,v_session.basis_months,v_session.base_settings_revision
  );
  perform set_config('costkeep.fixed_cost_restore','on',true);
  for g in reverse v_session.basis_months..0 loop
    insert into public.fixed_cost_item_configurations(store_id,effective_month,items,revision,updated_at)
    values(
      p_store,
      to_char(to_date(v_session.target_month||'-01','YYYY-MM-DD')-make_interval(months=>g),'YYYY-MM'),
      v_session.items,1,now()
    ) on conflict(store_id,effective_month) do update set
      items=excluded.items,revision=public.fixed_cost_item_configurations.revision+1,updated_at=now();
  end loop;
  select revision into v_config_revision from public.fixed_cost_item_configurations
    where store_id=p_store and effective_month=v_session.target_month;
  for v_draft in select month,total_revenue,items from public.fixed_cost_reentry_months
    where session_id=v_session.id order by month
  loop
    perform public.save_fixed_costs(p_store,v_draft.month,v_draft.total_revenue,v_draft.items);
    update public.fixed_costs_monthly set items=v_draft.items
      where store_id=p_store and month=v_draft.month;
  end loop;
  update public.fixed_cost_reentry_sessions set
    status='completed',revision=revision+1,updated_at=now(),finished_at=now()
    where id=v_session.id returning * into v_session;
  perform set_config('costkeep.fixed_cost_restore','off',true);
  insert into public.store_configuration_changes(
    store_id,kind,source,month,actor_id,effective_from,before_value,after_value,
    application_mode,operation,operation_subject_type,operation_subject_id
  ) values(
    p_store,'fixed_cost','fixed_cost',v_session.target_month,auth.uid(),
    to_date(v_session.from_month||'-01','YYYY-MM-DD'),
    jsonb_build_object('items',v_session.before_items,'basis_months',v_session.before_basis_months),
    jsonb_build_object('items',v_session.items,'basis_months',v_session.basis_months,
      'reentry_session_id',v_session.id,'reentry_reversible',true),
    case when not exists(select 1 from public.business_days where store_id=p_store and status in ('open','break'))
      then 'immediate' else 'next_business' end,
    'update','fixed_cost',v_session.id::text
  );
  return jsonb_build_object('reentry_active',false,'reentry_completed',true,
    'completed_count',v_count,'required_count',v_session.basis_months,'next_month',null,
    'settings_revision',(v_result->>'revision')::integer,
    'configuration_revision',v_config_revision,'reentry',public.fixed_cost_reentry_json(v_session));
end $$;

create function public.cancel_fixed_cost_reentry(p_store uuid,p_session uuid,p_base_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session public.fixed_cost_reentry_sessions;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  select * into v_session from public.fixed_cost_reentry_sessions
    where id=p_session and store_id=p_store and status='active' for update;
  if not found then raise exception '진행 중인 고정 지출 수정을 찾지 못했어요' using errcode='22000'; end if;
  if p_base_revision is null or p_base_revision<>v_session.revision then
    raise exception '고정 지출 수정 상태가 바뀌었어요. 다시 불러와 주세요'
      using errcode='45009',detail='REVISION_CONFLICT';
  end if;
  update public.fixed_cost_reentry_sessions set
    status='cancelled',revision=revision+1,updated_at=now(),finished_at=now()
    where id=v_session.id returning * into v_session;
  return jsonb_build_object('cancelled',true,'reentry',public.fixed_cost_reentry_json(v_session));
end $$;

-- 저장된 최근 수정은 수정 내역에서 이전 확정 상태로 되돌린다. 더 최신 변경이 있으면 거절한다.
create function public.revert_fixed_cost_reentry(p_store uuid,p_session uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_session public.fixed_cost_reentry_sessions; v_row jsonb; v_draft record; v_current_basis smallint;
  v_current_items jsonb; v_rec record; v_change_id bigint;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  if exists(select 1 from public.fixed_cost_reentry_sessions where store_id=p_store and status='active') then
    raise exception '진행 중인 고정 지출 변경을 먼저 완료하거나 중단해 주세요'
      using errcode='45009',detail='REENTRY_ACTIVE';
  end if;
  select * into v_session from public.fixed_cost_reentry_sessions
    where id=p_session and store_id=p_store and status='completed' for update;
  if not found then raise exception '취소할 수 있는 고정 지출 수정 내역을 찾지 못했어요' using errcode='22000'; end if;
  select id into v_change_id from public.store_configuration_changes
    where store_id=p_store and kind='fixed_cost'
      and after_value->>'reentry_session_id'=v_session.id::text
      and coalesce((after_value->>'reentry_reversible')::boolean,false)
    order by id desc limit 1;
  if v_change_id is null or exists(
    select 1 from public.store_configuration_changes
      where store_id=p_store and kind='fixed_cost' and id>v_change_id
  ) then
    raise exception '더 최근 고정 지출 수정이 있어 이 내역을 바로 취소할 수 없어요'
      using errcode='45009',detail='NEWER_CHANGE_EXISTS';
  end if;
  select fixed_cost_basis_months into v_current_basis from public.settings where store_id=p_store for update;
  v_current_items:=public.fixed_cost_configuration_result(p_store,v_session.target_month)->'items';
  if v_current_basis<>v_session.basis_months or v_current_items<>v_session.items then
    raise exception '더 최근 설정이 있어 이 수정을 바로 취소할 수 없어요'
      using errcode='45009',detail='NEWER_CHANGE_EXISTS';
  end if;
  if exists(
    select 1 from public.fixed_cost_reentry_months d
    left join public.fixed_costs_monthly f on f.store_id=p_store and f.month=d.month
    where d.session_id=v_session.id
      and (f.id is null or f.total_revenue is distinct from d.total_revenue or f.items is distinct from d.items)
  ) then
    raise exception '더 최근 월별 입력이 있어 이 수정을 바로 취소할 수 없어요'
      using errcode='45009',detail='NEWER_CHANGE_EXISTS';
  end if;

  perform set_config('costkeep.fixed_cost_restore','on',true);
  for v_row in select value from jsonb_array_elements(v_session.before_months) loop
    if (v_row->>'exists')::boolean then
      insert into public.fixed_costs_monthly(store_id,month,total_revenue,items,updated_at)
      values(p_store,v_row->>'month',(v_row->>'total_revenue')::numeric,v_row->'items',now())
      on conflict(store_id,month) do update set total_revenue=excluded.total_revenue,
        items=excluded.items,updated_at=now();
    else
      delete from public.fixed_costs_monthly where store_id=p_store and month=v_row->>'month';
    end if;
  end loop;
  for v_row in select value from jsonb_array_elements(v_session.before_configurations) loop
    if (v_row->>'exists')::boolean then
      insert into public.fixed_cost_item_configurations(store_id,effective_month,items,revision,updated_at)
      values(p_store,v_row->>'month',v_row->'items',1,now())
      on conflict(store_id,effective_month) do update set items=excluded.items,
        revision=public.fixed_cost_item_configurations.revision+1,updated_at=now();
    elsif v_row->>'month'=v_session.target_month then
      -- 복구 전에는 현재 월의 명시 행이 없었더라도 현재 행은 남겨 판본이 0으로 되돌아가지 않게 한다.
      -- 값은 당시 유효 구성을 쓰고 판본만 계속 증가시켜 오래 열린 화면의 ABA 덮어쓰기를 막는다.
      insert into public.fixed_cost_item_configurations(store_id,effective_month,items,revision,updated_at)
      values(p_store,v_session.target_month,v_session.before_items,1,now())
      on conflict(store_id,effective_month) do update set items=excluded.items,
        revision=public.fixed_cost_item_configurations.revision+1,updated_at=now();
    else
      delete from public.fixed_cost_item_configurations
        where store_id=p_store and effective_month=v_row->>'month';
    end if;
  end loop;
  perform set_config('costkeep.fixed_cost_restore','off',true);
  update public.settings set fixed_cost_basis_months=v_session.before_basis_months,
    revision=revision+1,updated_at=now() where store_id=p_store;
  for v_rec in select id from public.recipes where store_id=p_store and coalesce(active,true) loop
    perform public.recompute_recipe(v_rec.id,'fixed',public.store_local_date(p_store));
  end loop;
  update public.fixed_cost_reentry_sessions set status='reverted',revision=revision+1,
    updated_at=now(),finished_at=now() where id=v_session.id returning * into v_session;
  insert into public.store_configuration_changes(
    store_id,kind,source,month,actor_id,effective_from,before_value,after_value,
    application_mode,operation,operation_subject_type,operation_subject_id
  ) values(
    p_store,'fixed_cost','fixed_cost',v_session.target_month,auth.uid(),
    to_date(v_session.from_month||'-01','YYYY-MM-DD'),
    jsonb_build_object('items',v_session.items,'basis_months',v_session.basis_months),
    jsonb_build_object('items',v_session.before_items,'basis_months',v_session.before_basis_months,
      'reentry_session_id',v_session.id,'reentry_reversible',false,'reverted',true),
    case when not exists(select 1 from public.business_days where store_id=p_store and status in ('open','break'))
      then 'immediate' else 'next_business' end,
    'update','fixed_cost',v_session.id::text
  );
  return jsonb_build_object('reverted',true,'session_id',v_session.id);
end $$;

revoke all on function public.get_fixed_cost_configuration(uuid,text),
  public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer),
  public.save_fixed_cost_amounts(uuid,text,numeric,jsonb),
  public.cancel_fixed_cost_reentry(uuid,uuid,integer),
  public.revert_fixed_cost_reentry(uuid,uuid)
from public,anon,authenticated,service_role;
grant execute on function public.get_fixed_cost_configuration(uuid,text),
  public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer),
  public.save_fixed_cost_amounts(uuid,text,numeric,jsonb),
  public.cancel_fixed_cost_reentry(uuid,uuid,integer),
  public.revert_fixed_cost_reentry(uuid,uuid)
to authenticated,service_role;

grant create on schema public to costkeep_rpc_executor;
alter function public.get_fixed_cost_configuration(uuid,text) owner to costkeep_rpc_executor;
alter function public.cancel_fixed_cost_reentry(uuid,uuid,integer) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

-- 이 두 원자 쓰기는 확정 설정·월별 원장을 함께 잠그고 되돌리므로 postgres 소유로 고정한다.
-- CREATE OR REPLACE는 0100에서 정한 이전 executor 소유권을 보존하므로 명시 전환이 필요하다.
alter function public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer) owner to postgres;
alter function public.save_fixed_cost_amounts(uuid,text,numeric,jsonb) owner to postgres;
alter function public.revert_fixed_cost_reentry(uuid,uuid) owner to postgres;

comment on table public.fixed_cost_reentry_sessions is
  '항목 변경과 선택 완료 월 재입력을 원자적으로 전환하기 위한 수정 작업. active 동안 확정 원장과 계산은 불변이다.';
comment on function public.cancel_fixed_cost_reentry(uuid,uuid,integer) is
  '진행 중 고정 지출 항목 수정 초안을 취소한다. 확정 구성·월별 원장·손익은 변경하지 않는다.';
comment on function public.revert_fixed_cost_reentry(uuid,uuid) is
  '수정 내역의 최근 원자 변경을 이전 구성·기간·월별 금액으로 복구하고 복구 이력을 새로 남긴다.';
comment on function public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer) is
  '기간만 바뀌면 즉시 저장하고, 항목이 바뀌면 선택한 완료 월 전체 재입력 작업을 시작한다.';
comment on function public.save_fixed_cost_amounts(uuid,text,numeric,jsonb) is
  '재입력 작업 중에는 월 초안을 저장하고 전 기간 완료 시 구성·월별 금액·현재 메뉴 기준을 원자 반영한다.';

select public.assert_no_rpc_overloads();
commit;
