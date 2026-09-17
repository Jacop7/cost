-- Exact archived identity, pagination, and authenticated tenant isolation.
set local role postgres;
do $test$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); s uuid; other_s uuid;
  i uuid; other_i uuid; old_id uuid:=gen_random_uuid(); other_old uuid:=gen_random_uuid(); n integer;
  first_page jsonb; second_page jsonb;
begin
  insert into auth.users(id) values(u),(other_u);
  perform pg_temp.as_owner(u); s:=(create_store('과거 기록 소유자','Asia/Seoul')->>'store_id')::uuid;
  i:=save_ingredient(s,'{"name":"이관 용기","base_unit":"ea","per_volume":1,"stock_tracking":true,"purchase_price":300}');
  perform pg_temp.as_owner(other_u); other_s:=(create_store('다른 소유자','Asia/Seoul')->>'store_id')::uuid;
  other_i:=save_ingredient(other_s,'{"name":"이관 용기","base_unit":"ea","per_volume":1,"stock_tracking":true,"purchase_price":900}');
  set local role postgres;
  insert into material_retirement_archive(id,store_id,source_material,source_extras,ingredient_id,disposition)
    values(old_id,s,'{}','[]',i,'migrated'),(other_old,other_s,'{}','[]',other_i,'migrated');
  for n in 1..23 loop
    insert into store_configuration_changes(store_id,kind,source,before_value,after_value)
      values(s,'material','material',jsonb_build_object('material_id',old_id,'unit_cost',n),jsonb_build_object('material_id',old_id,'unit_cost',n+1));
  end loop;
  insert into store_configuration_changes(store_id,kind,source,before_value,after_value)
    values(other_s,'material','material','{}',jsonb_build_object('material_id',other_old,'unit_cost',999));
  perform pg_temp.as_owner(u); set local role authenticated;
  first_page:=ingredient_legacy_material_history(s,i);
  second_page:=ingredient_legacy_material_history(s,i,first_page->>'next_cursor');
  perform pg_temp.ok('실제 앱 역할이 해당 재료 23건만 조회',first_page->>'count'='23' and jsonb_array_length(first_page->'items')=20);
  perform pg_temp.ok('다음 페이지 3건·끝 커서 없음',jsonb_array_length(second_page->'items')=3 and second_page->>'next_cursor' is null);
  perform pg_temp.ok('페이지 중복 없음',not exists(select 1 from jsonb_array_elements(first_page->'items') a join jsonb_array_elements(second_page->'items') b on a->>'id'=b->>'id'));
  perform pg_temp.ok('원래 단가와 원본 ID 보존',first_page#>>'{items,0,after_value,unit_cost}'='24' and first_page#>>'{items,0,after_value,material_id}'=old_id::text);
  perform pg_temp.ok('과거 기록을 현재 적용 상태로 추정하지 않음',not(first_page#>'{items,0}' ? 'application_mode'));
  perform pg_temp.ok('타 매장 재료 ID를 섞으면 빈 결과',ingredient_legacy_material_history(s,other_i)->>'count'='0');
  perform pg_temp.raises('타 매장 직접 조회 거부',format('select ingredient_legacy_material_history(%L::uuid,%L::uuid)',other_s,other_i),'42501');
  perform pg_temp.raises('잘못된 커서 거부',format('select ingredient_legacy_material_history(%L::uuid,%L::uuid,''invalid'')',s,i),'22000');
  perform pg_temp.raises('아카이브 직접 열람 거부','select * from material_retirement_archive','42501');
end $test$;
