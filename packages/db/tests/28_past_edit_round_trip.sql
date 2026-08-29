-- ════════════════════════════════════════════════════════════════
-- 28 · §6.4 화면이 실제로 걷는 길 (조회 → 정정 → 다시 조회)
--
-- 27 번은 정정 RPC 의 **계약**을 잰다. 여기서 재는 것은 그 위에 얹힌
-- **화면의 한 바퀴**다 — `sales_day` 로 받은 것을 그대로 되보내고, 저장한 뒤 다시
-- 조회했을 때 화면이 이어서 쓸 수 있는가.
--
-- 왜 따로 두나 —
--   화면 검증은 지금까지 브라우저로 손으로 했다. 브라우저 시험(RN 테스트 라이브러리)은
--   아직 없고, 그렇다고 "화면 → RPC → 새로고침" 을 안 재고 두면 다음 변경에서 조용히
--   끊긴다. 화면이 밟는 **RPC 순서 그대로** 여기서 잰다.
--
--   특히 이것 하나가 어디서도 안 재지고 있었다 —
--     정정 응답의 `revision` 이 **바로 다음 `sales_day` 의 revision 과 같은가.**
--   다르면 화면은 저장 직후 한 번 더 저장할 때 45009 를 맞는다. 사장님 눈에는
--   "저장했는데 또 저장이 안 된다" 로 보인다.
--
-- 재는 것:
--   ① 기록 없는 과거 날 — `판매 내역 추가` 한 바퀴
--   ② 기록 있는 과거 날 — `판매 내역 수정` 한 바퀴
--   ③ 저장 직후 **연달아 한 번 더** 저장이 되는가(판본이 이어지는가)
--   ④ 오늘(영업 중)은 이 문이 아니다 — 화면이 버튼을 안 띄우는 근거
-- ════════════════════════════════════════════════════════════════

/** 화면이 보는 네 값. `sales_day` 한 번으로 다 나온다(0153). */
create function pg_temp.screen(p_day date) returns jsonb
language sql stable as $h$
  select jsonb_build_object(
    'revision', d->>'revision',
    'has_ledger', d->>'has_ledger',
    'day_status', coalesce(d->>'day_status', '(null)'),
    'basis_quality', coalesce(d->>'basis_quality', '(null)'),
    'editable', d->>'editable',
    'qty', (d->'summary'->>'qty'))
  from (select sales_day(pg_temp.store(), p_day) as d) z;
$h$;

/**
 * 종료된 과거 날 하나. ⚠ 27 번에도 같은 헬퍼가 있지만 **파일마다 psql 세션이 따로**라
 * `pg_temp` 를 공유하지 않는다. 옮겨 쓸 수 없어서 여기에도 둔다.
 */
create function pg_temp.ended_day() returns date
language plpgsql as $h$
declare v_day date;
begin
  v_day := store_local_date(pg_temp.store()) - 3;
  set local role postgres;
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
  set local role sikjae_rpc_executor;
  return v_day;
end $h$;

/** 그날 그 메뉴의 판매 수량(화면이 행에 그리는 값). */
create function pg_temp.sold(p_day date, p_recipe uuid) returns numeric
language sql stable as $h$
  select coalesce((
    select it.qty_hall + it.qty_delivery + it.qty_takeout
      from daily_sales ds join daily_sales_items it on it.daily_sales_id = ds.id
     where ds.store_id = pg_temp.store() and ds.sale_date = p_day
       and it.recipe_id = p_recipe), 0);
$h$;


-- ── ① 기록 없는 과거 날 — `판매 내역 추가` 한 바퀴 ──────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_day   date;
  v_s0    jsonb;
  v_s1    jsonb;
  v_res   jsonb;
