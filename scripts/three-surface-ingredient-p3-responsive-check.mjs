import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Web-only regression evidence. This is not Android/iOS touch or font-scale evidence.
// The server must already serve the exact checked-out UI. No product writes are performed.
const args = new Map(process.argv.slice(2).map((part) => {
  const [key, ...value] = part.split('=');
  return [key, value.join('=')];
}));
const baseUrl = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const outputDir = resolve(args.get('--output') ?? 'docs/prototypes/three-surface-p3-ingredient-visual/responsive');
const expectedCommit = args.get('--expect-commit');
// RN also scales explicit lineHeight. Keep the old font-only stress available separately;
// neither browser mode proves native SP scaling, keyboard avoidance, or native touch geometry.
const scaleLineHeight = args.get('--scale-line-height') === 'true';
if (!/^[0-9a-f]{40}$/.test(expectedCommit ?? '')) throw new Error('--expect-commit=<40자리 SHA>가 필요합니다.');
const git = (...parts) => execFileSync('git', parts, { encoding: 'utf8' }).trim();
const sourceCommit = git('rev-parse', 'HEAD');
if (sourceCommit !== expectedCommit) throw new Error(`HEAD 불일치: ${sourceCommit}`);
const dirty = git('status', '--porcelain', '--untracked-files=no');
if (dirty) throw new Error(`추적 파일이 변경돼 있습니다.\n${dirty}`);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 720 }, locale: 'ko-KR' });
page.setDefaultTimeout(15_000);
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => pageErrors.push(error.message));
const checks = [];
const requireTrue = (value, message) => { if (!value) throw new Error(message); };

