-- 0204: promote recipe v2 CAS/receipt contract; cumulative calculations preserved.
-- Source: f2-migration-unapplied-draft-v7-45009-20260910.sql; new migration requires fresh verification.
begin;

-- Snapshot only the migration-local schema ACL. No persistent product object.
create temporary table f2_v4_schema_acl_before on commit drop as
select oid as schema_oid,nspowner as owner_oid,nspacl as original_acl
  from pg_namespace where nspname='public';
do $schema_before$
begin
  if (select count(*) from pg_temp.f2_v4_schema_acl_before)<>1 then
    raise exception '0204: public schema baseline must exist exactly once';
  end if;
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE must be closed before migration';
  end if;
end $schema_before$;

alter table public.recipes add column edit_revision bigint not null default 1
  check (edit_revision > 0);

-- No FK to recipes or auth.users: receipt identity survives target/user deletion.
-- Whole-store approved physical purge still cascades through stores, like other data.
create table public.recipe_write_receipts (
  store_id uuid not null references public.stores(id) on delete cascade,
  request_id uuid not null,
  actor_id uuid not null,
  target_id uuid,
  result_id uuid not null,
  patch text not null check (patch in ('create','full','memo','active')),
  expected_revision bigint,
  request_fingerprint jsonb not null check (jsonb_typeof(request_fingerprint)='object'),
  created_at timestamptz not null default now(),
  primary key (store_id,request_id),
  check ((patch='create' and target_id is null and expected_revision is null)
      or (patch<>'create' and target_id is not null and expected_revision is not null
          and target_id=result_id and expected_revision>0))
);
alter table public.recipe_write_receipts enable row level security;
create policy recipe_write_receipts_read on public.recipe_write_receipts for select
  to margincook_rpc_executor using (
    exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
create policy recipe_write_receipts_insert on public.recipe_write_receipts for insert
  to margincook_rpc_executor with check (
    actor_id=auth.uid() and exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid() and s.archived_at is null));
revoke all on public.recipe_write_receipts from public,anon,authenticated,service_role;
grant select,insert on public.recipe_write_receipts to margincook_rpc_executor;
-- No executor UPDATE/DELETE policy or grant. SELECT intentionally is not actor-filtered:
-- an authorized new owner must encounter the old actor and receive 42501, not a new key.

-- Exact original row-producing expression, shared by apply and semantic comparison.
-- Monetary, tax, net-sales, propagation and audit formulas are not reimplemented.
create function public.recipe_edit_extra_rows_v2(p_extras jsonb)
returns table(material_id uuid,name text,qty numeric,amount_per_serving numeric)
language sql stable set search_path=public,pg_temp as $extra_rows$
    select
           nullif(x->>'material_id','')::uuid,
           coalesce(m.name, nullif(btrim(x->>'name'),''), '기타'),
           coalesce((x->>'qty')::numeric, 1),
           case when m.id is not null
                then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                else coalesce((x->>'amount')::numeric, 0) end
      from jsonb_array_elements(p_extras) x
      left join materials m on m.id = nullif(x->>'material_id','')::uuid
     where coalesce(
             case when m.id is not null then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                  else (x->>'amount')::numeric end, 0) <> 0;
$extra_rows$;

-- Preserve the deployed cumulative function, fail closed on source drift.
do $copy$
declare v_original text := replace(pg_get_functiondef('public.save_recipe(uuid,jsonb)'::regprocedure),chr(13),'');
        v_copy text; v_restored text;
        -- Normalize both constants at SQL runtime; Windows CRLF checkout is valid.
        -- The same values own forward replacement, occurrence guards and both inverses.
        v_oldpart constant text := replace($oldpart$    select p_store, v_id,
           nullif(x->>'material_id','')::uuid,
           coalesce(m.name, nullif(btrim(x->>'name'),''), '기타'),
           coalesce((x->>'qty')::numeric, 1),
           case when m.id is not null
                then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                else coalesce((x->>'amount')::numeric, 0) end
      from jsonb_array_elements(p_payload->'extras') x
      left join materials m on m.id = nullif(x->>'material_id','')::uuid
     where coalesce(
             case when m.id is not null then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                  else (x->>'amount')::numeric end, 0) <> 0;$oldpart$,chr(13),'');
        v_oldmonth constant text := 'store_local_month(p_store)';
        v_newmonth constant text := $month$(p_payload->>'_change_history_month')$month$;
        v_newpart constant text := replace($newpart$    select p_store, v_id, e.material_id, e.name, e.qty, e.amount_per_serving
      from public.recipe_edit_extra_rows_v2(p_payload->'extras') e;$newpart$,chr(13),'');
