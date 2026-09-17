-- 0111 · 매출 피드 읽기, 기존 마감 장부 무부작용 백필
begin;

-- 기존 마감 장부를 새 읽기 모델에만 투영한다. 판매/재고 원장은 다시 쓰지 않는다.
do $m$
declare
  r record;
  v_basis uuid;
  v_draft uuid;
  v_version uuid;
  v_detail jsonb;
  v_summary jsonb;
  v_hash text;
  v_no integer;
begin
  for r in
    select b.*,coalesce(ds.revision,0) ledger_revision
      from public.business_days b
      left join public.daily_sales ds on ds.store_id=b.store_id and ds.sale_date=b.business_date
     where b.status='closed'
       and not exists(select 1 from public.sales_day_heads h
                      where h.store_id=b.store_id and h.business_date=b.business_date)
     order by b.store_id,b.business_date
  loop
    v_detail:=public.day_sales_detail(r.store_id,r.business_date);
    v_summary:=public.sales_day_accounting_summary(r.store_id,r.business_date,
      case when coalesce((public.sales_summary(r.store_id,r.business_date,r.business_date)->>'fixed_rate_provisional')::boolean,false)
        then null else nullif(r.snapshot->>'fixed_rate','')::numeric end);
    v_hash:=public.sales_json_sha256(public.sales_normalize_basis_manifest(coalesce(r.snapshot,'{}'::jsonb)));
    insert into public.sales_basis_versions(store_id,effective_from_business_date,revision,
      basis_quality,manifest,manifest_sha256)
    values (r.store_id,r.business_date,1,
      coalesce(r.basis_quality::text,'legacy_unrecorded')::public.sales_basis_quality,
      public.sales_normalize_basis_manifest(coalesce(r.snapshot,'{}'::jsonb)),v_hash)
    on conflict (store_id,effective_from_business_date,manifest_sha256) do update
      set manifest=excluded.manifest
    returning id into v_basis;

    v_draft:=gen_random_uuid();
    insert into public.sales_day_drafts(id,store_id,business_date,draft_kind,status,
      base_ledger_revision,basis_version_id,payload_hash,last_saved_at,expires_at,finalized_at)
    values (v_draft,r.store_id,r.business_date,'amendment','finalized',r.ledger_revision,
      v_basis,public.sales_json_sha256(v_detail),coalesce(r.closed_at,r.last_activity_at,r.created_at),
      coalesce(r.closed_at,r.last_activity_at,r.created_at)+interval '30 days',
      coalesce(r.closed_at,r.last_activity_at,r.created_at));
    select coalesce(max(version_no),0)+1 into v_no from public.sales_day_versions
     where store_id=r.store_id and business_date=r.business_date;
    insert into public.sales_day_versions(store_id,business_date,version_no,source_draft_id,
      basis_version_id,basis_quality,payload,summary,customer_total,net_sales,fixed_rate,
      finalized_at)
    values (r.store_id,r.business_date,v_no,v_draft,v_basis,
      coalesce(r.basis_quality::text,'legacy_unrecorded')::public.sales_basis_quality,
      v_detail,v_summary,
      coalesce((v_summary->>'customer_total')::numeric,(v_summary->>'revenue')::numeric,0),
      coalesce((v_summary->>'net_sales')::numeric,(v_summary->>'revenue')::numeric,0),
      case when coalesce((v_summary->>'fixed_rate_provisional')::boolean,false)
        then null else nullif(r.snapshot->>'fixed_rate','')::numeric end,
      coalesce(r.closed_at,r.last_activity_at,r.created_at)) returning id into v_version;
    insert into public.sales_day_heads(store_id,business_date,current_version_id,ledger_revision)
    values (r.store_id,r.business_date,v_version,greatest(r.ledger_revision,1));
    insert into public.sales_calendar_days(store_id,business_date,day_kind,source,timezone_id,
      scheduled_open_at,scheduled_close_at)
    select r.store_id,r.business_date,'expected','migrated_ledger',public.store_timezone(r.store_id),
      r.scheduled_open_at,r.planned_close_at from public.stores s where s.id=r.store_id
    on conflict (store_id,business_date) do nothing;
  end loop;
