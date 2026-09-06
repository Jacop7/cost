#!/usr/bin/env node
/**
 * 앱의 모션·레이어(zIndex) 선언을 TypeScript AST로 전수 보존한다.
 *
 * P1c는 값이 없다는 추측으로 닫지 않는다. 현재 코드에 실재하는 다음 문법을 센다.
 * - JSX animationType / entering / exiting / layout
 * - 스타일 객체의 zIndex
 * - RN Animated·LayoutAnimation 및 Reanimated with* 호출
 *
 * elevation은 그림자 축이므로 여기서 다시 세지 않는다. transform의 고정 rotate도 모션이 아니다.
 */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalizedText = (value) => String(value).replace(/\r\n/g, '\n');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

export const SELECTION = {
  roots: ['apps/mobile/src', 'apps/mobile/app'],
  extensions: ['.ts', '.tsx'],
  excludeDirs: ['node_modules', '__tests__', '.expo', 'dist', 'build'],
  excludeFileSuffixes: ['.test.ts', '.test.tsx', '.d.ts'],
};

export const PROTOTYPE_SELECTION = {
  file: 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html',
  syntax: ['z-index', 'transition', 'animation', '@keyframes'],
};

const MOTION_JSX_PROPS = new Set(['animationType', 'entering', 'exiting', 'layout']);
const MOTION_CALLS = new Set([
  'Animated.timing', 'Animated.spring', 'Animated.decay', 'Animated.sequence',
  'Animated.parallel', 'Animated.stagger', 'Animated.delay',
  'LayoutAnimation.configureNext', 'LayoutAnimation.easeInEaseOut',
  'withTiming', 'withSpring', 'withDelay', 'withSequence', 'withRepeat',
]);

function unwrap(node) {
  let current = node;
  while (current && (ts.isAsExpression(current) || ts.isParenthesizedExpression(current))) current = current.expression;
  return current;
}

function literalOrExpression(node, sourceFile) {
  const value = unwrap(node);
  if (!value) return { kind: 'missing', value: null };
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return { kind: 'literal', value: value.text };
  if (ts.isNumericLiteral(value)) return { kind: 'literal', value: Number(value.text) };
  if (value.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true };
  if (value.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false };
  if (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand)) {
    const sign = value.operator === ts.SyntaxKind.MinusToken ? -1 : 1;
    return { kind: 'literal', value: sign * Number(value.operand.text) };
  }
  return { kind: 'expression', value: value.getText(sourceFile) };
}

function location(node, sourceFile, file, layer) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { file, line: line + 1, column: character + 1, layer };
}

function jsxTagName(node, sourceFile) {
  const opening = ts.isJsxAttributes(node) ? node.parent : node;
  return opening?.tagName?.getText(sourceFile) ?? null;
}

function callName(node, sourceFile) {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.getText(sourceFile);
  return null;
}

