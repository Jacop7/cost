-- 0202 · 예약 편집 metadata를 보존하고 현재 날짜의 시장/quote provenance를 추가한다.
-- JSONB facade 두 개만 바꾼다. 날짜별 quote, 쓰기 RPC, 테이블/ACL은 그대로다.
begin;

do $patch$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_before jsonb;
  v_after jsonb;
  v_defs text[] := array[]::text[];
  v_anchor text;
  v_projection text := $projection$jsonb_build_object(
      'id',v_current_market.id,'store_id',v_current_market.store_id,
      'country_code',v_current_market.country_code,'region_code',v_current_market.region_code,
      'currency_code',v_current_market.currency_code,
      'minor_unit',public.international_currency_minor_unit(v_current_market.currency_code),
      'business_locale_code',v_current_market.business_locale_code,
      'price_basis',v_current_market.price_basis,
      'effective_from',v_current_market.effective_from,'effective_to',v_current_market.effective_to,
      'revision',v_current_market.revision)$projection$;
begin
  select jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl,
    'config',proconfig,'definer',prosecdef,'volatility',provolatile,
    'return_type',prorettype,'argtypes',proargtypes::text,'argnames',proargnames) order by oid)
    into v_before from pg_proc where oid in (
      'public.international_tax_app_state(uuid)'::regprocedure,
      'public.recipe_tax_app_state(uuid,uuid)'::regprocedure);

  -- Validate both definitions before executing either. The transaction also
  -- rolls back the first replacement if execution of the second ever fails.
  foreach v_oid in array array[
    'public.international_tax_app_state(uuid)'::regprocedure::oid,
    'public.recipe_tax_app_state(uuid,uuid)'::regprocedure::oid] loop
    v_def := replace(pg_get_functiondef(v_oid),chr(13),'');
    if position('v_current_market' in v_def)>0 or position('''quote_context''' in v_def)>0 then
      raise exception '0202: facade already contains current context';
    end if;
    foreach v_anchor in array array['declare'||chr(10),'  perform public.assert_my_store(p_store);'] loop
      if (length(v_def)-length(replace(v_def,v_anchor,'')))/length(v_anchor)<>1 then
        raise exception '0202: common anchors must each occur exactly once';
      end if;
    end loop;
    v_new := replace(v_def,'declare'||chr(10),$decl$declare
  v_local_date date;
  v_current_market public.store_market_profiles%rowtype;
$decl$);
    v_new := replace(v_new,'  perform public.assert_my_store(p_store);',$scope$  perform public.assert_my_store(p_store);
  v_local_date := public.store_local_date(p_store);
  select * into v_current_market from public.store_market_profiles m
   where m.store_id=p_store and m.effective_from<=v_local_date
     and (m.effective_to is null or v_local_date<=m.effective_to)
   order by m.effective_from desc limit 1;$scope$);

    if v_oid='public.international_tax_app_state(uuid)'::regprocedure::oid then
      v_anchor := '    ''local_date'',public.store_local_date(p_store),';
      if (length(v_new)-length(replace(v_new,v_anchor,'')))/length(v_anchor)<>1 then
        raise exception '0202: app date anchor must occur exactly once';
      end if;
      v_new := replace(v_new,v_anchor,'    ''local_date'',v_local_date,'||chr(10)||
        '    ''current_market'',case when v_current_market.id is null then null else '||v_projection||' end,');
    else
      v_new := replace(v_new,'declare'||chr(10),$decl$declare
  v_current_tax public.store_tax_profiles%rowtype;
  v_quote_context jsonb;
$decl$);
      v_anchor := '  v_quote:=public.current_recipe_tax_quote(p_recipe,public.store_local_date(p_store));';
      if (length(v_new)-length(replace(v_new,v_anchor,'')))/length(v_anchor)<>1 then
        raise exception '0202: recipe date anchor must occur exactly once';
      end if;
      v_new := replace(v_new,v_anchor,$quote$  v_quote:=public.current_recipe_tax_quote(p_recipe,v_local_date);
  if v_quote is not null then
    select * into v_current_tax from public.store_tax_profiles t
     where t.store_id=p_store and t.market_profile_id=v_current_market.id
       and t.effective_from<=v_local_date
       and (t.effective_to is null or v_local_date<=t.effective_to)
     order by t.effective_from desc limit 1;
    if v_current_market.id is null or v_current_tax.id is null then
      raise exception '현재 견적의 시장 기준을 확인하지 못했어요'
        using errcode='22000',detail='CURRENT_QUOTE_CONTEXT_MISMATCH';
    end if;
    v_quote_context:=jsonb_build_object('local_date',v_local_date,
      'market',$quote$||v_projection||$quote$,
      'tax_profile_id',v_current_tax.id,'tax_profile_revision',v_current_tax.revision,
      'sales_channel_code','hall');
  end if;$quote$);
      v_anchor := '    ''price_basis'',v_market.price_basis,''quote'',v_quote,';
      if (length(v_new)-length(replace(v_new,v_anchor,'')))/length(v_anchor)<>1 then
        raise exception '0202: recipe response anchor must occur exactly once';
      end if;
      v_new := replace(v_new,v_anchor,v_anchor||chr(10)||'    ''quote_context'',v_quote_context,');
    end if;
    v_defs := array_append(v_defs,v_new);
  end loop;
  foreach v_new in array v_defs loop execute v_new; end loop;

  select jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl,
    'config',proconfig,'definer',prosecdef,'volatility',provolatile,
    'return_type',prorettype,'argtypes',proargtypes::text,'argnames',proargnames) order by oid)
    into v_after from pg_proc where oid in (
      'public.international_tax_app_state(uuid)'::regprocedure,
      'public.recipe_tax_app_state(uuid,uuid)'::regprocedure);
  if v_before is distinct from v_after then
    raise exception '0202: facade execution contract changed';
  end if;
end
$patch$;

commit;
