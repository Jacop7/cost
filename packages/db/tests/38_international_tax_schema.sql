-- ═══════════════════════════════════════════════════════════════
-- 38 · INTL-1B 국제 시장·세금 프로필과 판매 세금 원장 스키마
--
-- 계산과 이관은 아직 하지 않는다. 저장 자리의 의미·경계·불변식과 비활성 capability를 잰다.
-- ═══════════════════════════════════════════════════════════════

select pg_temp.ok('INTL-1B 표 열 개가 모두 있다', (
  select count(*) = 10
    from unnest(array[
      'tax_region_catalog', 'store_market_profiles', 'store_tax_profiles',
      'store_tax_components', 'tax_category_catalog', 'menu_tax_overrides',
      'channel_tax_remittance', 'daily_sales_item_tax_snapshots',
      'daily_sales_item_tax_component_snapshots', 'sales_tax_events'
    ]) t(name)
   where to_regclass('public.' || t.name) is not null
));

select pg_temp.ok('앱 롤은 국제 세금 표를 직접 읽거나 쓰지 못한다', (
  select count(*) = 0
    from unnest(array[
      'tax_region_catalog', 'store_market_profiles', 'store_tax_profiles',
      'store_tax_components', 'tax_category_catalog', 'menu_tax_overrides',
      'channel_tax_remittance', 'daily_sales_item_tax_snapshots',
      'daily_sales_item_tax_component_snapshots', 'sales_tax_events'
    ]) t(name), unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) p(privilege_name)
   where has_table_privilege('authenticated', 'public.' || t.name, p.privilege_name)
      or has_table_privilege('anon', 'public.' || t.name, p.privilege_name)
));

select pg_temp.ok('service role은 국제 세금 표를 직접 쓰지 못한다', (
  select count(*) = 0
    from unnest(array[
      'tax_region_catalog', 'store_market_profiles', 'store_tax_profiles',
      'store_tax_components', 'tax_category_catalog', 'menu_tax_overrides',
      'channel_tax_remittance', 'daily_sales_item_tax_snapshots',
      'daily_sales_item_tax_component_snapshots', 'sales_tax_events'
    ]) t(name), unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) p(privilege_name)
   where has_table_privilege('service_role', 'public.' || t.name, p.privilege_name)
));

select pg_temp.ok('제품 소유 관할 카탈로그는 RPC 실행 역할에 읽기 전용이다',
  has_table_privilege('margincook_rpc_executor', 'tax_region_catalog', 'SELECT')
  and not has_table_privilege('margincook_rpc_executor', 'tax_region_catalog', 'INSERT')
  and not has_table_privilege('margincook_rpc_executor', 'tax_region_catalog', 'UPDATE')
  and not has_table_privilege('margincook_rpc_executor', 'tax_region_catalog', 'DELETE'));

select pg_temp.ok('프로필 판본 가드는 모든 BEFORE trigger 중 마지막에 실행된다',
  (select max(tgname) from pg_trigger where tgrelid = 'store_market_profiles'::regclass
    and not tgisinternal and (tgtype & 2) = 2) = 'store_market_profiles_90_version_guard'
  and (select max(tgname) from pg_trigger where tgrelid = 'store_tax_profiles'::regclass
    and not tgisinternal and (tgtype & 2) = 2) = 'store_tax_profiles_90_version_guard');

do $owner_truncate_guards$
begin
  set local role postgres;
  perform pg_temp.raises('소유자가 불러도 세금 이벤트 TRUNCATE 가드가 실행된다',
    'truncate sales_tax_events', '42501');
  perform pg_temp.raises('소유자가 불러도 판매 세금 스냅샷 TRUNCATE 가드가 실행된다',
    'truncate daily_sales_item_tax_snapshots cascade', '42501');
  perform pg_temp.raises('소유자가 불러도 구성 항목 스냅샷 TRUNCATE 가드가 실행된다',
    'truncate daily_sales_item_tax_component_snapshots', '42501');
  set local role margincook_rpc_executor;
end
$owner_truncate_guards$;

select pg_temp.raises('미국 시장 프로필은 제품 관할 코드 없이 못 만든다', format(
  'insert into store_market_profiles(store_id,country_code,currency_code,business_locale_code,price_basis,effective_from) values (%L,''US'',''USD'',''en-US'',''tax_exclusive'',''-infinity'')',
  pg_temp.store()), '23514');

select pg_temp.raises('국가·통화·업무 로케일 조합을 바꿔 끼우지 못한다', format(
  'insert into store_market_profiles(store_id,country_code,currency_code,business_locale_code,price_basis,effective_from) values (%L,''KR'',''USD'',''ko-KR'',''tax_inclusive'',''-infinity'')',
  pg_temp.store()), '23514');

