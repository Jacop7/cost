-- Monetary scope is independent of inventory tracking; history is never backfilled.
do $t$
declare
  s uuid:=pg_temp.store(); r uuid; production uuid; packaging uuid; day date;
  sale uuid; snap jsonb; before_events bigint; waste numeric; registered uuid;
begin
  registered:=save_ingredient(s,jsonb_build_object('contract_version',2,'name','통합 API 등록 검산','base_unit','ea','per_volume',1,'purchase_price',37,'stock_tracking',false));
  perform pg_temp.eq('재고 없이 등록한 재료 단가',current_ingredient_unit_price(registered),37);
  perform pg_temp.ok('재고 없이 등록한 재료 모드 보존',not (select stock_tracking from ingredients where id=registered));
  perform pg_temp.ok('폐기한 부자재 쓰기 API 차단',not has_function_privilege('authenticated','public.save_material(uuid,jsonb)','EXECUTE'));
  insert into ingredients(store_id,name,base_unit,per_volume,purchase_price,menu_unit_price_override,stock_tracking,cost_scope)
    values(s,'통합 검산 생산 재료','ea',1,100,100,false,'production') returning id into production;
  insert into ingredients(store_id,name,base_unit,per_volume,purchase_price,menu_unit_price_override,stock_tracking,cost_scope)
    values(s,'통합 검산 포장용기','ea',1,10,10,false,'sale_only') returning id into packaging;
  insert into recipes(store_id,name,price,base_servings) values(s,'통합 검산 메뉴',1000,1) returning id into r;
  insert into recipe_lines(store_id,recipe_id,ingredient_id,input_qty) values(s,r,production,1),(s,r,packaging,1);
  snap:=recipe_snapshot_entry(r,pg_temp.today());
  perform pg_temp.eq('재고 OFF도 판매 원가에 포함', (snap->>'material_cost')::numeric,110);
  perform pg_temp.eq('판매당 포장용기는 조리폐기 비용 제외', (snap->>'waste_material_cost')::numeric,100);
  perform pg_temp.ok('재고 OFF는 부족 경고 없음',not exists(select 1 from jsonb_array_elements(recipe_shortages(s)->'recipes') x where x->>'recipe_id'=r::text));
  day:=pg_temp.open_today();
  select count(*) into before_events from inventory_events where ingredient_id in(production,packaging);
  perform pg_temp.e10(s,day,r,1,0,0,1);
  select it.id into sale from daily_sales_items it join daily_sales d on d.id=it.daily_sales_id where it.recipe_id=r and d.sale_date=day;
  select unit_waste_cost into waste from daily_sales_items where id=sale;
  perform pg_temp.eq('판매행은 영업일 폐기단가 캡처',waste,100);
  perform pg_temp.eq('판매행 통합 판매원가', (select unit_material_cost from daily_sales_items where id=sale),110);
  perform pg_temp.raises('판매행 메뉴 교체로 동결 단가 재사용 금지',
    format('update daily_sales_items set recipe_id=%L::uuid where id=%L::uuid',pg_temp.rcp('제육볶음'),sale),'22000');
  perform pg_temp.eq('재고 원장이 없어도 매출 상세 재료 2개 표시',jsonb_array_length(range_menu_detail(s,day,day,r)->'lines'),2);
  perform pg_temp.eq('기간 상세 재료 합계는 판매 원가와 일치하며 조리 폐기 제외',
    (select sum((x->>'amount')::numeric) from jsonb_array_elements(range_menu_detail(s,day,day,r)->'lines') x),110);
  perform pg_temp.eq('판매·폐기에 OFF 재고 원장 생성 금지',(select count(*) from inventory_events where ingredient_id in(production,packaging)),before_events);
  update ingredients set menu_unit_price_override=200 where id=production;
  perform pg_temp.e10(s,day,r,2,0,0,2);
  perform pg_temp.eq('영업 중 단가 변경·수량 수정은 폐기단가 유지',(select unit_waste_cost from daily_sales_items where id=sale),100);
  perform pg_temp.e10(s,day,r,2,0,0,2);
  perform pg_temp.eq('동일 판매 재호출에도 OFF 원장 없음',(select count(*) from inventory_events where ingredient_id in(production,packaging)),before_events);
  perform pg_temp.e10(s,day,r,0,0,0,0);
  perform pg_temp.eq('판매 취소에도 OFF 원장 없음',(select count(*) from inventory_events where ingredient_id in(production,packaging)),before_events);
  begin
    insert into inventory_states(ingredient_id,store_id,stock_total) values(packaging,s,1);
    raise exception 'OFF 재고 생성이 허용됐습니다';
  exception when sqlstate '55000' then null; end;
end $t$;
