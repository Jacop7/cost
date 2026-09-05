#!/usr/bin/env node
/**
 * design-audit.mjs — 프로토타입의 디자인 축을 역할 단위로 전수 측정한다.
 *
 * 타이포만 재던 render-audit 과 달리, 토큰 기획에 필요한 축을 전부 낸다:
 *   타이포(카드×슬롯) · 색 · 대비 · 간격 · 반경 · 그림자 · 컨트롤 높이 · 터치 영역 · 아이콘
 *
 * 세는 규칙
 *  - 대상은 제품 UI 뿐이다. 프로토타입 셸(폰 목업 상태바·화면 ID 배지·카탈로그)은 제외한다.
 *  - 문자 기호 아이콘은 타이포가 아니므로 타이포 집계에서 빼고 아이콘으로 따로 센다.
 *  - "슬롯"은 요소의 첫 클래스(없으면 태그)이고, "카드"는 가장 가까운 카드류 조상이다.
 *    같은 슬롯이 카드 안에서 여러 스타일을 가지면 그것이 곧 역할 미배정이다.
 *  - 간격은 값만 세지 않고 **무엇과 무엇 사이인지**(부모 슬롯 → 자식 슬롯)를 함께 남긴다.
 *    값만 세면 4px 이 "값-단위 사이"인지 "카드 사이"인지 알 수 없어 토큰으로 못 옮긴다.
 *  - margin 이 `auto` 로 **선언된** 자리는 간격 집계에서 뺀다. 이때 computed 값은
 *    남은 공간을 나눈 레이아웃 결과지 디자이너가 고른 간격이 아니다. 픽셀 크기로
 *    거르면(예: 40px 초과) 진짜 40px 여백까지 같이 날아가므로, 스타일시트에서
 *    **선언값**을 찾아 auto 인 것만 뺀다. 뺀 개수는 manifest 에 남긴다.
 *
 * 과거 실패 기록
 *  [L1] margin:auto 를 거르지 않아 104px·44px 같은 레이아웃 잔여값이 간격 후보로 올라왔다.
 *  [L2] 그 뒤 "40px 초과 또는 정수 아님" 이라는 크기 휴리스틱으로 걸렀는데, 이는 값의
 *       출처가 아니라 값의 크기를 보는 것이라 재현 규칙이 되지 못한다. 선언값 조회로 바꿨다.
 *  [L3] 간격 집계 키에서 **변(side)을 버렸다.** `padding|2|a>b` 만 남기니 좌우인지 상하인지
 *       알 수 없었고, 그 결과 `.edit-form-label{margin:0 2px 7px}` 의 2px 을 "라벨과 입력
 *       사이 baseline 보정" 이라고 잘못 읽었다. 실제로 2px 은 좌우이고 아래는 7px 이다.
 *       간격은 방향이 곧 역할이므로 변을 키에 남긴다.
 *  [L7] `source` 를 "여기 선언이 있나" 로만 판정해, 조상의 작성자 선언이 내려온 **상속값**을
 *       브라우저 기본값과 같은 `ua` 로 묶었다. 색 `ua` 2,718 관측의 대부분은 브라우저가 고른
 *       값이 아니라 상속된 작성자 색이다. 상속되는 속성에 한해 조상을 훑어 `inherited` 로
 *       나눈다. 나누지 않으면 "아무도 고르지 않은 값" 이라는 정의가 거짓이 된다.
 *  [L4] **작성자가 선언한 값과 브라우저 기본값을 섞어 셌다.** `.expo-more` 는 `<button>` 인데
 *       padding 선언이 아예 없다. 그래서 Chrome 기본 `padding:1px 6px` 가 1px·6px 관측으로
 *       올라왔고, 그 둘이 "광학 보정 스케일" 의 최대 항목이 됐다. **아무도 고르지 않은 값을
 *       토큰 후보로 올릴 뻔했다.** 모든 축에 `source` 를 붙인다 —
 *       `author`(스타일시트 규칙) · `inline`(요소 style 속성) · `ua`(둘 다 없음 = 브라우저 기본).
 *  [L5] 타이포 키에 크기·굵기만 넣고 **행간·자간을 버렸다.** 수집은 해 놓고 집계에서 없앴다.
 *       가이드는 역할마다 행간을 요구하는데, 버린 축은 "미매핑 0" 이라고 말할 수 없다.
 *  [L6] 컨트롤 높이를 `<input>` 자신에서 쟀다. 실제 컨트롤은 그 입력을 감싼 shell 이다.
 *       상호작용 요소가 자기보다 큰 조작 상자 안에 있으면 그 상자를 컨트롤로 본다.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const req=createRequire(import.meta.url);

const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const opt=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>a.replace(/^--/,'').split('=')));
const target=resolve(args[0]??'docs/prototypes/0_full-page-flow-prototype-ui-applied.html');
const outPath=resolve(args[1]??'docs/prototypes/design-audit.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const textSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
const bytes=readFileSync(target);
const designSyncId=(bytes.toString('utf8').match(/<!--\s*DESIGN_SYNC:\s*(DS-\d{8}-\d{3})\s*-->/)||[])[1]??null;
let pw=null; try{pw=req('playwright/package.json').version;}catch{}

const URLBASE=pathToFileURL(target).href;
const browser=await chromium.launch(opt.executable?{executablePath:opt.executable}:{});

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
const boot=await newPinnedPage(browser); await boot.goto(URLBASE,{waitUntil:'load'});

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

const reg=await boot.evaluate(()=>{
  const hidden=Object.entries(screens).filter(([,s])=>s.hidden).map(([k])=>k);
  const pairs=[]; for(const [h,l] of Object.entries(popupTabs)) for(const [i] of l) pairs.push({id:i,host:h});
  return {screenKeys:Object.keys(screens),hidden,pairs};});
await boot.close();
const targets=[
  ...reg.screenKeys.filter(s=>!reg.hidden.includes(s)).map(s=>({t:`screen:${s}`,screen:s,popup:null})),
  ...reg.pairs.filter(p=>!reg.hidden.includes(p.host)).map(p=>({t:`popup:${p.id}@${p.host}`,screen:p.host,popup:p.id})),
];

const COLLECT=({SCALE})=>{
  // 선언값 조회 — 이 요소에 걸린 CSS 규칙을 캐스케이드 순서로 훑어 margin 선언값을 찾는다.
  // 인라인 style 이 가장 세고, 그 다음이 뒤에 온 규칙이다. (동일 명시도 가정: 프로토타입은
  // 단일 <style> 블록 하나뿐이라 문서 순서가 곧 캐스케이드 순서다.)
  const RULES=(()=>{ const r=[];
    for(const ss of document.styleSheets){ let list; try{list=ss.cssRules;}catch{continue;}
      const walk=cl=>{ for(const c of cl){ if(c.type===1) r.push(c);
        else if(c.cssRules) walk(c.cssRules); } };
      walk(list); }
    return r; })();
  const AUTO_CACHE=new WeakMap();
  const declaredAutoMargins=e=>{
    let v=AUTO_CACHE.get(e); if(v) return v;
    const sides={mt:false,mr:false,mb:false,ml:false};
    const apply=d=>{
      const sh=d.getPropertyValue('margin');
      if(sh){ const p=sh.trim().split(/\s+/);
        const [t,r2,b,l]=p.length===1?[p[0],p[0],p[0],p[0]]
          :p.length===2?[p[0],p[1],p[0],p[1]]
          :p.length===3?[p[0],p[1],p[2],p[1]]:[p[0],p[1],p[2],p[3]];
        sides.mt=t==='auto'; sides.mr=r2==='auto'; sides.mb=b==='auto'; sides.ml=l==='auto'; }
      const one=(prop,k)=>{ const x=d.getPropertyValue(prop); if(x) sides[k]=x.trim()==='auto'; };
      one('margin-top','mt'); one('margin-right','mr');
      one('margin-bottom','mb'); one('margin-left','ml');
      const inl=d.getPropertyValue('margin-inline');
      if(inl){ const p=inl.trim().split(/\s+/); sides.ml=p[0]==='auto'; sides.mr=(p[1]??p[0])==='auto'; }
      one('margin-inline-start','ml'); one('margin-inline-end','mr');
    };
    for(const rule of RULES){ let m=false; try{m=e.matches(rule.selectorText);}catch{}
      if(m) apply(rule.style); }
    apply(e.style);
    AUTO_CACHE.set(e,sides); return sides;
  };
  let autoSkipped=0;
  // 선언 출처 판정 ([L4]) — 이 요소의 이 속성을 작성자가 정했는가, 브라우저가 정했는가
  const DECL_CACHE=new WeakMap();
  const declaredProps=e=>{
    let set=DECL_CACHE.get(e); if(set) return set;
    set={author:new Set(),inline:new Set()};
    for(const rule of RULES){ let m=false; try{m=e.matches(rule.selectorText);}catch{}
      if(!m) continue;
      for(let i=0;i<rule.style.length;i++) set.author.add(rule.style[i]);
    }
    for(let i=0;i<e.style.length;i++) set.inline.add(e.style[i]);
    DECL_CACHE.set(e,set); return set;
  };
  const SHORTHAND={
    'padding-top':['padding'],'padding-right':['padding'],'padding-bottom':['padding'],'padding-left':['padding'],
    'margin-top':['margin','margin-block'],'margin-right':['margin','margin-inline'],
    'margin-bottom':['margin','margin-block'],'margin-left':['margin','margin-inline'],
    'row-gap':['gap'],'column-gap':['gap'],
    'border-top-width':['border','border-width','border-top'],
    'border-top-color':['border','border-color','border-top'],
    'background-color':['background','background-color'],
    'border-radius':['border-radius','border-top-left-radius','border-top-right-radius',
      'border-bottom-right-radius','border-bottom-left-radius'],
  };
  // 상속되는 속성 — 여기 선언이 없어도 조상의 작성자 선언이 내려온 것일 수 있다.
  const INHERITED=new Set(['color','font-weight','line-height','letter-spacing','font-size','font-family']);
  const sourceOf=(e,prop)=>{
    const names=[prop,...(SHORTHAND[prop]??[])];
    // 브라우저가 shorthand 를 longhand 로 펼쳐 열거하는 경우가 있어 접두 일치도 함께 본다
    const hit=(set)=>names.some(n=>set.has(n))||[...set].some(n=>names.some(x=>n===x||n.startsWith(x+'-')));
    const d=declaredProps(e);
    if(hit(d.inline)) return 'inline';
    if(hit(d.author)) return 'author';
    if(INHERITED.has(prop)){
      // 조상에 작성자 선언이 있으면 그건 브라우저가 고른 값이 아니라 **상속된 작성자 값**이다.
      for(let x=e.parentElement;x;x=x.parentElement){
        const dx=declaredProps(x);
        if(hit(dx.inline)||hit(dx.author)) return 'inherited';
      }
    }
    return 'ua';
  };

  const CARD=/^(card|expo-list-card|expo-pick-card|expo-row|expo-card|settings-|detail-|sheet-|hub-|option-card|revenue-|channel-|menu-|sales-|analysis-|tax-|edit-|stock-|order-|recipe-)/;
  const GLYPH=/^[＋+−–—‹›⌄•⋮▸▾✓✗▣●◔▰×…\s]*$/;
  const content=document.getElementById('content'), overlay=document.getElementById('overlay');
  const phone=document.querySelector('.phone');
  const isProduct=e=>(content&&content.contains(e))||(overlay&&overlay.contains(e))
    ||[...(phone?.children||[])].some(c=>/layer|popover/i.test(c.className||'')&&c.contains(e));
  const slotOf=e=>((typeof e.className==='string'&&e.className.trim())||'').split(/\s+/)[0]||e.tagName.toLowerCase();
  const cardOf=e=>{ for(let x=e.parentElement;x;x=x.parentElement){
    const c=(typeof x.className==='string'&&x.className.trim())||''; if(!c)continue;
    const f=c.split(/\s+/)[0]; if(CARD.test(f)) return f; } return '(no-card)'; };
  const px=v=>{const n=parseFloat(v); return Number.isFinite(n)?Math.round(n*100)/100:null;};

  // --- 대비(contrast) ---
  // WCAG 2.x 상대 휘도와 대비비. 텍스트가 실제로 어느 배경 위에 그려지는지 찾아야 하므로
  // 투명하지 않은 가장 가까운 조상의 배경색을 쓴다. 반투명이 섞이면 알파 합성한다.
  const parseRGB=v=>{const m=/rgba?\(([^)]+)\)/.exec(v||''); if(!m)return null;
    const p=m[1].split(',').map(x=>parseFloat(x)); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
  const overCompose=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a), g:fg.g*fg.a+bg.g*(1-fg.a), b:fg.b*fg.a+bg.b*(1-fg.a), a:1});
  const lum=c=>{const f=x=>{x/=255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);};
    return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
  const ratio=(a,b)=>{const l1=lum(a),l2=lum(b); const hi=Math.max(l1,l2),lo=Math.min(l1,l2);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;};
  const effectiveBg=e=>{
    let acc=null;
    for(let x=e;x;x=x.parentElement){
      const c=parseRGB(getComputedStyle(x).backgroundColor);
      if(!c||c.a===0) continue;
      acc = acc===null ? c : overCompose(acc,c);
      if(acc.a>=1) return acc;
    }
    return acc ?? {r:255,g:255,b:255,a:1};   // 끝까지 불투명 배경이 없으면 흰색으로 본다
  };

  const out={typo:[],color:[],space:[],radius:[],shadow:[],control:[],touch:[],icon:[],contrast:[]};
  const all=(phone||document.body).querySelectorAll('*');
  for(const e of all){
    if(!isProduct(e))continue;
    const cs=getComputedStyle(e), rect=e.getBoundingClientRect();
    const slot=slotOf(e), card=cardOf(e);
    let txt=''; e.childNodes.forEach(n=>{if(n.nodeType===3)txt+=n.nodeValue;});
    if(e.tagName==='INPUT'||e.tagName==='TEXTAREA') txt+=(e.value||'')+(e.placeholder||'');
    txt=txt.trim();

    if(txt){
      if(GLYPH.test(txt)) out.icon.push({card,slot,size:cs.fontSize,weight:cs.fontWeight,
        color:cs.color,w:px(rect.width),h:px(rect.height),glyph:txt.slice(0,4)});
      else {
        out.typo.push({card,slot,size:cs.fontSize,weight:cs.fontWeight,lh:cs.lineHeight,
          color:cs.color,ls:cs.letterSpacing,tabular:cs.fontVariantNumeric,sample:txt.slice(0,20),
          weightSource:sourceOf(e,'font-weight'),lhSource:sourceOf(e,'line-height')});
        out.color.push({role:'text',card,slot,value:cs.color,source:sourceOf(e,'color')});
        // 대비 — 굵기·크기로 '큰 글자' 여부를 갈라 기준을 다르게 적용한다(WCAG 1.4.3)
        const fg=parseRGB(cs.color), bgc=effectiveBg(e);
        if(fg&&bgc){
          const fgOn = fg.a<1 ? overCompose(fg,bgc) : fg;
          const px=parseFloat(cs.fontSize), w=parseInt(cs.fontWeight,10)||400;
          const large = px>=24 || (px>=18.66 && w>=700);
          const r=ratio(fgOn,bgc);
          out.contrast.push({card,slot,size:cs.fontSize,weight:cs.fontWeight,
            fg:cs.color, bg:`rgb(${Math.round(bgc.r)}, ${Math.round(bgc.g)}, ${Math.round(bgc.b)})`,
            ratio:r, large, passAA: r >= (large?3:4.5), passAAA: r >= (large?4.5:7),
            sample:txt.slice(0,16)});
        }
      }
    }
    if(cs.backgroundColor&&cs.backgroundColor!=='rgba(0, 0, 0, 0)')
      out.color.push({role:'bg',card,slot,value:cs.backgroundColor,source:sourceOf(e,'background-color')});
    if(px(cs.borderTopWidth)) out.color.push({role:'border',card,slot,value:cs.borderTopColor,width:cs.borderTopWidth,
      source:sourceOf(e,'border-top-color')});
    if(cs.borderRadius!=='0px') out.radius.push({card,slot,value:cs.borderRadius,
      w:px(rect.width),h:px(rect.height),source:sourceOf(e,'border-radius')});
    if(cs.boxShadow&&cs.boxShadow!=='none') out.shadow.push({card,slot,value:cs.boxShadow});

    // 간격 — 부모 슬롯 → 자식 슬롯 관계로 남긴다
    const p=e.parentElement, pslot=p?slotOf(p):'(root)';
    const PADPROP={pt:'padding-top',pr:'padding-right',pb:'padding-bottom',pl:'padding-left'};
    for(const [k,v] of [['pt',cs.paddingTop],['pr',cs.paddingRight],['pb',cs.paddingBottom],['pl',cs.paddingLeft]])
      if(px(v)) out.space.push({kind:'padding',side:k,card,slot,parent:pslot,value:px(v),source:sourceOf(e,PADPROP[k])});
    const autoM=declaredAutoMargins(e);
    const MARPROP={mt:'margin-top',mr:'margin-right',mb:'margin-bottom',ml:'margin-left'};
    for(const [k,v] of [['mt',cs.marginTop],['mr',cs.marginRight],['mb',cs.marginBottom],['ml',cs.marginLeft]])
      if(px(v)&&px(v)>0){ if(autoM[k]){autoSkipped++; continue;}
        out.space.push({kind:'margin',side:k,card,slot,parent:pslot,value:px(v),source:sourceOf(e,MARPROP[k])}); }
    if(cs.gap&&cs.gap!=='normal') cs.gap.split(' ').forEach((g,i)=>{ if(px(g))
      out.space.push({kind:'gap',side:i?'col':'row',card,slot,parent:pslot,value:px(g),
        source:sourceOf(e,i?'column-gap':'row-gap')}); });

    // 컨트롤 높이 · 터치 영역
    const interactive=/^(button|a|input|select|textarea)$/.test(e.tagName.toLowerCase())
      || e.getAttribute('role')==='button' || e.hasAttribute('data-screen-link') || e.hasAttribute('data-popup-link');
    if(interactive&&rect.width>0){
      // 실제 컨트롤은 <input> 자신이 아니라 그것을 감싼 조작 상자다 ([L6]).
      // 입력이 자기보다 확실히 큰 상자 안에 있으면 그 상자를 컨트롤로 본다.
      let ctl=e, ctlRect=rect, promoted=null;
      if(/^(input|textarea|select)$/.test(e.tagName.toLowerCase())){
        for(let x=e.parentElement, up=0; x && up<3; x=x.parentElement, up++){
          const xr=x.getBoundingClientRect();
          if(xr.height >= rect.height+6 && xr.width>0 && xr.height<=96){ ctl=x; ctlRect=xr; promoted=slotOf(x); break; }
        }
      }
      const ccs=ctl===e?cs:getComputedStyle(ctl);
      out.control.push({card,slot:slotOf(ctl),tag:ctl.tagName.toLowerCase(),
        h:px(ctlRect.height),w:px(ctlRect.width),radius:ccs.borderRadius,
        size:cs.fontSize,weight:cs.fontWeight,label:txt.slice(0,18),
        innerTag:ctl===e?null:e.tagName.toLowerCase(), promotedFrom:promoted?slot:null});
      if(ctlRect.height<44||ctlRect.width<44)
        out.touch.push({card,slot:slotOf(ctl),h:px(ctlRect.height),w:px(ctlRect.width),label:txt.slice(0,18)});
    }
  }
  out._autoSkipped=autoSkipped;
  return out;
};

const SCALE=['22px','20px','18px','16px','14px','13px'];
const agg={typo:{},color:{},space:{},radius:{},shadow:{},control:{},touch:{},icon:{},contrast:{},contrastRole:{}};
const push=(bucket,key,extra)=>{ const b=(agg[bucket][key]??={n:0,ex:new Set()}); b.n++;
  if(extra&&b.ex.size<3) b.ex.add(extra); };

let autoSkippedTotal=0;
const page=await newPinnedPage(browser,{viewport:{width:390,height:844}});
for(const t of targets){
  await page.goto(`${URLBASE}?screen=${t.screen}`+(t.popup?`&popup=${t.popup}`:''),{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready);
  const r=await page.evaluate(COLLECT,{SCALE});
  autoSkippedTotal+=r._autoSkipped||0;
  r.typo.forEach(x=>push('typo',`${x.card}|${x.slot}|${x.size}/${x.weight}/${x.lh}/${x.ls}`,x.sample));
  r.color.forEach(x=>push('color',`${x.role}|${x.value}|${x.source}`,`${x.card}.${x.slot}`));
  r.space.forEach(x=>push('space',`${x.kind}|${x.side}|${x.value}|${x.parent}>${x.slot}|${x.source}`,x.card));
  r.radius.forEach(x=>push('radius',`${x.value}|${x.card}.${x.slot}|${x.source}`,`${x.w}x${x.h}`));
  r.shadow.forEach(x=>push('shadow',`${x.value}`,`${x.card}.${x.slot}`));
  r.control.forEach(x=>push('control',`${x.tag}|h${x.h}|${x.radius}|${x.size}/${x.weight}${x.innerTag?'|shell of '+x.innerTag:''}`,`${x.card}.${x.slot} "${x.label}"`));
  r.touch.forEach(x=>push('touch',`${x.card}.${x.slot}|${x.w}x${x.h}`,x.label));
  r.icon.forEach(x=>push('icon',`${x.size}/${x.weight}|${x.card}.${x.slot}`,x.glyph));
  r.contrast.forEach(x=>{
    push('contrast',`${x.fg} on ${x.bg}|${x.ratio}|${x.large?'large':'normal'}|${x.passAA?'AA':'FAIL'}`,
      `${x.card}.${x.slot} ${x.size}/${x.weight} "${x.sample}"`);
    // 역할별로도 모은다. "이 색을 어떻게 고칠까" 가 아니라 **"이 자리가 대비 요건 대상인가"**
    // 를 물으려면 색이 아니라 슬롯으로 봐야 한다. WCAG 1.4.3 은 비활성 컴포넌트와
    // placeholder 를 요건에서 제외하므로, 같은 색이라도 자리에 따라 판단이 갈린다.
    push('contrastRole',`${x.card}.${x.slot}|${x.fg}|${x.bg}|${x.ratio}|${x.passAA?'AA':'FAIL'}`,x.sample);
  });
}
await browser.close();

const dump=b=>Object.entries(agg[b]).map(([k,v])=>({key:k,n:v.n,ex:[...v.ex]})).sort((a,b2)=>b2.n-a.n);
const result={
  manifest:{generatedAt:new Date().toISOString(),schemaVersion:1,
    script:{name:basename(new URL(import.meta.url).pathname),sha256:textSha(readFileSync(new URL(import.meta.url)))},
    target:{path:basename(target),sha256:sha(bytes),designSyncId},
    runner:{node:process.version,playwright:pw,chromium:'see render-audit',clock:CLOCK,clockSample: CLOCK_SAMPLE, clockNote:'프로토타입이 스스로 new Date() 를 읽으므로 시계도 측정 입력이다 (PRT-209)'},
    viewport:{width:390,height:844}, targetsMeasured:targets.length,
    marginAutoExcluded:autoSkippedTotal,
    rules:{ '대상':'제품 UI 만. 프로토타입 셸 제외',
      '아이콘':'문자 기호는 타이포에서 빼고 icon 으로 따로 센다',
      '슬롯':'요소의 첫 클래스(없으면 태그)',
      '카드':'가장 가까운 카드류 조상',
      '간격':'값만 세지 않고 부모 슬롯 > 자식 슬롯 관계와 변(top/right/bottom/left, row/col)을 함께 남긴다',
      '출처':"모든 값에 source 를 붙인다 — author(이 요소에 걸린 스타일시트 규칙이 선언) · inline(요소 style 속성) · inherited(여기 선언은 없지만 조상의 작성자 선언이 내려온 것. 상속되는 속성에만 해당) · ua(아무도 선언하지 않은 브라우저 기본값). inherited 와 ua 를 나누지 않으면 '상속된 작성자 색' 을 '아무도 고르지 않은 값' 이라고 잘못 부르게 된다",
      '타이포':'키에 행간·자간을 포함한다. 버린 축은 미매핑 0 이라고 말할 수 없다',
      '컨트롤':'input 자신이 아니라 그것을 감싼 조작 상자를 컨트롤로 본다',
      '대비 역할':'색 조합만이 아니라 **카드.슬롯 단위로도** 모은다. WCAG 1.4.3 은 비활성 컴포넌트와 placeholder 를 대비 요건에서 제외하므로, 같은 색이라도 자리에 따라 판단이 갈린다. 색을 고칠지 역할을 나눌지는 슬롯을 봐야 정해진다',
      '대비':'WCAG 2.x 상대 휘도로 대비비를 낸다. 배경은 투명하지 않은 가장 가까운 조상의 배경색이고, 반투명이 섞이면 알파 합성한다. 24px 이상 또는 18.66px 이상&700 이상은 큰 글자로 보아 기준을 3:1 로, 나머지는 4.5:1 로 적용한다',
      'margin auto':'스타일시트 선언값이 auto 인 변은 뺀다. computed 픽셀은 레이아웃 결과라 간격 결정이 아니다' }},
  summary:Object.fromEntries(Object.keys(agg).map(b=>[b,{종류:Object.keys(agg[b]).length,
    합계:Object.values(agg[b]).reduce((a,v)=>a+v.n,0)}])),
  typo:dump('typo'),color:dump('color'),space:dump('space'),radius:dump('radius'),contrast:dump('contrast'),
  shadow:dump('shadow'),control:dump('control'),touch:dump('touch'),icon:dump('icon'),
  contrastRole:dump('contrastRole'),
};
writeFileSync(outPath,JSON.stringify(result,null,1)+'\n');
console.log(JSON.stringify({manifest:result.manifest,summary:result.summary},null,1));
