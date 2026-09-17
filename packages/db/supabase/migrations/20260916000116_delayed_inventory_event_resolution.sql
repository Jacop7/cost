-- 0116 · 실사 전 발생·실사 후 기록된 비판매 재고 사건
-- 정확한 발생 시각으로 최초 후속 실사와 비교해 재고 이중 반영을 막는다.
begin;

alter table public.inventory_events
  add column if not exists inventory_resolution_kind text not null default 'normal',
  add column if not exists classified_by_count_batch_id uuid
    references public.inventory_count_batches(id) on delete restrict;
alter table public.inventory_events
  add constraint inventory_events_resolution_kind_ck
  check (inventory_resolution_kind in ('normal','absorbed_before_count','ambiguous_during_count','economic_correction')) not valid;

create table public.inventory_event_economic_corrections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  source_event_id uuid not null references public.inventory_events(id) on delete restrict,
  revision integer not null check (revision>0),
  request_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  target_reported_count_delta numeric not null,
  target_volume_delta numeric,
  correction_event_id uuid not null unique references public.inventory_events(id) on delete restrict,
  reason text not null,
  created_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  unique (source_event_id,revision),
  unique (store_id,request_key)
);

create table public.inventory_delayed_command_receipts (
  store_id uuid not null references public.stores(id) on delete restrict,
  command_kind text not null check (command_kind in ('discard','stock_adjustment')),
  request_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  created_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  primary key (store_id,command_kind,request_key)
);

create or replace function public.block_inventory_write_during_count()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_batch public.inventory_count_batches;
  v_forced_at text:=nullif(current_setting('costkeep.inventory_event_occurred_at',true),'');
  v_recount boolean:=false;
begin
  perform public.lock_store_write_scope(new.store_id);
  perform public.expire_inventory_count_session(new.store_id);
  if current_setting('costkeep.inventory_count_commit',true) is distinct from 'on'
     and exists(select 1 from public.sales_lifecycle_cutover_state
       where store_id=new.store_id and phase in ('freezing','blocked')) then
    raise exception '매출 전환 확인 중에는 재고를 변경할 수 없어요'
      using errcode='45044',detail='SALES_CUTOVER_WRITE_FROZEN';
  end if;
  if current_setting('costkeep.inventory_count_commit',true) is distinct from 'on'
     and exists (select 1 from public.inventory_count_sessions
                 where store_id=new.store_id and status='active') then
    raise exception '재고 실사 중에는 재고를 변경할 수 없어요'
      using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  if new.reverses_event_id is not null and exists (
    select 1 from public.inventory_events original
     where original.id=new.reverses_event_id
       and (original.stock_effect<>'normal'
         or exists(select 1 from public.inventory_count_lines own_count where own_count.event_id=original.id)
         or exists(select 1 from public.inventory_count_lines counted
           join public.inventory_count_batches batch on batch.id=counted.batch_id
            where counted.ingredient_id=original.ingredient_id
              and original.seq<=batch.event_sequence_high_watermark))) then
    raise exception '재고 실사에 포함된 내역은 취소할 수 없어요. 현재 재고를 새로 조정해 주세요'
      using errcode='45035',detail='EVENT_ABSORBED_BY_COUNT';
  end if;

  if v_forced_at is not null then
    new.occurred_at:=v_forced_at::timestamptz;
  end if;
  new.reported_count_delta:=coalesce(new.reported_count_delta,new.count_delta,0);

  -- 날짜만 저장하는 구형 RPC는 같은 영업일의 실사 전/후를 구분할 증거가 없다.
  -- 해당 식재료가 이미 한 번이라도 실사됐다면 묵시적으로 현재 사건이나 과거 사건으로
  -- 추정하지 않고, 서버 현재시각 wrapper 또는 exact 발생시각 RPC만 허용한다.
  if v_forced_at is null
     and new.sales_item_id is null and new.reverses_event_id is null
     and current_setting('costkeep.inventory_count_commit',true) is distinct from 'on'
     and current_setting('costkeep.inventory_economic_correction',true) is distinct from 'on'
     and exists(select 1 from public.inventory_count_lines line
       where line.ingredient_id=new.ingredient_id) then
    raise exception '재고 실사 이후 내역은 실제 발생 시각을 확인해 주세요'
      using errcode='45055',detail='EXACT_OCCURRENCE_TIME_REQUIRED';
  end if;

  -- 판매 component와 실사 자체는 각 전용 원장이 판정한다.
  if v_forced_at is not null
     and new.sales_item_id is null and new.reverses_event_id is null
     and current_setting('costkeep.inventory_count_commit',true) is distinct from 'on'
     and current_setting('costkeep.inventory_economic_correction',true) is distinct from 'on' then
    select b.* into v_batch
    from public.inventory_count_batches b
    join public.inventory_count_lines l on l.batch_id=b.id and l.ingredient_id=new.ingredient_id
    where b.store_id=new.store_id and new.occurred_at<=b.counted_at
    order by b.counted_at,b.id limit 1;
    if found then
      new.count_delta:=0;
      new.stock_effect:='absorbed';
      new.classified_by_count_batch_id:=v_batch.id;
      if new.occurred_at<v_batch.observation_started_at then
        new.inventory_resolution_kind:='absorbed_before_count';
        new.absorbed_by_count_batch_id:=v_batch.id;
      else
        new.inventory_resolution_kind:='ambiguous_during_count';
        new.absorbed_by_count_batch_id:=null;
      end if;
    end if;
  end if;

  select inventory_recount_required into v_recount from public.stores where id=new.store_id;
  if coalesce(v_recount,false)
     and current_setting('costkeep.inventory_count_commit',true) is distinct from 'on'
     and current_setting('costkeep.inventory_economic_correction',true) is distinct from 'on'
     and new.sales_item_id is null
     and new.inventory_resolution_kind='normal' then
    raise exception '재고 확인이 필요한 식재료가 있어 실사를 먼저 마쳐 주세요'
      using errcode='45054',detail='INVENTORY_RECOUNT_REQUIRED';
  end if;

  insert into public.inventory_store_write_state(store_id,revision,updated_at)
  values (new.store_id,1,clock_timestamp())
  on conflict (store_id) do update
    set revision=public.inventory_store_write_state.revision+1,
        updated_at=clock_timestamp();
  return new;
