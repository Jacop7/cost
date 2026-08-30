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
-- 판매·영업일 무리는 0154 에서 **매장 컨텍스트**(resolve_sales_business_context)로
-- 옮겼다. 거기는 cutoff 가 의미가 있는데(새벽 영업이면 전날 장부), 이제 그 cutoff 를
-- 전역 settings 가 아니라 매장별 규칙으로 계산한다. 시험은 29 가 잰다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 영업시간을 바꿔도 과거 해석이 안 움직인다 ───────────────
do $t$
declare
  v_at   timestamptz;
  v_ld0  date; v_sd0 date;
  v_ld1  date; v_sd1 date;
begin
  -- 서울 새벽 1시(과거의 고정 시각).
  v_at := (pg_temp.today()::text || ' 01:00')::timestamp at time zone 'Asia/Seoul';

  v_ld0 := store_local_date(pg_temp.store(), v_at);
  v_sd0 := (resolve_sales_business_context(pg_temp.store(), v_at)).sales_date;

  -- 표시 폼(settings)을 소유자가 직접 바꾼다 — 0164 부터 앱 롤은 못 쓰고, 동기화 트리거도
  -- 없어 규칙에 닿지 않는다. 그래도 날짜 해석이 흔들리지 않는지가 이 블록의 단언이다.
  set local role postgres;
  update settings set open_time = '18:00', close_time = '02:00';
  set local role margincook_rpc_executor;

  v_ld1 := store_local_date(pg_temp.store(), v_at);
  v_sd1 := (resolve_sales_business_context(pg_temp.store(), v_at)).sales_date;

  /*
   * 예전엔 여기서 전역 business_day() 가 **같은 과거 시각을 다른 날로** 읽는 것을
   * 보였다 — 지금 설정(settings)이 과거 해석에 섞여 있었기 때문이다(기획서 §2.2).
   * 그 함수는 0155 에서 지웠다. 판매 영업일은 **날짜별 규칙**(operating_rules)으로
   * 구하고, 설정 변경은 다음 영업일부터의 새 규칙이 되므로(0132) 과거 시각의
   * 해석은 현지 날짜든 영업일이든 움직이지 않아야 한다.
   */
  perform pg_temp.eq_t('현지 날짜는 그대로다', v_ld1::text, v_ld0::text);
  perform pg_temp.eq_t('판매 영업일도 그대로다 — 과거 해석은 규칙이 지킨다',
    v_sd1::text, v_sd0::text);

  -- 되돌린다(표시 폼).
  set local role postgres;
  update settings set open_time = '11:00', close_time = '22:00';
  set local role margincook_rpc_executor;
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
  --   (준비 쓰기는 소유자 직접이다 — 0156 부터 앱 롤은 테이블에 직접 못 쓴다.)
  set local role postgres;
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'America/New_York')
  on conflict (store_id) do update set timezone = excluded.timezone;
  set local role margincook_rpc_executor;
  -- 뉴욕(UTC-4, 서머타임)이면 아직 같은 날 18:30 이다.
  perform pg_temp.eq_t('뉴욕에서는 같은 날',
    store_local_date(pg_temp.store(), v_at)::text, '2026-08-25');

  -- 등록이 없어도 멈추지 않는다. 날짜 계산이 설정 때문에 죽으면 안 된다.
  set local role postgres;
  delete from store_time_settings where store_id = pg_temp.store();
  set local role margincook_rpc_executor;
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
      position('store_local_date' in v_def) > 0 and position('pg_temp.today()' in v_def) = 0);
  end loop;

  /*
   * 판매·영업일 5개 — 0154 에서 매장 컨텍스트로 옮겼다.
   * 새벽 2시까지 영업하는 집의 01:00 판매가 어제 장부에 들어가는 건 그대로인데,
   * 그 판정을 전역 `business_day()`(settings limit 1)가 아니라
   * `resolve_sales_business_context` 가 매장별 규칙으로 한다.
   * 전역 함수가 돌아오면 다매장에서 날짜가 틀린다 — 서울 새벽 판매가
   * 뉴욕 매장 설정에 좌우된다.
   */
  for r in
    select unnest(array['business_day_state','day_menu_basis','e10_sale_recorded',
                        'open_business_day','save_sale']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 는 매장 컨텍스트를 쓴다 (0154)', r.fn),
      position('resolve_sales_business_context' in v_def) > 0
      and position('pg_temp.today()' in v_def) = 0);
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
  perform pg_temp.eq_t('정오에는 두 날짜가 같다 (자정 안 넘는 규칙)',
    store_local_date(pg_temp.store(), v_at)::text,
    (resolve_sales_business_context(pg_temp.store(), v_at)).sales_date::text);

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
  set local role postgres;
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'Asia/Seoul')
  on conflict (store_id) do update set timezone = excluded.timezone;
  set local role margincook_rpc_executor;

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

  /*
   * 시간대는 PostgreSQL 이 아는 이름만 받는다. 틀린 값이 들어가면 그 매장의
   * 입고·발주·재고 수정이 날짜 계산 단계에서 전부 죽는다.
   * ⚠ 문은 RPC 하나다(0156) — 가드 트리거는 그 안에서 돈다. 직접 쓰기는 아예 막혔다.
   *   (RPC 는 영업 중이면 45011 로 거부하므로, 가드 검증도 영업 전 상태에서 잰다.)
   */
  perform pg_temp.close_today();
  perform pg_temp.raises('알 수 없는 시간대는 거부',
    format('select set_store_timezone(%L, %L)', pg_temp.store(), 'KST+9'), '22000');
  perform pg_temp.raises('빈 시간대도 거부',
    format('select set_store_timezone(%L, %L)', pg_temp.store(), ''), '22000');
  perform pg_temp.raises('앱 롤의 직접 쓰기는 막혔다',
    format($q$update store_time_settings set timezone = 'Asia/Seoul' where store_id = %L$q$,
           pg_temp.store()), '42501');

  -- 맞는 값은 통과하고 updated_at 이 따라 오르며, 사장님이 정한 값(confirmed)이 된다.
  set local role postgres;
  update store_time_settings set updated_at = '2000-01-01'::timestamptz, confirmed = false
   where store_id = pg_temp.store();
  set local role margincook_rpc_executor;
  perform set_store_timezone(pg_temp.store(), 'America/New_York');
  perform pg_temp.ok('updated_at 이 자동으로 갱신된다',
    (select updated_at from store_time_settings where store_id = pg_temp.store()) > now() - interval '1 minute');
  perform pg_temp.ok('RPC 로 정한 시간대는 confirmed 다',
    (select confirmed from store_time_settings where store_id = pg_temp.store()));

  -- 영업 중에는 못 바꾼다 — 열린 장부의 날짜 해석이 흔들린다.
  perform pg_temp.open_today();
  perform pg_temp.raises('영업 중 시간대 변경은 45011',
    format('select set_store_timezone(%L, %L)', pg_temp.store(), 'Asia/Seoul'), '45011');
  perform pg_temp.close_today();
  perform set_store_timezone(pg_temp.store(), 'America/New_York');

  /*
   * ⚠ 백필·준비로 들어간 값은 **정한 값이 아니다.** 해외 매장이 생기면
   *   서울이 맞을 리 없는데, 값이 들어 있으면 화면도 사장님도 정해진 값으로 읽는다.
   *   앱이 첫 기록 전에 고르게 하려면 '정했는지'를 알아야 한다.
   *   (위에서 RPC 로 정했으니 여기서는 백필 상태를 다시 만들어 잰다 —
   *    RPC 를 지나지 않은 행만 confirmed=false 다.)
   */
  set local role postgres;
  update store_time_settings set confirmed = false where store_id = pg_temp.store();
  set local role margincook_rpc_executor;
  perform pg_temp.ok('백필로 들어간 시간대는 confirmed 가 아니다',
    not (select confirmed from store_time_settings where store_id = pg_temp.store()));
  perform pg_temp.eq_t('operating_hours_status 도 그걸 그대로 말한다',
    operating_hours_status(pg_temp.store())->>'timezone_confirmed', 'false');
