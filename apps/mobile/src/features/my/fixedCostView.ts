import type { FixedCostItem } from './hooks';

export const FIXED_COST_LABEL: Record<string, string> = {
  labor: '인건비',
  rent: '임대료',
  utility: '공과금',
  commission: '플랫폼 수수료',
  packing: '포장비',
  delivery: '배달/배송',
  ads: '광고/홍보',
  etc: '기타',
};

export const fullFixedMonthLabel = (month: string) =>
  `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;

/** 서버가 확정한 월별 항목을 기준 개월 수로 나눠 상세 화면용 항목 평균을 만든다. */
export function averageFixedCostItems(
  months: { items: FixedCostItem[] }[],
  divisor: number,
): FixedCostItem[] {
  const items = new Map<string, { label?: string; total: number; lines: Map<string, number> }>();
  for (const month of months)
    for (const item of month.items) {
      const current = items.get(item.key) ?? {
        label: item.label,
        total: 0,
        lines: new Map<string, number>(),
      };
      current.label ??= item.label;
      current.total += item.total;
      for (const line of item.lines)
        current.lines.set(line.name, (current.lines.get(line.name) ?? 0) + line.amount);
      items.set(item.key, current);
    }
  return [...items.entries()].map(([key, item]) => ({
    key,
    label: item.label,
    mode: item.lines.size ? 'detail' : 'total',
    total: item.total / divisor,
    lines: [...item.lines.entries()].map(([name, amount]) => ({ name, amount: amount / divisor })),
    weights: null,
  }));
}
