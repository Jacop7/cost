-- ════════════════════════════════════════════════════════════════
-- 24 · recipe_detail 의 고정지출 계약 (0128)
--
-- 왜 이 시험이 있어야 하는가 —
--   0128 마이그레이션도 사후 확인을 하지만 그건 **적용될 때 한 번**이다.
--   `recipe_detail` 은 여기저기서 `create or replace` 로 다시 정의되는 함수라,
--   다음 사람이 무심코 옛 모양으로 덮어써도 마이그레이션은 다시 안 돈다.
--   계약은 상시 회귀에서 잡아야 한다.
--
-- 지키는 계약 넷:
--   ① fixed_month = store_local_month(레시피 매장)
--   ② fixed_items = 그 매장·그 달의 fixed_costs_monthly.items
--   ③ fixed_rate  = fixed_cost_rate(매장, fixed_month)
--   ④ 항목 합계로 되짚은 비율 = fixed_rate
--
-- ⚠ ④ 가 핵심이다. ①②③ 이 각각 맞아도 **서로 다른 달**을 보면 화면이 거짓말한다 —
--   9월 비율을 8월 항목으로 쪼개면 소계는 맞고 줄마다 틀린다. 그게 제일 안 보인다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rid   uuid := pg_temp.rcp('제육볶음');
  v_store uuid := pg_temp.store();
  v_res   jsonb;
  v_month text;
  v_rate  numeric;
  v_rev   numeric;
  v_sum   numeric;
begin
  v_res := recipe_detail(v_rid);

  -- ── ① 기준 월 ──────────────────────────────────────────────
  perform pg_temp.ok('fixed_month 이 있다', v_res ? 'fixed_month');
  perform pg_temp.eq_t('fixed_month = 매장 현지 달',
    v_res->>'fixed_month', store_local_month(v_store));
  -- 형식도 본다. 앱이 'YYYY-MM' 으로 검사하므로 여기서 어긋나면 화면이 오류로 뜬다.
  perform pg_temp.ok('fixed_month 형식이 YYYY-MM',
    (v_res->>'fixed_month') ~ '^\d{4}-(0[1-9]|1[0-2])$');

  v_month := v_res->>'fixed_month';

  -- ── ② 항목 ────────────────────────────────────────────────
  perform pg_temp.ok('fixed_items 가 배열이다',
    jsonb_typeof(v_res->'fixed_items') = 'array');
  perform pg_temp.ok('fixed_items = 그 매장·그 달의 items',
    (v_res->'fixed_items')
      = coalesce((select items from fixed_costs_monthly
                   where store_id = v_store and month = v_month), '[]'::jsonb));

  -- ── ③ 비율 ────────────────────────────────────────────────
  v_rate := (v_res->>'fixed_rate')::numeric;
  perform pg_temp.eq('fixed_rate = fixed_cost_rate(매장, fixed_month)',
    v_rate, coalesce(fixed_cost_rate(v_store, v_month), 0), 0.0000001);

  -- ── ④ 항목 합계로 되짚은 비율 = fixed_rate ─────────────────
  -- 고정지출률 = 항목 합계 ÷ 그 달 매출(0048). 셋이 같은 달이라야 이게 성립한다.
  select total_revenue into v_rev from fixed_costs_monthly
   where store_id = v_store and month = v_month;
  select coalesce(sum((x->>'total')::numeric), 0) into v_sum
    from jsonb_array_elements(v_res->'fixed_items') x;

  if coalesce(v_rev, 0) > 0 then
    perform pg_temp.eq('항목 합계 ÷ 그 달 매출 = fixed_rate',
      v_sum / v_rev, v_rate, 0.0000001);
    -- 검산값 고정. 시드가 31.3% 다 — 여기가 움직이면 전 메뉴 손익이 움직인 것이다.
    perform pg_temp.eq('고정지출률 31.3% 불변', v_rate, 0.313, 0.0000001);
  else
    -- 그 달을 아직 안 적었으면 비율도 0 이고 항목도 비어야 한다. 한쪽만 차면 안 된다.
    perform pg_temp.eq('안 적은 달이면 비율 0', v_rate, 0, 0.0000001);
    perform pg_temp.eq('안 적은 달이면 항목도 0', v_sum, 0, 0.0000001);
  end if;
end $t$;


