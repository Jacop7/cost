// Read-only browser-response diagnostic. No save/confirm/cancel-order clicks.
// Run only after restarting the local Expo server at --expect-commit.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';


const args = new Map(process.argv.slice(2).map(s => { const [k,...v]=s.split('='); return [k,v.join('=')]; }));
if ([...args.keys()].some(k=>!['--expect-commit','--output'].includes(k))) throw Error('Unsupported argument');
const expected=args.get('--expect-commit'), output=args.get('--output');
if(!/^[a-f0-9]{40}$/.test(expected??'')) throw Error('Exact SHA required');
if(!output||existsSync(resolve(output))) throw Error('New output required');
const dir=resolve(output); mkdirSync(dir,{recursive:true});
const base='http://127.0.0.1:8091';
const hash=value=>createHash('sha256').update(value).digest('hex');
const git=(...argv)=>execFileSync('git',argv,{encoding:'utf8'}).trim();
const local=url=>['127.0.0.1','localhost','[::1]'].includes(url.hostname);
const rows=[],errors=[],blocked=[],inputs=[],checkpoints=[],writtenInputs=new Set();
const reads=new Set(['recipe_list','recipe_shortages','sales_day','day_menu_basis','settings_lists','get_settings','operating_hours_status','business_day_state','app_capabilities']);
let browser,key='setup';
const errorRecord=(kind,error,at=key)=>errors.push({key:at,kind,message:String(error?.message??error)});
function clean(stage) {
  const head = git('rev-parse', 'HEAD');
  const dirty = git('status', '--porcelain', '--untracked-files=no');
  checkpoints.push({ stage, head, trackedClean: dirty === '' });
  if (head !== expected || dirty !== '') throw Error(`Exact clean tracked HEAD required (${stage})`);
}
function writeJson(file, value) {
  writeFileSync(resolve(dir, file), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
function rememberInput(rpc, bytes, status, source, request) {
  const sha256 = hash(bytes), file = `input-${sha256}.json`;
  // Only allowlisted read RPC bodies, never auth/session response bodies/headers.
  if (!writtenInputs.has(file)) { writeFileSync(resolve(dir, file), bytes, { flag: 'wx' }); writtenInputs.add(file); }
  inputs.push({ key, rpc, status, source, request, sha256, file });
  JSON.parse(bytes.toString('utf8'));
}
function observe(page, at) {
  page.on('pageerror', e => errorRecord('pageerror', e, at));
  page.on('console', e => { if (e.type() === 'error') errorRecord('console', e.text(), at); });
  page.on('requestfailed', req => errorRecord('requestfailed', `${req.method()} ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`, at));
  page.on('response', response => {
    if (response.status() >= 400) errorRecord('http-response', `${response.status()} ${new URL(response.url()).pathname}`, at);
  });
  page.on('dialog', async dialog => {
    errorRecord('unexpected-dialog', `${dialog.type()}: ${dialog.message()}`, at);
    try { await dialog.dismiss(); } catch (e) { errorRecord('dialog-dismiss', e, at); }
  });
}
async function settle(page) {
  return page.evaluate(async () => {
    const running = () => document.getAnimations().filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime));
    const animations = running();
    let timer;
    try {
      await Promise.race([
        Promise.all(animations.map(a => a.finished.catch(() => 'cancelled'))),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Finite animation timeout')), 8000); }),
      ]);
    } finally { clearTimeout(timer); }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (running().length) throw Error('Finite animation still running');
    return { finiteAnimationsAwaited: animations.length };
  });
}
async function scale(page, factor) {
  const result = await page.evaluate(async factor => {
    const weights = [400, 500, 600, 700, 800];
    const loaded = await Promise.all(weights.map(w => document.fonts.load(`${w} 16px PretendardApp`, '발주 0123456789')));
    const fontFailures = weights.filter((w, i) => !loaded[i].length || !document.fonts.check(`${w} 16px PretendardApp`, '발주 0123456789'));
    const baseline = [...document.querySelectorAll('*')].filter(el => el.style).map(el => {
      const style = getComputedStyle(el);
      return { el, size: parseFloat(style.fontSize), line: parseFloat(style.lineHeight), normalLine: style.lineHeight === 'normal' };
    });
    if (baseline.some(({ el, size, line, normalLine }) => !el.isConnected || !Number.isFinite(size) || (!normalLine && !Number.isFinite(line)))) throw Error('Non-finite or disconnected baseline');
    if (factor === 2) for (const { el, size, line, normalLine } of baseline) {
      el.style.setProperty('font-size', `${size * 2}px`, 'important');
      if (!normalLine) el.style.setProperty('line-height', `${line * 2}px`, 'important');
    }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const mismatches = baseline.filter(({ el, size, line, normalLine }) => {
      const style = getComputedStyle(el), actual = parseFloat(style.fontSize), actualLine = parseFloat(style.lineHeight);
      return !el.isConnected || !Number.isFinite(actual) || Math.abs(actual - size * factor) > .05
        || (!normalLine && (!Number.isFinite(actualLine) || Math.abs(actualLine - line * factor) > .05));
    }).length;
    return { factor, fontFailures, mismatches, elements: baseline.length, normalLineHeightCount: baseline.filter(b => b.normalLine).length };
  }, factor);
  if (result.fontFailures.length || result.mismatches) throw Error(`Font/scale validation failed: ${JSON.stringify(result)}`);
  return result;
}
async function onlyDialog(page) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  if (await dialog.count() !== 1) throw Error('Exactly one active dialog required');
  return dialog;
}
async function measure(scope) {
  return scope.evaluate(root => {
    const rect = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const text = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(el.tagName)) continue;
      const style = getComputedStyle(el), range = document.createRange(); range.selectNode(node);
      if (!el.getClientRects().length || style.visibility === 'hidden') continue;
      text.push({ text: node.textContent, size: style.fontSize, lineHeight: style.lineHeight, weight: style.fontWeight,
        family: style.fontFamily, color: style.color, box: rect(el.getBoundingClientRect()), ink: rect(range.getBoundingClientRect()) });
    }
    return { scope: root.getAttribute('role') === 'dialog' ? 'active-dialog' : 'document',
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), text,
      controls: [...root.querySelectorAll('input,textarea')].map(el => ({ label: el.getAttribute('aria-label'),
        value: el.type === 'password' ? '[excluded]' : el.value, box: rect(el.getBoundingClientRect()) })),
      buttons: [...root.querySelectorAll('[role="button"],[role="tab"]')].map(el => ({ name: el.getAttribute('aria-label'),
        text: el.textContent, selected: el.getAttribute('aria-selected'), expanded: el.getAttribute('aria-expanded'), disabled: el.getAttribute('aria-disabled') })) };
  });
}

