begin;

-- A sales-stopped menu still belongs to its category. Preserve the existing
-- ownership/business-scope locking facade and all non-menu category behavior.
do $patch$
declare sig text; source text; anchor text; replacement text;
begin
  foreach sig in array array['public.recipe_edit_category_delete_v2(uuid)','public.settings_lists(uuid)'] loop
    source:=pg_get_functiondef(sig::regprocedure);
    if sig='public.recipe_edit_category_delete_v2(uuid)' then
      anchor:='from recipes where category_id = p_id and active';
      replacement:='from recipes where category_id = p_id and deleted_at is null';
    else
      anchor:='from recipes r where r.category_id = c.id and r.active';
      replacement:='from recipes r where r.category_id = c.id and r.deleted_at is null';
    end if;
    if (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1 then
      raise exception 'category delete guard source anchor mismatch: %',sig;
    end if;
    execute replace(source,anchor,replacement);
  end loop;
end $patch$;

notify pgrst, 'reload schema';
commit;
