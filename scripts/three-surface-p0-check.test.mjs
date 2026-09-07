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
  cpSync(resolve(sourceRoot, 'scripts/three-surface-p0-check.mjs'), resolve(temp, 'scripts/three-surface-p0-check.mjs'));
  git(['add', '--', 'scripts/three-surface-p0-check.mjs'], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test checker'], temp);
  const codeCommit = git(['rev-parse', 'HEAD'], temp).stdout.trim();
  expectFail(run(['--write', '--force', `--expect-commit=${'0'.repeat(40)}`]), /--expect-commit/);
  expectFail(run(['--write', `--expect-commit=${codeCommit}`]), /--force/);
  const initialWrite = run(['--write', '--force', `--expect-commit=${codeCommit}`]);
  assert.equal(initialWrite.status, 0, `${initialWrite.stdout}${initialWrite.stderr}`);
  git(['add', '--', 'docs/prototypes/three-surface-baseline.json'], temp);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test baseline'], temp);
  assert.equal(run([]).status, 0); passed += 1;

  const baselinePath = resolve(temp, 'docs/prototypes/three-surface-baseline.json');
  const original = readFileSync(baselinePath, 'utf8');
  const mutate = (change) => { const data = JSON.parse(original); change(data); writeFileSync(baselinePath, canonical(data)); return run([]); };
  expectFail(mutate((data) => { data.gates[0].outputSha256 = '0'.repeat(64); }), /재현 출력/);
  expectFail(mutate((data) => { data.regressionBacklog.push({ id: 'P0-BOGUS', sourceFindingId: 'BOGUS', owner: 'DESIGN-SYSTEM', stage: 'P2/P3', status: 'open' }); }), /양방향 일치/);
  expectFail(mutate((data) => { data.classificationSummary.regression -= 1; }), /classificationSummary/);
  expectFail(mutate((data) => { data.floors.screenIds += 1; }), /inventory floor/);
  writeFileSync(baselinePath, original);

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

  const bootstrapRoot = mkdtempSync(join(localTempRoot, 'three-surface-bootstrap-'));
  mkdirSync(resolve(bootstrapRoot, 'scripts'), { recursive: true });
  cpSync(resolve(sourceRoot, 'scripts/three-surface-p0-check.mjs'), resolve(bootstrapRoot, 'scripts/three-surface-p0-check.mjs'));
  git(['init'], bootstrapRoot); git(['add', '--all'], bootstrapRoot);
  git(['-c', 'user.name=Three Surface Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'bootstrap candidate'], bootstrapRoot);
  const bootstrapCommit = git(['rev-parse', 'HEAD'], bootstrapRoot).stdout.trim();
  expectFail(run(['--write', `--expect-commit=${bootstrapCommit}`], bootstrapRoot), /--bootstrap/);
  rmSync(bootstrapRoot, { recursive: true, force: true });
  assert.equal(passed, 15);
  console.log(`three-surface P0 실행 음성 계약 ${passed}/15 PASS`);
} finally {
  git(['worktree', 'remove', '--force', temp]);
  rmSync(temp, { recursive: true, force: true });
}
