#!/usr/bin/env node
/**
 * full-page-flow-prototype-render-audit.mjs
 *
 * 프로토타입 적용본의 렌더 산출물·회귀·폰트·타이포 계약을 target 단위로 전수 측정해
 * JSON 으로 남긴다. 문서에 적는 모든 수치는 이 스크립트의 출력에서만 인용한다.
 *
 * 사용:
 *   node full-page-flow-prototype-render-audit.mjs <적용본 경로> [출력 JSON 경로] [--executable=...]
 *   저장소 루트에서:  pnpm prototype:audit
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 측정 도구 자체가 검증 대상이다. 아래는 과거에 이 스크립트가 놓쳐서 잘못된 결론을
 * 문서에 남겼던 지점이다. 검사 범위를 줄이려 할 때 반드시 먼저 읽는다.
 *
 * [L1] PRT-186 — #overlay.open 만 보고 분류해 .phone 아래 독립 생성 Layer
 *      (.option-popover-layer) 를 페이지 상태로 오분류했다.  → detectLayer()
 * [L2] PRT-188 — PageState 를 "#content 가 host 기본 상태와 다른가" 로 판정해,
 *      host 의 기본 상태 그 자체인 3건(ingredient_option_filled, stock_inbound,
 *      option_list) 을 렌더러 부재로 오분류했다.  → openPopupTab 처리 분기로 판정
 * [L3] PRT-189 — documentElement.style.zoom 은 CSS 전체 확대이지 글자 확대가 아니다.
 *      "큰 글꼴" 계약은 글자만 커질 때의 재배치·잘림을 본다.  → textScale 모드
 * [L4] PRT-189 — pageerror 는 미처리 예외만 잡는다. console.error() 는 안 잡힌다.
 *      그런데 결과를 consoleErrors 로 보고했다.  → 둘을 분리해 수집
 * [L5] PRT-189 — 요소의 직접 text node 만 검사해 <input value> 를 통째로 건너뛰었다.
 *      현재 확정안 2.15 는 "text node 와 입력값 전체" 를 계약으로 못박는다.
 * [L6] PRT-189 — 금지 굵기를 computed 값에서만, 900 을 뺀 채 검사했다. 새 선언
 *      font-weight:900 이 통과한다. 선언값과 computed 를 분리해 검사한다.
 *      (computed 900 은 브라우저 bolder 파생이라 선언값 검사에서만 금지)
 * [L7] PRT-189 — document.fonts.ready 는 폰트가 실패해 대체 글꼴로 정착해도 resolve
 *      된다. PRT-182 에서 실제로 있었던 "@font-face descriptor 손상" 을 못 잡는다.
 *      → fonts.check() 단언 + 네 face 의 실측 폭 구분
 * [L8] PRT-189(자기 정정) — face 는 그 화면에서 실제로 쓰일 때만 지연 로드된다.
 *      600 을 아무도 안 쓰는 화면에서 fonts.check('600 …') 는 false 이고 프로브도
 *      대체 글꼴로 그려진다. 26개 화면이 그렇게 오탐으로 잡혔다.
 *      → 측정 전에 네 face 를 document.fonts.load() 로 명시적으로 적재한다.
 * [L9] PRT-189(자기 정정) — 가로 스크롤 컨테이너(카탈로그 화면 선택 탭 등) 안의
 *      요소는 viewport 밖으로 나가는 것이 정상이다. 조상에 가로 스크롤이 있거나
 *      보이지 않는 요소는 이탈로 세지 않는다.
 * [L11] 넘침을 boolean 으로만 저장해, KD-001 이 5px 에서 50px 로 악화돼도 같은 "1건"
 *       이라 게이트가 통과시켰다. 알려진 목록 대조도 존재 여부만 봤다. **크기가 없으면
 *       악화를 못 잡는다.** phoneOverflowPx·documentOverflowPx 와 요소별 좌·우 이탈 px 을
 *       저장하고, 알려진 목록에 크기를 함께 넣어 기준보다 나빠지면 FAIL 로 본다.
 * [L10] PRT-189(자기 정정) — 글자를 2배로 키운 패스에서 TYPE 스케일 검사는 의미가
 *      없다. 모든 크기가 스케일 밖이 된다. 확대 패스에서는 스케일 검사를 하지 않는다.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 렌더 산출물 분류 (배타적, 우선순위 순):
 *   overlay     - 주 #overlay 가 열린다
 *   independent - .phone 아래에 별도 Layer DOM 이 생성된다
 *   pageState   - Layer 없이 페이지가 그 상태를 그린다. openPopupTab 에 처리 분기가 있다
 *   none        - Layer 도 없고 처리 분기도 없다 (렌더러 부재 → 반드시 조사)
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { textSha256 } from './full-page-flow-prototype-text-sha256.mjs';

const require_ = createRequire(import.meta.url);
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--'))
  .map(a => a.replace(/^--/, '').split('=')));
const targetPath = resolve(args[0] ?? 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html');
const outPath = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-render-audit.json');

const sha = buf => createHash('sha256').update(buf).digest('hex');
const bytes = readFileSync(targetPath);
const scriptSha = textSha256(readFileSync(new URL(import.meta.url)));
const designSyncId = (bytes.toString('utf8').match(/<!--\s*DESIGN_SYNC:\s*(DS-\d{8}-\d{3})\s*-->/) || [])[1] ?? null;
let playwrightVersion = null;
try { playwrightVersion = require_('playwright/package.json').version; } catch { /* noop */ }

