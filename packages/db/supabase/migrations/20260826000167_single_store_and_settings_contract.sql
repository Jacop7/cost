/*
 * 0167 · 단일 매장 계약 · create_store 재호출 무해 · settings 계약 · 백필(부트스트랩 행만)
 *
 * ⚠ 이 파일은 첫 푸시 뒤 **실환경 적용 전에** 고쳐졌다(검토 P0·P1). 후속 번호로 덧대지 않은 이유:
 *   새 DB 는 순서대로 태우므로 잘못된 0167 이 먼저 돌아 데이터를 잃는다. 개발 DB 는 재적용했다
 *   (트리거 → UNIQUE 로 바뀌는 부분은 아래가 스스로 정리한다).
 *
 * ① create_store 재호출 — 0166 은 기존 매장에도 시간대 인자를 적용했다. 열린 장부의 영업일과
 *    매장 현지 날짜가 갈라진다(실측). 매장이 있으면 **시간대를 보기 전에** created=false 로 끝낸다.
 *
 * ② 단일 매장 — 앱 롤의 stores 직접 INSERT/UPDATE/DELETE 를 권한부터 걷어내고,
 *    `owner_id` 에 **UNIQUE 제약**을 건다. 첫 판은 `exists` 트리거 + 세션 플래그였는데
 *    두 세션이 동시에 들어오면 둘 다 통과했다(검토 재현). 제약은 경합에서도 하나만 남긴다.
 *    교차 매장 시험은 **다른 사장님**의 매장을 쓴다 — 우회 플래그는 운영 스키마에 두지 않는다.
 *
 * ③ save_settings — 받는 키를 명시하고(언어·통화·단위·컵·자릿수·목표율·알림) 모르는 키는
 *    거부한다. 예전엔 unit_system·cup_volume·currency 를 조용히 버려 앱이 저장된 줄 알았다.
 *    값의 뜻도 여기서 잰다: 1차는 metric 고정, 컵 용량은 양수, 통화·언어는 core 의 목록.
 *
 * ④ 백필 — 0166 은 revision=1 을 "안 만진 초기 규칙"으로 읽고 월요일 시작만 비교했다.
 *    틀렸다: 사장님이 문(0159)으로 저장한 **새 예약 규칙도 revision=1** 이고, settings 는
 *    그 규칙의 월요일 값만 비춘다. 그 백필은 화~일과 브레이크를 월요일 값으로 덮어썼다
 *    (검토 재현 — 원본은 복구 불가). 대상을 **진짜 부트스트랩 행**으로 한정한다:
 *    `created_by is null and effective_from = '-infinity'` (0129·0165 가 만드는 행의 모양).
 *    문이 만든 행은 항상 created_by 가 있고 effective_from 이 실제 날짜다(0130~0163).
 *
 * ⑤ supabase_admin 기본 권한은 postgres 가 못 바꾼다(멤버가 아니다). 여기서는 감추지 않고
 *    NOTICE 로 남긴다 — 실행 가능한 단계는 `scripts/admin-acl.sh`(fresh-db.sh 가 부르고, 운영은
 *    배포 절차에서 부른다). 시험 31 이 두 롤의 pg_default_acl 을 잰다.
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

  -- 트리거 셋(시간대·규칙·설정)이 같은 트랜잭션에서 따라붙는다(0165 ②). UNIQUE 가 둘째를 막는다.
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
comment on function public.create_store(text, text) is
'매장 생성의 공식 문(0165·0166·0167). 계정당 매장 하나(UNIQUE) — 이미 있으면 시간대 인자를 보지 않고 created=false 로 그 매장을 돌려준다. 매장·시간대·영업규칙·설정을 한 트랜잭션으로 만들고 셋이 다 생겼는지 확인한다.';
revoke execute on function public.create_store(text, text) from public, anon;
grant  execute on function public.create_store(text, text) to authenticated, service_role;

-- ── ② stores — 앱 롤 직접 쓰기 회수 + 계정당 하나(UNIQUE) ────────
revoke insert, update, delete, truncate on public.stores from anon, authenticated;
drop policy if exists stores_insert on public.stores;
drop policy if exists stores_update on public.stores;
drop policy if exists stores_delete on public.stores;
-- 읽기 정책(stores_select)은 그대로.

-- 첫 판의 트리거·플래그 우회는 걷어낸다(개발 DB 에 남아 있을 수 있다).
drop trigger if exists stores_00_single_per_owner on public.stores;
drop function if exists public.stores_single_per_owner();

do $$
declare v_n int;
begin
  select count(*) into v_n from (select owner_id from public.stores group by owner_id having count(*) > 1) d;
  if v_n > 0 then
    raise exception '0167: 이미 매장이 둘 이상인 계정이 %개 있습니다 — 정리 후 다시 적용하세요', v_n;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stores_owner_id_key'
                    and conrelid = 'public.stores'::regclass) then
    alter table public.stores add constraint stores_owner_id_key unique (owner_id);
  end if;
end $$;
comment on constraint stores_owner_id_key on public.stores is
'계정당 매장 하나(1차 범위, 기획서 §12 · 0167). 트리거가 아니라 제약이다 — 두 트랜잭션이 동시에 들어와도 하나만 남는다.';

-- ── ③ save_settings — 받는 키를 넓히고, 모르는 키·틀린 값은 거부 ──
create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_unknown text;
  v_num     numeric;
  v_txt     text;
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

  /*
   * 값의 뜻(검토 P2). 키만 보면 'nonsense'·-5·'???' 가 그대로 저장된다.
   * 목록은 packages/core/src/locale.ts 의 LOCALES 와 같다 — 앱 선택지가 곧 서버 허용치다.
   */
  if p_payload ? 'unit_system' and p_payload->>'unit_system' is distinct from 'metric' then
    raise exception '1차는 미터법만 지원해요' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'cup_volume' then
    v_num := (p_payload->>'cup_volume')::numeric;
    if v_num is null or v_num <= 0 or v_num > 5000 then
      raise exception '컵 용량은 0 보다 크고 5,000ml 이하여야 해요' using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end if;
  if p_payload ? 'currency' and p_payload->>'currency' not in ('KRW','USD','JPY','EUR','SAR','AED','VND','MXN','BRL') then
    raise exception '지원하지 않는 통화예요: %', p_payload->>'currency' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'locale' and p_payload->>'locale' not in ('ko','en-US','ja','de','ar-SA','ar-AE','vi','es-ES','es-MX','pt-BR') then
    raise exception '지원하지 않는 언어예요: %', p_payload->>'locale' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  foreach v_txt in array array['unit_price_digits', 'quantity_digits', 'money_digits']
  loop
    if p_payload ? v_txt then
      v_num := (p_payload->>v_txt)::numeric;
      if v_num is null or v_num <> trunc(v_num) or v_num < 0 or v_num > 4 then
        raise exception '자릿수는 0~4 사이 정수여야 해요 (%)', v_txt using errcode = '22000', detail = 'INVALID_VALUE';
      end if;
    end if;
  end loop;
  if p_payload ? 'default_target_profit_rate' then
    v_num := (p_payload->>'default_target_profit_rate')::numeric;
    if v_num is null or v_num < 0 or v_num > 100 then
      raise exception '목표 이익률은 0~100%% 사이여야 해요' using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
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
'설정 저장(언어·통화·단위·자릿수·알림). 영업시간 키는 거부(0163), 모르는 키·틀린 값도 거부(0167) — 조용히 버리면 앱이 저장된 줄 안다. settings 는 앱 롤이 직접 못 쓰므로 definer(0164).';

