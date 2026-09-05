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

test('공용 컴포넌트 계약 — Button size 별로 한 번 판정하고 소비처를 센다', () => {
  const r = spawnSync(process.execPath, [AUDIT], { encoding: 'utf8' });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert.equal(r.status, 0, out);
  assert.match(out, /공용 — Button size="sm" 높이 30~36 → 미달/);
  assert.match(out, /공용 — Button size="lg" .* → 통과/);
});
