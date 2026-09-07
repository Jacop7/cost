#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  carryAstChangeStage,
  evaluateS4,
  evaluateS4Successor,
  loadBaselineSources,
  loadSources,
  validatePredecessorProvenance,
} from './design-token-s4-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const contract = JSON.parse(readFileSync(join(root, 'scripts/design-token-s4-contract.json'), 'utf8'));
const baseline = loadBaselineSources(root, contract.baselineCommit);
const residualKnown = JSON.parse(readFileSync(join(root, contract.residualStage.contract), 'utf8'));
const residual = {
  before: loadBaselineSources(root, residualKnown.baselineCommit),
  after: loadBaselineSources(root, contract.residualStage.productCommit),
};
const successor = JSON.parse(readFileSync(join(root, 'scripts/design-token-s4-successor.json'), 'utf8'));
const readBlobJson = (oid) => {
  const result = spawnSync('git', ['cat-file', 'blob', oid], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Git blob fixture를 읽지 못했다: ${oid}`);
  return JSON.parse(result.stdout);
};
const previousP0 = readBlobJson(successor.previousP0BaselineBlob);
const sourceP0 = readBlobJson(successor.sourceP0BaselineBlob);
const current = () => loadSources(root);
const evaluateCurrent = (
  sources = current(),
  activeContract = contract,
  activeSuccessor = successor,
  previous = previousP0,
  source = sourceP0,
) => {
  const raw = evaluateS4(sources, activeContract, baseline, residual);
  const overlay = evaluateS4Successor(raw, activeSuccessor, previous, source, sources);
  return overlay.length ? [...raw, ...overlay] : [];
};
const changed = (file, from, to) => {
  const sources = current();
  const text = sources.get(file);
  assert.ok(text?.includes(from), `${file} fixture에 ${from} 없음`);
  sources.set(file, text.replace(from, to));
  return sources;
};

test('저장소 S4 successor 계약이 raw 실패 54건을 전수 분류하고 통과한다', () => {
  assert.deepEqual(evaluateCurrent(), []);
});

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
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3b 소유 AST 변경/);
});

test('AST 계약 갱신은 같은 선언의 occurrence 이동에도 기존 소유 단계를 보존한다', () => {
  const previous = [{
    file: 'Button.tsx', declaration: 'prop:minHeight#1', before: '40', after: '44', stage: 'S4b',
  }];
  assert.equal(carryAstChangeStage({
    file: 'Button.tsx', declaration: 'prop:minHeight#2', before: '40', after: '44',
  }, previous), 'S4b');
  assert.equal(carryAstChangeStage({
    file: 'Button.tsx', declaration: 'prop:minHeight#2', before: '40', after: '48',
  }, previous), 'S4a');
});

test('S3c 누적 행을 다른 단계로 밀면 승인된 8개 배정과의 결속이 실패한다', () => {
  const broken = structuredClone(contract);
  broken.allowedAstChanges.find((item) => item.stage === 'S3c').stage = 'S4a';
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3c 소유 AST 변경/);
});

test('S3c 배정 건수를 바꾸면 8개 known 계약과의 양방향 대조가 실패한다', () => {
  const broken = structuredClone(contract);
  broken.residualStage.assignments = 7;
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3c 승인 배정 8 ≠ 7/);
});

test('S3c 누적 AST 값을 바꾸면 제품 커밋 계산값과의 대조가 실패한다', () => {
  const broken = structuredClone(contract);
  broken.allowedAstChanges.find((item) => item.stage === 'S3c').after = 'space.sm';
  assert.match(evaluateCurrent(current(), broken).join('\n'), /S3c 승인 AST 변경 불일치/);
});

test('스크롤 역할 한 자리를 리터럴로 되돌리면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingBottom: LAYOUT.scroll.end', 'paddingBottom: 30');
  assert.match(evaluateCurrent(sources).join('\n'), /scrollEnd 40 ≠ 44/);
});

test('Button sm 최소 높이를 줄이면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Button.tsx', 'minHeight: 44', 'minHeight: 43');
  assert.match(evaluateCurrent(sources).join('\n'), /Button 크기·hitSlop/);
});

test('탭 라벨을 한 줄로 닫으면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', 'numberOfLines={2}', 'numberOfLines={1}');
  assert.match(evaluateCurrent(sources).join('\n'), /탭바 계약 누락/);
});

test('탭 글꼴 배율 변경 시 높이 재측정을 빼면 실패한다', () => {
  const sources = changed('apps/mobile/app/(tabs)/_layout.tsx', '[bottomPad, fontScale]', '[bottomPad]');
  assert.match(evaluateCurrent(sources).join('\n'), /탭바 계약 누락/);
});

test('Modal Sheet에서 safe-area를 빼면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/Sheet.tsx', 'LAYOUT.scroll.end + insets.bottom', 'LAYOUT.scroll.end');
  assert.match(evaluateCurrent(sources).join('\n'), /Modal Sheet safe-area/);
});

test('카테고리 28×20 버튼이 돌아오면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'width: 44, height: 44', 'width: 28, height: 20');
  assert.match(evaluateCurrent(sources).join('\n'), /옛 28×20/);
});

test('카테고리 방향 Sheet를 없애면 실패한다', () => {
  const sources = changed('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx', 'visible={reordering !== null}', 'visible={false}');
  assert.match(evaluateCurrent(sources).join('\n'), /kit Sheet 순서 선택/);
});

test('알려진 터치 미달을 다시 넣으면 실패한다', () => {
  const sources = current();
  const file = 'scripts/touch-target-known.json';
  const known = JSON.parse(sources.get(file));
  known.entries.push({ at: 'fake:1' });
  sources.set(file, JSON.stringify(known));
  assert.match(evaluateCurrent(sources).join('\n'), /터치 미달 1건/);
});

test('허용 목록 밖 기하 변경은 건수 상쇄와 무관하게 실패한다', () => {
  const sources = changed('apps/mobile/src/components/history/HistoryLayout.tsx', 'paddingHorizontal: 16', 'paddingHorizontal: 17');
  assert.match(evaluateCurrent(sources).join('\n'), /허용 AST diff 불일치/);
});

test('글자 확대에서 제목이 액션 영역을 침범하지 않게 하는 minWidth 계약을 잡는다', () => {
  const sources = changed('apps/mobile/src/components/kit/index.tsx', '<View style={{ flex: 1, minWidth: 0 }}>', '<View style={{ flex: 1, minWidth: 1 }}>');
  assert.match(evaluateCurrent(sources).join('\n'), /P2-HUB-HEADER owner 계약 누락/);
});

test('raw 실패가 한 건 추가되면 봉인 source와의 양방향 대조가 실패한다', () => {
  const raw = evaluateS4(current(), contract, baseline, residual);
  const failures = evaluateS4Successor([...raw, '가짜 신규 실패'], successor, previousP0, sourceP0, current());
  assert.match(failures.join('\n'), /현재 raw 실패가 봉인 source와 다르다/);
});

test('P0 migration의 S4 차집합이 바뀌면 실패한다', () => {
  const broken = structuredClone(sourceP0);
  broken.classificationMigration.failureLineDelta
    .find((entry) => entry.gateId === successor.rawGateId).added.pop();
  assert.match(evaluateCurrent(current(), contract, successor, previousP0, broken).join('\n'), /P0 migration 차집합/);
});

test('raw 실패 분류 한 건을 빼면 전수 분류 대조가 실패한다', () => {
  const broken = structuredClone(successor);
  broken.classifications.pop();
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /raw 실패 전수 분류/);
});

test('successor 자체 sealed raw 목록을 바꾸면 source와의 exact 대조가 실패한다', () => {
  const broken = structuredClone(successor);
  broken.sealedRawFailures.pop();
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /sealed raw 실패/);
});

test('상속된 MyHome 실패를 component transfer로 바꾸면 실패한다', () => {
  const broken = structuredClone(successor);
  const item = broken.classifications.find((entry) => entry.message.includes('MyHomeScreen.tsx'));
  item.kind = 'component-transfer';
  item.transferId = 'P2-HUB-HEADER';
  delete item.ownerStage;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /상속 실패를 component transfer/);
});

test('changeDelta를 raw 차집합과 다르게 쓰면 실패한다', () => {
  const broken = structuredClone(successor);
  broken.changeDelta.added.pop();
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /changeDelta/);
});

test('공용 컴포넌트 소유 계약 needle을 제품에서 빼면 실패한다', () => {
  const sources = changed('apps/mobile/src/components/kit/index.tsx', 'export function HubHeader(', 'export function LegacyHubHeader(');
  assert.match(evaluateCurrent(sources).join('\n'), /P2-HUB-HEADER owner 계약 누락/);
});

test('owner 파일 다른 위치에 같은 토큰이 있어도 HubHeader 구현 범위에서 빠지면 실패한다', () => {
  const sources = current();
  const file = 'apps/mobile/src/components/kit/index.tsx';
  const text = sources.get(file);
  const start = text.indexOf('export function HubHeader(');
  const end = text.indexOf('export function Select(', start);
  const scope = text.slice(start, end);
  assert.ok(scope.includes('borderRadius: radius.full'));
  sources.set(file, text.slice(0, start) + scope.replace('borderRadius: radius.full', 'borderRadius: radius.lg') + text.slice(end));
  assert.match(evaluateCurrent(sources).join('\n'), /P2-HUB-HEADER owner 계약 누락: borderRadius/);
});

test('component transfer 분류 건수를 손으로 바꾸면 실패한다', () => {
  const broken = structuredClone(successor);
  broken.componentOwnershipTransfers[0].failureCount += 1;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /P2-HUB-HEADER 분류 6 ≠ 7/);
});

test('분류 통계만 손으로 바꾸면 exact 총계 대조가 실패한다', () => {
  const broken = structuredClone(successor);
  broken.counts.p3Backlog += 1;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /P3 backlog 총계 48 ≠ 49/);
});

test('P3 owner 분포를 바꾸면 exact 소유 대조가 실패한다', () => {
  const broken = structuredClone(successor);
  broken.counts.p3Owners['P3-MY'] += 1;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /P3 owner 분포/);
});

test('후속 successor predecessor blob은 Git blob OID 형식이어야 한다', () => {
  const broken = structuredClone(successor);
  broken.lineage.predecessorSuccessorBlob = 'not-a-blob';
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /predecessor blob\/commit/);
});

const followupSuccessor = ({ added = [], removed = [] }) => {
  const next = structuredClone(successor);
  next.lineage.predecessorSuccessorBlob = 'a'.repeat(40);
  next.lineage.predecessorSuccessorCommit = 'b'.repeat(40);
  next.counts.inherited = successor.sealedRawFailures.length;
  for (const message of removed) {
    const item = next.classifications.find((entry) => entry.message === message);
    next.sealedRawFailures = next.sealedRawFailures.filter((entry) => entry !== message);
    next.classifications = next.classifications.filter((entry) => entry.message !== message);
    next.counts.current -= 1;
    next.counts[item.kind === 'p3-backlog' ? 'p3Backlog' : 'componentTransfer'] -= 1;
    if (item.ownerStage) next.counts.p3Owners[item.ownerStage] -= 1;
  }
  for (const item of added) {
    next.sealedRawFailures.push(item.message);
    next.classifications.push(item);
    next.counts.current += 1;
    next.counts.p3Backlog += 1;
    next.counts.p3Owners[item.ownerStage] = (next.counts.p3Owners[item.ownerStage] ?? 0) + 1;
  }
  next.delta = {
    removed: removed.map((message) => ({ message, rationale: 'P3에서 해소' })),
    added: added.map(({ message }) => ({ message, rationale: 'P3에서 새로 관측' })),
  };
  next.changeDelta = {
    from: 'predecessorSuccessorBlob',
    to: 'sealedRawFailures',
    fromRaw: successor.sealedRawFailures,
    removed,
    added: added.map(({ message }) => message),
  };
  return next;
};

test('후속 successor는 predecessor sealed raw에서 실패가 줄어드는 판본을 표현한다', () => {
  const removed = successor.classifications.findLast((item) => item.kind === 'p3-backlog').message;
  const next = followupSuccessor({ removed: [removed] });
  assert.deepEqual(evaluateS4Successor(next.sealedRawFailures, next, previousP0, sourceP0, current(), successor), []);
});

test('후속 successor는 predecessor sealed raw에 새 실패가 생기는 판본도 숨기지 않는다', () => {
  const added = [{ message: 'P3 가짜 신규 실패', kind: 'p3-backlog', ownerStage: 'P3-COMMON', rationale: '음성 시험' }];
  const next = followupSuccessor({ added });
  assert.deepEqual(evaluateS4Successor(next.sealedRawFailures, next, previousP0, sourceP0, current(), successor), []);
});

test('후속 successor의 fromRaw가 predecessor와 다르면 실패한다', () => {
  const next = followupSuccessor({ added: [] });
  next.changeDelta.fromRaw = [];
  assert.match(evaluateS4Successor(next.sealedRawFailures, next, previousP0, sourceP0, current(), successor).join('\n'), /fromRaw/);
});

test('후속 successor에서 기존 P3 backlog를 component transfer로 세탁하면 실패한다', () => {
  const next = followupSuccessor({ added: [] });
  const item = next.classifications.find((entry) => entry.kind === 'p3-backlog');
  item.kind = 'component-transfer';
  item.transferId = 'P2-HUB-HEADER';
  delete item.ownerStage;
  assert.match(evaluateS4Successor(next.sealedRawFailures, next, previousP0, sourceP0, current(), successor).join('\n'), /상속 실패를 component transfer/);
});

test('Git 이력에서 도달 불가능한 predecessor blob은 provenance 검사를 통과하지 못한다', () => {
  const tempRoot = join(root, '.tmp');
  mkdirSync(tempRoot, { recursive: true });
  const repo = mkdtempSync(join(tempRoot, 's4-predecessor-'));
  try {
    spawnSync('git', ['init'], { cwd: repo });
    mkdirSync(join(repo, 'scripts'), { recursive: true });
    writeFileSync(join(repo, 'scripts/design-token-s4-successor.json'), JSON.stringify(successor));
    spawnSync('git', ['add', '--all'], { cwd: repo });
    spawnSync('git', ['-c', 'user.name=S4 Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'predecessor'], { cwd: repo });
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
    const orphan = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, encoding: 'utf8', input: '{"orphan":true}\n' }).stdout.trim();
    const next = structuredClone(successor);
    next.lineage.predecessorSuccessorBlob = orphan;
    next.lineage.predecessorSuccessorCommit = commit;
    assert.match(validatePredecessorProvenance(repo, next).join('\n'), /지정 커밋의 계약 파일/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('P0 baseline blob 계보를 끊으면 실패한다', () => {
  const broken = structuredClone(sourceP0);
  broken.classificationMigration.previousBaselineBlob = successor.sourceP0BaselineBlob;
  assert.match(evaluateCurrent(current(), contract, successor, previousP0, broken).join('\n'), /이전 baseline blob 계보/);
});

test('P0 결정 커밋 계보를 바꾸면 실패한다', () => {
  const broken = structuredClone(successor);
  broken.p0DecisionCommit = broken.reviewedTargetCommit;
  assert.match(evaluateCurrent(current(), contract, broken).join('\n'), /결정 커밋 계보/);
});
