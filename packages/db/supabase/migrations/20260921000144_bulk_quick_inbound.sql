-- ING-12 · 재료 일괄 입고
-- 여러 직접 입고를 한 트랜잭션에서 확정하고 배치 요청 키로 중복을 막는다.
begin;

create table public.quick_inbound_batch_receipts (
  store_id uuid not null references public.stores(id) on delete cascade,
  request_key uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (store_id, request_key)
);

create table public.quick_inbound_batch_closed_requests (
  store_id uuid not null references public.stores(id) on delete cascade,
  request_key uuid not null,
  actor_id uuid not null,
  closed_at timestamptz not null default clock_timestamp(),
  primary key (store_id, request_key)
);

alter table public.quick_inbound_batch_receipts enable row level security;
alter table public.quick_inbound_batch_closed_requests enable row level security;

create policy quick_inbound_batch_receipts_read on public.quick_inbound_batch_receipts
  for select to costkeep_rpc_executor
  using (created_by = auth.uid() and exists (
    select 1 from public.stores s
     where s.id = quick_inbound_batch_receipts.store_id
       and s.owner_id = auth.uid() and s.archived_at is null
  ));
create policy quick_inbound_batch_receipts_insert on public.quick_inbound_batch_receipts
  for insert to costkeep_rpc_executor
  with check (created_by = auth.uid() and exists (
    select 1 from public.stores s
     where s.id = quick_inbound_batch_receipts.store_id
       and s.owner_id = auth.uid() and s.archived_at is null
  ));
create policy quick_inbound_batch_closed_read on public.quick_inbound_batch_closed_requests
  for select to costkeep_rpc_executor
  using (actor_id = auth.uid() and exists (
    select 1 from public.stores s
     where s.id = quick_inbound_batch_closed_requests.store_id
       and s.owner_id = auth.uid() and s.archived_at is null
  ));
create policy quick_inbound_batch_closed_insert on public.quick_inbound_batch_closed_requests
  for insert to costkeep_rpc_executor
  with check (actor_id = auth.uid() and exists (
    select 1 from public.stores s
     where s.id = quick_inbound_batch_closed_requests.store_id
       and s.owner_id = auth.uid() and s.archived_at is null
  ));

revoke all on public.quick_inbound_batch_receipts from public, anon, authenticated, service_role;
revoke all on public.quick_inbound_batch_closed_requests from public, anon, authenticated, service_role;
grant select, insert on public.quick_inbound_batch_receipts to costkeep_rpc_executor;
grant select, insert on public.quick_inbound_batch_closed_requests to costkeep_rpc_executor;

create function public.validate_quick_inbound_batch(p_store uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_item jsonb;
  v_client_text text;
  v_client uuid;
  v_ingredient uuid;
  v_vendor uuid;
  v_quantity numeric;
  v_paid numeric;
  v_seen uuid[] := '{}';
begin
  perform public.assert_my_store(p_store);
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 20 then
    raise exception '입고 항목은 1개 이상 20개 이하로 보내 주세요.'
      using errcode = '22000', detail = 'BULK_INBOUND_ITEMS_INVALID';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_client_text := v_item->>'client_item_id';
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['client_item_id','ingredient_id','received_quantity','paid_amount'])
       or exists (
         select 1 from jsonb_object_keys(v_item) as keys(key)
          where key not in ('client_item_id','ingredient_id','vendor_id','received_quantity','paid_amount')
       ) then
      raise exception '입고 항목 형식을 확인해 주세요.'
        using errcode = '22000', detail = 'BULK_INBOUND_ITEM_SHAPE_INVALID:' || coalesce(v_client_text, 'unknown');
    end if;
    begin
      v_client := nullif(v_client_text, '')::uuid;
      v_ingredient := nullif(v_item->>'ingredient_id', '')::uuid;
      v_vendor := nullif(v_item->>'vendor_id', '')::uuid;
      v_quantity := (v_item->>'received_quantity')::numeric;
      v_paid := (v_item->>'paid_amount')::numeric;
    exception when others then
      raise exception '입고 항목 형식을 확인해 주세요.'
        using errcode = '22000', detail = 'BULK_INBOUND_ITEM_FORMAT_INVALID:' || coalesce(v_client_text, 'unknown');
    end;
    if v_client is null or v_ingredient is null
       or v_quantity is null or not (v_quantity > 0 and v_quantity < 'Infinity'::numeric)
       or v_paid is null or not (v_paid > 0 and v_paid < 'Infinity'::numeric) then
      raise exception '입고량과 결제금액을 확인해 주세요.'
        using errcode = '22000', detail = 'BULK_INBOUND_ITEM_VALUE_INVALID:' || coalesce(v_client_text, 'unknown');
    end if;
    if v_client = any(v_seen) then
      raise exception '중복된 입고 항목이 있어요.'
        using errcode = '22000', detail = 'BULK_INBOUND_CLIENT_ITEM_DUPLICATE:' || v_client::text;
    end if;
    v_seen := array_append(v_seen, v_client);
    if not exists (
      select 1 from public.ingredients i
       where i.id = v_ingredient and i.store_id = p_store and i.active and i.stock_tracking
    ) then
      raise exception '입고할 재료를 찾을 수 없어요.'
        using errcode = 'P0002', detail = 'BULK_INBOUND_INGREDIENT_NOT_FOUND:' || v_client::text;
    end if;
    if v_vendor is not null and not exists (
      select 1 from public.vendors v
       where v.id = v_vendor and v.store_id = p_store and not v.hidden
    ) then
      raise exception '입고 구매처를 찾을 수 없어요.'
        using errcode = 'P0002', detail = 'BULK_INBOUND_VENDOR_NOT_FOUND:' || v_client::text;
    end if;
  end loop;
