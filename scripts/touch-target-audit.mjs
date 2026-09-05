#!/usr/bin/env node
/**
 * 최소 터치 영역 감사 — `min(유효 폭, 유효 높이) >= 44` (`minTouchTarget`).
 *
 * 왜 스크립트인가: `PRT-211` 초판은 "34자리 중 21자리 미달" 을 **주석에만** 적었다.
 * 자리별 결과도 재현 경로도 없어서 다음 사람이 확인할 방법이 없다 (솔 검수 `F04`).
 *
 * 계약은 결정 9-1 이다 — **시각 높이와 터치 영역은 분리된 값**이다. 상자를 44 로 키우는
 * 것이 아니라, 상자가 작으면 `hitSlop` 으로 채운다. 앱은 이미 이 산수를 하고 있다:
 * `34 + 2×5 = 44` · `40 + 2×2 = 44`.
 *
 * ⚠ `hitSlop` 은 숫자만이 아니다. `{top,bottom,left,right}` · `{horizontal,vertical}` 형태면
 *   **축마다 따로** 더해야 한다. 초판의 `min(w,h) + 2×hitSlop` 은 숫자형 대칭에만 맞았다.
 *
 * 산출: 전수 인벤토리(파일·행·폭·높이·상하좌우 hitSlop·유효 폭/높이·판정)를 JSON 으로
 * 보존하고, 알려진 미달 목록과 **양방향 래칫**으로 대조한다 —
 *   목록에 없는 새 미달 → FAIL (재발 방지)
 *   목록에 있는데 이제 통과 → FAIL (고쳤으면 목록에서 빼라)
 *
 * 남은 한계는 정직하게 적는다: 부모 경계로 잘리는지, 이웃 터치 영역과 겹치는지는 **정적
 * 분석으로 못 본다.** 그건 렌더 감사(`S4`)의 몫이고, 이 감사는 "선언상 44 가 되는가" 만 본다.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const opt = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--') && a.includes('='))
  .map(a => [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]));
const srcRoot = resolve(opt.src ?? join(root, 'apps', 'mobile'));
const knownPath = resolve(opt.known ?? join(root, 'scripts', 'touch-target-known.json'));
const outPath = opt.out ? resolve(opt.out) : null;
const MIN = 44;

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e === '.expo' || e === 'dist') continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) files.push(p);
  }
})(srcRoot);

/** 여는 태그 본문 — `<Name` 부터 짝이 되는 `>` 까지. 중괄호 안의 `>` 는 세지 않는다. */
const tagBody = (text, start) => {
  let depth = 0;
  for (let i = start; i < text.length && i < start + 4000; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start, start + 4000);
};

/** `hitSlop` 을 축별로 읽는다. 숫자 · {top,bottom,left,right} · {horizontal,vertical}. */
const readHitSlop = (body) => {
  const m = body.match(/hitSlop\s*=\s*\{/);
  if (!m) return { top: 0, bottom: 0, left: 0, right: 0, form: '없음' };
  const rest = body.slice(m.index + m[0].length - 1);
  const num = rest.match(/^\{\s*(\d+(?:\.\d+)?)\s*\}/);
  if (num) { const v = Number(num[1]); return { top: v, bottom: v, left: v, right: v, form: `숫자 ${v}` }; }
  const obj = rest.match(/^\{\s*\{([\s\S]{0,200}?)\}\s*\}/);
  if (obj) {
    const g = (k) => { const mm = obj[1].match(new RegExp(`${k}\\s*:\\s*(\\d+(?:\\.\\d+)?)`)); return mm ? Number(mm[1]) : null; };
    const h = g('horizontal'), v = g('vertical');
    const o = { top: g('top') ?? v ?? 0, bottom: g('bottom') ?? v ?? 0, left: g('left') ?? h ?? 0, right: g('right') ?? h ?? 0 };
    return { ...o, form: `객체 ${JSON.stringify(o)}` };
  }
  return { top: 0, bottom: 0, left: 0, right: 0, form: '읽을 수 없음' };
};

/**
 * 상자 크기를 읽는다.
 *
 * ⚠ `shadowOffset: { width: 0, height: 6 }` 의 숫자를 상자 크기로 읽으면 안 된다.
 *   초판이 그래서 `FAB`(크기가 padding 으로 정해지는 상자)를 `0×6` 미달로 오검출했다.
 *   중첩 객체를 쓰는 속성은 먼저 지운다.
 */
const NESTED = /\b(shadowOffset|transform|textShadowOffset|hitSlop)\s*:\s*\{[^}]*\}/g;
const dim = (body, key) => {
  const clean = body.replace(NESTED, ' ');
  const m = clean.match(new RegExp(`(?:^|[^A-Za-z])${key}\\s*:\\s*(\\d+(?:\\.\\d+)?)`));
  return m ? Number(m[1]) : null;
};

