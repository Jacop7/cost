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

-- 그날 현재 판본. 정정 RPC 는 판본이 **필수**다(0146).
create function pg_temp.rev(p_day date) returns integer
language sql stable as $h$
  select coalesce((select revision from daily_sales
                    where store_id = pg_temp.store() and sale_date = p_day), 0)
$h$;

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
    format('select amend_ended_business_day(%L, %L, 0, %L::jsonb)', v_store,
           (date_trunc('month', v_today)::date - interval '1 month' - interval '1 day')::date,
           v_items::text),
    '45010');
  perform pg_temp.raises('내일도 거절',
    format('select amend_ended_business_day(%L, %L, 0, %L::jsonb)', v_store, v_today + 1, v_items::text),
    '45010');

  -- ⚠ 살아 있는 날은 이 문이 아니다. "그냥 되게" 만들면 오늘 장부의 규칙(마감 기한·판본)이
  --   통째로 우회된다.
  perform pg_temp.open_today();
  perform pg_temp.raises('영업 중인 날은 이 문이 아니다',
    format('select amend_ended_business_day(%L, %L, %s, %L::jsonb)', v_store, business_day(),
           pg_temp.rev(business_day()), v_items::text),
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

  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
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

  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
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
  /*
   * ⚠ `add_to_day_basis` 도 같다(0149). `p_allow_closed => true` 로 부르면 종료된
   *   장부의 기준을 바꾸고 `basis_quality` 를 내릴 수 있다 — 판본 검사도 감사 기록도 없이.
   *   16번의 "못 부르는 함수 목록" 은 **적어 두기만** 하는 곳이라 열려도 조용하다.
   *   그래서 여기서 **실제로 불러** 본다.
   */
  perform pg_temp.raises('기준 더하기 몸통도 직접은 못 부른다',
    format('select add_to_day_basis(%L, %L, %L, true)',
           pg_temp.store(), business_day(), pg_temp.rcp('제육볶음')), '42501');

  -- 감사 기록도 손댈 수 없다. 손댈 수 있으면 감사 기록이 아니다.
  perform pg_temp.raises('정정 기록은 직접 못 쓴다',
    'insert into business_day_revisions (business_day_id, revision_no, before_summary, after_summary)
     values (gen_random_uuid(), 1, ''{}''::jsonb, ''{}''::jsonb)', '42501');
  perform pg_temp.raises('정정 기록은 지울 수도 없다',
    'delete from business_day_revisions', '42501');
end $t$;


-- ── ⑨ 0146 이 막은 네 구멍 ────────────────────────────────────
/*
 * 넷 다 실측으로 확인된 것들이다. 방향이 맞아도 이런 자리가 남으면 기능이 아니라
 * 새 사고의 씨앗이 된다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_today date := store_local_date(v_store);
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_day   date;
  v_res   jsonb;
  v_free  date;
begin
  -- ① 바꿀 게 없으면 아무것도 만들지 않는다.
  --    0145 는 빈 호출만으로 종료 장부 + 감사 기록이 생겼다(created=true · revision=1).
  v_day := pg_temp.ended_day();
  perform pg_temp.raises('빈 저장은 거절',
    format('select amend_ended_business_day(%L, %L, %s, ''[]''::jsonb)',
           v_store, v_day, pg_temp.rev(v_day)), '45012');

  -- ② 기타 매출만 넣어도 영업일에 이어진다.
  --    0145 는 메뉴가 있을 때만 `e10` 이 우연히 이어 줬다 — 우연에 기댄 연결이었다.
  perform amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day), '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('name','시험 음료','price',3000,'qty',2)));
  perform pg_temp.eq_t('기타 매출만 넣어도 영업일에 이어진다',
    (select ds.business_day_id::text from daily_sales ds
      where ds.store_id = v_store and ds.sale_date = v_day),
    (select id::text from business_days
      where store_id = v_store and business_date = v_day));

  /*
   * ③ 합계가 그대로여도 감사가 변경을 남긴다.
   *   매장 1개를 배달 1개로 옮기면 총량도 금액도 같다 — 합계만 남기면 감사 기록이
   *   **아무 차이도 없다고 말한다.** 0145 가 그랬다.
   */
  perform amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 4, 'qty_delivery', 0)));
  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
    jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 3, 'qty_delivery', 1)));

  perform pg_temp.eq_t('합계는 그대로다 — 그래서 합계만으로는 못 잡는다',
    (v_res->'before_summary'->>'revenue'), (v_res->'after_summary'->>'revenue'));
  perform pg_temp.ok('그래도 상세는 다르다',
    (v_res->'before_detail') <> (v_res->'after_detail'));
  perform pg_temp.eq('채널이 옮겨간 것이 상세에 보인다',
    (select (x->>'qty_delivery')::numeric
       from jsonb_array_elements(v_res->'after_detail'->'items') x
      where (x->>'recipe_id')::uuid = v_r), 1, 0);
  perform pg_temp.ok('감사 기록에도 상세가 남는다',
    (select before_detail is not null and after_detail is not null
       from business_day_revisions r
       join business_days d on d.id = r.business_day_id
      where d.store_id = v_store and d.business_date = v_day
      order by r.revision_no desc limit 1));

  /*
   * ④ **제일 나쁜 것** — 기록 없는 오늘을 종료 장부로 만들면 그날 영업을 통째로 막는다.
   *   허용 기간이 오늘까지라 이 문으로 들어올 수 있었고, 그 뒤 `open_business_day` 는
   *   "이미 종료된 날" 이라며 거부한다.
   */
  /*
   * ⚠ 날짜만 옮기면 그 행이 **열린 채로** 남아 `open_business_day` 가
   *   "다른 날이 아직 열려 있다" 로 거부한다. 옮기면서 닫아 둔다.
   *   (지우지 않는 이유는 매출·발주가 이 행을 참조하기 때문이다.)
   */
  set local role postgres;
  update business_days set business_date = v_today - 400, status = 'closed'
   where store_id = v_store and business_date = v_today;
  set local role authenticated;

  perform pg_temp.raises('장부 없는 오늘은 이 문으로 못 만든다',
    format('select amend_ended_business_day(%L, %L, 0, %L::jsonb)', v_store, v_today,
           jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1))::text),
    '45001');
  -- 그리고 정상 경로는 그대로 열려 있어야 한다. 막기만 하면 그건 고장이다.
  perform pg_temp.eq_t('영업 시작은 여전히 된다',
    open_business_day(v_store, v_today)->>'status', 'open');

  -- ⑤ 판본이 어긋나면 거절한다(신규 RPC 라 선택값 없이 굳혔다).
  perform pg_temp.close_today();
  perform pg_temp.raises('낡은 판본은 거절',
    format('select amend_ended_business_day(%L, %L, 999, %L::jsonb)', v_store, v_today,
           jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1))::text),
    '45009');
