import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('..', import.meta.url);
const rootPath = decodeURIComponent(root.pathname).replace(/^\/(?:([A-Za-z]):)/, '$1:');
const glossaryPath = join(rootPath, 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html');
const outputPath = join(rootPath, 'docs/prototypes/terminology-source-audit.json');
const hangul = /[가-힣]/;

const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

const normalize = value => value
  .replace(/\\n/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#x20;/g, ' ')
  .replace(/\$\{[^}]+\}/g, '{값}')
  .replace(/\s+/g, ' ')
  .trim();

const lexical = value => normalize(value)
  .replace(/\{값\}|[0-9]+(?:[.,][0-9]+)*/g, '')
  .replace(/[^가-힣A-Za-z]/g, '')
  .toLowerCase();

const domainOf = path => {
  const normalized = path.replaceAll('\\', '/');
  const match = normalized.match(/features\/([^/]+)/);
  if (match) return match[1];
  if (normalized.includes('/app/')) return 'route';
  if (normalized.includes('scripts/appmap')) return 'appmap';
  if (normalized.includes('docs/prototypes')) return 'prototype';
  return 'shared';
};

const occurrences = [];
const uiContexts = new Set([
  'accessibilityHint', 'accessibilityLabel', 'confirmText', 'description', 'emptyHint', 'emptyTitle',
  'error', 'helper', 'hint', 'label', 'message', 'placeholder', 'sub', 'subtitle', 'text', 'title',
]);

const add = (value, file, line, kind, context = '') => {
  const text = normalize(value);
  if (!hangul.test(text) || text.length > 220) return;
  occurrences.push({
    text,
    file: relative(rootPath, file).replaceAll('\\', '/'),
    line,
    kind,
    context,
    domain: domainOf(file),
    likelyUi: kind === 'jsx' || kind === 'contract' || uiContexts.has(context) || context === 'Alert.alert',
  });
};

const mobileRoots = [join(rootPath, 'apps/mobile/src'), join(rootPath, 'apps/mobile/app')];
const mobileFiles = mobileRoots.flatMap(walk).filter(path => ['.ts', '.tsx'].includes(extname(path)));
for (const file of mobileFiles) {
  const source = readFileSync(file, 'utf8');
  const node = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const contextOf = current => {
    const parent = current.parent;
    if (ts.isJsxAttribute(parent)) return parent.name.getText(node);
    if (ts.isPropertyAssignment(parent)) return parent.name.getText(node).replace(/^['"]|['"]$/g, '');
    if (ts.isCallExpression(parent) && parent.expression.getText(node) === 'Alert.alert') return 'Alert.alert';
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    return '';
  };
  const visit = current => {
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return;
    if (ts.isJsxText(current)) add(current.getText(node), file, node.getLineAndCharacterOfPosition(current.getStart(node)).line + 1, 'jsx', current.parent?.tagName?.getText(node) ?? '');
    if ((ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) && !ts.isLiteralTypeNode(current.parent)) {
      add(current.text, file, node.getLineAndCharacterOfPosition(current.getStart(node)).line + 1, 'literal', contextOf(current));
    }
    if (ts.isTemplateExpression(current)) {
      add(current.getText(node).slice(1, -1), file, node.getLineAndCharacterOfPosition(current.getStart(node)).line + 1, 'template', contextOf(current));
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
}

const addQuotedStrings = (file, source, kind) => {
  const lineAt = offset => source.slice(0, offset).split(/\r?\n/).length;
  const pattern = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const match of source.matchAll(pattern)) add(match[2], file, lineAt(match.index ?? 0), kind);
};

const appMapPath = join(rootPath, 'scripts/appmap/app.js');
addQuotedStrings(appMapPath, readFileSync(appMapPath, 'utf8'), 'appmap');

const prototypeSource = readFileSync(glossaryPath, 'utf8');
const glossaryStart = prototypeSource.indexOf('    const term=');
const glossaryEnd = prototypeSource.indexOf('    const termIsApplied=');
const prototypeWithoutGlossary = `${prototypeSource.slice(0, glossaryStart)}${prototypeSource.slice(glossaryEnd)}`;
addQuotedStrings(glossaryPath, prototypeWithoutGlossary, 'prototype');

const specPath = join(rootPath, 'docs/prototypes/full-page-flow-prototype-current-spec.md');
const spec = readFileSync(specPath, 'utf8');
for (const match of spec.matchAll(/`([^`\n]*[가-힣][^`\n]*)`/g)) add(match[1], specPath, spec.slice(0, match.index ?? 0).split(/\r?\n/).length, 'contract');

const html = readFileSync(glossaryPath, 'utf8');
const context = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('    const term='), html.indexOf('    const termIsApplied=')), context);
const terms = JSON.parse(vm.runInContext('JSON.stringify(terminology)', context));
const termWords = terms.flatMap(term => [term.canonical, ...term.variants]).map(value => ({ value, lexical: lexical(value) })).filter(item => item.lexical.length >= 2);

const grouped = new Map();
for (const item of occurrences) {
  const key = item.text;
  const record = grouped.get(key) ?? { text: key, count: 0, uiCount: 0, domains: new Set(), files: new Set(), contexts: new Set(), examples: [] };
  record.count += 1;
  if (item.likelyUi) record.uiCount += 1;
  record.domains.add(item.domain);
  record.files.add(item.file);
  if (item.context) record.contexts.add(item.context);
  if (record.examples.length < 5) record.examples.push({ file: item.file, line: item.line, kind: item.kind, context: item.context });
  grouped.set(key, record);
}

const phrases = [...grouped.values()].map(record => {
  const key = lexical(record.text);
  const matches = key.length >= 2 ? termWords.filter(term => key.includes(term.lexical) || term.lexical.includes(key)).map(term => term.value) : [];
  return {
    text: record.text,
    count: record.count,
    uiCount: record.uiCount,
    domains: [...record.domains].sort(),
    contexts: [...record.contexts].sort(),
    fileCount: record.files.size,
    examples: record.examples,
    glossaryMatches: [...new Set(matches)].slice(0, 12),
    covered: matches.length > 0,
  };
}).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'ko'));

const byDomain = {};
for (const item of occurrences) byDomain[item.domain] = (byDomain[item.domain] ?? 0) + 1;
const missing = phrases.filter(item => !item.covered && item.text.length >= 2);
const likelyUiPhrases = phrases.filter(item => item.uiCount > 0);
const likelyUiMissing = likelyUiPhrases.filter(item => !item.covered && item.text.length >= 2);

const report = {
  generatedAt: new Date().toISOString(),
  inputs: {
    mobileFiles: mobileFiles.length,
    appMap: relative(rootPath, appMapPath).replaceAll('\\', '/'),
    prototype: relative(rootPath, glossaryPath).replaceAll('\\', '/'),
    contract: relative(rootPath, specPath).replaceAll('\\', '/'),
  },
  summary: {
    glossaryConcepts: terms.length,
    occurrences: occurrences.length,
    uniquePhrases: phrases.length,
    lexicallyCoveredPhrases: phrases.length - missing.length,
    missingCandidatePhrases: missing.length,
    likelyUiOccurrences: occurrences.filter(item => item.likelyUi).length,
    uniqueLikelyUiPhrases: likelyUiPhrases.length,
    missingLikelyUiCandidatePhrases: likelyUiMissing.length,
    byDomain,
  },
  missingCandidates: missing,
  missingLikelyUiCandidates: likelyUiMissing,
  phrases,
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
