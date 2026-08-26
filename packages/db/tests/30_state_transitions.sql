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
    has_function_privilege('authenticated', 'public.transition_business_state(uuid, text)', 'execute'));
end $t$;
