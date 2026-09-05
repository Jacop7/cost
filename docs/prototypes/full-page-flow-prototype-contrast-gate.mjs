// 색 대비 게이트 — **절대 기준**으로 본다 (페이블 요청 2 · W1 종결).
//
// 왜 문서 계약이 아니라 게이트인가: §8.2 는 "표면 색을 바꾸는 변경은 경계값 셋의
// 재검산을 동반한다" 를 계약으로 남겼다. 그런데 문서 계약은 표면 색이 바뀌는 커밋에서
// 아무것도 하지 않는다. 승인된 값 중 셋이 AA 선에 여유 0 으로 붙어 있으므로
// (흰 on #1470F5 = 4.50 · #66717E on #F2F4F6 = 4.50 · #0A68EE on #F2F4F6 = 4.51)
// 표면을 한 톤만 바꿔도 셋 다 미달로 떨어진다.
//
// 기준은 저장된 baseline 이 아니라 **절대값**이다 — 4.5:1(글자) · 3:1(비텍스트).
// baseline 비교로 두면 바뀐 값이 새 baseline 이 되어 조용히 통과한다.
// 4.50~4.55 는 통과시키되 `boundary: true` 로 표시한다. 여유를 만드는 것은 별도 결정이다.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const contractPath = resolve(args[0] ?? 'docs/prototypes/full-page-flow-prototype-contrast-contract.json');
const outPath      = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-contrast-gate.json');
const contractBytes = readFileSync(contractPath);
const C = JSON.parse(contractBytes.toString('utf8'));

// WCAG 2.x 상대 휘도.
const hex = (h) => {
  const s = h.replace('#', '');
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16) / 255);
};
const lum = (h) => {
  const [r, g, b] = hex(h).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const round2 = (n) => Math.round(n * 100) / 100;

const TEXT_MIN = 4.5, NONTEXT_MIN = 3.0, BOUNDARY_HI = 4.55;
const rows = [], failures = [];
// 알려진 열린 조합 — 소유자 결정 대기. 크기까지 묶어 두므로 더 나빠지면 FAIL 이다.
const OPEN = new Map((C.열린 ?? []).map(o => [`${o.fg.toUpperCase()}|${o.bg.toUpperCase()}`, o]));
const openSeen = new Set();

const push = (역할, fg, bg, kind, 표면이름) => {
  const r = round2(ratio(fg, bg));
  const min = kind === 'text' ? TEXT_MIN : NONTEXT_MIN;
  const pass = r >= min;
  const boundary = kind === 'text' && r >= TEXT_MIN && r <= BOUNDARY_HI;
  const k = `${fg.toUpperCase()}|${bg.toUpperCase()}`;
  const open = !pass && kind === 'text' ? OPEN.get(k) : undefined;
  rows.push({ 역할, fg, bg, 표면: 표면이름 ?? null, kind, ratio: r, min, pass, boundary, open: !!open });
  if (!pass && open) {
    openSeen.add(k);
    if (r < open.ratio - 0.005) failures.push(`${역할} ${fg} on ${bg} = ${r.toFixed(2)} — 열린 조합이지만 기록된 ${open.ratio} 보다 **나빠졌다**`);
  } else if (!pass) {
    failures.push(`${역할} ${fg} on ${bg} = ${r.toFixed(2)} — ${kind === 'text' ? '글자' : '비텍스트'} 기준 ${min} 미달`);
  }
};

for (const [surfName, surf] of Object.entries(C.surfaces))
  for (const [role, fg] of Object.entries(C.text)) push(role, fg, surf, 'text', surfName);
for (const p of C.onColor ?? []) push(p.역할, p.fg, p.bg, p.kind ?? 'text');
for (const p of C.nonText ?? []) push(p.역할, p.fg, p.bg, 'nonText');
for (const p of C.componentSurfaces ?? []) push(p.역할, p.fg, p.bg, p.kind ?? 'text');

const boundaries = rows.filter(r => r.boundary);
// 사라진 열린 조합은 조용히 지나가면 안 된다 — 좋아졌으면 목록에서 빼야 하고,
// 조합 자체가 없어졌으면 그것도 계약 변경이다.
for (const [k, o] of OPEN) if (!openSeen.has(k)) failures.push(`열린 조합 ${o.fg} on ${o.bg} 이(가) 이번 검사에 나타나지 않았다 — 해결됐으면 목록에서 빼고, 조합이 없어졌으면 사유를 적어라`);
const out = {
  manifest: {
    script: 'docs/prototypes/full-page-flow-prototype-contrast-gate.mjs',
    scriptSha256: sha(readFileSync(new URL(import.meta.url))),
    contractSha256: sha(contractBytes),
    node: process.version, generatedAt: new Date().toISOString(),
    기준: `글자 ${TEXT_MIN}:1 · 비텍스트 ${NONTEXT_MIN}:1 — 절대 기준. baseline 비교가 아니다.`,
    면제: Object.entries(C.textExempt ?? {}).map(([k, v]) => `${k} ${v.value} — ${v.사유}`),
  },
  status: failures.length ? 'FAIL' : (rows.some(r => r.open) ? 'OPEN' : 'PASS'),
  pairCount: rows.length,
  openCount: rows.filter(r => r.open).length,
  open: rows.filter(r => r.open).map(r => `${r.역할} ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)}`),
  boundaryCount: boundaries.length,
  boundaries: boundaries.map(r => `${r.역할} ${r.fg} on ${r.bg} = ${r.ratio.toFixed(2)}`),
  failures, rows,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ status: out.status, pairs: out.pairCount, boundary: out.boundaries, open: out.open, failures }, null, 1));
if (failures.length && process.argv.includes('--strict')) process.exit(1);