end $m$;

create or replace function public.ensure_sales_calendar_range(p_store uuid,p_from date,p_to date)
returns integer language plpgsql security definer set search_path=public,pg_temp as $fn$
declare d date; n integer:=0;
begin
  perform public.assert_my_store(p_store);
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then
    raise exception '조회 기간은 최대 1년까지 선택할 수 있어요' using errcode='22000',detail='INVALID_SALES_RANGE';
  end if;
  for d in select generate_series(p_from,p_to,interval '1 day')::date loop
    perform public.ensure_sales_calendar_day(p_store,d);
    n:=n+1;
  end loop;
  return n;
end $fn$;

create or replace function public.sales_lifecycle_clock(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_now timestamptz:=clock_timestamp(); v_date date; v_phase public.sales_cutover_phase;
begin
  perform public.assert_my_store(p_store);
  v_date:=public.sales_recommended_date(p_store,v_now);
  select phase into v_phase from public.sales_lifecycle_cutover_state where store_id=p_store;
  return jsonb_build_object('server_now',v_now,'recommended_sales_date',v_date,
    'editable_from',public.sales_editable_from(p_store,v_now),
    'editable_to',v_date,'phase',coalesce(v_phase,'active'::public.sales_cutover_phase));
end $fn$;

-- 판매 확정 판본은 고정하되, 판매와 독립된 E2 폐기는 귀속일 원장에서 현재 합계를 읽어
-- 완료 뒤 입력·취소된 손실만 동적으로 더하거나 뺀다.
create or replace function public.sales_effective_day_summary(p_store uuid,p_date date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare base jsonb; current_value jsonb; base_waste numeric:=0; current_waste numeric:=0; result jsonb;
  v_profit numeric; v_customer numeric;
begin
  select v.summary into base from public.sales_day_heads h
  join public.sales_day_versions v on v.id=h.current_version_id
  where h.store_id=p_store and h.business_date=p_date;
  if base is null and exists(select 1 from public.business_days b
    where b.store_id=p_store and b.business_date=p_date and b.status='closed') then
    base:=public.sales_summary(p_store,p_date,p_date);
  end if;
  current_value:=public.sales_summary(p_store,p_date,p_date);
  base_waste:=coalesce((base->>'waste_loss')::numeric,0);
  current_waste:=coalesce((current_value->>'waste_loss')::numeric,0);
  if base is null and current_waste=0 then return null; end if;
  result:=coalesce(base,jsonb_build_object('revenue',0,'customer_total',0,'net_sales',0,
    'qty',0,'material_cost',0,'extra_material_cost',0,'tax',0,'daily_extra',0,
    'fixed_cost',0,'fixed_rate',null,'fixed_rate_provisional',false,'uncomputed_day_count',0,
    'profit',-current_waste));
  result:=result||jsonb_build_object('waste_loss',current_waste,
    'waste_ingredient',coalesce((current_value->>'waste_ingredient')::numeric,0),
    'waste_menu',coalesce((current_value->>'waste_menu')::numeric,0));
  if base is not null and jsonb_typeof(base->'profit')<>'null' then
    v_profit:=(base->>'profit')::numeric-(current_waste-base_waste);
    v_customer:=coalesce((base->>'customer_total')::numeric,(base->>'revenue')::numeric,0);
    result:=result||jsonb_build_object('profit',v_profit,
      'profit_rate',case when v_customer=0 then null else v_profit/v_customer end);
  end if;
  return result;
end $fn$;

create or replace function public.sales_feed(
  p_store uuid,p_from date,p_to date,p_before date default null,p_limit integer default 31
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_items jsonb;
  v_counts jsonb;
  v_summary jsonb;
  v_next date;
  v_limit integer:=greatest(1,least(coalesce(p_limit,31),100));
begin
  perform public.assert_my_store(p_store);
  perform public.expire_sales_drafts(p_store);
  perform public.ensure_sales_calendar_range(p_store,p_from,p_to);
  -- 기간 요약은 최신 완료 head와 판매와 독립된 E2 손실만 합산한다.
  with completed as (
    select effective.summary
    from generate_series(p_from,p_to,interval '1 day') d(day)
    left join public.sales_day_heads h on h.store_id=p_store and h.business_date=d.day::date
    left join lateral (select public.sales_effective_day_summary(p_store,d.day::date) summary) effective on true
    where effective.summary is not null
  ), totals as (
    select count(*) days,
      coalesce(sum(coalesce((summary->>'customer_total')::numeric,(summary->>'revenue')::numeric,0)),0) revenue,
      coalesce(sum((summary->>'etc_revenue')::numeric),0) etc_revenue,
      coalesce(sum((summary->>'qty')::numeric),0) qty,
      coalesce(sum((summary->>'material_cost')::numeric),0) material_cost,
      coalesce(sum((summary->>'extra_material_cost')::numeric),0) extra_material_cost,
      coalesce(sum((summary->>'tax')::numeric),0) tax,
      coalesce(sum((summary->>'waste_loss')::numeric),0) waste_loss,
      coalesce(sum((summary->>'waste_ingredient')::numeric),0) waste_ingredient,
      coalesce(sum((summary->>'waste_menu')::numeric),0) waste_menu,
      coalesce(sum((summary->>'daily_extra')::numeric),0) daily_extra,
      case when count(*) filter(where coalesce((summary->>'uncomputed_day_count')::integer,0)>0
        or jsonb_typeof(summary->'fixed_cost')='null')>0 then null
        else coalesce(sum((summary->>'fixed_cost')::numeric),0) end fixed_cost,
      count(*) filter(where coalesce((summary->>'uncomputed_day_count')::integer,0)>0
        or jsonb_typeof(summary->'fixed_cost')='null') uncomputed_day_count,
      coalesce(bool_or(coalesce((summary->>'fixed_rate_provisional')::boolean,false)),false) fixed_provisional,
      case when count(*) filter(where jsonb_typeof(summary->'profit')='null')>0 then null
        else coalesce(sum((summary->>'profit')::numeric),0) end profit
    from completed
  )
  select jsonb_build_object('from',p_from,'to',p_to,'days',days,'revenue',revenue,
    'etc_revenue',etc_revenue,'qty',qty,'material_cost',material_cost,
    'extra_material_cost',extra_material_cost,'tax',tax,'waste_loss',waste_loss,
    'waste_ingredient',waste_ingredient,'waste_menu',waste_menu,'daily_extra',daily_extra,
    'fixed_cost',fixed_cost,'fixed_rate',case when revenue=0 or fixed_cost is null then null else fixed_cost/revenue end,
    'uncomputed_day_count',uncomputed_day_count,
    'fixed_rate_provisional',fixed_provisional,'profit',profit)
  into v_summary from totals;

  with days as (
    select c.business_date,c.day_kind,c.revision calendar_revision,b.status legacy_status,
      d.id draft_id,d.status draft_status,d.last_saved_at,
      h.current_version_id,effective.summary,
      coalesce((effective.summary->>'customer_total')::numeric,
        (effective.summary->>'revenue')::numeric,v.customer_total,0) customer_total,
      coalesce((effective.summary->>'net_sales')::numeric,
        (effective.summary->>'revenue')::numeric,v.net_sales,0) net_sales,
      coalesce(v.finalized_at,b.closed_at) finalized_at,
      row_number() over(order by c.business_date desc) rn
    from public.sales_calendar_days c
    left join lateral (
      select x.id,x.status,x.last_saved_at from public.sales_day_drafts x
       where x.store_id=c.store_id and x.business_date=c.business_date
         and x.status in ('editing','pending_inventory_resolution')
       order by x.last_saved_at desc limit 1) d on true
    left join public.sales_day_heads h on h.store_id=c.store_id and h.business_date=c.business_date
    left join public.sales_day_versions v on v.id=h.current_version_id
    left join public.business_days b on b.store_id=c.store_id and b.business_date=c.business_date
    left join lateral (select public.sales_effective_day_summary(c.store_id,c.business_date) summary) effective on true
    where c.store_id=p_store and c.business_date between p_from and p_to
      and (p_before is null or c.business_date<p_before)
  ), page as (select * from days where rn<=v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
    'business_date',business_date,
    'status',case when current_version_id is not null then 'completed'
                  when legacy_status='closed' then 'completed'
                  when draft_id is not null then 'editing'
                  when legacy_status in ('open','break') then 'editing'
                  when day_kind='closed' then 'closed' else 'missing' end,
    'draft_id',draft_id,'draft_status',draft_status,'last_saved_at',last_saved_at,
    'calendar_revision',calendar_revision,
    'version_id',current_version_id,'finalized_at',finalized_at,
    'sales',coalesce(customer_total,0),'net_sales',coalesce(net_sales,0),
    'qty',coalesce((summary->>'qty')::numeric,0),
    'expense',case when jsonb_typeof(summary->'fixed_cost')='null' then null else
      coalesce((summary->>'material_cost')::numeric,0)
      +coalesce((summary->>'extra_material_cost')::numeric,0)
      +coalesce((summary->>'daily_extra')::numeric,0)
      +coalesce((summary->>'fixed_cost')::numeric,0)
      +coalesce((summary->>'waste_loss')::numeric,0)
      +coalesce((summary->>'tax')::numeric,0) end,
    'profit',(summary->>'profit')::numeric,
    'profit_rate',case when coalesce(customer_total,0)=0 then null
      else round((summary->>'profit')::numeric*100/customer_total,1) end,
    'can_edit',business_date between public.sales_editable_from(p_store)
      and public.sales_recommended_date(p_store)
      and draft_status is distinct from 'pending_inventory_resolution'
      and (current_version_id is not null or legacy_status in ('closed','open','break')
        or business_date>(select greatest(inventory_cutoff_business_date,
          legacy_inventory_cutoff_business_date) from public.stores where id=p_store)),
    'can_classify',business_date between public.sales_editable_from(p_store)
      and public.sales_recommended_date(p_store)
      and draft_id is null and current_version_id is null and legacy_status is null
      and (day_kind='expected' or business_date>(select greatest(inventory_cutoff_business_date,
        legacy_inventory_cutoff_business_date) from public.stores where id=p_store)),
    'blocked_reason',case
      when draft_status='pending_inventory_resolution' then '재고 확인이 끝나면 작성 완료돼요.'
      when current_version_id is null and legacy_status is null and day_kind='expected'
        and business_date<=(select greatest(inventory_cutoff_business_date,
          legacy_inventory_cutoff_business_date) from public.stores where id=p_store)
        then '재고 실사에 포함된 날짜예요. 휴무 여부만 확정할 수 있어요.'
      when day_kind='closed' and business_date<=(select greatest(inventory_cutoff_business_date,
          legacy_inventory_cutoff_business_date) from public.stores where id=p_store)
        then '재고 실사에 포함된 휴무일은 영업일로 되돌릴 수 없어요.'
      when business_date not between public.sales_editable_from(p_store)
        and public.sales_recommended_date(p_store) then '수정 가능한 기간이 지났어요.'
      else null end,
    'action',case when draft_status='pending_inventory_resolution' then 'detail'
                  when draft_id is not null or legacy_status in ('open','break') then 'resume'
                  when current_version_id is not null or legacy_status='closed' then 'detail' else 'write' end)
    order by business_date desc),'[]'::jsonb),min(business_date)
    into v_items,v_next from page;

  select jsonb_build_object(
    'missing',count(*) filter(where d.id is null and h.current_version_id is null and b.id is null and c.day_kind='expected'),
    'editing',count(*) filter(where h.current_version_id is null and b.status is distinct from 'closed'
      and (d.id is not null or b.status in ('open','break'))),
    'completed',count(*) filter(where h.current_version_id is not null or b.status='closed'),
    'closed',count(*) filter(where d.id is null and h.current_version_id is null and b.id is null and c.day_kind='closed'))
  into v_counts
  from public.sales_calendar_days c
  left join lateral (select x.id from public.sales_day_drafts x
    where x.store_id=c.store_id and x.business_date=c.business_date
      and x.status in ('editing','pending_inventory_resolution') limit 1) d on true
  left join public.sales_day_heads h on h.store_id=c.store_id and h.business_date=c.business_date
  left join public.business_days b on b.store_id=c.store_id and b.business_date=c.business_date
  where c.store_id=p_store and c.business_date between p_from and p_to;

  return jsonb_build_object('from',p_from,'to',p_to,'summary',v_summary,
    'counts',v_counts,'items',v_items,
    'next_cursor',case when jsonb_array_length(v_items)<v_limit then null else v_next end,
    'clock',public.sales_lifecycle_clock(p_store));
end $fn$;

create or replace function public.sales_day_read(p_store uuid,p_date date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_head public.sales_day_heads; v_version public.sales_day_versions; v_draft public.sales_day_drafts;
begin
  perform public.assert_my_store(p_store);
  perform public.expire_sales_drafts(p_store);
  select * into v_head from public.sales_day_heads where store_id=p_store and business_date=p_date;
  if found then
    select * into v_version from public.sales_day_versions where id=v_head.current_version_id;
  end if;
  select * into v_draft from public.sales_day_drafts where store_id=p_store and business_date=p_date
    and status in ('editing','pending_inventory_resolution') order by last_saved_at desc limit 1;
  return jsonb_build_object('business_date',p_date,
    'status',case when v_version.id is not null then 'completed'
                  when v_draft.id is not null then 'editing'
                  when exists(select 1 from public.sales_calendar_days c
                    where c.store_id=p_store and c.business_date=p_date and c.day_kind='closed')
                    then 'closed' else 'missing' end,
    'draft',case when v_draft.id is null then null else public.sales_draft_detail(p_store,v_draft.id) end,
    'version',case when v_version.id is null then null else jsonb_build_object(
      'id',v_version.id,'version_no',v_version.version_no,'basis_quality',v_version.basis_quality,
      'finalized_at',v_version.finalized_at,'payload',v_version.payload,
      'summary',public.sales_effective_day_summary(p_store,p_date),
      'customer_total',v_version.customer_total,'net_sales',v_version.net_sales,
      'fixed_rate',v_version.fixed_rate,'ledger_revision',v_head.ledger_revision) end,
    'can_edit',p_date between public.sales_editable_from(p_store)
      and public.sales_recommended_date(p_store)
      and coalesce(v_draft.status::text,'')<>'pending_inventory_resolution'
      and not exists(select 1 from public.sales_calendar_days c
        where c.store_id=p_store and c.business_date=p_date and c.day_kind='closed')
      and (v_version.id is not null or v_draft.id is not null
        or exists(select 1 from public.business_days b
          where b.store_id=p_store and b.business_date=p_date)
        or p_date>(select greatest(inventory_cutoff_business_date,
          legacy_inventory_cutoff_business_date) from public.stores where id=p_store)));
end $fn$;

grant create on schema public to costkeep_rpc_executor;
do $m$
begin
  alter function public.ensure_sales_calendar_range(uuid,date,date) owner to costkeep_rpc_executor;
  alter function public.sales_lifecycle_clock(uuid) owner to costkeep_rpc_executor;
  alter function public.sales_effective_day_summary(uuid,date) owner to costkeep_rpc_executor;
  alter function public.sales_feed(uuid,date,date,date,integer) owner to costkeep_rpc_executor;
  alter function public.sales_day_read(uuid,date) owner to costkeep_rpc_executor;
end $m$;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.ensure_sales_calendar_range(uuid,date,date) from public,anon,authenticated;
revoke all on function public.sales_effective_day_summary(uuid,date) from public,anon,authenticated;
revoke all on function public.sales_lifecycle_clock(uuid),public.sales_feed(uuid,date,date,date,integer),
  public.sales_day_read(uuid,date) from public,anon;
grant execute on function public.sales_lifecycle_clock(uuid),public.sales_feed(uuid,date,date,date,integer),
  public.sales_day_read(uuid,date) to authenticated;

notify pgrst,'reload schema';
commit;
