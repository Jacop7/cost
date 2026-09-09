/** Pure scope classifier, not an approval issuer or a release gate.
 * Callers must verify the human decision and supply tracked Git blobs themselves.
 * dirtyPaths must include staged, unstaged and untracked paths. No filesystem or
 * Git access occurs here, and paths are never normalized into an approved path.
 */
const PREFIXES = [
  'apps/mobile/src/features/ingredients/',
  'apps/mobile/app/(tabs)/ingredients/',
];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactPath = path => {
  if (typeof path !== 'string' || path.length === 0) return false;
  const parts = path.split('/');
  // Expo route filenames are literal Git paths, never expanded as patterns.
  // Only a final [param].tsx or [...param].tsx inside the two boundaries qualifies.
  const literalRoute = PREFIXES.some(prefix => path.startsWith(prefix))
    && /^\[(?:\.\.\.)?[A-Za-z0-9_]+\]\.tsx$/.test(parts.at(-1));
  const checked = literalRoute ? [...parts.slice(0, -1), 'route.tsx'].join('/') : path;
  return !/[\\:*?\[\]{}\x00-\x1f\x7f]/.test(checked) && !path.startsWith('/')
    && parts.every(part => part !== '' && part !== '.' && part !== '..');
};
const ingredientPath = path => exactPath(path) && PREFIXES.some(prefix => path.startsWith(prefix));

/**
 * @param {{changedPaths: string[], approvedEntries: {path: string, blob: string}[],
 * currentBlobs: Record<string, string>, approvedCommitIsAncestor: boolean,
 * dirtyPaths: string[]}} input
 * @returns {{allowed: string[], blocked: string[], errors: string[]}}
 */
export function classifyIngredientScope(input) {
  const errors = [];
  const source = record(input) ? input : {};
  const paths = Array.isArray(source.changedPaths)
    ? [...new Set(source.changedPaths.filter(path => typeof path === 'string'))] : [];
  const denyAll = () => ({ allowed: [], blocked: paths, errors });
  if (!Array.isArray(source.changedPaths) || source.changedPaths.some(path => !exactPath(path))) {
    errors.push('INVALID_CHANGED_PATHS');
  }
  if (!Array.isArray(source.dirtyPaths) || source.dirtyPaths.some(path => !exactPath(path))) {
    errors.push('INVALID_DIRTY_PATHS');
  }
  if (!record(source.currentBlobs)) errors.push('INVALID_CURRENT_BLOBS');
  if (!Array.isArray(source.approvedEntries)) errors.push('INVALID_APPROVED_ENTRIES');

  const approved = new Map();
  for (const entry of Array.isArray(source.approvedEntries) ? source.approvedEntries : []) {
    if (!record(entry) || !ingredientPath(entry.path) || typeof entry.blob !== 'string'
      || !/^[0-9a-f]{40}$/.test(entry.blob)) {
      errors.push('INVALID_APPROVED_ENTRY');
      continue;
    }
    if (approved.has(entry.path)) errors.push(`DUPLICATE_APPROVED_PATH: ${entry.path}`);
    approved.set(entry.path, entry.blob);
  }
  if (source.approvedCommitIsAncestor !== true) errors.push('APPROVED_COMMIT_NOT_ANCESTOR');
  if (errors.length) return denyAll();

  const dirty = new Set(source.dirtyPaths);
  const allowed = [], blocked = [];
  for (const path of paths) {
    const permitted = ingredientPath(path) && approved.has(path) && !dirty.has(path)
      && own(source.currentBlobs, path) && source.currentBlobs[path] === approved.get(path);
    (permitted ? allowed : blocked).push(path);
  }
  return { allowed, blocked, errors };
}
