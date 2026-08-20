-- ════════════════════════════════════════════════════════════════
-- 17 · 손익 변동은 금액으로 말한다 (0083)
--
-- 사장님의 질문은 하나다 — **언제, 무엇 때문에, 얼마만큼.**
-- 예전 화면은 `순이익률 33.72% · 재료비율 23.39%` 만 되뇌었다.
-- 비율만으로는 "이번 달 얼마 손해 봤나"에 답할 수 없다.
--
-- 여기서 지키는 것
--   ① 스냅샷에 금액이 전부 남는다 (검산값 4,046.69원 / 33.72%)
--   ② 대표 원인은 **가장 크게 움직인 한 항목**이고, 목록과 시트가 같은 걸 가리킨다
--   ③ 판매가를 500원 올려도 증감이 500원이 아니다 — 세금·고정지출이 따라 움직인다
--   ④ 기준선과 옛 비율 행은 목록에 없다
--   ⑤ 같은 날 여러 번 고쳐도 순서가 정확하다
--   ⑥ 반쪽짜리 스냅샷은 0원으로 메꾸지 않고 **터진다**
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_st   uuid := pg_temp.store();
  v_ven  uuid := (select id from vendors where store_id = pg_temp.store() limit 1);
  v_day  date := business_day();
  v_rcp  uuid := pg_temp.rcp('제육볶음');
  v_ing  uuid := pg_temp.ing('대파');
  v_base profit_trends;
  v_h    jsonb;
  v_row  jsonb;
  v_n    int;
  v_n0   int;      -- 시작 시점 목록 건수. 시드는 깨끗하지 않다 — **상대로** 센다.
  v_prev numeric;
  v_p0   numeric;
  v_p1   numeric;