end $fn$;

create or replace function public.apply_delayed_inventory_event_resolution()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_correction numeric;
begin
  if new.sales_item_id is not null
     or new.inventory_resolution_kind not in ('absorbed_before_count','ambiguous_during_count') then
    return new;
  end if;
  -- 구형 E1/E2/E5 본체가 사건 INSERT 전에 현재고를 이미 변경한다. 사건에서 0으로
  -- 분류한 차이만 같은 트랜잭션에서 되돌려 실측 수량을 보존한다.
  if current_setting('costkeep.inventory_stock_already_applied',true)='on' then
    v_correction:=coalesce(new.reported_count_delta,0)-coalesce(new.count_delta,0);
    update public.inventory_states
       set stock_total=stock_total-v_correction,updated_at=clock_timestamp()
     where ingredient_id=new.ingredient_id and store_id=new.store_id;
  end if;
  if new.inventory_resolution_kind='ambiguous_during_count' then
    insert into public.inventory_recount_targets(store_id,ingredient_id,source_event_id,reason)
    values (new.store_id,new.ingredient_id,new.id,'ambiguous_during_count')
    on conflict (source_event_id) do nothing;
    update public.stores set inventory_recount_required=true where id=new.store_id;
  end if;
  return new;
end $fn$;

drop trigger if exists inventory_events_delayed_resolution on public.inventory_events;
create trigger inventory_events_delayed_resolution
after insert on public.inventory_events
for each row execute function public.apply_delayed_inventory_event_resolution();