end $t$;


-- ── ⑥ 인자 형태와 시간대까지 (0123) ──────────────────────────
/*
 * 0121 의 치환도 검증도 **`business_day()` 라는 문자열만** 봤다. 그런데
 * `e2_discard_reverted` 는 인자를 넣어 부른다 — `business_day(ev.occurred_at)`.
 * 그래서 안 옮겨졌는데 "13개 전부 옮겼다" 고 통과했다. 눈이 같으면 못 잡는다.
 *
 * 그리고 날짜만 옮기고 **시간대는 안 옮겼다**. `business_tz()` 는 서울 하드코딩인데
 * 옮긴 함수들이 여전히 그걸로 타임스탬프를 만들고 있었다 —
 *     (v_day::timestamp at time zone business_tz())
 * 뉴욕 매장이면 13시간 어긋난 순간이 저장되고, 되읽을 때 날짜 경계가 하루 밀린다.
 */
do $t$
declare r record; v_def text;
begin
  -- ⚠ `business_day(` 로 본다. 괄호까지만 보면 인자 있는 호출을 놓친다.
  for r in
    select unnest(array['e1_confirm_inbound','e2_discard','e2_discard_reverted','e5_stock_adjusted',
                        'e7_place_order','e11_inbound_reverted','quick_inbound','e4_fixed_cost_saved',
                        'recipe_detail','recompute_recipe','retire_channel','save_store_tax',
                        'fixed_cost_revenue_check']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 에 영업일 호출이 한 톨도 없다', r.fn),
      position('business_day(' in v_def) = 0);
  end loop;

  -- 시간대를 옮긴 9개.
  for r in
    select unnest(array['e1_confirm_inbound','e2_discard','e5_stock_adjusted','recompute_recipe',
                        'stock_history','sales_summary','sales_waste_breakdown','planned_close',
                        'reconcile_sales_consumption']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 는 매장 시간대를 쓴다', r.fn),
      position('business_tz()' in v_def) = 0 and position('store_timezone(' in v_def) > 0);
  end loop;

  /*
   * 남아도 되는 건 딱 하나다.
   *   business_month — 고정지출 귀속 월 키다. 잘못 옮기면 월 손익이 통째로 이동한다.
   * (business_day 는 0155 에서 지웠다 — 판매 무리는 매장 컨텍스트를 쓴다.)
   * 둘째가 생기면 누가 몰래 하드코딩을 되살린 것이다.
   */
  perform pg_temp.eq_t('시간대 하드코딩이 남은 함수는 하나뿐',
    (select coalesce(string_agg(p.proname, ',' order by p.proname), '')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.prokind = 'f' and l.lanname in ('plpgsql','sql')
        and p.prosrc like '%business_tz()%' and p.proname <> 'business_tz'),
    'business_month');

  /*
   * ⚠ **간접 경로까지** 본다. 위 검사는 직접 호출만 보므로, `business_month()` 를
   *   거쳐 서울을 무는 함수가 있으면 "정확히 둘" 이라고 통과한다 — 실제로 그렇게
   *   여섯 함수(입고·입고취소·레시피 조회/목록/저장·스냅샷)가 뚫려 있었다.
   *   business_month 를 **부르는 함수가 하나도 없어야** 한다.
   */
  perform pg_temp.eq_t('월 기준을 서울로 무는 함수가 없다',
    (select coalesce(string_agg(p.proname, ',' order by p.proname), '없음')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.prokind = 'f' and l.lanname in ('plpgsql','sql')
        and p.prosrc like '%business_month(%' and p.proname <> 'business_month'),
    '없음');

  /*
   * "business_month 를 안 쓴다" 만으로는 부족하다. **어느 매장의 월을 쓰는지**가
   * 진짜 문제다. 엉뚱한 매장 식을 넣어도 위 검사는 통과한다.
   * 그래서 다섯 자리의 호출 형태를 그대로 못 박는다.
   */
  for r in
    select * from (values
      ('e1_confirm_inbound',   'store_local_month(o.store_id)'),
      ('e11_inbound_reverted', 'store_local_month(o.store_id)'),
      ('recipe_detail',        'store_local_month(r.store_id)'),
      ('recipe_list',          'store_local_month(r.store_id)'),
      ('save_recipe',          'store_local_month(p_store)')
    ) as t(fn, call)
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    perform pg_temp.ok(format('%s 가 %s 를 쓴다', r.fn, r.call),
      position(r.call in v_def) > 0);
  end loop;

  -- 스냅샷만은 **날짜에서** 월을 뽑는다. now() 기준이면 1/31 → 2/1 새벽이 깨진다.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'build_day_snapshot';
  perform pg_temp.ok('스냅샷은 그 영업일의 달을 쓴다',
    position($q$to_char(p_date, 'YYYY-MM')$q$ in v_def) > 0);
  perform pg_temp.ok('스냅샷은 now() 기준 월을 쓰지 않는다',
    position('store_local_month' in v_def) = 0);