const URLBASE = pathToFileURL(targetPath).href;
const SCALE = ['22px', '20px', '18px', '16px', '14px', '13px'];
/** 선언값에서 금지. computed 900 은 b/strong 의 브라우저 bolder 파생이라 예외 ([L6]) */
const BANNED_DECLARED = ['300', '500', '650', '750', '850', '900'];
const BANNED_COMPUTED = ['300', '500', '650', '750', '850'];
const OFFICIAL_WEIGHTS = ['400', '600', '700', '800'];
/** 제품 UI 가 아닌 프로토타입 셸. 스케일 계약 대상이 아니다 */
const SHELL_OFFSCALE_ALLOW = ['SPAN 11px', 'route 10px'];

const PASSES = [
  { id: 'pc',          width: 1280, height: 900, mode: 'none'      },
  { id: 'mobile320',   width: 320,  height: 720, mode: 'none'      },
  { id: 'mobile320z2', width: 320,  height: 720, mode: 'cssZoom2'  }, // CSS 전체 확대
  { id: 'mobile320t2', width: 320,  height: 720, mode: 'textOnly2' }, // 글자만 200% ([L3])
];
const CLASSIFY_PASS = { id: 'mobile390', width: 390, height: 844, mode: 'none' };

const browser = await chromium.launch(opt.executable ? { executablePath: opt.executable } : {});
const chromiumVersion = browser.version();

// ── 시계 고정 (PRT-209) ────────────────────────────────────────────────────
// 프로토타입은 스스로 `new Date()` 를 읽는다 — `recentChangeButton()` 이 표본 행의 날짜와
// 오늘을 비교해 7일이 넘으면 버튼을 **통째로 지운다**. 그래서 같은 대상 SHA 가 날마다
// 다른 수치를 낸다(2026-09-04 → 6,974 · 09-05 → 6,965). 봉인은 파일을 묶지 시계를 묶지 않는다.
// 측정이 재현 가능하려면 시계도 입력이어야 하므로 여기서 고정하고 manifest 에 적는다.
const CLOCK = opt.clock ?? '2026-09-04T09:00:00+09:00';
const CLOCK_MS = Date.parse(CLOCK);
if (!Number.isFinite(CLOCK_MS)) { console.error(`--clock 값을 읽을 수 없다: ${CLOCK}`); process.exit(2); }
const PIN_CLOCK = `(() => {
  const T = ${JSON.stringify(CLOCK_MS)};
  const _D = Date;
  function D(...a) { return a.length ? new _D(...a) : new _D(T); }
  D.now = () => T; D.parse = _D.parse; D.UTC = _D.UTC; D.prototype = _D.prototype;
  Object.setPrototypeOf(D, _D);
  globalThis.Date = D;
})()`;
let CLOCK_SAMPLE = null;
const newPinnedPage = async (browser, o) => {
  const p = await browser.newPage(o);
  await p.addInitScript(PIN_CLOCK);
  return p;
};


// ── 레지스트리는 문서가 아니라 적용본 자신에게서 읽는다 ────────────────────────
const boot = await newPinnedPage(browser);
await boot.goto(URLBASE, { waitUntil: 'load' });

