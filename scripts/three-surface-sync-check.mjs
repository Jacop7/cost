#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buildMigrationBacklog, validateMigrationTransition } from './three-surface-migration-contract.mjs';

const argv = process.argv.slice(2);
const option = (name) => argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const flag = (name) => argv.includes(name);
const root = resolve(option('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const declarationsPath = resolve(root, option('--declarations') ?? 'apps/mobile/src/dev/surfaceRegistry.declarations.json');
const generatedPath = resolve(root, option('--generated') ?? 'apps/mobile/src/dev/surfaceRegistry.generated.json');
const readmePath = resolve(root, option('--readme') ?? 'apps/mobile/src/features/README.md');
const prototypePath = resolve(root, option('--prototype') ?? 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html');
const baselinePath = resolve(root, option('--baseline') ?? 'docs/prototypes/three-surface-baseline.json');
const migrationBacklogPath = resolve(root, option('--migration-backlog') ?? 'docs/prototypes/three-surface-migration-backlog.json');
const stubRegistryPath = resolve(root, option('--stub-registry') ?? 'apps/mobile/src/dev/surfaceFixtureStubs.json');
const mobileTsconfigPath = resolve(root, 'apps/mobile/tsconfig.json');
const expectedBaselineFloorsSha256 = 'ff8a545d6205d8c63a61af95f3b3b3e3e2bca1b06f0b9d452a3985a4fa04cd26';
const markerStart = '<!-- THREE-SURFACE-STATUS:START -->';
const markerEnd = '<!-- THREE-SURFACE-STATUS:END -->';
const normalize = (text) => text.replaceAll('\r\n', '\n');
const sha256 = (text) => createHash('sha256').update(normalize(text)).digest('hex');
const rel = (path) => relative(root, path).replaceAll('\\', '/');
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const codeUnitCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const pathKey = (path) => {
  const absolute = resolve(path);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
};
const failures = [];
const fail = (message) => failures.push(message);
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const within = (path, base) => {
  const candidate = pathKey(path);
  const rootPath = pathKey(base);
  return candidate === rootPath || candidate.startsWith(`${rootPath}/`) || candidate.startsWith(`${rootPath}\\`);
};

function walk(base) {
  const output = [];
  const visitedDirectories = new Set();
  const visitedFiles = new Set();
  const walkRoot = resolve(root, base);
  const visit = (path) => {
    if (!existsSync(path)) return;
    const realDirectory = realpathSync.native(path);
    if (!within(realDirectory, walkRoot)) throw new Error(`walk symlink가 root 밖을 가리킨다: ${rel(path)}`);
    const directoryKey = pathKey(realDirectory);
    if (visitedDirectories.has(directoryKey)) return;
    visitedDirectories.add(directoryKey);
    for (const name of readdirSync(realDirectory).sort(codeUnitCompare)) {
      const child = join(realDirectory, name);
      const link = lstatSync(child);
      const realChild = link.isSymbolicLink() ? realpathSync.native(child) : child;
      if (!within(realChild, walkRoot)) throw new Error(`walk symlink가 root 밖을 가리킨다: ${rel(child)}`);
      if (statSync(realChild).isDirectory()) visit(realChild);
      else {
        const fileKey = pathKey(realpathSync.native(realChild));
        if (!visitedFiles.has(fileKey)) { visitedFiles.add(fileKey); output.push(realChild); }
      }
    }
  };
  visit(walkRoot);
  return output;
}

function splitMarkdownRow(line) {
  if (!line.startsWith('|') || !line.endsWith('|')) throw new Error(`Markdown table row 형식 오류: ${line}`);
  const cells = [];
  let current = '';
  let code = false;
  let escaped = false;
  for (const char of line.slice(1, -1)) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === '\\') { current += char; escaped = true; continue; }
    if (char === '`') code = !code;
    if (char === '|' && !code) { cells.push(current.trim()); current = ''; }
    else current += char;
  }
  cells.push(current.trim());
  if (code) throw new Error('Markdown table의 backtick이 닫히지 않았다.');
  return cells;
}

function parseReadme(text) {
  const normalized = normalize(text);
  const starts = normalized.split(markerStart).length - 1;
  const ends = normalized.split(markerEnd).length - 1;
  if (starts > 1 || ends > 1 || starts !== ends) throw new Error('README 생성 상태 표식은 0쌍 또는 정확히 1쌍이어야 한다.');
  const withoutGenerated = starts === 1
    ? `${normalized.slice(0, normalized.indexOf(markerStart))}${normalized.slice(normalized.indexOf(markerEnd) + markerEnd.length)}`
    : normalized;
  const heading = withoutGenerated.indexOf('## 화면 인벤토리');
  if (heading < 0) throw new Error('README 화면 인벤토리 heading이 없다.');
  const nextHeading = withoutGenerated.indexOf('\n## ', heading + 4);
  const section = withoutGenerated.slice(heading, nextHeading < 0 ? undefined : nextHeading);
  const lines = section.split('\n');
  const headerIndex = lines.findIndex((line) => /^\|\s*모듈\s*\|\s*화면 ID\s*\|/.test(line));
  if (headerIndex < 0 || !/^\|(?:\s*:?-+:?\s*\|){5}$/.test(lines[headerIndex + 1] ?? ''))
    throw new Error('README 화면 인벤토리 표 header/delimiter가 없다.');
  const entries = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith('|')) break;
    const cells = splitMarkdownRow(line);
    if (cells.length !== 5) throw new Error(`README 화면 행 열 수 오류: ${line}`);
    const screenId = cells[1].replaceAll('`', '').trim();
    if (screenId === '—') continue;
    if (!/^(?:ING|RCP|ORD|SALES|MY)-\d+[a-z]?$/.test(screenId)) throw new Error(`정식 화면 ID 형식 오류: ${screenId}`);
    entries.push({
      screenId,
      declaredDomain: cells[0].replaceAll('`', '').trim(),
      domain: screenId.startsWith('ING-') ? 'ingredients' : screenId.startsWith('RCP-') ? 'recipes'
        : screenId.startsWith('ORD-') ? 'orders' : screenId.startsWith('SALES-') ? 'sales' : 'my',
      name: cells[2].replaceAll('**', '').trim(),
      locator: cells[3],
      implementationStatus: cells[4].trim(),
    });
  }
  const ids = entries.map(({ screenId }) => screenId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error(`README 중복 screenId: ${[...new Set(duplicates)].join(', ')}`);
  return { entries, sourceSha256: sha256(withoutGenerated) };
}

