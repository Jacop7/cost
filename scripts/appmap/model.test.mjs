import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, readNavigation, prototypePath } from './model.mjs';
import { activeTargetId, destination, navRows, adapterKeys, limitationEntries, matchesPathCondition } from './navigation.mjs';
import { createAppmapServer } from './server.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const model = buildModel(root);

test('통합한 부자재 옛 주소는 재료로 연결하되 매출 재료 상세는 보존한다', () => {
  for (const host of ['recipe_materials', 'my_materials', 'recipe_materials_detail', 'recipe_materials_edit']) {
    assert.equal(model.screens[host], undefined);
    assert.equal(activeTargetId(`screen:${host}`), 'screen:recipe_ingredients');
  }
  assert.equal(activeTargetId('popup:recipe_material_usage@recipe_material_search'), 'screen:recipe_ingredient_search');
  const id = 'popup:sales_material_detail@material';
  assert.equal(activeTargetId(id), id);
  assert.ok(model.targets.some(t => t.id === id));
  assert.ok(navRows(model, 'material').popups.some(([id]) => id === 'sales_material_detail'));
});

test('발주의 제거된 목록 보기 대신 카드 보드로 돌아가며 주문·입고 동작은 남긴다', () => {
  const rows = navRows(model, 'order_main');
  for (const kind of ['candidates', 'waiting', 'received']) {
    const id = `popup:order_${kind}@order_main`;
    assert.equal(activeTargetId(id), 'screen:order_main');
    assert.ok(!model.targets.some(target => target.id === id));
    assert.ok(!rows.popups.some(([popup]) => popup === `order_${kind}`));
  }
  for (const popup of ['order_order', 'order_receive', 'order_cancel', 'order_revert']) {
    assert.ok(rows.popups.some(([id]) => id === popup));
    assert.ok(model.targets.some(target => target.id === `popup:${popup}@order_main`));
  }
  const receive = model.targets.find(target => target.id === 'screen:order_receive');
  assert.equal(receive.expoRoute, 'orders/receive');
  const receiveDestination = destination(receive);
  assert.equal(receiveDestination.path, '/orders');
  assert.equal(receiveDestination.steps.at(-1).expectPath, '/orders/receive');
});

test('MY의 옛 설정 화면은 숨기고 메뉴 영역의 목록형 설정 화면으로 연결한다', () => {
  assert.equal(model.screens.my_settings, undefined);
  assert.equal(activeTargetId('screen:my_settings'), 'screen:my_main');
  assert.ok(!navRows(model, 'my_main').primary.includes('my_settings'));
  assert.ok(!navRows(model, 'my_main').primary.includes('my_ingredient_categories'));
  assert.ok(!navRows(model, 'my_main').primary.includes('my_recipe_categories'));
  assert.equal(activeTargetId('screen:my_ingredient_categories'), 'screen:recipe_ingredients');
  assert.equal(activeTargetId('screen:my_recipe_categories'), 'screen:recipe_manage');
});

test('매장 시간대 팝업은 지역 설정 화면에 표시한다', () => {
  assert.equal(activeTargetId('popup:hours_timezone@my_hours'), 'popup:hours_timezone@my_language');
  assert.ok(!navRows(model, 'my_hours').popups.some(([id]) => id === 'hours_timezone'));
  assert.ok(navRows(model, 'my_language').popups.some(([id]) => id === 'hours_timezone'));
  assert.ok(navRows(model, 'my_language').popups.some(([id]) => id === 'tax_country'));
  const target = model.targets.find(row => row.id === 'popup:hours_timezone@my_language');
  assert.equal(target?.expoRoute, 'my/country');
});

