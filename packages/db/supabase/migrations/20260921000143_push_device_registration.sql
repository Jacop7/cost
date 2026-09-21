/*
 * 0143 · 푸시 수신 기기 등록
 *
 * Expo push token 원문은 앱 role이 직접 읽지 못한다. 앱은 본인 매장과 현재 설치 ID를
 * 검증하는 RPC로만 등록·상태 확인·폐기하고, 실제 발송 서비스만 테이블을 읽는다.
 */

create table public.push_device_registrations (
  installation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  expo_push_token text not null check (
    length(expo_push_token) between 20 and 1024
    and expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^][[:space:]]+\]$'
  ),
  token_fingerprint text not null check (token_fingerprint ~ '^[0-9a-f]{64}$'),
  app_version text not null check (length(app_version) between 1 and 64),
  active boolean not null default true,
  registered_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  constraint push_device_revocation_shape check (
    (active and revoked_at is null) or (not active and revoked_at is not null)
  )
);

create unique index push_device_one_active_token
  on public.push_device_registrations (expo_push_token)
  where active;
create index push_device_active_recipient
  on public.push_device_registrations (store_id, user_id, last_seen_at desc)
  where active;

comment on table public.push_device_registrations is
'Expo 푸시 기기 등록. token 원문은 service_role만 읽고 앱은 전용 RPC만 호출한다.';
comment on column public.push_device_registrations.installation_id is
'앱 설치 시 SecureStore에 생성한 UUID. 계정 전환 시 같은 설치 행의 소유자를 원자적으로 교체한다.';
comment on column public.push_device_registrations.token_fingerprint is
'운영 화면과 로그에 사용할 SHA-256. token 원문·전체 fingerprint를 사용자 화면에 노출하지 않는다.';

alter table public.push_device_registrations enable row level security;
revoke all on table public.push_device_registrations from public, anon, authenticated;
grant select, insert, update, delete on table public.push_device_registrations to service_role;

create or replace function public.register_push_device(
  p_store uuid,
  p_installation_id uuid,
  p_platform text,
  p_expo_push_token text,
  p_app_version text
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_user uuid := auth.uid();
  v_token text := btrim(p_expo_push_token);
  v_version text := btrim(p_app_version);
  v_fingerprint text;
  v_registered_at timestamptz;
begin
  if v_user is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  perform public.assert_my_store(p_store);
  if p_installation_id is null then
    raise exception '기기 설치 ID가 필요해요' using errcode = '22000', detail = 'INSTALLATION_ID_REQUIRED';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception '지원하지 않는 기기예요' using errcode = '22000', detail = 'PLATFORM_INVALID';
  end if;
  if length(v_token) not between 20 and 1024
     or v_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^][[:space:]]+\]$' then
    raise exception '푸시 token 형식이 올바르지 않아요' using errcode = '22000', detail = 'TOKEN_INVALID';
  end if;
  if length(v_version) not between 1 and 64 then
    raise exception '앱 판본이 올바르지 않아요' using errcode = '22000', detail = 'APP_VERSION_INVALID';
  end if;

  v_fingerprint := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  -- 공급자가 같은 token을 다른 설치 ID에 재사용한 경우 한 기기만 활성 수신자가 된다.
  update public.push_device_registrations
     set active = false, revoked_at = clock_timestamp(), last_seen_at = clock_timestamp()
   where active and expo_push_token = v_token and installation_id <> p_installation_id;

  insert into public.push_device_registrations (
    installation_id, user_id, store_id, platform, expo_push_token,
    token_fingerprint, app_version, active, registered_at, last_seen_at, revoked_at
  ) values (
    p_installation_id, v_user, p_store, p_platform, v_token,
    v_fingerprint, v_version, true, clock_timestamp(), clock_timestamp(), null
  )
  on conflict (installation_id) do update set
    user_id = excluded.user_id,
    store_id = excluded.store_id,
    platform = excluded.platform,
    expo_push_token = excluded.expo_push_token,
    token_fingerprint = excluded.token_fingerprint,
    app_version = excluded.app_version,
    active = true,
    registered_at = case
      when push_device_registrations.user_id is distinct from excluded.user_id
        or push_device_registrations.expo_push_token is distinct from excluded.expo_push_token
      then clock_timestamp()
      else push_device_registrations.registered_at
    end,
    last_seen_at = clock_timestamp(),
    revoked_at = null
  returning registered_at into v_registered_at;

  return jsonb_build_object(
    'registered', true,
    'active', true,
    'fingerprint_suffix', right(v_fingerprint, 12),
    'registered_at', v_registered_at
  );
end;
$fn$;

create or replace function public.push_device_registration_status(
  p_store uuid,
  p_installation_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_user uuid := auth.uid();
  v_row record;
begin
  if v_user is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  perform public.assert_my_store(p_store);

  select active, right(token_fingerprint, 12) as fingerprint_suffix,
         registered_at, last_seen_at
    into v_row
    from public.push_device_registrations
   where installation_id = p_installation_id
     and user_id = v_user
     and store_id = p_store;

  if not found then
    return jsonb_build_object('registered', false, 'active', false);
  end if;
  return jsonb_build_object(
    'registered', v_row.active,
    'active', v_row.active,
    'fingerprint_suffix', v_row.fingerprint_suffix,
    'registered_at', v_row.registered_at,
    'last_seen_at', v_row.last_seen_at
  );
end;
$fn$;

create or replace function public.deactivate_push_device(
  p_store uuid,
  p_installation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_user uuid := auth.uid();
  v_changed boolean;
begin
  if v_user is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  perform public.assert_my_store(p_store);

  update public.push_device_registrations
     set active = false, revoked_at = clock_timestamp(), last_seen_at = clock_timestamp()
   where installation_id = p_installation_id
     and user_id = v_user
     and store_id = p_store
     and active;
  v_changed := found;
  return jsonb_build_object('changed', v_changed, 'active', false);
end;
$fn$;

revoke execute on function public.register_push_device(uuid, uuid, text, text, text) from public, anon;
revoke execute on function public.push_device_registration_status(uuid, uuid) from public, anon;
revoke execute on function public.deactivate_push_device(uuid, uuid) from public, anon;
grant execute on function public.register_push_device(uuid, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.push_device_registration_status(uuid, uuid) to authenticated, service_role;
grant execute on function public.deactivate_push_device(uuid, uuid) to authenticated, service_role;

alter function public.register_push_device(uuid, uuid, text, text, text) owner to postgres;
alter function public.push_device_registration_status(uuid, uuid) owner to postgres;
alter function public.deactivate_push_device(uuid, uuid) owner to postgres;

do $check$
begin
  if has_table_privilege('authenticated', 'public.push_device_registrations', 'SELECT') then
    raise exception '0143: authenticated가 push token 원문을 직접 읽을 수 있습니다';
  end if;
  if exists (
    select 1 from pg_proc p
     where p.oid in (
       'public.register_push_device(uuid,uuid,text,text,text)'::regprocedure,
       'public.push_device_registration_status(uuid,uuid)'::regprocedure,
       'public.deactivate_push_device(uuid,uuid)'::regprocedure
     )
       and (not p.prosecdef or pg_get_userbyid(p.proowner) <> 'postgres'
            or not (p.proconfig @> array['search_path=public, pg_temp']::text[]))
  ) then
    raise exception '0143: 푸시 기기 RPC의 definer·owner·search_path 계약이 다릅니다';
  end if;
end;
$check$;
