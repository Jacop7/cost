/*
 * 0170 · get_settings 에 cup_volume 을 싣는다 — 앱 응답 계약(20키)과 맞춘다
 *
 * 검토 재현(P0): 앱 파서(parseStoreSettings)는 cup_volume 을 포함한 20개 키를 요구하는데 get_settings 는
 * 19개를 돌려줬다(cup_volume 없음). 정상 매장도 "설정 응답에 cup_volume 이 없거나…" 로 막혔다.
 * 엄격한 파서는 맞다 — 응답 쪽을 계약에 맞추고, **실제 RPC 응답의 키 집합**을 시험 32 가 잰다
 * (앱 시험은 손으로 만든 객체라 이 불일치를 못 잡았다).
 */
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
    -- 0170: 앱이 저장·표시하는 값인데 응답에 없었다(검토 P0).
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
             else (s.close_time - s.open_time) end) / 60)::int)
    from settings s where s.store_id = p_store;
$$;
comment on function public.get_settings(uuid) is
'설정 표시 폼(0170: cup_volume 포함 20키). 키 집합은 앱 parseStoreSettings 의 계약이고 시험 32 가 실제 응답으로 잰다.';

-- ── 사후조건 ────────────────────────────────────────────────────
do $$
declare v_keys text[];
begin
  select array_agg(k order by k) into v_keys
    from settings s, jsonb_object_keys(public.get_settings(s.store_id)) k
   limit 1;
  if v_keys is null then
    -- 설정 행이 없는 DB(새 DB 의 마이그레이션 시점)면 함수 본문으로만 확인한다.
    if position('''cup_volume'', s.cup_volume' in pg_get_functiondef('public.get_settings(uuid)'::regprocedure)) = 0 then
      raise exception '0170: get_settings 에 cup_volume 이 없습니다';
    end if;
  elsif not ('cup_volume' = any(v_keys)) or array_length(v_keys, 1) <> 20 then
    raise exception '0170: get_settings 키가 20개(cup_volume 포함)가 아닙니다: %', array_to_string(v_keys, ',');
  end if;
end $$;
