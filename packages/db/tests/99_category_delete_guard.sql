do $test$
declare s uuid:=pg_temp.store(); c uuid; moved uuid; i uuid; r uuid; n int;
begin
  insert into categories(store_id,kind,name) values(s,'recipe','삭제 검사 메뉴 분류') returning id into c;
  insert into categories(store_id,kind,name) values(s,'recipe','이동할 메뉴 분류') returning id into moved;
  insert into recipes(store_id,category_id,name,price,base_servings,active)
    values(s,c,'판매 중지 분류 검사',1000,1,false) returning id into r;
  select (x->>'used_count')::int into n from jsonb_array_elements(settings_lists(s)->'recipe_categories') x where x->>'id'=c::text;
  perform pg_temp.eq('판매 중지 메뉴도 카테고리 사용 수 포함',n,1);
  perform pg_temp.raises('판매 중지 메뉴 연결 카테고리 삭제 차단',format('select delete_category(%L::uuid)',c),'23503');
  update recipes set active=true where id=r;
  perform pg_temp.raises('판매 중 메뉴 연결 카테고리 삭제 차단',format('select delete_category(%L::uuid)',c),'23503');
  update recipes set category_id=moved where id=r;
  perform delete_category(c);
  perform pg_temp.ok('메뉴 이동 후 빈 카테고리 삭제 가능',not exists(select 1 from categories where id=c));
  perform pg_temp.ok('이동한 메뉴 보존',exists(select 1 from recipes where id=r and category_id=moved));
  update recipes set active=false,deleted_at=now(),deleted_by=pg_temp.owner(),deletion_base_revision=edit_revision where id=r;
  select (x->>'used_count')::int into n from jsonb_array_elements(settings_lists(s)->'recipe_categories') x where x->>'id'=moved::text;
  perform pg_temp.eq('실제 삭제 메뉴는 현재 카테고리 사용 수 제외',n,0);
  perform delete_category(moved);
  perform pg_temp.ok('삭제 메뉴 행은 보존',exists(select 1 from recipes where id=r and deleted_at is not null));

  insert into categories(store_id,kind,name) values(s,'ingredient','삭제 검사 재료 분류') returning id into c;
  insert into categories(store_id,kind,name) values(s,'ingredient','이동할 재료 분류') returning id into moved;
  i:=save_ingredient(s,jsonb_build_object('name','분류 검사 재료','base_unit','g','per_volume',1,'category_id',c));
  select (x->>'used_count')::int into n from jsonb_array_elements(settings_lists(s)->'categories') x where x->>'id'=c::text;
  perform pg_temp.eq('재료 카테고리 사용 수',n,1);
  perform pg_temp.raises('재료 연결 카테고리 삭제 차단',format('select delete_category(%L::uuid)',c),'23503');
  update ingredients set category_id=moved where id=i;
  perform delete_category(c);
  perform pg_temp.ok('재료 이동 후 빈 카테고리 삭제 가능',not exists(select 1 from categories where id=c));
  perform pg_temp.ok('이동한 재료 보존',exists(select 1 from ingredients where id=i and category_id=moved and active));
end $test$;
