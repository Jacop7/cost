-- 0114 · 독립 검수 보완: publisher clock, as-of 기준, 회계 합계 읽기 계약
begin;

create table public.sales_basis_authority_clock (
  store_id uuid primary key references public.stores(id) on delete cascade,
  current_revision bigint not null default 0 check (current_revision>=0),
  published_revision bigint not null default 0 check (published_revision>=0),
  updated_at timestamptz not null default clock_timestamp(),
  check (published_revision<=current_revision)
);
insert into public.sales_basis_authority_clock(store_id)
select id from public.stores on conflict (store_id) do nothing;
alter table public.sales_basis_authority_clock enable row level security;

-- 새 매장도 수명주기 상태와 publisher clock을 같은 부트스트랩에서 만든다.
create or replace function public.sales_lifecycle_seed_new_store()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  insert into public.sales_lifecycle_cutover_state(store_id,phase)
  values (new.id,'legacy_active') on conflict (store_id) do nothing;
  insert into public.sales_basis_authority_clock(store_id)
  values (new.id) on conflict (store_id) do nothing;
  return new;
end $fn$;

-- 기준 변경은 이미 작성이 시작된 날짜로 소급하지 않는다. 오늘이 예정 영업일이어도
-- 예약 영업 시작 전이고 초안/완료/레거시 영업일이 전혀 없을 때만 오늘부터 적용한다.
-- 그 밖에는 영업 규칙상 다음 예정 영업일부터 적용한다.
create or replace function public.sales_basis_effective_date(
  p_store uuid,p_at timestamptz default clock_timestamp()
) returns date language plpgsql volatile security definer set search_path=public,pg_temp as $fn$
declare
  v_today date:=public.store_local_date(p_store,p_at);
  v_day public.sales_calendar_days;
  v_candidate date;
begin
  perform public.assert_my_store(p_store);
  v_day:=public.ensure_sales_calendar_day(p_store,v_today);
  if v_day.day_kind='expected'
     and v_day.scheduled_open_at is not null
     and p_at<v_day.scheduled_open_at
     and not exists(select 1 from public.sales_day_drafts
       where store_id=p_store and business_date=v_today
         and status in ('editing','pending_inventory_resolution'))
     and not exists(select 1 from public.sales_day_heads
       where store_id=p_store and business_date=v_today)
     and not exists(select 1 from public.business_days
       where store_id=p_store and business_date=v_today) then
    return v_today;
  end if;

  for v_candidate in select generate_series(v_today+1,v_today+30,interval '1 day')::date loop
    v_day:=public.ensure_sales_calendar_day(p_store,v_candidate);
    if v_day.day_kind='expected' and v_day.scheduled_open_at is not null
       and not exists(select 1 from public.sales_day_drafts
         where store_id=p_store and business_date=v_candidate
           and status in ('editing','pending_inventory_resolution'))
       and not exists(select 1 from public.sales_day_heads
         where store_id=p_store and business_date=v_candidate)
       and not exists(select 1 from public.business_days
         where store_id=p_store and business_date=v_candidate) then
      return v_candidate;
    end if;
  end loop;
  return v_today+1;
end $fn$;

-- 국제 세금·메뉴 과세·고정비 전파 등 기존 쓰기 경계도 동일한 적용일을 사용한다.
-- 최종 정의를 브리지로 바꿔 남아 있는 모든 기존 호출자가 새 resolver를 공유하게 한다.
create or replace function public.next_unopened_business_date(p_store uuid)
returns date language sql volatile security definer set search_path=public,pg_temp as $fn$
  select public.sales_basis_effective_date(p_store);
$fn$;

