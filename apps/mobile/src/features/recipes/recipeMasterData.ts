import type { SettingsLists } from '@/features/master-data/hooks';
import type { RecipeDraft } from './draftStore';

/** Keep identity and entered quantities; refresh only labels and referenced master prices. */
export function recipeMasterDataPatch(draft: RecipeDraft, lists: SettingsLists): Partial<RecipeDraft> | null {
  const categoryName = lists.recipeCategories.find(c => c.id === draft.categoryId)?.name ?? '';
  let changed = categoryName !== draft.categoryName;
  const extras = draft.extras.map(extra => {
    const current = lists.materials?.find(m => m.id === extra.materialId);
    // Do not silently discard a removed master or a historical custom expense.
    if (!current) return extra;
    if (extra.name === current.name && extra.unitCost === current.unitCost) return extra;
    changed = true;
    return { ...extra, name: current.name, unitCost: current.unitCost, amountPerServing: current.unitCost * extra.qty };
  });
  return changed ? { categoryName, extras } : null;
}
