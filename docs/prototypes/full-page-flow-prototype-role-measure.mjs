// 선언의 **역할 맥락**을 측정한다 (W1 · P1b · 페이블 조건 1~5 대응).
//
// 배정을 눈으로 판단하면 값에서 역할을 짐작하게 된다 — 이 회차에만 네 번 그랬다.
// 그래서 판단의 **입력이 되는 사실**만 기계로 뽑는다. 뽑는 사실은 셋이다.
//
//   element   선언이 붙은 JSX 원소 이름 (<Text · <TextInput · <View · <Pressable …)
//   pressable 조상 사슬에 onPress/onPressIn/accessibilityRole="button" 이 있는가
//   siblings  같은 스타일 객체 안의 다른 속성 (fontWeight · lineHeight · flex · width …)
//
// 조상 사슬은 **들여쓰기**로 찾는다. 이 저장소는 prettier 로 정렬되어 있어
// 여는 태그의 들여쓰기가 곧 중첩 깊이다. 태그 본문은 여는 `<` 부터 짝이 되는 `>` 까지다.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const auditPath = resolve(args[0] ?? 'docs/token-adoption-audit.json');
const outPath   = resolve(args[1] ?? '.tmp/role-measure.json');
const selector  = args[2] ?? 'typography:fontSize:15';

const auditBytes = readFileSync(auditPath);
const audit = JSON.parse(auditBytes.toString('utf8'));

const cache = new Map();
const L = (f) => { if (!cache.has(f)) cache.set(f, readFileSync(resolve(f), 'utf8').split(/\r?\n/)); return cache.get(f); };
const indent = (s) => s.match(/^\s*/)[0].replace(/\t/g, '  ').length;

// 여는 태그 본문 — `<Name` 부터 그 태그를 닫는 `>` 까지. 중첩 중괄호 안의 `>` 는 세지 않는다.
const tagBody = (lines, i) => {
  let out = '', depth = 0;
  for (let k = i; k < Math.min(i + 40, lines.length); k++) {
    const t = lines[k];
    for (let c = 0; c < t.length; c++) {
      const ch = t[c];
      out += ch;
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) { lastTagEnd = k + 1; return out; }
    }
    out += '\n';
  }
  lastTagEnd = Math.min(i + 40, lines.length);
  return out;
};
let lastTagEnd = 0;

// 위로 올라가며 조상을 찾을 때, **이미 닫힌 형제 부분트리**를 건너뛰어야 한다.
// 들여쓰기만 보면 형제의 여는 태그가 조상으로 잘못 잡힌다 —
// `<Text>브레이크 타임</Text>` 위에 닫혀 있는 스위치 `<Pressable>` 이 그 경우였다.
// 닫는 줄(`</Name>` 또는 단독 `/>`)을 만나면 같은 들여쓰기의 여는 줄까지 건너뛴다.
const climb = (lines, from, stopIndent, want, refLine) => {
  const out = [];
  let ind = stopIndent;
  let k = from;
  while (k >= 0) {
    const t = lines[k];
    if (!t.trim()) { k--; continue; }
    const ti = indent(t);
    const close = t.match(/^\s*<\/([A-Za-z][A-Za-z0-9_.]*)>/);
    if (close) {                                   // 형제 부분트리의 끝 — 그 시작까지 뛴다
      const re = new RegExp('^\\s{' + ti + '}<' + close[1].replace('.', '\\.') + '[\\s/>]');
      let j = k - 1;
      while (j >= 0 && !re.test(lines[j])) j--;
      k = j - 1; continue;
    }
    if (/^\s*\/>\s*$/.test(t)) {                   // 여러 줄 자기닫힘 형제의 끝
      let j = k - 1;
      while (j >= 0 && indent(lines[j]) >= ti) j--;
      k = j; continue;
    }
    const open = t.match(/^\s*<([A-Za-z][A-Za-z0-9_.]*)/);
    if (open && ti < ind) {
      const body = tagBody(lines, k);
      // 자기닫힘 태그라도 **속성이 여러 줄이고 선언이 그 안에** 있으면 조상이다.
      // `<TextInput ... style={{ fontSize: 15 }} />` 가 그 경우다.
      if (/\/>\s*$/.test(body.trim()) && lastTagEnd < refLine) { k--; continue; }
      ind = ti;
      out.push({ name: open[1], at: k + 1, body });
      if (want === 1) return out;
    }
    k--;
  }
  return out;
};

// 선언 줄을 감싸는 원소 — 자기 줄에 여는 태그가 있으면 그것, 없으면 위로 첫 조상.
const enclosing = (file, line) => {
  const lines = L(file);
  const own = lines[line - 1] ?? '';
  const self = own.match(/<([A-Za-z][A-Za-z0-9_.]*)/);
  if (self) return { name: self[1], at: line, body: tagBody(lines, line - 1) };
  return climb(lines, line - 2, indent(own), 1, line)[0] ?? null;
};

// 조상 사슬.
const ancestors = (file, line, limit = 12) =>
  climb(L(file), line - 2, indent(L(file)[line - 1] ?? ''), 0, line).slice(0, limit);