-- 현재 권위 입력의 처리 여부는 과거 basis manifest의 내용 hash와 분리한다.
-- source write가 성공했지만 발행이 끝나지 않으면 두 revision이 달라져 첫 저장을 닫는다.
create or replace function public.sales_lifecycle_publish_basis_after_write()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare row_value jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_value jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_value jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_store uuid; v_date date; v_source text; v_hash text; v_revision bigint; boundary date;
begin
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
  if tg_table_name='order_records' then
    if tg_op='INSERT' and coalesce(new_value->>'status','') not in ('received','partial') then return new; end if;
    if tg_op='DELETE' and coalesce(old_value->>'status','') not in ('received','partial') then return old; end if;
    if tg_op='UPDATE' and jsonb_build_object('ingredient_id',old_value->>'ingredient_id',
        'status',old_value->>'status','amount',old_value->>'amount','volume',old_value->>'volume',
        'received_qty',old_value->>'received_qty')
      = jsonb_build_object('ingredient_id',new_value->>'ingredient_id',
        'status',new_value->>'status','amount',new_value->>'amount','volume',new_value->>'volume',
        'received_qty',new_value->>'received_qty') then return new; end if;
  end if;
  v_store:=nullif(row_value->>'store_id','')::uuid;
  if v_store is null and tg_table_name='store_tax_components' then
    select store_id into v_store from public.store_tax_profiles
     where id=nullif(row_value->>'tax_profile_id','')::uuid;
  end if;
  if v_store is null or not exists(select 1 from public.sales_lifecycle_cutover_state
    where store_id=v_store and phase='active') then
    return case when tg_op='DELETE' then old else new end;
  end if;

  v_date:=public.sales_basis_effective_date(v_store);
  if nullif(row_value->>'effective_from','') is not null then
    v_date:=greatest(v_date,(row_value->>'effective_from')::date);
  end if;
  v_source:=coalesce(row_value->>'id',row_value->>'recipe_id',row_value->>'ingredient_id',v_store::text);
  v_hash:=public.sales_json_sha256(jsonb_build_object('operation',tg_op,'row',row_value));
  insert into public.sales_basis_authority_clock(store_id,current_revision,published_revision)
  values (v_store,1,0)
  on conflict (store_id) do update set current_revision=sales_basis_authority_clock.current_revision+1,
    updated_at=clock_timestamp()
  returning current_revision into v_revision;
  insert into public.sales_basis_publisher_state(store_id,source_kind,source_id,processed_revision)
  values (v_store,tg_table_name,v_source,v_hash)
  on conflict (store_id,source_kind,source_id) do update
    set processed_revision=excluded.processed_revision,processed_at=clock_timestamp();

  begin
    -- 새 경계와 이미 예약된 미래 경계를 모두 다시 합성한다. 과거 완료 판본은 건드리지 않는다.
    for boundary in
      select d from (
        select v_date d
        union
        select distinct effective_from_business_date from public.sales_basis_versions
         where store_id=v_store and effective_from_business_date>=v_date
      ) q order by d
    loop
      perform public.publish_sales_basis_version(v_store,boundary);
    end loop;
    update public.sales_basis_authority_clock set published_revision=v_revision,
      updated_at=clock_timestamp() where store_id=v_store;
  exception when sqlstate '45013' then
    -- 원자적 세금 설정 RPC의 중간 행은 불완전할 수 있다. 마지막 완결 trigger가
    -- current까지 발행하고 두 clock을 다시 맞춘다.
    null;
  end;
  return case when tg_op='DELETE' then old else new end;
end $fn$;

create or replace function public.assert_sales_basis_version(
  p_store uuid,p_basis uuid,p_date date,p_require_latest boolean
) returns void language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_row public.sales_basis_versions; v_latest uuid; v_clock public.sales_basis_authority_clock;
begin
  perform public.assert_my_store(p_store);
  select * into v_row from public.sales_basis_versions where id=p_basis and store_id=p_store;
  if not found then
    raise exception '매출 계산 기준을 찾을 수 없어요'
      using errcode='P0002',detail='SALES_BASIS_NOT_FOUND';
  end if;
  if public.sales_json_sha256(v_row.manifest)<>v_row.manifest_sha256 then
    raise exception '매출 계산 기준의 무결성을 확인할 수 없어요'
      using errcode='45009',detail='SALES_BASIS_INTEGRITY_MISMATCH';
  end if;
  if v_row.manifest ? '_basis_content_sha256'
     and public.sales_json_sha256(v_row.manifest-'_source_state'-'_basis_content_sha256')
       <>v_row.manifest->>'_basis_content_sha256' then
    raise exception '매출 계산 기준 내용이 변경됐어요'
      using errcode='45009',detail='SALES_BASIS_CONTENT_MISMATCH';
  end if;
  if p_require_latest then
    select * into v_clock from public.sales_basis_authority_clock where store_id=p_store;
    if v_clock.store_id is null or v_clock.current_revision<>v_clock.published_revision then
      raise exception '계산 기준 발행이 끝나지 않았어요. 잠시 후 다시 열어 주세요.'
        using errcode='45009',detail='SALES_BASIS_PUBLISHER_LAG';
    end if;
    select id into v_latest from public.sales_basis_versions
     where store_id=p_store and effective_from_business_date<=p_date
     order by effective_from_business_date desc,revision desc limit 1;
    if v_latest is distinct from p_basis then
      raise exception '작성 중 계산 기준이 변경됐어요. 최신 기준으로 다시 열어 주세요.'
        using errcode='45009',detail='SALES_BASIS_STALE';
    end if;
  end if;