do $fixture$
declare
  v_market uuid;
  v_tax uuid;
  v_primary uuid;
  v_additional uuid;
  v_recipe uuid := pg_temp.rcp('제육볶음');
  v_recipe2 uuid;
  v_item uuid;
  v_snapshot uuid;
  v_sale_date date;
  v_market2 uuid;
  v_tax2 uuid;
  v_late_sales uuid;
  v_late_item uuid;
  v_late_date date;
begin
  insert into store_market_profiles(
    store_id, country_code, currency_code, business_locale_code,
    price_basis, effective_from, revision
  ) values (
    pg_temp.store(), 'KR', 'KRW', 'ko-KR', 'tax_inclusive', '-infinity', 1
  ) returning id into v_market;

  begin
    insert into store_market_profiles(
      store_id, country_code, currency_code, business_locale_code,
      price_basis, effective_from, effective_to
    ) values (
      pg_temp.store(), 'KR', 'KRW', 'ko-KR', 'tax_inclusive', '2026-01-01', '2026-12-31'
    );
    raise exception 'FAIL  시장 프로필 적용 기간 겹침이 허용됐다';
  exception when unique_violation then
    null;
  end;

  insert into store_tax_profiles(
    store_id, market_profile_id, default_treatment, effective_from, revision
  ) values (
    pg_temp.store(), v_market, 'taxable', '-infinity', 1
  ) returning id into v_tax;

  insert into store_tax_components(
    store_id, tax_profile_id, kind, name, rate_pct,
    jurisdiction_level, calculation_basis, applies_to_treatments, sort_order
  ) values (
    pg_temp.store(), v_tax, 'primary', '부가세', 10,
    'national', 'primary_tax_exclusive', array['taxable'::tax_treatment], 0
  ) returning id into v_primary;

  begin
    insert into store_tax_components(
      store_id, tax_profile_id, kind, name, rate_pct,
      jurisdiction_level, calculation_basis, applies_to_treatments
    ) values (
      pg_temp.store(), v_tax, 'primary', '중복 기본세', 1,
      'national', 'primary_tax_exclusive', array['taxable'::tax_treatment]
    );
    raise exception 'FAIL  한 세금 프로필에 기본세가 둘 들어갔다';
  exception when unique_violation then
    null;
  end;

  insert into store_tax_components(
    store_id, tax_profile_id, kind, name, rate_pct,
    jurisdiction_level, calculation_basis, applies_to_treatments, sort_order
  ) values (
    pg_temp.store(), v_tax, 'additional', '추가세', 5,
    'special', 'primary_tax_inclusive',
    array['taxable'::tax_treatment, 'zero_rated'::tax_treatment], 1
  ) returning id into v_additional;

  insert into tax_category_catalog(store_id, tax_profile_id, code, name, treatment)
  values (pg_temp.store(), v_tax, 'standard_food', '일반 음식', 'taxable');

  insert into menu_tax_overrides(recipe_id, store_id, tax_profile_id, tax_category)
  values (v_recipe, pg_temp.store(), v_tax, 'standard_food');

  select id into v_recipe2 from recipes
   where store_id = pg_temp.store() and id <> v_recipe order by id limit 1;
  insert into tax_category_catalog(store_id, tax_profile_id, code, name, treatment, active)
  values (pg_temp.store(), v_tax, 'inactive_food', '비활성 음식', 'taxable', false);
  perform pg_temp.raises('비활성 과세 카테고리는 메뉴에 새로 연결할 수 없다', format(
    'insert into menu_tax_overrides(recipe_id,store_id,tax_profile_id,tax_category) values (%L,%L,%L,''inactive_food'')',
    v_recipe2, pg_temp.store(), v_tax), '23514');
  delete from tax_category_catalog where tax_profile_id = v_tax and code = 'inactive_food';
  begin
    insert into menu_tax_overrides(recipe_id, store_id, tax_profile_id, tax_category, treatment)
    values (v_recipe2, pg_temp.store(), v_tax, 'standard_food', 'taxable');
    raise exception 'FAIL  메뉴 과세 분류와 직접 상태를 동시에 저장했다';
  exception when check_violation then
    null;
  end;

  insert into channel_tax_remittance(store_id, tax_component_id, sales_channel_code, remittance_owner)
  values
    (pg_temp.store(), v_primary, 'hall', 'merchant'),
    (pg_temp.store(), v_additional, 'hall', 'marketplace');

  perform pg_temp.raises('시장 프로필 내용은 같은 판본에서 바꿀 수 없다',
    format('update store_market_profiles set price_basis=''tax_exclusive'' where id=%L', v_market), '23514');
  perform pg_temp.raises('세금 프로필 내용은 같은 판본에서 바꿀 수 없다',
    format('update store_tax_profiles set default_treatment=''exempt'' where id=%L', v_tax), '23514');
  perform pg_temp.raises('세금 구성 항목 계산값은 같은 프로필 판본에서 바꿀 수 없다',
    format('update store_tax_components set rate_pct=11 where id=%L', v_primary), '23514');
  perform pg_temp.raises('과세 카테고리 계산 의미는 같은 프로필 판본에서 바꿀 수 없다',
    format('update tax_category_catalog set treatment=''exempt'' where tax_profile_id=%L and code=''standard_food''', v_tax), '23514');
  perform pg_temp.raises('채널 납부 주체는 같은 프로필 판본에서 바꿀 수 없다',
    format('update channel_tax_remittance set remittance_owner=''marketplace'' where tax_component_id=%L and sales_channel_code=''hall''', v_primary), '23514');
  perform pg_temp.raises('시장 프로필을 닫아 세금 프로필을 적용 구간 밖에 남길 수 없다',
    format('update store_market_profiles set effective_to=''2026-12-31'' where id=%L', v_market), '23514');
  update store_tax_components set sort_order = 9 where id = v_additional;
  perform pg_temp.eq('표시 순서만 바꾸는 것은 계산 판본을 바꾸지 않는다',
    (select sort_order from store_tax_components where id = v_additional), 9);

  select i.id into v_item
    from daily_sales_items i
    join daily_sales ds on ds.id = i.daily_sales_id
   where i.store_id = pg_temp.store() and i.recipe_id = v_recipe
   order by ds.sale_date desc, i.id
   limit 1;
  if v_item is null then
    raise exception 'FAIL  판매 세금 스냅샷 시험에 쓸 판매 장부가 없다';
  end if;
  select d.sale_date into v_sale_date
    from daily_sales_items i join daily_sales d on d.id = i.daily_sales_id
   where i.id = v_item;
  select max(sale_date) + 1 into v_late_date
    from daily_sales where store_id = pg_temp.store();

  perform pg_temp.raises('메뉴 override와 다른 기본 과세 상태로 스냅샷을 만들 수 없다', format(
    $sql$insert into daily_sales_item_tax_snapshots(
      store_id,daily_sales_item_id,sales_channel_code,
      market_profile_id,market_profile_revision,tax_profile_id,tax_profile_revision,
      country_code,currency_code,minor_unit,price_basis,treatment,
      calculation_version,unit_price,final_quantity,listed_total,
      net_sales,customer_total,tax_total,merchant_tax_liability,marketplace_tax_liability,
      input_snapshot,amount_snapshot
    ) values (%L,%L,'delivery',%L,1,%L,1,'KR','KRW',0,'tax_inclusive','taxable',
      'international_tax_v1',100,1,100,90,100,10,10,0,'{}','{}')$sql$,
    pg_temp.store(), v_item, v_market, v_tax), '23514');

  insert into daily_sales_item_tax_snapshots(
    store_id, daily_sales_item_id, sales_channel_code,
    market_profile_id, market_profile_revision, tax_profile_id, tax_profile_revision,
    country_code, currency_code, minor_unit, price_basis, treatment, tax_category,
    calculation_version, unit_price, final_quantity, listed_total,
    net_sales, customer_total, tax_total,
    merchant_tax_liability, marketplace_tax_liability,
    input_snapshot, amount_snapshot
  ) values (
    pg_temp.store(), v_item, 'hall',
    v_market, 1, v_tax, 1,
    'KR', 'KRW', 0, 'tax_inclusive', 'taxable', 'standard_food',
    'international_tax_v1', 100, 1, 100,
    90, 100, 10,
    7, 3,
    '{"source":"schema-test"}', '{"tax_total":10}'
  ) returning id into v_snapshot;

  insert into daily_sales_item_tax_component_snapshots(
    store_id, sales_tax_snapshot_id, component_id_snapshot, kind, name, rate_pct,
    jurisdiction_level, calculation_basis, applies_to_treatments,
    remittance_owner, unrounded_amount, rounded_amount
  ) values
    (pg_temp.store(), v_snapshot, v_primary, 'primary', '부가세', 10,
     'national', 'primary_tax_exclusive', array['taxable'::tax_treatment], 'merchant', 7, 7),
    (pg_temp.store(), v_snapshot, v_additional, 'additional', '추가세', 5,
     'special', 'primary_tax_inclusive',
     array['taxable'::tax_treatment, 'zero_rated'::tax_treatment], 'marketplace', 3, 3);

  perform pg_temp.raises('판매에 사용한 프로필에는 세금 구성 항목을 더 넣을 수 없다', format(
    'insert into store_tax_components(store_id,tax_profile_id,kind,name,rate_pct,jurisdiction_level,calculation_basis,applies_to_treatments) values (%L,%L,''additional'',''뒤늦은 세금'',1,''custom'',''primary_tax_exclusive'',array[''taxable''::tax_treatment])',
    pg_temp.store(), v_tax), '23514');
  perform pg_temp.raises('판매에 사용한 프로필의 세금 구성 항목을 지울 수 없다',
    format('delete from store_tax_components where id=%L', v_additional), '23514');
  perform pg_temp.raises('판매에 사용한 프로필에는 과세 카테고리를 더 넣을 수 없다', format(
    'insert into tax_category_catalog(store_id,tax_profile_id,code,name,treatment) values (%L,%L,''late_category'',''뒤늦은 분류'',''taxable'')',
    pg_temp.store(), v_tax), '23514');
  perform pg_temp.raises('판매에 사용한 프로필의 과세 카테고리를 지울 수 없다',
    format('delete from tax_category_catalog where tax_profile_id=%L and code=''standard_food''', v_tax), '23514');
  perform pg_temp.raises('과세 카테고리 활성 여부도 같은 판본에서 바꿀 수 없다',
    format('update tax_category_catalog set active=false where tax_profile_id=%L and code=''standard_food''', v_tax), '23514');
  perform pg_temp.raises('판매에 사용한 프로필에는 채널 납부 주체를 더 넣을 수 없다', format(
    'insert into channel_tax_remittance(store_id,tax_component_id,sales_channel_code,remittance_owner) values (%L,%L,''delivery'',''merchant'')',
    pg_temp.store(), v_primary), '23514');
  perform pg_temp.raises('판매에 사용한 프로필의 채널 납부 주체를 지울 수 없다',
    format('delete from channel_tax_remittance where tax_component_id=%L and sales_channel_code=''hall''', v_primary), '23514');
  perform pg_temp.raises('판매에 사용한 프로필에는 메뉴 override를 더 넣을 수 없다', format(
    'insert into menu_tax_overrides(recipe_id,store_id,tax_profile_id,treatment) values (%L,%L,%L,''exempt'')',
    v_recipe2, pg_temp.store(), v_tax), '23514');
  perform pg_temp.raises('판매에 사용한 프로필의 메뉴 override를 지울 수 없다',
    format('delete from menu_tax_overrides where recipe_id=%L and tax_profile_id=%L', v_recipe, v_tax), '23514');
  perform pg_temp.raises('메뉴 override 계산 의미는 같은 판본에서 바꿀 수 없다', format(
    'update menu_tax_overrides set tax_category=null,treatment=''exempt'' where recipe_id=%L and tax_profile_id=%L',
    v_recipe, v_tax), '23514');

  perform pg_temp.raises('스냅샷 통화 소수 자릿수는 시장 원본과 달라질 수 없다',
    format('update daily_sales_item_tax_snapshots set minor_unit=2 where id=%L', v_snapshot), '23514');
  perform pg_temp.raises('구성 항목 이름은 프로필 원본과 달라질 수 없다',
    format('update daily_sales_item_tax_component_snapshots set name=''다른 이름'' where sales_tax_snapshot_id=%L and component_id_snapshot=%L',
      v_snapshot, v_primary), '23514');
  perform pg_temp.raises('판매 세금 스냅샷의 채널 정체성은 바꿀 수 없다',
    format('update daily_sales_item_tax_snapshots set sales_channel_code=''delivery'' where id=%L', v_snapshot), '23514');
  perform pg_temp.raises('RPC 실행 역할은 판매 세금 스냅샷을 지울 수 없다',
    format('delete from daily_sales_item_tax_snapshots where id=%L', v_snapshot), '42501');
  set local role postgres;
  perform pg_temp.raises('소유자도 승인된 물리 삭제 밖에서는 판매 세금 스냅샷을 지울 수 없다',
    format('delete from daily_sales_item_tax_snapshots where id=%L', v_snapshot), '42501');
  perform pg_temp.raises('소유자도 구성 항목 스냅샷만 지워 과거 계산 근거를 없앨 수 없다',
    format('delete from daily_sales_item_tax_component_snapshots where sales_tax_snapshot_id=%L and component_id_snapshot=%L',
      v_snapshot, v_primary), '42501');
  set local role margincook_rpc_executor;
  perform pg_temp.raises('스냅샷 삭제가 막힌 뒤에도 사용된 프로필의 자식 봉인은 유지된다', format(
    'insert into store_tax_components(store_id,tax_profile_id,kind,name,rate_pct,jurisdiction_level,calculation_basis,applies_to_treatments) values (%L,%L,''additional'',''삭제 우회 세금'',1,''custom'',''primary_tax_exclusive'',array[''taxable''::tax_treatment])',
    pg_temp.store(), v_tax), '23514');
  update daily_sales_item_tax_snapshots
     set input_snapshot = input_snapshot || '{"reconciled":true}'::jsonb
   where id = v_snapshot;
  perform pg_temp.ok('계산 결과 보정 필드는 정체성을 유지한 채 갱신할 수 있다',
    (select input_snapshot @> '{"reconciled":true}'::jsonb
       from daily_sales_item_tax_snapshots where id = v_snapshot));

  insert into sales_tax_events(
    store_id, daily_sales_item_id, sales_channel_code, component_id_snapshot,
    delta_amount, target_quantity, calculation_version, business_day_revision_no
  ) values
    (pg_temp.store(), v_item, 'hall', v_primary, 7, 1, 'international_tax_v1', 0),
    (pg_temp.store(), v_item, 'hall', v_additional, 3, 1, 'international_tax_v1', 0);

  perform pg_temp.raises('프로필 스냅샷에 없는 구성 항목으로 세금 이벤트를 만들 수 없다', format(
    'insert into sales_tax_events(store_id,daily_sales_item_id,sales_channel_code,component_id_snapshot,delta_amount,target_quantity,calculation_version,business_day_revision_no) values (%L,%L,''hall'',%L,1,1,''international_tax_v1'',0)',
    pg_temp.store(), v_item, gen_random_uuid()), '23514');

  perform pg_temp.ok('프로필·구성·메뉴·채널·판매 스냅샷이 같은 매장 경계로 연결된다',
    (select count(*) = 2 from daily_sales_item_tax_component_snapshots where sales_tax_snapshot_id = v_snapshot)
    and (select count(*) = 2 from sales_tax_events where daily_sales_item_id = v_item and sales_channel_code = 'hall'));

  perform pg_temp.eq('구성 항목 스냅샷 합 = 계산선 세금 합계',
    (select sum(rounded_amount) from daily_sales_item_tax_component_snapshots where sales_tax_snapshot_id = v_snapshot),
    (select tax_total from daily_sales_item_tax_snapshots where id = v_snapshot), 0);
  perform pg_temp.eq('세금 이벤트 합 = 현재 구성 항목 스냅샷 합계',
    (select sum(delta_amount) from sales_tax_events where daily_sales_item_id = v_item and sales_channel_code = 'hall'),
    (select sum(rounded_amount) from daily_sales_item_tax_component_snapshots where sales_tax_snapshot_id = v_snapshot), 0);

  perform pg_temp.raises('세금 이벤트 UPDATE는 막힌다',
    format('update sales_tax_events set delta_amount = 1 where daily_sales_item_id = %L', v_item), '42501');
  perform pg_temp.raises('세금 이벤트 DELETE는 막힌다',
    format('delete from sales_tax_events where daily_sales_item_id = %L', v_item), '42501');
  perform pg_temp.raises('세금 이벤트 TRUNCATE는 막힌다',
    'truncate sales_tax_events', '42501');

  update daily_sales_items
     set qty_hall=0, qty_delivery=0, qty_takeout=0, qty_waste=0
   where id = v_item;
  update daily_sales_item_tax_snapshots
     set final_quantity=0, listed_total=0, net_sales=0, customer_total=0,
         tax_total=0, merchant_tax_liability=0, marketplace_tax_liability=0,
         amount_snapshot='{"tax_total":0}'::jsonb
   where id = v_snapshot;
  update daily_sales_item_tax_component_snapshots
     set unrounded_amount=0, rounded_amount=0
   where sales_tax_snapshot_id = v_snapshot;
  insert into sales_tax_events(
    store_id, daily_sales_item_id, sales_channel_code, component_id_snapshot,
    delta_amount, target_quantity, calculation_version, business_day_revision_no
  ) values
    (pg_temp.store(), v_item, 'hall', v_primary, -7, 0, 'international_tax_v1', 1),
    (pg_temp.store(), v_item, 'hall', v_additional, -3, 0, 'international_tax_v1', 1);
  perform pg_temp.ok('수량 0 정정은 판매행 tombstone과 역이벤트를 보존한다',
    exists (select 1 from daily_sales_items where id=v_item
      and qty_hall=0 and qty_delivery=0 and qty_takeout=0 and qty_waste=0)
    and (select sum(delta_amount) from sales_tax_events
          where daily_sales_item_id=v_item and sales_channel_code='hall') = 0
    and (select tax_total from daily_sales_item_tax_snapshots where id=v_snapshot) = 0);

  perform pg_temp.raises('판매 날짜보다 앞에서 세금 프로필을 닫을 수 없다',
    format('update store_tax_profiles set effective_to=%L where id=%L', v_sale_date - 1, v_tax), '23514');
  update store_tax_profiles set effective_to = v_sale_date where id = v_tax;
  perform pg_temp.raises('세금 프로필을 닫은 뒤 다시 열 수 없다',
    format('update store_tax_profiles set effective_to=null where id=%L', v_tax), '23514');
  perform pg_temp.raises('판매 날짜보다 앞에서 시장 프로필을 닫을 수 없다',
    format('update store_market_profiles set effective_to=%L where id=%L', v_sale_date - 1, v_market), '23514');
  update store_market_profiles set effective_to = v_sale_date where id = v_market;
  perform pg_temp.raises('시장 프로필을 닫은 뒤 다시 열 수 없다',
    format('update store_market_profiles set effective_to=null where id=%L', v_market), '23514');

  insert into store_market_profiles(
    store_id, country_code, currency_code, business_locale_code,
    price_basis, effective_from, revision
  ) values (
    pg_temp.store(), 'KR', 'KRW', 'ko-KR', 'tax_inclusive', v_sale_date + 1, 2
  ) returning id into v_market2;
  insert into store_tax_profiles(
    store_id, market_profile_id, default_treatment, effective_from, revision
  ) values (
    pg_temp.store(), v_market2, 'taxable', v_sale_date + 1, 2
  ) returning id into v_tax2;
  insert into store_tax_components(
    store_id, tax_profile_id, kind, name, rate_pct,
    jurisdiction_level, calculation_basis, applies_to_treatments
  ) values (
    pg_temp.store(), v_tax2, 'primary', '새 판본 부가세', 10,
    'national', 'primary_tax_exclusive', array['taxable'::tax_treatment]
  );
  perform pg_temp.ok('계산 의미 변경은 새 프로필과 새 revision에서 가능하다',
    exists (select 1 from store_tax_profiles where id = v_tax2 and revision = 2)
    and exists (select 1 from store_tax_components where tax_profile_id = v_tax2 and name = '새 판본 부가세'));

  insert into daily_sales(store_id, sale_date, etc_revenue, daily_extra, note)
  values (pg_temp.store(), v_late_date, 0, 0, 'INTL-1B 기간 밖 스냅샷 시험')
  returning id into v_late_sales;
  insert into daily_sales_items(
    store_id, daily_sales_id, recipe_id, menu_name, unit_price,
    qty_hall, qty_delivery, qty_takeout, unit_material_cost, unit_extra_cost, qty_waste
  ) values (
    pg_temp.store(), v_late_sales, v_recipe, 'INTL-1B 기간 밖 메뉴', 100,
    1, 0, 0, 0, 0, 0
  ) returning id into v_late_item;
  perform pg_temp.raises('판매일 범위 밖의 닫힌 프로필로 스냅샷을 만들 수 없다', format(
    $sql$insert into daily_sales_item_tax_snapshots(
      store_id,daily_sales_item_id,sales_channel_code,
      market_profile_id,market_profile_revision,tax_profile_id,tax_profile_revision,
      country_code,currency_code,minor_unit,price_basis,treatment,tax_category,
      calculation_version,unit_price,final_quantity,listed_total,
      net_sales,customer_total,tax_total,merchant_tax_liability,marketplace_tax_liability,
      input_snapshot,amount_snapshot
    ) values (%L,%L,'hall',%L,1,%L,1,'KR','KRW',0,'tax_inclusive','taxable','standard_food',
      'international_tax_v1',100,1,100,90,100,10,10,0,'{}','{}')$sql$,
    pg_temp.store(), v_late_item, v_market, v_tax), '23514');

  set local role postgres;
  begin
    delete from daily_sales_items where id = v_item;
    raise exception 'FAIL  세금 원장·스냅샷이 있는 판매행을 직접 지웠다';
  exception when insufficient_privilege or foreign_key_violation then
    perform pg_temp.ok('수량 0 tombstone도 세금 원장·스냅샷을 남겨 직접 지울 수 없다', true);
  end;
  set local role margincook_rpc_executor;
