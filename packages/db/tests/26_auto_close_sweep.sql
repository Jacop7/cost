-- ════════════════════════════════════════════════════════════════
-- 26 · 자동 마감 스윕 (0137)
--
-- 고치려는 것 둘 (기획서 §2.4 · §2.5) —
--   ① 앱을 안 열면 마감이 안 됐다. 8/22 장부에 `8/23 08:25` 가 찍혀 있었다.
--   ② 마감 기한이 `max(예정 종료, 마지막 활동 + 1시간)` 이라 **판매를 계속 넣으면
--      끝없이 밀렸다.** 브레이크 버튼도 활동으로 쳐서 마감을 미뤘다.
--
-- 지키는 계약:
--   ① 기한이 지나면 닫는다
--   ② **활동이 기한을 못 민다** — 이게 이 파일의 핵심이다
--   ③ 닫힌 시각은 **마감 기한**(예정 종료 + 유예)이다. 스윕이 돈 시각이 아니다.
--      ⚠ 0137 은 여기를 `예정 종료` 로 적었다가 `판매 22:45 / 종료 22:00` 을 만들었다.
--        화면의 `11:00–22:00` 은 `planned_close_at` 으로 그린다 — 뜻이 다른 값이다(0138).
--   ④ 아직 기한 전이면 안 닫는다
--   ⑤ 수동 마감과 **같은 몸통**이라 스냅샷이 갈리지 않는다
--   ⑥ 사람은 못 부른다 (매장을 안 가리는 definer 다)
-- ════════════════════════════════════════════════════════════════

-- 스윕은 definer 라 소유자로 부른다. 앱은 어차피 못 부른다(⑥에서 확인).
create function pg_temp.sweep() returns jsonb
language plpgsql as $h$
declare v_res jsonb;
begin
  set local role postgres;
  v_res := close_due_business_days();
  set local role authenticated;
  return v_res;
end $h$;

-- 오늘 영업일의 예정 종료를 원하는 시각으로 옮긴다(시험은 실제 시각에 안 기댄다).
create function pg_temp.set_close(p_at timestamptz) returns void
language plpgsql as $h$
begin
  set local role postgres;
  update business_days set planned_close_at = p_at
   where store_id = pg_temp.store() and business_date = pg_temp.today();
  set local role authenticated;
end $h$;


-- ── ①②③ 기한이 지나면 닫고, 활동은 기한을 못 민다 ────────────
do $t$
declare
  v_day   date;
  v_id    uuid;
  v_due   timestamptz;
  v_res   jsonb;
  v_st    text;
  v_closed timestamptz;
begin
  v_day := pg_temp.open_today();
  select id into v_id from business_days
   where store_id = pg_temp.store() and business_date = v_day;

  -- 예정 종료를 3시간 전으로 옮긴다 → 유예(1시간)까지 지났으니 기한이 지났다.
  v_due := now() - interval '3 hours';
  perform pg_temp.set_close(v_due);

  /*
   * ⚠ 여기가 핵심이다. **지금 막 활동한 것으로 만든다.**
   *   옛 규칙(`마지막 활동 + 1시간`)이면 기한이 1시간 뒤로 밀려 안 닫힌다.
   *   새 규칙은 활동을 안 보므로 그대로 닫혀야 한다.
   */
  set local role postgres;
  update business_days set last_activity_at = now() where id = v_id;
  set local role authenticated;

  v_res := pg_temp.sweep();
  perform pg_temp.eq('기한이 지난 영업일을 닫는다', (v_res->>'closed')::int, 1, 0);
  perform pg_temp.eq('실패는 없다', (v_res->>'failed')::int, 0, 0);

  select status::text, closed_at into v_st, v_closed from business_days where id = v_id;
  perform pg_temp.eq_t('상태가 closed', v_st, 'closed');
  perform pg_temp.eq_t('종료 방식이 auto',
    (select close_method::text from business_days where id = v_id), 'auto');

  /*
   * ③ 닫힌 시각 = **기한**(예정 종료 + 유예). 스윕이 돈 시각이 아니다.
   *
   * ⚠ 0137 은 여기를 `예정 종료` 로 적었다가 장부에 모순을 만들었다 —
   *     판매 22:45 / 영업 종료 22:00
   *   22:00~23:00 판매를 받아들이기로 한 이상 종료 시각은 그보다 뒤여야 한다.
   *   화면의 `11:00–22:00` 은 `planned_close_at` 으로 그린다 — 뜻이 다른 값이다(0138).
   */
  perform pg_temp.eq_t('닫힌 시각이 마감 기한이다',
    v_closed::text, (v_due + auto_close_grace())::text);
  perform pg_temp.ok('예정 종료보다 뒤다 — 그 사이 판매보다 뒤여야 한다', v_closed > v_due);
  perform pg_temp.ok('스윕이 돈 시각이 아니다', v_closed < now() - interval '1 hour');

  -- 마감 집계가 스냅샷에 들어갔는가(수동 마감과 같은 몸통이라는 뜻).
  perform pg_temp.ok('마감 집계가 스냅샷에 남는다',
    (select snapshot ? 'closing' from business_days where id = v_id));