-- ── ⑤ 셋이 **함께** 움직인다 ───────────────────────────────────
-- 여기가 이 파일의 진짜 목적이다. ①②③ 이 각각 맞아도 서로 다른 달을 보면
-- 화면이 거짓말한다. 그래서 **같이 움직이는지**를 직접 흔들어 본다.
--
-- ⚠ 예전 판본은 매장 시간대를 옮겨 달을 넘기려 했다. 8/26 처럼 달 경계에서 먼 날에는
--   어떤 시간대로도 못 넘겨서 블록이 통째로 **조용히 건너뛰어졌다** — 초록인데 아무것도
--   확인 안 한 상태다. 날짜에 기대지 않는 방법으로 바꿨다.
do $t$
declare
  v_rid   uuid := pg_temp.rcp('제육볶음');
  v_store uuid := pg_temp.store();
  v_now   text := store_local_month(v_store);
  v_prev  text := to_char((v_now || '-01')::date - interval '1 month', 'YYYY-MM');
  v_res   jsonb;
  v_sum   numeric;
begin
  -- ⑤-a 다른 달 행이 있어도 **이번 달** 것을 고른다.
  --     `그 매장의 아무 행` 이나 `제일 최근 행` 을 집는 구현이 여기서 걸린다.
  insert into fixed_costs_monthly (store_id, month, total_revenue, items)
  values (v_store, v_prev, 9000000,
          '[{"key":"rent","mode":"total","total":9000000,"lines":[],"weights":null}]'::jsonb)
  on conflict (store_id, month) do update
     set total_revenue = excluded.total_revenue, items = excluded.items;

  v_res := recipe_detail(v_rid);
  perform pg_temp.eq_t('지난달 행이 있어도 이번 달을 본다', v_res->>'fixed_month', v_now);
  perform pg_temp.ok('지난달 항목(9,000,000)이 섞이지 않았다',
    not (v_res->'fixed_items' @> '[{"total": 9000000}]'::jsonb));
  -- 지난달 비율은 100% 다. 그게 새어 나오면 여기서 걸린다.
  perform pg_temp.ok('지난달 비율(1.0)이 새지 않았다',
    (v_res->>'fixed_rate')::numeric <> 1);

  -- ⑤-b 이번 달 값을 바꾸면 비율과 항목이 **함께** 따라간다.
  --     항목 400,000 ÷ 매출 2,000,000 = 0.2
  insert into fixed_costs_monthly (store_id, month, total_revenue, items)
  values (v_store, v_now, 2000000,
          -- ⚠ 괄호가 필요하다. `'a' || 'b'::jsonb` 는 뒤쪽만 캐스팅해서 터진다.
          ('[{"key":"rent","mode":"total","total":250000,"lines":[],"weights":null},'
        || ' {"key":"ads","mode":"total","total":150000,"lines":[],"weights":null}]')::jsonb)
  on conflict (store_id, month) do update
     set total_revenue = excluded.total_revenue, items = excluded.items;

  v_res := recipe_detail(v_rid);
  select coalesce(sum((x->>'total')::numeric), 0) into v_sum
    from jsonb_array_elements(v_res->'fixed_items') x;

  perform pg_temp.eq_t('달은 그대로', v_res->>'fixed_month', v_now);
  perform pg_temp.eq('비율이 새 값(0.2)으로', (v_res->>'fixed_rate')::numeric, 0.2, 0.0000001);
  perform pg_temp.eq('항목도 새 값(400,000)으로', v_sum, 400000, 0.0000001);
  perform pg_temp.eq('되짚은 비율 = fixed_rate',
    v_sum / 2000000, (v_res->>'fixed_rate')::numeric, 0.0000001);
  perform pg_temp.ok('항목이 두 줄(rent·ads)이다',
    jsonb_array_length(v_res->'fixed_items') = 2);

  -- ⑤-c 이번 달 행을 지우면 **둘 다** 빈다. 한쪽만 남으면 화면이 거짓말한다 —
  --     `이번 달 고정지출이 없어요` 라면서 소계는 3,756원 이 찍히는 그 상태다.
  delete from fixed_costs_monthly where store_id = v_store and month = v_now;

  v_res := recipe_detail(v_rid);
  perform pg_temp.eq_t('달은 여전히 있다', v_res->>'fixed_month', v_now);
  perform pg_temp.eq('행이 없으면 비율 0', (v_res->>'fixed_rate')::numeric, 0, 0.0000001);
  perform pg_temp.ok('행이 없으면 항목은 빈 배열',
    v_res->'fixed_items' = '[]'::jsonb);
  -- ⚠ 지난달 행은 아직 살아 있다. 그런데도 비어야 한다 — 달을 안 보고 아무거나
  --   집는 구현이라면 여기서 9,000,000 이 튀어나온다.
  perform pg_temp.ok('지난달 행이 남아 있어도 안 집는다',
    jsonb_array_length(v_res->'fixed_items') = 0);
end $t$;
