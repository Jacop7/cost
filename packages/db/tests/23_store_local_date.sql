-- ════════════════════════════════════════════════════════════════
-- 23 · 날짜 분리 (0121) — 영업시간 재설계 1단계
--
-- 지금까지 날짜가 하나뿐이었다. `business_day()` 가 발주·입고·재고·추이·판매를
-- 전부 담당했고, 그 정의에 **지금 설정**이 섞여 있었다 —
--
--     business_cutoff() = 영업 종료 < 시작 이면 (종료 시각), 아니면 0
--     business_day(at)  = ((at at time zone 서울) - cutoff)::date
--
-- 그래서 영업시간을 자정 너머로 바꾸는 순간 **과거 시각의 해석이 바뀐다.**
-- 원장에 이미 박힌 날짜와 갈린다(기획서 §2.2).
--
-- 일반 기록(발주·입고·재고·가격추이·손익추이·수정내역)의 날짜는 그러면 안 된다.
-- 달력 날짜는 영업시간과 무관하다 — "서울 매장 01:00 입고는 현지 달력의 오늘 입고다"(§4.1).
--
-- ⚠ 판매·영업일 무리는 **아직 옮기지 않았다.** 거기는 cutoff 가 의미가 있다
--   (새벽 영업이면 전날 장부). 3단계에서 통째로 간다. 이 시험이 그 경계를 지킨다 —
--   실수로 판매까지 옮기면 새벽 판매가 다음 날 장부로 새 버린다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 영업시간을 바꿔도 현지 날짜는 안 움직인다 ───────────────
do $t$
declare
  v_at   timestamptz;
  v_bd0  date; v_ld0 date;
  v_bd1  date; v_ld1 date;
begin
  -- 서울 새벽 1시. 자정 너머 영업이면 '어제 장부'지만 달력으로는 오늘이다.
  v_at := (business_day()::text || ' 01:00')::timestamp at time zone 'Asia/Seoul';

  v_bd0 := business_day(v_at);
  v_ld0 := store_local_date(pg_temp.store(), v_at);
  perform pg_temp.eq_t('바꾸기 전에는 둘이 같다', v_bd0::text, v_ld0::text);

  -- 사장님이 영업시간을 18:00–02:00 으로 바꾼다.
  update settings set open_time = '18:00', close_time = '02:00';

  v_bd1 := business_day(v_at);
  v_ld1 := store_local_date(pg_temp.store(), v_at);

  /*
   * ⚠ 여기가 이 파일의 이유다. **같은 과거 시각**을 두 번 재는데 답이 달라진다.
   *   business_day 는 지금 설정을 읽으므로 어제로 밀린다.
   */
  perform pg_temp.ok('영업일은 과거 해석이 바뀐다 (그래서 일반 기록에 쓰면 안 된다)',
    v_bd1 is distinct from v_bd0);
  perform pg_temp.eq_t('현지 날짜는 그대로다', v_ld1::text, v_ld0::text);

  -- ⚠ 되돌린다. 안 되돌리면 아래 블록들이 cutoff 02:00 인 채로 돌고,
  --   서울 시간 00:00~02:00 에 실행하면 통과/실패가 갈린다 — 시각에 따라 흔들리는 시험이 된다.
  update settings set open_time = '11:00', close_time = '22:00';
end $t$;


-- ── ② 시간대는 매장이 정한다 ──────────────────────────────────
do $t$
declare
  v_at timestamptz := '2026-08-25 22:30:00+00'::timestamptz;   -- UTC 22:30
begin
  -- 서울(UTC+9)이면 다음 날 07:30 이다.
  perform pg_temp.eq_t('서울에서는 다음 날',
    store_local_date(pg_temp.store(), v_at)::text, '2026-08-26');

  -- ⚠ 행이 있다고 가정하지 않는다. 없으면 update 가 0행을 치고 시험이 조용히 통과한다.
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'America/New_York')
  on conflict (store_id) do update set timezone = excluded.timezone;
  -- 뉴욕(UTC-4, 서머타임)이면 아직 같은 날 18:30 이다.
  perform pg_temp.eq_t('뉴욕에서는 같은 날',
    store_local_date(pg_temp.store(), v_at)::text, '2026-08-25');

  -- 등록이 없어도 멈추지 않는다. 날짜 계산이 설정 때문에 죽으면 안 된다.
  delete from store_time_settings where store_id = pg_temp.store();
  perform pg_temp.eq_t('시간대가 없으면 서울로 떨어진다',
    store_local_date(pg_temp.store(), v_at)::text, '2026-08-26');
end $t$;


-- ── ③ 옮긴 것과 안 옮긴 것의 경계 ─────────────────────────────
-- 이 경계가 무너지면 조용히 틀린다. 목록으로 못 박는다.
do $t$
declare
  r     record;
  v_def text;
begin
  -- 일반 기록 13개 — 전부 옮겼어야 한다.
  for r in
    select unnest(array['e1_confirm_inbound','e2_discard','e2_discard_reverted','e5_stock_adjusted',
                        'e7_place_order','e11_inbound_reverted','quick_inbound','e4_fixed_cost_saved',
                        'recipe_detail','recompute_recipe','retire_channel','save_store_tax',
                        'fixed_cost_revenue_check']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 는 현지 날짜를 쓴다', r.fn),
      position('store_local_date' in v_def) > 0 and position('business_day()' in v_def) = 0);
  end loop;

  /*
   * 판매·영업일 5개 — **아직 옮기면 안 된다.**
   * 여기는 cutoff 가 일부러 들어 있다. 새벽 2시까지 영업하는 집에서 01:00 판매는
   * 어제 장부에 들어가야 한다. 3단계에서 sync_business_context 로 옮긴다.
   */
  for r in
    select unnest(array['business_day_state','day_menu_basis','e10_sale_recorded',
                        'open_business_day','save_sale']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 는 아직 영업일을 쓴다 (3단계 몫)', r.fn),
      position('business_day()' in v_def) > 0);
  end loop;
