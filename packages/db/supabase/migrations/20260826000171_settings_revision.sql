/*
 * 0171 · 설정 판본 — 다중 기기 충돌을 서버가 닫는다 (검토 O P1)
 *
 * 앱은 재조회 실패 중 저장을 막고 충돌 배너를 띄우지만, 재조회 **성공 직후** 다른 기기가 다시 바꾸면
 * 여전히 옛 값으로 덮어쓸 수 있었다. 영업시간(0159)과 같은 짜임으로 `settings.revision` 을 두고,
 * `save_settings` 가 `p_base_revision` 을 **요구**해(없으면 22000 BASE_REQUIRED) 현재 판본과 다르면
 * 45009(REVISION_CONFLICT) 로 거절한다. 저장할 때마다 판본이 오르고 `get_settings` 가 그 판본을 준다.
 *
 * 응답 키는 21개가 된다(revision) — 앱 SETTINGS_SHAPE·시험 32 와 함께 움직인다.
 */

-- ── ① 판본 컬럼 ─────────────────────────────────────────────────
alter table public.settings add column if not exists revision integer not null default 1;
comment on column public.settings.revision is
'설정 판본(0171). save_settings 가 base 로 요구하고 저장마다 1씩 올린다 — 다른 기기가 먼저 저장했으면 45009.';

-- ── ② get_settings — revision 을 싣는다 (21키) ────────────────────
create or replace function public.get_settings(p_store uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'locale', s.locale, 'tax_mode', s.tax_mode, 'tax_items', s.tax_items,
    'currency', s.currency,
    'unit_price_digits', s.unit_price_digits,
    'quantity_digits', s.quantity_digits,
    'money_digits', s.money_digits,
    'unit_system', s.unit_system,
    'cup_volume', s.cup_volume,
    'default_target_profit_rate', s.default_target_profit_rate,
    'alert_morning_summary', s.alert_morning_summary,
    'alert_inbound_delay', s.alert_inbound_delay,
    'alert_price_spike', s.alert_price_spike,
    'alert_target_miss', s.alert_target_miss,
    'open_time', to_char(s.open_time, 'HH24:MI'),
    'close_time', to_char(s.close_time, 'HH24:MI'),
    'break_start', to_char(s.break_start, 'HH24:MI'),
    'break_end', to_char(s.break_end, 'HH24:MI'),
    -- 자정을 넘는 영업인지. 화면이 "다음날 02:00" 처럼 적어 줘야 헷갈리지 않는다.
    'overnight', (s.close_time < s.open_time),
    -- 총 영업 시간(분). 10:00~02:00 이면 960분 = 16시간.
    'open_minutes', (extract(epoch from
        case when s.close_time < s.open_time
             then (s.close_time - s.open_time) + interval '24 hours'
             else (s.close_time - s.open_time) end) / 60)::int,
    -- 0171: 저장 토큰. 앱은 이 값을 p_base_revision 으로 되보낸다.
    'revision', s.revision)
    from settings s where s.store_id = p_store;
$$;
comment on function public.get_settings(uuid) is
'설정 표시 폼(0171: revision 포함 21키). 키 집합은 앱 parseStoreSettings 의 계약이고 시험 32 가 실제 응답으로 잰다.';

-- ── ③ save_settings — 판본 필수·검사·증가 ─────────────────────────
-- 시그니처가 바뀌므로 옛 2인자 함수를 지운다(남기면 2인자 호출이 옛 몸통으로 간다).
drop function if exists public.save_settings(uuid, jsonb);

