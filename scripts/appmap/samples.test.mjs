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

test('재료 일괄 입고는 선택·서버 미리보기 샘플만 제공하고 저장은 차단한다', async () => {
  const target = 'screen:ingredient_bulk_inbound';
  const e = environment(target, {});
  assert.deepEqual(Array.from(e.win.appmapPreview.expected(target)), ['ingredient_list_v2']);

  const list = await (await e.win.fetch('http://localhost:54321/rest/v1/rpc/ingredient_list_v2', {
    method: 'POST', body: '{}',
  })).json();
  assert.equal(list[0].name, '대파');

  const detail = await (await e.win.fetch('http://localhost:54321/rest/v1/rpc/ingredient_detail', {
    method: 'POST', body: '{}',
  })).json();
  assert.equal(detail.options[0].vendor_name, '샘플 구매처');

  const missingEntity = environment(target, { message: 'not found' }, true, 400);
  const syntheticDetail = await (await missingEntity.win.fetch('http://localhost:54321/rest/v1/rpc/ingredient_detail', {
    method: 'POST', body: '{}',
  })).json();
  assert.equal(syntheticDetail.options[0].vendor_name, '샘플 구매처');
  assert.ok(missingEntity.messages.some(message => message.syntheticRead === true));

  const preview = await (await e.win.fetch('http://localhost:54321/rest/v1/rpc/quick_inbound_batch_preview', {
    method: 'POST', body: JSON.stringify({ p_items: [{ client_item_id: 'card-1', ingredient_id: list[0].id,
      received_quantity: 1000, paid_amount: 4000 }] }),
  })).json();
  assert.equal(preview.items[0].stock_after, 5100);
  assert.equal(preview.items[0].base_price_after, 4);

  const write = await e.win.fetch('http://localhost:54321/rest/v1/rpc/record_current_quick_inbound_batch', {
    method: 'POST', body: '{}',
  });
  assert.equal(write.status, 403);
});
function environment(target, data = {}, loadSamples = true, responseStatus = 200) {
  const calls = [], messages = [];
  const parent = { postMessage: v => messages.push(v) };
  const stored = new Map([['ingredient.inbound.v1.real', 'unresolved-real-inbound'], ['auth-session', 'existing-session']]);
  class Storage {
    getItem(key) { return stored.get(key) ?? null; }
    setItem(key, value) { stored.set(key, String(value)); }
    removeItem(key) { stored.delete(key); }
  }
  const win = { Storage, localStorage: new Storage(), parent, __APPMAP_SAMPLE_TARGET__: target, fetch: async (...args) => { calls.push(args); return new Response(JSON.stringify(data), { status: responseStatus, headers: { 'content-type': 'application/json' } }); } };
  const ctx = vm.createContext({ window: win, location: { origin: 'http://localhost:8091', href: 'http://localhost:8091/ingredients' }, URL, Request, Response, setInterval: () => 0 });
  if (loadSamples) vm.runInContext(samples, ctx); vm.runInContext(bridge, ctx);
  return { win, calls, messages, stored };
}

test('단위 설정 샘플은 1a 수량 단위 두 행을 제공하고 저장은 차단한다', async () => {
  const target = 'screen:my_units';
  const e = environment(target);
  const result = e.win.appmapPreview.sample('get_bundle_units', [], {}, target);
  assert.deepEqual(JSON.parse(JSON.stringify(result.map(({ name, quantity, item_unit_name }) => ({ name, quantity, item_unit_name })))), [
    { name: '박스', quantity: 30, item_unit_name: '개' },
    { name: '판', quantity: 30, item_unit_name: '알' },
  ]);
  const response = await e.win.fetch('http://localhost:54321/rest/v1/rpc/save_bundle_unit', { method: 'POST', body: '{}' });
  assert.equal(response.status, 403);
  assert.equal(e.calls.length, 0);
});

