/*
 * 0141 · 사용자 업무 알림 6종 설정
 *
 * 사용자에게 보이는 알림 스위치를 재료 부족·입고 확인·재고 확인·순이익률 변동·
 * 매출 작성·고정 지출의 6개로 고정한다. 매출 작성의 일간·주간·월간·기한 임박은
 * 하나의 선호 값으로 함께 켜고 끈다. 기존 단가 급등 선호는 UI·알림 판정에서 제거하되
 * 이전 앱 판본의 순차 배포를 위해 한 배포 주기 동안 RPC 읽기·쓰기를 유지한다.
 */

alter table public.settings
  add column if not exists alert_negative_stock_check boolean not null default true,
  add column if not exists alert_sales_entry boolean not null default true,
  add column if not exists alert_fixed_cost_missing boolean not null default true;

comment on column public.settings.alert_negative_stock_check is
'마이너스 재고 주간 확인 푸시 선호. 음수 재고 표시와 인앱 필수 안내에는 영향을 주지 않는다.';
comment on column public.settings.alert_sales_entry is
'일간·주간·월간·작성 기한 임박 매출 푸시를 함께 제어하는 단일 선호.';
comment on column public.settings.alert_fixed_cost_missing is
'최초·월간·주간 고정 지출 미입력 푸시를 함께 제어하는 단일 선호.';

create or replace function public.get_settings(p_store uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
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
    'alert_negative_stock_check', s.alert_negative_stock_check,
    'alert_target_miss', s.alert_target_miss,
    'alert_sales_entry', s.alert_sales_entry,
    'alert_fixed_cost_missing', s.alert_fixed_cost_missing,
    'open_time', to_char(s.open_time, 'HH24:MI'),
    'close_time', to_char(s.close_time, 'HH24:MI'),
    'break_start', to_char(s.break_start, 'HH24:MI'),
    'break_end', to_char(s.break_end, 'HH24:MI'),
    'overnight', (s.close_time < s.open_time),
    'open_minutes', (extract(epoch from
        case when s.close_time < s.open_time
             then (s.close_time - s.open_time) + interval '24 hours'
             else (s.close_time - s.open_time) end) / 60)::int,
    'revision', s.revision)
    from settings s where s.store_id = p_store;
$$;

comment on function public.get_settings(uuid) is
'설정 표시 폼(0141: 알림 6종 포함 23개 필수키 + 이전 앱용 alert_price_spike 임시 호환키).';