end $t$;


-- ── ⑩ 응답 계약 (0147) ────────────────────────────────────────
/*
 * ⚠ 이 블록은 **DB 를 다시 조회하지 않는다.** 위 블록들은 매번 `pg_temp.rev()` 로
 *   판본을 새로 읽어서, 응답이 틀린 판본을 주고 있어도 못 봤다 —
 *   실제로 0146 은 응답에 감사용 값(1)을 담았는데 다음 판본은 5였다.
 *   화면은 DB 를 다시 못 읽는다. **응답만 들고** 다음 저장을 한다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_day   date;
  v_a     jsonb;
  v_b     jsonb;
begin
  v_day := pg_temp.ended_day();

  /*
   * ⚠ 두 판본을 **일부러 벌려 놓는다.**
   *   시드 상태에서는 둘이 우연히 같을 수 있고(실제로 6·6 이 나왔다), 그러면 응답이
   *   둘을 뒤바꿔 담아도 시험이 못 잡는다 — 사보타주를 걸어 보고 알았다.
   *   판매 판본만 밀어 두면 그 뒤로는 값이 겹치지 않는다.
   */
  set local role postgres;
  insert into daily_sales (store_id, sale_date) values (v_store, v_day)
  on conflict (store_id, sale_date) do update set revision = daily_sales.revision + 7;
  set local role authenticated;

  v_a := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
           jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 6)));
  perform pg_temp.ok('바뀌었다고 말한다', (v_a->>'changed')::boolean);
  perform pg_temp.ok('두 판본이 실제로 벌어져 있다 — 안 그러면 뒤바뀜을 못 잡는다',
    (v_a->>'revision')::int <> (v_a->>'audit_revision_no')::int);

  -- 응답의 `revision` 만 들고 두 번째 정정. 여기서 45009 가 나면 계약이 틀린 것이다.
  v_b := amend_ended_business_day(v_store, v_day, (v_a->>'revision')::int,
           jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 9)));
  perform pg_temp.eq('두 번째 정정이 실제로 반영된다',
    (select coalesce(sum(it.qty_hall), 0) from daily_sales ds
       join daily_sales_items it on it.daily_sales_id = ds.id
      where ds.store_id = v_store and ds.sale_date = v_day and it.recipe_id = v_r), 9, 0);

  -- 두 판본은 **다른 값**이다. 섞으면 화면이 다음 저장에서 즉시 45009 를 맞는다.
  perform pg_temp.eq('판매 판본이 하나 는다',
    (v_b->>'revision')::int, (v_a->>'revision')::int + 1, 0);
  perform pg_temp.eq('감사 판본도 하나 는다',
    (v_b->>'audit_revision_no')::int, (v_a->>'audit_revision_no')::int + 1, 0);
  /*
   * ⚠ "둘이 다르다" 로 재면 안 된다 — **우연히 같을 수 있다**(실제로 6·6 이 나왔다).
   *   계약은 각자 **제 출처**를 가리킨다는 것이다. 0146 이 깬 것도 그 지점이다:
   *   응답에 감사용 값을 담아 화면이 다음 저장에서 즉시 45009 를 맞았다.
   */
  perform pg_temp.eq('revision = daily_sales.revision (다음 저장에 되보낼 값)',
    (v_b->>'revision')::int, pg_temp.rev(v_day), 0);
  perform pg_temp.eq('audit_revision_no = business_days.revision_no (정정 횟수)',
    (v_b->>'audit_revision_no')::int,
    (select revision_no from business_days
      where store_id = v_store and business_date = v_day), 0);

  /*
   * ② 같은 값을 다시 보내면 **아무것도 안 남는다.**
   *   저장 버튼을 두 번 누르는 일은 흔하다. 그때마다 `before = after` 인 정정 기록이
   *   쌓이면 감사 기록이 잡음으로 차서 진짜 변경을 못 찾는다.
   */
  declare
    v_c     jsonb;
    v_audit int := (select revision_no from business_days
                     where store_id = v_store and business_date = v_day);
    v_cnt   int := (select count(*) from business_day_revisions r
                      join business_days d on d.id = r.business_day_id
                     where d.store_id = v_store and d.business_date = v_day);
  begin
    /*
     * ⚠ "안 바뀌었다" 는 판본과 감사 기록만이 아니다. **자국이 하나도 없어야** 한다.
     *   0147 은 판본은 안 올렸는데 `updated_at` 과 오늘 영업일의 `last_activity_at` 이
     *   움직였다. 나중에 "누가 언제 건드렸나" 를 볼 때 그게 거짓말한다.
     */
    declare
      v_upd0  timestamptz;
      v_act0  timestamptz;
      v_ev0   int;
    begin
    /*
     * ⚠ **오늘을 열어 두고 잰다.** 처음엔 앞 블록이 닫아 둔 상태로 재서
     *   `오늘 영업일의 마지막 활동도 그대로 = (없음)` 이 나왔다 — 통과했지만
     *   아무것도 안 잰 단언이었다. 건드릴 대상이 있어야 안 건드린 것을 잴 수 있다.
     */
    perform pg_temp.open_today();
    /*
     * ⚠ `updated_at` 도 뒤로 밀어 둔다. `now()` 는 트랜잭션 시작 시각이라, 같은
     *   트랜잭션에서 방금 쓴 행은 **이미 그 값**이다 — 다시 찍어도 값이 안 변해서
     *   "쓸 때마다 시각을 찍는다" 는 결함을 못 잡는다(사보타주를 걸어 보고 알았다).
     * ⚠ 미는 UPDATE 자체도 `daily_sales_touch` 트리거에 걸려 도로 `now()` 가 된다.
     *   그래서 트리거를 잠깐 끄고 민다. 이 시험의 준비 과정일 뿐 계약이 아니다.
     */
    set local role postgres;
    alter table daily_sales disable trigger daily_sales_touch;
    update daily_sales set updated_at = now() - interval '1 hour'
     where store_id = v_store and sale_date = v_day;
    alter table daily_sales enable trigger daily_sales_touch;
    set local role authenticated;

    v_upd0 := (select updated_at from daily_sales
                where store_id = v_store and sale_date = v_day);
    perform pg_temp.ok('전제: 저장 시각이 지금보다 과거다', v_upd0 < now());
    perform pg_temp.ok('전제: 기타매출이 실제로 있다 — 없으면 그 경로를 안 탄다',
      (select etc_items from daily_sales
        where store_id = v_store and sale_date = v_day) is not null);
    v_act0 := (select last_activity_at from business_days
                where store_id = v_store and status::text <> 'closed'
                order by business_date desc limit 1);
    v_ev0  := (select count(*) from inventory_events);
    perform pg_temp.ok('전제: 오늘 영업일이 열려 있다', v_act0 is not null);
    /*
     * ⚠ **기타매출도 그대로 되보낸다.** 화면은 고친 칸만 보내지 않고 화면에 있는
     *   값을 통째로 보낸다. 메뉴만 보내면 몸통의 기타/지출 경로를 안 타서
     *   "몸통이 시각을 선갱신한다" 는 결함을 못 잡는다 — 사보타주를 걸어 보고 알았다.
     */
    v_c := amend_ended_business_day(v_store, v_day, (v_b->>'revision')::int,
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 9)),
             (select etc_items from daily_sales
               where store_id = v_store and sale_date = v_day),
             (select extra_items from daily_sales
               where store_id = v_store and sale_date = v_day));

    perform pg_temp.ok('안 바뀌었다고 말한다', (v_c->>'changed')::boolean is false);
    perform pg_temp.eq_t('저장 시각도 안 움직인다',
      (select updated_at from daily_sales
        where store_id = v_store and sale_date = v_day)::text, v_upd0::text);
    perform pg_temp.eq('재고 이벤트도 안 늘어난다',
      (select count(*) from inventory_events), v_ev0, 0);
    perform pg_temp.eq_t('오늘 영업일의 마지막 활동도 그대로',
      (select last_activity_at from business_days
        where store_id = v_store and status::text <> 'closed'
        order by business_date desc limit 1)::text, v_act0::text);
    end;
    perform pg_temp.eq('판본이 안 오른다 — 화면이 그대로 다시 쓸 수 있어야 한다',
      (v_c->>'revision')::int, (v_b->>'revision')::int, 0);
    perform pg_temp.eq('정정 횟수도 그대로',
      (select revision_no from business_days
        where store_id = v_store and business_date = v_day), v_audit, 0);
    perform pg_temp.eq('감사 기록이 안 늘어난다',
      (select count(*) from business_day_revisions r
         join business_days d on d.id = r.business_day_id
        where d.store_id = v_store and d.business_date = v_day), v_cnt, 0);
  end;

  /*
   * ③ 감사 상세의 메뉴명은 **판매 시점** 이름이다.
   *
   * ⚠ 순서가 중요하다. 감사 기록을 만든 **뒤에** 이름을 바꾸면 옛 구현(`recipes.name`)도
   *   통과한다 — 이미 저장된 jsonb 는 어차피 안 바뀌기 때문이다. 처음에 그렇게 짰다가
   *   아무것도 못 재는 시험이었다.
   *   이름을 **먼저** 바꾸고, 그 뒤에 만든 **새** 기록이 옛 이름을 지키는지 본다.
   */
  declare
    v_old_name text := (select name from recipes where id = v_r);
    v_d        jsonb;
  begin
    set local role postgres;
    update recipes set name = '이름을 바꿔 봤다' where id = v_r;
    set local role authenticated;

    -- 이름을 바꾼 **뒤에** 새 정정을 만든다.
    v_d := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 11)));

    perform pg_temp.eq_t('새 감사 기록도 팔릴 때 이름을 지킨다',
      (select (x->>'name') from jsonb_array_elements(v_d->'after_detail'->'items') x
        where (x->>'recipe_id')::uuid = v_r),
      v_old_name);
    perform pg_temp.eq_t('저장된 감사 기록도 마찬가지',
      (select (x->>'name') from business_day_revisions r
         join business_days d on d.id = r.business_day_id
         cross join lateral jsonb_array_elements(r.after_detail->'items') x
        where d.store_id = v_store and d.business_date = v_day
          and (x->>'recipe_id')::uuid = v_r
        order by r.revision_no desc limit 1),
      v_old_name);

    set local role postgres;
    update recipes set name = v_old_name where id = v_r;
    set local role authenticated;
  end;
