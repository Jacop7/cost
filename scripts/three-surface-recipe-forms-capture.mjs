import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Map(process.argv.slice(2).map(s => { const [k, ...v] = s.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit'), output = args.get('--output'), base = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const states = (args.get('--screens') ?? 'detail,add,edit').split(',');
if (!states.length || new Set(states).size !== states.length || states.some(s => !['detail', 'add', 'edit', 'ingredient-search', 'material-search', 'profit-history', 'profit-history-sheet'].includes(s))) throw Error('Unsupported screens');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const hash = v => createHash('sha256').update(v).digest('hex');
function clean() { if (!/^[a-f0-9]{40}$/.test(expected ?? '') || git('rev-parse', 'HEAD') !== expected || git('status', '--porcelain', '--untracked-files=no')) throw Error('Exact clean tracked HEAD required'); }
clean();
if (!output || existsSync(resolve(output))) throw Error('New output directory required');
const dir = resolve(output); mkdirSync(dir, { recursive: true });
const reads = new Set(['recipe_list', 'ingredient_list', 'recipe_detail', 'recipe_profit_history', 'settings_lists', 'get_settings', 'operating_hours_status', 'business_day_state', 'app_capabilities', 'recipe_tax_app_state']);
const rows = [], errors = [], blocked = [], inputs = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR' });
context.setDefaultTimeout(20000);
let key = 'lookup', recipe;
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url()), rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if ((rpc && (!reads.has(rpc) || !['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method())))
    || (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && !rpc && !(url.pathname === '/auth/v1/token' && req.method() === 'POST'))) {
    blocked.push({ key, path: url.pathname, method: req.method() }); return route.abort();
  }
  if (rpc) {
    const response = await route.fetch();
    const body = await response.body();
    inputs.push({ key, rpc, status: response.status(), sha256: hash(body) });
    return route.fulfill({ response, body });
  }
  return route.continue();
});
try {
  const lookup = await context.newPage();
  const listed = lookup.waitForResponse(r => new URL(r.url()).pathname.endsWith('/rpc/recipe_list'));
  await lookup.goto(`${base}/recipes`, { waitUntil: 'networkidle' });
  const list = await (await listed).json();
  recipe = list.find(r => r.active !== false);
  if (!recipe || !/^[a-f0-9-]{36}$/.test(recipe.id)) throw Error('Existing recipe required');
  await lookup.close();
  for (const state of states) for (const [width, height, factor] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
    key = `${state}-${width}-text${factor}`;
    const page = await context.newPage(); await page.setViewportSize({ width, height });
    page.on('pageerror', e => errors.push({ key, kind: 'pageerror', message: e.message }));
    page.on('console', e => { if (e.type() === 'error') errors.push({ key, kind: 'console', message: e.text() }); });
    const history = state.startsWith('profit-history');
    const path = history ? `profit-history?id=${recipe.id}` : state.endsWith('-search') ? state : state === 'detail' ? recipe.id : `add${state === 'edit' ? `?id=${recipe.id}` : ''}`;
    await page.goto(`${base}/recipes/${path}`, { waitUntil: 'networkidle' });
    if (history) {
      await page.getByText('손익 변동', { exact: true }).waitFor();
      if (state === 'profit-history-sheet') {
        await page.getByRole('button', { name: /순이익 / }).first().click();
        await page.getByText('손익 결과', { exact: true }).waitFor();
      }
    }
    else if (state === 'detail') await page.getByText('판매가 구성', { exact: true }).waitFor();
    else if (state.endsWith('-search')) await page.getByPlaceholder(state === 'ingredient-search' ? '식재료 이름으로 검색' : '부자재 이름으로 검색').waitFor();
    else await page.getByRole('textbox', { name: '메뉴명', exact: true }).waitFor();
    const scaling = await page.evaluate(async factor => {
      const weights = [400, 500, 600, 700, 800];
      await Promise.all(weights.map(w => document.fonts.load(`${w} 16px PretendardApp`, '메뉴 0123456789')));
      const baseline = [...document.querySelectorAll('*')].map(el => ({ el, size: parseFloat(getComputedStyle(el).fontSize), line: parseFloat(getComputedStyle(el).lineHeight) }));
      if (factor === 2) for (const { el, size, line } of baseline) {
        if (Number.isFinite(size)) el.style.setProperty('font-size', `${size * 2}px`, 'important');
        if (Number.isFinite(line)) el.style.setProperty('line-height', `${line * 2}px`, 'important');
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { factor, fontFailures: weights.filter(w => !document.fonts.check(`${w} 16px PretendardApp`)), mismatches: baseline.filter(({ el, size, line }) => Math.abs(parseFloat(getComputedStyle(el).fontSize) - size * factor) > .05 || (Number.isFinite(line) && Math.abs(parseFloat(getComputedStyle(el).lineHeight) - line * factor) > .05)).length };
    }, factor);
    if (scaling.fontFailures.length || scaling.mismatches) throw Error(`Scaling failure ${key}`);
    const shots = [];
    for (const anchor of state.endsWith('-search') || history ? ['start'] : ['start', state === 'detail' ? '판매가 구성' : '재료비 소계', '손익 미리보기']) {
      if (anchor !== 'start') await page.getByText(anchor, { exact: true }).first().evaluate(el => el.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const measured = await page.evaluate(() => {
        const box = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
        const text = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node; (node = walker.nextNode());) {
          if (!node.textContent.trim() || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) continue;
          const el = node.parentElement, range = document.createRange(); range.selectNode(node);
          const s = getComputedStyle(el);
          text.push({ text: node.textContent, size: s.fontSize, weight: s.fontWeight, color: s.color, box: box(el.getBoundingClientRect()), ink: box(range.getBoundingClientRect()) });
        }
        return { documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), text,
          inputs: [...document.querySelectorAll('input')].map(el => ({ label: el.getAttribute('aria-label'), value: el.value, box: box(el.getBoundingClientRect()) })) };
      });
      const file = `${key}-${shots.length}.png`, png = await page.screenshot({ fullPage: true });
      writeFileSync(resolve(dir, file), png, { flag: 'wx' }); shots.push({ anchor, file, sha256: hash(png), ...measured });
    }
    rows.push({ key, state, width, height, scaling, shots }); await page.close();
  }
  clean();
} catch (error) { errors.push({ key, kind: 'runner', message: String(error) }); process.exitCode = 1; }
finally {
  writeFileSync(resolve(dir, 'recipe-forms-evidence.json'), `${JSON.stringify({ sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))), browserVersion: browser.version(), recipeId: recipe?.id,
    scope: 'Actual Expo recipe detail/forms/searches and local read responses. No saves. Anchor captures, not exhaustive scroll/occlusion/native proof. Font+line-height approximation. Compare RPC hashes for data drift. Restart server at source commit.', states, rows, inputs, errors, blocked }, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output: dir, rows: rows.length, shots: rows.flatMap(r => r.shots).length, errors, blocked }));
  if (errors.length || blocked.length || rows.length !== states.length * 3) process.exitCode = 1;
  await browser.close();
}
