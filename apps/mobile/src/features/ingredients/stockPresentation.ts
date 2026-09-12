/** 입고 전의 빈 식재료만 구분한다. 실사·판매 등으로 생긴 실제 수량은 숨기지 않는다. */
export function isStockUnentered(g: { lastInboundAt: string | null; stockTotal: number }): boolean {
  return g.lastInboundAt === null && g.stockTotal === 0;
}
