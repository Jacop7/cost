-- F1: additive edit fields only. Preserve the cumulative detail definition and ACL.
-- JSON amount continues to mean amount_per_serving (the row total), never unit cost.
begin;
do $patch$
declare
  original text := replace(pg_get_functiondef('public.recipe_detail(uuid)'::regprocedure),chr(13),'');
  patched text;
  actual text;
  old_category text := $anchor$'memo', r.memo,$anchor$;
  new_category text := $anchor$'memo', r.memo, 'category_id', r.category_id,$anchor$;
  old_extra text := $anchor$'id', ec.id, 'name', ec.name, 'amount', ec.amount_per_serving$anchor$;
  new_extra text := $anchor$'id', ec.id, 'name', ec.name, 'amount', ec.amount_per_serving, 'material_id', ec.material_id, 'qty', ec.qty$anchor$;
  metadata jsonb;
  save_definition text := pg_get_functiondef('public.save_recipe(uuid,jsonb)'::regprocedure);
begin
  if (length(original)-length(replace(original,old_category,'')))/length(old_category) <> 1
     or (length(original)-length(replace(original,old_extra,'')))/length(old_extra) <> 1 then
    raise exception '0198: recipe_detail edit anchors must each occur exactly once';
  end if;
  if position('''category_id''' in original)>0 or position('''material_id''' in original)>0 then
    raise exception '0198: recipe_detail already contains edit fields; inspect the cumulative contract';
  end if;
  select jsonb_build_array(proowner,proacl,prosecdef,proconfig,provolatile) into metadata
    from pg_proc where oid='public.recipe_detail(uuid)'::regprocedure;
  patched := replace(replace(original,old_category,new_category),old_extra,new_extra);
  execute patched;
  actual := replace(pg_get_functiondef('public.recipe_detail(uuid)'::regprocedure),chr(13),'');
  if actual <> patched or replace(replace(actual,new_category,old_category),new_extra,old_extra) <> original then
    raise exception '0198: cumulative recipe_detail contract changed unexpectedly';
  end if;
  if metadata is distinct from (select jsonb_build_array(proowner,proacl,prosecdef,proconfig,provolatile)
      from pg_proc where oid='public.recipe_detail(uuid)'::regprocedure)
     or save_definition is distinct from pg_get_functiondef('public.save_recipe(uuid,jsonb)'::regprocedure) then
    raise exception '0198: detail ACL/attributes or save_recipe changed unexpectedly';
  end if;
end
$patch$;
commit;