function scriptContents(html) {
  const output = [];
  const lower = html.toLowerCase();
  let offset = 0;
  while (offset < html.length) {
    const open = lower.indexOf('<script', offset);
    if (open < 0) break;
    const openEnd = lower.indexOf('>', open + 7);
    if (openEnd < 0) throw new Error('prototype script 시작 태그가 닫히지 않았다.');
    const close = lower.indexOf('</script>', openEnd + 1);
    if (close < 0) throw new Error('prototype script 종료 태그가 없다.');
    output.push(html.slice(openEnd + 1, close));
    offset = close + 9;
  }
  if (!output.length) throw new Error('prototype script가 없다.');
  return output;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  throw new Error(`지원하지 않는 property name: ${node.getText()}`);
}

function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return Number(`${node.operator === ts.SyntaxKind.MinusToken ? '-' : ''}${node.operand.text}`);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) {
    const object = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property))
        throw new Error(`prototype registry object에는 property assignment만 허용한다: ${property.getText().slice(0, 80)}`);
      const key = propertyName(property.name);
      if (Object.hasOwn(object, key)) throw new Error(`prototype registry object 중복 key: ${key}`);
      object[key] = literal(property.initializer);
    }
    return object;
  }
  throw new Error(`prototype registry에 비-literal 값이 있다: ${node.getText().slice(0, 80)}`);
}

function findVariable(source, name) {
  const found = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) found.push(declaration.initializer);
  }
  if (found.length !== 1 || !found[0])
    throw new Error(`prototype ${name} registry는 top-level에 정확히 1개 있어야 한다.`);
  return found[0];
}