end $t$;


-- ── ⑪ 과거 정정은 오늘을 건드리지 않는다 (0148 ③) ─────────────
/*
 * ⚠ 이건 **무변경일 때만의 이야기가 아니다.** 실제로 고칠 때도 마찬가지다 —
 *   지난주 판매를 고치는 것이 오늘 영업일의 `last_activity_at` 을 밀면
 *   "오늘 마지막으로 장사한 시각" 이 틀려진다. 과거를 고치는 일과 오늘 장사하는
 *   일은 다른 일이다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_day   date;
  v_act0  timestamptz;
  v_res   jsonb;
begin
  v_day := pg_temp.ended_day();
  perform pg_temp.open_today();

  /*
   * ⚠ 활동 시각을 **한 시간 뒤로 밀어 둔다.**
   *   `touch_business_day` 는 `now()`(트랜잭션 시작 시각)를 찍는데, 방금 연 영업일의
   *   활동 시각도 같은 `now()` 다. 그대로 재면 두 값이 같아 `>` 도 `=` 도 아무것도
   *   증명하지 못한다 — 처음에 그렇게 짰다가 `오늘 저장은 오늘을 건드린다` 가 빨개졌다.
   *   밀어 두면 "안 건드렸다" 와 "건드렸다" 가 서로 다른 값으로 갈린다.
   */
  set local role postgres;
  update business_days set last_activity_at = now() - interval '1 hour'
   where store_id = v_store and status::text <> 'closed';
  set local role authenticated;

  v_act0 := (select last_activity_at from business_days
              where store_id = v_store and status::text <> 'closed'
              order by business_date desc limit 1);
  perform pg_temp.ok('전제: 오늘 영업일이 열려 있다', v_act0 is not null);
  perform pg_temp.ok('전제: 활동 시각이 지금보다 과거다', v_act0 < now());

  -- **실제로** 바뀌는 정정이다.
  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 21)));
  perform pg_temp.ok('전제: 실제로 바뀐 정정이다', (v_res->>'changed')::boolean);

  perform pg_temp.eq_t('그래도 오늘 마지막 활동은 안 움직인다',
    (select last_activity_at from business_days
      where store_id = v_store and status::text <> 'closed'
      order by business_date desc limit 1)::text, v_act0::text);

  -- 반대로, **오늘** 저장은 오늘을 건드려야 한다. 막기만 하면 그건 고장이다.
  declare v_act1 timestamptz;
  begin
    perform save_sale(v_store, business_day(),
      jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1)));
    v_act1 := (select last_activity_at from business_days
                where store_id = v_store and status::text <> 'closed'
                order by business_date desc limit 1);
    perform pg_temp.ok('오늘 저장은 오늘을 건드린다', v_act1 > v_act0);
  end;
