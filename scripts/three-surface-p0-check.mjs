#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
const root = resolve(option('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const baselinePath = resolve(root, option('--baseline') ?? 'docs/prototypes/three-surface-baseline.json');
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
const gateDefs = [
  { id: 'S3A-EXACT', command: ['node', ['scripts/design-token-s3a-diff.mjs']], disposition: 'regression', successorContract: 'P0 backlog + P2/P3 token-adoption and visual-diff gates' },
  { id: 'S4-EXACT', command: ['node', ['scripts/design-token-s4-check.mjs']], disposition: 'regression', successorContract: 'P0 backlog + P2/P3 component and visual-diff gates' },
  { id: 'TOUCH-EXACT', command: ['node', ['scripts/touch-target-audit.mjs']], disposition: 'regression', successorContract: 'P0 backlog + P2/P3 refreshed touch inventory; minimum 44 contract remains preserved' },
  { id: 'CONTRAST', command: ['node', ['scripts/design-token-contrast.mjs']], disposition: 'preserve', successorContract: 'Existing contrast gate remains mandatory' },
];
const classifyFailure = (gateId) => gateId === 'CONTRAST' ? 'preserve' : 'regression';

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
  const scripts = [...new Set(gateDefs.map((item) => item.command[1][0]))].sort()
    .map((path) => ({ path, textSha256: sha(readFileSync(resolve(root, path), 'utf8')) }));
  const allFailures = gates.flatMap((gate) => gate.failures);
  return { schemaVersion: 2, stage: 'P0', baselineCommit: head, baselineTree: tree, anchors,
    scope: { productRoots, allowedP0Changes },
    thresholds: { status: 'deferredUntilP2', activationStage: 'P2', decisionRequired: true },
    inventory: measuredInventory, floors: measuredInventory, scripts, gates,
    regressionBacklog: allFailures.filter((item) => item.disposition === 'regression')
      .map((item) => ({ id: `P0-${item.id}`, sourceFindingId: item.id, owner: 'DESIGN-SYSTEM', stage: 'P2/P3', status: 'open' })),
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
  const next = measure();
  if (existsSync(baselinePath)) {
    if (!flag('--force')) throw new Error('기존 baseline 갱신은 --force가 필요하다.');
    const previous = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const previousRegression = previous.classificationSummary?.regression ?? 0;
    const nextRegression = next.classificationSummary.regression;
    for (const [key, floor] of Object.entries(previous.floors ?? {})) if ((next.inventory[key] ?? 0) < floor) throw new Error(`inventory floor 악화: ${key}`);
    if (nextRegression > previousRegression && option('--allow-reclassification') !== 'OPUS-P0-M2-2026-09-08')
      throw new Error(`regression ${previousRegression}→${nextRegression} 증가는 명시적 검수 정정 없이는 쓸 수 없다.`);
    if (nextRegression > previousRegression) next.classificationMigration = { authority: 'OPUS_DIRECT_ADVISORY', decision: 'M-2', reason: '값·개수·새 미판정 표면을 supersede에서 regression으로 보수 재분류', previousRegression, nextRegression };
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
}
if (!existsSync(baselinePath)) throw new Error('three-surface-baseline.json이 없다. 보호된 --write로 생성하라.');
const expectedText = readFileSync(baselinePath, 'utf8');
const expected = JSON.parse(expectedText); const actual = measure();
if (expected.schemaVersion !== 2 || expected.stage !== 'P0') fail('baseline schema/stage 오류');
if (git(['merge-base', '--is-ancestor', expected.baselineCommit, 'HEAD']).status !== 0) fail('baselineCommit이 HEAD 조상이 아니다');
if (gitText(['rev-parse', `${expected.baselineCommit}^{tree}`]) !== expected.baselineTree) fail('baseline tree 결속 오류');
for (const [name, anchor] of Object.entries(expected.anchors ?? {})) {
  if (git(['merge-base', '--is-ancestor', anchor.commit, 'HEAD']).status !== 0 || gitText(['rev-parse', `${anchor.commit}^{tree}`]) !== anchor.tree) fail(`anchor ${name} 결속 오류`);
}
if (JSON.stringify(expected.anchors) !== JSON.stringify(anchors)) fail('필수 기준선 anchor 누락 또는 변경');
if (JSON.stringify(expected.scope) !== JSON.stringify(actual.scope)) fail('scope 계약이 코드와 다르다');
const roots = expected.scope?.productRoots ?? [];
const committed = gitText(['diff', '--name-only', `${expected.baselineCommit}..HEAD`, '--', ...roots]).split('\n').filter(Boolean);
const dirtyProduct = gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', ...roots]);
if (committed.length || dirtyProduct) fail(`P0 제품 화면 변경 금지 위반: ${[...committed, ...(dirtyProduct ? [dirtyProduct.replaceAll('\n', ' | ')] : [])].join(', ')}`);
for (const [key, floor] of Object.entries(expected.floors ?? {})) if ((actual.inventory[key] ?? 0) < floor) fail(`inventory floor ${key} ${actual.inventory[key]} < ${floor}`);
if (JSON.stringify(expected.scripts) !== JSON.stringify(actual.scripts)) fail('게이트 스크립트 hash 결속 불일치');
if (expected.thresholds?.status !== 'deferredUntilP2' || expected.thresholds?.activationStage !== 'P2' || expected.thresholds?.decisionRequired !== true) fail('P2 전 threshold 결정 상태 오류');
for (const expectedGate of expected.gates ?? []) {
  const actualGate = actual.gates.find((item) => item.id === expectedGate.id);
  if (!actualGate || actualGate.exitCode !== expectedGate.exitCode || actualGate.outputSha256 !== expectedGate.outputSha256) fail(`${expectedGate.id} 재현 출력이 기준선과 다르다`);
  if (!['preserve', 'supersede', 'intentionalDifference', 'regression'].includes(expectedGate.disposition)) fail(`${expectedGate.id} disposition 오류`);
  if (!expectedGate.rationale || !expectedGate.successorContract) fail(`${expectedGate.id} 근거 또는 승계 계약 누락`);
  if (JSON.stringify(actualGate.failureLines) !== JSON.stringify(expectedGate.failureLines)) fail(`${expectedGate.id} 실패선 누락 또는 추가`);
  if (JSON.stringify(actualGate.failures) !== JSON.stringify(expectedGate.failures)) fail(`${expectedGate.id} 선언별 분류가 실측 규칙과 다르다`);
}
const expectedFailures = expected.gates.flatMap((gate) => gate.failures);
const regressionIds = expectedFailures.filter((item) => item.disposition === 'regression').map((item) => item.id);
const backlogSourceIds = (expected.regressionBacklog ?? []).map((item) => item.sourceFindingId);
if (JSON.stringify(backlogSourceIds) !== JSON.stringify(regressionIds)) fail('regression backlog가 선언별 regression과 양방향 일치하지 않는다');
if ((expected.regressionBacklog ?? []).some((item) => !item.id || !item.owner || !item.stage || item.status !== 'open')) fail('regression backlog 필수 필드 누락');
const recomputedSummary = Object.fromEntries(['preserve', 'supersede', 'intentionalDifference', 'regression'].map((kind) => [kind,
  expectedFailures.filter((item) => item.disposition === kind).length + (kind === 'preserve' ? expected.gates.filter((gate) => gate.failures.length === 0 && gate.disposition === kind).length : 0)]));
if (JSON.stringify(expected.classificationSummary) !== JSON.stringify(recomputedSummary)) fail('classificationSummary 재계산 불일치');
if (Buffer.from(expectedText)[0] === 0xef || expectedText.includes('\r') || expectedText !== `${JSON.stringify(expected, null, 2)}\n`) fail('baseline canonical JSON/BOM/LF 계약 위반');
if (failList.length) { console.error(failList.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
const measuredFailures = actual.gates.reduce((sum, gate) => sum + gate.failureLines.length, 0);
console.log(`3표면 P0 기준선 PASS — 화면 ID ${actual.inventory.screenIds} · route ${actual.inventory.routeFiles} · prototype ${actual.inventory.prototypeTargetsMeasured} · 실패선 ${measuredFailures}건 전수 분류`);
