import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

import { chromium } from 'playwright';

const args = new Map(process.argv.slice(2).map((part) => {
  const [key, ...value] = part.split('=');
  return [key, value.join('=')];
}));
const outputDir = resolve(args.get('--output') ?? 'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-P3-INGREDIENTS-001/visual/prototype');
const expectedCommit = args.get('--expect-commit');
if (!expectedCommit) throw new Error('--expect-commit=<40자리 SHA>가 필요합니다.');

const root = resolve('.');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== expectedCommit) throw new Error(`HEAD 불일치: expected=${expectedCommit} actual=${head}`);
const trackedDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim();
if (trackedDirty) throw new Error(`추적 파일이 수정된 상태에서는 증거를 만들 수 없습니다.\n${trackedDirty}`);

const targets = [
  { screenId: 'ING-01', query: 'screen=ingredient_main', markers: ['식재료', '재고 적은순'] },
  { screenId: 'ING-02', query: 'screen=ingredient_add', markers: ['식재료 추가', '카테고리'] },
  { screenId: 'ING-03', query: 'screen=ingredient_detail', markers: ['고춧가루', '기준 단가', '재고'] },
  { screenId: 'ING-03b', query: 'screen=stock_change&popup=stock_inbound', markers: ['재고 수정', '구매처', '입고'] },
  { screenId: 'ING-04', query: 'screen=ingredient_edit', markers: ['식재료 수정', '개당 용량', '구매 단가'] },
  { screenId: 'ING-05', query: 'screen=stock_change&popup=stock_deduct', markers: ['재고 수정', '입고', '차감', '폐기'] },
  { screenId: 'ING-06', query: 'screen=options', markers: ['구매 링크', '최저', '최고'] },
  { screenId: 'ING-07', query: 'screen=stock', markers: ['재고 내역', '현재 재고'] },
  { screenId: 'ING-08', query: 'screen=stock&popup=stock_type', markers: ['유형', '전체', '입고', '폐기'] },
  { screenId: 'ING-09', query: 'screen=purchase', markers: ['구매 이력', '기준단가'] },
  { screenId: 'ING-10', query: 'screen=discard', markers: ['재고 내역', '폐기 합계', '조리 전', '조리 후'] },
  { screenId: 'ING-11', query: 'screen=ingredient_changes', markers: ['수정 내역', '직접 수정', '자동 갱신'] },
];
const referenceStates = [
  { stateId: 'ING-05-waste', query: 'screen=stock_change&popup=stock_discard', markers: ['재고 수정', '폐기할 수량', '폐기 사유'] },
];

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const requested = resolve(root, `.${pathname}`);
    if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const file = statSync(requested).isDirectory() ? resolve(requested, 'index.html') : requested;
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('임시 HTTP 서버 포트를 찾지 못했습니다.');
const prototypeUrl = `http://127.0.0.1:${address.port}/docs/prototypes/0_full-page-flow-prototype-ui-applied.html`;
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
// Expo 증거와 같은 390px 콘텐츠 폭. 프로토타입은 값 정본이 아니라 구조 참고지만,
// 폭까지 다르면 줄바꿈·밀도 차이가 구조 차이처럼 보이므로 비교 입력을 맞춘다.
const viewport = { width: 390, height: 1024 };
const page = await browser.newPage({ viewport, locale: 'ko-KR' });
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => pageErrors.push(error.message));

async function matchedPhone() {
  const phone = page.locator('.phone');
  await phone.waitFor();
  // Catalog header height varies with each screen's number of state tabs.
  // Resize only the surrounding browser so every captured phone is 390x844;
  // do not rewrite the prototype's CSS or discard overflow to obtain a pass.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const box = await phone.boundingBox();
    if (box && Math.abs(box.width - 390) < 0.5 && Math.abs(box.height - 844) < 0.5) return phone;
    if (!box || Math.abs(box.width - 390) >= 0.5) throw new Error('390px phone width mismatch');
    await page.setViewportSize({ width: 390, height: Math.round(page.viewportSize().height + 844 - box.height) });
  }
  throw new Error('844px phone height mismatch');
}

