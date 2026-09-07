#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const baselinePath = resolve(root, 'docs/prototypes/three-surface-baseline.json');
const args = new Set(process.argv.slice(2));
const norm = (text) => text.replaceAll('\r\n', '\n');
const sha = (text) => createHash('sha256').update(norm(text)).digest('hex');
const git = (input) => spawnSync('git', input, { cwd: root, encoding: 'utf8', maxBuffer: 100_000_000 });
const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', maxBuffer: 100_000_000 });
  const output = norm(`${result.stdout ?? ''}${result.stderr ?? ''}`).trimEnd();
  return { exitCode: result.status, outputSha256: sha(output), lineCount: output ? output.split('\n').length : 0,
    failureLines: output.split('\n').filter((line) => /^\s+- /.test(line)).map((line) => line.trim().slice(2)) };
};
const walk = (base) => {
  const out = []; const visit = (dir) => { if (!existsSync(dir)) return; for (const name of readdirSync(dir)) {
    const path = join(dir, name); const stat = statSync(path); if (stat.isDirectory()) visit(path); else out.push(relative(root, path).replaceAll('\\', '/'));
  }}; visit(resolve(root, base)); return out.sort();
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
  { id: 'S3A-EXACT', command: ['node', ['scripts/design-token-s3a-diff.mjs']], disposition: 'supersede', successorContract: 'P1 inventory + P2/P3 token-adoption and visual-diff gates' },
  { id: 'S4-EXACT', command: ['node', ['scripts/design-token-s4-check.mjs']], disposition: 'supersede', successorContract: 'P1 registry + P2/P3 component and visual-diff gates' },
  { id: 'TOUCH-EXACT', command: ['node', ['scripts/touch-target-audit.mjs']], disposition: 'supersede', successorContract: 'P2/P3 refreshed touch inventory; minimum 44 contract remains preserved' },
  { id: 'CONTRAST', command: ['node', ['scripts/design-token-contrast.mjs']], disposition: 'preserve', successorContract: 'Existing contrast gate remains mandatory' },
];
const classifyFailure = (gateId, message, fallback) => {
  if (gateId === 'S3A-EXACT' && /승인된 (?:치환|hitSlop 보정)이 재현되지 않았다/.test(message)) return 'regression';
  if (gateId === 'S4-EXACT' && message.startsWith('S3a 회귀 ')) return 'regression';
  if (gateId === 'TOUCH-EXACT' && message.startsWith('새 형제 중첩 위험 ')) return 'regression';
  return fallback;
};
function measure() {
  const head = git(['rev-parse', 'HEAD']).stdout.trim(); const tree = git(['rev-parse', 'HEAD^{tree}']).stdout.trim();
  const gates = gateDefs.map((definition) => {
    const measurement = run(...definition.command);
    return { id: definition.id, command: [definition.command[0], ...definition.command[1]].join(' '), ...measurement,
      disposition: definition.disposition, rationale: definition.disposition === 'preserve'
        ? '현재 제품에서도 의미와 입력 범위가 유효하며 그대로 통과한다.'
        : '과거 exact 파일·줄·소비처 인벤토리는 통합 이후 구조와 달라졌다. 실패선을 삭제하지 않고 새 동등 계약으로 승계한다.',
      successorContract: definition.successorContract,
      failures: measurement.failureLines.map((message, index) => ({ id: `${definition.id}-${String(index + 1).padStart(4, '0')}`, disposition: classifyFailure(definition.id, message, definition.disposition), message })),
    };
  });
  const scripts = [...new Set(gateDefs.map((item) => item.command[1][0]))].sort().map((path) => ({ path, textSha256: sha(readFileSync(resolve(root, path), 'utf8')) }));
  const allFailures = gates.flatMap((gate) => gate.failures);
  return { schemaVersion: 1, stage: 'P0', baselineCommit: head, baselineTree: tree,
    scope: { productRoots: ['apps/mobile/app', 'apps/mobile/src'], allowedP0Changes: ['docs/**', 'scripts/**', 'apps/mobile/tests/myHours.test.tsx'] },
    thresholds: { migrationBacklogMax: 80, emergencyDivergenceMax: 3, migrationDeadlineUtc: '2026-10-31T23:59:59Z' },
    inventory: inventory(), floors: inventory(), scripts, gates,
    regressionBacklog: allFailures.filter((item) => item.disposition === 'regression').map((item) => ({ id: `P0-${item.id}`, sourceFindingId: item.id, owner: 'DESIGN-SYSTEM', stage: 'P2/P3', status: 'open' })),
    classificationSummary: Object.fromEntries(['preserve', 'supersede', 'intentionalDifference', 'regression'].map((kind) => [kind, allFailures.filter((item) => item.disposition === kind).length + (kind === 'preserve' ? gates.filter((gate) => gate.failures.length === 0 && gate.disposition === kind).length : 0)])) };
}
if (args.has('--write')) writeFileSync(baselinePath, `${JSON.stringify(measure(), null, 2)}\n`);
if (!existsSync(baselinePath)) throw new Error('three-surface-baseline.json이 없다. --write로 생성하라.');
const expected = JSON.parse(readFileSync(baselinePath, 'utf8'));
const actual = measure(); const failures = [];
const fail = (message) => failures.push(message);
if (expected.schemaVersion !== 1 || expected.stage !== 'P0') fail('baseline schema/stage 오류');
const productDiff = git(['diff', '--name-only', `${expected.baselineCommit}..HEAD`, '--', 'apps/mobile/app', 'apps/mobile/src']).stdout.trim().split(/\r?\n/).filter(Boolean).filter((path) => path !== 'apps/mobile/tests/myHours.test.tsx');
if (productDiff.length) fail(`P0 제품 화면 변경 금지 위반: ${productDiff.join(', ')}`);
for (const [key, floor] of Object.entries(expected.floors ?? {})) if ((actual.inventory[key] ?? 0) < floor) fail(`inventory floor ${key} ${actual.inventory[key]} < ${floor}`);
for (const expectedGate of expected.gates ?? []) {
  const actualGate = actual.gates.find((item) => item.id === expectedGate.id);
  if (!actualGate || actualGate.exitCode !== expectedGate.exitCode || actualGate.outputSha256 !== expectedGate.outputSha256) fail(`${expectedGate.id} 재현 출력이 기준선과 다르다`);
  if (!['preserve', 'supersede', 'intentionalDifference', 'regression'].includes(expectedGate.disposition)) fail(`${expectedGate.id} disposition 오류`);
  if (!expectedGate.rationale || !expectedGate.successorContract) fail(`${expectedGate.id} 근거 또는 승계 계약 누락`);
  if (JSON.stringify(actualGate.failureLines) !== JSON.stringify(expectedGate.failureLines)) fail(`${expectedGate.id} 실패선 누락 또는 추가`);
  if ((expectedGate.failures ?? []).length !== expectedGate.failureLines.length) fail(`${expectedGate.id} 선언별 분류 수가 실패선 수와 다르다`);
  for (const item of expectedGate.failures ?? []) if (!['preserve', 'supersede', 'intentionalDifference', 'regression'].includes(item.disposition)) fail(`${item.id} 선언 disposition 오류`);
}
const regressionIds = expected.gates.flatMap((gate) => gate.failures).filter((item) => item.disposition === 'regression').map((item) => item.id);
const backlogSourceIds = (expected.regressionBacklog ?? []).map((item) => item.sourceFindingId);
if (JSON.stringify(backlogSourceIds) !== JSON.stringify(regressionIds)) fail('regression backlog가 선언별 regression과 양방향 일치하지 않는다');
if ((expected.regressionBacklog ?? []).some((item) => !item.id || !item.owner || !item.stage || item.status !== 'open')) fail('regression backlog 필수 필드 누락');
if (readFileSync(baselinePath)[0] === 0xef || readFileSync(baselinePath, 'utf8').includes('\r')) fail('baseline BOM/LF 계약 위반');
if (failures.length) { console.error(failures.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
console.log(`3표면 P0 기준선 PASS — 화면 ID ${actual.inventory.screenIds} · route ${actual.inventory.routeFiles} · prototype ${actual.inventory.prototypeTargetsMeasured} · 실패선 ${expected.gates.reduce((sum, gate) => sum + gate.failureLines.length, 0)}건 전수 분류`);
