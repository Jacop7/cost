/** Supplementary item details never replace the authoritative preview totals. */
export type PreviewCostDetails = {
  taxItems: { name: string; amount: number }[] | null;
  fixedMonth: string; fixedRevenue: number | null; fixedTotal: number | null;
  fixedItems: { key: string; total: number }[] | null;
};
export const sameCost = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
export function previewCostDetails(quote: Record<string, unknown>, basis: Record<string, unknown>): PreviewCostDetails {
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const components = Array.isArray(quote.components) ? quote.components : null;
  const valid = components?.every(v => v && typeof v === 'object' && typeof v.name === 'string' && finite(v.rounded_amount));
  const items = valid ? components!.map(v => ({ name: v.name as string, amount: v.rounded_amount as number })) : null;
  const rawFixed = Array.isArray(basis.fixed_items) ? basis.fixed_items : null;
  const validFixed = rawFixed?.every(v => v && typeof v === 'object' && typeof v.key === 'string' && finite(v.total));
  return {
    taxItems: items && finite(quote.tax_total) && sameCost(items.reduce((sum, v) => sum + v.amount, 0), quote.tax_total) ? items : null,
    fixedMonth: typeof basis.fixed_month === 'string' ? basis.fixed_month : '',
    fixedRevenue: finite(basis.fixed_revenue) ? basis.fixed_revenue : null,
    fixedTotal: finite(basis.fixed_total) ? basis.fixed_total : null,
    fixedItems: validFixed ? rawFixed!.map(v => ({ key: v.key as string, total: v.total as number })) : null,
  };
}
