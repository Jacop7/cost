#!/usr/bin/env node
/** S3a 계약 — S2 exact SHA에서 승인된 1,051개 치환만 허용한다. */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const opt = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith('--')).map(x => {
  const i = x.indexOf('='); return i < 0 ? [x.slice(2), ''] : [x.slice(2, i), x.slice(i + 1)];
}));
const root = resolve(opt.root ?? fileURLToPath(new URL('..', import.meta.url)));
const knownPath = resolve(opt.known ?? join(root, 'scripts/design-token-s3a-known.json'));
const known = JSON.parse(readFileSync(knownPath, 'utf8'));
const baseline = opt['baseline-root'] ? resolve(opt['baseline-root']) : null;
const baselineCommit = known.baselineCommit;
const outPath = opt.out ? resolve(opt.out) : null;
const APP_ROOTS = ['apps/mobile/src', 'apps/mobile/app'];
const PROPS = /^(?:fontSize|lineHeight|letterSpacing|padding(?:Top|Right|Bottom|Left|Horizontal|Vertical)?|margin(?:Top|Right|Bottom|Left|Horizontal|Vertical)?|gap|rowGap|columnGap|width|minWidth|maxWidth|height|minHeight|maxHeight|border(?:Top|Right|Bottom|Left)?Width|border(?:Top|Bottom)(?:Left|Right)Radius|borderRadius|flex|flexBasis|flexGrow|flexShrink|aspectRatio|transform|top|right|bottom|left)$/;
const CSS_PROPS = /^(?:font-size|line-height|letter-spacing|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|gap|row-gap|column-gap|width|min-width|max-width|height|min-height|max-height|border(?:-(?:top|right|bottom|left))?-width|border-(?:top|bottom)-(?:left|right)-radius|border-radius|flex|flex-basis|flex-grow|flex-shrink|aspect-ratio|transform|top|right|bottom|left)$/;
const norm = text => text.replace(/\s+/g, ' ').trim();
const failures = [];
const fail = message => failures.push(message);

const git = args => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 80_000_000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
};
const walk = base => {
  const files = [];
  const visit = dir => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (['node_modules', '__tests__', '.expo', 'dist', 'build'].includes(name)) continue;
      const path = join(dir, name); const stat = statSync(path);
      if (stat.isDirectory()) visit(path);
      else if (/\.(?:ts|tsx)$/.test(name) && !/\.(?:test|d)\.tsx?$/.test(name))
        files.push(relative(root, path).replaceAll('\\', '/'));
    }
  };
  visit(resolve(root, base));
  return files;
};
const currentFiles = APP_ROOTS.flatMap(walk).sort();
const baselineFiles = baseline
  ? APP_ROOTS.flatMap(base => {
      const out = []; const start = resolve(baseline, base);
      const visit = dir => { if (!existsSync(dir)) return; for (const name of readdirSync(dir)) {
        if (['node_modules', '__tests__', '.expo', 'dist', 'build'].includes(name)) continue;
        const path = join(dir, name); const stat = statSync(path);
        if (stat.isDirectory()) visit(path);
        else if (/\.(?:ts|tsx)$/.test(name) && !/\.(?:test|d)\.tsx?$/.test(name))
          out.push(relative(baseline, path).replaceAll('\\', '/'));
      }}; visit(start); return out;
    }).sort()
  : git(['ls-tree', '-r', '--name-only', baselineCommit, '--', ...APP_ROOTS])
      .trim().split(/\r?\n/).filter(x => /\.(?:ts|tsx)$/.test(x) && !/\.(?:test|d)\.tsx?$/.test(x));
const readCurrent = file => readFileSync(resolve(root, file), 'utf8');
const readBaseline = file => baseline ? readFileSync(resolve(baseline, file), 'utf8') : git(['show', `${baselineCommit}:${file}`]);

