#!/usr/bin/env node
/** iOS/Android 실제 런타임에서 Text host frame을 읽어 글자 확대가 레이아웃에 반영됐는지 보존한다. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { textSha256 } from '../docs/prototypes/full-page-flow-prototype-text-sha256.mjs';

const here = fileURLToPath(import.meta.url);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const opts = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const at = arg.indexOf('='); return at < 0 ? [arg.slice(2), true] : [arg.slice(2, at), arg.slice(at + 1)];
}));

async function connectInspector(url, desiredPlatform) {
  const pages = await fetch(`${url.replace(/\/$/, '')}/json/list`).then((response) => response.json());
  const evaluate = async (socket, expression) => {
    const id = Math.floor(Math.random() * 1_000_000_000);
    return await new Promise((done, reject) => {
      const timeout = setTimeout(() => reject(new Error('Hermes 평가 시간 초과')), 15_000);
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timeout); socket.removeEventListener('message', listener);
        if (message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.result.exceptionDetails)));
        else done(message.result?.result?.value);
      };
      socket.addEventListener('message', listener);
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
  };
  for (const page of pages.slice().reverse()) {
    const socket = await new Promise((done, reject) => {
      const candidate = new WebSocket(page.webSocketDebuggerUrl);
      candidate.onerror = reject; candidate.onopen = () => done(candidate);
    });
    const platform = await evaluate(socket, `(()=>{const m=[...__r.getModules().entries()];const h=m.find(([,v])=>String(v.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/react-native/index.js'));return h?__r(h[0]).Platform.OS:'unknown'})()`);
    if (platform === desiredPlatform) return { socket, page, evaluate: (expression) => evaluate(socket, expression) };
    socket.close();
  }
  throw new Error(`${desiredPlatform} Hermes inspector를 찾지 못했다`);
}

const deviceExpression = `JSON.stringify((()=>{const m=[...__r.getModules().entries()];const h=m.find(([,v])=>String(v.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/react-native/index.js'));const rn=__r(h[0]);return {platform:rn.Platform.OS,density:rn.PixelRatio.get(),fontScale:rn.PixelRatio.getFontScale(),osVersion:String(rn.Platform.Version),window:rn.Dimensions.get('window'),screen:rn.Dimensions.get('screen'),model:rn.Platform.constants?.Model??rn.Platform.constants?.model??null}})())`;

const collectExpression = `(()=>{
  const hook=__REACT_DEVTOOLS_GLOBAL_HOOK__,rendererId=[...hook.renderers.keys()].find(id=>hook.getFiberRoots(id).size>0);
  const roots=[...hook.getFiberRoots(rendererId)].map(root=>root.current),state=globalThis.__MARGINCOOK_TEXT_SCALE__={rows:[],pending:0,done:false};
  const name=f=>{const t=f?.elementType||f?.type;return typeof t==='string'?t:(t?.displayName||t?.name||'')};
  const owners=f=>{const out=[];for(let n=f?._debugOwner;n&&out.length<12;n=n._debugOwner){const v=name(n);if(v&&!out.includes(v))out.push(v)}return out};
  const flat=s=>Array.isArray(s)?Object.assign({},...s.filter(Boolean).map(flat)):(s&&typeof s==='object'?s:{});
  const ownText=f=>{let out='';const seen=new Set(),walk=n=>{if(!n||seen.has(n))return;seen.add(n);const p=n.memoizedProps;if(typeof p==='string'||typeof p==='number')out+=' '+p;walk(n.child);walk(n.sibling)};walk(f?.child);return out.replace(/\\s+/g,' ').trim()};
  const hostChild=f=>{const q=f?.child?[f.child]:[],seen=new Set();while(q.length){const n=q.shift();if(!n||seen.has(n))continue;seen.add(n);if(n.tag===5)return n;if(n.child)q.push(n.child);if(n.sibling)q.push(n.sibling)}return null};
  const activeScreen=f=>{const states=[];for(let n=f?.return;n;n=n.return)if(name(n)==='RNSScreen'&&n.memoizedProps?.activityState!=null)states.push(n.memoizedProps.activityState);return states.length===0||states.every(v=>v===2)};
  const candidates=[],seen=new Set(),walk=f=>{if(!f||seen.has(f))return;seen.add(f);if(name(f)==='Text'&&activeScreen(f)){const host=hostChild(f),tag=host?.stateNode?.canonical?.nativeTag,label=ownText(f),style=flat(f.memoizedProps?.style);if(Number.isFinite(tag)&&label)candidates.push({host,tag,label,ownerChain:owners(f),fontSize:Number(style.fontSize)||null,lineHeight:Number(style.lineHeight)||null,allowFontScaling:f.memoizedProps?.allowFontScaling!==false,maxFontSizeMultiplier:f.memoizedProps?.maxFontSizeMultiplier??null})}walk(f.child);walk(f.sibling)};
  roots.forEach(walk);
  for(const c of [...new Map(candidates.map(c=>[c.tag,c])).values()]){const row={key:c.ownerChain.join('>')+'|'+c.label,label:c.label,ownerChain:c.ownerChain,fontSize:c.fontSize,lineHeight:c.lineHeight,allowFontScaling:c.allowFontScaling,maxFontSizeMultiplier:c.maxFontSizeMultiplier,nativeTag:c.tag};state.rows.push(row);state.pending++;nativeFabricUIManager.measureInWindow(c.host.stateNode.node,(...v)=>{row.windowMeasure=v;state.pending--;if(state.pending===0)state.done=true})}
  if(state.pending===0)state.done=true;return JSON.stringify({rows:state.rows.length})
})()`;

async function main() {
  const platform = String(opts.platform ?? 'ios');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (opts['expect-commit'] !== head) throw new Error(`--expect-commit 불일치: ${head}`);
  const dirtyApp = spawnSync('git', ['status', '--porcelain', '--untracked-files=no', '--', 'apps/mobile'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (dirtyApp) throw new Error('apps/mobile이 변경된 트리에서는 텍스트 확대 증거를 만들지 않는다');
  const requestedProduct = String(opts['product-commit'] ?? head);
  const productCommit = spawnSync('git', ['rev-parse', `${requestedProduct}^{commit}`], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(productCommit)) throw new Error(`유효한 --product-commit이 아니다: ${requestedProduct}`);
  if (spawnSync('git', ['merge-base', '--is-ancestor', productCommit, head], { cwd: root }).status !== 0)
    throw new Error(`productCommit ${productCommit}은 HEAD의 조상이 아니다`);
  if (spawnSync('git', ['diff', '--quiet', productCommit, head, '--', 'apps/mobile'], { cwd: root }).status !== 0)
    throw new Error('productCommit 뒤 apps/mobile이 바뀌었다');
  const inspector = await connectInspector(String(opts.inspector ?? 'http://127.0.0.1:8081'), platform);
  try {
    const device = JSON.parse(await inspector.evaluate(deviceExpression));
    const expectedScale = Number(opts['font-scale']);
    const scaleMatches = expectedScale === 2 ? device.fontScale >= 2 : Math.abs(device.fontScale - expectedScale) <= 1e-6;
    if (device.platform !== platform || !(expectedScale > 0) || !scaleMatches)
      throw new Error(`런타임 ${device.platform}@${device.fontScale} ≠ 요청 ${platform}@${expectedScale}`);
    await inspector.evaluate(collectExpression);
    let state;
    for (let attempt = 0; attempt < 100; attempt++) {
      await sleep(50); state = JSON.parse(await inspector.evaluate('JSON.stringify(globalThis.__MARGINCOOK_TEXT_SCALE__)'));
      if (state.done) break;
    }
    if (!state?.done) throw new Error('Text host measure 완료 실패');
    const rows = state.rows.filter((row) => row.windowMeasure?.[2] > 0 && row.windowMeasure?.[3] > 0)
      .sort((a, b) => a.key.localeCompare(b.key) || a.windowMeasure[1] - b.windowMeasure[1]
        || a.windowMeasure[0] - b.windowMeasure[0]);
    const occurrences = new Map();
    for (const row of rows) {
      const occurrence = occurrences.get(row.key) ?? 0;
      occurrences.set(row.key, occurrence + 1);
      row.key = `${row.key}#${occurrence}`;
    }
    const artifact = { schemaVersion: 1, platform, fontScale: device.fontScale, device, rows,
      manifest: { evidenceStatus: 'EXACT_COMMIT_EVIDENCE', productCommit,
        appTree: spawnSync('git', ['rev-parse', `${productCommit}:apps/mobile`], { cwd: root, encoding: 'utf8' }).stdout.trim(),
        scriptSha256: textSha256(readFileSync(here)), capturedAt: new Date().toISOString(), inspectorPage: inspector.page } };
    const out = resolve(opts.out ?? `docs/prototypes/native-text-scale-${platform}-${expectedScale}x.json`);
    writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`PASS ${out} — Text ${rows.length}개 · ${platform}@${device.fontScale}`);
  } finally { inspector.socket.close(); }
}

if (resolve(process.argv[1] ?? '') === resolve(here)) main().catch((error) => { console.error(error.stack ?? String(error)); process.exit(1); });
