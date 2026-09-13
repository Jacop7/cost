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
  // AppMap navigation entry for the ingredient master management route.
  const ingredientManagement = 'recipe_ingredients';
  const ingredientTarget = targets.find(t => t.id === 'screen:ingredient_main');
  nav.screens[ingredientManagement] = { ...nav.screens.ingredient_main, domain: 'recipe', label: '재료 관리', title: '재료 관리' };
  nav.domains.recipe.screens.splice(nav.domains.recipe.screens.indexOf('recipe_materials'), 0, ingredientManagement);
  nav.parentScreens[ingredientManagement] = 'recipe_main';
  targets.push({ ...ingredientTarget, id: `screen:${ingredientManagement}`, screen: ingredientManagement,
    label: '재료 관리', hidden: false, appmapOnly: true, expoRoute: 'recipes/ingredients', screenId: 'RCP-13b', mapping: 'appmap-management-route', candidates: ['RCP-13b'] });
  const menuManagement = 'recipe_manage';
  nav.screens[menuManagement] = { ...nav.screens.recipe_main, domain: 'recipe', label: '메뉴 관리', title: '메뉴 관리' };
  nav.domains.recipe.screens.splice(nav.domains.recipe.screens.indexOf(ingredientManagement), 0, menuManagement);
  nav.parentScreens[menuManagement] = 'recipe_main';
  targets.push({ id: `screen:${menuManagement}`, screen: menuManagement, popup: null, label: '메뉴 관리', hidden: false,
    appmapOnly: true, expoRoute: 'recipes/manage', screenId: 'RCP-13d', mapping: 'appmap-management-route', candidates: ['RCP-13d'] });
  // Category editing is reached through management; omit duplicate top-level tabs.
  const managedCategories = new Set(['recipe_category', 'recipe_material_category']);
  nav.domains.recipe.screens = nav.domains.recipe.screens.filter(id => !managedCategories.has(id));
  for (const target of targets) if (managedCategories.has(target.screen)) target.hidden = true;
  // Category selection belongs to the material form, not the management list.
  nav.popupTabs.recipe_materials = (nav.popupTabs.recipe_materials ?? [])
    .filter(([popup]) => popup !== 'material_category_pick');
  const managementGroups = {};
  for (const [host, kind, label, children] of [
    ['recipe_manage', 'recipe', '메뉴', [
      ['register', '메뉴 등록', 'recipes/add'], ['detail', '상세', 'recipes/[id]'], ['edit', '수정', 'recipes/add?id=[id]'],
    ]],
    ['recipe_ingredients', 'ingredient', '재료', [
      ['register', '재료 등록', 'ingredients/add'], ['detail', '상세', 'ingredients/[id]'],
      ['basic', '기본 정보 수정', 'ingredients/edit/[id]'], ['stock', '재고 수정', 'ingredients/add-stock/[id]'],
      ['options', '구매 링크 수정', 'ingredients/option'],
    ]],
    ['recipe_materials', 'material', '부자재', [
      ['add', '부자재 추가', 'recipes/material-edit'], ['detail', '상세', 'recipes/materials'], ['edit', '부자재 수정', 'recipes/materials'],
    ]],
  ]) {
    managementGroups[host] = [host];
    nav.parentScreens[host] = 'recipe_main';
    for (const [suffix, name, route] of [
      ...children,
      ['categories', '카테고리 편집', `recipes/manage-order?kind=${kind}&target=category`],
      ['order', `${label} 목록 편집`, `recipes/manage-order?kind=${kind}&target=item`],
    ]) {
      const id = `${host}_${suffix}`;
      nav.screens[id] = { domain: 'recipe', label: name, title: name };
      nav.parentScreens[id] = host;
      managementGroups[host].push(id);
      const surface = registry.surfaces.find(row => row.expoRoute === route.split('?')[0]);
      targets.push({ id: `screen:${id}`, screen: id, popup: null, label: name, hidden: false,
        appmapOnly: true, expoRoute: route, screenId: surface?.screenId ?? null,
        mapping: 'appmap-management-route', candidates: surface ? [surface.screenId] : [] });
      if (suffix === 'categories' || suffix === 'order') {
        nav.popupTabs[id] = [['order_delete', '삭제 확인']];
        targets.push({ ...targets.at(-1), id: `popup:order_delete@${id}`, popup: 'order_delete', label: '삭제 확인' });
        nav.popupTabs[id].push(['order_save', '저장 확인']);
        targets.push({ ...targets.at(-1), id: `popup:order_save@${id}`, popup: 'order_save', label: '저장 확인' });
      }
      if (kind === 'material' && suffix === 'detail') {
        nav.popupTabs[id] = [['material_detail_menu', '더보기']];
        targets.push({ ...targets.at(-1), id: `popup:material_detail_menu@${id}`, popup: 'material_detail_menu', label: '더보기' });
      }
    }
    const extraPopups = [['manage_more', '더보기'], ['manage_item', '항목 메뉴'],
      ...(kind === 'ingredient' ? [['manage_edit', '수정 메뉴'], ['manage_delete', '삭제 확인']] :
        kind === 'recipe' ? [['manage_edit', '수정 진입']] : [])];
    nav.popupTabs[host] = [...extraPopups, ...(nav.popupTabs[host] ?? [])];
    const hostTarget = targets.find(target => target.id === `screen:${host}`);
    for (const [popup, name] of extraPopups) targets.push({ ...hostTarget,
      id: `popup:${popup}@${host}`, popup, label: name, appmapOnly: true });
  }
  const retiredMaterials = new Set(['recipe_material_search', 'recipe_materials', 'recipe_material_category', 'my_materials', 'my_material_categories']);
  const retired = id => retiredMaterials.has(id) || id.startsWith('recipe_materials_');
  for (const domain of Object.values(nav.domains)) domain.screens = domain.screens.filter(id => !retired(id));
  delete managementGroups.recipe_materials;
  for (let i = targets.length - 1; i >= 0; i--) if (retired(targets[i].screen) || targets[i].popup?.includes('material')) targets.splice(i, 1);
  for (const key of Object.keys(nav.popupTabs)) nav.popupTabs[key] = nav.popupTabs[key].filter(([id]) => !id.includes('material'));
  return { ...nav, managementGroups, targets, source: prototypePath, sourceSha256: createHash('sha256').update(html.replace(/\r\n/g, '\n')).digest('hex'),
    counts: { total: targets.length, active: targets.filter(t => !t.hidden).length, hidden: targets.filter(t => t.hidden).length,
      screens: Object.keys(nav.screens).length, popups: targets.filter(t => t.popup).length },
    expoOnly: registry.surfaces.filter(s => s.parity === 'expoOnly').map(s => ({ screenId: s.screenId, name: s.name, expoRoute: s.expoRoute })) };
}

export function primaryScreens(model, domain) {
  return model.domains[domain].screens.filter(k => domain !== 'ingredient' || !model.ingredientEditScreens.includes(k));
}
