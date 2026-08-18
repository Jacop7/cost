/**
 * 단가 계산 — ⑤ 2.3, ① 4.1·8.6.
 * 기준 단가 = 구매이력 가중평균(수량 가중) ÷ (1−로스율).
 * 실측 로스율 = 누적 폐기량 ÷ 누적 구매량.
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
 * 기준 단가 = 평균 단가 ÷ (1 − 로스율). lossRate 는 0~1.
 * 로스율 100% 이상이면 남는 양이 없어 단가를 정의할 수 없다 → null.
 * (0으로 나눠 Infinity, 100% 초과 시 음수 단가가 나오던 문제를 여기서 차단한다.)
 */
export function baseUnitPrice(avgUnitPrice: number | null, lossRate: number): number | null {
  if (avgUnitPrice === null || !isNonNegativeFinite(avgUnitPrice)) return null;
  if (!Number.isFinite(lossRate) || lossRate < 0 || lossRate >= 1) return null;
  return avgUnitPrice / (1 - lossRate);
}

/**
 * 등록 미리보기 단가 — 단일 구매가 기준 (① 3.5, A-02).
 * 예: 4,000원 / 1,000g, 로스 15% → 4.71원/g
 */
export const previewBaseUnitPrice = (
  amount: number,
  volume: number,
  lossRate: number,
): number | null => baseUnitPrice(rawUnitPrice(amount, volume), lossRate);

/**
 * 실측 로스율 = 누적 폐기량 ÷ 누적 구매량 (**0~1 비율**). 구매 0이면 null.
 * ⚠ SQL `real_loss_rate()`는 같은 값을 **%**로 반환한다(100배). 연결 시 단위를 반드시 맞출 것.
 */
export function realLossRate(totalDiscarded: number, totalPurchased: number): number | null {
  if (!isNonNegativeFinite(totalDiscarded)) return null;
  if (!isPositiveFinite(totalPurchased)) return null;
  return totalDiscarded / totalPurchased;
}

/** 입고가가 평균 대비 ±임계% 벗어나는지 (E1 급등 알림 판정, 기본 15%). */
export function isPriceSpike(newUnitPrice: number, avgUnitPrice: number, threshold = 0.15): boolean {
  if (!isPositiveFinite(avgUnitPrice) || !isNonNegativeFinite(newUnitPrice)) return false;
  return Math.abs(newUnitPrice - avgUnitPrice) / avgUnitPrice >= threshold;
}
