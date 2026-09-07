#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const argv = process.argv.slice(2);
const option = (name) => argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const flag = (name) => argv.includes(name);
const root = resolve(option('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const declarationsPath = resolve(root, option('--declarations') ?? 'apps/mobile/src/dev/surfaceRegistry.declarations.json');
const generatedPath = resolve(root, option('--generated') ?? 'apps/mobile/src/dev/surfaceRegistry.generated.json');
const readmePath = resolve(root, option('--readme') ?? 'apps/mobile/src/features/README.md');
const prototypePath = resolve(root, option('--prototype') ?? 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html');
const baselinePath = resolve(root, option('--baseline') ?? 'docs/prototypes/three-surface-baseline.json');
const markerStart = '<!-- THREE-SURFACE-STATUS:START -->';
const markerEnd = '<!-- THREE-SURFACE-STATUS:END -->';
const normalize = (text) => text.replaceAll('\r\n', '\n');
const sha256 = (text) => createHash('sha256').update(normalize(text)).digest('hex');
const rel = (path) => relative(root, path).replaceAll('\\', '/');
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const failures = [];
const fail = (message) => failures.push(message);
const within = (path, base) => path === base || path.startsWith(`${base}${sep}`);

function walk(base) {
  const output = [];
  const visit = (path) => {
    if (!existsSync(path)) return;
    for (const name of readdirSync(path).sort()) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) visit(child);
      else output.push(child);
    }
  };
  visit(resolve(root, base));
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
  return { entries, sourceSha256: sha256(withoutGenerated), hasGeneratedMarker: starts === 1 };
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
      if (!ts.isPropertyAssignment(property)) continue;
      object[propertyName(property.name)] = literal(property.initializer);
    }
    return object;
  }
  throw new Error(`prototype registry에 비-literal 값이 있다: ${node.getText().slice(0, 80)}`);
}

function findVariable(source, name) {
  let found = null;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) throw new Error(`prototype ${name} registry가 없다.`);
  return found;
}

