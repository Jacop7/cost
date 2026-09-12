begin;
-- Audit proposed edits with the same pending profile as other configuration changes.
-- Historical sales and inventory valuation continue to use their original event dates.
create function public.pending_recipe_tax_quote_for_price(p_recipe uuid,p_price numeric)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select public.recipe_tax_quote_for_price(r.id,public.next_unopened_business_date(r.store_id),p_price)
  from public.recipes r where r.id=p_recipe
$$;
revoke all on function public.pending_recipe_tax_quote_for_price(uuid,numeric) from public,anon,authenticated,service_role;
grant execute on function public.pending_recipe_tax_quote_for_price(uuid,numeric) to margincook_rpc_executor;
do $patch$
declare sig text; d text; a text; b text; i integer;
begin
  for sig,a,b in select * from (values
    ('public.save_ingredient(uuid,jsonb)','public.recipe_tax_quote_for_price(rec.id,v_day,rec.price)','public.pending_recipe_tax_quote_for_price(rec.id,rec.price)'),
    ('public.recipe_edit_apply_v3(uuid,jsonb)','public.recipe_tax_quote_for_price(v_id,v_day,v_before.price)','public.pending_recipe_tax_quote_for_price(v_id,v_before.price)'),
    ('public.recipe_edit_apply_v3(uuid,jsonb)','public.recipe_tax_quote_for_price(v_id,v_day,(p_payload->>''price'')::numeric)','public.pending_recipe_tax_quote_for_price(v_id,(p_payload->>''price'')::numeric)'),
    ('public.e1_confirm_inbound(uuid,numeric,text,date)','public.recipe_tax_quote_for_price(rec.recipe_id,v_today,v_price0)','public.pending_recipe_tax_quote_for_price(rec.recipe_id,v_price0)'),
    ('public.e11_inbound_reverted(uuid,text)','public.recipe_tax_quote_for_price(rec.recipe_id,v_day,v_price0)','public.pending_recipe_tax_quote_for_price(rec.recipe_id,v_price0)')
  ) x(sig,a,b) loop
    d:=pg_get_functiondef(sig::regprocedure);
    i:=(length(d)-length(replace(d,a,'')))/length(a);
    if i<>1 then raise exception '0221 audit quote anchor %: %',sig,i; end if;
    execute replace(d,a,b);
  end loop;
end $patch$;
commit;
