import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium } from 'playwright';

const args = new Map(process.argv.slice(2).map((part) => {
  const [key, ...value] = part.split('=');
  return [key, value.join('=')];
}));

const baseUrl = args.get('--base-url') ?? 'http://127.0.0.1:8090';
const outputDir = resolve(args.get('--output') ?? 'docs/prototypes/three-surface-p3-ingredient-visual/after');
const expectedCommit = args.get('--expect-commit');
const viewport = {
  width: Number(args.get('--width') ?? 390),
  height: Number(args.get('--height') ?? 844),
};
const textScale = Number(args.get('--text-scale') ?? 1);
if (![1, 2].includes(textScale) || !Object.values(viewport).every((value) => Number.isInteger(value) && value >= 240))
  throw new Error('width/height는 240 이상 정수, text-scale은 1 또는 2여야 합니다.');
if (existsSync(resolve(outputDir, 'render-evidence.json'))) throw new Error('기존 측정 증거를 덮어쓸 수 없습니다. 새 output 경로를 사용하세요.');

if (!/^[0-9a-f]{40}$/.test(expectedCommit ?? '')) throw new Error('--expect-commit=<40자리 SHA>가 필요합니다.');

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== expectedCommit) throw new Error(`HEAD 불일치: expected=${expectedCommit} actual=${head}`);
const trackedDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
if (trackedDirty) throw new Error(`추적 파일이 수정된 상태에서는 증거를 만들 수 없습니다.\n${trackedDirty}`);

const registry = JSON.parse(readFileSync(resolve('apps/mobile/src/dev/surfaceRegistry.generated.json'), 'utf8'));
const ingredientSurfaceIds = registry.surfaces.filter(({ domain }) => domain === 'ingredients').map(({ screenId }) => screenId).sort();

const surfaces = [
  { screenId: 'ING-01', path: () => '/ingredients', markers: ['식재료', '추천순', '대파'] },
  { screenId: 'ING-02', path: () => '/ingredients/add', markers: ['식재료 추가', '식재료명', '카테고리 선택'] },
  { screenId: 'ING-03', path: (id) => `/ingredients/${id}`, markers: ['대파', '기준 단가', '현재 재고'] },
  { screenId: 'ING-03b', path: (id) => `/ingredients/add-stock/${id}`, markers: ['재고 추가', '구매한 곳 · 옵션'] },
  { screenId: 'ING-04', path: (id) => `/ingredients/edit/${id}`, markers: ['식재료 수정', '농산(신선)'] },
  {
    screenId: 'ING-05',
    path: (id) => `/ingredients/${id}`,
    markers: ['대파 재고 수정', '수량 조정', '완전 소진', '폐기'],
    prepare: async (page) => {
      await page.getByRole('button', { name: '수정 메뉴 열기' }).click();
      await page.getByRole('button', { name: '재고 수정 (실사)' }).click();
      await page.getByText('대파 재고 수정').waitFor();
    },
  },
  { screenId: 'ING-06', path: (id) => `/ingredients/option?ingredient=${id}`, markers: ['구매 링크 · 옵션', '식자재쇼핑몰', '신동진 10kg', '구매 옵션 추가'] },
  { screenId: 'ING-07', path: (id) => `/ingredients/history/${id}`, markers: ['재고 내역', '현재 재고', '최근 3개월'] },
  {
    screenId: 'ING-08',
    path: (id) => `/ingredients/history/${id}`,
    markers: ['조회 설정', '기간', '유형', '정렬'],
    prepare: async (page) => {
      await page.getByRole('button', { name: '전체 변경' }).click();
      await page.getByText('조회 설정').waitFor();
    },
  },
  { screenId: 'ING-09', path: (id) => `/ingredients/purchases/${id}`, markers: ['구매 이력', '기준단가', '최근 3개월'] },
  { screenId: 'ING-10', path: (id) => `/ingredients/discards/${id}`, markers: ['폐기 내역', '전체 합계', '최근 3개월'] },
  { screenId: 'ING-11', path: (id) => `/ingredients/changes/${id}`, markers: ['수정 내역', '직접 수정', '자동 갱신'] },
];

