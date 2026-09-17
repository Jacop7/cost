do $test$
declare s uuid:=pg_temp.store(); i uuid; r uuid; result jsonb;
begin
  i:=save_ingredient(s,'{"name":"삭제 차단 시험 재료","base_unit":"g","per_volume":1}');
  insert into recipes(store_id,name,price,base_servings) values(s,'삭제 차단 시험 메뉴',1000,1) returning id into r;
  insert into recipe_lines(store_id,recipe_id,ingredient_id,input_qty) values(s,r,i,1);
  result:=ingredient_delete_check(i);
  perform pg_temp.ok('연결된 메뉴를 삭제 전 조회',not (result->>'can_delete')::boolean);
  perform pg_temp.eq_t('연결 메뉴 이름 반환',result->'menu_names'->>0,'삭제 차단 시험 메뉴');
  perform pg_temp.raises('판매 중 메뉴 연결 삭제 차단',format('select deactivate_ingredient(%L::uuid)',i),'23503');
  update recipes set active=false where id=r;
  perform pg_temp.raises('판매 중지 메뉴 연결도 삭제 차단',format('select deactivate_ingredient(%L::uuid)',i),'23503');
  perform pg_temp.ok('거절 후 재료 활성 유지',(select active from ingredients where id=i));
  -- A genuinely deleted menu only keeps historical links, which must survive.
  update recipes set deleted_at=now(),deleted_by=pg_temp.owner(),deletion_base_revision=edit_revision where id=r;
  perform pg_temp.ok('삭제된 메뉴의 과거 연결은 차단 제외',(ingredient_delete_check(i)->>'can_delete')::boolean);
  perform deactivate_ingredient(i);
  perform pg_temp.ok('연결 해소 재료는 비활성화',(select not active from ingredients where id=i));
  perform pg_temp.eq('과거 연결 행 보존',(select count(*) from recipe_lines where ingredient_id=i),1);
end $test$;
