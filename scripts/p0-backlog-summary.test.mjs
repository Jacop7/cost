import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOpenBacklogs } from './p0-backlog-summary.mjs';

test('disjoint historical ledgers retain their existing counts', () => {
  assert.deepEqual(summarizeOpenBacklogs(['a', 'b'], ['c']), { p0Regression: 2, overlap: 0, combinedUniqueOpen: 3 });
});
test('38 inherited findings remain open but are counted only once', () => {
  const inherited = Array.from({ length: 38 }, (_, i) => `inherited-${i}`);
  const current = [...inherited, 'new-current'];
  const successor = [...inherited, 'old-successor'];
  const before = JSON.stringify({ current, successor });
  assert.deepEqual(summarizeOpenBacklogs(current, successor), { p0Regression: 39, overlap: 38, combinedUniqueOpen: 40 });
  assert.equal(JSON.stringify({ current, successor }), before);
});
test('duplicate messages in a source do not inflate the unique total', () => {
  assert.deepEqual(summarizeOpenBacklogs(['a', 'a'], ['a', 'a', 'b']), { p0Regression: 2, overlap: 1, combinedUniqueOpen: 2 });
});
test('new or different findings are never discarded', () => {
  assert.equal(summarizeOpenBacklogs(['first'], ['second']).combinedUniqueOpen, 2);
});
test('empty ledgers are valid', () => {
  assert.deepEqual(summarizeOpenBacklogs([], []), { p0Regression: 0, overlap: 0, combinedUniqueOpen: 0 });
});
test('malformed input fails rather than becoming an empty backlog', () => {
  for (const invalid of [null, {}, [null], [''], ['  ']]) assert.throws(() => summarizeOpenBacklogs(invalid, []), TypeError);
});
