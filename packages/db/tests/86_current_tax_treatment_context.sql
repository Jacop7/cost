set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare stage text; u uuid; s uuid; d date; bd uuid; p jsonb; v jsonb; body jsonb;
  inherited uuid; explicit_taxable uuid; exempt_menu uuid; category_menu uuid; untouched uuid; x jsonb; n bigint;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('상속·정확한 대기 '||stage,'Asia/Seoul')->>'store_id')::uuid;
    d:=public.store_local_date(s);
    p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[{"code":"food","name":"식품","treatment":"taxable","active":true}]}';
    v:=public.save_tax_configuration(s,'{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}',p,null,null,null,null);
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,'name','상속','price',11000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb);
    inherited:=public.save_recipe(s,body);
    explicit_taxable:=public.save_recipe(s,body||jsonb_build_object('name','명시 과세','request_id',gen_random_uuid()::text));
    exempt_menu:=public.save_recipe(s,body||jsonb_build_object('name','명시 면세','request_id',gen_random_uuid()::text));
    category_menu:=public.save_recipe(s,body||jsonb_build_object('name','카테고리','request_id',gen_random_uuid()::text));
    untouched:=public.save_recipe(s,body||jsonb_build_object('name','기본','request_id',gen_random_uuid()::text));
    x:=public.save_menu_tax_override(s,inherited,(v->>'profile_id')::uuid,null,null,0);
    perform public.save_menu_tax_override(s,explicit_taxable,(v->>'profile_id')::uuid,null,'taxable',0);
    perform public.save_menu_tax_override(s,exempt_menu,(v->>'profile_id')::uuid,null,'exempt',0);
    perform public.save_menu_tax_override(s,category_menu,(v->>'profile_id')::uuid,'food',null,0);
    perform pg_temp.ok(stage||': 기본값 신규 저장은 상속 표시·UI 선택 null',
      exists(select 1 from public.menu_tax_overrides where recipe_id=inherited and inherit_default)
      and public.recipe_tax_app_state(s,inherited)->'treatment'='null'::jsonb);
    perform pg_temp.ok(stage||': 같은 기본값 저장 무변경·판본 유지',
      public.save_menu_tax_override(s,inherited,(v->>'profile_id')::uuid,null,null,1)->>'changed'='false');
    perform pg_temp.raises(stage||': 상속도 오래된 판본 거부',format('select public.save_menu_tax_override(%L::uuid,%L::uuid,%L::uuid,null,null,0)',s,inherited,v->>'profile_id'),'45009');
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    perform pg_temp.ok(stage||': 현재 견적은 메뉴의 명시 면세 기준을 포함',
      public.recipe_tax_app_state(s,exempt_menu)#>>'{quote_context,treatment}'='exempt');
    x:=public.save_menu_tax_override(s,exempt_menu,(v->>'profile_id')::uuid,null,'taxable',1);
    perform pg_temp.ok(stage||': 예약 편집 과세와 현재 적용 과세를 분리',
      public.recipe_tax_app_state(s,exempt_menu)->>'treatment'='taxable'
      and public.recipe_tax_app_state(s,exempt_menu)#>>'{quote_context,treatment}'=case when stage in ('open','break') then 'exempt' else 'taxable' end);
    if stage in ('open','break') then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 견적과 과세 기준 함께 전환',
        public.recipe_tax_app_state(s,exempt_menu)#>>'{quote_context,treatment}'='taxable'
        and (public.recipe_tax_app_state(s,exempt_menu)#>>'{quote,tax_total}')::numeric=1000);
    end if;
    set local role postgres;
  end loop;
end $test$;