end $t$;


-- ── ④ 오늘은 값이 안 바뀐다 ───────────────────────────────────
-- 이 단계는 구조만 가른다. 지금 영업시간(11:00–22:00)에서는 cutoff 가 0 이라
-- 두 날짜가 같아야 한다. 다르면 이 단계가 데이터를 움직인 것이다.
do $t$
declare
  v_i  uuid := pg_temp.ing('대파');
  v_o  uuid;
  -- ⚠ **고정된 시각**으로 잰다. `now()` 로 재면 서울 00:00~02:00 에 실행할 때
  --   답이 달라진다 — 시각에 따라 흔들리는 시험은 아무것도 안 지킨다.
  v_at timestamptz := '2026-08-25 12:00:00+09'::timestamptz;   -- 서울 정오
begin
  perform pg_temp.eq_t('정오에는 두 날짜가 같다 (cutoff 0)',
    store_local_date(pg_temp.store(), v_at)::text, business_day(v_at)::text);

  -- 실제 기록 경로도 같은 날짜를 남긴다.
  perform quick_inbound(pg_temp.store(), v_i, 1000, 4000, 1, null, null, 'T23');
  select id into v_o from order_records where ingredient_id = v_i order by created_at desc limit 1;
  perform pg_temp.eq_t('빠른 입고가 현지 날짜로 적힌다',
    (select ordered_at::text from order_records where id = v_o),
    store_local_date(pg_temp.store())::text);
end $t$;


-- ── ⑤ 전역 기본값과 시간대 검증 (0122) ───────────────────────
/*
 * 0121 이 함수 13개를 옮겼는데 **테이블 기본값에 남은 게 있었다** —
 *     order_records.ordered_at default business_day()
 * 지금은 e7_place_order 가 날짜를 명시해서 안 틀리지만, 새 쓰기 경로가 생기면
 * 판매 영업일이 발주일에 다시 들어간다. 행의 store_id 를 모르는 전역 기본값은
 * 애초에 쓰면 안 된다 — 매장마다 시간대가 다를 수 있다.
 */
do $t$
declare
  v_i uuid := pg_temp.ing('대파');
  v_ok boolean;
begin
  /*
   * ⚠ 앞 블록(②)이 시간대 행을 **지워 놨다.** 그대로 두면 아래 update 가 0행을 치고
   *   "거부되어야 하는데 성공했다" 가 아니라 그냥 통과해 버린다 — 실제로 그렇게 걸렸다.
   *   행이 있어야 트리거가 돈다.
   */
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'Asia/Seoul')
  on conflict (store_id) do update set timezone = excluded.timezone;

  perform pg_temp.ok('발주일에 전역 기본값이 없다',
    not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'order_records'
                   and column_name = 'ordered_at' and column_default is not null));

  -- 그래도 정상 경로는 날짜를 넣는다. 기본값을 지웠다고 발주가 막히면 안 된다.
  perform e7_place_order(pg_temp.store(), v_i, null, null, 1000, 4000, 1, null);
  perform pg_temp.eq_t('발주는 여전히 현지 날짜로 적힌다',
    (select ordered_at::text from order_records where ingredient_id = v_i
      order by created_at desc limit 1),
    store_local_date(pg_temp.store())::text);

  -- 시간대는 PostgreSQL 이 아는 이름만 받는다. 틀린 값이 들어가면 그 매장의
  -- 입고·발주·재고 수정이 날짜 계산 단계에서 전부 죽는다.
  perform pg_temp.raises('알 수 없는 시간대는 거부',
    format($q$update store_time_settings set timezone = 'KST+9' where store_id = %L$q$,
           pg_temp.store()), '22000');
  perform pg_temp.raises('빈 시간대도 거부',
    format($q$update store_time_settings set timezone = '' where store_id = %L$q$,
           pg_temp.store()), '22000');

  -- 맞는 값은 통과하고 updated_at 이 따라 오른다.
  update store_time_settings set updated_at = '2000-01-01'::timestamptz where store_id = pg_temp.store();
  update store_time_settings set timezone = 'America/New_York' where store_id = pg_temp.store();
  perform pg_temp.ok('updated_at 이 자동으로 갱신된다',
    (select updated_at from store_time_settings where store_id = pg_temp.store()) > now() - interval '1 minute');

  /*
   * ⚠ 백필로 들어간 'Asia/Seoul' 은 **정한 값이 아니다.** 해외 매장이 생기면
   *   서울이 맞을 리 없는데, 값이 들어 있으면 화면도 사장님도 정해진 값으로 읽는다.
   *   앱이 첫 기록 전에 고르게 하려면 '정했는지'를 알아야 한다.
   */
  perform pg_temp.ok('백필로 들어간 시간대는 confirmed 가 아니다',
    not (select confirmed from store_time_settings where store_id = pg_temp.store()));
end $t$;
