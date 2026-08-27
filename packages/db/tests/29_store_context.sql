-- ════════════════════════════════════════════════════════════════
-- 29 · 매장별 영업 컨텍스트 (0154) — 영업시간 재설계 3단계
--
-- 판매·영업일 무리의 날짜 권위가 `resolve_sales_business_context` 로 갔다.
-- 수용 기준(기획서 §11): 서울·뉴욕 매장을 동시에 두고 자정 영업을 해도
-- **같은 순간의 판매가 매장마다 제 영업일**로 갈라져야 한다.
--
-- 원자화 둘도 여기서 잰다 —
--   · 기한 지난 옛 영업일: open_business_day 가 한 트랜잭션에서 닫고 연다
--   · 첫 판매: save_sale(p_open_day)가 영업 시작 + 저장을 한 트랜잭션으로
-- ════════════════════════════════════════════════════════════════

-- ── 준비: 뉴욕 매장 ────────────────────────────────────────────
-- 주인은 **다른 사장님**이다(0167: 계정당 매장 하나). 여기서 재는 건 문지기가 아니라 날짜 계산이라,
-- 뉴욕 매장을 읽는 블록은 그 사장님으로 읽는다(앱 롤에는 남의 매장이 RLS 로 안 보인다 — 정상).
-- 조회 헬퍼 둘은 임시 표를 읽는다 — stores 는 다른 사장님 것이라 앱 롤에 안 보이고,
-- pg_temp 함수는 이 세션(authenticated)이 소유해 definer 로도 RLS 를 못 넘는다(실측).
create temp table _ny (store_id uuid, owner_id uuid) on commit drop;
create function pg_temp.ny() returns uuid
language sql stable as $h$ select store_id from _ny $h$;
create function pg_temp.ny_owner() returns uuid
language sql stable as $h$ select owner_id from _ny $h$;

do $t$
declare
  v_b uuid;
  v_owner uuid := pg_temp.new_owner();   -- 계정당 매장 하나(0167) — 다른 사장님의 매장
begin
  set local role postgres;
  insert into stores (owner_id, name) values (v_owner, '시험 매장 뉴욕')
    returning id into v_b;
  insert into store_time_settings (store_id, timezone) values (v_b, 'America/New_York')
  on conflict (store_id) do update set timezone = excluded.timezone;
  /*
   * 자정 넘김 규칙 18:00–02:00, 모든 요일. 기본 규칙 행을 소유자 직접 갱신으로
   * 바꾼다 — set_operating_hours 는 "다음 영업일부터"라 과거 시각 시험에 못 쓴다.
   * (운영 경로가 아니라 시험 준비다. 규칙 쓰기 차단은 앱 롤에만 걸려 있다 — 0132.)
   */
  update operating_rules
     set effective_from = '2026-01-01', effective_to = null, weekly_breaks = '{}'::jsonb,
         weekly_hours = (select jsonb_object_agg(d::text, jsonb_build_object('open','18:00','close','02:00'))
                           from generate_series(0, 6) d)
   where store_id = v_b;
  if (select count(*) from operating_rules where store_id = v_b) <> 1 then
    raise exception '준비 실패: 뉴욕 매장 규칙이 1개가 아닙니다';
  end if;
  set local role authenticated;
  insert into _ny values (v_b, v_owner);
end $t$;


-- ── ① 같은 순간, 두 매장, 다른 영업일 — 수용 기준 ─────────────
do $t$
declare
  -- UTC 05:00 = 서울 14:00(8/26) = 뉴욕 01:00(8/26, EDT).
  v_at timestamptz := '2026-08-26 05:00:00+00'::timestamptz;
  a    public.sales_business_context;
  b    public.sales_business_context;
begin
  a := resolve_sales_business_context(pg_temp.store(), v_at);
  perform pg_temp.as_owner(pg_temp.ny_owner());   -- 뉴욕 매장은 다른 사장님 것 — 그 사장님으로 읽는다(RLS)
  b := resolve_sales_business_context(pg_temp.ny(), v_at);

  perform pg_temp.eq_t('서울 낮 2시 → 오늘 영업일', a.sales_date::text, '2026-08-26');
  perform pg_temp.eq_t('뉴욕 새벽 1시(자정 넘김) → 어제 영업일', b.sales_date::text, '2026-08-25');
  perform pg_temp.eq_t('뉴욕 달력 날짜는 오늘', b.local_date::text, '2026-08-26');
  perform pg_temp.ok('같은 순간인데 영업일이 갈린다 — 이게 수용 기준이다',
    a.sales_date is distinct from b.sales_date);
  perform pg_temp.eq_t('시간대도 매장 것', b.timezone, 'America/New_York');
  perform pg_temp.ok('적용 규칙 id 를 준다', b.sales_rule_id is not null);
  perform pg_temp.as_owner(pg_temp.owner());
