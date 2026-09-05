#!/usr/bin/env node
/**
 * 색 대비 게이트의 **음성 시험** — 저장소에 보존한다.
 *
 * 왜 파일로 남기나: 손으로 돌려 통과한 것은 증거가 아니다. 이 팀이 `W0` 에서 스스로 세운
 * 규칙 — "새로 넣은 검사마다 **실제로 FAIL 하는** 음성 시험 한 건이 저장소에 있어야 한다" —
 * 를 앱 게이트에도 적용한다(페이블 차단 2 · 솔 `F03`).
 *
 * 각 시험은 `tokens.ts` 사본을 한 군데만 변조해 게이트를 돌리고, **종료 코드가 1 인지**와
 * **이유가 맞는지**를 본다. 통과해 버리면 그 검사는 없는 것과 같다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const GATE = join(root, 'scripts', 'design-token-contrast.mjs');
const TOKENS = join(root, 'apps', 'mobile', 'src', 'theme', 'tokens.ts');
const CONTRACT = join(root, 'scripts', 'design-token-contract.json');

/** 변조본을 만들어 게이트를 돌린다. `edit` 이 null 이면 원본 그대로. */
const run = (edit, { contract = CONTRACT, extra = [], contractEdit = null } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'contrast-gate-'));
  try {
    const tok = join(dir, 'tokens.ts');
    let s = readFileSync(TOKENS, 'utf8');
    if (edit) {
      const before = s;
      s = edit(s);
      assert.notEqual(s, before, '변조가 적용되지 않았다 — 시험이 원본을 보고 있다');
    }
    writeFileSync(tok, s);
    let con = contract;
    if (contract === CONTRACT) {
      con = join(dir, 'contract.json');
      if (contractEdit) writeFileSync(con, JSON.stringify(contractEdit(JSON.parse(readFileSync(CONTRACT, 'utf8'))), null, 2));
      else copyFileSync(CONTRACT, con);
    }
    const r = spawnSync(process.execPath, [GATE, `--tokens=${tok}`,
      ...(con ? [`--contract=${con}`] : ['--contract=' + join(dir, '없는파일.json')]), ...extra],
      { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('원본은 통과한다 — 시험 자체가 항상 FAIL 하는 것이 아님을 먼저 보인다', () => {
  const r = run(null);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /색 대비 게이트 PASS/);
});

test('경계 4.499… — 반올림하면 4.50 이 되는 색은 **미달로 잡아야 한다**', () => {
  // #006FFB on #FFFFFF = 4.499888…  둘째 자리로 접으면 4.50 이라 옛 판정은 통과시켰다.
  const r = run(s => s.replace(/(action:\s*\{[\s\S]*?primary:\s*)'#[0-9A-Fa-f]{6}'/, "$1'#006FFB'"));
  assert.equal(r.code, 1, `반올림 전 원시값으로 판정하지 않는다\n${r.out}`);
  assert.match(r.out, /4\.50 — 글자 기준 4\.5 미달|action\.primary/);
});

test('표면 bg 를 한 톤 어둡게 하면 그 커밋에서 FAIL 한다', () => {
  const r = run(s => s.replace("bg: '#F2F4F6',", "bg: '#EEF0F3',"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /text\.tertiary .* 미달/);
});

test('text.link 를 정정 전 값으로 되돌리면 흰 표면 밖에서 잡힌다', () => {
  const r = run(s => s.replace(/(link:\s*)'#1465DB'/, "$1'#1470F5'"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /text\.link .* 미달/);
});

test('AA 는 통과하지만 확정값이 아닌 색으로 바꾸면 계약 대조가 잡는다', () => {
  // #0A5FD0 은 흰 글자 대비가 넉넉하다. 대비만 보면 통과하므로 **계약 대조**가 유일한 방어다.
  const r = run(s => s.replace(/(action:\s*\{[\s\S]*?primary:\s*)'#1470F5'/, "$1'#0A5FD0'"));
  assert.equal(r.code, 1, `확정값과 다른데 통과했다\n${r.out}`);
  assert.match(r.out, /계약 투영에 없다|다르다/);
});

test('action.primaryPressed 를 **AA 통과하는 다른 색**으로 바꿔도 잡는다', () => {
  // #0E5FD6 은 흰 글자 대비 5.79 로 넉넉히 통과한다. 대비만 보면 통과하므로
  // **이름→값 대조**가 유일한 방어다 — 예전 게이트는 이 자리를 통과시켰다.
  const r = run(s => s.replace(/(primaryPressed:\s*)'#1465DB'/, "$1'#0E5FD6'"));
  assert.equal(r.code, 1, `AA 는 통과하지만 확정값이 아닌데 통과했다\n${r.out}`);
  assert.match(r.out, /action\.primaryPressed 가 tokens\.ts/);
});

test('action.primaryPressed 를 저대비 색으로 바꾸면 대비로도 잡는다', () => {
  const r = run(s => s.replace(/(primaryPressed:\s*)'#1465DB'/, "$1'#7FB0FF'"));
  assert.equal(r.code, 1, r.out);
});

test('brand.primary 를 action.primary 와 같게 만들면 결정 2-4 위반으로 잡는다', () => {
  const r = run(s => s.replace(/(brand:\s*\{[\s\S]*?primary:\s*)'#3182F6'/, "$1'#1470F5'"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /결정 2-4/);
});

test('T.blueTint 만 바꾸면 결정 2-4 의 tint 고정 위반으로 잡는다', () => {
  const r = run(s => s.replace("blueTint: '#EBF3FE',", "blueTint: '#E9F1FF',"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /blueTint/);
});

test('myHubTile.label 을 tint 위 4.03 인 색으로 바꾸면 잡는다', () => {
  const r = run(s => s.replace(/(label:\s*)'#1465DB'/, "$1'#1470F5'"));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /myHubTile\.label/);
});

test('계약 투영이 없으면 기본 verify 에서는 FAIL 한다', () => {
  const r = run(null, { contract: null });
  assert.equal(r.code, 1, `계약 파일이 사라졌는데 조용히 통과했다\n${r.out}`);
  assert.match(r.out, /계약 투영을 찾을 수 없다/);
});

test('계약 투영 부재는 --allow-missing-contract 로만 면제된다', () => {
  const r = run(null, { contract: null, extra: ['--allow-missing-contract=1'] });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /명시 면제/);
});

test('계약에만 있는 낡은 조합을 게이트가 잡는다', () => {
  const r = run(null, { contractEdit: (c) => { c.combos.push({ 역할: '없는 조합', fg: '#000000', bg: '#FFFFFF', kind: 'text' }); return c; } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /게이트가 재지 않는다/);
});

test('계약에서 조합을 지우면 게이트가 잡는다', () => {
  const r = run(null, { contractEdit: (c) => { c.combos = c.combos.slice(0, -1); return c; } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /계약 투영에 없다/);
});

test('계약 roles 에서 이름을 지우면 잡는다', () => {
  const r = run(null, { contractEdit: (c) => { delete c.roles['action.primaryPressed']; return c; } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /roles 에 없다/);
});

// ── 별칭 래칫 ────────────────────────────────────────────────────────────────
// 임시 앱 트리를 만들어 사용처 수를 직접 정하고, 양방향으로 FAIL 하는지 본다.
const runAlias = (usages, baseline) => {
  const dir = mkdtempSync(join(tmpdir(), 'alias-'));
  try {
    const app = join(dir, 'src'); mkdirSync(app, { recursive: true });
    const body = Array.from({ length: usages }, (_, i) => `const s${i} = [box, cardShadow];`).join('\n');
    writeFileSync(join(app, 'Sample.tsx'), `import { cardShadow } from '@/theme/tokens';\n// cardShadow 주석은 사용처가 아니다\n${body}\n`);
    const con = join(dir, 'contract.json'); copyFileSync(CONTRACT, con);
    const tok = join(dir, 'tokens.ts'); copyFileSync(TOKENS, tok);
    const r = spawnSync(process.execPath, [GATE, `--tokens=${tok}`, `--contract=${con}`, `--app=${app}`, `--alias-baseline=${baseline}`], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('별칭 사용처가 기준과 같으면 통과한다', () => {
  const r = runAlias(2, 2);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /별칭 사용처 2곳 — 기준과 같다/);
});

test('별칭 사용처가 늘면 FAIL 한다 — 새 화면이 별칭을 새로 쓰는 것을 막는다', () => {
  const r = runAlias(3, 2);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /늘었다/);
});

test('별칭 사용처가 줄면 FAIL 한다 — 치환했으면 기준도 함께 낮춘다', () => {
  const r = runAlias(1, 2);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /줄었다/);
});

test('주석과 import 는 사용처로 세지 않는다', () => {
  const r = runAlias(0, 0);   // 파일에 주석 1줄 + import 1줄만 남는다
  assert.equal(r.code, 0, `주석이나 import 를 사용처로 셌다\n${r.out}`);
});

// ── 봉인 (솔 검수 `R3 F03`) ──────────────────────────────────────────────────
// 계약을 앱 쪽에 둔 것만으로는 **토큰과 계약을 같이 고치면 조용히 통과한다.** 위 대조는
// 둘이 서로 같은지만 보기 때문이다. 아래 첫 시험이 정확히 그 자리를 친다.
const SEAL = join(root, 'scripts', 'design-token-seal.json');
const DECISION = join(root, 'docs', '디자인-토큰-3계층-값-매핑-기획서.md');

test('토큰과 계약을 **함께** 바꾸고 봉인을 그대로 두면 FAIL 한다 — 봉인이 없으면 통과했을 자리다', () => {
  const r = run(
    s => s.replace(/(primaryPressed:\s*)'#1465DB'/, "$1'#0E5FD6'"),
    { contractEdit: (c) => { c.roles['action.primaryPressed'] = '#0E5FD6'; return c; } },
  );
  assert.equal(r.code, 1, `토큰과 계약을 함께 고쳤는데 통과했다 — 봉인이 작동하지 않는다\n${r.out}`);
  assert.match(r.out, /색 역할 값이 봉인과 다르다/);
  assert.doesNotMatch(r.out, /가 tokens\.ts\(.*\) 와 계약 투영/,
    '이 시험은 계약 대조가 아니라 **봉인**이 잡는 것을 보여야 한다');
});

test('봉인이 없으면 FAIL 한다', () => {
  const r = run(null, { extra: [`--seal=${join(root, 'scripts', '없는봉인.json')}`] });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /봉인을 찾을 수 없다/);
});

test('봉인 부재는 --allow-missing-seal 로만 면제된다', () => {
  const r = run(null, { extra: [`--seal=${join(root, 'scripts', '없는봉인.json')}`, '--allow-missing-seal'] });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /명시 면제/);
});

/** 봉인을 한 군데만 고친 사본으로 돌린다. */
const runSeal = (edit, { decision = null } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'seal-'));
  try {
    const s = JSON.parse(readFileSync(SEAL, 'utf8'));
    const seal = join(dir, 'seal.json');
    writeFileSync(seal, JSON.stringify(edit(s), null, 2));
    const tok = join(dir, 'tokens.ts'); copyFileSync(TOKENS, tok);
    const con = join(dir, 'contract.json'); copyFileSync(CONTRACT, con);
    const extra = [`--seal=${seal}`];
    if (decision) { const d = join(dir, 'decision.md'); writeFileSync(d, decision(readFileSync(DECISION, 'utf8'))); extra.push(`--decision=${d}`); }
    const r = spawnSync(process.execPath, [GATE, `--tokens=${tok}`, `--contract=${con}`, ...extra], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('봉인 사본 그대로면 통과한다 — 봉인 시험이 항상 FAIL 하는 것이 아님을 보인다', () => {
  const r = runSeal(s => s);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /봉인 일치/);
});

test('결정문 §8.2 구간이 바뀌면 FAIL 한다 — 값만 묶고 근거를 안 묶으면 반쪽이다', () => {
  const r = runSeal(s => s, { decision: (t) => t.replace('### 8.2c 부록', '### 8.2c 부록(고침)') });
  assert.equal(r.code, 1, `결정문 변조를 놓쳤다\n${r.out}`);
  assert.match(r.out, /결정문 §8\.2 구간이 봉인과 다르다/);
});

test('결정문 §8.2 밖의 산문이 바뀌어도 통과한다 — 게이트가 산문마다 울면 아무도 안 고친다', () => {
  const r = runSeal(s => s, { decision: (t) => t.replace('## 9. 알려진 측정기 한계', '## 9. 알려진 측정기 한계(문장 다듬음)') });
  assert.equal(r.code, 0, r.out);
});

test('봉인에서 역할해시를 지우면 FAIL 한다', () => {
  const r = runSeal(s => { delete s.봉인.역할해시; return s; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /봉인에 역할해시가 없다/);
});

test('봉인에서 결정 커밋을 비우면 FAIL 한다 — 어느 커밋의 결정인지 추적할 수 없다', () => {
  const r = runSeal(s => { s.결정.커밋 = []; return s; });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /결정 커밋이 없다/);
});
