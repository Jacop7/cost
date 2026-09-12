set local role postgres;
do $test$
declare stage text; u uuid; s uuid; r uuid; r2 uuid; bd uuid; d date; month text; n bigint; trends bigint; stamp timestamptz; pending boolean; body jsonb;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('고정지출 합성 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s); month:=to_char(d,'YYYY-MM');
    body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
      'name','메뉴','price',12000,'base_servings',1,'target_profit_rate',30,'lines','[]'::jsonb,'extras','[]'::jsonb);
    r:=public.save_recipe(s,body); r2:=public.save_recipe(s,body||jsonb_build_object('request_id',gen_random_uuid()::text,'name','중지 메뉴'));
    perform public.save_recipe(s,jsonb_build_object('contract_version',2,'patch','active','id',r2,'request_id',gen_random_uuid()::text,'expected_revision',public.recipe_detail(r2)->'edit_revision','active',false));
    perform public.save_fixed_costs(s,month,100000,'[{"key":"rent","total":20000}]');
    set local role postgres;
    if stage<>'before_open' then
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(s,d)) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u); pending:=stage in ('open','break');
    n:=(select count(*) from public.entity_change_events where entity_id=r);
    trends:=(select count(*) from public.profit_trends where recipe_id=r);
    perform public.save_fixed_costs(s,month,100000,'[{"key":"rent","total":10000},{"key":"labor","total":10000}]');
    perform pg_temp.ok(stage||': 같은 총액 항목 추가·금액 합성 변경도 메뉴별 이력·대기 표시',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and (select count(*)=n+2 from public.entity_change_events where entity_id=r2)
      and (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending
      and (select count(*)=trends from public.profit_trends where recipe_id=r));
    select updated_at into stamp from public.fixed_costs_monthly f where store_id=s and f.month=to_char(d,'YYYY-MM');
    perform public.save_fixed_costs(s,month,100000,'[{"key":"rent","total":10000},{"key":"labor","total":10000}]');
    perform pg_temp.ok(stage||': 같은 값 재저장은 메뉴 이력·수정 시각 유지',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and (select updated_at=stamp from public.fixed_costs_monthly f where store_id=s and f.month=to_char(d,'YYYY-MM')));
    perform public.save_fixed_costs(s,month,100000,'[{"key":"labor","total":30000}]');
    perform pg_temp.ok(stage||': 삭제와 금액 증가 동시 변경은 현재·대기 값 분리',
      coalesce(public.recipe_detail(r)#>>'{effective,fixed_rate}',public.recipe_detail(r)->>'fixed_rate')::numeric=case when pending then 0.2 else 0.3 end);
    perform public.save_fixed_costs(s,month,100000,'[]');
    perform pg_temp.ok(stage||': 전체 삭제도 0으로 반영하고 자동 갱신 기록',
      public.fixed_cost_rate(s,month)=0 and (select count(*)=n+3 from public.entity_change_events where entity_id=r));
    trends:=(select count(*) from public.profit_trends where recipe_id=r);
    perform public.save_fixed_costs(s,'2040-01',100000,'[{"key":"labor","total":50000}]');
    perform pg_temp.ok(stage||': 다른 월 수정은 현재 메뉴 수정 내역을 오염시키지 않음',
      (select count(*)=n+3 from public.entity_change_events where entity_id=r));
    perform pg_temp.ok(stage||': 다른 월 최초 저장도 현재 메뉴 손익 추이 생성 없음', (select count(*)=trends from public.profit_trends where recipe_id=r));
    perform public.save_fixed_costs(s,to_char(d-interval '1 month','YYYY-MM'),100000,'[{"key":"labor","total":40000}]');
    perform pg_temp.ok(stage||': 과거월 정정은 해당 월 손익에 반영하고 현재 메뉴로 과거 추이 점을 합성하지 않음',
      (select fixed_cost=40000 and revenue=100000 from public.monthly_pl m where store_id=s and m.month=to_char(d-interval '1 month','YYYY-MM'))
      and (select count(*)=trends from public.profit_trends where recipe_id=r)
      and (select count(*)=n+3 from public.entity_change_events where entity_id=r));
    if pending then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 최종 고정지출 0원 적용·대기 해제',
        (public.recipe_detail(r)->>'fixed_rate')::numeric=0 and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false');
    end if;
    set local role postgres;
  end loop;
end $test$;
