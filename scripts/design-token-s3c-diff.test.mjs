import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gate = fileURLToPath(new URL('./design-token-s3c-diff.mjs', import.meta.url));
const put = (root, file, text) => {
  const path = join(root, file);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
};
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), 's3c-'));
  const base = join(dir, 'base');
  const cur = join(dir, 'cur');
  put(base, 'apps/mobile/src/theme/tokens.ts', "export const shadow = { sheet: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16 } };\n");
  put(cur, 'apps/mobile/src/theme/tokens.ts', readFileSync(join(base, 'apps/mobile/src/theme/tokens.ts'), 'utf8'));
  put(base, 'apps/mobile/src/A.tsx', "const x = { marginTop: 2 };\n");
  put(cur, 'apps/mobile/src/A.tsx', "const x = { marginTop: space.xs };\n");
  put(base, 'apps/mobile/src/B.tsx', "import { T } from '@/theme/tokens';\nconst x = { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16 };\n");
  put(cur, 'apps/mobile/src/B.tsx', "import { T, shadow } from '@/theme/tokens';\nconst x = { ...shadow.sheet };\n");
  const known = {
    schemaVersion: 1, stage: 'S3c', baselineCommit: 'fixture', expectedAssignments: 2,
    assignments: [
      { id: 'SP', file: 'apps/mobile/src/A.tsx', rule: 'R-SP-CAPTION-GAP-VIEW', axis: 'vertical', delta: 'grow',
        currentValue: 2, targetValue: 4, target: 'space.xs',
        replacements: [{ before: 'marginTop: 2', after: 'marginTop: space.xs' }] },
      { id: 'SH', file: 'apps/mobile/src/B.tsx', rule: 'R-CL-SHADOW', axis: 'none', delta: 'same',
        target: 'shadow.sheet', shadowRole: 'sheet',
        bundle: "shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16",
        replacements: [
          { before: 'T', after: 'T, shadow' },
          { before: "shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16", after: '...shadow.sheet' },
        ] },
    ],
  };
  put(cur, 'known.json', JSON.stringify(known));
  const run = () => spawnSync(process.execPath, [gate, `--root=${cur}`, `--baseline-root=${base}`, '--known=known.json'], { encoding: 'utf8' });
  return { dir, base, cur, known, run };
};

test('승인된 간격과 그림자 치환만 있으면 통과한다', () => {
  const f = fixture();
  try { assert.equal(f.run().status, 0); } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('승인 밖 앱 변경은 실패한다', () => {
  const f = fixture();
  try {
    put(f.cur, 'apps/mobile/src/A.tsx', "const x = { marginTop: space.xs, padding: 99 };\n");
    assert.equal(f.run().status, 1);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('간격 방향이나 목표값을 바꾸면 실패한다', () => {
  const f = fixture();
  try {
    f.known.assignments[0].delta = 'shrink';
    f.known.assignments[0].targetValue = 2;
    put(f.cur, 'known.json', JSON.stringify(f.known));
    assert.equal(f.run().status, 1);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('정본 그림자 bundle이 달라지면 실패한다', () => {
  const f = fixture();
  try {
    put(f.cur, 'apps/mobile/src/theme/tokens.ts', "export const shadow = { sheet: { shadowColor: '#000', shadowOffset: { width: 0, height: -7 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16 } };\n");
    assert.equal(f.run().status, 1);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('기준선 before가 모호하게 두 번 나오면 실패한다', () => {
  const f = fixture();
  try {
    put(f.base, 'apps/mobile/src/A.tsx', "const a = { marginTop: 2 };\nconst b = { marginTop: 2 };\n");
    assert.equal(f.run().status, 1);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
