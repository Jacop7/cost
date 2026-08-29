-- ════════════════════════════════════════════════════════════════
-- 0173 · 인증 계정 삭제와 매장·거래 원장의 수명주기를 분리한다
--
-- 기존 `stores.owner_id -> auth.users on delete cascade`는 계정 한 건을 삭제하면
-- 매장 아래 판매·입고·재고·감사 원장을 모두 물리 삭제했다. 인증 계정은
-- 접근권이고 원장은 영업 기록이므로 같은 수명주기를 가지면 안 된다.
-- ════════════════════════════════════════════════════════════════

create table public.store_lifecycle_events (
  id                 bigint generated always as identity primary key,
  store_id           uuid not null,
  event_type         text not null check (event_type in (
                       'account_deleted', 'store_archived', 'purge_scheduled', 'physical_purge')),
  former_owner_id    uuid,
  actor_user_id      uuid,
  reason             text not null,
  approval_reference text,
  backup_reference   text,
  metadata           jsonb not null default '{}'::jsonb,
  occurred_at        timestamptz not null default clock_timestamp(),
  check (jsonb_typeof(metadata) = 'object')
);

comment on table public.store_lifecycle_events is
  '매장 접근 해제·폐점·물리 삭제의 append-only 감사 원장. 매장 FK를 두지 않아 승인된 물리 삭제 후에도 남는다.';

create table public.store_purge_schedules (
  store_id           uuid primary key references public.stores(id) on delete cascade,
  purge_after        timestamptz not null,
  approved_by        text not null check (btrim(approved_by) <> ''),
  approval_reference text not null check (btrim(approval_reference) <> ''),
  reason             text not null check (btrim(reason) <> ''),
  scheduled_at       timestamptz not null default clock_timestamp()
);

comment on table public.store_purge_schedules is
  '아카이브된 매장의 물리 삭제 예정. 보존 종료 시각·승인 주체·근거를 운영자가 명시해야 한다.';

-- 계정 삭제는 매장 소유 연결만 끊고, 매장과 하위 원장은 남긴다.
alter table public.stores alter column owner_id drop not null;
alter table public.stores drop constraint stores_owner_id_fkey;
alter table public.stores
  add constraint stores_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null;

alter table public.stores
  add column archived_at timestamptz,
  add column archive_reason text,
  add column archive_note text;

alter table public.stores
  add constraint stores_archive_state_ck check (
    (owner_id is not null and archived_at is null and archive_reason is null and archive_note is null)
    or
    (owner_id is null and archived_at is not null
      and archive_reason in ('account_deleted', 'store_archived'))
  );

create or replace function public.store_owner_lifecycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.owner_id is null and new.owner_id is not null then
    raise exception '아카이브된 매장의 소유권은 이 경로로 복구할 수 없어요'
      using errcode = '42501', detail = 'STORE_OWNERSHIP_RESTORE_FORBIDDEN';
  end if;

  if old.owner_id is not null and new.owner_id is not null and new.owner_id <> old.owner_id then
    raise exception '매장 소유권을 직접 바꿀 수 없어요'
      using errcode = '42501', detail = 'STORE_OWNERSHIP_TRANSFER_FORBIDDEN';
  end if;

  if old.owner_id is not null and new.owner_id is null then
    new.archived_at := coalesce(new.archived_at, clock_timestamp());
    new.archive_reason := coalesce(new.archive_reason, 'account_deleted');
    if new.archive_reason not in ('account_deleted', 'store_archived') then
      raise exception '알 수 없는 매장 아카이브 사유예요'
        using errcode = '22000', detail = 'INVALID_ARCHIVE_REASON';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.record_store_owner_detached()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.owner_id is not null and new.owner_id is null then
    insert into public.store_lifecycle_events (
      store_id, event_type, former_owner_id, actor_user_id, reason, metadata)
    values (
      new.id, new.archive_reason, old.owner_id, auth.uid(),
      coalesce(nullif(btrim(new.archive_note), ''), new.archive_reason),
      jsonb_build_object('archived_at', new.archived_at));
  end if;
  return null;
end;
$$;

create trigger stores_10_owner_lifecycle_guard
before update of owner_id on public.stores
for each row execute function public.store_owner_lifecycle_guard();

create trigger stores_90_record_owner_detached
after update of owner_id on public.stores
for each row execute function public.record_store_owner_detached();

create or replace function public.reject_store_direct_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('sikjae.store_purge_id', true) is distinct from old.id::text then
    raise exception '매장 물리 삭제는 보존·승인·백업 절차를 통해야 해요'
      using errcode = '42501', detail = 'STORE_PURGE_PROCEDURE_REQUIRED';
  end if;
  return old;
end;
$$;

create trigger stores_00_reject_direct_delete
before delete on public.stores
for each row execute function public.reject_store_direct_delete();

create or replace function public.reject_store_lifecycle_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '매장 수명주기 감사 원장은 바꿀 수 없어요'
    using errcode = '42501', detail = 'STORE_LIFECYCLE_APPEND_ONLY';
