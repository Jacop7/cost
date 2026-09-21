begin;

-- 기간 매출의 메뉴 행은 이름이 아니라 recipe_id로 구분한다. 삭제 후 같은 이름이나
-- 띄어쓰기가 다른 이름으로 다시 등록해도 과거 메뉴를 현재 메뉴와 합치지 않는다.
-- 기존 권위 집계는 그대로 보존하고, 현재 recipes 행의 삭제 상태만 응답에 덧붙인다.
alter function public.sales_authoritative_range_detail(uuid,date,date)
  rename to sales_authoritative_range_detail_base_0121;

revoke all on function public.sales_authoritative_range_detail_base_0121(uuid,date,date)
  from public,anon,authenticated,service_role;

create function public.sales_authoritative_range_detail(
  p_store uuid,p_from date,p_to date
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_result jsonb;
  v_menu jsonb;
begin
  v_result:=public.sales_authoritative_range_detail_base_0121(p_store,p_from,p_to);

  select coalesce(jsonb_agg(
      row_value || jsonb_build_object(
        'is_deleted',
        case
          when nullif(row_value->>'recipe_id','') is null then true
          else coalesce((
            select r.deleted_at is not null
              from public.recipes r
             where r.store_id=p_store
               and r.id=(row_value->>'recipe_id')::uuid
          ),true)
        end
      ) order by ord
    ),'[]'::jsonb)
    into v_menu
    from jsonb_array_elements(coalesce(v_result->'menu','[]'::jsonb))
      with ordinality rows(row_value,ord);

  return jsonb_set(v_result,'{menu}',v_menu,true);
end $fn$;

comment on function public.sales_authoritative_range_detail(uuid,date,date) is
  '기간 매출 권위 상세(0121). 메뉴는 recipe_id별로 분리하고 soft-delete 여부를 is_deleted로 제공한다.';

grant create on schema public to costkeep_rpc_executor;
alter function public.sales_authoritative_range_detail(uuid,date,date)
  owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.sales_authoritative_range_detail(uuid,date,date)
  from public,anon,service_role;
grant execute on function public.sales_authoritative_range_detail(uuid,date,date)
  to authenticated;

notify pgrst,'reload schema';
commit;