end
$fixture$;

-- 다른 사장님의 실제 프로필을 만들어 교차 매장·교차 프로필 경계를 값으로 잰다.
do $cross_store$
declare
  v_owner uuid := pg_temp.new_owner();
  v_foreign_store uuid;
  v_foreign_market uuid;
  v_foreign_tax uuid;
  v_foreign_component uuid;
  v_my_market uuid;
  v_my_tax uuid;
  v_item uuid;
  v_recipe uuid;
begin
  perform pg_temp.as_owner(v_owner);
  v_foreign_store := (create_store('INTL-1B 다른 사장님', 'Asia/Seoul')->>'store_id')::uuid;
  insert into store_market_profiles(
    store_id, country_code, currency_code, business_locale_code,
    price_basis, effective_from, revision
  ) values (
    v_foreign_store, 'KR', 'KRW', 'ko-KR', 'tax_inclusive', '-infinity', 1
  ) returning id into v_foreign_market;
  insert into store_tax_profiles(
    store_id, market_profile_id, default_treatment, effective_from, revision
  ) values (
    v_foreign_store, v_foreign_market, 'taxable', '-infinity', 1
  ) returning id into v_foreign_tax;
  insert into tax_category_catalog(store_id, tax_profile_id, code, name, treatment)
  values (v_foreign_store, v_foreign_tax, 'foreign_only', '다른 매장 전용', 'taxable');
  insert into store_tax_components(
    store_id, tax_profile_id, kind, name, rate_pct,
    jurisdiction_level, calculation_basis, applies_to_treatments
  ) values (
    v_foreign_store, v_foreign_tax, 'primary', '부가세', 10,
    'national', 'primary_tax_exclusive', array['taxable'::tax_treatment]
  ) returning id into v_foreign_component;
  insert into channel_tax_remittance(store_id, tax_component_id, sales_channel_code, remittance_owner)
  values (v_foreign_store, v_foreign_component, 'hall', 'merchant');
  perform set_config('margincook.test.intl_foreign_owner', v_owner::text, true);
  perform set_config('margincook.test.intl_foreign_store', v_foreign_store::text, true);
  perform set_config('margincook.test.intl_foreign_market', v_foreign_market::text, true);
  perform set_config('margincook.test.intl_foreign_tax', v_foreign_tax::text, true);
  perform set_config('margincook.test.intl_foreign_component', v_foreign_component::text, true);

  perform pg_temp.as_owner(pg_temp.owner());
  select id into v_my_market from store_market_profiles
   where store_id = pg_temp.store() and effective_to is null;
  select id into v_my_tax from store_tax_profiles
   where store_id = pg_temp.store() and effective_to is null;
  select id into v_item from daily_sales_items where store_id = pg_temp.store() order by created_at, id limit 1;
  select id into v_recipe from recipes
   where store_id = pg_temp.store()
     and id <> pg_temp.rcp('제육볶음')
   order by id limit 1;

  begin
    insert into daily_sales_item_tax_snapshots(
      store_id, daily_sales_item_id, sales_channel_code,
      market_profile_id, market_profile_revision, tax_profile_id, tax_profile_revision,
      country_code, currency_code, minor_unit, price_basis, treatment,
      calculation_version, unit_price, final_quantity, listed_total,
      net_sales, customer_total, tax_total,
      merchant_tax_liability, marketplace_tax_liability,
      input_snapshot, amount_snapshot
    ) values (
      pg_temp.store(), v_item, 'delivery',
      v_foreign_market, 1, v_foreign_tax, 1,
      'KR', 'KRW', 0, 'tax_inclusive', 'taxable',
      'international_tax_v1', 100, 1, 100,
      90, 100, 10, 10, 0, '{}'::jsonb, '{}'::jsonb
    );
    raise exception 'FAIL  다른 매장 프로필로 판매 세금 스냅샷을 만들었다';
  exception when foreign_key_violation or check_violation then
    null;
  end;

  begin
    insert into menu_tax_overrides(recipe_id, store_id, tax_profile_id, tax_category)
    values (v_recipe, pg_temp.store(), v_my_tax, 'foreign_only');
    raise exception 'FAIL  다른 세금 프로필 카테고리를 메뉴 override에 연결했다';
  exception when foreign_key_violation or check_violation then
    null;
  end;

  perform pg_temp.ok('교차 매장 프로필 시도 뒤 내 프로필 연결은 그대로다',
    exists (select 1 from store_tax_profiles where id = v_my_tax and market_profile_id = v_my_market));
