import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gate = fileURLToPath(new URL('./design-token-color-usage.mjs', import.meta.url));
const run = (source, expected = 0, baseline = 1, buttonSource = null) => {
  const dir = mkdtempSync(join(tmpdir(), 'color-usage-'));
  try {
    const app = join(dir, 'app'); mkdirSync(app);
    writeFileSync(join(app, 'A.tsx'), source);
    if (buttonSource !== null) {
      const kit = join(app, 'src', 'components', 'kit'); mkdirSync(kit, { recursive: true });
      writeFileSync(join(kit, 'Button.tsx'), buttonSource);
    }
    const known = join(dir, 'known.json');
    writeFileSync(known, JSON.stringify({
      baseline: { commit: 'x', totals: { ter: baseline, blue: 0, blueTint: 0, bluePressed: 0 }, perFile: { 'app/A.tsx': { ter: baseline, blue: 0, blueTint: 0, bluePressed: 0 } } },
      expectedTotals: { ter: expected, blue: 0, blueTint: 0, bluePressed: 0 },
      statusAliasExpectedTotals: { green: 0, greenTint: 0, amberText: 0, amberTint: 0, red: 0, redTint: 0 },
      ...(buttonSource === null ? {} : { buttonDisabledContract: { mode: 'variant-color-opacity', opacity: 0.4 } }),
    }));
    return spawnSync(process.execPath, [gate, `--root=${dir}`, `--app=${app}`, `--known=${known}`], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('옛 참조 0이면 통과한다', () => assert.equal(run('const x = COLOR.text.tertiary;').status, 0));
test('같은 파일에 옛 참조가 되살아나면 합계 래칫이 잡는다', () => assert.equal(run('const x = T.ter;').status, 1));
test('기준선보다 파일별 사용이 늘면 잡는다', () => assert.equal(run('const x = [T.ter, T.ter];', 2, 1).status, 1));
test('주석과 문자열은 참조로 세지 않는다', () => assert.equal(run('// T.ter\nconst s = "T.blue";').status, 0));
test('상태 팔레트 별칭이 늘면 잡는다', () => assert.equal(run('const x = T.red;').status, 1));
test('상호작용과 무관한 text.link 는 잡는다', () => assert.equal(run('const x = <Text style={{color: COLOR.text.link}}>값</Text>;').status, 1));
test('Pressable 안의 행동 text.link 는 허용한다', () => assert.equal(run('const x = <Pressable onPress={go}><Text style={{color: COLOR.text.link}}>관리</Text></Pressable>;').status, 0));
test('Button 비활성은 variant 고유색을 유지하고 공통 opacity 0.4를 쓴다', () => assert.equal(
  run('const x = 1;', 0, 1, "const x = { backgroundColor: c.bg, opacity: disabled ? 0.4 : 1 };" ).status, 0));
test('Button 비활성 opacity를 primary만 예외 처리하면 잡는다', () => assert.equal(
  run('const x = 1;', 0, 1, "const x = { opacity: disabled && kind !== 'primary' ? 0.4 : 1 };" ).status, 1));
