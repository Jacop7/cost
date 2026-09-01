do $synthetic$
declare
  v_i integer;
  v_owner uuid;
  v_store uuid;
  v_market_result jsonb;
  v_tax_result jsonb;
  v_market uuid;
  v_tax uuid;
  v_components jsonb;
  v_quote jsonb;
  v_prefs jsonb;
  v_settings jsonb;
  v_saved_language text;
  v_summary text:='';
  v_country text[]:=array['KR','US','GB','AU','CA'];
  v_region text[]:=array[null,'US-NY',null,null,'CA-ON'];
  v_currency text[]:=array['KRW','USD','GBP','AUD','CAD'];
  v_locale text[]:=array['ko-KR','en-US','en-GB','en-AU','en-CA'];
  v_language text[]:=array['en','ko','en','ko','en'];
  v_basis text[]:=array['tax_inclusive','tax_exclusive','tax_inclusive','tax_inclusive','tax_exclusive'];
  v_rate numeric[]:=array[10,8.875,20,10,13];
  v_listed numeric[]:=array[12000,10,12,11,10];
  v_tax_expected numeric[]:=array[1091,0.89,2,1,1.30];
  v_net_expected numeric[]:=array[10909,10,10,10,10];
  v_customer_expected numeric[]:=array[12000,10.89,12,11,11.30];
begin
  if public.app_capabilities()#>>'{minimum_supported_app_version}' <> '0.2.0'
     or not (public.app_capabilities()#>>'{international_tax,read_enabled}')::boolean
     or not (public.app_capabilities()#>>'{international_tax,write_enabled}')::boolean then
    raise exception 'SYNTHETIC_CAPABILITY_NOT_ACTIVE';
  end if;

  insert into auth.users(id)
  select ('a71f0000-0000-0000-0000-00000000000' || n)::uuid
    from generate_series(1,5) n;
  set local role margincook_rpc_executor;
  perform set_config('request.headers','{"x-margincook-app-version":"0.2.0"}',true);

  for v_i in 1..5 loop
    v_owner:=('a71f0000-0000-0000-0000-00000000000' || v_i)::uuid;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
    v_store:=(public.create_store('INTL synthetic '||v_country[v_i],case v_country[v_i]
      when 'US' then 'America/New_York' when 'GB' then 'Europe/London'
      when 'AU' then 'Australia/Sydney' when 'CA' then 'America/Toronto'
      else 'Asia/Seoul' end)->>'store_id')::uuid;

    v_prefs:=public.get_user_preferences();
    perform public.save_app_language(v_language[v_i],(v_prefs->>'revision')::integer);
    v_market_result:=public.save_store_market_profile(v_store,jsonb_build_object(
      'country_code',v_country[v_i],'region_code',v_region[v_i],
      'currency_code',v_currency[v_i],'business_locale_code',v_locale[v_i],
      'price_basis',v_basis[v_i]),null,null);
    v_market:=(v_market_result->>'profile_id')::uuid;

    v_tax_result:=public.save_store_tax_profile(v_store,jsonb_build_object(
      'default_treatment','taxable',
      'components',jsonb_build_array(jsonb_build_object(
        'key','primary','kind','primary','name','Primary tax','rate_pct',v_rate[v_i],
        'jurisdiction_level',case when v_country[v_i] in ('US','CA') then 'state' else 'national' end,
        'calculation_basis','primary_tax_exclusive',
        'applies_to_treatments',jsonb_build_array('taxable'),'sort_order',0,
        'remittance',jsonb_build_object('hall','merchant','delivery','merchant','takeout','merchant'))),
      'categories',jsonb_build_array(
        jsonb_build_object('code','standard','name','Standard','treatment','taxable','active',true),
        jsonb_build_object('code','zero_rated','name','Zero rate','treatment','zero_rated','active',true),
        jsonb_build_object('code','exempt','name','Exempt','treatment','exempt','active',true))),null,null);
    v_tax:=(v_tax_result->>'profile_id')::uuid;

    -- 앱 facade 저장을 마쳤으므로 내부 구성행 검산은 소유자 역할에서 읽는다.
    reset role;
    select jsonb_agg(jsonb_build_object(
      'component_id',c.id,'kind',c.kind,'rate_pct',c.rate_pct,
      'calculation_basis',c.calculation_basis,
      'applies_to_treatments',to_jsonb(c.applies_to_treatments),
      'remittance_owner',r.remittance_owner) order by c.sort_order,c.id)
      into v_components from public.store_tax_components c
      join public.channel_tax_remittance r
        on r.tax_component_id=c.id and r.sales_channel_code='hall'
     where c.tax_profile_id=v_tax;
    v_settings:=public.international_tax_app_state(v_store);
    v_saved_language:=public.get_user_preferences()->>'app_language';

    v_quote:=public.calculate_international_tax(
      v_basis[v_i]::public.tax_price_basis,
      public.international_currency_minor_unit(v_currency[v_i]::public.international_currency_code),
      'taxable',v_listed[v_i],v_components);

    if v_settings#>>'{market_profile,country_code}' <> v_country[v_i]
       or v_settings#>>'{market_profile,currency_code}' <> v_currency[v_i]
       or v_settings#>>'{market_profile,business_locale_code}' <> v_locale[v_i]
       or v_settings#>>'{tax_profile,id}' <> v_tax::text
       or v_saved_language <> v_language[v_i]
       or (v_quote->>'tax_total')::numeric <> v_tax_expected[v_i]
       or (v_quote->>'net_sales')::numeric <> v_net_expected[v_i]
       or (v_quote->>'customer_total')::numeric <> v_customer_expected[v_i]
       or (public.calculate_international_tax(v_basis[v_i]::public.tax_price_basis,
          public.international_currency_minor_unit(v_currency[v_i]::public.international_currency_code),
          'zero_rated',v_listed[v_i],v_components)->>'tax_total')::numeric <> 0
       or (public.calculate_international_tax(v_basis[v_i]::public.tax_price_basis,
          public.international_currency_minor_unit(v_currency[v_i]::public.international_currency_code),
          'exempt',v_listed[v_i],v_components)->>'tax_total')::numeric <> 0 then
      raise exception 'SYNTHETIC_COUNTRY_MISMATCH country=% settings=% quote=%',
        v_country[v_i],v_settings,v_quote;
    end if;
    v_summary:=v_summary||format('%s/%s/%s/%s tax=%s net=%s customer=%s; ',
      v_country[v_i],v_currency[v_i],v_locale[v_i],v_language[v_i],
      v_quote->>'tax_total',v_quote->>'net_sales',v_quote->>'customer_total');
    set local role margincook_rpc_executor;
  end loop;

  -- 이 예외가 단일 DO 문 전체를 롤백한다. 호출자는 정확한 marker만 성공으로 인정한다.
  raise exception 'SYNTHETIC_ROLLBACK_OK %',v_summary using errcode='P0001';
end
$synthetic$;
