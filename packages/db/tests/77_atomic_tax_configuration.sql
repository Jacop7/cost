set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare stage text; u uuid; s uuid; r uuid; exempt_menu uuid; bd uuid; d date; m jsonb; p jsonb; v jsonb; old_v jsonb; pending boolean; n bigint; count_before bigint; ingredient uuid;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('원자 세금 저장 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    m:='{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}';
    p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[{"code":"standard","name":"일반","treatment":"taxable","active":true}]}';
    v:=public.save_tax_configuration(s,m,p,null,null,null,null);
    r:=public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','메뉴','price',12000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb));
    exempt_menu:=public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','면세 메뉴','price',5000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb));
    perform public.save_menu_tax_override(s,exempt_menu,(v->>'profile_id')::uuid,null,'exempt',0);
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u); pending:=stage in ('open','break');
    ingredient:=public.save_ingredient(s,'{"name":"실제 입고","base_unit":"g","per_volume":1000,"purchase_price":4000}');
    perform public.quick_inbound(s,ingredient,1000,4000,1,null,d,gen_random_uuid()::text);
    set local role postgres;
    perform pg_temp.ok(stage||': 실제 입고로 금액 원장 존재',public.store_has_money_ledger(s));
    perform pg_temp.as_owner(u);
    perform pg_temp.raises(stage||': 원장 이후 국가·통화 변경 차단',format('select public.save_tax_configuration(%L::uuid,%L::jsonb,%L::jsonb,%L::uuid,%s,%L::uuid,%s)',s,
      '{"country_code":"GB","region_code":null,"currency_code":"GBP","business_locale_code":"en-GB","price_basis":"tax_inclusive"}',p,v->>'market_profile_id',v->>'market_revision',v->>'profile_id',v->>'revision'),'45017');
    old_v:=v; count_before:=(public.store_configuration_history(s,'tax')->>'count')::bigint;
    perform pg_temp.raises(stage||': 잘못된 세금 입력이면 시장 변경도 롤백',format(
      'select public.save_tax_configuration(%L::uuid,%L::jsonb,%L::jsonb,%L::uuid,%s,%L::uuid,%s)',s,
      jsonb_set(m,'{price_basis}','"tax_exclusive"'),jsonb_set(p,'{components}','[]'),v->>'market_profile_id',v->>'market_revision',v->>'profile_id',v->>'revision'),'22000');
    perform pg_temp.ok(stage||': 실패 뒤 시장·세금 판본·설정 이력 불변',
      (public.international_tax_app_state(s)#>>'{market_profile,id}')=v->>'market_profile_id'
      and (public.store_configuration_history(s,'tax')->>'count')::bigint=count_before);
    m:=jsonb_set(m,'{price_basis}','"tax_exclusive"'); p:=jsonb_set(p,'{components,0,rate_pct}','20');
    n:=(select count(*) from public.entity_change_events where entity_id=r);
    v:=public.save_tax_configuration(s,m,p,(v->>'market_profile_id')::uuid,(v->>'market_revision')::integer,(v->>'profile_id')::uuid,(v->>'revision')::integer);
    perform pg_temp.ok(stage||': 금액 원장 이후에도 가격 기준·세율 동시 변경 가능',v->>'changed'='true');
    perform pg_temp.ok(stage||': 두 설정 합성 변경은 메뉴당 최종 사건 1건',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r));
    perform pg_temp.ok(stage||': 현재 세금·순매출은 영업 상태에 맞춰 표시',
      (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=case when pending then 1091 else 2400 end
      and (public.recipe_tax_app_state(s,r)#>>'{quote,net_sales}')::numeric=case when pending then 10909 else 12000 end
      and (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending);
    perform pg_temp.ok(stage||': 시장 교체 뒤에도 메뉴 명시 면세 설정 유지',
      (public.recipe_tax_quote_for_price(exempt_menu,(v->>'effective_from')::date,5000)->>'tax_total')::numeric=0);
    perform pg_temp.raises(stage||': 오래된 두 프로필 판본 저장 차단',format(
      'select public.save_tax_configuration(%L::uuid,%L::jsonb,%L::jsonb,%L::uuid,%s,%L::uuid,%s)',s,m,p,
      old_v->>'market_profile_id',old_v->>'market_revision',old_v->>'profile_id',old_v->>'revision'),'45009');
    old_v:=v;
    v:=public.save_tax_configuration(s,m,p,(v->>'market_profile_id')::uuid,(v->>'market_revision')::integer,(v->>'profile_id')::uuid,(v->>'revision')::integer);
    perform pg_temp.ok(stage||': 무변경은 두 판본·메뉴 이력 유지',v->>'changed'='false'
      and v->>'profile_id'=old_v->>'profile_id' and v->>'market_profile_id'=old_v->>'market_profile_id'
      and (select count(*)=n+1 from public.entity_change_events where entity_id=r));
    p:=jsonb_set(p,'{components,0,rate_pct}','30');
    v:=public.save_store_tax_profile(s,p,(v->>'profile_id')::uuid,(v->>'revision')::integer);
    perform pg_temp.ok(stage||': 일반 프로필 변경도 명시 면세 설정 보존',
      (public.recipe_tax_quote_for_price(exempt_menu,(v->>'effective_from')::date,5000)->>'tax_total')::numeric=0);
    if pending then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 최종 세금·순매출 적용',
        (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=3600
        and (public.recipe_tax_app_state(s,r)#>>'{quote,net_sales}')::numeric=12000
        and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
    end if;
    set local role postgres;
  end loop;
  perform pg_temp.as_owner(u);
  perform public.save_fixed_costs(s,to_char(d,'YYYY-MM'),100000,'[{"key":"labor","total":40000}]');
  perform pg_temp.ok('미포함 세금에서 고정지출 이력도 순매출에서 세금을 재차 차감하지 않음',
    exists(select 1 from public.entity_change_events e cross join lateral jsonb_array_elements(e.changes) x
      where entity_id=r and source_type='fixed_cost' and x->>'key'='profit' and (x->>'after')::numeric=7200));
  set local role postgres;
  perform pg_temp.as_owner(pg_temp.owner());
  perform pg_temp.raises('다른 매장 원자 저장 차단',format('select public.save_tax_configuration(%L::uuid,%L::jsonb,%L::jsonb,null,null,null,null)',s,m,p),'42501');
  perform pg_temp.ok('앱에 원자 저장 내부 writer·복구 helper 직접 호출 금지',
    not has_function_privilege('authenticated','public.tax_market_apply_v2(uuid,jsonb,uuid,integer)','execute')
    and not has_function_privilege('authenticated','public.tax_profile_apply_v2(uuid,jsonb,uuid,integer)','execute')
    and not has_function_privilege('authenticated','public.restore_tax_override_carry(uuid,date,jsonb)','execute'));
end $test$;
