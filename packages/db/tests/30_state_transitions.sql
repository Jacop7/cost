-- ════════════════════════════════════════════════════════════════
-- 30 · 영업 상태 전이 (0157) — 한 문 · 감사 · 자동 브레이크
--
-- 전이는 transition_business_state 한 문으로 들어오고, 몸통이 행을 잠그고
-- 상태를 재확인하며(틀리면 45014) 모든 전이가 감사 표에 남는다.
-- 설정된 브레이크 시간은 크론(apply_due_breaks)이 같은 몸통으로 전환한다 —
-- 경계 이후 전이 기록이 있으면 자동은 물러선다(사장님 결정이 이긴다).
-- ════════════════════════════════════════════════════════════════

-- ── ① 전이 한 문 + 감사 ────────────────────────────────────────
-- ⚠ 새 매장에서 잰다. 시드 매장의 오늘 장부는 판매·재고·발주가 FK 로 매달려 있어
--   "영업 전" 상태를 만들 수 없다 — 지우면 다섯 참조가 터진다. 빈 매장은 시작부터
--   종료까지 전이 네 개가 정확히 남는 깨끗한 표본이 된다.
do $t$
declare
  v_store uuid;
  v_day   date;
  v_id    uuid;
begin
  set local role postgres;
  insert into stores (owner_id, name) values (pg_temp.owner(), '시험 매장 전이')
    returning id into v_store;
  set local role authenticated;

  perform pg_temp.raises('영업 전 브레이크는 거부',
    format('select transition_business_state(%L, %L)', v_store, 'start_break'), '22000');
  perform pg_temp.raises('알 수 없는 전이는 거부',
    format('select transition_business_state(%L, %L)', v_store, 'nap'), '22000');

  perform pg_temp.eq_t('시작', transition_business_state(v_store, 'open')->>'status', 'open');
  select id, business_date into v_id, v_day from business_days
   where store_id = v_store and status = 'open';
  perform pg_temp.ok('시작이 감사에 남는다 — 영업 전(null)→open · manual',
    exists (select 1 from business_state_transitions
             where business_day_id = v_id and from_status is null
               and to_status = 'open' and method = 'manual' and by_user = pg_temp.owner()));

  perform pg_temp.eq_t('브레이크', transition_business_state(v_store, 'start_break')->>'status', 'break');
  perform pg_temp.raises('브레이크 중 또 브레이크는 45014',
    format('select transition_business_state(%L, %L)', v_store, 'start_break'), '45014');
  perform pg_temp.eq_t('재개', transition_business_state(v_store, 'resume')->>'status', 'open');
  perform pg_temp.raises('영업 중 재개는 45014',
    format('select transition_business_state(%L, %L)', v_store, 'resume'), '45014');

  perform pg_temp.ok('브레이크·재개가 감사에 남는다',
    exists (select 1 from business_state_transitions
             where business_day_id = v_id and from_status = 'open' and to_status = 'break' and method = 'manual')
    and exists (select 1 from business_state_transitions
             where business_day_id = v_id and from_status = 'break' and to_status = 'open' and method = 'manual'));

  perform transition_business_state(v_store, 'end');
  perform pg_temp.eq_t('종료가 상태에 보인다',
    (select status::text from business_days where id = v_id), 'closed');
  perform pg_temp.ok('종료도 같은 감사 표에 남는다 — 몸통(close_business_day_row)이 적는다',
    exists (select 1 from business_state_transitions
             where business_day_id = v_id and to_status = 'closed' and method = 'manual'));

  perform pg_temp.eq('이 장부의 전이는 정확히 4건 — 시작·브레이크·재개·종료',
    (select count(*) from business_state_transitions where business_day_id = v_id)::numeric, 4, 0);

  perform pg_temp.raises('종료 뒤 또 종료는 거부',
    format('select transition_business_state(%L, %L)', v_store, 'end'), '22000');
end $t$;


-- ── ② 자동 브레이크 — 크론이 같은 몸통으로 ─────────────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.open_today();
  v_id    uuid;
  v_rule  uuid;
  v_start timestamptz;
  v_res   jsonb;