test('세금 설정 샘플은 지역세 2%를 추가해 합계 카드 상태를 재현한다', () => {
  const target = 'screen:my_tax';
  const primaryId = '00000000-0000-4000-8000-000000009949';
  const raw = { tax_profile: {
    components: [{ id: primaryId, config_key: 'primary', kind: 'primary', name: '부가세', rate_pct: 10 }],
    remittance: [{ tax_component_id: primaryId, sales_channel_code: 'hall', remittance_owner: 'merchant' }],
  } };
  const preview = environment(target).win.appmapPreview;
  const result = preview.sample('international_tax_app_state', raw, {}, target);
  const regional = result.tax_profile.components.find(component => component.config_key === 'appmap_regional_tax');
  assert.equal(regional.name, '지역세');
  assert.equal(regional.rate_pct, 2);
  assert.equal(regional.calculation_basis, 'primary_tax_exclusive');
  assert.equal(result.tax_profile.remittance.filter(rule => rule.tax_component_id === regional.id).length, 3);
  assert.equal(raw.tax_profile.components.length, 1);
  assert.deepEqual(Array.from(preview.expected(target)), ['international_tax_app_state']);
});

test('지출 확인 예시는 편집 가능한 영업일만 사용하고 실제 저장은 차단한다', async () => {
  for (const action of ['add', 'delete']) {
    const target = `popup:expense_${action}@expense`;
    const e = environment(target);
    const day = e.win.appmapPreview.sample('sales_day', {}, {}, target);
    assert.equal(day.editable, true);
    assert.equal(day.day_status, 'open');
    await e.win.fetch('http://localhost:54321/rest/v1/rpc/save_sales', { method: 'POST' });
    assert.equal(e.calls.length, 0);
  }
  const e = environment('screen:expense');
  assert.equal(e.win.appmapPreview.sample('sales_day', {}, {}, 'screen:expense').editable, false);
});
test('고정 지출 입력 완료 상태는 3개월 전체 입력과 31.3% 평균을 제공한다', () => {
  const target = 'popup:fixed_complete@fixed_average';
  const preview = environment(target).win.appmapPreview;
  const data = preview.sample('get_fixed_cost_basis', {}, { p_month: '2026-09' }, target);
  assert.equal(data.entered_months, 3);
  assert.equal(data.missing_months.length, 0);
  assert.equal(data.applied, true);
  assert.equal(data.rate, 0.313);
  assert.equal(data.months.length, 3);
  assert.ok(data.months.every(month => month.entered && month.total_fixed === 3756000));
  assert.ok(data.months.every(month => month.items.length === 5 && month.items.every(item => item.lines.length > 0)));
  assert.deepEqual(Object.entries(data.months[0].items.find(item => item.key === 'labor').weights), [['hall', 30], ['delivery', 50], ['takeout', 20]]);
  assert.deepEqual(Array.from(preview.expected(target)), ['get_fixed_cost_basis']);
  const detailTarget = 'screen:fixed_detail_average';
  const channelData = preview.sample('sales_range', {}, { p_from: '2026-06-01', p_to: '2026-08-31' }, detailTarget);
  assert.equal(channelData.channels.reduce((sum, channel) => sum + channel.amount, 0), channelData.summary.revenue);
  assert.deepEqual(Array.from(preview.expected(detailTarget)), []);
});

test('고정 지출 설정의 기준·항목 구성 조회는 샘플 모드에서도 읽기 전용으로 연다', async () => {
  const target = 'screen:fixed_settings';
  const raw = { configured: true, items: [] };
  const e = environment(target, raw);
  const expected = Array.from(e.win.appmapPreview.expected(target));
  assert.deepEqual(expected, ['get_fixed_cost_basis', 'get_fixed_cost_configuration']);
  const basisResponse = await e.win.fetch('http://localhost:54321/rest/v1/rpc/get_fixed_cost_basis', {
    method: 'POST', body: '{}',
  });
  assert.equal((await basisResponse.json()).basis_months, 3);
  const configurationResponse = await e.win.fetch('http://localhost:54321/rest/v1/rpc/get_fixed_cost_configuration', {
    method: 'POST', body: '{}',
  });
  const configuration = await configurationResponse.json();
  assert.equal(configuration.configured, true);
  assert.equal(configuration.items.length, 5);
  assert.equal(e.calls.length, 2);
});

