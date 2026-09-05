#!/usr/bin/env node
/** S2 색 역할 이관 래칫 — 옛 팔레트 참조가 파일별로 되살아나지 못하게 한다. */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const opt = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith('--')).map(x => {
  const i = x.indexOf('='); return i < 0 ? [x.slice(2), ''] : [x.slice(2, i), x.slice(i + 1)];
}));
const root = resolve(opt.root ?? fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = resolve(opt.app ?? join(root, 'apps/mobile'));
const knownPath = resolve(opt.known ?? join(root, 'scripts/design-token-color-usage-known.json'));
const outPath = opt.out === undefined ? null : resolve(opt.out);
const TOKENS = ['ter', 'blue', 'blueTint', 'bluePressed'];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name); const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(?:ts|tsx)$/.test(name)) files.push(p);
  }
};
walk(sourceRoot);

export const countSource = (src, file = 'sample.tsx') => {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const counts = Object.fromEntries(TOKENS.map(k => [k, 0]));
  const visit = (n) => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'T' && TOKENS.includes(n.name.text)) counts[n.name.text]++;
    ts.forEachChild(n, visit);
  };
  visit(sf); return counts;
};

const current = {};
for (const p of files) {
  const c = countSource(readFileSync(p, 'utf8'), p);
  if (Object.values(c).some(Boolean)) current[relative(root, p).replaceAll('\\', '/')] = c;
}
const known = JSON.parse(readFileSync(knownPath, 'utf8'));
const baseline = known.baseline?.perFile ?? {};
const failures = [];
for (const file of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
  for (const token of TOKENS) {
    const before = baseline[file]?.[token] ?? 0;
    const now = current[file]?.[token] ?? 0;
    if (now > before) failures.push(`${file} T.${token} ${before}→${now} — 파일별 사용처가 늘었다`);
  }
}
const totals = Object.fromEntries(TOKENS.map(t => [t, Object.values(current).reduce((n, c) => n + (c[t] ?? 0), 0)]));
for (const token of TOKENS) {
  const expected = known.expectedTotals?.[token];
  if (!Number.isInteger(expected)) failures.push(`expectedTotals.${token} 이 없다`);
  else if (totals[token] !== expected) failures.push(`T.${token} 합계 ${totals[token]} ≠ 기대 ${expected}`);
}
const baselineTotals = Object.fromEntries(TOKENS.map(t => [t, Object.values(baseline).reduce((n, c) => n + (c[t] ?? 0), 0)]));
for (const token of TOKENS) {
  if (baselineTotals[token] !== known.baseline.totals[token]) failures.push(`기준선 T.${token} 파일 합 ${baselineTotals[token]} ≠ 기록 ${known.baseline.totals[token]}`);
}
const result = { schemaVersion: 1, baseline: { commit: known.baseline.commit, totals: baselineTotals }, current: { totals, filesWithLegacyRefs: Object.keys(current).length }, failures };
if (outPath) writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`S2 색 사용 래칫 — 기준 ${Object.values(baselineTotals).reduce((a,b)=>a+b,0)} · 현재 ${Object.values(totals).reduce((a,b)=>a+b,0)}`);
if (failures.length) { console.error(failures.map(x => `  - ${x}`).join('\n')); process.exit(1); }
console.log('S2 색 사용 래칫 PASS');
