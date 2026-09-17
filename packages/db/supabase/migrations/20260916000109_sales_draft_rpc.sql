-- 0109 · 매출 서버 초안 RPC
-- 화면의 임시 상태를 서버가 소유하고 전체 목표 상태/CAS로 저장한다.
begin;

create or replace function public.sales_json_sha256(p_value jsonb)
returns text language sql immutable parallel safe
set search_path=public,pg_temp
as $fn$
  select encode(extensions.digest(convert_to(coalesce(p_value,'null'::jsonb)::text,'UTF8'),'sha256'),'hex');
$fn$;

create or replace function public.sales_normalize_basis_manifest(p_manifest jsonb)
returns jsonb language sql immutable parallel safe set search_path=public,pg_temp as $fn$
  -- closing은 판매 결과, taken_at·메뉴별 basis_at은 캡처 시각이다.
  -- 계산 입력 판본 해시에는 포함하지 않는다.
  with base as (
    select coalesce(p_manifest,'{}'::jsonb)-'closing'-'taken_at' value
  ), cleaned as (
    select case when jsonb_typeof(value->'recipes')='object' then
      jsonb_set(value,'{recipes}',coalesce((select jsonb_object_agg(key,item-'basis_at')
        from jsonb_each(value->'recipes') entries(key,item)),'{}'::jsonb),true)
      else value end value from base
  )
  select case when coalesce(value#>>'{fixed_basis,applied}','true')='false'
    then jsonb_set(value,'{fixed_rate}','null'::jsonb,true) else value end from cleaned;
$fn$;

create or replace function public.ensure_sales_calendar_day(p_store uuid,p_date date)
returns public.sales_calendar_days
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_row public.sales_calendar_days;
  v_hours jsonb;
  v_tz text;
begin
  perform public.assert_my_store(p_store);
  select * into v_row from public.sales_calendar_days
   where store_id=p_store and business_date=p_date;
  if found then return v_row; end if;

  v_tz := public.store_timezone(p_store);
  v_hours := public.store_hours_on(p_store,p_date);
  insert into public.sales_calendar_days(
    store_id,business_date,day_kind,source,timezone_id,scheduled_open_at,scheduled_close_at)
  values (
    p_store,p_date,
    case when coalesce((v_hours->>'closed')::boolean,false)
      then 'closed'::public.sales_calendar_day_kind else 'expected'::public.sales_calendar_day_kind end,
    'operating_rule'::public.sales_calendar_source,
    coalesce(v_tz,'Asia/Seoul'),
    public.scheduled_open_at(p_store,p_date),
    public.planned_close(p_store,p_date))
  returning * into v_row;
  return v_row;
end $fn$;

create or replace function public.publish_sales_basis_version(p_store uuid,p_date date)
returns public.sales_basis_versions
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_manifest jsonb;
  v_hash text;
  v_revision bigint;
  v_source_clock bigint;
  v_content_hash text;
  v_source_state jsonb;
  v_from_closed_day boolean:=false;
  v_row public.sales_basis_versions;
  v_quality public.sales_basis_quality:='exact';
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);

  select b.snapshot,coalesce(b.basis_quality::text,'legacy_unrecorded')::public.sales_basis_quality
    into v_manifest,v_quality from public.business_days b
   where b.store_id=p_store and b.business_date=p_date;
  v_from_closed_day:=found;
  if not found then
    v_manifest := public.build_day_snapshot(p_store,p_date);
    -- 추천일보다 과거인 날짜를 현재 master로 재구성할 때만 추정이다.
    -- 개점 전 오늘처럼 추천일(전날)보다 뒤에 적용되는 새 기준은 정확한 미래 판본이다.
    v_quality := case when p_date>=public.sales_recommended_date(p_store)
      then 'exact'::public.sales_basis_quality else 'estimated_current'::public.sales_basis_quality end;
  end if;
  v_manifest:=public.sales_normalize_basis_manifest(v_manifest);
  if v_manifest is null or v_manifest='{}'::jsonb then
    raise exception '해당 날짜의 계산 기준을 만들 수 없어요'
      using errcode='22000',detail='SALES_BASIS_NOT_AVAILABLE';
  end if;
  -- 새 수명주기에서 발행한 기준에는 publisher가 처리한 source 판본을 함께 봉인한다.
  -- 이관 전 마감 snapshot은 당시 source 판본이 없으므로 그대로 legacy 품질로 보존한다.
  if not v_from_closed_day then
    v_content_hash:=public.sales_json_sha256(v_manifest-'_source_state'-'_basis_content_sha256');
    insert into public.sales_basis_publisher_state(store_id,source_kind,source_id,processed_revision)
    values (p_store,'authority_manifest',p_date::text,v_content_hash)
    on conflict (store_id,source_kind,source_id) do update
      set processed_revision=excluded.processed_revision,processed_at=clock_timestamp();
    select coalesce(jsonb_agg(jsonb_build_object('kind',source_kind,'id',source_id,
        'revision',processed_revision) order by source_kind,source_id),'[]'::jsonb)
      into v_source_state
    from public.sales_basis_publisher_state where store_id=p_store
      and (source_kind<>'authority_manifest' or source_id=p_date::text);
    v_manifest:=v_manifest||jsonb_build_object('_basis_content_sha256',v_content_hash,
      '_source_state',v_source_state);
  end if;
  v_hash := public.sales_json_sha256(v_manifest);

  select * into v_row from public.sales_basis_versions
   where store_id=p_store and effective_from_business_date=p_date and manifest_sha256=v_hash
   order by revision desc limit 1;
  if found then return v_row; end if;

  select coalesce(max(revision),0)+1 into v_revision
    from public.sales_basis_versions
   where store_id=p_store and effective_from_business_date=p_date;
  select coalesce(max(source_clock),0)+1 into v_source_clock
    from public.sales_basis_versions where store_id=p_store;
  insert into public.sales_basis_versions(
    store_id,effective_from_business_date,revision,basis_quality,manifest,manifest_sha256,source_clock)
  values (p_store,p_date,v_revision,v_quality,v_manifest,v_hash,v_source_clock)
  returning * into v_row;
  return v_row;