end $t$;


-- ── ⑦ 뉴욕 월말의 고정지출률 (0124) ─────────────────────────
/*
 * 뉴욕 8월 31일 저녁 7시는 **서울로 9월 1일 아침 8시**다.
 * 월 기준이 서울을 물고 있으면 그 순간 8월 원가에 **9월 고정지출률**이 붙는다.
 *
 * ⚠ 이 블록이 **증명하는 것과 못 하는 것**을 정확히 적어 둔다.
 *   증명한다 — 같은 순간에 두 월 함수가 다른 달을 준다는 것,
 *              그리고 `build_day_snapshot(store, 날짜)` 가 **그 날짜의 달**을 쓴다는 것.
 *              (8/31 → 10% · 9/1 → 40% 로 값이 갈린다)
 *   못 한다  — **월 경계에서 실제로 입고를 굴리는 것**. `e1_confirm_inbound` 는
 *              `store_local_month(o.store_id)` = **지금 시각** 기준이라, now() 를
 *              8/31 뉴욕 저녁으로 옮길 수 없으면 그 갈림을 재현할 수 없다.
 *              오늘(8/25)은 서울도 뉴욕도 8월이라 애초에 안 갈린다.
 *              그 자리는 위 ⑥ 의 **호출 형태 검증**이 대신 지킨다.
 */