function parsePrototype(html) {
  const combined = scriptContents(html).join('\n');
  const source = ts.createSourceFile('prototype.js', combined, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const parseErrors = source.parseDiagnostics ?? [];
  if (parseErrors.length) throw new Error(`prototype JS parse 오류: ${parseErrors[0].messageText}`);
  const screens = literal(findVariable(source, 'screens'));
  const popupTabs = literal(findVariable(source, 'popupTabs'));
  const screenTargets = Object.entries(screens).map(([key, value]) => ({
    key,
    target: `screen:${key}`,
    trackingId: String(value.route ?? ''),
    domain: String(value.domain ?? ''),
    hidden: value.hidden === true,
  })).sort((a, b) => a.target.localeCompare(b.target, 'en'));
  const popupTargets = [];
  for (const [host, rows] of Object.entries(popupTabs)) {
    if (!screens[host]) throw new Error(`popup host에 대응 screen이 없다: ${host}`);
    for (const row of rows) {
      if (!Array.isArray(row) || typeof row[0] !== 'string') throw new Error(`popupTabs 행 형식 오류: ${host}`);
      popupTargets.push({ id: row[0], host, target: `popup:${row[0]}@${host}`, hidden: screens[host].hidden === true });
    }
  }
  popupTargets.sort((a, b) => a.target.localeCompare(b.target, 'en'));
  const duplicateTargets = [...screenTargets, ...popupTargets].map(({ target }) => target)
    .filter((target, index, values) => values.indexOf(target) !== index);
  if (duplicateTargets.length) throw new Error(`prototype 중복 target: ${[...new Set(duplicateTargets)].join(', ')}`);
  return { screenTargets, popupTargets, sourceSha256: sha256(html) };
}

function routeName(path) {
  return rel(path).replace(/^apps\/mobile\/app\//, '').replace(/(?:^|\/)\([^/]+\)\//g, '').replace(/\.tsx?$/, '');
}

function routeInventory() {
  return walk('apps/mobile/app').filter((path) => /\.tsx?$/.test(path) && !path.endsWith('_layout.tsx') && !path.endsWith('/index.ts'))
    .map((path) => ({ route: routeName(path), file: rel(path) })).sort((a, b) => a.route.localeCompare(b.route, 'en'));
}

function moduleCandidate(fromFile, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? resolve(root, 'apps/mobile/src', specifier.slice(2))
    : resolve(dirname(fromFile), specifier);
  const candidates = extname(base) ? [base] : [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find(existsSync) ?? null;
}

function directSource(routeFile) {
  const text = readFileSync(routeFile, 'utf8');
  const source = ts.createSourceFile(routeFile, text, ts.ScriptTarget.ESNext, true, routeFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const path = moduleCandidate(routeFile, statement.moduleSpecifier.text);
      if (!path || !statement.importClause) continue;
      if (statement.importClause.name) imports.set(statement.importClause.name.text, { path, symbol: 'default' });
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements)
        imports.set(element.name.text, { path, symbol: element.propertyName?.text ?? element.name.text });
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
      && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const path = moduleCandidate(routeFile, statement.moduleSpecifier.text);
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
  const values = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      values.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        values.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

function assertNoProductDevImports() {
  const files = [...walk('apps/mobile/app'), ...walk('apps/mobile/src')].filter((path) => /\.tsx?$/.test(path));
  const graph = new Map(files.map((path) => [path, sourceModuleSpecifiers(path).map((specifier) => moduleCandidate(path, specifier)).filter(Boolean)]));
  const devRoot = resolve(root, 'apps/mobile/src/dev');
  const product = files.filter((path) => !within(path, devRoot));
  for (const origin of product) {
    const queue = [...(graph.get(origin) ?? [])];
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      if (within(current, devRoot)) throw new Error(`제품 코드의 src/dev import 금지: ${rel(origin)} -> ${rel(current)}`);
      queue.push(...(graph.get(current) ?? []));
    }
  }
}

function assertSourceComponent(reference, screenId) {
  const [file, symbol] = reference.split('#');
  const path = resolve(root, file);
  if (!file || !symbol || !existsSync(path)) throw new Error(`${screenId} sourceComponent 참조 오류: ${reference}`);
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let found = symbol === 'default' && source.statements.some((statement) =>
    ts.isExportAssignment(statement) || (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Default) !== 0);
  if (!found) found = source.statements.some((statement) => ts.isExportDeclaration(statement)
    && statement.exportClause && ts.isNamedExports(statement.exportClause)
    && statement.exportClause.elements.some((element) => element.name.text === symbol));
  if (!found) for (const statement of source.statements) {
    const exported = (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) !== 0;
    if (exported && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)
      || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement))
      && statement.name?.text === symbol) found = true;
    if (exported && ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === symbol)) found = true;
  }
  if (!found) throw new Error(`${screenId} sourceComponent export가 없다: ${reference}`);
}

function deriveRoute(row, routes, declaration) {
  const codeTokens = [...row.locator.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const direct = codeTokens.find((token) => routes.some(({ route }) => route === token));
  if (direct) {
    const route = routes.find((item) => item.route === direct);
    return { expoRoute: direct, sourceComponent: directSource(resolve(root, route.file)) };
  }
  if (!declaration.routeBinding) throw new Error(`${row.screenId}는 inline/sheet 항목이므로 AST 검증용 routeBinding이 필요하다.`);
  const route = routes.find((item) => item.route === declaration.routeBinding.expoRoute);
  if (!route) throw new Error(`${row.screenId} routeBinding route가 없다: ${declaration.routeBinding.expoRoute}`);
  const sourcePath = declaration.routeBinding.sourceComponent.split('#')[0];
  if (!existsSync(resolve(root, sourcePath))) throw new Error(`${row.screenId} sourceComponent 파일이 없다: ${sourcePath}`);
  return { expoRoute: route.route, sourceComponent: declaration.routeBinding.sourceComponent };
}

function validateHuman(entry, row) {
  const parity = entry.parity;
  const catalogMode = entry.catalogMode;
  if (!['aligned', 'divergent', 'specOnly', 'expoOnly'].includes(parity)) throw new Error(`${row.screenId} parity 오류`);
  if (!['route', 'fixture', 'unsupported'].includes(catalogMode)) throw new Error(`${row.screenId} catalogMode 오류`);
  if ((parity === 'divergent' || parity === 'specOnly' || parity === 'expoOnly' || catalogMode === 'unsupported')
    && (typeof entry.reason !== 'string' || !entry.reason.trim())) throw new Error(`${row.screenId} reason 필수`);
  if (parity === 'aligned' && catalogMode !== 'unsupported' && Object.hasOwn(entry, 'reason')) throw new Error(`${row.screenId} aligned reason 금지`);
  if (catalogMode === 'fixture') {
    if (!['stub', 'devSeedEntity'].includes(entry.fixtureKind) || !entry.fixtureRef) throw new Error(`${row.screenId} fixture 계약 누락`);
    if (entry.fixtureKind === 'stub' && (!entry.fixtureRef.stubName || Object.keys(entry.fixtureRef).length !== 1)) throw new Error(`${row.screenId} stub fixtureRef 오류`);
    if (entry.fixtureKind === 'devSeedEntity') {
      const ref = entry.fixtureRef;
      if (!ref.seedVersion || !ref.entityKind || !ref.selector || typeof ref.selector !== 'object') throw new Error(`${row.screenId} devSeedEntity fixtureRef 오류`);
      if (JSON.stringify(ref).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)) throw new Error(`${row.screenId} bare UUID 금지`);
    }
  } else if (entry.fixtureKind || entry.fixtureRef) throw new Error(`${row.screenId} fixture 필드 금지`);
  if (catalogMode === 'unsupported') {
    if (entry.states) throw new Error(`${row.screenId} unsupported states 금지`);
  } else if (!Array.isArray(entry.states) || !entry.states.length) throw new Error(`${row.screenId} states 필수`);
}

