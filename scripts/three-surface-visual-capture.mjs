#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { gitBlobOid } from './three-surface-visual-diff-check.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf('=');
  return index < 0 ? [arg, true] : [arg.slice(0, index), arg.slice(index + 1)];
}));
const baseUrl = String(args.get('--base-url') ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const outputRoot = resolve(repoRoot, String(args.get('--output') ?? '.tmp/three-surface-visual-capture'));
const manifestPath = resolve(repoRoot, String(args.get('--manifest') ?? 'docs/prototypes/three-surface-approved-visual-changes.json'));
const compare = !args.has('--no-compare');

const screens = [
  { screenId: 'ING-01', route: '/ingredients', englishTitle: 'Ingredients' },
  { screenId: 'RCP-01', route: '/recipes', englishTitle: 'Menu recipes' },
  { screenId: 'ORD-01', route: '/orders', englishTitle: 'Purchase orders' },
  { screenId: 'SALES-01', route: '/sales', englishTitle: 'Sales management' },
  { screenId: 'MY-01', route: '/my', englishTitle: 'My business settings' },
];
const modes = [
  { mode: 'mobile320', width: 320, textScale: 1, safeTop: 0 },
  { mode: 'mobile320Text200English', width: 320, textScale: 2, safeTop: 0 },
  { mode: 'androidSafe24', width: 390, textScale: 1, safeTop: 24 },
  { mode: 'iosSafe47', width: 390, textScale: 1, safeTop: 47 },
];

async function load(page, route) {
  const consoleErrors = [];
  const pageErrors = [];
  const httpErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({ status: response.status(), path: new URL(response.url()).pathname });
  });
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(700);
  return { consoleErrors, pageErrors, httpErrors };
}

function unexpectedErrors(screenId, errors) {
  if (errors.consoleErrors.length === 0 && errors.pageErrors.length === 0 && errors.httpErrors.length === 0) return false;
  if (screenId !== 'MY-01') return true;
  const allowedMyPaths = new Set([
    '/rest/v1/rpc/get_user_preferences',
    '/rest/v1/rpc/international_tax_app_state',
    '/rest/v1/rpc/report_client_rpc_error',
  ]);
  const allowedHttp = errors.httpErrors.every(({ status, path }) => status === 404 && allowedMyPaths.has(path));
  const resourceOnly = errors.consoleErrors.every((message) => message === 'Failed to load resource: the server responded with a status of 404 (Not Found)');
  return errors.pageErrors.length > 0 || !allowedHttp || !resourceOnly || errors.consoleErrors.length !== errors.httpErrors.length;
}

const browser = await chromium.launch({ headless: true });
const result = { schemaVersion: 1, baseUrl, screens: [], responsiveChecks: [], failures: [] };
try {
  const manifest = compare ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  for (const screen of screens) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'ko-KR' });
    const errors = await load(page, screen.route);
    const dir = resolve(outputRoot, screen.screenId);
    mkdirSync(dir, { recursive: true });
    const png = resolve(dir, 'ready.png');
    const tree = resolve(dir, 'ready.txt');
    await page.screenshot({ path: png });
    writeFileSync(tree, (await page.locator('body').innerText()).replaceAll('\r\n', '\n'));
    const entry = {
      screenId: screen.screenId,
      pngBlob: gitBlobOid(readFileSync(png)),
      treeBlob: gitBlobOid(readFileSync(tree)),
      ...errors,
    };
    result.screens.push(entry);
    const expected = manifest?.screens.find(({ screenId }) => screenId === screen.screenId)?.after;
    if (compare && (entry.pngBlob !== expected?.pngBlob || entry.treeBlob !== expected?.treeBlob)) {
      result.failures.push(`${screen.screenId}: captured evidence differs from bound after evidence`);
    }
    if (unexpectedErrors(screen.screenId, errors)) result.failures.push(`${screen.screenId}: browser errors`);
    await page.close();

    for (const mode of modes) {
      const responsivePage = await browser.newPage({ viewport: { width: mode.width, height: 844 }, deviceScaleFactor: 1, locale: 'en-US' });
      const responsiveErrors = await load(responsivePage, screen.route);
      const geometry = await responsivePage.evaluate(({ screenId, englishTitle, textScale, safeTop }) => {
        const header = [...document.querySelectorAll('[data-testid]')]
          .find((element) => element.getAttribute('data-testid') === `${screenId}/header`);
        if (!(header instanceof HTMLElement)) return { missing: true };
        header.style.paddingTop = `${safeTop}px`;
        const texts = [...header.querySelectorAll('[dir=auto]')].filter((element) => element instanceof HTMLElement);
        if (textScale === 2) {
          if (texts[0]) texts[0].textContent = englishTitle;
          for (const text of texts) {
            const style = getComputedStyle(text);
            text.style.fontSize = `${Number.parseFloat(style.fontSize) * textScale}px`;
            text.style.lineHeight = `${Number.parseFloat(style.lineHeight) * textScale}px`;
            text.style.whiteSpace = 'normal';
          }
        }
        const rect = header.getBoundingClientRect();
        const escapees = [...header.querySelectorAll('*')].filter((element) => {
          const item = element.getBoundingClientRect();
          return item.left < -0.5 || item.right > innerWidth + 0.5;
        }).length;
        return {
          headerHeight: Math.round(rect.height),
          documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          escapees,
        };
      }, { screenId: screen.screenId, englishTitle: screen.englishTitle, textScale: mode.textScale, safeTop: mode.safeTop });
      const check = { screenId: screen.screenId, mode: mode.mode, ...geometry };
      result.responsiveChecks.push(check);
      if (geometry.missing || geometry.documentOverflow !== 0 || geometry.escapees !== 0
        || unexpectedErrors(screen.screenId, responsiveErrors)) {
        result.failures.push(`${screen.screenId}:${mode.mode}: responsive contract failed`);
      }
      await responsivePage.close();
    }
  }
} finally {
  await browser.close();
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(resolve(outputRoot, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
if (result.failures.length) {
  console.error(`three-surface visual capture: FAIL (${result.failures.length})`);
  for (const failure of result.failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('three-surface visual capture: PASS (5 baseline hashes + responsive 20/20)');
}
