-- 고정 지출 기준 월이 하나라도 비면 메뉴·매출 손익 전 구간에서 미산출을 보존한다.
-- null을 0%로 바꾸면 "고정 지출 없음"으로 계산되어 순이익이 과대 표시되므로 금지한다.
begin;

do $patch$
declare d text; a text; z text;
begin
  d:=replace(pg_get_functiondef('public.build_day_snapshot(uuid,date)'::regprocedure),chr(13),'');
  a:='''fixed_rate'',coalesce((fb.value->>''rate'')::numeric,0),';
  z:='''fixed_rate'',(fb.value->>''rate'')::numeric,';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '00125 build_day_snapshot fixed rate anchor';
  end if;
  execute replace(d,a,z);

  d:=replace(pg_get_functiondef('public.with_effective_menu_detail(jsonb)'::regprocedure),chr(13),'');
  a:='''fixed_rate'',coalesce((current_basis->>''rate'')::numeric,0),';
  z:='''fixed_rate'',(current_basis->>''rate'')::numeric,';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '00125 menu detail fixed rate anchor';
  end if;
  execute replace(d,a,z);

  d:=replace(pg_get_functiondef('public.recipe_list(uuid)'::regprocedure),chr(13),'');
  a:='case when b.b is null then coalesce(public.fixed_cost_rate(b.store_id,public.store_local_month(b.store_id)),0) else (b.b->>''fixed_rate'')::numeric end rate';
  z:='case when b.b is null then public.fixed_cost_rate(b.store_id,public.store_local_month(b.store_id)) else (b.b->>''fixed_rate'')::numeric end rate';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '00125 recipe list fixed rate anchor';
  end if;
  execute replace(d,a,z);

  d:=replace(pg_get_functiondef('public.sales_draft_payload(uuid)'::regprocedure),chr(13),'');
  a:='v_fixed_rate numeric:=0;';
  z:='v_fixed_rate numeric;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '00125 draft fixed declaration anchor';
  end if;
  d:=replace(d,a,z);
  a:='v_fixed_rate:=coalesce(nullif(v_manifest->>''fixed_rate'','''')::numeric,0);';
  z:='v_fixed_rate:=nullif(v_manifest->>''fixed_rate'','''')::numeric;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '00125 draft fixed value anchor';
  end if;
  d:=replace(d,a,z);
  a:='''expense_rate'',case when v_revenue=0 then 0 else v_expense/v_revenue end,'||chr(10)||
     '      ''profit_rate'',case when v_revenue=0 then 0 else v_profit/v_revenue end';
  z:='''expense_rate'',case when v_fixed_rate is null or v_revenue=0 then null else v_expense/v_revenue end,'||chr(10)||
     '      ''profit_rate'',case when v_fixed_rate is null or v_revenue=0 then null else v_profit/v_revenue end';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '00125 draft rate result anchor';
  end if;
  execute replace(d,a,z);
end $patch$;

comment on function public.fixed_cost_basis_result(uuid,text) is
  '대상 월 제외 직전 완료 1~3개월이 모두 입력된 경우만 가중 고정 지출률을 반환한다. 누락 시 null이다.';
comment on function public.sales_draft_payload(uuid) is
  '매출 초안 미리보기. 고정 지출 기준 누락 시 고정 지출·총지출·순이익·비율을 null로 반환한다.';

notify pgrst,'reload schema';
commit;
