-- ═══════════════════════════════════════════════════════════════
-- 44 · INTL-1F 국제 시장·세금·메뉴 과세 설정 쓰기 계약
-- ═══════════════════════════════════════════════════════════════

create function pg_temp.market_payload(
  p_country text,p_region text,p_currency text,p_locale text,p_basis text default 'tax_inclusive'
) returns jsonb language sql immutable as $h$
  select jsonb_build_object(
    'country_code',p_country,'region_code',p_region,'currency_code',p_currency,
    'business_locale_code',p_locale,'price_basis',p_basis)
$h$;

create function pg_temp.tax_payload(p_rate numeric default 10) returns jsonb
language sql immutable as $h$
  select jsonb_build_object(
    'default_treatment','taxable',
    'components',jsonb_build_array(jsonb_build_object(
      'key','primary','kind','primary','name','VAT','rate_pct',p_rate,
      'jurisdiction_level','national','calculation_basis','primary_tax_exclusive',
      'applies_to_treatments',jsonb_build_array('taxable'),'sort_order',0,
      'remittance',jsonb_build_object('hall','merchant','delivery','merchant','takeout','merchant'))),
    'categories',jsonb_build_array(
      jsonb_build_object('code','standard','name','Standard','treatment','taxable','active',true),
      jsonb_build_object('code','zero_rated','name','Zero rate','treatment','zero_rated','active',true),
      jsonb_build_object('code','exempt','name','Exempt','treatment','exempt','active',true)))
$h$;

do $disabled$
begin
  perform pg_temp.raises('capability 전에는 국제 설정 쓰기가 실패 폐쇄된다',format(
    'select save_store_market_profile(%L::uuid,%L::jsonb,null,null)',pg_temp.store(),
    pg_temp.market_payload('KR',null,'KRW','ko-KR')),'22000');
end
$disabled$;

select set_config('margincook.international_tax_force','owner_test',true);

do $market$
declare
  v_owner uuid:=pg_temp.new_owner();
  v_store uuid;
  v jsonb;
  v_first uuid;
  v_rev integer;
begin
  perform pg_temp.as_owner(v_owner);
  v:=create_store('국제 설정 시험','America/New_York');
  v_store:=(v->>'store_id')::uuid;

  v:=save_store_market_profile(v_store,
    pg_temp.market_payload('US','US-NY','USD','en-US','tax_exclusive'),null,null);
  v_first:=(v->>'profile_id')::uuid;
  v_rev:=(v->>'revision')::integer;
  perform pg_temp.ok('미국 시장 프로필은 다음 미개장 영업일부터 판본 1로 저장된다',
    (v->>'changed')::boolean and v_rev=1
    and (select country_code='US' and region_code='US-NY' and currency_code='USD'
          and price_basis='tax_exclusive' from store_market_profiles where id=v_first)
    and (v->>'effective_from')::date>store_local_date(v_store));

  v:=save_store_market_profile(v_store,
    pg_temp.market_payload('US','US-NY','USD','en-US','tax_exclusive'),v_first,v_rev);
  perform pg_temp.ok('같은 시장 설정은 행·판본을 올리지 않는다',
    not (v->>'changed')::boolean and (v->>'profile_id')::uuid=v_first
    and (select count(*) from store_market_profiles where store_id=v_store)=1);
  perform pg_temp.raises('낡은 시장 판본은 거부한다',format(
    'select save_store_market_profile(%L::uuid,%L::jsonb,%L::uuid,0)',v_store,
    pg_temp.market_payload('US','US-NY','USD','en-US','tax_exclusive'),v_first),'45009');
  perform pg_temp.raises('미국에 캐나다 지역을 섞을 수 없다',format(
    'select save_store_market_profile(%L::uuid,%L::jsonb,%L::uuid,%s)',v_store,
    pg_temp.market_payload('US','CA-ON','USD','en-US','tax_exclusive'),v_first,v_rev),'22000');

  v:=save_store_market_profile(v_store,
    pg_temp.market_payload('GB',null,'GBP','en-GB','tax_inclusive'),v_first,v_rev);
  perform pg_temp.ok('금액 원장이 없으면 미래 프로필을 새 판본으로 교체한다',
    (v->>'changed')::boolean and (v->>'revision')::integer=2
    and (select count(*) from store_market_profiles where store_id=v_store and effective_to is null)=1
    and (select country_code='GB' from store_market_profiles where id=(v->>'profile_id')::uuid));
  perform pg_temp.as_owner(pg_temp.owner());
end
$market$;

do $profiles$
declare
  v jsonb;
  v_market uuid;
  v_market_rev integer;
  v_tax uuid;
  v_tax_rev integer;
  v_recipe uuid:=pg_temp.rcp('제육볶음');
  v_stamp timestamptz;
