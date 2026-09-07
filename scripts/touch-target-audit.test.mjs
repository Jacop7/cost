#!/usr/bin/env node
/** 터치 영역 래칫의 음성 시험 — 양방향으로 실제 FAIL 하는지 본다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const AUDIT = join(root, 'scripts', 'touch-target-audit.mjs');
const KNOWN = join(root, 'scripts', 'touch-target-known.json');

/**
 * 감사를 한 번 돌려 **입력해시**를 얻는다. 알려진 목록은 이 값으로 결속되므로(솔 `R4` 질문 3)
 * 시험도 실제 사용과 같은 순서를 밟는다 — 재고, 그 입력에 목록을 매고, 다시 잰다.
 */
const probeHash = (src, dir) => {
  const o = join(dir, 'probe.json');
  spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${join(dir, '없는목록.json')}`, `--out=${o}`], { encoding: 'utf8' });
  return JSON.parse(readFileSync(o, 'utf8')).manifest.측정.제품입력해시;
};

const runWith = ({ tsx, known, args = [], tokens = null }) => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-'));
  try {
    const src = join(dir, 'src'); mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Sample.tsx'), tsx);
    if (tokens) {
      const theme = join(src, 'src', 'theme'); mkdirSync(theme, { recursive: true });
      writeFileSync(join(theme, 'tokens.ts'), tokens);
    }
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ 제품입력해시: probeHash(src, dir), unjudged: [], parentUnjudged: [], siblingOverlaps: [],
      siblingUnjudged: [], components: [], buttonDynamic: [], ...known }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`, ...args], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

const OK = `<View style={{ minWidth: 44, minHeight: 44 }}><Pressable onPress={f} hitSlop={5} style={{ width: 34, height: 34 }}><I/></Pressable></View>`;
const BAD = `<Pressable onPress={f} style={{ width: 40, height: 40 }}><I/></Pressable>`;
const FAB = `<Pressable onPress={f} style={{ paddingVertical: 14, shadowOffset: { width: 0, height: 6 } }}><I/></Pressable>`;