try {
  clean('before');
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'ko-KR',serviceWorkers:'block'});
  context.setDefaultTimeout(20000);
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method();
    const rpc=url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    const safe=['GET','HEAD','OPTIONS'].includes(method);
    const allowedRpc=rpc&&reads.has(rpc)&&['GET','POST','HEAD','OPTIONS'].includes(method);
    const auth=method==='POST'&&url.pathname==='/auth/v1/token';
    if(!local(url)||(rpc&&!allowedRpc)||(!rpc&&!safe&&!auth)){
      blocked.push({key,path:url.pathname,method}); await route.abort(); return;
    }
    try{
      if(rpc&&!['OPTIONS','HEAD'].includes(method)){
        const raw=method==='POST'?req.postDataJSON()??{}:Object.fromEntries(url.searchParams);
        const request=Object.fromEntries(['p_store','p_date','p_from','p_to'].filter(k=>raw[k]!=null).map(k=>[k,raw[k]]));
        const response=await route.fetch({maxRedirects:0}),bytes=await response.body();
        rememberInput(rpc,bytes,response.status(),'local-read-response',request);
        if(!response.ok())errorRecord('read-rpc-http',rpc+': '+response.status());
        await route.fulfill({response,body:bytes});return;
      }
      await route.continue();
    }catch(e){errorRecord('route',e);try{await route.abort();}catch{}}
  });
  for(const state of ['home','sort','quantity','other','expense']) for(const [width,height,factor] of [[390,844,1],[320,720,1],[320,720,2]]){
    key=state+'-'+width+'-text'+factor;
    const row={key,state,width,height,factor,shots:[],finished:false};rows.push(row);
    const page=await context.newPage();observe(page,key);await page.setViewportSize({width,height});
    try{
      await page.goto(base+'/sales',{waitUntil:'networkidle'});
      await page.getByRole('button',{name:'메뉴 관리',exact:true}).waitFor();
      if(state==='sort') await page.getByRole('button',{name:'정렬 기준: 판매량순',exact:true}).click();
      if(state==='quantity'){
        const buttons=page.getByRole('button',{name:/ 판매 입력$/});
        await buttons.first().waitFor();
        row.selectedName=await buttons.first().getAttribute('aria-label');
        await buttons.first().click();
      }
      if(state==='other'){
        await page.getByRole('button',{name:'기타 매출',exact:true}).click();
        const dialog=await onlyDialog(page);
        await dialog.getByPlaceholder('예: 음료',{exact:true}).fill('검수용 음료');
        await dialog.getByPlaceholder('2000',{exact:true}).fill('28000');
      }
      if(state==='expense'){
        await page.getByRole('button',{name:'지출 추가',exact:true}).click();
        const dialog=await onlyDialog(page);
        await dialog.getByPlaceholder('예: 얼음·소모품',{exact:true}).fill('검수용 당일 지출');
        await dialog.getByPlaceholder('15000',{exact:true}).fill('15000');
      }
      await settle(page);
      await page.evaluate(()=>{window.scrollTo(0,0);for(const el of document.querySelectorAll('*'))if(el.scrollTop)el.scrollTop=0;});
      row.scaling=await scale(page,factor);await settle(page);
      const scope=state==='home'?page.locator('body'):await onlyDialog(page);
      const anchors=state==='home'?['start','last-sale']:state==='sort'?['start','이름순']:state==='quantity'?['start','합계','저장']:['start','추가'];
      for(const anchor of anchors){
        if(anchor!=='start'){
          const target=anchor==='last-sale'?scope.getByRole('button',{name:/ 판매 (입력|중지)$/}).last():scope.getByText(anchor,{exact:true});
          if(await target.count()!==1)throw Error('Unique anchor required: '+anchor);
          await target.evaluate(el=>el.scrollIntoView({block:'center'}));
        }
        await settle(page);
        const file=key+'-'+row.shots.length+'.png',png=await page.screenshot({fullPage:false});
        writeFileSync(resolve(dir,file),png,{flag:'wx'});
        row.shots.push({anchor,file,sha256:hash(png),...await measure(scope)});
      }
      row.finished=true;
    }catch(e){errorRecord('pass',e);}
    finally{await page.close();}
  }
}catch(e){errorRecord('runner',e);}
finally{
  try{clean('after');}catch(e){errorRecord('source',e);}
  const browserVersion=browser?.version();if(browser)await browser.close();
  const diagnostic={failed:errors.length>0||blocked.length>0||rows.length!==15||rows.some(r=>!r.finished),expectedPasses:15,completedPasses:rows.filter(r=>r.finished).length,shots:rows.reduce((n,r)=>n+r.shots.length,0)};
  writeJson('sales-evidence.json',{sourceCommit:expected,scriptSha256:hash(readFileSync(new URL(import.meta.url))),browserVersion,checkpoints,
    scope:'Actual local Expo SALES-01/home, sort, quantity, other revenue and expense sheets. Local read RPC bodies preserved; no synthetic backend values. Input drafts only; no save/add/delete/business transitions. Unknown RPC and nonlocal network blocked. No token/storage/auth response recording. 2x CSS font/finite line-height approximation, not native/keyboard or production proof. Matching disk SHA does not prove runtime; restart Expo at product SHA before use. Range rects do not prove ancestor clipping or occlusion; actual local data are not exhaustive scenarios.',
    rows,inputs,errors,blocked,diagnostic});
  console.log(JSON.stringify({output,diagnostic,errors,blocked}));if(diagnostic.failed)process.exitCode=1;
}
