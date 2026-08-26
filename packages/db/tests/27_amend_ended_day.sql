-- ════════════════════════════════════════════════════════════════
-- 27 · 종료된 장부를 다시 열지 않고 고친다 (0144·0145)
--
-- 기획서 §6.4 — "종료된 장부를 다시 열지 않는다. 정정 RPC 로 수정한다."
-- 0139 가 과거 판매를 막았고, 그 자리를 이 RPC 가 메운다.
--
-- 지키는 계약:
--   ① 허용 기간(지난달 1일~오늘) 밖은 거절 — 안정된 코드로
--   ② 살아 있는 날은 이 문이 아니다
--   ③ 종료된 날의 판매가 실제로 바뀌고, 재고도 같이 움직인다
--   ④ **상태·종료 시각·종료 방식은 안 바뀐다** ← 이게 "다시 열지 않는다" 의 뜻이다
--   ⑤ 장부가 없던 날은 만들되 `estimated_current` 로 표시한다
--   ⑥ 마감 집계가 새 값으로 맞춰진다
--   ⑦ 감사 기록이 전후를 남기고, 앱 롤은 그걸 손댈 수 없다
--   ⑧ 몸통(문지기 없는 함수)은 앱 롤이 못 부른다
-- ════════════════════════════════════════════════════════════════

-- 종료된 과거 날을 하나 만든다(오늘이 아닌, 허용 기간 안).
create function pg_temp.ended_day() returns date
language plpgsql as $h$
declare v_day date;
begin
  v_day := store_local_date(pg_temp.store()) - 3;
  set local role postgres;
  -- 이미 있으면 닫아만 둔다. 없으면 만든다(스냅샷 포함).
  if not exists (select 1 from business_days
                  where store_id = pg_temp.store() and business_date = v_day) then
    insert into business_days (store_id, business_date, status, snapshot,
                               planned_close_at, closed_at, close_method)
    values (pg_temp.store(), v_day, 'closed', build_day_snapshot(pg_temp.store(), v_day),
            planned_close(pg_temp.store(), v_day),
            planned_close(pg_temp.store(), v_day) + auto_close_grace(), 'auto');
  else
    update business_days set status = 'closed'
     where store_id = pg_temp.store() and business_date = v_day;
  end if;
  set local role authenticated;
  return v_day;
end $h$;


-- ── ①② 문을 잘못 찾으면 안정된 코드로 돌려보낸다 ──────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_today date := store_local_date(v_store);
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_items jsonb := jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1));
begin
  -- 허용 기간은 **지난달 1일 ~ 오늘**이다(§6.4).
  perform pg_temp.raises('지난달 1일 하루 전은 거절',
    format('select amend_ended_business_day(%L, %L, %L::jsonb)', v_store,
           (date_trunc('month', v_today)::date - interval '1 month' - interval '1 day')::date,
           v_items::text),
    '45010');
  perform pg_temp.raises('내일도 거절',
    format('select amend_ended_business_day(%L, %L, %L::jsonb)', v_store, v_today + 1, v_items::text),
    '45010');

  -- ⚠ 살아 있는 날은 이 문이 아니다. "그냥 되게" 만들면 오늘 장부의 규칙(마감 기한·판본)이
  --   통째로 우회된다.
  perform pg_temp.open_today();
  perform pg_temp.raises('영업 중인 날은 이 문이 아니다',
    format('select amend_ended_business_day(%L, %L, %L::jsonb)', v_store, business_day(), v_items::text),
    '45011');
end $t$;


-- ── ③④⑥⑦ 종료된 날을 고친다 ─────────────────────────────────
do $t$
declare
  v_store  uuid := pg_temp.store();
  v_day    date;
  v_r      uuid := pg_temp.rcp('제육볶음');
  v_ing    uuid := pg_temp.ing('대파');
  v_before record;
  v_stock0 numeric;
  v_prev   numeric;
  v_res    jsonb;
  v_after  record;