test('설정 수정 내역은 조회를 허용하고 실제 설정 변경은 차단한다', async () => {
  const raw = { items: [], count: 0 };
  const e = environment('screen:my_tax', raw);
  const response = await e.win.fetch('http://localhost:54321/rest/v1/rpc/store_configuration_history', { method: 'POST' });
  assert.deepEqual(await response.json(), raw);
  assert.equal(e.calls.length, 1);
  await e.win.fetch('http://localhost:54321/rest/v1/rpc/save_store_tax', { method: 'POST' });
  assert.equal(e.calls.length, 1);
});

test('고정 지출 수정 내역은 최신 복구 가능 항목과 쓰기 없는 복구 결과를 제공한다', async () => {
  const target = 'screen:my_fixed_history';
  const e = environment(target);
  const preview = e.win.appmapPreview;
  const history = preview.sample('fixed_cost_change_history', {}, {}, target);
  assert.equal(history.items[0].reversible, true);
  assert.equal(history.items[0].affected_months.join(','), '2026-06,2026-07,2026-08');
  const response = await e.win.fetch('http://localhost:54321/rest/v1/rpc/revert_fixed_cost_change', {
    method: 'POST', body: JSON.stringify({ p_change: 9501, p_expected_latest_change: 9501 }),
  });
  assert.equal((await response.json()).reverted, true);
  assert.equal(e.calls.length, 0);
});

test('현재 국제 세금 저장 결과는 샘플 타깃에서만 모의 응답하고 네트워크에 쓰지 않는다', async () => {
  const e = environment('popup:tax_saved@my_tax');
  const response = await e.win.fetch('http://localhost:54321/rest/v1/rpc/save_tax_configuration', { method: 'POST', body: JSON.stringify({ p_tax_revision: 7 }) });
  const result = await response.json();
  assert.equal(result.changed, true);
  assert.equal(result.revision, 8);
  assert.equal(result.application_mode, 'immediate');
  assert.equal(e.calls.length, 0);
  const other = environment('popup:tax_confirm@my_tax');
  const denied = await other.win.fetch('http://localhost:54321/rest/v1/rpc/save_tax_configuration', { method: 'POST', body: '{}' });
  assert.equal(denied.status, 403);
  assert.equal(other.calls.length, 0);
});

test('입고 미리보기는 실제 미확정 요청을 재사용·덮어쓰기·삭제하지 않는다', () => {
  const e = environment('popup:stock_error@stock_change');
  const key = 'ingredient.inbound.v1.real';
  assert.equal(e.win.localStorage.getItem(key), null);
  e.win.localStorage.setItem(key, 'preview-inbound');
  assert.equal(e.win.localStorage.getItem(key), 'preview-inbound');
  assert.equal(e.stored.get(key), 'unresolved-real-inbound');
  e.win.localStorage.removeItem(key);
  assert.equal(e.win.localStorage.getItem(key), null);
  assert.equal(e.stored.get(key), 'unresolved-real-inbound');
  assert.equal(e.win.localStorage.getItem('auth-session'), 'existing-session');
  const real = environment(undefined);
  assert.equal(real.win.localStorage.getItem(key), 'unresolved-real-inbound');
  real.win.localStorage.setItem(key, 'real-request');
  assert.equal(real.stored.get(key), 'real-request');
});

test('재고 취소 확인 예시는 같은 샘플 원장만 연결하고 실제 취소는 차단한다', async () => {
  const target = 'popup:stock_event_revert@stock';
  const e = environment(target);
  const sample = e.win.appmapPreview.sample;
  const row = sample('stock_history', [], { p_to: '2026-09-14' }, target)[0];
  const candidate = sample('stock_revert_candidates', [], {}, target)[0];
  assert.equal(row.id, candidate.event_id);
  assert.equal(row.balance, sample('ingredient_detail', { id: 'real' }, {}, target).stock_total);
  assert.equal(sample('stock_history', [], {}, 'screen:stock'), undefined);
  const result = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/revert_latest_stock_event', { method: 'POST' });
  assert.equal(result.status, 403);
  assert.equal(e.calls.length, 0);
});

