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
    (store_hours_on(v_store, pg_temp.today())->>'open_time') || '~' ||
    (store_hours_on(v_store, pg_temp.today())->>'close_time'), '11:00:00~22:00:00');
  perform pg_temp.eq('낮 영업이면 종료가 같은 날',
    (store_hours_on(v_store, pg_temp.today())->>'close_day_offset')::numeric, 0, 0);
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
-- ⚠ 여기만 **postgres 로 올라가서** 시험한다(0132). 앱 사용자에게는 직접 쓰기 권한이
--   아예 없어서(⑧ 참고) 트리거까지 가지도 못한다. 그래도 이 방어선은 살아 있어야 한다 —
--   `set_operating_hours` 에 버그가 생겨도 겹친 규칙이 저장되면 안 되기 때문이다.
do $t$
declare v_store uuid := pg_temp.store();
begin
  set local role postgres;
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
  set local role authenticated;   -- 다음 블록은 다시 앱 사용자로 돈다
end $t$;


-- ── ⑧ 규칙 이력은 손으로 못 고친다 (0132) ─────────────────────
-- 규칙을 직접 고칠 수 있으면 소급 방지가 통째로 무너진다 —
-- 8월 규칙의 시각을 손으로 바꾸면 8월 예정 종료가 다시 계산된다. 막으려던 그것이다.
do $t$
declare v_store uuid := pg_temp.store();
begin
  perform pg_temp.ok('읽기는 된다',
    (select count(*) from operating_rules where store_id = v_store) > 0);

  -- 42501 = insufficient_privilege. RLS 가 아니라 **권한**에서 막힌다.
  perform pg_temp.raises('직접 수정은 막힌다',
    'update operating_rules set weekly_hours = weekly_hours', '42501');
  perform pg_temp.raises('직접 삭제도 막힌다',
    'delete from operating_rules', '42501');
  perform pg_temp.raises('직접 추가도 막힌다',
    format('insert into operating_rules (store_id, effective_from, weekly_hours)
            values (%L, %L, %L::jsonb)',
           v_store, date '2095-01-01', pg_temp.hours('09:00','18:00')::text),
    '42501');

  -- 그런데 RPC 로는 된다. 문이 하나뿐이라는 뜻이다.
  perform pg_temp.ok('RPC 로는 바꿀 수 있다',
    (set_operating_hours(v_store, pg_temp.hours('12:00','23:00'))->>'rule_id') is not null);

  /*
   * ⚠ 여기가 진짜 확인이다(0133). 위 세 개는 **권한**이 막은 것일 수도 있는데,
   *   권한은 `grant all on all tables` 한 줄로 조용히 되살아난다 — 실제로 내 새 DB
   *   빌드 스크립트가 그러고 있었고 아무도 못 봤다.
   *   그래서 권한과 정책을 **0129 원래 상태로 되살린 뒤**에도 막히는지 본다.
   *   (전부 이 트랜잭션 안이라 롤백된다.)
   */
  set local role postgres;
  grant insert, update, delete, truncate on operating_rules to authenticated;
  drop policy if exists pg_temp_rw on operating_rules;
  create policy pg_temp_rw on operating_rules for all to authenticated
    using (store_id in (select my_store_ids())) with check (store_id in (select my_store_ids()));
  set local role authenticated;

  perform pg_temp.raises('권한·정책이 되살아나도 막힌다',
    'update operating_rules set weekly_hours = weekly_hours', '42501');
  perform pg_temp.raises('추가도 마찬가지',
    format('insert into operating_rules (store_id, effective_from, weekly_hours)
            values (%L, %L, %L::jsonb)',
           v_store, date '2096-01-01', pg_temp.hours('09:00','18:00')::text),
    '42501');
  /*
   * ⚠ TRUNCATE 는 **행 트리거를 안 부른다**(0134). 0133 만 있을 땐 여기로 새어 나갔다 —
   *   `truncate ... cascade` 한 줄이면 규칙 이력과 영업일이 같이 사라진다.
   *   문장 트리거로 따로 막는다.
   */
  perform pg_temp.raises('비우기(truncate)도 막힌다',
    'truncate operating_rules cascade', '42501');
  perform pg_temp.raises('영업일 비우기도 막힌다',
    'truncate business_days cascade', '42501');

  -- 그 상태에서도 RPC 는 통과해야 한다. 막기만 하고 길이 없으면 그건 고장이다.
  perform pg_temp.ok('그 상태에서도 RPC 는 통과',
    (set_operating_hours(v_store, pg_temp.hours('13:00','23:30'))->>'rule_id') is not null);
end $t$;