test('매출 작성 팝업은 피드가 아니라 새 작성 초안 화면에서 연다', () => {
  assert.equal(model.screens.sales_main.label, '매출 작성');
  assert.equal(model.screens.day.label, '일별 손익');
  assert.deepEqual(navRows(model, 'sales_main').sub, ['sales_main', 'sales_write']);
  assert.deepEqual(navRows(model, 'sales_main').popups.map(([popup]) => popup), [
    'sales_sort', 'sales_status', 'sales_calendar',
  ]);
  assert.deepEqual(navRows(model, 'sales_write').popups.map(([popup]) => popup), [
    'sales_preview', 'sales_qty', 'sales_etc', 'sales_expense', 'sales_entry_delete',
  ]);
  for (const popup of ['sales_qty', 'sales_etc', 'sales_expense']) {
    const target = model.targets.find(item => item.id === `popup:${popup}@sales_write`);
    assert.equal(target.expoRoute, 'sales/write');
    assert.equal(destination(target).path, '/sales/write');
  }
  const etc = destination(model.targets.find(item => item.id === 'popup:sales_etc@sales_write'));
  assert.equal(etc.steps.at(-1).name, '기타 매출 추가');
  const preview = destination(model.targets.find(item => item.id === 'popup:sales_preview@sales_write'));
  assert.equal(preview.steps.at(-1).expectText, '손익 계산');
  const remove = destination(model.targets.find(item => item.id === 'popup:sales_entry_delete@sales_write'));
  assert.equal(remove.steps.at(-1).expectText, '선택한 메뉴를 삭제하시겠습니까?');
  assert.ok(!model.domains.sales.screens.includes('day_full'));
  assert.ok(!model.domains.sales.screens.includes('sales_past'));
});

test('현재 제품에 없는 옛 팝업은 실제 작성·설정 화면이나 인라인 상태로 정리한다', () => {
  assert.equal(activeTargetId('popup:expense_add@expense'), 'popup:sales_expense@sales_write');
  assert.equal(activeTargetId('popup:expense_delete@expense'), 'popup:sales_entry_delete@sales_write');
  assert.equal(activeTargetId('popup:sales_shortage@sales_write'), 'screen:sales_write');
  assert.equal(activeTargetId('popup:sales_revenue_all@revenue'), 'screen:revenue');
  assert.equal(activeTargetId('popup:fixed_item_add@my_fixed_edit'),
    'popup:fixed_item_add@fixed_settings');
  for (const id of ['popup:expense_add@expense', 'popup:expense_delete@expense',
    'popup:sales_shortage@sales_write', 'popup:sales_revenue_all@revenue',
    'popup:fixed_item_add@my_fixed_edit']) assert.equal(model.targets.some(t => t.id === id), false, id);
  const fixedAdd = model.targets.find(t => t.id === 'popup:fixed_item_add@fixed_settings');
  assert.equal(destination(fixedAdd).path, '/recipes/fixed-cost-settings');
  assert.equal(destination(fixedAdd).steps.at(-1).expectIncreaseSelector,
    'input[placeholder="고정 지출 항목명"]');
});

test('전체 부족 재고 후조건은 정확한 최소재고 쿼리까지 검사한다', () => {
  const target = model.targets.find(t => t.id === 'popup:stock_check_all@stock_check');
  const step = destination(target).steps.at(-1);
  const matches = path => matchesPathCondition(new URL(path, 'http://localhost'), step);
  assert.equal(matches('/ingredients?stock=below-safety'), true);
  assert.equal(matches('/ingredients/?__appmap=1&stock=below-safety&__appmap_run=9'), true);
  for (const path of ['/ingredients', '/ingredients?stock=', '/ingredients?stock=all',
    '/ingredients?stock=below-safety-other', '/ingredients?stock=BELOW-SAFETY',
    '/ingredients?stock=below-safety&stock=all', '/ingredients?stock=below-safety&stock=below-safety',
    '/recipes?stock=below-safety']) assert.equal(matches(path), false, path);
});

test('쿼리 후조건 없는 경로 검증은 기존 pathname 동작을 유지한다', () => {
  const step = { expectPath: '/ingredients' };
  for (const path of ['/ingredients', '/ingredients/', '/ingredients?stock=all&__appmap=1'])
    assert.equal(matchesPathCondition(new URL(path, 'http://localhost'), step), true, path);
  assert.equal(matchesPathCondition(new URL('/recipes?stock=below-safety', 'http://localhost'), step), false);
});
test('원본 audit 집합은 보존하고 AppMap 전용 바로가기는 별도 표시한다', () => {
  const audit = JSON.parse(readFileSync(resolve(root, 'docs/prototypes/full-page-flow-prototype-render-audit.json'), 'utf8'));
  const currentAudit = audit.targets.map(t => t.target).filter(id => activeTargetId(id) === id);
  assert.deepEqual(model.targets.filter(t => !t.appmapOnly).map(t => t.id).sort(), currentAudit.sort());
  assert.equal(model.counts.total, currentAudit.length + model.targets.filter(t => t.appmapOnly).length);
  assert.equal(model.counts.screens + model.counts.popups, model.counts.total);
  assert.equal(new Set(model.targets.map(t => t.id)).size, model.counts.total);
  assert.deepEqual([...new Set(model.targets.filter(t => t.hidden).map(t => t.screen))],
    ['discard', 'recipe_category', 'sales_inventory_count', 'sales_expense_read', 'day_full', 'sales_past']);
  for (const category of ['recipe_category']) {
    assert.ok(!navRows(model, 'recipe_main').primary.includes(category));
    assert.ok(model.targets.find(t => t.screen === category && !t.popup)?.expoRoute);
  }
});

