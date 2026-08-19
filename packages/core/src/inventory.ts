/**
 * 재고 계산 — ① 2.2·4.7, ⑤ 2.3.
 * 잔여 환산량 = 개수 × 개당 용량 × (1−로스율).
 * 뱃지 = 남은 개수 vs 안전재고 + 곧소진 플래그.
 */
import type { StockBadge } from '@sikjae/types';

export interface StockSnapshot {
  sealedCount: number; // 미개봉 수
  openedCount: 0 | 1; // 개봉 수
  openedRemain: number | null; // 개봉분 남은 양(기준단위)
  soonOut: boolean;
}

/** 총 보유 개수(미개봉 + 개봉통). 안전재고 비교 기준. */
export const totalCount = (s: StockSnapshot): number => s.sealedCount + s.openedCount;

/**
 * 잔여 환산량(기준단위) = 미개봉×개당용량 + 개봉분 남은 양.
 * 개봉분 남은 양 미입력 시 한 통 가득(perVolume)으로 가정.
 *
 * ⚠ 로스를 곱하지 않는다. SQL `stock_total_base()` 도 곱하지 않는다 —
 *   재고는 **물건의 양**이지 쓸 수 있는 양의 추정치가 아니다.
 *   (0041 이전에는 이 함수만 (1−로스)를 곱해 SQL 과 어긋나 있었다.)
 */
export function remainConverted(s: StockSnapshot, perVolume: number): number {
  const openedGross = s.openedCount === 1 ? (s.openedRemain ?? perVolume) : 0;
  return s.sealedCount * perVolume + openedGross;
}

/** 재고 상태 뱃지 판정 (③ 3.4). soonOut/소진이 부족보다 우선. */
export function stockBadge(s: StockSnapshot, safetyStock: number): StockBadge {
  const cnt = totalCount(s);
  if (s.soonOut || cnt <= 0) return 'out'; // 소진임박
  if (cnt <= safetyStock) return 'low'; // 부족
  return 'ok'; // 충분
}