end $t$;


-- ── ⑫ 세율을 바꿔도 과거 기타 세금은 안 움직인다 (0149) ────────
/*
 * 실측으로 잡힌 것: 저장된 2,636.36원이 현재 세율만 9.0909% → 20% 로 바꾸니
 * 5,800원이 됐다. 사장님은 아무것도 안 고쳤는데 과거 세금과 손익이 움직였다.
 *
 * ⚠ 이 블록부터 매장 세율을 바꾼다. 뒤 블록들이 그걸 전제로 하니 순서를 바꾸지 않는다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_etc   jsonb := jsonb_build_array(
                     jsonb_build_object('name','시험 음료','price',29000,'qty',1));
  v_tax0  numeric;
  v_tax1  numeric;
  v_res   jsonb;
begin
  /*
   * ⚠ 그날 세율을 **명시로 심는다.** 시드에 이미 있는 옛 장부라 스냅샷에 `etc_tax_rate`
   *   가 없었고, 그 상태로 재니 `is distinct from` 이 null 때문에 헛통과했다 —
   *   `그날 세율이 없다` 와 `그날 세율이 다르다` 가 구별되지 않았다.
   *   현재 세율(뒤에서 20%)과 확연히 다른 5% 를 쓴다.
   */
  set local role postgres;
  update business_days
     set snapshot = jsonb_set(snapshot, '{etc_tax_rate}', to_jsonb(0.05::numeric)),
         basis_quality = 'exact'
   where store_id = v_store and business_date = v_day;
  set local role authenticated;
  perform pg_temp.eq('전제: 그날 세율이 5%다', day_etc_tax_rate(v_store, v_day), 0.05, 0);

  -- 그날 세율로 기타 매출을 하나 남긴다.
  v_res  := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
              '[]'::jsonb, v_etc, '[]'::jsonb);
  v_tax0 := (select etc_tax from daily_sales
              where store_id = v_store and sale_date = v_day);
  perform pg_temp.eq('전제: 그날 세율 5%로 매겨졌다 — 현재 세율이 아니다',
    v_tax0, round(29000 * 0.05, 2), 0);

  -- 사장님이 오늘 세율을 고친다.
  set local role postgres;
  update settings set tax_items = '[{"name":"시험세","rate":20}]'::jsonb
   where store_id = v_store;
  set local role authenticated;
  -- ⚠ `is distinct from` 만 쓰면 그날 세율이 **없을 때도** 참이다. 둘 다 있고 다름을 잰다.
  perform pg_temp.ok('전제: 그날 세율이 기록에 있다', day_etc_tax_rate(v_store, v_day) is not null);
  perform pg_temp.ok('전제: 현재 세율이 그날 세율과 다르다',
    store_tax_rate(v_store) <> day_etc_tax_rate(v_store, v_day));

  /*
   * 화면은 고친 칸만 보내지 않고 화면에 있는 값을 통째로 보낸다.
   * 그러니 "같은 내용을 그대로 다시 보내는" 것이 흔한 경로다.
   */
  v_res  := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
              '[]'::jsonb, v_etc, '[]'::jsonb);
  v_tax1 := (select etc_tax from daily_sales
              where store_id = v_store and sale_date = v_day);

  perform pg_temp.eq('과거 기타 세금은 그대로다', v_tax1, v_tax0, 0);
  perform pg_temp.ok('바뀐 게 없다고 말한다', (v_res->>'changed')::boolean is false);
  perform pg_temp.eq_t('그날 기준도 안 내려간다', v_res->>'basis_quality', 'exact');
