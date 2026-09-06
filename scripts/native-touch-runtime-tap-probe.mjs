import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(import.meta.url);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const opt = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
  const index = arg.indexOf('='); return index < 0 ? [arg.slice(2), true] : [arg.slice(2, index), arg.slice(index + 1)];
}));
const inspectorUrl = String(opt.inspector ?? 'http://127.0.0.1:8081');
const platform = String(opt.platform ?? 'android');
const adb = String(opt.adb ?? (process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe') : 'adb'));
const deviceId = String(opt.device ?? 'emulator-5554');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizedText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.trim();
};

async function connect(desiredPlatform) {
  const pages = await fetch(`${inspectorUrl}/json/list`).then((response) => response.json());
  for (const page of pages.slice().reverse()) {
    const socket = await new Promise((resolve, reject) => {
      const candidate = new WebSocket(page.webSocketDebuggerUrl);
      candidate.onerror = reject;
      candidate.onopen = () => resolve(candidate);
    });
    const roots = await evaluate(socket, "typeof __REACT_DEVTOOLS_GLOBAL_HOOK__==='object'?[...__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.keys()].reduce((n,id)=>n+__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots(id).size,0):0");
    const runtimePlatform = roots > 0 ? await evaluate(socket, `(()=>{const modules=[...__r.getModules().entries()];const hit=modules.find(([,m])=>String(m.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/react-native/index.js'));return hit?__r(hit[0]).Platform.OS:'unknown'})()`) : 'unknown';
    if (roots > 0 && runtimePlatform === desiredPlatform) return socket;
    socket.close();
  }
  throw new Error('Hermes inspector 없음');
}

async function evaluate(socket, expression) {
  const id = Math.floor(Math.random() * 1e9);
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Hermes timeout')), 15_000);
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timeout);
      socket.removeEventListener('message', listener);
      if (message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.result.exceptionDetails)));
      else resolve(message.result?.result?.value);
    };
    socket.addEventListener('message', listener);
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
}