end;
$fn$;

create function public.quick_inbound_batch_preview(p_store uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_item jsonb;
  v_client uuid;
  v_ingredient uuid;
  v_quantity numeric;
  v_paid numeric;
  v_existing_quantity numeric;
  v_existing_paid numeric;
  v_added numeric;
  v_added_paid numeric;
  v_stock numeric;
  v_after_price numeric;
  v_key text;
  v_virtual jsonb := '{}'::jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  perform public.validate_quick_inbound_batch(p_store, p_items);
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_client := (v_item->>'client_item_id')::uuid;
    v_ingredient := (v_item->>'ingredient_id')::uuid;
    v_quantity := (v_item->>'received_quantity')::numeric;
    v_paid := (v_item->>'paid_amount')::numeric;
    v_key := v_ingredient::text;
    v_added := coalesce((v_virtual->v_key->>'quantity')::numeric, 0);
    v_added_paid := coalesce((v_virtual->v_key->>'paid')::numeric, 0);
    select coalesce(sum(o.volume * o.received_qty), 0),
           coalesce(sum(o.amount * o.received_qty), 0)
      into v_existing_quantity, v_existing_paid
      from public.order_records o
     where o.ingredient_id = v_ingredient and o.status in ('received','partial');
    v_stock := coalesce(public.stock_total_base(v_ingredient), 0) + v_added;
    v_after_price := case when v_existing_quantity + v_added + v_quantity > 0
      then (v_existing_paid + v_added_paid + v_paid) /
           (v_existing_quantity + v_added + v_quantity) end;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'client_item_id', v_client,
      'ingredient_id', v_ingredient,
      'stock_before', v_stock,
      'stock_after', v_stock + v_quantity,
      'inbound_unit_price', v_paid / v_quantity,
      'base_price_after', v_after_price,
      'affected_recipes', (select count(distinct l.recipe_id) from public.recipe_lines l
        where l.store_id = p_store and l.ingredient_id = v_ingredient)
    ));
    v_virtual := jsonb_set(v_virtual, array[v_key], jsonb_build_object(
      'quantity', v_added + v_quantity,
      'paid', v_added_paid + v_paid
    ), true);
  end loop;
  return jsonb_build_object('items', v_results);
end;
$fn$;

