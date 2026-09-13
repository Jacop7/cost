/** Keep legacy sale-only costs in the unified display; unknown never means zero. */
export function combinedMaterialCost(material: number | null | undefined, extra: number | null | undefined): number | null {
  return material == null || extra == null ? null : material + extra;
}