function build() {
  const readme = parseReadme(readFileSync(readmePath, 'utf8'));
  const prototype = parsePrototype(readFileSync(prototypePath, 'utf8'));
  const routes = routeInventory();
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const declarationsText = readFileSync(declarationsPath, 'utf8');
  if (declarationsText.charCodeAt(0) === 0xfeff || declarationsText.includes('\r'))
    throw new Error('declarations는 UTF-8 BOM 없음·LF 계약이어야 한다.');
  const declarations = JSON.parse(declarationsText);
  assertNoProductDevImports();
  if (declarations.schemaVersion !== 1 || !Array.isArray(declarations.surfaces)) throw new Error('declarations schema 오류');
  const generatedKeys = ['domain', 'name', 'expoRoute', 'sourceComponent', 'prototypeTargets'];
  for (const [owner, value] of [['defaults', declarations.defaults ?? {}], ...declarations.surfaces.map((entry) => [entry.screenId, entry])]) {
    const forbidden = generatedKeys.filter((key) => Object.hasOwn(value, key));
    if (forbidden.length) throw new Error(`${owner} 사람 선언에 생성 컬럼 금지: ${forbidden.join(', ')}`);
  }
  const byId = new Map(declarations.surfaces.map((entry) => [entry.screenId, { ...(declarations.defaults ?? {}), ...entry }]));
  if (byId.size !== declarations.surfaces.length) throw new Error('declarations 중복 screenId');
  const readmeIds = readme.entries.map(({ screenId }) => screenId).sort();
  const declarationIds = [...byId.keys()].sort();
  if (JSON.stringify(readmeIds) !== JSON.stringify(declarationIds)) throw new Error('README ID와 declarations key가 양방향 일치하지 않는다.');
  if (readme.entries.length < baseline.floors.screenIds || routes.length < baseline.floors.routeFiles
    || prototype.screenTargets.length + prototype.popupTargets.length < baseline.floors.prototypeTargetsMeasured)
    throw new Error('P0 inventory floor보다 입력이 줄었다.');
  const allPrototype = new Set([...prototype.screenTargets, ...prototype.popupTargets].map(({ target }) => target));
  const claimed = new Map();
  const surfaces = readme.entries.map((row) => {
    const human = byId.get(row.screenId);
    validateHuman(human, row);
    const targets = [...(human.prototypeTargetsBinding ?? [])];
    for (const key of human.prototypeScreenKeys ?? []) {
      targets.push(`screen:${key}`);
      if (human.includeHostPopups !== false)
        targets.push(...prototype.popupTargets.filter(({ host }) => host === key).map(({ target }) => target));
    }
    const sortedTargets = [...new Set(targets)].sort((a, b) => a.localeCompare(b, 'en'));
    if (sortedTargets.length > 1 && (typeof human.prototypeSharingReason !== 'string' || !human.prototypeSharingReason.trim()))
      throw new Error(`1:N prototype 매핑은 prototypeSharingReason이 필요하다: ${row.screenId}`);
    for (const target of sortedTargets) {
      if (!allPrototype.has(target)) throw new Error(`${row.screenId} 존재하지 않는 prototype target: ${target}`);
      const owners = claimed.get(target) ?? [];
      owners.push(row.screenId);
      claimed.set(target, owners);
    }
    if (human.parity === 'specOnly') {
      if (human.routeBinding || sortedTargets.length) throw new Error(`${row.screenId} specOnly route/target 금지 계약과 충돌`);
      return { screenId: row.screenId, domain: row.domain, name: row.name, parity: human.parity, reason: human.reason };
    }
    const route = deriveRoute(row, routes, human);
    assertSourceComponent(route.sourceComponent, row.screenId);
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
      ...(human.states ? { states: [...human.states].sort() } : {}),
      parity: human.parity,
      ...(human.reason ? { reason: human.reason } : {}),
    };
  }).sort((a, b) => a.screenId.localeCompare(b.screenId, 'en'));
  const orphanPrototypeTargets = [...allPrototype].filter((target) => !claimed.has(target)).sort((a, b) => a.localeCompare(b, 'en'));
  const sharedPrototypeTargets = [...claimed].filter(([, owners]) => owners.length > 1)
    .map(([target, owners]) => ({ target, screenIds: owners.sort() })).sort((a, b) => a.target.localeCompare(b.target, 'en'));
  for (const shared of sharedPrototypeTargets) {
    const reasons = shared.screenIds.map((id) => byId.get(id).prototypeSharingReason).filter(Boolean);
    if (reasons.length !== shared.screenIds.length) throw new Error(`1:N/N:1 target은 각 선언에 prototypeSharingReason이 필요하다: ${shared.target}`);
  }
  if (orphanPrototypeTargets.length) throw new Error(`미등록 prototype target ${orphanPrototypeTargets.length}건: ${orphanPrototypeTargets.slice(0, 8).join(', ')}`);
  const exclusions = declarations.routeExclusions ?? [];
  if (new Set(exclusions.map(({ route }) => route)).size !== exclusions.length) throw new Error('routeExclusions route 중복');
  for (const exclusion of exclusions) {
    if (exclusion.kind !== 'redirect' || typeof exclusion.reason !== 'string' || !exclusion.reason.trim())
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
        screenCount: prototype.screenTargets.length, popupTargetCount: prototype.popupTargets.length },
      declarations: { path: rel(declarationsPath), textSha256: sha256(readFileSync(declarationsPath, 'utf8')) },
    },
    inventory: { screenIds: surfaces.length, routes: routes.length, prototypeTargets: allPrototype.size },
    routeExclusions: exclusions,
    sharedPrototypeTargets,
    catalogProjection: surfaces.filter(({ catalogMode }) => catalogMode !== 'unsupported')
      .map(({ screenId, domain, name, expoRoute, sourceComponent, catalogMode, fixtureKind, fixtureRef, states }) =>
        ({ screenId, domain, name, expoRoute, sourceComponent, catalogMode, ...(fixtureKind ? { fixtureKind, fixtureRef } : {}), states })),
    surfaces,
  };
}

let generated;
try { generated = build(); } catch (error) { console.error(`  - ${error.message}`); process.exit(1); }
const output = canonical(generated);
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
  console.log(`3표면 P1 레지스트리 생성 — 화면 ${generated.inventory.screenIds} · route ${generated.inventory.routes} · prototype ${generated.inventory.prototypeTargets}`);
  process.exit(0);
}
if (!existsSync(generatedPath)) fail('surfaceRegistry.generated.json이 없다. --write로 생성하라.');
else if (readFileSync(generatedPath, 'utf8') !== output) fail('surfaceRegistry.generated.json committed bytes가 재생성 결과와 다르다.');
if (normalize(readFileSync(readmePath, 'utf8')) !== withStatusBlock(readFileSync(readmePath, 'utf8')))
  fail('README 생성 상태 블록이 registry projection과 다르다.');
if (failures.length) { console.error(failures.map((message) => `  - ${message}`).join('\n')); process.exit(1); }
console.log(`3표면 P1 동기화 PASS — 화면 ${generated.inventory.screenIds} · route ${generated.inventory.routes} · prototype ${generated.inventory.prototypeTargets} · orphan 0`);
