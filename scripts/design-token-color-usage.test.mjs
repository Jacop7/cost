import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gate = fileURLToPath(new URL('./design-token-color-usage.mjs', import.meta.url));
const run = (source, expected = 0, baseline = 1) => {
  const dir = mkdtempSync(join(tmpdir(), 'color-usage-'));
  try {
    const app = join(dir, 'app'); mkdirSync(app);
    writeFileSync(join(app, 'A.tsx'), source);
    const known = join(dir, 'known.json');
    writeFileSync(known, JSON.stringify({ baseline: { commit: 'x', totals: { ter: baseline, blue: 0, blueTint: 0, bluePressed: 0 }, perFile: { 'app/A.tsx': { ter: baseline, blue: 0, blueTint: 0, bluePressed: 0 } } }, expectedTotals: { ter: expected, blue: 0, blueTint: 0, bluePressed: 0 } }));
    return spawnSync(process.execPath, [gate, `--root=${dir}`, `--app=${app}`, `--known=${known}`], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('옛 참조 0이면 통과한다', () => assert.equal(run('const x = COLOR.text.tertiary;').status, 0));
test('같은 파일에 옛 참조가 되살아나면 합계 래칫이 잡는다', () => assert.equal(run('const x = T.ter;').status, 1));
test('기준선보다 파일별 사용이 늘면 잡는다', () => assert.equal(run('const x = [T.ter, T.ter];', 2, 1).status, 1));
test('주석과 문자열은 참조로 세지 않는다', () => assert.equal(run('// T.ter\nconst s = "T.blue";').status, 0));