create or replace function public.save_settings(p_store uuid, p_payload jsonb, p_base_revision integer default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_unknown  text;
  v_key      text;
  v_num      numeric;
  v_locale   text;
  v_currency text;
  v_digits   int;
  v_rev      int;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄
  perform lock_business_scope(p_store);   -- 0134 와 같은 순서

  -- 모양부터: 비어 있지 않은 객체여야 한다. 빈 저장이 성공하면 updated_at 만 바뀐다(검토 실측).
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception '설정은 객체로 보내 주세요' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload = '{}'::jsonb then
    raise exception '저장할 설정 값이 없어요' using errcode = '22000', detail = 'EMPTY_PAYLOAD';
  end if;

  -- 영업시간은 여기로 안 들어온다(0163). 문은 하나다 — MY > 영업시간(판본 필수).
  if p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end'] then
    raise exception '영업시간은 영업시간 화면에서만 바꿀 수 있어요'
      using errcode = '22000', detail = 'HOURS_NOT_HERE';
  end if;

  -- 모르는 키는 거부(0167) — 조용히 버리면 앱이 저장된 줄 안다. (revision 은 인자로만 온다.)
  select string_agg(k, ', ') into v_unknown
    from jsonb_object_keys(p_payload) k
   where k not in ('locale', 'currency', 'unit_system', 'cup_volume',
                   'unit_price_digits', 'quantity_digits', 'money_digits',
                   'default_target_profit_rate',
                   'alert_morning_summary', 'alert_inbound_delay', 'alert_price_spike', 'alert_target_miss');
  if v_unknown is not null then
    raise exception '저장할 수 없는 설정이에요: %', v_unknown using errcode = '22000', detail = 'UNKNOWN_KEY';
  end if;

  -- JSON 타입(0168) — "yes" 는 참이 아니고 "abc" 는 숫자가 아니다. 캐스트보다 먼저 본다.
  foreach v_key in array array['locale', 'currency', 'unit_system'] loop
    if p_payload ? v_key and jsonb_typeof(p_payload -> v_key) <> 'string' then
      raise exception '%는 문자열이어야 해요', v_key using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end loop;
  foreach v_key in array array['cup_volume', 'unit_price_digits', 'quantity_digits', 'money_digits', 'default_target_profit_rate'] loop
    if p_payload ? v_key and jsonb_typeof(p_payload -> v_key) <> 'number' then
      raise exception '%는 숫자여야 해요', v_key using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end loop;
  foreach v_key in array array['alert_morning_summary', 'alert_inbound_delay', 'alert_price_spike', 'alert_target_miss'] loop
    if p_payload ? v_key and jsonb_typeof(p_payload -> v_key) <> 'boolean' then
      raise exception '%는 참/거짓이어야 해요', v_key using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end loop;

  -- 값(0167)
  if p_payload ? 'unit_system' and p_payload->>'unit_system' is distinct from 'metric' then
    raise exception '1차는 미터법만 지원해요' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'cup_volume' then
    v_num := (p_payload->>'cup_volume')::numeric;
    if v_num <= 0 or v_num > 5000 then
      raise exception '컵 용량은 0 보다 크고 5,000ml 이하여야 해요' using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end if;
  foreach v_key in array array['unit_price_digits', 'quantity_digits', 'money_digits'] loop
    if p_payload ? v_key then
      v_num := (p_payload->>v_key)::numeric;
      if v_num <> trunc(v_num) or v_num < 0 or v_num > 4 then
        raise exception '자릿수는 0~4 사이 정수여야 해요 (%)', v_key using errcode = '22000', detail = 'INVALID_VALUE';
      end if;
    end if;
  end loop;
  if p_payload ? 'default_target_profit_rate' then
    v_num := (p_payload->>'default_target_profit_rate')::numeric;
    if v_num < 0 or v_num > 100 then
      raise exception '목표 이익률은 0~100%% 사이여야 해요' using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end if;

  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;

  /*
   * 판본(0171) — 행을 잠그고 base 와 비교한다. base 가 없으면 계약 위반, 다르면 다른 기기가 먼저
   * 저장한 것이다(45009). 앱은 45009 에 "다른 기기에서 설정이 변경됐어요 — 새로고침" 을 띄운다.
   */
  select s.revision into v_rev from settings s where s.store_id = p_store for update;
  if p_base_revision is null then
    raise exception '설정 판본이 필요해요 — 설정을 다시 불러온 뒤 저장해 주세요'
      using errcode = '22000', detail = 'BASE_REQUIRED';
  end if;
  if p_base_revision <> v_rev then
    raise exception '다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요'
      using errcode = '45009', detail = 'REVISION_CONFLICT';
  end if;

  /*
   * 언어가 통화·금액 자릿수를 정한다(0168). 새 언어가 오면 둘을 파생하고, 같은 요청에 다른
   * 값이 실려 있으면 거부한다 — 화면이 달러를 보여 주는데 원장이 원으로 남는 일을 막는다.
   * 언어 없이 통화·자릿수만 오면 현재 언어의 값과 같아야 한다.
   */
  select coalesce(p_payload->>'locale', s.locale) into v_locale from settings s where s.store_id = p_store;
  select d.currency, d.money_digits into v_currency, v_digits from locale_defaults(v_locale) d;
  if v_currency is null then
    raise exception '지원하지 않는 언어예요: %', v_locale using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'currency' and p_payload->>'currency' is distinct from v_currency then
    raise exception '통화는 언어가 정해요 (% → %)', v_locale, v_currency using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'money_digits' and (p_payload->>'money_digits')::int is distinct from v_digits then
    raise exception '금액 자릿수는 통화가 정해요 (% → %자리)', v_currency, v_digits using errcode = '22000', detail = 'INVALID_VALUE';
  end if;

  update settings set
    locale             = v_locale,
    currency           = v_currency,
    money_digits       = v_digits,
    unit_system        = coalesce(p_payload->>'unit_system', unit_system),
    cup_volume         = coalesce((p_payload->>'cup_volume')::numeric, cup_volume),
    unit_price_digits  = coalesce((p_payload->>'unit_price_digits')::int, unit_price_digits),
    quantity_digits    = coalesce((p_payload->>'quantity_digits')::int, quantity_digits),
    default_target_profit_rate = coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate),
    alert_morning_summary = coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary),
    alert_inbound_delay   = coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay),
    alert_price_spike     = coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike),
    alert_target_miss     = coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss),
    revision           = revision + 1,
    updated_at         = now()
  where store_id = p_store
  returning revision into v_rev;

  return jsonb_build_object('revision', v_rev);
