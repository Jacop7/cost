-- ════════════════════════════════════════════════════════════════
-- 0029 · 설정 저장 (MY-06 단위 · MY-08 언어/통화 · 알림)
--
-- 지금까지 언어·통화·소수점 자릿수는 앱의 zustand 에만 있었다.
-- 앱을 지웠다 깔면 초기화되고, 기기를 바꾸면 따라오지 않는다.
-- 설정은 **매장의 속성**이지 기기의 속성이 아니므로 DB 에 둔다.
--
-- ⚠ 언어 전환 자체는 아직 켜지 않는다(사용자 결정). 여기 저장되는 값은
--   **숫자 표기**(천단위 구분·소수점 기호·자릿수·통화 기호)에만 쓰인다.
-- ════════════════════════════════════════════════════════════════

alter table settings
  add column if not exists locale            text    not null default 'ko-KR',
  add column if not exists currency          text    not null default 'KRW',
  -- 단가(원/g)는 소수점이 필요하고, 수량은 대개 정수다. 둘을 한 값으로 묶으면
  -- "4.71원/g" 을 위해 "12.00개"를 감수해야 한다.
  add column if not exists unit_price_digits smallint not null default 2,
  add column if not exists quantity_digits   smallint not null default 0,
  add column if not exists money_digits      smallint not null default 0;

alter table settings
  add constraint settings_digits_ck check (
    unit_price_digits between 0 and 4 and
    quantity_digits   between 0 and 4 and
    money_digits      between 0 and 4
  ) not valid;

create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker as $fn$
begin
  perform assert_my_store(p_store);

  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;

  update settings set
    unit_system                = coalesce(p_payload->>'unit_system', unit_system),
    cup_volume                 = coalesce((p_payload->>'cup_volume')::numeric, cup_volume),
    default_target_profit_rate = coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate),
    locale                     = coalesce(nullif(p_payload->>'locale',''), locale),
    currency                   = coalesce(nullif(p_payload->>'currency',''), currency),
    unit_price_digits          = coalesce((p_payload->>'unit_price_digits')::smallint, unit_price_digits),
    quantity_digits            = coalesce((p_payload->>'quantity_digits')::smallint, quantity_digits),
    money_digits               = coalesce((p_payload->>'money_digits')::smallint, money_digits),
    alert_morning_summary      = coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary),
    alert_inbound_delay        = coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay),
    alert_price_spike          = coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike),
    alert_target_miss          = coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss),
    updated_at                 = now()
  where store_id = p_store;

  return (select to_jsonb(s) from settings s where s.store_id = p_store);
end;
$fn$;

create or replace function public.get_settings(p_store uuid)
returns jsonb language sql stable security invoker as $fn$
  select to_jsonb(s) from settings s where s.store_id = p_store;
$fn$;

select public.assert_no_rpc_overloads();
