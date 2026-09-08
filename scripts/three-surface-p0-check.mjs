#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PRODUCT_GENERATED_EXCLUSIONS, dirtyProductScope, productScopeChangedPaths } from './native-product-evidence-scope.mjs';
import { PERMANENT_DIVERGENT_SCREEN_IDS } from './three-surface-migration-contract.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
const root = resolve(option('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const baselinePath = resolve(root, option('--baseline') ?? 'docs/prototypes/three-surface-baseline.json');
const baselineRel = relative(root, baselinePath).replaceAll('\\', '/');
const successorRel = 'scripts/design-token-s4-successor.json';
const successorPath = resolve(root, successorRel);
const norm = (text) => text.replaceAll('\r\n', '\n');
const sha = (text) => createHash('sha256').update(norm(text)).digest('hex');
const git = (input) => spawnSync('git', input, { cwd: root, encoding: 'utf8', maxBuffer: 100_000_000 });
const gitText = (input) => {
  const result = git(input);
  if (result.status !== 0) throw new Error(`git ${input.join(' ')} 실패: ${result.stderr}`);
  return norm(result.stdout).trim();
};
const stableGateOutput = (text) => norm(text).split('\n')
  .filter((line) => !/^\s*측정 — 커밋 [0-9a-f]+ · 작업 트리 /.test(line))
  .join('\n').trimEnd();
const protectedToken = (name, head) => {
  const value = option(name);
  if (value == null) return null;
  if (!/^[A-Z0-9][A-Z0-9-]*@[0-9a-f]{40}$/.test(value) || !value.endsWith(`@${head}`))
    throw new Error(`${name}는 <사유ID>@<현재 40자 SHA> 형식이어야 한다.`);
  return value;
};
const baselineAt = (commit) => {
  const shown = git(['show', `${commit}:${baselineRel}`]);
  if (shown.status !== 0) return null;
  try { return JSON.parse(shown.stdout); } catch { return null; }
};
const baselineHistory = () => {
  const result = git(['log', '--format=%H', '--', baselineRel]);
  if (result.status !== 0) return [];
  return norm(result.stdout).trim().split('\n').filter((commit) => /^[0-9a-f]{40}$/.test(commit))
    .map((commit) => ({ commit, baseline: baselineAt(commit) })).filter((item) => item.baseline);
};
const classificationOf = (baseline) => (baseline.gates ?? []).flatMap((gate) => [
  { id: gate.id, disposition: gate.disposition },
  ...(gate.failures ?? []).map(({ id, disposition }) => ({ id, disposition })),
]);
const subtractLines = (source, target) => {
  const remaining = new Map();
  for (const line of target) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  return source.filter((line) => {
    const count = remaining.get(line) ?? 0;
    if (count === 0) return true;
    remaining.set(line, count - 1);
    return false;
  });
};
const failureLineDelta = (previous, current) => {
  const previousByGate = new Map((previous.gates ?? []).map((gate) => [gate.id, gate.failureLines ?? []]));
  const currentByGate = new Map((current.gates ?? []).map((gate) => [gate.id, gate.failureLines ?? []]));
  const ids = [...new Set([...previousByGate.keys(), ...currentByGate.keys()])].sort();
  return ids.map((gateId) => {
    const before = previousByGate.get(gateId) ?? [];
    const after = currentByGate.get(gateId) ?? [];
    return { gateId, removed: subtractLines(before, after), added: subtractLines(after, before) };
  }).filter(({ removed, added }) => removed.length || added.length);
};
const historicalChange = (expected, kind) => {
  const current = kind === 'classification' ? classificationOf(expected) : expected.floors ?? {};
  return baselineHistory().find(({ baseline }) => JSON.stringify(kind === 'classification' ? classificationOf(baseline) : baseline.floors ?? {}) !== JSON.stringify(current)) ?? null;
};
const validateMigration = ({ migration, kind, previous, current, fail }) => {
  if (!migration) { fail(`${kind} 이력 변경에 migration이 없다`); return; }
  const token = migration.token ?? '';
  const decisionCommit = migration.decisionCommit ?? token.split('@')[1] ?? '';
  if (!/^[A-Z0-9][A-Z0-9-]*@[0-9a-f]{40}$/.test(token) || token !== `${migration.decision}@${decisionCommit}`)
    fail(`${kind} migration token이 decision commit에 결속되지 않았다`);
  if (git(['cat-file', '-e', `${decisionCommit}^{commit}`]).status !== 0 || git(['merge-base', '--is-ancestor', decisionCommit, 'HEAD']).status !== 0)
    fail(`${kind} migration decision commit이 현재 이력의 커밋이 아니다`);
  const writeInput = baselineAt(decisionCommit);
  const inputValue = kind === 'classification' ? writeInput?.classificationSummary?.regression : writeInput?.floors;
  const currentValue = kind === 'classification' ? current.classificationSummary?.regression : current.floors;
  if (writeInput == null || JSON.stringify(inputValue) === JSON.stringify(currentValue))
    fail(`${kind} migration token의 write 입력과 현재 baseline 값이 다르지 않다`);
  if (kind === 'classification') {
    if (migration.previousRegression !== previous.classificationSummary?.regression || migration.nextRegression !== current.classificationSummary?.regression)
      fail('classification migration 전후 수치가 Git 이력과 다르다');
    const blob = git(['rev-parse', `${decisionCommit}:${baselineRel}`]);
    const previousBlob = norm(blob.stdout ?? '').trim();
    if (blob.status !== 0 || migration.previousBaselineBlob !== previousBlob)
      fail('classification migration 이전 baseline blob 결속이 다르다');
    if (JSON.stringify(migration.failureLineDelta) !== JSON.stringify(failureLineDelta(writeInput, current)))
      fail('classification migration 실패선 차집합이 Git 이력과 다르다');
  } else if (JSON.stringify(migration.previousFloors) !== JSON.stringify(previous.floors) || JSON.stringify(migration.nextFloors) !== JSON.stringify(current.floors)) {
    fail('inventory migration 전후 floor가 Git 이력과 다르다');
  }
};
const previousBaseline = () => {
  if (existsSync(baselinePath)) return JSON.parse(readFileSync(baselinePath, 'utf8'));
  const found = git(['log', '-1', '--format=%H', 'HEAD^', '--', baselineRel]);
  const commit = norm(found.stdout ?? '').trim();
  if (found.status !== 0 || !/^[0-9a-f]{40}$/.test(commit)) return null;
  const shown = git(['show', `${commit}:${baselineRel}`]);
  if (shown.status !== 0) throw new Error('직전 baseline 이력을 읽지 못했다.');
  return JSON.parse(shown.stdout);
};
const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', maxBuffer: 100_000_000 });
  const raw = norm(`${result.stdout ?? ''}${result.stderr ?? ''}`).trimEnd();
  const stable = stableGateOutput(raw);
  return { exitCode: result.status, outputSha256: sha(stable), lineCount: stable ? stable.split('\n').length : 0,
    failureLines: raw.split('\n').filter((line) => /^\s+- /.test(line)).map((line) => line.trim().slice(2)) };
};
const walk = (base) => {
  const out = [];
  const visit = (dir) => { if (!existsSync(dir)) return; for (const name of readdirSync(dir)) {
    const path = join(dir, name); const stat = statSync(path);
    if (stat.isDirectory()) visit(path); else out.push(relative(root, path).replaceAll('\\', '/'));
  }};
  visit(resolve(root, base)); return out.sort();
};

const productRoots = ['apps/mobile/app', 'apps/mobile/src', 'apps/mobile/app.json', 'apps/mobile/assets', 'packages/core'];
const allowedP0Changes = ['docs/**', 'scripts/**'];
const productGeneratedExclusions = PRODUCT_GENERATED_EXCLUSIONS;
const activeThresholds = {
  status: 'active',
  activationStage: 'P2',
  migrationBacklogMax: 0,
  emergencyDivergenceMax: 0,
  migrationDeadlineUtc: '2026-09-30T23:59:59Z',
  reason: 'P1 레지스트리의 temporaryDivergence가 0건인 상태에서 P2를 시작하므로 새 예외를 기본 허용하지 않는다.',
};
const anchors = {
  productBaseline: { commit: '3448884d7219227dce369af45cb2be290ed12f3a', tree: 'a1e0a5d0e6f2112d3ba61419fa3eb83f4577fd24' },
  designTokenCompletion: { commit: '411902bddab6ba74b76656af0ba9aaa204a23884', tree: '2b4054749dbfdcf835426a0770ec117def006181' },
  integrationCheckpoint: { commit: '7e9d3084f1c76debe08d203b7db970e8af4568bc', tree: 'e35a29bafc4dfcedb358b973f116aa9599270149' },
  semanticColorCheckpoint: { commit: '1afad14351a402f81039e5e6d86561d36ce22645', tree: 'da4e8aa93b1764f5255645b0cd5466d32a45c56c' },
};
const inventory = () => {
  const readme = readFileSync(resolve(root, 'apps/mobile/src/features/README.md'), 'utf8');
  const screenIds = [...new Set(readme.match(/\b(?:ING|RCP|ORD|SALES|MY)-\d+\b/g) ?? [])].sort();
  const appFiles = walk('apps/mobile/app').filter((file) => /\.(?:ts|tsx)$/.test(file));
  const routes = appFiles.filter((file) => !file.endsWith('/_layout.tsx') && !file.endsWith('/index.ts'));
  const render = JSON.parse(readFileSync(resolve(root, 'docs/prototypes/full-page-flow-prototype-render-audit.json'), 'utf8'));
  return { screenIds: screenIds.length, appTsxFiles: appFiles.length, routeFiles: routes.length,
    prototypeTargetsMeasured: render.summary?.targetsMeasured ?? render.manifest?.targetsMeasured ?? 0,
    prototypeActiveTargets: render.summary?.activeTargets ?? 0 };
};
const successorBacklog = (p0FailureMessages) => {
  const text = readFileSync(successorPath, 'utf8');
  const successor = JSON.parse(text);
  const p3Backlog = successor.classifications?.filter((item) => item.kind === 'p3-backlog').length ?? 0;
  const componentTransfer = successor.classifications?.filter((item) => item.kind === 'component-transfer').length ?? 0;
  if (successor.schemaVersion !== 2 || successor.counts?.p3Backlog !== p3Backlog
    || successor.counts?.componentTransfer !== componentTransfer)
    throw new Error('S4 successor backlog 계약이 자체 분류와 다르다.');
  const successorOpen = successor.classifications.filter((item) => item.kind === 'p3-backlog').map((item) => item.message);
  const overlap = successorOpen.filter((message) => p0FailureMessages.includes(message));
  if (overlap.length) throw new Error(`P0 regression과 successor backlog가 ${overlap.length}건 중복된다.`);
  const combined = new Set([...p0FailureMessages, ...successorOpen]).size;
  return {
    contract: successorRel,
    textSha256: sha(text),
    rawFailures: successor.sealedRawFailures?.length ?? 0,
    componentTransfer,
    p3Backlog,
    p0Regression: p0FailureMessages.length,
    overlap: 0,
    combinedUniqueOpen: combined,
    rationale: 'P0 재기준선 이후 S4 gate가 PASS하므로 successor의 P3 backlog는 P0 regression과 중복되지 않는 별도 open 집합이다.',
  };
};
const gateDefs = [
  { id: 'S3A-EXACT', command: ['node', ['scripts/design-token-s3a-diff.mjs']], disposition: 'regression', successorContract: 'P0 backlog + P2/P3 token-adoption and visual-diff gates' },
  { id: 'S4-EXACT', command: ['node', ['scripts/design-token-s4-check.mjs', '--structural-only']], disposition: 'regression', successorContract: 'P0 backlog + P2/P3 component and visual-diff gates; review receipt is the full verify path, not the numeric backlog measurement' },
  { id: 'TOUCH-EXACT', command: ['node', ['scripts/touch-target-audit.mjs']], disposition: 'regression', successorContract: 'P0 backlog + P2/P3 refreshed touch inventory; minimum 44 contract remains preserved' },
  { id: 'CONTRAST', command: ['node', ['scripts/design-token-contrast.mjs']], disposition: 'preserve', successorContract: 'Existing contrast gate remains mandatory' },
];
const classifyFailure = (gateId) => gateId === 'CONTRAST' ? 'preserve' : 'regression';
const measuredScripts = () => [...new Set([
  ...gateDefs.map((item) => item.command[1][0]),
  'scripts/three-surface-p0-check.mjs',
  'scripts/three-surface-byte-artifacts-check.mjs',
  'scripts/three-surface-advisory-ledger-check.mjs',
  'scripts/native-product-evidence-scope.mjs',
])].sort().map((path) => ({ path, textSha256: sha(readFileSync(resolve(root, path), 'utf8')) }));

function measure() {
  const head = gitText(['rev-parse', 'HEAD']); const tree = gitText(['rev-parse', 'HEAD^{tree}']);
  const measuredInventory = inventory();
  const gates = gateDefs.map((definition) => {
    const measurement = run(...definition.command);
    const disposition = definition.disposition;
    return { id: definition.id, command: [definition.command[0], ...definition.command[1]].join(' '), ...measurement,
      outputNormalization: 'lf-trim-final-and-remove-touch-volatile-provenance-v1', disposition,
      rationale: disposition === 'preserve'
        ? '현재 제품에서도 의미와 입력 범위가 유효하며 그대로 통과한다.'
        : '값·개수·미판정 표면 변화는 주소 이동으로 입증되지 않았으므로 보수적으로 regression backlog에 남긴다.',
      successorContract: definition.successorContract,
      failures: measurement.failureLines.map((message, index) => ({ id: `${definition.id}-${String(index + 1).padStart(4, '0')}`, disposition: classifyFailure(definition.id), message })),
    };
  });
  const scripts = measuredScripts();
  const allFailures = gates.flatMap((gate) => gate.failures);
  const regressionBacklog = allFailures.filter((item) => item.disposition === 'regression')
    .map((item) => ({ id: `P0-${item.id}`, sourceFindingId: item.id, owner: 'DESIGN-SYSTEM', stage: 'P2/P3', status: 'open' }));
  return { schemaVersion: 3, stage: 'P2', baselineCommit: head, baselineTree: tree, anchors,
    scope: { productRoots, allowedP0Changes, productGeneratedExclusions,
      permanentDivergentScreenIds: PERMANENT_DIVERGENT_SCREEN_IDS },
    thresholds: activeThresholds,
    inventory: measuredInventory, floors: measuredInventory, scripts, gates,
    regressionBacklog,
    successorBacklog: successorBacklog(allFailures.filter((item) => item.disposition === 'regression').map((item) => item.message)),
    classificationSummary: Object.fromEntries(['preserve', 'supersede', 'intentionalDifference', 'regression']
      .map((kind) => [kind, allFailures.filter((item) => item.disposition === kind).length
        + (kind === 'preserve' ? gates.filter((gate) => gate.failures.length === 0 && gate.disposition === kind).length : 0)])) };
}

const failList = [];
const fail = (message) => failList.push(message);
const head = gitText(['rev-parse', 'HEAD']);
if (flag('--write')) {
  const expectedCommit = option('--expect-commit');
  if (!/^[0-9a-f]{40}$/.test(expectedCommit ?? '') || expectedCommit !== head) throw new Error('--write는 --expect-commit=<현재 40자 SHA>가 필요하다.');
  const dirty = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
  if (dirty) throw new Error('--write는 clean worktree에서만 허용된다.');
  const previous = previousBaseline();
  if (previous) {
    if (!flag('--force')) throw new Error('기존 또는 이력상 baseline 갱신은 --force가 필요하다.');
  } else if (!flag('--bootstrap')) {
    throw new Error('최초 baseline 생성은 --bootstrap이 필요하다.');
  }
  const suppliedReclassification = option('--allow-reclassification') ? protectedToken('--allow-reclassification', head) : null;
  const suppliedInventoryChange = option('--allow-inventory-change') ? protectedToken('--allow-inventory-change', head) : null;
  const suppliedProvenanceRepair = option('--allow-provenance-repair') ? protectedToken('--allow-provenance-repair', head) : null;
  const next = measure();
  if (previous) {
    const previousRegression = previous.classificationSummary?.regression ?? 0;
    const nextRegression = next.classificationSummary.regression;
    const previousClassification = classificationOf(previous);
    const nextClassification = classificationOf(next);
    const classificationChanged = JSON.stringify(previousClassification) !== JSON.stringify(nextClassification);
    for (const [key, floor] of Object.entries(previous.floors ?? {})) if ((next.inventory[key] ?? 0) < floor) throw new Error(`inventory floor 악화: ${key}`);
    const floorChanged = JSON.stringify(previous.floors ?? {}) !== JSON.stringify(next.floors);
    const reclassification = classificationChanged ? suppliedReclassification : null;
    const inventoryChange = floorChanged ? suppliedInventoryChange : null;
    if (classificationChanged && !reclassification)
      throw new Error(`분류 또는 regression ${previousRegression}→${nextRegression} 변경은 1회성 --allow-reclassification=<사유ID>@${head} 없이는 쓸 수 없다.`);
    if (floorChanged && !inventoryChange)
      throw new Error(`inventory floor 변경은 1회성 --allow-inventory-change=<사유ID>@${head} 없이는 쓸 수 없다.`);
    if (!classificationChanged && suppliedReclassification) throw new Error('분류가 같아 --allow-reclassification 토큰이 불필요하다.');
    if (!floorChanged && suppliedInventoryChange) throw new Error('inventory floor가 같아 --allow-inventory-change 토큰이 불필요하다.');
    if (reclassification) next.classificationMigration = { authority: 'OPUS_DIRECT_ADVISORY', decision: reclassification.split('@')[0], token: reclassification, decisionCommit: head,
      previousBaselineBlob: gitText(['rev-parse', `${head}:${baselineRel}`]), previousRegression, nextRegression,
      failureLineDelta: failureLineDelta(previous, next) };
    else if (previous.classificationMigration) {
      next.classificationMigration = { ...previous.classificationMigration };
      if (!next.classificationMigration.token && suppliedProvenanceRepair) {
        const historical = historicalChange(next, 'classification');
        if (!historical) throw new Error('legacy classification migration의 write 입력 커밋을 찾지 못했다.');
        next.classificationMigration.decisionCommit = historical.commit;
        next.classificationMigration.token = `${next.classificationMigration.decision}@${historical.commit}`;
      }
      if (!next.classificationMigration.previousBaselineBlob || !Array.isArray(next.classificationMigration.failureLineDelta)) {
        const input = baselineAt(next.classificationMigration.decisionCommit);
        if (!input) throw new Error('classification migration의 이전 baseline을 decision commit에서 읽지 못했다.');
        next.classificationMigration.previousBaselineBlob = gitText(['rev-parse', `${next.classificationMigration.decisionCommit}:${baselineRel}`]);
        next.classificationMigration.failureLineDelta = failureLineDelta(input, next);
      }
    }
    if (inventoryChange) next.inventoryMigration = { authority: 'REPOSITORY_DECISION', decision: inventoryChange.split('@')[0], token: inventoryChange, decisionCommit: head, previousFloors: previous.floors, nextFloors: next.floors };
    else if (previous.inventoryMigration) {
      next.inventoryMigration = { ...previous.inventoryMigration };
      if (!next.inventoryMigration.token && suppliedProvenanceRepair) {
        const historical = historicalChange(next, 'inventory');
        if (!historical) throw new Error('legacy inventory migration의 write 입력 커밋을 찾지 못했다.');
        next.inventoryMigration.decisionCommit = historical.commit;
        next.inventoryMigration.token = `${next.inventoryMigration.decision}@${historical.commit}`;
      }
    }
    const validPreviousProvenance = previous.provenance?.writtenBy === '--write'
      && previous.provenance?.headAtWrite === previous.baselineCommit
      && Array.isArray(previous.provenance?.tokens);
    if (!validPreviousProvenance && !suppliedProvenanceRepair)
      throw new Error(`provenance 복구는 1회성 --allow-provenance-repair=<사유ID>@${head} 없이는 쓸 수 없다.`);
    if (validPreviousProvenance && suppliedProvenanceRepair) throw new Error('provenance가 유효해 복구 토큰이 불필요하다.');
    next.provenance = { writtenBy: '--write', headAtWrite: head,
      tokens: [...new Set([next.classificationMigration?.token, next.inventoryMigration?.token, suppliedProvenanceRepair].filter(Boolean))] };
  } else {
    next.provenance = { writtenBy: '--write', headAtWrite: head, tokens: [] };
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
}
if (!existsSync(baselinePath)) throw new Error('three-surface-baseline.json이 없다. 보호된 --write로 생성하라.');
const expectedText = readFileSync(baselinePath, 'utf8');
const expected = JSON.parse(expectedText);
const actualInventory = inventory();
const actualScripts = measuredScripts();
if (expected.schemaVersion !== 3 || expected.stage !== 'P2') fail('baseline schema/stage 오류');
if (git(['merge-base', '--is-ancestor', expected.baselineCommit, 'HEAD']).status !== 0) fail('baselineCommit이 HEAD 조상이 아니다');
if (gitText(['rev-parse', `${expected.baselineCommit}^{tree}`]) !== expected.baselineTree) fail('baseline tree 결속 오류');
for (const [name, anchor] of Object.entries(expected.anchors ?? {})) {
  if (git(['merge-base', '--is-ancestor', anchor.commit, 'HEAD']).status !== 0 || gitText(['rev-parse', `${anchor.commit}^{tree}`]) !== anchor.tree) fail(`anchor ${name} 결속 오류`);
}
if (JSON.stringify(expected.anchors) !== JSON.stringify(anchors)) fail('필수 기준선 anchor 누락 또는 변경');
if (JSON.stringify(expected.scope) !== JSON.stringify({ productRoots, allowedP0Changes, productGeneratedExclusions,
  permanentDivergentScreenIds: PERMANENT_DIVERGENT_SCREEN_IDS })) fail('scope 계약이 코드와 다르다');
if (expected.provenance?.writtenBy !== '--write' || expected.provenance?.headAtWrite !== expected.baselineCommit || !Array.isArray(expected.provenance?.tokens))
  fail('baseline --write provenance가 없거나 baselineCommit과 다르다');
else if ((expected.provenance.tokens ?? []).some((token) => !/^[A-Z0-9][A-Z0-9-]*@[0-9a-f]{40}$/.test(token))) fail('baseline provenance token 형식 오류');
const historicalClassification = historicalChange(expected, 'classification');
if (historicalClassification) validateMigration({ migration: expected.classificationMigration, kind: 'classification', previous: historicalClassification.baseline, current: expected, fail });
const historicalInventory = historicalChange(expected, 'inventory');
if (historicalInventory) validateMigration({ migration: expected.inventoryMigration, kind: 'inventory', previous: historicalInventory.baseline, current: expected, fail });
const roots = expected.scope?.productRoots ?? [];
const committed = productScopeChangedPaths(root, expected.baselineCommit, 'HEAD', roots);
const dirtyProduct = dirtyProductScope(root, roots);
if (committed.length || dirtyProduct) fail(`P0 제품 화면 변경 금지 위반: ${[...committed, ...(dirtyProduct ? [dirtyProduct.replaceAll('\n', ' | ')] : [])].join(', ')}`);
for (const [key, floor] of Object.entries(expected.floors ?? {})) if ((actualInventory[key] ?? 0) < floor) fail(`inventory floor ${key} ${actualInventory[key]} < ${floor}`);
if (JSON.stringify(expected.scripts) !== JSON.stringify(actualScripts)) fail('게이트 스크립트 hash 결속 불일치');
if (JSON.stringify(expected.thresholds) !== JSON.stringify(activeThresholds)) fail('P2 active threshold 계약 오류');
for (const expectedGate of expected.gates ?? []) {
  if (!['preserve', 'supersede', 'intentionalDifference', 'regression'].includes(expectedGate.disposition)) fail(`${expectedGate.id} disposition 오류`);
  if (!expectedGate.rationale || !expectedGate.successorContract) fail(`${expectedGate.id} 근거 또는 승계 계약 누락`);
}
const expectedFailures = expected.gates.flatMap((gate) => gate.failures);
const regressionIds = expectedFailures.filter((item) => item.disposition === 'regression').map((item) => item.id);
const backlogSourceIds = (expected.regressionBacklog ?? []).map((item) => item.sourceFindingId);
if (JSON.stringify(backlogSourceIds) !== JSON.stringify(regressionIds)) fail('regression backlog가 선언별 regression과 양방향 일치하지 않는다');
if ((expected.regressionBacklog ?? []).some((item) => !item.id || !item.owner || !item.stage || item.status !== 'open')) fail('regression backlog 필수 필드 누락');
let actualSuccessorBacklog = null;
try { actualSuccessorBacklog = successorBacklog(expectedFailures.filter((item) => item.disposition === 'regression').map((item) => item.message)); }
catch (error) { fail(`successor backlog을 읽지 못했다: ${String(error)}`); }
if (actualSuccessorBacklog && JSON.stringify(expected.successorBacklog) !== JSON.stringify(actualSuccessorBacklog))
  fail('P0 regression과 S4 successor backlog 결속이 다르다');
const recomputedSummary = Object.fromEntries(['preserve', 'supersede', 'intentionalDifference', 'regression'].map((kind) => [kind,
  expectedFailures.filter((item) => item.disposition === kind).length + (kind === 'preserve' ? expected.gates.filter((gate) => gate.failures.length === 0 && gate.disposition === kind).length : 0)]));
if (JSON.stringify(expected.classificationSummary) !== JSON.stringify(recomputedSummary)) fail('classificationSummary 재계산 불일치');
if (Buffer.from(expectedText)[0] === 0xef || expectedText.includes('\r') || expectedText !== `${JSON.stringify(expected, null, 2)}\n`) fail('baseline canonical JSON/BOM/LF 계약 위반');
if (failList.length) { console.error(failList.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
const actual = measure();
for (const expectedGate of expected.gates ?? []) {
  const actualGate = actual.gates.find((item) => item.id === expectedGate.id);
  if (!actualGate || actualGate.exitCode !== expectedGate.exitCode || actualGate.outputSha256 !== expectedGate.outputSha256) fail(`${expectedGate.id} 재현 출력이 기준선과 다르다`);
  if (actualGate?.disposition !== expectedGate.disposition || actualGate?.rationale !== expectedGate.rationale || actualGate?.successorContract !== expectedGate.successorContract) fail(`${expectedGate.id} 분류 근거 또는 승계 계약이 기준선과 다르다`);
  if (JSON.stringify(actualGate.failureLines) !== JSON.stringify(expectedGate.failureLines)) fail(`${expectedGate.id} 실패선 누락 또는 추가`);
  if (JSON.stringify(actualGate.failures) !== JSON.stringify(expectedGate.failures)) fail(`${expectedGate.id} 선언별 분류가 실측 규칙과 다르다`);
}
if (failList.length) { console.error(failList.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
const measuredFailures = actual.gates.reduce((sum, gate) => sum + gate.failureLines.length, 0);
console.log(`3표면 P0 기준선 PASS — 화면 ID ${actual.inventory.screenIds} · route ${actual.inventory.routeFiles} · prototype ${actual.inventory.prototypeTargetsMeasured} · 실패선 ${measuredFailures}건 전수 분류`);