function parsePrototype(html) {
  const combined = scriptContents(html).join('\n');
  const source = ts.createSourceFile('prototype.js', combined, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const parseErrors = source.parseDiagnostics ?? [];
  if (parseErrors.length) throw new Error(`prototype JS parse 오류: ${parseErrors[0].messageText}`);
  const screens = literal(findVariable(source, 'screens'));
  const popupTabs = literal(findVariable(source, 'popupTabs'));
  const screenTargets = Object.entries(screens).map(([key, value]) => {
    if (!value || typeof value !== 'object' || !/^(?:ING|RCP|ORD|SALES|MY)-\d+[a-z]?$/.test(String(value.route ?? '')))
      throw new Error(`prototype screen tracking ID 오류: ${key}`);
    if (!['ingredient', 'recipe', 'order', 'sales', 'my'].includes(String(value.domain ?? '')))
      throw new Error(`prototype screen domain 오류: ${key}`);
    if (value.hidden !== undefined && typeof value.hidden !== 'boolean')
      throw new Error(`prototype screen hidden 형식 오류: ${key}`);
    return { key, target: `screen:${key}`, hidden: value.hidden === true };
  }).sort((a, b) => codeUnitCompare(a.target, b.target));
  const popupTargets = [];
  for (const [host, rows] of Object.entries(popupTabs)) {
    if (!screens[host]) throw new Error(`popup host에 대응 screen이 없다: ${host}`);
    for (const row of rows) {
      if (!Array.isArray(row) || typeof row[0] !== 'string') throw new Error(`popupTabs 행 형식 오류: ${host}`);
      popupTargets.push({ id: row[0], host, target: `popup:${row[0]}@${host}`, hidden: screens[host].hidden === true });
    }
  }
  popupTargets.sort((a, b) => codeUnitCompare(a.target, b.target));
  const duplicateTargets = [...screenTargets, ...popupTargets].map(({ target }) => target)
    .filter((target, index, values) => values.indexOf(target) !== index);
  if (duplicateTargets.length) throw new Error(`prototype 중복 target: ${[...new Set(duplicateTargets)].join(', ')}`);
  return {
    screenTargets,
    popupTargets,
    sourceSha256: sha256(html),
    hiddenScreenCount: screenTargets.filter(({ hidden }) => hidden).length,
    hiddenPopupTargetCount: popupTargets.filter(({ hidden }) => hidden).length,
  };
}

function routeName(path) {
  return rel(path).replace(/^apps\/mobile\/app\//, '').replace(/(?:^|\/)\([^/]+\)\//g, '').replace(/\.tsx?$/, '');
}

function routeInventory() {
  const routes = walk('apps/mobile/app').filter((path) => /\.tsx?$/.test(path) && !path.endsWith('_layout.tsx'))
    .map((path) => ({ route: routeName(path), file: rel(path) }))
    .sort((a, b) => codeUnitCompare(a.route, b.route) || codeUnitCompare(a.file, b.file));
  const names = routes.map(({ route }) => route.replace(/(?:^|\/)index$/, ''));
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length) throw new Error(`Expo route 이름 중복: ${[...new Set(duplicates)].sort(codeUnitCompare).join(', ')}`);
  return routes;
}

function pathAliases() {
  const parsed = ts.getParsedCommandLineOfConfigFile(mobileTsconfigPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic(diagnostic) {
      throw new Error(`mobile tsconfig를 읽지 못했다: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    },
  });
  if (!parsed) throw new Error('mobile tsconfig를 읽지 못했다.');
  const configErrors = parsed.errors.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (configErrors.length) throw new Error(`mobile tsconfig 오류: ${ts.flattenDiagnosticMessageText(configErrors[0].messageText, '\n')}`);
  const baseUrl = resolve(parsed.options.baseUrl ?? parsed.options.pathsBasePath ?? dirname(mobileTsconfigPath));
  const inheritedPath = resolve(root, 'tsconfig.base.json');
  const inherited = JSON.parse(readFileSync(inheritedPath, 'utf8'));
  const sources = [
    { paths: parsed.options.paths ?? {}, baseUrl },
    { paths: inherited.compilerOptions?.paths ?? {}, baseUrl: dirname(inheritedPath) },
  ];
  return sources.flatMap(({ paths, baseUrl: aliasBase }) => Object.entries(paths).map(([pattern, targets]) => {
    if (!Array.isArray(targets) || !targets.length) throw new Error(`tsconfig paths target 오류: ${pattern}`);
    const star = pattern.indexOf('*');
    return {
      pattern,
      prefix: star < 0 ? pattern : pattern.slice(0, star),
      suffix: star < 0 ? '' : pattern.slice(star + 1),
      wildcard: star >= 0,
      targets,
      baseUrl: aliasBase,
    };
  })).sort((a, b) => codeUnitCompare(a.pattern, b.pattern) || codeUnitCompare(a.baseUrl, b.baseUrl));
}

function internalModuleBases(fromFile, specifier, aliases) {
  if (specifier.startsWith('.')) return [resolve(dirname(fromFile), specifier)];
  const bases = [];
  for (const alias of aliases) {
    let wildcard = '';
    if (alias.wildcard) {
      if (!specifier.startsWith(alias.prefix) || !specifier.endsWith(alias.suffix)) continue;
      wildcard = specifier.slice(alias.prefix.length, specifier.length - alias.suffix.length);
    } else if (specifier !== alias.pattern) continue;
    for (const target of alias.targets)
      bases.push(resolve(alias.baseUrl, alias.wildcard ? target.replace('*', wildcard) : target));
  }
  return bases;
}

function candidatePaths(base) {
  const extension = extname(base).toLowerCase();
  const roots = extension === '.js' || extension === '.jsx' ? [base, base.slice(0, -extension.length)] : [base];
  const output = [];
  for (const item of roots) {
    output.push(item);
    const itemExtension = extname(item).toLowerCase();
    if (!itemExtension || ['.web', '.native', '.ios', '.android'].includes(itemExtension)) {
      for (const platform of ['.web', '.native', '.ios', '.android', ''])
        for (const sourceExtension of ['.ts', '.tsx', '.js', '.jsx', '.json']) output.push(`${item}${platform}${sourceExtension}`);
      for (const platform of ['.web', '.native', '.ios', '.android', ''])
        for (const sourceExtension of ['.ts', '.tsx', '.js', '.jsx', '.json']) output.push(join(item, `index${platform}${sourceExtension}`));
    }
  }
  return [...new Set(output)];
}

function moduleCandidate(fromFile, specifier, aliases, strict = true) {
  const bases = internalModuleBases(fromFile, specifier, aliases);
  if (!bases.length) return null;
  for (const candidate of bases.flatMap(candidatePaths)) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
    const realCandidate = realpathSync.native(candidate);
    if (!within(realCandidate, root)) throw new Error(`내부 module symlink가 repository 밖을 가리킨다: ${rel(fromFile)} -> ${specifier}`);
    return realCandidate;
  }
  if (strict) throw new Error(`해석할 수 없는 내부 module specifier: ${rel(fromFile)} -> ${specifier}`);
  return null;
}

function directSource(routeFile, aliases) {
  const text = readFileSync(routeFile, 'utf8');
  const source = ts.createSourceFile(routeFile, text, ts.ScriptTarget.ESNext, true, routeFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const path = moduleCandidate(routeFile, statement.moduleSpecifier.text, aliases);
      if (!path || !statement.importClause) continue;
      if (statement.importClause.name) imports.set(statement.importClause.name.text, { path, symbol: 'default' });
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements)
        imports.set(element.name.text, { path, symbol: element.propertyName?.text ?? element.name.text });
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
      && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const path = moduleCandidate(routeFile, statement.moduleSpecifier.text, aliases);
      for (const element of statement.exportClause.elements) if (element.name.text === 'default' && path)
        return `${rel(path)}#${element.propertyName?.text ?? 'default'}`;
    }
  }
  for (const statement of source.statements) {
    if (!ts.isExportAssignment(statement)) continue;
    if (ts.isIdentifier(statement.expression) && imports.has(statement.expression.text)) {
      const item = imports.get(statement.expression.text);
      return `${rel(item.path)}#${item.symbol}`;
    }
    return `${rel(routeFile)}#default`;
  }
  return `${rel(routeFile)}#default`;
}

function sourceModuleSpecifiers(path) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.ESNext, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const parseErrors = source.parseDiagnostics ?? [];
  if (parseErrors.length) throw new Error(`TypeScript parse 오류: ${rel(path)}: ${ts.flattenDiagnosticMessageText(parseErrors[0].messageText, '\n')}`);
  const values = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      values.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const first = node.arguments[0];
      if (!first || (!ts.isStringLiteral(first) && !ts.isNoSubstitutionTemplateLiteral(first)))
        throw new Error(`정적으로 해석할 수 없는 import/require: ${rel(path)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      values.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

function moduleGraph(aliases) {
  const appFiles = [...walk('apps/mobile/app'), ...walk('apps/mobile/src')].filter((path) => /\.tsx?$/.test(path));
  const files = [];
  const graph = new Map();
  const queue = [...appFiles];
  while (queue.length) {
    const path = queue.shift();
    const key = pathKey(path);
    if (graph.has(key)) continue;
    const edges = sourceModuleSpecifiers(path).map((specifier) => moduleCandidate(path, specifier, aliases)).filter(Boolean);
    graph.set(key, { path, edges });
    files.push(path);
    for (const edge of edges) if (/\.tsx?$/.test(edge) && !graph.has(pathKey(edge))) queue.push(edge);
  }
  return { files, graph };
}

function assertNoProductDevImports(modules) {
  const { files, graph } = modules;
  const devRoot = resolve(root, 'apps/mobile/src/dev');
  const mobileRoot = resolve(root, 'apps/mobile');
  const product = files.filter((path) => within(path, mobileRoot) && !within(path, devRoot));
  for (const origin of product) {
    const queue = [...(graph.get(pathKey(origin))?.edges ?? [])];
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      const key = pathKey(current);
      if (seen.has(key)) continue;
      seen.add(key);
      if (within(current, devRoot)) throw new Error(`제품 코드의 src/dev import 금지: ${rel(origin)} -> ${rel(current)}`);
      queue.push(...(graph.get(key)?.edges ?? []));
    }
  }
}

function assertReachableSource(routeFile, reference, screenId, modules) {
  const sourceFile = resolve(root, reference.split('#')[0]);
  const target = pathKey(sourceFile);
  const queue = [routeFile];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    const key = pathKey(current);
    if (seen.has(key)) continue;
    seen.add(key);
    if (key === target) return;
    queue.push(...(modules.graph.get(key)?.edges ?? []));
  }
  throw new Error(`${screenId} sourceComponent가 route import graph에서 도달 불가: ${reference}`);
}

function hasRuntimeExport(path, symbol, aliases, seen = new Set()) {
  const visitKey = `${pathKey(path)}#${symbol}`;
  if (seen.has(visitKey)) return false;
  seen.add(visitKey);
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const runtimeValues = new Set();
  for (const statement of source.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) runtimeValues.add(statement.name.text);
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name)) runtimeValues.add(declaration.name.text);
  }
  let found = symbol === 'default' && source.statements.some((statement) =>
    ts.isExportAssignment(statement) || ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Default) !== 0));
  if (!found) for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const target = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
      ? moduleCandidate(path, statement.moduleSpecifier.text, aliases) : null;
    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== symbol) continue;
        const local = element.propertyName?.text ?? element.name.text;
        if (target ? hasRuntimeExport(target, local, aliases, seen) : runtimeValues.has(local)) found = true;
      }
    } else if (target && hasRuntimeExport(target, symbol, aliases, seen)) found = true;
  }
  if (!found) for (const statement of source.statements) {
    const exported = (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) !== 0;
    if (exported && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && statement.name?.text === symbol) found = true;
    if (exported && ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === symbol)) found = true;
  }
  return found;
}

