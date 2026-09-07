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
const STATUS_ALIASES = ['green', 'greenTint', 'amberText', 'amberTint', 'red', 'redTint'];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name); const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(?:ts|tsx)$/.test(name)) files.push(p);
  }
};
walk(sourceRoot);

const jsxAttribute = (opening, name) => opening.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === name);
const roleValue = (attr) => {
  const value = attr?.initializer;
  if (!value) return null;
  if (ts.isStringLiteral(value)) return value.text;
  if (ts.isJsxExpression(value) && ts.isStringLiteral(value.expression)) return value.expression.text;
  return null;
};
const isInteractiveOpening = (opening) => {
  if (!opening?.attributes) return false;
  if (jsxAttribute(opening, 'onPress')) return true;
  return ['link', 'button'].includes(roleValue(jsxAttribute(opening, 'accessibilityRole')));
};
const hasInteractiveJsxAncestor = (node) => {
  for (let p = node; p; p = p.parent) {
    if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) && isInteractiveOpening(p)) return true;
    if (ts.isJsxElement(p) && isInteractiveOpening(p.openingElement)) return true;
  }
  return false;
};

export const analyzeSource = (src, file = 'sample.tsx') => {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const counts = Object.fromEntries(TOKENS.map(k => [k, 0]));
  const statusAliases = Object.fromEntries(STATUS_ALIASES.map(k => [k, 0]));
  const linkMisuses = [];
  const visit = (n) => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'T' && TOKENS.includes(n.name.text)) counts[n.name.text]++;
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'T' && STATUS_ALIASES.includes(n.name.text)) statusAliases[n.name.text]++;
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'link'
      && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'text'
      && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'COLOR'
      && !hasInteractiveJsxAncestor(n)) {
      const pos = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      linkMisuses.push(`${file}:${pos.line + 1}:${pos.character + 1}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf); return { counts, statusAliases, linkMisuses };
};
export const countSource = (src, file = 'sample.tsx') => analyzeSource(src, file).counts;

const current = {};
const statusAliasTotals = Object.fromEntries(STATUS_ALIASES.map(k => [k, 0]));
const linkMisuses = [];
let buttonSource = null;
for (const p of files) {
  const source = readFileSync(p, 'utf8');
  const a = analyzeSource(source, p);
  const c = a.counts;
  const sourceRel = relative(sourceRoot, p).replaceAll('\\', '/');
  if (Object.values(c).some(Boolean)) current[relative(root, p).replaceAll('\\', '/')] = c;
  if (sourceRel !== 'src/theme/tokens.ts') {
    for (const token of STATUS_ALIASES) statusAliasTotals[token] += a.statusAliases[token];
  }
  if (sourceRel === 'src/components/kit/Button.tsx') buttonSource = source;
  linkMisuses.push(...a.linkMisuses.map(x => relative(root, p).replaceAll('\\', '/') + x.slice(p.length)));
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
for (const token of STATUS_ALIASES) {
  const expected = known.statusAliasExpectedTotals?.[token];
  if (!Number.isInteger(expected)) failures.push(`statusAliasExpectedTotals.${token} 이 없다`);
  else if (statusAliasTotals[token] !== expected) failures.push(`T.${token} 별칭 사용 ${statusAliasTotals[token]} ≠ 기대 ${expected} — 수렴·회귀를 known과 함께 기록해야 한다`);
}
if (linkMisuses.length) failures.push(...linkMisuses.map(x => `${x} COLOR.text.link 는 상호작용 JSX 안에서만 쓴다`));
let buttonDisabledContract = null;
if (known.buttonDisabledContract) {
  buttonDisabledContract = { mode: known.buttonDisabledContract.mode, opacity: known.buttonDisabledContract.opacity };
  if (!buttonSource) failures.push('Button.tsx 를 찾지 못해 비활성 variant 계약을 검사할 수 없다');
  else {
    if (!/opacity\s*:\s*disabled\s*\?\s*0\.4\s*:/.test(buttonSource))
      failures.push('Button disabled 는 kind 분기 없이 opacity 0.4 를 적용해야 한다');
    if (/primaryDisabled|disabled\s*&&\s*kind|kind\s*!==\s*['"]primary['"]\s*\?\s*0\.4/.test(buttonSource))
      failures.push('Button disabled 표현을 variant 별 색/opacity 분기로 나누면 안 된다');
  }
}
const baselineTotals = Object.fromEntries(TOKENS.map(t => [t, Object.values(baseline).reduce((n, c) => n + (c[t] ?? 0), 0)]));
for (const token of TOKENS) {
  if (baselineTotals[token] !== known.baseline.totals[token]) failures.push(`기준선 T.${token} 파일 합 ${baselineTotals[token]} ≠ 기록 ${known.baseline.totals[token]}`);
}
const result = { schemaVersion: 2, baseline: { commit: known.baseline.commit, totals: baselineTotals }, current: { totals, filesWithLegacyRefs: Object.keys(current).length, statusAliasTotals, linkMisuses, buttonDisabledContract }, failures };
if (outPath) writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`S2 색 사용 래칫 — 기준 ${Object.values(baselineTotals).reduce((a,b)=>a+b,0)} · 현재 ${Object.values(totals).reduce((a,b)=>a+b,0)}`);
if (failures.length) { console.error(failures.map(x => `  - ${x}`).join('\n')); process.exit(1); }
console.log('S2 색 사용 래칫 PASS');
