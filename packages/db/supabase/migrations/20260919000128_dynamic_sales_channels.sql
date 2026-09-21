-- 0128 · 판매 채널 UUID 원장과 매출 초안 동적 채널 계약
-- 기존 qty_hall/qty_delivery/qty_takeout은 업그레이드 호환용으로 유지한다.
-- 신규 권위는 *_channel_quantities 행과 초안/완료 채널 manifest다.
begin;

create or replace function public.normalize_sales_channel_name(p_name text)
returns text language sql immutable parallel safe
set search_path=public,pg_temp
as $fn$
  select lower(regexp_replace(btrim(coalesce(p_name,'')), '\s+', ' ', 'g'));
$fn$;

alter table public.sales_channels add column if not exists normalized_name text;
update public.sales_channels
set normalized_name=public.normalize_sales_channel_name(name)
where normalized_name is distinct from public.normalize_sales_channel_name(name);
alter table public.sales_channels alter column normalized_name set not null;

do $collision$
begin
  if exists(select 1 from public.sales_channels group by store_id,normalized_name having count(*)>1) then
    raise exception '판매 채널 이름 정규화 충돌을 먼저 해결해야 합니다'
      using errcode='23505',detail='SALES_CHANNEL_NAME_MIGRATION_CONFLICT';
  end if;
end $collision$;
create unique index if not exists sales_channels_store_normalized_name_uidx
  on public.sales_channels(store_id,normalized_name);

create table public.store_sales_channel_state (
  store_id uuid primary key references public.stores(id) on delete cascade,
  revision integer not null default 0 check(revision>=0),
  updated_at timestamptz not null default clock_timestamp()
);
insert into public.store_sales_channel_state(store_id)
select id from public.stores on conflict(store_id) do nothing;

-- 기존 매장에 기본 3개가 누락된 경우만 보정한다. 기존 UUID와 이름은 유지한다.
select set_config('costkeep.sales_channel_rpc','on',true);
insert into public.sales_channels(store_id,code,name,normalized_name,sort_order,active)
select s.id,v.code,v.name,public.normalize_sales_channel_name(v.name),v.sort_order,true
from public.stores s cross join (values
  ('hall','매장',0),('delivery','배달',1),('takeout','포장',2)
) v(code,name,sort_order)
where not exists(select 1 from public.sales_channels c where c.store_id=s.id and c.code=v.code)
on conflict(store_id,code) do nothing;

alter table public.sales_day_drafts add column if not exists channel_storage_version smallint not null default 1;
alter table public.sales_day_versions add column if not exists channel_storage_version smallint not null default 1;
alter table public.daily_sales add column if not exists channel_storage_version smallint not null default 1;

create table public.sales_draft_channel_manifests (
  draft_id uuid not null references public.sales_day_drafts(id) on delete cascade,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  channel_code_snapshot text not null,
  channel_name_snapshot text not null,
  sort_order integer not null,
  primary key(draft_id,sales_channel_id)
);

create table public.sales_version_channel_manifests (
  version_id uuid not null references public.sales_day_versions(id) on delete cascade,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  channel_code_snapshot text not null,
  channel_name_snapshot text not null,
  sort_order integer not null,
  primary key(version_id,sales_channel_id)
);

create table public.sales_draft_menu_channel_quantities (
  draft_menu_line_id uuid not null references public.sales_draft_menu_lines(id) on delete cascade,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  quantity numeric not null default 0 check(quantity>=0),
  primary key(draft_menu_line_id,sales_channel_id)
);

create table public.daily_sales_item_channel_quantities (
  daily_sales_item_id uuid not null references public.daily_sales_items(id) on delete cascade,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  channel_code_snapshot text not null,
  channel_name_snapshot text not null,
  quantity numeric not null default 0 check(quantity>=0),
  created_at timestamptz not null default clock_timestamp(),
  primary key(daily_sales_item_id,sales_channel_id)
);
create index daily_sales_item_channel_quantities_channel_idx
  on public.daily_sales_item_channel_quantities(sales_channel_id,daily_sales_item_id);

alter table public.sales_draft_etc_lines add column if not exists sales_channel_id uuid
  references public.sales_channels(id) on delete restrict;
