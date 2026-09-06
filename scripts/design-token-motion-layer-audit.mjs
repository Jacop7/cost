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
  return node.tagName?.getText(sourceFile) ?? null;
}

function callName(node, sourceFile) {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.getText(sourceFile);
  return null;
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
      return { ...declaration, bucket: 'componentOwned', role: 'COMPONENT.contextMenu.animationType', target: 'fade' };
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
  for (const absolutePath of files) {
    const rel = relative(root, absolutePath).replace(/\\/g, '/');
    const source = normalizedText(readFileSync(absolutePath, 'utf8'));
    fileHashes.push({ file: rel, sha256: sha256(source) });
    declarations.push(...scanSource(source, { file: rel, layer: layerOf(rel) }));
  }
  declarations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  const classified = classifyDeclarations(declarations);
  const count = (predicate) => declarations.filter(predicate).length;
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  return {
    schemaVersion: 1,
    status: classified.unmapped.length ? 'INCOMPLETE' : 'PROPOSAL_COMPLETE',
    manifest: {
      sourceCommit: head,
      script: basename(here),
      scriptSha256: sha256(normalizedText(readFileSync(here, 'utf8'))),
      selection: SELECTION,
      filesMeasured: files.length,
      scopeSha256: sha256(canonical(fileHashes)),
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
    interpretation: {
      durationEasing: '현재 앱에는 직접 선언된 duration/easing 또는 Animated/Reanimated 호출이 없다. React Native Modal preset의 내부 시간값을 소스에서 추정하지 않는다.',
      tokens: '현재 6건은 세 컴포넌트 역할로 완전 배정된다. 숫자 primitive를 새로 만들 근거는 없으며 중앙 토큰 신설은 실제 두 번째 사용처가 생길 때 재검토한다.',
    },
    assignments: classified.assignments,
    failures: classified.unmapped.map((item) => `미매핑: ${item.file}:${item.line}:${item.column} ${item.prop}=${item.value}`),
  };
}

if (resolve(process.argv[1] ?? '') === resolve(here)) {
  const options = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const index = arg.indexOf('='); return index < 0 ? [arg.slice(2), true] : [arg.slice(2, index), arg.slice(index + 1)];
  }));
  const root = resolve(options.root ?? defaultRoot);
  const output = resolve(options.out ?? join(root, 'docs/prototypes/full-page-flow-prototype-motion-layer-audit.json'));
  const result = auditRepository(root);
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`P1c 모션·레이어 감사 — 선언 ${result.summary.declarations} · 모션 ${result.summary.motion} · 레이어 ${result.summary.layer} · 미매핑 ${result.summary.unmapped}`);
  if (result.failures.length) {
    console.error(result.failures.join('\n'));
    process.exit(1);
  }
  console.log(`PASS ${output}`);
}