do $t$
declare
  v_at   timestamptz := '2026-08-31 23:00:00+00'::timestamptz;  -- 뉴욕 8/31 19:00 · 서울 9/1 08:00
  v_rcp  uuid := pg_temp.rcp('제육볶음');
  v_rate_aug numeric := 0.10;
  v_rate_sep numeric := 0.40;
  v_seen numeric;
begin
  set local role postgres;
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'America/New_York')
  on conflict (store_id) do update set timezone = excluded.timezone;
  set local role margincook_rpc_executor;

  -- 같은 순간인데 달이 다르다.
  perform pg_temp.eq_t('뉴욕에서는 아직 8월', store_local_month(pg_temp.store(), v_at), '2026-08');
  perform pg_temp.eq_t('서울 기준이면 9월이 된다', business_month(v_at), '2026-09');

  -- 두 달의 고정지출률을 크게 다르게 심어 둔다. 섞이면 눈에 띄게.
  -- 고정지출률 = 항목 합계 ÷ 목표 매출. 두 달을 크게 다르게 심어 둔다 — 섞이면 눈에 띄게.
  delete from fixed_costs_monthly where store_id = pg_temp.store() and month in ('2026-08','2026-09');
  insert into fixed_costs_monthly (store_id, month, total_revenue, items)
  values (pg_temp.store(), '2026-08', 10000000,
          jsonb_build_array(jsonb_build_object('key','rent','total',1000000))),
         (pg_temp.store(), '2026-09', 10000000,
          jsonb_build_array(jsonb_build_object('key','rent','total',4000000)));

  perform pg_temp.eq('8월 고정지출률', fixed_cost_rate(pg_temp.store(), '2026-08'), v_rate_aug, 0.001);
  perform pg_temp.eq('9월 고정지출률', fixed_cost_rate(pg_temp.store(), '2026-09'), v_rate_sep, 0.001);

  /*
   * 영업일 스냅샷은 **그 영업일이 속한 달**을 쓴다. 만드는 시각이 아니다.
   * ⚠ 1월 31일 영업이 2월 1일 새벽까지 이어져도 장부는 1월치다 —
   *   여기를 now() 로 되돌리면 그 경우가 조용히 깨진다.
   */
  v_seen := (build_day_snapshot(pg_temp.store(), '2026-08-31'::date)->>'fixed_rate')::numeric;
  perform pg_temp.eq('8/31 장부에는 8월 고정지출률', v_seen, v_rate_aug, 0.001);
  v_seen := (build_day_snapshot(pg_temp.store(), '2026-09-01'::date)->>'fixed_rate')::numeric;
  perform pg_temp.eq('9/1 장부에는 9월 고정지출률', v_seen, v_rate_sep, 0.001);

  /*
   * 레시피 상세도 매장 현지 월을 본다.
   * ⚠ 이건 **지금 시각** 기준이다(고정된 v_at 이 아니다). 오늘은 서울도 뉴욕도
   *   같은 달이라 이 단언만으로는 서울/뉴욕을 못 가른다 — 값이 같은지만 본다.
   *   가르는 일은 ⑥ 의 호출 형태 검증이 한다.
   */
  perform pg_temp.eq('레시피 상세의 고정지출률 = 매장 현지 월(지금 시각 기준)',
    (recipe_detail(v_rcp)->>'fixed_rate')::numeric,
    coalesce(fixed_cost_rate(pg_temp.store(), store_local_month(pg_temp.store())), 0), 0.0001);
