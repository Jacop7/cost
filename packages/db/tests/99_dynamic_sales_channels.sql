-- 판매 채널 기본 3개, 최대 5개, 이름 불변, 초안 잠금과 동적 매출 전파를 검증한다.

do $test$
declare
  v_owner uuid:=pg_temp.new_owner(); s uuid; state jsonb; ch1 jsonb; ch2 jsonb;
  channel_id uuid; draft_id uuid:='99100000-0000-4000-8000-000000000001'; basis uuid;
begin
  perform pg_temp.as_owner(v_owner);
  perform public.create_store('동적 채널 설정 시험','Asia/Seoul');
  select st.id into s from public.stores st where st.owner_id=v_owner;
  state:=public.sales_channel_settings(s);
  perform pg_temp.eq('신규 매장은 기본 활성 채널 3개',(state->>'active_count')::numeric,3);
  perform pg_temp.eq_t('기본 채널 순서',''||(select string_agg(x->>'code',',' order by ord)
    from jsonb_array_elements(state->'channels') with ordinality rows(x,ord)
    where (x->>'active')::boolean),'hall,delivery,takeout');

  ch1:=public.create_sales_channel(s,'전화 주문',0);
  perform pg_temp.eq_t('추가 채널 이름 보존',(
    select name from public.sales_channels where id=(ch1#>>'{channel,id}')::uuid),'전화 주문');
  perform pg_temp.raises('정규화한 같은 이름은 중복 거절',format(
    'select public.create_sales_channel(%L,''전화 주문'',1)',s),'23505');
  ch2:=public.create_sales_channel(s,'네이버 주문',1);
  perform pg_temp.eq('활성 채널은 5개까지 추가',(public.sales_channel_settings(s)->>'active_count')::numeric,5);
  perform pg_temp.raises('6번째 활성 채널은 거절',format(
    'select public.create_sales_channel(%L,''여섯째'',2)',s),'23514');
  perform pg_temp.raises('오래된 revision은 거절',format(
    'select public.delete_sales_channel(%L,%L,1)',s,(ch2->>'channel_id')::uuid),'45009');

  channel_id:=(ch2#>>'{channel,id}')::uuid;
  perform public.delete_sales_channel(s,channel_id,2);
  perform pg_temp.ok('기준 판본에 들어간 채널은 hard delete하지 않고 사용 중지',exists(
    select 1 from public.sales_channels where id=channel_id and not active and retired_at is not null));
  perform public.restore_sales_channel(s,channel_id,3);
  perform pg_temp.ok('사용 중지 채널을 같은 UUID로 복구',(
    select active from public.sales_channels where id=channel_id));

  select id into basis from public.publish_sales_basis_version(s,public.store_local_date(s));
  insert into public.sales_day_drafts(id,store_id,business_date,draft_kind,status,basis_version_id,payload_hash,expires_at)
    values(draft_id,s,public.store_local_date(s),'initial','editing',basis,repeat('1',64),clock_timestamp()+interval '1 hour');
  perform pg_temp.raises('작성 중 매출이 있으면 채널 추가 차단',format(
    'select public.create_sales_channel(%L,''잠금 시험'',4)',s),'45044');
  perform pg_temp.ok('설정 읽기도 초안 잠금을 알림',(
    public.sales_channel_settings(s)->>'locked_by_draft')::boolean);

  perform pg_temp.as_owner(pg_temp.owner());
end $test$;

do $test$
declare
  v_owner uuid:=pg_temp.new_owner(); s uuid; r uuid; custom uuid;
  market_id uuid; tax_id uuid; component_id uuid;
  opened jsonb; saved jsonb; finalized jsonb; items jsonb; updated_items jsonb;
  d date; draft_id uuid:='99100000-0000-4000-8000-000000000011';
  request_id uuid:='99100000-0000-4000-8000-000000000012';
  item_id uuid; detail jsonb; channel_profit jsonb; tax_detail jsonb; activation_date date;
  final_tax numeric;
begin
  perform pg_temp.as_owner(v_owner);
  perform public.create_store('동적 채널 매출 시험','Asia/Seoul');
  select st.id into s from public.stores st where st.owner_id=v_owner;
  insert into public.recipes(store_id,name,price,active) values(s,'동적 채널 메뉴',12000,true) returning id into r;
  execute 'reset role';
  insert into public.store_market_profiles(store_id,country_code,currency_code,business_locale_code,price_basis,effective_from)
    values(s,'KR','KRW','ko-KR','tax_inclusive',public.store_local_date(s)) returning id into market_id;
  insert into public.store_tax_profiles(store_id,market_profile_id,default_treatment,effective_from)
    values(s,market_id,'taxable',public.store_local_date(s)) returning id into tax_id;
  insert into public.store_tax_components(store_id,tax_profile_id,config_key,kind,name,rate_pct,
    jurisdiction_level,calculation_basis,applies_to_treatments)
    values(s,tax_id,'primary','primary','부가세',10,'national','primary_tax_exclusive',array['taxable'::public.tax_treatment])
    returning id into component_id;
  insert into public.tax_category_catalog(store_id,tax_profile_id,code,name,treatment) values
    (s,tax_id,'standard','일반 과세','taxable'),
    (s,tax_id,'zero_rated','0% 과세','zero_rated'),
    (s,tax_id,'exempt','면세','exempt');
  insert into public.channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner) values
    (s,component_id,'hall','merchant'),(s,component_id,'delivery','merchant'),(s,component_id,'takeout','merchant');
  select b.activation_date into activation_date
    from public.international_tax_activation_boundaries b where b.store_id=s;
  insert into public.menu_tax_overrides(recipe_id,store_id,tax_profile_id,treatment,effective_from,revision)
    values(r,s,tax_id,'exempt',activation_date+1,1);
  execute 'set local role costkeep_rpc_executor';
  custom:=(public.create_sales_channel(s,'전화 주문',0)#>>'{channel,id}')::uuid;
  update public.sales_lifecycle_cutover_state set phase='legacy_active' where store_id=s;
  perform pg_temp.open_for_test(s);
  update public.sales_lifecycle_cutover_state set phase='active' where store_id=s;
  d:=activation_date;
  perform public.publish_sales_basis_version(s,d);
  opened:=public.open_sales_draft(s,d,draft_id);
  perform pg_temp.eq('초안 manifest는 기본 3개와 추가 채널을 모두 고정',
    jsonb_array_length(opened->'payload'->'channels'),4);
  items:=opened->'payload'->'items';
  select jsonb_agg(case when x->>'recipe_id'=r::text then
      jsonb_set(x,'{channels}',(
        select jsonb_agg(q||jsonb_build_object('quantity',case
          when q->>'code'='hall' then 10 when q->>'sales_channel_id'=custom::text then 3 else 0 end)
          order by ord2)
        from jsonb_array_elements(x->'channels') with ordinality c(q,ord2)))
      else x end order by ord)
    into updated_items from jsonb_array_elements(items) with ordinality rows(x,ord);
  saved:=public.save_sales_draft(s,draft_id,0,updated_items,'[]'::jsonb,'[]'::jsonb);
  perform pg_temp.eq('동적 네 채널 초안 총 판매수량',(saved#>>'{payload,summary,qty}')::numeric,13);
  perform pg_temp.eq('초안 세금은 채널 판매 총액에서 구성별 반올림',
    (saved#>>'{payload,summary,tax}')::numeric,14182);
  finalized:=public.finalize_sales_draft(s,draft_id,1,request_id,saved->>'payload_hash','동적 채널 회귀');
  perform pg_temp.eq_t('동적 채널 매출 완료',finalized->>'status','finalized');

  select it.id into item_id from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
    where ds.store_id=s and ds.sale_date=d and it.recipe_id=r;
  perform pg_temp.eq('확정 원장은 채널 네 행을 보존',(
    select count(*) from public.daily_sales_item_channel_quantities where daily_sales_item_id=item_id),4);
  perform pg_temp.eq('추가 채널 판매수량 보존',(
    select quantity from public.daily_sales_item_channel_quantities
      where daily_sales_item_id=item_id and sales_channel_id=custom),3);
  perform pg_temp.eq('UUID 채널 회계 합계는 판매수량 합계와 일치',(
    select sum(quantity) from public.sales_item_channel_accounting_rows(item_id)),13);
  select sum(tax_total) into final_tax
    from public.sales_item_channel_accounting_rows(item_id);
  perform pg_temp.eq('초안과 확정 원장의 채널별 세금 반올림 합계가 일치',
    final_tax,(saved#>>'{payload,summary,tax}')::numeric);

  detail:=public.sales_authoritative_range_detail(s,d,d);
  perform pg_temp.eq('기간 메뉴 총량도 동적 채널 합계',(
    select (x->>'qty')::numeric from jsonb_array_elements(detail->'menu') x
      where x->>'recipe_id'=r::text),13);
  perform pg_temp.eq('추가 채널 매출은 포장으로 중복되지 않음',(
    select (x->>'qty')::numeric from jsonb_array_elements(detail->'channels') x
      where x->>'sales_channel_id'=custom::text),3);
  perform pg_temp.eq('채널 매출 합은 기간 매출과 일치',(
    select sum((x->>'amount')::numeric) from jsonb_array_elements(detail->'channels') x),156000);

  channel_profit:=public.sales_authoritative_channel_profit(s,d,d);
  perform pg_temp.ok('채널 손익도 추가 채널을 같은 UUID로 반환',exists(
    select 1 from jsonb_array_elements(channel_profit->'channels') x
      where x->>'sales_channel_id'=custom::text and (x->>'qty')::numeric=3));
  tax_detail:=public.sales_tax_app_detail(s,d,d);
  perform pg_temp.ok('세금 자세히도 추가 채널 UUID와 저장 당시 이름을 보존',exists(
    select 1 from jsonb_array_elements(tax_detail->'lines') x
      where x->>'sales_channel_id'=custom::text
        and x->>'sales_channel_name'='전화 주문'
        and x->>'sales_channel_name_origin'='sale_snapshot'
        and (x->>'final_quantity')::numeric=3
        and x->>'treatment'='taxable'
        and (x->>'tax_total')::numeric>0));
  perform pg_temp.as_owner(pg_temp.owner());
end $test$;

do $test$
declare
  v_owner uuid:=pg_temp.new_owner(); s uuid; custom uuid; basis uuid;
  draft_id uuid:='99100000-0000-4000-8000-000000000021'; saved jsonb;
begin
  perform pg_temp.as_owner(v_owner);
  perform public.create_store('빈 메뉴 동적 채널 시험','Asia/Seoul');
  select st.id into s from public.stores st where st.owner_id=v_owner;
  custom:=(public.create_sales_channel(s,'전화 주문',0)#>>'{channel,id}')::uuid;
  select id into basis from public.publish_sales_basis_version(s,public.store_local_date(s));
  insert into public.sales_day_drafts(id,store_id,business_date,draft_kind,status,basis_version_id,payload_hash,expires_at)
    values(draft_id,s,public.store_local_date(s),'initial','editing',basis,repeat('2',64),clock_timestamp()+interval '1 hour');
  saved:=public.save_sales_draft(s,draft_id,0,'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','행사 매출','price',5000,'qty',2,
      'sales_channel_id',custom,'deleted',false)),'[]'::jsonb);
  perform pg_temp.eq('메뉴가 없어도 사용자 채널 기타 매출만 저장 가능',
    (saved#>>'{payload,summary,etc_revenue}')::numeric,10000);
  perform pg_temp.as_owner(pg_temp.owner());
end $test$;

do $test$
begin
  perform pg_temp.ok('앱 역할은 판매 채널 직접 쓰기 권한이 없음',
    not has_table_privilege('authenticated','public.sales_channels','insert')
    and not has_table_privilege('authenticated','public.sales_channels','update')
    and not has_table_privilege('authenticated','public.sales_channels','delete'));
  perform pg_temp.ok('구형 이름 수정·사용 중지 RPC는 앱에 닫힘',
    not has_function_privilege('authenticated','public.save_channel(uuid,jsonb)','execute')
    and not has_function_privilege('authenticated','public.retire_channel(uuid)','execute'));
  perform pg_temp.ok('목적별 채널 RPC만 앱에 열림',
    has_function_privilege('authenticated','public.sales_channel_settings(uuid)','execute')
    and has_function_privilege('authenticated','public.create_sales_channel(uuid,text,integer)','execute')
    and has_function_privilege('authenticated','public.delete_sales_channel(uuid,uuid,integer)','execute')
    and has_function_privilege('authenticated','public.restore_sales_channel(uuid,uuid,integer)','execute'));
end $test$;