end $t$;


-- ── ④ 기한 전이면 안 닫는다 ──────────────────────────────────
do $t$
declare v_id uuid; v_res jsonb; v_day date;
begin
  v_day := pg_temp.open_today();
  select id into v_id from business_days
   where store_id = pg_temp.store() and business_date = v_day;

  -- 예정 종료가 30분 전 → 유예(1시간)가 아직 안 지났다.
  perform pg_temp.set_close(now() - interval '30 minutes');
  perform pg_temp.eq('유예 안이면 안 닫는다', (pg_temp.sweep()->>'closed')::int, 0, 0);
  perform pg_temp.eq_t('상태도 그대로',
    (select status::text from business_days where id = v_id), 'open');

  -- 예정 종료가 미래면 당연히 안 닫는다.
  perform pg_temp.set_close(now() + interval '5 hours');
  perform pg_temp.eq('예정 종료 전이면 안 닫는다', (pg_temp.sweep()->>'closed')::int, 0, 0);

  -- 브레이크 중이어도 기한이 지나면 닫는다. 브레이크는 마감을 미루는 장치가 아니다(§2.6).
  set local role postgres;
  update business_days set status = 'break' where id = v_id;
  set local role authenticated;
  perform pg_temp.set_close(now() - interval '3 hours');
  perform pg_temp.eq('브레이크 중이어도 닫는다', (pg_temp.sweep()->>'closed')::int, 1, 0);
end $t$;


-- ── ⑤ 수동과 자동이 같은 몸통 ────────────────────────────────
-- 두 벌이면 "직접 닫은 날과 자동으로 닫힌 날의 손익이 다르다"가 된다.
do $t$
begin
  perform pg_temp.ok('수동 마감이 몸통을 부른다',
    pg_get_functiondef('public.close_business_day(uuid)'::regprocedure)
      like '%close_business_day_row(%');
  perform pg_temp.ok('자동 마감도 같은 몸통을 부른다',
    pg_get_functiondef('public.close_due_business_days()'::regprocedure)
      like '%close_business_day_row(%');

  /*
   * ⚠ 스윕이 `last_activity_at` 을 보면 §2.5 의 밀림이 그대로 돌아온다.
   *   주석 줄은 뺀다 — 위 함수 설명문에 그 글자가 들어 있다.
   */
  perform pg_temp.ok('스윕은 마지막 활동을 안 본다',
    not pg_temp.fn_code_has('public.close_due_business_days()'::regprocedure, 'last_activity_at'));
end $t$;


-- ── ⑥ 사람은 못 부른다 ───────────────────────────────────────
do $t$
begin
  perform pg_temp.raises('인증 사용자는 스윕을 못 부른다',
    'select close_due_business_days()', '42501');
  perform pg_temp.raises('anon 도 못 부른다',
    'set local role anon; select close_due_business_days()', '42501');
end $t$;


-- ── ⑦ 청소는 스윕이 아니라 **별도 크론**이다 (0138) ───────────
/*
 * 0137 은 청소를 스윕에 붙여 매분 돌렸다. 영업 시작에만 매달린 것보다는 나았지만
 * 값이 비쌌다 — 전 매장 삭제를 1분마다 하는데 `occurred_at` 단독 인덱스도 없었다.
 * 하루 한 번으로 떼어 냈고 인덱스를 붙였다.
 */
do $t$
declare v_old uuid; v_n int;
begin
  -- 스윕은 이제 청소를 안 한다.
  perform pg_temp.ok('스윕이 청소를 부르지 않는다',
    pg_get_functiondef('public.close_due_business_days()'::regprocedure)
      not like '%purge_entity_changes%');

  -- 나이로만 지우므로 그 인덱스가 있어야 한다.
  perform pg_temp.ok('occurred_at 인덱스가 있다',
    exists (select 1 from pg_indexes
             where tablename = 'entity_change_events'
               and indexdef like '%(occurred_at)%'));

  -- 청소 자체는 그대로 동작한다.
  set local role postgres;
  select id into v_old from entity_change_events
   where store_id = pg_temp.store() order by occurred_at desc limit 1;
  update entity_change_events set occurred_at = clock_timestamp() - interval '40 days'
   where id = v_old;
  set local role authenticated;

  /*
   * ⚠ 청소와 확인을 **한 식에** 넣으면 안 된다. `a and b` 의 평가 순서는 보장되지
   *   않아서 확인이 먼저 돌 수 있다 — 실제로 그래서 빨갛게 떴다.
   *   지우고, 그다음에 본다.
   */
  v_n := purge_entity_changes();
  perform pg_temp.ok('청소가 뭔가 지웠다', v_n >= 1);
  perform pg_temp.ok('40일 된 기록이 사라졌다',
    not exists (select 1 from entity_change_events where id = v_old));
