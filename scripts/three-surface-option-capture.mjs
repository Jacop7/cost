import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Synthetic purchase options in the real web app. NOT production-data or native proof.
// Only the ingredient_detail response's options are replaced; no domain writes are allowed.
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
const fixtures = Object.fromEntries(['normal', 'long'].map((kind) => [kind, [
  { id: '11111111-1111-4111-8111-111111111111', name: kind === 'long' ? '친환경 무농약 국내산 손질 대파 업소용 정기배송 특별 구성' : '대파 1kg', volume: 1000, amount: kind === 'long' ? 987654321 : 4000, vendor_id: null,
    vendor_name: kind === 'long' ? '전국 식자재 공동구매 배송센터 서울 동부 지점' : '동네마트', brand_id: null, brand_name: null, url: 'https://example.invalid/not-opened' },
  { id: '22222222-2222-4222-8222-222222222222', name: kind === 'long' ? 'Large commercial spring onion box with delivery included' : '대파 박스', volume: 2000, amount: kind === 'long' ? 2469135800 : 10000, vendor_id: null,
    vendor_name: kind === 'long' ? 'Wholesale vegetables and grocery distribution centre' : '도매시장', brand_id: null, brand_name: null, url: null },
]]));
const readRpcs = new Set(['settings_lists', 'ingredient_list', 'ingredient_detail', 'stock_history', 'business_day_state', 'get_settings', 'operating_hours_status']);
const rows = [], errors = [], blocked = [], rpcCalls = new Set();
let fixtureKind = null, substituted = 0;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR' });
context.setDefaultTimeout(20000);
await context.route('**/*', async (route) => {
  const req = route.request(), url = new URL(req.url());
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if (rpc) rpcCalls.add(rpc);
  const writeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(req.method());
  const login = url.pathname === '/auth/v1/token' && req.method() === 'POST';
  if ((rpc && (!readRpcs.has(rpc) || !['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method()))) || (writeMethod && !rpc && !login)) {
    blocked.push({ path: url.pathname, method: req.method() }); return route.abort();
  }
  if (rpc === 'ingredient_detail' && fixtureKind) {
    const response = await route.fetch();
    if (!response.ok()) throw Error(`Read fixture prerequisite HTTP ${response.status()}`);
    const data = await response.json();
    if (!data || Array.isArray(data) || !Array.isArray(data.options)) throw Error('Unexpected ingredient detail response');
    substituted++;
    return route.fulfill({ response, json: { ...data, options: fixtures[fixtureKind] } });
  }
  return route.continue();
});
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
    return { factor, mode: 'web-font-and-explicit-line-height-approximation',
      fonts: weights.map((w) => ({ weight: w, loaded: document.fonts.check(`${w} 16px PretendardApp`) })),
      mismatches: entries.filter(({ el, size, line }) => {
        const s = getComputedStyle(el), actual = parseFloat(s.fontSize), lh = parseFloat(s.lineHeight);
        return !el.isConnected || !Number.isFinite(actual) || Math.abs(actual - size * factor) > .05
          || (Number.isFinite(line) && (!Number.isFinite(lh) || Math.abs(lh - line * factor) > .05));
      }).length };
  }, factor);
}
async function snap(page, root, file) {
  const geometry = await root.evaluate((root) => {
    const rect = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const leaves = [...root.querySelectorAll('*')].filter((el) => !el.children.length && el.textContent?.trim()).map((el) => {
      const box = el.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(el);
      const text = range.getBoundingClientRect(); let left = 0, right = innerWidth;
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== 'visible') { const r = p.getBoundingClientRect(); left = Math.max(left, r.left); right = Math.min(right, r.right); }
      }
      return { text: el.textContent, box: rect(box), ink: rect(text), fontSize: getComputedStyle(el).fontSize, fontWeight: getComputedStyle(el).fontWeight,
        horizontalFits: text.left >= Math.max(left, box.left) - 1 && text.right <= Math.min(right, box.right) + 1 };
    });
    const overlaps = [];
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i].ink, b = leaves[j].ink;
      if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) overlaps.push([leaves[i].text, leaves[j].text]);
    }
    return { box: rect(root.getBoundingClientRect()), leaves, overlaps, documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
  });
  const png = await page.screenshot({ fullPage: true }); writeFileSync(resolve(dir, file), png, { flag: 'wx' });
  return { file, sha256: hash(png), ...geometry };
}
try {
  const lookup = await context.newPage(); await lookup.goto(`${baseUrl}/ingredients`, { waitUntil: 'networkidle' });
  await lookup.getByRole('button').filter({ hasText: '대파' }).first().click();
  await lookup.waitForURL(/\/ingredients\/[a-f0-9-]{36}$/);
  const id = new URL(lookup.url()).pathname.split('/').pop(); await lookup.close();
  const unitsOnly = args.has('--units-only');
  for (const kind of unitsOnly ? ['normal'] : ['normal', 'long']) for (const host of unitsOnly ? ['unit-ml', 'unit-box'] : ['list', 'detail', 'edit', 'unit']) for (const [width, height, factor] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
    fixtureKind = kind;
    const key = `${kind}-${host}-${width}-text${factor}`, page = await context.newPage();
    await page.setViewportSize({ width, height });
    page.on('pageerror', (e) => errors.push({ key, type: 'pageerror', message: e.message }));
    page.on('console', (e) => { if (e.type() === 'error') errors.push({ key, type: 'console', message: e.text() }); });
    const beforeSubstitution = substituted;
    const edit = host === 'edit' || host.startsWith('unit');
    await page.goto(`${baseUrl}/ingredients/${host === 'detail' ? id : `option?ingredient=${id}${edit ? `&option=${fixtures[kind][0].id}` : ''}`}`, { waitUntil: 'networkidle' });
    let roots;
    if (edit) {
      await page.getByLabel('옵션 이름', { exact: true }).waitFor();
      if (await page.getByLabel('옵션 이름', { exact: true }).inputValue() !== fixtures[kind][0].name) throw Error(`${key}: fixture not reflected`);
      await page.getByLabel('금액', { exact: true }).fill(kind === 'long' ? '1234567890' : '5000');
      if (host.startsWith('unit')) {
        const nextUnit = host === 'unit-ml' ? 'ml' : host === 'unit-box' ? '박스' : 'kg';
        await page.getByRole('button', { name: /^단위 .+ 변경$/ }).click();
        const sheet = page.locator('[aria-modal="true"]'); await sheet.waitFor();
        await sheet.getByRole('button', { name: nextUnit, exact: true }).click(); await sheet.waitFor({ state: 'hidden' });
        roots = [page.getByRole('button', { name: `단위 ${nextUnit} 변경` }).locator('..')];
      } else roots = [page.getByRole('button', { name: '저장', exact: true }).locator('..')];
    } else {
      roots = fixtures[kind].map((o) => page.getByRole('button', { name: `${o.name} 수정`, exact: true }));
      await roots[0].waitFor();
    }
    if (substituted === beforeSubstitution) throw Error(`${key}: no response substituted`);
    const scaling = await scale(page, factor), shots = [];
    for (const [i, root] of roots.entries()) { await root.scrollIntoViewIfNeeded(); shots.push(await snap(page, root, `${key}-${i}.png`)); }
    rows.push({ key, kind, host, width, height, scaling, shots, submitted: false }); await page.close();
  }
  clean();
  const evidence = { schemaVersion: 1, sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))), browserVersion: browser.version(), fixtures,
    scope: 'ING06 list/edit/unit and ING03 option rows; synthetic options over live read-only ingredient detail. No writes/native/IME/final approval. Geometry is diagnostic; no count threshold hides findings. Server bundle provenance requires operator restart after product edits.', rows, errors, blocked, substituted, rpcCalls: [...rpcCalls] };
  writeFileSync(resolve(dir, 'option-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ rows: rows.length, errors, blocked, diagnostics: rows.map((r) => ({ key: r.key, clipped: r.shots.flatMap((s) => s.leaves.filter((l) => !l.horizontalFits).map((l) => l.text)), overlaps: r.shots.flatMap((s) => s.overlaps) })), output: dir }));
  if (errors.length || blocked.length || rows.some((r) => r.scaling.mismatches || r.scaling.fonts.some((f) => !f.loaded))) process.exitCode = 1;
} catch (error) {
  writeFileSync(resolve(dir, 'option-failed.json'), `${JSON.stringify({ status: 'FAILED', sourceCommit: expected, message: String(error), rows, errors, blocked }, null, 2)}\n`, { flag: 'wx' });
  console.error(String(error)); process.exitCode = 1;
} finally { await browser.close(); }