end $fn$;

create or replace function public.resolve_sales_basis_version(p_store uuid,p_date date)
returns public.sales_basis_versions
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_row public.sales_basis_versions;
begin
  perform public.assert_my_store(p_store);
  -- 조회는 판본을 만들지 않는다. 해당 날짜에 이미 유효했던 가장 최근 판본만 고른다.
  select * into v_row from public.sales_basis_versions
   where store_id=p_store and effective_from_business_date<=p_date
   order by effective_from_business_date desc,revision desc limit 1;
  if not found then
    raise exception '해당 날짜에 유효했던 매출 계산 기준이 없어요'
      using errcode='45051',detail='SALES_BASIS_AS_OF_NOT_AVAILABLE';
  end if;
  return v_row;
end $fn$;

create or replace function public.assert_sales_basis_version(
  p_store uuid,p_basis uuid,p_date date,p_require_latest boolean
) returns void language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_row public.sales_basis_versions;
  v_latest uuid;
  v_embedded text;
  v_published text;
  v_current_hash text;
begin
  perform public.assert_my_store(p_store);
  select * into v_row from public.sales_basis_versions
   where id=p_basis and store_id=p_store;
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
    select id into v_latest from public.sales_basis_versions
     where store_id=p_store and effective_from_business_date<=p_date
     order by effective_from_business_date desc,revision desc limit 1;
    if v_latest is distinct from p_basis then
      raise exception '작성 중 계산 기준이 변경됐어요. 최신 기준으로 다시 열어 주세요.'
        using errcode='45009',detail='SALES_BASIS_STALE';
    end if;
    select source->>'revision' into v_embedded
      from jsonb_array_elements(coalesce(v_row.manifest->'_source_state','[]'::jsonb)) source
     where source->>'kind'='authority_manifest'
       and source->>'id'=v_row.effective_from_business_date::text
     limit 1;
    select processed_revision into v_published
      from public.sales_basis_publisher_state
     where store_id=p_store and source_kind='authority_manifest'
       and source_id=v_row.effective_from_business_date::text;
    v_current_hash:=public.sales_json_sha256(
      public.sales_normalize_basis_manifest(
        public.build_day_snapshot(p_store,v_row.effective_from_business_date))
        -'_source_state'-'_basis_content_sha256');
    if v_published is null or v_published is distinct from v_current_hash
       or (v_embedded is not null and v_published is distinct from v_embedded) then
      raise exception '작성 중 계산 기준 발행 상태가 변경됐어요. 최신 기준으로 다시 열어 주세요.'
        using errcode='45009',detail='SALES_BASIS_STALE';
    end if;
  end if;