create function public.record_current_quick_inbound_batch(
  p_store uuid,
  p_items jsonb,
  p_request_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_receipt public.quick_inbound_batch_receipts;
  v_item jsonb;
  v_client uuid;
  v_ingredient uuid;
  v_vendor uuid;
  v_quantity numeric;
  v_paid numeric;
  v_card_key text;
  v_quick jsonb;
  v_event uuid;
  v_stock_before numeric;
  v_affected_recipes integer;
  v_now timestamptz := clock_timestamp();
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  if p_request_key is null then
    raise exception '입고 요청 키를 확인해 주세요.'
      using errcode = '22000', detail = 'BULK_INBOUND_REQUEST_KEY_REQUIRED';
  end if;
  perform public.lock_store_write_scope(p_store);
  perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':quick-batch:' || p_request_key::text, 0));
  if exists (
    select 1 from public.quick_inbound_batch_closed_requests
     where store_id = p_store and request_key = p_request_key
  ) then
    raise exception '확인 완료된 이전 요청입니다. 새 일괄 입고로 등록해 주세요.'
      using errcode = '45010', detail = 'BULK_INBOUND_REQUEST_CLOSED';
  end if;
  select * into v_receipt from public.quick_inbound_batch_receipts
   where store_id = p_store and request_key = p_request_key;
  if found then
    if v_receipt.payload <> p_items then
      raise exception '동일 요청 키의 입고 내용이 다릅니다.'
        using errcode = '45021', detail = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return v_receipt.result || jsonb_build_object('duplicate', true);
  end if;

  perform public.validate_quick_inbound_batch(p_store, p_items);
  perform set_config('costkeep.inventory_event_occurred_at', v_now::text, true);
  perform set_config('costkeep.inventory_stock_already_applied', 'on', true);
  begin
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      v_client := (v_item->>'client_item_id')::uuid;
      v_ingredient := (v_item->>'ingredient_id')::uuid;
      v_vendor := nullif(v_item->>'vendor_id', '')::uuid;
      v_quantity := (v_item->>'received_quantity')::numeric;
      v_paid := (v_item->>'paid_amount')::numeric;
      v_card_key := p_request_key::text || ':' || v_client::text;
      v_stock_before := public.stock_total_base(v_ingredient);
      select count(distinct l.recipe_id)::integer into v_affected_recipes
        from public.recipe_lines l
       where l.store_id = p_store and l.ingredient_id = v_ingredient;
      v_quick := public.quick_inbound(
        p_store, v_ingredient, v_quantity, v_paid, 1, v_vendor,
        public.store_local_date(p_store, v_now), v_card_key
      );
      if coalesce((v_quick->>'duplicate')::boolean, false) then
        raise exception '입고 카드 요청 키가 이미 사용됐어요.'
          using errcode = '45021', detail = 'BULK_INBOUND_CARD_KEY_COLLISION:' || v_client::text;
      end if;
      select e.id into v_event from public.inventory_events e
       where e.store_id = p_store and e.idempotency_key = v_card_key
       limit 1;
      if v_event is null or nullif(v_quick->>'order_id', '') is null then
        raise exception '입고 결과를 확인하지 못했어요.'
          using errcode = 'P0001', detail = 'BULK_INBOUND_RESULT_INVALID:' || v_client::text;
      end if;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'client_item_id', v_client,
        'ingredient_id', v_ingredient,
        'card_idempotency_key', v_card_key,
        'order_id', v_quick->>'order_id',
        'inventory_event_id', v_event,
        'stock_before', v_stock_before,
        'stock_after', public.stock_total_base(v_ingredient),
        'inbound_unit_price', v_paid / v_quantity,
        'base_price_after', public.base_unit_price(v_ingredient),
        'affected_recipes', v_affected_recipes
      ));
    end loop;
  exception when others then
    perform set_config('costkeep.inventory_stock_already_applied', 'off', true);
    perform set_config('costkeep.inventory_event_occurred_at', '', true);
    raise;
  end;
  perform set_config('costkeep.inventory_stock_already_applied', 'off', true);
  perform set_config('costkeep.inventory_event_occurred_at', '', true);

  v_result := jsonb_build_object('items', v_results, 'duplicate', false);
  insert into public.quick_inbound_batch_receipts(store_id, request_key, payload, result, created_by)
  values (p_store, p_request_key, p_items, v_result, auth.uid());
  return v_result;
end;
$fn$;

create function public.resolve_quick_inbound_batch(p_store uuid, p_request_key uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  if p_request_key is null then
    raise exception '입고 요청 키를 확인해 주세요.'
      using errcode = '22000', detail = 'BULK_INBOUND_REQUEST_KEY_REQUIRED';
  end if;
  perform public.lock_store_write_scope(p_store);
  perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':quick-batch:' || p_request_key::text, 0));
  select result into v_result from public.quick_inbound_batch_receipts
   where store_id = p_store and request_key = p_request_key;
  if found then
    return jsonb_build_object('status', 'recorded') || v_result;
  end if;
  if not exists (
    select 1 from public.quick_inbound_batch_closed_requests
     where store_id = p_store and request_key = p_request_key
  ) then
    insert into public.quick_inbound_batch_closed_requests(store_id, request_key, actor_id)
    values (p_store, p_request_key, auth.uid());
  end if;
  return jsonb_build_object('status', 'not_recorded', 'items', '[]'::jsonb);
end;
$fn$;

grant create on schema public to costkeep_rpc_executor;
alter function public.validate_quick_inbound_batch(uuid,jsonb) owner to costkeep_rpc_executor;
alter function public.quick_inbound_batch_preview(uuid,jsonb) owner to costkeep_rpc_executor;
alter function public.record_current_quick_inbound_batch(uuid,jsonb,uuid) owner to costkeep_rpc_executor;
alter function public.resolve_quick_inbound_batch(uuid,uuid) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.validate_quick_inbound_batch(uuid,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.quick_inbound_batch_preview(uuid,jsonb) from public, anon;
revoke all on function public.record_current_quick_inbound_batch(uuid,jsonb,uuid) from public, anon;
revoke all on function public.resolve_quick_inbound_batch(uuid,uuid) from public, anon;
grant execute on function public.quick_inbound_batch_preview(uuid,jsonb) to authenticated, service_role;
grant execute on function public.record_current_quick_inbound_batch(uuid,jsonb,uuid) to authenticated, service_role;
grant execute on function public.resolve_quick_inbound_batch(uuid,uuid) to authenticated, service_role;

comment on function public.quick_inbound_batch_preview(uuid,jsonb) is
  'ING-12 일괄 입고의 카드 순서 누적 미리보기. 원장을 변경하지 않는다.';
comment on function public.record_current_quick_inbound_batch(uuid,jsonb,uuid) is
  'ING-12 일괄 입고 E7+E1 원자 저장. 배치와 카드 요청 키 모두 멱등이다.';
comment on function public.resolve_quick_inbound_batch(uuid,uuid) is
  '응답이 불명확한 ING-12 배치를 확인하고 미기록 키를 닫는다.';

select public.assert_no_rpc_overloads();
notify pgrst, 'reload schema';
commit;
