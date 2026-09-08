import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium } from 'playwright';

const args = new Map(process.argv.slice(2).map((part) => {
  const [key, ...value] = part.split('=');
  return [key, value.join('=')];
}));

const baseUrl = args.get('--base-url') ?? 'http://127.0.0.1:8090';
const outputDir = resolve(args.get('--output') ?? 'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P3-INGREDIENTS-001/visual/after');
const expectedCommit = args.get('--expect-commit');

if (!expectedCommit) throw new Error('--expect-commit=<40자리 SHA>가 필요합니다.');

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== expectedCommit) throw new Error(`HEAD 불일치: expected=${expectedCommit} actual=${head}`);
const trackedDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
if (trackedDirty) throw new Error(`추적 파일이 수정된 상태에서는 증거를 만들 수 없습니다.\n${trackedDirty}`);

const registry = JSON.parse(readFileSync(resolve('apps/mobile/src/dev/surfaceRegistry.generated.json'), 'utf8'));
const ingredientSurfaceIds = registry.surfaces.filter(({ domain }) => domain === 'ingredients').map(({ screenId }) => screenId).sort();

const surfaces = [
  { screenId: 'ING-01', path: () => '/ingredients', markers: ['식재료', '추천순', '대파'] },
  { screenId: 'ING-02', path: () => '/ingredients/add', markers: ['식재료 추가', '식재료명', '카테고리 선택', '⌄'] },
  { screenId: 'ING-03', path: (id) => `/ingredients/${id}`, markers: ['대파', '기준 단가', '현재 재고'] },
  { screenId: 'ING-03b', path: (id) => `/ingredients/add-stock/${id}`, markers: ['재고 추가', '구매한 곳 · 옵션', '⌄'] },
  { screenId: 'ING-04', path: (id) => `/ingredients/edit/${id}`, markers: ['식재료 수정', '농산(신선)', '⌄'] },
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
  { screenId: 'ING-07', path: (id) => `/ingredients/history/${id}`, markers: ['재고 내역', '현재 재고', '최근 3개월', '⌄'] },
  {
    screenId: 'ING-08',
    path: (id) => `/ingredients/history/${id}`,
    markers: ['조회 설정', '기간', '유형', '정렬'],
    prepare: async (page) => {
      await page.getByRole('button', { name: '전체 변경' }).click();
      await page.getByText('조회 설정').waitFor();
    },
  },
  { screenId: 'ING-09', path: (id) => `/ingredients/purchases/${id}`, markers: ['구매 이력', '기준단가', '최근 3개월', '⌄'] },
  { screenId: 'ING-10', path: (id) => `/ingredients/discards/${id}`, markers: ['폐기 내역', '전체 합계', '최근 3개월', '⌄'] },
  { screenId: 'ING-11', path: (id) => `/ingredients/changes/${id}`, markers: ['수정 내역', '직접 수정', '자동 갱신'] },
];

const expectedIds = surfaces.map(({ screenId }) => screenId).sort();
if (JSON.stringify(ingredientSurfaceIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`레지스트리와 캡처 목록 불일치\nregistry=${ingredientSurfaceIds.join(',')}\ncapture=${expectedIds.join(',')}`);
}

mkdirSync(outputDir, { recursive: true });
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => pageErrors.push(error.message));

async function goto(path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(500);
}