alter table public.sales_draft_etc_lines add column if not exists channel_name_snapshot text;
alter table public.sales_draft_etc_lines drop constraint if exists sales_draft_etc_lines_channel_check;

create table public.daily_sales_etc_lines (
  id uuid primary key,
  daily_sales_id uuid not null references public.daily_sales(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  sales_channel_id uuid references public.sales_channels(id) on delete restrict,
  channel_code_snapshot text,
  channel_name_snapshot text not null,
  name_snapshot text not null,
  unit_price numeric not null check(unit_price>=0),
  quantity numeric not null check(quantity>=0),
  tax_snapshot jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index daily_sales_etc_lines_parent_idx on public.daily_sales_etc_lines(daily_sales_id);
create index daily_sales_etc_lines_channel_idx on public.daily_sales_etc_lines(sales_channel_id,daily_sales_id);

do $rls$
declare t text;
begin
  foreach t in array array['store_sales_channel_state','sales_draft_channel_manifests',
    'sales_version_channel_manifests','sales_draft_menu_channel_quantities',
    'daily_sales_item_channel_quantities','daily_sales_etc_lines'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $rls$;

grant create on schema public to costkeep_rpc_executor;
alter table public.store_sales_channel_state owner to costkeep_rpc_executor;
alter table public.sales_draft_channel_manifests owner to costkeep_rpc_executor;
alter table public.sales_version_channel_manifests owner to costkeep_rpc_executor;
alter table public.sales_draft_menu_channel_quantities owner to costkeep_rpc_executor;
alter table public.daily_sales_item_channel_quantities owner to costkeep_rpc_executor;
alter table public.daily_sales_etc_lines owner to costkeep_rpc_executor;
revoke all on public.store_sales_channel_state,public.sales_draft_channel_manifests,
  public.sales_version_channel_manifests,public.sales_draft_menu_channel_quantities,
  public.daily_sales_item_channel_quantities,public.daily_sales_etc_lines from public,anon,authenticated;
grant all on public.store_sales_channel_state,public.sales_draft_channel_manifests,
  public.sales_version_channel_manifests,public.sales_draft_menu_channel_quantities,
  public.daily_sales_item_channel_quantities,public.daily_sales_etc_lines to service_role;
revoke create on schema public from costkeep_rpc_executor;

-- 모든 기존 초안/완료 판본에는 당시 사용 가능했던 기본 채널 manifest를 만든다.
insert into public.sales_draft_channel_manifests(draft_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,sort_order)
select d.id,c.id,c.code,c.name,c.sort_order
from public.sales_day_drafts d join public.sales_channels c on c.store_id=d.store_id
where c.code in ('hall','delivery','takeout')
on conflict do nothing;

insert into public.sales_version_channel_manifests(version_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,sort_order)
select v.id,c.id,c.code,c.name,c.sort_order
from public.sales_day_versions v join public.sales_channels c on c.store_id=v.store_id
where c.code in ('hall','delivery','takeout')
on conflict do nothing;

insert into public.sales_draft_menu_channel_quantities(draft_menu_line_id,sales_channel_id,quantity)
select m.id,c.id,case c.code when 'hall' then m.qty_hall when 'delivery' then m.qty_delivery else m.qty_takeout end
from public.sales_draft_menu_lines m
join public.sales_day_drafts d on d.id=m.draft_id
join public.sales_channels c on c.store_id=d.store_id and c.code in ('hall','delivery','takeout')
on conflict do nothing;

insert into public.daily_sales_item_channel_quantities(
  daily_sales_item_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,quantity)
select i.id,c.id,c.code,c.name,
  case c.code when 'hall' then i.qty_hall when 'delivery' then i.qty_delivery else i.qty_takeout end
from public.daily_sales_items i
join public.sales_channels c on c.store_id=i.store_id and c.code in ('hall','delivery','takeout')
on conflict do nothing;

update public.sales_draft_etc_lines e set
  sales_channel_id=c.id,channel_name_snapshot=c.name
from public.sales_day_drafts d join public.sales_channels c on c.store_id=d.store_id
where d.id=e.draft_id and c.code=e.channel and e.sales_channel_id is null;
update public.sales_draft_etc_lines set channel_name_snapshot='채널 미지정'
where channel_name_snapshot is null;

insert into public.daily_sales_etc_lines(id,daily_sales_id,store_id,sales_channel_id,
  channel_code_snapshot,channel_name_snapshot,name_snapshot,unit_price,quantity,tax_snapshot)
select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),ds.id,ds.store_id,c.id,
  nullif(x->>'channel',''),coalesce(c.name,'채널 미지정'),
  coalesce(nullif(x->>'name',''),'기타 매출'),coalesce((x->>'price')::numeric,0),
  coalesce((x->>'qty')::numeric,1),
  case when ds.etc_tax_snapshot is null then null else x->'quote' end
from public.daily_sales ds
cross join lateral jsonb_array_elements(case when ds.etc_tax_snapshot is null
  then coalesce(ds.etc_items,'[]'::jsonb) else coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb) end) x
left join public.sales_channels c on c.store_id=ds.store_id and c.code=nullif(x->>'channel','')
on conflict(id) do nothing;

update public.sales_day_drafts set channel_storage_version=2;
update public.sales_day_versions set channel_storage_version=2;
update public.daily_sales set channel_storage_version=2;

-- basis에 활성 채널 UUID/이름/정렬을 봉인한다. normalize 함수는 임의 key를 보존하므로
-- sales_channels도 자동으로 해시에 포함된다.
do $basis_patch$
declare d text; a text; z text;
begin
  d:=replace(pg_get_functiondef('public.build_day_snapshot(uuid,date)'::regprocedure),chr(13),'');
  if position('''sales_channels''' in d)=0 then
    a:='    ''etc_tax_rate'',public.store_tax_rate(p_store),';
    z:='    ''sales_channels'',coalesce((select jsonb_agg(jsonb_build_object('||chr(10)||
      '      ''id'',c.id,''code'',c.code,''name'',c.name,''sort_order'',c.sort_order)'||chr(10)||
      '      order by c.sort_order,c.id) from public.sales_channels c where c.store_id=p_store and c.active),''[]''::jsonb),'||chr(10)||a;
    if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0128 build_day_snapshot anchor'; end if;
    execute replace(d,a,z);
  end if;
end $basis_patch$;

create or replace function public.sales_channel_assert_mutation_allowed(p_store uuid)
returns void language plpgsql volatile security definer set search_path=public,pg_temp as $fn$
declare v_phase public.sales_cutover_phase;
begin
  perform public.lock_store_write_scope(p_store);
  perform public.expire_sales_drafts(p_store);
  select phase into v_phase from public.sales_lifecycle_cutover_state where store_id=p_store;
  if v_phase in ('freezing','blocked') then
    raise exception '매출 전환 확인 중에는 판매 채널을 변경할 수 없어요'
      using errcode='45044',detail='SALES_CUTOVER_WRITE_FROZEN';
  end if;
  if exists(select 1 from public.sales_day_drafts where store_id=p_store
    and status in ('editing','pending_inventory_resolution')) then
    raise exception '작성 중인 매출이 있어 판매 채널을 변경할 수 없습니다. 매출 작성을 완료하거나 초기화한 뒤 다시 시도해 주세요.'
      using errcode='45044',detail='SALES_CHANNELS_LOCKED_BY_DRAFT';
  end if;
end $fn$;

create or replace function public.sales_channel_has_reference(p_store uuid,p_channel uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $fn$
  select exists(select 1 from public.sales_draft_channel_manifests where sales_channel_id=p_channel)
    or exists(select 1 from public.sales_version_channel_manifests where sales_channel_id=p_channel)
    or exists(select 1 from public.sales_basis_versions b where b.store_id=p_store
      and coalesce(b.manifest->'sales_channels','[]'::jsonb)
        @> jsonb_build_array(jsonb_build_object('id',p_channel::text)))
    or exists(select 1 from public.sales_draft_menu_channel_quantities where sales_channel_id=p_channel)
    or exists(select 1 from public.daily_sales_item_channel_quantities where sales_channel_id=p_channel)
    or exists(select 1 from public.sales_draft_etc_lines where sales_channel_id=p_channel)
    or exists(select 1 from public.daily_sales_etc_lines where sales_channel_id=p_channel)
    or exists(select 1 from public.daily_sales_item_tax_snapshots s join public.sales_channels c
      on c.store_id=s.store_id and c.code=s.sales_channel_code::text where c.id=p_channel)
    or exists(select 1 from public.sales_tax_events s join public.sales_channels c
      on c.store_id=s.store_id and c.code=s.sales_channel_code::text where c.id=p_channel)
    or exists(select 1 from public.channel_tax_remittance r join public.store_tax_components tc
      on tc.id=r.tax_component_id join public.sales_channels c
      on c.store_id=tc.store_id and c.code=r.sales_channel_code::text where c.id=p_channel);
$fn$;

create or replace function public.sales_channels_rpc_only()
returns trigger language plpgsql as $fn$
begin
  if current_setting('costkeep.sales_channel_rpc',true) is distinct from 'on' then
    raise exception '판매 채널은 전용 기능에서만 변경할 수 있어요'
      using errcode='42501',detail='SALES_CHANNELS_RPC_ONLY';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $fn$;

create or replace function public.sales_channel_name_immutable()
returns trigger language plpgsql as $fn$
begin
  if new.name is distinct from old.name or new.normalized_name is distinct from old.normalized_name
     or new.code is distinct from old.code then
    raise exception '판매 채널 이름은 만든 뒤 수정할 수 없어요. 기존 채널을 삭제하고 새 채널을 추가해 주세요.'
      using errcode='45009',detail='SALES_CHANNEL_NAME_IMMUTABLE';
  end if;
  return new;
end $fn$;

drop trigger if exists sales_channels_00_rpc_only on public.sales_channels;
create trigger sales_channels_00_rpc_only before insert or update or delete on public.sales_channels
for each row execute function public.sales_channels_rpc_only();
drop trigger if exists sales_channels_01_name_immutable on public.sales_channels;
create trigger sales_channels_01_name_immutable before update on public.sales_channels
for each row execute function public.sales_channel_name_immutable();
drop trigger if exists sales_lifecycle_05_guard on public.sales_channels;
create trigger sales_lifecycle_05_guard before insert or update or delete on public.sales_channels
for each row execute function public.sales_lifecycle_guard_basis_write();
drop trigger if exists sales_lifecycle_95_publish on public.sales_channels;
create trigger sales_lifecycle_95_publish after insert or update or delete on public.sales_channels
for each row execute function public.sales_lifecycle_publish_basis_after_write();

create or replace function public.sales_channel_settings(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_revision integer; v_locked boolean; v_rows jsonb;
begin
  perform public.assert_my_store(p_store);
  select revision into v_revision from public.store_sales_channel_state where store_id=p_store;
  select exists(select 1 from public.sales_day_drafts where store_id=p_store
    and status in ('editing','pending_inventory_resolution')) into v_locked;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,
    'active',c.active,'retired_at',c.retired_at,'sort_order',c.sort_order,
    'used',public.sales_channel_has_reference(p_store,c.id)) order by c.sort_order,c.id),'[]'::jsonb)
    into v_rows from public.sales_channels c where c.store_id=p_store;
  return jsonb_build_object('revision',coalesce(v_revision,0),'max_active',5,
    'active_count',(select count(*) from public.sales_channels where store_id=p_store and active),
    'locked_by_draft',v_locked,'channels',v_rows);