begin
  if md5(v_original) <> '8dbae37cd0c29c5fdfc89de62c20d8b2' then
    raise exception '0204 source drift: save_recipe(uuid,jsonb)';
  end if;
  if to_regprocedure('public.recipe_edit_apply_v2(uuid,jsonb)') is not null then
    raise exception '0204 helper already exists: recipe_edit_apply_v2';
  end if;
  v_copy := replace(replace(v_original,'FUNCTION public.save_recipe(', 'FUNCTION public.recipe_edit_apply_v2('), v_oldpart, v_newpart);
  if (length(v_original)-length(replace(v_original,'FUNCTION public.save_recipe(','')))/length('FUNCTION public.save_recipe(') <> 1
     or (length(v_copy)-length(replace(v_copy,'FUNCTION public.recipe_edit_apply_v2(','')))/length('FUNCTION public.recipe_edit_apply_v2(') <> 1
     or position('FUNCTION public.save_recipe(' in v_copy)>0 then
    raise exception '0204 helper name replacement failure: recipe_edit_apply_v2';
  end if;

  if (length(v_original)-length(replace(v_original,v_oldpart,'')))/length(v_oldpart) <> 1 then
    raise exception '0204 independent extras source anchor failure';
  end if;
  if (length(v_copy)-length(replace(v_copy,v_newpart,'')))/length(v_newpart) <> 1
     or position(v_oldpart in v_copy)>0 then
    raise exception '0204 independent extras replacement failure';
  end if;

  if (length(v_original)-length(replace(v_original,v_oldmonth,'')))/length(v_oldmonth) <> 1 then
    raise exception '0204 history month source anchor failure';
  end if;
  -- The facade resolves the server month; only the private audit calculation consumes it.
  v_copy := replace(v_copy,v_oldmonth,v_newmonth);
  v_restored := replace(replace(replace(v_copy,v_newmonth,v_oldmonth),'FUNCTION public.recipe_edit_apply_v2(', 'FUNCTION public.save_recipe('), v_newpart, v_oldpart);
  if v_restored <> v_original then raise exception '0204 inverse body mismatch: recipe_edit_apply_v2'; end if;
  execute v_copy;
  v_copy := replace(pg_get_functiondef('public.recipe_edit_apply_v2(uuid,jsonb)'::regprocedure),chr(13),'');
  v_restored := replace(replace(replace(v_copy,v_newmonth,v_oldmonth),'FUNCTION public.recipe_edit_apply_v2(', 'FUNCTION public.save_recipe('), v_newpart, v_oldpart);
  if v_restored <> v_original then raise exception '0204 stored helper body mismatch: recipe_edit_apply_v2'; end if;
end $copy$;
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_edit_apply_v2(uuid,jsonb) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
do $owner_create_closed$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE remained after owner transfer';
  end if;
