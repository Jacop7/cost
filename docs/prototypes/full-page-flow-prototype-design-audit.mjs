#!/usr/bin/env node
/**
 * design-audit.mjs — 프로토타입의 디자인 축을 역할 단위로 전수 측정한다.
 *
 * 타이포만 재던 render-audit 과 달리, 토큰 기획에 필요한 축을 전부 낸다:
 *   타이포(카드×슬롯) · 색 · 간격 · 반경 · 그림자 · 컨트롤 높이 · 터치 영역 · 아이콘
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
const bytes=readFileSync(target);
const designSyncId=(bytes.toString('utf8').match(/<!--\s*DESIGN_SYNC:\s*(DS-\d{8}-\d{3})\s*-->/)||[])[1]??null;
let pw=null; try{pw=req('playwright/package.json').version;}catch{}

const URLBASE=pathToFileURL(target).href;
const browser=await chromium.launch(opt.executable?{executablePath:opt.executable}:{});
const boot=await browser.newPage(); await boot.goto(URLBASE,{waitUntil:'load'});
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

  const out={typo:[],color:[],space:[],radius:[],shadow:[],control:[],touch:[],icon:[]};
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
          color:cs.color,ls:cs.letterSpacing,tabular:cs.fontVariantNumeric,sample:txt.slice(0,20)});
        out.color.push({role:'text',card,slot,value:cs.color});
      }
    }
    if(cs.backgroundColor&&cs.backgroundColor!=='rgba(0, 0, 0, 0)')
      out.color.push({role:'bg',card,slot,value:cs.backgroundColor});
    if(px(cs.borderTopWidth)) out.color.push({role:'border',card,slot,value:cs.borderTopColor,width:cs.borderTopWidth});
    if(cs.borderRadius!=='0px') out.radius.push({card,slot,value:cs.borderRadius,
      w:px(rect.width),h:px(rect.height)});
    if(cs.boxShadow&&cs.boxShadow!=='none') out.shadow.push({card,slot,value:cs.boxShadow});

    // 간격 — 부모 슬롯 → 자식 슬롯 관계로 남긴다
    const p=e.parentElement, pslot=p?slotOf(p):'(root)';
    for(const [k,v] of [['pt',cs.paddingTop],['pr',cs.paddingRight],['pb',cs.paddingBottom],['pl',cs.paddingLeft]])
      if(px(v)) out.space.push({kind:'padding',side:k,card,slot,parent:pslot,value:px(v)});
    const autoM=declaredAutoMargins(e);
    for(const [k,v] of [['mt',cs.marginTop],['mr',cs.marginRight],['mb',cs.marginBottom],['ml',cs.marginLeft]])
      if(px(v)&&px(v)>0){ if(autoM[k]){autoSkipped++; continue;}
        out.space.push({kind:'margin',side:k,card,slot,parent:pslot,value:px(v)}); }
    if(cs.gap&&cs.gap!=='normal') cs.gap.split(' ').forEach((g,i)=>{ if(px(g))
      out.space.push({kind:'gap',side:i?'col':'row',card,slot,parent:pslot,value:px(g)}); });

    // 컨트롤 높이 · 터치 영역
    const interactive=/^(button|a|input|select|textarea)$/.test(e.tagName.toLowerCase())
      || e.getAttribute('role')==='button' || e.hasAttribute('data-screen-link') || e.hasAttribute('data-popup-link');
    if(interactive&&rect.width>0){
      out.control.push({card,slot,tag:e.tagName.toLowerCase(),h:px(rect.height),w:px(rect.width),
        radius:cs.borderRadius,size:cs.fontSize,weight:cs.fontWeight,label:txt.slice(0,18)});
      if(rect.height<44||rect.width<44)
        out.touch.push({card,slot,h:px(rect.height),w:px(rect.width),label:txt.slice(0,18)});
    }
  }
  out._autoSkipped=autoSkipped;
  return out;
};

const SCALE=['22px','20px','18px','16px','14px','13px'];
const agg={typo:{},color:{},space:{},radius:{},shadow:{},control:{},touch:{},icon:{}};
const push=(bucket,key,extra)=>{ const b=(agg[bucket][key]??={n:0,ex:new Set()}); b.n++;
  if(extra&&b.ex.size<3) b.ex.add(extra); };

let autoSkippedTotal=0;
const page=await browser.newPage({viewport:{width:390,height:844}});
for(const t of targets){
  await page.goto(`${URLBASE}?screen=${t.screen}`+(t.popup?`&popup=${t.popup}`:''),{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready);
  const r=await page.evaluate(COLLECT,{SCALE});
  autoSkippedTotal+=r._autoSkipped||0;
  r.typo.forEach(x=>push('typo',`${x.card}|${x.slot}|${x.size}/${x.weight}`,x.sample));
  r.color.forEach(x=>push('color',`${x.role}|${x.value}`,`${x.card}.${x.slot}`));
  r.space.forEach(x=>push('space',`${x.kind}|${x.value}|${x.parent}>${x.slot}`,x.card));
  r.radius.forEach(x=>push('radius',`${x.value}|${x.card}.${x.slot}`,`${x.w}x${x.h}`));
  r.shadow.forEach(x=>push('shadow',`${x.value}`,`${x.card}.${x.slot}`));
  r.control.forEach(x=>push('control',`${x.tag}|h${x.h}|${x.radius}|${x.size}/${x.weight}`,`${x.card}.${x.slot} "${x.label}"`));
  r.touch.forEach(x=>push('touch',`${x.card}.${x.slot}|${x.w}x${x.h}`,x.label));
  r.icon.forEach(x=>push('icon',`${x.size}/${x.weight}|${x.card}.${x.slot}`,x.glyph));
}
await browser.close();

const dump=b=>Object.entries(agg[b]).map(([k,v])=>({key:k,n:v.n,ex:[...v.ex]})).sort((a,b2)=>b2.n-a.n);
const result={
  manifest:{generatedAt:new Date().toISOString(),schemaVersion:1,
    script:{name:basename(new URL(import.meta.url).pathname),sha256:sha(readFileSync(new URL(import.meta.url)))},
    target:{path:basename(target),sha256:sha(bytes),designSyncId},
    runner:{node:process.version,playwright:pw,chromium:'see render-audit'},
    viewport:{width:390,height:844}, targetsMeasured:targets.length,
    marginAutoExcluded:autoSkippedTotal,
    rules:{ '대상':'제품 UI 만. 프로토타입 셸 제외',
      '아이콘':'문자 기호는 타이포에서 빼고 icon 으로 따로 센다',
      '슬롯':'요소의 첫 클래스(없으면 태그)',
      '카드':'가장 가까운 카드류 조상',
      '간격':'값만 세지 않고 부모 슬롯 > 자식 슬롯 관계를 함께 남긴다',
      'margin auto':'스타일시트 선언값이 auto 인 변은 뺀다. computed 픽셀은 레이아웃 결과라 간격 결정이 아니다' }},
  summary:Object.fromEntries(Object.keys(agg).map(b=>[b,{종류:Object.keys(agg[b]).length,
    합계:Object.values(agg[b]).reduce((a,v)=>a+v.n,0)}])),
  typo:dump('typo'),color:dump('color'),space:dump('space'),radius:dump('radius'),
  shadow:dump('shadow'),control:dump('control'),touch:dump('touch'),icon:dump('icon'),
};
writeFileSync(outPath,JSON.stringify(result,null,1)+'\n');
console.log(JSON.stringify({manifest:result.manifest,summary:result.summary},null,1));
