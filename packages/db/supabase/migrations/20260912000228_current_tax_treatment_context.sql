begin;
do $patch$
declare d text; a text := '''sales_channel_code'',''hall'');';
begin
  d:=pg_get_functiondef('public.recipe_tax_app_state(uuid,uuid)'::regprocedure);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '0228 current treatment context anchor must occur once';
  end if;
  execute replace(d,a,'''sales_channel_code'',''hall'',''treatment'',
      public.tax_menu_change_basis(p_store,v_settings_date,p_recipe)->p_recipe::text->''treatment'');');
end $patch$;
commit;
