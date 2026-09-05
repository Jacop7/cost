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
import { spawnSync } from 'node:child_process';

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
const definitionDeclarations = [];
const directNumericSibling = (node, propName, sf) => {
  const object = node.parent;
  if (!object || !ts.isObjectLiteralExpression(object)) return null;
  const sibling = object.properties.find(p => ts.isPropertyAssignment(p)
    && p.name.getText(sf).replace(/['"]/g, '') === propName
    && ts.isNumericLiteral(p.initializer));
  if (!sibling) return null;
  const { line, character } = sf.getLineAndCharacterOfPosition(sibling.getStart(sf));
  return { value: Number(sibling.initializer.text), line: line + 1, column: character + 1 };
};
const record = (group, prop, value, node, rel, layer) => {
  const sf2 = node.getSourceFile();
  const { line, character } = sf2.getLineAndCharacterOfPosition(node.getStart(sf2));
  const declaration = { group, prop, value, file: rel, line: line + 1, column: character + 1, layer };
  if (group === 'typography' && prop === 'lineHeight') {
    const pair = directNumericSibling(node, 'fontSize', sf2);
    declaration.fontSizePair = pair
      ? { status: 'direct', ...pair }
      : { status: 'missing', reason: '같은 스타일 객체에 숫자 fontSize 선언이 없다' };
  }
  // 토큰 정본의 숫자는 하드코딩 사용처가 아니라 primitive 정의다. 정의를 실행 우주에
  // 섞으면 정본 자신을 defect 로 분류하고 후행 수렴 단계가 확정값을 다시 쓰게 된다.
  (layer === 'tokenDefinition' ? definitionDeclarations : declarations).push(declaration);
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
  /** 중첩 객체를 값으로 갖는 속성 — 그 안쪽 키는 스타일 속성이 아니다. */
  const NESTED_OFFSET = ['shadowOffset', 'textShadowOffset', 'transform'];
  const insideNestedOffset = (n) => {
    const obj = n.parent;
    const pa = obj && obj.parent;
    return !!(pa && ts.isPropertyAssignment(pa)
      && NESTED_OFFSET.includes(pa.name.getText(sf).replace(/['"]/g, '')));
  };

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
    //
    // ⚠ `shadowOffset: { width: 0, height: 6 }` 의 `height` 는 **상자 높이가 아니다.**
    //   중첩 객체를 쓰는 속성의 안쪽 키를 상자 크기로 세면 그림자 오프셋이 `size` 선언으로
    //   잡힌다 — `tokens.ts` 의 그림자 다섯 역할이 그렇게 네 건 잡혔고, W1 재개에서 미분류로
    //   드러났다. (같은 덫을 `scripts/touch-target-audit.mjs` 에서도 한 번 밟았다.)
    if (ts.isPropertyAssignment(node) && node.name && ts.isNumericLiteral(node.initializer)
        && !insideNestedOffset(node)) {
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

// ── 입력 결속 (솔 검수 `W1 R1 F01`) ──────────────────────────────────────────
// 이 감사기의 산출물이 W1 전체의 입력이다. 그런데 초판은 HEAD 를 **적기만** 했고 아무도
// 그 값을 검사하지 않았다. 그 결과 3,677건이 다른 브랜치(`6497666`)에서 측정된 채로
// `codex/prototype-persistence` 에 실렸고, 자기 커밋에서 재현되지 않았다.
//
// 세 가지를 고친다 —
//   ① 문자열 셸 실행을 버린다. `HEAD^{tree}` 가 Windows 셸에서 `HEAD{tree}` 로 전달돼
//      tree 조회가 조용히 실패했다. 인자 배열로 넘긴다.
//   ② `--root` 가 **그 저장소의 최상위와 같은지** 단언한다. 다른 저장소 안의 임시 복사본을
//      가리키면 상위 저장소의 HEAD 를 적게 된다 — 검수자가 실제로 그 경로로 재현했다.
//   ③ `--expect-commit` 을 **필수**로 하고 전체 SHA 완전 일치와 선택 범위 dirty 0 을 단언한다.
const git = (args) => {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};
const bindFail = [];
const toplevel = git(['rev-parse', '--show-toplevel']);
const commit = git(['rev-parse', 'HEAD']);
const treeOid = git(['rev-parse', 'HEAD^{tree}']);
const wantCommit = opt['expect-commit'];
if (opt['no-bind'] === undefined) {
  if (!toplevel) bindFail.push(`--root 가 git 저장소가 아니다: ${repoRoot}`);
  else if (resolve(toplevel) !== resolve(repoRoot))
    bindFail.push(`--root 가 저장소 최상위가 아니다 — root ${resolve(repoRoot)} · 최상위 ${resolve(toplevel)}. 다른 저장소 안의 복사본을 재면 그 상위 저장소의 HEAD 를 적게 된다`);
  if (wantCommit === undefined)
    bindFail.push('--expect-commit 이 없다 — 이 산출물은 W1 전체의 입력이다. 어느 커밋을 쟀는지 결속하지 않은 측정은 쓰지 않는다 (의도한 것이면 --no-bind 를 명시하라)');
  else if (!/^[0-9a-fA-F]{7,40}$/.test(String(wantCommit).trim()))
    bindFail.push(`--expect-commit 값이 커밋 SHA 가 아니다: '${wantCommit}'`);
  else {
    const resolved = git(['rev-parse', '--verify', '--quiet', `${String(wantCommit).trim().toLowerCase()}^{commit}`]);
    if (!resolved) bindFail.push(`--expect-commit ${wantCommit} 를 커밋으로 해석할 수 없다 — 없는 개체이거나 모호한 짧은 SHA 다`);
    else if (resolved !== commit) bindFail.push(`측정 커밋 불일치 — 요구 ${resolved} · 실제 ${commit}`);
  }
  const dirty = git(['status', '--porcelain', '--', ...SELECTION.roots]);
  if (dirty === null) bindFail.push('작업 트리 상태를 읽을 수 없다');
  else if (dirty !== '') bindFail.push(`선택 범위가 깨끗하지 않다 — ${dirty.split(/\r?\n/).length}건 변경. clean checkout 에서 재라`);
}

/**
 * 입력 범위 해시 — 감사가 실제로 읽은 것을 결속한다 (솔 `W1 R1 F01` · 페이블 재종결 조건).
 * 선택된 파일의 `경로 + git blob SHA` 를 정렬해 잇고 감사 스크립트 자신의 sha256 을 더한다.
 * git 이 없으면 blob SHA 자리에 내용 sha256 을 쓴다 — 정보는 같고 결속도 같다.
 */
// blob id 를 **직접 계산한다** — `git hash-object` 를 부르면 git 설정(autocrlf 등)에 기대게 되고,
// git 이 없는 자리에서는 아예 못 잰다. `sha1("blob " + 길이 + "\0" + CRLF→LF 정규화 내용)` 은
// `git hash-object` 와 같은 값이면서 OS 와 git 유무에 좌우되지 않는다 (페이블 `R6` 차단).
const blobId = (buf) => {
  const lf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${lf.length}\u0000`, 'utf8'), lf])).digest('hex');
};
const blobIds = files.map(f => `${relative(repoRoot, f).replace(/\\/g, '/')}\u0000${blobId(readFileSync(f))}`).sort();
const scopeHash = sha(Buffer.from(
  [...blobIds, `\u0000self\u0000${blobId(readFileSync(new URL(import.meta.url)))}`].join('\n'), 'utf8'));

if (bindFail.length) {
  console.error('토큰 채택 감사 — 입력 결속 FAIL');
  for (const f of bindFail) console.error(`  - ${f}`);
  process.exit(1);
}

const declarationSummaryOf = (list) => {
  const byGroup = {};
  for (const d of list) {
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
};

const out = {
  manifest: {
    generatedAt: new Date().toISOString(), schemaVersion: 1,
    script: { name: basename(new URL(import.meta.url).pathname), sha256: sha(readFileSync(new URL(import.meta.url))) },
    repo: { headCommit: commit, headTree: treeOid, toplevel: toplevel ?? null },
    결속: { expectCommit: wantCommit ?? null, 범위해시: scopeHash,
      범위해시정의: '선택된 파일의 "경로\\0 git blob SHA" 를 정렬해 잇고 감사 스크립트 자신의 blob SHA 를 더해 sha256. blob SHA 는 CRLF→LF 정규화 뒤 직접 계산하므로 OS·git 유무에 좌우되지 않는다(페이블 R6 차단). 커밋 SHA 자기참조 없이 입력을 결속한다.' },
    runner: { node: process.version, typescript: ts.version },
    selection: SELECTION,
    fileLayers: { tokenDefinition: TOKEN_DEFINITION_FILES, sharedComponentPrefixes: SHARED_COMPONENT_PREFIXES,
      note: '토큰 정의는 definitions 인벤토리로 분리해 하드코딩 실행 우주에서 제외한다. 공용 컴포넌트는 토큰을 소비해야 정상이므로 제외하지 않고 따로 센다' },
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
      definitionDeclarations: 'tokenDefinition 파일의 숫자·굵기 선언은 definitions 에만 보존하고 declarations/defect 우주에서는 제외한다',
      lineHeightFontSizePair: 'lineHeight 선언은 같은 스타일 객체의 직접 숫자 fontSize 짝을 보존한다. 짝이 없으면 missing 으로 남겨 추정 수렴을 막는다',
    },
  },
  definitions: {
    declarations: definitionDeclarations,
    declarationSummary: declarationSummaryOf(definitionDeclarations),
    total: definitionDeclarations.length,
  },
  declarations,
  declarationSummary: declarationSummaryOf(declarations),
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
