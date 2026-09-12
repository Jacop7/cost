-- Composition changes affect the sales basis even when their monetary sum is equal.
-- Preserve the sealed v2 writer and its CAS/receipt facade; extend only audit output.
begin;

create function public.recipe_composition_labels(p_recipe uuid)
returns jsonb language sql stable set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'lines',coalesce((select string_agg(i.name||' '||trim_scale(l.input_qty)::text||i.base_unit::text,
       ', ' order by i.name,l.ingredient_id,l.input_qty)
       from public.recipe_lines l join public.ingredients i on i.id=l.ingredient_id
       where l.recipe_id=p_recipe),'없음'),
    'extras',coalesce((select string_agg(e.name||' ×'||trim_scale(e.qty)::text||
       case when e.material_id is null then ' ('||trim_scale(e.amount_per_serving)::text||'원)' else '' end,
       ', ' order by e.name,e.material_id,e.qty,e.amount_per_serving)
       from public.recipe_extra_costs e where e.recipe_id=p_recipe),'없음'));
$$;
revoke all on function public.recipe_composition_labels(uuid) from public,anon,authenticated,service_role;
grant execute on function public.recipe_composition_labels(uuid) to margincook_rpc_executor;

do $extend$
declare d text; old_text text; new_text text; facade text;
begin
  d:=replace(pg_get_functiondef('public.recipe_edit_apply_v2(uuid,jsonb)'::regprocedure),chr(13),'');
  if to_regprocedure('public.recipe_edit_apply_v3(uuid,jsonb)') is not null then
    raise exception '0209: v3 writer already exists';
  end if;
  d:=replace(d,'FUNCTION public.recipe_edit_apply_v2(', 'FUNCTION public.recipe_edit_apply_v3(');
  old_text:='  v_new      boolean;';
  new_text:=old_text||E'\n  v_shape0 jsonb; v_shape1 jsonb; v_labels0 jsonb; v_labels1 jsonb;\n  v_composition boolean; v_category0 text; v_category1 text;';
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0209 declaration anchor'; end if;
  d:=replace(d,old_text,new_text);
  old_text:='    v_mat0 := recipe_material_cost(v_id);';
  new_text:=$new$    v_shape0 := public.recipe_edit_shape_v2(v_id);
    v_labels0 := public.recipe_composition_labels(v_id);
    select name into v_category0 from public.categories where id=v_before.category_id and store_id=p_store;
$new$||old_text;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0209 before anchor'; end if;
  d:=replace(d,old_text,new_text);
  old_text:='    v_mat1 := recipe_material_cost(v_id);';
  new_text:=$new$    v_shape1 := public.recipe_edit_shape_v2(v_id);
    v_labels1 := public.recipe_composition_labels(v_id);
    v_composition := (v_shape0->'lines' is distinct from v_shape1->'lines')
      or (v_shape0->'extras' is distinct from v_shape1->'extras');
    select c.name into v_category1 from public.recipes r left join public.categories c on c.id=r.category_id
      where r.id=v_id and r.store_id=p_store;
$new$||old_text;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0209 after anchor'; end if;
  d:=replace(d,old_text,new_text);
  old_text:='    v_money := (v_before.price';
  new_text:='    v_money := v_composition or (v_before.price';
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0209 application anchor'; end if;
  d:=replace(d,old_text,new_text);
  old_text:='    perform record_entity_change(p_store, ''recipe'', v_id, ''direct'', ''레시피 수정'', v_ch, v_money);';
  new_text:=$new$    v_ch := v_ch
      || change_line('category','카테고리',v_category0,v_category1)
      || case when v_shape0->'lines' is distinct from v_shape1->'lines' then
        jsonb_build_array(jsonb_build_object('key','lines','label','식재료 구성','before',v_labels0->>'lines',
          'after',v_labels1->>'lines','unit',null,'change_kind','direct')) else '[]'::jsonb end
      || case when v_shape0->'extras' is distinct from v_shape1->'extras' then
        jsonb_build_array(jsonb_build_object('key','extras','label','부자재 구성','before',v_labels0->>'extras',
          'after',v_labels1->>'extras','unit',null,'change_kind','direct')) else '[]'::jsonb end;
    perform record_entity_change(p_store, 'recipe', v_id, 'direct', '레시피 수정', v_ch, v_money);$new$;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0209 event anchor'; end if;
  d:=replace(d,old_text,new_text);
  execute d;

  facade:=pg_get_functiondef('public.save_recipe(uuid,jsonb)'::regprocedure);
  old_text:='public.recipe_edit_apply_v2(p_store,v_body ||';
  if (length(facade)-length(replace(facade,old_text,'')))/length(old_text)<>1 then raise exception '0209 facade anchor'; end if;
  execute replace(facade,old_text,'public.recipe_edit_apply_v3(p_store,v_body ||');
end $extend$;

-- Same restricted ownership as v2. No new public RPC or schema CREATE privilege.
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_edit_apply_v3(uuid,jsonb) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.recipe_edit_apply_v3(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recipe_edit_apply_v3(uuid,jsonb) to margincook_rpc_executor;
select public.assert_no_rpc_overloads();
commit;