// ── 시계 ↔ 표본 날짜 계약 (PRT-210 · 페이블 조건) ──────────────────────────
// 시계를 고정하면 측정은 재현되지만, **표본이 낡았는데도 고정 시계 덕분에 통과**하는 상태로
// 봉인될 수 있다. 프로토타입의 `recentChangeButton()` 은 표본 행이 7일을 넘으면 버튼을
// 지우므로, 고정 시계가 가장 최근 표본에서 7일 이상 떨어지면 그 봉인은 "다시는 렌더되지
// 않는 화면" 을 재현하고 있는 것이다. 표본을 갱신하거나 시계를 옮길 때 여기서 걸린다.
{
  const sample = await boot.evaluate(() => {
    const out = [];
    const seen = new Set();
    const walk = (v) => {
      if (typeof v === 'string') { const m = v.match(/^(\d{2})\/(\d{2})(?:\s|$|\u00b7)/); if (m) out.push([+m[1], +m[2]]); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') { if (seen.has(v)) return; seen.add(v); Object.values(v).forEach(walk); }
    };
    try { walk(screens); } catch { /* 레지스트리가 없으면 빈 목록 */ }
    return out;
  });
  if (sample.length) {
    const c = new Date(CLOCK_MS);
    let newest = -Infinity, newestLabel = null;
    for (const [mo, da] of sample) {
      let t = new Date(c.getFullYear(), mo - 1, da).getTime();
      if (t - CLOCK_MS > 86400000) t = new Date(c.getFullYear() - 1, mo - 1, da).getTime();
      if (t > newest) { newest = t; newestLabel = `${String(mo).padStart(2, '0')}/${String(da).padStart(2, '0')}`; }
    }
    const ageDays = Math.floor((CLOCK_MS - newest) / 86400000);
    if (ageDays >= 7) {
      console.error(`시계 ${CLOCK} 가 가장 최근 표본 ${newestLabel} 에서 ${ageDays}일 떨어져 있다. ` +
        `프로토타입은 7일이 넘은 표본의 recent-change 버튼을 지우므로, 이 봉인은 다시는 렌더되지 않는 화면을 재현한다. ` +
        `표본을 갱신하거나 --clock 을 옮겨라.`);
      await browser.close();
      process.exit(3);
    }
    CLOCK_SAMPLE = { newest: newestLabel, ageDays };
  }
}

const registry = await boot.evaluate(() => {
  const hidden = Object.entries(screens).filter(([, s]) => s.hidden).map(([k]) => k);
  const pairs = [];
  for (const [host, list] of Object.entries(popupTabs)) for (const [id] of list) pairs.push({ id, host });
  const src = openPopupTab.toString() + '\n' + openActualPopup.toString();
  const handled = {};
  for (const { id } of pairs) handled[id] = new RegExp(`['"]${id}['"]|[,{\\s]${id}\\s*:`).test(src);
  return { screenKeys: Object.keys(screens), hidden, pairs, handled };
});
await boot.close();

const targets = [
  ...registry.screenKeys.map(s => ({ target: `screen:${s}`, screen: s, popup: null, hidden: registry.hidden.includes(s) })),
  ...registry.pairs.map(p => ({ target: `popup:${p.id}@${p.host}`, screen: p.host, popup: p.id, hidden: registry.hidden.includes(p.host) })),
];
const url = t => `${URLBASE}?screen=${t.screen}` + (t.popup ? `&popup=${t.popup}` : '');

// ── 브라우저 안에서 도는 검사기들 ────────────────────────────────────────────
const INBROWSER = {
  applyTextOnlyScale: (factor) => {
    // 글자만 확대한다. CSS zoom 은 레이아웃까지 함께 확대하므로 계약이 다르다 ([L3]).
    const nodes = [...document.querySelectorAll('*')];
    const sizes = nodes.map(e => parseFloat(getComputedStyle(e).fontSize) || 0);
    nodes.forEach((e, i) => { if (sizes[i]) e.style.setProperty('font-size', `${sizes[i] * factor}px`, 'important'); });
  },
  loadFaces: async (weights) => {
    // face 는 실제로 쓰일 때만 지연 로드된다 ([L8]). 검사 전에 넷 다 명시적으로 적재한다.
    await Promise.all(weights.map(w => document.fonts.load(`${w} 16px Pretendard`).catch(() => null)));
    await document.fonts.ready;
  },
  measure: ({ SCALE, BANNED_COMPUTED, BANNED_DECLARED, OFFICIAL_WEIGHTS, checkScale }) => {
    const phone = document.querySelector('.phone') || document.body;
    const vw = window.innerWidth;
    // 넘침을 boolean 이 아니라 **px 크기**로 저장한다 ([L11]).
    // boolean 이면 5px 넘침이 50px 이 돼도 같은 "1건" 이라 악화를 못 잡는다.
    const phoneOverflowPx = Math.max(0, phone.scrollWidth - phone.clientWidth);
    const documentOverflowPx = Math.max(0, document.documentElement.scrollWidth - vw);
    const out = {
      phoneOverflow: phoneOverflowPx > 1,
      phoneOverflowPx,
      // viewport 경계 기준. 확대된 .phone 이 화면 밖으로 나가는 경우를 잡는다 ([L3])
      documentOverflow: documentOverflowPx > 1,
      documentOverflowPx,
      viewportEscapees: [], escapeeDetail: [], bannedComputed: [], bannedDeclared: [], offScale: [], fonts: null,
    };
    const label = e => (typeof e.className === 'string' && e.className.trim()) || e.tagName;
    // 가로 스크롤 컨테이너 안이거나 보이지 않으면 viewport 밖으로 나가는 것이 정상이다 ([L9])
    const inScrollableX = e => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p.scrollWidth > p.clientWidth + 1) return true;
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      return false;
    };
    const visible = e => { const cs = getComputedStyle(e);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0.01; };

    let escapeeSeq = 0;
    for (const e of phone.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && visible(e) && !inScrollableX(e)) {
        out.viewportEscapees.push(`${label(e)} ${Math.round(r.left)}..${Math.round(r.right)}/${vw}`);
        // 좌·우 이탈 px 을 따로 저장한다. 어느 쪽으로 얼마나 나갔는지가 악화 판정의 단위다.
        out.escapeeDetail.push({ id: `${label(e)}#${escapeeSeq++}`, cls: label(e),
          leftPx: Math.max(0, Math.round(-r.left)), rightPx: Math.max(0, Math.round(r.right - vw)) });
      }

      const cs = getComputedStyle(e);
      // 직접 text node + 입력값 전체 ([L5])
      const textNodes = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join('');
      const isField = e.tagName === 'INPUT' || e.tagName === 'TEXTAREA';
      const fieldValue = isField ? `${e.value ?? ''}${e.placeholder ?? ''}` : '';
      const editable = e.isContentEditable ? (e.textContent || '').trim() : '';
      const text = textNodes || fieldValue || editable;
      if (!text) continue;

      if (BANNED_COMPUTED.includes(cs.fontWeight)) out.bannedComputed.push(`${label(e)} ${cs.fontWeight}`);
      // 확대 패스에서는 TYPE 스케일 검사가 성립하지 않는다 ([L10])
      if (checkScale && /[0-9]/.test(text) && !SCALE.includes(cs.fontSize)) out.offScale.push(`${label(e)} ${cs.fontSize}`);
      // 인라인 선언값 ([L6])
      const inlineW = e.style && e.style.fontWeight;
      if (inlineW && BANNED_DECLARED.includes(String(inlineW))) out.bannedDeclared.push(`inline ${label(e)} ${inlineW}`);
    }

    // 스타일시트 선언값 ([L6]) — at-rule(@font-face) 은 계약 대상이 아니므로 제외한다
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      const walk = list => { for (const r of list) {
        if (r.cssRules) { walk(r.cssRules); continue; }
        if (!r.style || r.constructor.name === 'CSSFontFaceRule') continue;
        const w = r.style.getPropertyValue('font-weight').trim();
        if (w && BANNED_DECLARED.includes(w)) out.bannedDeclared.push(`css ${r.selectorText} ${w}`);
      } };
      walk(rules);
    }

    // 폰트 face 실측 ([L7]) — fonts.ready 는 대체 글꼴 정착도 resolve 하므로 믿지 않는다
    const family = getComputedStyle(document.body).fontFamily;
    const probe = document.createElement('span');
    probe.textContent = '0123456789 가나다라마바사아자차';
    probe.style.cssText = 'position:absolute;left:-99999px;top:0;white-space:nowrap;font-size:100px;visibility:hidden';
    probe.style.fontFamily = family;
    document.body.append(probe);
    const widths = {}; const checks = {};
    for (const w of OFFICIAL_WEIGHTS) {
      checks[w] = document.fonts.check(`${w} 16px Pretendard`);
      probe.style.fontWeight = w;
      widths[w] = Math.round(probe.getBoundingClientRect().width * 100) / 100;
    }
    probe.remove();
    const distinct = new Set(Object.values(widths)).size;
    out.fonts = {
      checks, widths, distinctFaces: distinct,
      allChecksTrue: Object.values(checks).every(Boolean),
      allFacesDistinct: distinct === OFFICIAL_WEIGHTS.length,
    };
    return out;
  },
};