end $owner_create_closed$;
revoke all on function public.recipe_edit_apply_v2(uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.recipe_edit_apply_v2(uuid,jsonb) to margincook_rpc_executor;

-- Preserve the deployed cumulative function, fail closed on source drift.
do $copy$
declare v_original text := replace(pg_get_functiondef('public.save_material(uuid,jsonb)'::regprocedure),chr(13),'');
        v_copy text; v_restored text;
begin
  if md5(v_original) <> 'ff6a8488a01bbc044cbd9766989ea2a7' then
    raise exception '0204 source drift: save_material(uuid,jsonb)';
  end if;
  if to_regprocedure('public.recipe_edit_material_apply_v2(uuid,jsonb)') is not null then
    raise exception '0204 helper already exists: recipe_edit_material_apply_v2';
  end if;
  v_copy := replace(v_original,'FUNCTION public.save_material(', 'FUNCTION public.recipe_edit_material_apply_v2(');
  if (length(v_original)-length(replace(v_original,'FUNCTION public.save_material(','')))/length('FUNCTION public.save_material(') <> 1
     or (length(v_copy)-length(replace(v_copy,'FUNCTION public.recipe_edit_material_apply_v2(','')))/length('FUNCTION public.recipe_edit_material_apply_v2(') <> 1
     or position('FUNCTION public.save_material(' in v_copy)>0 then
    raise exception '0204 helper name replacement failure: recipe_edit_material_apply_v2';
  end if;

  v_restored := replace(v_copy,'FUNCTION public.recipe_edit_material_apply_v2(', 'FUNCTION public.save_material(');
  if v_restored <> v_original then raise exception '0204 inverse body mismatch: recipe_edit_material_apply_v2'; end if;
  execute v_copy;
  v_copy := replace(pg_get_functiondef('public.recipe_edit_material_apply_v2(uuid,jsonb)'::regprocedure),chr(13),'');
  v_restored := replace(v_copy,'FUNCTION public.recipe_edit_material_apply_v2(', 'FUNCTION public.save_material(');
  if v_restored <> v_original then raise exception '0204 stored helper body mismatch: recipe_edit_material_apply_v2'; end if;
end $copy$;
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_edit_material_apply_v2(uuid,jsonb) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
do $owner_create_closed$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE remained after owner transfer';
  end if;
end $owner_create_closed$;
revoke all on function public.recipe_edit_material_apply_v2(uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.recipe_edit_material_apply_v2(uuid,jsonb) to margincook_rpc_executor;

-- Preserve the deployed cumulative function, fail closed on source drift.
do $copy$
declare v_original text := replace(pg_get_functiondef('public.delete_category(uuid)'::regprocedure),chr(13),'');
        v_copy text; v_restored text;
begin
  if md5(v_original) <> '1dcd615711c70d847a62f0e1fc87e1b2' then
    raise exception '0204 source drift: delete_category(uuid)';
  end if;
  if to_regprocedure('public.recipe_edit_category_delete_v2(uuid)') is not null then
    raise exception '0204 helper already exists: recipe_edit_category_delete_v2';
  end if;
  v_copy := replace(v_original,'FUNCTION public.delete_category(', 'FUNCTION public.recipe_edit_category_delete_v2(');
  if (length(v_original)-length(replace(v_original,'FUNCTION public.delete_category(','')))/length('FUNCTION public.delete_category(') <> 1
     or (length(v_copy)-length(replace(v_copy,'FUNCTION public.recipe_edit_category_delete_v2(','')))/length('FUNCTION public.recipe_edit_category_delete_v2(') <> 1
     or position('FUNCTION public.delete_category(' in v_copy)>0 then
    raise exception '0204 helper name replacement failure: recipe_edit_category_delete_v2';
  end if;

  v_restored := replace(v_copy,'FUNCTION public.recipe_edit_category_delete_v2(', 'FUNCTION public.delete_category(');
  if v_restored <> v_original then raise exception '0204 inverse body mismatch: recipe_edit_category_delete_v2'; end if;
  execute v_copy;
  v_copy := replace(pg_get_functiondef('public.recipe_edit_category_delete_v2(uuid)'::regprocedure),chr(13),'');
  v_restored := replace(v_copy,'FUNCTION public.recipe_edit_category_delete_v2(', 'FUNCTION public.delete_category(');
  if v_restored <> v_original then raise exception '0204 stored helper body mismatch: recipe_edit_category_delete_v2'; end if;
end $copy$;
grant create on schema public to margincook_rpc_executor;
alter function public.recipe_edit_category_delete_v2(uuid) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
do $owner_create_closed$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE remained after owner transfer';
  end if;
end $owner_create_closed$;
revoke all on function public.recipe_edit_category_delete_v2(uuid) from public, anon, authenticated, service_role;
grant execute on function public.recipe_edit_category_delete_v2(uuid) to margincook_rpc_executor;

-- Compare editable content only; linked name/cost and tax/profit caches are derived.
-- p_body=NULL reads stored input; otherwise model legacy normalization of a full body.
-- No writes or calls to e3/recompute in this function.
create function public.recipe_edit_shape_v2(p_recipe uuid,p_body jsonb default null)
returns jsonb language plpgsql stable set search_path=public,pg_temp as $shape$
declare r public.recipes; n public.recipes; h jsonb; ls jsonb; es jsonb;
begin
  select * into strict r from public.recipes where id=p_recipe;
  n := r;
  if p_body is not null then
    n := jsonb_populate_record(r,jsonb_build_object(
      'name',btrim(p_body->>'name'), 'price',(p_body->>'price')::numeric,
      'base_servings',(p_body->>'base_servings')::int,
      'target_profit_rate',coalesce((p_body->>'target_profit_rate')::numeric,r.target_profit_rate),
      'avg_monthly_sales',coalesce(nullif(p_body->>'avg_monthly_sales','')::numeric,r.avg_monthly_sales),
      'memo',case when p_body ? 'memo' then nullif(p_body->>'memo','') else r.memo end,
      'category_id',case when p_body ? 'category_id' then nullif(p_body->>'category_id','')::uuid else r.category_id end,
      'active',case when p_body ? 'active' then (p_body->>'active')::boolean else r.active end));
  end if;
  h := jsonb_build_array(n.name,n.price,n.base_servings,n.target_profit_rate,n.category_id,n.memo,n.active,n.avg_monthly_sales);
  if p_body ? 'lines' then
    select coalesce(jsonb_agg(v order by v),'[]'::jsonb) into ls from (
      select jsonb_build_array(nullif(x->>'ingredient_id','')::uuid,
        nullif(x->>'sub_recipe_id','')::uuid,(x->>'input_qty')::numeric) v
      from jsonb_array_elements(p_body->'lines') x where coalesce((x->>'input_qty')::numeric,0)>0) q;
  else
    select coalesce(jsonb_agg(v order by v),'[]'::jsonb) into ls from (
      select jsonb_build_array(ingredient_id,sub_recipe_id,input_qty) v
      from public.recipe_lines where recipe_id=p_recipe) q;
  end if;
  if p_body ? 'extras' then
    select coalesce(jsonb_agg(v order by v),'[]'::jsonb) into es from (
      select case when material_id is not null then jsonb_build_array(material_id,qty)
                  else jsonb_build_array(null,qty,name,amount_per_serving) end v
      from public.recipe_edit_extra_rows_v2(p_body->'extras')) q;
  else
    select coalesce(jsonb_agg(v order by v),'[]'::jsonb) into es from (
      select case when material_id is not null then jsonb_build_array(material_id,qty)
                  else jsonb_build_array(null,qty,name,amount_per_serving) end v
      from public.recipe_extra_costs where recipe_id=p_recipe) q;
  end if;
  return jsonb_build_object('header',h,'lines',ls,'extras',es);
end $shape$;

-- Catch header edits, notably inactive category ON DELETE SET NULL.
-- Wrapper assigns the one aggregate revision for children-only edits.
-- This is integrity accounting, not a GUC or substitute for DML authorization.
create function public.recipe_edit_revision_header_v2()
returns trigger language plpgsql set search_path=public,pg_temp as $revision$
begin
  if row(new.name,new.price,new.base_servings,new.target_profit_rate,new.category_id,new.memo,new.active,new.avg_monthly_sales)
     is distinct from row(old.name,old.price,old.base_servings,old.target_profit_rate,old.category_id,old.memo,old.active,old.avg_monthly_sales) then
    new.edit_revision := greatest(new.edit_revision,old.edit_revision+1);
  end if;
  return new;
end $revision$;
create trigger recipe_edit_revision_header_v2 before update on public.recipes
  for each row execute function public.recipe_edit_revision_header_v2();

create or replace function public.save_recipe(p_store uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $facade$
declare
  v_key uuid; v_target uuid; v_patch text; v_expected bigint; v_result uuid;
  v_actor uuid := auth.uid(); v_receipt public.recipe_write_receipts;
  v_before public.recipes; v_body jsonb; v_allowed text[]; v_day date;
begin
  perform public.assert_my_store(p_store);
  if v_actor is null then raise exception '인증이 필요합니다' using errcode='42501'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload->'contract_version' is distinct from '2'::jsonb
     or jsonb_typeof(p_payload->'request_id') is distinct from 'string'
     or (p_payload->>'request_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'v2 요청 판본과 요청 ID가 필요합니다' using errcode='22000',detail='RECIPE_WRITE_CONTRACT_REQUIRED';
  end if;
  v_key := (p_payload->>'request_id')::uuid;
  perform public.lock_business_scope(p_store);
  -- Re-check ownership under the store lock before consuming a receipt.
  perform public.assert_my_store(p_store);
  select * into v_receipt from public.recipe_write_receipts where store_id=p_store and request_id=v_key;
  if found then
    if v_receipt.actor_id is distinct from v_actor then
      raise exception '다른 작성자의 요청입니다' using errcode='42501',detail='RECIPE_REQUEST_ACTOR_MISMATCH';
    end if;
    -- JSONB equality preserves missing-vs-null keys and array order. It intentionally
    -- ignores whitespace/object-key order/numeric lexical representation, not key presence.
    if v_receipt.request_fingerprint is distinct from p_payload then
      raise exception '요청 ID가 다른 내용에 사용됐습니다' using errcode='22000',detail='KEY_REUSE_MISMATCH';
    end if;
    perform 1 from public.recipes where id=v_receipt.result_id and store_id=p_store for no key update;
    if not found then raise exception '메뉴를 찾을 수 없습니다' using errcode='P0002'; end if;
    -- active=false is valid here. No product/audit/revision/receipt writes, even if stale.
    return v_receipt.result_id;
  end if;

  v_patch := p_payload->>'patch';
  if v_patch is null or v_patch not in ('create','full','memo','active') then
    raise exception 'patch가 올바르지 않습니다' using errcode='22000';
  end if;
  if v_patch='create' then
    if p_payload ? 'id' or p_payload ? 'expected_revision' or p_payload ? 'active' then
      raise exception '생성에는 대상·기준판본·상태를 지정할 수 없습니다' using errcode='22000';
    end if;
  else
    if jsonb_typeof(p_payload->'id') is distinct from 'string'
       or (p_payload->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(p_payload->'expected_revision') is distinct from 'string'
       or (p_payload->>'expected_revision') !~ '^[1-9][0-9]*$' then
      raise exception '대상과 기준판본이 필요합니다' using errcode='22000',detail='BASE_REQUIRED';
    end if;
    v_target := (p_payload->>'id')::uuid;
    begin v_expected := (p_payload->>'expected_revision')::bigint;
    exception when numeric_value_out_of_range then raise exception '기준판본 범위가 올바르지 않습니다' using errcode='22000'; end;
  end if;
  v_allowed := array['contract_version','request_id','patch','id','expected_revision'];
  if v_patch in ('create','full') then
    v_allowed := v_allowed || array['name','price','base_servings','target_profit_rate','category_id','memo','active','lines','extras','occurred_at','avg_monthly_sales'];
  else v_allowed := array_append(v_allowed,v_patch); end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(v_allowed))) then
    raise exception '이 patch에 허용되지 않은 필드입니다' using errcode='22000';
  end if;
  if v_patch in ('memo','active') and not (p_payload ? v_patch) then
    raise exception '수정할 값이 필요합니다' using errcode='22000';
  end if;
  if p_payload ? 'active' and jsonb_typeof(p_payload->'active') is distinct from 'boolean' then
    raise exception 'active는 boolean이어야 합니다' using errcode='22000';
  end if;
  if p_payload ? 'memo' and jsonb_typeof(p_payload->'memo') not in ('string','null') then
    raise exception 'memo 형식이 올바르지 않습니다' using errcode='22000';
  end if;
  if (p_payload ? 'lines' and jsonb_typeof(p_payload->'lines') is distinct from 'array')
     or (p_payload ? 'extras' and jsonb_typeof(p_payload->'extras') is distinct from 'array') then
    raise exception '구성은 배열이어야 합니다' using errcode='22000';
  end if;

  if v_patch in ('create','full') and (
      jsonb_typeof(p_payload->'name') is distinct from 'string'
      or jsonb_typeof(p_payload->'price') is distinct from 'number'
      or jsonb_typeof(p_payload->'base_servings') is distinct from 'number'
      or jsonb_typeof(p_payload->'target_profit_rate') is distinct from 'number') then
    raise exception '레시피 필수 입력 형식이 올바르지 않습니다' using errcode='22000';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'lines','[]')) x where x ? 'sub_recipe_id') then
    raise exception '반제품은 아직 쓸 수 없어요' using errcode='22000';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'lines','[]')) x
    where jsonb_typeof(x) is distinct from 'object'
      or jsonb_typeof(x->'ingredient_id') is distinct from 'string'
      or jsonb_typeof(x->'input_qty') is distinct from 'number'
      or (x->>'input_qty')::numeric<0
      or exists(select 1 from jsonb_object_keys(x) k where k not in ('ingredient_id','input_qty'))) then
    raise exception '재료 입력 형식이 올바르지 않습니다' using errcode='22000';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'extras','[]')) x
    where jsonb_typeof(x) is distinct from 'object'
      or (x ? 'qty' and (jsonb_typeof(x->'qty') is distinct from 'number' or (x->>'qty')::numeric<0))
      or (x ? 'amount' and (jsonb_typeof(x->'amount') is distinct from 'number' or (x->>'amount')::numeric<0))
      or exists(select 1 from jsonb_object_keys(x) k where k not in ('material_id','name','qty','amount'))) then
    raise exception '부자재 입력 형식이 올바르지 않습니다' using errcode='22000';
  end if;

  -- Stable lock hierarchy. Broad category/material row locks are a first-draft
  -- correctness choice; narrowing requires new-reference race coverage.
  perform 1 from public.categories where store_id=p_store order by id for share;
  perform 1 from public.materials where store_id=p_store order by id for share;
  if v_patch<>'create' then
    select * into v_before from public.recipes where id=v_target and store_id=p_store for no key update;
    if not found then raise exception '메뉴를 찾을 수 없습니다' using errcode='P0002'; end if;
    if v_expected<>v_before.edit_revision then
      raise exception '다른 곳에서 메뉴가 수정됐어요. 최신 내용을 확인해 주세요.' using errcode='45009',detail='REVISION_CONFLICT';
    end if;
  end if;
  v_body := p_payload - array['contract_version','request_id','patch','expected_revision'];
  if v_patch in ('memo','active') then
    v_body := jsonb_build_object('id',v_target,'name',v_before.name,'price',v_before.price,
       'base_servings',v_before.base_servings,'target_profit_rate',v_before.target_profit_rate)
       || jsonb_build_object(v_patch,p_payload->v_patch);
  end if;
  -- Reproduce existing validation before skipping the legacy body for semantic no-op.
  -- Numeric/reference/array negative cases must reach their original validation class.
  if nullif(btrim(v_body->>'name'),'') is null then raise exception '메뉴 이름을 입력해 주세요' using errcode='22000'; end if;
  if coalesce((v_body->>'base_servings')::int,1)<=0 then raise exception '기준 인분은 1 이상이어야 합니다' using errcode='22000'; end if;
  if coalesce((v_body->>'price')::numeric,-1)<0 then raise exception '판매가는 0 이상이어야 합니다' using errcode='22000'; end if;
  -- Original body defaults absent base_servings to 1, so comparison must do likewise.
  v_body := v_body || jsonb_build_object('base_servings',coalesce((v_body->>'base_servings')::int,1));
  if exists(select 1 from public.recipes where store_id=p_store and active
       and lower(btrim(name))=lower(btrim(v_body->>'name')) and (v_target is null or id<>v_target)) then
    raise exception '이미 같은 이름의 메뉴가 있어요' using errcode='23505';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_body->'lines','[]')) x
       where coalesce((x->>'input_qty')::numeric,0)>0 and nullif(x->>'sub_recipe_id','') is not null) then
    raise exception '반제품은 아직 쓸 수 없어요' using errcode='22000';
  end if;
  v_day := coalesce(nullif(v_body->>'occurred_at','')::date,public.store_local_date(p_store));
  if v_day>public.store_local_date(p_store) then
    raise exception '미래 날짜로는 기록할 수 없습니다 (요청 %, 오늘 %)',v_day,public.store_local_date(p_store);
  end if;

  if v_target is not null and public.recipe_edit_shape_v2(v_target)=public.recipe_edit_shape_v2(v_target,v_body) then
    v_result := v_target; -- no-op: no UPDATE, child UUID churn, e3/profit or audit write.
  else
    -- Internal-only key: rejected by the public allowlist and excluded from shape/receipt.
    -- The preserved helper uses this month for fixed_cost_rate in change history.
    v_result := public.recipe_edit_apply_v2(p_store,v_body ||
      jsonb_build_object('_change_history_month',public.store_local_month(p_store)));
    if v_target is not null then
      -- Header trigger may already have assigned this value. Children-only change
      -- reaches the same value; never increment once per child or per changed field.
      update public.recipes set edit_revision=greatest(edit_revision,v_before.edit_revision+1) where id=v_result and store_id=p_store;
    end if;
  end if;
  insert into public.recipe_write_receipts(store_id,request_id,actor_id,target_id,result_id,patch,expected_revision,request_fingerprint)
    values(p_store,v_key,v_actor,v_target,v_result,v_patch,v_expected,p_payload);
  -- No COMMIT/catch of application failures: product/audit/revision/receipt are atomic.
  return v_result;
