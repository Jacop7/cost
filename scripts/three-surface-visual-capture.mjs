#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { compareResponsiveChecks, gitBlobOid } from './three-surface-visual-diff-check.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf('=');
  return index < 0 ? [arg, true] : [arg.slice(0, index), arg.slice(index + 1)];
}));
const baseUrl = String(args.get('--base-url') ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const outputRoot = resolve(repoRoot, String(args.get('--output') ?? '.tmp/three-surface-visual-capture'));
const manifestPath = resolve(repoRoot, String(args.get('--manifest') ?? 'docs/prototypes/three-surface-approved-visual-changes.json'));
const compare = !args.has('--no-compare');
const evidenceOnly = args.has('--evidence-only');
const updateSide = args.get('--update-side');
if (updateSide !== undefined && !['before', 'after'].includes(updateSide)) throw new Error('--update-side는 before 또는 after여야 한다.');

const screens = [
  { screenId: 'ING-01', route: '/ingredients', koreanTitle: '식재료', englishTitle: 'Ingredients' },
  { screenId: 'RCP-01', route: '/recipes', koreanTitle: '레시피', englishTitle: 'Menu recipes' },
  { screenId: 'ORD-01', route: '/orders', koreanTitle: '발주', englishTitle: 'Purchase orders' },
  { screenId: 'SALES-01', route: '/sales', koreanTitle: '매출관리', englishTitle: 'Sales management', englishSubtitle: 'Today · Sales overview' },
  { screenId: 'MY-01', route: '/my', koreanTitle: '마이페이지', englishTitle: 'My business settings', englishSubtitle: 'Manage defaults and business settings' },
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
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
try {
  for (const screen of screens) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'ko-KR' });
    const errors = await load(page, screen.route);
    const dir = resolve(outputRoot, screen.screenId);
    mkdirSync(dir, { recursive: true });
    const png = resolve(dir, 'ready.png');
    const tree = resolve(dir, 'ready.txt');
    const headerSelector = `[data-testid="${screen.screenId}/header"]`;
    let header = page.locator(headerSelector);
    if (await header.count() === 0) {
      await page.evaluate(({ koreanTitle, screenId }) => {
        const title = [...document.querySelectorAll('[dir=auto]')]
          .find((element) => element.textContent?.trim() === koreanTitle);
        if (!(title instanceof HTMLElement)) return;
        let candidate = title.parentElement;
        while (candidate?.parentElement) {
          const parent = candidate.parentElement;
          const rect = parent.getBoundingClientRect();
          if (rect.top > 1 || rect.height > 180) break;
          candidate = parent;
        }
        candidate?.setAttribute('data-testid', `${screenId}/header`);
      }, screen);
      header = page.locator(headerSelector);
    }
    if (await header.count() !== 1) throw new Error(`${screen.screenId}: header capture target를 하나로 정하지 못했다.`);
    await header.screenshot({ path: png });
    writeFileSync(tree, `${(await header.innerText()).replaceAll('\r\n', '\n').trim()}\n`);
    const entry = {
      screenId: screen.screenId,
      pngBlob: gitBlobOid(readFileSync(png)),
      treeBlob: gitBlobOid(readFileSync(tree)),
      ...errors,
    };
    result.screens.push(entry);
    const manifestScreen = manifest.screens.find(({ screenId }) => screenId === screen.screenId);
    const expected = manifestScreen?.after;
    if (compare && (entry.pngBlob !== expected?.pngBlob || entry.treeBlob !== expected?.treeBlob)) {
      result.failures.push(`${screen.screenId}: captured evidence differs from bound after evidence`);
    }
    if (updateSide) {
      const target = manifestScreen?.[updateSide];
      if (!target) throw new Error(`${screen.screenId}: manifest ${updateSide} record가 없다.`);
      writeFileSync(resolve(repoRoot, target.png), readFileSync(png));
      writeFileSync(resolve(repoRoot, target.tree), readFileSync(tree));
      target.pngBlob = entry.pngBlob;
      target.treeBlob = entry.treeBlob;
    }
    if (unexpectedErrors(screen.screenId, errors)) result.failures.push(`${screen.screenId}: browser errors`);
    await page.close();

    if (!evidenceOnly) for (const mode of modes) {
      const responsivePage = await browser.newPage({ viewport: { width: mode.width, height: 844 }, deviceScaleFactor: 1, locale: 'en-US' });
      const cdp = await responsivePage.context().newCDPSession(responsivePage);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: mode.safeTop, right: 0, bottom: 0, left: 0 } });
      const responsiveErrors = await load(responsivePage, screen.route);
      const geometry = await responsivePage.evaluate(async ({ screenId, englishTitle, englishSubtitle, textScale, safeTop }) => {
        const header = [...document.querySelectorAll('[data-testid]')]
          .find((element) => element.getAttribute('data-testid') === `${screenId}/header`);
        if (!(header instanceof HTMLElement)) return { missing: true };
        const texts = [...header.querySelectorAll('[dir=auto]')].filter((element) => element instanceof HTMLElement);
        let nonNumericLineHeights = 0;
        let textScaleMismatches = 0;
        if (textScale === 2) {
          if (texts[0]) texts[0].textContent = englishTitle;
          if (texts[1] && englishSubtitle) texts[1].textContent = englishSubtitle;
          for (const text of texts) {
            const style = getComputedStyle(text);
            const fontSize = Number.parseFloat(style.fontSize);
            const lineHeight = Number.parseFloat(style.lineHeight);
            if (!Number.isFinite(lineHeight)) { nonNumericLineHeights += 1; continue; }
            text.dataset.baseFontSize = String(fontSize);
            text.dataset.baseLineHeight = String(lineHeight);
            text.style.setProperty('font-size', `${fontSize * textScale}px`, 'important');
            text.style.setProperty('line-height', `${lineHeight * textScale}px`, 'important');
            text.style.whiteSpace = 'normal';
          }
        }
        await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        if (textScale === 2) for (const text of texts) {
          const style = getComputedStyle(text);
          const expectedFont = Number(text.dataset.baseFontSize) * textScale;
          const expectedLine = Number(text.dataset.baseLineHeight) * textScale;
          if (Math.abs(Number.parseFloat(style.fontSize) - expectedFont) > 0.01
            || Math.abs(Number.parseFloat(style.lineHeight) - expectedLine) > 0.01) textScaleMismatches += 1;
        }
        const rect = header.getBoundingClientRect();
        const descendants = [...header.querySelectorAll('*')];
        const escapees = descendants.filter((element) => {
          const item = element.getBoundingClientRect();
          return item.left < -0.5 || item.right > innerWidth + 0.5;
        }).length;
        const verticalEscapees = descendants.filter((element) => {
          const item = element.getBoundingClientRect();
          return item.top < rect.top - 0.5 || item.bottom > rect.bottom + 0.5;
        }).length;
        const textRects = texts.map((element) => element.getBoundingClientRect());
        const actionRects = [...header.querySelectorAll('[role=button]')].map((element) => element.getBoundingClientRect());
        const overlaps = textRects.reduce((count, textRect) => count + actionRects.filter((actionRect) =>
          textRect.left < actionRect.right && textRect.right > actionRect.left
          && textRect.top < actionRect.bottom && textRect.bottom > actionRect.top).length, 0);
        return {
          headerHeight: Math.round(rect.height),
          safeTop: Math.round(Number.parseFloat(getComputedStyle(header).paddingTop)),
          documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          escapees,
          verticalEscapees,
          overlaps,
          nonNumericLineHeights,
          textScaleMismatches,
        };
      }, { screenId: screen.screenId, englishTitle: screen.englishTitle, englishSubtitle: screen.englishSubtitle, textScale: mode.textScale, safeTop: mode.safeTop });
      const check = { screenId: screen.screenId, mode: mode.mode, ...geometry };
      result.responsiveChecks.push(check);
      if (geometry.missing || geometry.safeTop !== mode.safeTop || geometry.documentOverflow !== 0 || geometry.escapees !== 0
        || geometry.verticalEscapees !== 0 || geometry.overlaps !== 0 || geometry.nonNumericLineHeights !== 0 || geometry.textScaleMismatches !== 0
        || unexpectedErrors(screen.screenId, responsiveErrors)) {
        result.failures.push(`${screen.screenId}:${mode.mode}: responsive contract failed`);
      }
      await responsivePage.close();
    }
  }
  if (compare && !evidenceOnly) result.failures.push(...compareResponsiveChecks(result.responsiveChecks, manifest.responsiveChecks));
} finally {
  await browser.close();
}

if (updateSide) {
  if (updateSide === 'after') manifest.responsiveChecks = result.responsiveChecks;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(resolve(outputRoot, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
if (result.failures.length) {
  console.error(`three-surface visual capture: FAIL (${result.failures.length})`);
  for (const failure of result.failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(evidenceOnly
    ? 'three-surface visual capture: PASS (5 baseline hashes; responsive 검사 생략)'
    : 'three-surface visual capture: PASS (5 baseline hashes + responsive 20/20)');
}
