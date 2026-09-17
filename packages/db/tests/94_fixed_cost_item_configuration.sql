-- 항목 변경은 선택한 완료 월을 모두 다시 입력한 뒤 원자 반영되고 취소할 수 있어야 한다.
do $test$
declare
  s uuid := pg_temp.store();
  current_month text := public.store_local_month(pg_temp.store());
  m1 text;
  m2 text;
  m3 text;
  m4 text;
  config jsonb;
  saved jsonb;
  history jsonb;
  completed_session uuid;
  first_items jsonb := '[
    {"key":"labor","label":"인건비","mode":"detail","lines":[{"name":"주방 직원"},{"name":"홀 직원"}],"weights":{"store":30,"delivery":50,"takeout":20}},
    {"key":"rent","label":"임대료","mode":"total","lines":[],"weights":null}
  ]'::jsonb;
  changed_items jsonb := '[
    {"key":"labor","label":"인건비","mode":"detail","lines":[{"name":"주방 직원"},{"name":"홀 직원"}],"weights":{"store":30,"delivery":50,"takeout":20}},
    {"key":"rent","label":"임대료","mode":"total","lines":[],"weights":null},
    {"key":"ads","label":"광고비","mode":"total","lines":[],"weights":{"delivery":100}}
  ]'::jsonb;
  first_amounts jsonb := '[
    {"key":"labor","label":"인건비","mode":"detail","total":300,"lines":[{"name":"주방 직원","amount":200},{"name":"홀 직원","amount":100}],"weights":{"store":30,"delivery":50,"takeout":20}},
    {"key":"rent","label":"임대료","mode":"total","total":500,"lines":[]}
  ]'::jsonb;
  changed_amounts jsonb := '[
    {"key":"labor","label":"인건비","mode":"detail","total":300,"lines":[{"name":"주방 직원","amount":200},{"name":"홀 직원","amount":100}],"weights":{"store":30,"delivery":50,"takeout":20}},
    {"key":"rent","label":"임대료","mode":"total","total":500,"lines":[],"weights":null},
    {"key":"ads","label":"광고비","mode":"total","total":100,"lines":[],"weights":{"delivery":100}}
  ]'::jsonb;
