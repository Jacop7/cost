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
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
// `--키=값` 과 값 없는 `--깃발` 둘 다 받는다. 깃발은 빈 문자열이라 `!== undefined` 로 본다.
const opt = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => (a.includes('=') ? [a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a.slice(2), ''])));
const srcRoot = resolve(opt.src ?? join(root, 'apps', 'mobile'));
const knownPath = resolve(opt.known ?? join(root, 'scripts', 'touch-target-known.json'));
const outPath = opt.out ? resolve(opt.out) : null;
const MIN = 44;
// 자리 ID 의 기준 경로. 저장소를 그대로 재면 저장소 루트 기준이고, `--src` 로 다른 나무를
// 가리키면 그 나무 기준이다 — 시험이 임시 폴더에서도 같은 ID 를 얻는다.
const idRoot = opt.src ? resolve(opt.src, '..') : root;

/**
 * 파일 선정 — **제품 코드와 시험 fixture 를 가른다** (솔 검수 `R4 F04`).
 *
 * 기준은 `scripts/token-adoption-audit.mjs` 의 `SELECTION` 과 같게 둔다. 감사기마다 다른
 * 기준을 두면 같은 저장소를 두 방식으로 세게 되고, 그 차이가 곧 `md 14` 대 `md 13` 이었다.
 * 시험 fixture 를 고쳤다고 제품 접근성 재고가 흔들리면 안 된다 — 세되 섞지 않는다.
 */
