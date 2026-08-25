-- ════════════════════════════════════════════════════════════════
-- 25 · 영업시간 규칙 버전 (0129 · 0130)
--
-- 고치려는 것은 기획서 §2.2 다 —
--   `settings` 에 영업시간이 한 벌뿐이라, 시간을 바꾸면 **과거 날짜 해석까지** 바뀐다.
--   8월 내내 11–22시로 장사한 가게가 9월에 18–02시로 바꾸면,
--   8월 어느 날의 예정 종료를 다시 물었을 때 새 시간이 나온다.
--
-- 지키는 계약:
--   ① 어느 날짜를 물어도 규칙이 있다 (아주 옛날도)
--   ② 규칙을 바꿔도 **옛 날짜는 옛 규칙**으로 답한다
--   ③ 영업 중에 바꾸면 **오늘은 안 바뀐다** — 다음 날부터다
--   ④ 이미 열린 장부의 예정 종료는 **저장된 값 그대로** 남는다
--   ⑤ 요일별로 다른 시간을 줄 수 있고, 자정 넘김(close < open)은 서버가 계산한다
--   ⑥ 규칙은 겹칠 수 없고, 형식이 틀리면 **저장 시점에** 막힌다
-- ════════════════════════════════════════════════════════════════

-- 요일 7개를 같은 시간으로 채운 weekly_hours.
create function pg_temp.hours(p_open text, p_close text) returns jsonb
language sql immutable as $h$
  select jsonb_object_agg(d::text, jsonb_build_object(
           'open', p_open, 'close', p_close, 'closed', false))
    from generate_series(0, 6) d
$h$;


-- ── ① 어느 날짜를 물어도 규칙이 있다 ──────────────────────────
do $t$
declare v_store uuid := pg_temp.store();
begin
  perform pg_temp.ok('아주 옛 날짜에도 규칙이 있다',
    store_hours_on(v_store, date '2001-01-01') is not null);
  perform pg_temp.ok('먼 미래에도 규칙이 있다',
    store_hours_on(v_store, date '2099-12-31') is not null);
  perform pg_temp.eq_t('시드 시간은 11:00~22:00',
    (store_hours_on(v_store, business_day())->>'open_time') || '~' ||
    (store_hours_on(v_store, business_day())->>'close_time'), '11:00:00~22:00:00');
  perform pg_temp.eq('낮 영업이면 종료가 같은 날',
    (store_hours_on(v_store, business_day())->>'close_day_offset')::numeric, 0, 0);
end $t$;


-- ── ②③④ 소급하지 않는다 ─────────────────────────────────────
-- 이 파일의 핵심이다. 영업 **중에** 시간을 바꾸고, 셋을 확인한다.
do $t$
declare
  v_store  uuid := pg_temp.store();
  v_today  date;
  v_res    jsonb;
  v_before timestamptz;
  v_after  timestamptz;
  v_stored timestamptz;
  v_yday   date;
  v_yclose timestamptz;
