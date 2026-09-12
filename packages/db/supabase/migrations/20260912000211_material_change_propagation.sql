-- Material edits: preserve monetary authority, emit linked-menu causes,
-- and avoid generating monetary trends for unchanged/metadata-only saves.
begin;
do $extend$
declare d text; old_text text; new_text text; facade text;
begin
  d:=replace(pg_get_functiondef('public.recipe_edit_material_apply_v2(uuid,jsonb)'::regprocedure),chr(13),'');
  if to_regprocedure('public.recipe_edit_material_apply_v3(uuid,jsonb)') is not null then raise exception '0211: writer already exists'; end if;
  d:=replace(d,'FUNCTION public.recipe_edit_material_apply_v2(', 'FUNCTION public.recipe_edit_material_apply_v3(');
  old_text:='declare v_id uuid := nullif(p_payload->>''id'','''')::uuid; v_name text := btrim(p_payload->>''name'');';
  new_text:=old_text||E'\n  v_before public.materials; v_after public.materials; v_costs jsonb; rec record;\n  v_old numeric; v_new numeric; v_ch jsonb; v_corr uuid:=gen_random_uuid();';
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0211 declaration anchor'; end if;
  d:=replace(d,old_text,new_text);
  old_text:='  if v_id is null then';
  new_text:=$new$  if v_id is not null then
    select * into v_before from public.materials where id=v_id and store_id=p_store for update;
    if found and row(v_before.name,v_before.category_id,v_before.unit_cost,v_before.unit_label,v_before.memo)
      is not distinct from row(v_name,nullif(p_payload->>'category_id','')::uuid,
        coalesce((p_payload->>'unit_cost')::numeric,v_before.unit_cost),
        coalesce(nullif(p_payload->>'unit_label',''),v_before.unit_label),nullif(p_payload->>'memo','')) then return v_id; end if;
    select coalesce(jsonb_object_agg(q.recipe_id,q.amount),'{}'::jsonb) into v_costs
      from (select ec.recipe_id,sum(ec.amount_per_serving) amount from public.recipe_extra_costs ec
        where ec.store_id=p_store and exists(select 1 from public.recipe_extra_costs linked
          where linked.recipe_id=ec.recipe_id and linked.material_id=v_id)
        group by ec.recipe_id) q;
  end if;
$new$||old_text;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0211 before anchor'; end if;
  d:=replace(d,old_text,new_text);
  old_text:=$old$  update recipe_extra_costs ec
     set amount_per_serving = m.unit_cost * ec.qty
    from materials m
   where m.id = v_id and ec.material_id = v_id;

  perform recompute_recipe(r.id, 'recipe', null)
     from recipes r
    where r.store_id = p_store and r.active
      and exists (select 1 from recipe_extra_costs ec where ec.recipe_id = r.id and ec.material_id = v_id);$old$;
  new_text:=$new$  select * into v_after from public.materials where id=v_id and store_id=p_store;
  update public.recipe_extra_costs ec set amount_per_serving=v_after.unit_cost*ec.qty,name=v_after.name
    where ec.store_id=p_store and ec.material_id=v_id
      and row(ec.amount_per_serving,ec.name) is distinct from row(v_after.unit_cost*ec.qty,v_after.name);
  for rec in select r.id,r.active from public.recipes r where r.store_id=p_store
    and exists(select 1 from public.recipe_extra_costs ec where ec.recipe_id=r.id and ec.material_id=v_id) loop
    v_old:=coalesce((v_costs->>rec.id::text)::numeric,0);
    select coalesce(sum(amount_per_serving),0) into v_new from public.recipe_extra_costs where recipe_id=rec.id;
    v_ch:=change_line('extra_cost','부자재비',v_old,v_new,'원','derived')
      || change_line('material_name','부자재명',v_before.name,v_after.name,null,'derived');
    if v_old is distinct from v_new and rec.active then perform public.recompute_recipe(rec.id,'recipe',null); end if;
    perform public.record_entity_change(p_store,'recipe',rec.id,'material',
      case when v_old is distinct from v_new then '부자재 단가 반영' else '부자재 정보 반영' end,
      v_ch,v_old is distinct from v_new,v_id,v_corr,
      v_after.name||case when v_old is distinct from v_new then ' 단가 변경' else ' 이름 변경' end);
  end loop;$new$;
  old_text:=replace(old_text,chr(13),''); new_text:=replace(new_text,chr(13),'');
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0211 propagation anchor'; end if;
  execute replace(d,old_text,new_text);
  facade:=pg_get_functiondef('public.save_material(uuid,jsonb)'::regprocedure);
  old_text:='public.recipe_edit_material_apply_v2(p_store,p_payload)';
  if (length(facade)-length(replace(facade,old_text,'')))/length(old_text)<>1 then raise exception '0211 facade anchor'; end if;
  execute replace(facade,old_text,'public.recipe_edit_material_apply_v3(p_store,p_payload)');
end $extend$;
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_edit_material_apply_v3(uuid,jsonb) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.recipe_edit_material_apply_v3(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recipe_edit_material_apply_v3(uuid,jsonb) to margincook_rpc_executor;

-- Item composition with an identical ratio does not create a new financial point.
do $fixed$
declare d text; old_text text:='    perform recompute_recipe(rec.id, ''fixed'', v_day);';
begin
  d:=pg_get_functiondef('public.e4_fixed_cost_saved(uuid,text,numeric)'::regprocedure);
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0211 fixed anchor'; end if;
  execute replace(d,old_text,'    if p_prev_rate is null or p_prev_rate is distinct from v_rate then '||old_text||' end if;');
end $fixed$;
select public.assert_no_rpc_overloads();
commit;
