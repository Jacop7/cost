#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temp = mkdtempSync(join(tmpdir(), 'three-surface-p0-'));
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
  assert.equal(run(['--write', '--force', '--allow-reclassification=OPUS-P0-M2-2026-09-08', `--expect-commit=${codeCommit}`]).status, 0);
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
  assert.equal(passed, 8);
  console.log(`three-surface P0 실행 음성 계약 ${passed}/8 PASS`);
} finally {
  git(['worktree', 'remove', '--force', temp]);
  rmSync(temp, { recursive: true, force: true });
}
