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
 * 실행 전제: 저장소 루트에서 `corepack pnpm install --frozen-lockfile`로 lockfile 의
 * `typescript` 파서를 설치한다. 없으면 아래 import guard가 재현 명령과 함께 종료한다.
 *
 * 남은 한계는 정직하게 적는다: 같은 부모의 직접 형제는 조건부 JSX까지 정적 검사하지만,
 * 부모 경계·다른 부모·absolute·z-order는 네이티브 렌더 감사(`S4`)의 몫이다.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
let ts;
try {
  const typescriptModule = await import('typescript');
  ts = typescriptModule.default ?? typescriptModule;
} catch (error) {
  console.error('touch-target-audit: TypeScript 파서 의존성이 없습니다. 저장소 루트에서 `corepack pnpm install --frozen-lockfile`을 먼저 실행하세요.');
  process.exit(2);
}

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

// S3a 이후 인라인 숫자는 `space.sm`·`controlVisualHeight.md` 같은 정적 토큰 참조가 된다.
// 토큰을 읽지 못해 판정불가가 늘면 제품 회귀가 아니라 감사기 거짓 양성이다. `tokens.ts`의
// 숫자 리터럴 객체만 펼치며, 계산식·함수·외부 값은 계속 판정불가로 남긴다.
const tokenNumberValues = new Map();
const unwrapTokenInitializer = (node) => {
  let current = node;
  while (current && (ts.isAsExpression(current) || ts.isSatisfiesExpression?.(current)
    || ts.isParenthesizedExpression(current) || ts.isTypeAssertionExpression(current))) current = current.expression;
  return current;
};
const tokenNumericLiteral = (node) => {
  const current = unwrapTokenInitializer(node);
  if (current && ts.isNumericLiteral(current)) return Number(current.text);
  if (current && ts.isPrefixUnaryExpression(current) && current.operator === ts.SyntaxKind.MinusToken
    && ts.isNumericLiteral(current.operand)) return -Number(current.operand.text);
  if (current && ts.isPropertyAccessExpression(current)) return tokenNumberValues.get(current.getText()) ?? null;
  return null;
};
const tokenFile = join(srcRoot, 'src', 'theme', 'tokens.ts');
if (existsSync(tokenFile)) {
  const source = ts.createSourceFile(tokenFile, readFileSync(tokenFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const collectObject = (prefix, raw) => {
    const node = unwrapTokenInitializer(raw);
    if (!node || !ts.isObjectLiteralExpression(node)) return;
    for (const property of node.properties) if (ts.isPropertyAssignment(property)) {
      const name = property.name.getText(source).replace(/^['"]|['"]$/g, '');
      const key = `${prefix}.${name}`;
      const numeric = tokenNumericLiteral(property.initializer);
      if (numeric !== null) tokenNumberValues.set(key, numeric);
      else collectObject(key, property.initializer);
    }
  };
  for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        const numeric = tokenNumericLiteral(declaration.initializer);
        if (numeric !== null) tokenNumberValues.set(declaration.name.text, numeric);
        else collectObject(declaration.name.text, declaration.initializer);
      }
    }
  }
}

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
  const ref = rest.match(/^\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*\}/);
  if (ref && tokenNumberValues.has(ref[1])) {
    const v = tokenNumberValues.get(ref[1]);
    return { top: v, bottom: v, left: v, right: v, form: `토큰 ${ref[1]}=${v}` };
  }
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
  const m = clean.match(new RegExp(`(?:^|[^A-Za-z])${key}\\s*:\\s*(\\d+(?:\\.\\d+)?|[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)+)`));
  if (!m) return null;
  return /^\d/.test(m[1]) ? Number(m[1]) : (tokenNumberValues.get(m[1]) ?? null);
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

