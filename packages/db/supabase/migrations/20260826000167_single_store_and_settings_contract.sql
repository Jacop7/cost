/*
 * 0167 · 단일 매장을 DB 가 지킨다 · create_store 재호출 무해 · settings 계약 · 백필 전체 비교
 *
 * ① create_store 재호출이 시간대를 바꿨다 — created=false 인데도 p_timezone 이 실렸다.
 *    영업 중 set_store_timezone 은 45011 로 막히는데 이 문으로는 통과했다(실측).
 *    이미 있으면 **즉시 그 매장을 돌려주고 아무것도 안 바꾼다.** 시간대는 그 문(set_store_timezone)뿐.
 *
 * ② 단일 매장이 DB 에서 보장되지 않았다 — 인증 사용자가 stores 에 직접 INSERT 할 수 있었고
 *    owner_id 유일성도 없었다. 정렬(0166)은 둘 중 하나를 일정하게 고를 뿐이다.
 *    · stores 의 직접 쓰기를 앱 롤에서 걷어낸다 — 매장은 create_store 로만 생긴다.
 *    · 소유자당 매장 하나를 트리거가 지킨다. ⚠ 유일 인덱스가 아니라 트리거인 이유:
 *      교차 매장 방어 시험(27 ⑰ · 29 뉴욕 · 30 · 31)이 **같은 사장님의 두 번째 매장**을
 *      소유자로 만들어 "내 매장 문지기는 통과하되 남의 메뉴는 막히는" 실제 위험을 잰다.
 *      그 픽스처는 세션 플래그(sikjae.multi_store_fixture=on)로만 열린다 — 앱 롤은 INSERT
 *      자체가 없어 플래그를 켜도 길이 없다.
 *
 * ③ save_settings 는 앱이 보내는 unit_system·cup_volume·currency 를 조용히 버렸다 —
 *    저장된 척했다. 셋을 받고, **모르는 키는 거부**해 같은 일이 다시 생기지 않게 한다.
 *
 * ④ 0166 백필은 월요일 open 만 비교했다. 종료·브레이크·다른 요일만 어긋난 규칙은 안 고쳤다 —
 *    표시 폼 전체(7일 시간 + 브레이크)로 기대값을 만들어 비교한다(revision=1 만).
 *
 * ⑤ supabase_admin 의 기본 권한은 postgres 가 못 바꾼다(멤버가 아니다). 그 롤이 public 에
 *    만든 테이블은 다시 열린다(검토 재현). 마이그레이션은 여기서 **감추지 않고** 남긴다 —
 *    로컬·CI 는 fresh-db.sh 가 슈퍼유저 연결로 그 기본 권한을 걷어내고, 시험 31 이
 *    pg_default_acl 을 두 롤 모두에 대해 잰다. 운영은 런북 항목이다(대시보드 테이블은
 *    postgres 소유라 이 마이그레이션의 기본 권한이 적용된다).
 */

-- ── ① create_store — 있으면 즉시 반환 ────────────────────────────
create or replace function public.create_store(p_name text, p_timezone text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id  uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('create_store:' || v_uid::text, 0));

  /*
   * 이미 매장이 있으면 **여기서 끝**이다(0167). 시간대 인자도 안 본다 — 재호출로 시간대가
   * 바뀌면 열린 장부의 날짜와 매장 현지 날짜가 갈라진다(실측). 시간대의 문은
   * set_store_timezone 하나이고, 그 문은 영업 중이면 45011 로 막는다.
   */
  select id into v_id from stores where owner_id = v_uid order by created_at, id limit 1;
  if v_id is not null then
    return jsonb_build_object('store_id', v_id, 'created', false,
                              'timezone', store_timezone(v_id), 'local_date', store_local_date(v_id));
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception '매장 이름을 적어 주세요' using errcode = '22000';
  end if;

  insert into stores (owner_id, name) values (v_uid, btrim(p_name)) returning id into v_id;

  if p_timezone is not null then
    insert into store_time_settings (store_id, timezone, confirmed)
         values (v_id, p_timezone, true)
    on conflict (store_id) do update set timezone = excluded.timezone, confirmed = true;
  end if;

  if not exists (select 1 from settings where store_id = v_id)
     or not exists (select 1 from operating_rules where store_id = v_id)
     or not exists (select 1 from store_time_settings where store_id = v_id) then
    raise exception '매장 초기화가 끝나지 않았어요' using errcode = '22000';
  end if;

  return jsonb_build_object('store_id', v_id, 'created', true,
                            'timezone', store_timezone(v_id), 'local_date', store_local_date(v_id));
end;
$$;

