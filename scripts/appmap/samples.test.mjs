import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { previewBootstrap } from './server.mjs';
const samples = readFileSync(new URL('./samples.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('./bridge.js', import.meta.url), 'utf8');
test('수정 상세 예시는 입력 2개/파생 1개를 제공하고 실제 응답은 보존한다', () => {
  const e = environment('popup:ingredient_change_detail@ingredient_changes');
  const raw = { items: [{ changes: [] }] };
  const data = e.win.appmapPreview.sample('entity_change_history', raw, { p_entity_type: 'ingredient' }, 'popup:ingredient_change_detail@ingredient_changes');
  assert.equal(data.items[0].changes.length, 3);
  assert.equal(data.items[0].changes.filter(c => c.change_kind === 'direct').length, 2);
  assert.equal(data.items[0].changes[1].after / data.items[0].changes[0].after, data.items[0].changes[2].after);
  assert.equal(raw.items[0].changes.length, 0);
  assert.equal(e.win.appmapPreview.sample('entity_change_history', raw, { p_entity_type: 'recipe' }, 'screen:recipe_changes'), undefined);
});
function environment(target, data = {}, loadSamples = true, responseStatus = 200) {
  const calls = [], messages = [];
  const parent = { postMessage: v => messages.push(v) };
  const win = { parent, __APPMAP_SAMPLE_TARGET__: target, fetch: async (...args) => { calls.push(args); return new Response(JSON.stringify(data), { status: responseStatus, headers: { 'content-type': 'application/json' } }); } };
  const ctx = vm.createContext({ window: win, location: { origin: 'http://localhost:8091', href: 'http://localhost:8091/ingredients' }, URL, Request, Response, setInterval: () => 0 });
  if (loadSamples) vm.runInContext(samples, ctx); vm.runInContext(bridge, ctx);
  return { win, calls, messages };
}
test('샘플 옵션이 조회 응답만 대체하고 입력 객체는 변경하지 않음', async () => {
  const raw = { id: 'real-ingredient', name: '대파', options: [] };
  const e = environment('popup:option_edit@options', raw);
  const r = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/ingredient_detail', { method: 'POST', body: '{}' });
  const option = (await r.json()).options[0];
  assert.equal(option.name, '샘플 구매 옵션 1kg');
  const settings = e.win.appmapPreview.sample('settings_lists', { vendors: [{ id: 'real-vendor', name: '실제 구매처' }] }, {}, 'screen:options');
  assert.ok(option.vendor_id);
  assert.equal(settings.vendors.find(v => v.id === option.vendor_id).name, option.vendor_name);
  assert.equal(settings.vendors[0].id, 'real-vendor');
  assert.deepEqual(raw.options, []); assert.equal(e.calls.length, 1);
});
test('샘플 저장·삭제·알 수 없는 RPC와 테이블 쓰기는 네트워크에 전달하지 않음', async () => {
  const e = environment('screen:ingredient_detail');
  for (const [path, method] of [['rpc/save_recipe','POST'], ['rpc/retire_account','POST'], ['rpc/new_unknown','GET'], ['ingredients','PATCH'], ['ingredients','DELETE']]) {
    const r = await e.win.fetch(`http://127.0.0.1:54321/rest/v1/${path}`, { method });
    assert.equal(r.status, 403); assert.equal((await r.json()).code, 'APPMAP_SAMPLE_READ_ONLY');
  }
  assert.equal(e.calls.length, 0); assert.equal(e.messages.length, 5);
});

test('브레이크 확인 URL은 열린 영업일 조회만 예시로 제공하고 상태 변경은 차단한다', async () => {
  const raw = { status: 'none', today: '2026-09-09' };
  const e = environment('popup:sales_break@sales_main', raw);
  const result = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/business_day_state', { method: 'POST', body: '{}' });
  assert.equal((await result.json()).status, 'open');
  assert.equal(raw.status, 'none');
  const write = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/set_business_break', { method: 'POST', body: '{}' });
  assert.equal(write.status, 403);
  assert.equal(e.calls.length, 1);
});
test('실제 데이터 모드는 조회값·쓰기 경로를 바꾸지 않음', async () => {
  const raw = { id: 'real', options: [] }; const e = environment(undefined, raw);
  const r = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/ingredient_detail', { method: 'POST' });
  assert.deepEqual(await r.json(), raw);
  await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/save_recipe', { method: 'POST' });
  assert.equal(e.calls.length, 2);
});
test('빈 옵션 샘플과 매출 합계·행의 일관성', () => {
  const e = environment('sample'); const sample = e.win.appmapPreview.sample;
  assert.equal(sample('ingredient_detail', { id: 'real', options: [{ id: 'old' }] }, {}, 'popup:ingredient_option_empty@ingredient_detail').options.length, 0);
  const r = sample('sales_range', {}, { p_from: '2026-09-09' }, 'popup:sales_revenue_all@revenue');
  assert.equal(r.menu.reduce((n, x) => n+x.revenue, 0), r.summary.revenue);
  assert.equal(r.menu.reduce((n, x) => n+x.qty, 0), r.summary.qty);
  assert.equal(r.channels.reduce((n, x) => n+x.amount, 0), r.summary.revenue);
  assert.ok(r.menu.length > 5);
});
test('일반 sample 변환은 타깃 밖 응답과 DB 계약을 바꾸지 않음', () => {
  const e = environment('sample'); const sample = e.win.appmapPreview.sample;
  assert.equal(sample('app_capabilities', null, {}, 'screen:my_tax'), undefined);
  assert.equal(sample('sales_range', {}, {}, 'screen:ingredient_main'), undefined);
});

test('손익 자세히의 샘플 합계와 식재료·부자재·고정 지출 내역은 같은 데이터를 사용한다', () => {
  const e = environment('screen:day_full'); const sample = e.win.appmapPreview.sample;
  const args = { p_from: '2026-09-09', p_to: '2026-09-09' };
  const r = sample('sales_range', {}, args, 'screen:day_full');
  const day = sample('sales_range', {}, args, 'screen:day');
  assert.deepEqual(r.summary, day.summary);
  for (const [rpc, key] of [['sales_material_usage', 'material_cost'], ['sales_extra_usage', 'extra_material_cost'], ['sales_fixed_breakdown', 'fixed_cost']]) {
    const detail = sample(rpc, {}, args, 'screen:day_full');
    assert.equal(detail.total, r.summary[key]);
    assert.equal(detail.items.reduce((sum, item) => sum + item.amount, 0), detail.total);
  }
  assert.equal(e.win.appmapPreview.expected('screen:day_full').length, 4);
});

test('결과 시나리오 두 개만 네트워크 전송 없이 재현하며 타깃/RPC가 다르면 차단', async () => {
  for (const [target, rpc, body] of [
    ['popup:tax_saved@my_tax','save_store_tax',{p_base_revision:2}],
    ['popup:order_price_spike@order_main','e1_confirm_inbound',{p_order:'test',p_actual_qty:1}],
  ]) {
    const e = environment(target);
    const response = await e.win.fetch(`http://127.0.0.1:54321/rest/v1/rpc/${rpc}`, { method:'POST',body:JSON.stringify(body) });
    assert.equal(response.status,200); assert.equal(e.calls.length,0);
    assert.ok(e.messages.some(x=>x.sampleApplied === 'simulated:'+rpc));
    const other = environment('screen:ingredient_main');
    assert.equal((await other.win.fetch(`http://127.0.0.1:54321/rest/v1/rpc/${rpc}`,{method:'POST'})).status,403);
    assert.equal(other.calls.length,0);
    assert.equal((await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/deactivate_ingredient',{method:'POST'})).status,403);
  }
});
test('404 계약 예시만 명시적으로 대체; 인증 실패/서버 오류/다른 타깃은 그대로', async () => {
  for (const status of [401,403,404,500]) {
    const e = environment('screen:my_language',{error:'test'},true,status);
    const response = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/get_user_preferences',{method:'POST'});
    assert.equal(response.status,status === 404 ? 200 : status);
    assert.equal(e.messages.some(x=>x.missingContract === 'get_user_preferences'),status === 404);
  }
  const other = environment('screen:ingredient_main',{},true,404);
  assert.equal((await other.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/get_user_preferences',{method:'POST'})).status,404);
});
test('저장 전 경고와 오류는 실제 저장 없이 도달하는 데이터 계약', async () => {
  const e = environment('popup:stock_error@stock_change');
  const res = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/quick_inbound',{method:'POST'});
  assert.equal(res.status,403); assert.equal(e.calls.length,0);
  assert.ok(e.messages.some(x=>x.sampleApplied === 'blocked:quick_inbound'));
  const sample = e.win.appmapPreview.sample;
  const past = sample('sales_day',{has_ledger:true,editable:false},{},'popup:past_save@sales_past');
  assert.equal(past.has_ledger,false); assert.equal(past.editable,true);
  const shortage = sample('sale_shortages',{}, {},'popup:sales_shortage@sales_main');
  assert.equal(shortage.has_basis,true); assert.equal(shortage.ingredient_count,1);
  assert.equal(shortage.recipes[0].ingredients[0].need,100);
});
test('samples.js 로드 실패에도 sample flag만으로 쓰기를 차단한다', async () => {
  const e = environment('screen:ingredient_detail', {}, false);
  for (const path of ['rpc/save_recipe', 'rpc/ingredient_detail', 'ingredients']) {
    const r = await e.win.fetch(`http://127.0.0.1:54321/rest/v1/${path}`, { method: 'POST' });
    assert.equal(r.status, 403);
  }
  assert.equal(e.calls.length, 0);
});
test('bridge 자체를 로드하지 않아도 inline bootstrap이 저장 요청을 차단한다', async () => {
  let calls = 0;
  const win = { fetch: async () => { calls++; return new Response('{}'); } };
  const ctx = vm.createContext({ window: win, URL, Response, location: { href: 'http://localhost:8091/ingredients' } });
  vm.runInContext(`(${previewBootstrap.toString()})()`, ctx);
  const r = await win.fetch('http://127.0.0.1:54321/rest/v1/rpc/save_recipe', { method: 'POST' });
  assert.equal(r.status, 403); assert.equal(calls, 0);
});

test('판매가 시뮬레이션은 서버 응답을 보존하는 읽기 RPC이고 저장은 계속 차단한다', async () => {
 const data={status:'ready',input_price:12.34};const e=environment('screen:recipe_price_sim',data);
 const response=await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/recipe_price_simulation',{method:'POST',body:'{}'});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),data);assert.equal(e.calls.length,1);
 const write=await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/save_recipe',{method:'POST',body:'{}'});
 assert.equal(write.status,403);assert.equal(e.calls.length,1);
});

test('초안 계산과 권장가는 서버 응답을 그대로 전달하고 저장은 차단한다', async () => {
 const data={status:'ready',quote:{net_sales:10.91}}; const e=environment('screen:recipe_price_sim',data);
 for(const rpc of ['recipe_draft_preview','recipe_price_recommendation']) {
  const r=await e.win.fetch(`http://127.0.0.1:54321/rest/v1/rpc/${rpc}`,{method:'POST',body:'{}'});
  assert.equal(r.status,200); assert.deepEqual(await r.json(),data);
 }
 assert.equal(e.calls.length,2);
 const r=await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/save_recipe',{method:'POST',body:'{}'});
 assert.equal(r.status,403); assert.equal(e.calls.length,2);
});
