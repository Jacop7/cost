/**
 * 매출 비율의 공통 계약.
 *
 * 하루 조회는 그날 금액 / 그날 매출, 기간 조회는 기간 금액 합계 / 기간 매출 합계다.
 * 일별 퍼센트를 더하거나 평균 내지 않는다. 과거 매출을 수정하면 서버가 최신 판본의
 * 금액 합계를 다시 내려 주고, 화면은 그 합계만 이 함수에 넣는다.
 */
export function percentOfTotal(amount: number, total: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((amount / total) * 1000) / 10;
}

export function nullablePercentOfTotal(amount: number | null | undefined, total: number): number | null {
  return amount == null ? null : percentOfTotal(amount, total);
}

export function percentOfTotalText(amount: number, total: number): string {
  return `${percentOfTotal(amount, total)}%`;
}
