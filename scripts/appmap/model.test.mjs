import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, readNavigation, prototypePath } from './model.mjs';
import { destination, navRows, adapterKeys } from './navigation.mjs';
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
    assert.deepEqual(rows.popups, model.popupTabs[screen] ?? []);
    const edit = screen === 'ingredient_edit_menu' || model.ingredientEditScreens.includes(screen);
    assert.deepEqual(rows.sub, edit ? model.ingredientEditScreens : []);
    if (rows.domain !== 'ingredient') assert.deepEqual(rows.primary, model.domains[rows.domain].screens);
  }
});
test('모든 popup 어댑터 키는 실제 원본 target에 존재', () => {
  const ids = new Set(model.targets.map(t => t.id));
  for (const key of adapterKeys()) assert.ok(ids.has(key), key);
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
  assert.equal(destination(order).needsEntity, 'ingredient');
  assert.equal(destination(order, { ingredient: 'test-id' }).path, '/orders/complete?ingredient=test-id');
  const direct = model.targets.find(t => t.id === 'screen:order_direct');
  assert.equal(destination(direct).path, '/orders/complete');
});
test('미연결 popup은 host 경로만 있다고 연결 완료 취급하지 않음', () => {
  const target = model.targets.find(t => t.id === 'popup:stock_error@stock_change');
  const d = destination(target, { ingredient: 'test-id' });
  assert.equal(d.manual, true); assert.equal(d.steps.length, 0);
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