begin
  v_today := pg_temp.open_today();          -- 영업 중으로 만든다
  v_yday  := v_today - 7;

  -- 바꾸기 **전에** 옛 규칙이 내는 값을 적어 둔다.
  v_before := planned_close(v_store, v_today);
  v_yclose := planned_close(v_store, v_yday);
  select planned_close_at into v_stored from business_days
   where store_id = v_store and business_date = v_today;

  perform pg_temp.ok('시작할 때 예정 종료가 저장됐다', v_stored is not null);
  perform pg_temp.eq_t('저장값 = 그날 규칙이 내는 값', v_stored::text, v_before::text);
  perform pg_temp.ok('시작할 때 규칙 id 도 남았다',
    (select operating_rule_id from business_days
      where store_id = v_store and business_date = v_today) is not null);

  -- ── 영업 중에 18:00~02:00 으로 바꾼다 ──
  v_res := set_operating_hours(v_store, pg_temp.hours('18:00', '02:00'));

  perform pg_temp.ok('오늘부터가 아니다', (v_res->>'applies_today')::boolean is false);
  perform pg_temp.eq_t('다음 날부터다', (v_res->>'effective_from')::date::text, (v_today + 1)::text);

  -- ② 옛 날짜는 옛 규칙으로
  perform pg_temp.eq_t('지난주 예정 종료가 안 바뀌었다',
    planned_close(v_store, v_yday)::text, v_yclose::text);
  perform pg_temp.eq_t('지난주 영업시간도 옛 값',
    store_hours_on(v_store, v_yday)->>'close_time', '22:00:00');

  -- ③ 오늘도 안 바뀐다
  perform pg_temp.eq_t('오늘 예정 종료가 안 바뀌었다',
    planned_close(v_store, v_today)::text, v_before::text);
  perform pg_temp.eq_t('오늘 영업시간도 옛 값',
    store_hours_on(v_store, v_today)->>'close_time', '22:00:00');

  -- ④ 저장된 장부 값은 그대로
  select planned_close_at into v_after from business_days
   where store_id = v_store and business_date = v_today;
  perform pg_temp.eq_t('장부에 박힌 예정 종료도 그대로', v_after::text, v_stored::text);

  -- 그리고 내일부터는 새 규칙이다. 자정을 넘기니 종료는 **다음 날** 02:00 이다.
  perform pg_temp.eq_t('내일은 새 시간', store_hours_on(v_store, v_today + 1)->>'close_time', '02:00:00');
  perform pg_temp.eq('내일은 자정을 넘긴다',
    (store_hours_on(v_store, v_today + 1)->>'close_day_offset')::numeric, 1, 0);
  perform pg_temp.eq_t('내일 예정 종료는 모레 02:00',
    planned_close(v_store, v_today + 1)::text,
    (((v_today + 2)::timestamp + '02:00'::time) at time zone store_timezone(v_store))::text);
end $t$;


-- ── ⑤ 요일별로 다르게 ────────────────────────────────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_today date := store_local_date(v_store);
  v_h     jsonb;
  v_sun   date;
begin
  -- 일요일만 휴무로 표시하고 시간도 다르게 준다.
  v_h := jsonb_set(pg_temp.hours('11:00', '22:00'), '{0}',
           jsonb_build_object('open', '12:00', 'close', '15:00', 'closed', true));

  -- 오늘 장부를 닫아 두면 새 규칙이 **내일부터**다. 요일 확인은 미래 날짜로 한다.
  perform pg_temp.close_today();
  perform set_operating_hours(v_store, v_h);

  -- 다음 일요일을 찾는다(오늘 이후 · 새 규칙 적용 범위 안).
  select d into v_sun from generate_series(v_today + 1, v_today + 8, '1 day') g(d)
   where extract(dow from d) = 0 limit 1;

  perform pg_temp.eq_t('일요일은 12:00 시작', store_hours_on(v_store, v_sun)->>'open_time', '12:00:00');
  perform pg_temp.ok('일요일은 휴무 표시', (store_hours_on(v_store, v_sun)->>'closed')::boolean);
  perform pg_temp.ok('휴무여도 예정 종료는 있다 — null 이면 자동 마감이 하염없이 밀린다',
    planned_close(v_store, v_sun) is not null);

  -- 월요일은 그대로 11~22.
  perform pg_temp.eq_t('월요일은 11:00 시작',
    store_hours_on(v_store, v_sun + 1)->>'open_time', '11:00:00');
  perform pg_temp.ok('월요일은 휴무가 아니다',
    (store_hours_on(v_store, v_sun + 1)->>'closed')::boolean is false);
end $t$;