function assertSourceComponent(reference, screenId, aliases) {
  const [file, symbol] = reference.split('#');
  const path = resolve(root, file);
  if (!file || !symbol || !existsSync(path) || !within(path, resolve(root, 'apps/mobile')))
    throw new Error(`${screenId} sourceComponent 참조 오류: ${reference}`);
  const found = hasRuntimeExport(path, symbol, aliases);
  if (!found) throw new Error(`${screenId} sourceComponent export가 없다: ${reference}`);
}

function deriveRoute(row, routes, declaration, aliases) {
  const codeTokens = [...row.locator.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const directRoutes = [...new Set(codeTokens.filter((token) => routes.some(({ route }) => route === token)))];
  if (directRoutes.length > 1) throw new Error(`${row.screenId} README locator가 복수 Expo route를 가리킨다: ${directRoutes.join(', ')}`);
  const direct = directRoutes[0];
  if (direct && declaration.routeBinding) {
    if (declaration.routeBinding.expoRoute !== direct)
      throw new Error(`${row.screenId} README locator와 routeBinding route가 다르다: ${direct} != ${declaration.routeBinding.expoRoute}`);
    const route = routes.find((item) => item.route === direct);
    return { expoRoute: direct, sourceComponent: declaration.routeBinding.sourceComponent, routeFile: resolve(root, route.file) };
  }
  if (direct) {
    const route = routes.find((item) => item.route === direct);
    return { expoRoute: direct, sourceComponent: directSource(resolve(root, route.file), aliases), routeFile: resolve(root, route.file) };
  }
  if (!declaration.routeBinding) throw new Error(`${row.screenId}는 inline/sheet 항목이므로 AST 검증용 routeBinding이 필요하다.`);
  const route = routes.find((item) => item.route === declaration.routeBinding.expoRoute);
  if (!route) throw new Error(`${row.screenId} routeBinding route가 없다: ${declaration.routeBinding.expoRoute}`);
  const sourcePath = declaration.routeBinding.sourceComponent.split('#')[0];
  if (!existsSync(resolve(root, sourcePath))) throw new Error(`${row.screenId} sourceComponent 파일이 없다: ${sourcePath}`);
  return { expoRoute: route.route, sourceComponent: declaration.routeBinding.sourceComponent, routeFile: resolve(root, route.file) };
}

function loadStubRegistry() {
  if (!existsSync(stubRegistryPath)) throw new Error(`stub registry가 없다: ${rel(stubRegistryPath)}`);
  const text = readFileSync(stubRegistryPath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff || text.includes('\r')) throw new Error('stub registry는 UTF-8 BOM 없음·LF 계약이어야 한다.');
  const document = JSON.parse(text);
  if (document.schemaVersion !== 1 || !document.stubs || typeof document.stubs !== 'object' || Array.isArray(document.stubs))
    throw new Error('stub registry schema 오류');
  for (const [name, value] of Object.entries(document.stubs)) {
    if (!/^[a-z][A-Za-z0-9]+$/.test(name) || !value || typeof value !== 'object'
      || !Array.isArray(value.screenIds) || !value.screenIds.length || Object.keys(value).some((key) => key !== 'screenIds'))
      throw new Error(`stub registry 항목 오류: ${name}`);
    const sorted = [...value.screenIds].sort(codeUnitCompare);
    if (new Set(sorted).size !== sorted.length || JSON.stringify(value.screenIds) !== JSON.stringify(sorted))
      throw new Error(`stub registry screenIds 중복/순서 오류: ${name}`);
  }
  return { document, sourceSha256: sha256(text) };
}

function validateTemporary(entry, row) {
  const temporary = entry.temporaryDivergence;
  if (temporary !== undefined) {
    const allowedByParity = {
      aligned: ['routeId', 'prototype', 'catalog', 'visual', 'state'],
      divergent: ['routeId', 'prototype', 'catalog', 'visual', 'state'],
      specOnly: ['prototype', 'visual', 'state'],
      expoOnly: ['routeId', 'catalog', 'visual', 'state'],
    };
    if (!temporary || typeof temporary !== 'object' || !Array.isArray(temporary.axes) || !temporary.axes.length
      || !temporary.axes.every((axis) => allowedByParity[entry.parity]?.includes(axis))
      || !['owner', 'approvedBy', 'expiresAt'].every((key) => typeof temporary[key] === 'string' && temporary[key].trim())
      || !Array.isArray(temporary.targets) || !temporary.targets.length)
      throw new Error(`${row.screenId} temporaryDivergence 계약 오류`);
  }
  const migration = entry.migrationPending;
  if (migration !== undefined) {
    if (entry.parity !== 'divergent' || !migration || typeof migration !== 'object'
      || !['owner', 'expiresAt'].every((key) => typeof migration[key] === 'string' && migration[key].trim())
      || !Array.isArray(migration.targets) || !migration.targets.length)
      throw new Error(`${row.screenId} migrationPending 계약 오류`);
  }
}

function validateP2Thresholds(baseline, declarations) {
  const thresholds = baseline.thresholds;
  if (!thresholds || thresholds.status !== 'active' || thresholds.activationStage !== 'P2')
    throw new Error('P2부터 baseline thresholds는 active/P2여야 한다.');
  for (const key of ['migrationBacklogMax', 'emergencyDivergenceMax']) {
    if (!Number.isInteger(thresholds[key]) || thresholds[key] < 0) throw new Error(`baseline threshold ${key}는 0 이상 정수여야 한다.`);
  }
  if (typeof thresholds.migrationDeadlineUtc !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(thresholds.migrationDeadlineUtc)
    || Number.isNaN(Date.parse(thresholds.migrationDeadlineUtc)))
    throw new Error('baseline migrationDeadlineUtc는 초 단위 UTC ISO 시각이어야 한다.');

  const migrations = declarations.surfaces.filter((entry) => entry.migrationPending);
  const emergencies = declarations.surfaces.filter((entry) => entry.temporaryDivergence);
  if (migrations.length > thresholds.migrationBacklogMax)
    throw new Error(`migration backlog ${migrations.length}건이 상한 ${thresholds.migrationBacklogMax}를 넘었다.`);
  if (emergencies.length > thresholds.emergencyDivergenceMax)
    throw new Error(`emergency divergence ${emergencies.length}건이 상한 ${thresholds.emergencyDivergenceMax}를 넘었다.`);
  const deadline = Date.parse(thresholds.migrationDeadlineUtc);
  for (const entry of [...migrations, ...emergencies]) {
    const expiry = entry.migrationPending?.expiresAt ?? entry.temporaryDivergence?.expiresAt;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expiry ?? '') || Number.isNaN(Date.parse(expiry)))
      throw new Error(`${entry.screenId} 예외 expiresAt은 초 단위 UTC ISO 시각이어야 한다.`);
    if (Date.parse(expiry) > deadline) throw new Error(`${entry.screenId} expiresAt이 migrationDeadlineUtc보다 늦다.`);
  }
}