test('메뉴의 재료 설정 탭은 재료 설정 화면을 열고 메뉴 영역을 유지한다', () => {
  const target = model.targets.find(t => t.id === 'screen:recipe_ingredients');
  assert.equal(target.appmapOnly, true);
  assert.equal(target.label, '재료 설정');
  assert.equal(destination(target).path, '/recipes/ingredients');
  const rows = navRows(model, target.screen);
  assert.equal(rows.domain, 'recipe');
  assert.equal(rows.primaryActive, 'recipe_ingredients');
  assert.ok(rows.primary.includes('recipe_ingredients'));
  assert.ok(!rows.primary.includes('recipe_materials'));
});
test('메뉴 설정 탭은 목록형 메뉴 설정 화면을 연다', () => {
  const target = model.targets.find(t => t.id === 'screen:recipe_manage');
  assert.equal(target.appmapOnly, true);
  assert.equal(target.label, '메뉴 설정');
  assert.equal(destination(target).path, '/recipes/manage');
  assert.equal(navRows(model, target.screen).primaryActive, 'recipe_manage');
});
test('관리 하위 화면은 부모 탭과 실제 편집 경로를 유지한다', () => {
  const target = id => model.targets.find(t => t.id === `screen:${id}`);
  for (const [host, kind] of [['recipe_manage','recipe'], ['recipe_ingredients','ingredient']]) {
    for (const [suffix, mode] of [['categories','category'], ['order','item']]) {
      const id = `${host}_${suffix}`;
      assert.equal(navRows(model, id).primaryActive, host);
      assert.ok(navRows(model, host).sub.includes(id));
      assert.equal(destination(target(id)).path, `/recipes/manage-order?kind=${kind}&target=${mode}`);
      const save = destination(model.targets.find(t => t.id === `popup:order_save@${id}`));
      assert.equal(save.steps[0].key, 'ArrowDown');
      assert.equal(save.steps.at(-1).expectText, '저장하시겠습니까?');
      assert.equal(save.steps.length, 2); // open only; never confirm a persisted order.
      const remove = destination(model.targets.find(t => t.id === `popup:order_delete@${id}`));
      assert.equal(remove.steps.length, 1); // confirmation or blocked reason only; never delete data.
      assert.equal(remove.steps[0].enabledOnly, true);
      if (kind === 'ingredient' && mode === 'item') assert.deepEqual(remove.steps[0].expectTextAny, ['삭제하시겠습니까?', '현재, 삭제가 불가능한 식재료입니다']);
      else assert.equal(remove.steps[0].expectText, mode === 'category' ? '삭제' : '삭제하시겠습니까?');
    }
    const popup = model.targets.find(t => t.id === `popup:manage_item@${host}`);
    assert.equal(destination(popup).steps[0].hasText, true);
    assert.ok(!destination(popup).steps.some(step => step.name === '삭제'));
  }
  assert.equal(destination(target('recipe_manage_edit'), {recipe:'abc'}).path, '/recipes/add?id=abc');
  assert.equal(destination(target('recipe_ingredients_options'), {ingredient:'xyz'}).path, '/ingredients/option?ingredient=xyz');
  const confirmation = model.targets.find(t => t.id === 'popup:manage_delete@recipe_ingredients');
  assert.deepEqual(destination(confirmation).steps.at(-1).expectTextAny, ['삭제하시겠습니까?', '현재, 삭제가 불가능한 식재료입니다']);
  assert.equal(destination(confirmation).steps.length, 2);
});

