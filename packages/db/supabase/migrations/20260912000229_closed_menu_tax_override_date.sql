begin;
do $patch$
declare d text; a text := 'return greatest(d,m.effective_from,t.effective_from);';
begin
  d:=pg_get_functiondef('public.current_tax_settings_date(uuid)'::regprocedure);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0229 closed tax date anchor must occur once';
  end if;
  execute replace(d,a,'return greatest(d,m.effective_from,t.effective_from,
    (select max(o.effective_from) from public.menu_tax_overrides o where o.store_id=p_store and o.tax_profile_id=t.id));');
end $patch$;
commit;