create or replace function public.save_settings(
  p_store uuid,
  p_payload jsonb,
  p_base_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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
  perform assert_my_store(p_store);
  perform lock_business_scope(p_store);

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception '설정은 객체로 보내 주세요' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload = '{}'::jsonb then
    raise exception '저장할 설정 값이 없어요' using errcode = '22000', detail = 'EMPTY_PAYLOAD';
  end if;

  if p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end'] then
    raise exception '영업시간은 영업시간 화면에서만 바꿀 수 있어요'
      using errcode = '22000', detail = 'HOURS_NOT_HERE';
  end if;

  select string_agg(k, ', ') into v_unknown
    from jsonb_object_keys(p_payload) k
   where k not in ('locale', 'currency', 'unit_system', 'cup_volume',
                   'unit_price_digits', 'quantity_digits', 'money_digits',
                   'default_target_profit_rate',
                   'alert_morning_summary', 'alert_inbound_delay', 'alert_price_spike',
                   'alert_negative_stock_check', 'alert_target_miss',
                   'alert_sales_entry', 'alert_fixed_cost_missing');
  if v_unknown is not null then
    raise exception '저장할 수 없는 설정이에요: %', v_unknown using errcode = '22000', detail = 'UNKNOWN_KEY';
  end if;

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
  foreach v_key in array array['alert_morning_summary', 'alert_inbound_delay', 'alert_price_spike',
                               'alert_negative_stock_check', 'alert_target_miss',
                               'alert_sales_entry', 'alert_fixed_cost_missing'] loop
    if p_payload ? v_key and jsonb_typeof(p_payload -> v_key) <> 'boolean' then
      raise exception '%는 참/거짓이어야 해요', v_key using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end loop;

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

  select s.revision into v_rev from settings s where s.store_id = p_store for update;
  if p_base_revision is null then
    raise exception '설정 판본이 필요해요 — 설정을 다시 불러온 뒤 저장해 주세요'
      using errcode = '22000', detail = 'BASE_REQUIRED';
  end if;
  if p_base_revision <> v_rev then
    raise exception '다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요'
      using errcode = '45009', detail = 'REVISION_CONFLICT';
  end if;

  select coalesce(p_payload->>'locale', s.locale) into v_locale
    from settings s where s.store_id = p_store;
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
    alert_inbound_delay = coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay),
    alert_price_spike = coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike),
    alert_negative_stock_check = coalesce((p_payload->>'alert_negative_stock_check')::boolean, alert_negative_stock_check),
    alert_target_miss = coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss),
    alert_sales_entry = coalesce((p_payload->>'alert_sales_entry')::boolean, alert_sales_entry),
    alert_fixed_cost_missing = coalesce((p_payload->>'alert_fixed_cost_missing')::boolean, alert_fixed_cost_missing),
    revision = revision + 1,
    updated_at = now()
  where store_id = p_store
    and (locale is distinct from v_locale
      or currency is distinct from v_currency
      or money_digits is distinct from v_digits
      or unit_system is distinct from coalesce(p_payload->>'unit_system', unit_system)
      or cup_volume is distinct from coalesce((p_payload->>'cup_volume')::numeric, cup_volume)
      or unit_price_digits is distinct from coalesce((p_payload->>'unit_price_digits')::int, unit_price_digits)
      or quantity_digits is distinct from coalesce((p_payload->>'quantity_digits')::int, quantity_digits)
      or default_target_profit_rate is distinct from coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate)
      or alert_morning_summary is distinct from coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary)
      or alert_inbound_delay is distinct from coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay)
      or alert_price_spike is distinct from coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike)
      or alert_negative_stock_check is distinct from coalesce((p_payload->>'alert_negative_stock_check')::boolean, alert_negative_stock_check)
      or alert_target_miss is distinct from coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss)
      or alert_sales_entry is distinct from coalesce((p_payload->>'alert_sales_entry')::boolean, alert_sales_entry)
      or alert_fixed_cost_missing is distinct from coalesce((p_payload->>'alert_fixed_cost_missing')::boolean, alert_fixed_cost_missing))
  returning revision into v_rev;

  if not found then
    return jsonb_build_object('changed', false, 'revision', p_base_revision);
  end if;
  return jsonb_build_object('changed', true, 'revision', v_rev);
end;
$$;

comment on function public.save_settings(uuid, jsonb, integer) is
'설정 저장(0141). 새 앱은 알림 6종만 사용하고 매출 작성 시점들은 alert_sales_entry 하나로 제어한다. 이전 앱용 alert_price_spike 쓰기는 한 배포 주기만 호환한다. 판본·무변경 계약은 0172를 유지한다.';
revoke execute on function public.save_settings(uuid, jsonb, integer) from public, anon;
grant execute on function public.save_settings(uuid, jsonb, integer) to authenticated, service_role;

do $$
declare
  v_def text;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'settings'
       and column_name in ('alert_negative_stock_check', 'alert_sales_entry', 'alert_fixed_cost_missing')
     group by table_schema, table_name having count(*) = 3
  ) then
    raise exception '0141: 신규 알림 설정 3개가 모두 존재하지 않습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.proname = 'save_settings' and p.pronamespace = 'public'::regnamespace and p.pronargs = 3;
  if v_def is null
     or position('alert_sales_entry' in v_def) = 0
     or position('alert_fixed_cost_missing' in v_def) = 0
     or position('alert_price_spike' in v_def) = 0 then
    raise exception '0141: save_settings 알림 6종 계약이 적용되지 않았습니다';
  end if;

  if not exists (
    select 1 from pg_proc p
     where p.oid = 'public.get_settings(uuid)'::regprocedure
       and p.prosecdef
       and pg_get_userbyid(p.proowner) = 'costkeep_rpc_executor'
       and p.proconfig @> array['search_path=public, pg_temp']::text[]
  ) then
    raise exception '0141: get_settings의 definer·owner·search_path 계약이 유지되지 않았습니다';
  end if;

  if not exists (
    select 1 from pg_proc p
     where p.oid = 'public.save_settings(uuid,jsonb,integer)'::regprocedure
       and p.prosecdef
       and pg_get_userbyid(p.proowner) = 'postgres'
       and p.proconfig @> array['search_path=public, pg_temp']::text[]
  ) then
    raise exception '0141: save_settings의 definer·postgres owner·search_path 계약이 유지되지 않았습니다';
  end if;
end;
$$;