test('재료 설정의 재고·구매 링크 수정은 원본의 모든 하위 탭·진입·샘플 제한을 공유한다', () => {
  for (const [screen, source] of [['recipe_ingredients_stock', 'stock_change'], ['recipe_ingredients_options', 'options']]) {
    assert.deepEqual(navRows(model, screen).popups, navRows(model, source).popups);
    assert.equal(navRows(model, screen).primaryActive, 'recipe_ingredients');
    for (const popup of [null, ...model.popupTabs[source].map(([id]) => id)]) {
      const id = name => popup ? `popup:${popup}@${name}` : `screen:${name}`;
      const origin = model.targets.find(target => target.id === id(source));
      const shortcut = model.targets.find(target => target.id === id(screen));
      assert.ok(shortcut); assert.equal(shortcut.sourceTargetId, origin.id);
      for (const entities of [{}, { ingredient: 'same-ingredient' }]) {
        for (const sample of [false, true]) assert.deepEqual(destination(shortcut, entities, sample), destination(origin, entities, sample));
      }
    }
  }
});

test('프로토타입 domain/page/popup 순서와 AppMap 일괄 입고 경로 일치', () => {
  assert.deepEqual(Object.keys(model.domains), ['ingredient', 'recipe', 'order', 'sales', 'my']);
  assert.deepEqual(navRows(model, 'ingredient_main').primary, ['ingredient_main', 'ingredient_bulk_inbound', 'ingredient_add', 'ingredient_detail', 'ingredient_edit_menu', 'stock', 'purchase', 'ingredient_changes']);
  const bulk = model.targets.find(target => target.id === 'screen:ingredient_bulk_inbound');
  assert.equal(destination(bulk, {}).path, '/ingredients/bulk-inbound');
  for (const screen of Object.keys(model.screens)) {
    const rows = navRows(model, screen);
    assert.deepEqual(rows.popups, (model.popupTabs[screen] ?? []).filter(([popup]) =>
      activeTargetId(`popup:${popup}@${screen}`) === `popup:${popup}@${screen}`));
    const edit = screen === 'ingredient_edit_menu' || model.ingredientEditScreens.includes(screen);
    const management = Object.values(model.managementGroups ?? {}).find(screens => screens.includes(screen));
    assert.deepEqual(rows.sub, management ?? (edit ? model.ingredientEditScreens : []));
    if (rows.domain !== 'ingredient') assert.deepEqual(rows.primary, model.domains[rows.domain].screens);
  }
});
test('삭제된 최근 기록 더보기 탭과 옛 URL은 재고 목록으로 정리한다', () => {
  assert.ok(!navRows(model, 'stock').popups.some(([id]) => id === 'stock_event_more'));
  assert.equal(activeTargetId('popup:stock_event_more@stock'), 'screen:stock');
  assert.equal(activeTargetId('popup:stock_event_revert@stock'), 'popup:stock_event_revert@stock');
});

test('재료 삭제 진입은 현재 확인 문구를 관측하고 삭제를 확정하지 않는다', () => {
  const target = model.targets.find(t => t.id === 'screen:ingredient_delete');
  const result = destination(target, { ingredient: 'test-id' });
  assert.deepEqual(result.steps.map(step => step.name), ['수정 메뉴 열기', '재료 삭제']);
  assert.deepEqual(result.steps.at(-1).expectTextAny, ['삭제하시겠습니까?', '현재, 삭제가 불가능한 식재료입니다']);
  const source = readFileSync(resolve(root, 'apps/mobile/src/features/ingredients/components/IngredientDeleteDialog.tsx'), 'utf8');
  for (const title of result.steps.at(-1).expectTextAny) assert.ok(source.includes(title));
});

test('구매처 선택 진입은 실제 공용 시트 제목과 일치한다', () => {
  const target = model.targets.find(t => t.id === 'popup:option_vendor@options');
  const result = destination(target, { ingredient: 'test-id' });
  assert.equal(result.manual, false);
  assert.deepEqual(result.steps.map(step => step.name), ['구매 옵션 추가', '구매처 변경,']);
  assert.equal(result.steps.at(-1).expectText, '구매처 선택');
  const source = readFileSync(resolve(root, 'apps/mobile/src/features/ingredients/components/VendorPickerSheet.tsx'), 'utf8');
  assert.ok(source.includes(`: '${result.steps.at(-1).expectText}'}`));
});

