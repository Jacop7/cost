import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyIngredientScope } from './ingredient-p3-scope.mjs';

const feature = 'apps/mobile/src/features/ingredients/screens/IngredientDetailScreen.tsx';
const route = 'apps/mobile/app/(tabs)/ingredients/index.tsx';
const blob = 'a'.repeat(40);
const otherBlob = 'b'.repeat(40);
const input = overrides => ({
  changedPaths: [feature], approvedEntries: [{ path: feature, blob }],
  currentBlobs: { [feature]: blob }, approvedCommitIsAncestor: true, dirtyPaths: [], ...overrides,
});
const blocked = (value, paths = [feature]) => {
  const result = classifyIngredientScope(value);
  assert.deepEqual(result.allowed, []);
  assert.deepEqual(result.blocked, paths);
  return result;
};

test('exact approved clean feature blob is allowed', () => {
  assert.deepEqual(classifyIngredientScope(input()), { allowed: [feature], blocked: [], errors: [] });
});
test('exact tabs ingredient route is allowed', () => {
  assert.deepEqual(classifyIngredientScope(input({ changedPaths: [route],
    approvedEntries: [{ path: route, blob }], currentBlobs: { [route]: blob } })).allowed, [route]);
});
test('changed content is blocked even on an approved path', () => {
  blocked(input({ currentBlobs: { [feature]: otherBlob } }));
});
test('dirty or untracked approved path is always blocked, even with matching blob', () => {
  blocked(input({ dirtyPaths: [feature] }));
});
test('missing tracked blob is blocked', () => {
  blocked(input({ currentBlobs: {} }));
});
test('prototype-inherited blob is not proof of tracked content', () => {
  blocked(input({ currentBlobs: Object.create({ [feature]: blob }) }));
});
test('other domains and shared components remain blocked', () => {
  const others = ['apps/mobile/src/features/recipes/index.ts', 'apps/mobile/src/theme/tokens.ts',
    'apps/mobile/src/components/kit/Button.tsx', 'apps/mobile/src/features/ingredients-other/a.ts'];
  const result = classifyIngredientScope(input({ changedPaths: [feature, ...others] }));
  assert.deepEqual(result.allowed, [feature]); assert.deepEqual(result.blocked, others);
});
test('an outside-domain manifest entry invalidates the entire manifest', () => {
  assert.ok(blocked(input({ approvedEntries: [{ path: feature, blob },
    { path: 'apps/mobile/src/theme/tokens.ts', blob }] })).errors.length);
});
test('duplicate approved paths invalidate the entire manifest', () => {
  assert.ok(blocked(input({ approvedEntries: [{ path: feature, blob }, { path: feature, blob }] })).errors.length);
});
for (const path of [
  'apps/mobile/src/features/ingredients/../recipes/a.ts',
  'apps/mobile/src/features/ingredients/./a.ts',
  'apps/mobile/src/features/ingredients//a.ts',
  'apps/mobile/src/features/ingredients/',
  'apps\\mobile\\src\\features\\ingredients\\a.ts',
  '/apps/mobile/src/features/ingredients/a.ts',
  'C:/apps/mobile/src/features/ingredients/a.ts',
  'apps/mobile/src/features/ingredients/*.tsx',
  'apps/mobile/src/features/ingredients/a?.tsx',
  'apps/mobile/src/features/ingredients/[a-z].tsx',
  'apps/mobile/src/features/ingredients/{a,b}.tsx',
  'apps/mobile/src/features/ingredients/a\n.ts',
]) {
  test(`malformed approved path fails closed: ${JSON.stringify(path)}`, () => {
    assert.ok(blocked(input({ approvedEntries: [{ path: feature, blob }, { path, blob }] })).errors.length);
  });
}
test('non-ancestor and truthy non-boolean ancestor claims cannot authorize', () => {
  for (const approvedCommitIsAncestor of [false, undefined, 'true', 1])
    assert.ok(blocked(input({ approvedCommitIsAncestor })).errors.includes('APPROVED_COMMIT_NOT_ANCESTOR'));
});
test('malformed or shortened approved blob invalidates all entries', () => {
  for (const invalid of ['a'.repeat(39), 'g'.repeat(40), '', null, 123])
    assert.ok(blocked(input({ approvedEntries: [{ path: feature, blob: invalid }] })).errors.length);
});
test('empty allowlist allows nothing', () => {
  assert.deepEqual(blocked(input({ approvedEntries: [] })).errors, []);
});
test('mixed allowed and blocked paths retain order and do not duplicate results', () => {
  const result = classifyIngredientScope(input({ changedPaths: [route, feature, route, feature] }));
  assert.deepEqual(result, { allowed: [feature], blocked: [route], errors: [] });
});
test('invalid changed or dirty path input fails closed rather than normalizing', () => {
  assert.ok(blocked(input({ changedPaths: [feature, '../escape'] }), [feature, '../escape']).errors.length);
  assert.ok(blocked(input({ dirtyPaths: ['apps\\mobile\\dirty.ts'] })).errors.length);
});
test('malformed manifest or blob map is denied without throwing', () => {
  for (const overrides of [{ approvedEntries: null }, { approvedEntries: [null] }, { currentBlobs: null },
    { currentBlobs: [] }, { dirtyPaths: null }]) assert.ok(blocked(input(overrides)).errors.length);
  assert.deepEqual(classifyIngredientScope(null).allowed, []);
});
test('function never mutates decision or caller state', () => {
  const value = input();
  Object.freeze(value.approvedEntries[0]); Object.freeze(value.approvedEntries);
  Object.freeze(value.changedPaths); Object.freeze(value.currentBlobs); Object.freeze(value.dirtyPaths); Object.freeze(value);
  assert.deepEqual(classifyIngredientScope(value).allowed, [feature]);
});
for (const path of ['apps/mobile/app/(tabs)/ingredients/add-stock/[id].tsx',
  'apps/mobile/app/(tabs)/ingredients/[...ingredient_id].tsx',
  'apps/mobile/src/features/ingredients/[item_1].tsx']) {
  test(`literal Expo route only matches its exact approved filename: ${path}`, () => {
    const approved = input({ changedPaths: [path], approvedEntries: [{ path, blob }], currentBlobs: { [path]: blob } });
    assert.deepEqual(classifyIngredientScope(approved), { allowed: [path], blocked: [], errors: [] });
    blocked({ ...approved, currentBlobs: { [path]: otherBlob } }, [path]);
    const expanded = path.replace(/\[[^\]]+\]/, 'actual-id');
    blocked({ ...approved, changedPaths: [expanded], currentBlobs: { [expanded]: blob } }, [expanded]);
  });
}
for (const path of ['apps/mobile/app/(tabs)/ingredients/[id]/index.tsx',
  'apps/mobile/app/(tabs)/ingredients/[a-z].tsx',
  'apps/mobile/app/(tabs)/ingredients/[!id].tsx',
  'apps/mobile/app/(tabs)/ingredients/[[id]].tsx',
  'apps/mobile/app/(tabs)/ingredients/[id].ts',
  'apps/mobile/app/(tabs)/ingredients/[].tsx',
  'apps/mobile/app/(tabs)/ingredients/[id]*.tsx',
  'apps/mobile/app/(tabs)/recipes/[id].tsx']) {
  test(`literal route exception never authorizes directory/glob/outside path: ${path}`, () => {
    assert.ok(blocked(input({ approvedEntries: [{ path: feature, blob }, { path, blob }] })).errors.length);
  });
}