end $fn$;

-- 앱 전역 관찰자는 구형 영업 상태가 아니라 서버 추천일과 basis 발행 판본을 본다.
create or replace function public.sales_lifecycle_clock(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_now timestamptz:=clock_timestamp(); v_date date;
  v_phase public.sales_cutover_phase; v_current bigint:=0; v_published bigint:=0;
begin
  perform public.assert_my_store(p_store);
  v_date:=public.sales_recommended_date(p_store,v_now);
  select phase into v_phase from public.sales_lifecycle_cutover_state where store_id=p_store;
  select current_revision,published_revision into v_current,v_published
    from public.sales_basis_authority_clock where store_id=p_store;
  return jsonb_build_object('server_now',v_now,'recommended_sales_date',v_date,
    'editable_from',public.sales_editable_from(p_store,v_now),'editable_to',v_date,
    'phase',coalesce(v_phase,'active'::public.sales_cutover_phase),
    'basis_current_revision',coalesce(v_current,0),
    'basis_published_revision',coalesce(v_published,0));
end $fn$;

-- 기간 합계·메뉴·채널을 모두 customer_total/net_sales 계약으로 만든다.
create or replace function public.sales_authoritative_range_detail(
  p_store uuid,p_from date,p_to date
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  with lines as (
    select it.*,ds.sale_date,
      public.sales_item_accounting_totals(it.id) accounting
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), menu_rows as (
    select recipe_id,menu_name,
      sum(qty_hall+qty_delivery+qty_takeout) qty,
      sum(qty_hall) qty_hall,sum(qty_delivery) qty_delivery,sum(qty_takeout) qty_takeout,
      sum(coalesce(qty_waste,0)) qty_waste,
      sum((accounting->>'customer_total')::numeric) revenue,
      sum(unit_material_cost*(qty_hall+qty_delivery+qty_takeout)) material
    from lines where qty_hall+qty_delivery+qty_takeout>0 group by recipe_id,menu_name
  ), menu_json as (
    select coalesce(jsonb_agg(jsonb_build_object('recipe_id',recipe_id,'menu_name',menu_name,
      'qty',qty,'qty_hall',qty_hall,'qty_delivery',qty_delivery,'qty_takeout',qty_takeout,
      'qty_waste',qty_waste,'revenue',revenue,'unit_price',case when qty=0 then 0 else revenue/qty end,
      'unit_material_cost',case when qty=0 then 0 else material/qty end,'material',material)
      order by qty desc,menu_name),'[]'::jsonb) value from menu_rows
  ), menu_channels as (
    select ch.code,ch.name,
      coalesce(sum(coalesce(ts.customer_total,it.unit_price*case ch.code
        when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end)),0) amount,
      coalesce(sum(case ch.code when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end),0) qty,
      coalesce(sum(it.unit_material_cost*case ch.code
        when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end),0) material,
      coalesce(sum(coalesce(ts.tax_total,coalesce(it.unit_tax,case when coalesce(it.tax_mode,'included')='included'
        then it.unit_price*10/110 else 0 end)*case ch.code
          when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end)),0) tax,
      coalesce(sum(coalesce(ts.net_sales,(it.unit_price-coalesce(it.unit_tax,
        case when coalesce(it.tax_mode,'included')='included' then it.unit_price*10/110 else 0 end))*case ch.code
          when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end)),0) net_sales
    from public.sales_channels ch
    left join public.daily_sales ds on ds.store_id=p_store and ds.sale_date between p_from and p_to
    left join public.daily_sales_items it on it.daily_sales_id=ds.id
    left join public.daily_sales_item_tax_snapshots ts on ts.daily_sales_item_id=it.id
      and ts.sales_channel_code::text=ch.code
    where ch.store_id=p_store group by ch.code,ch.name
  ), menu_channels_daily as (
    select ds.sale_date,ch.code,
      coalesce(sum(coalesce(ts.customer_total,it.unit_price*case ch.code
        when 'hall' then it.qty_hall when 'delivery' then it.qty_delivery else it.qty_takeout end)),0) amount
    from public.daily_sales ds
    cross join public.sales_channels ch
    left join public.daily_sales_items it on it.daily_sales_id=ds.id
    left join public.daily_sales_item_tax_snapshots ts on ts.daily_sales_item_id=it.id
      and ts.sales_channel_code::text=ch.code
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
      and ch.store_id=p_store
    group by ds.sale_date,ch.code
  ), etc_lines as (
    select ds.sale_date,nullif(x->>'channel','') code,
      case when ds.etc_tax_snapshot is null
        then coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
        else coalesce((x->'quote'->>'customer_total')::numeric,0) end amount,
      case when ds.etc_tax_snapshot is null then coalesce((x->>'qty')::numeric,1)
        else coalesce((x->>'quantity')::numeric,1) end qty,
      case when ds.etc_tax_snapshot is null then coalesce(ds.etc_tax,0)
          *coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
          /nullif(ds.etc_revenue,0)
        else coalesce((x->'quote'->>'tax_total')::numeric,0) end tax,
      case when ds.etc_tax_snapshot is null
        then coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
        else coalesce((x->'quote'->>'net_sales')::numeric,0) end net_sales
    from public.daily_sales ds cross join lateral jsonb_array_elements(
      case when ds.etc_tax_snapshot is null then coalesce(ds.etc_items,'[]'::jsonb)
           else coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb) end) x
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), etc_channels as (
    select code,sum(amount) amount,sum(qty) qty,coalesce(sum(tax),0) tax,sum(net_sales) net_sales
    from etc_lines where code is not null group by code
  ), etc_channels_daily as (
    select sale_date,code,sum(amount) amount
    from etc_lines where code is not null group by sale_date,code
  ), channel_daily as (
    select m.sale_date,m.code,m.amount+coalesce(e.amount,0) amount
    from menu_channels_daily m left join etc_channels_daily e using(sale_date,code)
  ), version_days as (
    select h.business_date,v.customer_total,v.summary
    from public.sales_day_heads h join public.sales_day_versions v on v.id=h.current_version_id
    where h.store_id=p_store and h.business_date between p_from and p_to
  ), fixed_ready as (
    select count(*)=(select count(*) from public.daily_sales ds
                      where ds.store_id=p_store and ds.sale_date between p_from and p_to)
      and coalesce(bool_and(jsonb_typeof(summary->'fixed_cost')='number'),true) ready
    from version_days
  ), fixed_channels as (
    select c.code,case when r.ready then sum(
      case when v.customer_total>0
        then (v.summary->>'fixed_cost')::numeric*c.amount/v.customer_total else 0 end)
      else null end amount
    from channel_daily c join version_days v on v.business_date=c.sale_date
    cross join fixed_ready r group by c.code,r.ready
  ), fixed_totals as (
    select case when r.ready then coalesce(sum((v.summary->>'fixed_cost')::numeric),0) else null end total,
      case when r.ready then greatest(coalesce(sum((v.summary->>'fixed_cost')::numeric),0)
        -coalesce((select sum(amount) from fixed_channels),0),0) else null end unallocated
    from fixed_ready r left join version_days v on true group by r.ready
  ), channel_json as (
    select coalesce(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name,
      'amount',m.amount+coalesce(e.amount,0),'qty',m.qty+coalesce(e.qty,0),
      'material',m.material,'tax',m.tax+coalesce(e.tax,0),
      'net_sales',m.net_sales+coalesce(e.net_sales,0),'fixed_cost',f.amount)
      order by m.amount+coalesce(e.amount,0) desc,m.code),'[]'::jsonb) value
    from menu_channels m left join etc_channels e using(code)
    left join fixed_channels f using(code)
  )
  select jsonb_build_object('from',p_from,'to',p_to,'menu',menu_json.value,
    'channels',channel_json.value,'fixed_cost_total',fixed_totals.total,
    'fixed_cost_unallocated',fixed_totals.unallocated)
  from menu_json cross join channel_json cross join fixed_totals;
$fn$;

grant create on schema public to costkeep_rpc_executor;
alter table public.sales_basis_authority_clock owner to costkeep_rpc_executor;
alter function public.sales_lifecycle_seed_new_store() owner to costkeep_rpc_executor;
alter function public.sales_basis_effective_date(uuid,timestamptz) owner to costkeep_rpc_executor;
alter function public.next_unopened_business_date(uuid) owner to costkeep_rpc_executor;
alter function public.sales_lifecycle_publish_basis_after_write() owner to costkeep_rpc_executor;
alter function public.assert_sales_basis_version(uuid,uuid,date,boolean) owner to costkeep_rpc_executor;
alter function public.sales_authoritative_range_detail(uuid,date,date) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on table public.sales_basis_authority_clock from public,anon,authenticated;
revoke all on function public.sales_basis_effective_date(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.sales_authoritative_range_detail(uuid,date,date) from public,anon;
grant execute on function public.sales_authoritative_range_detail(uuid,date,date) to authenticated;

notify pgrst,'reload schema';
commit;
