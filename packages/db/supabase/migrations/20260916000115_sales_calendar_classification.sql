-- 0115 · 매출 날짜 분류 명령
-- 예정 영업일을 휴무로 확정할 제품 경로가 없으면 전환 실사와 신규 수명주기가
-- 미작성 날짜에서 영구 대기한다. 날짜 분류는 장부를 만들지 않고 원장만 보충한다.
begin;

alter table public.sales_calendar_days
  add column if not exists revision integer not null default 0 check (revision>=0);

create or replace function public.set_sales_calendar_day(
  p_store uuid,p_date date,p_kind text,p_base_revision integer,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_row public.sales_calendar_days;
  v_cutoff date;
  v_phase public.sales_cutover_phase;
begin
  perform public.assert_my_store(p_store);
  if p_kind not in ('closed','expected') then
    raise exception '날짜 상태는 영업일 또는 휴무만 선택할 수 있어요'
      using errcode='22000',detail='SALES_CALENDAR_KIND_INVALID';
  end if;
  perform public.lock_store_write_scope(p_store);
  perform public.expire_inventory_count_session(p_store);
  if exists(select 1 from public.inventory_count_sessions
      where store_id=p_store and status='active') then
    raise exception '재고 실사 중에는 영업일을 변경할 수 없어요'
      using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  select phase into v_phase from public.sales_lifecycle_cutover_state
   where store_id=p_store for update;
  if v_phase='blocked' then
    raise exception '매출 전환 확인이 필요한 동안에는 날짜를 변경할 수 없어요'
      using errcode='45044',detail='SALES_CUTOVER_WRITE_FROZEN';
  end if;
  if p_date<public.sales_editable_from(p_store) or p_date>public.sales_recommended_date(p_store) then
    raise exception '분류할 수 있는 날짜가 아니에요'
      using errcode='45010',detail='SALE_DATE_OUT_OF_RANGE';
  end if;

  perform public.ensure_sales_calendar_day(p_store,p_date);
  select * into v_row from public.sales_calendar_days
   where store_id=p_store and business_date=p_date for update;

  if v_row.revision<>p_base_revision then
    raise exception '다른 기기에서 날짜 상태가 변경됐어요'
      using errcode='45009',detail='SALES_CALENDAR_REVISION_CONFLICT';
  end if;

  if exists(select 1 from public.sales_day_heads
      where store_id=p_store and business_date=p_date)
     or exists(select 1 from public.sales_day_drafts
      where store_id=p_store and business_date=p_date
        and status in ('editing','pending_inventory_resolution'))
     or exists(select 1 from public.business_days
      where store_id=p_store and business_date=p_date) then
    raise exception '매출 내역이 있는 날짜의 영업 여부는 변경할 수 없어요'
      using errcode='45053',detail='SALES_CALENDAR_DAY_HAS_LEDGER';
  end if;

  select greatest(inventory_cutoff_business_date,legacy_inventory_cutoff_business_date)
    into v_cutoff from public.stores where id=p_store;
  if p_kind='expected' and p_date<=v_cutoff then
    raise exception '재고 실사에 포함된 휴무일은 영업일로 되돌릴 수 없어요'
      using errcode='45052',detail='SALES_CALENDAR_BEFORE_INVENTORY_CUTOFF';
  end if;

  if v_row.day_kind::text=p_kind
     and ((p_kind='closed' and v_row.source='manual_closed')
       or (p_kind='expected' and v_row.source='manual_extra')) then
    return jsonb_build_object('business_date',v_row.business_date,'day_kind',v_row.day_kind,
      'source',v_row.source,'revision',v_row.revision,
      'reason',nullif(trim(coalesce(p_reason,'')),''));
  end if;

  update public.sales_calendar_days
     set day_kind=p_kind::public.sales_calendar_day_kind,
         source=case when p_kind='closed' then 'manual_closed'::public.sales_calendar_source
                     else 'manual_extra'::public.sales_calendar_source end,
         scheduled_open_at=case when p_kind='closed' then null else public.scheduled_open_at(p_store,p_date) end,
         scheduled_close_at=case when p_kind='closed' then null else public.planned_close(p_store,p_date) end,
         timezone_id=public.store_timezone(p_store),revision=revision+1
   where store_id=p_store and business_date=p_date
   returning * into v_row;

  return jsonb_build_object('business_date',v_row.business_date,'day_kind',v_row.day_kind,
    'source',v_row.source,'revision',v_row.revision,
    'reason',nullif(trim(coalesce(p_reason,'')),''));
end $fn$;

grant create on schema public to costkeep_rpc_executor;
alter function public.set_sales_calendar_day(uuid,date,text,integer,text) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.set_sales_calendar_day(uuid,date,text,integer,text) from public,anon;
grant execute on function public.set_sales_calendar_day(uuid,date,text,integer,text) to authenticated;

commit;
