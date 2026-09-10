import type { RecipeDetail } from './hooks';

/** Readable legacy data does not imply support for versioned editing. */
export type RecipeDetailView = Omit<RecipeDetail, 'editRevision' | 'extras'> & {
  editRevision: string | null;
  extras: (Omit<RecipeDetail['extras'][number], 'qty'> & { qty: number | null })[];
};

export const RECIPE_EDIT_UNAVAILABLE = '현재 연결에서는 레시피를 조회할 수 있어요. 수정·저장은 업데이트 후 사용할 수 있어요.';

export function canEditRecipeDetail(value: RecipeDetailView | null | undefined): value is RecipeDetail {
  return Boolean(value && typeof value.editRevision === 'string' && /^[1-9][0-9]*$/.test(value.editRevision)
    && value.extras.every(extra => extra.qty !== null));
}
