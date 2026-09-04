#!/usr/bin/env node
/**
 * full-page-flow-prototype-render-audit.mjs
 *
 * 프로토타입 적용본의 렌더 산출물·회귀를 target 단위로 전수 측정해 JSON으로 남긴다.
 * 문서에 적는 모든 수치(렌더 산출물 분포, 뷰포트별 넘침·콘솔 오류·폰트 실패,
 * 금지 굵기, 스케일 밖 크기)는 이 스크립트의 출력에서만 인용한다.
 *
 * 사용:
 *   node full-page-flow-prototype-render-audit.mjs <적용본 경로> [출력 JSON 경로]
 *
 * 요구: node >= 20, playwright (chromium). 예)
 *   npm i playwright && npx playwright install chromium
 *   node ... --executable=/path/to/chromium   (선택: 브라우저 경로 직접 지정)
 *
 * 측정 대상 = 등록 screen 키 전체 + 등록 popup 쌍 전체 (숨김 포함).
 * 숨김 host는 결과에 hidden:true로 표시하고 활성 집계에서 뺀다.
 *
 * 렌더 산출물 분류 (배타적, 우선순위 순):
 *   overlay    - 주 #overlay 가 열린다
 *   independent- .phone 아래에 별도 Layer DOM 이 생성된다 (예: .option-popover-layer)
 *   pageState  - Layer 없이 페이지 자체가 그 상태를 그린다. openPopupTab 에 처리 분기가 있다
 *   none       - Layer 도 없고 openPopupTab 에 처리 분기도 없다 (렌더러 부재 → 반드시 조사)
 *
 * 주의 1: 이전 판본(PRT-186)은 #overlay 만 보고 분류해 independent 를 놓쳤다.
 *         분류를 넓힐 때는 이 주석과 detectors 를 함께 고친다.
 * 주의 2: PageState 를 "#content 가 host 기본 상태와 다른가"로 판정하면 안 된다.
 *         일부 PageState 는 host 의 기본 상태 그 자체여서 차이가 0 이다
 *         (ingredient_option_filled, stock_inbound, option_list). 이 셋을 none 으로
 *         분류한 초판을 이 규칙으로 고쳤다. 기본 상태와의 차이는 분류 근거가 아니라
 *         참고 값(contentDiffersFromHostDefault)으로만 기록한다.
 * 주의 3: 처리 분기 유무는 openPopupTab / openActualPopup 의 함수 원문에서 ID 리터럴을
 *         찾아 판정한다. 복합 조건 분기(id==='a'||id==='b')도 이 방식으로 잡힌다.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--'))
  .map(a => a.replace(/^--/, '').split('=')));
const targetPath = resolve(args[0] ?? 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html');
const outPath = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-render-audit.json');

const bytes = readFileSync(targetPath);
const targetSha = createHash('sha256').update(bytes).digest('hex');
const targetShaLf = createHash('sha256')
  .update(Buffer.from(bytes.toString('binary').replace(/\r\n/g, '\n'), 'binary')).digest('hex');
const scriptSha = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const designSyncId = (bytes.toString('utf8').match(/<!--\s*DESIGN_SYNC:\s*(DS-\d{8}-\d{3})\s*-->/) || [])[1] ?? null;

const URLBASE = pathToFileURL(targetPath).href;
const SCALE = ['22px', '20px', '18px', '16px', '14px', '13px'];
const BANNED = ['300', '500', '650', '750', '850'];
const VIEWPORTS = [
  { id: 'pc',        width: 1280, height: 900, zoom: 1 },
  { id: 'mobile320', width: 320,  height: 720, zoom: 1 },
  { id: 'mobile320z2', width: 320, height: 720, zoom: 2 },
];
const CLASSIFY_VIEWPORT = { id: 'mobile390', width: 390, height: 844, zoom: 1 };

const browser = await chromium.launch(
  opt.executable ? { executablePath: opt.executable } : {});
const version = browser.version();

// ---- 레지스트리 추출 (문서가 아니라 적용본 자신에게서) ----
const boot = await browser.newPage();
await boot.goto(URLBASE, { waitUntil: 'load' });
const registry = await boot.evaluate(() => {
  const hidden = Object.entries(screens).filter(([, s]) => s.hidden).map(([k]) => k);
  const screenKeys = Object.keys(screens);
  const pairs = [];
  for (const [host, list] of Object.entries(popupTabs)) for (const [id] of list) pairs.push({ id, host });
  const src = openPopupTab.toString() + '\n' + openActualPopup.toString();
  const handled = {};
  for (const { id } of pairs) handled[id] = new RegExp("['\"]" + id + "['\"]|[,{\\s]" + id + "\\s*:").test(src);
  return { screenKeys, hidden, pairs, handled };
});
await boot.close();

const targets = [
  ...registry.screenKeys.map(s => ({ target: `screen:${s}`, screen: s, popup: null,
    hidden: registry.hidden.includes(s) })),
  ...registry.pairs.map(p => ({ target: `popup:${p.id}@${p.host}`, screen: p.host, popup: p.id,
    hidden: registry.hidden.includes(p.host) })),
];
const url = t => `${URLBASE}?screen=${t.screen}` + (t.popup ? `&popup=${t.popup}` : '');

// ---- 1) 렌더 산출물 분류 (390x844) ----
const classify = {};
{
  const page = await browser.newPage({ viewport: { width: CLASSIFY_VIEWPORT.width, height: CLASSIFY_VIEWPORT.height } });
  // 기준선: popup 없이 host 만 열었을 때의 #content 길이
  const baseline = {};
  for (const s of new Set(targets.map(t => t.screen))) {
    await page.goto(`${URLBASE}?screen=${s}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    baseline[s] = await page.evaluate(() =>
      (document.getElementById('content')?.textContent || '').replace(/\s+/g, '').length);
  }
  for (const t of targets) {
    await page.goto(url(t), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const overlay = document.getElementById('overlay');
      const phone = document.querySelector('.phone');
      const known = new Set(['overlay', 'content']);
      const independent = [...(phone?.children || [])]
        .filter(e => !known.has(e.id) && typeof e.className === 'string'
          && /layer|popover|modal|sheet|dialog/i.test(e.className))
        .map(e => e.className.trim());
      const sheet = document.getElementById('sheet-body');
      return {
        overlayOpen: !!overlay && overlay.classList.contains('open'),
        independent,
        roles: [...document.querySelectorAll('[role="menu"],[role="dialog"],[aria-modal="true"]')]
          .map(e => e.getAttribute('role') || 'aria-modal'),
        sheetNodes: sheet ? sheet.querySelectorAll('*').length : 0,
        sheetTitle: sheet?.querySelector('h2')?.textContent?.trim() ?? null,
        contentChars: (document.getElementById('content')?.textContent || '').replace(/\s+/g, '').length,
      };
    });
    const kind = !t.popup ? 'screen'
      : r.overlayOpen ? 'overlay'
      : r.independent.length ? 'independent'
      : registry.handled[t.popup] ? 'pageState'
      : 'none';
    classify[t.target] = { kind, handledInOpenPopupTab: t.popup ? registry.handled[t.popup] : null,
      contentDiffersFromHostDefault: t.popup ? r.contentChars !== baseline[t.screen] : null,
      ...r, baselineContentChars: baseline[t.screen] };
  }
  await page.close();
}

// ---- 2) 뷰포트별 회귀 ----
const regression = {};
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = []; const fontFails = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (/fonts?\//i.test(r.url())) fontFails.push(r.url()); });
  for (const t of targets) {
    const before = errors.length, beforeF = fontFails.length;
    await page.goto(url(t), { waitUntil: 'load' });
    if (vp.zoom > 1) await page.evaluate(z => { document.documentElement.style.zoom = z; }, vp.zoom);
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(({ SCALE, BANNED }) => {
      const root = document.querySelector('.phone') || document.body;
      const out = { overflow: root.scrollWidth > root.clientWidth + 1, banned: [], offScale: [] };
      root.querySelectorAll('*').forEach(e => {
        const text = [...e.childNodes].filter(n => n.nodeType === 3)
          .map(n => n.nodeValue.trim()).join('');
        if (!text) return;
        const cs = getComputedStyle(e);
        const name = (typeof e.className === 'string' && e.className) || e.tagName;
        if (BANNED.includes(cs.fontWeight)) out.banned.push(`${name} ${cs.fontWeight}`);
        if (/[0-9]/.test(text) && !SCALE.includes(cs.fontSize)) out.offScale.push(`${name} ${cs.fontSize}`);
      });
      return out;
    }, { SCALE, BANNED });
    (regression[t.target] ??= {})[vp.id] = {
      ...r,
      consoleErrors: errors.slice(before),
      fontFailures: fontFails.slice(beforeF),
    };
  }
  await page.close();
}
await browser.close();

// ---- 3) 집계 ----
const active = targets.filter(t => !t.hidden);
const uniquePopupIds = new Set(active.filter(t => t.popup).map(t => t.popup));
const kinds = {};
for (const t of active) kinds[classify[t.target].kind] = (kinds[classify[t.target].kind] ?? 0) + 1;
const uniqueKind = {};
for (const t of active.filter(x => x.popup)) {
  (uniqueKind[t.popup] ??= new Set()).add(classify[t.target].kind);
}
const byUniqueId = {};
for (const [id, set] of Object.entries(uniqueKind)) {
  const k = [...set].join('+');
  byUniqueId[k] = (byUniqueId[k] ?? 0) + 1;
}
const sum = (f) => targets.reduce((a, t) => a + f(t), 0);
const summary = {
  targetsMeasured: targets.length,
  activeTargets: active.length,
  hiddenTargets: targets.length - active.length,
  activeScreens: active.filter(t => !t.popup).length,
  activePopupPairs: active.filter(t => t.popup).length,
  activeUniquePopupIds: uniquePopupIds.size,
  renderKindByPair: kinds,
  renderKindByUniquePopupId: byUniqueId,
  noRendererIds: [...new Set(active.filter(t => t.popup && classify[t.target].kind === 'none').map(t => t.popup))],
  sheetBodyUnder3: active.filter(t => classify[t.target].kind === 'overlay' && classify[t.target].sheetNodes < 3)
    .map(t => t.target),
  viewports: Object.fromEntries(VIEWPORTS.map(vp => [vp.id, {
    overflow: sum(t => regression[t.target][vp.id].overflow ? 1 : 0),
    consoleErrors: sum(t => regression[t.target][vp.id].consoleErrors.length),
    fontFailures: sum(t => regression[t.target][vp.id].fontFailures.length),
    bannedWeights: [...new Set(targets.flatMap(t => regression[t.target][vp.id].banned))],
    offScale: [...new Set(targets.flatMap(t => regression[t.target][vp.id].offScale))],
  }])),
};

const manifest = {
  generatedAt: new Date().toISOString(),
  script: { name: basename(new URL(import.meta.url).pathname), sha256: scriptSha },
  target: { path: basename(targetPath), sha256: targetSha, sha256LfNormalized: targetShaLf, designSyncId },
  runner: { node: process.version, chromium: version, platform: process.platform },
  viewports: { regression: VIEWPORTS, classification: CLASSIFY_VIEWPORT },
  scale: SCALE, bannedWeights: BANNED,
};

writeFileSync(outPath, JSON.stringify({ manifest, summary,
  targets: targets.map(t => ({ ...t, render: classify[t.target], regression: regression[t.target] })) }, null, 1) + '\n');
console.log(JSON.stringify({ manifest, summary }, null, 1));