begin
  -- ── ① 기준선 ────────────────────────────────────────────────
  -- ⚠ '가장 최근' 이 아니라 **기준선**을 집는다. 이 DB 에는 이미 변동이 쌓여 있고,
  --   앞으로도 계속 쌓인다. 시드가 깨끗하다고 가정한 테스트는 언젠가 반드시 깨진다.
  select * into v_base from profit_trends
   where recipe_id = v_rcp and is_baseline
   order by occurred_at asc, id asc limit 1;

  perform pg_temp.ok('기준선이 찍혀 있다', v_base.is_baseline);
  perform pg_temp.eq('기준선 재료비',   v_base.material_cost, 2806.40, 0.01);
  perform pg_temp.eq('기준선 세금',     v_base.tax_amount,    1090.91, 0.01);
  perform pg_temp.eq('기준선 고정지출', v_base.fixed_cost,    3756.00, 0.01);
  perform pg_temp.eq('기준선 순이익',   v_base.profit_amount, 4046.69, 0.01);
  perform pg_temp.eq('기준선 순이익률', v_base.profit_rate,     33.72, 0.01);

  -- 손익표가 실제로 맞아떨어지는지. 어느 한 칸이 어긋나면 여기서 걸린다.
  perform pg_temp.eq('판매가 − 세금 − 재료 − 부자재 − 고정 = 순이익',
    v_base.price - v_base.tax_amount - v_base.material_cost
                 - v_base.extra_cost - v_base.fixed_cost,
    v_base.profit_amount, 0.001);

  -- 기준선은 **변동이 아니다.** 목록에 나오면 안 된다.
  v_h  := recipe_profit_history(v_rcp, null, null, 100);
  v_n0 := jsonb_array_length(v_h -> 'rows');
  perform pg_temp.ok('기준선은 목록에 없다',
    not exists (select 1 from jsonb_array_elements(v_h -> 'rows') e
                 where (e ->> 'id')::uuid = v_base.id));

  -- 비교 기준은 '지금 마지막 스냅샷'이다. 기준선일 수도, 그동안 쌓인 변동일 수도 있다.
  select profit_amount into v_prev from profit_trends
   where recipe_id = v_rcp and profit_amount is not null
   order by occurred_at desc, id desc limit 1;

  -- ── ② 원재료 단가 반영 ──────────────────────────────────────
  -- 대파를 비싸게 사 온다 → 재료비가 오르고 순이익이 그만큼 준다.
  perform e1_confirm_inbound(
    e7_place_order(v_st, v_ing, v_ven, null, 1000, 9000, 1, v_day), 1, 'T17-A');

  v_h   := recipe_profit_history(v_rcp, null, null, 100);
  v_row := v_h -> 'rows' -> 0;

  perform pg_temp.eq('한 줄 늘었다', jsonb_array_length(v_h -> 'rows'), v_n0 + 1);
  perform pg_temp.eq_t('제목은 재료 이름을 쓴다', v_row ->> 'title', '대파 단가 반영');
  perform pg_temp.eq_t('대표 원인은 재료비',      v_row ->> 'cause_key', 'material_cost');
  perform pg_temp.eq_t('시트 라벨',               v_row ->> 'cause_label', '재료비');
  perform pg_temp.eq_t('시트 부제는 재료 이름',   v_row ->> 'source_label', '대파');

  perform pg_temp.eq('직전 순이익은 마지막 스냅샷 그대로',
    (v_row ->> 'profit_before')::numeric, v_prev, 0.01);

  -- 재료비가 오른 만큼 정확히 순이익이 준다. 세금·고정지출은 판매가에만 걸리므로 그대로다.
  perform pg_temp.eq('증감 = −(재료비 증가분)',
    (v_row ->> 'profit_delta')::numeric,
    -((v_row ->> 'cause_after')::numeric - (v_row ->> 'cause_before')::numeric), 0.001);
  perform pg_temp.ok('재료비가 올랐다',
    (v_row ->> 'cause_after')::numeric > (v_row ->> 'cause_before')::numeric);
  perform pg_temp.ok('그래서 순이익은 줄었다', (v_row ->> 'profit_delta')::numeric < 0);

  -- 목록 한 줄과 시트가 **같은 항목**을 가리켜야 한다.
  -- 재료비가 올랐으니 요약도 '증가'다. 순이익 쪽 부호(-)와 헷갈리면 안 된다.
  perform pg_temp.ok('목록 요약도 같은 항목을 말한다', (v_row ->> 'summary') like '재료비%증가');

  -- ── ③ 고정지출 반영 ────────────────────────────────────────
  -- 매출 1,200만 · 임차료 480만 → 고정지출률 40%. 검산값 31.3% 에서 올라간다.
  perform save_fixed_costs(v_st, to_char(v_day, 'YYYY-MM'), 12000000,
    jsonb_build_array(jsonb_build_object('key', 'rent', 'total', 4800000)));
  perform e4_fixed_cost_saved(v_st, to_char(v_day, 'YYYY-MM'));

  v_h   := recipe_profit_history(v_rcp, null, null, 100);
  v_row := v_h -> 'rows' -> 0;
  perform pg_temp.eq_t('제목',          v_row ->> 'title', '고정지출 반영');
  perform pg_temp.eq_t('대표 원인',     v_row ->> 'cause_key', 'fixed_cost');
  perform pg_temp.eq_t('시트 부제',     v_row ->> 'source_label', '고정지출 설정');
  -- 12,000원 × 40% = 4,800원. 검산값 3,756원(31.3%)에서 1,044원 오른다.
  perform pg_temp.eq('고정지출 전',  (v_row ->> 'cause_before')::numeric, 3756, 0.01);
  perform pg_temp.eq('고정지출 후',  (v_row ->> 'cause_after')::numeric,  4800, 0.01);
  perform pg_temp.eq('순이익은 그만큼 준다', (v_row ->> 'profit_delta')::numeric, -1044, 0.01);

  -- ── ④ 레시피 직접 수정 ─────────────────────────────────────
  -- 판매가를 500원 올린다. 순이익이 500원 오르면 **틀린 것이다** —
  -- 부가세 10/110 과 고정지출률이 판매가에 걸려 함께 올라간다.
  select profit_amount into v_p0 from profit_trends
   where recipe_id = v_rcp and profit_amount is not null
   order by occurred_at desc, id desc limit 1;

  -- ⚠ base_servings 를 빼면 안 된다. save_recipe 는 없으면 1인분으로 되돌리고
  --   재료비가 10배로 튄다 — 이 테스트가 처음에 그걸로 걸렸다.
  perform save_recipe(v_st, jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12500, 'base_servings', 10));

  v_h   := recipe_profit_history(v_rcp, null, null, 100);
  v_row := v_h -> 'rows' -> 0;
  v_p1  := (v_row ->> 'profit_after')::numeric;

  perform pg_temp.eq_t('제목',      v_row ->> 'title', '레시피 수정');
  perform pg_temp.eq_t('시트 부제', v_row ->> 'source_label', '직접 수정');
  perform pg_temp.eq('판매가 전후', (v_row ->> 'cause_after')::numeric, 12500, 0.001);
  perform pg_temp.ok('증감은 500원이 아니다',
    abs((v_row ->> 'profit_delta')::numeric - 500) > 1);
  perform pg_temp.eq('증감은 서버 확정값 그대로',
    (v_row ->> 'profit_delta')::numeric, v_p1 - v_p0, 0.001);

  -- ── ⑤ 같은 날 여러 번 ──────────────────────────────────────
  select count(*) into v_n from jsonb_array_elements(v_h -> 'rows');
  perform pg_temp.eq('세 번 고쳤으니 세 줄 늘었다', v_n, v_n0 + 3);

  perform pg_temp.ok('최신이 맨 위다',
    (v_h -> 'rows' -> 0 ->> 'occurred_at')::timestamptz
      > (v_h -> 'rows' -> 1 ->> 'occurred_at')::timestamptz
    and (v_h -> 'rows' -> 1 ->> 'occurred_at')::timestamptz
      > (v_h -> 'rows' -> 2 ->> 'occurred_at')::timestamptz);

  -- 앞줄의 '변경 후'가 뒷줄의 '변경 전'이다 — 사슬이 끊기면 안 된다.
  perform pg_temp.eq('전후값이 이어진다',
    (v_h -> 'rows' -> 0 ->> 'profit_before')::numeric,
    (v_h -> 'rows' -> 1 ->> 'profit_after')::numeric, 0.001);

  -- ── ⑥ 변동 없는 재계산은 사건이 아니다 ─────────────────────
  perform recompute_recipe(v_rcp, 'recipe', null);
  v_h := recipe_profit_history(v_rcp, null, null, 100);
  perform pg_temp.eq('아무것도 안 바뀐 재계산은 목록에 없다',
    jsonb_array_length(v_h -> 'rows'), v_n0 + 3);
  perform pg_temp.ok('그래도 DB 에는 남는다 — 추이는 지우지 않는다',
    (select count(*) from profit_trends where recipe_id = v_rcp and profit_amount is not null) >= 5);

  -- ── ⑦ 옛 비율 행은 섞이지 않는다 ───────────────────────────
  perform pg_temp.ok('옛 비율 행이 실제로 있다',
    (select count(*) from profit_trends
      where recipe_id = v_rcp and profit_amount is null) > 0);
  perform pg_temp.ok('그래도 목록에는 안 나온다',
    not exists (select 1 from jsonb_array_elements(v_h -> 'rows') e
                 where (e ->> 'profit_after') is null));

  -- ── ⑧ 커서 ─────────────────────────────────────────────────
  -- 건수를 못 박지 않는다. 지켜야 하는 건 **겹치지 않고 이어진다**는 것뿐이다.
  v_h := recipe_profit_history(v_rcp, null, null, 2);
  perform pg_temp.eq('첫 장은 2건', jsonb_array_length(v_h -> 'rows'), 2);
  -- ⚠ jsonb 의 null 은 SQL 의 NULL 이 아니다. `-> 'next' is null` 은 항상 거짓이라
  --   이 단언이 아무것도 검사하지 않게 된다 — 실제로 그렇게 통과했었다.
  perform pg_temp.eq_t('다음 커서가 있다', jsonb_typeof(v_h -> 'next'), 'object');
  perform pg_temp.eq_t('커서는 첫 장 마지막 줄이다',
    v_h -> 'next' ->> 'id', v_h -> 'rows' -> 1 ->> 'id');

  v_row := v_h -> 'rows' -> 1;   -- 첫 장 마지막 줄
  v_h := recipe_profit_history(v_rcp,
    (v_h -> 'next' ->> 'occurred_at')::timestamptz,
    (v_h -> 'next' ->> 'id')::uuid, 100);

  perform pg_temp.ok('둘째 장은 첫 장과 겹치지 않는다',
    not exists (select 1 from jsonb_array_elements(v_h -> 'rows') e
                 where (e ->> 'id') = (v_row ->> 'id')));
  perform pg_temp.ok('둘째 장은 전부 더 과거다',
    not exists (select 1 from jsonb_array_elements(v_h -> 'rows') e
                 where (e ->> 'occurred_at')::timestamptz
                       >= (v_row ->> 'occurred_at')::timestamptz));
  perform pg_temp.eq('첫 장 2 + 둘째 장 = 전체',
    2 + jsonb_array_length(v_h -> 'rows'), v_n0 + 3);
  perform pg_temp.eq_t('마지막 장에는 커서가 없다', jsonb_typeof(v_h -> 'next'), 'null');
