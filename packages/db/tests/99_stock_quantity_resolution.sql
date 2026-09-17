do $test$
declare s uuid:=pg_temp.store(); i uuid; i2 uuid; result jsonb; n numeric; stock numeric; kind text; key text;
begin
  i:=save_ingredient(s,'{"name":"재고 처리 확인 시험","base_unit":"g","per_volume":1}');
  i2:=save_ingredient(s,'{"name":"다른 재고 재료","base_unit":"g","per_volume":1}');
  perform quick_inbound(s,i,1000,4000,1,null,null,'stock-resolution-seed');
  foreach kind in array array['deduct','discard'] loop
    key:='stock-resolution-'||kind;
    select stock_total into stock from inventory_states where ingredient_id=i;
    select count(*) into n from inventory_events where store_id=s;
    result:=resolve_stock_quantity(s,i,key);
    perform pg_temp.eq_t(kind||' 미반영 요청 종료',result->>'status','not_recorded');
    perform pg_temp.eq_t(kind||' 재조회 동일',resolve_stock_quantity(s,i,key)->>'status','not_recorded');
    perform pg_temp.eq(kind||' 조회 원장 불변',(select count(*) from inventory_events where store_id=s),n);
    perform pg_temp.raises(kind||' 늦은 요청 차단',format('select change_stock_quantity(%L,%L,100,%L,%L,%L)',i,kind,stock,'시험',key),'45010');
    perform pg_temp.raises(kind||' 종료 키 재료 불일치',format('select resolve_stock_quantity(%L,%L,%L)',s,i2,key),'22000');
    key:=key||'-committed';
    perform change_stock_quantity(i,kind,100,stock,'시험',key);
    select count(*) into n from inventory_events where store_id=s;
    perform pg_temp.eq_t(kind||' 기록된 처리 조회',resolve_stock_quantity(s,i,key)->>'status','recorded');
    perform pg_temp.eq(kind||' 확인 원장 불변',(select count(*) from inventory_events where store_id=s),n);
    perform pg_temp.eq(kind||' 한 번만 차감',(select stock_total from inventory_states where ingredient_id=i),stock-100);
    perform pg_temp.raises(kind||' 기록 키 재료 불일치',format('select resolve_stock_quantity(%L,%L,%L)',s,i2,key),'22000');
    perform change_stock_quantity(i,kind,100,stock,'시험',key);
    perform pg_temp.eq(kind||' 동일 요청 원장 불변',(select count(*) from inventory_events where store_id=s),n);
    perform change_stock_quantity(i,kind,100,stock-100,'시험',key||'-new');
    perform pg_temp.eq(kind||' 별도 의도 새 처리 허용',(select stock_total from inventory_states where ingredient_id=i),stock-200);
  end loop;
  perform pg_temp.raises('다른 매장 조회 차단',format('select resolve_stock_quantity(%L,%L,%L)',gen_random_uuid(),i,'other'),'42501');
  perform pg_temp.ok('앱 직접 종료 테이블 쓰기 차단',not has_table_privilege('authenticated','public.stock_quantity_closed_requests','INSERT'));
  perform pg_temp.ok('authenticated 전용 RPC',has_function_privilege('authenticated','public.resolve_stock_quantity(uuid,uuid,text)','execute')
    and not has_function_privilege('anon','public.resolve_stock_quantity(uuid,uuid,text)','execute')
    and not has_function_privilege('service_role','public.resolve_stock_quantity(uuid,uuid,text)','execute'));
end $test$;
