-- 0200: required purchase-option edit CAS; forward from 0199.
-- Preserve option values, history, facade metadata and existing unit checks.
-- Existing edits require a decimal string revision; create/delete retain their contracts.
begin;

alter table public.purchase_options
  add column edit_revision bigint not null default 1
  check (edit_revision > 0);
comment on column public.purchase_options.edit_revision is
  '구매 옵션 편집 판본. ingredient_detail은 문자열로 반환하고 수정은 expected_revision으로 되보낸다.';

create function public.bump_purchase_option_edit_revision() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $fn$
begin
  if row(new.id, new.store_id, new.ingredient_id, new.purchase_name,
         new.vendor_id, new.brand_id, new.volume, new.amount, new.url, new.hidden)
     is distinct from
     row(old.id, old.store_id, old.ingredient_id, old.purchase_name,
         old.vendor_id, old.brand_id, old.volume, old.amount, old.url, old.hidden) then
    -- bigint overflow fails the write; never reset or wrap a revision.
    new.edit_revision := old.edit_revision + 1;
  else
    new.edit_revision := old.edit_revision;
  end if;
  return new;
end;
$fn$;
revoke all on function public.bump_purchase_option_edit_revision() from public, anon, authenticated;
grant execute on function public.bump_purchase_option_edit_revision() to margincook_rpc_executor;
-- EXECUTE controls CREATE TRIGGER/direct invocation boundaries, not whether an
-- already installed trigger fires at runtime. Owner/service_role follow0194/0195.
create trigger purchase_option_edit_revision
  before update on public.purchase_options
  for each row execute function public.bump_purchase_option_edit_revision();

-- Explicitly close the direct app UPDATE route. Preserve INSERT/DELETE policies.
-- The definer facade must retain its own UPDATE grant, not an inherited app grant.
-- Only app-role direct UPDATE is closed; existing service_role privileges remain.
-- Do not change trigger ownership or revoke/add service_role privileges here.
grant update on public.purchase_options to margincook_rpc_executor;
revoke update on public.purchase_options from public, anon, authenticated;

do $patch$
declare
  d text;
  anchor text;
  replacement text;
  before_owner oid;
  before_acl aclitem[];
  before_config text[];
  before_definer boolean;
  app_role text;
