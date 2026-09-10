/** Recipe v2 write envelope. Revisions are decimal strings, never JS integers. */
export type RecipePatch = 'create' | 'full' | 'memo' | 'active';
export type RecipeScope = Readonly<{ actorId: string; storeId: string }>;
export type RecipePayload = Readonly<Record<string, unknown>>;
export interface RecipeInput {
  patch: RecipePatch;
  requestId: string;
  id?: string;
  expectedRevision?: string;
  name?: string;
  price?: number;
  categoryId?: string | null;
  active?: boolean;
  memo?: string | null;
  baseServings?: number;
  targetProfitRate?: number;
  avgMonthlySales?: number | null;
  lines?: { ingredientId?: string | null; subRecipeId?: string | null; inputQty: number }[];
  extras?: { materialId?: string | null; name?: string; amountPerServing?: number; qty?: number }[];
}