-- ── ⑩ operating_hours_status 계약 (0131) ──────────────────────
-- 마이그레이션의 사후 확인은 **적용될 때 한 번**이다. 이 함수는 화면이 "언제부터
-- 적용되는지" 말하는 유일한 근거라, 나중에 덮어써지면 그 안내가 조용히 사라진다.
do $t$
declare
  v_store uuid := pg_temp.store();
  v_res   jsonb;
  v_today date;
begin
  v_today := store_local_date(v_store);

  /*
   * ⚠ 앞 블록들이 예약 규칙을 만들고 **활성 규칙의 시각까지 바꿔 놨다.**
   *   여기서 `pending 은 null`·`today 는 22:00` 을 그냥 기대하면 **앞 블록 순서에
   *   기대는 시험**이 된다 — 파일을 재배치하거나 앞 블록을 고치는 순간 깨진다.
   *   예약을 지우는 것만으로는 부족하다. 활성 규칙의 **내용까지** 되돌려야 독립적이다.
   *   (규칙은 앱 권한으로 못 고치므로 소유자로 올라간다.)
   */
  set local role postgres;
  delete from operating_rules where store_id = v_store and effective_from > v_today;
  update operating_rules
     set effective_to  = null,
         weekly_hours  = (select jsonb_object_agg(d::text, jsonb_build_object(
                                   'open', '11:00:00', 'close', '22:00:00', 'closed', false))
                            from generate_series(0, 6) d),
         weekly_breaks = '{}'::jsonb
   where id = (select id from operating_rules
                where store_id = v_store order by effective_from desc limit 1);
  -- 다른 규칙이 남아 있으면 위 하나만 고쳐도 소용없다.
  if (select count(*) from operating_rules where store_id = v_store) <> 1 then
    raise exception '⑩ 출발점: 규칙이 %개입니다 — 1개여야 합니다',
      (select count(*) from operating_rules where store_id = v_store);
  end if;
  set local role authenticated;

  v_res := operating_hours_status(v_store);

  perform pg_temp.eq_t('local_date = 매장 현지 날짜', v_res->>'local_date', v_today::text);
  perform pg_temp.eq_t('today 는 그날 유효한 규칙과 같다',
    (v_res->'today')::text, store_hours_on(v_store, v_today)::text);
  -- 앱이 'HH:MM(:SS)' 로 검사한다. 여기서 어긋나면 화면이 오류로 뜬다.
  perform pg_temp.ok('today 시각이 시각 형식',
    (v_res->'today'->>'open_time') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$');

  -- 예약이 없으면 **null** 이어야 한다. 빈 객체면 앱이 "예약이 있다"로 읽는다.
  perform pg_temp.close_today();      -- 오늘을 닫아 둬야 다음 변경이 내일부터가 된다
  perform pg_temp.ok('예약이 없으면 pending 은 null',
    jsonb_typeof(operating_hours_status(v_store)->'pending') = 'null');

  -- 예약을 만들면 그 날짜와 그날 규칙이 실려 온다.
  perform set_operating_hours(v_store, pg_temp.hours('18:00','02:00'));
  v_res := operating_hours_status(v_store);
  perform pg_temp.eq_t('pending 시작일 = 내일',
    v_res->'pending'->>'effective_from', (v_today + 1)::text);
  perform pg_temp.eq_t('pending 시간 = 그날 규칙',
    (v_res->'pending'->'hours')::text, store_hours_on(v_store, v_today + 1)::text);
  perform pg_temp.eq_t('pending 종료 시각', v_res->'pending'->'hours'->>'close_time', '02:00:00');
  -- 그리고 today 는 **안 바뀐다.** 이게 이 화면이 말해야 하는 전부다.
  perform pg_temp.eq_t('today 는 그대로', v_res->'today'->>'close_time', '22:00:00');
end $t$;


-- ── ⑨ 장부와 규칙이 갈리지 않는다 (0132 경합) ──────────────────
/*
 * 잠금이 없으면 이 불변식이 깨진다. 실측한 순서는 —
 *     A 시간 변경: 열린 영업일 없음 확인
 *     B 영업 시작: 옛 규칙으로 오늘 장부 생성
 *     A 새 규칙을 **오늘부터** 적용
 * 결과: 장부는 22:00 규칙을 가리키는데 그날 유효한 규칙은 02:00, 예정 종료가 4시간 갈렸다.
 *
 * ⚠ 동시 실행은 한 트랜잭션 안에서 못 만든다. 대신 **결과 불변식**을 못 박는다 —
 *   깨진 상태가 만들어지면 여기서 걸린다.
 */
do $t$
declare v_store uuid := pg_temp.store(); v_bad int;
begin
  perform pg_temp.open_today();

  select count(*) into v_bad
    from business_days d
   where d.store_id = v_store
     and d.operating_rule_id is distinct from (select id from operating_rule_at(d.store_id, d.business_date));
  perform pg_temp.eq('모든 장부가 그날 유효한 규칙을 가리킨다', v_bad, 0, 0);

  select count(*) into v_bad
    from business_days d
   where d.store_id = v_store
     and d.planned_close_at is distinct from planned_close(d.store_id, d.business_date);
  perform pg_temp.eq('저장된 예정 종료 = 그날 규칙이 내는 값', v_bad, 0, 0);
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


-- ════════════════════════════════════════════════════════════════
-- 주간 일정 의미 검증 (0156) — 공개 문(set_operating_hours)으로 잰다
--
-- 모양 검증만 있던 시절엔 뜻이 틀린 값이 다 들어갔다. 겹치는 자정 넘김이
-- 저장되면 그 시각의 판매가 어느 영업일인지 **정의가 안 된다.**
-- ════════════════════════════════════════════════════════════════
do $t$
declare
  v_all  jsonb := (select jsonb_object_agg(d::text, jsonb_build_object('open','11:00','close','22:00'))
                     from generate_series(0, 6) d);
begin
  -- 시작=종료 — 영업일 경계를 못 정한다.
  perform pg_temp.raises('시작=종료 거부',
    format('select set_operating_hours(%L, %L::jsonb)', pg_temp.store(),
      (select jsonb_object_agg(d::text, jsonb_build_object('open','10:00','close','10:00'))
         from generate_series(0, 6) d)::text), '22000');

  -- 영업시간 밖 브레이크.
  perform pg_temp.raises('영업시간 밖 브레이크 거부',
    format('select set_operating_hours(%L, %L::jsonb, %L::jsonb)', pg_temp.store(),
      v_all::text, jsonb_build_object('1', jsonb_build_object('start','23:00','end','23:30'))::text),
    '22000');

  -- 브레이크 시작=종료.
  perform pg_temp.raises('브레이크 시작=종료 거부',
    format('select set_operating_hours(%L, %L::jsonb, %L::jsonb)', pg_temp.store(),
      v_all::text, jsonb_build_object('1', jsonb_build_object('start','15:00','end','15:00'))::text),
    '22000');

  -- 자정 넘김이 다음 날 영업과 겹친다 — 월요일이 새벽 2:30 에 닫는데 화요일이 2:00 에 연다.
  -- ⚠ 표본은 요일별로 달라야 한다. 균일한 주간표는 겹침이 성립 불가다(0156 주석).
  perform pg_temp.raises('다음 날과 겹치는 자정 넘김 거부',
    format('select set_operating_hours(%L, %L::jsonb)', pg_temp.store(),
      jsonb_set(
        (select jsonb_object_agg(d::text, jsonb_build_object('open','02:00','close','22:00'))
           from generate_series(0, 6) d),
        '{1}', jsonb_build_object('open','18:00','close','02:30'))::text), '22000');

  -- 휴무일의 브레이크 — 뜻이 없다.
  perform pg_temp.raises('휴무일 브레이크 거부',
    format('select set_operating_hours(%L, %L::jsonb, %L::jsonb)', pg_temp.store(),
      jsonb_set(v_all, '{1}', jsonb_build_object('open','11:00','close','22:00','closed',true))::text,
      jsonb_build_object('1', jsonb_build_object('start','15:00','end','16:00'))::text),
    '22000');

  -- 02:00~02:00 은 경계 사례처럼 보여도 폭이 0이다 — 시작=종료 거부.
  perform pg_temp.raises('02:00~02:00 도 시작=종료라 거부',
    format('select set_operating_hours(%L, %L::jsonb)', pg_temp.store(),
      (select jsonb_object_agg(d::text, jsonb_build_object('open','02:00','close','02:00'))
         from generate_series(0, 6) d)::text), '22000');
end $t$;

do $t$
declare
  v_res jsonb;
begin
  -- 18:00~02:00 + 다음 날 02:00 오픈(= 경계 맞닿음)은 허용된다.
  v_res := set_operating_hours(pg_temp.store(),
    (select jsonb_object_agg(d::text, jsonb_build_object('open','02:00','close','01:00'))
       from generate_series(0, 6) d),
    (select jsonb_object_agg(d::text, jsonb_build_object('start','00:00','end','00:30'))
       from generate_series(0, 6) d));
  perform pg_temp.ok('경계가 맞닿는 자정 넘김(02:00 오픈·다음 날 01:00 마감)은 허용',
    v_res ? 'rule_id');
  perform pg_temp.ok('새벽 구간 브레이크(00:00~00:30)도 영업시간 안', true);

  -- 원상 복구 — 이 파일 뒤 블록과 다른 시험이 기본 시간에 기대지 않게.
  perform set_operating_hours(pg_temp.store(),
    (select jsonb_object_agg(d::text, jsonb_build_object('open','11:00','close','22:00'))
       from generate_series(0, 6) d));
end $t$;
