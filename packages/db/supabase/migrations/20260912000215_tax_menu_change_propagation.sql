-- Compare each affected menu's actual quote, not the profile id. Profile replacement
-- must not manufacture changes for unaffected menus or duplicate financial trends.
begin;
create function public.tax_menu_change_basis(p_store uuid,p_date date,p_recipe uuid default null)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce(jsonb_object_agg(r.id::text,jsonb_build_object(
    'tax',coalesce((q.value->>'tax_total')::numeric,public.tax_of(r.price,r.tax_mode,r.tax_items)),
    'net',coalesce((q.value->>'net_sales')::numeric,r.price-public.tax_of(r.price,r.tax_mode,r.tax_items)),
    'components',coalesce((select jsonb_agg(x-'component_id' order by n)
      from jsonb_array_elements(q.value->'components') with ordinality a(x,n)),r.tax_items),
    'price_basis',m.price_basis,'treatment',coalesce(c.treatment,o.treatment,t.default_treatment),
    'rules',public.tax_profile_payload(t.id)->'components')), '{}')
  from public.recipes r left join lateral (select public.recipe_tax_quote_for_price(r.id,p_date,r.price) value) q on true
  left join public.store_market_profiles m on m.store_id=r.store_id and p_date>=m.effective_from and (m.effective_to is null or p_date<=m.effective_to)
  left join public.store_tax_profiles t on t.market_profile_id=m.id and p_date>=t.effective_from and (t.effective_to is null or p_date<=t.effective_to)
  left join lateral (select * from public.menu_tax_overrides where recipe_id=r.id and tax_profile_id=t.id and effective_from<=p_date order by effective_from desc limit 1) o on true
  left join public.tax_category_catalog c on c.tax_profile_id=t.id and c.code=o.tax_category and c.active
  where r.store_id=p_store and (p_recipe is null or r.id=p_recipe)
$$;
create function public.propagate_tax_menu_change(p_store uuid,p_date date,p_before jsonb,p_recipe uuid default null)
returns void language plpgsql set search_path=public,pg_temp as $$
declare after_values jsonb; rec record; a jsonb; b jsonb; changes jsonb; before_label text; after_label text;
  corr uuid:=gen_random_uuid(); ext numeric; material numeric; fixed numeric; monetary boolean;
begin
  after_values:=public.tax_menu_change_basis(p_store,p_date,p_recipe);
  for rec in select id,price,active from public.recipes where store_id=p_store and (p_recipe is null or id=p_recipe) loop
    a:=p_before->rec.id::text; b:=after_values->rec.id::text;
    if a is null or b is null or a=b then continue; end if;
    monetary:=row((a->>'tax')::numeric,(a->>'net')::numeric) is distinct from row((b->>'tax')::numeric,(b->>'net')::numeric);
    select string_agg(coalesce(x->>'name','세금')||' '||coalesce(x->>'rate_pct',x->>'rate','0')||'%'
      ||case x->>'remittance_owner' when 'merchant' then ' 매장 납부' when 'marketplace' then ' 플랫폼 대납' else '' end,' · ' order by n)
      into before_label from jsonb_array_elements(a->'components') with ordinality t(x,n);
    select string_agg(coalesce(x->>'name','세금')||' '||coalesce(x->>'rate_pct',x->>'rate','0')||'%'
      ||case x->>'remittance_owner' when 'merchant' then ' 매장 납부' when 'marketplace' then ' 플랫폼 대납' else '' end,' · ' order by n)
      into after_label from jsonb_array_elements(b->'components') with ordinality t(x,n);
    material:=public.recipe_material_cost(rec.id);
    select coalesce(sum(amount_per_serving),0) into ext from public.recipe_extra_costs where recipe_id=rec.id;
    fixed:=rec.price*coalesce(public.fixed_cost_rate(p_store,public.store_local_month(p_store)),0);
    changes:=public.change_line('tax','세금',(a->>'tax')::numeric,(b->>'tax')::numeric,'원','derived')
      ||public.change_line('profit','순이익',(a->>'net')::numeric-material-ext-fixed,(b->>'net')::numeric-material-ext-fixed,'원','derived')
      ||public.change_line('tax_components','세금 구성',coalesce(before_label,'없음'),coalesce(after_label,'없음'),null,'derived')
      ||public.change_line('price_basis','메뉴 가격 기준',case a->>'price_basis' when 'tax_inclusive' then '부가세 포함' when 'tax_exclusive' then '부가세 미포함' else '미설정' end,
        case b->>'price_basis' when 'tax_inclusive' then '부가세 포함' when 'tax_exclusive' then '부가세 미포함' else '미설정' end,null,'derived')
      ||public.change_line('tax_treatment','과세 상태',case a->>'treatment' when 'taxable' then '일반 과세' when 'exempt' then '면세' when 'zero_rated' then '0% 과세' else '미설정' end,
        case b->>'treatment' when 'taxable' then '일반 과세' when 'exempt' then '면세' when 'zero_rated' then '0% 과세' else '미설정' end,null,'derived');
    if a->'rules' is distinct from b->'rules' and changes='[]'::jsonb then
      -- Non-hall remittance and equal-amount calculation rule changes still affect sales.
      changes:=jsonb_build_array(jsonb_build_object('key','tax_rules','label','세금 계산·납부 설정',
        'before','이전 설정','after','변경한 설정','unit',null,'change_kind','derived',
        'before_rules',a->'rules','after_rules',b->'rules'));
    end if;
    if changes='[]'::jsonb then continue; end if;
    perform public.record_entity_change(p_store,'recipe',rec.id,
      case when p_recipe is null then 'tax'::public.change_source else 'direct'::public.change_source end,
      case when p_recipe is null then '세금 설정 반영' else '메뉴 세금 수정' end,
      changes,true,null,corr,'세금 항목·요율·납부 설정 변경');
    if monetary and rec.active then perform public.recompute_recipe(rec.id,'tax',public.store_local_date(p_store)); end if;
  end loop;
