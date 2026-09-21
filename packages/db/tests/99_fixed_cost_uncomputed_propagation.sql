-- 완료 월 누락은 0%가 아니라 미산출이며 메뉴·매출 계산 전 구간에서 null로 유지한다.
set local role postgres;
do $test$
declare
  u uuid:=gen_random_uuid();
  s uuid; r uuid; d date; target text; previous_month text; older_month text; next_month text;
  rev integer; draft uuid:=gen_random_uuid(); opened jsonb; listed record;
begin
  insert into auth.users(id) values(u);
  perform pg_temp.as_owner(u);
  s:=(public.create_store('고정지출 미산출 전파','Asia/Seoul')->>'store_id')::uuid;
  d:=public.store_local_date(s);
  target:=to_char(d,'YYYY-MM');
  previous_month:=to_char(d-interval '1 month','YYYY-MM');
  older_month:=to_char(d-interval '2 months','YYYY-MM');
  next_month:=to_char(d+interval '1 month','YYYY-MM');
  select revision into rev from public.settings where store_id=s;
  perform public.save_fixed_cost_basis(s,1::smallint,rev);
  perform public.save_fixed_costs(s,previous_month,1000,
    '[{"key":"rent","mode":"total","total":200,"lines":[]}]'::jsonb);
  perform public.save_fixed_costs(s,older_month,1000,
    '[{"key":"rent","mode":"total","total":100,"lines":[]}]'::jsonb);

  perform pg_temp.eq('현재 달은 직전 완료 월 입력으로 산출',
    public.fixed_cost_rate(s,target),0.2,0.000001);
  perform pg_temp.ok('다음 달은 새로 포함되는 현재 달 미입력으로 미산출',
    public.fixed_cost_rate(s,next_month) is null);

  set local role postgres;
  delete from public.fixed_costs_monthly where store_id=s and month=previous_month;
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  perform pg_temp.as_owner(u);

  r:=public.save_recipe(s,jsonb_build_object(
    'contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
    'name','미산출 메뉴','price',12000,'base_servings',1,'target_profit_rate',30,
    'lines','[]'::jsonb,'extras','[]'::jsonb));

  perform pg_temp.ok('오래된 입력 월이 있어도 미산출 손익 추이를 만들지 않음',
    not exists(select 1 from public.profit_trends where recipe_id=r));

  perform pg_temp.ok('누락 기준 RPC는 미적용과 null을 반환',
    public.fixed_cost_basis_result(s,target)->>'applied'='false'
    and public.fixed_cost_basis_result(s,target)->'rate'='null'::jsonb);
  perform pg_temp.ok('영업일 계산 기준도 고정 지출률 null 보존',
    public.build_day_snapshot(s,d)->'fixed_rate'='null'::jsonb);
  perform pg_temp.ok('메뉴 상세는 고정 지출률을 0으로 치환하지 않음',
    public.recipe_detail(r)->'fixed_rate'='null'::jsonb);

  select * into listed from public.recipe_list(s) where id=r;
  perform pg_temp.ok('메뉴 목록의 고정 지출·순이익도 미산출',
    listed.fixed_cost is null and listed.profit is null and listed.profit_rate is null);

  opened:=public.open_sales_draft(s,public.sales_recommended_date(s),draft);
  perform pg_temp.ok('매출 작성 미리보기는 고정 지출과 손익을 미산출',
    opened#>'{payload,summary,fixed_cost}'='null'::jsonb
    and opened#>'{payload,summary,expense}'='null'::jsonb
    and opened#>'{payload,summary,profit}'='null'::jsonb
    and opened#>'{payload,summary,expense_rate}'='null'::jsonb
    and opened#>'{payload,summary,profit_rate}'='null'::jsonb
    and (opened#>>'{payload,summary,fixed_rate_provisional}')::boolean);
  perform pg_temp.ok('작성 완료 손익 계산도 고정 지출과 순이익을 미산출',
    public.sales_day_accounting_summary(s,public.sales_recommended_date(s),null)->'fixed_cost'='null'::jsonb
    and public.sales_day_accounting_summary(s,public.sales_recommended_date(s),null)->'profit'='null'::jsonb);

  perform public.save_fixed_costs(s,previous_month,1000,
    '[{"key":"rent","mode":"total","total":200,"lines":[]}]'::jsonb);
  perform pg_temp.ok('필수 월을 입력하면 실제 비율로 첫 손익 기준선을 기록',
    (select count(*)=1
       and max(fixed_rate)=0.2
       and bool_and(profit_amount is not null)
       and bool_and(is_baseline)
       from public.profit_trends where recipe_id=r));
  perform pg_temp.ok('오래된 10% 비율을 현재 손익으로 기록하지 않음',
    not exists(select 1 from public.profit_trends where recipe_id=r and fixed_rate=0.1));

  set local role postgres;
end $test$;
