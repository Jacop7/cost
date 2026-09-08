import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// RCP-01 actual Expo host; only recipe_list is substituted. No product writes.
const args = new Map(process.argv.slice(2).map(s => { const [k, ...v] = s.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit'), output = args.get('--output');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const hash = v => createHash('sha256').update(v).digest('hex');
function clean() {
  if (!/^[a-f0-9]{40}$/.test(expected ?? '') || git('rev-parse', 'HEAD') !== expected
    || git('status', '--porcelain', '--untracked-files=no')) throw Error('Exact clean tracked HEAD required');
}
clean();
if (!output || existsSync(resolve(output))) throw Error('New output directory required');
const dir = resolve(output); mkdirSync(dir, { recursive: true });
const base = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const common = { category_id: null, category_name: '검수 한식', tax_mode: 'included', base_servings: 1,
  target_profit_rate: 35, avg_monthly_sales: 30, material_cost: 2806.4, material_rate: .23387,
  extra_cost: 0, tax: 1091, fixed_cost: 3756, unknown_cost_lines: 0, blocked_by: null };
const fixtures = [
  { ...common, id: '33333333-3333-4333-8333-000000000001', name: '제육볶음', active: true, price: 12000, profit: 4046.6, profit_rate: .3372 },
  { ...common, id: '33333333-3333-4333-8333-000000000002', name: '국내산 돼지고기와 제철 채소를 곁들인 매콤한 제육볶음 정식', active: true, price: 125000, profit: -12500, profit_rate: -.1, blocked_by: '대파', unknown_cost_lines: 2 },
  { ...common, id: '33333333-3333-4333-8333-000000000003', name: '판매 중지 검수 메뉴', active: false, price: 9000, profit: 4000, profit_rate: .4444 },
];
const reads = new Set(['recipe_list', 'settings_lists', 'business_day_state', 'get_settings', 'operating_hours_status']);
const rows = [], errors = [], blocked = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR' });
context.setDefaultTimeout(20000);
let key;
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url()), rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if ((rpc && (!reads.has(rpc) || !['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method())))
    || (!rpc && !['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && !(url.pathname === '/auth/v1/token' && req.method() === 'POST'))) {
    blocked.push({ key, path: url.pathname, method: req.method() }); return route.abort();
  }
  if (rpc === 'recipe_list') return route.fulfill({ json: fixtures });
  return route.continue();
});
try {
  for (const state of ['ready', 'search', 'sort', 'status', 'target']) for (const [width, height, factor] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
    key = `${state}-${width}-text${factor}`;
    const page = await context.newPage(); await page.setViewportSize({ width, height });
    page.on('pageerror', e => errors.push({ key, kind: 'pageerror', message: e.message }));
    page.on('console', e => { if (e.type() === 'error') errors.push({ key, kind: 'console', message: e.text() }); });
    await page.goto(`${base}/recipes`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '제육볶음 상세', exact: true }).waitFor();
    if (state !== 'ready') {
      await page.getByRole('button', { name: { search: '검색', sort: '순이익률 낮은순', status: '판매중', target: '목표' }[state], exact: true }).click();
      if (state === 'search') await page.getByPlaceholder('메뉴·카테고리 검색').waitFor();
      else await page.locator('[aria-modal="true"]').waitFor();
    }
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))); });
    const scaling = await page.evaluate(async factor => {
      const weights = [400, 500, 600, 700, 800];
      await Promise.all(weights.map(w => document.fonts.load(`${w} 16px PretendardApp`, '메뉴 0123456789')));
      const before = [...document.querySelectorAll('*')].map(el => ({ el, size: parseFloat(getComputedStyle(el).fontSize), line: parseFloat(getComputedStyle(el).lineHeight) }));
      if (factor === 2) for (const { el, size, line } of before) {
        if (Number.isFinite(size)) el.style.setProperty('font-size', `${size * factor}px`, 'important');
        if (Number.isFinite(line)) el.style.setProperty('line-height', `${line * factor}px`, 'important');
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { factor, fontFailures: weights.filter(w => !document.fonts.check(`${w} 16px PretendardApp`)),
        mismatches: before.filter(({ el, size, line }) => Math.abs(parseFloat(getComputedStyle(el).fontSize) - size * factor) > .05
          || (Number.isFinite(line) && Math.abs(parseFloat(getComputedStyle(el).lineHeight) - line * factor) > .05)).length };
    }, factor);
    if (scaling.fontFailures.length || scaling.mismatches) throw Error(`Font scaling failure ${key}`);
    const measurements = await page.evaluate(() => {
      const root = document.querySelector('[aria-modal="true"]') ?? document.body;
      const box = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), text = [];
      for (let node; (node = walker.nextNode());) {
        if (!node.textContent.trim() || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) continue;
        const el = node.parentElement, range = document.createRange(); range.selectNode(node);
        const s = getComputedStyle(el);
        text.push({ text: node.textContent, size: s.fontSize, weight: s.fontWeight, color: s.color,
          box: box(el.getBoundingClientRect()), ink: box(range.getBoundingClientRect()) });
      }
      return { documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), text };
    });
    const file = `${key}.png`, png = await page.screenshot({ fullPage: true });
    writeFileSync(resolve(dir, file), png, { flag: 'wx' });
    rows.push({ key, state, width, height, scaling, ...measurements, file, sha256: hash(png) });
    await page.close();
  }
  clean();
} catch (error) { errors.push({ key, kind: 'runner', message: String(error) }); process.exitCode = 1; }
finally {
  writeFileSync(resolve(dir, 'recipes-list-evidence.json'), `${JSON.stringify({ sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))), browserVersion: browser.version(), fixtures,
    scope: 'RCP-01 web ready/search/3 sheets, synthetic recipe_list and live surrounding reads. No save. Font+line-height x2 approximation, not native/SQL/i18n/exhaustive clipping proof. Restart served product at source commit before capture.', rows, errors, blocked }, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output: dir, shots: rows.length, errors, blocked }));
  if (errors.length || blocked.length || rows.length !== 15) process.exitCode = 1;
  await browser.close();
}
