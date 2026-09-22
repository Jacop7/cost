/** 서버의 미입력 표시를 우선한다. 오래된 목록 응답만 입고일·수량으로 판정한다. */
export function isStockUnentered(g: { lastInboundAt: string | null; stockTotal: number; stockTracking?: boolean; stockEntered?: boolean }): boolean {
  if (g.stockTracking === false) return false;
  if (g.stockEntered !== undefined) return !g.stockEntered;
  return g.lastInboundAt === null && g.stockTotal === 0;
}
