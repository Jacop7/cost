-- A zero-price material is still a selected material. A later price must propagate.
-- Keep the sealed v2 normalizer; the current writer and semantic comparison use v3.
begin;
do $patch$
declare d text; old_text text; new_text text; f text; expected integer;
begin
  if to_regprocedure('public.recipe_edit_extra_rows_v3(jsonb)') is not null
    or to_regprocedure('public.recipe_edit_shape_v3(uuid,jsonb)') is not null then raise exception '0213 helpers already exist'; end if;
  d:=replace(pg_get_functiondef('public.recipe_edit_extra_rows_v2(jsonb)'::regprocedure),chr(13),'');
  old_text:=$old$     where coalesce(
             case when m.id is not null then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                  else (x->>'amount')::numeric end, 0) <> 0;$old$;
  old_text:=replace(old_text,chr(13),'');
  new_text:=$new$     where (m.id is not null and coalesce((x->>'qty')::numeric,1)>0)
        or (m.id is null and coalesce((x->>'amount')::numeric,0)<>0);$new$;
  if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception '0213 rows anchor'; end if;
  execute replace(replace(d,old_text,new_text),'FUNCTION public.recipe_edit_extra_rows_v2(', 'FUNCTION public.recipe_edit_extra_rows_v3(');
  d:=pg_get_functiondef('public.recipe_edit_shape_v2(uuid,jsonb)'::regprocedure);
  if (length(d)-length(replace(d,'public.recipe_edit_extra_rows_v2(','')))/length('public.recipe_edit_extra_rows_v2(')<>1 then raise exception '0213 shape anchor'; end if;
  execute replace(replace(d,'FUNCTION public.recipe_edit_shape_v2(', 'FUNCTION public.recipe_edit_shape_v3('),
    'public.recipe_edit_extra_rows_v2(', 'public.recipe_edit_extra_rows_v3(');
  foreach f in array array['public.save_recipe(uuid,jsonb)','public.recipe_edit_apply_v3(uuid,jsonb)'] loop
    d:=pg_get_functiondef(f::regprocedure);
    if (length(d)-length(replace(d,'public.recipe_edit_shape_v2(','')))/length('public.recipe_edit_shape_v2(')<>2 then raise exception '0213 writer shape anchor: %',f; end if;
    d:=replace(d,'public.recipe_edit_shape_v2(', 'public.recipe_edit_shape_v3(');
    if f='public.recipe_edit_apply_v3(uuid,jsonb)' then
      if (length(d)-length(replace(d,'public.recipe_edit_extra_rows_v2(','')))/length('public.recipe_edit_extra_rows_v2(')<>1 then raise exception '0213 writer rows anchor'; end if;
      d:=replace(d,'public.recipe_edit_extra_rows_v2(', 'public.recipe_edit_extra_rows_v3(');
    end if;
    execute d;
  end loop;
end $patch$;
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_edit_extra_rows_v3(jsonb) owner to margincook_rpc_executor;
alter function public.recipe_edit_shape_v3(uuid,jsonb) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.recipe_edit_extra_rows_v3(jsonb),public.recipe_edit_shape_v3(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recipe_edit_extra_rows_v3(jsonb),public.recipe_edit_shape_v3(uuid,jsonb) to margincook_rpc_executor;
select public.assert_no_rpc_overloads();
commit;
