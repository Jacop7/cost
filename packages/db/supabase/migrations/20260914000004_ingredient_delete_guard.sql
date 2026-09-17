begin;

-- Sales stop is not deletion: every undeleted menu owns its ingredient links.
create function public.ingredient_delete_check(p_ingredient uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s uuid; linked jsonb;
begin
  select store_id into s from public.ingredients where id=p_ingredient;
  if s is null then raise exception '재료를 찾을 수 없어요.' using errcode='P0002'; end if;
  perform public.assert_my_store(s);
  select coalesce(jsonb_agg(x.name order by x.name,x.id),'[]'::jsonb) into linked
  from (select distinct r.id,r.name from public.recipe_lines l join public.recipes r on r.id=l.recipe_id
    where l.ingredient_id=p_ingredient and r.store_id=s and r.deleted_at is null) x;
  return jsonb_build_object('can_delete',jsonb_array_length(linked)=0,'menu_names',linked);
end $$;

create or replace function public.deactivate_ingredient(p_ingredient uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s uuid; result jsonb;
begin
  select store_id into s from public.ingredients where id=p_ingredient;
  if s is null then raise exception '재료를 찾을 수 없어요.' using errcode='P0002'; end if;
  perform public.assert_my_store(s);
  perform public.lock_business_scope(s);
  result:=public.ingredient_delete_check(p_ingredient);
  if not (result->>'can_delete')::boolean then
    raise exception '이 재료를 사용하는 메뉴가 %개 있어요. 메뉴에서 먼저 제거해 주세요.',jsonb_array_length(result->'menu_names')
      using errcode='23503';
  end if;
  update public.ingredients set active=false,updated_at=now() where id=p_ingredient and store_id=s;
  delete from public.order_candidates where ingredient_id=p_ingredient and store_id=s;
end $$;

grant create on schema public to costkeep_rpc_executor;
alter function public.ingredient_delete_check(uuid) owner to costkeep_rpc_executor;
alter function public.deactivate_ingredient(uuid) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.ingredient_delete_check(uuid) from public,anon,service_role;
grant execute on function public.ingredient_delete_check(uuid) to authenticated;
commit;