function validateCommittedMigrationTransition() {
  const parent = git(['rev-parse', '--verify', 'HEAD^']);
  if (parent.status !== 0) return;
  const showJson = (ref, path) => {
    const result = git(['show', `${ref}:${rel(path)}`]);
    if (result.status !== 0) throw new Error(`migration 전이 입력을 읽지 못했다: ${ref}:${rel(path)}`);
    return JSON.parse(result.stdout);
  };
  const previousBaseline = showJson('HEAD^', baselinePath);
  const currentBaseline = showJson('HEAD', baselinePath);
  const previousDeclarations = showJson('HEAD^', declarationsPath);
  const currentDeclarations = showJson('HEAD', declarationsPath);
  for (const message of validateMigrationTransition(previousBaseline, currentBaseline, previousDeclarations, currentDeclarations))
    throw new Error(message);
}

function validateHuman(entry, row, stubs) {
  const parity = entry.parity;
  const catalogMode = entry.catalogMode;
  if (!['aligned', 'divergent', 'specOnly', 'expoOnly'].includes(parity)) throw new Error(`${row.screenId} parity 오류`);
  validateTemporary(entry, row);
  if (parity === 'specOnly') {
    if (catalogMode !== undefined || entry.states !== undefined || entry.fixtureKind || entry.fixtureRef)
      throw new Error(`${row.screenId} specOnly catalog/states/fixture 금지`);
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) throw new Error(`${row.screenId} reason 필수`);
    return;
  }
  if (!['route', 'fixture', 'unsupported'].includes(catalogMode)) throw new Error(`${row.screenId} catalogMode 오류`);
  if ((parity === 'divergent' || parity === 'expoOnly' || catalogMode === 'unsupported')
    && (typeof entry.reason !== 'string' || !entry.reason.trim())) throw new Error(`${row.screenId} reason 필수`);
  if (parity === 'aligned' && catalogMode !== 'unsupported' && Object.hasOwn(entry, 'reason')) throw new Error(`${row.screenId} aligned reason 금지`);
  if (catalogMode === 'fixture') {
    if (!['stub', 'devSeedEntity'].includes(entry.fixtureKind) || !entry.fixtureRef) throw new Error(`${row.screenId} fixture 계약 누락`);
    if (entry.fixtureKind === 'stub') {
      if (!entry.fixtureRef.stubName || Object.keys(entry.fixtureRef).length !== 1) throw new Error(`${row.screenId} stub fixtureRef 오류`);
      const registered = stubs[entry.fixtureRef.stubName];
      if (!registered || !registered.screenIds.includes(row.screenId))
        throw new Error(`${row.screenId} stubName이 registry에 결속되지 않았다: ${entry.fixtureRef.stubName}`);
    }
    if (entry.fixtureKind === 'devSeedEntity') {
      const ref = entry.fixtureRef;
      if (!ref.seedVersion || !ref.entityKind || !ref.selector || typeof ref.selector !== 'object') throw new Error(`${row.screenId} devSeedEntity fixtureRef 오류`);
      if (JSON.stringify(ref).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)) throw new Error(`${row.screenId} bare UUID 금지`);
    }
  } else if (entry.fixtureKind || entry.fixtureRef) throw new Error(`${row.screenId} fixture 필드 금지`);
  if (catalogMode === 'unsupported') {
    if (entry.states !== undefined) throw new Error(`${row.screenId} unsupported states 금지`);
  } else if (!Array.isArray(entry.states) || !entry.states.length) throw new Error(`${row.screenId} states 필수`);
}

