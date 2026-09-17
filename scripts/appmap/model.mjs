import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { managementSourceScreens, removedOrderOverviewTargets } from './navigation.mjs';

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
  const popupTabs = literal(declarations.get('popupTabs'));
  const retiredMaterialPopups = new Set(['recipe_material_usage', 'material_add', 'material_edit', 'material_category_pick', 'material_delete', 'sales_extra_detail']);
  for (const key of Object.keys(popupTabs)) popupTabs[key] = popupTabs[key].filter(([id]) => !retiredMaterialPopups.has(id));
  return { domains: literal(declarations.get('domains')), screens, popupTabs,
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
  const added = [...ids].filter(id => !auditIds.has(id) && !removedOrderOverviewTargets.has(id));
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
  // Management shortcuts share the inventory tab's complete navigation contract.
  // Keep one popup inventory so later changes cannot diverge between entry points.
  for (const [screen, sourceScreen] of Object.entries(managementSourceScreens)) {
    const source = targets.find(target => target.id === `screen:${sourceScreen}`);
    const shortcut = targets.find(target => target.id === `screen:${screen}`);
    Object.assign(shortcut, { expoRoute: source.expoRoute, screenId: source.screenId, sourceScreen, sourceTargetId: source.id });
    nav.popupTabs[screen] = (nav.popupTabs[sourceScreen] ?? []).map(row => [...row]);
    for (const [popup, label] of nav.popupTabs[screen]) {
      const origin = targets.find(target => target.id === `popup:${popup}@${sourceScreen}`);
      targets.push({ ...origin, id: `popup:${popup}@${screen}`, screen, label, hidden: false,
        appmapOnly: true, sourceScreen, sourceTargetId: origin.id });
    }
  }
  const retiredMaterials = new Set(['recipe_material_search', 'recipe_materials', 'recipe_material_category', 'my_materials', 'my_material_categories', 'extra']);
  const retired = id => retiredMaterials.has(id) || id.startsWith('recipe_materials_');
  for (const domain of Object.values(nav.domains)) domain.screens = domain.screens.filter(id => !retired(id));
  delete managementGroups.recipe_materials;
  for (let i = targets.length - 1; i >= 0; i--) if (retired(targets[i].screen) || removedOrderOverviewTargets.has(targets[i].id) || targets[i].id === 'popup:stock_event_more@stock') targets.splice(i, 1);
  for (const key of Object.keys(nav.screens)) if (retired(key)) {
    delete nav.screens[key];
    delete nav.popupTabs[key];
    delete nav.parentScreens[key];
  }
  nav.popupTabs.order_main = (nav.popupTabs.order_main ?? []).filter(([id]) => !removedOrderOverviewTargets.has(`popup:${id}@order_main`));
  nav.popupTabs.stock = (nav.popupTabs.stock ?? []).filter(([id]) => id !== 'stock_event_more');
  for (const [screen, domain, label, route, parent, screenId] of [
    ['my_tax_history', 'my', '세금 수정 내역', 'my/configuration-history?kind=tax', 'my_tax', 'MY-02b'],
    ['my_fixed_history', 'recipe', '고정 지출 수정 내역', 'my/configuration-history?kind=fixed_cost', 'fixed_average', 'MY-05c'],
    ['my_country', 'my', '국가·통화', 'my/country', 'my_main', 'MY-12'],
    ['recipe_tax_detail', 'recipe', '세금 상세', 'recipes/tax', 'recipe_detail', 'RCP-02c'],
  ]) {
    nav.screens[screen] = { domain, label, title: label };
    nav.parentScreens[screen] = parent;
    nav.domains[domain].screens.splice(nav.domains[domain].screens.indexOf(parent) + 1, 0, screen);
    targets.push({ id: `screen:${screen}`, screen, popup: null, label, hidden: false, appmapOnly: true,
      expoRoute: route, screenId, mapping: 'appmap-management-route', candidates: [screenId] });
    if (screen.endsWith('_history')) {
      nav.popupTabs[screen] = [['configuration_detail', '수정 내용']];
      targets.push({ ...targets.at(-1), id: `popup:configuration_detail@${screen}`, popup: 'configuration_detail', label: '수정 내용' });
    }
  }
  for (const [popup, label] of [['tax_confirm', '저장 확인'], ['tax_simulation', '세금 시뮬레이션']]) {
    nav.popupTabs.my_tax.push([popup, label]);
    targets.push({ ...targets.find(t => t.id === 'screen:my_tax'), id: `popup:${popup}@my_tax`, popup, label, appmapOnly: true });
  }
  nav.popupTabs.order_main.push(['order_purchase_links', '구매링크 열기']);
  targets.push({ ...targets.find(t => t.id === 'screen:order_main'),
    id: 'popup:order_purchase_links@order_main', popup: 'order_purchase_links', label: '구매링크 열기',
    appmapOnly: true, previewOnly: true });
  const orderUnselected = 'order_order_unselected';
  nav.popupTabs.order_main.push([orderUnselected, '미 선택']);
  targets.push({ ...targets.find(t => t.id === 'popup:order_order@order_main'),
    id: `popup:${orderUnselected}@order_main`, popup: orderUnselected, label: '미 선택',
    appmapOnly: true, previewOnly: true });
  const fixedAverageTarget = targets.find(t => t.id === 'screen:fixed_average');
  nav.popupTabs.fixed_average.push(['fixed_complete', '입력 완료']);
  targets.push({ ...fixedAverageTarget, id: 'popup:fixed_complete@fixed_average', popup: 'fixed_complete', label: '입력 완료',
    appmapOnly: true, previewOnly: true });
  const fixedDetailSurface = registry.surfaces.find(row => row.screenId === 'MY-05d');
  let fixedDetailInsert = nav.domains.recipe.screens.indexOf('fixed_average') + 1;
  for (const [screen, label, route] of [
    ['fixed_detail_month', '월별 고정 지출 상세', 'recipes/fixed-cost-detail?month=2026-08'],
    ['fixed_detail_average', '평균 고정 지출 상세', 'recipes/fixed-cost-detail?mode=average'],
  ]) {
    nav.screens[screen] = { domain: 'recipe', label, title: '고정 지출 상세' };
    nav.parentScreens[screen] = 'fixed_average';
    nav.domains.recipe.screens.splice(fixedDetailInsert++, 0, screen);
    targets.push({ id: `screen:${screen}`, screen, popup: null, label, hidden: false, appmapOnly: true,
      expoRoute: route, screenId: 'MY-05d', mapping: 'appmap-management-route',
      candidates: fixedDetailSurface ? [fixedDetailSurface.screenId] : [] });
  }
  // 고정 지출의 상세·설정·입력 화면은 메뉴 영역의 같은 레벨 페이지가 아니다.
  // AppMap에서는 고정 지출 하나만 2뎁스에 두고 관련 화면을 그 아래에 묶는다.
  const fixedCostGroup = [
    'fixed_average',
    'fixed_detail_month',
    'fixed_detail_average',
    'fixed_settings',
    'my_fixed_history',
    'fixed_actual',
  ];
  managementGroups.fixed_average = fixedCostGroup;
  nav.domains.recipe.screens = nav.domains.recipe.screens.filter(
    screen => screen === 'fixed_average' || !fixedCostGroup.includes(screen),
  );
  return { ...nav, managementGroups, targets, source: prototypePath, sourceSha256: createHash('sha256').update(html.replace(/\r\n/g, '\n')).digest('hex'),
    counts: { total: targets.length, active: targets.filter(t => !t.hidden).length, hidden: targets.filter(t => t.hidden).length,
      screens: targets.filter(t => !t.popup).length, popups: targets.filter(t => t.popup).length },
    expoOnly: registry.surfaces.filter(s => s.parity === 'expoOnly').map(s => ({ screenId: s.screenId, name: s.name, expoRoute: s.expoRoute })) };
}

export function primaryScreens(model, domain) {
  return model.domains[domain].screens.filter(k => domain !== 'ingredient' || !model.ingredientEditScreens.includes(k));
}
