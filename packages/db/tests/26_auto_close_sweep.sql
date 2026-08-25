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
--   ③ 닫힌 시각은 **예정 종료**다. 스윕이 실제로 돈 시각이 아니다(§6.1 `11:00–22:00`)
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
   where store_id = pg_temp.store() and business_date = business_day();
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

  -- ③ 닫힌 시각 = 예정 종료. 스윕이 돈 시각(now)이 아니다.
  perform pg_temp.eq_t('닫힌 시각이 예정 종료다', v_closed::text, v_due::text);
  perform pg_temp.ok('스윕이 돈 시각이 아니다', v_closed < now() - interval '2 hours');

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
    pg_get_functiondef('public.close_business_day(uuid,business_close_method)'::regprocedure)
      like '%close_business_day_row(%');
  perform pg_temp.ok('자동 마감도 같은 몸통을 부른다',
    pg_get_functiondef('public.close_due_business_days()'::regprocedure)
      like '%close_business_day_row(%');

  /*
   * ⚠ 스윕이 `last_activity_at` 을 보면 §2.5 의 밀림이 그대로 돌아온다.
   *   주석 줄은 뺀다 — 위 함수 설명문에 그 글자가 들어 있다.
   */
  perform pg_temp.ok('스윕은 마지막 활동을 안 본다',
    not exists (
      select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'\n') as line
       where n.nspname = 'public' and p.proname = 'close_due_business_days'
         and line like '%last_activity_at%'
         and btrim(line) not like '--%'
         and btrim(line) not like '*%'
         and btrim(line) not like '/*%'));
end $t$;


-- ── ⑥ 사람은 못 부른다 ───────────────────────────────────────
do $t$
begin
  perform pg_temp.raises('인증 사용자는 스윕을 못 부른다',
    'select close_due_business_days()', '42501');
  perform pg_temp.raises('anon 도 못 부른다',
    'set local role anon; select close_due_business_days()', '42501');
end $t$;


-- ── ⑦ 청소도 스윕에 붙어 있다 ────────────────────────────────
-- 영업 시작에만 매달려 있으면 한동안 문을 안 연 매장은 영영 안 지워진다(0136 숙제).
do $t$
declare v_old uuid; v_res jsonb;
begin
  set local role postgres;
  select id into v_old from entity_change_events
   where store_id = pg_temp.store() order by occurred_at desc limit 1;
  update entity_change_events set occurred_at = clock_timestamp() - interval '40 days'
   where id = v_old;
  set local role authenticated;

  v_res := pg_temp.sweep();
  perform pg_temp.ok('스윕이 40일 된 기록을 지운다',
    not exists (select 1 from entity_change_events where id = v_old));
  perform pg_temp.ok('지운 건수를 돌려준다', (v_res->>'purged')::int >= 1);
end $t$;