try {
  const rows = [];
  for (const target of targets) {
    const errorStart = { console: consoleErrors.length, page: pageErrors.length };
    await page.goto(`${prototypeUrl}?${target.query}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(250);
    const phone = await matchedPhone();
    const bodyText = (await phone.innerText()).replace(/\n{3,}/g, '\n\n').trim();
    const screenshotPath = resolve(outputDir, `${target.screenId}.png`);
    await phone.screenshot({ path: screenshotPath, animations: 'disabled' });
    rows.push({
      screenId: target.screenId,
      phoneBounds: await phone.boundingBox(),
      browserViewport: page.viewportSize(),
      prototypeQuery: target.query,
      requiredMarkers: Object.fromEntries(target.markers.map((marker) => [marker, bodyText.includes(marker)])),
      bodyText,
      bodyTextSha256: sha256(Buffer.from(bodyText, 'utf8')),
      screenshot: `${target.screenId}.png`,
      screenshotSha256: sha256(readFileSync(screenshotPath)),
      consoleErrors: consoleErrors.slice(errorStart.console),
      pageErrors: pageErrors.slice(errorStart.page),
    });
  }

  const states = [];
  for (const state of referenceStates) {
    const errorStart = { console: consoleErrors.length, page: pageErrors.length };
    await page.goto(`${prototypeUrl}?${state.query}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(250);
    const phone = await matchedPhone();
    const bodyText = (await phone.innerText()).replace(/\n{3,}/g, '\n\n').trim();
    const screenshotPath = resolve(outputDir, `${state.stateId}.png`);
    await phone.screenshot({ path: screenshotPath, animations: 'disabled' });
    states.push({
      ...state,
      phoneBounds: await phone.boundingBox(),
      browserViewport: page.viewportSize(),
      requiredMarkers: Object.fromEntries(state.markers.map((marker) => [marker, bodyText.includes(marker)])),
      bodyText,
      bodyTextSha256: sha256(Buffer.from(bodyText, 'utf8')),
      screenshot: `${state.stateId}.png`,
      screenshotSha256: sha256(readFileSync(screenshotPath)),
      consoleErrors: consoleErrors.slice(errorStart.console),
      pageErrors: pageErrors.slice(errorStart.page),
    });
  }

  const actionErrorStart = { console: consoleErrors.length, page: pageErrors.length };
  await page.goto(`${prototypeUrl}?screen=ingredient_edit_menu`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(400);
  const actionPhone = await matchedPhone();
  const actionBodyText = (await actionPhone.innerText()).replace(/\n{3,}/g, '\n\n').trim();
  const actionMenuPath = resolve(outputDir, 'ING-03-action-menu.png');
  await actionPhone.screenshot({ path: actionMenuPath, animations: 'disabled' });
  const actionMenu = {
    screenshot: 'ING-03-action-menu.png',
    phoneBounds: await actionPhone.boundingBox(),
    browserViewport: page.viewportSize(),
    screenshotSha256: sha256(readFileSync(actionMenuPath)),
    bodyTextSha256: sha256(Buffer.from(actionBodyText, 'utf8')),
    requiredMarkers: Object.fromEntries(['식재료 수정', '재고 수정', '메모 수정', '구매 링크 수정', '식재료 삭제'].map((marker) => [marker, actionBodyText.includes(marker)])),
    consoleErrors: consoleErrors.slice(actionErrorStart.console),
    pageErrors: pageErrors.slice(actionErrorStart.page),
  };

  const violations = [...rows, ...states].flatMap((row) => {
    const findings = [];
    for (const [marker, present] of Object.entries(row.requiredMarkers)) if (!present) findings.push(`marker:${marker}`);
    if (row.consoleErrors.length) findings.push(`consoleErrors:${row.consoleErrors.length}`);
    if (row.pageErrors.length) findings.push(`pageErrors:${row.pageErrors.length}`);
    return findings.map((finding) => ({ screenId: row.screenId ?? row.stateId, finding }));
  });
  for (const [marker, present] of Object.entries(actionMenu.requiredMarkers)) {
    if (!present) violations.push({ screenId: 'ING-03-action-menu', finding: `marker:${marker}` });
  }
  if (actionMenu.consoleErrors.length) violations.push({ screenId: 'ING-03-action-menu', finding: `consoleErrors:${actionMenu.consoleErrors.length}` });
  if (actionMenu.pageErrors.length) violations.push({ screenId: 'ING-03-action-menu', finding: `pageErrors:${actionMenu.pageErrors.length}` });
  const evidence = {
    schemaVersion: 1,
    sourceCommit: head,
    prototypeFile: 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html',
    viewport,
    capturedSurfaceCount: rows.length,
    actionMenu,
    referenceStates: Object.fromEntries(states.map((state) => [state.stateId, state])),
    rows,
    violations,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
  };
  writeFileSync(resolve(outputDir, 'render-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ sourceCommit: head, captured: rows.length, violations, status: evidence.status }, null, 2));
  if (violations.length) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