-- ── ④ 백필 — 부트스트랩 행만, 표시 폼 전체(7일 시간 + 브레이크)로 ──
/*
 * 대상: 문을 한 번도 안 지난 **부트스트랩** 행 — created_by 없음 · effective_from = -infinity ·
 * 열려 있음 · revision 1. 사장님이 저장한 행은 created_by 가 있고 시작일이 실제 날짜다.
 */
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
   where r.revision = 1
     and r.created_by is null and r.effective_from = '-infinity'::date
     and s.open_time is not null and s.close_time is not null
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
  if not exists (select 1 from pg_constraint where conname = 'stores_owner_id_key'
                    and conrelid = 'public.stores'::regclass and contype = 'u') then
    raise exception '0167: stores.owner_id UNIQUE 제약이 없습니다';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'stores_00_single_per_owner') then
    raise exception '0167: 첫 판의 우회 트리거가 남아 있습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_settings';
  if position('UNKNOWN_KEY' in v_def) = 0 or position('INVALID_VALUE' in v_def) = 0
     or position('unit_system' in v_def) = 0 then
    raise exception '0167: save_settings 계약이 덜 됐습니다';
  end if;

  -- 백필 — **부트스트랩** 행만 표시 폼 전체와 맞는다. 사장님 저장 행은 대상이 아니다.
  select count(*) into v_n
    from public.operating_rules r join public.settings s on s.store_id = r.store_id
   where r.effective_to is null and r.revision = 1
     and r.created_by is null and r.effective_from = '-infinity'::date
     and s.open_time is not null and s.close_time is not null
     and exists (select 1 from generate_series(0, 6) d
                  where (r.weekly_hours -> d::text ->> 'open')  is distinct from s.open_time::text
                     or (r.weekly_hours -> d::text ->> 'close') is distinct from s.close_time::text
                     or (s.break_start is not null and s.break_end is not null and (
                           (r.weekly_breaks -> d::text ->> 'start') is distinct from s.break_start::text
                        or (r.weekly_breaks -> d::text ->> 'end')   is distinct from s.break_end::text)));
  if v_n > 0 then
    raise exception '0167: 부트스트랩 규칙이 표시 폼(시작·종료·브레이크)과 어긋난 매장이 %개 있습니다', v_n;
  end if;

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
    raise notice '0167: ⚠ supabase_admin 의 기본 권한이 아직 열려 있습니다 — 이 롤이 public 에 만드는 테이블은 TRUNCATE/TRIGGER/REFERENCES 가 열립니다. scripts/admin-acl.sh 를 슈퍼유저 접속으로 실행하세요(배포 절차의 단계).';
  end if;
end $$;