end $t$;


-- ── ⑬ 금액을 고칠 때는 그날 세율로 매긴다 ──────────────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_etc   jsonb := jsonb_build_array(
                     jsonb_build_object('name','시험 음료','price',10000,'qty',1));
  v_rate  numeric;
  v_tax   numeric;
  v_res   jsonb;
begin
  v_rate := day_etc_tax_rate(v_store, v_day);
  perform pg_temp.ok('전제: 그날 세율이 기록에 있다', v_rate is not null);
  perform pg_temp.ok('전제: 현재 세율은 그날 것과 다르다', store_tax_rate(v_store) <> v_rate);
  perform pg_temp.eq_t('전제: 아직 그날 기준 그대로다',
    (select basis_quality::text from business_days
      where store_id = v_store and business_date = v_day), 'exact');

  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
             '[]'::jsonb, v_etc, '[]'::jsonb);
  v_tax := (select etc_tax from daily_sales
             where store_id = v_store and sale_date = v_day);

  perform pg_temp.ok('전제: 실제로 바뀐 정정이다', (v_res->>'changed')::boolean);
  perform pg_temp.eq('금액을 고쳐도 세율은 그날 것이다', v_tax, round(10000 * v_rate, 2), 0);
  -- 그날 기준을 그대로 썼으니 내려갈 이유가 없다.
  perform pg_temp.eq_t('그날 기준을 썼으면 안 내려간다', v_res->>'basis_quality', 'exact');
end $t$;


-- ── ⑭ 그날 세율이 없으면 현재 세율 + 그렇게 했다고 남긴다 ──────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_etc   jsonb := jsonb_build_array(
                     jsonb_build_object('name','시험 음료','price',7000,'qty',1));
  v_cur   numeric;
  v_tax   numeric;
  v_res   jsonb;
begin
  -- 0149 이전에 열린 장부에는 그날 세율이 없다. 그 상태를 만든다.
  set local role postgres;
  update business_days
     set snapshot = snapshot - 'etc_tax_rate', basis_quality = 'exact'
   where store_id = v_store and business_date = v_day;
  set local role authenticated;
  perform pg_temp.ok('전제: 그날 세율이 기록에 없다',
    day_etc_tax_rate(v_store, v_day) is null);

  /*
   * ⚠ 먼저 **같은 내용**을 보낸다. 그날 세율이 없으면 현재 세율로 다시 계산하고
   *   싶어지는데, 그러면 사장님이 아무것도 안 고쳤는데 과거 세금이 움직인다.
   *   내용이 같으면 **계산 자체를 안 하는 것**이 규칙이다.
   *   (그날 세율이 있는 동안은 이 규칙이 없어도 값이 같아서 티가 안 난다 —
   *    사보타주를 걸어 보고 알았다. 세율이 없는 여기가 유일하게 구별되는 자리다.)
   */
  declare
    v_same jsonb := (select etc_items from daily_sales
                      where store_id = v_store and sale_date = v_day);
    v_t0   numeric := (select etc_tax from daily_sales
                        where store_id = v_store and sale_date = v_day);
    v_now  numeric;
  begin
    select round(coalesce(sum(coalesce((x->>'price')::numeric,0)
                            * coalesce((x->>'qty')::numeric,1)), 0)
                 * store_tax_rate(v_store), 2)
      into v_now from jsonb_array_elements(v_same) x;
    perform pg_temp.ok('전제: 남은 세금이 현재 세율로 매긴 값과 다르다', v_t0 <> v_now);

    v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
               '[]'::jsonb, v_same, '[]'::jsonb);
    perform pg_temp.eq('그날 세율이 없어도 같은 내용이면 세금이 안 움직인다',
      (select etc_tax from daily_sales
        where store_id = v_store and sale_date = v_day), v_t0, 0);
    perform pg_temp.ok('바뀐 게 없다고 말한다', (v_res->>'changed')::boolean is false);
    perform pg_temp.eq_t('기준도 안 내려간다', v_res->>'basis_quality', 'exact');
  end;

  v_cur := store_tax_rate(v_store);
  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
             '[]'::jsonb, v_etc, '[]'::jsonb);
  v_tax := (select etc_tax from daily_sales
             where store_id = v_store and sale_date = v_day);

  perform pg_temp.eq('그날 세율이 없으면 현재 세율로 매긴다', v_tax, round(7000 * v_cur, 2), 0);
  /*
   * ⚠ 조용히 현재값을 쓰면 나중에 그 숫자가 무엇이었는지 되짚을 수 없다.
   *   매출과 수량은 사장님이 적은 실제 기록이고, 내려간 것은 **계산 기준**뿐이다.
   */
  perform pg_temp.eq_t('그리고 그렇게 했다고 응답에 남긴다',
    v_res->>'basis_quality', 'estimated_current');
  perform pg_temp.eq_t('장부에도 남는다',
    (select basis_quality::text from business_days
      where store_id = v_store and business_date = v_day), 'estimated_current');