end $t$;


-- ── ② 경계 — 종료 시각 정각부터 오늘이다 ──────────────────────
do $t$
begin
  perform pg_temp.as_owner(pg_temp.ny_owner());   -- 뉴욕 매장은 다른 사장님 것 — 그 사장님으로 읽는다(RLS)
  perform pg_temp.eq_t('뉴욕 01:59:59 → 어제',
    (resolve_sales_business_context(pg_temp.ny(), '2026-08-26 05:59:59+00')).sales_date::text,
    '2026-08-25');
  -- ⚠ 유예(1시간)는 날짜 해석에 안 들어간다 — 유예는 열린 장부가 저장을 받아 주는
  --   기간이지 "몇 일인가"가 아니다.
  perform pg_temp.eq_t('뉴욕 02:00:00 정각 → 오늘 (유예는 날짜가 아니다)',
    (resolve_sales_business_context(pg_temp.ny(), '2026-08-26 06:00:00+00')).sales_date::text,
    '2026-08-26');
  perform pg_temp.as_owner(pg_temp.owner());
end $t$;


-- ── ③ 자정을 안 넘는 규칙이면 새벽도 그냥 오늘이다 ────────────
do $t$
declare
  -- UTC 16:00(8/25) = 서울 01:00(8/26). 서울 매장 규칙은 11:00–22:00.
  a public.sales_business_context;
begin
  a := resolve_sales_business_context(pg_temp.store(), '2026-08-25 16:00:00+00');
  perform pg_temp.eq_t('서울 새벽 1시, 자정 안 넘는 규칙 → 오늘', a.sales_date::text, '2026-08-26');
  perform pg_temp.eq_t('달력 날짜와 같다', a.local_date::text, a.sales_date::text);
end $t$;


-- ── ④ 서머타임 경계에서도 규칙 시각대로다 ─────────────────────
do $t$
begin
  perform pg_temp.as_owner(pg_temp.ny_owner());   -- 뉴욕 매장은 다른 사장님 것 — 그 사장님으로 읽는다(RLS)
  -- 2026-11-01 에 뉴욕 서머타임이 끝난다(EDT→EST). 그 다음 날 새벽 00:30(EST) —
  -- 전날(11/1) 규칙 18:00–02:00 의 종료(11/2 02:00 EST) 전이므로 어제 영업일이다.
  perform pg_temp.eq_t('서머타임 끝난 다음 날 새벽도 어제 영업일',
    (resolve_sales_business_context(pg_temp.ny(), '2026-11-02 05:30:00+00')).sales_date::text,
    '2026-11-01');
  perform pg_temp.as_owner(pg_temp.owner());
end $t$;


-- ── ④b 열린 장부가 밤을 소유한다 (0161, 검토 P1-3) ─────────────
/*
 * 휴무일 수동 개점·연장 영업: 규칙은 "월요일 03:00 은 월요일" 이라 말하지만,
 * 일요일 장부가 굳은 예정 종료(05:00)까지 열려 있으면 그 판매는 일요일 장사다.
 * 규칙 계산과 장부가 갈리는 시각을 골라 **분기가 실제로 이긴다**는 걸 잰다 —
 * 뉴욕 규칙(18:00~02:00)으로는 03:00 이 이미 월요일이다.
 */
do $t$
declare
  v_b  uuid := pg_temp.ny();
  v_id uuid;
