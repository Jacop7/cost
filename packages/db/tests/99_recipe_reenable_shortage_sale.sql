set local role postgres;

do $test$
declare
  u uuid := gen_random_uuid();
  s uuid;
  i uuid;
  r uuid;
  d date;
  rev text;
  shortage jsonb;
  item jsonb;
begin
  insert into auth.users(id) values(u);
  perform pg_temp.as_owner(u);
  s := (public.create_store('메뉴 재개 부족 판매','Asia/Seoul')->>'store_id')::uuid;
  d := public.store_local_date(s);
  i := public.save_ingredient(s,'{"contract_version":3,"name":"부족 재료","base_unit":"g"}');
  perform public.quick_inbound(s,i,50,200,1,null,d,gen_random_uuid()::text);
  r := pg_temp.save_recipe_fixture(s,jsonb_build_object(
    'name','재개 메뉴','price',10000,
    'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',100))
  ));

  rev := public.recipe_detail(r)->>'edit_revision';
  perform public.save_recipe(s,jsonb_build_object(
    'contract_version',2,'patch','active','request_id',gen_random_uuid()::text,
    'id',r,'expected_revision',rev,'active',false
  ));
  perform pg_temp.ok('판매 중지 상태를 서버가 보존',not (select active from public.recipes where id=r));

  rev := public.recipe_detail(r)->>'edit_revision';
  perform public.save_recipe(s,jsonb_build_object(
    'contract_version',2,'patch','active','request_id',gen_random_uuid()::text,
    'id',r,'expected_revision',rev,'active',true
  ));
  perform pg_temp.ok('사용자 재개 뒤 메뉴는 판매 가능 상태',(select active from public.recipes where id=r));

  set local role postgres;
  insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
  values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d));
  perform pg_temp.as_owner(u);

  shortage := public.sale_shortages(s,d,jsonb_build_array(
    jsonb_build_object('recipe_id',r,'qty_hall',1)
  ));
  select ingredient.value into item
    from jsonb_array_elements(shortage->'recipes') recipe,
         jsonb_array_elements(recipe.value->'ingredients') ingredient
   where recipe.value->>'recipe_id'=r::text and ingredient.value->>'ingredient_id'=i::text;
  perform pg_temp.ok('재개 메뉴의 부족 경고가 판매 증가분 1개를 사용',item is not null);
  perform pg_temp.eq('판매 증가분 필요량 100g',(item->>'need')::numeric,100,0.001);
  perform pg_temp.eq('부족 판정은 현재 재고 50g을 숨기지 않음',(item->>'stock')::numeric,50,0.001);

  perform pg_temp.e10(s,d,r,1);
  perform pg_temp.eq('부족 경고 뒤에도 허용된 판매 전량을 차감',public.stock_total_base(i),-50,0.001);
  perform pg_temp.eq('음수 재고에서도 원장 합계와 현재고 일치',
    (select coalesce(sum(count_delta),0) from public.inventory_events where ingredient_id=i),
    public.stock_total_base(i),0.001);
  perform pg_temp.ok('판매 뒤에도 재개 상태 유지',(select active from public.recipes where id=r));
end $test$;