begin
  v_day := pg_temp.ended_day();

  select status::text as st, closed_at, close_method::text as cm, revision_no
    into v_before
    from business_days where store_id = v_store and business_date = v_day;
  v_stock0 := stock_total_base(v_ing);
  /*
   * 그날 이미 적힌 수량. 시드가 넣어 둔 판매가 있다.
   * ⚠ **네 칸을 다 더한다.** 재료는 채널을 안 가리고 총량으로 빠진다 —
   *   처음에 `qty_hall` 만 세었다가 어긋났다(기대 75 / 실제 −125).
   *   이번 정정은 `qty_hall` 만 보내므로 나머지 칸은 0 이 된다.
   */
  select coalesce(sum(it.qty_hall + it.qty_delivery + it.qty_takeout
                      + coalesce(it.qty_waste, 0)), 0) into v_prev
    from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
   where ds.store_id = v_store and ds.sale_date = v_day and it.recipe_id = v_r;

  v_res := amend_ended_business_day(v_store, v_day,
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 10)),
             null, null, '시험: 빠뜨린 판매');

  -- ③ 판매가 실제로 바뀐다.
  perform pg_temp.eq('그날 수량이 10 이 된다',
    (select coalesce(sum(it.qty_hall), 0) from daily_sales ds
       join daily_sales_items it on it.daily_sales_id = ds.id
      where ds.store_id = v_store and ds.sale_date = v_day and it.recipe_id = v_r), 10, 0);
  /*
   * 재고도 같이 움직인다 — 몸통이 하나라는 뜻이다.
   * ⚠ **증감분**만 움직인다(0028 목표치 대조). 그날 이미 15개가 적혀 있었는데 10 으로
   *   고치면 재고는 오히려 **돌아온다.** 절대량으로 재면 그 계약을 못 본다.
   *   제육 1인분에 대파 25g.
   */
  perform pg_temp.eq('증감분만큼만 움직인다',
    v_stock0 - stock_total_base(v_ing), (10 - v_prev) * 25, 0.001);

  -- ④ **여기가 이 파일의 핵심이다.** 다시 열지 않는다.
  select status::text as st, closed_at, close_method::text as cm, revision_no
    into v_after
    from business_days where store_id = v_store and business_date = v_day;
  perform pg_temp.eq_t('상태가 그대로 closed', v_after.st, v_before.st);
  perform pg_temp.eq_t('종료 시각이 안 바뀐다', v_after.closed_at::text, v_before.closed_at::text);
  perform pg_temp.eq_t('종료 방식도 안 바뀐다', v_after.cm, v_before.cm);
  perform pg_temp.eq('정정 횟수가 하나 는다', v_after.revision_no, v_before.revision_no + 1, 0);

  -- ⑥ 마감 집계도 새 값으로 맞춰진다. 안 맞추면 장부와 마감 요약이 갈린다.
  perform pg_temp.eq('마감 집계 매출 = 정정 후 매출',
    (select (snapshot->'closing'->>'revenue')::numeric from business_days
      where store_id = v_store and business_date = v_day),
    (v_res->'after_summary'->>'revenue')::numeric, 0.01);

  -- ⑦ 감사 기록이 전후를 남긴다.
  perform pg_temp.eq('정정 기록이 남는다',
    (select count(*) from business_day_revisions r
       join business_days d on d.id = r.business_day_id
      where d.store_id = v_store and d.business_date = v_day
        and r.revision_no = v_after.revision_no), 1, 0);
  perform pg_temp.ok('전후가 다르다 — 안 다르면 기록할 이유가 없다',
    (select before_summary <> after_summary from business_day_revisions r
       join business_days d on d.id = r.business_day_id
      where d.store_id = v_store and d.business_date = v_day
        and r.revision_no = v_after.revision_no));
  perform pg_temp.eq_t('이유가 남는다',
    (select reason from business_day_revisions r
       join business_days d on d.id = r.business_day_id
      where d.store_id = v_store and d.business_date = v_day
        and r.revision_no = v_after.revision_no), '시험: 빠뜨린 판매');