begin
  perform pg_temp.as_owner(pg_temp.ny_owner());   -- 뉴욕 매장은 다른 사장님 것 — 그 사장님으로 읽는다(RLS)
  set local role postgres;
  insert into business_days (store_id, business_date, status, snapshot, opened_at, planned_close_at)
       values (v_b, '2026-04-05', 'open', '{}'::jsonb,
               '2026-04-05 18:00:00'::timestamp at time zone 'America/New_York',
               '2026-04-06 05:00:00'::timestamp at time zone 'America/New_York')
    returning id into v_id;
  set local role authenticated;

  perform pg_temp.eq_t('굳은 종료 전 새벽 판매는 열린 그 날 장사다',
    (resolve_sales_business_context(v_b, '2026-04-06 03:00:00'::timestamp at time zone 'America/New_York')).sales_date::text,
    '2026-04-05');
  perform pg_temp.eq_t('굳은 종료 시각부터는 다음 날이다',
    (resolve_sales_business_context(v_b, '2026-04-06 05:00:00'::timestamp at time zone 'America/New_York')).sales_date::text,
    '2026-04-06');
  -- 하한 — 열기 전 시각은 이 장부 것이 아니다(과거 조회를 삼키면 안 된다).
  perform pg_temp.eq_t('연 시각 전(일요일 정오)은 장부 소유가 아니다',
    (resolve_sales_business_context(v_b, '2026-04-05 12:00:00'::timestamp at time zone 'America/New_York')).sales_date::text,
    '2026-04-05');

  -- 다음 블록들이 이 임시 장부에 기대지 않게 치운다.
  set local role postgres;
  delete from business_state_transitions where business_day_id = v_id;
  delete from business_days where id = v_id;
  set local role authenticated;
  perform pg_temp.as_owner(pg_temp.owner());
end $t$;


-- ── ⑤·⑥ 기한 지난 옛 영업일 — 표시와 원자 마감 ────────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_today date;
  v_id    uuid;
  v_ctx   public.sales_business_context;
  v_open  jsonb;
begin
  v_today := pg_temp.open_today();
  select id into v_id from business_days
   where store_id = v_store and business_date = v_today;

  -- 옛 날짜에 열린 채 잊힌 장부를 만든다(소유자 직접 — 크론이 못 닫은 상황).
  set local role postgres;
  update business_days
     set business_date = '2020-01-15',
         planned_close_at = '2020-01-16 02:00:00+09'::timestamptz
   where id = v_id;
  set local role authenticated;

  v_ctx := resolve_sales_business_context(v_store);
  perform pg_temp.ok('컨텍스트가 기한 지남을 표시한다', v_ctx.open_expired is true);
  perform pg_temp.eq_t('열린 장부 날짜도 준다', v_ctx.open_business_date::text, '2020-01-15');

  /*
   * 영업 시작 — 기한 지난 옛 날을 **같은 트랜잭션에서** auto 로 닫고 오늘을 연다.
   * 예전엔 close → open RPC 두 번이라 사이에 다른 기기가 끼어들 수 있었다.
   */
  v_open := transition_business_state(v_store, 'open');
  perform pg_temp.ok('새로 열었다', (v_open->>'already_open')::boolean is false);
  perform pg_temp.eq_t('닫은 옛 날짜를 알려 준다', v_open->>'closed_stale_date', '2020-01-15');
  perform pg_temp.eq_t('옛 장부는 auto 로 닫혔다',
    (select close_method::text from business_days where id = v_id), 'auto');
  perform pg_temp.eq_t('닫힌 시각 = 예정 종료 + 유예 (크론과 같은 기록)',
    (select closed_at::text from business_days where id = v_id),
    ('2020-01-16 02:00:00+09'::timestamptz + auto_close_grace())::text);
  perform pg_temp.eq_t('오늘이 열려 있다',
    (select status::text from business_days where store_id = v_store and business_date = v_today),
    'open');
end $t$;


-- ── ⑦ 상태 카드는 영업 중 설정 변경에 안 흔들린다 ─────────────
do $t$
declare
  v_store  uuid := pg_temp.store();
  v_before text;
  v_set    jsonb;
  v_state  jsonb;
begin
  v_before := business_day_state(v_store)->'hours'->>'open_time';
  perform pg_temp.ok('카드에 시작 시각이 있다', v_before is not null);

  -- 영업 중에 시간을 바꾼다 — 규칙은 다음 영업일부터다(0132).
  v_set := pg_temp.set_hours(
    (select jsonb_object_agg(d::text, jsonb_build_object('open','10:00','close','23:00'))
       from generate_series(0, 6) d));
  perform pg_temp.ok('오늘 적용이 아니라고 답한다', (v_set->>'applies_today')::boolean is false);

  v_state := business_day_state(v_store);
  /*
   * ⚠ 여기가 핵심이다. 예전 구현은 hours 를 `settings` 에서 읽어서
   *   이 순간 10:00 으로 바뀌었다 — 영업 중인데 카드가 내일 규칙을 말했다.
   *   지금은 장부에 굳은 규칙(operating_rule_id)을 읽는다.
   */
  perform pg_temp.eq_t('영업 중 카드는 오늘 굳은 규칙 그대로다',
    v_state->'hours'->>'open_time', v_before);
  perform pg_temp.eq_t('settings 는 새 값으로 바뀌었다 (카드가 그걸 안 볼 뿐)',
    (select open_time::text from settings where store_id = v_store), '10:00:00');
  perform pg_temp.eq_t('카드 시간 = 장부에 굳은 규칙의 시간',
    v_state->'hours'->>'open_time',
    (select rule_hours_on(d.operating_rule_id, d.business_date)->>'open_time'
       from business_days d where d.store_id = v_store and d.status <> 'closed'));
