/** Readable legacy data does not imply support for versioned editing. */
export type RecipeDetailReadContract = {
  editRevision: string | null;
  extras: { qty: number | null }[];
};

export const RECIPE_EDIT_UNAVAILABLE = '현재 연결에서는 메뉴를 조회할 수 있어요. 수정·저장은 업데이트 후 사용할 수 있어요.';

export function canEditRecipeDetail<T extends RecipeDetailReadContract>(
  value: T | null | undefined,
): value is T & { editRevision: string; extras: (Omit<T['extras'][number], 'qty'> & { qty: number })[] } {
  return Boolean(value && typeof value.editRevision === 'string' && /^[1-9][0-9]*$/.test(value.editRevision)
    && value.extras.every(extra => extra.qty !== null));
}
