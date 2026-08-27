-- ════════════════════════════════════════════════════════════════
-- 32 · 설정 응답 계약 (0170) — get_settings 의 **실제 응답**이 앱 파서가 요구하는 키·타입 그대로인가
--
-- 검토 재현(P0): 앱은 cup_volume 포함 20키를 요구했고 RPC 는 19키를 줬다. 손으로 만든 객체로 재는 앱
-- 시험은 이 불일치를 못 잡는다 — 여기서 실제 RPC 를 부른다. 키 목록은 앱 SETTINGS_SHAPE 와 같아야 하고,
-- 앱 시험(settingsResponse)이 이 파일의 배열 리터럴을 읽어 파서 계약과 대조한다(양쪽 한 곳만 고치면 빨개진다).
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_res  jsonb := get_settings(pg_temp.store());
  v_keys text[];
  -- ⚠ 앱 parseStoreSettings 의 SETTINGS_SHAPE 와 같은 순서·같은 이름(정렬). 앱 시험이 이 리터럴을 읽는다.
  v_want text[] := array['alert_inbound_delay','alert_morning_summary','alert_price_spike','alert_target_miss',
                         'break_end','break_start','close_time','cup_volume','currency','default_target_profit_rate',
                         'locale','money_digits','open_minutes','open_time','overnight','quantity_digits',
                         'tax_items','tax_mode','unit_price_digits','unit_system'];
begin
  select array_agg(k order by k) into v_keys from jsonb_object_keys(v_res) k;
  perform pg_temp.eq_t('get_settings 의 실제 키 집합 = 앱 계약(20키)', array_to_string(v_keys, ','), array_to_string(v_want, ','));

  -- JSON 타입 — 파서가 요구하는 그대로.
  perform pg_temp.eq_t('문자열 키', (select string_agg(k || ':' || jsonb_typeof(v_res -> k), ',' order by k)
     from unnest(array['locale','currency','unit_system','tax_mode','open_time','close_time']) k),
     'close_time:string,currency:string,locale:string,open_time:string,tax_mode:string,unit_system:string');
  perform pg_temp.eq_t('숫자 키', (select string_agg(jsonb_typeof(v_res -> k), ',' order by k)
     from unnest(array['cup_volume','default_target_profit_rate','unit_price_digits','quantity_digits','money_digits','open_minutes']) k),
     'number,number,number,number,number,number');
  perform pg_temp.eq_t('참/거짓 키', (select string_agg(jsonb_typeof(v_res -> k), ',' order by k)
     from unnest(array['alert_morning_summary','alert_inbound_delay','alert_price_spike','alert_target_miss','overnight']) k),
     'boolean,boolean,boolean,boolean,boolean');
  perform pg_temp.ok('브레이크는 문자열 또는 null', jsonb_typeof(v_res -> 'break_start') in ('string','null')
                                              and jsonb_typeof(v_res -> 'break_end') in ('string','null'));
  perform pg_temp.eq_t('tax_items 는 배열', jsonb_typeof(v_res -> 'tax_items'), 'array');
  perform pg_temp.ok('시각은 HH:MM', (v_res ->> 'open_time') ~ '^\d\d:\d\d$' and (v_res ->> 'close_time') ~ '^\d\d:\d\d$');

  /*
   * 저장값 **보존**(검토 P1) — "양수인가"로는 상수 1 을 돌려줘도 통과했다. 눈에 띄는 값으로 저장한 뒤
   * 응답이 **행의 값 그대로**인지 잰다. 다른 통과 필드도 행과 직접 대조한다.
   */
  perform save_settings(pg_temp.store(), '{"cup_volume": 333, "quantity_digits": 3, "unit_price_digits": 1}'::jsonb);
  v_res := get_settings(pg_temp.store());
  perform pg_temp.eq('cup_volume 은 저장한 333 그대로', (v_res ->> 'cup_volume')::numeric, 333, 0);
  perform pg_temp.ok('통과 필드들이 settings 행과 같다',
    exists (select 1 from settings s where s.store_id = pg_temp.store()
             and (v_res ->> 'cup_volume')::numeric = s.cup_volume
             and (v_res ->> 'quantity_digits')::int = s.quantity_digits
             and (v_res ->> 'unit_price_digits')::int = s.unit_price_digits
             and (v_res ->> 'money_digits')::int = s.money_digits
             and (v_res ->> 'locale') = s.locale and (v_res ->> 'currency') = s.currency
             and (v_res ->> 'unit_system') = s.unit_system
             and (v_res ->> 'default_target_profit_rate')::numeric = s.default_target_profit_rate
             and (v_res ->> 'alert_morning_summary')::boolean = s.alert_morning_summary
             and (v_res ->> 'open_time') = to_char(s.open_time, 'HH24:MI')
             and (v_res ->> 'close_time') = to_char(s.close_time, 'HH24:MI')
             and (v_res -> 'tax_items') = s.tax_items));
end $t$;
