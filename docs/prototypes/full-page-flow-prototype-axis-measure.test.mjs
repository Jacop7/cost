#!/usr/bin/env node
/**
 * 축 측정기의 **음성 시험** — 두 번 틀린 측정기다. 세 번째 판이라는 것은 근거가 아니다
 * (솔 검수 `W1 R1` 질문 4 · 페이블 재종결 조건 ④).
 *
 * 지난 두 번의 오판 유형을 그대로 재현해 각각 시험으로 박는다 —
 *   ① 값으로 축을 추측 (`PRT-207`)            → 이제 속성과 컨테이너로만 판정하는지
 *   ② 삼항식 `flexDirection` (`PRT-209`)      → 리터럴이 아니어도 읽는지
 *   ③ `ScrollView horizontal` (`PRT-209`)     → 컨테이너 밖 원소가 축을 정하는 경우
 *   ④ 스타일 배열·spread                        → 감싸는 블록을 잘못 잡지 않는지
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const MEASURE = join(here, 'full-page-flow-prototype-axis-measure.mjs');

/** 임시 화면 파일 하나를 만들고, 그 안의 선언들을 감사 산출물 모양으로 싸서 측정기에 넣는다. */
const measure = (source, decls) => {
  const dir = mkdtempSync(join(tmpdir(), 'axis-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    const rel = 'src/Screen.tsx';
    writeFileSync(join(dir, rel), source);
    const audit = {
      manifest: { 결속: { expectCommit: '0'.repeat(40), 범위해시: 'f'.repeat(64) } },
      declarations: decls.map(d => ({ group: d.group ?? 'spacing', prop: d.prop, value: d.value,
        file: rel, line: d.line, column: d.column ?? 1 })),
    };
    const a = join(dir, 'audit.json'); writeFileSync(a, JSON.stringify(audit));
    const o = join(dir, 'axis.json');
    const r = spawnSync(process.execPath, [MEASURE, a, o], { cwd: dir, encoding: 'utf8' });
    const out = JSON.parse(readFileSync(o, 'utf8'));
    return { code: r.status, axes: Object.fromEntries(out.perDecl.map(x => [x.key, x.axis])),
      why: Object.fromEntries(out.perDecl.map(x => [x.key, x.why])) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('값으로 축을 추측하지 않는다 — 같은 값 6 이 속성에 따라 갈린다', () => {
  const src = [
    `const a = <View style={{ marginTop: 6 }} />;`,
    `const b = <View style={{ marginLeft: 6 }} />;`,
  ].join('\n');
  const r = measure(src, [{ prop: 'marginTop', value: 6, line: 1 }, { prop: 'marginLeft', value: 6, line: 2 }]);
  assert.equal(r.axes['src/Screen.tsx:1:marginTop'], 'V');
  assert.equal(r.axes['src/Screen.tsx:2:marginLeft'], 'H');
});

test('삼항식 flexDirection 도 읽는다 — 두 갈래가 다 row 면 가로다 (PRT-209 오판)', () => {
  const src = [
    `const a = (`,
    `  <Pressable style={{ flexDirection: iconRight ? 'row-reverse' : 'row', gap: 6 }}>`,
    `  </Pressable>`,
    `);`,
  ].join('\n');
  const r = measure(src, [{ prop: 'gap', value: 6, line: 2, column: 60 }]);
  assert.equal(r.axes['src/Screen.tsx:2:gap'], 'H', r.why['src/Screen.tsx:2:gap']);
});

test('삼항식의 두 갈래가 축이 다르면 단정하지 않는다 — 양축으로 남긴다', () => {
  const src = [
    `const a = (`,
    `  <View style={{ flexDirection: wide ? 'row' : 'column', gap: 6 }}>`,
    `  </View>`,
    `);`,
  ].join('\n');
  const r = measure(src, [{ prop: 'gap', value: 6, line: 2, column: 55 }]);
  assert.equal(r.axes['src/Screen.tsx:2:gap'], 'B', r.why['src/Screen.tsx:2:gap']);
});

test('ScrollView horizontal 의 contentContainerStyle gap 은 가로다 (PRT-209 오판)', () => {
  const src = [
    `const a = (`,
    `  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>`,
    `  </ScrollView>`,
    `);`,
  ].join('\n');
  const r = measure(src, [{ prop: 'gap', value: 7, line: 2, column: 90 }]);
  assert.equal(r.axes['src/Screen.tsx:2:gap'], 'H', r.why['src/Screen.tsx:2:gap']);
});

test('세로 스크롤의 contentContainerStyle gap 은 세로다 — horizontal 이 없으면 RN 기본은 column', () => {
  const src = [
    `const a = (`,
    `  <ScrollView contentContainerStyle={{ gap: 7 }}>`,
    `  </ScrollView>`,
    `);`,
  ].join('\n');
  const r = measure(src, [{ prop: 'gap', value: 7, line: 2, column: 40 }]);
  assert.equal(r.axes['src/Screen.tsx:2:gap'], 'V', r.why['src/Screen.tsx:2:gap']);
});

test('스타일 배열 안의 객체도 그 객체의 flexDirection 을 본다', () => {
  const src = [
    `const a = (`,
    `  <View style={[base, { flexDirection: 'row', gap: 3 }]}>`,
    `  </View>`,
    `);`,
  ].join('\n');
  const r = measure(src, [{ prop: 'gap', value: 3, line: 2, column: 48 }]);
  assert.equal(r.axes['src/Screen.tsx:2:gap'], 'H', r.why['src/Screen.tsx:2:gap']);
});

test('spread 로 합친 객체도 직속 flexDirection 을 본다', () => {
  const src = [
    `const a = (`,
    `  <View style={{ ...base, flexDirection: 'row', gap: 3 }}>`,
    `  </View>`,
    `);`,
  ].join('\n');
  const r = measure(src, [{ prop: 'gap', value: 3, line: 2, column: 50 }]);
  assert.equal(r.axes['src/Screen.tsx:2:gap'], 'H', r.why['src/Screen.tsx:2:gap']);
});

test('중첩 블록의 flexDirection 은 남의 것이다 — 바깥 gap 을 가로로 접지 않는다', () => {
  const src = [
    `const a = (`,
    `  <View style={{ gap: 3, padding: 8 }}>`,
    `    <View style={{ flexDirection: 'row' }} />`,
    `  </View>`,
    `);`,
  ].join('\n');
  const r = measure(src, [{ prop: 'gap', value: 3, line: 2, column: 18 }]);
  assert.equal(r.axes['src/Screen.tsx:2:gap'], 'V', r.why['src/Screen.tsx:2:gap']);
});

test('반경과 색은 축이 없다 — 양축/불명과 한 통에 넣지 않는다', () => {
  const src = `const a = <View style={{ borderRadius: 3, backgroundColor: '#000' }} />;`;
  const r = measure(src, [{ group: 'radius', prop: 'borderRadius', value: 3, line: 1 }]);
  assert.equal(r.axes['src/Screen.tsx:1:borderRadius'], 'N');
});

test('입력 감사에 결속이 없으면 종료 코드가 1 이다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'axis-nobind-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src/Screen.tsx'), `const a = <View style={{ gap: 3 }} />;`);
    const a = join(dir, 'audit.json');
    writeFileSync(a, JSON.stringify({ manifest: {}, declarations: [{ group: 'spacing', prop: 'gap', value: 3, file: 'src/Screen.tsx', line: 1, column: 30 }] }));
    const r = spawnSync(process.execPath, [MEASURE, a, join(dir, 'axis.json')], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1, (r.stdout ?? '') + (r.stderr ?? ''));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
