-- Always rollback through _prelude.sql / run.mjs. No actual store records are modified.
set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare u uuid:=gen_random_uuid(); s uuid; r uuid; m jsonb; t jsonb; p jsonb; d date; day_id uuid; frozen jsonb; q jsonb; history_count bigint;
begin
  insert into auth.users(id) values(u);
  perform pg_temp.as_owner(u);
  s:=(public.create_store('영업 상태별 설정 적용','Asia/Seoul')->>'store_id')::uuid;
  d:=public.store_local_date(s);
  m:=public.save_store_market_profile(s,'{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}',null,null);
  p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[{"code":"standard","name":"일반","treatment":"taxable","active":true}]}';
  t:=public.save_store_tax_profile(s,p,null,null);
  perform pg_temp.ok('영업 전 저장은 오늘부터 즉시 적용',t->>'application_mode'='immediate' and (t->>'effective_from')::date=d and (m->>'effective_from')::date=d);
  set local role postgres;
  insert into public.recipes(store_id,name,price,base_servings) values(s,'적용 시험 메뉴',12000,10) returning id into r;
  frozen:=public.build_day_snapshot(s,d);
  perform pg_temp.ok('영업 시작 기준은 영업 전에 저장한 세금', (frozen#>>array['recipes',r::text,'tax'])::numeric=1091);
  insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
    values(s,d,'open',clock_timestamp()+interval '1 hour',frozen) returning id into day_id;
  perform pg_temp.as_owner(u);
  p:=jsonb_set(p,'{components,0,rate_pct}','20');
  t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  q:=public.recipe_tax_app_state(s,r);
  perform pg_temp.ok('영업 중에는 다음 영업 예약과 현재 세금 유지',t->>'application_mode'='next_business' and (t->>'effective_from')::date>d and (q#>>'{quote,tax_total}')::numeric=1091);
  set local role postgres;
  update public.business_days set status='break' where id=day_id;
  perform pg_temp.as_owner(u);
  p:=jsonb_set(p,'{components,0,rate_pct}','30');
  t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  perform pg_temp.ok('브레이크 중에도 같은 영업 기준 유지',t->>'application_mode'='next_business' and (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=1091);
  set local role postgres;
  update public.business_days set status='closed',closed_at=clock_timestamp(),close_method='manual' where id=day_id;
  perform pg_temp.as_owner(u);
  p:=jsonb_set(p,'{components,0,rate_pct}','40');
  t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  q:=public.recipe_tax_app_state(s,r);
  perform pg_temp.ok('종료 후 현재 메뉴에는 새 세금을 즉시 표시',t->>'application_mode'='immediate' and (q#>>'{quote,tax_total}')::numeric=3429 and (q#>>'{quote_context,local_date}')::date=d);
  perform pg_temp.ok('목록과 판매가 시뮬레이션도 같은 즉시 적용값', (select tax=3429 from public.recipe_list(s) where id=r) and (public.recipe_price_simulation(s,r,12000)#>>'{quote,tax_total}')::numeric=3429);
  perform pg_temp.ok('마감 스냅샷과 해당 영업일 세금은 불변', (select snapshot=frozen from public.business_days where id=day_id) and (public.recipe_tax_quote_for_price(r,d,12000)->>'tax_total')::numeric=1091);
  perform pg_temp.ok('수정 내역에도 즉시 적용 여부를 서버가 보존',public.store_configuration_history(s,'tax')#>>'{items,0,application_mode}'='immediate');
  perform pg_temp.ok('조회 오류를 우회하는 공개 내부 함수는 없음',not has_function_privilege('authenticated','public.current_tax_settings_date(uuid)','execute'));
  set local role postgres;
  -- Reproduce a legacy future reservation before any real opening (synthetic day only).
  delete from public.business_days where id=day_id;
  perform pg_temp.as_owner(u);
  t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  perform pg_temp.ok('영업 전 같은 값의 미래 예약도 오늘로 당기고 기간 중복을 만들지 않는다',
    (t->>'changed')::boolean and (t->>'effective_from')::date=d and (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=3429);
  perform pg_temp.ok('같은 설정의 적용 시점 변경도 이력으로 남는다',public.store_configuration_history(s,'tax')#>>'{items,0,application_mode}'='immediate');
  history_count:=(public.store_configuration_history(s,'tax')->>'count')::bigint;
  q:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
  perform pg_temp.ok('같은 적용일과 같은 설정의 재저장은 무변경',q->>'changed'='false');
  perform pg_temp.ok('무변경 재저장은 수정 이력을 중복하지 않음',
    (public.store_configuration_history(s,'tax')->>'count')::bigint=history_count);
  set local role postgres;
  u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('종료 후 첫 세금 설정','Asia/Seoul')->>'store_id')::uuid;
  set local role postgres;
  insert into public.business_days(store_id,business_date,status,planned_close_at,closed_at,close_method,snapshot)
    values(s,d,'closed',clock_timestamp(),clock_timestamp(),'manual','{}');
  insert into public.recipes(store_id,name,price) values(s,'첫 설정 메뉴',12000) returning id into r;
  perform pg_temp.as_owner(u);
  m:=public.save_store_market_profile(s,'{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}',null,null);
  t:=public.save_store_tax_profile(s,p,null,null);
  perform pg_temp.ok('종료 후 처음 등록하는 세금도 현재 메뉴에 즉시 적용',t->>'application_mode'='immediate' and (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=3429);
  perform pg_temp.ok('종료 후 첫 설정이 판매가·메뉴 초안에도 반영된다',
    (public.recipe_price_simulation(s,r,12000)#>>'{quote,tax_total}')::numeric=3429
    and (public.recipe_draft_preview(s,'{"recipe_id":null,"price":12000,"base_servings":10,"target_profit_rate":30,"lines":[],"extras":[]}'::jsonb)#>>'{quote,tax_total}')::numeric=3429);
  set local role postgres;
  perform pg_temp.ok('첫 설정이 과거 마감일의 세금 활성 경계를 바꾸지 않는다',public.recipe_tax_quote_for_price(r,d,12000) is null);
  perform pg_temp.as_owner(u);
  m:=public.save_store_market_profile(s,'{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_exclusive"}',(m->>'profile_id')::uuid,(m->>'revision')::integer);
  perform pg_temp.ok('종료 후 예약 시장과 세금이 있어도 시장 재저장이 FK 오류 없이 성공',m->>'changed'='true');
  t:=public.save_store_tax_profile(s,p,null,null);
  perform pg_temp.ok('교체된 시장에 세금을 다시 연결하고 이전 세금 수정 이력 보존',
    t->>'changed'='true' and (public.store_configuration_history(s,'tax')->>'count')::integer>=2);
  set local role postgres;
  u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('미래 활성 경계 시험','Asia/Seoul')->>'store_id')::uuid;
  set local role postgres;
  insert into public.store_market_profiles(store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
    values(s,'KR','KRW','ko-KR','tax_inclusive',d+2) returning jsonb_build_object('id',id) into m;
  insert into public.store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from) values(s,(m->>'id')::uuid,'taxable',d+2);
  insert into public.recipes(store_id,name,price) values(s,'미래 활성 메뉴',12000) returning id into r;
  insert into public.business_days(store_id,business_date,status,planned_close_at,closed_at,close_method,snapshot)
    values(s,d,'closed',clock_timestamp(),clock_timestamp(),'manual','{}');
  perform pg_temp.ok('즉시 표시가 출시 활성일을 앞당기지 않는다',public.current_tax_settings_date(s)=d and public.current_recipe_tax_quote(r,public.current_tax_settings_date(s)) is null);
end $test$;
