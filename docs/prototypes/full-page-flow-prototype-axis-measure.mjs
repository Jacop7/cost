// 간격 선언의 **축**을 선언마다 측정한다 (W1 · P1b).
//
// 왜 별도 스크립트인가: PRT-207 이전에는 값으로 축을 갈랐다 — 3=세로, 6·7=가로.
// 그 판정은 54건을 틀린 쪽에 넣었고 그중 5건은 가로인데 세로 단계(S3a)에 있었다.
// 그래서 축은 **값이 아니라 속성과 컨테이너**로 판정한다. 이 스크립트가 그 판정의 정본이고,
// 앱 매핑표의 `at` 목록(growV / growH)은 여기서 나온다.
//
// 판정 규칙
//   1. 속성 이름이 축을 말하면 그대로 쓴다.
//        세로 — marginTop/Bottom/Vertical, paddingTop/Bottom/Vertical, rowGap, top, bottom, height 계열
//        가로 — marginLeft/Right/Horizontal/Start/End, paddingLeft/Right/Horizontal/Start/End,
//               columnGap, left, right, width 계열
//   2. `gap` 은 축이 없다. 그 gap 이 놓인 **스타일 객체의 flexDirection** 을 읽는다.
//      React Native 의 기본 flexDirection 은 `column` 이므로, 선언이 없으면 세로다.
//      (웹 CSS 의 기본은 row 다. 이 차이가 값으로 축을 가를 때 틀렸던 이유다.)
//   3. `padding` · `margin` 단축은 두 축 모두다 — `both` 로 표시하고 자동 배정하지 않는다.
//
// 산출: axis-at.json — { growV: [...], growH: [...], both: [...], perDecl: [...] }
//       키는 `파일:줄:속성` 이다. 한 줄에 같은 그룹의 선언이 둘 이상 있고 축이 갈리면
//       `파일:줄` 만으로는 못 가르기 때문이다 (PRT-207).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const auditPath = resolve(args[0] ?? 'docs/token-adoption-audit.json');
const outPath   = resolve(args[1] ?? '.tmp/axis-at.json');
// `only` 는 이제 **선택**이다. 초판은 값 3·6·7 의 spacing 만 쟀는데, 그건 GROW-V/GROW-H
// 한 자리를 가르려고 만든 것이었다. 그 사이 검수가 요구한 것은 **defect 규칙 전수의 축
// 재검증**이라(솔 `W1 R1 F03` · 페이블 재종결 조건 ④) 기본값을 "전부" 로 바꾼다.
// `--only=3,6,7` 로 옛 범위를 그대로 재현할 수 있다 — 회귀 비교용이다.
const onlyOpt = process.argv.slice(2).find(a => a.startsWith('--only='));
const only = onlyOpt ? onlyOpt.slice('--only='.length).split(',').map(Number) : null;

const auditBytes = readFileSync(auditPath);
const audit = JSON.parse(auditBytes.toString('utf8'));

const V = /^(marginTop|marginBottom|marginVertical|paddingTop|paddingBottom|paddingVertical|rowGap|top|bottom|height|minHeight|maxHeight|lineHeight)$/;
const H = /^(marginLeft|marginRight|marginHorizontal|marginStart|marginEnd|paddingLeft|paddingRight|paddingHorizontal|paddingStart|paddingEnd|columnGap|left|right|width|minWidth|maxWidth)$/;
const BOTH = /^(padding|margin)$/;

