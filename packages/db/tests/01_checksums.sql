-- ════════════════════════════════════════════════════════════════
-- 01 · 검산 기준값 (CLAUDE.md "검산 기준값" 절)
--
-- 이 파일이 빨간색이면 나머지는 볼 필요가 없다. 공식이 움직인 것이다.
-- 시드는 이 값이 나오도록 고정돼 있다 — 시드를 고쳐 값이 바뀌면 그것도 실패다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  r record;
  v_price numeric := 12000;
begin
  -- ── 대파: 4,000원 / 1,000g, 로스 15% → 4.7059원/g ──────────────
  perform pg_temp.eq('대파 기준단가(원/g)', base_unit_price(pg_temp.ing('대파')), 4.7059, 0.0001);
  -- 로스가 단가에 들어가는 방식을 못 박는다: 금액 ÷ 용량 ÷ (1 − 로스)
  perform pg_temp.eq('대파 = 4000/1000/(1-0.15)',
                     base_unit_price(pg_temp.ing('대파')), 4000::numeric/1000/0.85, 0.0001);

  -- ── 고정지출률 31.30% (1,000원당 313원) ──────────────────────
  perform pg_temp.eq('고정지출률(%)',
                     fixed_cost_rate(pg_temp.store(), business_month()) * 100, 31.30, 0.01);

  -- ── 제육볶음 10인분 · 판매가 12,000 (부가세 포함) ─────────────
  select * into r from recipe_list(pg_temp.store()) where name = '제육볶음';
  perform pg_temp.eq('제육볶음 판매가',   r.price,         v_price,   0.01);
  perform pg_temp.eq('제육볶음 재료비',   r.material_cost, 2834.55,   0.01);
  perform pg_temp.eq('제육볶음 추가지출', r.extra_cost,     300.00,   0.01);
  perform pg_temp.eq('제육볶음 순이익',   r.profit,        4018.54,   0.01);
  perform pg_temp.eq('제육볶음 순이익률(%)', r.profit_rate * 100, 33.49, 0.01);

  -- 세금: 부가세 포함 = 판매가 × 10/110
  perform pg_temp.eq('제육볶음 부가세', r.tax, v_price * 10 / 110, 0.01);
  -- 고정비 = 판매가 × 고정지출률 (분모는 수기 월매출 — 0039 참고)
  perform pg_temp.eq('제육볶음 고정비', r.fixed_cost, v_price * 0.313, 0.01);

  -- 손익 항등식. 위 값들이 개별로 맞아도 합이 안 맞으면 어딘가 이중 차감이다.
  perform pg_temp.eq('순이익 = 판매가 − 세금 − 재료비 − 추가지출 − 고정비',
                     r.profit,
                     r.price - r.tax - r.material_cost - r.extra_cost - r.fixed_cost, 0.0001);
end $t$;
