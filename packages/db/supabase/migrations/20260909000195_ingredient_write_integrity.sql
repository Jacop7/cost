-- UI audit F1-F4: distinct operations, immutable unit dimensions, quantity CAS,
-- persisted discard reason and reference purchase price. No historical rewrites.
begin;

alter table public.ingredients add column purchase_price numeric;
alter table public.ingredients add constraint ingredient_purchase_price_valid
  check (purchase_price is null or (purchase_price >= 0 and purchase_price < 'Infinity'::numeric));
comment on column public.ingredients.purchase_price is '개당 참고 구매 가격. 입고 원장·확정 기준단가에 영향을 주지 않는다.';

create function public.guard_ingredient_dimension() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $fn$
begin
  if new.base_unit is distinct from old.base_unit then
    raise exception '등록된 식재료의 무게·부피·개수 종류는 변경할 수 없습니다. 새 식재료로 등록해 주세요.' using errcode='22000';
  end if;
  return new;
end;
$fn$;
revoke all on function public.guard_ingredient_dimension() from public,anon,authenticated;
grant execute on function public.guard_ingredient_dimension() to margincook_rpc_executor;
create trigger ingredient_dimension_guard before update of base_unit on public.ingredients
  for each row execute function public.guard_ingredient_dimension();

-- Preserve the accumulated RPC/RLS/locale contracts. Fail closed if anchors move.
do $patch$
declare d text;
begin
  d:=pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure);
  if position('safety_stock, min_order_qty, default_vendor_id, memo, active' in d)=0
    or position('memo              = nullif(p_payload->>''memo'',''''),' in d)=0
    or position('into v_ch;' in d)=0 then raise exception 'save_ingredient anchors changed'; end if;
  d:=replace(d,'safety_stock, min_order_qty, default_vendor_id, memo, active',
    'safety_stock, min_order_qty, default_vendor_id, memo, purchase_price, active');
  d:=replace(d,'nullif(p_payload->>''memo'',''''),' || chr(10) || '      true',
    'nullif(p_payload->>''memo'',''''), (p_payload->>''purchase_price'')::numeric,' || chr(10) || '      true');
  -- pg_get_functiondef preserves CRLF bodies on Windows; normalize before matching.
  d:=replace(d,chr(13),'');
  d:=replace(d,'nullif(p_payload->>''memo'',''''),' || chr(10) || '      true',
    'nullif(p_payload->>''memo'',''''), (p_payload->>''purchase_price'')::numeric,' || chr(10) || '      true');
  d:=replace(d,'memo              = nullif(p_payload->>''memo'',''''),',
    'purchase_price = case when p_payload ? ''purchase_price'' then (p_payload->>''purchase_price'')::numeric else purchase_price end,
      memo              = nullif(p_payload->>''memo'',''''),');
  d:=replace(d,'into v_ch;',
    '|| change_line(''purchase_price'', ''구매 가격'', v_before.purchase_price,
        case when p_payload ? ''purchase_price'' then (p_payload->>''purchase_price'')::numeric else v_before.purchase_price end, ''원'') into v_ch;');
  execute d;

  d:=pg_get_functiondef('public.ingredient_detail(uuid)'::regprocedure);
  if position('''per_volume'', i.per_volume,' in d)=0 then raise exception 'ingredient_detail anchor changed'; end if;
  execute replace(d,'''per_volume'', i.per_volume,','''per_volume'', i.per_volume, ''purchase_price'', i.purchase_price,');

  d:=pg_get_functiondef('public.save_purchase_option(uuid,jsonb)'::regprocedure);
  if position('perform assert_my_store(p_store);' in d)=0 then raise exception 'save_purchase_option anchor changed'; end if;
  execute replace(d,'perform assert_my_store(p_store);',
    'perform assert_my_store(p_store);
     if not exists(select 1 from ingredients i where i.id=(p_payload->>''ingredient_id'')::uuid and i.store_id=p_store
       and (not (p_payload ? ''base_unit'') or i.base_unit::text=p_payload->>''base_unit'')) then
       raise exception ''식재료의 기준단위와 구매 용량 단위가 다릅니다'' using errcode=''22000'';
     end if;
     if v_id is not null and not exists(select 1 from purchase_options where id=v_id and store_id=p_store
       and ingredient_id=(p_payload->>''ingredient_id'')::uuid) then
       raise exception ''구매 링크의 식재료가 일치하지 않습니다'' using errcode=''22000'';
     end if;');

  d:=pg_get_functiondef('public.quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,date,text)'::regprocedure);
  if position('if p_idempotency_key is not null then' in d)=0 then raise exception 'quick_inbound anchor changed'; end if;
  d:=replace(d,'if p_idempotency_key is not null then',
    'if p_idempotency_key is not null then
      perform pg_advisory_xact_lock(hashtextextended(p_store::text || '':quick:'' || p_idempotency_key,0));');
  d:=replace(d,'if v_order is not null then',
    'if v_order is not null then
      if not exists(select 1 from order_records where id=v_order and ingredient_id=p_ingredient
        and volume=p_volume and amount=p_amount and qty=p_qty and vendor_id is not distinct from p_vendor) then
        raise exception ''동일 요청 키의 입고 내용이 다릅니다'' using errcode=''22000'';
      end if;');
  execute d;

  -- Private E2 body with a note argument; preserve the current calculation exactly.
  d:=pg_get_functiondef('public.e2_discard(uuid,numeric,date)'::regprocedure);
  d:=regexp_replace(d,'FUNCTION public.e2_discard\([^\n]+\)',
    'FUNCTION public.discard_stock_noted(p_ingredient uuid, p_remain_volume numeric, p_occurred_at date, p_note text)');
  if position('volume_delta, occurred_at, unit_normalized)' in d)=0 then raise exception 'discard note anchor changed'; end if;
  d:=replace(d,'volume_delta, occurred_at, unit_normalized)', 'volume_delta, note, occurred_at, unit_normalized)');
  d:=replace(d,'''discard'', -v_taken, v_taken,', '''discard'', -v_taken, v_taken, p_note,');
  execute d;
end;
$patch$;

create table public.stock_quantity_receipts (
  store_id uuid not null references public.stores(id),
  request_key text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(store_id,request_key)
);
alter table public.stock_quantity_receipts enable row level security;
create policy stock_quantity_receipts_read on public.stock_quantity_receipts for select
  using (store_id in (select id from stores where owner_id=auth.uid() and archived_at is null));
create policy stock_quantity_receipts_insert on public.stock_quantity_receipts for insert
  with check (store_id in (select id from stores where owner_id=auth.uid() and archived_at is null));
revoke all on public.stock_quantity_receipts from public,anon,authenticated;
grant select,insert on public.stock_quantity_receipts to margincook_rpc_executor;

create function public.change_stock_quantity(
  p_ingredient uuid, p_kind text, p_quantity numeric, p_expected_stock numeric,
  p_note text, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_store uuid;
  v_stock numeric;
  v_soon boolean;
  v_payload jsonb;
  v_receipt stock_quantity_receipts;
  v_result jsonb;
begin
  select store_id into v_store from ingredients where id=p_ingredient and active;
  if v_store is null then raise exception '식재료를 찾을 수 없습니다' using errcode='P0002'; end if;
  perform assert_my_store(v_store);
  if p_kind is null or p_kind not in ('discard','deduct') or p_quantity is null or not (p_quantity>0 and p_quantity<'Infinity'::numeric)
    or p_expected_stock is null or not (p_expected_stock>=0 and p_expected_stock<'Infinity'::numeric)
    or nullif(btrim(p_note),'') is null or nullif(btrim(p_idempotency_key),'') is null then
    raise exception '처리 수량·사유·확인한 재고를 확인해 주세요' using errcode='22000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_store::text || ':stock:' || p_idempotency_key,0));
  v_payload:=jsonb_build_array(p_ingredient,p_kind,p_quantity,p_expected_stock,btrim(p_note));
  select * into v_receipt from stock_quantity_receipts where store_id=v_store and request_key=p_idempotency_key;
  if found then
    if v_receipt.payload<>v_payload then raise exception '동일 요청 키의 처리 내용이 다릅니다' using errcode='22000'; end if;
    return v_receipt.result || jsonb_build_object('duplicate',true);
  end if;
  -- All other inventory RPCs acquire this same state lock before changing stock.
  select stock_total,soon_out into v_stock,v_soon from inventory_states where ingredient_id=p_ingredient for update;
  v_stock:=coalesce(v_stock,0);
  if v_stock<>p_expected_stock then
    raise exception '재고가 변경됐어요. 새 재고를 확인하고 다시 처리해 주세요.' using errcode='40001';
  end if;
  if p_quantity>v_stock then raise exception '현재 재고 이내의 수량을 입력해 주세요' using errcode='22000'; end if;
  if p_kind='discard' then
    v_result:=discard_stock_noted(p_ingredient,v_stock-p_quantity,null,btrim(p_note));
  else
    v_result:=e5_stock_adjusted(p_ingredient,v_stock-p_quantity,coalesce(v_soon,false),btrim(p_note));
  end if;
  insert into stock_quantity_receipts(store_id,request_key,payload,result) values(v_store,p_idempotency_key,v_payload,v_result);
  return v_result;
end;
$fn$;

grant create on schema public to margincook_rpc_executor;
alter function public.discard_stock_noted(uuid,numeric,date,text) owner to margincook_rpc_executor;
alter function public.change_stock_quantity(uuid,text,numeric,numeric,text,text) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.discard_stock_noted(uuid,numeric,date,text) from public,anon,authenticated;
revoke all on function public.change_stock_quantity(uuid,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.change_stock_quantity(uuid,text,numeric,numeric,text,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
