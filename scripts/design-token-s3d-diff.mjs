#!/usr/bin/env node
/** S3d exact gate — 승인된 자간·크기·색 32건과 완결 역할 참조 외 앱 변경을 거부한다. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--'))
  .map(a => a.replace(/^--/, '').split('=')));
const root = resolve(opt.root ?? '.');
const knownPath = resolve(root, opt.known ?? 'scripts/design-token-s3d-known.json');
const outputPath = opt.out ? resolve(root, opt.out) : null;
const known = JSON.parse(readFileSync(knownPath, 'utf8'));
const failures = [];
const fail = message => failures.push(message);
const lf = text => text.replace(/\r\n/g, '\n');
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const read = file => lf(readFileSync(resolve(root, file), 'utf8'));
const readAt = (commit, file) => lf(execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, encoding: 'utf8' }));

const walk = (dir, acc = []) => {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, acc);
    else if (/\.tsx?$/.test(path)) acc.push(relative(root, path).replaceAll('\\', '/'));
  }
  return acc;
};

if (known.schemaVersion !== 1 || known.stage !== 'S3d') fail('known 계약은 schemaVersion 1 · stage S3d여야 한다');
if (known.expectedPendingDeclarationsResolved !== 32) fail('S3d는 pendingApproval 32건을 정확히 닫아야 한다');
if (!/^[0-9a-f]{40}$/.test(known.productCommit ?? '')) fail('S3d productCommit이 완전한 SHA가 아니다');
if (!Array.isArray(known.files) || new Set(known.files.map(x => x.file)).size !== known.files?.length)
  fail('files가 없거나 경로가 중복됐다');

const currentFiles = [...walk(join(root, 'apps/mobile/src')), ...walk(join(root, 'apps/mobile/app'))].sort();
const productCommit = known.productCommit;
if (productCommit && spawnSync('git', ['merge-base', '--is-ancestor', productCommit, 'HEAD'], { cwd: root }).status !== 0)
  fail(`S3d productCommit ${productCommit}이 HEAD의 조상이 아니다`);
const productFiles = productCommit ? git(['ls-tree', '-r', '--name-only', productCommit, '--', 'apps/mobile/src', 'apps/mobile/app'])
  .split(/\r?\n/).filter(file => /\.tsx?$/.test(file)).sort() : [];
const baselineFiles = git(['ls-tree', '-r', '--name-only', known.baselineCommit, '--', 'apps/mobile/src', 'apps/mobile/app'])
  .split(/\r?\n/).filter(file => /\.tsx?$/.test(file)).sort();
if (JSON.stringify(productFiles) !== JSON.stringify(baselineFiles)) fail('S3d 제품 커밋의 앱 TS/TSX 파일 집합이 기준선과 다르다');

const changedFiles = productFiles.filter(file => readAt(productCommit, file) !== readAt(known.baselineCommit, file));
const expectedFiles = known.files.map(x => x.file).sort();
if (JSON.stringify(changedFiles) !== JSON.stringify(expectedFiles)) {
  fail(`변경 파일 집합 불일치: expected ${expectedFiles.length}, current ${changedFiles.length}`);
}
for (const item of known.files ?? []) {
  const actual = sha(readAt(productCommit, item.file));
  if (actual !== item.sha256) fail(`${item.file} 내용 불일치: expected ${item.sha256.slice(0, 12)}, current ${actual.slice(0, 12)}`);
}

const tokenSource = read('apps/mobile/src/theme/tokens.ts');
for (const snippet of known.requiredTokenSnippets ?? []) {
  if (!tokenSource.includes(snippet)) fail(`필수 토큰 계약 누락: ${snippet}`);
}
for (const item of known.requiredProductSnippets ?? []) {
  if (!read(item.file).includes(item.snippet)) fail(`현재 제품 역할 계약 누락: ${item.file} — ${item.snippet}`);
}
const productSource = currentFiles.filter(f => f !== 'apps/mobile/src/theme/tokens.ts').map(read).join('\n');
for (const legacy of [
  'fontSize: 13.5', 'fontSize: 14.5', 'fontSize: 17', 'fontSize: 25',
  'letterSpacing: -0.6', 'letterSpacing: -0.5', 'letterSpacing: -0.4', 'letterSpacing: -0.2',
  "'#D5DAE0'", "'#FFF9F0'", "'#7A8694'", "'#C5CCD3'", "'#CDD3DA'", "'#5B6573'",
]) if (productSource.includes(legacy)) fail(`제품층 승인 전 리터럴 잔존: ${legacy}`);

if (opt['expect-commit']) {
  const head = git(['rev-parse', 'HEAD']);
  if (head !== opt['expect-commit']) fail(`HEAD 불일치: expected ${opt['expect-commit']}, current ${head}`);
  const dirty = git(['status', '--porcelain', '--', 'apps/mobile', 'scripts/design-token-s3d-known.json',
    'scripts/design-token-s3d-diff.mjs', 'scripts/design-token-s3d-diff.test.mjs']);
  if (dirty) fail(`S3d 결속 범위가 깨끗하지 않다: ${dirty.split(/\r?\n/).length}건`);
}

const result = {
  schemaVersion: 1,
  stage: 'S3d',
  baselineCommit: known.baselineCommit,
  productCommit,
  ownerDecisionDate: known.ownerDecisionDate,
  pendingDeclarationsResolved: known.expectedPendingDeclarationsResolved,
  changedFiles,
  appTreeSha256: sha(currentFiles.map(file => `${file}\0${read(file)}`).join('\0')),
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
};
if (outputPath) writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(`S3d 치환 계약 — pending ${result.pendingDeclarationsResolved}건 · 변경 파일 ${changedFiles.length}`);
console.log(failures.length ? 'S3d 치환 계약 FAIL' : 'S3d 치환 계약 PASS');
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
