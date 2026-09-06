#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateS4, loadBaselineSources, loadSources } from './design-token-s4-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const contract = JSON.parse(readFileSync(join(root, 'scripts/design-token-s4-contract.json'), 'utf8'));
const baseline = loadBaselineSources(root, contract.baselineCommit);
const current = () => loadSources(root);
const changed = (file, from, to) => {
  const sources = current();
  const text = sources.get(file);
  assert.ok(text?.includes(from), `${file} fixture에 ${from} 없음`);
  sources.set(file, text.replace(from, to));
  return sources;
};

test('저장소 S4 계약이 통과한다', () => assert.deepEqual(evaluateS4(current(), contract, baseline), []));

test('스크롤 역할 한 자리를 리터럴로 되돌리면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingBottom: LAYOUT.scroll.end', 'paddingBottom: 30');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /scrollEnd 43 ≠ 44/);
});

test('Button sm hitSlop을 줄이면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Button.tsx', 'r: 9, hs: 7', 'r: 9, hs: 6');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /Button 시각 보존 hitSlop/);
});

test('탭 라벨을 한 줄로 닫으면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', 'numberOfLines={2}', 'numberOfLines={1}');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /탭바 계약 누락/);
});

test('탭 글꼴 배율 변경 시 높이 재측정을 빼면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', '[bottomPad, fontScale]', '[bottomPad]');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /탭바 계약 누락/);
});

test('Modal Sheet에서 safe-area를 빼면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Sheet.tsx', 'LAYOUT.scroll.end + insets.bottom', 'LAYOUT.scroll.end');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /Modal Sheet safe-area/);
});

test('카테고리 28×20 버튼이 돌아오면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'width: 44, height: 44', 'width: 28, height: 20');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /옛 28×20/);
});

test('카테고리 방향 Sheet를 없애면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'visible={reordering !== null}', 'visible={false}');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /kit Sheet 순서 선택/);
});

test('알려진 터치 미달을 다시 넣으면 실패한다', () => {
  const sources = current();
  const file = 'scripts/touch-target-known.json';
  const known = JSON.parse(sources.get(file));
  known.entries.push({ at: 'fake:1' });
  sources.set(file, JSON.stringify(known));
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /터치 미달 1건/);
});

test('허용 목록 밖 기하 변경은 건수 상쇄와 무관하게 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingHorizontal: 16', 'paddingHorizontal: 17');
  assert.match(evaluateS4(sources, contract, baseline).join('\n'), /허용 AST diff 불일치/);
});
