set local role postgres;
do $test$
declare u uuid; s uuid; i uuid; stage text; d date; bd uuid; p jsonb; old_cost numeric; old_stock numeric; n bigint;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('정보 등록 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    i:=public.save_ingredient(s,'{"contract_version":3,"name":"새 식재료","base_unit":"g"}');
    perform pg_temp.ok(stage||': registration has no purchase cost',
      (select per_volume=1 and purchase_price is null and menu_unit_price_override is null from public.ingredients where id=i));
    perform pg_temp.ok(stage||': registration does not manufacture inventory',
      not exists(select 1 from public.inventory_events where ingredient_id=i));
    perform public.quick_inbound(s,i,1000,4000,2,null,d,gen_random_uuid()::text);
    perform pg_temp.eq(stage||': receipt computes price from actual paid/received',public.current_ingredient_unit_price(i),4,0);
    -- Existing price metadata/override must survive profile edits as well.
    perform public.save_ingredient(s,jsonb_build_object('contract_version',2,'id',i,'name','새 식재료','base_unit','g','per_volume',1000,'purchase_price',6000));
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    old_cost:=public.current_ingredient_unit_price(i);
    select stock_total into old_stock from public.inventory_states where ingredient_id=i;
    select count(*) into n from public.inventory_events where ingredient_id=i;
    p:=jsonb_build_object('contract_version',3,'id',i,'name','이름 수정','base_unit','g','safety_stock',50);
    perform public.save_ingredient(s,p);
    perform pg_temp.ok(stage||': hidden price and capacity preserved',
      (select per_volume=1000 and purchase_price=6000 and menu_unit_price_override=6 from public.ingredients where id=i));
    perform pg_temp.eq(stage||': profile does not reset current unit cost',public.current_ingredient_unit_price(i),old_cost,0);
    perform pg_temp.ok(stage||': no inventory write from profile',
      (select count(*)=n from public.inventory_events where ingredient_id=i)
      and (select stock_total=old_stock from public.inventory_states where ingredient_id=i));
    begin perform public.save_ingredient(s,p||'{"purchase_price":1}'); raise exception 'profile accepted price';
      exception when sqlstate '22000' then null; end;
    begin perform public.save_ingredient(s,p||'{"per_volume":2}'); raise exception 'profile accepted capacity';
      exception when sqlstate '22000' then null; end;
    perform pg_temp.ok(stage||': profile rejects financial fields',
      (select per_volume=1000 and purchase_price=6000 from public.ingredients where id=i));
    set local role postgres;
  end loop;
end $test$;