test('34 + 2×5 = 44 는 통과한다', () => {
  const r = runWith({ tsx: OK, known: { entries: [] } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /통과 1/);
});

test('목록에 없는 새 미달은 FAIL 한다', () => {
  const r = runWith({ tsx: BAD, known: { entries: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /새 미달/);
});

test('고쳐졌는데 목록에 남아 있으면 FAIL 한다 — 래칫은 양방향이다', () => {
  const r = runWith({ tsx: OK, known: { entries: [{ at: 'Sample.tsx:1', 사유: '옛 미달' }] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /해결됨/);
});

test('shadowOffset 의 width·height 를 상자 크기로 읽지 않는다', () => {
  const r = runWith({ tsx: FAB, known: { entries: [], unjudged: [] } });
  // 판정불가로 빠져야 한다 — 0×6 미달로 읽으면 오독이다.
  assert.match(r.out, /판정불가 1/, r.out);
  assert.doesNotMatch(r.out, /0×6/, `shadowOffset 을 상자로 오독했다\n${r.out}`);
});

test('객체형 hitSlop 은 축마다 따로 더한다', () => {
  const tsx = `<View style={{ minWidth: 44, minHeight: 44 }}><Pressable onPress={f} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }} style={{ width: 20, height: 20 }}><I/></Pressable></View>`;
  // 세로 20+24=44 통과 · 가로 20+4=24 미달 → 미달로 잡혀야 한다
  const r = runWith({ tsx, known: { entries: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /유효 24×44/);
});

test('점 없는 최상위 숫자 토큰도 width·height로 읽는다', () => {
  const tsx = `<Pressable onPress={f} style={{ width: minTouchTarget, height: minTouchTarget }}><I/></Pressable>`;
  const r = runWith({ tsx, tokens: `export const minTouchTarget = 44;`, known: { entries: [] } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /통과 1/);
});

test('부모 minHeight 38 안의 32 + 2×6은 44가 아니라 38로 잘려 미달이다', () => {
  const tsx = `<View style={{ minWidth: 44, minHeight: 38 }}><Pressable onPress={f} hitSlop={6} style={{ width: 32, height: 32 }}><I/></Pressable></View>`;
  const r = runWith({ tsx, known: { entries: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /유효 44×38/);
});

test('같은 부모 이웃 pressable 의 안쪽 hitSlop 이 gap 절반을 넘으면 FAIL 한다', () => {
  const tsx = `<View style={{ flexDirection: 'row', gap: 4 }}><Pressable onPress={a} hitSlop={{ left: 2, right: 3 }} style={{ width: 40, height: 44 }}/><Pressable onPress={b} hitSlop={{ left: 3, right: 2 }} style={{ width: 40, height: 44 }}/></View>`;
  const r = runWith({ tsx, known: { entries: [], siblingOverlaps: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /새 형제 중첩 위험/);
});

test('같은 부모 이웃 pressable 의 안쪽 hitSlop 이 gap 절반 이하면 통과한다', () => {
  const tsx = `<View style={{ flexDirection: 'row', gap: 4, minWidth: 100, minHeight: 44 }}><Pressable onPress={a} hitSlop={{ left: 2, right: 2 }} style={{ width: 40, height: 44 }}/><Pressable onPress={b} hitSlop={{ left: 2, right: 2 }} style={{ width: 40, height: 44 }}/></View>`;
  const r = runWith({ tsx, known: { entries: [], siblingOverlaps: [] } });
  assert.equal(r.code, 0, r.out);
});

test('삼항 JSX 안의 pressable도 바깥 형제와 중첩되면 FAIL 한다', () => {
  const tsx = `<View style={{ flexDirection: 'row', gap: 4 }}>{cond ? <Pressable onPress={a} hitSlop={{ right: 3 }} style={{ width: 40, height: 44 }}/> : null}<Pressable onPress={b} hitSlop={{ left: 3 }} style={{ width: 40, height: 44 }}/></View>`;
  const r = runWith({ tsx, known: { entries: [], siblingOverlaps: [], siblingUnjudged: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /새 형제 중첩 위험/);
});

test('동적 부모 style은 gap 0으로 가정하지 않고 형제판정불가로 래칫한다', () => {
  const tsx = `<View style={[styles.row, compact && styles.compact]}><Pressable onPress={a} hitSlop={3} style={{ width: 40, height: 44 }}/><Pressable onPress={b} hitSlop={3} style={{ width: 40, height: 44 }}/></View>`;
  const r = runWith({ tsx, known: { entries: [], siblingOverlaps: [], siblingUnjudged: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /새 형제판정불가/);
});

test('.map()이 반환하는 pressable의 반복 인접 관계도 검사한다', () => {
  const tsx = `<View style={{ flexDirection: 'row', gap: 4 }}>{items.map((item) => <Pressable key={item.id} onPress={f} hitSlop={3} style={{ width: 40, height: 44 }}/>)}</View>`;
  const r = runWith({ tsx, known: { entries: [], siblingOverlaps: [], siblingUnjudged: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /새 형제 중첩 위험/);
});

test('typescript 의존성이 없으면 설치 명령을 먼저 안내한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-nodeps-'));
  try {
    const audit = join(dir, 'touch-target-audit.mjs');
    copyFileSync(AUDIT, audit);
    const r = spawnSync(process.execPath, [audit], { encoding: 'utf8' });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    assert.equal(r.status, 2, out);
    assert.match(out, /corepack pnpm install --frozen-lockfile/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('저장소의 알려진 목록은 지금 실제와 맞는다', () => {
  const r = spawnSync(process.execPath, [AUDIT], { encoding: 'utf8' });
  assert.equal(r.status, 0, (r.stdout ?? '') + (r.stderr ?? ''));
  const known = JSON.parse(readFileSync(KNOWN, 'utf8'));
  assert.equal(known.entries.length, 0, '직접 부모 clipping으로 확인된 선언상 미달은 보정 뒤 0이어야 한다');
  assert.equal(known.siblingOverlaps.length, 0, '같은 부모 형제 중첩 위험은 S4에서 해소되어야 한다');
  assert.equal(known.siblingUnjudged.length, 12, '동적 형제 구조와 계약표에 없는 공용 조작 컴포넌트는 0으로 가정하지 말고 판정불가로 남겨야 한다');
});

test('판정불가도 래칫한다 — 목록에 없는 새 판정불가는 FAIL', () => {
  const tsx = `<Pressable onPress={f} style={{ paddingVertical: 10 }}><I/></Pressable>`;
  const r = runWith({ tsx, known: { entries: [], unjudged: [] } });
  assert.equal(r.code, 1, `판정불가가 래칫 밖이다\n${r.out}`);
  assert.match(r.out, /새 판정불가/);
});

test('판정불가 목록 자체가 없으면 FAIL — 래칫이 꺼진 것을 조용히 넘기지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-'));
  try {
    const src = join(dir, 'src'); mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'S.tsx'), OK);
    const k = join(dir, 'known.json'); writeFileSync(k, JSON.stringify({ entries: [] }));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    assert.equal(r.status, 1, (r.stdout ?? '') + (r.stderr ?? ''));
    assert.match((r.stdout ?? '') + (r.stderr ?? ''), /판정불가 목록이 없다/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('알려진 미달이 **더 나빠지면** FAIL — 존재만 비교하지 않는다', () => {
  // 자리 이름(at)은 실행 경로에 달렸으므로 **같은 임시 디렉터리에서** 두 번 돌린다.
  const dir = mkdtempSync(join(tmpdir(), 'touch-'));
  try {
    const src = join(dir, 'src'); mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Sample.tsx'), `<Pressable onPress={f} hitSlop={2} style={{ width: 30, height: 30 }}><I/></Pressable>`);
    const k = join(dir, 'known.json');
    const go = () => { const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
      return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }; };
    writeFileSync(k, JSON.stringify({ entries: [], unjudged: [], parentUnjudged: [], components: [] }));
    const first = go();
    const at = (first.out.match(/새 미달 — (\S+)/) ?? [])[1];
    assert.ok(at, `자리 이름을 못 읽었다\n${first.out}`);
    // 목록에는 42×42 로 적혀 있는데 실제는 34×34 다
    writeFileSync(k, JSON.stringify({ entries: [{ at, 유효: '42×42', 사유: '옛 값' }], unjudged: [], parentUnjudged: [], components: [] }));
    const r = go();
    assert.equal(r.code, 1, `유효 크기 악화를 놓쳤다\n${r.out}`);
    assert.match(r.out, /악화/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const BUTTON_TSX = `
type Size = 'sm' | 'md' | 'lg';
export function Button({ children, kind = 'primary', size = 'md', full }: Props) {
  const sizes: Record<Size, { pv: number; ph: number; fs: number; r: number; hs: number }> = {
    sm: { pv: 8, ph: 12, fs: 14, r: 9, hs: 7 },
    md: { pv: 13, ph: 16, fs: 16, r: 12, hs: 1 },
    lg: { pv: 16, ph: 18, fs: 17, r: 14, hs: 0 },
  };
  const s = sizes[size];
  return <Pressable hitSlop={{ top: s.hs, bottom: s.hs }} style={[base, style]} />;
}
`;

/** `Button.tsx` 가 있는 가짜 앱을 만든다 — 공용 컴포넌트 계약과 소비처 세기를 시험한다. */
const runButton = ({ consumers = '', known = {}, args = [], button = BUTTON_TSX }) => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-btn-'));
  try {
    const src = join(dir, 'src');
    mkdirSync(join(src, 'src', 'components', 'kit'), { recursive: true });
    writeFileSync(join(src, 'src', 'components', 'kit', 'Button.tsx'), button);
    writeFileSync(join(src, 'Consumers.tsx'), consumers);
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ 제품입력해시: probeHash(src, dir), entries: [], unjudged: [], parentUnjudged: [], siblingOverlaps: [],
      siblingUnjudged: [], components: [], buttonDynamic: [], ...known }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`, ...args], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

/** 시험용 계약 — 세 variant 를 다 올려 둔다. `at` 은 시험마다 덮어쓴다. */
const contracts = (at) => [
  { 컴포넌트: 'Button size="sm"', 판정: '부모판정불가', 높이하한: 44, 소비처: (at.sm ?? []).length, at: at.sm ?? [] },
  { 컴포넌트: 'Button size="md"', 판정: '부모판정불가', 높이하한: 44, 소비처: (at.md ?? []).length, at: at.md ?? [] },
  { 컴포넌트: 'Button size="lg"', 판정: '통과', 높이하한: 49, 소비처: (at.lg ?? []).length, at: at.lg ?? [] },
];

test('공용 컴포넌트 계약 — hitSlop 의존 variant는 부모 실측 전 통과로 닫지 않는다', () => {
  const r = runButton({ known: { components: contracts({}) } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Button size="sm" 높이 하한 44 → 부모판정불가/);
  assert.match(r.out, /Button size="md" 높이 하한 44 → 부모판정불가/);
  assert.match(r.out, /Button size="lg" 높이 하한 49 → 통과/);
});

test('Button variant hitSlop 연결이 빠지면 통과 계약을 재현하지 못한다', () => {
  const button = BUTTON_TSX.replace('hitSlop={{ top: s.hs, bottom: s.hs }} ', '');
  const r = runButton({ button, known: { components: contracts({}) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Button size="sm" 판정이 부모판정불가 → 경계/);
});

test('Button sm hitSlop이 6으로 줄면 유효 하한 44 미달을 잡는다', () => {
  const button = BUTTON_TSX.replace('r: 9, hs: 7', 'r: 9, hs: 6');
  const r = runButton({ button, known: { components: contracts({}) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Button size="sm" 높이 하한이 44 → 42/);
});

test('Button 소비처가 높이를 덮으면 variant hitSlop 통과를 닫지 않는다', () => {
  const consumers = `<Button size="sm" onPress={f} style={{ height: 20 }}>A</Button>`;
  const r = runButton({ consumers, known: { components: contracts({ sm: ['src/Consumers.tsx:1'] }) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Button size="sm" 판정이 부모판정불가 → 경계/);
});

test('인접 sm Button의 사방 hitSlop 회귀를 형제 중첩으로 잡는다', () => {
  const button = BUTTON_TSX.replace('hitSlop={{ top: s.hs, bottom: s.hs }}', 'hitSlop={s.hs}');
  const consumers = `<View style={{ flexDirection: 'row', gap: 8 }}><Button size="sm" onPress={a}>발주 취소</Button><Button size="sm" onPress={b}>입고 완료</Button></View>`;
  const r = runButton({ button, consumers, known: { components: contracts({ sm: ['src/Consumers.tsx:1', 'src/Consumers.tsx:1'] }) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /새 형제 중첩 위험/);
});

test('계약표에 없는 공용 조작 컴포넌트 형제는 무판정 통과하지 않는다', () => {
  const consumers = `<View style={{ flexDirection: 'row', gap: 8 }}><Action onPress={a}/><Action onPress={b}/></View>`;
  const r = runButton({ consumers, known: { components: contracts({}) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /새 형제판정불가/);
});

test('여러 줄로 나뉜 여는 태그의 size 도 읽는다 — 줄 단위 정규식이 놓치던 자리다', () => {
  const tsx = `
<Button
  kind="ghost"
  size="sm"
  onPress={f}
>눌러</Button>`;
  const r = runButton({ tsx: undefined, consumers: tsx, known: { components: contracts({ sm: ['src/Consumers.tsx:2'] }) } });
  assert.equal(r.code, 0, `여러 줄 태그의 size="sm" 을 못 읽었다\n${r.out}`);
  assert.match(r.out, /Button size="sm" .* 소비처 1곳/);
});

test('size 를 안 쓴 자리는 Button.tsx 의 기본값으로 배정된다', () => {
  const r = runButton({ consumers: `<Button onPress={f}>저장</Button>`, known: { components: contracts({ md: ['src/Consumers.tsx:1'] }) } });
  assert.equal(r.code, 0, `기본값 md 배정을 못 했다\n${r.out}`);
  assert.match(r.out, /Button size="md" .* 소비처 1곳/);
});

test('기본값을 Button.tsx 에서 못 읽으면 읽기실패다 — 조용히 md 로 가정하지 않는다', () => {
  const r = runButton({ button: BUTTON_TSX.replace("size = 'md', ", ''), known: { components: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /읽기실패/);
});

test('경계 variant 의 소비처가 늘면 FAIL — 열린 위험이 조용히 퍼지는 것을 막는다', () => {
  const button = BUTTON_TSX.replace('r: 9, hs: 7', 'r: 9, hs: 6');
  const open = contracts({ sm: ['src/Consumers.tsx:1'] }).map((item) => item.컴포넌트 === 'Button size="sm"'
    ? { ...item, 판정: '경계', 높이하한: 42 } : item);
  const r = runButton({
    button,
    consumers: `<Button size="sm" onPress={f}>A</Button>\n<Button size="sm" onPress={g}>B</Button>`,
    known: { components: open },
  });
  assert.equal(r.code, 1, `소비처 증가를 놓쳤다\n${r.out}`);
  assert.match(r.out, /새 Button size="sm" 소비처/);
  assert.match(r.out, /소비처가 1 → 2곳으로 바뀌었다/);
});

test('통과 variant의 소비처 증가는 열린 위험이 아니므로 실패시키지 않는다', () => {
  const r = runButton({
    consumers: `<Button size="lg" onPress={f}>A</Button>\n<Button size="lg" onPress={g}>B</Button>`,
    known: { components: contracts({ lg: ['src/Consumers.tsx:1'] }) },
  });
  assert.equal(r.code, 0, r.out);
});

test('size 가 변수·spread 면 동적으로 세고 따로 래칫한다', () => {
  const r = runButton({
    consumers: `<Button size={sz} onPress={f}>A</Button>\n<Button {...rest}>B</Button>`,
    known: { components: contracts({}) },
  });
  assert.equal(r.code, 1, `동적 size 소비처 증가를 놓쳤다\n${r.out}`);
  assert.match(r.out, /새 동적 size 소비처/);
  assert.match(r.out, /Button size 동적\/spread 2곳/);
});

test('알려진 동적 목록이 아예 없으면 FAIL — 래칫이 꺼진 것을 넘기지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-dyn-'));
  try {
    const src = join(dir, 'src');
    mkdirSync(join(src, 'src', 'components', 'kit'), { recursive: true });
    writeFileSync(join(src, 'src', 'components', 'kit', 'Button.tsx'), BUTTON_TSX);
    writeFileSync(join(src, 'Consumers.tsx'), '');
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ entries: [], unjudged: [], parentUnjudged: [], components: contracts({}) }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    assert.equal(r.status, 1, out);
    assert.match(out, /알려진 동적 size 소비처 목록이 없다/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--expect-commit 이 어긋나면 FAIL — 작업 트리에서 잰 수치를 커밋 증거로 쓰지 못하게 한다', () => {
  const r = runButton({ known: { components: contracts({}) }, args: ['--expect-commit=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'] });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /측정 커밋 불일치|커밋으로 해석할 수 없다/);
});

// ── 결속 우회 (솔 검수 `R4 F01`) ─────────────────────────────────────────────
// 초판은 `head.startsWith(want) || want.startsWith(head)` 였다. 빈 문자열은 **모든** SHA 의
// 접두사이므로 값 없는 깃발이 통과했고, `<전체SHA>garbage` 는 뒤쪽 조건으로 통과했다.
const onRepo = (args) => {
  const r = spawnSync(process.execPath, [AUDIT, ...args], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
};
const HEAD_SHA = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();

test('값 없는 --expect-commit 은 거부한다 — 빈 문자열은 모든 SHA 의 접두사다', () => {
  const r = onRepo(['--expect-commit']);
  assert.equal(r.code, 1, `값 없는 깃발이 결속을 통과했다\n${r.out}`);
  assert.match(r.out, /커밋 SHA 가 아니다/);
});

test('전체 SHA 뒤에 군더더기가 붙으면 거부한다 — startsWith 우회를 막는다', () => {
  const r = onRepo([`--expect-commit=${HEAD_SHA}zz`]);
  assert.equal(r.code, 1, `suffix 가 붙은 값이 통과했다\n${r.out}`);
  assert.match(r.out, /커밋 SHA 가 아니다/);
});

test('7자 미만의 짧은 SHA 는 거부한다', () => {
  const r = onRepo(['--expect-commit=abc']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /커밋 SHA 가 아니다/);
});

test('해석되지 않는 SHA 는 거부한다 — 없는 개체이거나 모호한 짧은 SHA', () => {
  const r = onRepo(['--expect-commit=0000000']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /커밋으로 해석할 수 없다/);
});

test('다른 커밋의 SHA 를 대면 불일치로 FAIL 한다 — 전체 SHA 로 해석해 완전 일치만 통과', () => {
  const parent = spawnSync('git', ['rev-parse', 'HEAD~1'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const r = onRepo([`--expect-commit=${parent}`]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /측정 커밋 불일치/);
});

test('제품입력해시가 목록과 다르면 FAIL 한다 — 목록이 어느 입력에서 나왔는지 결속한다', () => {
  const r = runButton({ known: { 제품입력해시: 'f'.repeat(64), components: contracts({}) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /제품 감사 입력이 바뀌었다/);
});

test('제품입력해시가 아예 없으면 FAIL 한다 — 결속이 꺼진 것을 조용히 넘기지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-nohash-'));
  try {
    const src = join(dir, 'src');
    mkdirSync(join(src, 'src', 'components', 'kit'), { recursive: true });
    writeFileSync(join(src, 'src', 'components', 'kit', 'Button.tsx'), BUTTON_TSX);
    writeFileSync(join(src, 'Consumers.tsx'), '');
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ entries: [], unjudged: [], parentUnjudged: [], components: contracts({}), buttonDynamic: [] }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    assert.equal(r.status, 1, out);
    assert.match(out, /알려진 제품입력해시가 없다/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('시험 fixture 의 <Button> 은 제품 소비처와 섞지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-split-'));
  try {
    const src = join(dir, 'src');
    mkdirSync(join(src, 'src', 'components', 'kit'), { recursive: true });
    mkdirSync(join(src, 'tests'), { recursive: true });
    writeFileSync(join(src, 'src', 'components', 'kit', 'Button.tsx'), BUTTON_TSX);
    writeFileSync(join(src, 'Consumers.tsx'), `<Button size="sm" onPress={f}>A</Button>`);
    writeFileSync(join(src, 'tests', 'smoke.test.tsx'), `<Button size="sm" onPress={f}>시험</Button>`);
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ 제품입력해시: probeHash(src, dir), entries: [], unjudged: [], parentUnjudged: [], siblingOverlaps: [], siblingUnjudged: [], buttonDynamic: [],
      components: contracts({ sm: ['src/Consumers.tsx:1'] }) }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    assert.equal(r.status, 0, `시험 fixture 가 제품 재고에 섞였다\n${out}`);
    assert.match(out, /Button size="sm" .* 제품 소비처 1곳 · 시험 참조 1곳/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('저장소를 그대로 재면 작업 트리 상태가 산출물에 남는다 — 결속 없이 인용하지 말라고 적는다', () => {
  const r = spawnSync(process.execPath, [AUDIT], { encoding: 'utf8' });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert.equal(r.status, 0, out);
  assert.match(out, /측정 — 커밋 [0-9a-f]{12} · 작업 트리 /);
  assert.match(out, /결속 없음 — 이 산출물을 커밋 증거로 인용하지 마라/);
});

// ── 제품/시험 해시 분리 (솔 검수 `R5 F02`) ───────────────────────────────────
// "시험 fixture 를 고쳐도 제품 재고가 흔들리면 안 된다" 고 적어 놓고 두 범위를 한 해시에
// 묶어 두면 앞뒤가 맞지 않는다. 아래 두 시험이 그 경계를 지킨다.
const withTestFixture = (fixture, known) => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-hash-'));
  try {
    const src = join(dir, 'src');
    mkdirSync(join(src, 'src', 'components', 'kit'), { recursive: true });
    mkdirSync(join(src, 'tests'), { recursive: true });
    writeFileSync(join(src, 'src', 'components', 'kit', 'Button.tsx'), BUTTON_TSX);
    writeFileSync(join(src, 'Consumers.tsx'), `<Button size="sm" onPress={f}>A</Button>`);
    writeFileSync(join(src, 'tests', 'smoke.test.tsx'), fixture);
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ 제품입력해시: probeHash(src, dir), entries: [], unjudged: [], parentUnjudged: [], siblingOverlaps: [], siblingUnjudged: [],
      buttonDynamic: [], components: contracts({ sm: ['src/Consumers.tsx:1'] }), ...known }, null, 2));
    // 목록을 만든 뒤 시험 fixture 만 고친다.
    writeFileSync(join(src, 'tests', 'smoke.test.tsx'), fixture + '\n// 시험만 한 줄 고쳤다\n');
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('시험 fixture 를 고쳐도 제품 래칫은 흔들리지 않는다', () => {
  const r = withTestFixture(`<Button size="sm" onPress={f}>시험</Button>`, {});
  assert.equal(r.code, 0, `시험 fixture 변경이 제품 재고를 흔들었다\n${r.out}`);
});

test('제품 .tsx 를 고치면 제품 래칫이 깨진다 — 경계가 한쪽으로만 열려 있지 않다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-hash2-'));
  try {
    const src = join(dir, 'src');
    mkdirSync(join(src, 'src', 'components', 'kit'), { recursive: true });
    writeFileSync(join(src, 'src', 'components', 'kit', 'Button.tsx'), BUTTON_TSX);
    writeFileSync(join(src, 'Consumers.tsx'), `<Button size="sm" onPress={f}>A</Button>`);
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ 제품입력해시: probeHash(src, dir), entries: [], unjudged: [], parentUnjudged: [], siblingOverlaps: [], siblingUnjudged: [],
      buttonDynamic: [], components: contracts({ sm: ['src/Consumers.tsx:1'] }) }, null, 2));
    writeFileSync(join(src, 'Consumers.tsx'), `<Button size="sm" onPress={f}>A</Button>\n// 제품 코드를 고쳤다\n`);
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    assert.equal(r.status, 1, `제품 변경을 놓쳤다\n${out}`);
    assert.match(out, /제품 감사 입력이 바뀌었다/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// 줄끝 독립 (페이블 검수 R6 차단)
// 내용 sha256 으로 재던 초판은 **줄끝을 쟀다.** 페이블의 Windows clean checkout(CRLF)과
// Linux 체크아웃(LF)에서 제품 해시가 갈렸고, 결속이 "이후 무변경" 이 아니라 "어느 OS 에서
// 받았나" 를 재고 있었다. blob SHA 는 CRLF→LF 정규화 뒤 계산하므로 같은 내용이면 같은 값이다.
const hashFor = (eol) => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-eol-'));
  try {
    const src = join(dir, 'src');
    mkdirSync(join(src, 'src', 'components', 'kit'), { recursive: true });
    const put = (p, t) => writeFileSync(p, eol === 'crlf' ? t.replace(/\n/g, '\r\n') : t);
    put(join(src, 'src', 'components', 'kit', 'Button.tsx'), BUTTON_TSX);
    put(join(src, 'Consumers.tsx'), '<Button size="sm" onPress={f}>A</Button>\n');
    return probeHash(src, dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('같은 내용을 CRLF 로 바꿔도 제품입력해시가 같다 — 결속이 줄끝을 재지 않는다', () => {
  assert.equal(hashFor('crlf'), hashFor('lf'),
    'CRLF 체크아웃과 LF 체크아웃의 해시가 갈린다 — 결속이 OS 를 재고 있다');
});

test('blob SHA 계산이 git hash-object 와 같다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-blob-'));
  try {
    const f = join(dir, 'a.tsx');
    const body = 'const a = 1;\nconst b = 2;\n';
    writeFileSync(f, body);
    const buf = Buffer.from(body, 'utf8');
    const mine = createHash('sha1')
      .update(Buffer.concat([Buffer.from('blob ' + buf.length + '\u0000', 'utf8'), buf]))
      .digest('hex');
    const theirs = spawnSync('git', ['hash-object', f], { encoding: 'utf8' }).stdout.trim();
    assert.equal(mine, theirs, 'blob id 계산이 git 과 다르다');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
