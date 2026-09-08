import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Live read-only web diagnostic; not native, keyboard/IME or arbitrary-length data coverage.
const args = new Map(process.argv.slice(2).map((s) => { const [k, ...v] = s.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit'), output = args.get('--output');
if (!/^[a-f0-9]{40}$/.test(expected ?? '') || !output) throw Error('Exact --expect-commit and new --output required');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const clean = () => { if (git('rev-parse', 'HEAD') !== expected || git('status', '--porcelain', '--untracked-files=no')) throw Error('Exact clean tracked HEAD required'); };
clean();
const dir = resolve(output);
if (existsSync(dir)) throw Error('Output exists; preserve earlier evidence');
mkdirSync(dir, { recursive: true });
const hash = (v) => createHash('sha256').update(v).digest('hex');
const baseUrl = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR' });
context.setDefaultTimeout(15000);
const rows = [], errors = [], blocked = [], rpcCalls = new Set();
const readRpcs = new Set(['settings_lists', 'ingredient_list', 'ingredient_detail', 'stock_history', 'business_day_state', 'get_settings', 'operating_hours_status']);
// No server save is part of this audit. Reject unknown POST RPCs and REST mutations
// before dispatch, not merely after clicking. Requests/bodies/credentials are not logged.
await context.route('**/*', async (route) => {
  const req = route.request(), url = new URL(req.url());
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if (rpc) rpcCalls.add(rpc);
  const writeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(req.method());
  const login = url.pathname === '/auth/v1/token' && req.method() === 'POST';
  if ((rpc && (!readRpcs.has(rpc) || !['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method()))) || (writeMethod && !rpc && !login)) {
    blocked.push({ path: url.pathname, method: req.method() }); return route.abort();
  }
  return route.continue();
});
async function settle(page) {
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {}))); });
}
async function scale(page, factor) {
  return page.evaluate(async (factor) => {
    const weights = [400, 500, 600, 700, 800];
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px PretendardApp`, '식재료 0123456789')));
    await document.fonts.ready;
    const entries = [...document.querySelectorAll('*')].map((el) => {
      const s = getComputedStyle(el); return { el, size: parseFloat(s.fontSize), line: parseFloat(s.lineHeight) };
    }).filter((e) => Number.isFinite(e.size));
    if (factor === 2) for (const { el, size, line } of entries) {
      el.style.setProperty('font-size', `${size * 2}px`, 'important');
      if (Number.isFinite(line)) el.style.setProperty('line-height', `${line * 2}px`, 'important');
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { mode: 'web-font-and-explicit-line-height-approximation', factor,
      fonts: weights.map((w) => ({ weight: w, loaded: document.fonts.check(`${w} 16px PretendardApp`) })),
      mismatches: entries.filter(({ el, size, line }) => {
        const actualSize = parseFloat(getComputedStyle(el).fontSize), actualLine = parseFloat(getComputedStyle(el).lineHeight);
        return !el.isConnected || !Number.isFinite(actualSize) || Math.abs(actualSize - size * factor) > .05
          || (Number.isFinite(line) && (!Number.isFinite(actualLine) || Math.abs(actualLine - line * factor) > .05));
      }).length };
  }, factor);
}
async function snapshot(page, sheet, file) {
  const geometry = await sheet.evaluate((root) => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const leaves = [...root.querySelectorAll('*')].filter((el) => !el.children.length && el.textContent?.trim()).map((el) => {
      const r = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
      const t = range.getBoundingClientRect(); let l = 0, right = innerWidth, top = 0, bottom = innerHeight;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p), box = p.getBoundingClientRect();
        if (s.overflowX !== 'visible') { l = Math.max(l, box.left); right = Math.min(right, box.right); }
        if (s.overflowY !== 'visible') { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
      }
      return { text: el.textContent, rect: rect(el), horizontalFits: t.left >= Math.max(l, r.left) - 1 && t.right <= Math.min(right, r.right) + 1,
        verticallyVisible: t.top >= top - 1 && t.bottom <= bottom + 1 };
    });
    return { sheet: rect(root), leaves, documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      scroll: [...root.querySelectorAll('*')].filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)).map((el) => ({ ...rect(el), scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })) };
  });
  const png = await page.screenshot({ fullPage: true }); writeFileSync(resolve(dir, file), png, { flag: 'wx' });
  return { file, sha256: hash(png), ...geometry };
}
try {
  const lookup = await context.newPage();
  await lookup.goto(`${baseUrl}/ingredients`, { waitUntil: 'networkidle' });
  await lookup.getByRole('button').filter({ hasText: '대파' }).first().click();
  await lookup.waitForURL(/\/ingredients\/[a-f0-9-]{36}$/);
  const id = new URL(lookup.url()).pathname.split('/').pop(); await lookup.close();
  for (const host of ['add', 'edit']) for (const kind of ['category', 'unit', 'vendor']) {
    for (const [width, height, factor] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
      const page = await context.newPage(); await page.setViewportSize({ width, height });
      const key = `${host}-${kind}-${width}-text${factor}`;
      page.on('pageerror', (e) => errors.push({ key, type: 'pageerror', message: e.message }));
      page.on('console', (e) => { if (e.type() === 'error') errors.push({ key, type: 'console', message: e.text() }); });
      await page.goto(`${baseUrl}/ingredients/${host === 'add' ? 'add' : `edit/${id}`}`, { waitUntil: 'networkidle' });
      await page.getByLabel('식재료명', { exact: true }).waitFor();
      // Before-fix Select has no role/name. Field-scoped focusable works on both revisions.
      const label = kind === 'category' ? /^카테고리/ : /^기본 거래처$/;
      const trigger = kind === 'unit' ? page.getByRole('button', { name: /^단위 .+ 변경$/ })
        : page.getByText(label).first().locator('..').locator('..').locator('[tabindex="0"]').first();
      const initialValue = await trigger.innerText(); await trigger.click();
      const sheet = page.locator('[aria-modal="true"]'); await sheet.waitFor(); await settle(page);
      const scaling = await scale(page, factor);
      const options = sheet.locator('[tabindex="0"]:not([aria-label="닫기"])').filter({ hasNotText: '거래처 추가' });
      const optionState = await options.evaluateAll((els) => els.map((el) => ({ text: el.textContent, role: el.getAttribute('role'), label: el.getAttribute('aria-label'), selected: el.getAttribute('aria-selected'), pressed: el.getAttribute('aria-pressed') })));
      if (!optionState.length) throw Error(`${key}: no options`);
      const start = await snapshot(page, sheet, `${key}-start.png`);
      const last = options.last(); await last.scrollIntoViewIfNeeded();
      const end = await snapshot(page, sheet, `${key}-end.png`);
      const choiceIndex = optionState.findLastIndex((o) => (o.label ?? o.text).trim() !== initialValue.trim() && o.label !== '거래처 없음');
      if (choiceIndex < 0) throw Error(`${key}: no different option; selection-change audit unavailable`);
      const choice = options.nth(choiceIndex);
      const selected = await choice.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent);
      await choice.click(); await sheet.waitFor({ state: 'hidden' });
      const reflectedValue = await trigger.innerText();
      if (reflectedValue.trim() !== selected.trim()) throw Error(`${key}: selected value not reflected`);
      // Newly mounted modal is NOT reused as a 200% measurement; it tests state only.
      await trigger.click(); await sheet.waitFor(); await settle(page);
      const reopened = await sheet.locator('[tabindex="0"]').evaluateAll((els) => els.map((el) => ({ text: el.textContent, label: el.getAttribute('aria-label'), selected: el.getAttribute('aria-selected'), pressed: el.getAttribute('aria-pressed') })));
      const active = reopened.filter((o) => o.pressed === 'true');
      const selectionStatePassed = active.length === 1 && (active[0].label ?? active[0].text).trim() === selected.trim();
      await page.getByRole('button', { name: '닫기', exact: true }).click({ position: { x: 10, y: 10 } });
      await sheet.waitFor({ state: 'hidden' });
      rows.push({ key, host, kind, width, height, scaling, initialValue, optionState, start, end, selected, reflectedValue, reopened,
        selectionChanged: initialValue.trim() !== reflectedValue.trim(), selectionStatePassed, closed: true });
      await page.close();
    }
  }
  clean();
  const evidence = { schemaVersion: 1, sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))), browserVersion: browser.version(),
    scope: 'ING02 + ING04; live lists, three web viewport/font conditions; first and last option, local selection/reopen/backdrop. No writes, arbitrary-length fixtures, native, keyboard or final approval. Leaf geometry is diagnostic; offscreen start leaves are expected.',
    rows, errors, blocked, rpcCalls: [...rpcCalls] };
  writeFileSync(resolve(dir, 'picker-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ rows: rows.length, errors, blocked, selectionStateFailures: rows.filter((r) => !r.selectionStatePassed).map((r) => r.key), rpcCalls: [...rpcCalls], output: dir }));
  if (errors.length || blocked.length || rows.some((r) => !r.selectionStatePassed || !r.selectionChanged || r.scaling.mismatches || r.scaling.fonts.some((f) => !f.loaded) || r.start.documentOverflow || r.end.documentOverflow)) process.exitCode = 1;
} catch (error) {
  const failure = { status: 'FAILED', sourceCommit: expected, message: String(error), rows, errors, blocked, rpcCalls: [...rpcCalls] };
  writeFileSync(resolve(dir, 'picker-failed.json'), `${JSON.stringify(failure, null, 2)}\n`, { flag: 'wx' });
  console.error(JSON.stringify({ message: String(error), errors, blocked, rpcCalls: [...rpcCalls] }));
  process.exitCode = 1;
} finally { await browser.close(); }
