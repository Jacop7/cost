begin;
-- Closing compares net sales too: inclusive/exclusive changes can leave tax identical.
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.close_business_day_row(uuid,business_close_method)'::regprocedure);
  a:='if row(current_basis->''price'',current_basis->''material_cost'',current_basis->''extra_cost'',current_basis->''tax'',new_fixed)';
  if position(a in d)=0 then raise exception '0220 close comparison anchor'; end if;
  d:=replace(d,a,'if coalesce((tax_quote->>''net_sales'')::numeric,(current_basis->>''price'')::numeric-(current_basis->>''tax'')::numeric)
      is distinct from coalesce((old_basis#>>''{tax_quote,net_sales}'')::numeric,(old_basis->>''price'')::numeric-(old_basis->>''tax'')::numeric)
      or row(current_basis->''price'',current_basis->''material_cost'',current_basis->''extra_cost'',current_basis->''tax'',new_fixed)');
  a:='when current_basis->''tax'' is distinct from old_basis->''tax'' then ''tax''::public.trend_cause';
  if position(a in d)=0 then raise exception '0220 close cause anchor'; end if;
  d:=replace(d,a,'when current_basis->''tax'' is distinct from old_basis->''tax''
          or coalesce((tax_quote->>''net_sales'')::numeric,(current_basis->>''price'')::numeric-(current_basis->>''tax'')::numeric)
            is distinct from coalesce((old_basis#>>''{tax_quote,net_sales}'')::numeric,(old_basis->>''price'')::numeric-(old_basis->>''tax'')::numeric)
          then ''tax''::public.trend_cause');
  execute d;
end $patch$;
commit;