end;
$$;
comment on function public.save_settings(uuid, jsonb, integer) is
'설정 저장(언어·단위·컵·자릿수·목표율·알림). 판본 필수(p_base_revision — 없으면 22000 BASE_REQUIRED, 다르면 45009 REVISION_CONFLICT)이고 저장마다 판본이 오른다(0171). 비어 있지 않은 객체·JSON 타입·값을 검사하고(0168), 영업시간 키(HOURS_NOT_HERE)·모르는 키(UNKNOWN_KEY)·틀린 값(INVALID_VALUE)·빈 저장(EMPTY_PAYLOAD)은 22000. 통화·금액 자릿수는 언어에서 파생한다(locale_defaults). settings 는 앱 롤이 직접 못 쓰므로 definer(0164). 새 판본을 돌려준다.';
revoke execute on function public.save_settings(uuid, jsonb, integer) from public, anon;
grant  execute on function public.save_settings(uuid, jsonb, integer) to authenticated, service_role;

-- ── 사후조건 ────────────────────────────────────────────────────
do $$
declare v_n int; v_bad int; v_def text;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'revision') then
    raise exception '0171: settings.revision 이 없습니다';
  end if;
  if exists (select 1 from pg_proc where proname = 'save_settings' and pronamespace = 'public'::regnamespace and pronargs = 2) then
    raise exception '0171: 옛 2인자 save_settings 가 남아 있습니다';
  end if;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.proname = 'save_settings' and p.pronamespace = 'public'::regnamespace and p.pronargs = 3;
  if v_def is null or position('REVISION_CONFLICT' in v_def) = 0 or position('BASE_REQUIRED' in v_def) = 0 then
    raise exception '0171: save_settings 판본 계약이 덜 됐습니다';
  end if;

  -- get_settings 는 매장마다 21키(revision 포함). 응답이 NULL 인 매장도 0키로 세어 잡는다(LEFT JOIN LATERAL).
  select count(*) into v_n from settings;
  if v_n > 0 then
    select count(*) into v_bad
      from (select s.store_id, count(k.k) as n, bool_or(k.k = 'revision') as has_rev
              from settings s
              left join lateral jsonb_object_keys(public.get_settings(s.store_id)) as k(k) on true
             group by s.store_id) t
     where t.n <> 21 or coalesce(t.has_rev, false) = false;
    if v_bad > 0 then
      raise exception '0171: get_settings 키가 21개(revision 포함)가 아닌 매장이 %개 있습니다', v_bad;
    end if;
  elsif position('''revision'', s.revision' in pg_get_functiondef('public.get_settings(uuid)'::regprocedure)) = 0 then
    raise exception '0171: get_settings 에 revision 이 없습니다';
  end if;
end $$;