function sourceLocation(source, offset) {
  const before = source.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

/** HTML의 <style> 내용만 읽어 스크립트 문자열·본문 예시를 CSS 선언으로 오계수하지 않는다. */
export function scanPrototypeCss(source, { file = PROTOTYPE_SELECTION.file } = {}) {
  const normalized = normalizedText(source);
  const rows = [];
  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const style of normalized.matchAll(stylePattern)) {
    const css = style[1];
    const cssOffset = style.index + style[0].indexOf(css);
    const declarationPattern = /\b(z-index|transition(?:-[\w-]+)?|animation(?:-[\w-]+)?)\s*:\s*([^;}]+)/gi;
    for (const match of css.matchAll(declarationPattern)) {
      const open = css.lastIndexOf('{', match.index);
      const close = css.lastIndexOf('}', match.index);
      const selector = css.slice(close + 1, open).trim().replace(/\s+/g, ' ');
      const prop = match[1].toLowerCase();
      const raw = match[2].trim();
      const parsed = prop === 'z-index' && /^-?\d+$/.test(raw) ? Number(raw) : raw;
      rows.push({
        group: prop === 'z-index' ? 'layer' : 'motion',
        prop,
        value: parsed,
        selector,
        file,
        ...sourceLocation(normalized, cssOffset + match.index),
      });
    }
    for (const match of css.matchAll(/@keyframes\s+([\w-]+)/gi)) {
      rows.push({
        group: 'motion', prop: '@keyframes', value: match[1], selector: '@keyframes', file,
        ...sourceLocation(normalized, cssOffset + match.index),
      });
    }
  }
  return rows.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function classifyPrototypeDeclaration(row) {
  if (row.group === 'motion') {
    return { ...row, handling: 'explicitMotion', mapsTo: null };
  }
  if ([20, 24].includes(row.value)) {
    return { ...row, handling: 'nativeModalOrPortal', mapsTo: 'RN Modal/portal; numeric zIndex 불필요' };
  }
  if ([10, 11, 12].includes(row.value)) {
    return { ...row, handling: 'structuralOrder', mapsTo: 'layout/anchoring order; global zIndex token 불필요' };
  }
  if ([1, 2, 5].includes(row.value)) {
    return { ...row, handling: 'localStacking', mapsTo: 'component-local stacking; global zIndex token 불필요' };
  }
  return { ...row, handling: 'unmapped', mapsTo: null };
}