begin
  select id into v_id from business_days
   where store_id = v_store and business_date = v_day;

  /*
   * 장부가 굳힌 규칙 행의 브레이크를 [00:00, 23:59] 로 소유자 직접 갱신한다(롤백).
   * 새 규칙 행을 넣지 않는 이유: 겹침 트리거(operating_rules_no_overlap)가 기간이
   * 무한한 기존 규칙과의 충돌을 막는다 — 우회가 아니라 굳은 규칙을 그대로 쓴다.
   * ⚠ 방금 연 시작 전이가 창 시작(오늘 00:00) 뒤라 자동이 물러선다 — 그게 규칙이다
   *   ("경계 이후 전이가 있으면 사장님 결정"). 그래서 기록을 창 앞으로 되민다.
   */
  select operating_rule_id into v_rule from business_days where id = v_id;
  set local role postgres;
  update operating_rules
     set weekly_breaks = (select jsonb_object_agg(d::text, jsonb_build_object('start','00:00','end','23:59'))
                            from generate_series(0, 6) d)
   where id = v_rule;
  v_start := (v_day::timestamp) at time zone store_timezone(v_store);   -- 오늘 00:00(매장 시간대)
  update business_state_transitions set at = v_start - interval '1 hour'
   where business_day_id = v_id;
  set local role authenticated;

  perform pg_temp.raises('사람은 자동 브레이크를 못 부른다',
    'select apply_due_breaks()', '42501');
  perform pg_temp.raises('몸통도 직접 못 부른다',
    format('select set_break_row(%L, true, %L)', v_id, 'manual'), '42501');

  set local role postgres;
  v_res := apply_due_breaks();
  set local role authenticated;
  perform pg_temp.ok('창 안이면 자동으로 브레이크', (v_res->>'break_started')::int >= 1);
  perform pg_temp.eq_t('상태가 브레이크다',
    (select status::text from business_days where id = v_id), 'break');
  perform pg_temp.ok('감사에 auto 로 남는다',
    exists (select 1 from business_state_transitions
             where business_day_id = v_id and to_status = 'break' and method = 'auto'));

  -- 사장님이 창 안에서 재개한다 — 그 결정이 이긴다. 크론이 다시 걸면 안 된다.
  perform transition_business_state(v_store, 'resume');
  set local role postgres;
  v_res := apply_due_breaks();
  set local role authenticated;
  perform pg_temp.eq_t('재개 뒤에도 크론이 다시 브레이크를 안 건다',
    (select status::text from business_days where id = v_id), 'open');

  /*
   * 자동 재개 — 창이 끝났으면(끝 경계 이후 전이 없음) 크론이 되돌린다.
   * 끝을 00:01 로 좁히고 상태·기록을 창 앞으로 되민다.
   */
  set local role postgres;
  update operating_rules
     set weekly_breaks = (select jsonb_object_agg(d::text, jsonb_build_object('start','00:00','end','00:01'))
                            from generate_series(0, 6) d)
   where id = v_rule;
  update business_days set status = 'break' where id = v_id;
  update business_state_transitions set at = v_start - interval '1 hour'
   where business_day_id = v_id;
  v_res := apply_due_breaks();
  set local role authenticated;
  perform pg_temp.ok('창이 끝나면 자동으로 재개', (v_res->>'resumed')::int >= 1);
  perform pg_temp.eq_t('상태가 다시 영업 중',
    (select status::text from business_days where id = v_id), 'open');
  perform pg_temp.ok('자동 재개도 감사에 남는다',
    exists (select 1 from business_state_transitions
             where business_day_id = v_id and from_status = 'break'
               and to_status = 'open' and method = 'auto'));
end $t$;


-- ── ③ 감사 표는 앱 롤이 못 쓴다 ────────────────────────────────
do $t$
begin
  perform pg_temp.raises('감사 표 직접 쓰기는 막혔다',
    format($q$insert into business_state_transitions
             (store_id, business_day_id, from_status, to_status, method)
           select %L, id, 'open', 'break', 'manual' from business_days limit 1$q$,
           pg_temp.store()), '42501');
  perform pg_temp.ok('읽기는 된다 — 내 매장 것',
    (select count(*) from business_state_transitions) >= 0);
end $t$;


-- ── ④ 과거 직접 열기 우회는 막혔다 (0160, 검토 P1-2) ────────────
/*
 * 실측된 우회: 인증 사용자가 open_business_day(store, '2020-01-01') 로 과거 날짜를
 * open 으로 만들 수 있었다 — 과거는 정정 RPC 만 쓰라는 규칙(§6.4)의 구멍.
 * 앱 문(전이·판매 저장)은 날짜를 못 받아 오늘만 연다.
 */
do $t$
begin
  perform pg_temp.raises('과거 날짜 직접 열기는 권한부터 없다',
    format('select open_business_day(%L, %L)', pg_temp.store(), '2020-01-01'), '42501');
  perform pg_temp.raises('오늘도 몸통 직접 호출은 막혔다',
    format('select open_business_day(%L)', pg_temp.store()), '42501');
  perform pg_temp.raises('종료 몸통도 막혔다',
    format('select close_business_day(%L)', pg_temp.store()), '42501');
  -- 앱 문은 살아 있다 — 문을 좁히다 문 자체를 잠그면 장사를 못 연다.
  perform pg_temp.ok('전이 문은 열려 있다',
    has_function_privilege('authenticated', 'public.transition_business_state(uuid, text, time)', 'execute'));
end $t$;


-- ── ⑤ 늦은 개점 — 오늘만, 종료 시간을 골라서 (0162, 검토 P1-4) ──
/*
 * 규칙 종료 + 유예가 지난 시각의 개점: 직접 시작은 크론이 1분 안에 닫고,
 * 첫 판매 시작은 45002 로 롤백됐다. 이제 45015 로 종료 시간을 요구하고,
 * 고른 시간은 그 영업일에만 굳는다(주간 설정 불변).
 *
 * ⚠ 시각 의존을 좁히려고 규칙을 00:01~00:02 로 둔다 — 자정 직후 2분을 빼면
 *   실행 시각이 언제든 "이미 지난 영업시간"이다.
 */
