import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const prototypePath = 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html';
export const registryPath = 'apps/mobile/src/dev/surfaceRegistry.generated.json';

// Read literal navigation metadata only. Never evaluate prototype JavaScript.
export function readNavigation(html) {
  const source = ts.createSourceFile('prototype.js', [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const wanted = new Set(['domains', 'screens', 'popupTabs', 'parentScreens', 'ingredientEditScreens']);
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && wanted.has(node.name.text)) {
      if (declarations.has(node.name.text)) throw Error(`Duplicate navigation declaration: ${node.name.text}`);
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  function literal(node) {
    if (!node) throw Error('Missing navigation literal');
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
      if (!ts.isPropertyAssignment(p) || !p.name || !('text' in p.name)) throw Error('Non-literal navigation property');
      return [p.name.text, literal(p.initializer)];
    }));
    throw Error(`Unsupported navigation expression: ${ts.SyntaxKind[node.kind]}`);
  }
  const screensNode = declarations.get('screens');
  if (!screensNode || !ts.isObjectLiteralExpression(screensNode)) throw Error('Missing screens');
  // Product example data inside screens is deliberately not copied into AppMap.
  const screens = Object.fromEntries(screensNode.properties.map(p => {
    if (!ts.isPropertyAssignment(p) || !ts.isObjectLiteralExpression(p.initializer)) throw Error('Non-literal screen');
    return [p.name.text, Object.fromEntries(p.initializer.properties.filter(q => ['domain', 'label', 'title', 'route'].includes(q.name?.text)).map(q => [q.name.text, literal(q.initializer)]))];
  }));
  return { domains: literal(declarations.get('domains')), screens, popupTabs: literal(declarations.get('popupTabs')),
    parentScreens: literal(declarations.get('parentScreens')), ingredientEditScreens: literal(declarations.get('ingredientEditScreens')) };
}

export function buildModel(root) {
  const html = readFileSync(resolve(root, prototypePath), 'utf8');
  const nav = readNavigation(html);
  const registry = JSON.parse(readFileSync(resolve(root, registryPath), 'utf8'));
  const audit = JSON.parse(readFileSync(resolve(root, 'docs/prototypes/full-page-flow-prototype-render-audit.json'), 'utf8'));
  const exposed = new Set(Object.values(nav.domains).flatMap(d => d.screens));
  const targets = [];
  for (const [screen, info] of Object.entries(nav.screens)) {
    const hidden = !exposed.has(screen);
    targets.push({ id: `screen:${screen}`, screen, popup: null, label: info.label, hidden });
    for (const [popup, label] of nav.popupTabs[screen] ?? []) targets.push({ id: `popup:${popup}@${screen}`, screen, popup, label, hidden });
  }
  const ids = new Set(targets.map(t => t.id));
  if (ids.size !== targets.length) throw Error('Duplicate prototype target');
  const auditIds = new Set(audit.targets.map(t => t.target));
  const missing = [...auditIds].filter(id => !ids.has(id));
  const added = [...ids].filter(id => !auditIds.has(id));
  if (missing.length || added.length) throw Error(`Prototype/audit inventory mismatch: ${JSON.stringify({ missing, added })}`);
  for (const t of targets) {
    const exact = registry.surfaces.filter(s => s.prototypeTargets?.includes(t.id));
    const host = registry.surfaces.filter(s => s.prototypeTargets?.includes(`screen:${t.screen}`));
    const candidates = (exact.length ? exact : host).filter(s => s.expoRoute && s.catalogMode !== 'unsupported');
    const chosen = candidates.find(s => s.catalogMode === 'route') ?? candidates[0];
    Object.assign(t, { expoRoute: chosen?.expoRoute ?? null, screenId: chosen?.screenId ?? null,
      mapping: exact.length ? 'registry-exact' : host.length ? 'host-only' : 'unmapped',
      candidates: candidates.map(s => s.screenId) });
  }
  return { ...nav, targets, source: prototypePath, sourceSha256: createHash('sha256').update(html.replace(/\r\n/g, '\n')).digest('hex'),
    counts: { total: targets.length, active: targets.filter(t => !t.hidden).length, hidden: targets.filter(t => t.hidden).length,
      screens: Object.keys(nav.screens).length, popups: targets.filter(t => t.popup).length },
    expoOnly: registry.surfaces.filter(s => s.parity === 'expoOnly').map(s => ({ screenId: s.screenId, name: s.name, expoRoute: s.expoRoute })) };
}

export function primaryScreens(model, domain) {
  return model.domains[domain].screens.filter(k => domain !== 'ingredient' || !model.ingredientEditScreens.includes(k));
}
