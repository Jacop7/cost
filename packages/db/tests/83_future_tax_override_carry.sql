set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare mode text; u uuid; s uuid; d date; p jsonb; m jsonb; mr jsonb; v jsonb; body jsonb; r uuid; inherited uuid; category_menu uuid;
begin
  foreach mode in array array['tax_only','atomic_future_market'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('미래 예약 승계 '||mode,'Asia/Seoul')->>'store_id')::uuid;d:=public.store_local_date(s);
    m:='{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}';
    p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[{"code":"food","name":"식품","treatment":"zero_rated","active":true}]}';
    if mode='tax_only' then mr:=public.save_store_market_profile(s,m,null,null); end if;
    set local role postgres;
    -- Disposable closed-day fixtures create a genuine D+2 reservation via the writers.
    insert into public.business_days(store_id,business_date,status,planned_close_at,closed_at,close_method,snapshot)
      select s,day,'closed',clock_timestamp(),clock_timestamp(),'manual','{}' from unnest(array[d,d+1]) day;
    perform pg_temp.as_owner(u);
    if mode='tax_only' then v:=public.save_store_tax_profile(s,p,null,null);
    else v:=public.save_tax_configuration(s,m,p,null,null,null,null); end if;
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,'name','명시 면세','price',11000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb);
    r:=public.save_recipe(s,body);
    inherited:=public.save_recipe(s,body||jsonb_build_object('name','기본값','request_id',gen_random_uuid()::text));
    category_menu:=public.save_recipe(s,body||jsonb_build_object('name','분류','request_id',gen_random_uuid()::text));
    perform public.save_menu_tax_override(s,r,(v->>'profile_id')::uuid,null,'exempt',0);
    perform public.save_menu_tax_override(s,inherited,(v->>'profile_id')::uuid,null,null,0);
    perform public.save_menu_tax_override(s,category_menu,(v->>'profile_id')::uuid,'food',null,0);
    perform pg_temp.ok(mode||': 기존 미래 예외 3행 확인',
      (select count(*)=3 from public.menu_tax_overrides where tax_profile_id=(v->>'profile_id')::uuid and effective_from=d+2));
    set local role postgres;
    -- Removing only these synthetic fixtures reproduces the supported legacy promotion path.
    delete from public.business_days where store_id=s;
    perform pg_temp.as_owner(u);
    if mode='tax_only' then
      v:=public.save_store_tax_profile(s,p,(v->>'profile_id')::uuid,(v->>'revision')::integer);
    else
      v:=public.save_tax_configuration(s,m,p,(v->>'market_profile_id')::uuid,(v->>'market_revision')::integer,(v->>'profile_id')::uuid,(v->>'revision')::integer);
    end if;
    perform pg_temp.ok(mode||': 미래 예약을 오늘로 승격하면서 면세·분류·상속·판본 보존',
      (v->>'effective_from')::date=d
      and (select count(*)=3 from public.menu_tax_overrides where tax_profile_id=(v->>'profile_id')::uuid and effective_from=d and revision=1)
      and exists(select 1 from public.menu_tax_overrides where recipe_id=r and tax_profile_id=(v->>'profile_id')::uuid and treatment='exempt' and not inherit_default)
      and exists(select 1 from public.menu_tax_overrides where recipe_id=inherited and tax_profile_id=(v->>'profile_id')::uuid and inherit_default)
      and exists(select 1 from public.menu_tax_overrides where recipe_id=category_menu and tax_profile_id=(v->>'profile_id')::uuid and tax_category='food'));
    perform pg_temp.ok(mode||': 기존 활성 경계에서 명시 면세·영세 금액 유지',
      (public.recipe_tax_quote_for_price(r,d+2,11000)->>'tax_total')::numeric=0
      and (public.recipe_tax_quote_for_price(category_menu,d+2,11000)->>'tax_total')::numeric=0
      and (public.recipe_tax_quote_for_price(inherited,d+2,11000)->>'tax_total')::numeric=1000);
    set local role postgres;
  end loop;
end $test$;
