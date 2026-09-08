// Read-only browser-response diagnostic. No save/confirm/cancel-order clicks.
// Run only after restarting the local Expo server at --expect-commit.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = new Map(process.argv.slice(2).map(s => { const [k, ...v] = s.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit');
const output = args.get('--output');
const base = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const states = (args.get('--screens') ?? 'candidate,waiting,received,order,receive,direct').split(',');
const supported = ['candidate', 'waiting', 'received', 'order', 'receive', 'direct'];
if ([...args.keys()].some(k => !['--expect-commit', '--output', '--base-url', '--screens'].includes(k))) throw Error('Unsupported argument');
if (!/^[a-f0-9]{40}$/.test(expected ?? '')) throw Error('Exact 40-character source SHA required');
if (!states.length || new Set(states).size !== states.length || states.some(s => !supported.includes(s))) throw Error('Unsupported or duplicate screens');
const baseUrl = new URL(base);
const local = url => ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
if (!local(baseUrl) || baseUrl.protocol !== 'http:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || baseUrl.pathname !== '/') throw Error('Local HTTP origin required');
if (!output || existsSync(resolve(output))) throw Error('New output directory required');
const dir = resolve(output);
mkdirSync(dir, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8' }).trim();
const rows = [], errors = [], blocked = [], inputs = [], checkpoints = [];
const writtenInputs = new Set();
let browser, context, browserVersion, ingredient, fixtures, key = 'setup';
const reads = new Set(['ingredient_list', 'ingredient_detail', 'order_board', 'settings_lists', 'get_settings',
  'operating_hours_status', 'business_day_state', 'app_capabilities']);
const errorRecord = (kind, error, at = key) => errors.push({ key: at, kind, message: String(error?.message ?? error) });

function clean(stage) {
  const head = git('rev-parse', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no');
  checkpoints.push({ stage, head, trackedClean: dirty === '' });
  if (head !== expected || dirty !== '') throw Error(`Exact clean tracked HEAD required (${stage})`);
}
function writeJson(file, value) {
  writeFileSync(resolve(dir, file), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
function rememberInput(rpc, bytes, status, source, request) {
  const sha256 = hash(bytes), file = `input-${sha256}.json`;
  // Only allowlisted read RPC bodies, never auth/session response bodies/headers.
  if (!writtenInputs.has(file)) { writeFileSync(resolve(dir, file), bytes, { flag: 'wx' }); writtenInputs.add(file); }
  inputs.push({ key, rpc, status, source, request, sha256, file });
  JSON.parse(bytes.toString('utf8'));
}
function fixtureFor(id) {
  const name = '국내산 고춧가루 업소용 대용량 장기 보관 식재료';
  const optionName = '국내산 고춧가루 업소용 대용량 밀봉 포장 구매 옵션';
  const record = {
    ingredient_id: id, name, vendor_name: '검수용 장기 거래처', volume: 1000, amount: 28000,
    qty: 3, received_qty: 1, status: 'partial', ordered_at: '2026-09-08T03:00:00Z',
    expected_at: '2026-09-10', unit_price: 28,
  };
  return {
    order_board: {
      candidates: [{ ingredient_id: id, name, reasons: ['safety_stock'], recommended_qty: 3,
        status: 'pending', stock_total: -750, safety_total: 1000, base_unit: 'g', per_volume: 1000 }],
      waiting: [{ ...record, id: '11111111-1111-4111-8111-111111111111' }],
      received: [{ ...record, id: '22222222-2222-4222-8222-222222222222', qty: 2, received_qty: 2,
        status: 'received', expected_at: '2026-09-08' }],
    },
    ingredient_detail: {
      id, name, category_name: '향신료·허브', category_id: null, base_unit: 'g', per_volume: 1000,
      safety_stock: 1000, stock_total: -750, base_price: 28, soon_out: false,
      vendor_name: null, default_vendor_id: null, memo: null, min_order_qty: 1, last_inbound_at: null,
      last_change: null, loss: {}, purchase: {}, price_trends: [], orders: [],
      options: [{ id: '33333333-3333-4333-8333-333333333333', name: optionName, volume: 1000, amount: 28000,
        vendor_id: null, vendor_name: null, brand_id: null, brand_name: null, url: null }],
    },
  };
}
function observe(page, at) {
  page.on('pageerror', e => errorRecord('pageerror', e, at));
  page.on('console', e => { if (e.type() === 'error') errorRecord('console', e.text(), at); });
  page.on('requestfailed', req => errorRecord('requestfailed', `${req.method()} ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`, at));
  page.on('response', response => {
    if (response.status() >= 400) errorRecord('http-response', `${response.status()} ${new URL(response.url()).pathname}`, at);
  });
  page.on('dialog', async dialog => {
    errorRecord('unexpected-dialog', `${dialog.type()}: ${dialog.message()}`, at);
    try { await dialog.dismiss(); } catch (e) { errorRecord('dialog-dismiss', e, at); }
  });
}
async function settle(page) {
  return page.evaluate(async () => {
    const running = () => document.getAnimations().filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime));
    const animations = running();
    let timer;
    try {
      await Promise.race([
        Promise.all(animations.map(a => a.finished.catch(() => 'cancelled'))),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Finite animation timeout')), 8000); }),
      ]);
    } finally { clearTimeout(timer); }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (running().length) throw Error('Finite animation still running');
    return { finiteAnimationsAwaited: animations.length };
  });
}
async function scale(page, factor) {
  const result = await page.evaluate(async factor => {
    const weights = [400, 500, 600, 700, 800];
    const loaded = await Promise.all(weights.map(w => document.fonts.load(`${w} 16px PretendardApp`, '발주 0123456789')));
    const fontFailures = weights.filter((w, i) => !loaded[i].length || !document.fonts.check(`${w} 16px PretendardApp`, '발주 0123456789'));
    const baseline = [...document.querySelectorAll('*')].filter(el => el.style).map(el => {
      const style = getComputedStyle(el);
      return { el, size: parseFloat(style.fontSize), line: parseFloat(style.lineHeight), normalLine: style.lineHeight === 'normal' };
    });
    if (baseline.some(({ el, size, line, normalLine }) => !el.isConnected || !Number.isFinite(size) || (!normalLine && !Number.isFinite(line)))) throw Error('Non-finite or disconnected baseline');
    if (factor === 2) for (const { el, size, line, normalLine } of baseline) {
      el.style.setProperty('font-size', `${size * 2}px`, 'important');
      if (!normalLine) el.style.setProperty('line-height', `${line * 2}px`, 'important');
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const mismatches = baseline.filter(({ el, size, line, normalLine }) => {
      const style = getComputedStyle(el), actual = parseFloat(style.fontSize), actualLine = parseFloat(style.lineHeight);
      return !el.isConnected || !Number.isFinite(actual) || Math.abs(actual - size * factor) > .05
        || (!normalLine && (!Number.isFinite(actualLine) || Math.abs(actualLine - line * factor) > .05));
    }).length;
    return { factor, fontFailures, mismatches, elements: baseline.length, normalLineHeightCount: baseline.filter(b => b.normalLine).length };
  }, factor);
  if (result.fontFailures.length || result.mismatches) throw Error(`Font/scale validation failed: ${JSON.stringify(result)}`);
  return result;
}
async function onlyDialog(page) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  if (await dialog.count() !== 1) throw Error('Exactly one active dialog required');
  return dialog;
}
async function prepare(page, state, phase) {
  await page.goto(`${baseUrl.origin}${state === 'direct' ? '/orders/complete' : '/orders'}`, { waitUntil: 'networkidle' });
  if (state === 'direct') {
    await page.getByRole('button', { name: '식재료 선택', exact: true }).waitFor();
    if (phase === 'empty') return;
    await page.getByRole('button', { name: '식재료 선택', exact: true }).click();
    let dialog = await onlyDialog(page);
    await dialog.getByRole('button', { name: ingredient.name, exact: true }).waitFor();
    if (phase === 'picker') return;
    await dialog.getByRole('button', { name: ingredient.name, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: fixtures.ingredient_detail.options[0].name, exact: true }).click();
    await page.getByRole('textbox', { name: '수량', exact: true }).fill('3');
    if (await page.getByRole('textbox', { name: '개당 용량', exact: true }).inputValue() !== '1000'
      || await page.getByRole('textbox', { name: '개당 금액', exact: true }).inputValue() !== '28000') throw Error('Fixture option prefill mismatch');
    if (phase === 'vendor') {
      await page.getByRole('button', { name: '지정 안 함', exact: true }).click();
      dialog = await onlyDialog(page);
      await dialog.getByText('거래처 선택', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: '거래처 추가', exact: true }).waitFor();
    }
    return;
  }
  await page.getByRole('tab', { name: /^발주 후보 / }).waitFor();
  if (['waiting', 'receive'].includes(state)) await page.getByRole('tab', { name: /^입고 예정 / }).click();
  if (state === 'received') await page.getByRole('tab', { name: /^입고 완료 / }).click();
  if (state === 'order') {
    await page.getByRole('button', { name: '주문하기', exact: true }).click();
    const dialog = await onlyDialog(page);
    await dialog.getByRole('button', { name: fixtures.ingredient_detail.options[0].name, exact: true }).waitFor();
    if (await dialog.getByRole('textbox', { name: '발주 수량', exact: true }).inputValue() !== '3') throw Error('Recommended quantity fixture mismatch');
  } else if (state === 'receive') {
    await page.getByRole('button', { name: '입고 완료', exact: true }).click();
    const dialog = await onlyDialog(page);
    if (await dialog.getByRole('textbox', { name: '실제 입고 수량', exact: true }).inputValue() !== '2') throw Error('Partial inbound remaining quantity mismatch');
  } else {
    await page.getByRole('button', { name: `${fixtures.ingredient_detail.name} 상세`, exact: true }).waitFor();
    if (state === 'candidate') await page.getByText('−750g', { exact: true }).waitFor();
  }
}
async function measure(scope) {
  return scope.evaluate(root => {
    const rect = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const text = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(el.tagName)) continue;
      const style = getComputedStyle(el), range = document.createRange(); range.selectNode(node);
      if (!el.getClientRects().length || style.visibility === 'hidden') continue;
      text.push({ text: node.textContent, size: style.fontSize, lineHeight: style.lineHeight, weight: style.fontWeight,
        family: style.fontFamily, color: style.color, box: rect(el.getBoundingClientRect()), ink: rect(range.getBoundingClientRect()) });
    }
    return { scope: root.getAttribute('role') === 'dialog' ? 'active-dialog' : 'document',
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), text,
      controls: [...root.querySelectorAll('input,textarea')].map(el => ({ label: el.getAttribute('aria-label'),
        value: el.type === 'password' ? '[excluded]' : el.value, box: rect(el.getBoundingClientRect()) })),
      buttons: [...root.querySelectorAll('[role="button"],[role="tab"]')].map(el => ({ name: el.getAttribute('aria-label'),
        text: el.textContent, selected: el.getAttribute('aria-selected'), expanded: el.getAttribute('aria-expanded'), disabled: el.getAttribute('aria-disabled') })) };
  });
}