end;
$$;

create trigger store_lifecycle_events_immutable_row
before update or delete on public.store_lifecycle_events
for each row execute function public.reject_store_lifecycle_mutation();

create trigger store_lifecycle_events_immutable_truncate
before truncate on public.store_lifecycle_events
for each statement execute function public.reject_store_lifecycle_mutation();

-- 아카이브된 매장은 소유권이 남아 있더라도 앱 스코프에서 제외한다.
create or replace function public.my_store_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.stores
   where owner_id = auth.uid()
     and archived_at is null;
$$;

create or replace function public.assert_my_store(p_store uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.stores
     where id = p_store
       and owner_id = auth.uid()
       and archived_at is null) then
    raise exception '이 매장에 대한 권한이 없습니다' using errcode = '42501';
  end if;
end;
$$;

drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores for select
using (owner_id = auth.uid() and archived_at is null);

create or replace function public.create_store(p_name text, p_timezone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from auth.users where id = v_uid) then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('create_store:' || v_uid::text, 0));

  select id into v_id from public.stores
   where owner_id = v_uid and archived_at is null
   order by created_at, id limit 1;
  if v_id is not null then
    return jsonb_build_object('store_id', v_id, 'created', false,
                              'timezone', store_timezone(v_id), 'local_date', store_local_date(v_id));
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception '매장 이름을 적어 주세요' using errcode = '22000';
  end if;

  insert into public.stores (owner_id, name) values (v_uid, btrim(p_name)) returning id into v_id;

  if p_timezone is not null then
    insert into public.store_time_settings (store_id, timezone, confirmed)
         values (v_id, p_timezone, true)
    on conflict (store_id) do update set timezone = excluded.timezone, confirmed = true;
  end if;

  if not exists (select 1 from public.settings where store_id = v_id)
     or not exists (select 1 from public.operating_rules where store_id = v_id)
     or not exists (select 1 from public.store_time_settings where store_id = v_id) then
    raise exception '매장 초기화가 끝나지 않았어요' using errcode = '22000';
  end if;

  return jsonb_build_object('store_id', v_id, 'created', true,
                            'timezone', store_timezone(v_id), 'local_date', store_local_date(v_id));
end;
$$;

create or replace function public.archive_my_store(p_store uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at  timestamptz := clock_timestamp();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception '폐점 사유를 적어 주세요' using errcode = '22000', detail = 'ARCHIVE_REASON_REQUIRED';
  end if;

  update public.stores
     set owner_id = null,
         archived_at = v_at,
         archive_reason = 'store_archived',
         archive_note = btrim(p_reason)
   where id = p_store
     and owner_id = v_uid
     and archived_at is null;
  if not found then
    raise exception '이 매장에 대한 권한이 없습니다' using errcode = '42501';
  end if;

  return jsonb_build_object('archived', true, 'store_id', p_store, 'archived_at', v_at);
end;
$$;

create or replace function public.retire_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz := clock_timestamp();
  v_stores integer;
  v_users integer;
begin
  if v_uid is null or not exists (select 1 from auth.users where id = v_uid) then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('retire_account:' || v_uid::text, 0));

  update public.stores
     set owner_id = null,
         archived_at = v_at,
         archive_reason = 'account_deleted',
         archive_note = '사용자 계정 탈퇴'
   where owner_id = v_uid
     and archived_at is null;
  get diagnostics v_stores = row_count;

  delete from auth.users where id = v_uid;
  get diagnostics v_users = row_count;
  if v_users <> 1 then
    raise exception '계정 삭제를 완료하지 못했어요' using errcode = 'P0001';
  end if;

  return jsonb_build_object('deleted', true, 'archived_store_count', v_stores);
end;
$$;

