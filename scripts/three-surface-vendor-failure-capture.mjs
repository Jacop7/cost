import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Actual Expo hosts, synthetic failed save fulfilled BEFORE network dispatch.
// No vendor is created. Native modal transitions/keyboard are not covered here.
const args = new Map(process.argv.slice(2).map((s) => { const [k, ...v] = s.split('='); return [k, v.join('=')]; }));
const expected = args.get('--expect-commit'), output = args.get('--output'), phase = args.get('--phase');
const subject = args.get('--subject') ?? 'vendor';
if (!['vendor', 'ingredient'].includes(subject)) throw Error('Unknown failure subject');
const ingredientSave = subject === 'ingredient';
if (!/^[a-f0-9]{40}$/.test(expected ?? '') || !output || !['before', 'after'].includes(phase)) throw Error('Exact SHA, new output and before/after phase required');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const clean = () => { if (git('rev-parse', 'HEAD') !== expected || git('status', '--porcelain', '--untracked-files=no')) throw Error('Exact clean tracked HEAD required'); };
clean();
const dir = resolve(output); if (existsSync(dir)) throw Error('Preserve old evidence'); mkdirSync(dir, { recursive: true });
const hash = (v) => createHash('sha256').update(v).digest('hex');
const base = args.get('--base-url') ?? 'http://127.0.0.1:8091';
const browser = await chromium.launch({ headless: true });
const rows = [], blocked = [], pageErrors = [], consoleErrors = [];
const message = ingredientSave ? '검수용 실패: 식재료를 저장하지 못했습니다. 입력값은 유지되며 연결을 확인한 뒤 다시 시도해 주세요.' : '검수용 실패: 거래처를 추가하지 못했습니다. 입력한 이름은 유지되며 연결을 확인한 뒤 다시 시도해 주세요.';
const draft = '검수 보존할 거래처 이름';
const formDraft = { '식재료명': '검수 보존할 식재료', '개당 용량': '1.25', '구매 가격': '5432', '안전재고': '2.5', '최소 발주': '3', '메모': '저장 실패 후 유지할 메모' };
const reads = new Set(['settings_lists', 'ingredient_list', 'ingredient_detail', 'stock_history', 'business_day_state', 'get_settings', 'operating_hours_status']);
async function ready(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))); });
}
async function scale(page, factor) {
  return page.evaluate(async (factor) => {
    const weights = [400,500,600,700,800];
    await Promise.all(weights.map(w => document.fonts.load(`${w} 16px PretendardApp`, '거래처 0123'))); await document.fonts.ready;
    const all = [...document.querySelectorAll('*')].map(el => { const s = getComputedStyle(el); return {el, size: parseFloat(s.fontSize), line: parseFloat(s.lineHeight)}; }).filter(e => Number.isFinite(e.size));
    if (factor === 2) for (const {el,size,line} of all) { el.style.setProperty('font-size', `${size*2}px`, 'important'); if(Number.isFinite(line)) el.style.setProperty('line-height', `${line*2}px`, 'important'); }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const mismatchDetails=all.filter(({el,size,line}) => { const s=getComputedStyle(el); return !el.isConnected || !Number.isFinite(parseFloat(s.fontSize)) || Math.abs(parseFloat(s.fontSize)-size*factor)>.05 || (Number.isFinite(line) && (!Number.isFinite(parseFloat(s.lineHeight)) || Math.abs(parseFloat(s.lineHeight)-line*factor)>.05)); }).map(({el,size,line})=>({tag:el.tagName,text:el.textContent?.slice(0,80),connected:el.isConnected,size,line,actualSize:getComputedStyle(el).fontSize,actualLine:getComputedStyle(el).lineHeight}));
    return { factor, fontFailures: weights.filter(w => !document.fonts.check(`${w} 16px PretendardApp`)), mismatches:mismatchDetails.length,mismatchDetails };
  }, factor);
}
try {
  for (const host of ['add','edit']) for (const [width,height,factor] of [[390,844,1],[320,720,1],[320,720,2]]) {
    const key = `${host}-${width}-text${factor}`;
    const context = await browser.newContext({locale:'ko-KR', viewport:{width,height}});
    let simulatedFailures=0;
    await context.route('**/*', async route => {
      const req=route.request(), url=new URL(req.url()), rpc=url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
      if (rpc===(ingredientSave?'save_ingredient':'save_vendor') && req.method()==='POST') { simulatedFailures++; return route.fulfill({status:400, contentType:'application/json', body:JSON.stringify({code:'P0001', message, details:null, hint:null})}); }
      if ((rpc && (!reads.has(rpc) || !['GET','POST','HEAD','OPTIONS'].includes(req.method()))) || (!rpc && !['GET','HEAD','OPTIONS'].includes(req.method()) && !(url.pathname==='/auth/v1/token' && req.method()==='POST'))) {
        blocked.push({key,path:url.pathname,method:req.method()}); return route.abort();
      }
      if(ingredientSave && rpc==='settings_lists') {
        const response=await route.fetch(); if(!response.ok()) throw Error('Settings read prerequisite failed');
        const data=await response.json();
        return route.fulfill({response,json:{...data,categories:[{id:'11111111-1111-4111-8111-111111111111',name:'검수 카테고리',kind:'ingredient'}]}});
      }
      return route.continue();
    });
    const page=await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror',e=>pageErrors.push({key,message:e.message}));
    page.on('console',e=>{if(e.type()==='error') consoleErrors.push({key,message:e.text()});});
    await page.goto(`${base}/ingredients`,{waitUntil:'networkidle'});
    await page.getByRole('button').filter({hasText:'대파'}).first().click(); await page.waitForURL(/\/ingredients\/[a-f0-9-]{36}$/);
    const id=new URL(page.url()).pathname.split('/').pop();
    await page.goto(`${base}/ingredients/${host==='add'?'add':`edit/${id}`}`,{waitUntil:'networkidle'});
    const selectionPrefix=ingredientSave?'카테고리 변경,':'기본 거래처 변경,';
    if(ingredientSave) {
      await page.getByRole('button',{name:/^카테고리 변경,/}).click(); await ready(page);
      await page.getByRole('button',{name:/^검수 카테고리/}).click(); await ready(page);
      await page.getByRole('button',{name:/^단위 .+ 변경$/}).click(); await ready(page);
      await page.getByRole('button',{name:/^kg(, 현재 선택됨)?$/}).click(); await ready(page);
      for(const [label,value] of Object.entries(formDraft)) await page.getByLabel(label,{exact:true}).fill(value);
    }
    const trigger=page.locator(`[aria-label^="${selectionPrefix}"]`); const originalSelection=await trigger.getAttribute('aria-label');
    if(ingredientSave) await page.getByRole('button',{name:host==='add'?'추가':'저장',exact:true}).click();
    else {
      await trigger.click(); await ready(page); await page.getByRole('button',{name:'거래처 추가',exact:true}).click();
      await page.getByLabel('새 거래처 이름',{exact:true}).fill(draft); await page.getByRole('dialog').getByRole('button',{name:'추가',exact:true}).click();
    }
    await ready(page);
    if(simulatedFailures!==1) throw Error(`Expected exactly one intercepted failure: ${key}`);
    // networkidle can precede the RN Modal mount/slide. Wait for the actual error UI,
    // then its animation; a one-shot isVisible races the newly presented modal.
    if(phase==='after') { await page.getByText(message,{exact:true}).waitFor({state:'visible'}); await ready(page); }
    const errorShown=await page.getByText(message,{exact:true}).isVisible(); if(errorShown!==(phase==='after')) throw Error(`Unexpected error visibility ${key}`);
    const scaling=await scale(page,factor); if(scaling.mismatches||scaling.fontFailures.length) throw Error(`Scaling failed ${key}: ${JSON.stringify(scaling)}`);
    const file=`${key}-failure.png`, png=await page.screenshot({fullPage:true}); writeFileSync(resolve(dir,file),png,{flag:'wx'});
    const geometry=await page.evaluate(()=>{ const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}; return {documentOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),modals:[...document.querySelectorAll('[aria-modal="true"]')].map(el=>({box:box(el),text:el.textContent,controls:[...el.querySelectorAll('[role="button"]')].map(b=>({name:b.getAttribute('aria-label')||b.textContent,box:box(b)}))}))};});
    if(phase==='after'){await page.getByRole('button',{name:'확인',exact:true}).click();await ready(page);}
    const retainedValues={};
    for(const [label,value] of Object.entries(ingredientSave?formDraft:{'새 거래처 이름':draft})) retainedValues[label]={expected:value,actual:await page.getByLabel(label,{exact:true}).inputValue()};
    const retained=Object.values(retainedValues).every(v=>v.expected===v.actual);
    if(!retained) throw Error(`Draft lost ${key}`);
    const currentSelection=await trigger.getAttribute('aria-label');
    if(currentSelection!==originalSelection) throw Error(`Selection changed ${key}`);
    rows.push({key,host,width,height,sourceCommit:expected,errorShown,simulatedFailures,originalSelection,currentSelection,retained,retainedValues,scaling,geometry,shot:{file,sha256:hash(png)}});
    await context.close();
  }
  clean();
  const evidence={sourceCommit:expected,phase,subject,scriptSha256:hash(readFileSync(new URL(import.meta.url))),browserVersion:browser.version(),scope:'ING02/04 actual web hosts; only selected subject save is intercepted; ingredient subject substitutes category read. Surrounding live reads, no writes dispatched. Font/line-height approximation, not native, all-consumer coverage or complete clipping proof. Operator restarts served bundle after source change.',rows,blocked,pageErrors,consoleErrors};
  writeFileSync(resolve(dir,'vendor-failure-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({rows:rows.length,blocked,pageErrors,consoleErrors,output:dir})); if(blocked.length||pageErrors.length) process.exitCode=1;
} catch(error) {writeFileSync(resolve(dir,'vendor-failure-failed.json'),JSON.stringify({sourceCommit:expected,message:String(error),rows,blocked,pageErrors,consoleErrors},null,2)+'\n',{flag:'wx'});console.error(error);process.exitCode=1;}
finally {await browser.close();}