const PRESS = /onPress\s*=|onPressIn\s*=|accessibilityRole\s*=\s*["']button["']|accessibilityRole\s*=\s*["']link["']/;

// 눌리는 조상의 **본문**을 들여쓰기로 잘라 낸다 — 여는 태그 줄부터, 그보다 얕아지는 첫 줄 전까지.
// 그 안의 <Text 개수가 1 이면 그 글자가 곧 버튼 라벨이고, 2 이상이면 라벨·값이 든 행이다.
const subtree = (file, openLine) => {
  const lines = L(file);
  const base = indent(lines[openLine - 1]);
  // 여는 태그의 속성이 여러 줄이면 `>` 가 태그와 같은 들여쓰기로 내려온다.
  // 그 줄에서 멈추면 본문을 한 줄도 못 읽는다 — 태그가 닫힌 뒤부터 세기 시작한다.
  let k = openLine - 1, depth = 0, closed = false;
  for (; k < lines.length && !closed; k++) {
    const t = lines[k];
    for (let c = (k === openLine - 1 ? t.indexOf('<') : 0); c < t.length; c++) {
      if (t[c] === '{') depth++;
      else if (t[c] === '}') depth--;
      else if (t[c] === '>' && depth === 0) { closed = true; break; }
    }
  }
  const out = [];
  for (; k < lines.length; k++) {
    const t = lines[k];
    if (t.trim() && indent(t) <= base) break;
    out.push(t);
  }
  return out.join('\n');
};

const [g, p, v] = selector.split(':');
const picked = audit.declarations.filter(d =>
  (!g || d.group === g) && (!p || d.prop === p) && (!v || String(d.value) === v));

const rows = picked.map(d => {
  const el = enclosing(d.file, d.line);
  const anc = ancestors(d.file, d.line);
  const chain = [el, ...anc].filter(Boolean);
  const pressAt = chain.find(x => PRESS.test(x.body));
  const own = (L(d.file)[d.line - 1] ?? '').trim();
  // 글자 내용이 **정적 문구**인지 데이터인지. 눌리는 원소 안에서 이 구분이
  // '버튼 자신의 라벨' 과 '행 안의 내용' 을 가른다.
  const elLines = L(d.file);
  let children = '';
  if (el) {
    tagBody(elLines, el.at - 1);
    const endTag = lastTagEnd;
    for (let k = endTag - 1; k < Math.min(endTag + 6, elLines.length); k++) {
      children += elLines[k];
      if (/<\/[A-Za-z][A-Za-z0-9_.]*>/.test(elLines[k])) break;
    }
    const gt = children.indexOf('>');
    children = gt >= 0 ? children.slice(gt + 1) : children;
    const lt = children.indexOf('</');
    if (lt >= 0) children = children.slice(0, lt);
  }
  const staticText = /[A-Za-z가-힣][A-Za-z가-힣0-9 ·+\-]*/.test(children.replace(/\{[^}]*\}/g, ''));
  const sub = pressAt ? subtree(d.file, pressAt.at) : null;
  const textCount = sub ? (sub.match(/<Text[\s>]/g) ?? []).length : null;
  const selectedState = sub ? /accessibilityState\s*=\s*\{\{?\s*selected|\bon\s*\?/.test(sub) : null;
  return {
    key: `${d.file}:${d.line}:${d.prop}`,
    short: `${d.file.replace('apps/mobile/src/', '')}:${d.line}`,
    value: d.value,
    element: el?.name ?? '?',
    isInput: /Input$/.test(el?.name ?? ''),
    pressable: !!pressAt,
    pressableBy: pressAt ? `${pressAt.name}@${pressAt.at}` : null,
    chain: chain.map(x => x.name).join(' < '),
    staticText,
    children: children.trim().slice(0, 60),
    pressTextCount: textCount,
    pressSelectedState: selectedState,
    line: own.length > 200 ? own.slice(0, 200) + '…' : own,
  };
});

const out = {
  manifest: {
    script: 'docs/prototypes/full-page-flow-prototype-role-measure.mjs',
    scriptSha256: sha(readFileSync(new URL(import.meta.url))),
    auditSha256: sha(auditBytes),
    selector, node: process.version, generatedAt: new Date().toISOString(),
    판정: '역할 맥락은 눈이 아니라 원소·조상 사슬·형제 속성으로 읽는다.',
  },
  counts: {
    total: rows.length,
    input: rows.filter(r => r.isInput).length,
    pressable: rows.filter(r => r.pressable && !r.isInput).length,
    plain: rows.filter(r => !r.pressable && !r.isInput).length,
    pressSingleText: rows.filter(r => r.pressable && !r.isInput && r.pressTextCount === 1).length,
    pressMultiText: rows.filter(r => r.pressable && !r.isInput && r.pressTextCount > 1).length,
  },
  rows,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`${selector} — 총 ${rows.length} · 입력 ${out.counts.input} · 눌리는 것 ${out.counts.pressable} · 그 외 ${out.counts.plain}`);