// ── 같은 부모의 일반 flow 형제 중첩 ──────────────────────────────────────────
// 선언상 44 만 맞추면 서로 붙은 버튼의 hitSlop 이 같은 공간을 차지할 수 있다. RN 은 겹친
// 형제 중 z-index 가 높은 쪽을 우선하므로, 그 상태는 두 버튼 모두의 독립 44px 계약이 아니다.
// TSX AST 로 **직접 이웃인 pressable 또는 공용 조작 컴포넌트 형제**와 부모의 inline gap 을
// 읽어 각 안쪽 hitSlop 이 gap/2 를 넘지 않는지 확인한다. 공용 컴포넌트는 아래 계약표에서
// 내부 hitSlop을 펼친다. 표에 없는 대문자 컴포넌트는 무판정 통과시키지 않고 판정불가로 남긴다.
// 다른 부모·absolute·부모 clipping 은 네이티브 실측의 몫이다.
const PRESSABLE_NAMES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback']);
const jsxName = (n) => n?.tagName?.getText?.() ?? '';
const attr = (opening, name) => opening.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.text === name);
const numberOf = (e) => {
  const current = unwrapTokenInitializer(e);
  if (!current) return null;
  if (ts.isNumericLiteral(current)) return Number(current.text);
  if (ts.isPrefixUnaryExpression(current) && current.operator === ts.SyntaxKind.MinusToken
    && ts.isNumericLiteral(current.operand)) return -Number(current.operand.text);
  if (ts.isPropertyAccessExpression(current)) return tokenNumberValues.get(current.getText()) ?? null;
  return null;
};
const objectNumbers = (e) => {
  if (!e || !ts.isObjectLiteralExpression(e)) return null;
  const out = {};
  for (const p of e.properties) if (ts.isPropertyAssignment(p)) {
    const k = p.name.getText().replace(/^['"]|['"]$/g, '');
    const v = numberOf(p.initializer);
    if (v !== null) out[k] = v;
    else if (ts.isStringLiteral(p.initializer)) out[k] = p.initializer.text;
  }
  return out;
};
const expressionOf = (a) => a?.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : null;
const unwrapExpression = (e) => {
  let current = e;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current))) current = current.expression;
  return current;
};
const astHitSlop = (opening) => {
  const hitSlopAttr = attr(opening, 'hitSlop');
  if (!hitSlopAttr) return { values: { top: 0, bottom: 0, left: 0, right: 0 }, resolved: true };
  const e = unwrapExpression(expressionOf(hitSlopAttr));
  const n = numberOf(e);
  if (n !== null) return { values: { top: n, bottom: n, left: n, right: n }, resolved: true };
  if (!e || !ts.isObjectLiteralExpression(e)) return { values: {}, resolved: false };
  const o = objectNumbers(e) ?? {};
  const relevant = new Set(['top', 'bottom', 'left', 'right', 'horizontal', 'vertical']);
  const unresolved = e.properties.some(p => ts.isSpreadAssignment(p) || (ts.isPropertyAssignment(p)
    && relevant.has(p.name.getText().replace(/^['"]|['"]$/g, '')) && numberOf(p.initializer) === null));
  return { values: { top: o.top ?? o.vertical ?? 0, bottom: o.bottom ?? o.vertical ?? 0,
    left: o.left ?? o.horizontal ?? 0, right: o.right ?? o.horizontal ?? 0 }, resolved: !unresolved };
};
const styleKeys = new Set(['flexDirection', 'gap', 'rowGap', 'columnGap', 'margin', 'marginHorizontal',
  'marginVertical', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom']);
const astStyle = (opening) => {
  const styleAttr = attr(opening, 'style');
  if (!styleAttr) return { values: {}, resolved: true };
  const e = unwrapExpression(expressionOf(styleAttr));
  if (!e || !ts.isObjectLiteralExpression(e)) return { values: {}, resolved: false };
  const values = objectNumbers(e) ?? {};
  const unresolved = e.properties.some(p => ts.isSpreadAssignment(p) || (ts.isPropertyAssignment(p)
    && styleKeys.has(p.name.getText().replace(/^['"]|['"]$/g, ''))
    && numberOf(p.initializer) === null && !ts.isStringLiteral(p.initializer)));
  return { values, resolved: !unresolved };
};
const isPressableOpening = (opening) => PRESSABLE_NAMES.has(jsxName(opening)) && Boolean(attr(opening, 'onPress'));
const isCustomInteractiveOpening = (opening) => /^[A-Z]/.test(jsxName(opening)) && Boolean(attr(opening, 'onPress'));
const isInteractiveOpening = (opening) => isPressableOpening(opening) || isCustomInteractiveOpening(opening);
const buttonPath = join(srcRoot, 'src', 'components', 'kit', 'Button.tsx');
const buttonSource = existsSync(buttonPath) ? readFileSync(buttonPath, 'utf8') : '';
const buttonDefaultSize = buttonSource.match(/\bsize\s*=\s*'([A-Za-z]+)'/)?.[1] ?? null;
const buttonHitSlopBySize = new Map([...buttonSource.matchAll(/(\w+)\s*:\s*\{\s*pv:\s*\d+,\s*ph:\s*\d+,\s*fs:\s*\d+,\s*r:\s*\d+,\s*hs:\s*(\d+)/g)]
  .map((match) => [match[1], Number(match[2])]));
const buttonHitSlopMode = /hitSlop\s*=\s*\{\{\s*top:\s*s\.hs,\s*bottom:\s*s\.hs\s*\}\}/.test(buttonSource)
  ? 'vertical' : /hitSlop\s*=\s*\{s\.hs\}/.test(buttonSource) ? 'all' : null;
const componentHitSlop = (opening) => {
  if (isPressableOpening(opening)) return astHitSlop(opening);
  if (jsxName(opening) !== 'Button') return { values: {}, resolved: false };
  const sizeAttr = attr(opening, 'size');
  let size = buttonDefaultSize;
  if (sizeAttr) {
    if (ts.isStringLiteral(sizeAttr.initializer)) size = sizeAttr.initializer.text;
    else {
      const expression = unwrapExpression(expressionOf(sizeAttr));
      if (expression && ts.isStringLiteral(expression)) size = expression.text;
      else return { values: {}, resolved: false };
    }
  }
  const hs = size ? buttonHitSlopBySize.get(size) : undefined;
  if (hs === undefined || !buttonHitSlopMode) return { values: {}, resolved: false };
  return { values: { top: hs, bottom: hs,
    left: buttonHitSlopMode === 'all' ? hs : 0, right: buttonHitSlopMode === 'all' ? hs : 0 }, resolved: true };
};
const siblingPairs = [];
const siblingUnjudged = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const atOf = (opening) => `${relative(idRoot, f).replace(/\\/g, '/')}:${sf.getLineAndCharacterOfPosition(opening.getStart(sf)).line + 1}`;
  const parentUnjudged = new Map();
  const expressionUnjudged = new Map();
  const markUnjudged = (opening, reason) => {
    const at = atOf(opening);
    const reasons = parentUnjudged.get(at) ?? new Set();
    reasons.add(reason);
    parentUnjudged.set(at, reasons);
  };
  const markExpressionUnjudged = (opening, reason) => {
    const at = atOf(opening);
    const reasons = expressionUnjudged.get(at) ?? new Set();
    reasons.add(reason);
    expressionUnjudged.set(at, reasons);
  };
  const jsxOpening = (node) => ts.isJsxElement(node) ? node.openingElement
    : ts.isJsxSelfClosingElement(node) ? node : null;
  const combine = (left, right, opening) => {
    const out = [];
    for (const a of left) for (const b of right) {
      if (out.length >= 128) { markExpressionUnjudged(opening, '조건부 JSX 조합이 128개를 넘어 정적으로 펼치지 못했다'); return out; }
      out.push([...a, ...b]);
    }
    return out;
  };
  const alternativesFromExpression = (raw, parentOpening) => {
    const e = unwrapExpression(raw);
    if (!e || e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword
      || e.kind === ts.SyntaxKind.TrueKeyword || ts.isStringLiteral(e) || ts.isNumericLiteral(e)) return [[]];
    const opening = jsxOpening(e);
    if (opening) return [[opening]];
    if (ts.isJsxFragment(e)) return alternativesFromChildren(e.children, parentOpening);
    if (ts.isConditionalExpression(e)) return [
      ...alternativesFromExpression(e.whenTrue, parentOpening),
      ...alternativesFromExpression(e.whenFalse, parentOpening),
    ];
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      return [[], ...alternativesFromExpression(e.right, parentOpening)];
    if (ts.isArrayLiteralExpression(e)) {
      let sequences = [[]];
      for (const item of e.elements) sequences = combine(sequences, alternativesFromExpression(item, parentOpening), parentOpening);
      return sequences;
    }
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'map') {
      const callback = e.arguments[0];
      let returned = [];
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        if (ts.isBlock(callback.body)) {
          const collectReturns = (n) => {
            if (ts.isReturnStatement(n) && n.expression) returned.push(...alternativesFromExpression(n.expression, parentOpening));
            else ts.forEachChild(n, collectReturns);
          };
          collectReturns(callback.body);
        } else returned = alternativesFromExpression(callback.body, parentOpening);
      }
      if (!returned.length) { markExpressionUnjudged(parentOpening, '.map() 반환 JSX를 정적으로 펼치지 못했다'); return [[]]; }
      return [[], ...returned, ...returned.map(sequence => [...sequence, ...sequence])];
    }
    markExpressionUnjudged(parentOpening, `JSX 식을 정적으로 펼치지 못했다 (${ts.SyntaxKind[e.kind]})`);
    return [[]];
  };
  const alternativesFromChild = (child, parentOpening) => {
    const opening = jsxOpening(child);
    if (opening) return [[opening]];
    if (ts.isJsxFragment(child)) return alternativesFromChildren(child.children, parentOpening);
    if (ts.isJsxExpression(child)) return alternativesFromExpression(child.expression, parentOpening);
    return [[]];
  };
  function alternativesFromChildren(children, parentOpening) {
    let sequences = [[]];
    for (const child of children) sequences = combine(sequences, alternativesFromChild(child, parentOpening), parentOpening);
    return sequences;
  }
  const seenPairs = new Set();
  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const parentStyle = astStyle(node.openingElement);
      const alternatives = alternativesFromChildren(node.children, node.openingElement);
      if (alternatives.some(elements => elements.some(isInteractiveOpening))) {
        const pending = expressionUnjudged.get(atOf(node.openingElement));
        if (pending) for (const reason of pending) markUnjudged(node.openingElement, reason);
      }
      for (const elements of alternatives) for (let i = 0; i < elements.length - 1; i++) {
        const first = elements[i], second = elements[i + 1];
        if (!isInteractiveOpening(first) || !isInteractiveOpening(second)) continue;
        const firstAt = atOf(first), secondAt = atOf(second), pair = `${firstAt}|${secondAt}`;
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);
        const firstStyle = astStyle(first), secondStyle = astStyle(second);
        const firstHitSlop = componentHitSlop(first), secondHitSlop = componentHitSlop(second);
        if (!parentStyle.resolved || !firstStyle.resolved || !secondStyle.resolved
          || !firstHitSlop.resolved || !secondHitSlop.resolved) {
          markUnjudged(node.openingElement, `형제 ${pair}의 style·gap·hitSlop 중 정적으로 읽지 못한 값이 있다`);
          continue;
        }
        const style = parentStyle.values;
        const axis = style.flexDirection === 'row' || style.flexDirection === 'row-reverse' ? 'horizontal' : 'vertical';
        const parentGap = Number(axis === 'horizontal' ? (style.columnGap ?? style.gap ?? 0) : (style.rowGap ?? style.gap ?? 0));
        const aStyle = firstStyle.values, bStyle = secondStyle.values;
        const gap = parentGap + Number(axis === 'horizontal'
          ? (aStyle.marginRight ?? aStyle.marginHorizontal ?? aStyle.margin ?? 0) + (bStyle.marginLeft ?? bStyle.marginHorizontal ?? bStyle.margin ?? 0)
          : (aStyle.marginBottom ?? aStyle.marginVertical ?? aStyle.margin ?? 0) + (bStyle.marginTop ?? bStyle.marginVertical ?? bStyle.margin ?? 0));
        const a = firstHitSlop.values, b = secondHitSlop.values, limit = gap / 2;
        const firstInward = axis === 'horizontal' ? a.right : a.bottom;
        const secondInward = axis === 'horizontal' ? b.left : b.top;
        siblingPairs.push({ pair, firstAt, secondAt, axis, gap, limit,
          firstInward, secondInward, 판정: firstInward <= limit && secondInward <= limit ? '통과' : '중첩위험' });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  siblingUnjudged.push(...[...parentUnjudged].map(([at, reasons]) => ({ at, 사유: [...reasons].sort().join(' · ') })));
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
// 그래서 호출부 뒤에 강제 하한이 없으면 판정은 **경계**다. 실제 높이는 `S4` 렌더 실측
// (Android·iOS)이 닫는다.
//
// 경계는 위험이 열려 있는 상태다. 그래서 **모든 variant 의 소비처 ID 와 개수를 래칫한다** —
// 열린 위험이 조용히 퍼지는 것을 막는다. `Button` 이 호출부가 무력화할 수 없는
// `minHeight: 44` 를 **호출부 style 뒤에** 갖거나, variant별 정적 hitSlop이 내용 하한을 44로
// 만들고 모든 소비처가 높이·세로 padding을 덮지 않으면 정적 통과로 닫는다. 후자는 S4a의
// "시각 변화 0" 계약을 지키는 경로다. 호출부 치수 override가 하나라도 있으면 다시 경계다.

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
  const dimensionOverrides = new Map();
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
      const variant = lit ? (lit[1] ?? lit[2]) : defaultSize;
      const inlineStyle = body.match(/\bstyle\s*=\s*\{\{([\s\S]*?)\}\}/)?.[1];
      const unknownStyle = /\bstyle\s*=/.test(body) && inlineStyle === undefined;
      const dimensionOverride = unknownStyle || /\b(?:height|minHeight|maxHeight|padding|paddingVertical|paddingTop|paddingBottom)\s*:/.test(inlineStyle ?? '');
      if (dimensionOverride && bucket === byVariant) {
        if (!dimensionOverrides.has(variant)) dimensionOverrides.set(variant, []);
        dimensionOverrides.get(variant).push(at);
      }
      if (lit) { add(variant, at); continue; }
      if (/\bsize\s*=\s*\{/.test(body) || SPREAD.test(body)) { if (bucket === byVariant) dynamic.push(at); continue; }
      add(defaultSize, at);
    }
  }
  return { byVariant, testByVariant, dynamic, dimensionOverrides };
};

const componentContracts = [];
let dynamicUses = null;
{
  const bt = join(srcRoot, 'src', 'components', 'kit', 'Button.tsx');
  if (existsSync(bt)) {
    const t = readFileSync(bt, 'utf8');
    const d = t.match(/\bsize\s*=\s*'([A-Za-z]+)'/);
    const m = t.match(/const sizes[^=]*=\s*\{([\s\S]*?)\n\s*\};/);
    const styleArray = t.match(/style\s*=\s*\{(?:\s*\([^)]*\)\s*=>)?\s*\[([\s\S]*?)\]\s*\}/);
    const callerStyleAt = styleArray?.[1].search(/(?:^|,)\s*style\s*(?:,|$)/) ?? -1;
    const forcedMin = styleArray?.[1].match(/\{\s*minHeight\s*:\s*(\d+(?:\.\d+)?|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}/);
    const forcedMinAt = forcedMin ? styleArray[1].indexOf(forcedMin[0]) : -1;
    const forcedMinValue = forcedMin
      ? (/^\d/.test(forcedMin[1]) ? Number(forcedMin[1]) : (tokenNumberValues.get(forcedMin[1]) ?? null))
      : null;
    const lockedMinHeight = callerStyleAt >= 0 && forcedMinAt > callerStyleAt ? forcedMinValue : null;
    const variantHitSlop = /hitSlop\s*=\s*\{\{\s*top:\s*s\.hs,\s*bottom:\s*s\.hs\s*\}\}/.test(t);
    if (!d) componentContracts.push({ 컴포넌트: 'Button', 판정: '읽기실패', 사유: "기본 size 값(`size = 'md'`)을 못 읽었다 — 기본값을 모르면 size 없는 자리를 배정할 수 없다" });
    else if (!m) componentContracts.push({ 컴포넌트: 'Button', 판정: '읽기실패', 사유: 'sizes 표를 못 읽었다 — 모양이 바뀌었으면 계약을 다시 맞춰라' });
    else {
      const uses = buttonUses(d[1]);
      dynamicUses = uses.dynamic;
      for (const line of m[1].split('\n')) {
        const v = line.match(/(\w+)\s*:\s*\{\s*pv:\s*(\d+),\s*ph:\s*(\d+),\s*fs:\s*(\d+),\s*r:\s*(\d+),\s*hs:\s*(\d+)/);
        if (!v) continue;
        const [, name, pv, ph, fs, , hs] = v;
        const contentLo = 2 * +pv + +fs;
        const overrides = uses.dimensionOverrides.get(name) ?? [];
        const hitSlopLo = variantHitSlop && overrides.length === 0 ? contentLo + 2 * +hs : contentLo;
        const lo = lockedMinHeight === null ? hitSlopLo : Math.max(contentLo, lockedMinHeight);
        const staticallyClosed = (lockedMinHeight !== null && lockedMinHeight >= MIN)
          || (variantHitSlop && overrides.length === 0 && hitSlopLo >= MIN);
        const at = (uses.byVariant.get(name) ?? []).slice().sort();
        const 시험 = (uses.testByVariant.get(name) ?? []).slice().sort();
        componentContracts.push({ 컴포넌트: `Button size="${name}"`, paddingVertical: +pv, fontSize: +fs, hitSlop: +hs,
          높이하한: lo, 기본값여부: name === d[1], 판정: staticallyClosed ? '통과' : '경계',
          판정사유: lockedMinHeight !== null && lockedMinHeight >= MIN
            ? `호출부 style 뒤의 강제 minHeight ${lockedMinHeight} 가 모든 variant 를 44 아래로 줄지 않게 한다`
            : variantHitSlop && overrides.length === 0 && hitSlopLo >= MIN
              ? `내용 하한 ${contentLo} + hitSlop ${hs}×2 = ${hitSlopLo}, 치수 override 소비처 0으로 시각 크기 없이 44를 채운다`
              : overrides.length > 0
                ? `치수 override 소비처 ${overrides.length}곳(${overrides.join(', ')}) 때문에 variant hitSlop 하한을 정적으로 보장하지 못한다`
            : lo >= MIN
              ? `내용 하한 ${lo} 는 44 를 넘지만 호출부 style 이 padding·height 를 덮어 줄일 수 있어 정적으로 닫지 않는다 (R4 F02)`
              : `내용 하한 ${lo} < 44 이고 호출부 뒤 강제 하한이 없다 — S4 렌더 실측이 닫는다`,
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

const known = existsSync(knownPath) ? JSON.parse(readFileSync(knownPath, 'utf8')) : { entries: [] };
const judged = rows.filter(r => r.판정 !== '판정불가');
const rawShort = judged.filter(r => r.판정 === '미달');
const short = rawShort;
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
const siblingRisks = siblingPairs.filter(p => p.판정 === '중첩위험');
const knownSibling = new Map((known.siblingOverlaps ?? []).map(e => [e.pair, e]));
for (const p of siblingRisks) if (!knownSibling.has(p.pair))
  failures.push(`새 형제 중첩 위험 — ${p.pair} · ${p.axis} gap ${p.gap}의 절반 ${p.limit}보다 안쪽 hitSlop ${p.firstInward}/${p.secondInward}가 크다`);
for (const p of siblingRisks) {
  const e = knownSibling.get(p.pair);
  if (e && (e.gap !== p.gap || e.firstInward !== p.firstInward || e.secondInward !== p.secondInward))
    failures.push(`알려진 형제 중첩 수치가 바뀌었다 — ${p.pair} · gap ${e.gap}→${p.gap}, 안쪽 ${e.firstInward}/${e.secondInward}→${p.firstInward}/${p.secondInward}`);
}
const siblingRiskSet = new Set(siblingRisks.map(p => p.pair));
for (const [pair] of knownSibling) if (!siblingRiskSet.has(pair))
  failures.push(`형제 중첩 위험이 해소됐다 — ${pair} 를 siblingOverlaps 에서 빼라`);
const currentSiblingUnjudged = new Map(siblingUnjudged.map(e => [e.at, e]));
const knownSiblingUnjudged = new Map((known.siblingUnjudged ?? []).map(e => [e.at, e]));
if (known.siblingUnjudged === undefined) failures.push('알려진 형제판정불가 목록이 없다 — 조건부 JSX나 동적 style이 늘어도 조용히 통과한다');
else {
  for (const [at, e] of currentSiblingUnjudged) if (!knownSiblingUnjudged.has(at))
    failures.push(`새 형제판정불가 — ${at} · ${e.사유}`);
  for (const [at, e] of currentSiblingUnjudged) {
    const previous = knownSiblingUnjudged.get(at);
    if (previous && previous.사유 !== e.사유)
      failures.push(`형제판정불가 사유가 바뀌었다 — ${at} · ${previous.사유} → ${e.사유}`);
  }
  for (const [at] of knownSiblingUnjudged) if (!currentSiblingUnjudged.has(at))
    failures.push(`형제판정불가가 해소됐다 — ${at} 를 siblingUnjudged에서 빼라`);
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
    한계: '같은 부모의 직접 이웃인 일반 flow pressable 은 조건부 JSX·Fragment·map 반환 JSX까지 펼쳐 gap/2 규칙으로 정적 검사한다. 펼칠 수 없는 JSX 식과 동적 style/gap/hitSlop은 형제판정불가로 래칫한다. 부모 경계·다른 부모·absolute·z-order 는 네이티브 렌더 감사(S4)의 몫이다.',
    측정,
    공용컴포넌트판정식: '하한 = 2×paddingVertical + fontSize (가정 A: lineHeight 를 명시하지 않은 Text 의 상자는 fontSize 보다 낮지 않다). 상한의 근거가 없어 미달을 단정하지 않고, 호출부 style 이 padding·height 를 덮어 줄일 수 있어 통과로도 닫지 않는다 — 전부 경계이고 S4 렌더 실측이 닫는다(R4 F02).',
    파일선정: '제품 = apps/mobile 의 .tsx 에서 .test/.spec.tsx 와 tests·__tests__ 폴더를 뺀 것. 시험 fixture 는 따로 세고 제품 재고와 섞지 않는다(R4 F04).',
    generatedAt: new Date().toISOString(), node: process.version,
  },
  summary: { 파일: files.length, 누를수있는상자: rows.length, 판정: judged.length,
    통과: judged.length - short.length, 미달: short.length,
    형제중첩위험: siblingRisks.length, 형제판정불가: siblingUnjudged.length, 판정불가: rows.length - judged.length,
    공용컴포넌트: componentContracts.length, 공용컴포넌트열린것: compOpen.length,
    Button동적size소비처: dynamicUses === null ? '측정 안 함' : dynamicUses.length },
  failures, siblingPairs, siblingUnjudged, componentContracts, Button동적size소비처: dynamicUses ?? [], rows,
};
if (opt['update-known'] !== undefined) {
  const refreshed = { ...known, 제품입력해시, 시험참조해시,
    entries: short.map(s => ({ at: s.at, 유효: `${s.유효폭}×${s.유효높이}`, 사유: '선언상 44 미달 — 후속 보정 필요' })),
    siblingOverlaps: siblingRisks.map(p => ({ ...(knownSibling.get(p.pair) ?? {}), ...p })), siblingUnjudged,
    components: componentContracts, buttonDynamic: dynamicUses ?? [], unjudged: unjudgedAts };
  writeFileSync(knownPath, JSON.stringify(refreshed, null, 2) + '\n');
}
if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`터치 영역 — 판정 ${judged.length}자리 · 통과 ${judged.length - short.length} · **미달 ${short.length}** · 형제중첩위험 ${siblingRisks.length} · 형제판정불가 ${siblingUnjudged.length} · 판정불가 ${rows.length - judged.length}(래칫 대상)`);
for (const c of componentContracts) console.log(`  공용 — ${c.컴포넌트} 높이 하한 ${c.높이하한 ?? '?'} → ${c.판정} · 제품 소비처 ${c.소비처 ?? 0}곳 · 시험 참조 ${c.시험참조 ?? 0}곳`);
if (dynamicUses !== null) console.log(`  공용 — Button size 동적/spread ${dynamicUses.length}곳 (정적 판정 불가)`);
console.log(`  측정 — 커밋 ${측정.커밋.slice(0, 12)} · 작업 트리 ${측정.작업트리} · 결속 ${측정.결속}`);
if (failures.length) {
  console.error('\n터치 영역 래칫 FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('터치 영역 래칫 PASS — 알려진 미달 목록과 일치한다');