end $t$;


-- ── ⑤ 장부가 없던 날 ─────────────────────────────────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date;
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_res   jsonb;
begin
  -- 시드가 안 만든 날을 고른다(허용 기간 안에서 뒤로 훑는다).
  select d into v_day
    from generate_series(store_local_date(v_store) - 1,
                         (date_trunc('month', store_local_date(v_store))::date
                          - interval '1 month')::date, '-1 day') g(d)
   where not exists (select 1 from business_days
                      where store_id = v_store and business_date = g.d::date)
   limit 1;

  if v_day is null then
    -- 허용 기간이 전부 채워져 있으면 이 블록은 잴 것이 없다. 조용히 넘어가지 않는다.
    raise exception '⑤ 전제 실패: 장부가 없는 날을 못 찾았습니다';
  end if;

  v_res := amend_ended_business_day(v_store, v_day,
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 3)));

  perform pg_temp.ok('없던 장부를 만들었다', (v_res->>'created')::boolean);
  /*
   * ⚠ `estimated_current` 는 **원가·손익 계산 기준만** 그날 값이 아니라는 뜻이다.
   *   매출과 판매 수량은 사장님이 적은 실제 기록이다 — 화면 문구도 그렇게 적어야 한다
   *   (`원가·손익은 현재 기준으로 계산했어요`).
   */
  perform pg_temp.eq_t('기준 품질이 estimated_current', v_res->>'basis_quality', 'estimated_current');
  perform pg_temp.eq_t('그 값이 장부에도 남는다',
    (select basis_quality::text from business_days
      where store_id = v_store and business_date = v_day), 'estimated_current');

  -- ⚠ 아무도 연 적도 닫은 적도 없는 날이다. 시각을 지어내지 않는다.
  perform pg_temp.ok('종료 시각을 지어내지 않는다',
    (select closed_at is null and close_method is null from business_days
      where store_id = v_store and business_date = v_day));
  perform pg_temp.eq_t('상태는 closed — 살아 있는 날이 아니다',
    (select status::text from business_days
      where store_id = v_store and business_date = v_day), 'closed');
  perform pg_temp.eq('판매는 실제로 들어갔다',
    (select coalesce(sum(it.qty_hall), 0) from daily_sales ds
       join daily_sales_items it on it.daily_sales_id = ds.id
      where ds.store_id = v_store and ds.sale_date = v_day and it.recipe_id = v_r), 3, 0);
end $t$;


-- ── ⑧ 문지기 없는 것들은 앱 롤이 못 부른다 ────────────────────
do $t$
begin
  /*
   * ⚠ `apply_sale_items` 와 `e10_sale_recorded` 는 문지기가 없다.
   *   특히 `e10` 은 `p_allow_closed` 를 받는다 — 열려 있으면 **그 인자가 곧 문**이다.
   *   누구나 종료된 장부에 감사 기록 없이 판매를 밀어 넣을 수 있게 된다.
   */
  perform pg_temp.raises('판매 반영 몸통은 못 부른다',
    format('select apply_sale_items(%L, %L, gen_random_uuid(), ''[]''::jsonb, null, null)',
           pg_temp.store(), business_day()), '42501');
  perform pg_temp.raises('판매 이벤트도 직접은 못 부른다',
    format('select e10_sale_recorded(%L, %L, %L, 1)',
           pg_temp.store(), business_day(), pg_temp.rcp('제육볶음')), '42501');

  -- 감사 기록도 손댈 수 없다. 손댈 수 있으면 감사 기록이 아니다.
  perform pg_temp.raises('정정 기록은 직접 못 쓴다',
    'insert into business_day_revisions (business_day_id, revision_no, before_summary, after_summary)
     values (gen_random_uuid(), 1, ''{}''::jsonb, ''{}''::jsonb)', '42501');
  perform pg_temp.raises('정정 기록은 지울 수도 없다',
    'delete from business_day_revisions', '42501');
end $t$;