begin
  -- 기존 금액 장부가 있는 시드 매장은 같은 KRW 계약의 최초 확인만 허용한다.
  v:=save_store_market_profile(pg_temp.store(),
    pg_temp.market_payload('KR',null,'KRW','ko-KR','tax_inclusive'),null,null);
  v_market:=(v->>'profile_id')::uuid;
  v_market_rev:=(v->>'revision')::integer;
  perform pg_temp.raises('금액 원장 뒤 국가·통화 계약 변경은 거부한다',format(
    'select save_store_market_profile(%L::uuid,%L::jsonb,%L::uuid,%s)',pg_temp.store(),
    pg_temp.market_payload('US','US-CA','USD','en-US','tax_exclusive'),v_market,v_market_rev),'45017');

  v:=save_store_tax_profile(pg_temp.store(),pg_temp.tax_payload(10),null,null);
  v_tax:=(v->>'profile_id')::uuid;
  v_tax_rev:=(v->>'revision')::integer;
  perform pg_temp.ok('세금 프로필은 기본세 하나·카테고리 셋·채널 납부 셋을 원자 저장한다',
    (v->>'changed')::boolean and v_tax_rev=1
    and (select count(*) from store_tax_components where tax_profile_id=v_tax)=1
    and (select count(*) from tax_category_catalog where tax_profile_id=v_tax)=3
    and (select count(*) from channel_tax_remittance r join store_tax_components c
      on c.id=r.tax_component_id where c.tax_profile_id=v_tax)=3);
  v_stamp:=(select created_at from store_tax_profiles where id=v_tax);
  v:=save_store_tax_profile(pg_temp.store(),pg_temp.tax_payload(10),v_tax,v_tax_rev);
  perform pg_temp.ok('같은 세금 설정은 새 프로필을 만들지 않는다',
    not (v->>'changed')::boolean and (v->>'profile_id')::uuid=v_tax
    and (select created_at from store_tax_profiles where id=v_tax)=v_stamp);
  perform pg_temp.raises('낡은 세금 프로필 판본은 거부한다',format(
    'select save_store_tax_profile(%L::uuid,%L::jsonb,%L::uuid,0)',
    pg_temp.store(),pg_temp.tax_payload(9),v_tax),'45009');
  perform pg_temp.raises('기본세가 없는 세금 설정은 거부한다',format(
    'select save_store_tax_profile(%L::uuid,%L::jsonb,%L::uuid,%s)',pg_temp.store(),
    jsonb_set(pg_temp.tax_payload(10),'{components,0,kind}','"additional"'::jsonb),v_tax,v_tax_rev),'22000');

  v:=save_menu_tax_override(pg_temp.store(),v_recipe,v_tax,'zero_rated',null,0);
  perform pg_temp.ok('메뉴 과세 예외는 카테고리와 판본을 저장한다',
    (v->>'changed')::boolean and (v->>'revision')::integer=1
    and (recipe_tax_app_state(pg_temp.store(),v_recipe)->>'override_revision')::integer=1);
  v:=save_menu_tax_override(pg_temp.store(),v_recipe,v_tax,'zero_rated',null,1);
  perform pg_temp.ok('같은 메뉴 예외 재저장은 판본을 올리지 않는다',
    not (v->>'changed')::boolean and (v->>'revision')::integer=1);
  perform pg_temp.raises('낡은 메뉴 과세 판본은 거부한다',format(
    'select save_menu_tax_override(%L::uuid,%L::uuid,%L::uuid,%L,null,0)',
    pg_temp.store(),v_recipe,v_tax,'exempt'),'45009');
  v:=save_menu_tax_override(pg_temp.store(),v_recipe,v_tax,null,null,1);
  perform pg_temp.ok('기본 과세로 복귀해도 행을 지우지 않아 ABA 판본이 생기지 않는다',
    (v->>'changed')::boolean and (v->>'revision')::integer=2
    and (select tax_category is null and treatment='taxable' and revision=2
      from menu_tax_overrides where recipe_id=v_recipe and tax_profile_id=v_tax));
end
$profiles$;

do $acl$
begin
  perform pg_temp.ok('국제 설정 표는 앱 롤에 직접 열리지 않고 세 facade만 열린다',
    not has_table_privilege('authenticated','public.store_market_profiles','insert')
    and not has_table_privilege('authenticated','public.store_tax_profiles','update')
    and has_function_privilege('authenticated',
      'public.save_store_market_profile(uuid,jsonb,uuid,integer)','execute')
    and has_function_privilege('authenticated',
      'public.save_store_tax_profile(uuid,jsonb,uuid,integer)','execute')
    and has_function_privilege('authenticated',
      'public.save_menu_tax_override(uuid,uuid,uuid,text,tax_treatment,integer)','execute'));
  perform pg_temp.ok('국제 설정 내부 도우미는 앱·RPC 실행 역할에 닫혀 있다',
    not has_function_privilege('authenticated','public.store_has_money_ledger(uuid)','execute')
    and not has_function_privilege('margincook_rpc_executor','public.tax_profile_payload(uuid)','execute'));
end
$acl$;
