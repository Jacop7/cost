/** User revision conflicts are distinct from database serialization failures. */
export function isIngredientRevisionConflict(error: unknown): boolean {
  const value = error as { code?: unknown; details?: unknown } | null;
  return value?.code === '45009' && value.details === 'REVISION_CONFLICT';
}