function build() {
  const readme = parseReadme(readFileSync(readmePath, 'utf8'));
  const prototype = parsePrototype(readFileSync(prototypePath, 'utf8'));
  const routes = routeInventory();
  const baselineText = readFileSync(baselinePath, 'utf8');
  const baseline = JSON.parse(baselineText);
  if (sha256(canonical(baseline.floors)) !== expectedBaselineFloorsSha256)
    throw new Error('P1 baseline floors hash가 고정 계약과 다르다.');
  const declarationsText = readFileSync(declarationsPath, 'utf8');
  if (declarationsText.charCodeAt(0) === 0xfeff || declarationsText.includes('\r'))
    throw new Error('declarations는 UTF-8 BOM 없음·LF 계약이어야 한다.');
  const declarations = JSON.parse(declarationsText);
  validateP2Thresholds(baseline, declarations);
  const aliases = pathAliases();
  const modules = moduleGraph(aliases);
  assertNoProductDevImports(modules);
  const stubRegistry = loadStubRegistry();
  if (declarations.schemaVersion !== 1 || !Array.isArray(declarations.surfaces)) throw new Error('declarations schema 오류');
  const generatedKeys = ['domain', 'name', 'expoRoute', 'sourceComponent', 'prototypeTargets'];
  for (const [owner, value] of [['defaults', declarations.defaults ?? {}], ...declarations.surfaces.map((entry) => [entry.screenId, entry])]) {
    const forbidden = generatedKeys.filter((key) => Object.hasOwn(value, key));
    if (forbidden.length) throw new Error(`${owner} 사람 선언에 생성 컬럼 금지: ${forbidden.join(', ')}`);
  }
  const topLevelKeys = new Set(['schemaVersion', 'defaults', 'routeExclusions', 'surfaces']);
  const unknownTopLevel = Object.keys(declarations).filter((key) => !topLevelKeys.has(key));
  if (unknownTopLevel.length) throw new Error(`declarations 알 수 없는 top-level 필드: ${unknownTopLevel.join(', ')}`);
  const allowedDefaults = new Set(['catalogMode', 'states', 'parity']);
  const unknownDefaults = Object.keys(declarations.defaults ?? {}).filter((key) => !allowedDefaults.has(key));
  if (unknownDefaults.length) throw new Error(`defaults 알 수 없는 필드: ${unknownDefaults.join(', ')}`);
  const allowedSurfaceKeys = new Set([
    'screenId', 'routeBinding', 'prototypeScreenKeys', 'prototypeTargetsBinding', 'includeHostPopups',
    'prototypeSharingReason', 'catalogMode', 'fixtureKind', 'fixtureRef', 'states', 'parity', 'reason',
    'temporaryDivergence', 'migrationPending',
  ]);
  for (const entry of declarations.surfaces) {
    const unknown = Object.keys(entry).filter((key) => !allowedSurfaceKeys.has(key));
    if (unknown.length) throw new Error(`${entry.screenId ?? '(screenId 없음)'} 알 수 없는 사람 선언 필드: ${unknown.join(', ')}`);
    if (entry.routeBinding && (typeof entry.routeBinding !== 'object'
      || Object.keys(entry.routeBinding).some((key) => !['expoRoute', 'sourceComponent'].includes(key))
      || typeof entry.routeBinding.expoRoute !== 'string' || typeof entry.routeBinding.sourceComponent !== 'string'))
      throw new Error(`${entry.screenId} routeBinding 계약 오류`);
    for (const key of ['prototypeScreenKeys', 'prototypeTargetsBinding'])
      if (entry[key] !== undefined && (!Array.isArray(entry[key]) || !entry[key].length || !entry[key].every((value) => typeof value === 'string')))
        throw new Error(`${entry.screenId} ${key} 계약 오류`);
    if (entry.includeHostPopups !== undefined && typeof entry.includeHostPopups !== 'boolean')
      throw new Error(`${entry.screenId} includeHostPopups 계약 오류`);
  }
  const byId = new Map(declarations.surfaces.map((entry) => {
    const inherited = { ...(declarations.defaults ?? {}) };
    if (entry.parity === 'specOnly') { delete inherited.catalogMode; delete inherited.states; }
    if (entry.catalogMode === 'unsupported') delete inherited.states;
    return [entry.screenId, { ...inherited, ...entry }];
  }));
  if (byId.size !== declarations.surfaces.length) throw new Error('declarations 중복 screenId');
  const readmeIds = readme.entries.map(({ screenId }) => screenId).sort(codeUnitCompare);
  const declarationIds = [...byId.keys()].sort(codeUnitCompare);
  if (JSON.stringify(readmeIds) !== JSON.stringify(declarationIds)) throw new Error('README ID와 declarations key가 양방향 일치하지 않는다.');
  if (readme.entries.length < baseline.floors.screenIds || routes.length < baseline.floors.routeFiles
    || prototype.screenTargets.length + prototype.popupTargets.length < baseline.floors.prototypeTargetsMeasured)
    throw new Error('P0 inventory floor보다 입력이 줄었다.');
  const allPrototype = new Set([...prototype.screenTargets, ...prototype.popupTargets].map(({ target }) => target));
  const claimed = new Map();
  const surfaces = readme.entries.map((row) => {
    const human = byId.get(row.screenId);
    validateHuman(human, row, stubRegistry.document.stubs);
    const targets = [...(human.prototypeTargetsBinding ?? [])];
    for (const key of human.prototypeScreenKeys ?? []) {
      targets.push(`screen:${key}`);
      if (human.includeHostPopups !== false)
        targets.push(...prototype.popupTargets.filter(({ host }) => host === key).map(({ target }) => target));
    }
    const sortedTargets = [...new Set(targets)].sort(codeUnitCompare);
    if (sortedTargets.length > 1 && (typeof human.prototypeSharingReason !== 'string' || !human.prototypeSharingReason.trim()))
      throw new Error(`1:N prototype 매핑은 prototypeSharingReason이 필요하다: ${row.screenId}`);
    for (const target of sortedTargets) {
      if (!allPrototype.has(target)) throw new Error(`${row.screenId} 존재하지 않는 prototype target: ${target}`);
      const owners = claimed.get(target) ?? [];
      owners.push(row.screenId);
      claimed.set(target, owners);
    }
    if (human.parity === 'specOnly') {
      if (human.routeBinding || !sortedTargets.length) throw new Error(`${row.screenId} specOnly은 route 금지·prototype target 필수다.`);
      return {
        screenId: row.screenId,
        domain: row.domain,
        name: row.name,
        prototypeTargets: sortedTargets,
        parity: human.parity,
        reason: human.reason,
        ...(human.temporaryDivergence ? { temporaryDivergence: human.temporaryDivergence } : {}),
      };
    }
    const route = deriveRoute(row, routes, human, aliases);
    assertSourceComponent(route.sourceComponent, row.screenId, aliases);
    assertReachableSource(route.routeFile, route.sourceComponent, row.screenId, modules);
    if (human.parity === 'expoOnly' && sortedTargets.length) throw new Error(`${row.screenId} expoOnly prototypeTargets 금지`);
    if (human.parity !== 'expoOnly' && !sortedTargets.length) throw new Error(`${row.screenId} prototypeTargets 필수`);
    return {
      screenId: row.screenId,
      domain: row.domain,
      name: row.name,
      expoRoute: route.expoRoute,
      sourceComponent: route.sourceComponent,
      ...(sortedTargets.length ? { prototypeTargets: sortedTargets } : {}),
      catalogMode: human.catalogMode,
      ...(human.fixtureKind ? { fixtureKind: human.fixtureKind, fixtureRef: human.fixtureRef } : {}),
      ...(human.states ? { states: [...human.states].sort(codeUnitCompare) } : {}),
      parity: human.parity,
      ...(human.reason ? { reason: human.reason } : {}),
      ...(human.temporaryDivergence ? { temporaryDivergence: human.temporaryDivergence } : {}),
      ...(human.migrationPending ? { migrationPending: human.migrationPending } : {}),
    };
  }).sort((a, b) => codeUnitCompare(a.screenId, b.screenId));
  const usedStubs = new Set(surfaces.filter(({ fixtureKind }) => fixtureKind === 'stub').map(({ fixtureRef }) => fixtureRef.stubName));
  const orphanStubs = Object.keys(stubRegistry.document.stubs).filter((name) => !usedStubs.has(name)).sort(codeUnitCompare);
  if (orphanStubs.length) throw new Error(`사용되지 않는 stub registry 항목: ${orphanStubs.join(', ')}`);
  const orphanPrototypeTargets = [...allPrototype].filter((target) => !claimed.has(target)).sort(codeUnitCompare);
  const sharedPrototypeTargets = [...claimed].filter(([, owners]) => owners.length > 1)
    .map(([target, owners]) => ({ target, screenIds: owners.sort(codeUnitCompare) })).sort((a, b) => codeUnitCompare(a.target, b.target));
  for (const shared of sharedPrototypeTargets) {
    const reasons = shared.screenIds.map((id) => byId.get(id).prototypeSharingReason).filter(Boolean);
    if (reasons.length !== shared.screenIds.length) throw new Error(`1:N/N:1 target은 각 선언에 prototypeSharingReason이 필요하다: ${shared.target}`);
  }
  if (orphanPrototypeTargets.length) throw new Error(`미등록 prototype target ${orphanPrototypeTargets.length}건: ${orphanPrototypeTargets.slice(0, 8).join(', ')}`);
  const exclusions = declarations.routeExclusions ?? [];
  if (!Array.isArray(exclusions)) throw new Error('routeExclusions 배열 계약 오류');
  if (new Set(exclusions.map(({ route }) => route)).size !== exclusions.length) throw new Error('routeExclusions route 중복');
  for (const exclusion of exclusions) {
    if (!exclusion || typeof exclusion !== 'object'
      || Object.keys(exclusion).some((key) => !['route', 'kind', 'reason'].includes(key))
      || typeof exclusion.route !== 'string' || exclusion.kind !== 'redirect'
      || typeof exclusion.reason !== 'string' || !exclusion.reason.trim())
      throw new Error(`routeExclusion 계약 오류: ${exclusion.route}`);
    const route = routes.find((item) => item.route === exclusion.route);
    if (!route || !/<Redirect\b/.test(readFileSync(resolve(root, route.file), 'utf8')))
      throw new Error(`redirect로 입증되지 않은 routeExclusion: ${exclusion.route}`);
  }
  const referencedRoutes = new Set(surfaces.map(({ expoRoute }) => expoRoute).filter(Boolean));
  const excludedRoutes = new Set(exclusions.map(({ route }) => route));
  const orphanRoutes = routes.map(({ route }) => route).filter((route) => !referencedRoutes.has(route) && !excludedRoutes.has(route));
  if (orphanRoutes.length) throw new Error(`README ID 없는 Expo route ${orphanRoutes.length}건: ${orphanRoutes.join(', ')}`);
  return {
    schemaVersion: 1,
    stage: 'P1',
    sources: {
      readme: { path: rel(readmePath), textSha256: readme.sourceSha256 },
      routes: { root: 'apps/mobile/app', count: routes.length, files: routes },
      prototype: { path: rel(prototypePath), textSha256: prototype.sourceSha256,
        screenCount: prototype.screenTargets.length, popupTargetCount: prototype.popupTargets.length,
        hiddenScreenCount: prototype.hiddenScreenCount, hiddenPopupTargetCount: prototype.hiddenPopupTargetCount },
      declarations: { path: rel(declarationsPath), textSha256: sha256(readFileSync(declarationsPath, 'utf8')) },
      stubRegistry: { path: rel(stubRegistryPath), textSha256: stubRegistry.sourceSha256,
        count: Object.keys(stubRegistry.document.stubs).length },
    },
    inventory: { screenIds: surfaces.length, routes: routes.length, prototypeTargets: allPrototype.size },
    routeExclusions: exclusions,
    sharedPrototypeTargets,
    catalogProjection: surfaces.filter(({ parity, catalogMode }) => parity !== 'specOnly' && catalogMode !== 'unsupported')
      .map(({ screenId, domain, name, expoRoute, sourceComponent, catalogMode, fixtureKind, fixtureRef, states }) =>
        ({ screenId, domain, name, expoRoute, sourceComponent, catalogMode, ...(fixtureKind ? { fixtureKind, fixtureRef } : {}), states })),
    surfaces,
  };
}