end $t$;


-- ── ⑮ 지금 판매 중지한 메뉴의 과거 수량도 고칠 수 있다 ─────────
/*
 * 실측으로 잡힌 것: 제육볶음을 판매 중지하니 3일 전 수량 수정이 22000 으로 거절됐다.
 * `판매 중지` 는 **오늘 파는 것**을 막는 스위치다. 과거에 실제로 판 기록과는 무관하다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_q     numeric;
begin
  set local role postgres;
  update recipes set active = false where id = v_r;
  set local role authenticated;
  perform pg_temp.ok('전제: 지금은 판매 중지된 메뉴다',
    not (select active from recipes where id = v_r));

  perform amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
            jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 4)));
  v_q := (select it.qty_hall from daily_sales ds
            join daily_sales_items it on it.daily_sales_id = ds.id
           where ds.store_id = v_store and ds.sale_date = v_day and it.recipe_id = v_r);
  perform pg_temp.eq('판매 중지된 메뉴도 과거 수량을 고칠 수 있다', v_q, 4, 0);

  -- ⚠ 반대쪽도 본다. 열기만 하면 그건 고장이다 — **오늘**은 여전히 못 판다.
  perform pg_temp.raises('그래도 오늘은 판매 중지된 메뉴를 못 판다',
    format('select save_sale(%L, business_day(), %L::jsonb)', v_store,
           jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1))::text),
    '22000');

  set local role postgres;
  update recipes set active = true where id = v_r;
  set local role authenticated;
end $t$;


-- ── ⑯ 그날 기준에 없던 메뉴는 더하되, 기준이 내려간다 ──────────
/*
 * §6.4 의 `판매 내역 추가` 는 그날 기준에 없는 메뉴로도 들어온다 — 그때 꺼 뒀던 메뉴,
 * 그 뒤에 만든 메뉴. 여기서 막으면 그 화면 자체가 성립하지 않는다.
 * 더한 값은 그날 값이 아니라 지금 값이므로 그 장부는 `estimated_current` 로 내려간다.
 *
 * ⚠ 이 블록은 응답 계약도 함께 잰다. 정정 RPC 는 몸통을 부르기 **전에** 장부를 읽으므로,
 *   다시 읽지 않으면 몸통이 내린 뒤에도 옛 값(`exact`)을 돌려준다(0149 ⑤).
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_res   jsonb;
begin
  set local role postgres;
  update business_days
     set snapshot = jsonb_set(snapshot, '{recipes}', (snapshot->'recipes') - v_r::text),
         basis_quality = 'exact'
   where store_id = v_store and business_date = v_day;
  set local role authenticated;
  perform pg_temp.ok('전제: 그날 기준에 그 메뉴가 없다',
    (select snapshot #> array['recipes', v_r::text] from business_days
      where store_id = v_store and business_date = v_day) is null);

  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 6)));

  perform pg_temp.ok('종료된 장부에도 기준을 더한다',
    (select snapshot #> array['recipes', v_r::text] from business_days
      where store_id = v_store and business_date = v_day) is not null);
  perform pg_temp.eq_t('응답이 몸통이 내린 뒤 값을 준다',
    v_res->>'basis_quality', 'estimated_current');

  -- 그날에도 없고 지금도 없는 메뉴는 **안정된 코드**로 돌려보낸다.
  perform pg_temp.raises('없는 메뉴는 BASIS_NOT_AVAILABLE 로 거절한다',
    format('select amend_ended_business_day(%L, %L, %s, %L::jsonb)',
           v_store, v_day, pg_temp.rev(v_day),
           jsonb_build_array(jsonb_build_object(
             'recipe_id', '00000000-0000-0000-0000-0000000000ff', 'qty_hall', 1))::text),
    '45013');
end $t$;


-- ── ⑰ 남의 매장 메뉴는 우리 장부에 못 들어온다 (0150) ──────────
/*
 * 실측으로 잡힌 것: 매장 A 의 과거 장부에 매장 B 의 `남의 메뉴`(판매가 7,777)가
 * 판매행으로 저장됐다. `add_to_day_basis` 가 `p_recipe` 의 매장을 안 봤고,
 * 정정 RPC 는 `security definer` 라 RLS 도 지나간다.
 *
 * ⚠ `assert_my_store(p_store)` 로는 못 막는다. 그건 "이 사람이 이 매장 사람인가" 지
 *   "이 메뉴가 이 매장 것인가" 가 아니다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_b     uuid;
  v_other uuid;
begin
  -- 매장 B 와 그 매장 메뉴를 만든다.
  set local role postgres;
  /*
   * ⚠ 주인은 **같은 사장님**으로 둔다. 그래야 `assert_my_store(A)` 가 통과하고도
   *   메뉴만 B 것인, 실제로 위험한 경우가 된다. 남남이면 문지기가 먼저 막아서
   *   정작 재려던 경계를 안 재게 된다.
   */
  insert into stores (owner_id, name)
       values (pg_temp.owner(), '시험 매장 B')
    returning id into v_b;

  create temp table _other_recipe on commit drop as
    select * from recipes where id = pg_temp.rcp('제육볶음');
  update _other_recipe
     set id = '00000000-0000-0000-0000-0000000000c9',
         store_id = v_b, name = '남의 메뉴', price = 7777;
  insert into recipes select * from _other_recipe;
  select id into v_other from _other_recipe;
  set local role authenticated;

  perform pg_temp.ok('전제: 그 메뉴는 우리 매장 것이 아니다',
    (select store_id from recipes where id = v_other) <> v_store);

  perform pg_temp.raises('남의 매장 메뉴는 안정된 코드로 거절한다',
    format('select amend_ended_business_day(%L, %L, %s, %L::jsonb)',
           v_store, v_day, pg_temp.rev(v_day),
           jsonb_build_array(jsonb_build_object('recipe_id', v_other, 'qty_hall', 1))::text),
    '45013');

  -- ⚠ 거절만으로는 부족하다. **아무것도 안 남아야** 한다.
  perform pg_temp.ok('우리 장부 기준에 남의 메뉴가 없다',
    (select snapshot #> array['recipes', v_other::text] from business_days
      where store_id = v_store and business_date = v_day) is null);
  perform pg_temp.eq('우리 판매내역에 남의 메뉴 줄이 없다',
    (select count(*) from daily_sales ds
       join daily_sales_items it on it.daily_sales_id = ds.id
      where ds.store_id = v_store and ds.sale_date = v_day and it.recipe_id = v_other),
    0, 0);
