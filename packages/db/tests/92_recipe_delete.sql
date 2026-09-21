set local role postgres;
do $test$
declare u uuid; s uuid; r uuid; i uuid; stage text; d date; bd uuid; rev text; stamp timestamptz;
  inventory_before jsonb; sales_before jsonb; day_before jsonb; trends_before jsonb; other uuid;
  deleted_menu jsonb;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    set local role postgres;
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('메뉴 삭제 '||stage,'Asia/Seoul')->>'store_id')::uuid;
    d:=public.store_local_date(s);
    i:=public.save_ingredient(s,'{"contract_version":3,"name":"식재료","base_unit":"g"}');
    perform public.quick_inbound(s,i,1000,4000,1,null,d,gen_random_uuid()::text);
    r:=pg_temp.save_recipe_fixture(s,jsonb_build_object('name','삭제 메뉴','price',12000,'lines',
      jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',10))));
    select edit_revision::text into rev from public.recipes where id=r;
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      perform pg_temp.e10(s,d,r,2);
      set local role postgres;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u);
    select jsonb_agg(to_jsonb(x) order by x.id) into inventory_before from public.inventory_events x where store_id=s;
    select jsonb_agg(to_jsonb(x) order by x.id) into sales_before from public.daily_sales_items x where store_id=s;
    select jsonb_agg(to_jsonb(x) order by x.id) into day_before from public.business_days x where store_id=s;
    select jsonb_agg(to_jsonb(x)) into trends_before from public.profit_trends x where recipe_id=r;
    if stage in ('open','break') then
      begin perform public.delete_recipe(s,r,rev); raise exception 'FAIL active business deletion';
        exception when sqlstate '55000' then null; end;
      perform pg_temp.ok(stage||': deletion blocked without header change',
        (select deleted_at is null and active and edit_revision::text=rev from public.recipes where id=r));
    else
      begin perform public.delete_recipe(s,r,(rev::bigint+1)::text); raise exception 'FAIL stale delete';
        exception when sqlstate '45009' then null; end;
      -- Exercise application facade permissions, not executor-only access.
      set local role authenticated;
      perform public.delete_recipe(s,r,rev);
      perform public.delete_recipe(s,r,rev);
      set local role costkeep_rpc_executor;
      select deleted_at into stamp from public.recipes where id=r;
      perform pg_temp.ok(stage||': archive once and preserve row',
        (select not active and deleted_at is not null and deleted_by=u and edit_revision=rev::bigint+1
          and deletion_base_revision=rev::bigint from public.recipes where id=r));
      perform pg_temp.ok(stage||': absent from current menu and pick lists',
        not exists(select 1 from public.recipe_list(s) where id=r)
        and not exists(select 1 from public.recipe_pick_list(s) where id=r));
      perform pg_temp.ok(stage||': ingredient relationship survives',exists(select 1 from public.recipe_lines where recipe_id=r and ingredient_id=i));
      begin perform public.save_recipe(s,jsonb_build_object('contract_version',2,'request_id',gen_random_uuid(),
        'patch','active','id',r,'expected_revision',(rev::bigint+1)::text,'active',true));
        raise exception 'FAIL revived deleted menu'; exception when sqlstate '45009' then null; end;
      begin perform public.save_recipe(s,jsonb_build_object('contract_version',2,'request_id',gen_random_uuid(),
        'patch','memo','id',r,'expected_revision',(rev::bigint+1)::text,'memo','rewrite'));
        raise exception 'FAIL edited deleted menu'; exception when sqlstate '45009' then null; end;
      perform pg_temp.ok(stage||': retry does not rewrite deletion time',(select deleted_at=stamp from public.recipes where id=r));
      if stage='closed' then
        select value into deleted_menu
          from jsonb_array_elements(public.sales_authoritative_range_detail(s,d,d)->'menu')
         where value->>'recipe_id'=r::text;
        perform pg_temp.ok(stage||': sales range marks the archived recipe as deleted menu',
          coalesce((deleted_menu->>'is_deleted')::boolean,false));
      end if;
    end if;
    perform pg_temp.ok(stage||': inventory ledger preserved', inventory_before is not distinct from
      (select jsonb_agg(to_jsonb(x) order by x.id) from public.inventory_events x where store_id=s));
    perform pg_temp.ok(stage||': sales and day snapshots preserved', sales_before is not distinct from
      (select jsonb_agg(to_jsonb(x) order by x.id) from public.daily_sales_items x where store_id=s)
      and day_before is not distinct from (select jsonb_agg(to_jsonb(x) order by x.id) from public.business_days x where store_id=s));
    perform pg_temp.ok(stage||': profit history preserved',trends_before is not distinct from
      (select jsonb_agg(to_jsonb(x)) from public.profit_trends x where recipe_id=r));
    begin perform public.delete_recipe(pg_temp.store(),r,rev); raise exception 'FAIL foreign store';
      exception when insufficient_privilege then null; end;
  end loop;
  perform pg_temp.ok('anonymous deletion forbidden',not has_function_privilege('anon','public.delete_recipe(uuid,uuid,text)','execute'));
  perform pg_temp.ok('legacy deletion remains revoked',not has_function_privilege('authenticated','public.deactivate_recipe(uuid)','execute'));
end $test$;