test('모든 popup 어댑터 키는 실제 원본 target에 존재', () => {
  const ids = new Set(model.targets.map(t => t.id));
  for (const key of adapterKeys()) assert.ok(ids.has(key), key);
});
test('활성 popup은 실제 열기 또는 소스 근거 있는 제약으로 중복 없이 전수 분류', () => {
  const limitations = limitationEntries();
  const keys = [...adapterKeys(), ...limitations.map(x => x.id)];
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys.sort(), model.targets.filter(t => t.popup).map(t => t.id).sort());
  for (const entry of limitations) {
    assert.ok(existsSync(resolve(root, entry.source)), entry.source);
    assert.ok(entry.reason.length > 20);
    const target = model.targets.find(t => t.id === entry.id);
    const d = destination(target, { ingredient: 'id', recipe: 'id' });
    assert.equal(d.manual, true); assert.deepEqual(d.steps, []);
    assert.equal(d.reason, entry.reason);
  }
});

test('고정 지출 상세·설정·수정 내역·입력은 고정 지출 아래에 묶는다', () => {
  const group = [
    'fixed_average',
    'fixed_detail_month',
    'fixed_detail_average',
    'fixed_settings',
    'my_fixed_history',
    'fixed_actual',
  ];
  assert.deepEqual(navRows(model, 'fixed_settings').sub, group);
  assert.equal(navRows(model, 'fixed_settings').primaryActive, 'fixed_average');
  assert.ok(model.domains.recipe.screens.includes('fixed_average'));
  for (const screen of group.slice(1)) assert.ok(!model.domains.recipe.screens.includes(screen));
});