const rows = (source, file) => {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const inOffset = node => { for (let p = node.parent; p; p = p.parent) {
    if (ts.isPropertyAssignment(p) && ['shadowOffset', 'textShadowOffset'].includes(p.name.getText(sf).replace(/["']/g, ''))) return true;
    if (ts.isJsxAttribute(p) && p.name.getText(sf) === 'hitSlop') return true;
  } return false; };
  const visit = node => {
    if (ts.isPropertyAssignment(node)) {
      const prop = node.name.getText(sf).replace(/["']/g, '');
      if (PROPS.test(prop) && !inOffset(node)) {
        const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        out.push({ prop, text: norm(node.initializer.getText(sf)), line: pos.line + 1, column: pos.character + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf); return out;
};
const hitSlopRows = (source, file) => {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const visit = node => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'hitSlop') {
      const initializer = node.initializer;
      const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      out.push({ text: expression ? norm(expression.getText(sf)) : '', line: pos.line + 1, column: pos.character + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf); return out;
};
const cssRows = source => {
  const out = []; const regex = /([A-Za-z-]+)\s*:\s*([^;{}"']+)/g; let match;
  while ((match = regex.exec(source))) if (CSS_PROPS.test(match[1])) out.push(`${match[1]}:${norm(match[2])}`);
  return out;
};

if (JSON.stringify(currentFiles) !== JSON.stringify(baselineFiles)) fail('앱 TS/TSX 파일 집합이 S2 기준선과 다르다');
const plan = new Map(known.assignmentPlan.map(row => [row.key, row]));
const used = new Set();
const touchPlan = new Map((known.touchAdjustments ?? []).map(row => [row.key, row]));
const touchUsed = new Set();
let declarations = 0;
for (const file of new Set([...baselineFiles, ...currentFiles])) {
  if (!baselineFiles.includes(file) || !currentFiles.includes(file)) continue;
  const before = rows(readBaseline(file), file);
  const after = rows(readCurrent(file), file);
  declarations += after.length;
  if (before.length !== after.length) { fail(`${file} 기하 선언 수 ${before.length}→${after.length}`); continue; }
  for (let index = 0; index < before.length; index++) {
    const a = before[index], b = after[index];
    if (a.prop !== b.prop) { fail(`${file} 기하 선언 순서 ${index}의 속성 ${a.prop}→${b.prop}`); continue; }
    if (a.text === b.text) continue;
    const key = `${file}:${a.line}:${a.prop}`;
    const expected = plan.get(key);
    if (!expected) { fail(`${key} 승인되지 않은 변경 ${a.text}→${b.text}`); continue; }
    if (b.text !== expected.expression) fail(`${key} 목적지 ${b.text} ≠ 승인 ${expected.expression}`);
    used.add(key);
  }
  const touchBefore = hitSlopRows(readBaseline(file), file);
  const touchAfter = hitSlopRows(readCurrent(file), file);
  if (touchBefore.length !== touchAfter.length) { fail(`${file} hitSlop 선언 수 ${touchBefore.length}→${touchAfter.length}`); continue; }
  for (let index = 0; index < touchBefore.length; index++) {
    const a = touchBefore[index], b = touchAfter[index];
    if (a.text === b.text) continue;
    const key = `${file}:${a.line}:hitSlop`;
    const expected = touchPlan.get(key);
    if (!expected) { fail(`${key} 승인되지 않은 변경 ${a.text}→${b.text}`); continue; }
    if (a.text !== expected.before || b.text !== expected.after)
      fail(`${key} hitSlop ${a.text}→${b.text} ≠ 승인 ${expected.before}→${expected.after}`);
    touchUsed.add(key);
  }
}

for (const key of plan.keys()) if (!used.has(key)) fail(`${key} 승인된 치환이 재현되지 않았다`);
for (const key of touchPlan.keys()) if (!touchUsed.has(key)) fail(`${key} 승인된 hitSlop 보정이 재현되지 않았다`);
if (known.assignments !== plan.size) fail(`known assignments ${known.assignments} ≠ 목록 ${plan.size}`);
const byRule = {};
for (const item of plan.values()) {
  byRule[item.rule] = (byRule[item.rule] ?? 0) + 1;
  if (['H', 'B'].includes(item.axis) && item.target > item.current)
    fail(`${item.key} 가로 축 증가 ${item.current}→${item.target} — S3b 자리다`);
}
const sortedRecord = (value) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
if (JSON.stringify(sortedRecord(byRule)) !== JSON.stringify(sortedRecord(known.byRule))) {
  fail('규칙별 치환 수가 known.byRule과 다르다');
}

// 토큰 참조 문자열만 맞고 실제 값이 갈리는 경우를 막는다.
const tokenSource = readCurrent('apps/mobile/src/theme/tokens.ts');
const tokenAst = ts.createSourceFile('tokens.ts', tokenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const actualContract = {};
const unwrap = node => { while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression; return node; };
const readObject = node => {
  node = unwrap(node); if (!ts.isObjectLiteralExpression(node)) return null;
  const object = {};
  for (const property of node.properties) if (ts.isPropertyAssignment(property)) {
    const key = property.name.getText(tokenAst).replace(/["']/g, '');
    const value = unwrap(property.initializer);
    if (ts.isNumericLiteral(value)) object[key] = Number(value.text);
    else if (ts.isObjectLiteralExpression(value)) object[key] = readObject(value);
  }
  return object;
};
(function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && known.tokenContract[node.name.text])
    actualContract[node.name.text] = readObject(node.initializer);
  ts.forEachChild(node, visit);
})(tokenAst);
for (const [name, expected] of Object.entries(known.tokenContract)) {
  const actual = actualContract[name];
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'object') {
      for (const [inner, innerValue] of Object.entries(value))
        if (actual?.[key]?.[inner] !== innerValue) fail(`${name}.${key}.${inner} 값 ${actual?.[key]?.[inner]} ≠ ${innerValue}`);
    } else if (actual?.[key] !== value) fail(`${name}.${key} 값 ${actual?.[key]} ≠ ${value}`);
  }
}

const proto = 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html';
const protoBefore = baseline ? readFileSync(resolve(baseline, proto), 'utf8') : git(['show', `${baselineCommit}:${proto}`]);
const protoAfter = readFileSync(resolve(root, proto), 'utf8');
if (JSON.stringify(cssRows(protoBefore)) !== JSON.stringify(cssRows(protoAfter))) fail('S3a에서 프로토타입 CSS 기하가 바뀌었다');

const result = { schemaVersion: 1, stage: 'S3a', baselineCommit, assignments: plan.size,
  assignmentsApplied: used.size, touchAdjustments: touchPlan.size, touchAdjustmentsApplied: touchUsed.size,
  files: known.files, geometryDeclarations: declarations,
  inventoryHash: createHash('sha256').update(JSON.stringify([...currentFiles].map(file => [file, rows(readCurrent(file), file).map(x => [x.prop, x.text])]))).digest('hex'),
  failures };
if (outPath) writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`S3a 치환 계약 — ${used.size}/${plan.size} · 기하 선언 ${declarations}`);
if (failures.length) { console.error(failures.map(x => `  - ${x}`).join('\n')); process.exit(1); }
console.log('S3a 치환 계약 PASS');
