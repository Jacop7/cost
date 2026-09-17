-- 표시명이 없던 기존 월별 원장을 수정할 때도 설정 화면의 한국어 항목명을 보존한다.
begin;

do $patch$
declare
  v_definition text;
  v_before constant text:='''label'',coalesce(v_expected->>''label'',v_expected->>''key''),';
  v_after constant text:='''label'',coalesce(v_expected->>''label'',public.fixed_cost_configuration_from_monthly(jsonb_build_array(v_expected))->0->>''label''),';
begin
  select replace(pg_get_functiondef(
    'public.save_fixed_cost_amounts(uuid,text,numeric,jsonb)'::regprocedure
  ),chr(13),'') into v_definition;
  if position(v_after in v_definition)>0 then
    null;
  elsif position(v_before in v_definition)>0 then
    execute replace(v_definition,v_before,v_after);
  else
    raise exception 'save_fixed_cost_amounts 표시명 변경 지점을 찾지 못했습니다';
  end if;
end $patch$;

comment on function public.save_fixed_cost_amounts(uuid,text,numeric,jsonb) is
  '완료된 최근 3개월의 월매출·고정 지출 금액만 저장한다. 기존 원장의 누락된 표시명은 표준 항목명으로 복원한다.';

select public.assert_no_rpc_overloads();
commit;
