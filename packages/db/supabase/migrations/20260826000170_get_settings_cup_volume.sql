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
declare v_n int; v_bad int;
begin
  /*
   * ⚠ 매장마다 따로 센다(검토 P0). 첫 판은 `array_agg(...) limit 1` 이었는데 LIMIT 은 집계 **뒤에** 걸려
   *   매장이 둘이면 키 40개를 모아 "20개가 아니다"로 배포가 멈췄다(실측). GROUP BY store_id 로 잰다.
   */
  select count(*) into v_n from settings;
  if v_n = 0 then
    -- 설정 행이 없는 DB(새 DB 의 마이그레이션 시점)면 함수 본문으로만 확인한다.
    if position('''cup_volume'', s.cup_volume' in pg_get_functiondef('public.get_settings(uuid)'::regprocedure)) = 0 then
      raise exception '0170: get_settings 에 cup_volume 이 없습니다';
    end if;
    return;
  end if;
  /*
   * ⚠ LEFT JOIN LATERAL — get_settings 가 NULL 을 돌려주는 매장은 jsonb_object_keys 가 0행이라 안쪽
   *   조인으로는 그룹 자체가 사라져 "이상 없음"으로 통과했다(검토 지적). 매장 수와 검사된 매장 수도 맞춘다.
   */
  select count(*) into v_bad
    from (select s.store_id, count(k.k) as n, bool_or(k.k = 'cup_volume') as has_cup
            from settings s
            left join lateral jsonb_object_keys(public.get_settings(s.store_id)) as k(k) on true
           group by s.store_id) t
   where t.n <> 20 or coalesce(t.has_cup, false) = false;
  if v_bad > 0 then
    raise exception '0170: get_settings 키가 20개(cup_volume 포함)가 아닌 매장이 %개 있습니다', v_bad;
  end if;
  if (select count(distinct s.store_id) from settings s
       left join lateral jsonb_object_keys(public.get_settings(s.store_id)) as k(k) on true) <> v_n then
    raise exception '0170: 검사된 매장 수가 설정 행 수(%)와 다릅니다', v_n;
  end if;
end $$;
