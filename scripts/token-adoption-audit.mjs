#!/usr/bin/env node
/**
 * token-adoption-audit.mjs
 *
 * 앱(`apps/mobile`)이 디자인 토큰과 공용 kit 을 실제로 얼마나 쓰는지 AST 로 센다.
 * 기획안·검수 문서에 적는 채택 수치는 이 스크립트의 출력에서만 인용한다.
 *
 * 사용:
 *   node scripts/token-adoption-audit.mjs [--out=<경로>] [--root=<경로>]
 *   저장소 루트에서:  pnpm token:audit
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 왜 정규식이 아니라 AST 인가 — 과거 실패 기록
 *
 * [L1] 2026-09-04 기획안 초안(7f34139)이 임시 grep 으로 수치를 냈고 재현되지 않았다.
 *      `T.` 출현을 1,827 로 적었으나 검수자는 1,812, git 트리 재측정은 1,805 였다.
 *      셋이 다른 이유는 **세는 규칙을 정하지도 남기지도 않았기 때문**이다.
 *      정규식은 문자열·주석·import 를 구분하지 못하고 파일 선정 기준도 숨는다.
 * [L2] 같은 초안이 `Txt` 를 "사용 파일 3/187" 로 적었다. 실제로는 정의 파일 ·
 *      배럴 export · 소비 파일 하나를 합친 값이었고 **JSX 사용은 charts.tsx 한 곳**뿐이다.
 *      "언급"과 "사용"은 다른 사건이므로 나눠 센다.
 * [L3] 같은 초안이 `TYPE` 을 "7단계"로 적었다. 역할은 7개지만 고유 크기 단계는 6개
 *      (13·14·16·18·20·22)다. **정의 역할 수와 고유 값 단계 수는 다른 개념**이다.
 * [L4] 이 스크립트 초판(2026-09-04)이 `components/kit/index.tsx` 를 "배럴"로 보고 사용 집계에서
 *      제외해 `STATUS`·`cardShadow` 를 0회로 냈다. 그 파일은 재수출만 하지 않고
 *      `StatusBadge`·`Card` 를 **정의하면서 토큰을 소비**한다. 이진 분류가 틀렸다.
 *      → 파일을 tokenDefinition / sharedComponent / product 3층으로 나눠 각각 센다.
 * [L5] 같은 초판이 프로퍼티 접근만 세서 `STATUS[status]` 같은 **인덱스 접근을 통째로 놓쳤다.**
 *      → ElementAccessExpression 도 센다. 더불어 같은 이름의 지역 선언이 토큰을 가리는
 *        경우(`PurchaseHistoryScreen` 의 지역 `STATUS`)를 감지해 그 파일은 해당 심볼에서 제외하고
 *        shadowedBy 로 남긴다. 이름만 보고 세면 남의 변수를 토큰 사용으로 오계수한다.
 *
 * 그래서 이 스크립트는 아래 넷을 항상 분리해서 낸다.
 *   definitionRoles   정의된 역할 수
 *   distinctValues    그 역할들이 실제로 갖는 고유 값의 수
 *   usageOccurrences  코드에서 참조된 횟수
 *   usageFiles        참조한 파일 수 (토큰 정의 파일만 제외)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, basename } from 'node:path';
import { execSync } from 'node:child_process';

const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--'))
  .map(a => a.replace(/^--/, '').split('=')));
const repoRoot = resolve(opt.root ?? '.');
const outPath = resolve(opt.out ?? 'docs/token-adoption-audit.json');
const sha = b => createHash('sha256').update(b).digest('hex');

/** 파일 선정 규칙 — 결과에 그대로 기록한다. 숨은 기준을 두지 않는다. */
const SELECTION = {
  roots: ['apps/mobile/src', 'apps/mobile/app'],
  extensions: ['.ts', '.tsx'],
  excludeDirs: ['node_modules', '__tests__', '.expo', 'dist', 'build'],
  excludeFileSuffixes: ['.test.ts', '.test.tsx', '.d.ts'],
  note: '테스트·타입선언·빌드산출물은 제품 화면이 아니므로 제외한다.',
};
/**
 * 파일 3층 분류 ([L4]).
 *   tokenDefinition  토큰을 정의하는 파일. 사용으로 세지 않는다
 *   sharedComponent  공용 kit. 토큰을 소비해야 정상이므로 따로 센다
 *   product          기능 화면. 여기의 인라인이 곧 미채택이다
 */
