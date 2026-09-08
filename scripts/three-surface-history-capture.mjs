import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Real Expo hosts, synthetic history responses. No save/delete RPC is dispatched.
// This is web evidence, not native/keyboard proof or a server correctness test.
const args = new Map(process.argv.slice(2).map((s) => { const [k, ...v] = s.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit'), output = args.get('--output');
if (!/^[a-f0-9]{40}$/.test(expected ?? '') || !output) throw Error('Exact commit and new output required');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
function clean() { if (git('rev-parse', 'HEAD') !== expected || git('status', '--porcelain', '--untracked-files=no')) throw Error('Exact clean tracked HEAD required'); }
clean();
const dir = resolve(output), base = args.get('--base-url') ?? 'http://127.0.0.1:8091';
if (existsSync(dir)) throw Error('Preserve existing output');
mkdirSync(dir, { recursive: true });
const hash = (v) => createHash('sha256').update(v).digest('hex');
const today = '2026-09-08';
const rowStress = args.has('--row-stress');
const stock = [
  ['2026-09-08', 'discard', -100, '검수 조리 전', false, 1700],
  ['2026-09-07', 'discard', -200, '검수 조리 후', true, 1800],
  ['2026-09-06', 'inbound', 1000, '검수 최근 입고 기록', false, 2000],
  ['2026-08-20', 'inbound', 1000, '검수 이전 입고 기록', false, 1000],
  ['2026-06-01', 'consume', -50, '검수 옛 소진', false, 0],
].map(([occurred_on, type, count_delta, note, waste, balance], i) => ({
  id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`, occurred_on, type, count_delta, note, waste, balance, reverted: false, volume_delta: count_delta,
}));
const purchases = ['2026-09-08', '2026-08-20', '2026-06-01'].map((ordered_at, i) => ({
  id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`, ordered_at, expected_at: ordered_at,
  status: ['partial', 'received', 'canceled'][i], vendor_name: ['검수 오늘 구매처', '검수 지난 구매처', '검수 옛 구매처'][i],
  volume: 1000, amount: 4000, qty: 2, received_qty: i === 0 ? 1 : i === 1 ? 2 : 0, unit_price: 4,
}));
if (rowStress) {
  // Opposing width pressures: long identity/short values, short identity/long values.
  stock[0].note = '검수 국내산 손질 식재료 보관 상태 확인 후 조리 전 폐기 기록 끝';
  stock[0].balance = -750;
  stock[1].note = '짧은 기록'; stock[1].count_delta = -987654321; stock[1].balance = -987654321;
  stock[2].note = '검수 공급처 변경과 대용량 포장 입고 수량 확인 기록 끝';
  purchases[0].vendor_name = '검수 전국 식자재 공동구매 배송센터 서울 동부 지점 끝';
  purchases[1].vendor_name = '짧은 구매처'; purchases[1].unit_price = 12345678.9;
}
const readRpcs = new Set(['settings_lists', 'ingredient_list', 'ingredient_detail', 'stock_history', 'purchase_history', 'business_day_state', 'get_settings', 'operating_hours_status']);
const rows = [], blocked = [], errors = [], requests = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR' });
context.setDefaultTimeout(20000);
let active = false, key = 'lookup';
await context.route('**/*', async (route) => {
  const req = route.request(), url = new URL(req.url()), rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method());
  if ((rpc && (!readRpcs.has(rpc) || !['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method()))) || (write && !rpc && !(url.pathname === '/auth/v1/token' && req.method() === 'POST'))) {
    blocked.push({ key, path: url.pathname, method: req.method() }); return route.abort();
  }
  if (active && ['stock_history', 'purchase_history'].includes(rpc)) {
    const p = req.method() === 'POST' ? req.postDataJSON() : Object.fromEntries(url.searchParams);
    const all = rpc === 'stock_history' ? stock : purchases, field = rpc === 'stock_history' ? 'occurred_on' : 'ordered_at';
    const filtered = all.filter((r) => (!p.p_from || r[field] >= p.p_from) && (!p.p_to || r[field] <= p.p_to));
    requests.push({ key, rpc, from: p.p_from ?? null, to: p.p_to ?? null, returnedIds: filtered.map((r) => r.id) });
    return route.fulfill({ json: filtered });
  }
  if (active && ['business_day_state', 'ingredient_detail'].includes(rpc)) {
    const response = await route.fetch();
    if (!response.ok()) throw Error(`Read prerequisite ${rpc} ${response.status()}`);
    const data = await response.json();
    if (!data || Array.isArray(data)) throw Error(`Unexpected ${rpc} shape`);
    return route.fulfill({ response, json: rpc === 'business_day_state' ? { ...data, local_date: today } : { ...data, options: [], memo: null } });
  }
  return route.continue();
});
const modal = (page) => page.locator('[aria-modal="true"]');
const choice = (page, text) => modal(page).getByRole('button', { name: new RegExp(`^${text}(?:, 현재 선택됨)?$`) });
async function settle(page) {
  await page.waitForFunction(() => document.querySelectorAll('[aria-modal="true"]').length === 1);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {}))); });
}
async function enlarge(page, factor) {
  const result = await page.evaluate(async (factor) => {
    const weights = [400, 500, 600, 700, 800];
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px PretendardApp`, '식재료 0123456789')));
    const values = [...document.querySelectorAll('*')].map((el) => ({ el, fs: parseFloat(getComputedStyle(el).fontSize), lh: parseFloat(getComputedStyle(el).lineHeight) }));
    if (factor === 2) for (const { el, fs, lh } of values) {
      if (Number.isFinite(fs)) el.style.setProperty('font-size', `${fs * 2}px`, 'important');
      if (Number.isFinite(lh)) el.style.setProperty('line-height', `${lh * 2}px`, 'important');
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { factor, fonts: weights.map((w) => ({ weight: w, loaded: document.fonts.check(`${w} 16px PretendardApp`) })), mismatches: values.filter(({ el, fs, lh }) => {
      const s = getComputedStyle(el), actual = parseFloat(s.fontSize), line = parseFloat(s.lineHeight);
      return !el.isConnected || !Number.isFinite(fs) || !Number.isFinite(actual) || Math.abs(actual - fs * factor) > .05
        || (Number.isFinite(lh) && (!Number.isFinite(line) || Math.abs(line - lh * factor) > .05));
    }).length };
  }, factor);
  if (result.mismatches || result.fonts.some((f) => !f.loaded)) throw Error('Font/scaling assertion failed');
  return result;
}
async function shot(page, name) {
  const state = await page.evaluate(() => {
    const root = document.querySelector('[aria-modal="true"]') ?? document.body;
    const rect = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    return { documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      controls: [...root.querySelectorAll('[role="button"]')].map((el) => ({ label: el.getAttribute('aria-label'), text: el.textContent, selected: el.getAttribute('aria-selected'), box: rect(el.getBoundingClientRect()) })),
      text: [...root.querySelectorAll('*')].filter((el) => !el.children.length && el.textContent?.trim()).map((el) => ({ text: el.textContent, fontSize: getComputedStyle(el).fontSize, fontWeight: getComputedStyle(el).fontWeight, color: getComputedStyle(el).color, box: rect(el.getBoundingClientRect()) })) };
  });
  const file = `${key}-${name}.png`, png = await page.screenshot({ fullPage: true });
  writeFileSync(resolve(dir, file), png, { flag: 'wx' }); return { file, sha256: hash(png), ...state };
}
async function close(page) { await modal(page).getByRole('button', { name: '닫기', exact: true }).first().click({ position: { x: 4, y: 4 } }); await modal(page).waitFor({ state: 'hidden' }); }
async function open(page) { await page.getByRole('button', { name: /^최근 3개월/ }).click(); await settle(page); }
async function select(page, host) {
  await choice(page, host === 'history' ? '최근 1개월' : '오늘').click();
  if (host === 'history') { await choice(page, '입고').click(); await choice(page, '오래된순').click(); }
}
try {
  const lookup = await context.newPage(); await lookup.goto(`${base}/ingredients`, { waitUntil: 'networkidle' });
  await lookup.getByRole('button').filter({ hasText: '대파' }).first().click(); await lookup.waitForURL(/\/ingredients\/[a-f0-9-]{36}$/);
  const id = new URL(lookup.url()).pathname.split('/').pop(); await lookup.close(); active = true;
  for (const host of rowStress ? ['detail', 'history', 'purchases', 'discards'] : ['history', 'purchases', 'discards']) for (const [width, height, factor] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
    key = `${host}-${width}-text${factor}`;
    const page = await context.newPage(); await page.setViewportSize({ width, height });
    page.on('pageerror', (e) => errors.push({ key, type: 'pageerror', message: e.message }));
    page.on('console', (e) => { if (e.type() === 'error') errors.push({ key, type: 'console', message: e.text() }); });
    const url = host === 'detail' ? `${base}/ingredients/${id}` : `${base}/ingredients/${host}/${id}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    if (rowStress) {
      const labels = host === 'purchases' ? purchases.slice(0, 2).map((r) => r.vendor_name)
        : stock.slice(0, host === 'detail' ? 3 : host === 'history' ? 4 : 2).map((r) => r.note);
      // Detail also repeats discard notes in LossCard. Scope to the ledger Card
      // via its actual footer action, not an arbitrary first matching note.
      const scope = host === 'detail' ? page.getByRole('button', { name: '재고 변동 내역 전체 보기', exact: true }).locator('..') : page;
      for (const label of labels) await scope.getByText(label, { exact: true }).waitFor();
      const listScaling = await enlarge(page, factor), shots = [];
      for (let index = 0; index < labels.length; index++) {
        const label = scope.getByText(labels[index], { exact: true });
        const root = label.locator('..').locator('..');
        // Scroll the row's textual endpoints independently. An ellipsized tail may
        // remain inaccessible; preserve that diagnostic instead of claiming full text.
        for (const edge of ['start', 'end']) {
          const endpoint = await root.evaluate((el, edge) => {
            const nodes = [...el.querySelectorAll('*')].filter((n) => !n.children.length && n.textContent?.trim());
            const node = edge === 'start' ? nodes[0] : nodes.at(-1);
            if (!node) throw Error('Missing row endpoint');
            node.scrollIntoView({ block: edge });
            const r = node.getBoundingClientRect(); let top = 0, bottom = innerHeight;
            for (let p = node.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflowY !== 'visible') {
              const b = p.getBoundingClientRect(); top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom);
            }
            return { text: node.textContent, visible: r.top >= top - 1 && r.bottom <= bottom + 1 };
          }, edge);
          const geometry = await root.evaluate((el) => {
            const box = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
            return { box: box(el.getBoundingClientRect()), leaves: [...el.querySelectorAll('*')]
              .filter((n) => !n.children.length && n.textContent?.trim()).map((n) => {
                const b = n.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(n); const ink = range.getBoundingClientRect();
                return { text: n.textContent, fontSize: getComputedStyle(n).fontSize, fontWeight: getComputedStyle(n).fontWeight,
                  color: getComputedStyle(n).color, box: box(b), ink: box(ink), horizontalFits: ink.left >= Math.max(0, b.left) - 1 && ink.right <= Math.min(innerWidth, b.right) + 1 };
              }) };
          });
          shots.push({ rowIndex: index, edge, endpoint, row: geometry, ...await shot(page, `row${index}-${edge}`) });
        }
      }
      rows.push({ key, host, width, height, listScaling, shots, submittedDomainWrite: false });
      await page.close(); continue;
    }
    await open(page);
    const requestCount = requests.length; await select(page, host);
    if (requests.length !== requestCount) throw Error('Draft sent a query before apply');
    await close(page); await open(page);
    // The date summary is visible even on RNW versions that omit aria-selected.
    await modal(page).getByText('2026.06.10', { exact: true }).waitFor();
    await select(page, host);
    await modal(page).getByRole('button', { name: host === 'history' ? '조회' : '적용', exact: true }).click(); await modal(page).waitFor({ state: 'hidden' });
    const expectedFrom = host === 'history' ? '2026-08-09' : today;
    await page.waitForFunction(() => !document.querySelector('[role="progressbar"]'));
    // Ledger strips a trailing event label from note. Fixtures deliberately end in
    // '기록', so exact visible note assertions do not confuse that formatter with data loss.
    const want = host === 'history' ? ['검수 이전 입고 기록', '검수 최근 입고 기록'] : host === 'purchases' ? ['검수 오늘 구매처'] : ['검수 조리 전'];
    for (const label of want) await page.getByText(label, { exact: true }).waitFor();
    const listText = await page.locator('body').innerText();
    const excluded = host === 'history' ? ['검수 조리 전', '검수 조리 후', '검수 옛 소진'] : host === 'purchases' ? ['검수 지난 구매처', '검수 옛 구매처'] : ['검수 조리 후'];
    if (excluded.some((s) => listText.includes(s)) || (host === 'history' && listText.indexOf(want[0]) > listText.indexOf(want[1]))) throw Error('Filter/order result mismatch');
    const query = requests.filter((r) => r.key === key).at(-1);
    if (query?.from !== expectedFrom || query?.to !== today) throw Error('Applied query range mismatch');
    const listScaling = await enlarge(page, factor), shots = [await shot(page, 'applied-list')];
    // Fresh document: never scale inherited values twice after React creates a new modal.
    await page.goto(url, { waitUntil: 'networkidle' }); await open(page); await select(page, host);
    const sheetScaling = await enlarge(page, factor);
    await choice(page, '오늘').scrollIntoViewIfNeeded(); shots.push(await shot(page, 'sheet-start'));
    await choice(page, host === 'history' ? '오래된순' : '전체').scrollIntoViewIfNeeded(); shots.push(await shot(page, 'sheet-end'));
    const footer = modal(page).getByRole('button', { name: host === 'history' ? '조회' : '적용', exact: true });
    const box = await footer.boundingBox();
    if (!box || box.x < -1 || box.y < -1 || box.x + box.width > width + 1 || box.y + box.height > height + 1) throw Error('Footer outside viewport');
    rows.push({ key, host, width, height, listScaling, sheetScaling, checks: { draftDoesNotQuery: true, cancelRestoresDefaultRange: true, expectedFrom, expectedTo: today, appliedQuery: query, included: want, excluded, oldestFirst: host === 'history' ? true : null, submittedDomainWrite: false }, footer: box, shots });
    await page.close();
  }
  clean();
  const evidence = { sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))), browserVersion: browser.version(), fixtures: { localDate: today, stock, purchases }, rowStress,
    scope: rowStress ? 'Real ING03/07/09/10 row diagnostics, synthetic long identities/large values over live read-only surrounding data. Endpoints and Range geometry recorded, not exhaustive clipping/occlusion proof. No domain writes or native/keyboard/full UI approval. Served source requires operator restart.' : 'Real ING07/08/09/10 web hosts. Synthetic stock/purchase responses filtered by captured query dates; local_date substituted, other surrounding read data live. No domain writes. Draft/cancel/apply/query/order checks run unscaled, then separately rendered list and sheet use 100/200% font+explicit-line-height approximation. Not native, keyboard, server correctness, arbitrary long text or full visual pass. Served source requires operator restart.', rows, requests, errors, blocked };
  writeFileSync(resolve(dir, 'history-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ rows: rows.length, shots: rows.reduce((n, r) => n + r.shots.length, 0), errors, blocked, output: dir }));
  if (errors.length || blocked.length) process.exitCode = 1;
} catch (error) {
  writeFileSync(resolve(dir, 'history-failed.json'), `${JSON.stringify({ sourceCommit: expected, message: String(error), rows, requests, errors, blocked }, null, 2)}\n`, { flag: 'wx' });
  console.error(String(error)); process.exitCode = 1;
} finally { await browser.close(); }