end $facade$;
grant create on schema public to margincook_rpc_executor;
alter function public.save_recipe(uuid,jsonb) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
do $owner_create_closed$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE remained after owner transfer';
  end if;
end $owner_create_closed$;
revoke all on function public.save_recipe(uuid,jsonb) from public,anon;
grant execute on function public.save_recipe(uuid,jsonb) to authenticated,service_role,margincook_rpc_executor;

create or replace function public.save_material(p_store uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $material$
declare v_id uuid := nullif(p_payload->>'id','')::uuid;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  perform 1 from public.categories where store_id=p_store order by id for share;
  perform 1 from public.materials where store_id=p_store order by id for update;
  perform 1 from public.recipes r where r.store_id=p_store and exists(
    select 1 from public.recipe_extra_costs ec where ec.recipe_id=r.id and ec.material_id=v_id)
    order by r.id for no key update;
  return public.recipe_edit_material_apply_v2(p_store,p_payload);
end $material$;
grant create on schema public to margincook_rpc_executor;
alter function public.save_material(uuid,jsonb) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
do $owner_create_closed$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE remained after owner transfer';
  end if;
end $owner_create_closed$;

create or replace function public.delete_category(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $category$
declare v_store uuid;
begin
  select store_id into v_store from public.categories where id=p_id;
  if not found then return; end if;
  perform public.assert_my_store(v_store);
  perform public.lock_business_scope(v_store);
  perform 1 from public.categories where store_id=v_store order by id for update;
  perform 1 from public.materials where store_id=v_store order by id for update;
  perform 1 from public.recipes where store_id=v_store and category_id=p_id order by id for no key update;
  perform public.recipe_edit_category_delete_v2(p_id);
  -- Original active-reference rejection remains. Inactive FK SET NULL fires revision trigger.
end $category$;
grant create on schema public to margincook_rpc_executor;
alter function public.delete_category(uuid) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
do $owner_create_closed$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE remained after owner transfer';
  end if;
end $owner_create_closed$;

-- Do not leave the former unversioned public writer as an alternate mutation path.
create or replace function public.deactivate_recipe(p_recipe uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $old$
begin raise exception '판본을 포함한 레시피 상태 저장이 필요합니다' using errcode='22000',detail='RECIPE_WRITE_CONTRACT_REQUIRED'; end $old$;
revoke all on function public.deactivate_recipe(uuid) from public,anon,authenticated,service_role;

-- Grant executor before removing inherited application rights, all in this transaction.
grant select,insert,update,delete on public.recipes,public.recipe_lines,public.recipe_extra_costs,public.materials,public.categories
  to margincook_rpc_executor;
revoke insert,update,delete on public.recipes,public.recipe_lines,public.recipe_extra_costs,public.materials,public.categories
  from public,anon,authenticated;
do $column_acl$
declare r record; cols text;
begin
  for r in select unnest(array['recipes','recipe_lines','recipe_extra_costs','materials','categories']) name loop
    select string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute
      where attrelid=format('public.%I',r.name)::regclass and attnum>0 and not attisdropped;
    execute format('revoke insert (%s), update (%s) on public.%I from public,anon,authenticated',cols,cols,r.name);
  end loop;
end $column_acl$;
-- DELETE has no column-level variant. Existing RLS policies/memberships stay intact.

grant create on schema public to margincook_rpc_executor;
do $helper_acl$
declare f text;
begin
  foreach f in array array['recipe_edit_extra_rows_v2(jsonb)','recipe_edit_shape_v2(uuid,jsonb)',
     'recipe_edit_revision_header_v2()'] loop
    execute format('alter function public.%s owner to margincook_rpc_executor',f);
    execute format('revoke all on function public.%s from public,anon,authenticated,service_role',f);
    execute format('grant execute on function public.%s to margincook_rpc_executor',f);
  end loop;
end $helper_acl$;
revoke create on schema public from margincook_rpc_executor;
do $owner_create_closed$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: executor schema CREATE remained after owner transfer';
  end if;
end $owner_create_closed$;

-- Effective privileges, not just a GRANT text check. Existing PUBLIC RLS is untouched.
do $acl_check$
declare t text; r text; a record; f text; privilege_name text;
begin
  foreach t in array array['recipes','recipe_lines','recipe_extra_costs','materials','categories'] loop
    foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('margincook_rpc_executor','public.'||t,privilege_name) then
        raise exception 'Missing executor privilege: %.%',t,privilege_name;
      end if;
    end loop;
    foreach r in array array['authenticated','anon'] loop
      if has_table_privilege(r,'public.'||t,'INSERT,UPDATE,DELETE') then
        raise exception 'Residual application table DML: %.%',r,t;
      end if;
      for a in select attname from pg_attribute where attrelid=('public.'||t)::regclass and attnum>0 and not attisdropped loop
        if has_column_privilege(r,'public.'||t,a.attname,'INSERT,UPDATE') then
          raise exception 'Residual application column DML: %.%.%',r,t,a.attname;
        end if;
      end loop;
    end loop;
  end loop;
  foreach f in array array['recipe_edit_extra_rows_v2(jsonb)','recipe_edit_shape_v2(uuid,jsonb)',
    'recipe_edit_revision_header_v2()','recipe_edit_apply_v2(uuid,jsonb)',
    'recipe_edit_material_apply_v2(uuid,jsonb)','recipe_edit_category_delete_v2(uuid)'] loop
    if has_function_privilege('authenticated','public.'||f,'EXECUTE')
       or has_function_privilege('anon','public.'||f,'EXECUTE')
       or has_function_privilege('service_role','public.'||f,'EXECUTE') then
      raise exception 'Internal recipe helper exposed: %',f;
    end if;
  end loop;
  if not has_function_privilege('authenticated','public.save_recipe(uuid,jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.save_recipe(uuid,jsonb)','EXECUTE') then
    raise exception 'Missing existing save_recipe facade access';
  end if;
  if has_function_privilege('anon','public.save_recipe(uuid,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.deactivate_recipe(uuid)','EXECUTE') then
    raise exception 'Unexpected anonymous or legacy recipe writer access';
  end if;
  foreach r in array array['authenticated','anon','service_role'] loop
    foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'] loop
      if has_table_privilege(r,'public.recipe_write_receipts',privilege_name) then
        raise exception 'Unexpected direct receipt access: %.%',r,privilege_name;
      end if;
    end loop;
  end loop;
  foreach privilege_name in array array['SELECT','INSERT'] loop
    if not has_table_privilege('margincook_rpc_executor','public.recipe_write_receipts',privilege_name) then
      raise exception 'Missing executor receipt privilege: %',privilege_name;
    end if;
  end loop;
  foreach privilege_name in array array['UPDATE','DELETE','TRUNCATE'] loop
    if has_table_privilege('margincook_rpc_executor','public.recipe_write_receipts',privilege_name) then
      raise exception 'Mutable executor receipt privilege: %',privilege_name;
    end if;
  end loop;
end $acl_check$;

-- Independent anchor; leave both 0198 contiguous anchor strings intact.
do $detail$
declare d text := replace(pg_get_functiondef('public.recipe_detail(uuid)'::regprocedure),chr(13),'');
  a text := $a$'id', r.id, 'name', r.name,$a$;
  b text := $b$'id', r.id, 'edit_revision', r.edit_revision::text, 'name', r.name,$b$;
  actual text; meta jsonb;
begin
  if position('''edit_revision''' in d)>0 then raise exception 'recipe revision already present'; end if;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'recipe revision anchor must occur exactly once'; end if;
  select jsonb_build_array(proowner,proacl,prosecdef,proconfig,provolatile) into meta from pg_proc where oid='public.recipe_detail(uuid)'::regprocedure;
  execute replace(d,a,b);
  actual := replace(pg_get_functiondef('public.recipe_detail(uuid)'::regprocedure),chr(13),'');
  if replace(actual,b,a)<>d or meta is distinct from (
    select jsonb_build_array(proowner,proacl,prosecdef,proconfig,provolatile) from pg_proc where oid='public.recipe_detail(uuid)'::regprocedure) then
    raise exception 'recipe revision detail preservation failed';
  end if;
end $detail$;

-- RELEASE BLOCKERS: exact facade/ACL postconditions, static/DB contract review and
-- all acceptance/upgrade/seed/type/verify work in the companion spec. No claim of green.

grant create on schema public to margincook_rpc_executor;

-- Additive list response; preserve owner/config/ACL, fail rather than drop dependencies.
do $list$
declare d text:=replace(pg_get_functiondef('public.recipe_list(uuid)'::regprocedure),chr(13),'');
  signature text:='blocked_by text)'; tail text:='else 0 end,b.unknown_lines,b.blocked';
  owner_name name; grants record; acl aclitem[]; old_config text[];
begin
  if (length(d)-length(replace(d,signature,'')))/length(signature)<>1
     or (length(d)-length(replace(d,tail,'')))/length(tail)<>1 then
    raise exception '0204 list revision anchors must occur exactly once';
  end if;
  select pg_get_userbyid(proowner),proacl,proconfig into owner_name,acl,old_config
    from pg_proc where oid='public.recipe_list(uuid)'::regprocedure;
  d:=replace(replace(d,signature,'blocked_by text, edit_revision text)'),tail,tail||',b.edit_revision::text');
  drop function public.recipe_list(uuid);
  execute d;
  execute format('alter function public.recipe_list(uuid) owner to %I',owner_name);
  revoke all on function public.recipe_list(uuid) from public,anon,authenticated,service_role,margincook_rpc_executor;
  for grants in select * from aclexplode(acl) loop
    if grants.privilege_type<>'EXECUTE' then raise exception 'Unexpected list privilege'; end if;
    execute format('grant execute on function public.recipe_list(uuid) to %s%s',
      case when grants.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(grants.grantee)) end,
      case when grants.is_grantable then ' with grant option' else '' end);
  end loop;
  if old_config is distinct from (select proconfig from pg_proc where oid='public.recipe_list(uuid)'::regprocedure) then
    raise exception '0204 list config drift';
  end if;
end $list$;
revoke create on schema public from margincook_rpc_executor;

-- Same transaction: owner-transfer CREATE is not a lasting executor capability.
do $schema_restored$
begin
  if has_schema_privilege('margincook_rpc_executor','public','CREATE') then
    raise exception '0204: effective executor schema CREATE must be false at commit';
  end if;
  if not exists (
    select 1 from pg_namespace n join pg_temp.f2_v4_schema_acl_before b on b.schema_oid=n.oid
    where n.nspname='public' and n.nspowner=b.owner_oid
      and n.nspacl is not distinct from b.original_acl
  ) then
    raise exception '0204: public schema owner or ACL changed';
  end if;
end $schema_restored$;
commit;