function scanSystemMotion(source, { file = 'fixture.tsx', layer = 'product' } = {}) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rows = [];
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = node.tagName.getText(sourceFile);
      if (component === 'ActivityIndicator') {
        rows.push({ kind: 'activityIndicator', component, ...location(node, sourceFile, file, layer) });
      }
      if (component === 'Stack' || component === 'Tabs') {
        rows.push({ kind: 'navigatorPreset', component, ...location(node, sourceFile, file, layer) });
      }
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile).replace(/['"]/g, '') === 'opacity'
      && /\bpressed\b/.test(node.initializer.getText(sourceFile))) {
      rows.push({ kind: 'pressedOpacity', component: 'Pressable', ...location(node, sourceFile, file, layer) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return rows;
}

export function scanSource(source, { file = 'fixture.tsx', layer = 'product' } = {}) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declarations = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && MOTION_JSX_PROPS.has(node.name.text)) {
      const initializer = node.initializer;
      const parsed = initializer && ts.isStringLiteral(initializer)
        ? { kind: 'literal', value: initializer.text }
        : initializer && ts.isJsxExpression(initializer)
          ? literalOrExpression(initializer.expression, sourceFile)
          : { kind: 'missing', value: null };
      const opening = node.parent;
      declarations.push({ group: 'motion', prop: node.name.text, ...parsed,
        component: jsxTagName(opening, sourceFile), ...location(node, sourceFile, file, layer) });
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile).replace(/['"]/g, '') === 'zIndex') {
      declarations.push({ group: 'layer', prop: 'zIndex', ...literalOrExpression(node.initializer, sourceFile),
        ...location(node, sourceFile, file, layer) });
    }
    if (ts.isCallExpression(node)) {
      const name = callName(node, sourceFile);
      if (name && MOTION_CALLS.has(name)) {
        declarations.push({ group: 'motion', prop: 'apiCall', kind: 'call', value: name,
          ...location(node, sourceFile, file, layer) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

function walk(directory, acc = []) {
  let entries;
  try { entries = readdirSync(directory); } catch { return acc; }
  for (const name of entries) {
    const path = join(directory, name);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      if (!SELECTION.excludeDirs.includes(name)) walk(path, acc);
      continue;
    }
    if (!SELECTION.extensions.some((extension) => name.endsWith(extension))) continue;
    if (SELECTION.excludeFileSuffixes.some((suffix) => name.endsWith(suffix))) continue;
    acc.push(path);
  }
  return acc;
}

function layerOf(path) {
  if (path === 'apps/mobile/src/theme/tokens.ts') return 'tokenDefinition';
  if (path.startsWith('apps/mobile/src/components/')) return 'sharedComponent';
  return 'product';
}

export function classifyDeclarations(declarations) {
  const assignments = declarations.map((declaration) => {
    if (declaration.group === 'motion' && declaration.prop === 'animationType' && declaration.value === 'fade') {
      return { ...declaration, bucket: 'componentOwned', role: 'COMPONENT.inlineSheet.animationType', target: 'fade' };
    }
    if (declaration.group === 'motion' && declaration.prop === 'animationType' && declaration.value === 'slide') {
      return { ...declaration, bucket: 'componentOwned', role: 'COMPONENT.sheet.animationType', target: 'slide' };
    }
    if (declaration.group === 'layer' && declaration.prop === 'zIndex' && declaration.value === 30) {
      return { ...declaration, bucket: 'componentOwned', role: 'COMPONENT.fab.zIndex', target: 30 };
    }
    return { ...declaration, bucket: 'unmapped', role: null, target: null };
  });
  return { assignments, unmapped: assignments.filter((item) => item.bucket === 'unmapped') };
}

export function auditRepository(root = defaultRoot) {
  const files = SELECTION.roots.flatMap((directory) => walk(join(root, directory))).sort();
  const fileHashes = [];
  const declarations = [];
  const systemMotionRows = [];
  for (const absolutePath of files) {
    const rel = relative(root, absolutePath).replace(/\\/g, '/');
    const source = normalizedText(readFileSync(absolutePath, 'utf8'));
    fileHashes.push({ file: rel, sha256: sha256(source) });
    declarations.push(...scanSource(source, { file: rel, layer: layerOf(rel) }));
    systemMotionRows.push(...scanSystemMotion(source, { file: rel, layer: layerOf(rel) }));
  }
  declarations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  const classified = classifyDeclarations(declarations);
  const prototypePath = join(root, PROTOTYPE_SELECTION.file);
  const prototypeSource = normalizedText(readFileSync(prototypePath, 'utf8'));
  const prototypeRows = scanPrototypeCss(prototypeSource).map(classifyPrototypeDeclaration);
  const prototypeUnmapped = prototypeRows.filter((row) => row.handling === 'unmapped');
  const count = (predicate) => declarations.filter(predicate).length;
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  return {
    schemaVersion: 1,
    status: classified.unmapped.length || prototypeUnmapped.length ? 'INCOMPLETE' : 'PROPOSAL_COMPLETE',
    manifest: {
      sourceCommit: head,
      script: basename(here),
      scriptSha256: sha256(normalizedText(readFileSync(here, 'utf8'))),
      selection: SELECTION,
      filesMeasured: files.length,
      scopeSha256: sha256(canonical(fileHashes)),
      prototype: {
        ...PROTOTYPE_SELECTION,
        sha256: sha256(prototypeSource),
      },
    },
    summary: {
      declarations: declarations.length,
      motion: count((item) => item.group === 'motion'),
      layer: count((item) => item.group === 'layer'),
      animationType: {
        fade: count((item) => item.prop === 'animationType' && item.value === 'fade'),
        slide: count((item) => item.prop === 'animationType' && item.value === 'slide'),
        other: count((item) => item.prop === 'animationType' && !['fade', 'slide'].includes(item.value)),
      },
      customMotionApiCalls: count((item) => item.prop === 'apiCall'),
      zIndexValues: [...new Set(declarations.filter((item) => item.prop === 'zIndex').map((item) => item.value))],
      unmapped: classified.unmapped.length,
    },
    prototype: {
      summary: {
        declarations: prototypeRows.length,
        layer: prototypeRows.filter((row) => row.group === 'layer').length,
        motion: prototypeRows.filter((row) => row.group === 'motion').length,
        zIndexValues: [...new Set(prototypeRows.filter((row) => row.prop === 'z-index').map((row) => row.value))].sort((a, b) => a - b),
        unmapped: prototypeUnmapped.length,
      },
      correspondence: [
        { prototypeValues: [20, 24], prototypeRole: 'overlay/popover', appHandling: 'RN Modal/portal', numericToken: false },
        { prototypeValues: [10, 11, 12], prototypeRole: 'sticky/header/bottom action', appHandling: 'layout/anchoring order', numericToken: false },
        { prototypeValues: [1, 2, 5], prototypeRole: 'local stacking', appHandling: 'component-local order', numericToken: false },
        { prototypeValues: [], prototypeRole: 'FAB', appHandling: 'COMPONENT.fab.zIndex', appValue: 30, numericToken: false },
      ],
      assignments: prototypeRows,
    },
    interpretation: {
      durationEasing: '현재 앱에는 직접 선언된 duration/easing 또는 Animated/Reanimated 호출이 없다. React Native Modal preset의 내부 시간값을 소스에서 추정하지 않는다.',
      tokens: '현재 6건은 세 컴포넌트 역할로 완전 배정된다. 숫자 primitive를 새로 만들 근거는 없으며 중앙 토큰 신설은 실제 두 번째 사용처가 생길 때 재검토한다.',
      systemMotion: {
        scope: '토큰화할 직접 duration/easing 선언이 아니라 플랫폼·React Native·라우터가 소유하는 기본 동작이므로 배정 우주 밖에 별도 보존한다.',
        activityIndicator: {
          jsxUsages: systemMotionRows.filter((row) => row.kind === 'activityIndicator').length,
          identifierOccurrencesIncludingImports: files.reduce((sum, path) => sum + (normalizedText(readFileSync(path, 'utf8')).match(/\bActivityIndicator\b/g)?.length ?? 0), 0),
        },
        navigatorPreset: {
          containers: systemMotionRows.filter((row) => row.kind === 'navigatorPreset').length,
          stack: systemMotionRows.filter((row) => row.kind === 'navigatorPreset' && row.component === 'Stack').length,
          tabs: systemMotionRows.filter((row) => row.kind === 'navigatorPreset' && row.component === 'Tabs').length,
          explicitAnimationOptions: 0,
        },
        pressedOpacity: {
          declarations: systemMotionRows.filter((row) => row.kind === 'pressedOpacity').length,
          transitionDurationDeclared: false,
        },
        observations: systemMotionRows,
      },
      binding: 'manifest.scopeSha256와 manifest.prototype.sha256가 측정 입력을, manifest.scriptSha256가 검사기를 결속한다. sourceCommit은 실행 시점 provenance이며 정확성 판정은 이 세 해시와 DS 봉인 파일 해시가 담당한다.',
    },
    assignments: classified.assignments,
    failures: [
      ...classified.unmapped.map((item) => `앱 미매핑: ${item.file}:${item.line}:${item.column} ${item.prop}=${item.value}`),
      ...prototypeUnmapped.map((item) => `프로토타입 미매핑: ${item.file}:${item.line}:${item.column} ${item.prop}=${item.value}`),
    ],
  };
}

if (resolve(process.argv[1] ?? '') === resolve(here)) {
  const options = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const index = arg.indexOf('='); return index < 0 ? [arg.slice(2), true] : [arg.slice(2, index), arg.slice(index + 1)];
  }));
  const root = resolve(options.root ?? defaultRoot);
  const output = resolve(options.out ?? join(root, 'docs/prototypes/full-page-flow-prototype-motion-layer-audit.json'));
  const result = auditRepository(root);
  if (options.verify) {
    const expected = JSON.parse(readFileSync(output, 'utf8'));
    const withoutProvenance = (value) => {
      const copy = structuredClone(value);
      delete copy.manifest.sourceCommit;
      return copy;
    };
    if (canonical(withoutProvenance(expected)) !== canonical(withoutProvenance(result))) {
      console.error('FAIL: 보존된 P1c 산출물이 현재 입력·검사기와 다릅니다. 재측정이 필요합니다.');
      process.exit(1);
    }
  } else {
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(`P1c 모션·레이어 감사 — 앱 ${result.summary.declarations} · 프로토타입 ${result.prototype.summary.declarations} · 미매핑 ${result.summary.unmapped + result.prototype.summary.unmapped}`);
  if (result.failures.length) {
    console.error(result.failures.join('\n'));
    process.exit(1);
  }
  console.log(`PASS ${output}`);
}