const runtime = (op) => `(()=>{
  const op=${JSON.stringify(op)},hook=__REACT_DEVTOOLS_GLOBAL_HOOK__;
  globalThis.__MARGINCOOK_TAP_PROBE__??={count:0,events:[]};
  if(op.kind==='state')return JSON.stringify(globalThis.__MARGINCOOK_TAP_PROBE__);
  if(op.kind==='reset'){globalThis.__MARGINCOOK_TAP_PROBE__={count:0,events:[]};return 'ok'}
  const rendererId=[...hook.renderers.keys()].find(id=>hook.getFiberRoots(id).size>0),renderer=hook.renderers.get(rendererId);
  const roots=[...hook.getFiberRoots(rendererId)].map(root=>root.current);
  const name=f=>{const t=f?.elementType||f?.type;return typeof t==='string'?t:(t?.displayName||t?.name||'')};
  const owners=f=>{const out=[];for(let n=f?._debugOwner;n&&out.length<12;n=n._debugOwner){const v=name(n);if(v&&!out.includes(v))out.push(v)}return out};
  const text=f=>{let out='';const seen=new Set();const walk=n=>{if(!n||seen.has(n))return;seen.add(n);const p=n.memoizedProps;if(typeof p==='string'||typeof p==='number')out+=' '+p;walk(n.child);walk(n.sibling)};walk(f?.child);return out.replace(/\\s+/g,' ').trim()};
  const hostChild=f=>{const q=f?.child?[f.child]:[];const seen=new Set();while(q.length){const n=q.shift();if(!n||seen.has(n))continue;seen.add(n);if(n.tag===5)return n;if(n.child)q.push(n.child);if(n.sibling)q.push(n.sibling)}return null};
  const hostAncestors=f=>{const out=[];for(let n=f?.return;n;n=n.return)if(n.tag===5)out.push(n);return out};
  const flat=s=>Array.isArray(s)?Object.assign({},...s.filter(Boolean).map(flat)):(s&&typeof s==='object'?s:{});
  let found;const seen=new Set();const walk=f=>{if(!f||seen.has(f))return;seen.add(f);const p=f.memoizedProps||{};if(name(f)==='Pressable'){const label=String(p.accessibilityLabel||text(f)||'(unlabelled)');if(new RegExp(op.labelPattern,'u').test(label)&&owners(f).some(v=>new RegExp(op.ownerPattern,'u').test(v)))found={fiber:f,label,host:hostChild(f),ancestors:hostAncestors(f)}}walk(f.child);walk(f.sibling)};roots.forEach(walk);
  if(!found?.host||!found.ancestors.length)throw new Error('probe target 없음');
  if(op.kind==='instrument'){
    renderer.overrideProps(found.fiber,['onPress'],()=>{globalThis.__MARGINCOOK_TAP_PROBE__.count++;globalThis.__MARGINCOOK_TAP_PROBE__.events.push(Date.now())});
    return JSON.stringify({label:found.label,owner:owners(found.fiber)[0]});
  }
  if(op.kind==='shrinkDirectParent'){
    const parent=found.ancestors[0];
    const pressableStyle={...flat(found.fiber.memoizedProps?.style),height:20,paddingVertical:0};
    const parentStyle={...flat(parent.memoizedProps?.style),flex:0,height:20,paddingTop:0,paddingBottom:0,
      marginBottom:48,overflow:'visible',position:'relative',zIndex:999,elevation:999};
    renderer.overrideProps(found.fiber,['style'],pressableStyle);
    renderer.overrideProps(found.fiber,['hitSlop'],{top:0,bottom:40,left:0,right:0});
    renderer.overrideProps(parent,['style'],parentStyle);
    return JSON.stringify({host:name(parent),pressableStyle,parentStyle});
  }
  if(op.kind==='shrinkOverflowGrandparent'){
    const parent=found.ancestors[0],target=found.ancestors[1];
    const parentStyle={...flat(parent.memoizedProps?.style),position:'relative',zIndex:999,elevation:999};
    const style={...flat(target.memoizedProps?.style),flex:0,height:20,overflow:'visible',position:'relative',zIndex:999,elevation:999};
    renderer.overrideProps(parent,['style'],parentStyle);renderer.overrideProps(target,['style'],style);
    return JSON.stringify({host:name(target),style,parentStyle});
  }
  if(op.kind==='measure'){
    const state={done:false,pending:0,frame:null,ancestors:[]};globalThis.__MARGINCOOK_TAP_MEASURE__=state;
    const measure=(node,target)=>{state.pending++;nativeFabricUIManager.measureInWindow(node.stateNode.node,(...v)=>{target.push(...v);state.pending--;if(!state.pending)state.done=true})};
    measure(found.host,state.frame=[]);for(const ancestor of found.ancestors.slice(0,4)){const row=[];state.ancestors.push({host:name(ancestor),owner:name(ancestor._debugOwner),style:flat(ancestor.memoizedProps?.style),frame:row});measure(ancestor,row)}
    return JSON.stringify({pending:state.pending});
  }
})()`;

