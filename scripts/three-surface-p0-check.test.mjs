#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const localTempRoot = resolve(sourceRoot, '.tmp');
mkdirSync(localTempRoot, { recursive: true });
const temp = mkdtempSync(join(localTempRoot, 'three-surface-p0-'));
const git = (args, cwd = sourceRoot) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 100_000_000 });
const run = (args, cwd = temp) => spawnSync(process.execPath, ['scripts/three-surface-p0-check.mjs', ...args], { cwd, encoding: 'utf8', maxBuffer: 100_000_000 });
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
let passed = 0;
const expectFail = (result, message) => { assert.notEqual(result.status, 0); assert.match(`${result.stdout}${result.stderr}`, message); passed += 1; };

try {
  assert.equal(git(['worktree', 'add', '--detach', temp, 'HEAD']).status, 0);
  const fixtureReviewTarget = git(['rev-parse', 'HEAD'], temp).stdout.trim();
  cpSync(resolve(sourceRoot, 'scripts/three-surface-p0-check.mjs'), resolve(temp, 'scripts/three-surface-p0-check.mjs'));
  cpSync(resolve(sourceRoot, 'scripts/native-product-evidence-scope.mjs'), resolve(temp, 'scripts/native-product-evidence-scope.mjs'));
  cpSync(resolve(sourceRoot, 'scripts/design-token-s4-check.mjs'), resolve(temp, 'scripts/design-token-s4-check.mjs'));
  cpSync(resolve(sourceRoot, 'scripts/design-token-s4-successor.json'), resolve(temp, 'scripts/design-token-s4-successor.json'));
  const fixtureSuccessor = JSON.parse(readFileSync(resolve(temp, 'scripts/design-token-s4-successor.json'), 'utf8'));
  const fixtureReceipt = resolve(temp, fixtureSuccessor.reviewReceipt);
  writeFileSync(fixtureReceipt, `대상: ${fixtureReviewTarget}\n판정: PASS\n`);
  git(['add', '--', 'scripts/three-surface-p0-check.mjs', 'scripts/native-product-evidence-scope.mjs', 'scripts/design-token-s4-check.mjs', 'scripts/design-token-s4-successor.json', fixtureSuccessor.reviewReceipt], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test checker'], temp);
  const codeCommit = git(['rev-parse', 'HEAD'], temp).stdout.trim();
  expectFail(run(['--write', '--force', `--expect-commit=${'0'.repeat(40)}`]), /--expect-commit/);
  expectFail(run(['--write', `--expect-commit=${codeCommit}`]), /--force/);
  const initialWrite = run(['--write', '--force', `--expect-commit=${codeCommit}`]);
  assert.equal(initialWrite.status, 0, `${initialWrite.stdout}${initialWrite.stderr}`);
  git(['add', '--', 'docs/prototypes/three-surface-baseline.json'], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test baseline'], temp);
  assert.equal(run([]).status, 0); passed += 1;

  const generatedRegistryPath = resolve(temp, 'apps/mobile/src/dev/surfaceRegistry.generated.json');
  const generatedRegistryOriginal = readFileSync(generatedRegistryPath, 'utf8');
  writeFileSync(generatedRegistryPath, `${generatedRegistryOriginal}\n`);
  assert.equal(run([]).status, 0); passed += 1;
  writeFileSync(generatedRegistryPath, generatedRegistryOriginal);

  const baselinePath = resolve(temp, 'docs/prototypes/three-surface-baseline.json');
  const original = readFileSync(baselinePath, 'utf8');
  const mutate = (change) => { const data = JSON.parse(original); change(data); writeFileSync(baselinePath, canonical(data)); return run([]); };
  expectFail(mutate((data) => { data.gates[0].outputSha256 = '0'.repeat(64); }), /재현 출력/);
  expectFail(mutate((data) => { data.regressionBacklog.push({ id: 'P0-BOGUS', sourceFindingId: 'BOGUS', owner: 'DESIGN-SYSTEM', stage: 'P2/P3', status: 'open' }); }), /양방향 일치/);
  expectFail(mutate((data) => { data.classificationSummary.regression -= 1; }), /classificationSummary/);
  expectFail(mutate((data) => { data.floors.screenIds += 1; }), /inventory floor/);
  writeFileSync(baselinePath, original);

  const successorPath = resolve(temp, 'scripts/design-token-s4-successor.json');
  const successorOriginal = readFileSync(successorPath, 'utf8');
  const successorData = JSON.parse(successorOriginal);
  successorData.counts.p3Backlog += 1;
  writeFileSync(successorPath, canonical(successorData));
  expectFail(run([]), /successor backlog/);
  const overlappingSuccessor = JSON.parse(successorOriginal);
  const p0Failure = JSON.parse(original).gates.flatMap((gate) => gate.failures).find((item) => item.disposition === 'regression').message;
  overlappingSuccessor.classifications.find((item) => item.kind === 'p3-backlog').message = p0Failure;
  writeFileSync(successorPath, canonical(overlappingSuccessor));
  expectFail(run([]), /중복/);
  writeFileSync(successorPath, successorOriginal);

  const productPath = resolve(temp, 'apps/mobile/src/theme/tokens.ts');
  const productOriginal = readFileSync(productPath, 'utf8');
  writeFileSync(productPath, `${productOriginal}\n// forbidden dirty product mutation\n`);
  expectFail(run([]), /P0 제품 화면 변경 금지/);
  const head = git(['rev-parse', 'HEAD'], temp).stdout.trim();
  expectFail(run(['--write', '--force', `--expect-commit=${head}`]), /clean worktree/);
  writeFileSync(productPath, productOriginal);

  const gatePath = resolve(temp, 'scripts/design-token-s3a-diff.mjs');
  const gateOriginal = readFileSync(gatePath, 'utf8');
  writeFileSync(gatePath, `${gateOriginal}\n// hash mutation\n`);
  expectFail(run([]), /스크립트 hash/);
  writeFileSync(gatePath, gateOriginal);

  rmSync(baselinePath);
  git(['add', '--', 'docs/prototypes/three-surface-baseline.json'], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'delete baseline'], temp);
  const deletionCommit = git(['rev-parse', 'HEAD'], temp).stdout.trim();
  expectFail(run(['--write', `--expect-commit=${deletionCommit}`]), /이력상 baseline.*--force/);
  git(['checkout', 'HEAD^', '--', 'docs/prototypes/three-surface-baseline.json'], temp);
  git(['add', '--', 'docs/prototypes/three-surface-baseline.json'], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'restore baseline'], temp);

  const checkerPath = resolve(temp, 'scripts/three-surface-p0-check.mjs');
  const checkerOriginal = readFileSync(checkerPath, 'utf8');
  writeFileSync(checkerPath, checkerOriginal.replace("gateId === 'CONTRAST' ? 'preserve' : 'regression'", "gateId === 'CONTRAST' ? 'preserve' : 'supersede'"));
  git(['add', '--', 'scripts/three-surface-p0-check.mjs'], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'mutate classification'], temp);
  const mutationCommit = git(['rev-parse', 'HEAD'], temp).stdout.trim();
  expectFail(run(['--write', '--force', `--expect-commit=${mutationCommit}`]), /--allow-reclassification/);
  expectFail(run(['--write', '--force', `--allow-reclassification=TEST-RECLASS@${codeCommit}`, `--expect-commit=${mutationCommit}`]), /형식/);
  const authorized = run(['--write', '--force', `--allow-reclassification=TEST-RECLASS@${mutationCommit}`, `--expect-commit=${mutationCommit}`]);
  assert.equal(authorized.status, 0, `${authorized.stdout}${authorized.stderr}`); passed += 1;
  git(['add', '--', 'docs/prototypes/three-surface-baseline.json'], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'classification baseline receipt'], temp);
  const migratedText = readFileSync(baselinePath, 'utf8');
  const badDelta = JSON.parse(migratedText);
  badDelta.classificationMigration.failureLineDelta = [{ gateId: 'S3A', removed: [], added: ['수기 차집합 오염'] }];
  writeFileSync(baselinePath, canonical(badDelta));
  expectFail(run([]), /실패선 차집합/);
  writeFileSync(baselinePath, migratedText);
  const migrated = JSON.parse(migratedText); delete migrated.classificationMigration;
  writeFileSync(baselinePath, canonical(migrated));
  expectFail(run([]), /classification 이력 변경에 migration/);
  writeFileSync(baselinePath, migratedText);
  const badProvenance = JSON.parse(migratedText); badProvenance.provenance.writtenBy = 'manual';
  writeFileSync(baselinePath, canonical(badProvenance));
  expectFail(run([]), /--write provenance/);
  writeFileSync(baselinePath, migratedText);

  const bootstrapRoot = mkdtempSync(join(localTempRoot, 'three-surface-bootstrap-'));
  mkdirSync(resolve(bootstrapRoot, 'scripts'), { recursive: true });
  cpSync(resolve(sourceRoot, 'scripts/three-surface-p0-check.mjs'), resolve(bootstrapRoot, 'scripts/three-surface-p0-check.mjs'));
  cpSync(resolve(sourceRoot, 'scripts/native-product-evidence-scope.mjs'), resolve(bootstrapRoot, 'scripts/native-product-evidence-scope.mjs'));
  cpSync(resolve(sourceRoot, 'scripts/three-surface-migration-contract.mjs'), resolve(bootstrapRoot, 'scripts/three-surface-migration-contract.mjs'));
  git(['init'], bootstrapRoot); git(['add', '--all'], bootstrapRoot);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'bootstrap candidate'], bootstrapRoot);
  const bootstrapCommit = git(['rev-parse', 'HEAD'], bootstrapRoot).stdout.trim();
  expectFail(run(['--write', `--expect-commit=${bootstrapCommit}`], bootstrapRoot), /--bootstrap/);
  rmSync(bootstrapRoot, { recursive: true, force: true });
  assert.equal(passed, 21);
  console.log(`three-surface P0 실행 음성 계약 ${passed}/21 PASS`);
} finally {
  git(['worktree', 'remove', '--force', temp]);
  rmSync(temp, { recursive: true, force: true });
}
