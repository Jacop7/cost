#!/usr/bin/env node
/** 터치 영역 래칫의 음성 시험 — 양방향으로 실제 FAIL 하는지 본다. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const AUDIT = join(root, 'scripts', 'touch-target-audit.mjs');
const KNOWN = join(root, 'scripts', 'touch-target-known.json');

const runWith = ({ tsx, known }) => {
  const dir = mkdtempSync(join(tmpdir(), 'touch-'));
  try {
    const src = join(dir, 'src'); mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Sample.tsx'), tsx);
    const k = join(dir, 'known.json');
    writeFileSync(k, JSON.stringify({ unjudged: [], components: [], ...known }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

const OK = `<Pressable onPress={f} hitSlop={5} style={{ width: 34, height: 34 }}><I/></Pressable>`;
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
  const tsx = `<Pressable onPress={f} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }} style={{ width: 20, height: 20 }}><I/></Pressable>`;
  // 세로 20+24=44 통과 · 가로 20+4=24 미달 → 미달로 잡혀야 한다
  const r = runWith({ tsx, known: { entries: [] } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /유효 24×44/);
});

test('저장소의 알려진 목록은 지금 실제와 맞는다', () => {
  const r = spawnSync(process.execPath, [AUDIT], { encoding: 'utf8' });
  assert.equal(r.status, 0, (r.stdout ?? '') + (r.stderr ?? ''));
  const known = JSON.parse(readFileSync(KNOWN, 'utf8'));
  assert.ok(known.entries.length > 0, '알려진 미달이 비어 있다 — 목록이 사라졌는지 확인하라');
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
    writeFileSync(k, JSON.stringify({ entries: [], unjudged: [], components: [] }));
    const first = go();
    const at = (first.out.match(/새 미달 — (\S+)/) ?? [])[1];
    assert.ok(at, `자리 이름을 못 읽었다\n${first.out}`);
    // 목록에는 42×42 로 적혀 있는데 실제는 34×34 다
    writeFileSync(k, JSON.stringify({ entries: [{ at, 유효: '42×42', 사유: '옛 값' }], unjudged: [], components: [] }));
    const r = go();
    assert.equal(r.code, 1, `유효 크기 악화를 놓쳤다\n${r.out}`);
    assert.match(r.out, /악화/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const BUTTON_TSX = `
type Size = 'sm' | 'md' | 'lg';
export function Button({ children, kind = 'primary', size = 'md', full }: Props) {
  const sizes: Record<Size, { pv: number; ph: number; fs: number; r: number }> = {
    sm: { pv: 8, ph: 12, fs: 14, r: 9 },
    md: { pv: 13, ph: 16, fs: 16, r: 12 },
    lg: { pv: 16, ph: 18, fs: 17, r: 14 },
  };
  return null;
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
    writeFileSync(k, JSON.stringify({ entries: [], unjudged: [], components: [], buttonDynamic: [], ...known }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`, ...args], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

/** 시험용 계약 — 세 variant 를 다 올려 둔다. `at` 은 시험마다 덮어쓴다. */
const contracts = (at) => [
  { 컴포넌트: 'Button size="sm"', 판정: '경계', 높이하한: 30, 소비처: (at.sm ?? []).length, at: at.sm ?? [] },
  { 컴포넌트: 'Button size="md"', 판정: '경계', 높이하한: 42, 소비처: (at.md ?? []).length, at: at.md ?? [] },
  { 컴포넌트: 'Button size="lg"', 판정: '통과', 높이하한: 49 },
];

test('공용 컴포넌트 계약 — 하한이 44 를 넘으면 통과, 못 넘으면 경계다 (미달을 단정하지 않는다)', () => {
  const r = runButton({ known: { components: contracts({}) } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Button size="sm" 높이 하한 30 → 경계/);
  assert.match(r.out, /Button size="md" 높이 하한 42 → 경계/);
  assert.match(r.out, /Button size="lg" 높이 하한 49 → 통과/);
  assert.doesNotMatch(r.out, /어떤 글꼴에서도/);
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
  const r = runButton({
    consumers: `<Button size="sm" onPress={f}>A</Button>\n<Button size="sm" onPress={g}>B</Button>`,
    known: { components: contracts({ sm: ['src/Consumers.tsx:1'] }) },
  });
  assert.equal(r.code, 1, `소비처 증가를 놓쳤다\n${r.out}`);
  assert.match(r.out, /새 Button size="sm" 소비처/);
  assert.match(r.out, /소비처가 1 → 2곳으로 바뀌었다/);
});

test('통과 variant 의 소비처는 게이트하지 않는다 — 늘어도 위험이 늘지 않는다', () => {
  const r = runButton({
    consumers: `<Button size="lg" onPress={f}>A</Button>\n<Button size="lg" onPress={g}>B</Button>`,
    known: { components: contracts({}) },
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Button size="lg" .* 소비처 2곳/);
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
    writeFileSync(k, JSON.stringify({ entries: [], unjudged: [], components: contracts({}) }, null, 2));
    const r = spawnSync(process.execPath, [AUDIT, `--src=${src}`, `--known=${k}`], { encoding: 'utf8' });
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    assert.equal(r.status, 1, out);
    assert.match(out, /알려진 동적 size 소비처 목록이 없다/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--expect-commit 이 어긋나면 FAIL — 작업 트리에서 잰 수치를 커밋 증거로 쓰지 못하게 한다', () => {
  const r = runButton({ known: { components: contracts({}) }, args: ['--expect-commit=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'] });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /측정 커밋 불일치/);
});

test('저장소를 그대로 재면 작업 트리 상태가 산출물에 남는다 — 결속 없이 인용하지 말라고 적는다', () => {
  const r = spawnSync(process.execPath, [AUDIT], { encoding: 'utf8' });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert.equal(r.status, 0, out);
  assert.match(out, /측정 — 커밋 [0-9a-f]{12} · 작업 트리 /);
  assert.match(out, /결속 없음 — 이 산출물을 커밋 증거로 인용하지 마라/);
});