const TOKEN_DEFINITION_FILES = ['apps/mobile/src/theme/tokens.ts'];
const SHARED_COMPONENT_PREFIXES = ['apps/mobile/src/components/'];
const layerOf = (rel) => TOKEN_DEFINITION_FILES.includes(rel) ? 'tokenDefinition'
  : SHARED_COMPONENT_PREFIXES.some(p => rel.startsWith(p)) ? 'sharedComponent' : 'product';
const TOKEN_OBJECTS = ['T', 'TYPE', 'space', 'radius', 'STATUS', 'FONT'];
const TOKEN_VALUES = ['cardShadow', 'tnum'];
const KIT_COMPONENTS = ['Txt', 'Button', 'Icon', 'Sheet', 'AppHeader', 'SearchBar', 'SortSheet',
  'MemoEditSheet', 'QueryState', 'Slider', 'EmptyState'];
/** 인라인 하드코딩으로 세는 스타일 속성. 숫자 리터럴만 센다. */
const NUMERIC_STYLE_PROPS = {
  typography: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'],
  spacing: ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'paddingHorizontal', 'paddingVertical', 'margin', 'marginTop', 'marginRight',
    'marginBottom', 'marginLeft', 'marginHorizontal', 'marginVertical', 'gap', 'rowGap', 'columnGap'],
  radius: ['borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomLeftRadius', 'borderBottomRightRadius'],
  size: ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'],
};

function walk(dir, acc = []) {
  let entries; try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (!SELECTION.excludeDirs.includes(name)) walk(p, acc); continue; }
    if (!SELECTION.extensions.some(e => name.endsWith(e))) continue;
    if (SELECTION.excludeFileSuffixes.some(s => name.endsWith(s))) continue;
    acc.push(p);
  }
  return acc;
}
const files = SELECTION.roots.flatMap(r => walk(join(repoRoot, r))).sort();