test('발주 입고와 차감·폐기·일괄 입고 미리보기도 실제 확인 키를 격리한다', () => {
  for (const prefix of ['order.inbound.v1.', 'ingredient.stock.v1.', 'ingredient.bulk-inbound.v1.']) {
    const key = prefix + 'real';
    const e = environment('screen:orders');
    e.stored.set(key, 'real-pending-request');
    assert.equal(e.win.localStorage.getItem(key), null, prefix + ' 실제 키를 읽으면 안 됨');
    e.win.localStorage.setItem(key, 'preview-request');
    assert.equal(e.win.localStorage.getItem(key), 'preview-request');
    e.win.localStorage.removeItem(key);
    assert.equal(e.win.localStorage.getItem(key), null);
    assert.equal(e.stored.get(key), 'real-pending-request');
    const real = environment(undefined);
    real.stored.set(key, 'real-pending-request');
    assert.equal(real.win.localStorage.getItem(key), 'real-pending-request');
    real.win.localStorage.removeItem(key);
    assert.equal(real.stored.has(key), false);
  }
});
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

test('실제 데이터 모드는 조회값·쓰기 경로를 바꾸지 않음', async () => {
  const raw = { id: 'real', options: [] }; const e = environment(undefined, raw);
  const r = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/ingredient_detail', { method: 'POST' });
  assert.deepEqual(await r.json(), raw);
  await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/save_recipe', { method: 'POST' });
  assert.equal(e.calls.length, 2);
});
test('매출관리 샘플은 작성 화면을 메모리 초안으로 열고 실제 변경은 계속 차단한다', async () => {
  const target = 'screen:sales_main';
  const e = environment(target);
  assert.deepEqual(Array.from(e.win.appmapPreview.expected(target)), [
    'sales_feed', 'simulated:sales_inventory_count_requirement',
  ]);

  const feedResponse = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/sales_feed', {
    method: 'POST',
    body: JSON.stringify({ p_from: '2026-09-01', p_to: '2026-09-16' }),
  });
  const feed = await feedResponse.json();
  assert.equal(feed.from, '2026-09-01');
  assert.equal(feed.to, '2026-09-16');
  assert.equal(feed.items.length, 4);
  assert.deepEqual(feed.counts, { missing: 1, editing: 1, completed: 1, closed: 1 });

  const inventoryResponse = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/sales_inventory_count_requirement', {
    method: 'POST', body: '{}',
  });
  assert.equal((await inventoryResponse.json()).required, false);
  assert.equal(e.calls.length, 1);

  const denied = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/set_sales_calendar_day', {
    method: 'POST', body: '{}',
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'APPMAP_SAMPLE_READ_ONLY');
  assert.equal(e.calls.length, 1);

  const draftId = '97000000-0000-4000-8000-000000000999';
  const opened = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/open_sales_draft', {
    method: 'POST', body: JSON.stringify({ p_date: '2026-09-16', p_draft_id: draftId }),
  });
  assert.equal(opened.status, 200);
  const draft = await opened.json();
  assert.equal(draft.draft_id, draftId);
  assert.equal(draft.business_date, '2026-09-16');
  assert.equal(draft.status, 'editing');
  assert.equal(draft.payload.items.length, 6);
  assert.deepEqual(draft.payload.etc_items.map(item => [item.name, item.channel, item.qty, item.price * item.qty]), [
    ['음료(캔)', 'hall', 7, 14000],
    ['소주·맥주', 'hall', 3, 15000],
  ]);
  assert.equal(draft.payload.extra_items[0].amount, 15000);
  assert.equal(e.calls.length, 1);

  const detail = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/sales_draft_detail', {
    method: 'POST', body: JSON.stringify({ p_draft: draftId }),
  });
  assert.equal((await detail.json()).draft_id, draftId);
  assert.equal(e.calls.length, 1);

  const save = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/save_sales_draft', {
    method: 'POST', body: '{}',
  });
  assert.equal(save.status, 403);
  assert.equal((await save.json()).code, 'APPMAP_SAMPLE_READ_ONLY');
  assert.equal(e.calls.length, 1);
});
test('매출 읽기 권위 RPC는 샘플 모드에서 차단하지 않고 같은 합계를 제공한다', async () => {
  const target = 'screen:day';
  const e = environment(target);
  const args = { p_from: '2026-09-15', p_to: '2026-09-15', p_date: '2026-09-15' };
  const expected = Array.from(e.win.appmapPreview.expected(target));
  assert.deepEqual(expected, ['sales_range', 'sales_authoritative_range_detail', 'sales_day', 'sales_day_read']);

  const dayResponse = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/sales_day_read', {
    method: 'POST', body: JSON.stringify(args),
  });
  const day = await dayResponse.json();
  assert.equal(day.status, 'completed');
  assert.equal(day.version.summary.revenue, 600000);
  assert.equal(day.version.ledger_revision, 1);

  const rangeResponse = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/sales_authoritative_range_detail', {
    method: 'POST', body: JSON.stringify(args),
  });
  const range = await rangeResponse.json();
  assert.equal(range.menu.reduce((sum, item) => sum + item.revenue, 0), 600000);
  assert.equal(range.channels.reduce((sum, item) => sum + item.amount, 0), 600000);
  assert.equal(e.calls.length, 2);
});