async function inspect() {
  return page.evaluate(() => {
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
    return {
      bodyText,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      viewportEscapees: visible.filter((node) => {
        if (insideHorizontalScroller(node)) return false;
        const rect = node.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > innerWidth + 0.5;
      }).map((node) => ({ tag: node.tagName, text: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) })),
      nestedButtons: document.querySelectorAll('button button, [role="button"] [role="button"]').length,
      selectionArrowCount: visible.filter((node) => node.children.length === 0 && node.textContent?.trim() === '⌄').length,
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
    await page.waitForTimeout(300);
    const inspected = await inspect();
    const screenshotPath = resolve(outputDir, `${surface.screenId}.png`);
    await page.screenshot({ path: screenshotPath });
    const markerResults = Object.fromEntries(surface.markers.map((marker) => [marker, inspected.bodyText.includes(marker)]));
    rows.push({
      screenId: surface.screenId,
      route: new URL(page.url()).pathname + new URL(page.url()).search,
      requiredMarkers: markerResults,
      bodyText: inspected.bodyText,
      bodyTextSha256: sha256(Buffer.from(inspected.bodyText, 'utf8')),
      screenshot: `${surface.screenId}.png`,
      screenshotSha256: sha256(readFileSync(screenshotPath)),
      documentOverflow: inspected.documentOverflow,
      viewportEscapees: inspected.viewportEscapees,
      nestedButtons: inspected.nestedButtons,
      selectionArrowCount: inspected.selectionArrowCount,
      consoleErrors: consoleErrors.slice(errorStart.console),
      pageErrors: pageErrors.slice(errorStart.page),
    });
  }

  await goto(`/ingredients/${ingredientId}`);
  await page.getByRole('button', { name: '수정 메뉴 열기' }).click();
  await page.getByRole('button', { name: '재고 수정 (실사)' }).waitFor();
  const actionMenuPath = resolve(outputDir, 'ING-03-action-menu.png');
  await page.screenshot({ path: actionMenuPath });
  const actionMenu = await inspect();

  await goto(`/ingredients/option?ingredient=${optionIngredientId}`);
  await page.getByRole('button', { name: /수정$/ }).first().click();
  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: '구매 옵션 삭제' }).waitFor();
  await page.waitForTimeout(500);
  const optionActionMenuPath = resolve(outputDir, 'ING-06-action-menu.png');
  await page.screenshot({ path: optionActionMenuPath });
  const optionActionMenu = await inspect();

  const violations = rows.flatMap((row) => {
    const findings = [];
    for (const [marker, present] of Object.entries(row.requiredMarkers)) if (!present) findings.push(`marker:${marker}`);
    if (row.documentOverflow !== 0) findings.push(`documentOverflow:${row.documentOverflow}`);
    if (row.viewportEscapees.length) findings.push(`viewportEscapees:${row.viewportEscapees.length}`);
    if (row.nestedButtons !== 0) findings.push(`nestedButtons:${row.nestedButtons}`);
    if (row.consoleErrors.length) findings.push(`consoleErrors:${row.consoleErrors.length}`);
    if (row.pageErrors.length) findings.push(`pageErrors:${row.pageErrors.length}`);
    return findings.map((finding) => ({ screenId: row.screenId, finding }));
  });

  for (const [stateId, state, markers] of [
    ['ING-03-action-menu', actionMenu, ['식재료 수정', '재고 추가 (입고)', '재고 수정 (실사)', '식재료 삭제', '닫기']],
    ['ING-06-action-menu', optionActionMenu, ['삭제', '닫기']],
  ]) {
    for (const marker of markers) if (!state.bodyText.includes(marker)) violations.push({ screenId: stateId, finding: `marker:${marker}` });
    if (state.nestedButtons !== 0) violations.push({ screenId: stateId, finding: `nestedButtons:${state.nestedButtons}` });
  }

  const evidence = {
    schemaVersion: 1,
    sourceCommit: head,
    baseUrl,
    viewport: { width: 390, height: 844 },
    ingredientId,
    optionIngredientId,
    registrySurfaceCount: ingredientSurfaceIds.length,
    capturedSurfaceCount: rows.length,
    interactionStates: {
      ingredientActionMenu: {
        screenshot: 'ING-03-action-menu.png',
        screenshotSha256: sha256(readFileSync(actionMenuPath)),
        requiredMarkers: {
          '식재료 수정': actionMenu.bodyText.includes('식재료 수정'),
          '재고 추가 (입고)': actionMenu.bodyText.includes('재고 추가 (입고)'),
          '재고 수정 (실사)': actionMenu.bodyText.includes('재고 수정 (실사)'),
          '식재료 삭제': actionMenu.bodyText.includes('식재료 삭제'),
          '닫기': actionMenu.bodyText.includes('닫기'),
        },
        nestedButtons: actionMenu.nestedButtons,
      },
      purchaseOptionActionMenu: {
        screenshot: 'ING-06-action-menu.png',
        screenshotSha256: sha256(readFileSync(optionActionMenuPath)),
        requiredMarkers: {
          '삭제': optionActionMenu.bodyText.includes('삭제'),
          '닫기': optionActionMenu.bodyText.includes('닫기'),
        },
        nestedButtons: optionActionMenu.nestedButtons,
      },
    },
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
