/**
 * 단가 계산 — ⑤ 2.3, ① 4.1·8.6.
 * 기준 단가 = 구매이력 가중평균(수량 가중). 산 값 그대로다.
 *
 * ⚠ 0041 에서 로스율을 없앴다. 예전에는 `÷ (1−로스율)` 로 추정 손실을 단가에 얹었는데,
 *   폐기를 입력하면 실측이 추정을 통째로 대체해 **단가가 오히려 내려가는** 구조였다.
 *   이제 손실은 추정하지 않고 실제로 버릴 때만 폐기로 기록한다.
 *
 * 경계 계약 (가이드 불변식 6):
 *   산출이 불가능한 입력은 0이 아니라 **null**을 반환한다. 0으로 위장하면 원가가 0원이 되어
 *   순이익이 과대 계상되고, 그 값이 저장 경로로 들어가면 DB가 오염된다.
 *   SQL 쪽도 같은 의미로 `nullif(volume,0)` / `nullif(1 - v_loss, 0)`를 써서 null을 반환한다
 *   (packages/db/supabase/migrations/20260608000006_calc_helpers.sql).
 */
import { isNonNegativeFinite, isPositiveFinite } from './guards';

export interface PurchaseLike {
  amount: number; // 금액 (원)
  volume: number; // 용량 (기준단위)
  qty: number; // 수량 (구매단위 개수)
}

/**
 * 구매 1건의 환산 단가 = 금액 ÷ 용량 (원/기준단위, 로스 미반영).
 * 용량 0 이하·음수 금액·비유한 입력은 산출 불가(null). 금액 0은 유효한 0원 단가다.
 */
export function rawUnitPrice(amount: number, volume: number): number | null {
  if (!isNonNegativeFinite(amount)) return null;
  if (!isPositiveFinite(volume)) return null;
  return amount / volume;
}

/**
 * 수량 가중 평균 단가 (로스 미반영). 유효한 이력이 없으면 null.
 * 용량 0 같은 오염된 행 하나가 전체 평균을 NaN으로 만들지 않도록 해당 행만 건너뛴다.
 */
export function weightedAvgUnitPrice(purchases: PurchaseLike[]): number | null {
  let pricedQty = 0;
  let weighted = 0;
  for (const p of purchases) {
    const per = rawUnitPrice(p.amount, p.volume);
    if (per === null) continue; // 오염된 이력 행은 평균에서 제외
    if (!isPositiveFinite(p.qty)) continue;
    weighted += per * p.qty;
    pricedQty += p.qty;
  }
  return pricedQty > 0 ? weighted / pricedQty : null;
}

/**
 * 기준 단가 = 실입고량 가중평균, 그 이상 아무것도 아니다 (0041).
 * SQL `base_unit_price()` 와 같은 값이어야 한다.
 */
export function baseUnitPrice(avgUnitPrice: number | null): number | null {
  if (avgUnitPrice === null || !isNonNegativeFinite(avgUnitPrice)) return null;
  return avgUnitPrice;
}

/**
 * 등록 미리보기 단가 — 단일 구매가 기준 (① 3.5, A-02).
 * 예: 4,000원 / 1,000g → 4.00원/g
 */
export const previewBaseUnitPrice = (amount: number, volume: number): number | null =>
  baseUnitPrice(rawUnitPrice(amount, volume));

/** 입고가가 평균 대비 ±임계% 벗어나는지 (E1 급등 알림 판정, 기본 15%). */
export function isPriceSpike(newUnitPrice: number, avgUnitPrice: number, threshold = 0.15): boolean {
  if (!isPositiveFinite(avgUnitPrice) || !isNonNegativeFinite(newUnitPrice)) return false;
  return Math.abs(newUnitPrice - avgUnitPrice) / avgUnitPrice >= threshold;
}