// 파일별 소스 캐시. gap 의 컨테이너 축을 읽으려면 원문이 필요하다.
const src = new Map();
const text = (f) => {
  if (!src.has(f)) {
    const t = readFileSync(resolve(f), 'utf8');
    const off = [0];
    for (let i = 0; i < t.length; i++) if (t[i] === '\n') off.push(i + 1);
    // 중괄호 짝을 한 번만 훑어 둔다. 문자열·주석 안의 중괄호는 세지 않는다.
    const open = [], pair = new Map();
    let mode = null; // 'sq' 'dq' 'tick' 'line' 'block'
    for (let i = 0; i < t.length; i++) {
      const c = t[i], n = t[i + 1];
      if (mode === 'line') { if (c === '\n') mode = null; continue; }
      if (mode === 'block') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
      if (mode) {
        if (c === '\\') { i++; continue; }
        if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tick' && c === '`')) mode = null;
        continue;
      }
      if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
      if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
      if (c === "'") { mode = 'sq'; continue; }
      if (c === '"') { mode = 'dq'; continue; }
      if (c === '`') { mode = 'tick'; continue; }
      if (c === '{') open.push(i);
      else if (c === '}') { const o = open.pop(); if (o !== undefined) pair.set(o, i); }
    }
    src.set(f, { t, off, pair });
  }
  return src.get(f);
};

// 선언을 감싸는 **가장 안쪽** 중괄호 블록을 찾고, 그 블록 직속의 flexDirection 을 읽는다.
// 중첩 블록 안의 flexDirection 은 남의 것이므로 세지 않는다.
const containerDirection = (file, line, column) => {
  const { t, off, pair } = text(file);
  const pos = off[line - 1] + Math.max(0, (column ?? 1) - 1);
  let best = null;
  for (const [o, c] of pair) {
    if (o < pos && pos < c) { if (!best || o > best[0]) best = [o, c]; }
  }
  if (!best) return null;
  const [o, c] = best;
  const body = t.slice(o + 1, c);
  // 직속만 보려면 이 블록 안의 중첩 블록 구간을 지운다.
  let masked = body, guard = 0;
  for (const [oo, cc] of pair) {
    if (oo > o && cc < c) {
      const s0 = oo - (o + 1), s1 = cc - (o + 1) + 1;
      if (s0 >= 0 && s1 <= masked.length) masked = masked.slice(0, s0) + ' '.repeat(s1 - s0) + masked.slice(s1);
      if (++guard > 5000) break;
    }
  }
  // flexDirection 의 값이 항상 문자열 리터럴인 것은 아니다.
  // `flexDirection: iconRight ? 'row-reverse' : 'row'` 처럼 식일 수 있다 (Button.tsx:55).
  // 리터럴만 받으면 이 자리는 "선언 없음" 이 되어 기본값 column 으로 잘못 접힌다.
  const fd = masked.match(/flexDirection\s*:\s*([^,}\n]+)/);
  if (fd) {
    const e = fd[1];
    const hasRow = /row/.test(e), hasCol = /column/.test(e);
    if (hasRow && !hasCol) return { dir: 'row', why: `flexDirection: ${e.trim()}` };
    if (hasCol && !hasRow) return { dir: 'column', why: `flexDirection: ${e.trim()}` };
    return { dir: null, why: `flexDirection 이 식이고 두 축이 다 나온다 — ${e.trim()}`, ambiguous: true };
  }
  // 스타일 객체에 flexDirection 이 없어도, 이 스타일을 받는 **원소**가 축을 정할 수 있다.
  // ScrollView·FlatList 의 `horizontal` 이 그렇다 — contentContainerStyle 의 gap 은 가로가 된다
  // (RecipesListScreen.tsx:184 의 `gap: 7` 이 이 경우다).
  const head = t.slice(Math.max(0, o - 2000), o);
  const tag = [...head.matchAll(/<([A-Za-z][A-Za-z0-9_.]*)/g)].pop();
  if (tag) {
    const attrs = head.slice(tag.index);
    // 이 블록 바로 앞의 속성 이름
    const an = attrs.match(/([A-Za-z]+)\s*=\s*\{\{?\s*$/);
    const styleAttr = an ? an[1] : null;
    const isHorizontal = /(^|\s)horizontal(\s|=\{true\}|=\{\!\!|$)/.test(attrs) || /horizontal\s*(\/?>|$)/.test(attrs);
    if (isHorizontal && (styleAttr === 'contentContainerStyle' || styleAttr === 'style')) {
      return { dir: 'row', why: `${tag[1]} 에 horizontal 이 있고 ${styleAttr} 이다` };
    }
  }
  return { dir: null, why: '컨테이너에 flexDirection 이 없다 — RN 기본은 column' };
};

const growV = new Set(), growH = new Set(), both = new Set();
const perDecl = [];
let vCount = 0, hCount = 0, bCount = 0;

// 축이 **없는** 속성 — 값이 변해도 이웃을 밀지 않는다. 반경과 색이 그렇다.
// "축을 모른다(B)" 와 "축이 없다(N)" 를 한 통에 넣으면, 아는 것과 모르는 것이 섞인다.
const none = new Set();
let nCount = 0;
const TYPO_AXIS = { fontSize: 'B', lineHeight: 'V', letterSpacing: 'H', fontWeight: 'H' };

for (const d of audit.declarations) {
  const n = Number(d.value);
  if (only && !only.includes(n)) continue;
  const key = `${d.file}:${d.line}:${d.prop}`;
  let axis, why;
  if (d.group === 'radius') { axis = 'N'; why = '반경은 상자 크기를 바꾸지 않는다 — 축이 없다'; }
  else if (d.group === 'color') { axis = 'N'; why = '색은 레이아웃을 밀지 않는다 — 축이 없다'; }
  else if (d.group === 'typography') {
    axis = TYPO_AXIS[d.prop] ?? 'B';
    why = { B: '글자 크기는 글자 상자의 두 축을 함께 바꾼다', V: '행간은 줄 높이 — 세로다',
      H: `${d.prop} 는 글자 폭에 붙는다 — 가로다` }[axis] ?? `축을 알 수 없는 속성 ${d.prop}`;
  }
  else if (V.test(d.prop)) { axis = 'V'; why = '속성이 세로다'; }
  else if (H.test(d.prop)) { axis = 'H'; why = '속성이 가로다'; }
  else if (BOTH.test(d.prop)) { axis = 'B'; why = '단축 속성 — 두 축 모두'; }
  else if (d.prop === 'gap') {
    const r = containerDirection(d.file, d.line, d.column) ?? { dir: null, why: '감싸는 블록을 찾지 못했다' };
    why = r.why;
    if (r.ambiguous) axis = 'B';
    else if (r.dir === 'row' || r.dir === 'row-reverse') axis = 'H';
    else axis = 'V';
  }
  else { axis = 'B'; why = `축을 알 수 없는 속성 ${d.prop}`; }
  perDecl.push({ key, value: n, prop: d.prop, group: d.group, axis, why });
  if (axis === 'V') { growV.add(key); vCount++; }
  else if (axis === 'H') { growH.add(key); hCount++; }
  else if (axis === 'N') { none.add(key); nCount++; }
  else { both.add(key); bCount++; }
}

const out = {
  manifest: {
    script: 'docs/prototypes/full-page-flow-prototype-axis-measure.mjs',
    scriptSha256: sha(readFileSync(new URL(import.meta.url))),
    auditSha256: sha(auditBytes),
    // 입력이 결속된 감사 산출물인지 **여기서도** 본다. 결속 없는 입력에서 잰 축은
    // 그 자체가 남의 나무를 잰 값이 될 수 있다 (솔 `W1 R1 F01`).
    audit결속: audit.manifest?.결속 ?? null,
    values: only ?? '전부',
    node: process.version,
    generatedAt: new Date().toISOString(),
    판정: '축은 값이 아니라 속성과 컨테이너 flexDirection 으로 정한다 (PRT-207).',
  },
  counts: { V: vCount, H: hCount, both: bCount, none: nCount,
    keysV: growV.size, keysH: growH.size, keysBoth: both.size, keysNone: none.size },
  growV: [...growV].sort(),
  growH: [...growH].sort(),
  both: [...both].sort(),
  none: [...none].sort(),
  perDecl,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`값 ${only ? only.join('·') : '전부'} — 세로 ${vCount} · 가로 ${hCount} · 양축/불명 ${bCount} · 축없음 ${nCount}`);
if (!audit.manifest?.결속) {
  console.error('  ⚠ 입력 감사 산출물에 결속이 없다 — token-adoption-audit.mjs 를 --expect-commit 과 함께 다시 돌려라');
  process.exitCode = 1;
}
