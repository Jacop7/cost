/*
 * 0168 · 설정 값 계약 마무리 — 언어 키 이관 · 언어가 통화·금액 자릿수를 정한다 · JSON 타입 검사
 *
 * ① 언어 키 — DB 기본값·기존 행은 'ko-KR' 인데 0167 의 허용 목록(core LOCALES)은 'ko' 다.
 *    현재 값을 그대로 저장해도 INVALID_VALUE 로 실패했다(검토 실측). 기존 행을 core 키로 옮기고
 *    컬럼 기본값을 'ko' 로 바꾼다. 앱 fallback 도 'ko' 다.
 *
 * ② 언어 → 통화·금액 자릿수 — 언어 화면은 "언어가 통화와 금액 자릿수를 정한다"고 약속하는데
 *    앱은 locale 만 보냈다. en-US / KRW / 0자리 가 실제로 저장됐다(검토 실측). 서버가
 *    `locale_defaults()` 로 **원자적으로 파생**한다 — 같은 요청에 다른 통화·자릿수가 실리면 거부.
 *    표는 packages/core/src/locale.ts 의 LOCALES 와 같아야 한다(core 시험 localeSqlParity 가 이 파일을 읽어 대조).
 *
 * ③ JSON 타입 — 빈 {} 가 성공하며 updated_at 만 바뀌었고, "yes" 가 true 로, "abc" 컵 용량이
 *    원시 22P02 로 새어 나갔다(검토 실측). 비어 있지 않은 객체인지, 키마다 JSON 타입이 맞는지를
 *    값 검사 **앞에서** 보고 한 가지 코드(22000 · EMPTY_PAYLOAD / INVALID_VALUE)로 돌려준다.
 *
 * ④ 표 자체에도 CHECK 를 건다 — RPC 밖(소유자 직접 갱신·시드)에서도 같은 계약이 지켜지게.
 */

-- ── ② 언어 → 통화·금액 자릿수 (core LOCALES 미러) ──────────────
create or replace function public.locale_defaults(p_locale text)
returns table (currency text, money_digits int)
language sql
immutable
as $$
  select v.currency, v.money_digits
    from (values
      ('ko',    'KRW', 0),
      ('en-US', 'USD', 2),
      ('ja',    'JPY', 0),
      ('de',    'EUR', 2),
      ('ar-SA', 'SAR', 2),
      ('ar-AE', 'AED', 2),
      ('vi',    'VND', 0),
      ('es-ES', 'EUR', 2),
      ('es-MX', 'MXN', 2),
      ('pt-BR', 'BRL', 2)
    ) as v(locale, currency, money_digits)
   where v.locale = p_locale
$$;
comment on function public.locale_defaults(text) is
'언어 키 → 통화·금액 자릿수(0168). packages/core/src/locale.ts LOCALES 의 미러 — 두 표가 어긋나면 core 시험(localeSqlParity)이 빨개진다. 없는 키면 0행.';
revoke execute on function public.locale_defaults(text) from public, anon;
grant  execute on function public.locale_defaults(text) to authenticated, service_role;

-- ── ① 기존 행·기본값 이관 ────────────────────────────────────────
update public.settings set locale = case locale
    when 'ko-KR' then 'ko' when 'ko_KR' then 'ko'
    when 'en' then 'en-US' when 'en-GB' then 'en-US'
    when 'es' then 'es-ES' when 'ar' then 'ar-SA' when 'pt' then 'pt-BR'
    when 'ja-JP' then 'ja' when 'de-DE' then 'de' when 'vi-VN' then 'vi'
    else locale end
 where locale not in (select l from unnest(array['ko','en-US','ja','de','ar-SA','ar-AE','vi','es-ES','es-MX','pt-BR']) l);

do $$
declare v_bad text;
begin
  select string_agg(distinct locale, ', ') into v_bad
    from public.settings where not exists (select 1 from public.locale_defaults(locale));
  if v_bad is not null then
    raise exception '0168: 알 수 없는 언어 키가 남아 있습니다 — % (정리 후 다시 적용하세요)', v_bad;
  end if;
end $$;

