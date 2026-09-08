import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Actual Expo host with substituted read responses, never a real inbound/vendor write.
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
const options = [
  { id: '33333333-3333-4333-8333-000000000001', name: '검수 국내산 손질 대파 대용량 포장 옵션', vendor_name: '검수 공동구매 배송센터 동부 지점', vendor_id: '44444444-4444-4444-8444-000000000001', volume: 1000, amount: 4000 },
  { id: '33333333-3333-4333-8333-000000000002', name: '검수 두 번째 옵션', vendor_name: '검수 구매처', vendor_id: '44444444-4444-4444-8444-000000000002', volume: 2000, amount: 8000 },
];
const fixtures = { localDate: '2026-09-08', stockBefore: -1750, options };
const reads = new Set(['settings_lists', 'ingredient_list', 'ingredient_detail', 'stock_history', 'purchase_history', 'business_day_state', 'get_settings', 'operating_hours_status', 'quick_inbound_preview']);
const rows = [], errors = [], blocked = [], previews = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR' });
context.setDefaultTimeout(20000);
let key = 'lookup', active = false;
await context.route('**/*', async (route) => {
  const req = route.request(), url = new URL(req.url()), rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if ((rpc && (!reads.has(rpc) || !['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method())))
    || (!rpc && !['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && !(url.pathname === '/auth/v1/token' && req.method() === 'POST'))) {
    blocked.push({ key, path: url.pathname, method: req.method() }); return route.abort();
  }
  if (active && rpc === 'quick_inbound_preview') {
    const p = req.method() === 'POST' ? req.postDataJSON() : Object.fromEntries(url.searchParams);
    // Synthetic shape/render fixture only: no claim of RPC/ledger arithmetic validation.
    const added = Number(p.p_volume) * Number(p.p_qty), paid = Number(p.p_amount) * Number(p.p_qty);
    const response = { stock_before: -1750, stock_after: -1750 + added, added, paid,
      inbound_unit_price: 4, base_price_before: 3.75, base_price_after: 4.25, affected_recipes: 3 };
    previews.push({ key, volume: p.p_volume, amount: p.p_amount, qty: p.p_qty, response });
    return route.fulfill({ json: response });
  }
  if (active && ['ingredient_detail', 'business_day_state'].includes(rpc)) {
    const response = await route.fetch();
    if (!response.ok()) throw Error(`Read prerequisite ${rpc}: ${response.status()}`);
    const data = await response.json();
    if (!data || Array.isArray(data)) throw Error(`Unexpected ${rpc} shape`);
    return route.fulfill({ response, json: rpc === 'business_day_state'
      ? { ...data, local_date: fixtures.localDate }
      : { ...data, stock_total: fixtures.stockBefore, base_price: 3.75, options } });
  }
  return route.continue();
});
async function scale(page, factor) {
  return page.evaluate(async (factor) => {
    const weights = [400, 500, 600, 700, 800];
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px PretendardApp`, '식재료 0123456789')));
    const baseline = [...document.querySelectorAll('*')].map((el) => ({ el, size: parseFloat(getComputedStyle(el).fontSize), line: parseFloat(getComputedStyle(el).lineHeight) }));
    if (factor === 2) for (const { el, size, line } of baseline) {
      if (Number.isFinite(size)) el.style.setProperty('font-size', `${size * factor}px`, 'important');
      if (Number.isFinite(line)) el.style.setProperty('line-height', `${line * factor}px`, 'important');
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const result = { factor, fontFailures: weights.filter((w) => !document.fonts.check(`${w} 16px PretendardApp`)), mismatches: baseline.filter(({ el, size, line }) => {
      const s = getComputedStyle(el), actual = parseFloat(s.fontSize), actualLine = parseFloat(s.lineHeight);
      return !el.isConnected || !Number.isFinite(size) || !Number.isFinite(actual) || Math.abs(actual - size * factor) > .05
        || (Number.isFinite(line) && (!Number.isFinite(actualLine) || Math.abs(actualLine - line * factor) > .05));
    }).length };
    return result;
  }, factor);
}
async function shot(page, name) {
  const measurements = await page.evaluate(() => {
    const root = document.querySelector('[aria-modal="true"]') ?? document.body;
    const box = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    // Direct text nodes include parent numeric prefixes, unlike leaf-only collection.
    const text = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim() || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) continue;
      const el = node.parentElement, range = document.createRange(); range.selectNode(node);
      const s = getComputedStyle(el);
      text.push({ text: node.textContent, fontSize: s.fontSize, fontWeight: s.fontWeight, color: s.color,
        box: box(el.getBoundingClientRect()), ink: box(range.getBoundingClientRect()) });
    }
    return { documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), text,
      controls: [...root.querySelectorAll('[role="button"],input')].map((el) => ({ label: el.getAttribute('aria-label'), text: el.textContent, value: el.value ?? null, selected: el.getAttribute('aria-selected'), disabled: el.getAttribute('aria-disabled'), box: box(el.getBoundingClientRect()) })) };
  });
  const file = `${key}-${name}.png`, png = await page.screenshot({ fullPage: true });
  writeFileSync(resolve(dir, file), png, { flag: 'wx' });
  return { file, sha256: hash(png), ...measurements };
}
try {
  const lookup = await context.newPage(); await lookup.goto(`${base}/ingredients`, { waitUntil: 'networkidle' });
  await lookup.getByRole('button').filter({ hasText: '대파' }).first().click(); await lookup.waitForURL(/\/ingredients\/[a-f0-9-]{36}$/);
  const id = new URL(lookup.url()).pathname.split('/').pop(); await lookup.close(); active = true;
  for (const state of ['initial', 'picker', 'negative', 'positive']) for (const [width, height, factor] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
    key = `${state}-${width}-text${factor}`;
    const page = await context.newPage(); await page.setViewportSize({ width, height });
    page.on('pageerror', (e) => errors.push({ key, type: 'pageerror', message: e.message }));
    page.on('console', (e) => { if (e.type() === 'error') errors.push({ key, type: 'console', message: e.text() }); });
    await page.goto(`${base}/ingredients/add-stock/${id}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '구매한 곳 선택', exact: true }).waitFor();
    if (state !== 'initial') {
      await page.getByRole('button', { name: '구매한 곳 선택', exact: true }).click();
      const modal = page.locator('[aria-modal="true"]'); await modal.waitFor();
      await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {}))); });
      if (state !== 'picker') {
        await modal.getByRole('button', { name: options[state === 'negative' ? 0 : 1].name, exact: true }).click();
        await modal.waitFor({ state: 'hidden' }); await page.getByText('반영 내용', { exact: true }).waitFor();
        await page.waitForLoadState('networkidle');
      }
    }
    const scaling = await scale(page, factor);
    if (scaling.mismatches || scaling.fontFailures.length) throw Error(`Scaling failed ${key}`);
    const shots = [await shot(page, 'start')];
    const endpoint = state === 'picker' ? page.getByRole('button', { name: '새 구매 링크·옵션 추가', exact: true })
      : state === 'initial' ? page.getByLabel('입고일', { exact: true }) : page.getByText('이번 입고 단가', { exact: true });
    await endpoint.scrollIntoViewIfNeeded(); shots.push(await shot(page, 'end'));
    rows.push({ key, state, width, height, scaling, shots, submittedWrite: false }); await page.close();
  }
  clean();
  writeFileSync(resolve(dir, 'quick-inbound-evidence.json'), `${JSON.stringify({ sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))), browserVersion: browser.version(), fixtures,
    scope: 'ING03b web render: initial/picker/negative and positive preview. Synthetic read responses; surrounding data live. No save/ensureVendor. Font+explicit-line-height approximation, not native/keyboard/SQL or exhaustive clipping proof. Served source requires operator restart.', rows, previews, errors, blocked }, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ rows: rows.length, shots: rows.flatMap((r) => r.shots).length, errors, blocked, output: dir }));
  if (errors.length || blocked.length) process.exitCode = 1;
} catch (error) {
  writeFileSync(resolve(dir, 'quick-inbound-failed.json'), `${JSON.stringify({ sourceCommit: expected, message: String(error), rows, previews, errors, blocked }, null, 2)}\n`, { flag: 'wx' });
  console.error(String(error)); process.exitCode = 1;
} finally { await browser.close(); }
