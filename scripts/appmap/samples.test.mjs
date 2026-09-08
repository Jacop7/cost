import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { previewBootstrap } from './server.mjs';
const samples = readFileSync(new URL('./samples.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('./bridge.js', import.meta.url), 'utf8');
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
  assert.equal((await r.json()).options[0].name, '샘플 구매 옵션 1kg');
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
  const res = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/e5_stock_adjusted',{method:'POST'});
  assert.equal(res.status,403); assert.equal(e.calls.length,0);
  assert.ok(e.messages.some(x=>x.sampleApplied === 'blocked:e5_stock_adjusted'));
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