async function measure(socket) {
  await evaluate(socket, runtime({ kind: 'measure', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  for (let i = 0; i < 40; i++) {
    await sleep(50);
    const state = JSON.parse(await evaluate(socket, 'JSON.stringify(globalThis.__MARGINCOOK_TAP_MEASURE__)'));
    if (state.done) return state;
  }
  throw new Error('measure timeout');
}

async function tapAndRead(socket, point, windowOffsetY, density) {
  await evaluate(socket, runtime({ kind: 'reset', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  const x = Math.round(point.x * density), y = Math.round((point.y + windowOffsetY) * density);
  const result = spawnSync(adb, ['-s', deviceId, 'shell', 'input', 'tap', String(x), String(y)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  await sleep(500);
  const state = JSON.parse(await evaluate(socket, runtime({ kind: 'state', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' })));
  return { pointDp: point, pointPx: { x, y }, onPressCount: state.count };
}

async function physicalTapAndRead(socket, point, instruction, { requirePress } = {}) {
  await evaluate(socket, runtime({ kind: 'reset', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  console.log(`PHYSICAL_TAP_REQUIRED ${instruction} requestedPointDp=${point.x.toFixed(2)},${point.y.toFixed(2)}`);
  console.log('PRESS_ENTER_AFTER_PHYSICAL_TAP');
  process.stdin.resume();
  await new Promise((resolveInput) => process.stdin.once('data', resolveInput));
  const state = JSON.parse(await evaluate(socket, runtime({ kind: 'state', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' })));
  return { requestedPointDp: point, onPressCount: state.count,
    operatorAttestation: {
      method: requirePress
        ? 'physical-user-tap-confirmed-by-stdin-and-hermes-onPress'
        : 'physical-user-tap-confirmed-by-stdin',
      confirmedAt: new Date().toISOString(),
    } };
}

const head = git(['rev-parse', 'HEAD']);
if (!opt['expect-commit'] || opt['expect-commit'] !== head) throw new Error(`--expect-commit 불일치: ${head}`);
if (git(['status', '--porcelain', '--untracked-files=no'])) throw new Error('추적 파일이 변경된 트리에서는 실제 탭 증거를 만들지 않는다');
const socket = await connect(platform);
try {
  const runtimeDevice = JSON.parse(await evaluate(socket, `JSON.stringify((()=>{const modules=[...__r.getModules().entries()];const hit=modules.find(([,m])=>String(m.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/react-native/index.js'));const rn=__r(hit[0]);return {platform:rn.Platform.OS,density:rn.PixelRatio.get(),fontScale:rn.PixelRatio.getFontScale(),osVersion:String(rn.Platform.Version)}})())`));
  if (runtimeDevice.platform !== platform) throw new Error(`${platform} 런타임이 아니다: ${runtimeDevice.platform}`);
  const density = Number(runtimeDevice.density);
  await evaluate(socket, `(()=>{const m=[...__r.getModules().entries()].find(([,v])=>String(v.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/expo-router/build/exports.js'));__r(m[0]).router.replace('/(tabs)/orders');return 'ok'})()`);
  await sleep(700);
  await evaluate(socket, `(()=>{const m=[...__r.getModules().entries()].find(([,v])=>String(v.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/expo-router/build/exports.js'));__r(m[0]).router.replace('/(tabs)/ingredients');return 'ok'})()`);
  await sleep(1800);
  await evaluate(socket, runtime({ kind: 'instrument', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  await sleep(500);
  const initial = await measure(socket);
  const [x, y, width, height] = initial.frame;
  const windowOffsetY = Math.max(0, -initial.ancestors.at(-1).frame[1]);
  const insidePoint = { x: x + width / 2, y: y + height / 2 };
  const inside = platform === 'android'
    ? await tapAndRead(socket, insidePoint, windowOffsetY, density)
    : await physicalTapAndRead(socket, insidePoint, '1/3 추천순 버튼 가운데를 누르세요', { requirePress: true });
  await evaluate(socket, runtime({ kind: 'shrinkDirectParent', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  await sleep(700);
  await evaluate(socket, runtime({ kind: 'instrument', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  const clippedMeasure = await measure(socket);
  const [cx, cy, cwidth, cheight] = clippedMeasure.frame;
  const clippedPoint = { x: cx + cwidth / 2, y: cy + cheight + 24 };
  const clippedEdge = platform === 'android'
    ? await tapAndRead(socket, clippedPoint, Math.max(0, -clippedMeasure.ancestors.at(-1).frame[1]), density)
    : await physicalTapAndRead(socket, clippedPoint, '2/3 낮아진 추천순 버튼과 첫 카드 사이의 넓은 빈 회색 공간 중앙을 누르세요', { requirePress: true });
  await evaluate(socket, `(()=>{const m=[...__r.getModules().entries()].find(([,v])=>String(v.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/expo-router/build/exports.js'));__r(m[0]).router.replace('/(tabs)/orders');return 'ok'})()`);
  await sleep(500);
  await evaluate(socket, `(()=>{const m=[...__r.getModules().entries()].find(([,v])=>String(v.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/expo-router/build/exports.js'));__r(m[0]).router.replace('/(tabs)/ingredients');return 'ok'})()`);
  await sleep(1200);
  await evaluate(socket, runtime({ kind: 'shrinkOverflowGrandparent', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  await sleep(700);
  await evaluate(socket, runtime({ kind: 'instrument', labelPattern: '^정렬 기준: 추천순$', ownerPattern: 'IngredientListScreen' }));
  await sleep(300);
  const overflowMeasure = await measure(socket);
  const [ox, oy, ow, oh] = overflowMeasure.frame;
  const overflowWindowOffsetY = Math.max(0, -overflowMeasure.ancestors.at(-1).frame[1]);
  const overflowPoint = { x: ox + ow / 2, y: oy + oh / 2 };
  const overflowVisibleGrandparent = platform === 'android'
    ? await tapAndRead(socket, overflowPoint, overflowWindowOffsetY, density)
    : await physicalTapAndRead(socket, overflowPoint, '3/3 추천순 버튼 가운데를 다시 누르세요', { requirePress: true });
  const probes = [
    { id: 'inside-effective-rect', expectedOnPressCount: 1, ...inside },
    { id: 'outside-direct-parent', expectedOnPressCount: platform === 'ios' ? 1 : 0,
      syntheticMutation: 'Pressable height:20 + hitSlop.bottom:40; ancestor[0] height:20 + marginBottom:48 + overflow:visible', measure: clippedMeasure, ...clippedEdge },
    { id: 'outside-overflow-visible-grandparent', expectedOnPressCount: 1, syntheticMutation: 'ancestor[1] flex:0;height:20;overflow:visible; zIndex/elevation 999', ...overflowVisibleGrandparent },
  ];
  // 실제 사용자 탭은 전송 지연 동안 반복될 수 있다. 계약은 '정확히 1회'가 아니라
  // '안쪽은 발화, Android 부모 밖은 차단, iOS overflow-visible 부모 밖은 발화'다.
  // 원시 횟수는 증거에 그대로 보존한다.
  const failures = probes.filter((probe) => probe.expectedOnPressCount === 0
    ? probe.onPressCount !== 0 : probe.onPressCount < 1)
    .map((probe) => `${probe.id}: onPress ${probe.onPressCount} does not satisfy ${probe.expectedOnPressCount === 0 ? '= 0' : '>= 1'}`);
  const shell = (args) => spawnSync(adb, ['-s', deviceId, 'shell', ...args], { encoding: 'utf8' }).stdout.trim();
  const artifact = {
    schemaVersion: 1,
    status: failures.length ? 'FAIL' : 'PASS',
    platform,
    device: platform === 'android'
      ? { id: deviceId, model: shell(['getprop', 'ro.product.model']), apiLevel: Number(shell(['getprop', 'ro.build.version.sdk'])), ...runtimeDevice }
      : { id: String(opt.device ?? 'iphone-actual'), model: String(opt.model ?? 'iPhone'), ...runtimeDevice },
    manifest: {
      evidenceStatus: 'EXACT_COMMIT_EVIDENCE', productCommit: head, productTree: git(['rev-parse', 'HEAD^{tree}']),
      script: basename(here), scriptSha256: sha256(normalizedText(here)),
      auditSha256: sha256(normalizedText(join(root, 'scripts/native-touch-runtime-audit.mjs'))),
      contractSha256: sha256(normalizedText(join(root, 'scripts/native-touch-runtime-contract.json'))),
      method: platform === 'android'
        ? 'Hermes React DevTools onPress counter + adb shell input tap'
        : 'Hermes React DevTools onPress counter + physical user tap with stdin attestation at all three points',
    },
    target: { route: '/ingredients', label: '정렬 기준: 추천순', owner: 'IngredientListScreen' },
    windowOffsetY,
    frames: { initial, overflowMutation: overflowMeasure },
    empiricalTapProbe: probes,
    failures,
  };
  const output = resolve(String(opt.out ?? join(root, 'docs/prototypes', `native-touch-${platform}-tap-probe.json`)));
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${artifact.status} ${output}`);
  if (failures.length) process.exitCode = 1;
} finally {
  socket.close();
}