end $t$;


-- ── ⑧ 판매 저장이 잠근 뒤 기한을 본다 (0138) ──────────────────
/*
 * 기획서 §2.4 마지막 줄 — "자동 마감 시각이 지나도 열린 행이면 판매를 계속 받을 수 있다".
 * 크론이 1분마다 돌아도 그 1분 사이는 열려 있다. 그 틈으로 들어온 판매는
 * 이미 닫혔어야 할 장부에 얹힌다.
 */
do $t$
declare v_day date; v_r uuid := pg_temp.rcp('제육볶음');
begin
  v_day := pg_temp.open_today();

  -- 기한 전이면 당연히 받는다.
  perform pg_temp.set_close(now() + interval '5 hours');
  perform save_sale(pg_temp.store(), v_day,
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1)));
  perform pg_temp.ok('기한 전에는 판매가 들어간다', true);

  -- 기한이 지나면 **열려 있어도** 안 받는다.
  perform pg_temp.set_close(now() - interval '3 hours');
  perform pg_temp.eq_t('아직 열려 있다',
    (select status::text from business_days
      where store_id = pg_temp.store() and business_date = v_day), 'open');
  perform pg_temp.raises('기한이 지나면 열려 있어도 안 받는다',
    format('select save_sale(%L, %L, %L::jsonb)', pg_temp.store(), v_day,
           jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 2))::text),
    '45002');

  /*
   * ⚠ `now()` 가 아니라 `clock_timestamp()` 여야 한다. `now()` 는 트랜잭션 시작 시각에
   *   고정되므로, 잠금을 기다리는 동안 기한이 지나도 안 지난 것으로 보인다 —
   *   **오래 기다린 트랜잭션일수록 더 잘 샌다.**
   */
  perform pg_temp.ok('판매 저장이 clock_timestamp 로 기한을 본다',
    pg_temp.fn_code_has('public.save_sale(uuid,date,jsonb,jsonb,jsonb,integer,boolean)'::regprocedure,
                        'clock_timestamp() >= v_bday.planned_close_at'));
  perform pg_temp.ok('그 자리에 now() 를 쓰지 않는다',
    not pg_temp.fn_code_has('public.save_sale(uuid,date,jsonb,jsonb,jsonb,integer,boolean)'::regprocedure,
                            'now() >= v_bday.planned_close_at'));
end $t$;


-- ── ⑨ 수동 마감과 크론이 겹치면 실패가 아니다 (0138) ──────────
-- 후보를 읽은 뒤 사장님이 먼저 닫으면 몸통이 45002 를 낸다. 경합의 정상 결말이다.
-- 실패로 세면 매분 `failed: 1` 이 쌓여 **진짜 실패가 그 속에 묻힌다.**
do $t$
declare v_day date; v_res jsonb;
begin
  v_day := pg_temp.open_today();
  perform pg_temp.set_close(now() - interval '3 hours');

  -- 사장님이 먼저 닫는다.
  perform transition_business_state(pg_temp.store(), 'end');

  -- 스윕이 뒤늦게 돈다 — 닫을 게 없다. 실패도 아니다.
  v_res := pg_temp.sweep();
  perform pg_temp.eq('닫은 건 없다', (v_res->>'closed')::int, 0, 0);
  perform pg_temp.eq('실패로 세지 않는다', (v_res->>'failed')::int, 0, 0);

  -- 그리고 수동 마감 시각은 **지금**이다(기한이 아니라).
  perform pg_temp.eq_t('수동 마감은 manual 로 남는다',
    (select close_method::text from business_days
      where store_id = pg_temp.store() and business_date = v_day), 'manual');

  /*
   * ⚠ **여기까지가 이 블록이 실제로 잰 것이다.** 진짜 경합 —
   *     스윕이 후보를 읽음 → 사장님이 먼저 닫음 → 몸통이 45002
   *   은 한 트랜잭션 안에서 못 만든다. 위 순서는 후보를 읽는 시점에 이미 닫혀 있어
   *   루프가 아예 안 돈다(그래서 `closed:0 failed:0` 이 나온 것이지, 45002 를 잘
   *   처리해서가 아니다). 실제로 45002 처리를 망가뜨려도 위 단언은 통과한다 — 확인했다.
   *
   *   그래서 처리 **구조**를 못 박는다. 이건 행동이 아니라 코드 모양을 보는 단언이고,
   *   그 한계를 알고 쓰는 것이다.
   */
  perform pg_temp.ok('45002 를 따로 잡는다',
    pg_temp.fn_code_has('public.close_due_business_days()'::regprocedure,
                        'when sqlstate ''45002'''));
  perform pg_temp.ok('그리고 실패가 아니라 skipped 로 센다',
    pg_temp.fn_code_has('public.close_due_business_days()'::regprocedure,
                        'v_skipped := v_skipped + 1'));
  perform pg_temp.ok('스윕 결과에 skipped 칸이 있다',
    pg_temp.sweep() ? 'skipped');
end $t$;