do $t$
declare
  v_store uuid;
  v_today date;
  v_res   jsonb;
begin
  set local role postgres;
  insert into stores (owner_id, name) values (pg_temp.owner(), '시험 매장 심야')
    returning id into v_store;
  update operating_rules
     set weekly_hours = (select jsonb_object_agg(d::text, jsonb_build_object('open','00:01','close','00:02'))
                           from generate_series(0, 6) d),
         weekly_breaks = '{}'::jsonb
   where store_id = v_store;
  set local role authenticated;

  v_today := store_local_date(v_store);

  -- 종료 시간 없이는 45015 — "골라 주세요"라는 다음 할 일이다(45001 과 같은 성격).
  perform pg_temp.raises('늦은 개점은 종료 시간을 요구한다',
    format('select transition_business_state(%L, %L)', v_store, 'open'), '45015');
  perform pg_temp.ok('45015 로 거부됐으면 장부도 안 생겼다',
    not exists (select 1 from business_days where store_id = v_store));

  -- 다음 영업 시작(내일 00:01)과 겹치는 선택은 거부 — 00:02 는 이미 지난 시각이라
  -- 내일 00:02 로 해석되고, 그건 내일 시작(00:01)을 넘는다.
  perform pg_temp.raises('다음 영업 시작과 겹치는 종료는 거부',
    format('select transition_business_state(%L, %L, %L)', v_store, 'open', '00:02'), '22000');

  -- 00:00 은 내일 00:00 으로 해석된다 — 내일 시작(00:01) 전이라 허용.
  v_res := transition_business_state(v_store, 'open', '00:00');
  perform pg_temp.ok('늦은 개점 성공', (v_res->>'late_open')::boolean is true);
  perform pg_temp.eq_t('고른 종료가 그 영업일에 굳는다',
    (select planned_close_at::text from business_days
      where store_id = v_store and business_date = v_today),
    (((v_today + 1)::timestamp) at time zone store_timezone(v_store))::text);
  -- 규칙 트리거가 시각을 HH:MM:SS 로 정규화한다 — time 으로 비교한다.
  perform pg_temp.ok('주간 설정은 그대로다 — 오늘에만 적용',
    (select (weekly_hours->'1'->>'close')::time from operating_rules
      where store_id = v_store and effective_to is null) = time '00:02');

  -- 이미 시작한 날의 종료 시간은 여기서 못 바꾼다 — 조용히 무시하지 않는다.
  perform pg_temp.raises('이미 연 날에 종료 시간 지정은 거부',
    format('select transition_business_state(%L, %L, %L)', v_store, 'open', '01:00'), '22000');

  -- 늦은 개점이 아닌 전이에 종료 시간을 실으면 거부 — 문은 늦은 개점뿐이다.
  perform pg_temp.raises('브레이크 전이에 종료 시간은 거부',
    format('select transition_business_state(%L, %L, %L)', v_store, 'start_break', '01:00'), '22000');
end $t$;


-- ── ⑥ 늦은 개점 종료 시각은 DST 안전하다 (0163, 검토 P1-3) ──────
/*
 * timestamptz + interval '1 day' 는 서머타임이 바뀌는 날 한 시간 어긋난다.
 * 다음 **현지 날짜**를 만들고 시간대를 적용해야 벽시계가 맞는다.
 */
do $t$
begin
  -- 뉴욕 2026-11-01 02:00 EDT→EST. 10/31 02:30 이 지난 뒤 고른 "02:30"은 11/1 02:30 EST(07:30Z).
  perform pg_temp.eq_t('가을 되돌림 — 다음 날 02:30 은 EST 07:30Z',
    late_close_at('2026-10-31', '02:30', 'America/New_York', '2026-11-01 08:00:00+00')::text,
    '2026-11-01 07:30:00+00'::timestamptz::text);
  -- 아직 안 지난 시각은 오늘 그대로.
  perform pg_temp.eq_t('안 지났으면 오늘 그 시각',
    late_close_at('2026-10-31', '23:00', 'America/New_York', '2026-10-31 20:00:00-04')::text,
    '2026-10-31 23:00:00-04'::timestamptz::text);
  -- 서울(서머타임 없음)은 두 방식이 같다 — 회귀 방지용 대조.
  perform pg_temp.eq_t('서울은 단순히 다음 날',
    late_close_at('2026-08-27', '00:30', 'Asia/Seoul', '2026-08-27 23:00:00+09')::text,
    '2026-08-28 00:30:00+09'::timestamptz::text);
  -- 봄 전환(뉴욕 3/8 02:00→03:00): 3/8 02:30 은 그날 없는 시각 — 03:30 으로 조용히 옮기지 않고 거부(0164).
  perform pg_temp.raises('봄 전환일의 없는 시각은 거부',
    $q$select late_close_at('2026-03-07', '02:30', 'America/New_York', '2026-03-08 08:00:00+00')$q$, '22000');
end $t$;