begin
  select proowner, proacl, proconfig, prosecdef
    into before_owner, before_acl, before_config, before_definer
    from pg_proc where oid='public.save_purchase_option(uuid,jsonb)'::regprocedure;
  if not before_definer then
    raise exception 'U6 expects the existing least-privilege definer facade';
  end if;
  d := replace(pg_get_functiondef('public.save_purchase_option(uuid,jsonb)'::regprocedure), chr(13), '');

  -- U6_TARGET: save_purchase_option
  anchor := $anchor$declare v_id uuid := nullif(p_payload->>'id','')::uuid;$anchor$;
  replacement := $body$declare v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_option_before public.purchase_options%rowtype;
  v_expected_revision bigint;$body$;
  if (length(d)-length(replace(d,anchor,'')))/length(anchor) <> 1 then
    raise exception 'U6 declaration anchor must occur exactly once';
  end if;
  d := replace(d, anchor, replacement);

  anchor := $anchor$perform assert_my_store(p_store);$anchor$;
  replacement := $body$perform assert_my_store(p_store);
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception '구매 옵션 저장 정보가 올바르지 않습니다'
      using errcode='22000', detail='OPTION_PAYLOAD_INVALID';
  end if;
  if v_id is not null then
    -- Acquire the row lock before checking the baseline. After waiting for A,
    -- READ COMMITTED sees A's committed revision, not B's earlier snapshot.
    select * into v_option_before from public.purchase_options
      where id=v_id and store_id=p_store for update;
    if not found then
      raise exception '구매 옵션을 찾을 수 없습니다'
        using errcode='P0002', detail='OPTION_NOT_FOUND';
    end if;
    if jsonb_typeof(p_payload->'expected_revision') is distinct from 'string'
       or (p_payload->>'expected_revision') !~ '^[1-9][0-9]*$' then
      raise exception '최신 구매 옵션을 확인한 뒤 다시 저장해 주세요. 앱 업데이트가 필요할 수 있습니다.'
        using errcode='22000', detail='OPTION_BASE_REQUIRED';
    end if;
    begin
      v_expected_revision := (p_payload->>'expected_revision')::bigint;
    exception when numeric_value_out_of_range or invalid_text_representation then
      raise exception '구매 옵션 판본이 올바르지 않습니다'
        using errcode='22000', detail='OPTION_BASE_INVALID';
    end;
    if v_option_before.edit_revision <> v_expected_revision then
      raise exception '다른 곳에서 구매 옵션이 수정됐어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.'
        using errcode='45009', detail='REVISION_CONFLICT';
    end if;
  elsif p_payload ? 'expected_revision' then
    raise exception '새 구매 옵션에는 이전 판본을 보낼 수 없습니다'
      using errcode='22000', detail='OPTION_CREATE_BASE_UNEXPECTED';
  end if;
  -- Existing ingredient ownership/dimension checks and DML follow unchanged.$body$;
  if (length(d)-length(replace(d,anchor,'')))/length(anchor) <> 1 then
    raise exception 'U6 store assertion anchor must occur exactly once';
  end if;
  d := replace(d, anchor, replacement);

  -- The current UI does not edit brands. Omission must preserve that hidden value.
  anchor := $anchor$brand_id      = nullif(p_payload->>'brand_id','')::uuid,$anchor$;
  replacement := $body$brand_id      = case when p_payload ? 'brand_id'
        then nullif(p_payload->>'brand_id','')::uuid else brand_id end,$body$;
  if (length(d)-length(replace(d,anchor,'')))/length(anchor) <> 1 then
    raise exception 'U6 brand preservation anchor must occur exactly once';
  end if;
  d := replace(d, anchor, replacement);
  execute d;

  if exists(select 1 from pg_proc where oid='public.save_purchase_option(uuid,jsonb)'::regprocedure
    and (proowner is distinct from before_owner or proacl is distinct from before_acl
      or proconfig is distinct from before_config or prosecdef is distinct from before_definer)) then
    raise exception 'U6 changed save facade ownership/config/ACL';
  end if;

  select proowner, proacl, proconfig, prosecdef
    into before_owner, before_acl, before_config, before_definer
    from pg_proc where oid='public.ingredient_detail(uuid)'::regprocedure;
  d := replace(pg_get_functiondef('public.ingredient_detail(uuid)'::regprocedure), chr(13), '');
  -- U6_TARGET: ingredient_detail
  anchor := $anchor$'id', po.id, 'url', po.url, 'name', po.purchase_name,$anchor$;
  replacement := $body$'id', po.id, 'url', po.url, 'name', po.purchase_name,
               'edit_revision', po.edit_revision::text,$body$;
  if (length(d)-length(replace(d,anchor,'')))/length(anchor) <> 1 then
    raise exception 'U6 detail option anchor must occur exactly once';
  end if;
  execute replace(d, anchor, replacement);
  if exists(select 1 from pg_proc where oid='public.ingredient_detail(uuid)'::regprocedure
    and (proowner is distinct from before_owner or proacl is distinct from before_acl
      or proconfig is distinct from before_config or prosecdef is distinct from before_definer)) then
    raise exception 'U6 changed detail facade ownership/config/ACL';
  end if;

  -- D1: the facade must still have effective UPDATE after the app grant is revoked.
  if not has_table_privilege('margincook_rpc_executor','public.purchase_options','UPDATE') then
    raise exception 'U6 executor UPDATE privilege missing';
  end if;
  -- D2: fail closed on inherited or column-level bypasses for BOTH app roles.
  foreach app_role in array array['authenticated','anon'] loop
    if has_table_privilege(app_role,'public.purchase_options','UPDATE')
       or exists(select 1 from pg_attribute a
         where a.attrelid='public.purchase_options'::regclass and a.attnum>0 and not a.attisdropped
           and has_column_privilege(app_role,'public.purchase_options',a.attname,'UPDATE')) then
      raise exception 'U6 direct % UPDATE privilege remains', app_role;
    end if;
  end loop;
end;
$patch$;

-- No existing data/ledger deletion, no changes to delete_purchase_option.
-- Existing same-value updates keep edit_revision through the BEFORE trigger;
-- the existing history trigger still suppresses empty change events.
commit;