end $fn$;

create or replace function public.create_sales_channel(p_store uuid,p_name text,p_expected_channel_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_state public.store_sales_channel_state; v_channel public.sales_channels; v_id uuid:=gen_random_uuid(); v_name text:=btrim(p_name);
begin
  perform public.assert_my_store(p_store);
  perform public.sales_channel_assert_mutation_allowed(p_store);
  select * into v_state from public.store_sales_channel_state where store_id=p_store for update;
  if v_state.revision<>p_expected_channel_revision then
    raise exception '판매 채널 설정이 다른 기기에서 변경됐어요'
      using errcode='45009',detail='SALES_CHANNEL_REVISION_CONFLICT';
  end if;
  if coalesce(v_name,'')='' then raise exception '채널 이름을 입력해 주세요' using errcode='22000'; end if;
  select * into v_channel from public.sales_channels where store_id=p_store
    and normalized_name=public.normalize_sales_channel_name(v_name) for update;
  if found then
    if v_channel.active then raise exception '이미 등록된 판매 채널이에요'
      using errcode='23505',detail='SALES_CHANNEL_NAME_DUPLICATE'; end if;
    if (select count(*) from public.sales_channels where store_id=p_store and active)>=5 then
      raise exception '판매 채널은 최대 5개까지 사용할 수 있어요'
        using errcode='23514',detail='SALES_CHANNEL_LIMIT_REACHED';
    end if;
    perform set_config('costkeep.sales_channel_rpc','on',true);
    update public.sales_channels set active=true,retired_at=null where id=v_channel.id returning * into v_channel;
  else
    if (select count(*) from public.sales_channels where store_id=p_store and active)>=5 then
      raise exception '판매 채널은 최대 5개까지 사용할 수 있어요'
        using errcode='23514',detail='SALES_CHANNEL_LIMIT_REACHED';
    end if;
    perform set_config('costkeep.sales_channel_rpc','on',true);
    insert into public.sales_channels(id,store_id,code,name,normalized_name,sort_order,active)
    values(v_id,p_store,'custom_'||replace(v_id::text,'-',''),v_name,public.normalize_sales_channel_name(v_name),
      coalesce((select max(sort_order)+1 from public.sales_channels where store_id=p_store),0),true)
    returning * into v_channel;
  end if;
  update public.store_sales_channel_state set revision=revision+1,updated_at=clock_timestamp()
    where store_id=p_store returning * into v_state;
  return jsonb_build_object('action',case when v_channel.id=v_id then 'created' else 'restored' end,
    'revision',v_state.revision,'channel',jsonb_build_object('id',v_channel.id,'code',v_channel.code,
      'name',v_channel.name,'active',v_channel.active,'sort_order',v_channel.sort_order));
end $fn$;

create or replace function public.delete_sales_channel(p_store uuid,p_channel uuid,p_expected_channel_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_state public.store_sales_channel_state; v_channel public.sales_channels; v_used boolean; v_action text;
begin
  perform public.assert_my_store(p_store);
  perform public.sales_channel_assert_mutation_allowed(p_store);
  select * into v_state from public.store_sales_channel_state where store_id=p_store for update;
  if v_state.revision<>p_expected_channel_revision then raise exception '판매 채널 설정이 다른 기기에서 변경됐어요'
    using errcode='45009',detail='SALES_CHANNEL_REVISION_CONFLICT'; end if;
  select * into v_channel from public.sales_channels where id=p_channel and store_id=p_store for update;
  if not found then raise exception '판매 채널을 찾을 수 없어요' using errcode='P0002'; end if;
  if not v_channel.active then return jsonb_build_object('action','retired','revision',v_state.revision); end if;
  if (select count(*) from public.sales_channels where store_id=p_store and active)<=1 then
    raise exception '판매 채널은 최소 1개가 필요해요' using errcode='23514',detail='SALES_CHANNEL_MINIMUM_REQUIRED';
  end if;
  v_used:=public.sales_channel_has_reference(p_store,p_channel);
  perform set_config('costkeep.sales_channel_rpc','on',true);
  if v_used then
    update public.sales_channels set active=false,retired_at=public.store_local_date(p_store) where id=p_channel;
    v_action:='retired';
  else
    delete from public.sales_channels where id=p_channel;
    v_action:='deleted';
  end if;
  update public.store_sales_channel_state set revision=revision+1,updated_at=clock_timestamp()
    where store_id=p_store returning * into v_state;
  return jsonb_build_object('action',v_action,'revision',v_state.revision,'channel_id',p_channel);
end $fn$;

create or replace function public.restore_sales_channel(p_store uuid,p_channel uuid,p_expected_channel_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_state public.store_sales_channel_state; v_channel public.sales_channels;
begin
  perform public.assert_my_store(p_store);
  perform public.sales_channel_assert_mutation_allowed(p_store);
  select * into v_state from public.store_sales_channel_state where store_id=p_store for update;
  if v_state.revision<>p_expected_channel_revision then raise exception '판매 채널 설정이 다른 기기에서 변경됐어요'
    using errcode='45009',detail='SALES_CHANNEL_REVISION_CONFLICT'; end if;
  select * into v_channel from public.sales_channels where id=p_channel and store_id=p_store for update;
  if not found then raise exception '판매 채널을 찾을 수 없어요' using errcode='P0002'; end if;
  if not v_channel.active and (select count(*) from public.sales_channels where store_id=p_store and active)>=5 then
    raise exception '판매 채널은 최대 5개까지 사용할 수 있어요' using errcode='23514',detail='SALES_CHANNEL_LIMIT_REACHED';
  end if;
  perform set_config('costkeep.sales_channel_rpc','on',true);
  update public.sales_channels set active=true,retired_at=null where id=p_channel;
  update public.store_sales_channel_state set revision=revision+1,updated_at=clock_timestamp()
    where store_id=p_store returning * into v_state;
  return jsonb_build_object('action','restored','revision',v_state.revision,'channel_id',p_channel);
end $fn$;

-- 신규 매장은 기본 3개 채널과 전용 revision을 같은 트랜잭션에서 만든다.
create or replace function public.sales_channels_seed_new_store()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  insert into public.store_sales_channel_state(store_id) values(new.id) on conflict do nothing;
  perform set_config('costkeep.sales_channel_rpc','on',true);
  insert into public.sales_channels(store_id,code,name,normalized_name,sort_order,active) values
    (new.id,'hall','매장',public.normalize_sales_channel_name('매장'),0,true),
    (new.id,'delivery','배달',public.normalize_sales_channel_name('배달'),1,true),
    (new.id,'takeout','포장',public.normalize_sales_channel_name('포장'),2,true)
  on conflict(store_id,code) do nothing;
  return new;
end $fn$;
drop trigger if exists stores_20_sales_channels_seed on public.stores;
create trigger stores_20_sales_channels_seed after insert on public.stores
for each row execute function public.sales_channels_seed_new_store();

-- 기준 판본으로부터 초안의 허용 채널을 고정한다.
create or replace function public.sales_draft_seed_channel_manifest()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
begin
  if new.draft_kind='initial' then
    insert into public.sales_draft_channel_manifests(draft_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,sort_order)
    select new.id,c.id,c.code,c.name,c.sort_order from public.sales_channels c
    where c.store_id=new.store_id and c.active order by c.sort_order,c.id on conflict do nothing;
  else
    insert into public.sales_draft_channel_manifests(draft_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,sort_order)
    select new.id,c.id,c.code,c.name,c.sort_order
    from public.sales_basis_versions b
    cross join lateral jsonb_array_elements(coalesce(b.manifest->'sales_channels','[]'::jsonb)) x
    join public.sales_channels c on c.id=nullif(x->>'id','')::uuid and c.store_id=new.store_id
    where b.id=new.basis_version_id
    on conflict do nothing;
    if not found then
      insert into public.sales_draft_channel_manifests(draft_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,sort_order)
      select new.id,c.id,c.code,c.name,c.sort_order from public.sales_channels c
      where c.store_id=new.store_id and c.active order by c.sort_order,c.id on conflict do nothing;
    end if;
  end if;
  return new;
end $fn$;
drop trigger if exists sales_day_drafts_20_channel_manifest on public.sales_day_drafts;
create trigger sales_day_drafts_20_channel_manifest after insert on public.sales_day_drafts
for each row execute function public.sales_draft_seed_channel_manifest();

create or replace function public.sales_draft_seed_menu_channels()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_draft public.sales_day_drafts;
begin
  select * into v_draft from public.sales_day_drafts where id=new.draft_id;
  insert into public.sales_draft_menu_channel_quantities(draft_menu_line_id,sales_channel_id,quantity)
  select new.id,m.sales_channel_id,case when v_draft.draft_kind='amendment' then coalesce((
    select q.quantity from public.daily_sales ds join public.daily_sales_items i on i.daily_sales_id=ds.id
    join public.daily_sales_item_channel_quantities q on q.daily_sales_item_id=i.id
    where ds.store_id=v_draft.store_id and ds.sale_date=v_draft.business_date
      and i.recipe_id=new.recipe_id and q.sales_channel_id=m.sales_channel_id limit 1),
    case m.channel_code_snapshot when 'hall' then new.qty_hall when 'delivery' then new.qty_delivery
      when 'takeout' then new.qty_takeout else 0 end) else 0 end
  from public.sales_draft_channel_manifests m where m.draft_id=new.draft_id
  on conflict do nothing;
  return new;
end $fn$;
drop trigger if exists sales_draft_menu_lines_20_channels on public.sales_draft_menu_lines;
create trigger sales_draft_menu_lines_20_channels after insert on public.sales_draft_menu_lines
for each row execute function public.sales_draft_seed_menu_channels();

create or replace function public.sales_draft_etc_resolve_channel()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_store uuid; v_channel public.sales_channels;
begin
  select store_id into v_store from public.sales_day_drafts where id=new.draft_id;
  if new.sales_channel_id is not null then
    select * into v_channel from public.sales_channels where id=new.sales_channel_id and store_id=v_store;
  elsif nullif(new.channel,'') is not null then
    select * into v_channel from public.sales_channels where store_id=v_store and code=new.channel;
  end if;
  if v_channel.id is not null then
    new.sales_channel_id:=v_channel.id; new.channel:=v_channel.code; new.channel_name_snapshot:=v_channel.name;
  else
    new.sales_channel_id:=null; new.channel:=coalesce(new.channel,'');
    new.channel_name_snapshot:='채널 미지정';
  end if;
  return new;
end $fn$;
drop trigger if exists sales_draft_etc_lines_10_channel on public.sales_draft_etc_lines;
create trigger sales_draft_etc_lines_10_channel before insert or update on public.sales_draft_etc_lines
for each row execute function public.sales_draft_etc_resolve_channel();

-- 직접 DML을 닫고 목적별 RPC만 공개한다.
drop policy if exists sales_channels_insert on public.sales_channels;
drop policy if exists sales_channels_update on public.sales_channels;
drop policy if exists sales_channels_delete on public.sales_channels;
drop policy if exists sales_channels_rpc_executor on public.sales_channels;
create policy sales_channels_rpc_executor on public.sales_channels
  for all to costkeep_rpc_executor using(true) with check(true);
revoke insert,update,delete,truncate on public.sales_channels from anon,authenticated;
grant select,insert,update,delete on public.sales_channels to costkeep_rpc_executor,service_role;
revoke all on function public.save_channel(uuid,jsonb),public.retire_channel(uuid) from public,anon,authenticated,service_role;

grant create on schema public to costkeep_rpc_executor;
alter function public.normalize_sales_channel_name(text) owner to costkeep_rpc_executor;
alter function public.sales_channel_assert_mutation_allowed(uuid) owner to costkeep_rpc_executor;
alter function public.sales_channel_has_reference(uuid,uuid) owner to costkeep_rpc_executor;
alter function public.sales_channel_settings(uuid) owner to costkeep_rpc_executor;
alter function public.create_sales_channel(uuid,text,integer) owner to costkeep_rpc_executor;
alter function public.delete_sales_channel(uuid,uuid,integer) owner to costkeep_rpc_executor;
alter function public.restore_sales_channel(uuid,uuid,integer) owner to costkeep_rpc_executor;
alter function public.sales_channels_seed_new_store() owner to costkeep_rpc_executor;
alter function public.sales_draft_seed_channel_manifest() owner to costkeep_rpc_executor;
alter function public.sales_draft_seed_menu_channels() owner to costkeep_rpc_executor;
alter function public.sales_draft_etc_resolve_channel() owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.normalize_sales_channel_name(text),
  public.sales_channel_assert_mutation_allowed(uuid),
  public.sales_channel_has_reference(uuid,uuid),public.sales_channel_settings(uuid),
  public.create_sales_channel(uuid,text,integer),public.delete_sales_channel(uuid,uuid,integer),
  public.restore_sales_channel(uuid,uuid,integer) from public,anon,service_role;
revoke all on function public.sales_channel_assert_mutation_allowed(uuid),
  public.sales_channel_has_reference(uuid,uuid) from authenticated;
grant execute on function public.sales_channel_settings(uuid),public.create_sales_channel(uuid,text,integer),
  public.delete_sales_channel(uuid,uuid,integer),public.restore_sales_channel(uuid,uuid,integer) to authenticated;

notify pgrst,'reload schema';
commit;
