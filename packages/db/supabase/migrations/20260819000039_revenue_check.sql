-- ════════════════════════════════════════════════════════════════
-- 0039 · M-030 고정지출률 분모와 실제 매출의 괴리 (조회 전용)
--
-- 총 월매출은 **수기 입력이 설계 의도**다:
--   레시피_상세로직_유저시나리오_v3 §111 "총 월매출 | 고정지출률의 분모.
--   (향후 POS/채널 연동 자동화 여지)"
-- 그래서 자동으로 덮어쓰지 않는다. 대신 **얼마나 어긋났는지 보여준다.**
--
-- 왜 필요한가: 사장님이 월초에 한 번 적은 예상 매출이 전 메뉴 순이익에 곱해진다.
-- 실측(2026-08, 19/31일): 수기 12,000,000 vs 월 환산 실적 20,479,579 → 괴리 +70.7%.
-- 고정지출률 31.30% 가 실적 기준으론 18.34% 이고, 제육볶음 개당 고정비가 1,555원 과대다.
-- 모르는 채로 모든 메뉴 손익이 틀어져 있었다.
--
-- ⚠ 이 함수는 **아무것도 바꾸지 않는다.** fixed_cost_rate() 의 분모는 여전히 수기 값이다.
--   월 환산을 비율에 쓰면 월초 3일차에 분모가 폭주한다(고정비 ÷ 3일치 매출).
-- ════════════════════════════════════════════════════════════════

create or replace function public.fixed_cost_revenue_check(p_store uuid, p_month text)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_first     date;
  v_last      date;
  v_today     date := business_day();
  v_days_in   int;      -- 그 달에서 지금까지 경과한 일수
  v_days_all  int;      -- 그 달의 총 일수
  v_manual    numeric;
  v_fixed_sum numeric;
  v_actual    numeric;
  v_projected numeric;
begin
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode = '22000';
  end if;

  v_first    := (p_month || '-01')::date;
  v_last     := (v_first + interval '1 month - 1 day')::date;
  v_days_all := extract(day from v_last)::int;

  -- 진행 중인 달이면 오늘까지, 지난 달이면 월 전체. 미래 달이면 경과 0.
  v_days_in := case
                 when v_today >= v_last  then v_days_all
                 when v_today <  v_first then 0
                 else extract(day from v_today)::int
               end;

  select total_revenue,
         coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i), 0)
    into v_manual, v_fixed_sum
    from fixed_costs_monthly
   where store_id = p_store and month = p_month;

  v_actual := (sales_summary(p_store, v_first, least(v_last, v_today))->>'revenue')::numeric;

  -- 월 환산 — 진행 중인 달만 일할 추정한다. 끝난 달은 실적이 곧 월 매출이다.
  v_projected := case
                   when v_days_in = 0 then null
                   when v_days_in >= v_days_all then v_actual
                   else v_actual / v_days_in * v_days_all
                 end;

  return jsonb_build_object(
    'month', p_month,
    'days_elapsed', v_days_in,
    'days_total', v_days_all,
    'in_progress', (v_days_in > 0 and v_days_in < v_days_all),
    -- 사장님이 적은 값. 없으면 null(0 이 아니다 — "0원 매출"과 "안 적음"은 다르다).
    'manual_revenue', nullif(v_manual, 0),
    'fixed_total', v_fixed_sum,
    'actual_revenue', v_actual,
    'projected_revenue', v_projected,
    -- 괴리 = (월 환산 실적 ÷ 수기) − 1. 둘 중 하나라도 없으면 null.
    'gap_pct', case
                 when v_manual is null or v_manual <= 0 or v_projected is null then null
                 else (v_projected / v_manual - 1) * 100
               end,
    'rate_manual',    case when coalesce(v_manual, 0)    > 0 then v_fixed_sum / v_manual    end,
    'rate_projected', case when coalesce(v_projected, 0) > 0 then v_fixed_sum / v_projected end,
    -- 판매 기록이 아예 없으면 비교할 것이 없다. 화면이 "아직 매출 기록이 없어요"를 띄운다.
    'has_sales', (v_actual > 0));
end;
$fn$;

comment on function public.fixed_cost_revenue_check(uuid, text) is
  '수기 월매출(고정지출률 분모)과 실제 매출의 괴리. 조회 전용 — 비율 계산은 바꾸지 않는다(0039).';

select public.assert_no_rpc_overloads();