-- 통화·금액 자릿수는 언어가 정한다 — 기존 행도 같은 규칙으로 맞춘다(en-US/KRW/0 같은 어긋남 정리).
update public.settings s
   set currency = d.currency, money_digits = d.money_digits
  from (select st.store_id, ld.currency, ld.money_digits
          from public.settings st, lateral public.locale_defaults(st.locale) ld) d
 where d.store_id = s.store_id
   and (s.currency is distinct from d.currency or s.money_digits is distinct from d.money_digits);

alter table public.settings alter column locale set default 'ko';

-- ── ④ 표의 CHECK — RPC 밖에서도 같은 계약 ───────────────────────
alter table public.settings drop constraint if exists settings_locale_ck;
alter table public.settings add constraint settings_locale_ck
  check (locale in ('ko','en-US','ja','de','ar-SA','ar-AE','vi','es-ES','es-MX','pt-BR'));
alter table public.settings drop constraint if exists settings_currency_ck;
alter table public.settings add constraint settings_currency_ck
  check (currency in ('KRW','USD','JPY','EUR','SAR','AED','VND','MXN','BRL'));
alter table public.settings drop constraint if exists settings_unit_system_ck;
alter table public.settings add constraint settings_unit_system_ck check (unit_system = 'metric');
alter table public.settings drop constraint if exists settings_cup_volume_ck;
alter table public.settings add constraint settings_cup_volume_ck check (cup_volume > 0 and cup_volume <= 5000);
alter table public.settings drop constraint if exists settings_target_rate_ck;
alter table public.settings add constraint settings_target_rate_ck
  check (default_target_profit_rate >= 0 and default_target_profit_rate <= 100);

-- ── ③ save_settings — 비어 있지 않은 객체 · JSON 타입 · 값 · 언어 파생 ──
create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void
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

  -- 모르는 키는 거부(0167) — 조용히 버리면 앱이 저장된 줄 안다.
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
    updated_at         = now()
  where store_id = p_store;
end;
$$;
comment on function public.save_settings(uuid, jsonb) is
'설정 저장(언어·단위·컵·자릿수·목표율·알림). 비어 있지 않은 객체·JSON 타입·값을 검사하고(0168), 영업시간 키(HOURS_NOT_HERE)·모르는 키(UNKNOWN_KEY)·틀린 값(INVALID_VALUE)·빈 저장(EMPTY_PAYLOAD)은 22000. 통화·금액 자릿수는 언어에서 파생한다(locale_defaults). settings 는 앱 롤이 직접 못 쓰므로 definer(0164).';

-- ── 사후조건 ────────────────────────────────────────────────────
do $$
declare v_def text; v_n int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_settings';
  if position('EMPTY_PAYLOAD' in v_def) = 0 or position('jsonb_typeof' in v_def) = 0
     or position('locale_defaults' in v_def) = 0 then
    raise exception '0168: save_settings 계약이 덜 됐습니다';
  end if;
  select count(*) into v_n from public.locale_defaults('ko') d where d.currency = 'KRW' and d.money_digits = 0;
  if v_n <> 1 then raise exception '0168: locale_defaults 가 ko 를 모릅니다'; end if;
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'settings' and column_name = 'locale') !~ '''ko''' then
    raise exception '0168: settings.locale 기본값이 ko 가 아닙니다';
  end if;
  select count(*) into v_n from public.settings s
   where not exists (select 1 from public.locale_defaults(s.locale) d
                      where d.currency = s.currency and d.money_digits = s.money_digits);
  if v_n > 0 then
    raise exception '0168: 언어와 통화·자릿수가 어긋난 행이 %개 있습니다', v_n;
  end if;
  foreach v_def in array array['settings_locale_ck','settings_currency_ck','settings_unit_system_ck','settings_cup_volume_ck','settings_target_rate_ck'] loop
    if not exists (select 1 from pg_constraint where conname = v_def and conrelid = 'public.settings'::regclass and convalidated) then
      raise exception '0168: 제약 % 가 없거나 검증되지 않았습니다', v_def;
    end if;
  end loop;
end $$;