end
$cross_store$;

do $rls$
declare
  v_other_owner uuid := pg_temp.new_owner();
  v_seen integer;
begin
  perform pg_temp.as_owner(v_other_owner);
  select count(*) into v_seen from store_market_profiles;
  perform pg_temp.ok('다른 사장님은 시장 프로필을 볼 수 없다', v_seen = 0);
  select count(*) into v_seen from sales_tax_events;
  perform pg_temp.ok('다른 사장님은 세금 이벤트를 볼 수 없다', v_seen = 0);
  perform pg_temp.as_owner(pg_temp.owner());
end
$rls$;

select pg_temp.ok('schema 단계에서도 국제 세금 capability는 꺼져 있다',
  (app_capabilities()#>>'{international_tax,read_enabled}')::boolean is false
  and (app_capabilities()#>>'{international_tax,write_enabled}')::boolean is false);

select pg_temp.eq('schema 단계에서 현행 0090 세금 계산은 불변',
  tax_of(12000, 'included', '[{"name":"부가세","rate":9.0909090909}]'::jsonb),
  12000 * 10 / 110.0, 0.01);

select pg_temp.ok('DB 통화 minor unit 단일 함수는 KRW=0·나머지=2다', not exists (
  select 1 from unnest(enum_range(null::international_currency_code)) c
   where international_currency_minor_unit(c) is distinct from
     case c when 'KRW' then 0::smallint else 2::smallint end
));

-- append-only는 보존 기간 동안의 계약이다. 기존 공식 문이 승인·보존 종료·백업을 확인한
-- 매장 물리 삭제에서만 세금 이벤트 cascade를 허용하고 수명주기 감사 원장은 남긴다.
do $purge$
declare
  v_owner uuid := current_setting('margincook.test.intl_foreign_owner')::uuid;
  v_store uuid := current_setting('margincook.test.intl_foreign_store')::uuid;
  v_market uuid := current_setting('margincook.test.intl_foreign_market')::uuid;
  v_tax uuid := current_setting('margincook.test.intl_foreign_tax')::uuid;
  v_component uuid := current_setting('margincook.test.intl_foreign_component')::uuid;
  v_sales uuid;
  v_item uuid;
  v_snapshot uuid;
begin
  perform pg_temp.as_owner(v_owner);
  insert into daily_sales(store_id, sale_date, etc_revenue, daily_extra, note)
  values (v_store, current_date, 0, 0, 'INTL-1B purge 전용 판매')
  returning id into v_sales;
  insert into daily_sales_items(
    store_id, daily_sales_id, recipe_id, menu_name, unit_price,
    qty_hall, qty_delivery, qty_takeout, unit_material_cost, unit_extra_cost, qty_waste
  ) values (
    v_store, v_sales, null, 'INTL-1B purge 전용 행', 100,
    1, 0, 0, 0, 0, 0
  ) returning id into v_item;
  insert into daily_sales_item_tax_snapshots(
    store_id, daily_sales_item_id, sales_channel_code,
    market_profile_id, market_profile_revision, tax_profile_id, tax_profile_revision,
    country_code, currency_code, minor_unit, price_basis, treatment,
    calculation_version, unit_price, final_quantity, listed_total,
    net_sales, customer_total, tax_total,
    merchant_tax_liability, marketplace_tax_liability,
    input_snapshot, amount_snapshot
  ) values (
    v_store, v_item, 'hall', v_market, 1, v_tax, 1,
    'KR', 'KRW', 0, 'tax_inclusive', 'taxable',
    'international_tax_v1', 100, 1, 100,
    90, 100, 10, 10, 0, '{}'::jsonb, '{}'::jsonb
  ) returning id into v_snapshot;
  insert into daily_sales_item_tax_component_snapshots(
    store_id, sales_tax_snapshot_id, component_id_snapshot, kind, name, rate_pct,
    jurisdiction_level, calculation_basis, applies_to_treatments,
    remittance_owner, unrounded_amount, rounded_amount
  ) values (
    v_store, v_snapshot, v_component, 'primary', '부가세', 10,
    'national', 'primary_tax_exclusive', array['taxable'::tax_treatment],
    'merchant', 10, 10
  );
  insert into sales_tax_events(
    store_id, daily_sales_item_id, sales_channel_code, component_id_snapshot,
    delta_amount, target_quantity, calculation_version, business_day_revision_no
  ) values (
    v_store, v_item, 'hall', v_component, 10, 1, 'international_tax_v1', 0
  );

  -- 세션 변수만 흉내 내서는 원장·프로필 봉인을 풀 수 없다. 승인 함수가 같은
  -- 트랜잭션에 physical_purge 감사 행을 남긴 뒤에만 실제 cascade가 통과한다.
  perform set_config('margincook.store_purge_id', v_store::text, true);
  perform pg_temp.raises('RPC 실행 역할은 purge 세션 변수를 흉내 내도 세금 이벤트를 지울 수 없다',
    format('delete from sales_tax_events where store_id=%L', v_store), '42501');
  set local role postgres;
  perform pg_temp.raises('소유자도 승인·백업 감사 없이 세금 이벤트를 지울 수 없다',
    format('delete from sales_tax_events where store_id=%L', v_store), '42501');
  perform set_config('margincook.store_purge_id', '', true);
  perform pg_temp.as_owner(v_owner);

  perform archive_my_store(v_store, 'INTL-1B 세금 이벤트 purge 시험');
  set local role service_role;
  perform schedule_store_purge(
    v_store,
    clock_timestamp(),
    'INTL-1B 시험 운영자',
    'INTL-1B-PURGE-APPROVAL',
    '보존 기간 종료 시험');
  perform purge_archived_store(v_store, 'INTL-1B-BACKUP-SHA256');
  set local role postgres;

  perform pg_temp.ok('승인된 매장 물리 삭제는 세금 이벤트와 매장을 함께 지운다',
    not exists (select 1 from stores where id = v_store)
    and not exists (select 1 from sales_tax_events where store_id = v_store));
  perform pg_temp.ok('매장 물리 삭제 뒤에도 승인·백업 감사 원장은 남는다', exists (
    select 1 from store_lifecycle_events
     where store_id = v_store
       and event_type = 'physical_purge'
       and approval_reference = 'INTL-1B-PURGE-APPROVAL'
       and backup_reference = 'INTL-1B-BACKUP-SHA256'
  ));
  set local role margincook_rpc_executor;
end
$purge$;
