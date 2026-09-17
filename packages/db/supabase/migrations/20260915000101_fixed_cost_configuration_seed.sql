-- 항목 설정을 아직 저장하지 않은 기존 매장은 최근 월별 입력의 구성으로 설정 초안을 만든다.
-- 금액은 가져오지 않고 항목명·세부 항목명·채널 비중만 보존한다.
begin;

create function public.fixed_cost_configuration_from_monthly(p_items jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'key',item->>'key',
      'label',coalesce(nullif(btrim(item->>'label'),''),case item->>'key'
        when 'labor' then '인건비'
        when 'rent' then '임대료'
        when 'utility' then '공과금'
        when 'commission' then '플랫폼 수수료'
        when 'packing' then '포장비'
        when 'delivery' then '배달/배송'
        when 'ads' then '광고/홍보'
        when 'etc' then '기타'
        else item->>'key' end),
      'mode',case when item->>'mode'='detail' then 'detail' else 'total' end,
      'lines',case when item->>'mode'='detail' then coalesce((
        select jsonb_agg(jsonb_build_object('name',line->>'name') order by line_order)
        from jsonb_array_elements(coalesce(item->'lines','[]'::jsonb))
          with ordinality as lines(line,line_order)
        where nullif(btrim(line->>'name'),'') is not null
      ),'[]'::jsonb) else '[]'::jsonb end,
      'weights',case when jsonb_typeof(item->'weights')='object' then item->'weights' else null end
    ) order by item_order
  ),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
    with ordinality as items(item,item_order)
  where nullif(btrim(item->>'key'),'') is not null
$$;

create or replace function public.fixed_cost_configuration_result(p_store uuid,p_month text)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare
  v_source public.fixed_cost_item_configurations;
  v_exact_revision integer:=0;
  v_seed_items jsonb;
  v_seed_month text;
  v_has_source boolean:=false;
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
  v_has_source:=found;
  if not v_has_source then
    select * into v_source from public.fixed_cost_item_configurations
      where store_id=p_store order by effective_month asc limit 1;
    v_has_source:=found;
  end if;

  if not v_has_source then
    select public.fixed_cost_configuration_from_monthly(items),month
      into v_seed_items,v_seed_month
    from public.fixed_costs_monthly
    where store_id=p_store and month<=p_month and jsonb_array_length(items)>0
    order by month desc limit 1;
    if not found then
      select public.fixed_cost_configuration_from_monthly(items),month
        into v_seed_items,v_seed_month
      from public.fixed_costs_monthly
      where store_id=p_store and jsonb_array_length(items)>0
      order by month asc limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'requested_month',p_month,
    'effective_month',case when v_has_source then v_source.effective_month
      else coalesce(v_seed_month,public.store_local_month(p_store)) end,
    'configured',v_has_source,
    'current_revision',v_exact_revision,
    'source_revision',case when v_has_source then v_source.revision else 0 end,
    'items',case when v_has_source then v_source.items
      when coalesce(jsonb_array_length(v_seed_items),0)>0 then v_seed_items
      else public.default_fixed_cost_configuration() end);
end $$;

-- 파생된 초안과 같은 내용으로 최초 저장해도 정식 설정 판본은 반드시 만든다.
do $patch$
declare
  v_definition text;
  v_before constant text:='v_config_changed:=v_before_items is distinct from v_items;';
  v_after constant text:='v_config_changed:=not v_has_configuration or v_before_items is distinct from v_items;';
begin
  select replace(pg_get_functiondef(
    'public.save_fixed_cost_settings(uuid,smallint,jsonb,integer,integer)'::regprocedure
  ),chr(13),'') into v_definition;
  if position(v_after in v_definition)>0 then
    null;
  elsif position(v_before in v_definition)>0 then
    execute replace(v_definition,v_before,v_after);
  else
    raise exception 'save_fixed_cost_settings 변경 지점을 찾지 못했습니다';
  end if;
end $patch$;

revoke all on function public.fixed_cost_configuration_from_monthly(jsonb)
from public,anon,authenticated,service_role;
grant execute on function public.fixed_cost_configuration_from_monthly(jsonb)
to costkeep_rpc_executor,service_role;

comment on function public.fixed_cost_configuration_from_monthly(jsonb) is
  '기존 월별 입력에서 금액을 제거하고 항목 구성 초안을 만든다.';
comment on function public.fixed_cost_configuration_result(uuid,text) is
  '유효한 설정 판본을 반환하고, 최초 설정 전에는 최근 월별 입력의 항목 구성을 초안으로 반환한다.';

select public.assert_no_rpc_overloads();
commit;