-- ── ② stores — 앱 롤 직접 쓰기 회수 + 소유자당 하나 ─────────────
revoke insert, update, delete, truncate on public.stores from anon, authenticated;
drop policy if exists stores_insert on public.stores;
drop policy if exists stores_update on public.stores;
drop policy if exists stores_delete on public.stores;
-- 읽기 정책(stores_select)은 그대로.

create or replace function public.stores_single_per_owner()
returns trigger
language plpgsql
as $$
begin
  -- 시험 픽스처만 연다(교차 매장 방어 시험). 앱 롤은 INSERT 자체가 없어 이 플래그로도 못 연다.
  if current_setting('sikjae.multi_store_fixture', true) = 'on' then
    return new;
  end if;
  if exists (select 1 from public.stores s where s.owner_id = new.owner_id and s.id <> new.id) then
    raise exception '한 계정에 매장은 하나예요 (1차 범위)'
      using errcode = '23505', detail = 'SINGLE_STORE';
  end if;
  return new;
end;
$$;
drop trigger if exists stores_00_single_per_owner on public.stores;
create trigger stores_00_single_per_owner before insert or update of owner_id on public.stores
  for each row execute function public.stores_single_per_owner();

-- ── ③ save_settings — 받는 키를 넓히고, 모르는 키는 거부 ──────────
create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_unknown text;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄
  perform lock_business_scope(p_store);   -- 0134 와 같은 순서

  -- 영업시간은 여기로 안 들어온다(0163). 문은 하나다 — MY > 영업시간(판본 필수).
  if p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end'] then
    raise exception '영업시간은 영업시간 화면에서만 바꿀 수 있어요'
      using errcode = '22000', detail = 'HOURS_NOT_HERE';
  end if;

  /*
   * 모르는 키는 거부한다(0167). 예전엔 unit_system·cup_volume·currency 를 조용히 버려서
   * 앱은 저장된 줄 알았다. 받는 키를 명시하고 그 밖은 계약 위반으로 돌려보낸다.
   */
  select string_agg(k, ', ') into v_unknown
    from jsonb_object_keys(p_payload) k
   where k not in ('locale', 'currency', 'unit_system', 'cup_volume',
                   'unit_price_digits', 'quantity_digits', 'money_digits',
                   'default_target_profit_rate',
                   'alert_morning_summary', 'alert_inbound_delay', 'alert_price_spike', 'alert_target_miss');
  if v_unknown is not null then
    raise exception '저장할 수 없는 설정이에요: %', v_unknown using errcode = '22000', detail = 'UNKNOWN_KEY';
  end if;

  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;

  update settings set
    locale             = coalesce(nullif(p_payload->>'locale',''), locale),
    currency           = coalesce(nullif(p_payload->>'currency',''), currency),
    unit_system        = coalesce(nullif(p_payload->>'unit_system',''), unit_system),
    cup_volume         = coalesce((p_payload->>'cup_volume')::numeric, cup_volume),
    unit_price_digits  = coalesce((p_payload->>'unit_price_digits')::int, unit_price_digits),
    quantity_digits    = coalesce((p_payload->>'quantity_digits')::int, quantity_digits),
    money_digits       = coalesce((p_payload->>'money_digits')::int, money_digits),
    default_target_profit_rate = coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate),
    alert_morning_summary = coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary),
    alert_inbound_delay   = coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay),
    alert_price_spike     = coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike),
    alert_target_miss     = coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss),
    updated_at         = now()
  where store_id = p_store;
end;
$$;
comment on function public.save_settings(uuid, jsonb) is
'설정 저장(언어·통화·단위·자릿수·알림). 영업시간 키는 거부(0163), 모르는 키도 거부(0167) — 조용히 버리면 앱이 저장된 줄 안다. settings 는 앱 롤이 직접 못 쓰므로 definer(0164).';

-- ── ④ 백필 — 표시 폼 전체(7일 시간 + 브레이크)로 비교 ────────────
with expected as (
  select s.store_id,
         (select jsonb_object_agg(d::text, jsonb_build_object(
                   'open',   s.open_time::text,
                   'close',  s.close_time::text,
                   'closed', coalesce((r.weekly_hours -> d::text ->> 'closed')::boolean, false)))
            from generate_series(0, 6) d) as hours,
         case when s.break_start is null or s.break_end is null then '{}'::jsonb
              else (select jsonb_object_agg(d::text, jsonb_build_object(
                             'start', s.break_start::text, 'end', s.break_end::text))
                      from generate_series(0, 6) d) end as breaks,
         r.id as rule_id
    from public.settings s
    join public.operating_rules r on r.store_id = s.store_id and r.effective_to is null
   where r.revision = 1 and s.open_time is not null and s.close_time is not null
)
update public.operating_rules r
   set weekly_hours = e.hours, weekly_breaks = e.breaks
  from expected e
 where r.id = e.rule_id
   and (r.weekly_hours is distinct from e.hours or r.weekly_breaks is distinct from e.breaks);