const PRESSABLE = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)\b/g;
const rows = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  const offsets = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') offsets.push(i + 1);
  const lineOf = (idx) => { let lo = 0, hi = offsets.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; };
  PRESSABLE.lastIndex = 0;
  let m;
  while ((m = PRESSABLE.exec(text))) {
    const body = tagBody(text, m.index);
    if (!/onPress\s*=/.test(body)) continue;          // 누를 수 없으면 터치 영역 계약 밖이다
    const w = dim(body, 'width'), h = dim(body, 'height');
    const hs = readHitSlop(body);
    const rel = relative(root, f).replace(/\\/g, '/');
    const line = lineOf(m.index);
    if (w === null || h === null) {
      rows.push({ at: `${rel}:${line}`, element: m[1], width: w, height: h, hitSlop: hs.form,
        판정: '판정불가', 사유: '폭 또는 높이가 선언되지 않았다 — 내용/flex 로 정해진다. 렌더 감사의 몫이다' });
      continue;
    }
    const ew = w + hs.left + hs.right, eh = h + hs.top + hs.bottom;
    rows.push({ at: `${rel}:${line}`, element: m[1], width: w, height: h, hitSlop: hs.form,
      유효폭: ew, 유효높이: eh, 판정: (ew >= MIN && eh >= MIN) ? '통과' : '미달' });
  }
}

