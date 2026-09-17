-- Fractional package quantities now use recipe_lines, in batch units on write.
do $test$
declare s uuid:=pg_temp.store(); category uuid; material uuid; recipe uuid;
  detail jsonb; quantity numeric; event_hash text; day_hash text;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) into event_hash from inventory_events e where store_id=s;
  select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) into day_hash from business_days where store_id=s;
  category:=save_category(s,jsonb_build_object('name','통합 왕복 카테고리','kind','recipe'));
  material:=save_ingredient(s,'{"contract_version":2,"name":"통합 왕복 용기","base_unit":"ea","per_volume":1,"purchase_price":300,"stock_tracking":true}');
  foreach quantity in array array[0.5,2,0.25]::numeric[] loop
    recipe:=pg_temp.save_recipe_fixture(s,jsonb_build_object('name','왕복 '||quantity,'price',12000,'base_servings',10,'category_id',category,
      'lines',jsonb_build_array(jsonb_build_object('ingredient_id',material,'input_qty',quantity*10))));
    detail:=recipe_detail(recipe);
    perform pg_temp.ok('카테고리와 재료 ID 보존',detail->>'category_id'=category::text and detail#>>'{lines,0,ingredient_id}'=material::text);
    perform pg_temp.eq('소수 사용량 1인분 환산',(detail#>>'{lines,0,per_serving}')::numeric,quantity,0);
    perform pg_temp.eq('1인분 재료비',(detail->>'material_cost')::numeric,300*quantity,0);
    perform pg_temp.ok('별도 부자재 비용 제거',(detail->>'extra_cost')::numeric=0 and jsonb_array_length(detail->'extras')=0);
    perform pg_temp.ok('상세 읽기 계약 유지',detail ?& array['last_change','tax','fixed_items','sales_30d','profit_trends']);
    perform pg_temp.save_recipe_fixture(s,jsonb_build_object('id',recipe,'name',detail->>'name','price',13000,'base_servings',10,'category_id',category,
      'lines',jsonb_build_array(jsonb_build_object('ingredient_id',material,'input_qty',(detail#>>'{lines,0,per_serving}')::numeric*10))));
    perform pg_temp.ok('저장 왕복 후 수량 보존',exists(select 1 from recipe_lines where recipe_id=recipe and ingredient_id=material and input_qty=quantity*10));
  end loop;
  perform save_ingredient(s,jsonb_build_object('contract_version',2,'id',material,'name','통합 왕복 용기','base_unit','ea','per_volume',1,'purchase_price',400));
  perform pg_temp.eq('연결 수 유지',(select count(*) from recipe_lines where ingredient_id=material),3,0);
  perform pg_temp.eq('가격 변경이 소수 사용량 원가에 전파',(recipe_detail(recipe)->>'material_cost')::numeric,100,0);
  perform pg_temp.raises('구형 부자재 저장 계약은 거부',format('select pg_temp.save_recipe_fixture(%L::uuid,%L::jsonb)',s,
    jsonb_build_object('name','구형 요청','price',1000,'base_servings',1,'extras',jsonb_build_array(jsonb_build_object('name','용기','qty',1,'amount',100)))::text),'45009');
  perform pg_temp.ok('재고 원장 불변',event_hash=(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from inventory_events e where store_id=s));
  perform pg_temp.ok('과거 영업일 스냅샷 불변',day_hash=(select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) from business_days where store_id=s));
end $test$;
