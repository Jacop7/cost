set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare u uuid:=gen_random_uuid(); s uuid; m jsonb; t jsonb; p jsonb; h jsonb; n bigint; i integer;
begin
  insert into auth.users(id) values(u);
  perform pg_temp.as_owner(u);
  s:=(public.create_store('설정 수정 내역 시험','Asia/Seoul')->>'store_id')::uuid;
  p:='{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}';
  m:=public.save_store_market_profile(s,p,null,null);
  perform pg_temp.ok('시장 최초 저장을 기록한다',(public.store_configuration_history(s,'tax')->>'count'='1'));
  perform public.save_store_market_profile(s,p,(m->>'profile_id')::uuid,(m->>'revision')::integer);
  perform pg_temp.ok('시장 무변경은 기록을 늘리지 않는다',(public.store_configuration_history(s,'tax')->>'count'='1'));
  p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[{"code":"standard","name":"일반","treatment":"taxable","active":true}]}';
  t:=public.save_store_tax_profile(s,p,null,null);
  p:=jsonb_set(p,'{components,0,rate_pct}','12');
  t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  h:=public.store_configuration_history(s,'tax');
  perform pg_temp.ok('예약 프로필 교체 후에도 세율 전후와 서버 적용일을 보존한다',
    h#>>'{items,0,before_value,components,0,rate_pct}'='10' and h#>>'{items,0,after_value,components,0,rate_pct}'='12' and h#>>'{items,0,effective_from}'=t->>'effective_from');
  n:=(h->>'count')::bigint;
  perform public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  perform pg_temp.ok('동일 세금 저장은 수정 내역을 추가하지 않는다',(public.store_configuration_history(s,'tax')->>'count')::bigint=n);
  perform public.save_fixed_costs(s,'2030-01',10000,'[{"key":"labor","total":1000,"mode":"total","lines":[]}]');
  perform public.save_fixed_costs(s,'2030-01',10000,'[{"key":"labor","total":1000,"mode":"total","lines":[]}]');
  perform public.save_fixed_costs(s,'2030-01',20000,'[{"key":"labor","total":2000,"mode":"total","lines":[]}]');
  h:=public.store_configuration_history(s,'fixed_cost','2030-01');
  perform pg_temp.ok('월별 고정 지출은 무변경을 제외하고 전후 금액을 기록한다',h->>'count'='2' and h#>>'{items,0,before_value,total_revenue}'='10000' and h#>>'{items,0,after_value,items,0,total}'='2000');
  perform pg_temp.ok('다른 월과 섞이지 않는다',public.store_configuration_history(s,'fixed_cost','2030-02')->>'count'='0');
  for i in 1..22 loop perform public.save_fixed_costs(s,'2030-02',i*100,'[]'); end loop;
  h:=public.store_configuration_history(s,'fixed_cost','2030-02');
  perform pg_temp.ok('20건 커서와 전체 건수를 반환한다',jsonb_array_length(h->'items')=20 and h->>'count'='22' and h->>'next_cursor' is not null);
  h:=public.store_configuration_history(s,'fixed_cost','2030-02',h->>'next_cursor');
  perform pg_temp.ok('다음 페이지는 중복 없이 나머지 두 건이다',jsonb_array_length(h->'items')=2 and h->>'next_cursor' is null);
  perform pg_temp.as_owner(pg_temp.owner());
  perform pg_temp.raises('다른 매장 수정 내역 차단',format('select public.store_configuration_history(%L::uuid,''tax'')',s),'42501');
  perform pg_temp.ok('앱에 이력 직접쓰기와 내부 기록 함수가 열리지 않는다',
    not has_table_privilege('authenticated','public.store_configuration_changes','INSERT') and not has_table_privilege('authenticated','public.store_configuration_changes','UPDATE') and not has_table_privilege('authenticated','public.store_configuration_changes','DELETE') and not has_function_privilege('authenticated','public.record_configuration_change(uuid,text,text,jsonb,jsonb,date)','EXECUTE'));
end $test$;
