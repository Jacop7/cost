import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, readNavigation, prototypePath } from './model.mjs';
import { activeTargetId, destination, navRows, adapterKeys, limitationEntries } from './navigation.mjs';
import { createAppmapServer } from './server.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const model = buildModel(root);
test('원본과 audit의 target 집합 185개를 누락/중복 없이 보존', () => {
  assert.deepEqual(model.counts, { total: 185, active: 182, hidden: 3, screens: 62, popups: 123 });
  assert.equal(new Set(model.targets.map(t => t.id)).size, 185);
  assert.deepEqual(model.targets.filter(t => t.hidden).map(t => t.id), ['screen:discard', 'popup:discard_type@discard', 'popup:discard_period@discard']);
});
test('프로토타입 domain/page/popup 순서 및 수정 하위 5개 일치', () => {
  assert.deepEqual(Object.keys(model.domains), ['ingredient', 'recipe', 'order', 'sales', 'my']);
  assert.deepEqual(navRows(model, 'ingredient_main').primary, ['ingredient_main', 'ingredient_add', 'ingredient_detail', 'ingredient_edit_menu', 'stock', 'purchase', 'ingredient_changes']);
  for (const screen of Object.keys(model.screens)) {
    const rows = navRows(model, screen);
    assert.deepEqual(rows.popups, (model.popupTabs[screen] ?? []).filter(([popup]) => !(screen === 'stock' && popup === 'stock_event_more')));
    const edit = screen === 'ingredient_edit_menu' || model.ingredientEditScreens.includes(screen);
    assert.deepEqual(rows.sub, edit ? model.ingredientEditScreens : []);
    if (rows.domain !== 'ingredient') assert.deepEqual(rows.primary, model.domains[rows.domain].screens);
  }
});
test('삭제된 최근 기록 더보기 탭과 옛 URL은 재고 목록으로 정리한다', () => {
  assert.ok(!navRows(model, 'stock').popups.some(([id]) => id === 'stock_event_more'));
  assert.equal(activeTargetId('popup:stock_event_more@stock'), 'screen:stock');
  assert.equal(activeTargetId('popup:stock_event_revert@stock'), 'popup:stock_event_revert@stock');
});

test('식재료 삭제 진입은 현재 확인 문구를 관측하고 삭제를 확정하지 않는다', () => {
  const target = model.targets.find(t => t.id === 'screen:ingredient_delete');
  const result = destination(target, { ingredient: 'test-id' });
  assert.deepEqual(result.steps.map(step => step.name), ['수정 메뉴 열기', '식재료 삭제']);
  assert.equal(result.steps.at(-1).expectText, '삭제 시, 복구가 불가합니다.');
  const source = readFileSync(resolve(root, 'apps/mobile/src/features/ingredients/screens/IngredientDetailScreen.tsx'), 'utf8');
  assert.ok(source.includes(`message="${result.steps.at(-1).expectText}"`));
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
test('123 popup은 실제 열기 또는 소스 근거 있는 제약으로 중복 없이 전수 분류', () => {
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
test('위험 상태는 자동 실행하지 않고 안전한 확인창의 완료 조건을 유지', () => {
  const get = id => destination(model.targets.find(t => t.id === `popup:${id}`), { ingredient: 'id', recipe: 'id' });
  for (const id of ['past_save@sales_past', 'order_price_spike@order_main']) assert.equal(get(id).manual, true);
  const expenseConfirm = get('expense_delete@expense');
  assert.equal(expenseConfirm.manual, false);
  assert.equal(expenseConfirm.steps.length, 1);
  assert.equal(expenseConfirm.steps[0].expectText, '지출을 삭제할까요?');
  assert.ok(!expenseConfirm.steps.some(step => step.name === '삭제'));
  const breakConfirm = get('sales_break@sales_main');
  assert.equal(breakConfirm.manual, false);
  assert.equal(breakConfirm.steps.at(-1).expectText, '브레이크 타임으로 바꿀까요?');
  assert.ok(!breakConfirm.steps.some(step => step.name === '브레이크 시작'));
  assert.equal(get('account_delete@my_account').steps.at(-1).expectSelector, 'input[aria-label="탈퇴 확인 문구"]');
  assert.equal(get('sales_close@sales_main').steps.at(-1).expectText, '오늘 장사를 마칠까요?');
  assert.equal(get('hours_break_start@my_hours').steps[1].ensureChecked, true);
  assert.equal(get('fixed_item_add@my_fixed_edit').steps.at(-1).expectSelector, 'input[aria-label="항목 이름"]');
  assert.equal(get('order_vendor@order_direct').path, '/orders/complete?ingredient=id');
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
  assert.equal(destination(orderPopup).path, '/orders/place?openOrder=1');
  assert.deepEqual(destination(orderPopup).steps, []);
  const direct = model.targets.find(t => t.id === 'screen:order_direct');
  assert.equal(destination(direct).path, '/orders/complete');
});
test('미연결 popup은 host 경로만 있다고 연결 완료 취급하지 않음', () => {
  const target = model.targets.find(t => t.id === 'popup:stock_error@stock_change');
  const d = destination(target, { ingredient: 'test-id' });
  assert.equal(d.manual, true); assert.equal(d.steps.length, 0);
});
test('샘플 전용 쓰기 경로는 실제 모드에서 자동으로 열지 않는다', () => {
  for (const id of ['past_save@sales_past','sales_shortage@sales_main','order_price_spike@order_main','tax_saved@my_tax']) {
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
  assert.equal(d.steps.at(-1).name, '입고'); assert.equal(d.steps.at(-1).expectText, '입고 실패');
  const confirm = destination(model.targets.find(t => t.id === 'popup:stock_confirm@stock_change'), { ingredient: 'id' }, false);
  assert.equal(confirm.manual, false); assert.equal(confirm.steps.at(-1).expectText, '재고를 입고할까요?');
  assert.ok(!confirm.steps.some(step => step.name === '입고'));
});
test('대체 화면/인라인은 실제 팝업 직통과 별도 분류한다', () => {
  const alternates = model.targets.filter(t=>destination(t,{ingredient:'id',recipe:'id'},true).displayKind === 'alternate');
  assert.equal(alternates.length,4);
  for (const screen of ['fixed_actual', 'my_fixed_edit']) {
    const month = destination(model.targets.find(t => t.id === `popup:fixed_period@${screen}`), {}, true);
    assert.equal(month.displayKind, 'direct');
    assert.equal(month.path, '/recipes/fixed-cost-edit');
    assert.equal(month.note, null);
  }
  const material = destination(model.targets.find(t => t.id === 'popup:recipe_material_usage@recipe_material_search'), {}, true);
  assert.equal(material.displayKind, 'direct');
  assert.equal(material.path, '/recipes/material-search');
  for (const t of alternates) assert.ok(destination(t,{ingredient:'id',recipe:'id'},true).note);
  const language = destination(model.targets.find(t=>t.id === 'popup:language_preview@my_language'),{},true);
  assert.equal(language.steps[0].expectChecked,true);
  const country = destination(model.targets.find(t=>t.id === 'popup:tax_country@my_tax'),{},true);
  assert.equal(country.steps[0].observeOnly,true);
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
});