begin
  /*
   * 장부도 판매도 없는 날을 고른다.
   * ⚠ **허용 기간 전체**를 훑는다. 처음엔 `오늘-20 ~ 오늘-5` 만 봤는데 시드가 그 구간을
   *   22일치 매출로 채워 놔서 한 날도 못 찾았다 — 빈 날은 지난달 쪽에 있다.
   *   범위를 코드에 박지 않고 `sale_date_allowed` 가 참인 날에서 고른다.
   */
  set local role postgres;
  select d::date into v_day
    from generate_series(
           (date_trunc('month', store_local_date(v_store))::date - interval '1 month')::date,
           store_local_date(v_store) - 1, interval '1 day') d
   where sale_date_allowed(v_store, d::date)
     and not exists (select 1 from business_days b
                      where b.store_id = v_store and b.business_date = d::date)
     and not exists (select 1 from daily_sales s
                      where s.store_id = v_store and s.sale_date = d::date)
   order by d desc
   limit 1;
  set local role sikjae_rpc_executor;
  perform pg_temp.ok('전제: 기록도 장부도 없는 과거 날을 찾았다', v_day is not null);

  -- ⓐ 화면이 연다.
  v_s0 := pg_temp.screen(v_day);
  perform pg_temp.eq_t('열었을 때 — 장부 없음', v_s0->>'has_ledger', 'false');
  perform pg_temp.eq_t('열었을 때 — 상태 없음', v_s0->>'day_status', '(null)');
  perform pg_temp.eq_t('열었을 때 — 기준 품질 없음', v_s0->>'basis_quality', '(null)');
  perform pg_temp.eq_t('열었을 때 — 고칠 수 있는 기간', v_s0->>'editable', 'true');
  perform pg_temp.eq('열었을 때 — 판매 수량 0', (v_s0->>'qty')::numeric, 0, 0);

  -- ⓑ 3개를 적고 저장한다(화면은 받은 revision 을 그대로 되보낸다).
  v_res := amend_ended_business_day(v_store, v_day, (v_s0->>'revision')::int,
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 3)));
  perform pg_temp.ok('저장 — 바뀌었다고 답한다', (v_res->>'changed')::boolean);
  perform pg_temp.ok('저장 — 장부를 새로 만들었다고 답한다', (v_res->>'created')::boolean);
  perform pg_temp.eq_t('저장 — 기준은 현재값이라고 답한다',
    v_res->>'basis_quality', 'estimated_current');

  -- ⓒ 화면이 새로고침한다.
  v_s1 := pg_temp.screen(v_day);
  perform pg_temp.eq('새로고침 — 수량이 남아 있다', pg_temp.sold(v_day, v_r), 3, 0);
  perform pg_temp.eq_t('새로고침 — 장부가 생겼다', v_s1->>'has_ledger', 'true');
  perform pg_temp.eq_t('새로고침 — 종료된 장부다', v_s1->>'day_status', 'closed');
  /*
   * ⚠ 이 줄이 화면의 배지를 정한다. 여기서 `exact` 가 나오면 사장님은 현재 판매가로
   *   계산된 손익을 그날 실제 값으로 믿게 된다.
   */
  perform pg_temp.eq_t('새로고침 — 배지가 뜰 값이다', v_s1->>'basis_quality', 'estimated_current');

  -- ⓓ **응답 판본이 다음 조회 판본과 같아야** 화면이 이어서 쓸 수 있다.
  perform pg_temp.eq_t('응답 판본 = 다시 조회한 판본',
    v_res->>'revision', v_s1->>'revision');

  /*
   * ⚠ 두 판본이 **우연히 같으면** 위아래 단언이 아무것도 못 잡는다. 실제로 그랬다 —
   *   갓 만든 장부는 판매 판본도 감사 판본도 1 이라, 응답의 `revision` 자리에 감사 판본을
   *   담는 사보타주(0147 이 고쳤던 그 버그)가 그대로 통과했다.
   *   판매 판본만 7 올려 **떼어 놓고** 잰다.
   */
  set local role postgres;
  update daily_sales set revision = revision + 7
   where store_id = v_store and sale_date = v_day;
  set local role sikjae_rpc_executor;
  v_s1 := pg_temp.screen(v_day);
  perform pg_temp.ok('전제: 판매 판본과 감사 판본이 서로 다르다',
    (v_s1->>'revision')::int <> (select revision_no from business_days
                                  where store_id = v_store and business_date = v_day));

  -- ⓔ 연달아 한 번 더 저장 — 화면이 받은 값을 그대로 되보낸다.
  v_res := amend_ended_business_day(v_store, v_day, (v_s1->>'revision')::int,
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 5)));
  perform pg_temp.ok('이어서 한 번 더 저장된다', (v_res->>'changed')::boolean);
  perform pg_temp.eq('두 번째 저장도 반영된다', pg_temp.sold(v_day, v_r), 5, 0);
  perform pg_temp.eq_t('두 번째 응답 판본 = 다시 조회한 판본',
    v_res->>'revision', (pg_temp.screen(v_day))->>'revision');