create or replace function public.schedule_store_purge(
  p_store uuid,
  p_purge_after timestamptz,
  p_approved_by text,
  p_approval_reference text,
  p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_purge_after is null
     or coalesce(btrim(p_approved_by), '') = ''
     or coalesce(btrim(p_approval_reference), '') = ''
     or coalesce(btrim(p_reason), '') = '' then
    raise exception '보존 종료 시각·승인 주체·근거·사유가 필요해요'
      using errcode = '22000', detail = 'PURGE_APPROVAL_REQUIRED';
  end if;
  if not exists (select 1 from public.stores where id = p_store and archived_at is not null) then
    raise exception '아카이브된 매장만 물리 삭제를 예약할 수 있어요'
      using errcode = '22000', detail = 'STORE_NOT_ARCHIVED';
  end if;

  insert into public.store_purge_schedules
    (store_id, purge_after, approved_by, approval_reference, reason)
  values
    (p_store, p_purge_after, btrim(p_approved_by), btrim(p_approval_reference), btrim(p_reason))
  on conflict (store_id) do update
    set purge_after = excluded.purge_after,
        approved_by = excluded.approved_by,
        approval_reference = excluded.approval_reference,
        reason = excluded.reason,
        scheduled_at = clock_timestamp();

  insert into public.store_lifecycle_events
    (store_id, event_type, actor_user_id, reason, approval_reference, metadata)
  values
    (p_store, 'purge_scheduled', auth.uid(), btrim(p_reason), btrim(p_approval_reference),
     jsonb_build_object('purge_after', p_purge_after, 'approved_by', btrim(p_approved_by)));

  return jsonb_build_object('scheduled', true, 'store_id', p_store, 'purge_after', p_purge_after);
end;
$$;

create or replace function public.purge_archived_store(p_store uuid, p_backup_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.store_purge_schedules%rowtype;
begin
  if coalesce(btrim(p_backup_reference), '') = '' then
    raise exception '복구할 백업 근거가 필요해요'
      using errcode = '22000', detail = 'PURGE_BACKUP_REQUIRED';
  end if;

  select * into v_schedule from public.store_purge_schedules
   where store_id = p_store for update;
  if not found then
    raise exception '승인된 물리 삭제 예정이 없어요'
      using errcode = '42501', detail = 'PURGE_NOT_SCHEDULED';
  end if;
  if v_schedule.purge_after > clock_timestamp() then
    raise exception '원장 보존 기간이 아직 끝나지 않았어요'
      using errcode = '42501', detail = 'RETENTION_PERIOD_ACTIVE';
  end if;

  insert into public.store_lifecycle_events
    (store_id, event_type, actor_user_id, reason, approval_reference, backup_reference, metadata)
  values
    (p_store, 'physical_purge', auth.uid(), v_schedule.reason,
     v_schedule.approval_reference, btrim(p_backup_reference),
     jsonb_build_object('approved_by', v_schedule.approved_by,
                        'purge_after', v_schedule.purge_after,
                        'scheduled_at', v_schedule.scheduled_at));

  perform set_config('sikjae.store_purge_id', p_store::text, true);
  delete from public.stores where id = p_store and archived_at is not null;
  if not found then
    raise exception '아카이브된 매장을 찾지 못했어요'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('purged', true, 'store_id', p_store);
end;
$$;

revoke all on table public.store_lifecycle_events, public.store_purge_schedules
  from public, anon, authenticated;
grant select on table public.store_lifecycle_events, public.store_purge_schedules to service_role;

revoke all on function public.archive_my_store(uuid, text) from public, anon;
revoke all on function public.retire_my_account() from public, anon;
grant execute on function public.archive_my_store(uuid, text), public.retire_my_account()
  to authenticated, service_role;

revoke all on function public.schedule_store_purge(uuid, timestamptz, text, text, text)
  from public, anon, authenticated;
revoke all on function public.purge_archived_store(uuid, text)
  from public, anon, authenticated;
grant execute on function public.schedule_store_purge(uuid, timestamptz, text, text, text),
                          public.purge_archived_store(uuid, text)
  to service_role;

revoke all on function public.store_owner_lifecycle_guard(),
                       public.record_store_owner_detached(),
                       public.reject_store_direct_delete(),
                       public.reject_store_lifecycle_mutation()
  from public, anon, authenticated;

comment on function public.retire_my_account() is
  '현재 인증 계정을 삭제하고 소유 매장을 접근 불가 아카이브로 전환한다. 매장 하위 원장은 보존한다.';
comment on function public.archive_my_store(uuid, text) is
  '계정은 유지하고 현재 매장만 폐점·아카이브한다. 기존 원장은 보존하고 앱 접근을 즉시 끊는다.';
comment on function public.schedule_store_purge(uuid, timestamptz, text, text, text) is
  '운영자가 보존 종료 시각·승인 주체·승인 근거를 기록하는 service_role 전용 물리 삭제 예약이다.';
comment on function public.purge_archived_store(uuid, text) is
  '보존 종료·승인·백업 근거가 모두 있을 때만 아카이브 매장과 하위 원장을 물리 삭제하는 service_role 전용 문이다.';

-- 배포 중 조용히 반영되는 걸 막는 사후조건.
do $$
declare
  v_fk text;
begin
  select pg_get_constraintdef(oid) into v_fk
    from pg_constraint
   where conrelid = 'public.stores'::regclass
     and conname = 'stores_owner_id_fkey';
  if v_fk not like '%ON DELETE SET NULL%' then
    raise exception '0173: stores.owner_id FK가 ON DELETE SET NULL이 아닙니다';
  end if;
  if exists (select 1 from public.stores where owner_id is null and archived_at is null) then
    raise exception '0173: 소유자 없는 활성 매장이 있습니다';
  end if;
  if has_function_privilege('anon', 'public.retire_my_account()', 'EXECUTE')
     or has_function_privilege('anon', 'public.archive_my_store(uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.purge_archived_store(uuid,text)', 'EXECUTE') then
    raise exception '0173: 계정 탈퇴·물리 삭제 함수 권한이 열려 있습니다';
  end if;
end;
$$;