-- ── ⑥ 겹침·형식은 저장 시점에 막힌다 ──────────────────────────
do $t$
declare v_store uuid := pg_temp.store();
begin
  -- 겹치는 규칙을 손으로 밀어 넣어 본다.
  perform pg_temp.raises('겹치는 규칙은 거부',
    format('insert into operating_rules (store_id, effective_from, effective_to, weekly_hours)
            values (%L, %L, %L, %L::jsonb)',
           v_store, date '2001-01-01', date '2001-12-31', pg_temp.hours('09:00','18:00')::text),
    '23505');

  -- 요일이 빠지면 거부.
  perform pg_temp.raises('요일이 모자라면 거부',
    format('insert into operating_rules (store_id, effective_from, weekly_hours)
            values (%L, %L, %L::jsonb)',
           v_store, date '2090-01-01', '{"0":{"open":"09:00","close":"18:00"}}'),
    '22000');

  -- 시각이 시각이 아니면 거부. `('25:00')::time` 은 22007 이다.
  perform pg_temp.raises('시각 형식이 틀리면 거부',
    format('insert into operating_rules (store_id, effective_from, weekly_hours)
            values (%L, %L, %L::jsonb)',
           v_store, date '2091-01-01', pg_temp.hours('25:00','18:00')::text));

  -- 브레이크에 start 만 있으면 거부.
  perform pg_temp.raises('반쪽 브레이크는 거부',
    format('insert into operating_rules (store_id, effective_from, weekly_hours, weekly_breaks)
            values (%L, %L, %L::jsonb, %L::jsonb)',
           v_store, date '2092-01-01', pg_temp.hours('09:00','18:00')::text,
           '{"1":{"start":"15:00"}}'),
    '22000');
end $t$;


-- ── ⑦ 앱이 실제로 쓰는 경로 (save_settings) ───────────────────
-- ⚠ 앱은 `set_operating_hours` 를 직접 안 부른다. MY > 영업시간은 `save_settings` 로 간다.
--   그래서 여기까지 확인하지 않으면 "규칙은 잘 도는데 화면에서 저장하면 안 바뀐다"가 된다.
--   실제로 처음엔 settings 만 바뀌고 규칙은 옛 값으로 남았다.
do $t$
declare
  v_store uuid := pg_temp.store();
  v_today date;
  v_before timestamptz;
begin
  v_today  := pg_temp.open_today();          -- 영업 중
  v_before := planned_close(v_store, v_today);

  perform save_settings(v_store, jsonb_build_object('open_time', '18:00', 'close_time', '02:00'));

  -- settings 는 바로 바뀐다(입력 폼이니까).
  perform pg_temp.eq_t('settings 는 새 값',
    (select close_time::text from settings where store_id = v_store), '02:00:00');

  -- 규칙도 따라왔다. 다만 **내일부터**다.
  perform pg_temp.eq_t('오늘은 옛 규칙 그대로',
    store_hours_on(v_store, v_today)->>'close_time', '22:00:00');
  perform pg_temp.eq_t('내일부터 새 규칙',
    store_hours_on(v_store, v_today + 1)->>'close_time', '02:00:00');
  perform pg_temp.eq_t('오늘 예정 종료도 그대로',
    planned_close(v_store, v_today)::text, v_before::text);

  -- 시간과 무관한 저장은 규칙을 안 건드린다.
  perform save_settings(v_store, jsonb_build_object('money_digits', 1));
  perform pg_temp.eq('규칙 개수가 안 늘었다',
    (select count(*) from operating_rules where store_id = v_store), 2, 0);

  -- 같은 날 또 고치면 예약 규칙을 **덮어쓴다** — 규칙이 계속 쌓이면 안 된다.
  perform save_settings(v_store, jsonb_build_object('open_time', '17:00', 'close_time', '01:00'));
  perform pg_temp.eq('그래도 규칙은 2개',
    (select count(*) from operating_rules where store_id = v_store), 2, 0);
  perform pg_temp.eq_t('내일 값이 갱신됐다',
    store_hours_on(v_store, v_today + 1)->>'open_time', '17:00:00');
  perform pg_temp.eq_t('오늘은 여전히 옛 규칙',
    store_hours_on(v_store, v_today)->>'open_time', '11:00:00');
end $t$;