-- ── ⑤ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  v_def text;
  v_n int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'create_store';
  -- "있으면 즉시 반환"이 시간대 처리보다 **앞**에 있어야 한다.
  if position('''created'', false' in v_def) = 0
     or position('''created'', false' in v_def) > position('store_time_settings' in v_def) then
    raise exception '0167: create_store 가 기존 매장에서도 시간대를 만집니다';
  end if;

  if has_table_privilege('authenticated', 'public.stores', 'insert')
     or has_table_privilege('authenticated', 'public.stores', 'update')
     or has_table_privilege('authenticated', 'public.stores', 'delete') then
    raise exception '0167: stores 직접 쓰기가 아직 열려 있습니다';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'stores_00_single_per_owner') then
    raise exception '0167: 소유자당 하나 트리거가 없습니다';
  end if;
  select count(*) into v_n from (select owner_id from stores group by owner_id having count(*) > 1) d;
  if v_n > 0 then
    raise exception '0167: 이미 매장이 둘 이상인 계정이 %개 있습니다 — 정리 후 다시 적용하세요', v_n;
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_settings';
  if position('UNKNOWN_KEY' in v_def) = 0 or position('unit_system' in v_def) = 0 then
    raise exception '0167: save_settings 계약이 덜 됐습니다';
  end if;

  -- 백필 — 문을 안 지난 규칙이 표시 폼 전체(7일 시작·종료 + 브레이크)와 어긋난 매장이 없다.
  -- (0166 은 월요일 시작만 봐서 종료·브레이크가 다른 매장을 놓쳤다.)
  select count(*) into v_n
    from public.operating_rules r join public.settings s on s.store_id = r.store_id
   where r.effective_to is null and r.revision = 1
     and s.open_time is not null and s.close_time is not null
     and exists (select 1 from generate_series(0, 6) d
                  where (r.weekly_hours -> d::text ->> 'open')  is distinct from s.open_time::text
                     or (r.weekly_hours -> d::text ->> 'close') is distinct from s.close_time::text
                     or (s.break_start is not null and s.break_end is not null and (
                           (r.weekly_breaks -> d::text ->> 'start') is distinct from s.break_start::text
                        or (r.weekly_breaks -> d::text ->> 'end')   is distinct from s.break_end::text)));
  if v_n > 0 then
    raise exception '0167: 규칙이 표시 폼(시작·종료·브레이크)과 어긋난 매장이 %개 있습니다', v_n;
  end if;

  -- postgres 의 기본 권한은 닫혀 있어야 한다(0166). supabase_admin 은 여기서 못 고친다 —
  -- 감추지 않고 남긴다: 로컬·CI 는 fresh-db.sh, 시험 31 이 두 롤 모두를 잰다.
  -- 롤은 이름으로 잇는다 — supabase_admin 이 없는 호스트에서 ::regrole 은 그 자체로 터진다.
  if exists (select 1 from pg_default_acl a join pg_roles ro on ro.oid = a.defaclrole
              where ro.rolname = 'postgres' and a.defaclnamespace = 'public'::regnamespace
                and a.defaclobjtype = 'r'
                and exists (select 1 from unnest(a.defaclacl) x
                             where x::text ~ '^(anon|authenticated)=' and x::text ~ '=[^/]*[Dtx]')) then
    raise exception '0167: postgres 기본 권한에 TRUNCATE/TRIGGER/REFERENCES 가 남아 있습니다';
  end if;
  if exists (select 1 from pg_default_acl a join pg_roles ro on ro.oid = a.defaclrole
              where ro.rolname = 'supabase_admin' and a.defaclnamespace = 'public'::regnamespace
                and a.defaclobjtype = 'r'
                and exists (select 1 from unnest(a.defaclacl) x
                             where x::text ~ '^(anon|authenticated)=' and x::text ~ '=[^/]*[Dtx]')) then
    raise notice '0167: ⚠ supabase_admin 의 기본 권한이 아직 열려 있습니다 — 이 롤이 public 에 만드는 테이블은 TRUNCATE/TRIGGER/REFERENCES 가 열립니다. fresh-db.sh 의 슈퍼유저 단계(로컬·CI) 또는 운영 런북으로 걷어내세요.';
  end if;
end $$;