async function settle() {
  await page.evaluate(async () => {
    await Promise.all([400, 500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px PretendardApp`, '식자재 0123456789')));
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((animation) => {
      const end = animation.effect?.getComputedTiming().endTime;
      return typeof end === 'number' && Number.isFinite(end);
    }).map((animation) => animation.finished.catch(() => {})));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function goto(path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await settle();
}

async function textOnly2() {
  const result = await page.evaluate((includeLineHeight) => {
    if (window.__p3ResponsiveScaled) throw new Error('한 document에 글자 확대를 두 번 적용할 수 없습니다.');
    window.__p3ResponsiveScaled = true;
    // Snapshot every baseline before the first style write. Includes input/textarea values and placeholders.
    const baseline = [...document.querySelectorAll('*')].map((element) => {
      const computed = getComputedStyle(element);
      return { element, size: parseFloat(computed.fontSize), lineHeight: parseFloat(computed.lineHeight) };
    }).filter(({ size }) => Number.isFinite(size));
    for (const { element, size, lineHeight } of baseline) {
      element.style.setProperty('font-size', `${size * 2}px`, 'important');
      if (includeLineHeight && Number.isFinite(lineHeight)) element.style.setProperty('line-height', `${lineHeight * 2}px`, 'important');
    }
    const mismatches = baseline.flatMap(({ element, size, lineHeight }) => {
      const actual = parseFloat(getComputedStyle(element).fontSize);
      const actualLineHeight = parseFloat(getComputedStyle(element).lineHeight);
      if (includeLineHeight && Number.isFinite(lineHeight) && Math.abs(actualLineHeight - lineHeight * 2) > 0.05)
        return [{ tag: element.tagName, property: 'lineHeight', baseline: lineHeight, expected: lineHeight * 2, actual: actualLineHeight }];
      return Math.abs(actual - size * 2) > 0.05
        ? [{ tag: element.tagName, baseline: size, expected: size * 2, actual }]
        : [];
    });
    return {
      mode: includeLineHeight ? 'font-and-explicit-line-height-times-two-web-approximation' : 'font-only-times-two-harsh-stress', measuredElements: baseline.length,
      inputElements: baseline.filter(({ element }) => element.matches('input,textarea,[contenteditable="true"]')).length,
      mismatches,
      fonts: Object.fromEntries([400, 500, 600, 700, 800].map((weight) => [weight, document.fonts.check(`${weight} 16px PretendardApp`)])),
    };
  }, scaleLineHeight);
  requireTrue(result.mismatches.length === 0, `글자 확대 오차 ${JSON.stringify(result.mismatches)}`);
  requireTrue(Object.values(result.fonts).every(Boolean), 'Pretendard face 적재 실패');
  await settle();
  return result;
}

async function geometry(locator, reveal = false) {
  if (reveal) await locator.scrollIntoViewIfNeeded();
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    let left = 0; let top = 0; let right = innerWidth; let bottom = innerHeight;
    const scrollers = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const box = parent.getBoundingClientRect();
      if (style.overflowX !== 'visible') { left = Math.max(left, box.left); right = Math.min(right, box.right); }
      if (style.overflowY !== 'visible') { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
      if (parent.scrollWidth > parent.clientWidth + 1 || parent.scrollHeight > parent.clientHeight + 1) {
        scrollers.push({ overflowX: style.overflowX, overflowY: style.overflowY, scrollLeft: parent.scrollLeft, scrollTop: parent.scrollTop, clientWidth: parent.clientWidth, clientHeight: parent.clientHeight, scrollWidth: parent.scrollWidth, scrollHeight: parent.scrollHeight });
      }
    }
    const x = rect.left + rect.width / 2; const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
      fullyVisible: rect.width > 0 && rect.height > 0 && rect.left >= left - 1 && rect.right <= right + 1 && rect.top >= top - 1 && rect.bottom <= bottom + 1,
      centerHitsTarget: hit === element || element.contains(hit), scrollers,
    };
  });
}

async function screenshot(name) {
  const path = resolve(outputDir, `${name}.png`);
  await page.screenshot({ path });
  return { file: `${name}.png`, sha256: sha256(readFileSync(path)) };
}

async function runCheck(id, run) {
  const consoleStart = consoleErrors.length; const errorStart = pageErrors.length;
  const record = { id, status: 'FAIL' };
  try { Object.assign(record, await run()); record.status = 'PASS'; }
  catch (error) { record.error = error.message; record.failureScreenshot = await screenshot(`${id}-failure`).catch(() => null); }
  record.consoleErrors = consoleErrors.slice(consoleStart);
  record.pageErrors = pageErrors.slice(errorStart);
  if (record.consoleErrors.length || record.pageErrors.length) record.status = 'FAIL';
  checks.push(record);
}

try {
  await goto('/ingredients');
  await page.getByRole('button', { name: '대파 상세', exact: true }).click();
  await page.waitForURL(/\/ingredients\/[^/]+$/);
  const ingredientId = new URL(page.url()).pathname.split('/').pop();
  requireTrue(Boolean(ingredientId), '식재료 ID 없음');

  for (const [index, label] of ['전체', '최근 3개월', '최신순'].entries()) {
    await runCheck(`ING-07-chip-${index + 1}`, async () => {
      await goto(`/ingredients/history/${ingredientId}`);
      const scale = await textOnly2();
      const chips = [];
      for (const name of ['전체', '최근 3개월', '최신순']) {
        const measured = await geometry(page.getByRole('button', { name: `${name} 변경`, exact: true }));
        chips.push({ label: name, ...measured });
        requireTrue(measured.fullyVisible && measured.centerHitsTarget, `${name} 칩이 읽기/클릭 영역 밖입니다.`);
      }
      const captured = await screenshot(`ING-07-chip-${index + 1}-text2`);
      await page.getByRole('button', { name: `${label} 변경`, exact: true }).click();
      await page.getByText('조회 설정', { exact: true }).waitFor({ state: 'visible' });
      return { scale, chips, clickedLabel: label, opensFilterSheet: true, screenshot: captured };
    });
  }

  async function openStockEdit(tab) {
    await goto(`/ingredients/${ingredientId}`);
    await page.getByRole('button', { name: '수정 메뉴 열기', exact: true }).click();
    await page.getByRole('button', { name: '재고 수정 (실사)', exact: true }).click();
    await page.getByText('대파 재고 수정', { exact: true }).waitFor({ state: 'visible' });
    await settle();
    if (tab !== '수량 조정') await page.getByRole('tab', { name: tab, exact: true }).click();
    await settle();
  }

  for (const [index, tab] of ['수량 조정', '완전 소진', '폐기'].entries()) {
    await runCheck(`ING-05-tab-${index + 1}`, async () => {
      // Tap test begins on another tab so aria-selected proves an actual state transition.
      await openStockEdit(tab === '수량 조정' ? '완전 소진' : '수량 조정');
      const selectionScale = await textOnly2();
      const target = page.getByRole('tab', { name: tab, exact: true });
      const tabGeometry = await geometry(target, true);
      requireTrue(tabGeometry.fullyVisible && tabGeometry.centerHitsTarget, `${tab} 탭을 스크롤해도 접근할 수 없습니다.`);
      await target.click();
      requireTrue(await target.getAttribute('aria-selected') === 'true', `${tab} 선택 반영 실패`);

      // New tab content mounts after the tap. A fresh document selects it BEFORE taking the baseline,
      // avoiding inherited double-scaling or leaving newly mounted inputs unscaled.
      await openStockEdit(tab);
      const contentScale = await textOnly2();
      const help = page.getByRole('button', { name: '재고 추가로 이동', exact: true });
      const helpGeometry = await geometry(help, true);
      requireTrue(helpGeometry.fullyVisible && helpGeometry.centerHitsTarget, `${tab} 본문 아래 입고 도움말에 도달할 수 없습니다.`);
      const action = { '수량 조정': '저장', '완전 소진': '소진 처리', '폐기': '폐기 처리' }[tab];
      const footer = [];
      for (const name of ['취소', action]) {
        const measured = await geometry(page.getByRole('button', { name, exact: true }));
        footer.push({ label: name, ...measured });
        requireTrue(measured.fullyVisible, `${tab}: ${name} 버튼이 viewport/부모 클리핑 영역 밖입니다.`);
      }
      // Deliberately never click save, consume, discard, or the inbound navigation action.
      return { tab, selectionScale, tabGeometry, selectedAfterTap: true, contentScale, helpGeometry, footer, screenshot: await screenshot(`ING-05-tab-${index + 1}-text2`) };
    });
  }

  await runCheck('ING-03-change-badge', async () => {
    await goto(`/ingredients/${ingredientId}`);
    const scale = await textOnly2();
    const badge = page.getByText('현재 매출에 반영 중', { exact: true });
    const measured = await geometry(badge, true);
    // Width=0 (a coloured empty dot) is not readable, even when nothing escapes the viewport.
    const firstGlyph = await badge.evaluate((element) => {
      const node = [...element.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
      if (!node) return { readable: false };
      const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 1);
      const glyph = range.getBoundingClientRect(); const box = element.getBoundingClientRect();
      return { readable: glyph.width > 0 && glyph.left >= box.left - 1 && glyph.right <= box.right + 1,
        glyphWidth: glyph.width, visibleTextWidth: box.width, label: element.textContent };
    });
    requireTrue(measured.fullyVisible && firstGlyph.readable, '최근 수정 배지가 빈 점/완전히 가린 텍스트가 됩니다.');
    return { scale, measured, firstGlyph, screenshot: await screenshot('ING-03-change-badge-text2') };
  });

  await runCheck('ING-03-base-price', async () => {
    await goto(`/ingredients/${ingredientId}`);
    const scale = await textOnly2();
    const groups = [];
    for (const label of ['가중평균', '최저', '최고']) {
      const group = page.getByText(label, { exact: true }).first().locator('..');
      const measured = await geometry(group, true);
      requireTrue(measured.fullyVisible, `${label} 값 그룹을 스크롤해도 볼 수 없습니다.`);
      groups.push({ label, ...measured, screenshot: await screenshot(`ING-03-base-price-${groups.length + 1}-text2`) });
    }
    return { scale, groups };
  });

  for (const mode of ['history', 'period']) {
    await runCheck(`ING-${mode === 'history' ? '08' : '10'}-date-scroll`, async () => {
      await goto(`/ingredients/${mode === 'history' ? 'history' : 'discards'}/${ingredientId}`);
      await page.getByRole('button', { name: mode === 'history' ? '전체 변경' : '최근 3개월 변경', exact: true }).click();
      await page.getByText(mode === 'history' ? '조회 설정' : '기간', { exact: true }).waitFor({ state: 'visible' });
      await settle();
      const scale = await textOnly2();
      const dates = page.getByText(/^\d{4}\.\d{2}\.\d{2}$/);
      requireTrue(await dates.count() === 2, '기간 시작/끝 날짜 두 개를 찾지 못했습니다.');
      const measuredDates = [];
      for (let i = 0; i < 2; i++) {
        const measured = await geometry(dates.nth(i), true);
        requireTrue(measured.fullyVisible, `기간 ${i + 1} 날짜가 클리핑됩니다.`);
        measuredDates.push({ text: await dates.nth(i).innerText(), ...measured });
      }
      if (mode === 'history') {
        const lastOption = await geometry(page.getByRole('button', { name: '오래된순', exact: true }), true);
        requireTrue(lastOption.fullyVisible && lastOption.centerHitsTarget, '마지막 정렬 옵션에 도달하지 못합니다.');
      }
      const footer = await geometry(page.getByRole('button', { name: mode === 'history' ? '조회' : '적용', exact: true }));
      requireTrue(footer.fullyVisible && footer.centerHitsTarget, '고정 하단 버튼에 접근할 수 없습니다.');
      // Do not submit the filter; this check is geometry/reachability, not a mutation test.
      return { scale, measuredDates, footer, screenshot: await screenshot(`ING-${mode}-date-scroll-text2`) };
    });
  }

  await runCheck('ING-01-names', async () => {
    await goto('/ingredients');
    const scale = await textOnly2();
    const names = [];
    for (const name of ['설탕', '고춧가루', '대파', '쌀']) {
      const text = page.getByRole('button', { name: `${name} 상세`, exact: true }).getByText(name, { exact: true });
      const measured = await geometry(text, true);
      const fits = await text.evaluate((element) => {
        const range = document.createRange(); range.selectNodeContents(element);
        const natural = range.getBoundingClientRect(); const box = element.getBoundingClientRect();
        return natural.width > 0 && natural.left >= box.left - 1 && natural.right <= box.right + 1;
      });
      requireTrue(measured.fullyVisible && fits, `${name} 식재료명이 소실되거나 잘립니다.`);
      names.push({ name, ...measured, fullNameFits: fits, screenshot: await screenshot(`ING-01-name-${names.length + 1}-text2`) });
    }
    return { scale, names };
  });

  await runCheck('ING-10-row-overlap', async () => {
    await goto(`/ingredients/discards/${ingredientId}`);
    const scale = await textOnly2();
    const rows = page.getByTestId('discard-history-row');
    requireTrue(await rows.count() > 0, '폐기 기록이 없어 중첩을 검사할 수 없습니다.');
    const measuredRows = [];
    for (const row of await rows.all()) {
      const badge = row.getByText(/^조리 (전|후)$/);
      const quantity = row.getByText(/^−/);
      await badge.scrollIntoViewIfNeeded();
      const badgeRect = await geometry(badge); const quantityRect = await geometry(quantity);
      const a = badgeRect.rect; const b = quantityRect.rect;
      const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
      const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
      requireTrue(badgeRect.fullyVisible && quantityRect.fullyVisible && overlapWidth * overlapHeight === 0, '폐기 배지/수량이 겹치거나 잘립니다.');
      measuredRows.push({ badge: badgeRect, quantity: quantityRect, overlapArea: overlapWidth * overlapHeight });
    }
    return { scale, measuredRows, screenshot: await screenshot('ING-10-row-overlap-text2') };
  });
} catch (error) {
  checks.push({ id: 'setup', status: 'FAIL', error: error.message });
} finally {
  const finalHead = git('rev-parse', 'HEAD');
  if (finalHead !== sourceCommit) checks.push({ id: 'source-commit', status: 'FAIL', error: `검사 중 HEAD 변경: ${finalHead}` });
  const result = {
    schemaVersion: 1, sourceCommit, scriptSha256: sha256(readFileSync(new URL(import.meta.url))),
    baseUrl, viewport: { width: 320, height: 720 }, platform: 'chromium-web',
    scope: 'ING-01 names, ING-07 chips, ING-05 tabs/body/footer, ING-03 badge/price, ING-08/10 dates/scroll end, ING-10 badge/quantity overlap; web only, not complete visual or native evidence',
    scaleLineHeight,
    browserVersion: browser.version(), checks, consoleErrors, pageErrors,
    status: checks.length === 12 && checks.every((check) => check.status === 'PASS') && !consoleErrors.length && !pageErrors.length ? 'PASS' : 'FAIL',
  };
  writeFileSync(resolve(outputDir, 'responsive-evidence.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ sourceCommit, status: result.status, checks: checks.map(({ id, status, error }) => ({ id, status, error })) }, null, 2));
  await browser.close();
  if (result.status !== 'PASS') process.exitCode = 1;
}
