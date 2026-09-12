begin;
create function public.applicable_tax_change_items(p_items jsonb,p_treatment public.tax_treatment)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(x order by n),'[]') from jsonb_array_elements(coalesce(p_items,'[]')) with ordinality a(x,n)
  where p_treatment is null or not (x ? 'applies_to_treatments')
    or case when x->>'kind'='primary' then p_treatment='taxable'
      else x->'applies_to_treatments' ? p_treatment::text end
$$;
create function public.tax_financial_change_rules(p_items jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(x-'key'-'name'-'sort_order' order by (x-'key'-'name'-'sort_order')::text),'[]')
  from jsonb_array_elements(coalesce(p_items,'[]')) x
$$;
revoke all on function public.applicable_tax_change_items(jsonb,public.tax_treatment),public.tax_financial_change_rules(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.applicable_tax_change_items(jsonb,public.tax_treatment),public.tax_financial_change_rules(jsonb) to margincook_rpc_executor;
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.propagate_tax_menu_change(uuid,date,jsonb,uuid)'::regprocedure);
  d:=replace(d,'monetary boolean;','monetary boolean; affects boolean; before_rules text; after_rules text;');
  a:='    if a is null or b is null or a=b then continue; end if;';
  if position(a in d)=0 then raise exception '0225 applied comparison anchor'; end if;
  d:=replace(d,a,'    if a is null or b is null then continue; end if;
    a:=a||jsonb_build_object(''rules'',public.applicable_tax_change_items(a->''rules'',(a->>''treatment'')::public.tax_treatment),
      ''components'',public.applicable_tax_change_items(a->''components'',(a->>''treatment'')::public.tax_treatment));
    b:=b||jsonb_build_object(''rules'',public.applicable_tax_change_items(b->''rules'',(b->>''treatment'')::public.tax_treatment),
      ''components'',public.applicable_tax_change_items(b->''components'',(b->>''treatment'')::public.tax_treatment));
    if a=b then continue; end if;');
  d:=replace(d,'before_label:=public.tax_rule_change_label','before_rules:=public.tax_rule_change_label');
  d:=replace(d,'after_label:=public.tax_rule_change_label','after_rules:=public.tax_rule_change_label');
  a:='    material:=public.recipe_material_cost(rec.id);';
  if position(a in d)=0 then raise exception '0225 financial comparison anchor'; end if;
  d:=replace(d,a,'    affects:=monetary or a->''treatment'' is distinct from b->''treatment''
      or a->''price_basis'' is distinct from b->''price_basis''
      or public.tax_financial_change_rules(a->''rules'') is distinct from public.tax_financial_change_rules(b->''rules'');
'||a);
  a:='    if a->''rules'' is distinct from b->''rules'' and changes=''[]''::jsonb then';
  if position(a in d)=0 then raise exception '0225 rule label anchor'; end if;
  d:=replace(d,a,'    changes:=changes||public.change_line(''tax_rules'',''세금 계산·납부 설정'',coalesce(before_rules,''없음''),coalesce(after_rules,''없음''),null,''derived'');
'||a);
  a:='changes,true,null,corr,';
  if position(a in d)=0 then raise exception '0225 affects anchor'; end if;
  execute replace(d,a,'changes,affects,null,corr,');
end $patch$;
commit;
