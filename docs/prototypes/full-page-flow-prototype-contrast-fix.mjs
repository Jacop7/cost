#!/usr/bin/env node
/**
 * contrast-fix.mjs — AA 를 못 넘는 색 쌍마다 **가장 가까운 통과 색**을 낸다.
 *
 * 왜
 *   "어느 초록으로 할까" 는 답할 수 없는 질문이다. "이 초록은 흰 배경에서 3.39:1 이고
 *   AA 를 넘으려면 명도를 이만큼 낮춰야 한다" 는 답할 수 있는 질문이다.
 *   대비 측정만으로는 결정이 안 되고, **통과선까지의 거리**가 있어야 결정이 된다.
 *
 * 규칙
 *  - 전경색의 색상(hue)과 채도(saturation)를 유지한 채 **명도(lightness)만** 움직인다.
 *    색을 바꾸는 것이 아니라 같은 색의 진하기를 조절하는 것이므로 브랜드 정체성이 덜 흔들린다.
 *  - 배경이 밝으면 어둡게, 어두우면 밝게 움직인다.
 *  - **전경이 흰색이면 전경을 움직이지 않고 배경을 움직인다.** 채움 버튼의 흰 글자를
 *    회색으로 만드는 것은 답이 아니다 — 버튼 색을 진하게 하는 것이 답이다.
 *  - 0.5% 단위로 이분 탐색해 기준을 처음 넘는 지점을 낸다.
 *  - 기준은 WCAG 2.x AA — 일반 텍스트 4.5:1, 큰 글자(24px 이상 또는 18.66px&700 이상) 3:1.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';

const auditPath = resolve(process.argv[2] ?? 'design-audit.json');
const outPath = resolve(process.argv[3] ?? 'contrast-fix.json');
const bytes = readFileSync(auditPath);
const audit = JSON.parse(bytes.toString('utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');

const parse = v => { const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(v); return m ? { r: +m[1], g: +m[2], b: +m[3] } : null; };
const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05); };
const hex = c => '#' + [c.r, c.g, c.b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();

// RGB ↔ HSL
const toHSL = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4); h /= 6; }
  return { h, s, l }; };
const toRGB = ({ h, s, l }) => { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  if (!s) { const v = l * 255; return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return { r: f(p, q, h + 1 / 3) * 255, g: f(p, q, h) * 255, b: f(p, q, h - 1 / 3) * 255 }; };

const nearestPassing = (fg, bg, target) => {
  const hsl = toHSL(fg);
  const bgLum = lum(bg);
  const darker = bgLum > 0.18;              // 밝은 배경이면 전경을 어둡게
  let lo = darker ? 0 : hsl.l, hi = darker ? hsl.l : 1;
  let best = null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const c = toRGB({ ...hsl, l: mid });
    if (ratio(c, bg) >= target) { best = { ...c, l: mid }; if (darker) lo = mid; else hi = mid; }
    else { if (darker) hi = mid; else lo = mid; }
  }
  if (!best) return null;
  return { hex: hex(best), ratio: Math.round(ratio(best, bg) * 100) / 100,
    lightnessFrom: Math.round(hsl.l * 1000) / 10, lightnessTo: Math.round(best.l * 1000) / 10 };
};

const rows = [];
for (const e of audit.contrast) {
  const [pair, r, size, verdict] = e.key.split('|');
  const [fgs, bgs] = pair.split(' on ');
  const fg = parse(fgs), bg = parse(bgs);
  if (!fg || !bg) continue;
  const target = size === 'large' ? 3 : 4.5;
  const cur = Math.round(ratio(fg, bg) * 100) / 100;
  const fgHsl = toHSL(fg);
  const fgIsWhiteish = fgHsl.l > 0.9 && fgHsl.s < 0.15;
  // 흰 글자는 움직이지 않는다. 대신 배경을 움직여 통과시킨다.
  const fixFg = cur >= target ? null : (fgIsWhiteish ? null : nearestPassing(fg, bg, target));
  const fixBg = cur >= target ? null : (fgIsWhiteish ? nearestPassing(bg, fg, target) : null);
  rows.push({ fg: hex(fg), bg: hex(bg), size, observations: e.n, ratio: cur,
    target, passAA: cur >= target, moved: fgIsWhiteish ? 'background' : 'foreground',
    fix: fixFg, fixBackground: fixBg,
    fixAAA: (cur >= (size === 'large' ? 4.5 : 7) || fgIsWhiteish) ? null : nearestPassing(fg, bg, size === 'large' ? 4.5 : 7),
    where: e.ex });
}
rows.sort((a, b) => b.observations - a.observations);
const failing = rows.filter(r => !r.passAA);
const result = {
  manifest: { generatedAt: new Date().toISOString(), schemaVersion: 1,
    script: { name: basename(new URL(import.meta.url).pathname), sha256: sha(readFileSync(new URL(import.meta.url))) },
    designAudit: { path: basename(auditPath), sha256: sha(bytes),
      targetSha256: audit.manifest.target.sha256, designSyncId: audit.manifest.target.designSyncId },
    rules: { '기준': 'WCAG 2.x AA — 일반 4.5:1, 큰 글자(24px 이상 또는 18.66px&700 이상) 3:1',
      '수정안': '색상·채도를 유지한 채 명도만 움직여 기준을 처음 넘는 지점을 낸다. 색을 바꾸는 것이 아니라 같은 색의 진하기를 조절한다',
      '방향': '배경이 밝으면 전경을 어둡게, 어두우면 밝게' } },
  summary: { pairs: rows.length, failingPairs: failing.length,
    totalObservations: rows.reduce((a, b) => a + b.observations, 0),
    failingObservations: failing.reduce((a, b) => a + b.observations, 0) },
  rows,
};
console.log(JSON.stringify(result.summary, null, 1));
// D-1′ 비교 — 실행서·프로토타입 값과 tokens.ts 값 중 어느 쪽이 대비가 나은가
const D1 = [
  { role: 'green',     doc: '#0E9F6E', code: '#15B374' },
  { role: 'amberText', doc: '#B76E00', code: '#E07A00' },
  { role: 'blueTint',  doc: '#EAF3FF', code: '#EBF3FE' },
];
const white = { r: 255, g: 255, b: 255 };
const hexToRgb = h => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
result.d1Comparison = D1.map(x => {
  const isTint = x.role.endsWith('Tint');
  const on = isTint ? null : white;
  const row = { role: x.role, doc: x.doc, code: x.code, note: isTint ? '배경색이라 전경과 짝지어야 비교된다' : '흰 배경 기준' };
  if (on) {
    row.docRatio = Math.round(ratio(hexToRgb(x.doc), on) * 100) / 100;
    row.codeRatio = Math.round(ratio(hexToRgb(x.code), on) * 100) / 100;
    row.better = row.docRatio >= row.codeRatio ? 'doc' : 'code';
    row.docPassesAA = row.docRatio >= 4.5;
    row.codePassesAA = row.codeRatio >= 4.5;
    row.minimumPassing = nearestPassing(hexToRgb(row.better === 'doc' ? x.doc : x.code), on, 4.5)?.hex ?? null;
  }
  return row;
});
console.log('\n=== D-1′ 비교 — 실행서/프로토타입 값 vs tokens.ts 값 (흰 배경) ===');
for (const r of result.d1Comparison) {
  if (!r.docRatio) { console.log(`  ${r.role.padEnd(10)} ${r.doc} vs ${r.code}  — ${r.note}`); continue; }
  console.log(`  ${r.role.padEnd(10)} 문서 ${r.doc} ${String(r.docRatio).padStart(5)}:1 ${r.docPassesAA?'AA':'FAIL'}` +
    `  |  코드 ${r.code} ${String(r.codeRatio).padStart(5)}:1 ${r.codePassesAA?'AA':'FAIL'}` +
    `  → 더 나은 쪽 ${r.better}, AA 최소 ${r.minimumPassing}`);
}

console.log('\n=== AA 실패 쌍과 가장 가까운 통과 색 ===');
for (const r of failing) {
  const f = r.fix ?? r.fixBackground;
  const what = r.moved === 'background' ? '배경' : '글자';
  console.log(`${String(r.observations).padStart(5)}회  ${r.fg} on ${r.bg}  ${String(r.ratio).padStart(5)}:1 → ` +
    (f ? `${what} ${f.hex} (${f.ratio}:1, 명도 ${f.lightnessFrom}%→${f.lightnessTo}%)` : '(불가)'));
  console.log(`        ${r.where[0] ?? ''}`);
}
writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n');
