-- E7 발주 묶음은 한 트랜잭션으로 저장하고 요청 키로 중복을 제거한다.
-- 응답이 유실돼도 같은 요청을 다시 보내면 기존 발주 ID만 반환한다.
begin;

create table public.order_placement_receipts (
  store_id uuid not null references public.stores(id) on delete cascade,
  request_key uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  primary key (store_id, request_key)
);

alter table public.order_placement_receipts enable row level security;
revoke all on table public.order_placement_receipts from public, anon, authenticated;

create function public.place_orders(
  p_store uuid,
  p_items jsonb,
  p_request_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_receipt public.order_placement_receipts;
  v_item jsonb;
  v_order uuid;
  v_ids uuid[] := '{}';
  v_result jsonb;
  v_ingredient uuid;
  v_vendor uuid;
  v_brand uuid;
  v_volume numeric;
  v_amount numeric;
  v_qty numeric;
  v_expected date;
  v_ordered_at date;
begin
  perform public.assert_my_store(p_store);
  if p_request_key is null then
    raise exception '발주 요청 키를 확인해 주세요' using errcode = '22000', detail = 'ORDER_REQUEST_KEY_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 100 then
    raise exception '발주 항목을 1개 이상 100개 이하로 보내 주세요'
      using errcode = '22000', detail = 'ORDER_ITEMS_INVALID';
  end if;

  -- 동일 매장·키의 경합을 직렬화한다. JSONB text는 키 순서가 정규화되어 동일 payload를 비교할 수 있다.
  perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':order:' || p_request_key::text, 0));
  select * into v_receipt from public.order_placement_receipts
   where store_id = p_store and request_key = p_request_key;
  if found then
    if v_receipt.payload <> p_items then
      raise exception '동일 요청 키의 발주 내용이 다릅니다'
        using errcode = '22000', detail = 'ORDER_REQUEST_PAYLOAD_MISMATCH';
    end if;
    return v_receipt.result || jsonb_build_object('duplicate', true);
  end if;

  -- 모든 항목을 먼저 검증한다. 아래 E7 중 하나라도 실패하면 함수 전체가 롤백된다.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_ingredient := nullif(v_item->>'ingredient_id', '')::uuid;
      v_vendor := nullif(v_item->>'vendor_id', '')::uuid;
      v_brand := nullif(v_item->>'brand_id', '')::uuid;
      v_volume := (v_item->>'volume')::numeric;
      v_amount := (v_item->>'amount')::numeric;
      v_qty := (v_item->>'qty')::numeric;
      v_expected := nullif(v_item->>'expected_at', '')::date;
      v_ordered_at := nullif(v_item->>'ordered_at', '')::date;
    exception when others then
      raise exception '발주 항목 형식을 확인해 주세요' using errcode = '22000', detail = 'ORDER_ITEM_FORMAT_INVALID';
    end;
    if v_ingredient is null or v_expected is null
       or v_volume is null or not (v_volume > 0 and v_volume < 'Infinity'::numeric)
       or v_amount is null or not (v_amount >= 0 and v_amount < 'Infinity'::numeric)
       or v_qty is null or not (v_qty > 0 and v_qty < 'Infinity'::numeric) then
      raise exception '발주 식재료·용량·금액·수량·도착일을 확인해 주세요'
        using errcode = '22000', detail = 'ORDER_ITEM_VALUE_INVALID';
    end if;
    if not exists (
      select 1 from public.ingredients i
       where i.id = v_ingredient and i.store_id = p_store and i.active
    ) then
      raise exception '발주할 식재료를 찾을 수 없어요' using errcode = 'P0002', detail = 'ORDER_INGREDIENT_NOT_FOUND';
    end if;
    if v_vendor is not null and not exists (
      select 1 from public.vendors v
       where v.id = v_vendor and v.store_id = p_store and not v.hidden
    ) then
      raise exception '발주 구매처를 찾을 수 없어요' using errcode = 'P0002', detail = 'ORDER_VENDOR_NOT_FOUND';
    end if;
    if v_brand is not null and not exists (
      select 1 from public.brands b
       where b.id = v_brand and b.store_id = p_store and not b.hidden
    ) then
      raise exception '발주 브랜드를 찾을 수 없어요' using errcode = 'P0002', detail = 'ORDER_BRAND_NOT_FOUND';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_order := public.e7_place_order(
      p_store,
      (v_item->>'ingredient_id')::uuid,
      nullif(v_item->>'vendor_id', '')::uuid,
      nullif(v_item->>'brand_id', '')::uuid,
      (v_item->>'volume')::numeric,
      (v_item->>'amount')::numeric,
      (v_item->>'qty')::numeric,
      (v_item->>'expected_at')::date,
      coalesce(nullif(v_item->>'source', '')::public.order_source, 'manual'::public.order_source),
      nullif(v_item->>'ordered_at', '')::date
    );
    v_ids := array_append(v_ids, v_order);
  end loop;

  v_result := jsonb_build_object('order_ids', to_jsonb(v_ids), 'duplicate', false);
  insert into public.order_placement_receipts(store_id, request_key, payload, result, created_by)
  values (p_store, p_request_key, p_items, v_result, auth.uid());
  return v_result;
end;
$fn$;

create function public.resolve_order_placement(
  p_store uuid,
  p_request_key uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_result jsonb;
begin
  perform public.assert_my_store(p_store);
  if p_request_key is null then
    raise exception '발주 요청 키를 확인해 주세요' using errcode = '22000', detail = 'ORDER_REQUEST_KEY_REQUIRED';
  end if;
  select result into v_result from public.order_placement_receipts
   where store_id = p_store and request_key = p_request_key;
  if found then
    return jsonb_build_object('status','recorded') || v_result;
  end if;
  return jsonb_build_object('status','not_recorded','order_ids','[]'::jsonb);
end;
$fn$;

grant create on schema public to costkeep_rpc_executor;
alter table public.order_placement_receipts owner to costkeep_rpc_executor;
alter function public.place_orders(uuid,jsonb,uuid) owner to costkeep_rpc_executor;
alter function public.resolve_order_placement(uuid,uuid) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.place_orders(uuid,jsonb,uuid) from public, anon;
revoke all on function public.resolve_order_placement(uuid,uuid) from public, anon;
grant execute on function public.place_orders(uuid,jsonb,uuid) to authenticated, service_role;
grant execute on function public.resolve_order_placement(uuid,uuid) to authenticated, service_role;

comment on function public.place_orders(uuid,jsonb,uuid) is
  'E7 발주 묶음 원자 저장. 같은 매장·요청 키·payload 재호출은 기존 order_ids를 반환한다.';
comment on function public.resolve_order_placement(uuid,uuid) is
  '응답이 불명확한 E7 발주 묶음의 기록 여부와 기존 order_ids를 조회한다.';

notify pgrst, 'reload schema';
commit;
