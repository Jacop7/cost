-- 대상 월 제외 완료 월 평균, 누락 미적용, 기준 설정 판본을 함께 검증한다.
do $t$
declare
  s uuid:=pg_temp.store(); target text:=public.store_local_month(pg_temp.store());
  m1 text; m2 text; m3 text; b jsonb; rev integer;
begin
  m1:=to_char(to_date(target||'-01','YYYY-MM-DD')-interval '1 month','YYYY-MM');
  m2:=to_char(to_date(target||'-01','YYYY-MM-DD')-interval '2 months','YYYY-MM');
  m3:=to_char(to_date(target||'-01','YYYY-MM-DD')-interval '3 months','YYYY-MM');
  delete from public.fixed_costs_monthly where store_id=s and month in (target,m1,m2,m3);
  perform public.save_fixed_cost_basis(s,3::smallint,pg_temp.settings_rev(s));

  perform public.save_fixed_costs(s,m1,1000,'[{"key":"rent","mode":"total","total":100,"lines":[]}]');
  perform public.save_fixed_costs(s,m2,1000,'[{"key":"rent","mode":"total","total":200,"lines":[]}]');
  b:=public.get_fixed_cost_basis(s,target);
  perform pg_temp.ok('3개월 중 2개월 입력은 미적용',(b->>'applied')::boolean=false and (b->>'entered_months')::int=2 and b->'missing_months'=jsonb_build_array(m3));
  perform pg_temp.ok('미적용률은 null',b->'rate'='null'::jsonb and public.fixed_cost_rate(s,target) is null);

  perform public.save_fixed_costs(s,m3,1000,'[{"key":"rent","mode":"total","total":300,"lines":[]}]');
  b:=public.get_fixed_cost_basis(s,target);
  perform pg_temp.eq('완료 3개월 합계 비율',public.fixed_cost_rate(s,target),0.2,0.000001);
  perform pg_temp.eq('월평균 고정 지출',(b->>'average_fixed')::numeric,200,0.000001);
  perform pg_temp.ok('항목도 같은 3개월 기준의 키별 월평균',
    b->'items'=jsonb_build_array(jsonb_build_object('key','rent','total',200)));

  -- 대상 월 입력은 현재 기준에 섞이지 않는다.
  perform public.save_fixed_costs(s,target,1000,'[{"key":"rent","mode":"total","total":900,"lines":[]}]');
  perform pg_temp.eq('이번 달 제외',public.fixed_cost_rate(s,target),0.2,0.000001);

  rev:=pg_temp.settings_rev(s);
  perform public.save_fixed_cost_basis(s,1::smallint,rev);
  b:=public.get_fixed_cost_basis(s,target);
  perform pg_temp.eq('최근 1개월 기준',(b->>'rate')::numeric,0.1,0.000001);
  perform pg_temp.ok('최근 1개월 항목도 같은 기준으로 전환',
    b->'items'=jsonb_build_array(jsonb_build_object('key','rent','total',100)));
  perform pg_temp.ok('설정 판본 증가',pg_temp.settings_rev(s)=rev+1);
end $t$;
