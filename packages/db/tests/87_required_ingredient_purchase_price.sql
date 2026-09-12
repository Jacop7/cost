set local role postgres;
do $test$
declare u uuid; s uuid; i uuid; r uuid; stage text; d date; bd uuid; body jsonb; bad jsonb; n bigint;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('가격 필수 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    -- Reproduce an existing ingredient with receipts but no saved purchase price.
    i:=public.save_ingredient(s,'{"name":"대파","base_unit":"g","per_volume":1000}');
    perform public.quick_inbound(s,i,1000,4000,1,null,d,gen_random_uuid()::text);
    r:=public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','시험 메뉴','price',12000,'base_servings',1,'target_profit_rate',30,
      'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',100)),'extras','[]'::jsonb));
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    body:=jsonb_build_object('contract_version',2,'id',i,'name','대파','base_unit','g','per_volume',2000);
    select count(*) into n from public.entity_change_events where store_id=s;
    foreach bad in array array['{}'::jsonb,'{"purchase_price":null}','{"purchase_price":""}','{"purchase_price":-1}','{"purchase_price":"NaN"}'] loop
      begin
        perform public.save_ingredient(s,body||bad);
        raise exception 'Missing or invalid purchase price was accepted';
      exception when sqlstate '22000' then null;
      end;
    end loop;
    perform pg_temp.ok(stage||': invalid full saves do not edit fields/history',
      (select per_volume=1000 and purchase_price is null from public.ingredients where id=i)
      and (select count(*)=n from public.entity_change_events where store_id=s));
    perform public.save_ingredient(s,body||'{"purchase_price":4000}'::jsonb);
    perform pg_temp.eq(stage||': explicit price with changed capacity updates current unit cost',public.current_ingredient_unit_price(i),2,0);
    perform pg_temp.ok(stage||': ingredient pending matches business state',
      (public.last_entity_change(s,'ingredient',i)->>'has_pending_change')::boolean=(stage in ('open','break')));
    perform pg_temp.eq(stage||': menu uses correct frozen/current cost',
      coalesce(public.recipe_detail(r)#>>'{effective,material_cost}',public.recipe_detail(r)->>'material_cost')::numeric,
      case when stage in ('open','break') then 400 else 200 end,0);
    perform public.save_ingredient(s,body||'{"purchase_price":0}'::jsonb);
    perform pg_temp.eq(stage||': explicit zero is valid, unlike missing price',public.current_ingredient_unit_price(i),0,0);
    -- A memo edit must not require financial fields or create a financial event.
    perform public.save_ingredient(s,jsonb_build_object('id',i,'patch','memo','memo','메모','expected_memo',null));
    perform pg_temp.ok(stage||': memo remains independent',(select memo='메모' from public.ingredients where id=i));
    set local role postgres;
  end loop;
end $test$;
