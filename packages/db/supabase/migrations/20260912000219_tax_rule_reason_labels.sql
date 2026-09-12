begin;
create function public.tax_rule_change_label(p_rules jsonb)
returns text language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(string_agg(coalesce(x->>'name','세금')||' '||coalesce(x->>'rate_pct','0')||'% · '
    ||case x->>'calculation_basis' when 'primary_tax_inclusive' then '부가세 포함 금액 기준' else '부가세 미포함 금액 기준' end
    ||' · 적용: '||(select string_agg(case treatment when 'taxable' then '일반 과세' when 'zero_rated' then '0% 과세' when 'exempt' then '면세' else treatment end,', ' order by treatment)
      from jsonb_array_elements_text(x->'applies_to_treatments') treatment)
    ||' · '||(select string_agg(case channel when 'hall' then '매장' when 'delivery' then '배달' else '포장' end||': '
        ||case x#>>array['remittance',channel] when 'marketplace' then '플랫폼 대납' else '매장 직접 납부' end,', ' order by n)
      from unnest(array['hall','delivery','takeout']) with ordinality c(channel,n)),
    ' / ' order by (x->>'sort_order')::integer,x->>'key'),'없음') from jsonb_array_elements(p_rules) x
$$;
revoke all on function public.tax_rule_change_label(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.tax_rule_change_label(jsonb) to margincook_rpc_executor;
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.propagate_tax_menu_change(uuid,date,jsonb,uuid)'::regprocedure);
  a:='    material:=public.recipe_material_cost(rec.id);';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0219 reason label anchor'; end if;
  execute replace(d,a,'    if jsonb_typeof(a->''rules'')=''array'' then before_label:=public.tax_rule_change_label(a->''rules''); end if;
    if jsonb_typeof(b->''rules'')=''array'' then after_label:=public.tax_rule_change_label(b->''rules''); end if;
'||a);
end $patch$;
commit;