const EXCLUDE_DIRS = ['node_modules', '.expo', 'dist', 'build'];
const TEST_SUFFIX = /\.(test|spec)\.tsx$/;
const TEST_DIR = /(^|\/)(__tests__|tests)\//;
const files = [];        // 제품 — 판정과 소비처 재고는 여기서만 나온다
const testFiles = [];    // 시험 참조 — 따로 센다
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (EXCLUDE_DIRS.includes(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) {
      const rel = relative(idRoot, p).replace(/\\/g, '/');
      (TEST_SUFFIX.test(rel) || TEST_DIR.test(rel) ? testFiles : files).push(p);
    }
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
    const rel = relative(idRoot, f).replace(/\\/g, '/');
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

// ── 공용 컴포넌트 계약 ────────────────────────────────────
// `Button` 처럼 **높이가 padding + 글자로 정해지는** 공용 컴포넌트는 자리마다 판정불가로
// 빠진다. 그런데 그게 앱에서 가장 많이 눌리는 상자다. 크기 variant 를 **한 번** 판정하고
// 소비처를 세어 연결한다.
//
// ⚠ **상한을 만들지 않는다** (솔 검수 `R3 F02`). 초판은 상한을 `2×pv + ceil(fs × 1.4)` 로 두고
//   "상한이 44 미만이면 어떤 글꼴에서도 미달" 이라고 단정했다. 근거가 없다 — `1.4` 는 §4.8 의
//   **기본 행간 권고**이지 글꼴이 그리는 텍스트 상자 높이의 상한이 아니다. 그래서 이 감사는
//   **미달을 단정하지 않는다.**
//
//   하한 = `2×paddingVertical + fontSize`
//     — 가정 A: `lineHeight` 를 명시하지 않은 `Text` 의 상자는 `fontSize` 보다 낮지 않다.
//       **가정이지 증명이 아니다** — 그래서 통과 쪽으로만 쓴다.
// ⚠ **하한이 44 를 넘어도 통과로 닫지 않는다** (솔 검수 `R4 F02`). 두 가지 때문이다 —
//   ① 가정 A 를 "증명이 아니다" 라고 적어 놓고 그것으로 확정 통과를 선언하면 앞뒤가 안 맞는다.
//   ② `Button` 의 호출부 `style` 은 기본 스타일 **뒤에** 붙어 `paddingVertical` 과 `height` 를
//      **덮어 줄일 수 있다.** 이 감사는 호출부 override 를 읽지 않는다. 그러니 하한 49 인
//      `lg` 라도 어떤 소비처가 높이를 줄였는지 정적으로는 모른다.
// 그래서 판정은 전부 **경계**다. 실제 높이는 `S4` 렌더 실측(Android·iOS)이 닫는다.
//
// 경계는 위험이 열려 있는 상태다. 그래서 **모든 variant 의 소비처 ID 와 개수를 래칫한다** —
// 열린 위험이 조용히 퍼지는 것을 막는다. `Button` 이 호출부가 무력화할 수 없는
// `minHeight: 44` 를 갖게 되면(그건 시각 변화라 `S4`) 그때 통과로 닫고 래칫을 푼다.

/**
 * `<Button …>` 소비처를 **여는 태그 전체**로 읽는다 (솔 검수 `R3 F01`).
 *
 * 초판은 `줄마다 /<Button[^>]*size="sm"/` 로 셌다. 세 가지를 놓친다 —
 *   ① 여러 줄로 나눈 태그(`<Button` 과 `size=` 가 다른 줄)
 *   ② `size` 를 안 쓴 자리 — 기본값(`Button.tsx` 의 `size = 'md'`)으로 간다
 *   ③ `size={v}` · `{...props}` 처럼 정적으로 모르는 자리
 * 기본값은 이 파일이 아니라 **`Button.tsx` 에서 읽는다** — 바뀌면 감사가 따라가야 한다.
 */
const SPREAD = /(?:^|\s)\{\s*\.\.\.[A-Za-z_$][\w$]*\s*\}/;
const buttonUses = (defaultSize) => {
  const byVariant = new Map();
  const testByVariant = new Map();
  const dynamic = [];
  let bucket = byVariant;
  const add = (k, at) => { if (!bucket.has(k)) bucket.set(k, []); bucket.get(k).push(at); };
  const productSet = new Set(files);
  for (const f of [...files, ...testFiles]) {
    bucket = productSet.has(f) ? byVariant : testByVariant;
    const text = readFileSync(f, 'utf8');
    const offsets = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') offsets.push(i + 1);
    const lineOf = (idx) => { let lo = 0, hi = offsets.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; };
    const re = /<Button(?![A-Za-z0-9_])/g;
    let m;
    while ((m = re.exec(text))) {
      const body = tagBody(text, m.index);
      const at = `${relative(idRoot, f).replace(/\\/g, '/')}:${lineOf(m.index)}`;
      const lit = body.match(/\bsize\s*=\s*(?:["'](\w+)["']|\{\s*["'](\w+)["']\s*\})/);
      if (lit) { add(lit[1] ?? lit[2], at); continue; }
      if (/\bsize\s*=\s*\{/.test(body) || SPREAD.test(body)) { if (bucket === byVariant) dynamic.push(at); continue; }
      add(defaultSize, at);
    }
  }
  return { byVariant, testByVariant, dynamic };
};

const componentContracts = [];
let dynamicUses = null;
{
  const bt = join(srcRoot, 'src', 'components', 'kit', 'Button.tsx');
  if (existsSync(bt)) {
    const t = readFileSync(bt, 'utf8');
    const d = t.match(/\bsize\s*=\s*'([A-Za-z]+)'/);
    const m = t.match(/const sizes[^=]*=\s*\{([\s\S]*?)\n\s*\};/);
    if (!d) componentContracts.push({ 컴포넌트: 'Button', 판정: '읽기실패', 사유: "기본 size 값(`size = 'md'`)을 못 읽었다 — 기본값을 모르면 size 없는 자리를 배정할 수 없다" });
    else if (!m) componentContracts.push({ 컴포넌트: 'Button', 판정: '읽기실패', 사유: 'sizes 표를 못 읽었다 — 모양이 바뀌었으면 계약을 다시 맞춰라' });
    else {
      const uses = buttonUses(d[1]);
      dynamicUses = uses.dynamic;
      for (const line of m[1].split('\n')) {
        const v = line.match(/(\w+)\s*:\s*\{\s*pv:\s*(\d+),\s*ph:\s*(\d+),\s*fs:\s*(\d+)/);
        if (!v) continue;
        const [, name, pv, ph, fs] = v;
        const lo = 2 * +pv + +fs;
        const at = (uses.byVariant.get(name) ?? []).slice().sort();
        const 시험 = (uses.testByVariant.get(name) ?? []).slice().sort();
        componentContracts.push({ 컴포넌트: `Button size="${name}"`, paddingVertical: +pv, fontSize: +fs,
          높이하한: lo, 기본값여부: name === d[1], 판정: '경계',
          판정사유: lo >= MIN
            ? `하한 ${lo} 는 44 를 넘지만 호출부 style 이 padding·height 를 덮어 줄일 수 있어 정적으로 닫지 않는다 (R4 F02)`
            : `하한 ${lo} < 44 이고 상한의 근거가 없다 — S4 렌더 실측이 닫는다`,
          소비처: at.length, at, 시험참조: 시험.length, 시험참조at: 시험 });
      }
      for (const [name, at] of uses.byVariant) {
        if (componentContracts.some(c => c.컴포넌트 === `Button size="${name}"`)) continue;
        componentContracts.push({ 컴포넌트: `Button size="${name}"`, 판정: '읽기실패',
          사유: 'sizes 표에 없는 size 값을 쓰는 자리가 있다', 소비처: at.length, at: at.slice().sort() });
      }
    }
  }
}
const compOpen = componentContracts.filter(c => c.판정 !== '통과');

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
// 공용 컴포넌트 계약 — 알려진 목록과 양방향으로 맞춘다.
//
// 판정과 높이 하한은 모든 variant 를 대조한다. **소비처 ID 와 개수는 판정이 `통과` 가 아닌
// variant 만** 대조한다 — 열린 위험이 조용히 퍼지는 것을 막는 것이 목적이고, 확정 통과가
// 늘어나는 것은 위험이 아니다. 판정이 통과에서 벗어나는 순간 소비처가 래칫 대상이 된다.
const knownComp = new Map((known.components ?? []).map(c => [c.컴포넌트, c]));
if (known.components === undefined) failures.push('알려진 공용 컴포넌트 목록이 없다 — 래칫이 꺼진 것을 조용히 넘기지 않는다');
else if (componentContracts.length || knownComp.size) {
  const seen = new Set();
  for (const c of componentContracts) {
    seen.add(c.컴포넌트);
    const e = knownComp.get(c.컴포넌트);
    if (!e) { failures.push(`알려지지 않은 공용 컴포넌트 계약 — ${c.컴포넌트} 판정 ${c.판정} · 하한 ${c.높이하한 ?? '?'} · 소비처 ${c.소비처 ?? 0}곳. 목록에 올려라`); continue; }
    if (e.판정 !== c.판정) failures.push(`공용 컴포넌트 ${c.컴포넌트} 판정이 ${e.판정} → ${c.판정} 으로 바뀌었다 — 목록을 갱신하라`);
    if (c.높이하한 !== undefined && e.높이하한 !== c.높이하한) failures.push(`공용 컴포넌트 ${c.컴포넌트} 높이 하한이 ${e.높이하한} → ${c.높이하한} 으로 바뀌었다 — 목록을 갱신하라`);
    if (c.판정 === '통과') continue;
    if (e.소비처 === undefined || !Array.isArray(e.at)) {
      failures.push(`공용 컴포넌트 ${c.컴포넌트} 는 판정이 ${c.판정} 인데 알려진 소비처 목록이 없다 — 열린 위험은 소비처까지 래칫한다`);
      continue;
    }
    if (e.소비처 !== c.소비처) failures.push(`공용 컴포넌트 ${c.컴포넌트} 소비처가 ${e.소비처} → ${c.소비처}곳으로 바뀌었다`);
    const ka = new Set(e.at), ca = new Set(c.at);
    for (const a of c.at) if (!ka.has(a)) failures.push(`새 ${c.컴포넌트} 소비처 — ${a} (판정이 ${c.판정} 인 variant 는 늘리지 않는다)`);
    for (const a of e.at) if (!ca.has(a)) failures.push(`${c.컴포넌트} 소비처가 사라졌다 — ${a} 를 목록에서 빼라`);
  }
  for (const k of knownComp.keys()) if (!seen.has(k)) failures.push(`알려진 공용 컴포넌트 ${k} 가 이제 측정되지 않는다 — 목록에서 빼라`);
}
// `size` 가 변수거나 spread 로 들어오는 자리 — 어느 variant 인지 정적으로 모른다. 따로 래칫한다.
if (dynamicUses !== null) {
  if (known.buttonDynamic === undefined) failures.push('알려진 동적 size 소비처 목록이 없다 — size 가 변수면 어느 variant 인지 정적으로 모른다');
  else {
    const cur = new Set(dynamicUses), prev = new Set(known.buttonDynamic);
    for (const a of dynamicUses) if (!prev.has(a)) failures.push(`새 동적 size 소비처 — ${a} (어느 variant 인지 정적으로 판정할 수 없다)`);
    for (const a of known.buttonDynamic) if (!cur.has(a)) failures.push(`동적 size 소비처가 사라졌다 — ${a} 를 목록에서 빼라`);
  }
}

// ── 측정 출처 결속 (솔 검수 `R3 F01` · `R4 F01`) ────────────────────────────
// `R3` 초판은 **작업 트리에서 잰 수치를 검수 대상 커밋의 증거로 인용했다.** 두 값이 달랐고
// (`8/16/53` 대 `10/14/62`) 검수자가 그걸 잡았다.
//
// `R4` 는 그 결속 자체가 우회 가능하다고 잡았다. 초판은 `startsWith` 로 앞뒤를 비교해서
// **값 없는 `--expect-commit`(빈 문자열은 모든 SHA 의 접두사다)** 과 `<전체SHA>garbage`
// (`want.startsWith(head)` 가 참) 를 통과시켰다. 이제는 —
//   ① 빈 값과 비-hex 와 7자 미만을 **먼저 거부**하고
//   ② `git rev-parse --verify <입력>^{commit}` 으로 **전체 SHA 로 해석**한 뒤
//   ③ HEAD 와 **완전히 같은지**만 본다. 모호한 짧은 SHA 는 ②에서 죽는다.
const git = (args) => { const r = spawnSync('git', args, { cwd: srcRoot, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const headSha = git(['rev-parse', 'HEAD']);
const dirtyRaw = git(['status', '--porcelain', '--', srcRoot, join(root, 'scripts')]);

/**
 * 감사 입력 범위 해시 (솔 `R4` 질문 3 · 솔 `R5 F02` · **페이블 `R6` 차단**).
 *
 * `측정커밋` 에 커밋 SHA 를 적으면 **자기 자신의 SHA 를 자기 안에 적어야 하는** 순환이 생긴다.
 * 대신 **감사가 실제로 읽은 것**을 해시한다 — 파일 경로와 내용, 그리고 **감사기 자신**.
 *
 * ⚠ **내용 sha256 을 쓰면 줄끝을 잰다.** 초판이 그랬고, 페이블의 Windows clean checkout(CRLF)과
 *   내 Linux 체크아웃(LF)에서 값이 갈렸다. 결속이 "이후 무변경" 이 아니라 "어느 OS 에서
 *   받았나" 를 재고 있었다. 그래서 **git blob SHA** 로 바꾼다 —
 *     `sha1("blob " + 길이 + "\0" + CRLF→LF 정규화 내용)`
 *   이것은 `git hash-object` 가 내는 값과 같고(그쪽도 clean 필터로 LF 로 정규화한다),
 *   **git 이 없어도** 계산된다. 시험 하네스가 임시 폴더에서 도는 것과 OS 독립성을 함께 만족한다.
 *
 * ⚠ **제품과 시험을 따로 해시한다** (솔 `R5 F02`). 시험 fixture 한 줄을 고쳤다고 제품 재고가
 *   흔들리면 안 된다. **래칫은 제품 해시에만 건다.**
 */
const h = (b) => createHash('sha256').update(b).digest('hex');
/** git blob id — 줄끝을 정규화하므로 체크아웃한 OS 에 좌우되지 않는다. */
const blobId = (buf) => {
  const lf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${lf.length}\u0000`, 'utf8'), lf])).digest('hex');
};
const hashOf = (list, withSelf) => {
  const parts = list.map(f => `${relative(idRoot, f).replace(/\\/g, '/')}\u0000${blobId(readFileSync(f))}`).sort();
  if (withSelf) parts.push(`\u0000self\u0000${blobId(readFileSync(new URL(import.meta.url)))}`);
  return h(parts.join('\n'));
};
const 제품입력해시 = hashOf(files, true);        // 판정·소비처·래칫의 입력. 감사기 자신을 포함한다
const 시험참조해시 = hashOf(testFiles, false);   // 기록만 한다 — 래칫 대상이 아니다

const 측정 = {
  커밋: headSha ?? '알 수 없음 — git 저장소가 아니다',
  작업트리: dirtyRaw === null ? '알 수 없음' : dirtyRaw === '' ? '깨끗' : `변경 ${dirtyRaw.split(/\r?\n/).length}건`,
  변경목록: dirtyRaw ? dirtyRaw.split(/\r?\n/).slice(0, 20) : [],
  제품입력해시, 시험참조해시,
  해시정의: '감사가 읽은 .tsx 의 "경로\\0git blob SHA" 를 정렬해 이어 붙여 sha256. blob SHA 는 CRLF→LF 정규화 뒤 계산하므로 체크아웃한 OS 에 좌우되지 않는다(페이블 R6 차단 — 내용 sha256 은 줄끝을 쟀다). 제품 해시에는 감사기 자신의 blob SHA 를 더한다. 커밋 SHA 가 아니라 입력을 결속한다. **래칫은 제품 해시에만 건다** — 시험 fixture 변경이 제품 재고를 흔들면 안 된다(솔 R5 F02).',
  결속: opt['expect-commit'] !== undefined ? `--expect-commit=${opt['expect-commit']}` : '없음 — 이 산출물을 커밋 증거로 인용하지 마라',
};
if (opt['expect-commit'] !== undefined) {
  const want = String(opt['expect-commit']).trim();
  if (!/^[0-9a-fA-F]{7,40}$/.test(want))
    failures.push(`--expect-commit 값이 커밋 SHA 가 아니다: '${want}' — 빈 값·비-hex·7자 미만·군더더기가 붙은 값은 받지 않는다`);
  else {
    const resolved = git(['rev-parse', '--verify', '--quiet', `${want.toLowerCase()}^{commit}`]);
    if (!resolved) failures.push(`--expect-commit ${want} 를 커밋으로 해석할 수 없다 — 없는 개체이거나 모호한 짧은 SHA 다`);
    else if (!headSha) failures.push('HEAD 를 읽을 수 없다 — git 저장소가 아니다');
    else if (resolved !== headSha) failures.push(`측정 커밋 불일치 — 요구 ${resolved} · 실제 ${headSha}. 검수 대상 커밋의 clean checkout 에서 재라`);
    else if (dirtyRaw !== '') failures.push(`작업 트리가 깨끗하지 않다 (${측정.작업트리}) — 커밋에 결속된 수치가 아니다. clean checkout 에서 재라`);
  }
}
// 입력 범위 해시 래칫 — 알려진 목록이 어느 입력에서 확정됐는지 게이트가 직접 본다.
if (known.제품입력해시 === undefined)
  failures.push(`알려진 제품입력해시가 없다 — 목록이 어느 입력에서 나왔는지 결속되지 않는다. 지금 값은 ${제품입력해시}`);
else if (known.제품입력해시 !== 제품입력해시)
  failures.push(`제품 감사 입력이 바뀌었다 — 목록 ${String(known.제품입력해시).slice(0, 12)} · 지금 ${제품입력해시.slice(0, 12)}. 제품 .tsx 나 감사기가 바뀌었다. 다시 재고 목록과 제품입력해시를 함께 갱신하라`);

const out = {
  manifest: {
    script: 'scripts/touch-target-audit.mjs',
    minTouchTarget: MIN,
    판정식: '유효폭 = width + hitSlop.left + hitSlop.right · 유효높이 = height + hitSlop.top + hitSlop.bottom · 둘 다 44 이상',
    한계: '부모 경계로 잘리는지, 이웃 터치 영역과 겹치는지는 정적 분석으로 못 본다 — 렌더 감사(S4)의 몫이다.',
    측정,
    공용컴포넌트판정식: '하한 = 2×paddingVertical + fontSize (가정 A: lineHeight 를 명시하지 않은 Text 의 상자는 fontSize 보다 낮지 않다). 상한의 근거가 없어 미달을 단정하지 않고, 호출부 style 이 padding·height 를 덮어 줄일 수 있어 통과로도 닫지 않는다 — 전부 경계이고 S4 렌더 실측이 닫는다(R4 F02).',
    파일선정: '제품 = apps/mobile 의 .tsx 에서 .test/.spec.tsx 와 tests·__tests__ 폴더를 뺀 것. 시험 fixture 는 따로 세고 제품 재고와 섞지 않는다(R4 F04).',
    generatedAt: new Date().toISOString(), node: process.version,
  },
  summary: { 파일: files.length, 누를수있는상자: rows.length, 판정: judged.length, 통과: judged.length - short.length,
    미달: short.length, 판정불가: rows.length - judged.length,
    공용컴포넌트: componentContracts.length, 공용컴포넌트열린것: compOpen.length,
    Button동적size소비처: dynamicUses === null ? '측정 안 함' : dynamicUses.length },
  failures, componentContracts, Button동적size소비처: dynamicUses ?? [], rows,
};
if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`터치 영역 — 판정 ${judged.length}자리 · 통과 ${judged.length - short.length} · **미달 ${short.length}** · 판정불가 ${rows.length - judged.length}(래칫 대상)`);
for (const c of componentContracts) console.log(`  공용 — ${c.컴포넌트} 높이 하한 ${c.높이하한 ?? '?'} → ${c.판정} · 제품 소비처 ${c.소비처 ?? 0}곳 · 시험 참조 ${c.시험참조 ?? 0}곳`);
if (dynamicUses !== null) console.log(`  공용 — Button size 동적/spread ${dynamicUses.length}곳 (정적 판정 불가)`);
console.log(`  측정 — 커밋 ${측정.커밋.slice(0, 12)} · 작업 트리 ${측정.작업트리} · 결속 ${측정.결속}`);
if (failures.length) {
  console.error('\n터치 영역 래칫 FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('터치 영역 래칫 PASS — 알려진 미달 목록과 일치한다');
