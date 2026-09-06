import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const gate = fileURLToPath(new URL('./design-token-s3d-diff.mjs', import.meta.url));
const sha = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const put = (root, file, text) => {
  const path = join(root, file);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
};
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 's3d-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'fixture'], { cwd: root });
  put(root, 'apps/mobile/src/theme/tokens.ts', 'export const old = 1;\n');
  put(root, 'apps/mobile/src/A.tsx', 'const x = 25;\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });
  const baselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const token = "displayTight: -0.6\nletterSpacing: letterSpacing.displayTight\nlabel: { letterSpacing: -0.2 }\ncenterValue: { letterSpacing: -0.5 }\noffTrack: '#D5DAE0'\nbackground: COLOR.status.cautionTint\nborder: COLOR.status.caution\nhall: COLOR.brand.primary\n";
  const app = 'const x = TYPE.display.fontSize;\n';
  put(root, 'apps/mobile/src/theme/tokens.ts', token);
  put(root, 'apps/mobile/src/A.tsx', app);
  const known = {
    schemaVersion: 1, stage: 'S3d', baselineCommit, expectedPendingDeclarationsResolved: 32,
    files: [
      { file: 'apps/mobile/src/A.tsx', sha256: sha(app) },
      { file: 'apps/mobile/src/theme/tokens.ts', sha256: sha(token) },
    ],
    requiredTokenSnippets: ['displayTight: -0.6', 'hall: COLOR.brand.primary'],
  };
  put(root, 'known.json', JSON.stringify(known));
  const run = () => spawnSync(process.execPath, [gate, `--root=${root}`, '--known=known.json'], { encoding: 'utf8' });
  return { root, known, run };
};

test('승인된 S3d 파일과 역할이면 통과한다', () => {
  const f = fixture();
  try { assert.equal(f.run().status, 0); } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('승인 밖 파일 변경은 실패한다', () => {
  const f = fixture();
  try { put(f.root, 'apps/mobile/src/B.tsx', 'const b = 1;\n'); assert.equal(f.run().status, 1); }
  finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('승인 파일 내용 변조는 실패한다', () => {
  const f = fixture();
  try { put(f.root, 'apps/mobile/src/A.tsx', 'const x = TYPE.display.fontSize + 1;\n'); assert.equal(f.run().status, 1); }
  finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('CRLF 체크아웃은 같은 내용으로 인정한다', () => {
  const f = fixture();
  try {
    const p = join(f.root, 'apps/mobile/src/A.tsx');
    put(f.root, 'apps/mobile/src/A.tsx', readFileSync(p, 'utf8').replace(/\n/g, '\r\n'));
    assert.equal(f.run().status, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test('필수 역할 토큰 누락은 실패한다', () => {
  const f = fixture();
  try {
    f.known.requiredTokenSnippets.push('missing.role');
    put(f.root, 'known.json', JSON.stringify(f.known));
    assert.equal(f.run().status, 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