end $t$;


-- ── ⑧ 첫 판매 = 영업 시작 + 저장, 한 트랜잭션 ─────────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date;
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_items jsonb;
  v_res   jsonb;
begin
  v_day := (resolve_sales_business_context(v_store)).sales_date;
  v_items := jsonb_build_array(jsonb_build_object(
    'recipe_id', v_r, 'qty_hall', 1, 'qty_delivery', 0, 'qty_takeout', 0, 'qty_waste', 0));

  -- 영업 전 상태로 되돌린다 — ⑤~⑦이 연 오늘 장부를 치운다(시험 준비, 롤백된다).
  -- 전이 감사(0157)가 이 장부를 참조하므로 그것부터 치운다.
  /*
   * ⚠ 시각 독립: 오늘 규칙이 22:00 종료라, 23:00(유예 포함) 이후 실행이면 p_open_day 로
   *   새로 연 날이 그 자리에서 DAY_CLOSED 게이트에 걸린다. 오늘 규칙의 종료를 23:59 로
   *   밀어 시험을 시각과 떼어 놓는다(소유자 준비, 롤백).
   *   — 이건 **제품 공백의 노출**이기도 하다: 규칙 종료 + 유예 뒤에 영업을 시작하면
   *     열자마자 저장이 막히고 크론이 1분 안에 닫는다. 늦은 개점의 예정 종료를
   *     어떻게 둘지는 사장님 결정이 필요하다(보고서에 남김).
   */
  set local role postgres;
  update operating_rules r
     set weekly_hours = (select jsonb_object_agg(d::text, jsonb_build_object('open','11:00','close','23:59'))
                           from generate_series(0, 6) d)
   where r.store_id = v_store
     and r.effective_from <= v_day and (r.effective_to is null or r.effective_to >= v_day);
  delete from business_state_transitions t using business_days d
   where t.business_day_id = d.id and d.store_id = v_store and d.business_date = v_day;
  delete from business_days where store_id = v_store and business_date = v_day;
  set local role authenticated;

  -- 그냥 저장하면 예전처럼 45001 — 화면이 "영업을 시작할까요?" 를 물을 자리다.
  perform pg_temp.raises('영업 전 저장은 여전히 45001',
    format('select save_sale(%L, %L, %L::jsonb)', v_store, v_day, v_items::text), '45001');
  perform pg_temp.ok('45001 로 거부됐으면 장부도 안 생겼다',
    not exists (select 1 from business_days where store_id = v_store and business_date = v_day));

  -- 확인 후 p_open_day — 영업 시작과 저장이 **한 번에** 된다.
  v_res := save_sale(v_store, v_day, v_items, p_open_day => true);
  perform pg_temp.ok('영업 시작을 겸했다고 답한다', (v_res->>'day_opened')::boolean is true);
  perform pg_temp.ok('판본을 준다', (v_res->>'revision')::int >= 1);
  perform pg_temp.eq_t('장부가 열렸다',
    (select status::text from business_days where store_id = v_store and business_date = v_day), 'open');
  perform pg_temp.ok('판매가 실제로 저장됐다',
    exists (select 1 from daily_sales_items i
             join daily_sales s on s.id = i.daily_sales_id
            where s.store_id = v_store and s.sale_date = v_day and i.recipe_id = v_r));

  -- 이미 열려 있으면 그냥 저장이다 — 두 번 열지 않는다.
  v_res := save_sale(v_store, v_day, v_items, p_open_day => true);
  perform pg_temp.ok('이미 열려 있으면 day_opened=false', (v_res->>'day_opened')::boolean is false);

  -- 과거 날짜는 p_open_day 로도 못 연다 — 그 문은 정정 RPC 다(§6.4).
  perform pg_temp.raises('과거 날짜는 p_open_day 로도 45001',
    format('select save_sale(%L, %L, %L::jsonb, p_open_day => true)',
           v_store, '2020-03-01', v_items::text), '45001');

  -- 미래는 컨텍스트 날짜 기준으로 막는다.
  perform pg_temp.raises('미래 날짜는 여전히 거부',
    format('select save_sale(%L, %L, %L::jsonb)', v_store, v_day + 1, v_items::text), '22000');
end $t$;
