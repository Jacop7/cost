import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentS4Contract, evaluateS4, loadSources } from './design-token-s4-check.mjs';

const original = loadSources();
const evaluate = (sources = original) => evaluateS4(sources, currentS4Contract, null, null, { historical: false });
const changed = (file, before, after) => {
  const sources = new Map(original);
  assert.ok(sources.get(file)?.includes(before), `missing fixture: ${file}: ${before}`);
  sources.set(file, sources.get(file).replace(before, after));
  return sources;
};
const button = 'apps/mobile/src/components/kit/Button.tsx';
const sheet = 'apps/mobile/src/components/kit/Sheet.tsx';
const tabs = 'apps/mobile/app/(tabs)/_layout.tsx';
const category = 'apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx';

test('current quality passes without historical Git blobs, AST counts or successor receipts', () => {
  assert.deepEqual(evaluate(), []);
});
test('comments and moving non-contract declarations do not freeze the screen', () => {
  const sources = new Map(original);
  for (const [file, text] of sources) if (file.endsWith('.tsx')) sources.set(file, '// moved line\n' + text);
  sources.set('apps/mobile/src/features/example/NewLayout.tsx', 'const style = { paddingTop: LAYOUT.scroll.start };');
  assert.deepEqual(evaluate(sources), []);
});
test('historical evaluation still rejects a missing baseline', () => {
  const sources = new Map(original);
  // Historical evaluation continues to fail closed; current mode is explicit.
  const failures = evaluateS4(sources, { ...currentS4Contract, priorStage: {} }, null, null);
  assert.ok(failures.includes('S4 baseline AST 입력이 없다'));
});

for (const [name, file, before, after, expected] of [
  ['minimum touch token reduced', 'apps/mobile/src/theme/tokens.ts', 'export const minTouchTarget = 44;', 'export const minTouchTarget = 20;', /현재 최소 터치 크기/],
  ['history bottom padding lost', 'apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingBottom: LAYOUT.scroll.end', 'paddingBottom: 0', /historyContent 현재 스크롤/],
  ['small button 43dp', button, 'minHeight: 44', 'minHeight: 43', /Button 현재 터치/],
  ['status hitSlop lost', button, 'top: status ? (minTouchTarget - status.visualHeight) / 2 : s.hs', 'top: 0', /Button 현재 터치/],
  ['status parent clipping', button, 'minHeight: minTouchTarget, minWidth: minTouchTarget', 'minHeight: 20, minWidth: 20', /Button 현재 터치/],
  ['one-line tab', tabs, 'numberOfLines={2}', 'numberOfLines={1}', /탭바 계약/],
  ['font-scale remeasure lost', tabs, '[bottomPad, fontScale]', '[bottomPad]', /탭바 계약/],
  ['sheet scroll inset lost', sheet, 'LAYOUT.scroll.end + insets.bottom', 'LAYOUT.scroll.end', /Sheet 현재 safe-area/],
  ['sheet footer inset lost', sheet, 'space.lg + insets.bottom', 'space.lg', /Sheet 현재 safe-area/],
  ['sheet non-scroll inset lost', sheet, 'paddingBottom: insets.bottom', 'paddingBottom: 0', /Sheet 현재 safe-area/],
  ['tiny category action', category, 'width: 44, height: 44', 'width: 28, height: 20', /옛 28×20/],
  ['category directions disabled', category, 'visible={reordering !== null}', 'visible={false}', /kit Sheet 순서 선택/],
  ['header minimum width lost', 'apps/mobile/src/components/kit/index.tsx', '<View style={{ flex: 1, minWidth: 0 }}>', '<View style={{ flex: 1 }}>', /HubHeader 현재 공용/],
]) test(name + ' still fails', () => assert.match(evaluate(changed(file, before, after)).join('\n'), expected));

for (const field of ['entries', 'siblingOverlaps']) test(`actual touch ${field} still fails`, () => {
  const sources = new Map(original);
  const file = 'scripts/touch-target-known.json';
  const known = JSON.parse(sources.get(file));
  known[field].push({ at: 'regression' });
  sources.set(file, JSON.stringify(known));
  assert.match(evaluate(sources).join('\n'), /터치 미달|형제 중첩/);
});
test('improving an old unresolved Button state is allowed, not a historical regression', () => {
  const sources = new Map(original);
  const file = 'scripts/touch-target-known.json';
  const known = JSON.parse(sources.get(file));
  for (const item of known.components) item.판정 = '통과';
  sources.set(file, JSON.stringify(known));
  assert.deepEqual(evaluate(sources), []);
});
