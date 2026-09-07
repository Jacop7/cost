#!/usr/bin/env node
/**
 * full-page-flow-prototype-token-map-check.mjs
 *   — 측정된 모든 값이 토큰 매핑표에 자리를 가지고 있는지 판정한다.
 *
 * 왜 필요한가
 *   기획서 `P1` 의 완료 조건은 "미매핑 0건" 이다. 그런데 그 판정을 사람이 눈으로 하면
 *   빠진 값을 못 본다 — 측정된 간격만 685관계 · 25값이고 색은 40종이다.
 *   이 스크립트가 `design-audit.json` 의 모든 값을 매핑표와 대조해 **자리 없는 값**을 센다.
 *
 * 판정 규칙
 *  1. 값은 네 자리 중 하나에 있어야 한다 —
 *     primitive 스케일 안 / converge 로 보낼 곳이 정해짐 / componentOwned 고유값 /
 *     defects 로 분류된 정정 대상. 넷 다 아니면 **미매핑**이다.
 *  2. `converge` 가 가리키는 목적지도 primitive 안에 있어야 한다.
 *     "15 → 어딘가" 라고만 적어 두면 매핑이 아니다.
 *  3. 매핑표가 **측정에 없는 값을 수렴 대상으로 적고 있으면** 그것도 실패로 본다.
 *     낡은 표를 들고 있으면 미매핑이 아니라 표가 틀린 것이다. `render-audit` 의
 *     알려진 미해결 목록과 같은 양방향 대조다.
 *  4. 높이는 세 버킷으로 나뉜다 — 컨트롤 · 행(실행서 §3.4 의 60/76/92) · 카드.
 *     그리고 세 가지는 아예 매핑 대상이 아니다 — 정수가 아닌 높이(min-height + 내용),
 *     shell 안 `<input>` 자신의 높이(측정기 한계), 내용에 따라 늘어난 카드 높이.
 *     제외 이유는 매핑표에 값마다 적혀 있어야 한다.
 *  5. **브라우저 기본값(`source: 'ua'`)은 매핑 대상이 아니다.** 아무도 고르지 않은 값을
 *     토큰 후보로 올리면 안 된다. 빼되 개수를 남겨, 뺀 것이 얼마인지 보이게 한다.
 *  6. 행간·자간도 함께 센다. 버린 축은 "미매핑 0" 이라고 말할 수 없다.
 *  7. **열린 결정에 걸린 축의 값은 "매핑됨" 이 아니라 "잠정" 이다.** `open` 에 나열된
 *     결정이 어느 축을 붙들고 있는지 읽어, 그 축의 값을 `provisionallyMapped` 로 따로 센다.
 *     이걸 안 하면 열린 결정의 값을 잠정 primitive 로 넣어 두는 것만으로 미매핑이 0 이 되고,
 *     **"미매핑 0" 이 "확정 0" 처럼 읽힌다.** 0 두 개는 다른 뜻이다.
 *  8. `status` 가 `PROVISIONAL` 이면 결과를 보고만 하고 종료 코드를 0 으로 둔다.
 *     검수 확정 후 `CONFIRMED` 로 바꾸면 미매핑 1건에도 실패한다.
 *
 * 세는 단위
 *   `design-audit.json` 의 `n` 은 **렌더 관측 수**이지 소스 선언 수가 아니다(기획서 §1.0).
 *   그래서 이 검사는 **값의 종류**로 판정하고 관측 수는 참고로만 출력한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const auditPath = resolve(args[0] ?? 'docs/prototypes/full-page-flow-prototype-design-audit.json');
const mapPath   = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-token-map.json');
const outPath   = resolve(args[2] ?? 'docs/prototypes/full-page-flow-prototype-token-map-check.json');
const sha = b => createHash('sha256').update(b).digest('hex');

const auditBytes = readFileSync(auditPath), mapBytes = readFileSync(mapPath);
const audit = JSON.parse(auditBytes.toString('utf8'));
const map = JSON.parse(mapBytes.toString('utf8'));

const P = map.primitive, C = map.converge, O = map.componentOwned, D = map.defects;
// tokens.ts 에 없는 값은 primitive 가 아니라 **확장 제안**이다 ([9]).
// 목적지로 허용하되 따로 세어, 정본 확장 승인이 필요한 범위를 드러낸다.
const X = map.proposedTokensExtension ?? {};
const ext = { hits: {}, axes: new Set() };
const inPrimitiveOrExt = (axis, value) => {
  const prim = P[axis], pext = X[axis];
  const has = (bag) => Array.isArray(bag) ? bag.includes(value)
    : (bag && typeof bag === 'object') ? Object.values(bag).some(v => String(v) === String(value)) || Object.keys(bag).includes(String(value))
    : false;
  if (has(prim)) return 'primitive';
  if (has(pext)) { ext.axes.add(axis); ext.hits[axis] = (ext.hits[axis] ?? 0) + 1; return 'extension'; }
  return null;
};
const num = v => Number.parseFloat(v);
const owned = (axis, v) => (O[axis] ?? []).some(x => String(x.value) === String(v));
const nudgeUsed = new Set();
const failures = [], unmapped = { space: [], radius: [], typeSize: [], typeWeight: [], color: [], shadow: [], icon: [], control: [], lineHeight: [], letterSpacing: [] };
const used = { space: new Set(), radius: new Set(), typeSize: new Set(), color: new Set(), shadow: new Set() };

// --- 간격 ---
// 키 형식: kind|side|value|parent>slot|source
// **브라우저 기본값(ua)은 디자인 값이 아니다.** 아무도 고르지 않은 값을 토큰 후보로
// 올리면 안 되므로 매핑 대상에서 빼고 따로 센다.
const spaceValues = new Map();
let uaSpaceObs = 0; const uaSpaceValues = new Set();
for (const e of audit.space) {
  const p = e.key.split('|'); const v = p[2], src = p[4];
  if (src === 'ua') { uaSpaceObs += e.n; uaSpaceValues.add(v); continue; }
  spaceValues.set(v, (spaceValues.get(v) ?? 0) + e.n);
}
for (const [v, n] of spaceValues) {
  const x = num(v);
  if (P.space.includes(x)) continue;
  if ((P.nudge ?? []).includes(x)) { nudgeUsed.add(v); continue; }   // D-4 가 부결되면 여기가 미매핑이 된다
  if (Object.prototype.hasOwnProperty.call(C.space, v)) {
    used.space.add(v);
    if (!P.space.includes(C.space[v])) failures.push(`space ${v}px → ${C.space[v]} 는 primitive space 스케일에 없다`);
    continue;
  }
  if (owned('space', v)) continue;
  unmapped.space.push({ value: v, observations: n });
}

// --- 반경 ---
const radiusValues = new Map();
for (const e of audit.radius) { const p = e.key.split('|'); if (p[2] === 'ua') continue;
  radiusValues.set(p[0], (radiusValues.get(p[0]) ?? 0) + e.n); }
const radiusAllowed = new Set(Object.values(P.radius).map(String));
for (const [v, n] of radiusValues) {
  // 다중 값(시트 상단 등)은 각 항을 따로 본다
  const parts = v.split(/\s+/);
  const unresolved = [];
  for (const part of parts) {
    if (part === '0px') continue;
    const raw = part.replace('px', '');
    if (radiusAllowed.has(raw) || radiusAllowed.has(part)) continue;
    if (Object.prototype.hasOwnProperty.call(C.radius, raw)) {
      used.radius.add(raw);
      if (!radiusAllowed.has(String(C.radius[raw]))) failures.push(`radius ${raw} → ${C.radius[raw]} 는 primitive radius 에 없다`);
      continue;
    }
    if (owned('radius', raw)) continue;
    unresolved.push(part);
  }
  if (unresolved.length) unmapped.radius.push({ value: v, observations: n, unresolved });
}

// --- 타이포 ---
const sizeValues = new Map(), weightValues = new Map(), lineHeights = new Map(), letterSpacings = new Map();
for (const e of audit.typo) {
  const [size, weight, lh, ls] = e.key.split('|')[2].split('/');
  lineHeights.set(lh, (lineHeights.get(lh) ?? 0) + e.n);
  letterSpacings.set(ls, (letterSpacings.get(ls) ?? 0) + e.n);
  const s = size.replace('px', '');
  sizeValues.set(s, (sizeValues.get(s) ?? 0) + e.n);
  weightValues.set(weight, (weightValues.get(weight) ?? 0) + e.n);
}
for (const [v, n] of sizeValues) {
  const x = num(v);
  if (P.typeSize.includes(x)) continue;
  if (Object.prototype.hasOwnProperty.call(C.typeSize, v)) {
    used.typeSize.add(v);
    const dest = C.typeSize[v];
    if (typeof dest === 'number' && !P.typeSize.includes(dest)) failures.push(`typeSize ${v} → ${dest} 는 스케일에 없다`);
    continue;
  }
  if ((D.uaCheckbox?.values ?? []).includes(v + 'px') || (D.uaCheckbox?.values ?? []).includes(v)) continue;
  unmapped.typeSize.push({ value: v, observations: n });
}
for (const [w, n] of weightValues) {
  if (P.typeWeight.includes(Number(w))) continue;
  if (String(D.inheritedBolder?.computedWeight) === String(w)) continue;   // 정정 대상. 토큰 자리가 아니다
  unmapped.typeWeight.push({ value: w, observations: n });
}

// --- 행간 · 자간 ---
const lhAllowed = new Set(Object.keys(X.lineHeight ?? P.lineHeight ?? {}));
if (X.lineHeight) { ext.axes.add('lineHeight'); }
for (const [v, n] of lineHeights) {
  if (String(D.unspecifiedLineHeight?.value) === v) continue;   // 정정 대상. 토큰 자리가 아니다
  if (Object.prototype.hasOwnProperty.call(C.lineHeight ?? {}, v)) {
    if (!lhAllowed.has(C.lineHeight[v])) failures.push(`lineHeight ${v} → ${C.lineHeight[v]} 는 스케일에 없다`);
    continue;
  }
  unmapped.lineHeight.push({ value: v, observations: n });
}
const lsSrc = X.letterSpacing ?? P.letterSpacing ?? {};
const lsAllowed = new Set(Object.values(lsSrc).filter(v => typeof v === 'number').map(x => x === 0 ? 'normal' : x + 'px'));
if (X.letterSpacing) ext.axes.add('letterSpacing');
for (const [v, n] of letterSpacings) if (!lsAllowed.has(v)) unmapped.letterSpacing.push({ value: v, observations: n });

// --- 색 ---
const colorValues = new Map();
let uaColorObs = 0;
for (const e of audit.color) { const p = e.key.split('|');
  if (p[2] === 'ua') { uaColorObs += e.n; continue; }
  colorValues.set(p[1], (colorValues.get(p[1]) ?? 0) + e.n); }
const paletteValues = new Set(Object.values(P.color));
const defectColors = new Set(D.uaButtonReset?.values ?? []);
for (const [v, n] of colorValues) {
  if (paletteValues.has(v)) continue;
  if (Object.prototype.hasOwnProperty.call(C.color, v)) {
    used.color.add(v);
    if (!Object.prototype.hasOwnProperty.call(P.color, C.color[v])) failures.push(`color ${v} → ${C.color[v]} 는 팔레트에 없다`);
    continue;
  }
  if (defectColors.has(v)) continue;
  unmapped.color.push({ value: v, observations: n });
}

// --- 그림자 ---
const shadowValues = new Map();
for (const e of audit.shadow) shadowValues.set(e.key, (shadowValues.get(e.key) ?? 0) + e.n);
const shadowAllowed = new Set([...Object.values(P.shadow ?? {}), ...Object.values(X.shadow ?? {})].filter(v => typeof v === 'string' && v.includes('px')));
if (X.shadow) ext.axes.add('shadow');
for (const [v, n] of shadowValues) {
  if (shadowAllowed.has(v)) continue;
  if (Object.prototype.hasOwnProperty.call(C.shadow, v)) {
    used.shadow.add(v);
    const shadowRoles = { ...(P.shadow ?? {}), ...(X.shadow ?? {}) };
    if (!Object.prototype.hasOwnProperty.call(shadowRoles, C.shadow[v])) failures.push(`shadow → ${C.shadow[v]} 는 primitive/확장 shadow 에 없다`);
    continue;
  }
  unmapped.shadow.push({ value: v, observations: n });
}

// --- 아이콘 · 컨트롤 높이 (역할 매핑이므로 '가장 가까운 단계' 로 판정하지 않고 목록만 낸다) ---
const iconSizes = new Map();
for (const e of audit.icon) { const s = e.key.split('|')[0].split('/')[0].replace('px', ''); iconSizes.set(s, (iconSizes.get(s) ?? 0) + e.n); }
const iconAllowed = P.iconSize ?? X.iconSize ?? [];
if (X.iconSize) ext.axes.add('iconSize');
for (const [v, n] of iconSizes) {
  if (iconAllowed.includes(num(v))) continue;
  if (Object.prototype.hasOwnProperty.call(C.iconSize ?? {}, v)) {
    if (!iconAllowed.includes(C.iconSize[v])) failures.push(`iconSize ${v} → ${C.iconSize[v]} 는 스케일에 없다`);
    continue;
  }
  unmapped.icon.push({ value: v, observations: n });
}
const ctlHeights = new Map();
for (const e of audit.control) { const h = e.key.split('|')[1].replace(/^h/, ''); ctlHeights.set(h, (ctlHeights.get(h) ?? 0) + e.n); }
const EX = map.excluded ?? {};
const excludedHeights = new Set([
  ...(EX.nonIntegerHeight?.values ?? []),
  ...(EX.inputInsideShell?.values ?? []),
  ...(EX.contentDrivenCardHeight?.values ?? []),
].map(String));
for (const [v, n] of ctlHeights) {
  const x = num(v);
  if (excludedHeights.has(v)) continue;
  const ctlAllowed = P.controlHeight ?? X.controlHeight ?? [];
  const rowAllowed = P.rowHeight ?? X.rowHeight ?? [];
  if (X.controlHeight) ext.axes.add('controlHeight');
  if (ctlAllowed.includes(x) || rowAllowed.includes(x)) continue;
  if (Object.prototype.hasOwnProperty.call(C.controlHeight ?? {}, v)) {
    if (!(P.controlHeight ?? X.controlHeight ?? []).includes(C.controlHeight[v])) failures.push(`controlHeight ${v} → ${C.controlHeight[v]} 는 스케일에 없다`);
    continue;
  }
  if (Object.prototype.hasOwnProperty.call(C.rowHeight ?? {}, v)) {
    if (!(P.rowHeight ?? X.rowHeight ?? []).includes(C.rowHeight[v])) failures.push(`rowHeight ${v} → ${C.rowHeight[v]} 는 스케일에 없다`);
    continue;
  }
  if (owned('controlHeight', v) || owned('cardHeight', v)) continue;
  unmapped.control.push({ value: v, observations: n });
}

// --- 양방향: 매핑표가 측정에 없는 값을 들고 있는가 ---
const stale = [];
for (const v of Object.keys(C.space))    if (!spaceValues.has(v))  stale.push(`converge.space ${v} 는 측정에 없다`);
for (const v of Object.keys(C.typeSize)) if (!sizeValues.has(v))   stale.push(`converge.typeSize ${v} 는 측정에 없다`);
for (const v of Object.keys(C.color))    if (!colorValues.has(v))  stale.push(`converge.color ${v} 는 측정에 없다`);
for (const v of Object.keys(C.shadow))   if (!shadowValues.has(v)) stale.push(`converge.shadow ${v} 는 측정에 없다`);
for (const v of Object.keys(C.radius)) {
  let seen = false;
  for (const k of radiusValues.keys()) if (k.split(/\s+/).some(p => p.replace('px', '') === v)) { seen = true; break; }
  if (!seen) stale.push(`converge.radius ${v} 는 측정에 없다`);
}

for (const v of Object.keys(C.lineHeight ?? {}))    if (!lineHeights.has(v)) stale.push(`converge.lineHeight ${v} 는 측정에 없다`);
for (const v of Object.keys(C.iconSize ?? {}))      if (!iconSizes.has(v))  stale.push(`converge.iconSize ${v} 는 측정에 없다`);
for (const v of Object.keys(C.controlHeight ?? {})) if (!ctlHeights.has(v)) stale.push(`converge.controlHeight ${v} 는 측정에 없다`);
for (const v of Object.keys(C.rowHeight ?? {}))     if (!ctlHeights.has(v)) stale.push(`converge.rowHeight ${v} 는 측정에 없다`);

// 열린 결정이 붙들고 있는 축을 모은다 ([7])
const openAxes = new Map();
for (const [key, val] of Object.entries(map.open ?? {})) {
  if (key === 'note' || typeof val !== 'object') continue;
  for (const axis of (val['축'] ?? [])) {
    if (!openAxes.has(axis)) openAxes.set(axis, []);
    openAxes.get(axis).push(key);
  }
}
const AXIS_COUNT = { color: colorValues.size, typeWeight: weightValues.size,
  lineHeight: lineHeights.size, shadow: shadowValues.size, space: spaceValues.size,
  radius: radiusValues.size, typeSize: sizeValues.size };
const provisionallyMapped = [...openAxes].map(([axis, decisions]) => ({
  axis, decisions, valueKinds: AXIS_COUNT[axis] ?? null }));

const totalUnmapped = Object.values(unmapped).reduce((a, b) => a + b.length, 0);
const result = {
  manifest: {
    generatedAt: new Date().toISOString(), schemaVersion: 1,
    script: { name: basename(new URL(import.meta.url).pathname), sha256: sha(readFileSync(new URL(import.meta.url))) },
    designAudit: { path: basename(auditPath), sha256: sha(auditBytes), targetSha256: audit.manifest.target.sha256, designSyncId: audit.manifest.target.designSyncId },
    tokenMap: { path: basename(mapPath), sha256: sha(mapBytes), status: map.status },
    rules: {
      '자리': 'primitive · converge · componentOwned · defects 넷 중 하나에 있어야 한다',
      '목적지': 'converge 가 가리키는 곳도 primitive 안에 있어야 한다',
      '양방향': '매핑표가 측정에 없는 값을 들고 있으면 표가 낡은 것이다',
      '단위': '판정은 값의 종류로 한다. 관측 수는 참고다(기획서 §1.0)',
    },
  },
  summary: {
    status: map.status,
    unmappedCount: totalUnmapped,
    unmappedByAxis: Object.fromEntries(Object.entries(unmapped).map(([k, v]) => [k, v.length])),
    nudgeValuesUsed: [...nudgeUsed].sort((a, b) => num(a) - num(b)),
    uaExcluded: { spaceObservations: uaSpaceObs, spaceValues: [...uaSpaceValues].sort((a,b)=>num(a)-num(b)), colorObservations: uaColorObs },
    lineHeightKinds: lineHeights.size, letterSpacingKinds: letterSpacings.size,
    provisionallyMapped,
    tokensExtensionRequired: [...ext.axes].sort(),
    confirmedAxes: ['space', 'radius', 'typeSize', 'icon', 'control']
      .filter(a => !openAxes.has(a)),
    mapFailures: failures.length,
    staleMapEntries: stale.length,
  },
  unmapped, failures, stale, openDecisions: map.open ?? {}, retiredDecisions: map.retired ?? {},
  lineHeight: [...lineHeights].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ value: v, observations: n })),
  letterSpacing: [...letterSpacings].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ value: v, observations: n })),
};
writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ manifest: result.manifest, summary: result.summary }, null, 1));
for (const [axis, rows] of Object.entries(unmapped)) if (rows.length) {
  console.log(`\n미매핑 ${axis} ${rows.length}종`);
  for (const r of rows) console.log(`   ${JSON.stringify(r)}`);
}
if (failures.length) { console.log('\n매핑표 오류'); failures.forEach(f => console.log('   ' + f)); }
if (stale.length)    { console.log('\n낡은 매핑 항목'); stale.forEach(f => console.log('   ' + f)); }

const hardFail = map.status === 'CONFIRMED' && (totalUnmapped > 0 || failures.length > 0 || stale.length > 0);
process.exit(hardFail ? 1 : 0);