// ── 토큰 정의 자체를 읽는다 (역할 수와 고유 값 수를 나눠 세기 위해) ──────────
const tokensPath = join(repoRoot, 'apps/mobile/src/theme/tokens.ts');
const tokensSrc = readFileSync(tokensPath, 'utf8');
const tokensAst = ts.createSourceFile(tokensPath, tokensSrc, ts.ScriptTarget.Latest, true);
const definitions = {};
(function readDefs(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    const name = node.name.text;
    let init = node.initializer;
    while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
    if (ts.isObjectLiteralExpression(init)) {
      const roles = {};
      for (const prop of init.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = prop.name.getText(tokensAst).replace(/['"]/g, '');
        let v = prop.initializer;
        while (ts.isAsExpression(v)) v = v.expression;
        if (ts.isObjectLiteralExpression(v)) {
          const inner = {};
          for (const ip of v.properties) if (ts.isPropertyAssignment(ip))
            inner[ip.name.getText(tokensAst).replace(/['"]/g, '')] = ip.initializer.getText(tokensAst).replace(/['"]/g, '');
          roles[key] = inner;
        } else roles[key] = v.getText(tokensAst).replace(/['"]/g, '');
      }
      definitions[name] = roles;
    }
  }
  ts.forEachChild(node, readDefs);
})(tokensAst);

const summarizeDef = (name, valueKey) => {
  const roles = definitions[name]; if (!roles) return null;
  const keys = Object.keys(roles);
  const vals = keys.map(k => (valueKey && typeof roles[k] === 'object') ? roles[k][valueKey] : roles[k]);
  return { definitionRoles: keys.length, distinctValues: new Set(vals.filter(v => v !== undefined)).size,
    roles: keys, values: vals };
};

// ── 사용처 AST 스캔 ─────────────────────────────────────────────────────────
const perFile = [];
const tally = { tokenAccess: {}, tokenValue: {}, kitJsx: {}, kitImport: {},
  inline: { typography: {}, spacing: {}, radius: {}, size: {} }, hexColors: {} };
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
const propGroup = n => Object.entries(NUMERIC_STYLE_PROPS).find(([, list]) => list.includes(n))?.[0] ?? null;

// 선언 하나하나를 **어디의 무슨 값인지** 로 보존한다 ([L6]).
// 파일별 개수만 저장하면 "이 값을 어느 토큰으로 보낼지" 를 판정할 수 없다 —
// 매핑은 값과 속성과 위치가 있어야 정해진다. 프로토타입 감사와 같은 단위로 맞춘다.
const declarations = [];
const record = (group, prop, value, node, rel, layer) => {
  const sf2 = node.getSourceFile();
  const { line, character } = sf2.getLineAndCharacterOfPosition(node.getStart(sf2));
  declarations.push({ group, prop, value, file: rel, line: line + 1, column: character + 1, layer });
};

for (const abs of files) {
  const rel = relative(repoRoot, abs).replace(/\\/g, '/');
  const src = readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.Latest, true,
    abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const layer = layerOf(rel);
  const f = { file: rel, layer, tokenAccess: {}, tokenValue: {}, kitJsx: {}, kitImport: [],
    shadowedSymbols: [], inline: { typography: 0, spacing: 0, radius: 0, size: 0 }, hexColors: 0 };

  // 같은 이름의 지역 선언이 토큰을 가리는지 먼저 확인한다 ([L5])
  (function findShadows(node) {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
        && node.name && ts.isIdentifier(node.name)
        && [...TOKEN_OBJECTS, ...TOKEN_VALUES].includes(node.name.text)) {
      if (!f.shadowedSymbols.includes(node.name.text)) f.shadowedSymbols.push(node.name.text);
    }
    ts.forEachChild(node, findShadows);
  })(sf);
  const shadowed = (name) => f.shadowedSymbols.includes(name);

  (function visit(node) {
    // T.blue / TYPE.body / space.lg …  — 프로퍼티 접근만 센다(문자열·주석 제외)
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
        && TOKEN_OBJECTS.includes(node.expression.text) && !shadowed(node.expression.text)) {
      const key = `${node.expression.text}.${node.name.text}`;
      bump(f.tokenAccess, key); bump(tally.tokenAccess, key);
    }
    // STATUS[status] 같은 인덱스 접근 ([L5]) — 키가 동적이면 [computed] 로 묶는다
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)
        && TOKEN_OBJECTS.includes(node.expression.text) && !shadowed(node.expression.text)) {
      const arg = node.argumentExpression;
      const k = arg && (ts.isStringLiteral(arg) || ts.isNumericLiteral(arg)) ? arg.text : '[computed]';
      const key = `${node.expression.text}[${k}]`;
      bump(f.tokenAccess, key); bump(tally.tokenAccess, key);
    }
    // cardShadow / tnum — 객체가 아니라 값이므로 식별자 참조를 센다(import 절 제외)
    if (ts.isIdentifier(node) && TOKEN_VALUES.includes(node.text) && !shadowed(node.text)
        && !ts.isImportSpecifier(node.parent) && !ts.isImportClause(node.parent)
        && !ts.isPropertyAssignment(node.parent)) {
      bump(f.tokenValue, node.text); bump(tally.tokenValue, node.text);
    }
    // <Txt …> — JSX 실사용. 언급(import·타입)과 구분한다 ([L2])
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && ts.isIdentifier(node.tagName) && KIT_COMPONENTS.includes(node.tagName.text)) {
      bump(f.kitJsx, node.tagName.text); bump(tally.kitJsx, node.tagName.text);
    }
    if (ts.isImportSpecifier(node) && KIT_COMPONENTS.includes(node.name.text)) {
      f.kitImport.push(node.name.text); bump(tally.kitImport, node.name.text);
    }
    // 인라인 숫자 스타일 리터럴
    if (ts.isPropertyAssignment(node) && node.name && ts.isNumericLiteral(node.initializer)) {
      const prop = node.name.getText(sf).replace(/['"]/g, '');
      const g = propGroup(prop);
      if (g) { f.inline[g]++; bump(tally.inline[g], `${prop}:${node.initializer.text}`);
        record(g, prop, node.initializer.text, node, rel, layer); }
    }
    // fontWeight 는 문자열 리터럴로 쓰인다
    if (ts.isPropertyAssignment(node) && node.name && ts.isStringLiteral(node.initializer)
        && node.name.getText(sf).replace(/['"]/g, '') === 'fontWeight' && /^\d+$/.test(node.initializer.text)) {
      f.inline.typography++; bump(tally.inline.typography, `fontWeight:${node.initializer.text}`);
      record('typography', 'fontWeight', node.initializer.text, node, rel, layer);
    }
    // hex 색 리터럴
    if (ts.isStringLiteral(node) && /^#[0-9a-fA-F]{3,8}$/.test(node.text)
        && layer !== 'tokenDefinition') {
      f.hexColors++; bump(tally.hexColors, node.text.toUpperCase());
      record('color', 'hex', node.text.toUpperCase(), node, rel, layer);
    }
    ts.forEachChild(node, visit);
  })(sf);

  f.tokenAccessTotal = Object.values(f.tokenAccess).reduce((a, b) => a + b, 0);
  f.inlineTotal = Object.values(f.inline).reduce((a, b) => a + b, 0);
  perFile.push(f);
}

const consumers = perFile.filter(f => f.layer !== 'tokenDefinition');
const byLayer = (l) => perFile.filter(f => f.layer === l);
const countIn = (list, pick) => {
  const occ = list.reduce((a, f) => a + Object.entries(f[pick.field] ?? {})
    .filter(([k]) => pick.match(k)).reduce((s, [, v]) => s + v, 0), 0);
  const fileCount = list.filter(f => Object.keys(f[pick.field] ?? {}).some(k => pick.match(k))).length;
  return { usageOccurrences: occ, usageFiles: fileCount };
};
const countUsage = (pick) => ({
  ...countIn(consumers, pick),
  sharedComponent: countIn(byLayer('sharedComponent'), pick),
  product: countIn(byLayer('product'), pick),
  shadowedIn: perFile.filter(f => f.shadowedSymbols.some(s => pick.match(`${s}.`) || pick.match(s))).map(f => f.file),
});

const tokenReport = {};
for (const name of TOKEN_OBJECTS) {
  tokenReport[name] = {
    ...(summarizeDef(name, name === 'TYPE' ? 'fontSize' : null) ?? { definitionRoles: null, distinctValues: null }),
    // 프로퍼티 접근과 인덱스 접근을 모두 잡는다. `.` 만 보면 STATUS[status] 를 놓친다 ([L5])
    ...countUsage({ field: 'tokenAccess', match: k => k.startsWith(`${name}.`) || k.startsWith(`${name}[`) }),
  };
}
for (const name of TOKEN_VALUES) {
  tokenReport[name] = { definitionRoles: 1, distinctValues: 1,
    ...countUsage({ field: 'tokenValue', match: k => k === name }) };
}
const kitReport = {};
for (const c of KIT_COMPONENTS) {
  kitReport[c] = {
    jsxOccurrences: consumers.reduce((a, f) => a + (f.kitJsx[c] ?? 0), 0),
    jsxFiles: consumers.filter(f => f.kitJsx[c]).length,
    importFiles: consumers.filter(f => f.kitImport.includes(c)).length,
    productJsxFiles: byLayer('product').filter(f => f.kitJsx[c]).length,
  };
}
const inlineReport = Object.fromEntries(Object.keys(NUMERIC_STYLE_PROPS).map(g => {
  const occ = consumers.reduce((a, f) => a + f.inline[g], 0);
  return [g, { occurrences: occ, files: consumers.filter(f => f.inline[g] > 0).length,
    distinctDeclarations: Object.keys(tally.inline[g]).length,
    sharedComponent: byLayer('sharedComponent').reduce((a, f) => a + f.inline[g], 0),
    product: byLayer('product').reduce((a, f) => a + f.inline[g], 0) }];
}));

let commit = null, treeOid = null;
try {
  commit = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
  treeOid = execSync('git rev-parse HEAD^{tree}', { cwd: repoRoot }).toString().trim();
} catch { /* git 없이도 동작한다 */ }

const out = {
  manifest: {
    generatedAt: new Date().toISOString(), schemaVersion: 1,
    script: { name: basename(new URL(import.meta.url).pathname), sha256: sha(readFileSync(new URL(import.meta.url))) },
    repo: { headCommit: commit, headTree: treeOid },
    runner: { node: process.version, typescript: ts.version },
    selection: SELECTION,
    fileLayers: { tokenDefinition: TOKEN_DEFINITION_FILES, sharedComponentPrefixes: SHARED_COMPONENT_PREFIXES,
      note: '공용 컴포넌트는 토큰을 소비해야 정상이므로 제외하지 않고 따로 센다' },
    countedTokenObjects: TOKEN_OBJECTS, countedTokenValues: TOKEN_VALUES,
    countedKitComponents: KIT_COMPONENTS, numericStyleProps: NUMERIC_STYLE_PROPS,
    countingRules: {
      definitionRoles: '토큰 객체에 정의된 키의 수',
      distinctValues: '그 키들이 갖는 고유 값의 수 (TYPE 은 fontSize 기준)',
      usageOccurrences: '소비 파일의 프로퍼티 접근 횟수. 정의 파일과 배럴은 제외',
      usageFiles: '한 번이라도 접근한 소비 파일 수',
      jsxOccurrences: 'JSX 요소로 실제 렌더된 횟수. import 만 한 파일은 세지 않는다',
      elementAccess: 'X[key] 인덱스 접근도 센다. 동적 키는 X[computed] 로 묶는다',
      shadowing: '같은 이름의 지역 선언이 있으면 그 파일은 해당 심볼 집계에서 제외하고 목록에 남긴다',
    },
  },
  declarations,
  declarationSummary: (() => {
    const byGroup = {};
    for (const d of declarations) {
      const g = (byGroup[d.group] ??= { total: 0, byValue: {}, byLayer: {} });
      g.total++;
      const k = `${d.prop}:${d.value}`;
      g.byValue[k] = (g.byValue[k] ?? 0) + 1;
      g.byLayer[d.layer] = (g.byLayer[d.layer] ?? 0) + 1;
    }
    for (const g of Object.values(byGroup)) {
      g.distinctDeclarations = Object.keys(g.byValue).length;
      g.byValue = Object.fromEntries(Object.entries(g.byValue).sort((a, b) => b[1] - a[1]));
    }
    return byGroup;
  })(),
  summary: {
    filesScanned: files.length,
    filesByLayer: { tokenDefinition: byLayer('tokenDefinition').length,
      sharedComponent: byLayer('sharedComponent').length, product: byLayer('product').length },
    filesWithShadowedTokenNames: perFile.filter(f => f.shadowedSymbols.length)
      .map(f => ({ file: f.file, shadowedSymbols: f.shadowedSymbols })),
    declarations: declarations.length,
    declarationsByGroup: Object.fromEntries(
      [...new Set(declarations.map(d => d.group))].map(g => [g, declarations.filter(d => d.group === g).length])),
    tokens: tokenReport, kit: kitReport, inlineLiterals: inlineReport,
    hexColorLiterals: { occurrences: consumers.reduce((a, f) => a + f.hexColors, 0),
      files: consumers.filter(f => f.hexColors > 0).length,
      byLayer: { sharedComponent: byLayer('sharedComponent').reduce((a, f) => a + f.hexColors, 0),
        product: byLayer('product').reduce((a, f) => a + f.hexColors, 0) },
      distinct: Object.keys(tally.hexColors).length, values: tally.hexColors },
    topInlineFiles: consumers.slice().sort((a, b) => b.inlineTotal - a.inlineTotal).slice(0, 15)
      .map(f => ({ file: f.file, inlineTotal: f.inlineTotal, breakdown: f.inline })),
  },
  files: perFile,
};
writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ manifest: out.manifest, summary: out.summary }, null, 1));