const expectedIds = surfaces.map(({ screenId }) => screenId).sort();
if (JSON.stringify(ingredientSurfaceIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`레지스트리와 캡처 목록 불일치\nregistry=${ingredientSurfaceIds.join(',')}\ncapture=${expectedIds.join(',')}`);
}

mkdirSync(outputDir, { recursive: true });
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport, locale: 'ko-KR' });
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => pageErrors.push(error.message));

async function goto(path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(500);
}

async function prepareMeasurement() {
  return page.evaluate(async (factor) => {
    await Promise.all([400, 500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px PretendardApp`, '식자재 0123456789')));
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map((animation) => animation.finished.catch(() => {})));
    // All states are mounted BEFORE taking the baseline. Snapshot before writes prevents inherited
    // double scaling. This web approximation also scales explicit lineHeight; it is NOT native evidence.
    if (window.__p3CaptureScaled) throw new Error('같은 document를 두 번 확대할 수 없습니다.');
    window.__p3CaptureScaled = true;
    const baseline = [...document.querySelectorAll('*')].map((element) => {
      const style = getComputedStyle(element);
      return { element, size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
    }).filter(({ size }) => Number.isFinite(size));
    if (factor !== 1) for (const { element, size, lineHeight } of baseline) {
      element.style.setProperty('font-size', `${size * factor}px`, 'important');
      if (Number.isFinite(lineHeight)) element.style.setProperty('line-height', `${lineHeight * factor}px`, 'important');
    }
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const mismatches = baseline.flatMap(({ element, size, lineHeight }) => {
      const actual = getComputedStyle(element);
      return [
        { property: 'fontSize', expected: size * factor, actual: parseFloat(actual.fontSize) },
        ...(Number.isFinite(lineHeight) ? [{ property: 'lineHeight', expected: lineHeight * factor, actual: parseFloat(actual.lineHeight) }] : []),
      ].filter((value) => !Number.isFinite(value.actual) || Math.abs(value.actual - value.expected) > 0.05)
        .map((value) => ({ tag: element.tagName, ...value }));
    });
    return { factor, mode: factor === 1 ? 'normal' : 'font-and-explicit-line-height-times-two-web-approximation', elements: baseline.length, mismatches };
  }, textScale);
}

async function inspect() {
  return page.evaluate(async () => {
    const fontWeights = [400, 500, 600, 700, 800];
    await Promise.all(fontWeights.map((weight) => document.fonts.load(`${weight} 100px PretendardApp`, '식자재 0123456789')));
    const visible = [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const insideHorizontalScroller = (node) => {
      for (let current = node.parentElement; current; current = current.parentElement) {
        const overflowX = getComputedStyle(current).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      return false;
    };
    const bodyText = document.body.innerText.replace(/\n{3,}/g, '\n\n').trim();
    const textElements = visible.filter((node) => node.matches('input,textarea,[contenteditable="true"]') || [...node.childNodes].some(
      (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
    ));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const faceWidths = Object.fromEntries(fontWeights.map((weight) => {
      if (!context) return [weight, null];
      context.font = `${weight} 100px PretendardApp`;
      return [weight, context.measureText('식자재 0123456789').width];
    }));
    return {
      bodyText,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      viewportEscapees: visible.filter((node) => {
        if (insideHorizontalScroller(node)) return false;
        const rect = node.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > innerWidth + 0.5;
      }).map((node) => ({ tag: node.tagName, text: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) })),
      nestedButtons: document.querySelectorAll('button button, [role="button"] [role="button"]').length,
      fontContract: {
        checks: Object.fromEntries(fontWeights.map((weight) => [weight, document.fonts.check(`${weight} 16px PretendardApp`)])),
        faceWidths,
        visibleFamilies: [...new Set(textElements.map((node) => getComputedStyle(node).fontFamily))],
        visibleWeights: [...new Set(textElements.map((node) => getComputedStyle(node).fontWeight))].sort(),
      },
    };
  });
}

try {
  await goto('/ingredients');
  await page.getByRole('button', { name: '대파 상세' }).click();
  await page.waitForLoadState('networkidle');
  const ingredientId = new URL(page.url()).pathname.split('/').pop();
  if (!ingredientId) throw new Error('대파 식재료 ID를 찾지 못했습니다.');

  await goto('/ingredients');
  await page.getByRole('button', { name: '쌀 상세' }).click();
  await page.waitForLoadState('networkidle');
  const optionIngredientId = new URL(page.url()).pathname.split('/').pop();
  if (!optionIngredientId) throw new Error('채워진 구매 옵션 증거용 쌀 식재료 ID를 찾지 못했습니다.');

  const rows = [];
  for (const surface of surfaces) {
    const errorStart = { console: consoleErrors.length, page: pageErrors.length };
    await goto(surface.path(surface.screenId === 'ING-06' ? optionIngredientId : ingredientId));
    if (surface.prepare) await surface.prepare(page);
    const scaling = await prepareMeasurement();
    const inspected = await inspect();
    const screenshotPath = resolve(outputDir, `${surface.screenId}.png`);
    await page.screenshot({ path: screenshotPath, animations: 'disabled' });
    const markerResults = Object.fromEntries(surface.markers.map((marker) => [marker, inspected.bodyText.includes(marker)]));
    rows.push({
      screenId: surface.screenId,
      scaling,
      route: new URL(page.url()).pathname + new URL(page.url()).search,
      requiredMarkers: markerResults,
      bodyText: inspected.bodyText,
      bodyTextSha256: sha256(Buffer.from(inspected.bodyText, 'utf8')),
      screenshot: `${surface.screenId}.png`,
      screenshotSha256: sha256(readFileSync(screenshotPath)),
      documentOverflow: inspected.documentOverflow,
      viewportEscapees: inspected.viewportEscapees,
      nestedButtons: inspected.nestedButtons,
      fontContract: inspected.fontContract,
      consoleErrors: consoleErrors.slice(errorStart.console),
      pageErrors: pageErrors.slice(errorStart.page),
    });
  }

  const interactions = [];
  async function captureInteraction({ stateId, path, prepare, markers }) {
    const errorStart = { console: consoleErrors.length, page: pageErrors.length };
    await goto(path);
    await prepare();
    const scaling = await prepareMeasurement();
    const inspected = await inspect();
    const screenshot = `${stateId}.png`;
    const screenshotPath = resolve(outputDir, screenshot);
    await page.screenshot({ path: screenshotPath, animations: 'disabled' });
    interactions.push({
      stateId,
      scaling,
      route: new URL(page.url()).pathname + new URL(page.url()).search,
      requiredMarkers: Object.fromEntries(markers.map((marker) => [marker, inspected.bodyText.includes(marker)])),
      bodyText: inspected.bodyText,
      bodyTextSha256: sha256(Buffer.from(inspected.bodyText, 'utf8')),
      screenshot,
      screenshotSha256: sha256(readFileSync(screenshotPath)),
      documentOverflow: inspected.documentOverflow,
      viewportEscapees: inspected.viewportEscapees,
      nestedButtons: inspected.nestedButtons,
      fontContract: inspected.fontContract,
      consoleErrors: consoleErrors.slice(errorStart.console),
      pageErrors: pageErrors.slice(errorStart.page),
    });
  }

  const openStockEdit = async () => {
    await page.getByRole('button', { name: '수정 메뉴 열기' }).click();
    await page.getByRole('button', { name: '재고 수정 (실사)' }).click();
    await page.getByText('대파 재고 수정').waitFor();
  };

  await captureInteraction({
    stateId: 'ING-03-action-menu',
    path: `/ingredients/${ingredientId}`,
    prepare: async () => {
      await page.getByRole('button', { name: '수정 메뉴 열기' }).click();
      await page.getByRole('button', { name: '재고 수정 (실사)' }).waitFor();
    },
    markers: ['식재료 수정', '재고 추가 (입고)', '재고 수정 (실사)', '식재료 삭제', '닫기'],
  });
  await captureInteraction({
    stateId: 'ING-05-out',
    path: `/ingredients/${ingredientId}`,
    prepare: async () => {
      await openStockEdit();
      await page.getByRole('tab', { name: '완전 소진' }).click();
    },
    markers: ['대파 재고 수정', '완전 소진', '0kg', '사유 (선택)'],
  });
  await captureInteraction({
    stateId: 'ING-05-waste',
    path: `/ingredients/${ingredientId}`,
    prepare: async () => {
      await openStockEdit();
      await page.getByRole('tab', { name: '폐기' }).click();
    },
    markers: ['대파 재고 수정', '폐기 수량', '폐기 후 재고', '사유 (선택)'],
  });
  await captureInteraction({
    stateId: 'ING-06-action-menu',
    path: `/ingredients/option?ingredient=${optionIngredientId}`,
    prepare: async () => {
      await page.getByRole('button', { name: /수정$/ }).first().click();
      await page.getByRole('button', { name: '더보기' }).click();
      await page.getByRole('button', { name: '구매 옵션 삭제' }).waitFor();
    },
    markers: ['삭제', '닫기'],
  });
  await captureInteraction({
    stateId: 'ING-10-type-sheet',
    path: `/ingredients/discards/${ingredientId}`,
    prepare: async () => {
      await page.getByRole('button', { name: '전체 변경' }).click();
      await page.getByText('유형', { exact: true }).waitFor();
    },
    markers: ['유형', '전체', '조리 전 폐기', '조리 후 폐기'],
  });

  const violations = [...rows, ...interactions].flatMap((row) => {
    const findings = [];
    if (row.scaling.mismatches.length) findings.push(`textScaleMismatches:${row.scaling.mismatches.length}`);
    for (const [marker, present] of Object.entries(row.requiredMarkers)) if (!present) findings.push(`marker:${marker}`);
    if (row.documentOverflow !== 0) findings.push(`documentOverflow:${row.documentOverflow}`);
    if (row.viewportEscapees.length) findings.push(`viewportEscapees:${row.viewportEscapees.length}`);
    if (row.nestedButtons !== 0) findings.push(`nestedButtons:${row.nestedButtons}`);
    if (Object.values(row.fontContract.checks).some((value) => !value)) findings.push('fontChecksFailed');
    const widths = Object.values(row.fontContract.faceWidths);
    if (new Set(widths).size !== widths.length) findings.push('fontFacesNotDistinct');
    if (row.fontContract.visibleFamilies.some((family) => !family.includes('PretendardApp'))) findings.push('fontFamilyFallback');
    if (row.consoleErrors.length) findings.push(`consoleErrors:${row.consoleErrors.length}`);
    if (row.pageErrors.length) findings.push(`pageErrors:${row.pageErrors.length}`);
    return findings.map((finding) => ({ screenId: row.screenId ?? row.stateId, finding }));
  });

  const finalHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const finalDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
  if (finalHead !== head || finalDirty) violations.push({ screenId: 'source', finding: '측정 중 HEAD 또는 추적 파일 변경' });
  const evidence = {
    schemaVersion: 2,
    sourceCommit: head,
    scriptSha256: sha256(readFileSync(new URL(import.meta.url))),
    baseUrl,
    viewport,
    textScale,
    browserVersion: browser.version(),
    scope: '17 ingredient ready/selected states; horizontal bounds, mounted text scaling, fonts, markers and errors only. Not full vertical reachability, translation, native touch or final parity approval.',
    ingredientId,
    optionIngredientId,
    registrySurfaceCount: ingredientSurfaceIds.length,
    capturedSurfaceCount: rows.length,
    interactionStates: Object.fromEntries(interactions.map((state) => [state.stateId, state])),
    rows,
    violations,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
  };
  writeFileSync(resolve(outputDir, 'render-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ sourceCommit: head, captured: rows.length, violations, status: evidence.status }, null, 2));
  if (violations.length) process.exitCode = 1;
} finally {
  await browser.close();
}
