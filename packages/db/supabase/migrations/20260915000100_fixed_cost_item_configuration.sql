-- 고정 지출의 "항목 구성"과 "월별 금액 입력"을 분리한다.
-- 최초 구성은 최근 완료 월 입력에도 사용할 수 있고, 이후 변경 판본은 현재 월부터 적용한다.
begin;

create table public.fixed_cost_item_configurations (
  store_id uuid not null references public.stores(id) on delete cascade,
  effective_month text not null check (
    effective_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    and to_char(to_date(effective_month || '-01','YYYY-MM-DD'),'YYYY-MM') = effective_month
  ),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (store_id,effective_month)
);

alter table public.fixed_cost_item_configurations enable row level security;
create policy fixed_cost_item_configurations_select_mine
  on public.fixed_cost_item_configurations for select to authenticated
  using (store_id in (
    select id from public.stores where owner_id=auth.uid() and archived_at is null
  ));
create policy fixed_cost_item_configurations_rpc_insert
  on public.fixed_cost_item_configurations for insert to costkeep_rpc_executor
  with check (store_id in (
    select id from public.stores where owner_id=auth.uid() and archived_at is null
  ));
create policy fixed_cost_item_configurations_rpc_update
  on public.fixed_cost_item_configurations for update to costkeep_rpc_executor
  using (store_id in (
    select id from public.stores where owner_id=auth.uid() and archived_at is null
  ))
  with check (store_id in (
    select id from public.stores where owner_id=auth.uid() and archived_at is null
  ));

revoke all privileges on public.fixed_cost_item_configurations from public,anon,authenticated;
grant select on public.fixed_cost_item_configurations to authenticated;
grant select,insert,update on public.fixed_cost_item_configurations to costkeep_rpc_executor,service_role;

create function public.default_fixed_cost_configuration()
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select jsonb_build_array(
    jsonb_build_object('key','labor','label','인건비','mode','total','lines','[]'::jsonb,'weights',null),
    jsonb_build_object('key','rent','label','임대료','mode','total','lines','[]'::jsonb,'weights',null),
    jsonb_build_object('key','utility','label','공과금','mode','total','lines','[]'::jsonb,'weights',null),
    jsonb_build_object('key','commission','label','플랫폼 수수료','mode','total','lines','[]'::jsonb,'weights',null),
    jsonb_build_object('key','packing','label','포장비','mode','total','lines','[]'::jsonb,'weights',null),
    jsonb_build_object('key','delivery','label','배달/배송','mode','total','lines','[]'::jsonb,'weights',null),
    jsonb_build_object('key','ads','label','광고/홍보','mode','total','lines','[]'::jsonb,'weights',null)
  )
$$;