// ── 공용 컴포넌트 계약 (솔 검수 `F02`) ─────────────────────────────────────────
// `Button` 처럼 **높이가 padding + 글자로 정해지는** 공용 컴포넌트는 자리마다 판정불가로
// 빠진다. 그런데 그게 앱에서 가장 많이 눌리는 상자다. 크기 variant 를 **한 번** 판정하고
// 소비처를 세어 연결한다.
//
// 정확한 높이는 글꼴 메트릭에 달려 정적 분석으로 못 정한다. 그래서 **범위**로 판정한다 —
//   하한 = 2×paddingVertical + fontSize        (글자 상자가 최소 이만큼은 된다)
//   상한 = 2×paddingVertical + ceil(fontSize × 1.4)   (§4.8 default 행간)
// 상한이 44 미만이면 **어떤 글꼴에서도 미달**이라 확정이고, 하한이 44 이상이면 확정 통과다.
// 그 사이는 `경계` 로 두고 렌더 측정(`S4`)의 몫으로 넘긴다 — 정적으로 단정하지 않는다.
const componentContracts = [];
{
  const bt = join(srcRoot, 'src', 'components', 'kit', 'Button.tsx');
  if (existsSync(bt)) {
    const t = readFileSync(bt, 'utf8');
    const m = t.match(/const sizes[^=]*=\s*\{([\s\S]*?)\n\s*\};/);
    if (!m) componentContracts.push({ 컴포넌트: 'Button', 판정: '읽기실패', 사유: 'sizes 표를 못 읽었다 — 모양이 바뀌었으면 계약을 다시 맞춰라' });
    else {
      for (const line of m[1].split('\n')) {
        const v = line.match(/(\w+)\s*:\s*\{\s*pv:\s*(\d+),\s*ph:\s*(\d+),\s*fs:\s*(\d+)/);
        if (!v) continue;
        const [, name, pv, ph, fs] = v;
        const lo = 2 * +pv + +fs, hi = 2 * +pv + Math.ceil(+fs * 1.4);
        const 판정 = hi < MIN ? '미달' : lo >= MIN ? '통과' : '경계';
        const uses = [];
        for (const f of files) {
          const src = readFileSync(f, 'utf8').split(/\r?\n/);
          src.forEach((ln, i) => { if (new RegExp(`<Button[^>]*size=["']${name}["']`).test(ln)) uses.push(`${relative(root, f).replace(/\\/g, '/')}:${i + 1}`); });
        }
        componentContracts.push({ 컴포넌트: `Button size="${name}"`, paddingVertical: +pv, fontSize: +fs,
          높이범위: `${lo}~${hi}`, 판정, 소비처: uses.length, at: uses.slice(0, 12) });
      }
    }
  }
}
const compShort = componentContracts.filter(c => c.판정 === '미달' || c.판정 === '읽기실패');
const compEdge = componentContracts.filter(c => c.판정 === '경계');

const judged = rows.filter(r => r.판정 !== '판정불가');
const short = judged.filter(r => r.판정 === '미달');
const known = existsSync(knownPath) ? JSON.parse(readFileSync(knownPath, 'utf8')) : { entries: [] };
const knownSet = new Map((known.entries ?? []).map(e => [e.at, e]));

const failures = [];
for (const s of short) if (!knownSet.has(s.at))
  failures.push(`새 미달 — ${s.at} ${s.width}×${s.height} · hitSlop ${s.hitSlop} → 유효 ${s.유효폭}×${s.유효높이}`);
const shortSet = new Set(short.map(s => s.at));
for (const [at, e] of knownSet) if (!shortSet.has(at))
  failures.push(`해결됨 — ${at} 이 이제 통과한다. 알려진 목록에서 빼라 (${e.사유 ?? '사유 없음'})`);
// 알려진 미달이 **더 나빠지는 것**도 막는다 (솔 F02) — 존재만 비교하면 42×42 가 30×30 이
// 되어도 계속 "알려진 미달" 이라 통과한다.
for (const s of short) {
  const e = knownSet.get(s.at);
  if (!e) continue;
  const pw = Number(String(e.유효 ?? '').split('×')[0]), ph = Number(String(e.유효 ?? '').split('×')[1]);
  if (Number.isFinite(pw) && s.유효폭 < pw) failures.push(`악화 — ${s.at} 유효 폭 ${pw} → ${s.유효폭}`);
  if (Number.isFinite(ph) && s.유효높이 < ph) failures.push(`악화 — ${s.at} 유효 높이 ${ph} → ${s.유효높이}`);
}
// 판정불가도 래칫한다 — 래칫 밖에 두면 판정 못 하는 상자가 늘어도 통과한다.
const unjudgedAts = rows.filter(r => r.판정 === '판정불가').map(r => r.at).sort();
const knownUnjudged = (known.unjudged ?? []).slice().sort();
if (known.unjudged === undefined) failures.push('알려진 판정불가 목록이 없다 — 래칫 밖에 두면 판정 못 하는 상자가 늘어도 통과한다');
else {
  const ku = new Set(knownUnjudged);
  for (const a of unjudgedAts) if (!ku.has(a)) failures.push(`새 판정불가 — ${a} (폭·높이가 선언되지 않았다. 공용 컴포넌트면 계약으로, 아니면 크기를 선언하라)`);
  const ua = new Set(unjudgedAts);
  for (const a of knownUnjudged) if (!ua.has(a)) failures.push(`판정불가가 해소됐다 — ${a} 를 목록에서 빼라`);
}
// 공용 컴포넌트 계약
// 공용 컴포넌트 계약 — 알려진 미달과 양방향으로 맞춘다.
const knownComp = new Map((known.components ?? []).map(c => [c.컴포넌트, c]));
if (known.components === undefined) failures.push('알려진 공용 컴포넌트 미달 목록이 없다');
else {
  for (const c of compShort) if (!knownComp.has(c.컴포넌트))
    failures.push(`새 공용 컴포넌트 미달 — ${c.컴포넌트} 높이 ${c.높이범위 ?? '?'} · 소비처 ${c.소비처 ?? '?'}곳 — 어떤 글꼴에서도 44 에 못 미친다`);
  const shortComp = new Set(compShort.map(c => c.컴포넌트));
  for (const k of knownComp.keys()) if (!shortComp.has(k)) failures.push(`공용 컴포넌트 ${k} 가 이제 미달이 아니다 — 목록에서 빼라`);
  for (const c of compShort) {
    const e = knownComp.get(c.컴포넌트);
    if (e && e.높이범위 && e.높이범위 !== c.높이범위) failures.push(`공용 컴포넌트 ${c.컴포넌트} 높이 범위가 ${e.높이범위} → ${c.높이범위} 로 바뀌었다 — 목록을 갱신하라`);
  }
}

const out = {
  manifest: {
    script: 'scripts/touch-target-audit.mjs',
    minTouchTarget: MIN,
    판정식: '유효폭 = width + hitSlop.left + hitSlop.right · 유효높이 = height + hitSlop.top + hitSlop.bottom · 둘 다 44 이상',
    한계: '부모 경계로 잘리는지, 이웃 터치 영역과 겹치는지는 정적 분석으로 못 본다 — 렌더 감사(S4)의 몫이다.',
    generatedAt: new Date().toISOString(), node: process.version,
  },
  summary: { 파일: files.length, 누를수있는상자: rows.length, 판정: judged.length, 통과: judged.length - short.length,
    미달: short.length, 판정불가: rows.length - judged.length,
    공용컴포넌트: componentContracts.length, 공용컴포넌트미달: compShort.length, 공용컴포넌트경계: compEdge.length },
  failures, componentContracts, rows,
};
if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`터치 영역 — 판정 ${judged.length}자리 · 통과 ${judged.length - short.length} · **미달 ${short.length}** · 판정불가 ${rows.length - judged.length}(래칫 대상)`);
for (const c of componentContracts) console.log(`  공용 — ${c.컴포넌트} 높이 ${c.높이범위 ?? '?'} → ${c.판정} · 소비처 ${c.소비처 ?? 0}곳`);
if (failures.length) {
  console.error('\n터치 영역 래칫 FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('터치 영역 래칫 PASS — 알려진 미달 목록과 일치한다');
