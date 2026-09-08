import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Map(process.argv.slice(2).map(s => { const [k, ...v] = s.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit'), output = args.get('--output'), base = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const states = (args.get('--screens') ?? 'detail,add,edit').split(',');
const fixtureHistory = args.get('--history-fixture') === '1';
if (args.has('--history-fixture') && !fixtureHistory) throw Error('history-fixture supports only 1');
if (fixtureHistory && states.some(s => !s.startsWith('profit-history'))) throw Error('History fixture requires history-only states');
// Existing local history can be empty. This opt-in fixture exercises only the
// browser response boundary; it creates no persisted recipe/history/DB rows.
const historyFixture = { rows: [
  { id: '11111111-1111-4111-8111-111111111111', occurred_at: '2026-09-09T03:00:00Z',
    title: '국내산 고춧가루 대용량 구매 옵션 단가 반영', summary: '재료비 32원 감소 · 기존 구매 옵션의 단가 갱신', source_label: '국내산 고춧가루 대용량 구매 옵션',
    cause_key: 'material', cause_label: '재료비', cause_before: 2838.4, cause_after: 2806.4,
    profit_before: 4014.6, profit_after: 4046.6, profit_delta: 32, rate_before: 33.455, rate_after: 33.7216667 },
  { id: '22222222-2222-4222-8222-222222222222', occurred_at: '2026-09-08T02:00:00Z',
    title: '고정지출 반영', summary: '플랫폼 수수료 증가', source_label: '고정지출 설정',
    cause_key: 'fixed', cause_label: '고정지출', cause_before: 3756, cause_after: 20302.6,
    profit_before: 4046.6, profit_after: -12500, profit_delta: -16546.6, rate_before: 33.7216667, rate_after: -104.1667 },
  { id: '33333333-3333-4333-8333-333333333333', occurred_at: '2026-08-31T01:00:00Z',
    title: '메뉴 최초 등록', summary: null, source_label: null, cause_key: null, cause_before: null, cause_after: null,
    profit_before: null, profit_after: 4046.6, profit_delta: null, rate_before: null, rate_after: 33.7216667 },
], next: null };
const managementRoutes = { materials: 'materials', 'material-add': 'materials', 'material-edit': 'materials', 'recipe-category': 'category', 'material-category': 'material-category' };
if (!states.length || new Set(states).size !== states.length || states.some(s => !['detail', 'add', 'edit', 'price-sim', 'avg-sales', 'ingredient-search', 'material-search', 'profit-history', 'profit-history-sheet', ...Object.keys(managementRoutes)].includes(s))) throw Error('Unsupported screens');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const hash = v => createHash('sha256').update(v).digest('hex');
function clean() { if (!/^[a-f0-9]{40}$/.test(expected ?? '') || git('rev-parse', 'HEAD') !== expected || git('status', '--porcelain', '--untracked-files=no')) throw Error('Exact clean tracked HEAD required'); }
clean();
if (!output || existsSync(resolve(output))) throw Error('New output directory required');
const dir = resolve(output); mkdirSync(dir, { recursive: true });
const reads = new Set(['recipe_list', 'ingredient_list', 'recipe_detail', 'recipe_profit_history', 'sales_range', 'settings_lists', 'get_settings', 'operating_hours_status', 'business_day_state', 'app_capabilities', 'recipe_tax_app_state']);
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
    if (fixtureHistory && rpc === 'recipe_profit_history') {
      const body = JSON.stringify(historyFixture);
      inputs.push({ key, rpc, status: 200, sha256: hash(body), source: 'synthetic-history-fixture' });
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    }
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
    const management = state in managementRoutes;
    const materialForm = state === 'material-add' || state === 'material-edit';
    const path = management ? managementRoutes[state] : history ? `profit-history?id=${recipe.id}` : state === 'avg-sales' ? `avg-sales?recipe=${recipe.id}` : state.endsWith('-search') ? state : state === 'detail' || state === 'price-sim' ? recipe.id : `add${state === 'edit' ? `?id=${recipe.id}` : ''}`;
    await page.goto(`${base}/recipes/${path}`, { waitUntil: 'networkidle' });
    if (management) {
      await page.getByText(state.includes('category') ? (state === 'recipe-category' ? '레시피 카테고리' : '부자재 카테고리') : '부자재 관리', { exact: true }).waitFor();
      if (materialForm) {
        await (state === 'material-add' ? page.getByRole('button', { name: '부자재 추가', exact: true }) : page.getByRole('button', { name: / 수정$/ }).first()).click();
        await page.getByRole('textbox', { name: '부자재명', exact: true }).waitFor();
      }
    }
    else if (history) {
      await page.getByText('손익 변동', { exact: true }).waitFor();
      if (state === 'profit-history-sheet') {
        await page.getByRole('button', { name: /순이익 / }).first().click();
        await page.getByText('손익 결과', { exact: true }).waitFor();
      }
    }
    else if (state === 'price-sim') {
      await page.getByRole('button', { name: '판매가 시뮬레이션', exact: true }).click();
      await page.getByText('임시 판매가', { exact: true }).waitFor();
    }
    else if (state === 'avg-sales') await page.getByText('월 평균 판매량', { exact: true }).waitFor();
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
    // Modal slide-in can still be moving after font layout settles. Await actual
    // finite browser animations; two RAFs alone produced half-entered sheet PNGs.
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    const shots = [];
    const anchors = state === 'price-sim' ? ['start', '순이익률', '(−) 세금', '닫기']
      : state === 'avg-sales' ? ['start', '월 평균 판매량', '하루 환산']
      : materialForm ? ['start', '단가 미리보기', state === 'material-edit' ? '저장' : '추가']
      : state === 'profit-history-sheet' ? ['start', '변동 원인', '손익 결과', '닫기']
      : state.endsWith('-search') || history || management ? ['start'] : ['start', state === 'detail' ? '판매가 구성' : '재료비 소계', '손익 미리보기'];
    for (const anchor of anchors) {
      // Simulation duplicates cost labels behind its modal. Never scroll the
      // background detail when the requested anchor belongs to the active sheet.
      const anchorScope = state === 'price-sim' ? page.getByRole('dialog') : page;
      if (anchor !== 'start') await anchorScope.getByText(anchor, { exact: true }).first().evaluate((el, block) => el.scrollIntoView({ block }), state === 'price-sim' || state === 'profit-history-sheet' || materialForm ? 'center' : 'start');
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
    scope: 'Actual Expo components. Local read responses except explicitly marked synthetic history fixture. No saves. Anchor captures, not exhaustive scroll/occlusion/native proof. Font+line-height approximation. Compare RPC hashes for data drift. Restart server at source commit.',
    historyFixture: fixtureHistory ? historyFixture : null, states, rows, inputs, errors, blocked }, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output: dir, rows: rows.length, shots: rows.flatMap(r => r.shots).length, errors, blocked }));
  if (errors.length || blocked.length || rows.length !== states.length * 3) process.exitCode = 1;
  await browser.close();
}