end $t$;


-- ── ⑱ 팔지도 않고 기준부터 더하지 않는다 (0150) ────────────────
/*
 * 실측으로 잡힌 것: 그날 기준에 없는 메뉴를 **0개**로 보내니
 *   응답 changed=false / basis exact → estimated_current / 메뉴 기준 추가됨
 *   판매 판본 4→4 / 감사 판본 0→0
 * 아무도 안 남긴 변경이다. 기준을 더하는 것은 장부를 바꾸는 일이라,
 * 바꿀 판매가 있을 때만 해야 한다.
 *
 * ⑯ 은 양수 판매만 재서 이 경계를 놓쳤다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_new   uuid := '00000000-0000-0000-0000-0000000000ca';
  v_res   jsonb;
  v_bq0   text;
  v_aud0  int;
  v_rev0  int;
  v_cnt0  int;
begin
  -- 그날 스냅샷이 찍힌 뒤에 만든 메뉴 — 그날 기준에 없다.
  set local role postgres;
  create temp table _new_recipe on commit drop as
    select * from recipes where id = pg_temp.rcp('제육볶음');
  update _new_recipe set id = v_new, name = '나중에 만든 메뉴';
  insert into recipes select * from _new_recipe;
  update business_days set basis_quality = 'exact'
   where store_id = v_store and business_date = v_day;
  set local role authenticated;

  select basis_quality::text, revision_no into v_bq0, v_aud0
    from business_days where store_id = v_store and business_date = v_day;
  v_rev0 := pg_temp.rev(v_day);
  v_cnt0 := (select count(*) from business_day_revisions r
               join business_days d on d.id = r.business_day_id
              where d.store_id = v_store and d.business_date = v_day);
  perform pg_temp.eq_t('전제: 그날 기준은 아직 그날 것이다', v_bq0, 'exact');
  perform pg_temp.ok('전제: 그 메뉴 기준이 그날에 없다',
    (select snapshot #> array['recipes', v_new::text] from business_days
      where store_id = v_store and business_date = v_day) is null);

  -- ── 0개 : 아무것도 안 판다 ──
  v_res := amend_ended_business_day(v_store, v_day, v_rev0,
             jsonb_build_array(jsonb_build_object('recipe_id', v_new, 'qty_hall', 0)));

  perform pg_temp.ok('0개면 바뀐 게 없다고 말한다', (v_res->>'changed')::boolean is false);
  perform pg_temp.ok('0개면 기준을 안 더한다',
    (select snapshot #> array['recipes', v_new::text] from business_days
      where store_id = v_store and business_date = v_day) is null);
  perform pg_temp.eq_t('0개면 그날 기준 품질도 그대로다',
    (select basis_quality::text from business_days
      where store_id = v_store and business_date = v_day), v_bq0);
  perform pg_temp.eq('0개면 판매 판본도 그대로다', pg_temp.rev(v_day), v_rev0, 0);

  -- ── 1개 : 실제로 판다 ── 반대쪽도 봐야 "안 더한다"가 의미를 가진다.
  v_res := amend_ended_business_day(v_store, v_day, v_rev0,
             jsonb_build_array(jsonb_build_object('recipe_id', v_new, 'qty_hall', 1)));

  perform pg_temp.ok('실제로 팔면 기준을 더한다',
    (select snapshot #> array['recipes', v_new::text] from business_days
      where store_id = v_store and business_date = v_day) is not null);
  perform pg_temp.eq_t('그리고 그날 기준 품질이 내려간다',
    (select basis_quality::text from business_days
      where store_id = v_store and business_date = v_day), 'estimated_current');
  perform pg_temp.ok('기준이 내려갔으니 그것만으로도 변경이다',
    (v_res->>'changed')::boolean);

  -- 감사 기록이 **무엇이 내려갔는지**까지 남긴다.
  perform pg_temp.eq('정정 기록이 하나 늘었다',
    (select count(*) from business_day_revisions r
       join business_days d on d.id = r.business_day_id
      where d.store_id = v_store and d.business_date = v_day), v_cnt0 + 1, 0);
  declare v_r business_day_revisions;
  begin
    select r.* into v_r from business_day_revisions r
      join business_days d on d.id = r.business_day_id
     where d.store_id = v_store and d.business_date = v_day
     order by r.revision_no desc limit 1;
    perform pg_temp.eq_t('감사 기록에 내려가기 전 값이 남는다',
      v_r.before_basis_quality::text, 'exact');
    perform pg_temp.eq_t('감사 기록에 내려간 뒤 값도 남는다',
      v_r.after_basis_quality::text, 'estimated_current');
  end;
end $t$;


-- ── ⑲ 열린 장부의 기타매출 세율은 그날 안에서 안 움직인다 (0150) ─
/*
 * 0149 는 **앞으로 만드는** 스냅샷만 고쳤다. 그 시점에 이미 열려 있던 장부는 그대로여서
 * 같은 영업일 안에서 설정을 바꾸면 세금이 따라 움직였다 —
 * 실측: 1,000원 → 100원(10%), 세율을 20% 로 바꾼 뒤 2,000원 → 400원.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_today date;
  v_rate  numeric;
  v_t1    numeric;
  v_t2    numeric;
  v_n     int;
begin
  v_today := pg_temp.open_today();
  v_rate  := day_etc_tax_rate(v_store, v_today);
  perform pg_temp.ok('전제: 열린 장부에 그날 세율이 굳어 있다', v_rate is not null);

  perform save_sale(v_store, v_today, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('name','시험 음료','price',1000,'qty',1)));
  v_t1 := (select etc_tax from daily_sales where store_id = v_store and sale_date = v_today);
  perform pg_temp.eq('그날 세율로 매긴다', v_t1, round(1000 * v_rate, 2), 0);

  -- 영업 중에 사장님이 세율을 바꾼다.
  set local role postgres;
  update settings set tax_items = '[{"name":"시험세","rate":37}]'::jsonb where store_id = v_store;
  set local role authenticated;
  perform pg_temp.ok('전제: 현재 세율이 그날 세율과 달라졌다', store_tax_rate(v_store) <> v_rate);

  perform save_sale(v_store, v_today, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('name','시험 음료','price',2000,'qty',1)));
  v_t2 := (select etc_tax from daily_sales where store_id = v_store and sale_date = v_today);

  perform pg_temp.eq('같은 영업일 안에서는 세율이 안 움직인다', v_t2, round(2000 * v_rate, 2), 0);
  perform pg_temp.eq_t('열린 장부의 세율도 그대로다',
    day_etc_tax_rate(v_store, v_today)::text, v_rate::text);

  /*
   * ⚠ 0150 의 채움은 **일회성 마이그레이션**이라 시험이 직접 못 부른다.
   *   대신 그 결과인 불변식을 잰다 — 열린 장부에 세율 없는 것이 하나도 없어야 한다.
   */
  select count(*) into v_n from business_days
   where status::text <> 'closed'
     and not (coalesce(snapshot, '{}'::jsonb) ? 'etc_tax_rate');
  perform pg_temp.eq('세율이 안 굳은 열린 장부가 없다', v_n, 0, 0);
