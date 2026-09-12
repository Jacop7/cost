set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare stage text; u uuid; s uuid; r uuid; bd uuid; d date; m jsonb; p jsonb; v jsonb; n bigint;
begin
  foreach stage in array array['open','break'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('순매출만 바뀌는 마감 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    m:='{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}';
    p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[]}';
    v:=public.save_tax_configuration(s,m,p,null,null,null,null);
    r:=public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,'name','메뉴','price',110,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb));
    set local role postgres;
    insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
      values(s,d,stage::public.business_day_status,clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
    perform pg_temp.as_owner(u);
    n:=(select count(*) from public.profit_trends where recipe_id=r);
    m:=jsonb_set(m,'{price_basis}','"tax_exclusive"');p:=jsonb_set(p,'{components,0,rate_pct}','9.09');
    v:=public.save_tax_configuration(s,m,p,(v->>'market_profile_id')::uuid,(v->>'market_revision')::integer,(v->>'profile_id')::uuid,(v->>'revision')::integer);
    perform pg_temp.ok(stage||': 저장 대기 중 이전 순매출100·세금10 유지',
      (public.recipe_tax_app_state(s,r)#>>'{quote,net_sales}')::numeric=100
      and (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=10
      and (select count(*)=n from public.profit_trends where recipe_id=r));
    set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
    perform pg_temp.ok(stage||': 같은 세액10이어도 종료 후 순매출110·순이익 증가 추이 1건',
      (public.recipe_tax_app_state(s,r)#>>'{quote,net_sales}')::numeric=110
      and (select count(*)=n+1 from public.profit_trends where recipe_id=r));
    perform pg_temp.ok(stage||': 종료 추이 원인을 세금으로 분류',
      (select cause='tax' from public.profit_trends where recipe_id=r order by occurred_at desc,id desc limit 1));
    set local role postgres;
  end loop;
end $test$;