create function public.normalize_fixed_cost_configuration(p_items jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare
  v_item jsonb; v_line jsonb; v_weight record;
  v_key text; v_label text; v_mode text; v_lines jsonb; v_weights jsonb;
  v_result jsonb:='[]'::jsonb; v_line_result jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception '고정 지출 항목 형식이 올바르지 않아요' using errcode='22000';
  end if;
  if jsonb_array_length(p_items)>30 then
    raise exception '고정 지출 항목은 30개까지 설정할 수 있어요' using errcode='22000';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_key:=btrim(coalesce(v_item->>'key',''));
    v_label:=btrim(coalesce(v_item->>'label',''));
    v_mode:=coalesce(v_item->>'mode','total');
    v_lines:=coalesce(v_item->'lines','[]'::jsonb);
    v_weights:=v_item->'weights';
    if v_key='' or length(v_key)>100 or v_label='' or length(v_label)>40 then
      raise exception '고정 지출 항목 이름을 확인해 주세요' using errcode='22000';
    end if;
    if exists(select 1 from jsonb_array_elements(v_result) old
      where old->>'key'=v_key or lower(old->>'label')=lower(v_label)) then
      raise exception '같은 고정 지출 항목이 있어요' using errcode='23505';
    end if;
    if v_mode not in ('total','detail') or jsonb_typeof(v_lines)<>'array' then
      raise exception '고정 지출 입력 방식을 확인해 주세요' using errcode='22000';
    end if;
    if jsonb_array_length(v_lines)>30 then
      raise exception '세부 항목은 항목당 30개까지 설정할 수 있어요' using errcode='22000';
    end if;

    v_line_result:='[]'::jsonb;
    if v_mode='detail' then
      if jsonb_array_length(v_lines)=0 then
        raise exception '세부 항목을 한 개 이상 입력해 주세요' using errcode='22000';
      end if;
      for v_line in select value from jsonb_array_elements(v_lines) loop
        v_label:=btrim(coalesce(v_line->>'name',''));
        if v_label='' or length(v_label)>40 then
          raise exception '세부 항목 이름을 확인해 주세요' using errcode='22000';
        end if;
        if exists(select 1 from jsonb_array_elements(v_line_result) old where lower(old->>'name')=lower(v_label)) then
          raise exception '같은 세부 항목이 있어요' using errcode='23505';
        end if;
        v_line_result:=v_line_result||jsonb_build_array(jsonb_build_object('name',v_label));
      end loop;
    end if;

    if v_weights is not null and v_weights<>'null'::jsonb then
      if jsonb_typeof(v_weights)<>'object' then
        raise exception '채널 비중 형식이 올바르지 않아요' using errcode='22000';
      end if;
      for v_weight in select key,value from jsonb_each(v_weights) loop
        if jsonb_typeof(v_weight.value)<>'number' or (v_weight.value#>>'{}')::numeric<0 then
          raise exception '채널 비중은 0 이상의 숫자여야 해요' using errcode='22000';
        end if;
      end loop;
      if coalesce((select sum((value#>>'{}')::numeric) from jsonb_each(v_weights)),0)<=0 then
        raise exception '채널 비중 합계는 0보다 커야 해요' using errcode='22000';
      end if;
    else
      v_weights:=null;
    end if;

    -- 세부 줄을 검사하며 재사용한 v_label 대신 항목명은 원문에서 다시 읽는다.
    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'key',v_key,'label',btrim(v_item->>'label'),'mode',v_mode,
      'lines',v_line_result,'weights',v_weights));
  end loop;
  return v_result;
end $$;

create function public.fixed_cost_configuration_result(p_store uuid,p_month text)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare v_source public.fixed_cost_item_configurations; v_exact_revision integer:=0;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or to_char(to_date(p_month||'-01','YYYY-MM-DD'),'YYYY-MM')<>p_month then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode='22000';
  end if;
  select revision into v_exact_revision from public.fixed_cost_item_configurations
    where store_id=p_store and effective_month=public.store_local_month(p_store);
  v_exact_revision:=coalesce(v_exact_revision,0);
  select * into v_source from public.fixed_cost_item_configurations
    where store_id=p_store and effective_month<=p_month order by effective_month desc limit 1;
  if not found then
    select * into v_source from public.fixed_cost_item_configurations
      where store_id=p_store order by effective_month asc limit 1;
  end if;
  return jsonb_build_object(
    'requested_month',p_month,
    'effective_month',coalesce(v_source.effective_month,public.store_local_month(p_store)),
    'configured',v_source.store_id is not null,
    'current_revision',v_exact_revision,
    'source_revision',coalesce(v_source.revision,0),
    'items',coalesce(v_source.items,public.default_fixed_cost_configuration()));
end $$;

create function public.get_fixed_cost_configuration(p_store uuid,p_month text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_my_store(p_store);
  return public.fixed_cost_configuration_result(p_store,p_month);
end $$;

create function public.save_fixed_cost_settings(
  p_store uuid,p_months smallint,p_items jsonb,
  p_base_settings_revision integer,p_base_configuration_revision integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_month text; v_effective_month text; v_settings_revision integer; v_current_revision integer:=0;
  v_before_items jsonb; v_items jsonb; v_basis_result jsonb; v_config_changed boolean;
  v_has_configuration boolean;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  v_month:=public.store_local_month(p_store);
  v_items:=public.normalize_fixed_cost_configuration(p_items);

  select items,revision into v_before_items,v_current_revision
    from public.fixed_cost_item_configurations
    where store_id=p_store and effective_month=v_month for update;
  if not found then
    v_current_revision:=0;
    v_before_items:=public.fixed_cost_configuration_result(p_store,v_month)->'items';
  end if;
  select exists(select 1 from public.fixed_cost_item_configurations where store_id=p_store)
    into v_has_configuration;
  if p_base_configuration_revision is null or p_base_configuration_revision<>v_current_revision then
    raise exception '다른 기기에서 고정 지출 항목이 변경됐어요. 새로고침 후 다시 저장해 주세요'
      using errcode='45009',detail='REVISION_CONFLICT';
  end if;

  if p_months not in (1,2,3) or p_months is null then
    raise exception '고정 지출 기준은 최근 1~3개월 중에서 선택해 주세요' using errcode='22000';
  end if;
  -- 기준 기간의 판본 검사·저장은 기존 공식 RPC 한 곳에 맡긴다.
  v_basis_result:=public.save_fixed_cost_basis(p_store,p_months,p_base_settings_revision);
  v_settings_revision:=(v_basis_result->>'revision')::integer;

  v_config_changed:=v_before_items is distinct from v_items;
  if v_config_changed then
    -- 최초 설정은 아직 입력할 수 있는 완료 월 3개월에도 같은 항목을 제공한다.
    -- 그 뒤의 구조 변경은 현재 월 판본으로만 추가되어 과거 월 구성을 덮지 않는다.
    v_effective_month:=case when v_has_configuration then v_month else
      to_char(to_date(v_month||'-01','YYYY-MM-DD')-interval '3 months','YYYY-MM') end;
    insert into public.fixed_cost_item_configurations(store_id,effective_month,items,revision,updated_at)
    values(p_store,v_effective_month,v_items,1,now())
    on conflict(store_id,effective_month) do update set
      items=excluded.items,revision=public.fixed_cost_item_configurations.revision+1,updated_at=now()
    returning revision into v_current_revision;
    perform public.record_configuration_change(p_store,'fixed_cost',v_month,
      jsonb_build_object('item_configuration',v_before_items),
      jsonb_build_object('item_configuration',v_items),
      to_date(v_effective_month||'-01','YYYY-MM-DD'));
  else
    v_effective_month:=v_month;
  end if;

  return jsonb_build_object('changed',v_config_changed or coalesce((v_basis_result->>'changed')::boolean,false),
    'settings_revision',v_settings_revision,'configuration_revision',v_current_revision,
    'effective_month',v_effective_month,'months',p_months,'items',v_items);
end $$;

-- 월별 입력은 기존 월의 구조 또는 그 월에 유효한 설정 구조에 금액만 채운다.
create function public.save_fixed_cost_amounts(p_store uuid,p_month text,p_total_revenue numeric,p_items jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_local_month text; v_position integer; v_skeleton jsonb; v_expected jsonb; v_given jsonb;
  v_line jsonb; v_given_line jsonb; v_lines jsonb; v_norm jsonb:='[]'::jsonb; v_total numeric;
  v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or to_char(to_date(p_month||'-01','YYYY-MM-DD'),'YYYY-MM')<>p_month then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode='22000';
  end if;
  v_local_month:=public.store_local_month(p_store);
  select g into v_position from generate_series(1,3) g
    where to_char(to_date(v_local_month||'-01','YYYY-MM-DD')-make_interval(months=>g),'YYYY-MM')=p_month;
  if v_position is null then
    raise exception '완료된 최근 3개월의 고정 지출만 입력·수정할 수 있어요' using errcode='22000';
  end if;
  if coalesce(p_total_revenue,0)<=0 then
    raise exception '월 매출은 0보다 커야 해요' using errcode='22000';
  end if;
  if jsonb_typeof(p_items)<>'array' then
    raise exception '고정 지출 금액 형식이 올바르지 않아요' using errcode='22000';
  end if;

  select items into v_skeleton from public.fixed_costs_monthly
    where store_id=p_store and month=p_month for update;
  if v_skeleton is null then
    v_skeleton:=public.fixed_cost_configuration_result(p_store,p_month)->'items';
  end if;
  if jsonb_array_length(v_skeleton)<>jsonb_array_length(p_items) then
    raise exception '고정 지출 항목 구성이 바뀌었어요. 다시 불러와 주세요' using errcode='45009';
  end if;

  for v_expected in select value from jsonb_array_elements(v_skeleton) loop
    select value into v_given from jsonb_array_elements(p_items)
      where value->>'key'=v_expected->>'key' limit 1;
    if v_given is null or coalesce(v_given->>'mode','total')<>coalesce(v_expected->>'mode','total') then
      raise exception '고정 지출 항목 구성이 바뀌었어요. 다시 불러와 주세요' using errcode='45009';
    end if;
    v_lines:='[]'::jsonb;
    if coalesce(v_expected->>'mode','total')='detail' then
      if jsonb_array_length(coalesce(v_expected->'lines','[]'))<>jsonb_array_length(coalesce(v_given->'lines','[]')) then
        raise exception '고정 지출 세부 항목 구성이 바뀌었어요. 다시 불러와 주세요' using errcode='45009';
      end if;
      for v_line in select value from jsonb_array_elements(coalesce(v_expected->'lines','[]')) loop
        select value into v_given_line from jsonb_array_elements(coalesce(v_given->'lines','[]'))
          where value->>'name'=v_line->>'name' limit 1;
        if v_given_line is null then
          raise exception '고정 지출 세부 항목 구성이 바뀌었어요. 다시 불러와 주세요' using errcode='45009';
        end if;
        v_total:=coalesce((v_given_line->>'amount')::numeric,0);
        if v_total<0 then raise exception '고정 지출 금액은 0 이상이어야 해요' using errcode='22000'; end if;
        v_lines:=v_lines||jsonb_build_array(jsonb_build_object('name',v_line->>'name','amount',v_total));
      end loop;
      select coalesce(sum((x->>'amount')::numeric),0) into v_total from jsonb_array_elements(v_lines) x;
    else
      v_total:=coalesce((v_given->>'total')::numeric,0);
      if v_total<0 then raise exception '고정 지출 금액은 0 이상이어야 해요' using errcode='22000'; end if;
    end if;
    v_norm:=v_norm||jsonb_build_array(jsonb_build_object(
      'key',v_expected->>'key','label',coalesce(v_expected->>'label',v_expected->>'key'),
      'mode',coalesce(v_expected->>'mode','total'),'total',v_total,'lines',v_lines)
      ||case when jsonb_typeof(v_expected->'weights')='object'
        then jsonb_build_object('weights',v_expected->'weights') else '{}'::jsonb end);
  end loop;
  v_result:=public.save_fixed_costs(p_store,p_month,p_total_revenue,v_norm);
  -- 구형 저장 함수는 계산에 쓰이지 않던 표시명을 정규화 과정에서 제거한다.
  -- 새 설정 기반 입력은 계산 완료 뒤 같은 구조·금액에 표시명만 보존한다.
  update public.fixed_costs_monthly set items=v_norm
    where store_id=p_store and month=p_month;
  return v_result;
end $$;

revoke all on function public.default_fixed_cost_configuration(),
  public.normalize_fixed_cost_configuration(jsonb),
  public.fixed_cost_configuration_result(uuid,text),
  public.get_fixed_cost_configuration(uuid,text),
  public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer),
  public.save_fixed_cost_amounts(uuid,text,numeric,jsonb)
from public,anon,authenticated,service_role;

grant execute on function public.default_fixed_cost_configuration(),
  public.normalize_fixed_cost_configuration(jsonb),public.fixed_cost_configuration_result(uuid,text),
  public.save_fixed_cost_basis(uuid,smallint,integer),public.save_fixed_costs(uuid,text,numeric,jsonb)
to costkeep_rpc_executor,service_role;
grant execute on function public.get_fixed_cost_configuration(uuid,text),
  public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer),
  public.save_fixed_cost_amounts(uuid,text,numeric,jsonb)
to authenticated,service_role;

grant create on schema public to costkeep_rpc_executor;
alter function public.get_fixed_cost_configuration(uuid,text) owner to costkeep_rpc_executor;
alter function public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer) owner to costkeep_rpc_executor;
alter function public.save_fixed_cost_amounts(uuid,text,numeric,jsonb) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

comment on table public.fixed_cost_item_configurations is
  '고정 지출 항목 구성 판본. 최초 구성은 과거 입력에 사용하고 이후 변경은 effective_month부터 적용한다.';
comment on function public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer) is
  '평균 기간과 고정 지출 항목 구성을 함께 저장한다. 항목 변경은 매장 현재 월부터 적용한다.';
comment on function public.save_fixed_cost_amounts(uuid,text,numeric,jsonb) is
  '완료된 최근 3개월의 월매출·고정 지출 금액만 저장하며 항목 구성 변경을 거절한다.';

select public.assert_no_rpc_overloads();
commit;