end $t$;


-- ── ⑧ 상태 응답 계약 (0125) ─────────────────────────────────
/*
 * 마이그레이션은 함수 **정의**를 검사했지만, 응답에 실제로 어떤 값이 실리는지는
 * 안 봤다. 앱이 그 값을 날짜 권위로 쓰므로 계약을 여기서 못 박는다.
 *
 * ⚠ 세 키는 **서로 다른 것**이다. 값이 같을 때가 많아 하나가 빠져도 안 티 난다.
 *     local_date    매장 달력의 오늘. 영업시간과 무관. 발주·입고·재고가 쓴다
 *     today         판매 영업일 기준(cutoff 반영). 3단계에서 정리된다
 *     business_date 판매 화면이 대상으로 삼는 장부 날짜.
 *                   영업 중이면 열린 장부, 영업 전·종료 후에는 서버가 정한 대상 날짜.
 *                   **새벽 영업 중이면 전날일 수 있다.**
 */
do $t$
declare v_s jsonb;
begin
  v_s := business_day_state(pg_temp.store());

  perform pg_temp.ok('세 날짜 키가 모두 있다',
    (v_s ? 'local_date') and (v_s ? 'today') and (v_s ? 'business_date'));
  perform pg_temp.eq_t('local_date = store_local_date(매장)',
    v_s->>'local_date', store_local_date(pg_temp.store())::text);

  /*
   * 시간대를 바꾸면 local_date 가 따라 움직여야 한다. 안 움직이면 그건 서울이
   * 어딘가에 박혀 있다는 뜻이다.
   * ⚠ 뉴욕이 서울과 **다른 날**이 되는 시각에만 갈린다. `now()` 는 못 옮기므로
   *   여기서는 "매장 설정을 따라간다" 는 것까지만 잰다.
   */
  set local role postgres;
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'America/New_York')
  on conflict (store_id) do update set timezone = excluded.timezone;
  set local role margincook_rpc_executor;
  v_s := business_day_state(pg_temp.store());
  perform pg_temp.eq_t('시간대를 바꾸면 local_date 도 따라간다',
    v_s->>'local_date', store_local_date(pg_temp.store())::text);
  perform pg_temp.eq_t('그때도 store_timezone 이 뉴욕이다',
    store_timezone(pg_temp.store()), 'America/New_York');

  set local role postgres;
  insert into store_time_settings (store_id, timezone) values (pg_temp.store(), 'Asia/Seoul')
  on conflict (store_id) do update set timezone = excluded.timezone;
  set local role margincook_rpc_executor;

  /*
   * ⚠ 앱은 `local_date` 가 없을 때 `today` 로 **조용히 대신 메우지 않는다**
   *   (businessDay.ts 의 파싱이 `?? ''` 다). 그래야 서버가 필드를 빠뜨렸을 때
   *   화면이 멈추고 사장님이 알아챈다. 서버 쪽에서는 그 필드가 **항상 있어야** 한다.
   */
  perform pg_temp.ok('local_date 가 빈 값이 아니다', length(coalesce(v_s->>'local_date','')) = 10);
  perform pg_temp.ok('business_date 도 빈 값이 아니다',
    length(coalesce((business_day_state(pg_temp.store()))->>'business_date','')) = 10);
end $t$;
