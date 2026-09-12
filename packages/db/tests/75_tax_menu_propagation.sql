set local role postgres;
select set_config('margincook.international_tax_force','owner_test',true);
do $test$
declare stage text; u uuid; s uuid; r uuid; r2 uuid; d date; bd uuid; p jsonb; t jsonb; snap jsonb;
  n bigint; pending boolean; extra jsonb; base_component jsonb;
begin
  foreach stage in array array['before_open','open','break','closed'] loop
    u:=gen_random_uuid(); insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
    s:=(public.create_store('세금 자동 갱신 '||stage,'Asia/Seoul')->>'store_id')::uuid; d:=public.store_local_date(s);
    perform public.save_store_market_profile(s,'{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}',null,null);
    p:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[{"code":"standard","name":"일반","treatment":"taxable","active":true}]}';
    t:=public.save_store_tax_profile(s,p,null,null); base_component:=p#>'{components,0}';
    set local role postgres;
    insert into public.recipes(store_id,name,price) values(s,'과세 메뉴',12000) returning id into r;
    insert into public.recipes(store_id,name,price,active) values(s,'판매 중지 메뉴',6000,false) returning id into r2;
    bd:=null;
    if stage<>'before_open' then
      snap:=public.build_day_snapshot(s,d);
      insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
        values(s,d,'open',clock_timestamp()+interval '1 hour',snap) returning id into bd;
      if stage='break' then update public.business_days set status='break' where id=bd; end if;
      if stage='closed' then perform public.close_business_day_row(bd,'manual'); end if;
    end if;
    perform pg_temp.as_owner(u); pending:=stage in ('open','break');
    p:=jsonb_set(p,'{components,0,rate_pct}','20');
    t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
    perform pg_temp.ok(stage||': 세율 수정은 활성·비활성 메뉴 모두 자동 갱신 사건 생성',
      (select count(*)=2 and count(distinct correlation_id)=1 and bool_and(source_type='tax' and affects_sales)
       from public.entity_change_events where store_id=s and entity_type='recipe'));
    perform pg_temp.ok(stage||': 진행 중에는 시작 세금 유지·영업 전후에는 즉시 반영',
      (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=case when pending then 1091 else 2000 end
      and (public.last_entity_change(s,'recipe',r)->>'has_pending_change')::boolean=pending
      and public.last_entity_change(s,'recipe',r2)->>'has_pending_change'='false');
    n:=(select count(*) from public.entity_change_events where entity_id=r);
    t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
    perform pg_temp.ok(stage||': 같은 세금 재저장은 사건 중복 없음',(select count(*)=n from public.entity_change_events where entity_id=r));
    extra:=base_component||'{"key":"extra","kind":"additional","name":"추가세","rate_pct":5,"sort_order":1,"jurisdiction_level":"custom"}'::jsonb;
    p:=jsonb_set(p,'{components}',jsonb_build_array(base_component,extra));
    t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
    perform pg_temp.ok(stage||': 항목 추가와 기본 세율 변경을 한 사건에 반영',
      (select count(*)=n+1 from public.entity_change_events where entity_id=r)
      and (public.recipe_tax_quote_for_price(r,(t->>'effective_from')::date,12000)->>'tax_total')::numeric=1565);
    p:=jsonb_set(p,'{components}',jsonb_build_array(base_component||'{"rate_pct":15}'::jsonb));
    t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
    perform pg_temp.ok(stage||': 같은 합계라도 항목 삭제·세율 합성 변경 이력 보존',
      (select count(*)=n+2 from public.entity_change_events where entity_id=r));
    p:=jsonb_set(p,'{components,0,remittance,delivery}','"marketplace"');
    t:=public.save_store_tax_profile(s,p,(t->>'profile_id')::uuid,(t->>'revision')::integer);
    perform pg_temp.ok(stage||': 배달 납부 주체만 변경해도 메뉴 자동 갱신 기록',
      (select count(*)=n+3 from public.entity_change_events where entity_id=r));
    perform public.save_menu_tax_override(s,r,(t->>'profile_id')::uuid,null,'exempt',0);
    perform pg_temp.ok(stage||': 메뉴 과세 선택 변경은 직접 수정으로 기록',exists(
      select 1 from public.entity_change_events where entity_id=r and source_type='direct' and title='메뉴 세금 수정'));
    if pending then
      set local role postgres; perform public.close_business_day_row(bd,'manual'); perform pg_temp.as_owner(u);
      perform pg_temp.ok(stage||': 종료 후 최종 과세 적용·대기 해제·스냅샷 불변',
        (public.recipe_tax_app_state(s,r)#>>'{quote,tax_total}')::numeric=0
        and public.last_entity_change(s,'recipe',r)->>'has_pending_change'='false'
        and (select snapshot->'recipes'=snap->'recipes' from public.business_days where id=bd));
    end if;
    set local role postgres;
  end loop;
end $test$;
