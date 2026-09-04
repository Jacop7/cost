#!/usr/bin/env node
/**
 * full-page-flow-prototype-i18n-stress.mjs
 *   — 프로토타입이 "한국어 320px" 밖에서도 서는지를 target 단위로 전수 측정한다.
 *
 * 왜 따로 재는가
 *   render-audit 은 320px 과 글자 200% 는 재지만 **번역문이 길어지는 축**을 재지 않는다.
 *   한국어는 같은 뜻을 가장 짧게 쓰는 언어에 가깝다. 한국어에서 딱 맞는 레이아웃은
 *   영어·독일어에서 거의 항상 넘치거나 잘린다. UI 가이드 968줄과 `C-20` 이 요구하는
 *   "30~50% 긴 번역" 검수가 이 스크립트다.
 *
 * 세는 규칙
 *  1. 번역문을 지어내지 않는다. 없는 번역을 만들어 재면 그 숫자는 번역이 아니라
 *     내가 고른 문장을 잰 것이다. 대신 **폭을 목표치까지 늘린다** — 각 텍스트 노드의
 *     렌더 폭 w 를 재고, 그 노드 자신의 글자를 순환해서 덧붙여 폭이 w×1.3 (또는 ×1.5)
 *     이상이 되게 한다. 같은 글꼴·같은 자간으로 늘어나므로 폭 증가분이 정확하다.
 *     "30% 긴 번역"의 단위는 글자 수가 아니라 **폭**이다. 레이아웃을 깨는 것이 폭이다.
 *  2. **숫자만 있는 노드는 늘리지 않는다.** 번역해도 숫자는 길어지지 않는다.
 *     글자(한글·라틴)를 하나라도 포함한 노드만 대상이다. 제외 건수를 함께 남긴다.
 *  3. **문자 기호 아이콘은 늘리지 않는다.** `＋ ‹ › ⋮ ▣` 는 번역 대상이 아니다.
 *  4. **기준 패스를 반드시 같이 잰다.** 늘리기 전에 이미 깨져 있던 것을 번역 탓으로
 *     돌리면 안 되므로, 모든 위반은 `base` 패스에서 재현되는지 함께 기록한다.
 *
 * 패스
 *   base    320×720, 한국어 원문 그대로            — 기준선
 *   w130    320×720, 텍스트 폭 +30%                 — 가이드 하한
 *   w150    320×720, 텍스트 폭 +50%                 — 가이드 상한
 *   w130t2  320×720, 텍스트 폭 +30% & 글자 200%     — 접근성과 번역이 겹치는 최악
 *
 *   w130t2 의 글자 200% 는 문자 기호 아이콘을 키우지 않는다. 번역 대상이 아니기 때문이다.
 *   render-audit 의 `mobile320t2` 는 아이콘까지 키운다. 두 패스는 다른 계약을 재며
 *   서로를 대체하지 않는다 — `KD-001`(아이콘 글리프 확대 넘침)은 render-audit 쪽에서만 잡힌다.
 *
 * 파손 판정
 *   phoneOverflow    `.phone` 이 가로로 넘침
 *   clipped          요소의 `scrollWidth` 가 자기 폭을 넘음 (잘림·말줄임)
 *   collision        같은 flex 행에서 이웃 사이 간격이 4px 미만 (라벨과 값이 붙음)
 *   escapee          요소가 뷰포트 밖으로 나감
 *
 * 과거 실패 기록
 *  [L1] 별도 측정용 상자(`#wrap{width:320px;padding:12px}`)를 만들어 재려다,
 *       그 상자 자체가 카드 폭을 좁혀 한국어에서도 넘침이 났다. 측정 도구가 만든
 *       파손을 제품 파손으로 보고할 뻔했다. 하네스를 버리고 실제 프로토타입에서 잰다.
 *  [L2] 손으로 만든 한↔영 사전 20개로 6개 화면만 재던 초안이 있었다. 사전이 내 선택이라
 *       재현 규칙이 못 되고, 사전에 없는 화면은 아예 안 재진다. 폭 기준 확대로 바꿨다.
 *  [L3] 처음에는 모든 텍스트를 늘렸는데 `1,091원`·`08/27` 같은 숫자까지 30% 길어져
 *       실제보다 파손이 부풀었다. 글자를 포함한 노드만 늘린다.
 *  [L4] `collision` 을 "flex 형제 사이 간격 4px 미만" 으로 절대 판정했더니 한국어
 *       기준선에서 182개 중 181개가 걸렸다. 두 가지가 섞여 있었다 —
 *       (가) `.header` 의 `‹` 아이콘 상자와 제목처럼 **원래 붙어 있는 것이 설계**인 쌍,
 *       (나) `flex-wrap` 으로 **줄이 바뀐** 쌍(간격이 −176px 로 나온다).
 *       절대 간격은 번역 스트레스의 지표가 아니다. **같은 줄**에 있고 둘 다 글자를 가진
 *       쌍만 보고, 기준선에서 4px 이상 떨어져 있던 것이 이 패스에서 4px 미만으로
 *       좁아졌는지를 잰다. 즉 "번역 때문에 붙었나"를 직접 묻는다.
 *  [L5] 가로 스크롤 컨테이너 예외를 `clipped` 에만 적용하고 `escapee` 에는 빼먹어,
 *       `.tabs`·`.recipe-filters` 처럼 **가로로 넘기라고 만든** 줄의 자식이
 *       기준선에서도 화면 이탈로 잡혔다. 같은 예외를 양쪽에 적용한다.
 *  [L6] 잘림을 target 단위로만 세니 하단 탭바 라벨 하나 때문에 182개 target 전부가
 *       "잘림 있음" 으로 보고돼 아무 정보가 없었다. **요소 단위로 모으고** 몇 개
 *       target 에 나타나는지를 함께 센다. 그리고 각 요소가 +30% 에서 깨지는지
 *       +50% 에서 깨지는지로 **여유(headroom)** 를 등급화한다.
 *  [L7] 글자를 통째로 붙여 목표 폭을 넘기는 순간 멈추니 **마지막 한 글자만큼 넘쳤다.**
 *       한글 한 글자가 약 11px 이므로 4글자짜리 탭 라벨(45px)에서는 +30%(58.5px) 를
 *       요구했는데 실제로는 67.4px(+49.8%) 가 됐고, 그 3px 넘침이 "탭바 라벨이 +30%
 *       에서 182개 target 전부 잘린다" 는 결론으로 보고될 뻔했다. 짧은 문자열일수록
 *       오차가 커지는데 UI 에서 가장 빡빡한 자리가 바로 짧은 라벨이라 최악의 조합이다.
 *       처음에는 채움 span 을 따로 붙여 되돌리려 했는데, 부모가 flex 인 자리에서 그 span 이
 *       **새 flex 아이템이 되어 gap 까지 얻는 바람에** 오차가 300% 까지 튀었다. 측정 발판이
 *       레이아웃을 바꾸면 재는 대상이 달라진다. 그래서 DOM 구조는 건드리지 않고,
 *       텍스트가 host 의 유일한 자식일 때 **host 의 letter-spacing** 으로 되돌린다.
 *       유일하지 않으면 목표에 더 가까운 글자 수를 고른다(오차 ≤ 반 글자).
 *  [L8] 그 보정이 일부 자리에서 오차를 77~100% 로 키웠다. 원인은 폭 측정이었다 —
 *       `Range.getBoundingClientRect()` 는 텍스트가 **두 줄에 걸치면 컨테이너 폭**을
 *       돌려준다. 한 글자 붙였을 뿐인데 폭이 54px→118px 로 뛴 것처럼 보였고, 그
 *       가짜 초과분을 letter-spacing 으로 되돌리려다 글자를 겹쳐 버렸다.
 *       폭은 `getClientRects()` 의 **줄 조각 합**으로 잰다. 보정 후에도 오차가 5% 를
 *       넘으면 보정을 되돌리고 글자 수 조정으로 내려간다.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.replace(/^--/, '').split('=')));
const target = resolve(args[0] ?? 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html');
const outPath = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-i18n-stress.json');
const sha = b => createHash('sha256').update(b).digest('hex');
const bytes = readFileSync(target);
const designSyncId = (bytes.toString('utf8').match(/<!--\s*DESIGN_SYNC:\s*(DS-\d{8}-\d{3})\s*-->/) || [])[1] ?? null;
let pwVersion = null; try { pwVersion = req('playwright/package.json').version; } catch {}

const URLBASE = pathToFileURL(target).href;
const browser = await chromium.launch(opt.executable ? { executablePath: opt.executable } : {});
const chromiumVersion = browser.version();

const boot = await browser.newPage();
await boot.goto(URLBASE, { waitUntil: 'load' });
const reg = await boot.evaluate(() => {
  const hidden = Object.entries(screens).filter(([, s]) => s.hidden).map(([k]) => k);
  const pairs = []; for (const [h, l] of Object.entries(popupTabs)) for (const [i] of l) pairs.push({ id: i, host: h });
  return { screenKeys: Object.keys(screens), hidden, pairs };
});
await boot.close();
const targets = [
  ...reg.screenKeys.filter(s => !reg.hidden.includes(s)).map(s => ({ t: `screen:${s}`, screen: s, popup: null })),
  ...reg.pairs.filter(p => !reg.hidden.includes(p.host)).map(p => ({ t: `popup:${p.id}@${p.host}`, screen: p.host, popup: p.id })),
];

// --- 브라우저 안에서 도는 두 함수 ---

const STRETCH = ({ factor }) => {
  const GLYPH = /^[＋+−–—‹›⌄•⋮▸▾✓✗▣●◔▰×…\s]*$/;
  const LETTER = /[가-힣A-Za-z]/;           // 한글 또는 라틴 글자를 하나라도 포함해야 늘린다
  const phone = document.querySelector('.phone');
  if (!phone) return { stretched: 0, skippedNumeric: 0, skippedGlyph: 0, exact: 0, maxErrorPct: 0 };
  const walker = document.createTreeWalker(phone, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  const range = document.createRange();
  // 줄이 바뀐 텍스트의 폭은 bounding rect 가 아니라 **줄 조각들의 합**이다 ([L8]).
  // bounding rect 는 두 줄에 걸치면 컨테이너 폭을 그대로 돌려준다.
  const widthOf = n => { range.selectNodeContents(n);
    let w = 0; for (const r of range.getClientRects()) w += r.width; return w; };
  let stretched = 0, skippedNumeric = 0, skippedGlyph = 0, exact = 0, maxErrorPct = 0;
  for (const n of nodes) {
    const raw = n.nodeValue; const t = raw.trim();
    if (!t) continue;
    const host = n.parentElement;
    if (!host || host.closest('.status, .route, .catalog')) continue;
    if (GLYPH.test(t)) { skippedGlyph++; continue; }
    if (!LETTER.test(t)) { skippedNumeric++; continue; }
    const w0 = widthOf(n);
    if (!(w0 > 0)) continue;
    const goal = w0 * factor;
    const src = t.replace(/\s+/g, '');
    if (!src) continue;

    // 1) 자기 글자를 순환해 붙여 목표 폭을 넘는 지점까지 간다
    let k = 0, w1 = w0, prevW = w0, guard = 0;
    while (guard++ < 400) {
      k++;
      n.nodeValue = raw + Array.from({ length: k }, (_, i) => src[i % src.length]).join('');
      prevW = w1; w1 = widthOf(n);
      if (w1 >= goal) break;
    }
    // 2) 통째 글자는 마지막 한 글자만큼 넘친다 ([L7]).
    //    이 텍스트 노드가 host 의 유일한 자식이면 host 의 letter-spacing 으로 정확히 되돌린다.
    //    (letter-spacing 은 host 안의 다른 텍스트까지 건드리므로 유일할 때만 안전하다.)
    const soleChild = host.childNodes.length === 1 && host.firstChild === n;
    let corrected = false;
    if (soleChild && w1 > goal) {
      const chars = n.nodeValue.length;
      if (chars > 0) {
        host.style.letterSpacing = ((goal - w1) / chars) + 'px';
        // 보정이 오히려 빗나가면(줄바꿈이 바뀌는 등) 되돌리고 글자 수 조정으로 내려간다
        if (Math.abs(widthOf(n) / goal - 1) * 100 <= 5) { exact++; corrected = true; }
        else host.style.letterSpacing = '';
      }
    }
    if (!corrected && k > 0 && Math.abs(prevW - goal) < Math.abs(w1 - goal)) {
      // 3) 되돌릴 수 없으면 목표에 더 가까운 쪽을 고른다 (오차 ≤ 반 글자)
      n.nodeValue = raw + Array.from({ length: k - 1 }, (_, i) => src[i % src.length]).join('');
    }
    const err = Math.abs(widthOf(n) / goal - 1) * 100;
    if (err > maxErrorPct) maxErrorPct = err;
    stretched++;
  }
  range.detach?.();
  return { stretched, skippedNumeric, skippedGlyph, exact, maxErrorPct: Math.round(maxErrorPct * 100) / 100 };
};

const TEXT2X = () => {
  const GLYPH = /^[＋+−–—‹›⌄•⋮▸▾✓✗▣●◔▰×…\s]*$/;
  const phone = document.querySelector('.phone'); if (!phone) return 0;
  let n = 0;
  for (const e of phone.querySelectorAll('*')) {
    let t = ''; e.childNodes.forEach(x => { if (x.nodeType === 3) t += x.nodeValue; });
    if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') t += (e.value || '') + (e.placeholder || '');
    t = t.trim(); if (!t || GLYPH.test(t)) continue;
    const size = parseFloat(getComputedStyle(e).fontSize);
    if (Number.isFinite(size) && size > 0) { e.style.fontSize = (size * 2) + 'px'; n++; }
  }
  return n;
};

const MEASURE = () => {
  const phone = document.querySelector('.phone');
  const out = { phoneOverflow: 0, clipped: [], pairs: [], escapee: [], contentHeight: 0 };
  if (!phone) return out;
  const pr = phone.getBoundingClientRect();
  out.phoneOverflow = Math.max(0, phone.scrollWidth - phone.clientWidth);
  const content = document.getElementById('content');
  out.contentHeight = content ? content.scrollHeight : 0;

  const slotOf = e => {
    const c = (typeof e.className === 'string' && e.className.trim()) || '';
    return c.split(/\s+/)[0] || e.tagName.toLowerCase();
  };
  const textOf = e => { let t = ''; e.childNodes.forEach(n => { if (n.nodeType === 3) t += n.nodeValue; }); return t.trim(); };
  const CARD = /^(card|expo-|settings-|detail-|sheet-|hub-|option-card|revenue-|channel-|menu-|sales-|analysis-|tax-|edit-|stock-|order-|recipe-|app-tab|header|tabs|bottom-)/;
  const cardOf = e => { for (let x = e.parentElement; x; x = x.parentElement) {
    const c = (typeof x.className === 'string' && x.className.trim()) || ''; if (!c) continue;
    const f = c.split(/\s+/)[0]; if (CARD.test(f)) return f; } return '(no-card)'; };
  // 가로 스크롤을 의도한 컨테이너 안은 잘림·이탈로 보지 않는다 ([L5])
  const scrollable = e => {
    for (let x = e; x && x !== phone; x = x.parentElement) {
      const ov = getComputedStyle(x).overflowX;
      if (ov === 'auto' || ov === 'scroll') return true;
    } return false;
  };

  for (const e of phone.querySelectorAll('*')) {
    if (e.closest('.status, .route, .catalog')) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const inScroll = scrollable(e);
    const t = textOf(e);
    if (t && !inScroll && e.scrollWidth > e.clientWidth + 1) {
      out.clipped.push({ key: `${cardOf(e)}.${slotOf(e)}`, over: e.scrollWidth - e.clientWidth, sample: t.slice(0, 16) });
    }
    if (!inScroll && (r.right > pr.right + 1 || r.left < pr.left - 1)) {
      out.escapee.push({ key: `${cardOf(e)}.${slotOf(e)}`, sample: t.slice(0, 16) });
    }
    const cs = getComputedStyle(e);
    if (cs.display === 'flex' && cs.flexDirection.startsWith('row')) {
      const kids = [...e.children].filter(k => { const kr = k.getBoundingClientRect(); return kr.width > 0 && kr.height > 0; });
      for (let i = 1; i < kids.length; i++) {
        const A = kids[i - 1], B = kids[i];
        const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
        if (Math.abs(a.top - b.top) > 2) continue;          // 줄이 바뀐 쌍은 제외 ([L4])
        if (!textOf(A) || !textOf(B)) continue;             // 둘 다 글자를 가진 쌍만
        out.pairs.push({ key: `${cardOf(e)}.${slotOf(e)}|${slotOf(A)}>${slotOf(B)}|${i}`,
                         gap: Math.round(b.left - a.right) });
      }
    }
  }
  return out;
};

// --- 실행 ---

const PASSES = [
  { id: 'base',   factor: null, text2x: false, note: '한국어 원문 그대로 · 기준선' },
  { id: 'w130',   factor: 1.3,  text2x: false, note: '텍스트 폭 +30%' },
  { id: 'w150',   factor: 1.5,  text2x: false, note: '텍스트 폭 +50%' },
  { id: 'w130t2', factor: 1.3,  text2x: true,  note: '텍스트 폭 +30% & 글자 200%' },
];

const perTarget = {};
const passSummary = {};
const violations = {};
const stretchStats = {};

for (const pass of PASSES) {
  const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
  const sum = { phoneOverflow: 0, clipped: 0, escapee: 0 };
  const st = { stretched: 0, skippedNumeric: 0, skippedGlyph: 0, text2x: 0, exact: 0, maxErrorPct: 0 };
  for (const t of targets) {
    await page.goto(`${URLBASE}?screen=${t.screen}` + (t.popup ? `&popup=${t.popup}` : ''), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (pass.factor) {
      const s = await page.evaluate(STRETCH, { factor: pass.factor });
      st.stretched += s.stretched; st.skippedNumeric += s.skippedNumeric; st.skippedGlyph += s.skippedGlyph;
      st.exact += s.exact ?? 0;
      st.maxErrorPct = Math.max(st.maxErrorPct, s.maxErrorPct ?? 0);
    }
    if (pass.text2x) st.text2x += await page.evaluate(TEXT2X);
    const m = await page.evaluate(MEASURE);
    (perTarget[t.t] ??= {})[pass.id] = m;
    if (m.phoneOverflow > 0) sum.phoneOverflow++;
    if (m.clipped.length) sum.clipped++;
    if (m.escapee.length) sum.escapee++;
  }
  await page.close();
  passSummary[pass.id] = { mode: pass.note, targets: targets.length,
    targetsWithPhoneOverflow: sum.phoneOverflow, targetsWithClipped: sum.clipped,
    targetsWithEscapee: sum.escapee };
  stretchStats[pass.id] = st;
}
await browser.close();

// --- 집계 ---
// 요소 단위로 모은다 ([L6]). target 단위 카운트만으로는 하단 탭바 라벨 하나가
// 182개 target 전부를 "잘림 있음" 으로 만들어 아무 정보가 없다.
const elementRollup = (metric) => {
  const byPass = {};
  for (const pass of PASSES) {
    const m = {};
    for (const [tid, byP] of Object.entries(perTarget)) {
      for (const row of (byP[pass.id]?.[metric] ?? [])) {
        const b = (m[row.key] ??= { key: row.key, targets: new Set(), maxOver: 0, samples: new Set() });
        b.targets.add(tid);
        if (row.over) b.maxOver = Math.max(b.maxOver, row.over);
        if (b.samples.size < 3 && row.sample) b.samples.add(row.sample);
      }
    }
    byPass[pass.id] = m;
  }
  // 여유 등급 — base 에서 이미 깨졌나 / +30% 에서 깨지나 / +50% 에서만 깨지나 / +50% 도 버티나
  const keys = new Set(Object.values(byPass).flatMap(m => Object.keys(m)));
  return [...keys].map(k => {
    const at = p => byPass[p][k];
    const grade = at('base') ? 'base에서 이미 깨짐'
      : at('w130') ? '+30%에서 깨짐'
      : at('w150') ? '+50%에서 깨짐'
      : at('w130t2') ? '+30%와 글자200% 겹칠 때만 깨짐' : '(없음)';
    const src = at('w130t2') ?? at('w150') ?? at('w130') ?? at('base');
    return { key: k, headroom: grade,
      targets: { base: at('base')?.targets.size ?? 0, w130: at('w130')?.targets.size ?? 0,
                 w150: at('w150')?.targets.size ?? 0, w130t2: at('w130t2')?.targets.size ?? 0 },
      maxOver: Math.max(...PASSES.map(p2 => at(p2.id)?.maxOver ?? 0)),
      samples: [...(src?.samples ?? [])] };
  }).sort((a, b) => (b.targets.w130t2 + b.targets.w150) - (a.targets.w130t2 + a.targets.w150));
};

// 붙음 — 절대 간격이 아니라 기준선 대비 좁아짐을 잰다 ([L4])
const pairGaps = {};
for (const [tid, byP] of Object.entries(perTarget)) {
  for (const pass of PASSES) for (const pr of (byP[pass.id]?.pairs ?? [])) {
    ((pairGaps[`${tid}|${pr.key}`] ??= {}))[pass.id] = pr.gap;
  }
}
const squeezed = {};
for (const pass of PASSES) {
  if (pass.id === 'base') continue;
  const rows = [];
  for (const [k, byP] of Object.entries(pairGaps)) {
    const base = byP.base, now = byP[pass.id];
    if (base === undefined || now === undefined) continue;
    if (base >= 4 && now < 4) rows.push({ pair: k, baseGap: base, gap: now });
  }
  const byKey = {};
  for (const r of rows) { const key = r.pair.split('|').slice(1).join('|');
    (byKey[key] ??= { key, targets: 0, minGap: 999, baseGap: r.baseGap });
    byKey[key].targets++; byKey[key].minGap = Math.min(byKey[key].minGap, r.gap); }
  squeezed[pass.id] = Object.values(byKey).sort((a, b) => b.targets - a.targets);
}

const clippedElements = elementRollup('clipped');
const escapeeElements = elementRollup('escapee');

const result = {
  manifest: {
    generatedAt: new Date().toISOString(), schemaVersion: 1,
    script: { name: basename(new URL(import.meta.url).pathname), sha256: sha(readFileSync(new URL(import.meta.url))) },
    target: { path: basename(target), sha256: sha(bytes), designSyncId },
    runner: { node: process.version, playwright: pwVersion, chromium: chromiumVersion, platform: process.platform },
    viewport: { width: 320, height: 720 },
    targetsMeasured: targets.length,
    rules: {
      '번역문': '지어내지 않는다. 각 텍스트 노드의 글자를 순환해 붙여 렌더 폭을 목표 배수까지 늘린다',
      '단위': '글자 수가 아니라 폭. 레이아웃을 깨는 것은 폭이다',
      '정확도': '통째 글자 붙이기는 마지막 한 글자만큼 넘친다. 텍스트가 host 의 유일한 자식이면 host 의 letter-spacing 으로 목표 폭에 정확히 맞추고(exact), 아니면 목표에 더 가까운 글자 수를 고른다(오차 ≤ 반 글자). 남은 최대 오차를 maxErrorPct 로 남긴다',
      '숫자': '글자(한글·라틴)를 포함하지 않은 노드는 늘리지 않는다. 번역해도 숫자는 안 길어진다',
      '아이콘': '문자 기호는 번역 대상이 아니므로 늘리지 않는다',
      '셸': '상태바·화면 ID 배지·카탈로그는 제품이 아니므로 제외한다',
      '기준선': '모든 위반은 base 패스에서 재현되는지 갈라 적는다. 원래 깨져 있던 것은 번역 탓이 아니다',
      '가로 스크롤': '가로 스크롤을 의도한 조상 안의 요소는 잘림·이탈로 세지 않는다',
      '붙음': '절대 간격이 아니라 기준선 대비 좁아짐을 잰다. 같은 줄에 있고 둘 다 글자를 가진 쌍만 본다',
      '집계 단위': 'target 이 아니라 요소(카드.슬롯). 하단 탭바 라벨 하나가 182개 target 을 물들이는 것을 막는다',
      'render-audit 과의 차이': "w130t2 의 글자 200% 는 문자 기호 아이콘을 키우지 않는다(번역 대상이 아니므로). render-audit 의 mobile320t2 는 키운다. 그래서 두 패스의 phoneOverflow 수치는 서로 다르며 서로 대체하지 않는다",
    },
  },
  summary: {
    passes: passSummary, stretch: stretchStats,
    clippedElements, escapeeElements, squeezedPairs: squeezed,
    headroomTally: (() => { const t = {}; for (const r of clippedElements) t[r.headroom] = (t[r.headroom] ?? 0) + 1; return t; })(),
  },
  perTarget: Object.fromEntries(Object.entries(perTarget).map(([k, v]) => [k,
    Object.fromEntries(Object.entries(v).map(([pid, m]) => [pid,
      { phoneOverflow: m.phoneOverflow, contentHeight: m.contentHeight,
        clipped: m.clipped.length, escapee: m.escapee.length }]))])),
};
writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ manifest: result.manifest, summary: result.summary.passes, stretch: stretchStats }, null, 1));