test('매출관리 하위 팝업도 읽기 조회와 메모리 초안을 공유한다', async () => {
  const target = 'popup:sales_qty@sales_main';
  const e = environment(target);
  const inventory = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/sales_inventory_count_requirement', {
    method: 'POST', body: '{}',
  });
  assert.equal((await inventory.json()).required, false);
  const opened = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/open_sales_draft', {
    method: 'POST', body: JSON.stringify({ p_date: '2026-09-16' }),
  });
  assert.equal(opened.status, 200);
  assert.equal((await opened.json()).status, 'editing');
  assert.equal(e.calls.length, 0);
});

test('매출 목록 필터 팝업은 목록과 같은 작성 상태 샘플을 유지한다', () => {
  for (const popup of ['sales_sort', 'sales_status', 'sales_calendar']) {
    const target = `popup:${popup}@sales_main`;
    const e = environment(target);
    assert.deepEqual(Array.from(e.win.appmapPreview.expected(target)), [
      'sales_feed', 'simulated:sales_inventory_count_requirement',
    ]);
    const feed = e.win.appmapPreview.sample('sales_feed', {}, { p_to: '2026-09-18' }, target);
    assert.equal(JSON.stringify(feed.counts), JSON.stringify({ missing: 1, editing: 1, completed: 1, closed: 1 }));
    assert.equal(feed.items.length, 4);
    assert.equal(e.calls.length, 0);
  }
});

test('과거 매출 작성 화면도 서버 저장 없이 메모리 초안을 연다', async () => {
  const target = 'screen:sales_past';
  const e = environment(target);
  assert.deepEqual(Array.from(e.win.appmapPreview.expected(target)), [
    'simulated:open_sales_draft', 'simulated:sales_draft_detail',
  ]);
  const opened = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/open_sales_draft', {
    method: 'POST', body: JSON.stringify({ p_date: '2026-09-15' }),
  });
  const draft = await opened.json();
  assert.equal(opened.status, 200);
  assert.equal(draft.business_date, '2026-09-15');
  const detail = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/sales_draft_detail', {
    method: 'POST', body: JSON.stringify({ p_draft: draft.draft_id, p_date: '2026-09-15' }),
  });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).draft_id, draft.draft_id);
  assert.equal(e.calls.length, 0);
});
test('현재 매출 작성 화면도 서버 저장 없이 메모리 초안을 연다', async () => {
  const target = 'screen:sales_write';
  const e = environment(target);
  assert.deepEqual(Array.from(e.win.appmapPreview.expected(target)), [
    'simulated:open_sales_draft', 'simulated:sales_draft_detail',
  ]);
  const opened = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/open_sales_draft', {
    method: 'POST', body: JSON.stringify({ p_date: '2026-09-17' }),
  });
  const draft = await opened.json();
  assert.equal(opened.status, 200);
  assert.equal(draft.business_date, '2026-09-17');
  assert.equal(draft.payload.items.length, 6);
  const recipes = e.win.appmapPreview.sample('recipe_list', [], {}, target);
  assert.deepEqual([...new Set(recipes.map(item => item.category_name))], ['볶음·구이', '찌개·전골', '사이드', '밥·면']);
  assert.equal(e.calls.length, 0);
});