validateCommittedMigrationTransition();
let generated;
try { generated = build(); } catch (error) { console.error(`  - ${error.message}`); process.exit(1); }
const output = canonical(generated);
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const migrationBacklogOutput = canonical(buildMigrationBacklog(generated, baseline));
const statusBlock = `${markerStart}\n\n| screenId | parity | catalog | Expo route | prototype target 수 |\n|---|---|---|---|---:|\n${generated.surfaces.map((surface) =>
  `| \`${surface.screenId}\` | \`${surface.parity}\` | \`${surface.catalogMode ?? '—'}\` | ${surface.expoRoute ? `\`${surface.expoRoute}\`` : '—'} | ${surface.prototypeTargets?.length ?? 0} |`).join('\n')}\n\n${markerEnd}`;
function withStatusBlock(readme) {
  const normalized = normalize(readme);
  const start = normalized.indexOf(markerStart);
  const end = normalized.indexOf(markerEnd);
  if ((start < 0) !== (end < 0)) throw new Error('README 상태 표식 쌍이 깨졌다.');
  if (start >= 0) return `${normalized.slice(0, start)}${statusBlock}${normalized.slice(end + markerEnd.length)}`;
  const anchor = '\n### 국제 출시 앱 개정';
  const at = normalized.indexOf(anchor);
  if (at < 0) throw new Error('README 상태 블록 삽입 anchor가 없다.');
  return `${normalized.slice(0, at)}\n${statusBlock}\n${normalized.slice(at)}`;
}
if (flag('--write')) {
  writeFileSync(generatedPath, output, 'utf8');
  writeFileSync(readmePath, withStatusBlock(readFileSync(readmePath, 'utf8')), 'utf8');
  writeFileSync(migrationBacklogPath, migrationBacklogOutput, 'utf8');
  console.log(`3표면 P1 레지스트리 생성 — 화면 ${generated.inventory.screenIds} · route ${generated.inventory.routes} · prototype ${generated.inventory.prototypeTargets}`);
  process.exit(0);
}
if (!existsSync(generatedPath)) fail('surfaceRegistry.generated.json이 없다. --write로 생성하라.');
else if (readFileSync(generatedPath, 'utf8') !== output) fail('surfaceRegistry.generated.json committed bytes가 재생성 결과와 다르다.');
if (normalize(readFileSync(readmePath, 'utf8')) !== withStatusBlock(readFileSync(readmePath, 'utf8')))
  fail('README 생성 상태 블록이 registry projection과 다르다.');
if (!existsSync(migrationBacklogPath)) fail('three-surface-migration-backlog.json이 없다. --write로 생성하라.');
else if (readFileSync(migrationBacklogPath, 'utf8') !== migrationBacklogOutput)
  fail('three-surface-migration-backlog.json committed bytes가 registry projection과 다르다.');
if (failures.length) { console.error(failures.map((message) => `  - ${message}`).join('\n')); process.exit(1); }
console.log(`3표면 P1 동기화 PASS — 화면 ${generated.inventory.screenIds} · route ${generated.inventory.routes} · prototype ${generated.inventory.prototypeTargets} · orphan 0`);
