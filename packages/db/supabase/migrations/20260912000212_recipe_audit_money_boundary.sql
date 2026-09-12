-- Audit every composition change, but add profit points only for money changes.
begin;
do $patch$
declare d text; old_text text; new_text text;
begin
  d:=replace(pg_get_functiondef('public.recipe_edit_apply_v3(uuid,jsonb)'::regprocedure),chr(13),'');
  old_text:='  perform e3_recipe_saved(v_id, nullif(p_payload->>''occurred_at'','''')::date);';
  new_text:='  if v_new then '||old_text||' end if;';
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0212 e3 anchor'; end if;
  d:=replace(d,old_text,new_text);
  old_text:='    v_money := v_composition or (v_before.price';
  new_text:=$new$    if v_before.price is distinct from (p_payload->>'price')::numeric
      or v_mat0 is distinct from v_mat1 or v_ext0 is distinct from v_ext1
      or v_tax0 is distinct from v_tax1 or v_net0 is distinct from v_net1 then
      perform e3_recipe_saved(v_id, nullif(p_payload->>'occurred_at','')::date);
    end if;
    v_money := v_composition or (v_before.price$new$;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0212 money anchor'; end if;
  d:=replace(d,old_text,new_text);
  -- A freeform cost label changes the audit description, not the sales basis.
  old_text:='      or (v_shape0->''extras'' is distinct from v_shape1->''extras'');';
  new_text:=$new$      or ((select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from
        (select case when e->0='null'::jsonb then jsonb_build_array(e->0,e->1,e->3) else e end x
         from jsonb_array_elements(v_shape0->'extras') e) q)
        is distinct from
        (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from
        (select case when e->0='null'::jsonb then jsonb_build_array(e->0,e->1,e->3) else e end x
         from jsonb_array_elements(v_shape1->'extras') e) q));$new$;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0212 extras anchor'; end if;
  execute replace(d,old_text,new_text);

  d:=pg_get_functiondef('public.change_event_json(public.entity_change_events)'::regprocedure);
  old_text:='    ''source_name'', case p_event.source_type';
  new_text:=old_text||E'\n      when ''material'' then (select name from public.materials where id=p_event.source_entity_id and store_id=p_event.store_id)';
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0212 source-name anchor'; end if;
  execute replace(d,old_text,new_text);
end $patch$;
select public.assert_no_rpc_overloads();
commit;