try {
  clean('before');
  browser = await chromium.launch({ headless: true }); browserVersion = browser.version();
  context = await browser.newContext({ locale: 'ko-KR', serviceWorkers: 'block' });
  context.setDefaultTimeout(20000);
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const allowedRpc = rpc && local(url) && reads.has(rpc) && ['GET', 'POST', 'HEAD', 'OPTIONS'].includes(method);
    const authPost = local(url) && url.pathname === '/auth/v1/token' && method === 'POST';
    if ((rpc && !allowedRpc) || (!rpc && !safeMethod && !authPost)) {
      blocked.push({ key, path: url.pathname, method }); await route.abort(); return;
    }
    try {
      if (rpc && method !== 'OPTIONS' && method !== 'HEAD') {
        const raw = method === 'POST' ? req.postDataJSON() ?? {} : Object.fromEntries(url.searchParams);
        const request = Object.fromEntries(['p_store', 'p_ingredient'].filter(k => raw[k] != null).map(k => [k, raw[k]]));
        const replacement = fixtures && (rpc === 'order_board' ? fixtures.order_board
          : rpc === 'ingredient_detail' && raw.p_ingredient === ingredient.id ? fixtures.ingredient_detail : null);
        if (replacement) {
          const bytes = Buffer.from(JSON.stringify(replacement));
          rememberInput(rpc, bytes, 200, 'synthetic-response-fixture', request);
          await route.fulfill({ status: 200, contentType: 'application/json', body: bytes }); return;
        }
        const response = await route.fetch({ maxRedirects: 0 });
        const bytes = await response.body();
        rememberInput(rpc, bytes, response.status(), 'local-read-response', request);
        if (!response.ok()) errorRecord('read-rpc-http', `${rpc}: ${response.status()}`);
        await route.fulfill({ response, body: bytes }); return;
      }
      await route.continue();
    } catch (error) {
      errorRecord('route', error);
      try { await route.abort(); } catch (abortError) { errorRecord('route-abort', abortError); }
    }
  });
  // Existing app dev session only. Do not inspect storage, credentials, or tokens.
  const lookup = await context.newPage(); observe(lookup, 'lookup');
  const [response] = await Promise.all([
    lookup.waitForResponse(r => new URL(r.url()).pathname.endsWith('/rpc/ingredient_list')),
    lookup.goto(`${baseUrl.origin}/ingredients`, { waitUntil: 'networkidle' }),
  ]);
  const list = await response.json();
  if (!Array.isArray(list)) throw Error('Existing ingredient_list array required');
  ingredient = list.find(row => /^[a-f0-9-]{36}$/.test(row.id ?? '') && typeof row.name === 'string' && row.name
    && list.filter(other => other.name === row.name).length === 1);
  if (!ingredient) throw Error('One existing uniquely named ingredient required; no seed/write is performed');
  ingredient = { id: ingredient.id, name: ingredient.name };
  fixtures = fixtureFor(ingredient.id); writeJson('orders-fixtures.json', fixtures);
  await lookup.close();
  for (const state of states) for (const [width, height, factor] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
    key = `${state}-${width}-text${factor}`;
    const row = { key, state, width, height, factor, passes: [] }; rows.push(row);
    for (const phase of state === 'direct' ? ['empty', 'picker', 'filled', 'vendor'] : ['main']) {
      key = `${row.key}-${phase}`;
      // Fresh document per phase: mount the intended modal before scaling, never
      // double-scale old nodes or silently leave newly mounted controls at 1x.
      const pass = { phase, shots: [] }; row.passes.push(pass);
      let page;
      try {
        page = await context.newPage(); observe(page, key); await page.setViewportSize({ width, height });
        await prepare(page, state, phase); await settle(page);
        // Playwright may have scrolled while opening/selecting inputs. The first
        // shot begins at the top of the mounted phase, not at that incidental position.
        await page.evaluate(() => {
          window.scrollTo(0, 0);
          for (const el of document.querySelectorAll('*')) {
            if (el.scrollTop) el.scrollTop = 0;
            if (el.scrollLeft) el.scrollLeft = 0;
          }
        });
        pass.scaling = await scale(page, factor); pass.animation = await settle(page); pass.finalUrl = page.url();
        const modal = ['order', 'receive'].includes(state) || ['picker', 'vendor'].includes(phase);
        const scope = modal ? await onlyDialog(page) : page.locator('body');
        const anchors = state === 'order' ? ['start', '발주 금액', '발주 등록']
          : state === 'receive' ? ['start', '입고 확정']
          : phase === 'filled' ? ['start', '총 발주 금액', '도착 예정일', '발주 등록']
          : phase === 'vendor' ? ['start', '거래처 추가'] : ['start'];
        for (const anchor of anchors) {
          if (anchor !== 'start') {
            // Read/scroll only, including labels on destructive/save controls.
            // Scope is always the active dialog for every modal phase.
            const target = scope.getByText(anchor, { exact: true });
            if (await target.count() !== 1) throw Error(`Unique scoped anchor required: ${anchor}`);
            await target.evaluate(el => el.scrollIntoView({ block: 'center' }));
          }
          await settle(page);
          const measured = await measure(scope);
          const file = `${key}-${pass.shots.length}.png`;
          const png = await page.screenshot({ fullPage: false });
          writeFileSync(resolve(dir, file), png, { flag: 'wx' });
          pass.shots.push({ anchor, file, sha256: hash(png), ...measured });
        }
        pass.finished = true;
      } catch (error) { errorRecord('pass', error); pass.finished = false; }
      finally { if (page) try { await page.close(); } catch (error) { errorRecord('page-close', error); } }
    }
  }
} catch (error) { errorRecord('runner', error); }
finally {
  try { clean('after'); } catch (error) { errorRecord('final-source-check', error); }
  if (browser) try { await browser.close(); } catch (error) { errorRecord('browser-close', error); }
  const expectedPasses = states.reduce((sum, state) => sum + (state === 'direct' ? 4 : 1) * 3, 0);
  const passes = rows.flatMap(row => row.passes), completedPasses = passes.filter(pass => pass.finished).length;
  const failed = errors.length > 0 || blocked.length > 0 || rows.length !== states.length * 3 || completedPasses !== expectedPasses;
  writeJson('orders-evidence.json', {
    sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))), browserVersion,
    baseUrl: baseUrl.origin, states, ingredientLookup: ingredient, checkpoints,
    fixtures: fixtures ? { file: 'orders-fixtures.json', sha256: hash(readFileSync(resolve(dir, 'orders-fixtures.json'))) } : null,
    scope: 'Actual Expo hosts with synthetic order_board and one ingredient_detail response only; all fixture/input bodies preserved. Server date/settings/vendor reads remain local. No save, inbound confirmation, order/inbound cancellation, vendor creation, or real database write. Existing app dev session; no storage/token reads. Viewport anchor PNGs and scoped text/control measurements, not exhaustive scroll/clipping/native/IME or external approval. 2x font and finite numeric line-height approximation. A matching disk HEAD does not prove a previously running bundle was restarted; operator must restart Expo at sourceCommit. Untracked/ignored files are not a clean-runtime guarantee.',
    measurementLimits: ['Range boxes do not prove absence of ancestor clipping or occlusion.', 'Normal line-height stays normal and scales through the font.',
      'Direct picker list and vendor list are local data, not synthetic exhaustive states.', 'Expected fixture dates are fixed; actual local business date can change between runs.'],
    rows, inputs, errors, blocked, diagnostic: { failed, expectedPasses, completedPasses, shots: passes.reduce((n, pass) => n + pass.shots.length, 0) },
  });
  console.log(JSON.stringify({ output: dir, rows: rows.length, expectedPasses, completedPasses, errors, blocked }));
  if (failed) process.exitCode = 1;
}