test('세금·고정 지출 내역과 메뉴 세금 상세는 실제 경로와 상세 확인까지 연결한다', () => {
  for (const [screen, kind] of [['my_tax_history', 'tax'], ['my_fixed_history', 'fixed_cost']]) {
    const t = model.targets.find(t => t.id === `screen:${screen}`);
    assert.equal(destination(t).path, `/my/configuration-history?kind=${kind}`);
    assert.equal(destination(model.targets.find(t => t.id === `popup:configuration_detail@${screen}`)).steps.at(-1).expectText,
      kind === 'fixed_cost' ? undefined : '수정 내용');
  }
  const tax = model.targets.find(t => t.id === 'screen:recipe_tax_detail');
  assert.equal(destination(tax).needsEntity, 'recipe');
  assert.equal(destination(tax, { recipe: 'menu-id' }).path, '/recipes/tax?id=menu-id');
  assert.equal(activeTargetId('popup:sales_extra_detail@extra'), 'popup:sales_material_detail@material');
});
test('고정 지출 입력 완료 상태는 읽기 전용 샘플 화면으로 연결한다', () => {
  const screen = model.targets.find(t => t.id === 'screen:fixed_average');
  const target = model.targets.find(t => t.id === 'popup:fixed_complete@fixed_average');
  assert.ok(target);
  assert.equal(target.previewOnly, true);
  assert.equal(target.expoRoute, screen.expoRoute);
  assert.deepEqual(model.popupTabs.fixed_average.at(-1), ['fixed_complete', '입력 완료']);
  const result = destination(target, {}, true);
  assert.equal(result.manual, false);
  assert.deepEqual(result.steps, []);
  const month = model.targets.find(t => t.id === 'screen:fixed_detail_month');
  const average = model.targets.find(t => t.id === 'screen:fixed_detail_average');
  assert.equal(destination(month).path, '/recipes/fixed-cost-detail?month=2026-08');
  assert.equal(destination(average).path, '/recipes/fixed-cost-detail?mode=average');
  assert.equal(month.screenId, 'MY-05d');
  assert.equal(average.screenId, 'MY-05d');
});
test('위험 상태는 자동 실행하지 않고 안전한 확인창의 완료 조건을 유지', () => {
  const get = id => destination(model.targets.find(t => t.id === `popup:${id}`), { ingredient: 'id', recipe: 'id' });
  assert.equal(get('past_save@sales_past').manual, true);
  const expenseConfirm = get('sales_entry_delete@sales_write');
  assert.equal(expenseConfirm.manual, false);
  assert.equal(expenseConfirm.steps.length, 3);
  assert.equal(expenseConfirm.steps.at(-1).expectText, '선택한 메뉴를 삭제하시겠습니까?');
  assert.ok(!expenseConfirm.steps.some(step => step.name === '삭제'));
  assert.equal(get('account_delete@my_account').steps.at(-1).expectSelector, 'input[aria-label="탈퇴 확인 문구"]');
  assert.equal(get('sales_status@sales_main').steps.at(-1).name, '미작성');
  assert.equal(get('hours_end@my_hours').steps[0].name, '종료 선택');
  assert.equal(get('fixed_item_add@fixed_settings').steps.at(-1).expectIncreaseSelector,
    'input[placeholder="고정 지출 항목명"]');
});
test('상세/수정은 기존 실제 엔티티 필요, 레시피 수정 id 파라미터 보존', () => {
  const target = model.targets.find(t => t.id === 'screen:recipe_edit');
  assert.equal(destination(target).needsEntity, 'recipe');
  assert.equal(destination(target, { recipe: 'test-id' }).path, '/recipes/add?id=test-id');
  const option = model.targets.find(t => t.id === 'screen:options');
  assert.equal(destination(option, { ingredient: 'test-id' }).path, '/ingredients/option?ingredient=test-id');
  const menu = model.targets.find(t => t.id === 'screen:menu');
  assert.equal(destination(menu, { recipe: 'test-id' }).path, '/sales/menu?recipe=test-id');
  const order = model.targets.find(t => t.id === 'screen:order_detail');
  assert.equal(destination(order).path, '/orders/place');
  assert.equal(destination(order, { ingredient: 'test-id' }).path, '/orders/place');
  const orderPopup = model.targets.find(t => t.id === 'popup:order_order@order_detail');
  assert.equal(destination(orderPopup).path, '/orders/place');
  assert.deepEqual(destination(orderPopup).steps, []);
});
test('미연결 popup은 host 경로만 있다고 연결 완료 취급하지 않음', () => {
  const target = model.targets.find(t => t.id === 'popup:stock_error@stock_change');
  const d = destination(target, { ingredient: 'test-id' });
  assert.equal(d.manual, true); assert.equal(d.steps.length, 0);
});
test('샘플 전용 쓰기 경로는 실제 모드에서 자동으로 열지 않는다', () => {
  for (const id of ['past_save@sales_past','tax_saved@my_tax']) {
    const target = model.targets.find(t=>t.id === 'popup:'+id);
    assert.equal(destination(target,{ingredient:'id',recipe:'id'},false).manual,true);
    assert.equal(destination(target,{ingredient:'id',recipe:'id'},true).manual,false);
  }
});
test('재고 수정은 실제 페이지와 차감/폐기 탭으로 연결하며 이전 소진 오류를 입고 오류로 위장하지 않는다', () => {
  for (const [id, suffix] of [['screen:stock_change', ''], ['popup:stock_deduct@stock_change', '?mode=deduct'], ['popup:stock_discard@stock_change', '?mode=waste']]) {
    const d = destination(model.targets.find(t => t.id === id), { ingredient: 'test-id' });
    assert.equal(d.path, '/ingredients/add-stock/test-id' + suffix); assert.equal(d.manual, false); assert.equal(d.steps.length, 0);
  }
  const d = destination(model.targets.find(t => t.id === 'popup:stock_error@stock_change'), { ingredient: 'id' }, true);
  assert.equal(d.manual, false); assert.equal(d.displayKind, 'scenario');
  assert.equal(d.steps.at(-1).name, '입고'); assert.equal(d.steps.at(-1).expectText, '이전 입고 확인');
  const confirm = destination(model.targets.find(t => t.id === 'popup:stock_confirm@stock_change'), { ingredient: 'id' }, false);
  assert.equal(confirm.manual, false); assert.equal(confirm.steps.at(-1).expectText, '재고를 입고할까요?');
  assert.ok(!confirm.steps.some(step => step.name === '입고'));
});
test('대체 화면/인라인은 실제 팝업 직통과 별도 분류한다', () => {
  const alternates = model.targets.filter(t=>destination(t,{ingredient:'id',recipe:'id'},true).displayKind === 'alternate');
  assert.equal(alternates.length,1);
  for (const screen of ['fixed_actual', 'my_fixed_edit']) {
    const month = destination(model.targets.find(t => t.id === `popup:fixed_period@${screen}`), {}, true);
    assert.equal(month.displayKind, 'direct');
    assert.equal(month.path, '/recipes/fixed-cost-edit');
    assert.equal(month.note, null);
  }
  for (const t of alternates) assert.ok(destination(t,{ingredient:'id',recipe:'id'},true).note);
  const language = destination(model.targets.find(t=>t.id === 'popup:language_preview@my_language'),{},true);
  assert.equal(language.displayKind, 'direct');
  assert.equal(language.steps[0].expectText,'언어 선택');
  const currency = destination(model.targets.find(t=>t.id === 'popup:tax_country@my_language'),{},true);
  assert.equal(currency.displayKind, 'direct');
  assert.equal(currency.steps[0].expectText,'통화 선택');
  const basis = destination(model.targets.find(t=>t.id === 'popup:tax_basis@my_tax'),{},true);
  assert.equal(basis.steps[0].expectText,'판매가에 세금 포함');
  const name = destination(model.targets.find(t=>t.id === 'popup:tax_name@my_tax'),{},true);
  assert.equal(name.steps[0].expectText,'세금 명');
  const rate = destination(model.targets.find(t=>t.id === 'popup:tax_rate@my_tax'),{},true);
  assert.equal(rate.steps[0].expectText,'세율');
});
test('프로토타입 코드는 실행하지 않으며 목록 외 product data는 복제하지 않음', () => {
  const html = readFileSync(resolve(root, prototypePath), 'utf8');
  const nav = readNavigation(html + '<script>throw Error("must not execute")</script>');
  assert.equal(nav.screens.ingredient_main.rows, undefined);
  assert.throws(() => readNavigation(html.replace("const ingredientEditScreens=[", "const ingredientEditScreens=evil([")));
});
test('정적 AppMap 경로/프록시 경계, normal Expo HTML은 변경 없음', async t => {
  const { default: http } = await import('node:http');
  const origin = http.createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<html><head></head><body>real Expo</body></html>'); });
  await new Promise(r => origin.listen(0, '127.0.0.1', r));
  const server = createAppmapServer({ root, upstreamPort: origin.address().port });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); origin.closeAllConnections(); origin.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const plain = await (await fetch(base + '/ingredients')).text();
  assert.equal(plain, '<html><head></head><body>real Expo</body></html>');
  assert.match(await (await fetch(base + '/ingredients?__appmap=1')).text(), /bridge.js/);
  assert.equal((await fetch(base + '/appmap/missing')).status, 404);
  assert.equal((await fetch(base + '/appmap/model.json', { method: 'POST' })).status, 405);
  const hostileStatus = await new Promise((done, reject) => {
    http.get(base + '/appmap/model.json', { headers: { host: 'evil.example' } }, r => { r.resume(); done(r.statusCode); }).on('error', reject);
  });
  assert.equal(hostileStatus, 403);
  assert.equal((await fetch(base + '/appmap')).url, base + '/appmap/');
  const appmapHtml = await (await fetch(base + '/appmap/')).text();
  const appmapJs = await (await fetch(base + '/appmap/app.js')).text();
  const termsData = await (await fetch(base + '/appmap/terms.json')).json();
  const servedModel = await (await fetch(base + '/appmap/model.json')).json();
  assert.match(appmapHtml, /id="screen-url"[^>]+aria-label="실제 Expo 화면 직접 열기"/);
  assert.doesNotMatch(appmapHtml, /id="connection-counts"/);
  assert.match(appmapJs, /location\.protocol.*location\.hostname.*model\.expoPort/);
  assert.match(appmapJs, /new URL\(path, expoOrigin\)/);
  assert.match(appmapJs, /url\.pathname === '\/my\/tax-simulation'/);
  assert.match(appmapJs, /\['country', 'basis', 'treatment', 'components'\]/);
  assert.doesNotMatch(appmapJs, /모든 탭을 표시합니다/);
  assert.match(appmapJs, /용어 사전.*showTerms/);
  assert.doesNotMatch(appmapJs, /location\.href\s*=\s*['"]\/appmap\/terms/);
  assert.equal(termsData.terms.length, 311);
  assert.equal(termsData.terms[0].canonical, '재료');
  assert.ok(termsData.appliedKeys.includes('공통·탐색::매출관리'));
  assert.equal(servedModel.expoPort, origin.address().port);
});

test('구매처 미선택 발주 예시는 샘플 전용으로 기존 발주 완료 화면을 연다', () => {
  const target = model.targets.find(t => t.id === 'popup:order_order_unselected@order_main');
  assert.equal(target.previewOnly, true);
  assert.equal(target.appmapOnly, true);
  const d = destination(target, {}, true);
  assert.equal(d.path, '/orders');
  assert.equal(d.steps[0].name, '발주완료');
  assert.equal(d.steps[0].expectPath, '/orders/place');
});
