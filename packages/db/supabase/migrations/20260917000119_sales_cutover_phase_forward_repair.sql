-- 0119 · 적용된 구형 전환 함수의 사전 점검을 현재 계약으로 전진 복구
-- 모호한 레거시 실사 이력이 없는 매장은 불필요한 재고 실사를 요구하지 않는다.
begin;

create or replace function public.set_sales_lifecycle_phase(
  p_store uuid,p_expected_revision integer,p_target public.sales_cutover_phase,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v public.sales_lifecycle_cutover_state; v_reference date;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  select * into v from public.sales_lifecycle_cutover_state where store_id=p_store for update;
  v_reference:=coalesce(v.inventory_reference_sales_date,public.sales_recommended_date(p_store));
  if v.revision<>p_expected_revision then
    raise exception '전환 상태가 변경됐어요' using errcode='45009',detail='CUTOVER_REVISION_CONFLICT';
  end if;
  if not (
    (v.phase='legacy_active' and p_target='draining') or
    (v.phase='draining' and p_target in ('legacy_active','freezing','blocked')) or
    (v.phase='freezing' and p_target in ('active','blocked')) or
    (v.phase='blocked' and p_target='freezing') or
    (v.phase='blocked' and v.freeze_receipt_id is null and p_target='draining') or
    (v.phase=p_target)
  ) then
    raise exception '허용되지 않은 매출 전환 단계예요'
      using errcode='45045',detail='CUTOVER_TRANSITION_NOT_ALLOWED';
  end if;
  -- draining은 재고 쓰기를 막는다. 추천일을 완료/휴무로 해소했거나, 기존 영업일을
  -- 정상 마감할 수 있을 때만 진입시켜 되돌릴 수 없는 교착을 예방한다.
  if v.phase='legacy_active' and p_target='draining' and not (
    exists(select 1 from public.business_days where store_id=p_store
      and business_date=v_reference and status in ('open','break','closed'))
    or exists(select 1 from public.sales_day_heads where store_id=p_store
      and business_date=v_reference)
    or exists(select 1 from public.sales_calendar_days where store_id=p_store
      and business_date=v_reference and day_kind='closed')) then
    raise exception '추천 날짜의 매출 작성 또는 휴무 확정을 먼저 마쳐 주세요'
      using errcode='45047',detail='CUTOVER_REFERENCE_DATE_NOT_READY';
  end if;
  if p_target='freezing' and (exists(
    select 1 from public.business_days where store_id=p_store and status<>'closed')
    or exists(select 1 from public.sales_day_drafts where store_id=p_store
      and status in ('editing','pending_inventory_resolution'))
    or exists(select 1 from public.inventory_count_sessions where store_id=p_store and status='active')) then
    raise exception '열린 기존 영업일을 먼저 마감해 주세요'
      using errcode='45046',detail='LEGACY_DAY_STILL_OPEN';
  end if;
  if p_target='freezing' and not (v.phase='blocked' and v.inventory_reference_sales_date is not null) and not (
    exists(select 1 from public.business_days where store_id=p_store
      and business_date=v_reference and status='closed')
    or exists(select 1 from public.sales_calendar_days where store_id=p_store
      and business_date=v_reference and day_kind='closed')) then
    raise exception '추천 날짜의 매출 작성 또는 휴무 확정을 먼저 마쳐 주세요'
      using errcode='45047',detail='CUTOVER_REFERENCE_DATE_NOT_RESOLVED';
  end if;
  if p_target='active' and (v.freeze_receipt_id is null or exists(
      select 1 from public.business_days where store_id=p_store and status<>'closed')
      or exists(select 1 from public.inventory_count_sessions where store_id=p_store and status='active')
      or exists(select 1 from public.pending_sales_inventory_resolution where store_id=p_store and status='pending')
      or exists(select 1 from public.inventory_recount_targets where store_id=p_store and status='pending')
      or ((select inventory_recount_required
              or legacy_inventory_cutoff_business_date>date '1900-01-01'
            from public.stores where id=p_store)
        and not exists(select 1 from public.inventory_count_batches b
          join public.sales_lifecycle_cutover_receipts r on r.id=v.freeze_receipt_id
          where b.store_id=p_store and b.counted_at>=r.created_at))) then
    raise exception '전환 전 열린 영업일과 재고 실사를 확인해 주세요'
      using errcode='45047',detail='CUTOVER_PREFLIGHT_FAILED';
  end if;
  if v.phase='draining' and p_target='legacy_active' and exists(
    select 1 from (
      select x.* from public.sales_lifecycle_cutover_receipts x
       where x.store_id=p_store and x.receipt_kind='draining_baseline'
       order by x.created_at desc,x.id desc limit 1
    ) r
    where (v.freeze_receipt_id is not null
        or r.ledger_state_hash<>encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_array(h.business_date,h.ledger_revision,h.current_version_id) order by h.business_date) from public.sales_day_heads h where h.store_id=p_store),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
        or exists(select 1 from public.inventory_count_batches b
          where b.store_id=p_store and b.counted_at>=r.created_at)
        or exists(select 1 from public.inventory_count_sessions i
          where i.store_id=p_store and i.status='active')
        or (select inventory_cutoff_business_date from public.stores where id=p_store)
             is distinct from nullif(r.payload->>'inventory_cutoff_business_date','')::date
        or (select inventory_recount_required from public.stores where id=p_store)
             is distinct from coalesce((r.payload->>'inventory_recount_required')::boolean,false))
  ) then
    raise exception '전환 중 데이터가 변경되어 이전 방식으로 돌아갈 수 없어요'
      using errcode='45048',detail='CUTOVER_FORWARD_RECOVERY_REQUIRED';
  end if;

  if v.phase='legacy_active' and p_target='draining' then
    insert into public.sales_lifecycle_cutover_receipts(store_id,receipt_kind,phase_revision,
      inventory_reference_sales_date,inventory_write_revision,inventory_event_sequence,
      ledger_state_hash,source_state_hash,payload,payload_hash,created_by)
    select p_store,'draining_baseline',v.revision+1,public.sales_recommended_date(p_store),s.revision,
      coalesce((select max(seq) from public.inventory_events where store_id=p_store),0),
      encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_array(h.business_date,h.ledger_revision,h.current_version_id) order by h.business_date) from public.sales_day_heads h where h.store_id=p_store),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex'),
      encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_array(source_kind,source_id,processed_revision) order by source_kind,source_id) from public.sales_basis_publisher_state where store_id=p_store),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex'),
      jsonb_build_object('phase','draining','server_now',clock_timestamp(),
        'inventory_cutoff_business_date',(select inventory_cutoff_business_date from public.stores where id=p_store),
        'inventory_recount_required',(select inventory_recount_required from public.stores where id=p_store)),
      public.sales_json_sha256(jsonb_build_object('phase','draining','revision',v.revision+1,'inventory_revision',s.revision)),auth.uid()
    from public.inventory_store_write_state s where s.store_id=p_store;
  end if;

  -- 0116에서 추가한 구형 부분 실사 격리를 전진 복구 뒤에도 유지한다.
  if p_target='freezing' and v.freeze_receipt_id is null and exists (
    select 1 from public.inventory_events e
    left join public.inventory_count_lines l on l.event_id=e.id
    where e.store_id=p_store and e.type='stocktake' and l.event_id is null
  ) then
    update public.stores set
      legacy_inventory_cutoff_business_date=greatest(legacy_inventory_cutoff_business_date,v_reference),
      inventory_recount_required=true
    where id=p_store;
  end if;

  if p_target='freezing' and v.freeze_receipt_id is null then
    if not exists(select 1 from public.sales_basis_versions b
      where b.store_id=p_store and b.effective_from_business_date<=public.sales_editable_from(p_store)) then
      perform public.publish_sales_basis_version(p_store,public.sales_editable_from(p_store));
    end if;
    insert into public.sales_lifecycle_cutover_receipts(store_id,receipt_kind,phase_revision,
      inventory_reference_sales_date,inventory_write_revision,inventory_event_sequence,
      ledger_state_hash,source_state_hash,previous_receipt_id,payload,payload_hash,created_by)
    select p_store,'freeze',v.revision+1,v_reference,s.revision,
      coalesce((select max(seq) from public.inventory_events where store_id=p_store),0),
      encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_array(h.business_date,h.ledger_revision,h.current_version_id) order by h.business_date) from public.sales_day_heads h where h.store_id=p_store),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex'),
      encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_array(source_kind,source_id,processed_revision) order by source_kind,source_id) from public.sales_basis_publisher_state where store_id=p_store),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex'),
      (select id from public.sales_lifecycle_cutover_receipts where store_id=p_store order by created_at desc limit 1),
      jsonb_build_object('phase','freezing','server_now',clock_timestamp(),'reference_date',v_reference),
      public.sales_json_sha256(jsonb_build_object('phase','freezing','revision',v.revision+1,'inventory_revision',s.revision,'reference_date',v_reference)),auth.uid()
    from public.inventory_store_write_state s where s.store_id=p_store
    returning id into v.freeze_receipt_id;
  end if;

  if p_target='active' then
    insert into public.sales_lifecycle_cutover_receipts(store_id,receipt_kind,phase_revision,
      inventory_reference_sales_date,inventory_write_revision,inventory_event_sequence,
      ledger_state_hash,source_state_hash,previous_receipt_id,payload,payload_hash,created_by)
    select p_store,'activate',v.revision+1,v.inventory_reference_sales_date,s.revision,
      coalesce((select max(seq) from public.inventory_events where store_id=p_store),0),
      encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_array(h.business_date,h.ledger_revision,h.current_version_id) order by h.business_date) from public.sales_day_heads h where h.store_id=p_store),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex'),
      encode(extensions.digest(convert_to(coalesce((select jsonb_agg(jsonb_build_array(source_kind,source_id,processed_revision) order by source_kind,source_id) from public.sales_basis_publisher_state where store_id=p_store),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex'),
      v.freeze_receipt_id,jsonb_build_object('phase','active','server_now',clock_timestamp()),
      public.sales_json_sha256(jsonb_build_object('phase','active','revision',v.revision+1,
        'inventory_revision',s.revision,'reference_date',v.inventory_reference_sales_date)),auth.uid()
    from public.inventory_store_write_state s where s.store_id=p_store;
  end if;

  update public.sales_lifecycle_cutover_state
     set phase=p_target,revision=revision+1,
         planned_freeze_at=case when p_target='draining' then clock_timestamp()+interval '1 hour' else planned_freeze_at end,
         blocked_reason=case when p_target='blocked' then coalesce(nullif(p_reason,''),'확인 필요') else null end,
         inventory_reference_sales_date=case when p_target='freezing' then v_reference else inventory_reference_sales_date end,
         freeze_receipt_id=case when p_target='freezing' then v.freeze_receipt_id else freeze_receipt_id end,
         updated_at=clock_timestamp()
   where store_id=p_store returning * into v;
  return jsonb_build_object('store_id',v.store_id,'phase',v.phase,'revision',v.revision,
    'planned_freeze_at',v.planned_freeze_at,'blocked_reason',v.blocked_reason);
end $fn$;

alter function public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text) owner to costkeep_rpc_executor;
revoke all on function public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text) from public,anon;
grant execute on function public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text) to authenticated;

commit;
