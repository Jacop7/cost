import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Read-only live-data web diagnostic. Not native, exhaustive state coverage or approval.
const args = new Map(process.argv.slice(2).map((p) => { const [k, ...v] = p.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit');
const output = args.get('--output');
if (!/^[a-f0-9]{40}$/.test(expected ?? '') || !output) throw Error('Exact --expect-commit and a new --output are required');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const clean = () => { if (git('rev-parse', 'HEAD') !== expected || git('status', '--porcelain', '--untracked-files=no')) throw Error('Exact clean tracked HEAD required'); };
clean();
const dir = resolve(output);
if (existsSync(dir)) throw Error('Output already exists; preserve previous evidence');
mkdirSync(dir, { recursive: true });
const hash = (v) => createHash('sha256').update(v).digest('hex');
const browser = await chromium.launch({ headless: true });
const baseUrl = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const rows = [];
const errors = [];
const expanded = args.get('--expanded') === 'true';
async function leafGeometry(locator) {
  return locator.evaluate((root) => [...root.querySelectorAll('*')].filter((el) => el.children.length === 0 && el.textContent?.trim()).map((el) => {
    const box = el.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    let left = 0, right = innerWidth, top = 0, bottom = innerHeight;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p); const r = p.getBoundingClientRect();
      if (s.overflowX !== 'visible') { left = Math.max(left, r.left); right = Math.min(right, r.right); }
      if (s.overflowY !== 'visible') { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
    }
    return { text: el.textContent, fontSize: getComputedStyle(el).fontSize,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      horizontalTextFits: text.left >= Math.max(left, box.left) - 1 && text.right <= Math.min(right, box.right) + 1,
      verticallyVisible: text.top >= top - 1 && text.bottom <= bottom + 1 };
  }));
}
async function capture(page, file) {
  const png = await page.screenshot({ fullPage: true });
  writeFileSync(resolve(dir, file), png, { flag: 'wx' });
  return { screenshot: file, screenshotSha256: hash(png) };
}
try {
  for (const entity of ['ingredients', 'recipes']) {
    const lookup = await browser.newPage();
    await lookup.goto(`${baseUrl}/${entity}`, { waitUntil: 'networkidle' });
    const name = entity === 'ingredients' ? '대파' : '제육볶음';
    await lookup.getByRole('button').filter({ hasText: name }).first().click();
    await lookup.waitForURL(new RegExp(`/${entity}/[a-f0-9-]{36}$`));
    const id = new URL(lookup.url()).pathname.split('/').pop();
    await lookup.close();
    for (const [width, height, scale] of [[390, 844, 1], [320, 720, 1], [320, 720, 2]]) {
      const page = await browser.newPage({ viewport: { width, height }, locale: 'ko-KR' });
      page.on('pageerror', (e) => errors.push({ entity, width, scale, type: 'pageerror', message: e.message }));
      page.on('console', (e) => { if (e.type() === 'error') errors.push({ entity, width, scale, type: 'console', message: e.text() }); });
      await page.goto(`${baseUrl}/${entity}/changes/${id}`, { waitUntil: 'networkidle' });
      const events = page.getByRole('button', { name: /자세히 보기$/ });
      await events.first().waitFor();
      const applyScale = () => page.evaluate(async (factor) => {
        const weights = [400, 500, 600, 700, 800];
        await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px PretendardApp`, '식재료 0123456789')));
        await document.fonts.ready;
        const baseline = [...document.querySelectorAll('*')].map((el) => {
          const s = getComputedStyle(el); return { el, size: parseFloat(s.fontSize), height: parseFloat(s.lineHeight) };
        }).filter((v) => Number.isFinite(v.size));
        if (factor === 2) for (const { el, size, height } of baseline) {
          el.style.setProperty('font-size', `${size * 2}px`, 'important');
          if (Number.isFinite(height)) el.style.setProperty('line-height', `${height * 2}px`, 'important');
        }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { factor, mode: 'font-and-explicit-line-height-web-approximation',
          fonts: Object.fromEntries(weights.map((w) => [w, document.fonts.check(`${w} 16px PretendardApp`)])),
          mismatches: baseline.filter(({ el, size, height }) => {
            const s = getComputedStyle(el); return !el.isConnected || Math.abs(parseFloat(s.fontSize) - size * factor) > .05
              || (Number.isFinite(height) && Math.abs(parseFloat(s.lineHeight) - height * factor) > .05);
          }).length };
      }, scale);
      const scaling = await applyScale();
      const eventRows = await events.evaluateAll((elements) => elements.map((el) => {
        const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        const title = el.getAttribute('aria-label').replace(/ 자세히 보기$/, '');
        const titleNode = [...el.querySelectorAll('*')].find((n) => n.textContent === title && n.children.length === 0);
        const date = el.querySelector('[data-testid="change-history-date"]');
        return { title, text: el.textContent, rect: rect(el), titleRect: titleNode ? rect(titleNode) : null,
          dateText: date?.textContent ?? null, dateParts: date ? [...date.children].map((n) => ({ text: n.textContent, rect: rect(n) })) : [] };
      }));
      const prefix = `${entity}-${width}-text${scale}`;
      const png = await page.screenshot({ fullPage: true });
      writeFileSync(resolve(dir, `${prefix}.png`), png, { flag: 'wx' });
      const bodyText = await page.locator('body').innerText();
      const documentOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      const scrollRows = [];
      let detail = null;
      if (expanded) {
        // Initial loaded batch only: do not call this a pagination/full-history audit.
        const count = await events.count();
        for (let index = 0; index < count; index++) {
          const row = events.nth(index);
          await row.scrollIntoViewIfNeeded();
          scrollRows.push({ index, leaves: await leafGeometry(row), ...await capture(page, `${prefix}-row${index}.png`) });
        }
        // Reload so the modal and its host are scaled exactly once, after modal mounting.
        await page.reload({ waitUntil: 'networkidle' });
        await events.first().click();
        const sheet = page.locator('[aria-modal="true"]');
        await sheet.waitFor();
        await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {}))); });
        const detailScaling = await applyScale();
        const detailBody = await sheet.innerText();
        const detailLeaves = await leafGeometry(sheet);
        const detailStart = await capture(page, `${prefix}-detail.png`);
        // Last text leaf is used only to expose the bottom of the currently opened event.
        await sheet.evaluate((el) => {
          const texts = [...el.querySelectorAll('*')].filter((n) => n.children.length === 0 && n.textContent?.trim());
          texts.at(-1)?.scrollIntoView({ block: 'end' });
        });
        detail = { scaling: detailScaling, bodyText: detailBody, bodyTextSha256: hash(detailBody), leaves: detailLeaves,
          ...detailStart, end: { leaves: await leafGeometry(sheet), ...await capture(page, `${prefix}-detail-end.png`) } };
      }
      rows.push({ entity, id, width, height, scale, scaling, eventRows, bodyText, scrollRows, detail,
        screenshot: `${prefix}.png`, screenshotSha256: hash(png), bodyTextSha256: hash(bodyText),
        documentOverflow });
      await page.close();
    }
  }
  clean();
  const evidence = { schemaVersion: 2, sourceCommit: expected, scriptSha256: hash(readFileSync(new URL(import.meta.url))),
    baseUrl, browserVersion: browser.version(), expanded, scope: 'Live development data; two entities, three web viewport/font conditions. Expanded mode adds initial loaded event scrolls and first event detail start/end. Leaf geometry is diagnostic, not exhaustive readability, pagination, native or final approval.', rows, errors };
  writeFileSync(resolve(dir, 'change-history-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ rows: rows.length, errors: errors.length, sourceCommit: expected, output: dir }));
  if (errors.length || rows.some((r) => r.scaling.mismatches || Object.values(r.scaling.fonts).some((v) => !v) || r.documentOverflow
    || (r.detail && (r.detail.scaling.mismatches || Object.values(r.detail.scaling.fonts).some((v) => !v))))) process.exitCode = 1;
} finally { await browser.close(); }