create or replace function public.record_delayed_inbound(
  p_order uuid,p_actual_qty numeric,p_request_key text,p_occurred_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_store uuid; v_result jsonb;
begin
  select store_id into v_store from public.order_records where id=p_order;
  if v_store is null then raise exception '발주를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  if p_occurred_at is null or p_occurred_at>clock_timestamp() then
    raise exception '실제 발생 시각을 확인해 주세요' using errcode='22000',detail='OCCURRED_AT_REQUIRED';
  end if;
  perform set_config('costkeep.inventory_event_occurred_at',p_occurred_at::text,true);
  perform set_config('costkeep.inventory_stock_already_applied','on',true);
  v_result:=public.e1_confirm_inbound(p_order,p_actual_qty,p_request_key,
    public.store_local_date(v_store,p_occurred_at));
  perform set_config('costkeep.inventory_stock_already_applied','off',true);
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  return v_result;
end $fn$;

create or replace function public.record_current_inbound(
  p_order uuid,p_actual_qty numeric default null,p_request_key text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_store uuid; v_now timestamptz:=clock_timestamp(); v_result jsonb;
begin
  select store_id into v_store from public.order_records where id=p_order;
  if v_store is null then raise exception '발주를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  perform set_config('costkeep.inventory_event_occurred_at',v_now::text,true);
  perform set_config('costkeep.inventory_stock_already_applied','on',true);
  v_result:=public.e1_confirm_inbound(p_order,p_actual_qty,p_request_key,
    public.store_local_date(v_store,v_now));
  perform set_config('costkeep.inventory_stock_already_applied','off',true);
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  return v_result;
end $fn$;

create or replace function public.record_current_quick_inbound(
  p_store uuid,p_ingredient uuid,p_volume numeric,p_amount numeric,
  p_qty numeric default 1,p_vendor uuid default null,p_request_key text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_now timestamptz:=clock_timestamp(); v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  perform set_config('costkeep.inventory_event_occurred_at',v_now::text,true);
  perform set_config('costkeep.inventory_stock_already_applied','on',true);
  v_result:=public.quick_inbound(p_store,p_ingredient,p_volume,p_amount,p_qty,p_vendor,
    public.store_local_date(p_store,v_now),p_request_key);
  perform set_config('costkeep.inventory_stock_already_applied','off',true);
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  return v_result;
end $fn$;

create or replace function public.record_current_discard(
  p_ingredient uuid,p_remain_volume numeric
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_store uuid; v_now timestamptz:=clock_timestamp(); v_result jsonb;
begin
  select store_id into v_store from public.ingredients where id=p_ingredient;
  if v_store is null then raise exception '식재료를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  perform set_config('costkeep.inventory_event_occurred_at',v_now::text,true);
  perform set_config('costkeep.inventory_stock_already_applied','on',true);
  v_result:=public.e2_discard(p_ingredient,p_remain_volume,public.store_local_date(v_store,v_now));
  perform set_config('costkeep.inventory_stock_already_applied','off',true);
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  return v_result;
end $fn$;

create or replace function public.record_current_stock_adjustment(
  p_ingredient uuid,p_target_quantity numeric,p_soon_out boolean,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_store uuid; v_now timestamptz:=clock_timestamp(); v_result jsonb;
begin
  select store_id into v_store from public.ingredients where id=p_ingredient;
  if v_store is null then raise exception '식재료를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  perform set_config('costkeep.inventory_event_occurred_at',v_now::text,true);
  perform set_config('costkeep.inventory_stock_already_applied','on',true);
  v_result:=public.e5_stock_adjusted(p_ingredient,p_target_quantity,p_soon_out,p_note,
    public.store_local_date(v_store,v_now));
  perform set_config('costkeep.inventory_stock_already_applied','off',true);
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  return v_result;
end $fn$;

create or replace function public.record_current_stock_quantity(
  p_ingredient uuid,p_kind text,p_quantity numeric,p_expected_stock numeric,
  p_note text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_store uuid; v_now timestamptz:=clock_timestamp(); v_result jsonb;
begin
  select store_id into v_store from public.ingredients where id=p_ingredient;
  if v_store is null then raise exception '식재료를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  perform set_config('costkeep.inventory_event_occurred_at',v_now::text,true);
  perform set_config('costkeep.inventory_stock_already_applied','on',true);
  v_result:=public.change_stock_quantity(p_ingredient,p_kind,p_quantity,p_expected_stock,p_note,p_idempotency_key);
  perform set_config('costkeep.inventory_stock_already_applied','off',true);
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  return v_result;
end $fn$;

create or replace function public.record_delayed_discard(
  p_ingredient uuid,p_discard_quantity numeric,p_occurred_at timestamptz,p_note text,
  p_request_key uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_store uuid; v_result jsonb; v_payload_hash text;
  v_receipt public.inventory_delayed_command_receipts; v_event public.inventory_events;
  v_before numeric; v_unit numeric; rec record;
begin
  select store_id into v_store from public.ingredients where id=p_ingredient;
  if v_store is null then raise exception '식재료를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  if p_occurred_at is null or p_occurred_at>clock_timestamp() then
    raise exception '실제 발생 시각을 확인해 주세요' using errcode='22000',detail='OCCURRED_AT_REQUIRED';
  end if;
  if coalesce(p_discard_quantity,0)<=0 then
    raise exception '폐기량은 0보다 커야 해요' using errcode='22000';
  end if;
  if p_request_key is null then raise exception '요청 키를 확인해 주세요' using errcode='22000'; end if;
  perform public.lock_store_write_scope(v_store);
  v_payload_hash:=public.sales_json_sha256(jsonb_build_object('ingredient_id',p_ingredient,
    'discard_quantity',p_discard_quantity,'occurred_at',p_occurred_at,'note',coalesce(p_note,'')));
  select * into v_receipt from public.inventory_delayed_command_receipts
   where store_id=v_store and command_kind='discard' and request_key=p_request_key;
  if found then
    if v_receipt.payload_hash<>v_payload_hash then
      raise exception '같은 요청 키의 지연 폐기 내용이 달라요'
        using errcode='45021',detail='IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return v_receipt.result||jsonb_build_object('duplicate',true);
  end if;
  perform set_config('costkeep.inventory_event_occurred_at',p_occurred_at::text,true);
  insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
    volume_delta,note,occurred_at,unit_normalized)
  values (v_store,p_ingredient,'discard',-p_discard_quantity,-p_discard_quantity,
    p_discard_quantity,coalesce(nullif(trim(p_note),''),'이전 폐기 내역'),p_occurred_at,true)
  returning * into v_event;
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  if v_event.inventory_resolution_kind='normal' then
    select coalesce(stock_total,0) into v_before from public.inventory_states
      where ingredient_id=p_ingredient and store_id=v_store for update;
    if not found then v_before:=0; end if;
    if v_before<p_discard_quantity then
      raise exception '현재 재고보다 많이 폐기할 수 없어요' using errcode='22000';
    end if;
    update public.inventory_states set stock_total=stock_total-p_discard_quantity,
      updated_at=clock_timestamp() where ingredient_id=p_ingredient and store_id=v_store;
  end if;
  v_unit:=public.base_unit_price(p_ingredient);
  if v_unit is not null then
    insert into public.price_trends(store_id,ingredient_id,trend_date,unit_price)
    values(v_store,p_ingredient,public.store_local_date(v_store,p_occurred_at),v_unit);
  end if;
  for rec in select distinct recipe_id from public.recipe_lines
    where ingredient_id=p_ingredient and store_id=v_store loop
    perform public.recompute_recipe(rec.recipe_id,'material',public.store_local_date(v_store,p_occurred_at));
  end loop;
  perform public.refresh_order_candidate(p_ingredient);
  v_result:=jsonb_build_object('ingredient_id',p_ingredient,'event_id',v_event.id,
    'discarded',p_discard_quantity,'stock_effect',v_event.stock_effect,
    'resolution_kind',v_event.inventory_resolution_kind,'unit_price',v_unit);
  insert into public.inventory_delayed_command_receipts(store_id,command_kind,request_key,payload_hash,result,created_by)
  values (v_store,'discard',p_request_key,v_payload_hash,v_result,auth.uid());
  return v_result||jsonb_build_object('duplicate',false);
end $fn$;

create or replace function public.record_delayed_stock_adjustment(
  p_ingredient uuid,p_quantity_delta numeric,p_soon_out boolean,p_note text,p_occurred_at timestamptz,
  p_request_key uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_store uuid; v_result jsonb; v_payload_hash text;
  v_receipt public.inventory_delayed_command_receipts; v_event public.inventory_events; v_before numeric;
begin
  select store_id into v_store from public.ingredients where id=p_ingredient;
  if v_store is null then raise exception '식재료를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  if p_occurred_at is null or p_occurred_at>clock_timestamp() then
    raise exception '실제 발생 시각을 확인해 주세요' using errcode='22000',detail='OCCURRED_AT_REQUIRED';
  end if;
  if p_quantity_delta is null or p_quantity_delta=0 then
    raise exception '재고 증감량은 0이 아니어야 해요' using errcode='22000';
  end if;
  if p_request_key is null then raise exception '요청 키를 확인해 주세요' using errcode='22000'; end if;
  perform public.lock_store_write_scope(v_store);
  v_payload_hash:=public.sales_json_sha256(jsonb_build_object('ingredient_id',p_ingredient,
    'quantity_delta',p_quantity_delta,'soon_out',coalesce(p_soon_out,false),
    'note',coalesce(p_note,''),'occurred_at',p_occurred_at));
  select * into v_receipt from public.inventory_delayed_command_receipts
   where store_id=v_store and command_kind='stock_adjustment' and request_key=p_request_key;
  if found then
    if v_receipt.payload_hash<>v_payload_hash then
      raise exception '같은 요청 키의 지연 재고 조정 내용이 달라요'
        using errcode='45021',detail='IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return v_receipt.result||jsonb_build_object('duplicate',true);
  end if;
  perform set_config('costkeep.inventory_event_occurred_at',p_occurred_at::text,true);
  insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
    note,occurred_at,unit_normalized)
  values (v_store,p_ingredient,'stocktake',p_quantity_delta,p_quantity_delta,
    coalesce(nullif(trim(p_note),''),'이전 재고 조정 내역'),p_occurred_at,true)
  returning * into v_event;
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  if v_event.inventory_resolution_kind='normal' then
    select coalesce(stock_total,0) into v_before from public.inventory_states
      where ingredient_id=p_ingredient and store_id=v_store for update;
    if not found then v_before:=0; end if;
    if v_before+p_quantity_delta<0 then
      raise exception '재고 조정 후 수량은 0 이상이어야 해요' using errcode='22000';
    end if;
    insert into public.inventory_states(ingredient_id,store_id,stock_total,soon_out)
    values(p_ingredient,v_store,v_before+p_quantity_delta,coalesce(p_soon_out,false))
    on conflict(ingredient_id) do update set stock_total=excluded.stock_total,
      soon_out=excluded.soon_out,updated_at=clock_timestamp();
  end if;
  perform public.refresh_order_candidate(p_ingredient);
  v_result:=jsonb_build_object('ingredient_id',p_ingredient,'event_id',v_event.id,
    'delta',p_quantity_delta,'stock_effect',v_event.stock_effect,
    'resolution_kind',v_event.inventory_resolution_kind);
  insert into public.inventory_delayed_command_receipts(store_id,command_kind,request_key,payload_hash,result,created_by)
  values (v_store,'stock_adjustment',p_request_key,v_payload_hash,v_result,auth.uid());
  return v_result||jsonb_build_object('duplicate',false);
end $fn$;

create or replace function public.correct_absorbed_inventory_event(
  p_store uuid,p_source_event uuid,p_base_revision integer,
  p_target_reported_count_delta numeric,p_target_volume_delta numeric,
  p_reason text,p_request_key uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_source public.inventory_events;
  v_existing public.inventory_event_economic_corrections;
  v_revision integer;
  v_current_reported numeric;
  v_current_volume numeric;
  v_target_delta numeric;
  v_order_delta numeric;
  v_new_received numeric;
  v_unit numeric;
  v_month text;
  v_order public.order_records;
  rec record;
  v_payload jsonb;
  v_hash text;
  v_event uuid;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_store_write_scope(p_store);
  select * into v_source from public.inventory_events
   where id=p_source_event and store_id=p_store;
  if not found or v_source.inventory_resolution_kind not in ('absorbed_before_count','ambiguous_during_count') then
    raise exception '경제 정정할 실사 흡수 내역을 찾을 수 없어요'
      using errcode='P0002',detail='ABSORBED_EVENT_NOT_FOUND';
  end if;
  v_payload:=jsonb_build_object('source_event_id',p_source_event,
    'target_reported_count_delta',p_target_reported_count_delta,
    'target_volume_delta',p_target_volume_delta,'reason',trim(coalesce(p_reason,'')));
  v_hash:=public.sales_json_sha256(v_payload);
  select * into v_existing from public.inventory_event_economic_corrections
   where store_id=p_store and request_key=p_request_key;
  if found then
    if v_existing.payload_hash<>v_hash then
      raise exception '같은 요청 키의 경제 정정 내용이 달라요'
        using errcode='45021',detail='IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return jsonb_build_object('correction_id',v_existing.id,'revision',v_existing.revision,
      'event_id',v_existing.correction_event_id,'duplicate',true);
  end if;
  select revision,target_reported_count_delta,target_volume_delta
    into v_revision,v_current_reported,v_current_volume
    from public.inventory_event_economic_corrections where source_event_id=p_source_event
    order by revision desc limit 1;
  if not found then
    v_revision:=0;
    v_current_reported:=coalesce(v_source.reported_count_delta,v_source.count_delta,0);
    v_current_volume:=v_source.volume_delta;
  end if;
  if v_revision<>p_base_revision then
    raise exception '다른 기기에서 경제 정정 내역이 변경됐어요'
      using errcode='45009',detail='ECONOMIC_REVISION_CONFLICT';
  end if;
  if trim(coalesce(p_reason,''))='' then
    raise exception '경제 정정 사유를 입력해 주세요' using errcode='22000';
  end if;
  if v_source.type='inbound' then
    if p_target_reported_count_delta<=0 or p_target_volume_delta is not null
       or v_source.order_record_id is null then
      raise exception '입고 정정 수량을 확인해 주세요' using errcode='22000';
    end if;
  elsif v_source.type='discard' then
    if p_target_reported_count_delta>=0 or coalesce(p_target_volume_delta,0)<=0
       or abs(p_target_reported_count_delta)<>p_target_volume_delta then
      raise exception '폐기 정정 수량을 확인해 주세요' using errcode='22000';
    end if;
  elsif v_source.type='stocktake' then
    if p_target_volume_delta is not null then
      raise exception '재고 조정 정정에는 별도 폐기량을 입력할 수 없어요' using errcode='22000';
    end if;
  else
    raise exception '이 내역은 경제 정정을 지원하지 않아요'
      using errcode='22000',detail='ECONOMIC_CORRECTION_UNSUPPORTED';
  end if;
  v_target_delta:=p_target_reported_count_delta-coalesce(v_current_reported,0);

  -- 흡수된 입고의 평가단가 권위는 inventory_events가 아니라 order_records다.
  -- 따라서 경제 정정은 원장 차이 사건과 같은 트랜잭션에서 실제 입고 개수·월 재료비·
  -- 단가 추이·메뉴 원가를 함께 전진 정정한다. 현재 물리 재고는 실측을 보존한다.
  if v_source.type='inbound' then
    select * into v_order from public.order_records where id=v_source.order_record_id for update;
    if coalesce(v_order.volume,0)<=0 then
      raise exception '입고 정정 기준 용량을 확인할 수 없어요' using errcode='22000';
    end if;
    -- 입고 사건은 당시 발주에 적힌 포장 용량으로 기준단위가 만들어졌다. 현재 식재료의
    -- 기본 용량은 이후 바뀔 수 있으므로 경제 정정도 원 발주의 불변 용량으로 역환산한다.
    v_order_delta:=v_target_delta/v_order.volume;
    v_new_received:=v_order.received_qty+v_order_delta;
    if v_order.status='canceled' or v_new_received<0 or v_new_received>v_order.qty then
      raise exception '입고 정정 후 수량이 발주 범위를 벗어나요' using errcode='22000';
    end if;
    update public.order_records set received_qty=v_new_received,
      status=(case when v_new_received=0 then 'ordered'
                   when v_new_received>=qty then 'received' else 'partial' end)::public.order_status
      where id=v_order.id;
    v_month:=to_char(public.store_local_date(p_store,v_source.occurred_at),'YYYY-MM');
    insert into public.monthly_pl(store_id,month,material_cost)
    values(p_store,v_month,v_order.amount*v_order_delta)
    on conflict(store_id,month) do update set material_cost=
      public.monthly_pl.material_cost+excluded.material_cost;
  end if;
  perform set_config('costkeep.inventory_economic_correction','on',true);
  insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
    volume_delta,order_record_id,note,occurred_at,stock_effect,absorbed_by_count_batch_id,
    classified_by_count_batch_id,inventory_resolution_kind,unit_normalized)
  values (p_store,v_source.ingredient_id,v_source.type,0,
    v_target_delta,
    p_target_volume_delta-coalesce(v_current_volume,0),v_source.order_record_id,
    '경제 정정 · '||trim(p_reason),v_source.occurred_at,'absorbed',
    v_source.absorbed_by_count_batch_id,v_source.classified_by_count_batch_id,
    'economic_correction',true)
  returning id into v_event;
  insert into public.inventory_event_economic_corrections(store_id,source_event_id,revision,
    request_key,payload_hash,target_reported_count_delta,target_volume_delta,
    correction_event_id,reason,created_by)
  values (p_store,p_source_event,v_revision+1,p_request_key,v_hash,
    p_target_reported_count_delta,p_target_volume_delta,v_event,trim(p_reason),auth.uid())
  returning * into v_existing;
  if v_source.type in ('inbound','discard') then
    v_unit:=public.base_unit_price(v_source.ingredient_id);
    if v_unit is not null then
      insert into public.price_trends(store_id,ingredient_id,trend_date,unit_price,order_record_id)
      values(p_store,v_source.ingredient_id,public.store_local_date(p_store,clock_timestamp()),v_unit,
        case when v_source.type='inbound' then v_source.order_record_id end);
    end if;
    for rec in select distinct recipe_id from public.recipe_lines
      where ingredient_id=v_source.ingredient_id and store_id=p_store loop
      perform public.recompute_recipe(rec.recipe_id,'material',public.store_local_date(p_store,clock_timestamp()));
    end loop;
  end if;
  perform public.refresh_order_candidate(v_source.ingredient_id);
  perform set_config('costkeep.inventory_economic_correction','off',true);
  return jsonb_build_object('correction_id',v_existing.id,'revision',v_existing.revision,
    'event_id',v_event,'duplicate',false);
end $fn$;

-- order_records.amount is the price of one purchase pack. Older E1 code divided
-- that unit price by the ordered pack count once more before accumulating monthly
-- material cost. Keep E1, E11 and absorbed-event economic corrections on the same
-- unit-price x received-pack-count contract.
do $migration$
declare
  definition text;
  anchor text:='o.amount / nullif(o.qty,0) * v_qty';
begin
  definition:=pg_get_functiondef('public.e1_confirm_inbound(uuid,numeric,text,date)'::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2 then
    raise exception 'e1_confirm_inbound monthly material cost anchor must occur exactly twice';
  end if;
  execute replace(definition,anchor,'o.amount * v_qty');
end $migration$;

-- Existing stores may contain an old partial E5 stocktake that was never part of
-- an immutable whole-store count batch. Mark that ambiguity while entering the
-- freeze phase so activation cannot project legacy sale components until a new
-- complete count has established the physical baseline.
do $migration$
declare
  definition text;
  guarded_anchor text:='  if p_target=''freezing'' and v.freeze_receipt_id is null then';
  legacy_anchor text:='  if p_target=''freezing'' then';
  anchor text;
  guarded_count integer;
  legacy_count integer;
  addition text;
begin
  definition:=pg_get_functiondef(
    'public.set_sales_lifecycle_phase(uuid,integer,public.sales_cutover_phase,text)'::regprocedure);
  guarded_count:=(length(definition)-length(replace(definition,guarded_anchor,'')))/length(guarded_anchor);
  legacy_count:=(length(definition)-length(replace(definition,legacy_anchor,'')))/length(legacy_anchor);
  if guarded_count+legacy_count<>1 then
    raise exception 'set_sales_lifecycle_phase freezing anchor must occur exactly once';
  end if;
  anchor:=case when guarded_count=1 then guarded_anchor else legacy_anchor end;
  addition:=
    '  if p_target=''freezing'' and v.freeze_receipt_id is null and exists ('||chr(10)||
    '    select 1 from public.inventory_events e'||chr(10)||
    '    left join public.inventory_count_lines l on l.event_id=e.id'||chr(10)||
    '    where e.store_id=p_store and e.type=''stocktake'' and l.event_id is null'||chr(10)||
    '  ) then'||chr(10)||
    '    update public.stores set'||chr(10)||
    '      legacy_inventory_cutoff_business_date=greatest(legacy_inventory_cutoff_business_date,v_reference),'||chr(10)||
    '      inventory_recount_required=true'||chr(10)||
    '    where id=p_store;'||chr(10)||
    '  end if;'||chr(10)||chr(10)||anchor;
  execute replace(definition,anchor,addition);
end $migration$;

create or replace function public.inventory_event_occurrence_context(p_ingredient uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_store uuid;
  v_batch public.inventory_count_batches;
begin
  select store_id into v_store from public.ingredients
    where id=p_ingredient and active;
  if v_store is null then
    raise exception '식재료를 찾을 수 없어요' using errcode='P0002';
  end if;
  perform public.assert_my_store(v_store);
  select b.* into v_batch
    from public.inventory_count_lines l
    join public.inventory_count_batches b on b.id=l.batch_id
    where l.ingredient_id=p_ingredient
    order by b.counted_at desc,b.id desc limit 1;
  return jsonb_build_object(
    'server_now',clock_timestamp(),
    'timezone',public.store_timezone(v_store),
    'requires_confirmation',v_batch.id is not null,
    'observation_started_at',v_batch.observation_started_at,
    'counted_at',v_batch.counted_at,
    'observation_started_local',case when v_batch.id is not null then
      to_char(v_batch.observation_started_at at time zone public.store_timezone(v_store),'YYYY-MM-DD HH24:MI') end,
    'counted_local',case when v_batch.id is not null then
      to_char(v_batch.counted_at at time zone public.store_timezone(v_store),'YYYY-MM-DD HH24:MI') end
  );
end $fn$;

create or replace function public.inventory_event_local_timestamp(
  p_ingredient uuid,p_local_date date,p_local_time time
) returns timestamptz language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_store uuid; v_result timestamptz;
begin
  select store_id into v_store from public.ingredients where id=p_ingredient and active;
  if v_store is null then raise exception '식재료를 찾을 수 없어요' using errcode='P0002'; end if;
  perform public.assert_my_store(v_store);
  if p_local_date is null or p_local_time is null then
    raise exception '실제 발생 날짜와 시간을 입력해 주세요' using errcode='22000';
  end if;
  v_result:=(p_local_date+p_local_time) at time zone public.store_timezone(v_store);
  if v_result>clock_timestamp() then
    raise exception '미래 시각은 입력할 수 없어요' using errcode='22000';
  end if;
  return v_result;
end $fn$;

create or replace function public.record_delayed_quick_inbound(
  p_store uuid,p_ingredient uuid,p_volume numeric,p_amount numeric,p_qty numeric,
  p_vendor uuid,p_request_key text,p_occurred_at timestamptz
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  if not exists(select 1 from public.ingredients where id=p_ingredient and store_id=p_store and active) then
    raise exception '식재료를 찾을 수 없어요' using errcode='P0002';
  end if;
  if p_occurred_at is null or p_occurred_at>clock_timestamp() then
    raise exception '실제 발생 시각을 확인해 주세요' using errcode='22000';
  end if;
  perform set_config('costkeep.inventory_stock_already_applied','on',true);
  perform set_config('costkeep.inventory_event_occurred_at',p_occurred_at::text,true);
  v_result:=public.quick_inbound(p_store,p_ingredient,p_volume,p_amount,p_qty,p_vendor,
    public.store_local_date(p_store,p_occurred_at),p_request_key);
  perform set_config('costkeep.inventory_event_occurred_at','',true);
  perform set_config('costkeep.inventory_stock_already_applied','',true);
  return v_result;
end $fn$;

create or replace function public.sales_inventory_count_requirement(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_phase public.sales_cutover_phase; v_required boolean; v_reference date;
begin
  perform public.assert_my_store(p_store);
  select c.phase,c.inventory_reference_sales_date,
         s.inventory_recount_required or exists(select 1 from public.inventory_recount_targets t
           where t.store_id=p_store and t.status='pending')
    into v_phase,v_reference,v_required
    from public.sales_lifecycle_cutover_state c join public.stores s on s.id=c.store_id
    where c.store_id=p_store;
  return jsonb_build_object('required',coalesce(v_required,false),'phase',v_phase,
    'reference_sales_date',v_reference,
    'reason',case when coalesce(v_required,false) then '현재 재고를 전체 실사해야 매출을 계속 작성할 수 있어요' end);
end $fn$;

grant create on schema public to costkeep_rpc_executor;
alter table public.inventory_events drop constraint if exists inventory_events_discard_positive_ck;
alter table public.inventory_events add constraint inventory_events_discard_positive_ck
  check (type<>'discard' or inventory_resolution_kind='economic_correction' or volume_delta>0) not valid;
alter table public.inventory_events validate constraint inventory_events_discard_positive_ck;

alter table public.inventory_event_economic_corrections enable row level security;
alter table public.inventory_delayed_command_receipts enable row level security;
alter table public.inventory_event_economic_corrections owner to costkeep_rpc_executor;
alter table public.inventory_delayed_command_receipts owner to costkeep_rpc_executor;
create policy inventory_event_economic_corrections_read on public.inventory_event_economic_corrections
for select using (store_id in (select id from public.stores where owner_id=auth.uid() and archived_at is null));
create policy inventory_delayed_command_receipts_read on public.inventory_delayed_command_receipts
for select using (store_id in (select id from public.stores where owner_id=auth.uid() and archived_at is null));
revoke all on public.inventory_event_economic_corrections from public,anon,authenticated;
revoke all on public.inventory_delayed_command_receipts from public,anon,authenticated;
grant select,insert on public.inventory_event_economic_corrections to costkeep_rpc_executor;
grant select,insert on public.inventory_delayed_command_receipts to costkeep_rpc_executor;

alter function public.apply_delayed_inventory_event_resolution() owner to costkeep_rpc_executor;
alter function public.record_current_inbound(uuid,numeric,text) owner to costkeep_rpc_executor;
alter function public.record_current_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text) owner to costkeep_rpc_executor;
alter function public.record_current_discard(uuid,numeric) owner to costkeep_rpc_executor;
alter function public.record_current_stock_adjustment(uuid,numeric,boolean,text) owner to costkeep_rpc_executor;
alter function public.record_current_stock_quantity(uuid,text,numeric,numeric,text,text) owner to costkeep_rpc_executor;
alter function public.record_delayed_inbound(uuid,numeric,text,timestamptz) owner to costkeep_rpc_executor;
alter function public.record_delayed_discard(uuid,numeric,timestamptz,text,uuid) owner to costkeep_rpc_executor;
alter function public.record_delayed_stock_adjustment(uuid,numeric,boolean,text,timestamptz,uuid) owner to costkeep_rpc_executor;
alter function public.correct_absorbed_inventory_event(uuid,uuid,integer,numeric,numeric,text,uuid) owner to costkeep_rpc_executor;
alter function public.inventory_event_occurrence_context(uuid) owner to costkeep_rpc_executor;
alter function public.inventory_event_local_timestamp(uuid,date,time) owner to costkeep_rpc_executor;
alter function public.record_delayed_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text,timestamptz) owner to costkeep_rpc_executor;
alter function public.sales_inventory_count_requirement(uuid) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
-- 경제 정정 RPC는 원본 append-only 사건을 잠가 판본과 분류를 검증한다.
-- 앱 역할이 아닌 SECURITY DEFINER 전용 실행 역할에만 읽기 권한을 준다.
grant select on public.inventory_events to costkeep_rpc_executor;
revoke all on function public.apply_delayed_inventory_event_resolution(),
  public.record_current_inbound(uuid,numeric,text),
  public.record_current_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text),
  public.record_current_discard(uuid,numeric),
  public.record_current_stock_adjustment(uuid,numeric,boolean,text),
  public.record_current_stock_quantity(uuid,text,numeric,numeric,text,text),
  public.record_delayed_inbound(uuid,numeric,text,timestamptz),
  public.record_delayed_discard(uuid,numeric,timestamptz,text,uuid),
  public.record_delayed_stock_adjustment(uuid,numeric,boolean,text,timestamptz,uuid),
  public.correct_absorbed_inventory_event(uuid,uuid,integer,numeric,numeric,text,uuid)
  ,public.inventory_event_occurrence_context(uuid)
  ,public.inventory_event_local_timestamp(uuid,date,time)
  ,public.record_delayed_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text,timestamptz)
  ,public.sales_inventory_count_requirement(uuid)
  from public,anon;
grant execute on function public.record_delayed_inbound(uuid,numeric,text,timestamptz),
  public.record_current_inbound(uuid,numeric,text),
  public.record_current_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text),
  public.record_current_discard(uuid,numeric),
  public.record_current_stock_adjustment(uuid,numeric,boolean,text),
  public.record_current_stock_quantity(uuid,text,numeric,numeric,text,text),
  public.record_delayed_discard(uuid,numeric,timestamptz,text,uuid),
  public.record_delayed_stock_adjustment(uuid,numeric,boolean,text,timestamptz,uuid),
  public.correct_absorbed_inventory_event(uuid,uuid,integer,numeric,numeric,text,uuid)
  ,public.inventory_event_occurrence_context(uuid)
  ,public.inventory_event_local_timestamp(uuid,date,time)
  ,public.record_delayed_quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,text,timestamptz)
  ,public.sales_inventory_count_requirement(uuid)
  to authenticated;

grant update(legacy_inventory_cutoff_business_date,inventory_recount_required)
  on public.stores to costkeep_rpc_executor;

commit;