begin
  m1 := to_char(to_date(current_month||'-01','YYYY-MM-DD')-interval '1 month','YYYY-MM');
  m2 := to_char(to_date(current_month||'-01','YYYY-MM-DD')-interval '2 months','YYYY-MM');
  m3 := to_char(to_date(current_month||'-01','YYYY-MM-DD')-interval '3 months','YYYY-MM');
  m4 := to_char(to_date(current_month||'-01','YYYY-MM-DD')-interval '4 months','YYYY-MM');

  set local role postgres;
  delete from public.fixed_costs_monthly where store_id=s;
  delete from public.fixed_cost_item_configurations where store_id=s;
  set local role costkeep_rpc_executor;

  config := public.get_fixed_cost_configuration(s,current_month);
  perform pg_temp.ok('최초에는 기본 항목을 제공하지만 아직 설정 완료 상태는 아님',
    (config->>'configured')::boolean=false and jsonb_array_length(config->'items')=7);

  perform public.save_fixed_costs(s,m1,1000,first_amounts);
  config := public.get_fixed_cost_configuration(s,current_month);
  perform pg_temp.ok('기존 월별 입력의 세부 항목과 호환용 채널 값을 최초 설정 초안으로 보존',
    (config->>'configured')::boolean=false
    and config->'items'=public.normalize_fixed_cost_configuration(first_items)
    and config->'items'->0->'lines'->0->>'name'='주방 직원'
    and config->'items'->0->'weights'='{"store":30,"delivery":50,"takeout":20}'::jsonb);

  saved := public.save_fixed_cost_settings(s,3::smallint,first_items,pg_temp.settings_rev(s),0);
  perform pg_temp.eq_t('최초 항목 구성은 입력 가능 범위의 첫 월부터 적용',saved->>'effective_month',m3);
  config := public.get_fixed_cost_configuration(s,m1);
  perform pg_temp.ok('최초 구성은 과거 완료 월 입력에도 사용',
    (config->>'configured')::boolean=true and config->'items'=public.normalize_fixed_cost_configuration(first_items));

  saved := public.save_fixed_cost_amounts(s,m1,1000,first_amounts);
  perform pg_temp.eq('월별 입력은 설정 구조에 금액만 저장',(saved->>'fixed')::numeric,800);
  perform pg_temp.eq_t('항목 표시명을 월별 원장에 보존',
    (select items->0->>'label' from public.fixed_costs_monthly where store_id=s and month=m1),'인건비');
  perform pg_temp.ok('이전 판본 호환용 채널 값을 월별 원장에 보존',
    (select items->0->'weights' from public.fixed_costs_monthly where store_id=s and month=m1)
      ='{"store":30,"delivery":50,"takeout":20}'::jsonb);

  saved := public.save_fixed_cost_settings(s,3::smallint,changed_items,pg_temp.settings_rev(s),0);
  completed_session := (saved#>>'{reentry,id}')::uuid;
  perform pg_temp.ok('항목 변경은 최근 3개월 재입력 작업을 시작',
    (saved->>'reentry_required')::boolean and saved#>>'{reentry,from_month}'=m3
    and saved#>>'{reentry,to_month}'=m1);
  perform pg_temp.ok('진행 중 확정 구성은 바뀌지 않음',
    (public.fixed_cost_configuration_result(s,current_month)->'items')
      =public.normalize_fixed_cost_configuration(first_items));
  perform pg_temp.ok('월 입력 화면에는 재입력할 새 구성을 제공',
    (public.get_fixed_cost_configuration(s,m1)->'items')
      =public.normalize_fixed_cost_configuration(changed_items));

  saved := public.save_fixed_cost_amounts(s,m3,1000,changed_amounts);
  perform pg_temp.ok('첫 달은 초안이고 기존 기준 유지',
    (saved->>'reentry_active')::boolean and (saved->>'completed_count')::integer=1
    and (public.fixed_cost_configuration_result(s,current_month)->'items')
      =public.normalize_fixed_cost_configuration(first_items));
  saved := public.save_fixed_cost_amounts(s,m2,1000,changed_amounts);
  perform pg_temp.ok('두 번째 달도 초안',
    (saved->>'reentry_active')::boolean and (saved->>'completed_count')::integer=2);
  saved := public.save_fixed_cost_amounts(s,m1,1000,changed_amounts);
  perform pg_temp.ok('세 달 완료 시 새 구성을 원자 반영',
    (saved->>'reentry_completed')::boolean
    and (public.fixed_cost_configuration_result(s,m3)->'items')
      =public.normalize_fixed_cost_configuration(changed_items)
    and (public.fixed_cost_configuration_result(s,current_month)->'items')
      =public.normalize_fixed_cost_configuration(changed_items));
  perform pg_temp.eq('새 구성의 세 달 월별 금액이 함께 확정',
    (select count(*) from public.fixed_costs_monthly where store_id=s and month in(m1,m2,m3)
      and jsonb_array_length(items)=3),3);
  history := public.fixed_cost_change_history(s,'all',m2);
  perform pg_temp.ok('항목 구성과 최근 월 재입력은 한 사건이며 설정·월별 필터에서 같은 ID로 조회',
    history#>>'{items,0,change_type}'='settings_reentry'
    and history#>>'{items,0,affected_months,0}'=m3
    and history#>>'{items,0,affected_months,1}'=m2
    and history#>>'{items,0,affected_months,2}'=m1
    and public.fixed_cost_change_history(s,'settings',m2)#>>'{items,0,id}'=history#>>'{items,0,id}'
    and public.fixed_cost_change_history(s,'monthly',m2)#>>'{items,0,id}'=history#>>'{items,0,id}');

  saved := public.save_fixed_cost_settings(
    s,3::smallint,first_items,pg_temp.settings_rev(s),
    (public.get_fixed_cost_configuration(s,current_month)->>'current_revision')::integer
  );
  perform pg_temp.ok('다음 수정 작업도 확정값을 건드리지 않고 시작',
    (saved->>'reentry_required')::boolean);
  perform public.cancel_fixed_cost_reentry(
    s,(saved#>>'{reentry,id}')::uuid,(saved#>>'{reentry,revision}')::integer
  );
  perform pg_temp.ok('변경 중단 뒤 새 작업은 사라지고 확정 구성은 유지',
    (public.get_fixed_cost_configuration(s,current_month)->>'reentry') is null
    and (public.fixed_cost_configuration_result(s,current_month)->'items')
      =public.normalize_fixed_cost_configuration(changed_items));
  saved := public.revert_fixed_cost_change(
    s,
    (history#>>'{items,0,id}')::bigint,
    (history->>'latest_change_id')::bigint
  );
  perform pg_temp.ok('수정 내역 복구는 변경 전 항목·월별 입력값을 되살리고 새 이력을 남김',
    (saved->>'reverted')::boolean
    and (public.fixed_cost_configuration_result(s,current_month)->'items')
      =public.normalize_fixed_cost_configuration(first_items)
    and (select items->0->>'label' from public.fixed_costs_monthly where store_id=s and month=m1)='인건비'
    and (select (items->0->>'total')::numeric from public.fixed_costs_monthly where store_id=s and month=m1)=300
    and (select (items->1->>'total')::numeric from public.fixed_costs_monthly where store_id=s and month=m1)=500
    and not exists(select 1 from public.fixed_costs_monthly where store_id=s and month in(m2,m3))
    and exists(
      select 1 from public.store_configuration_changes
      where store_id=s and kind='fixed_cost'
        and after_value->>'reentry_session_id'=completed_session::text
        and after_value->>'reverted'='true'
    ));
  perform pg_temp.raises(
    '현재 월 금액은 다음 달 전까지 입력할 수 없음',
    format('select public.save_fixed_cost_amounts(%L,%L,1000,%L::jsonb)',s,current_month,first_amounts),
    '22000'
  );
  perform pg_temp.raises(
    '최근 3개월보다 오래된 월은 수정할 수 없음',
    format('select public.save_fixed_cost_amounts(%L,%L,1000,%L::jsonb)',s,m4,first_amounts),
    '22000'
  );
  perform pg_temp.raises(
    '오래된 항목 구성 판본으로 현재 설정을 덮을 수 없음',
    format('select public.save_fixed_cost_settings(%L,3::smallint,%L::jsonb,%s,0)',s,first_items,pg_temp.settings_rev(s)),
    '45009'
  );
end $test$;