end $t$;


-- ── ② 기록 있는 과거 날 — `판매 내역 수정` 한 바퀴 ──────────────
do $t$
declare
  v_store uuid := pg_temp.store();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_day   date := pg_temp.ended_day();
  v_s0    jsonb;
  v_s1    jsonb;
  v_was   numeric;
  v_res   jsonb;
begin
  v_s0 := pg_temp.screen(v_day);
  v_was := pg_temp.sold(v_day, v_r);
  perform pg_temp.eq_t('열었을 때 — 장부가 있다', v_s0->>'has_ledger', 'true');
  perform pg_temp.eq_t('열었을 때 — 종료된 장부다', v_s0->>'day_status', 'closed');
  perform pg_temp.ok('전제: 그 메뉴가 실제로 팔려 있다', v_was > 0);

  -- ⚠ 여기서도 두 판본을 떼어 놓는다(위 ① 의 이유와 같다).
  set local role postgres;
  update daily_sales set revision = revision + 7
   where store_id = v_store and sale_date = v_day;
  set local role sikjae_rpc_executor;
  v_s0 := pg_temp.screen(v_day);
  perform pg_temp.ok('전제: 판매 판본과 감사 판본이 서로 다르다',
    (v_s0->>'revision')::int <> (select revision_no from business_days
                                  where store_id = v_store and business_date = v_day));

  -- 수량을 **줄인다.** 늘리는 것만 재면 재고가 도로 돌아오는 길이 안 잡힌다.
  v_res := amend_ended_business_day(v_store, v_day, (v_s0->>'revision')::int,
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1)));
  perform pg_temp.ok('줄이는 정정도 바뀌었다고 답한다', (v_res->>'changed')::boolean);

  v_s1 := pg_temp.screen(v_day);
  perform pg_temp.eq('새로고침 — 줄인 수량이 남아 있다', pg_temp.sold(v_day, v_r), 1, 0);
  perform pg_temp.eq_t('응답 판본 = 다시 조회한 판본', v_res->>'revision', v_s1->>'revision');
  perform pg_temp.eq_t('상태는 그대로 종료다 — 다시 열지 않는다', v_s1->>'day_status', 'closed');

  -- 같은 값을 다시 보내면 아무 자국도 안 남고, 판본도 그대로다(0148).
  v_res := amend_ended_business_day(v_store, v_day, (v_s1->>'revision')::int,
             jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1)));
  perform pg_temp.ok('같은 값 재저장 — 안 바뀌었다고 답한다', (v_res->>'changed')::boolean is false);
  perform pg_temp.eq_t('그래도 다음에 쓸 판본을 돌려준다',
    v_res->>'revision', (pg_temp.screen(v_day))->>'revision');
end $t$;


-- ── ③ 오늘(영업 중)은 이 문이 아니다 ────────────────────────────
/*
 * 화면은 `day_status` 가 open·break 면 `판매 내역 수정` 버튼을 안 띄운다.
 * 그 근거가 되는 값과, 그래도 눌렀을 때 서버가 무엇으로 막는지를 함께 잰다 —
 * 값만 재면 "버튼을 숨기는 것"에 기대게 되고, 다른 경로가 생기면 그대로 새어 나간다.
 */
do $t$
declare
  v_store uuid := pg_temp.store();
  v_r     uuid := pg_temp.rcp('제육볶음');
  v_today date;
  v_s     jsonb;
begin
  v_today := pg_temp.open_today();
  v_s := pg_temp.screen(v_today);
  perform pg_temp.eq_t('오늘 — 장부가 살아 있다', v_s->>'day_status', 'open');
  perform pg_temp.eq_t('오늘 — 기간으로는 고칠 수 있다', v_s->>'editable', 'true');

  perform pg_temp.raises('그래도 정정 문으로는 못 들어간다',
    format('select amend_ended_business_day(%L, %L, %s, %L::jsonb)',
           v_store, v_today, (v_s->>'revision')::int,
           jsonb_build_array(jsonb_build_object('recipe_id', v_r, 'qty_hall', 1))::text),
    '45011');
end $t$;