end $t$;


-- ── ⑨ 반쪽 스냅샷은 조용히 0원이 되지 않는다 ──────────────────
-- 금액 하나가 비어 있으면 화면은 "불러오지 못했어요"라고 말해야 한다.
-- 0원으로 메꾸면 사장님은 순이익이 진짜 그만큼 떨어진 줄 안다.
do $t$
declare
  v_rcp uuid := pg_temp.rcp('된장찌개');
  v_id  uuid;
  v_cnt int;
begin
  -- ⚠ 갱신으로는 못 만든다 — profit_trends 는 append-only 라 UPDATE 정책이 없다(0018).
  --   RLS 는 0건 갱신을 **오류 없이** 돌려주므로, 그 사실부터 못 박아 둔다.
  --   (0083 을 만들 때 여기 걸렸다. 넣은 뒤 요약을 채우려다 조용히 null 로 남았다.)
  select id into v_id from profit_trends
   where recipe_id = v_rcp and profit_amount is not null
   order by occurred_at desc, id desc limit 1;

  update profit_trends set summary = '고칠 수 없어야 한다' where id = v_id;
  get diagnostics v_cnt = row_count;
  perform pg_temp.eq('원장 갱신은 조용히 0건이다 — 오류도 안 난다', v_cnt, 0);

  -- 반쪽 행은 **쌓아서** 만든다. 실제로 나올 수 있는 모양은 이쪽이다.
  insert into profit_trends (
      store_id, recipe_id, trend_date, profit_rate, material_rate, cause,
      occurred_at, price, material_cost, extra_cost, profit_amount)
  values (pg_temp.store(), v_rcp, business_day(), 10, 10, 'recipe',
      clock_timestamp(), 8000, 1000, 0, 5000);   -- 세금·고정지출이 비었다

  perform pg_temp.raises('반쪽 스냅샷은 예외로 막는다',
    format('select recipe_profit_history(%L::uuid)', v_rcp), '45003');
end $t$;


-- ── ⑩ 원장은 그대로다 ─────────────────────────────────────────
-- 0083 은 profit_trends 에 컬럼만 늘렸다. 단가·재고 규칙은 손대지 않았다.
do $t$
declare
  v_ing uuid := pg_temp.ing('대파');
  v_p   numeric;
  v_vol numeric;
  v_amt numeric;
begin
  v_p := base_unit_price(v_ing);
  select sum(volume * received_qty), sum(amount * received_qty) into v_vol, v_amt
    from order_records
   where ingredient_id = v_ing and status in ('received', 'partial');

  -- 0072 의 불변식. 위에서 비싸게 한 번 사 왔어도 이건 그대로 성립해야 한다.
  perform pg_temp.eq('기준단가 × 총입고량 = 그 재료에 쓴 돈', v_p * v_vol, v_amt, 0.01);

  perform pg_temp.ok('옛 비율 행을 지우지 않았다',
    (select count(*) from profit_trends where calculation_version = 1) > 0);
  perform pg_temp.ok('옛 행에 금액을 지어 넣지도 않았다',
    not exists (select 1 from profit_trends
                 where calculation_version = 1 and profit_amount is not null));
end $t$;
