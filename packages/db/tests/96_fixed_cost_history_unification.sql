-- 고정 지출 설정과 월별 입력은 한 이력에서 구분해 보고, 저장 1회당 사건 1건만 남기며 서버 판정으로 복구한다.
do $test$
declare
  s uuid := pg_temp.store();
  current_month text := public.store_local_month(pg_temp.store());
  target_month text;
  configuration jsonb := '[
    {"key":"labor","label":"인건비","mode":"detail","lines":[{"name":"직원"}],"weights":null},
    {"key":"rent","label":"임대료","mode":"total","lines":[],"weights":null}
  ]'::jsonb;
  first_amounts jsonb := '[
    {"key":"labor","label":"인건비","mode":"detail","total":300,"lines":[{"name":"직원","amount":300}],"weights":null},
    {"key":"rent","label":"임대료","mode":"total","total":500,"lines":[],"weights":null}
  ]'::jsonb;
  second_amounts jsonb := '[
    {"key":"labor","label":"인건비","mode":"detail","total":400,"lines":[{"name":"직원","amount":400}],"weights":null},
    {"key":"rent","label":"임대료","mode":"total","total":500,"lines":[],"weights":null}
  ]'::jsonb;
  before_count bigint;
  after_count bigint;
  latest_id bigint;
  history jsonb;
  basis_before smallint;
  basis_after smallint;
  previous_items jsonb;
begin
  target_month := to_char(to_date(current_month||'-01','YYYY-MM-DD')-interval '1 month','YYYY-MM');

  set local role postgres;
  delete from public.fixed_cost_reentry_months where session_id in (
    select id from public.fixed_cost_reentry_sessions where store_id=s
  );
  delete from public.fixed_cost_reentry_sessions where store_id=s;
  delete from public.fixed_costs_monthly where store_id=s;
  delete from public.fixed_cost_item_configurations where store_id=s;
  delete from public.store_configuration_changes where store_id=s and kind='fixed_cost';
  set local role costkeep_rpc_executor;

  perform public.save_fixed_cost_settings(s,1::smallint,configuration,pg_temp.settings_rev(s),0);
  before_count := (public.fixed_cost_change_history(s)->>'count')::bigint;
  perform public.save_fixed_cost_amounts(s,target_month,1000,first_amounts);
  after_count := (public.fixed_cost_change_history(s)->>'count')::bigint;
  perform pg_temp.eq('표시명 보존 업데이트까지 포함해 월별 저장 한 번은 사건 한 건',after_count-before_count,1);

  before_count := after_count;
  perform public.save_fixed_cost_amounts(s,target_month,1200,second_amounts);
  history := public.fixed_cost_change_history(s,'monthly',target_month);
  perform pg_temp.eq('월별 재저장도 사건 한 건',
    (public.fixed_cost_change_history(s)->>'count')::bigint-before_count,1);
  perform pg_temp.ok('월 필터는 월별 사건과 서버 복구 판정을 함께 반환',
    history#>>'{items,0,change_type}'='monthly_input'
    and history#>>'{items,0,affected_months,0}'=target_month
    and (history#>>'{items,0,reversible}')::boolean
    and history#>>'{items,0,before_value,total_revenue}'='1000'
    and history#>>'{items,0,after_value,total_revenue}'='1200');

  latest_id := (history#>>'{items,0,id}')::bigint;
  previous_items := history#>'{items,0,before_value,items}';
  perform public.revert_fixed_cost_change(s,latest_id,latest_id);
  perform pg_temp.eq('월별 복구는 이전 매출을 되살림',
    (select total_revenue from public.fixed_costs_monthly where store_id=s and month=target_month),1000);
  perform pg_temp.ok('월별 복구는 이전 항목을 되살림',
    (select items=previous_items from public.fixed_costs_monthly where store_id=s and month=target_month));
  perform pg_temp.ok('월별 복구는 원본 사건을 가리키는 새 복구 사건을 남김',
    public.fixed_cost_change_history(s)#>>'{items,0,change_type}'='restore'
    and public.fixed_cost_change_history(s)#>>'{items,0,reverted_change_id}'=latest_id::text);

  select fixed_cost_basis_months into basis_before from public.settings where store_id=s;
  basis_after := case when basis_before=1 then 2 else 1 end;
  perform public.save_fixed_cost_basis(s,basis_after,pg_temp.settings_rev(s));
  history := public.fixed_cost_change_history(s,'settings');
  latest_id := (history#>>'{items,0,id}')::bigint;
  perform pg_temp.ok('설정 필터는 계산 기간 변경의 전후 값을 반환',
    history#>>'{items,0,change_type}'='settings_basis'
    and (history#>>'{items,0,before_value,basis_months}')::smallint=basis_before
    and (history#>>'{items,0,after_value,basis_months}')::smallint=basis_after);
  perform public.revert_fixed_cost_change(s,latest_id,latest_id);
  perform pg_temp.eq('계산 기간 변경도 이전 설정값으로 복구',
    (select fixed_cost_basis_months from public.settings where store_id=s),basis_before);

  perform pg_temp.raises('조회 뒤 더 최근 변경이 생기면 오래된 사건 복구 차단',
    format('select public.revert_fixed_cost_change(%L,%s,%s)',s,latest_id,latest_id),'45009');
end $test$;
