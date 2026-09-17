-- 재료·구매 옵션 생성은 서버 반영 뒤 응답이 유실돼 같은 폼을 재전송해도
-- 새 행을 만들거나 중복 이름 오류에 갇히지 않고 기존 결과 ID를 반환한다.
begin;

do $patch$
declare
  d text;
  anchor text;
  replacement text;
  before_owner oid;
  before_acl aclitem[];
  before_config text[];
  before_definer boolean;
begin
  select proowner, proacl, proconfig, prosecdef
    into before_owner, before_acl, before_config, before_definer
    from pg_proc where oid = 'public.save_ingredient(uuid,jsonb)'::regprocedure;
  d := replace(pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure), chr(13), '');
  anchor := $anchor$  -- 같은 매장에 같은 이름이 둘이면 어느 쪽 재고인지 사장님이 구분할 수 없다.
  if exists ($anchor$;
  replacement := $body$  -- 같은 생성 내용을 다시 받으면 첫 응답이 유실된 것으로 안전하게 복구한다.
  -- lock_business_scope가 위에서 같은 매장의 동시 생성을 직렬화한다.
  if v_new then
    select i.id into v_id
      from public.ingredients i
     where i.store_id = p_store
       and i.active
       and lower(btrim(i.name)) = lower(v_name)
       and i.category_id is not distinct from nullif(p_payload->>'category_id','')::uuid
       and i.base_unit = (p_payload->>'base_unit')::base_unit
       and i.per_volume = (p_payload->>'per_volume')::numeric
       and i.safety_stock = coalesce((p_payload->>'safety_stock')::numeric, 0)
       and i.min_order_qty = coalesce((p_payload->>'min_order_qty')::numeric, 1)
       and i.default_vendor_id is not distinct from nullif(p_payload->>'default_vendor_id','')::uuid
       and i.memo is not distinct from nullif(p_payload->>'memo','')
       and i.purchase_price is not distinct from (p_payload->>'purchase_price')::numeric
       and i.stock_tracking = coalesce((p_payload->>'stock_tracking')::boolean, true)
     order by i.id
     limit 1;
    if found then
      return v_id;
    end if;
  end if;

  -- 같은 매장에 같은 이름이 둘이면 어느 쪽 재고인지 사장님이 구분할 수 없다.
  if exists ($body$;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception '0013 save_ingredient retry anchor must occur exactly once';
  end if;
  execute replace(d, anchor, replacement);
  if exists (
    select 1 from pg_proc where oid = 'public.save_ingredient(uuid,jsonb)'::regprocedure
      and (proowner is distinct from before_owner or proacl is distinct from before_acl
        or proconfig is distinct from before_config or prosecdef is distinct from before_definer)
  ) then
    raise exception '0013 changed save_ingredient ownership/config/ACL';
  end if;

  select proowner, proacl, proconfig, prosecdef
    into before_owner, before_acl, before_config, before_definer
    from pg_proc where oid = 'public.save_purchase_option(uuid,jsonb)'::regprocedure;
  d := replace(pg_get_functiondef('public.save_purchase_option(uuid,jsonb)'::regprocedure), chr(13), '');
  anchor := $anchor$  if v_id is null then
    insert into purchase_options ($anchor$;
  replacement := $body$  if v_id is null then
    -- 빈 테이블에서도 동시 요청을 직렬화해야 하므로 행 잠금 대신 매장별 자문 잠금을 쓴다.
    perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':purchase-option-create', 0));
    select po.id into v_id
      from public.purchase_options po
     where po.store_id = p_store
       and not po.hidden
       and po.ingredient_id = (p_payload->>'ingredient_id')::uuid
       and po.purchase_name = coalesce(nullif(btrim(p_payload->>'purchase_name'),''), '구매 옵션')
       and po.vendor_id is not distinct from nullif(p_payload->>'vendor_id','')::uuid
       and po.brand_id is not distinct from nullif(p_payload->>'brand_id','')::uuid
       and po.volume = (p_payload->>'volume')::numeric
       and po.amount = (p_payload->>'amount')::numeric
       and po.url is not distinct from nullif(p_payload->>'url','')
     order by po.id
     limit 1;
    if found then
      return v_id;
    end if;
  end if;

  if v_id is null then
    insert into purchase_options ($body$;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception '0013 save_purchase_option retry anchor must occur exactly once';
  end if;
  execute replace(d, anchor, replacement);
  if exists (
    select 1 from pg_proc where oid = 'public.save_purchase_option(uuid,jsonb)'::regprocedure
      and (proowner is distinct from before_owner or proacl is distinct from before_acl
        or proconfig is distinct from before_config or prosecdef is distinct from before_definer)
  ) then
    raise exception '0013 changed save_purchase_option ownership/config/ACL';
  end if;

end;
$patch$;

comment on function public.save_ingredient(uuid,jsonb) is
  '재료 생성·수정. 완전히 같은 생성 재시도는 기존 ID를 반환한다(0013).';
comment on function public.save_purchase_option(uuid,jsonb) is
  '구매 옵션 생성·수정. 완전히 같은 활성 옵션 생성 재시도는 매장 잠금 뒤 기존 ID를 반환한다(0013).';
commit;