end $$;
revoke all on function public.tax_menu_change_basis(uuid,date,uuid),public.propagate_tax_menu_change(uuid,date,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.tax_menu_change_basis(uuid,date,uuid),public.propagate_tax_menu_change(uuid,date,jsonb,uuid)
  to margincook_rpc_executor;

do $patch$
declare d text; a text; sig text;
begin
  foreach sig in array array['public.save_store_tax_profile(uuid,jsonb,uuid,integer)',
    'public.save_menu_tax_override(uuid,uuid,uuid,text,public.tax_treatment,integer)'] loop
    d:=replace(pg_get_functiondef(sig::regprocedure),chr(13),'');
    d:=regexp_replace(d,'declare','declare v_menu_before jsonb;','i');
    if sig like '%save_store_tax_profile%' then
      a:='v_effective:=greatest(public.next_unopened_business_date(p_store),v_market.effective_from);';
      if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0215 profile before anchor'; end if;
      d:=replace(d,a,a||' v_menu_before:=public.tax_menu_change_basis(p_store,v_effective);');
      a:='return jsonb_build_object(''changed'',true,''profile_id'',v_new,';
      if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0215 profile after anchor'; end if;
      d:=replace(d,a,'perform public.propagate_tax_menu_change(p_store,v_effective,v_menu_before); '||a);
    else
      a:='v_effective:=greatest(public.next_unopened_business_date(p_store),v_profile.effective_from);';
      if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0215 override before anchor'; end if;
      d:=replace(d,a,a||' v_menu_before:=public.tax_menu_change_basis(p_store,v_effective,p_recipe);');
      a:='return jsonb_build_object(''changed'',true,''revision'',v_revision,';
      if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0215 override after anchor'; end if;
      d:=replace(d,a,'perform public.propagate_tax_menu_change(p_store,v_effective,v_menu_before,p_recipe); '||a);
    end if;
    execute d;
  end loop;
  d:=pg_get_functiondef('public.save_store_tax(uuid,public.tax_mode,jsonb,integer)'::regprocedure);
  a:='p_store, ''recipe'', rec.id, ''fixed_cost'', ''세금 반영''';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0215 legacy source anchor'; end if;
  execute replace(d,a,'p_store, ''recipe'', rec.id, ''tax'', ''세금 반영''');
end $patch$;
select public.assert_no_rpc_overloads();
commit;
