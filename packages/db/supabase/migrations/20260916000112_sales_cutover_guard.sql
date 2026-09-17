-- 0112 · 단계적 전환과 옛 영업 시작/종료 쓰기 차단
begin;

create or replace function public.sales_lifecycle_assert_legacy_write_allowed(p_store uuid,p_operation text)
returns void language plpgsql volatile security definer set search_path=public,pg_temp as $fn$
declare v_phase public.sales_cutover_phase;
begin
  if current_setting('costkeep.sales_finalize',true)='on' then return; end if;
  perform public.lock_store_write_scope(p_store);
  select phase into v_phase from public.sales_lifecycle_cutover_state where store_id=p_store;
  if coalesce(v_phase,'active'::public.sales_cutover_phase) in ('freezing','active','blocked')
     or (v_phase='draining' and p_operation='open_business_day') then
    raise exception '새 매출 작성 화면에서 계속해 주세요'
      using errcode='45044',detail='APP_UPDATE_REQUIRED';
  end if;
end $fn$;

create or replace function public.sales_lifecycle_guard_basis_write()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare row_value jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_store uuid; v_phase public.sales_cutover_phase;
begin
  v_store:=nullif(row_value->>'store_id','')::uuid;
  if v_store is null and tg_table_name='store_tax_components' then
    select store_id into v_store from public.store_tax_profiles
     where id=nullif(row_value->>'tax_profile_id','')::uuid;
  end if;
  if v_store is null then return case when tg_op='DELETE' then old else new end; end if;
  perform public.lock_store_write_scope(v_store);
  select phase into v_phase from public.sales_lifecycle_cutover_state where store_id=v_store;
  if v_phase in ('freezing','blocked') then
    raise exception '매출 전환 확인 중에는 계산 설정을 변경할 수 없어요'
      using errcode='45044',detail='SALES_CUTOVER_WRITE_FROZEN';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $fn$;

create or replace function public.sales_lifecycle_publish_basis_after_write()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare row_value jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_value jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_value jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_store uuid; v_date date; v_source text; v_hash text;
begin
  if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new; end if;
  -- 발주 자체는 계산 기준이 아니다. 실제 입고 상태·평가 금액·실입고량이 바뀔 때만
  -- order_records가 기준단가 source가 된다.
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
  v_date:=public.next_unopened_business_date(v_store);
  if nullif(row_value->>'effective_from','') is not null then
    v_date:=greatest(v_date,(row_value->>'effective_from')::date);
  end if;
  v_source:=coalesce(row_value->>'id',row_value->>'recipe_id',row_value->>'ingredient_id',v_store::text);
  v_hash:=public.sales_json_sha256(jsonb_build_object('operation',tg_op,'row',row_value));
  insert into public.sales_basis_publisher_state(store_id,source_kind,source_id,processed_revision)
  values (v_store,tg_table_name,v_source,v_hash)
  on conflict (store_id,source_kind,source_id) do update
    set processed_revision=excluded.processed_revision,processed_at=clock_timestamp();
  begin
    perform public.publish_sales_basis_version(v_store,v_date);
  exception when sqlstate '45013' then
    -- 세금 설정 RPC는 profile과 구성 항목을 같은 트랜잭션에서 순서대로 저장한다.
    -- 중간 행에서는 발행하지 않고 마지막 완결 행의 trigger가 전체 판본을 발행한다.
    null;
  end;
  return case when tg_op='DELETE' then old else new end;
end $fn$;

do $triggers$
declare t text;
begin
  foreach t in array array['settings','recipes','recipe_lines','recipe_extra_costs','ingredients',
    'purchase_options','order_records','store_market_profiles','store_tax_profiles','store_tax_components',
    'tax_category_catalog','menu_tax_overrides','fixed_costs_monthly','fixed_cost_item_configurations',
    'store_time_settings','operating_rules'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('drop trigger if exists %I on public.%I','sales_lifecycle_05_guard',t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.sales_lifecycle_guard_basis_write()',
      'sales_lifecycle_05_guard',t);
    execute format('drop trigger if exists %I on public.%I','sales_lifecycle_95_publish',t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.sales_lifecycle_publish_basis_after_write()',
      'sales_lifecycle_95_publish',t);
  end loop;
end $triggers$;

-- 신규 가입은 설정·시간대·운영 규칙 부트스트랩이 모두 끝난 같은 트랜잭션에서
-- 새 작성 수명주기를 활성화하고 최초 기준 판본을 발행한다. 직접 시드한 기존 매장은
-- legacy_active에 남아 명시적 전환 절차를 거친다.
do $patch_create_store$
declare v_def text; v_new text; v_anchor text;
begin
  v_def:=replace(pg_get_functiondef('public.create_store(text,text)'::regprocedure),chr(13),'');
  if position('sales_lifecycle_cutover_state' in v_def)=0 then
    v_anchor:='  return jsonb_build_object(''store_id'', v_id, ''created'', true,'||chr(10)||
      '                            ''timezone'', store_timezone(v_id), ''local_date'', store_local_date(v_id));';
    v_new:=replace(v_def,v_anchor,
      '  update public.sales_lifecycle_cutover_state set phase=''active'',revision=revision+1,'||chr(10)||
      '    updated_at=clock_timestamp() where store_id=v_id;'||chr(10)||
      '  perform public.publish_sales_basis_version(v_id,public.sales_editable_from(v_id));'||chr(10)||
      v_anchor);
    if v_new=v_def then raise exception '0112: create_store 활성화 위치를 찾지 못했습니다'; end if;
    execute v_new;
  end if;
end $patch_create_store$;

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

-- 옛 공개 RPC의 assert_my_store 직후에 전환 가드를 한 번만 삽입한다.
do $m$
declare r record; v_def text; v_anchor text; v_insert text;
begin
  for r in
    select p.oid,p.proname
      from pg_proc p
     where p.pronamespace='public'::regnamespace
       and p.proname in ('open_business_day','save_sale','close_business_day','amend_ended_business_day')
  loop
    v_def:=pg_get_functiondef(r.oid);
    if position('sales_lifecycle_assert_legacy_write_allowed' in v_def)>0 then continue; end if;
    v_anchor:='perform assert_my_store(p_store);';
    if position(v_anchor in v_def)=0 then
      raise exception '0112: % 전환 가드 삽입 위치를 찾을 수 없습니다',r.proname;
    end if;
    v_insert:=v_anchor||chr(10)||format('  perform public.sales_lifecycle_assert_legacy_write_allowed(p_store,%L);',r.proname);
    execute replace(v_def,v_anchor,v_insert);
  end loop;
end $m$;

grant create on schema public to costkeep_rpc_executor;
alter function public.sales_lifecycle_assert_legacy_write_allowed(uuid,text) owner to costkeep_rpc_executor;
alter function public.sales_lifecycle_guard_basis_write() owner to costkeep_rpc_executor;
alter function public.sales_lifecycle_publish_basis_after_write() owner to costkeep_rpc_executor;
alter function public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text) owner to costkeep_rpc_executor;
grant execute on function public.next_unopened_business_date(uuid) to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.sales_lifecycle_assert_legacy_write_allowed(uuid,text) from public,anon,authenticated;
revoke all on function public.sales_lifecycle_guard_basis_write(),
  public.sales_lifecycle_publish_basis_after_write() from public,anon,authenticated;
revoke all on function public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text) from public,anon;
grant execute on function public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text) to authenticated;

select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