// ── 1) 렌더 산출물 분류 ──────────────────────────────────────────────────────
const classify = {};
{
  const page = await newPinnedPage(browser, { viewport: { width: CLASSIFY_PASS.width, height: CLASSIFY_PASS.height } });
  const baseline = {};
  for (const s of new Set(targets.map(t => t.screen))) {
    await page.goto(`${URLBASE}?screen=${s}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    baseline[s] = await page.evaluate(() => (document.getElementById('content')?.textContent || '').replace(/\s+/g, '').length);
  }
  for (const t of targets) {
    await page.goto(url(t), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const overlay = document.getElementById('overlay');
      const phone = document.querySelector('.phone');
      const known = new Set(['overlay', 'content']);
      const independent = [...(phone?.children || [])]
        .filter(e => !known.has(e.id) && typeof e.className === 'string' && /layer|popover|modal|sheet|dialog/i.test(e.className))
        .map(e => e.className.trim());
      const sheet = document.getElementById('sheet-body');
      return {
        overlayOpen: !!overlay && overlay.classList.contains('open'),
        independent,
        roles: [...document.querySelectorAll('[role="menu"],[role="dialog"],[aria-modal="true"]')].map(e => e.getAttribute('role') || 'aria-modal'),
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
    classify[t.target] = {
      kind,
      handledInOpenPopupTab: t.popup ? registry.handled[t.popup] : null,
      contentDiffersFromHostDefault: t.popup ? r.contentChars !== baseline[t.screen] : null,
      ...r, baselineContentChars: baseline[t.screen],
    };
  }
  await page.close();
}

// ── 2) 패스별 회귀·타이포·폰트 ───────────────────────────────────────────────
const regression = {};
for (const pass of PASSES) {
  const page = await newPinnedPage(browser, { viewport: { width: pass.width, height: pass.height } });
  const pageErrors = []; const consoleErrors = []; const fontFails = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });   // [L4]
  page.on('requestfailed', r => { if (/fonts?\//i.test(r.url())) fontFails.push(r.url()); });
  for (const t of targets) {
    const a = pageErrors.length, b = consoleErrors.length, c = fontFails.length;
    await page.goto(url(t), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(INBROWSER.loadFaces, OFFICIAL_WEIGHTS);
    if (pass.mode === 'cssZoom2') await page.evaluate(() => { document.documentElement.style.zoom = 2; });
    if (pass.mode === 'textOnly2') await page.evaluate(INBROWSER.applyTextOnlyScale, 2);
    const r = await page.evaluate(INBROWSER.measure,
      { SCALE, BANNED_COMPUTED, BANNED_DECLARED, OFFICIAL_WEIGHTS, checkScale: pass.mode === 'none' });
    (regression[t.target] ??= {})[pass.id] = {
      ...r,
      pageErrors: pageErrors.slice(a),
      consoleErrors: consoleErrors.slice(b),
      fontFailures: fontFails.slice(c),
    };
  }
  await page.close();
}
await browser.close();

// ── 3) 집계 ─────────────────────────────────────────────────────────────────
const active = targets.filter(t => !t.hidden);
const uniqueIds = new Set(active.filter(t => t.popup).map(t => t.popup));
const kindByPair = {}; for (const t of active) kindByPair[classify[t.target].kind] = (kindByPair[classify[t.target].kind] ?? 0) + 1;
const kindSets = {}; for (const t of active.filter(x => x.popup)) (kindSets[t.popup] ??= new Set()).add(classify[t.target].kind);
const kindByUniqueId = {}; for (const s of Object.values(kindSets)) { const k = [...s].join('+'); kindByUniqueId[k] = (kindByUniqueId[k] ?? 0) + 1; }
const uniq = a => [...new Set(a)];
/** 0 이어야 하는 지표. 위반 시 어느 target 이 위반했는지까지 남긴다 — 예외 목록과 대조하기 위해 */
const ZERO_METRICS = ['phoneOverflow', 'documentOverflow', 'viewportEscapees', 'pageErrors', 'consoleErrors', 'fontFailures', 'fontChecksFailed', 'facesNotDistinct', 'bannedComputed', 'bannedDeclared'];
const violations = {};
for (const p of PASSES) {
  const perMetric = {};
  for (const m of ZERO_METRICS) {
    const hits = targets.filter(t => {
      const r = regression[t.target][p.id];
      const v = m === 'fontChecksFailed' ? !r.fonts?.allChecksTrue
        : m === 'facesNotDistinct' ? !r.fonts?.allFacesDistinct
        : r[m];
      return Array.isArray(v) ? v.length > 0 : !!v;
    }).map(t => t.target);
    if (hits.length) perMetric[m] = hits;
  }
  if (Object.keys(perMetric).length) violations[p.id] = perMetric;
}

const passSummary = Object.fromEntries(PASSES.map(p => {
  const all = targets.map(t => regression[t.target][p.id]);
  return [p.id, {
    mode: p.mode,
    phoneOverflow: all.filter(r => r.phoneOverflow).length,
    phoneOverflowMaxPx: Math.max(0, ...all.map(r => r.phoneOverflowPx ?? 0)),
    documentOverflow: all.filter(r => r.documentOverflow).length,
    documentOverflowMaxPx: Math.max(0, ...all.map(r => r.documentOverflowPx ?? 0)),
    viewportEscapees: uniq(all.flatMap(r => r.viewportEscapees)).length,
    escapeeMaxPx: Math.max(0, ...all.flatMap(r => (r.escapeeDetail ?? []).map(d => Math.max(d.leftPx, d.rightPx)))),
    pageErrors: all.reduce((s, r) => s + r.pageErrors.length, 0),
    consoleErrors: all.reduce((s, r) => s + r.consoleErrors.length, 0),
    fontFailures: all.reduce((s, r) => s + r.fontFailures.length, 0),
    bannedComputed: uniq(all.flatMap(r => r.bannedComputed)),
    bannedDeclared: uniq(all.flatMap(r => r.bannedDeclared)),
    offScale: uniq(all.flatMap(r => r.offScale)),
    fontChecksFailed: all.filter(r => !r.fonts?.allChecksTrue).length,
    facesNotDistinct: all.filter(r => !r.fonts?.allFacesDistinct).length,
    faceWidths: uniq(all.map(r => JSON.stringify(r.fonts?.widths))).map(s => JSON.parse(s)),
  }];
}));
const summary = {
  targetsMeasured: targets.length,
  activeTargets: active.length,
  hiddenTargets: targets.length - active.length,
  activeScreens: active.filter(t => !t.popup).length,
  activePopupPairs: active.filter(t => t.popup).length,
  activeUniquePopupIds: uniqueIds.size,
  duplicateTargets: targets.length - new Set(targets.map(t => t.target)).size,
  renderKindByPair: kindByPair,
  renderKindByUniquePopupId: kindByUniqueId,
  noRendererIds: uniq(active.filter(t => t.popup && classify[t.target].kind === 'none').map(t => t.popup)),
  sheetBodyUnder3: active.filter(t => classify[t.target].kind === 'overlay' && classify[t.target].sheetNodes < 3).map(t => t.target),
  passes: passSummary,
  violations,
  violationCount: Object.values(violations).reduce((a, m) => a + Object.values(m).reduce((b, l) => b + l.length, 0), 0),
  offScaleOutsideShellAllowlist: uniq(Object.values(passSummary).flatMap(p => p.offScale)).filter(x => !SHELL_OFFSCALE_ALLOW.includes(x)),
};

const manifest = {
  generatedAt: new Date().toISOString(),
  schemaVersion: 2,
  script: { name: basename(new URL(import.meta.url).pathname), sha256: scriptSha },
  target: { path: basename(targetPath), sha256: textSha256(bytes), designSyncId },
  runner: { node: process.version, playwright: playwrightVersion, chromium: chromiumVersion, platform: process.platform, clock: CLOCK, clockSample: CLOCK_SAMPLE, clockNote: '프로토타입이 스스로 new Date() 를 읽으므로 시계도 측정 입력이다 (PRT-209)' },
  passes: PASSES, classificationPass: CLASSIFY_PASS,
  scale: SCALE, bannedDeclaredWeights: BANNED_DECLARED, bannedComputedWeights: BANNED_COMPUTED,
  officialWeights: OFFICIAL_WEIGHTS, shellOffScaleAllowlist: SHELL_OFFSCALE_ALLOW,
};

writeFileSync(outPath, JSON.stringify({ manifest, summary,
  targets: targets.map(t => ({ ...t, render: classify[t.target], regression: regression[t.target] })) }, null, 1) + '\n');
console.log(JSON.stringify({ manifest, summary }, null, 1));
