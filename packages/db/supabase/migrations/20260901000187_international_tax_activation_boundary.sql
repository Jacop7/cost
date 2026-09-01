-- 0187 · INTL-1F 국제 세금 활성 경계
--
-- 0180에서 만든 미래 프로필의 effective_from은 실제 앱 출시일까지 시간이 지나면 과거가 된다.
-- 프로필 유효기간과 제품 활성 경계를 분리해, 활성일 전 과거 판매 정정이 국제 snapshot을
-- 새로 만들지 못하게 한다. 실제 경계 행은 capability를 여는 마지막 migration이 만든다.

begin;

create table public.international_tax_activation_boundaries (
  store_id             uuid primary key references public.stores(id) on delete cascade,
  activation_date      date not null,
  minimum_app_version  text not null check (
    minimum_app_version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  activated_at         timestamptz not null default clock_timestamp(),
  reason               text not null check (reason in ('release_cutover','profile_created_after_cutover'))
);
alter table public.international_tax_activation_boundaries enable row level security;
revoke all on table public.international_tax_activation_boundaries
  from public,anon,authenticated,service_role,margincook_rpc_executor;

create or replace function public.guard_international_tax_activation_boundary()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_store uuid:=case when tg_op='DELETE' then old.store_id else new.store_id end;
begin
  if tg_op='DELETE'
     and current_setting('margincook.store_purge_id',true)=v_store::text
     and exists(select 1 from public.store_lifecycle_events e
       where e.store_id=v_store and e.event_type='physical_purge'
         and coalesce(btrim(e.approval_reference),'')<>''
         and coalesce(btrim(e.backup_reference),'')<>'') then
    return old;
  end if;
  raise exception '국제 세금 활성 경계는 바꿀 수 없어요'
    using errcode='42501',detail='INTERNATIONAL_TAX_ACTIVATION_IMMUTABLE';
end
$$;
create trigger international_tax_activation_boundaries_immutable_row
before update or delete on public.international_tax_activation_boundaries
for each row execute function public.guard_international_tax_activation_boundary();
create trigger international_tax_activation_boundaries_immutable_truncate
before truncate on public.international_tax_activation_boundaries
for each statement execute function public.guard_international_tax_activation_boundary();

-- 0181 몸통은 그대로 보존하고, 제품 활성 경계를 검사하는 한 문을 앞에 둔다.
alter function public.apply_international_tax_for_sales_item(uuid,boolean)
  rename to apply_international_tax_for_sales_item_body;

create or replace function public.apply_international_tax_for_sales_item(
  p_sales_item uuid,p_force boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cap jsonb:=public.app_capabilities();
  v_test boolean:=session_user='postgres'
    and current_setting('margincook.international_tax_force',true) is not distinct from 'owner_test'
    and current_setting('margincook.international_tax_activation_test',true) is not distinct from 'on';
  v_store uuid;
  v_date date;
  v_boundary date;
begin
  -- 0181·기존 시험의 명시적 소유자 force는 활성 경계 시험을 요청하지 않은 한 그대로 둔다.
  if p_force and not v_test then
    return public.apply_international_tax_for_sales_item_body(p_sales_item,true);
  end if;
  if not (v_cap#>>'{international_tax,write_enabled}')::boolean and not v_test then
    return jsonb_build_object('enabled',false,'changed',false,'lines','[]'::jsonb);
  end if;
  select i.store_id,d.sale_date into v_store,v_date
    from public.daily_sales_items i join public.daily_sales d on d.id=i.daily_sales_id
   where i.id=p_sales_item;
  if v_store is null then
    raise exception '국제 세금 계산의 판매행을 찾을 수 없어요'
      using errcode='22000',detail='SALES_ITEM_NOT_FOUND';
  end if;
  select activation_date into v_boundary
    from public.international_tax_activation_boundaries where store_id=v_store;
  if v_boundary is null then
    raise exception '국제 세금 활성 경계를 찾을 수 없어요'
      using errcode='45013',detail='ACTIVATION_BOUNDARY_NOT_AVAILABLE';
  end if;
  if v_date<v_boundary then
    return jsonb_build_object('enabled',true,'changed',false,
      'reason','before_activation','activation_date',v_boundary,'lines','[]'::jsonb);
  end if;
  return public.apply_international_tax_for_sales_item_body(p_sales_item,p_force or v_test);
end
$$;

-- capability가 열린 뒤 새로 온보딩한 매장은 세금 프로필의 첫 적용일이 곧 활성 경계다.
create or replace function public.initialize_international_tax_activation_boundary()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_min text:=public.app_capabilities()#>>'{international_tax,minimum_write_app_version}';
begin
  if (public.app_capabilities()#>>'{international_tax,write_enabled}')::boolean then
    if v_min is null then
      raise exception '활성화된 국제 세금 계약에 최소 앱 판본이 없어요'
        using errcode='23514',detail='MINIMUM_APP_VERSION_REQUIRED';
    end if;
    insert into public.international_tax_activation_boundaries(
      store_id,activation_date,minimum_app_version,reason)
    values(new.store_id,new.effective_from,v_min,'profile_created_after_cutover')
    on conflict(store_id) do nothing;
  end if;
  return new;
end
$$;
create trigger store_tax_profiles_95_activation_boundary
after insert on public.store_tax_profiles
for each row execute function public.initialize_international_tax_activation_boundary();

revoke execute on function public.apply_international_tax_for_sales_item_body(uuid,boolean),
  public.apply_international_tax_for_sales_item(uuid,boolean),
  public.initialize_international_tax_activation_boundary(),
  public.guard_international_tax_activation_boundary()
  from public,anon,authenticated,service_role,margincook_rpc_executor;

comment on table public.international_tax_activation_boundaries is
  'INTL-1F 매장별 실제 제품 활성일. 프로필 유효일과 분리해 활성 전 과거 정정에 국제 snapshot을 만들지 않는다.';
comment on function public.apply_international_tax_for_sales_item(uuid,boolean) is
  'INTL-1F 국제 세금 판매 연결 문. capability·매장별 활성일을 지난 판매만 0181 계산 몸통으로 보낸다.';

do $verify$
begin
  if exists(select 1 from public.international_tax_activation_boundaries) then
    raise exception '0187: capability 전 준비 단계에서 활성 경계를 만들었습니다';
  end if;
  if (public.app_capabilities()#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0187: 활성 경계 준비 단계에서 capability를 켰습니다';
  end if;
  if has_function_privilege('authenticated',
       'public.apply_international_tax_for_sales_item_body(uuid,boolean)','execute') then
    raise exception '0187: 국제 세금 계산 몸통이 앱에 열렸습니다';
  end if;
end
$verify$;

commit;
