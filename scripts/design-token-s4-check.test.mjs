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
const residualKnown = JSON.parse(readFileSync(join(root, contract.residualStage.contract), 'utf8'));
const residual = {
  before: loadBaselineSources(root, residualKnown.baselineCommit),
  after: loadBaselineSources(root, contract.residualStage.productCommit),
};
const current = () => loadSources(root);
const changed = (file, from, to) => {
  const sources = current();
  const text = sources.get(file);
  assert.ok(text?.includes(from), `${file} fixture에 ${from} 없음`);
  sources.set(file, text.replace(from, to));
  return sources;
};

test('저장소 S4 계약이 통과한다', () => assert.deepEqual(evaluateS4(current(), contract, baseline, residual), []));

test('누적 AST 변경은 S4·S3b·S3c·네이티브 소유 단계를 행별로 보존한다', () => {
  const counts = contract.allowedAstChanges.reduce((result, item) => {
    result[item.stage] = (result[item.stage] ?? 0) + 1;
    return result;
  }, {});
  assert.equal(counts.S4, contract.allowedAstChanges.length
    - contract.downstreamStage.geometryChangesIncludedHere
    - contract.residualStage.geometryChangesIncludedHere
    - contract.nativeStage.geometryChangesIncludedHere
    - (contract.nativeFollowupStage?.geometryChangesIncludedHere ?? 0));
  assert.equal(counts.S3b, contract.downstreamStage.geometryChangesIncludedHere);
  assert.equal(counts.S3c, contract.residualStage.geometryChangesIncludedHere);
  assert.equal(counts.S4a ?? 0, contract.nativeStage.geometryChangesIncludedHere);
  assert.equal(counts.S4b ?? 0, contract.nativeFollowupStage?.geometryChangesIncludedHere ?? 0);
  const broken = structuredClone(contract);
  broken.allowedAstChanges[0].stage = 'S3b';
  assert.match(evaluateS4(current(), broken, baseline, residual).join('\n'), /S3b 소유 AST 변경/);
});

test('S3c 누적 행을 다른 단계로 밀면 승인된 8개 배정과의 결속이 실패한다', () => {
  const broken = structuredClone(contract);
  broken.allowedAstChanges.find((item) => item.stage === 'S3c').stage = 'S4a';
  assert.match(evaluateS4(current(), broken, baseline, residual).join('\n'), /S3c 소유 AST 변경/);
});

test('S3c 배정 건수를 바꾸면 8개 known 계약과의 양방향 대조가 실패한다', () => {
  const broken = structuredClone(contract);
  broken.residualStage.assignments = 7;
  assert.match(evaluateS4(current(), broken, baseline, residual).join('\n'), /S3c 승인 배정 8 ≠ 7/);
});

test('S3c 누적 AST 값을 바꾸면 제품 커밋 계산값과의 대조가 실패한다', () => {
  const broken = structuredClone(contract);
  broken.allowedAstChanges.find((item) => item.stage === 'S3c').after = 'space.sm';
  assert.match(evaluateS4(current(), broken, baseline, residual).join('\n'), /S3c 승인 AST 변경 불일치/);
});

test('스크롤 역할 한 자리를 리터럴로 되돌리면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingBottom: LAYOUT.scroll.end', 'paddingBottom: 30');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /scrollEnd 43 ≠ 44/);
});

test('Button sm 최소 높이를 줄이면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Button.tsx', 'minHeight: 44', 'minHeight: 43');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /Button 크기·hitSlop/);
});

test('탭 라벨을 한 줄로 닫으면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', 'numberOfLines={2}', 'numberOfLines={1}');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /탭바 계약 누락/);
});

test('탭 글꼴 배율 변경 시 높이 재측정을 빼면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', '[bottomPad, fontScale]', '[bottomPad]');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /탭바 계약 누락/);
});

test('Modal Sheet에서 safe-area를 빼면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Sheet.tsx', 'LAYOUT.scroll.end + insets.bottom', 'LAYOUT.scroll.end');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /Modal Sheet safe-area/);
});

test('카테고리 28×20 버튼이 돌아오면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'width: 44, height: 44', 'width: 28, height: 20');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /옛 28×20/);
});

test('카테고리 방향 Sheet를 없애면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'visible={reordering !== null}', 'visible={false}');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /kit Sheet 순서 선택/);
});

test('알려진 터치 미달을 다시 넣으면 실패한다', () => {
  const sources = current();
  const file = 'scripts/touch-target-known.json';
  const known = JSON.parse(sources.get(file));
  known.entries.push({ at: 'fake:1' });
  sources.set(file, JSON.stringify(known));
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /터치 미달 1건/);
});

test('허용 목록 밖 기하 변경은 건수 상쇄와 무관하게 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingHorizontal: 16', 'paddingHorizontal: 17');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /허용 AST diff 불일치/);
});

test('글자 확대에서 터치 영역을 지키는 flexShrink 변경도 기하 계약이 잡는다', () => {
  const sources = changed('apps/mobile/src/components/kit/index.tsx', 'flexShrink: 1, fontSize: 16', 'flexShrink: 0, fontSize: 16');
  assert.match(evaluateS4(sources, contract, baseline, residual).join('\n'), /허용 AST diff 불일치/);
});
