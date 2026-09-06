#!/usr/bin/env node
/** S3c 계약 — PRT-249 exact SHA에서 승인된 W1 잔여 defect 8건 외 앱 변경을 허용하지 않는다. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--'))
  .map(a => a.replace(/^--/, '').split('=')));
const root = resolve(opt.root ?? '.');
const knownPath = resolve(root, opt.known ?? 'scripts/design-token-s3c-known.json');
const outputPath = opt.out ? resolve(root, opt.out) : null;
const baselineRoot = opt['baseline-root'] ? resolve(opt['baseline-root']) : null;
const known = JSON.parse(readFileSync(knownPath, 'utf8'));
const failures = [];
const fail = message => failures.push(message);
const lf = text => text.replace(/\r\n/g, '\n');
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const walk = (dir, acc = []) => {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, acc);
    else if (path.endsWith('.ts') || path.endsWith('.tsx')) acc.push(relative(root, path).replaceAll('\\', '/'));
  }
  return acc;
};
const currentFiles = [...walk(join(root, 'apps/mobile/src')), ...walk(join(root, 'apps/mobile/app'))].sort();
const baselineFiles = baselineRoot
  ? [...walk(join(baselineRoot, 'apps/mobile/src')), ...walk(join(baselineRoot, 'apps/mobile/app'))]
      .map(file => relative(baselineRoot, resolve(root, file)).replaceAll('\\', '/')).sort()
  : git(['ls-tree', '-r', '--name-only', known.baselineCommit, '--', 'apps/mobile/src', 'apps/mobile/app'])
      .split(/\r?\n/).filter(file => /\.tsx?$/.test(file)).sort();
const readCurrent = file => lf(readFileSync(resolve(root, file), 'utf8'));
const readBaseline = file => lf(baselineRoot
  ? readFileSync(resolve(baselineRoot, file), 'utf8')
  : execFileSync('git', ['show', `${known.baselineCommit}:${file}`], { cwd: root, encoding: 'utf8' }));
const occurrences = (text, needle) => needle ? text.split(needle).length - 1 : 0;

if (known.schemaVersion !== 1 || known.stage !== 'S3c') fail('known 계약은 schemaVersion 1 · stage S3c 여야 한다');
if (!Number.isInteger(known.expectedAssignments) || known.expectedAssignments < 1)
  fail('expectedAssignments는 양의 정수여야 한다');
if (!Array.isArray(known.assignments) || known.assignments.length !== known.expectedAssignments)
  fail(`S3c assignment는 정확히 ${known.expectedAssignments}건이어야 한다`);
if (new Set((known.assignments ?? []).map(a => a.id)).size !== known.assignments?.length) fail('assignment id 중복');
if (JSON.stringify(currentFiles) !== JSON.stringify(baselineFiles)) fail('앱 TS/TSX 파일 집합이 기준선과 다르다');

const byFile = new Map();
for (const a of known.assignments ?? []) {
  if (!a.id || !a.file || !Array.isArray(a.replacements) || a.replacements.length === 0) {
    fail(`불완전 assignment: ${a.id ?? '(id 없음)'}`);
    continue;
  }
  if (a.rule === 'R-SP-CAPTION-GAP-VIEW') {
    if (a.axis !== 'vertical' || a.delta !== 'grow' || a.currentValue !== 2 || a.targetValue !== 4 || a.target !== 'space.xs')
      fail(`${a.id} 간격 계약은 vertical · grow · 2→4 · space.xs 여야 한다`);
  } else if (a.rule === 'R-CL-SHADOW') {
    if (a.axis !== 'none' || a.delta !== 'same' || a.target !== `shadow.${a.shadowRole}`)
      fail(`${a.id} 그림자 계약은 axis none · delta same · shadow 역할 참조여야 한다`);
    const tokens = readCurrent('apps/mobile/src/theme/tokens.ts');
    if (!tokens.includes(`${a.shadowRole}: { ${a.bundle} }`))
      fail(`${a.id}의 ${a.target} 정의가 기준 bundle과 다르다`);
  } else fail(`${a.id} 알 수 없는 W1 규칙 ${a.rule}`);
  const list = byFile.get(a.file) ?? [];
  list.push(...a.replacements.map(r => ({ ...r, id: a.id })));
  byFile.set(a.file, list);
}

for (const file of new Set([...baselineFiles, ...currentFiles])) {
  if (!baselineFiles.includes(file) || !currentFiles.includes(file)) continue;
  const before = readBaseline(file);
  const current = readCurrent(file);
  let expected = before;
  for (const r of byFile.get(file) ?? []) {
    const count = occurrences(expected, r.before);
    if (count !== 1) {
      fail(`${r.id} before가 기준선 ${file}에서 정확히 1개가 아니다: ${count}`);
      continue;
    }
    expected = expected.replace(r.before, r.after);
  }
  if (current !== expected) {
    const expectedHash = sha(expected).slice(0, 12);
    const currentHash = sha(current).slice(0, 12);
    fail(`${file}에 승인 밖 변경 또는 누락이 있다: expected ${expectedHash}, current ${currentHash}`);
  }
}

if (opt['expect-commit']) {
  const head = git(['rev-parse', 'HEAD']);
  if (head !== opt['expect-commit']) fail(`HEAD 불일치: expected ${opt['expect-commit']}, current ${head}`);
  const dirty = git(['status', '--porcelain', '--', 'apps/mobile', 'scripts/design-token-s3c-known.json',
    'scripts/design-token-s3c-diff.mjs', 'scripts/design-token-s3c-diff.test.mjs']);
  if (dirty) fail(`S3c 결속 범위가 깨끗하지 않다: ${dirty.split(/\r?\n/).length}건`);
}

const changedFiles = currentFiles.filter(file => baselineFiles.includes(file) && readCurrent(file) !== readBaseline(file));
const appTreeSha256 = sha(currentFiles.map(file => `${file}\0${readCurrent(file)}`).join('\0'));
const result = {
  schemaVersion: 1,
  stage: 'S3c',
  baselineCommit: known.baselineCommit,
  assignments: known.assignments?.length ?? 0,
  changedFiles,
  appTreeSha256,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
};
if (outputPath) writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(`S3c 치환 계약 — ${result.assignments}건 · 변경 파일 ${changedFiles.length}`);
console.log(failures.length ? 'S3c 치환 계약 FAIL' : 'S3c 치환 계약 PASS');
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