end $fn$;

create or replace function public.sales_draft_payload(p_draft uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'recipe_id',m.recipe_id,'menu_name',m.menu_name,
      'qty_hall',m.qty_hall,'qty_delivery',m.qty_delivery,
      'qty_takeout',m.qty_takeout,'qty_waste',m.qty_waste,'deleted',m.deleted)
      order by m.sort_order,m.id) from public.sales_draft_menu_lines m where m.draft_id=p_draft),'[]'::jsonb),
    'etc_items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'name',e.name,'price',e.price,'qty',e.qty,'channel',e.channel,'deleted',e.deleted)
      order by e.sort_order,e.id) from public.sales_draft_etc_lines e where e.draft_id=p_draft),'[]'::jsonb),
    'extra_items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',x.id,'name',x.name,'amount',x.amount,'memo',x.memo,'deleted',x.deleted)
      order by x.sort_order,x.id) from public.sales_draft_expense_lines x where x.draft_id=p_draft),'[]'::jsonb));
$fn$;

create or replace function public.sales_draft_inventory_deltas(p_draft uuid)
returns table(line_id uuid,ingredient_id uuid,waste boolean,delta numeric)
language sql stable security definer set search_path=public,pg_temp as $fn$
  with target as (
    select m.id line_id,m.recipe_id,(line->>'ingredient_id')::uuid ingredient_id,false waste,
      (case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end)
        * coalesce((line->>'per_serving')::numeric,0) quantity
    from public.sales_draft_menu_lines m
    join public.sales_day_drafts d on d.id=m.draft_id
    join public.sales_basis_versions b on b.id=d.basis_version_id
    cross join lateral jsonb_array_elements(coalesce(
      b.manifest#>array['recipes',m.recipe_id::text,'lines'],'[]'::jsonb)) line
    where m.draft_id=p_draft
    union all
    select m.id,m.recipe_id,(line->>'ingredient_id')::uuid,true,
      (case when m.deleted then 0 else m.qty_waste end)
        * coalesce((line->>'per_serving')::numeric,0) quantity
    from public.sales_draft_menu_lines m
    join public.sales_day_drafts d on d.id=m.draft_id
    join public.sales_basis_versions b on b.id=d.basis_version_id
    cross join lateral jsonb_array_elements(coalesce(
      b.manifest#>array['recipes',m.recipe_id::text,'lines'],'[]'::jsonb)) line
    where m.draft_id=p_draft
  ), applied as (
    select m.id line_id,m.recipe_id,(line->>'ingredient_id')::uuid ingredient_id,false waste,
      coalesce(i.qty_hall+i.qty_delivery+i.qty_takeout,0)
        * coalesce((line->>'per_serving')::numeric,0) quantity
    from public.sales_draft_menu_lines m
    join public.sales_day_drafts d on d.id=m.draft_id
    join public.sales_basis_versions b on b.id=d.basis_version_id
    cross join lateral jsonb_array_elements(coalesce(
      b.manifest#>array['recipes',m.recipe_id::text,'lines'],'[]'::jsonb)) line
    left join public.daily_sales ds on ds.store_id=d.store_id and ds.sale_date=d.business_date
    left join public.daily_sales_items i on i.daily_sales_id=ds.id and i.recipe_id=m.recipe_id
    where m.draft_id=p_draft
    union all
    select m.id,m.recipe_id,(line->>'ingredient_id')::uuid,true,
      coalesce(i.qty_waste,0)
        * coalesce((line->>'per_serving')::numeric,0) quantity
    from public.sales_draft_menu_lines m
    join public.sales_day_drafts d on d.id=m.draft_id
    join public.sales_basis_versions b on b.id=d.basis_version_id
    cross join lateral jsonb_array_elements(coalesce(
      b.manifest#>array['recipes',m.recipe_id::text,'lines'],'[]'::jsonb)) line
    left join public.daily_sales ds on ds.store_id=d.store_id and ds.sale_date=d.business_date
    left join public.daily_sales_items i on i.daily_sales_id=ds.id and i.recipe_id=m.recipe_id
    where m.draft_id=p_draft
  )
  select t.line_id,t.ingredient_id,t.waste,sum(t.quantity-coalesce(a.quantity,0)) delta
  from target t left join applied a using(line_id,recipe_id,ingredient_id,waste)
  group by t.line_id,t.ingredient_id,t.waste
  having abs(sum(t.quantity-coalesce(a.quantity,0)))>=1e-9;
$fn$;

create or replace function public.sales_editable_from(
  p_store uuid,p_at timestamptz default clock_timestamp()
) returns date language sql stable security definer set search_path=public,pg_temp as $fn$
  select date_trunc('month',(public.sales_recommended_date(p_store,p_at)-interval '1 month')::timestamp)::date;
$fn$;

create or replace function public.sales_draft_expires_at(p_store uuid,p_date date)
returns timestamptz language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare d date:=date_trunc('month',p_date::timestamp)::date+interval '2 months';
  h jsonb; candidate timestamptz;
begin
  for offset_day in 0..31 loop
    h:=public.store_hours_on(p_store,d+offset_day);
    if not coalesce((h->>'closed')::boolean,false) then
      candidate:=public.scheduled_open_at(p_store,d+offset_day);
      return coalesce(candidate,((d+offset_day)::timestamp at time zone public.store_timezone(p_store)));
    end if;
  end loop;
  return ((d+interval '1 month')::date::timestamp at time zone public.store_timezone(p_store));
end
$fn$;

create or replace function public.expire_sales_drafts(p_store uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_count integer; v_expired uuid[];
begin
  -- 상태 조건이 붙은 UPDATE 자체가 행을 잠그고 종료 대상을 확정한다. 별도 선조회 뒤
  -- 무조건 갱신하면 동시에 완료·폐기된 terminal 초안의 시각 계약과 경합할 수 있다.
  with expired as (
    update public.sales_day_drafts set status='expired'
     where store_id=p_store and status in ('editing','pending_inventory_resolution')
       and business_date<public.sales_editable_from(p_store)
     returning id
  )
  select coalesce(array_agg(id),'{}'::uuid[]),count(*)::integer
    into v_expired,v_count from expired;
  update public.pending_sales_inventory_resolution pending
     set status='abandoned'
   where pending.status='pending' and pending.draft_id=any(v_expired);
  return v_count;
end $fn$;

create or replace function public.open_sales_draft(
  p_store uuid,p_date date,p_draft_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_draft public.sales_day_drafts;
  v_basis public.sales_basis_versions;
  v_kind public.sales_draft_kind;
  v_base integer:=0;
  v_payload jsonb;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  perform public.expire_inventory_count_session(p_store);
  if exists(select 1 from public.inventory_count_sessions where store_id=p_store and status='active') then
    raise exception '재고 실사 중에는 매출을 작성할 수 없어요'
      using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  perform public.expire_sales_drafts(p_store);

  if not exists (select 1 from public.sales_lifecycle_cutover_state
             where store_id=p_store and phase='active') then
    raise exception '매출 전환 확인이 필요해요'
      using errcode='45040',detail='SALES_LIFECYCLE_NOT_ACTIVE';
  end if;
  if p_date>public.sales_recommended_date(p_store)
     or p_date<public.sales_editable_from(p_store) then
    raise exception '입력할 수 있는 날짜가 아니에요'
      using errcode='45010',detail='SALE_DATE_OUT_OF_RANGE';
  end if;

  perform public.ensure_sales_calendar_day(p_store,p_date);
  select * into v_draft from public.sales_day_drafts
   where store_id=p_store and business_date=p_date
     and status in ('editing','pending_inventory_resolution')
   for update;
  if found then
    return jsonb_build_object('draft_id',v_draft.id,'business_date',v_draft.business_date,
      'kind',v_draft.draft_kind,'status',v_draft.status,'revision',v_draft.draft_revision,
      'payload_hash',v_draft.payload_hash,'expires_at',v_draft.expires_at,
      'payload',public.sales_draft_payload(v_draft.id));
  end if;

  if exists (select 1 from public.sales_day_drafts where id=p_draft_id) then
    raise exception '다른 초안에서 사용 중인 식별자예요'
      using errcode='23505',detail='DRAFT_ID_ALREADY_USED';
  end if;

  select coalesce((select ds.revision from public.daily_sales ds
   where ds.store_id=p_store and ds.sale_date=p_date),0) into v_base;
  v_kind:=case when exists(select 1 from public.daily_sales ds
                            where ds.store_id=p_store and ds.sale_date=p_date)
                         or exists(select 1 from public.business_days b
                            where b.store_id=p_store and b.business_date=p_date and b.status='closed')
               then 'amendment'::public.sales_draft_kind else 'initial'::public.sales_draft_kind end;

  if v_kind='amendment' then
    select b.* into v_basis
      from public.sales_day_heads h
      join public.sales_day_versions v on v.id=h.current_version_id
      join public.sales_basis_versions b on b.id=v.basis_version_id
     where h.store_id=p_store and h.business_date=p_date;
    if v_basis.id is null then
      select b.* into v_basis from public.sales_basis_versions b
       where b.store_id=p_store and b.effective_from_business_date=p_date
       order by b.revision desc limit 1;
    end if;
    if v_basis.id is null and exists(select 1 from public.business_days day
      where day.store_id=p_store and day.business_date=p_date and day.snapshot is not null) then
      v_basis:=public.publish_sales_basis_version(p_store,p_date);
    end if;
    if v_basis.id is null then
      raise exception '완료된 매출의 계산 기준을 찾을 수 없어요'
        using errcode='45051',detail='SALES_BASIS_AS_OF_NOT_AVAILABLE';
    end if;
  else
    v_basis:=public.resolve_sales_basis_version(p_store,p_date);
  end if;

  insert into public.sales_day_drafts(id,store_id,business_date,draft_kind,status,
    base_ledger_revision,basis_version_id,payload_hash,last_saved_by,expires_at)
  values (p_draft_id,p_store,p_date,v_kind,'editing',v_base,v_basis.id,
    repeat('0',64),auth.uid(),public.sales_draft_expires_at(p_store,p_date))
  returning * into v_draft;

  if v_kind='amendment' then
    insert into public.sales_draft_menu_lines(id,draft_id,recipe_id,menu_name,
      qty_hall,qty_delivery,qty_takeout,qty_waste,sort_order)
    select gen_random_uuid(),p_draft_id,i.recipe_id,i.menu_name,
      i.qty_hall,i.qty_delivery,i.qty_takeout,coalesce(i.qty_waste,0),
      row_number() over(order by i.menu_name,i.id)::integer
    from public.daily_sales ds join public.daily_sales_items i on i.daily_sales_id=ds.id
    where ds.store_id=p_store and ds.sale_date=p_date;

    insert into public.sales_draft_etc_lines(id,draft_id,name,price,qty,channel,sort_order)
    select gen_random_uuid(),p_draft_id,
      coalesce(x->>'name','기타 매출'),coalesce((x->>'price')::numeric,0),
      coalesce((x->>'qty')::numeric,1),coalesce(nullif(x->>'channel',''),'hall'),ord::integer
    from public.daily_sales ds,
      jsonb_array_elements(coalesce(ds.etc_items,'[]'::jsonb)) with ordinality a(x,ord)
    where ds.store_id=p_store and ds.sale_date=p_date;

    insert into public.sales_draft_expense_lines(id,draft_id,name,amount,memo,sort_order)
    select gen_random_uuid(),p_draft_id,
      coalesce(x->>'name','추가 지출'),coalesce((x->>'amount')::numeric,0),x->>'memo',ord::integer
    from public.daily_sales ds,
      jsonb_array_elements(coalesce(ds.extra_items,'[]'::jsonb)) with ordinality a(x,ord)
    where ds.store_id=p_store and ds.sale_date=p_date;
  end if;

  insert into public.sales_draft_menu_lines(id,draft_id,recipe_id,menu_name,sort_order)
  select gen_random_uuid(),p_draft_id,r.id,r.name,
    100000+row_number() over(order by r.name,r.id)::integer
  from public.recipes r
  where r.store_id=p_store and coalesce(r.active,true)
    and (v_kind='initial' or coalesce(v_basis.manifest->'recipes','{}'::jsonb) ? r.id::text)
    and not exists(select 1 from public.sales_draft_menu_lines m
                   where m.draft_id=p_draft_id and m.recipe_id=r.id);

  v_payload:=public.sales_draft_payload(p_draft_id);
  update public.sales_day_drafts set payload_hash=public.sales_json_sha256(v_payload)
   where id=p_draft_id returning * into v_draft;
  return jsonb_build_object('draft_id',v_draft.id,'business_date',v_draft.business_date,
    'kind',v_draft.draft_kind,'status',v_draft.status,'revision',v_draft.draft_revision,
    'payload_hash',v_draft.payload_hash,'expires_at',v_draft.expires_at,'payload',v_payload);
end $fn$;

create or replace function public.save_sales_draft(
  p_store uuid,p_draft uuid,p_base_revision integer,
  p_items jsonb,p_etc_items jsonb,p_extra_items jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_draft public.sales_day_drafts;
  v_expected uuid[];
  v_supplied uuid[];
  v_expected_etc uuid[];
  v_supplied_etc uuid[];
  v_expected_extra uuid[];
  v_supplied_extra uuid[];
  v_payload jsonb;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  perform public.expire_inventory_count_session(p_store);
  if exists(select 1 from public.inventory_count_sessions where store_id=p_store and status='active') then
    raise exception '재고 실사 중에는 매출을 저장할 수 없어요'
      using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  select * into v_draft from public.sales_day_drafts where id=p_draft for update;
  if not found or v_draft.store_id<>p_store then
    raise exception '매출 초안을 찾을 수 없어요' using errcode='P0002',detail='SALES_DRAFT_NOT_FOUND';
  end if;
  if v_draft.status<>'editing' then
    raise exception '수정할 수 없는 매출 초안이에요' using errcode='45041',detail='SALES_DRAFT_NOT_EDITABLE';
  end if;
  if v_draft.business_date<public.sales_editable_from(p_store) then
    update public.sales_day_drafts set status='expired' where id=p_draft;
    return jsonb_build_object('draft_id',p_draft,'business_date',v_draft.business_date,
      'kind',v_draft.draft_kind,'status','expired','revision',v_draft.draft_revision,
      'payload_hash',v_draft.payload_hash,'expires_at',v_draft.expires_at,
      'payload',public.sales_draft_payload(p_draft));
  end if;
  if v_draft.draft_revision<>p_base_revision then
    raise exception '다른 기기에서 초안이 변경됐어요'
      using errcode='45009',detail='DRAFT_REVISION_CONFLICT';
  end if;
  perform public.assert_sales_basis_version(p_store,v_draft.basis_version_id,
    v_draft.business_date,v_draft.draft_kind='initial' and v_draft.draft_revision=0);

  select array_agg(recipe_id order by recipe_id) into v_expected
    from public.sales_draft_menu_lines where draft_id=p_draft;
  select array_agg((x->>'recipe_id')::uuid order by (x->>'recipe_id')::uuid) into v_supplied
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) x;
  if coalesce(jsonb_array_length(p_items),0)<>coalesce(cardinality(v_supplied),0)
     or v_expected is distinct from v_supplied then
    raise exception '메뉴 전체 상태를 보내 주세요. 삭제는 0 또는 삭제 표시로 남겨야 해요'
      using errcode='45043',detail='DRAFT_TARGET_INCOMPLETE';
  end if;
  if p_etc_items is null or p_extra_items is null
     or jsonb_typeof(p_etc_items)<>'array' or jsonb_typeof(p_extra_items)<>'array' then
    raise exception '기타 매출과 추가 지출의 전체 상태를 보내 주세요'
      using errcode='45043',detail='DRAFT_TARGET_INCOMPLETE';
  end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_expected_etc
    from public.sales_draft_etc_lines where draft_id=p_draft;
  select coalesce(array_agg((x->>'id')::uuid order by (x->>'id')::uuid),'{}'::uuid[])
    into v_supplied_etc from jsonb_array_elements(p_etc_items) x;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_expected_extra
    from public.sales_draft_expense_lines where draft_id=p_draft;
  select coalesce(array_agg((x->>'id')::uuid order by (x->>'id')::uuid),'{}'::uuid[])
    into v_supplied_extra from jsonb_array_elements(p_extra_items) x;
  if jsonb_array_length(p_etc_items)<>cardinality(v_supplied_etc)
     or jsonb_array_length(p_extra_items)<>cardinality(v_supplied_extra)
     or exists(select 1 from unnest(v_expected_etc) id where not id=any(v_supplied_etc))
     or exists(select 1 from unnest(v_expected_extra) id where not id=any(v_supplied_extra)) then
    raise exception '기존 기타 매출과 추가 지출은 삭제 표시를 포함해 모두 보내 주세요'
      using errcode='45043',detail='DRAFT_TARGET_INCOMPLETE';
  end if;

  delete from public.sales_draft_menu_lines where draft_id=p_draft;
  insert into public.sales_draft_menu_lines(id,draft_id,recipe_id,menu_name,
    qty_hall,qty_delivery,qty_takeout,qty_waste,deleted,sort_order)
  select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),p_draft,(x->>'recipe_id')::uuid,
    coalesce(nullif(x->>'menu_name',''),r.name),
    coalesce((x->>'qty_hall')::numeric,0),coalesce((x->>'qty_delivery')::numeric,0),
    coalesce((x->>'qty_takeout')::numeric,0),coalesce((x->>'qty_waste')::numeric,0),
    coalesce((x->>'deleted')::boolean,false),ord::integer
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) with ordinality a(x,ord)
  join public.recipes r on r.id=(x->>'recipe_id')::uuid and r.store_id=p_store;

  delete from public.sales_draft_etc_lines where draft_id=p_draft;
  insert into public.sales_draft_etc_lines(id,draft_id,name,price,qty,channel,deleted,sort_order)
  select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),p_draft,
    coalesce(nullif(x->>'name',''),'기타 매출'),coalesce((x->>'price')::numeric,0),
    coalesce((x->>'qty')::numeric,1),coalesce(nullif(x->>'channel',''),'hall'),
    coalesce((x->>'deleted')::boolean,false),ord::integer
  from jsonb_array_elements(coalesce(p_etc_items,'[]'::jsonb)) with ordinality a(x,ord);

  delete from public.sales_draft_expense_lines where draft_id=p_draft;
  insert into public.sales_draft_expense_lines(id,draft_id,name,amount,memo,deleted,sort_order)
  select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),p_draft,
    coalesce(nullif(x->>'name',''),'추가 지출'),coalesce((x->>'amount')::numeric,0),
    x->>'memo',coalesce((x->>'deleted')::boolean,false),ord::integer
  from jsonb_array_elements(coalesce(p_extra_items,'[]'::jsonb)) with ordinality a(x,ord);

  v_payload:=public.sales_draft_payload(p_draft);
  update public.sales_day_drafts set status='editing',draft_revision=draft_revision+1,
    payload_hash=public.sales_json_sha256(v_payload),last_saved_by=auth.uid(),last_saved_at=clock_timestamp()
  where id=p_draft returning * into v_draft;
  return jsonb_build_object('draft_id',v_draft.id,'business_date',v_draft.business_date,
    'kind',v_draft.draft_kind,'status',v_draft.status,
    'revision',v_draft.draft_revision,'payload_hash',v_draft.payload_hash,
    'expires_at',v_draft.expires_at,'last_saved_at',v_draft.last_saved_at,'payload',v_payload);
end $fn$;

create or replace function public.discard_sales_draft(p_store uuid,p_draft uuid,p_base_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v public.sales_day_drafts;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  perform public.expire_inventory_count_session(p_store);
  if exists(select 1 from public.inventory_count_sessions where store_id=p_store and status='active') then
    raise exception '재고 실사 중에는 매출 초안을 폐기할 수 없어요'
      using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  select * into v from public.sales_day_drafts where id=p_draft for update;
  if not found or v.store_id<>p_store then
    raise exception '매출 초안을 찾을 수 없어요' using errcode='P0002',detail='SALES_DRAFT_NOT_FOUND';
  end if;
  if v.status not in ('editing','pending_inventory_resolution') or v.draft_revision<>p_base_revision then
    raise exception '최신 초안 상태를 다시 확인해 주세요' using errcode='45009',detail='DRAFT_REVISION_CONFLICT';
  end if;
  if v.status='pending_inventory_resolution' then
    update public.pending_sales_inventory_resolution set status='abandoned'
     where draft_id=p_draft and status='pending';
  end if;
  update public.sales_day_drafts set status='discarded',discarded_at=clock_timestamp() where id=p_draft;
  return jsonb_build_object('draft_id',p_draft,'status','discarded');
end $fn$;

create or replace function public.sales_draft_detail(p_store uuid,p_draft uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v public.sales_day_drafts;
begin
  perform public.assert_my_store(p_store);
  select * into v from public.sales_day_drafts where id=p_draft and store_id=p_store;
  if not found then raise exception '매출 초안을 찾을 수 없어요' using errcode='P0002'; end if;
  return jsonb_build_object('draft_id',v.id,'business_date',v.business_date,'kind',v.draft_kind,
    'status',v.status,'revision',v.draft_revision,'payload_hash',v.payload_hash,
    'base_ledger_revision',v.base_ledger_revision,'basis_version_id',v.basis_version_id,
    'last_saved_at',v.last_saved_at,'expires_at',v.expires_at,'payload',public.sales_draft_payload(v.id));
end $fn$;

grant create on schema public to costkeep_rpc_executor;
do $m$
begin
  alter function public.sales_json_sha256(jsonb) owner to costkeep_rpc_executor;
  alter function public.sales_normalize_basis_manifest(jsonb) owner to costkeep_rpc_executor;
  alter function public.ensure_sales_calendar_day(uuid,date) owner to costkeep_rpc_executor;
  alter function public.publish_sales_basis_version(uuid,date) owner to costkeep_rpc_executor;
  alter function public.resolve_sales_basis_version(uuid,date) owner to costkeep_rpc_executor;
  alter function public.assert_sales_basis_version(uuid,uuid,date,boolean) owner to costkeep_rpc_executor;
  alter function public.sales_draft_payload(uuid) owner to costkeep_rpc_executor;
  alter function public.sales_draft_inventory_deltas(uuid) owner to costkeep_rpc_executor;
  alter function public.sales_draft_expires_at(uuid,date) owner to costkeep_rpc_executor;
  alter function public.expire_sales_drafts(uuid) owner to costkeep_rpc_executor;
  alter function public.sales_editable_from(uuid,timestamptz) owner to costkeep_rpc_executor;
  alter function public.open_sales_draft(uuid,date,uuid) owner to costkeep_rpc_executor;
  alter function public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb) owner to costkeep_rpc_executor;
  alter function public.discard_sales_draft(uuid,uuid,integer) owner to costkeep_rpc_executor;
  alter function public.sales_draft_detail(uuid,uuid) owner to costkeep_rpc_executor;
end $m$;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.sales_json_sha256(jsonb),public.ensure_sales_calendar_day(uuid,date),
  public.sales_normalize_basis_manifest(jsonb),
  public.publish_sales_basis_version(uuid,date),public.resolve_sales_basis_version(uuid,date),
  public.assert_sales_basis_version(uuid,uuid,date,boolean),
  public.sales_draft_payload(uuid),public.sales_draft_inventory_deltas(uuid),public.sales_draft_expires_at(uuid,date),
  public.expire_sales_drafts(uuid) from public,anon,authenticated;
revoke all on function public.sales_json_sha256(jsonb),
  public.sales_normalize_basis_manifest(jsonb) from service_role;
revoke all on function public.sales_editable_from(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.open_sales_draft(uuid,date,uuid),
  public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb),
  public.discard_sales_draft(uuid,uuid,integer),public.sales_draft_detail(uuid,uuid)
  to authenticated;

commit;
