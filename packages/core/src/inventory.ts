/**
 * 재고 상태 — 기준단위(g/ml/개) 총량과 안전재고를 비교한다.
 * 총량 계산과 변경은 서버가 권위이며 클라이언트는 상태만 미리 본다.
 */
import type { StockBadge } from '@sikjae/types';

export interface StockSnapshot {
  stockTotal: number; // 현재 재고 총량(기준단위)
  soonOut: boolean;
}

/** 재고 상태 뱃지 판정. 두 값 모두 같은 기준단위여야 한다. */
export function stockBadge(s: StockSnapshot, safetyStockBase: number): StockBadge {
  if (s.soonOut || s.stockTotal <= 0) return 'out'; // 소진임박
  if (s.stockTotal <= safetyStockBase) return 'low'; // 부족
  return 'ok'; // 충분
}