test('매출 작성 하위 팝업도 같은 메모리 초안과 메뉴 카테고리를 사용한다', async () => {
  const target = 'popup:sales_preview@sales_write';
  const e = environment(target);
  assert.deepEqual(Array.from(e.win.appmapPreview.expected(target)), [
    'simulated:open_sales_draft', 'simulated:sales_draft_detail',
  ]);
  const opened = await e.win.fetch('http://127.0.0.1:54321/rest/v1/rpc/open_sales_draft', {
    method: 'POST', body: JSON.stringify({ p_date: '2026-09-18' }),
  });
  const draft = await opened.json();
  assert.equal(draft.business_date, '2026-09-18');
  const rows = e.win.appmapPreview.sample('recipe_list', [], {}, target);
  assert.equal(rows[0].category_name, '볶음·구이');
  assert.equal(e.calls.length, 0);
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

test('손익 자세히의 샘플 합계와 재료·부자재·고정 지출 내역은 같은 데이터를 사용한다', () => {
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
  assert.equal(e.win.appmapPreview.expected('screen:day_full').length, 5);
});

test('세금 저장 결과 시나리오만 네트워크 전송 없이 재현하며 타깃/RPC가 다르면 차단', async () => {
  for (const [target, rpc, body] of [
    ['popup:tax_saved@my_tax','save_store_tax',{p_base_revision:2}],
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

test('발주 구매처 미선택 예시는 선택 가능한 두 옵션을 제공하고 발주 저장은 차단한다', async () => {
  const target = 'popup:order_order_unselected@order_main';
  const raw = { id: 'existing-ingredient', name: '고춧가루', options: [] };
  const e = environment(target, raw);
  const preview = e.win.appmapPreview;
  const result = preview.sample('ingredient_detail', raw, {}, target);
  assert.equal(result.id, raw.id);
  assert.equal(result.options.length, 2);
  assert.ok(result.options.every(option => option.url.startsWith('https://example.com/') && option.volume > 0));
  assert.equal(raw.options.length, 0);
  assert.deepEqual(Array.from(preview.expected(target)), ['ingredient_detail']);
  const response = await e.win.fetch('http://localhost:54321/rest/v1/rpc/e7_place_order', { method: 'POST', body: '{}' });
  assert.equal(response.status, 403);
  assert.equal(e.calls.length, 0);
});

test('재고 수정 샘플은 서버 날짜·발생시점 조회를 통과시키고 입고 저장은 차단한다', async () => {
  const target = 'screen:stock_change';
  for (const rpc of ['sales_lifecycle_clock', 'inventory_event_occurrence_context', 'inventory_event_local_timestamp']) {
    const raw = { server_now: '2026-09-16T05:00:00Z', requires_confirmation: true, timezone: 'Asia/Seoul' };
    const e = environment(target, raw);
    const result = await e.win.fetch(`http://localhost:54321/rest/v1/rpc/${rpc}`, { method: 'POST', body: '{}' });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), raw);
    assert.equal(e.calls.length, 1);
  }
  for (const rpc of ['record_current_quick_inbound', 'record_delayed_quick_inbound', 'record_current_inbound', 'record_delayed_inbound', 'quick_inbound']) {
    const e = environment(target);
    const result = await e.win.fetch(`http://localhost:54321/rest/v1/rpc/${rpc}`, { method: 'POST', body: '{}' });
    assert.equal(result.status, 403);
    assert.equal(e.calls.length, 0);
  }
});

test('재고 발생시점 API가 없는 샘플 화면만 404 예시로 열고 실제 오류는 보존한다', async () => {
  const url = 'http://localhost:54321/rest/v1/rpc/inventory_event_occurrence_context';
  for (const target of ['screen:stock_change', 'popup:stock_inbound@stock_change']) {
    const e = environment(target, {}, true, 404);
    const result = await e.win.fetch(url, { method: 'POST', body: '{}' });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).requires_confirmation, false);
    assert.ok(e.messages.some(m => m.missingContract === 'inventory_event_occurrence_context'));
  }
  for (const status of [401, 403, 500]) {
    const e = environment('screen:stock_change', {}, true, status);
    const result = await e.win.fetch(url, { method: 'POST', body: '{}' });
    assert.equal(result.status, status);
  }
  assert.equal(environment('screen:ingredient_main').win.appmapPreview.missingContract('inventory_event_occurrence_context', 'screen:ingredient_main'), undefined);
});