end $t$;


-- ── ⑳ 판매가 그대로여도 기준이 내려갔으면 변경이다 (0150) ──────
/*
 * ⑱ 은 `기준이 내려갔으니 변경이다` 를 재는 척했지만 **구별을 못 했다.** 거기서는
 * 실제로 판매도 늘어서, 기준 조건을 빼도 `changed=true` 가 그대로 나왔다
 * (사보타주를 걸어 보고 알았다).
 *
 * 구별되는 자리는 하나다: **판매 수량은 그대로인데 기준만 더해지는** 경우.
 * 옛 장부에서 그 메뉴 기준이 유실됐고, 사장님이 같은 수량을 다시 저장하는 상황이다.
 *   · 판매 상세도 합계도 그대로 → 옛 판정으로는 `changed=false`
 *   · 그런데 그날 손익을 무엇으로 계산했는지는 바뀌었다 → 남겨야 한다
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_day   date := pg_temp.ended_day();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_res   jsonb;
  v_bdet0 jsonb;
  v_sum0  jsonb;
  v_cnt0  int;
begin
  -- 그 메뉴 판매를 5개로 확정해 둔다.
  perform amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
            jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 5)));

  -- 그날 기준에서 그 메뉴만 지운다 — 기준이 유실된 옛 장부 흉내.
  set local role postgres;
  update business_days
     set snapshot = jsonb_set(snapshot, '{recipes}', (snapshot->'recipes') - v_r::text),
         basis_quality = 'exact'
   where store_id = v_store and business_date = v_day;
  set local role authenticated;

  v_bdet0 := day_sales_detail(v_store, v_day);
  v_sum0  := sales_summary(v_store, v_day, v_day);
  v_cnt0  := (select count(*) from business_day_revisions r
                join business_days d on d.id = r.business_day_id
               where d.store_id = v_store and d.business_date = v_day);
  perform pg_temp.ok('전제: 그 메뉴 기준이 그날에 없다',
    (select snapshot #> array['recipes', v_r::text] from business_days
      where store_id = v_store and business_date = v_day) is null);
  perform pg_temp.eq_t('전제: 그날 기준은 아직 그날 것이다',
    (select basis_quality::text from business_days
      where store_id = v_store and business_date = v_day), 'exact');

  -- **같은 수량**으로 다시 저장한다.
  v_res := amend_ended_business_day(v_store, v_day, pg_temp.rev(v_day),
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 5)));

  -- 판매는 정말로 그대로여야 이 시험이 성립한다.
  perform pg_temp.eq_t('전제: 판매 상세가 그대로다',
    day_sales_detail(v_store, v_day)::text, v_bdet0::text);
  perform pg_temp.eq_t('전제: 판매 합계도 그대로다',
    sales_summary(v_store, v_day, v_day)::text, v_sum0::text);

  perform pg_temp.eq_t('그런데 그날 기준 품질은 내려갔다',
    (select basis_quality::text from business_days
      where store_id = v_store and business_date = v_day), 'estimated_current');
  perform pg_temp.ok('판매가 그대로여도 기준이 내려갔으면 변경이다',
    (v_res->>'changed')::boolean);
  perform pg_temp.eq('그러니 정정 기록도 남는다',
    (select count(*) from business_day_revisions r
       join business_days d on d.id = r.business_day_id
      where d.store_id = v_store and d.business_date = v_day), v_cnt0 + 1, 0);
end $t$;
