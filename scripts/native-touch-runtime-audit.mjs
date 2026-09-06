#!/usr/bin/env node
/**
 * Expo 개발 빌드의 Fabric frame을 Hermes inspector에서 읽어 실제 터치 영역을 잰다.
 * 정적 `visual + hitSlop * 2` 합산과 달리 React Native의 부모 경계 clipping을 포함한다.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = fileURLToPath(import.meta.url);
const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const normalizedText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

export function slopBox(value) {
  if (typeof value === 'number') return { top: value, right: value, bottom: value, left: value };
  const box = value ?? {};
  return {
    top: Number(box.top ?? box.vertical ?? 0),
    right: Number(box.right ?? box.horizontal ?? 0),
    bottom: Number(box.bottom ?? box.vertical ?? 0),
    left: Number(box.left ?? box.horizontal ?? 0),
  };
}

export function effectiveTouchRect(frame, parentFrame, hitSlop) {
  const slop = slopBox(hitSlop);
  const raw = {
    left: frame.x - slop.left,
    top: frame.y - slop.top,
    right: frame.x + frame.width + slop.right,
    bottom: frame.y + frame.height + slop.bottom,
  };
  const parent = {
    left: parentFrame.x,
    top: parentFrame.y,
    right: parentFrame.x + parentFrame.width,
    bottom: parentFrame.y + parentFrame.height,
  };
  const effective = {
    left: Math.max(raw.left, parent.left),
    top: Math.max(raw.top, parent.top),
    right: Math.min(raw.right, parent.right),
    bottom: Math.min(raw.bottom, parent.bottom),
  };
  return {
    raw,
    effective,
    width: Math.max(0, effective.right - effective.left),
    height: Math.max(0, effective.bottom - effective.top),
    clipped: Object.keys(raw).some((key) => Math.abs(raw[key] - effective[key]) > 1e-7),
  };
}

export function physicalHalfPixelTolerance(density) {
  if (!(density > 0)) throw new Error(`유효한 density가 아니다: ${density}`);
  // 판정은 물리 픽셀에서 한다: effective_dp*density >= 44*density - 0.5 - eps.
  return (0.5 + 1e-3) / density;
}

export function rectOverlap(left, right) {
  return {
    width: Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left)),
    height: Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top)),
  };
}

const stableRuntimeKey = (value) => String(value).replace(/\|\d+$/, '');
export function nativeRatchetSnapshot(evaluation) {
  const observed = new Map();
  for (const item of evaluation.observedUnjudged) {
    const key = [item.scenario, item.phase, item.ownerChain.join('>'), item.label].join('|');
    const row = observed.get(key) ?? { key, count: 0, minEffectiveWidth: Infinity, minEffectiveHeight: Infinity };
    row.count += 1;
    row.minEffectiveWidth = Math.min(row.minEffectiveWidth, item.effectiveWidth);
    row.minEffectiveHeight = Math.min(row.minEffectiveHeight, item.effectiveHeight);
    observed.set(key, row);
  }
  const overlaps = new Map();
  for (const item of evaluation.materialOverlaps) {
    const endpoints = [stableRuntimeKey(item.left), stableRuntimeKey(item.right)].sort();
    const key = [item.scenario, item.phase, ...endpoints].join('|');
    const row = overlaps.get(key) ?? { key, count: 0, maxWidth: 0, maxHeight: 0 };
    row.count += 1;
    row.maxWidth = Math.max(row.maxWidth, item.width);
    row.maxHeight = Math.max(row.maxHeight, item.height);
    overlaps.set(key, row);
  }
  return { observedUnjudged: [...observed.values()].sort((a, b) => a.key.localeCompare(b.key)),
    materialOverlaps: [...overlaps.values()].sort((a, b) => a.key.localeCompare(b.key)) };
}

export function compareNativeRatchet(current, known, epsilon = 1e-6) {
  const failures = [];
  for (const field of ['observedUnjudged', 'materialOverlaps']) {
    const baseline = new Map((known?.[field] ?? []).map((item) => [item.key, item]));
    if (!known || !Array.isArray(known[field])) { failures.push(`네이티브 ${field} 래칫 목록 누락`); continue; }
    for (const item of current[field]) {
      const old = baseline.get(item.key);
      if (!old) { failures.push(`새 네이티브 ${field}: ${item.key}`); continue; }
      if (item.count > old.count) failures.push(`네이티브 ${field} 개수 악화: ${item.key} ${old.count}→${item.count}`);
      if (field === 'observedUnjudged'
        && (item.minEffectiveWidth + epsilon < old.minEffectiveWidth || item.minEffectiveHeight + epsilon < old.minEffectiveHeight))
        failures.push(`네이티브 미달 크기 악화: ${item.key}`);
      if (field === 'materialOverlaps'
        && (item.maxWidth > old.maxWidth + epsilon || item.maxHeight > old.maxHeight + epsilon))
        failures.push(`네이티브 중첩 악화: ${item.key}`);
    }
  }
  return failures;
}

const matches = (value, pattern) => !pattern || new RegExp(pattern, 'u').test(value ?? '');

export function evaluateNativeArtifact(artifact, contract) {
  const failures = [];
  const tolerance = physicalHalfPixelTolerance(artifact.device.density);
  const minimum = contract.minimumTarget;
  const seenTargetIds = new Set();
  const lineage = [];
  const observedUnjudged = [];
  const materialOverlaps = [];

  for (const scenario of contract.scenarios) {
    const measured = artifact.scenarios.find((item) => item.id === scenario.id);
    if (!measured) { failures.push(`시나리오 누락: ${scenario.id}`); continue; }
    for (const target of scenario.targets) {
      if (seenTargetIds.has(target.id)) failures.push(`target ID 중복: ${target.id}`);
      seenTargetIds.add(target.id);
      const rows = measured.phases.flatMap((phase) => phase.rows.map((row) => ({ ...row, phase: phase.id })))
        .filter((row) => (!target.phase || row.phase === target.phase)
          && matches(row.ownerChain.join('>'), target.ownerPattern)
          && matches(row.label, target.labelPattern));
      if (rows.length < target.minimumObserved)
        failures.push(`${target.id} 관측 ${rows.length} < ${target.minimumObserved}`);
      const short = rows.filter((row) => row.effectiveWidth + tolerance < minimum || row.effectiveHeight + tolerance < minimum);
      if (short.length) failures.push(`${target.id} 실제 44 미달 ${short.length}건`);
      lineage.push({ id: target.id, sourceEntries: target.sourceEntries, observed: rows.length, short: short.length });
    }

    const targetRows = new Set();
    for (const phase of measured.phases) for (const row of phase.rows) {
      const owned = scenario.targets.some((target) => (!target.phase || target.phase === phase.id)
        && matches(row.ownerChain.join('>'), target.ownerPattern) && matches(row.label, target.labelPattern));
      if (owned) targetRows.add(`${phase.id}|${row.nativeTag}`);
      else if (row.effectiveWidth + tolerance < minimum || row.effectiveHeight + tolerance < minimum)
        observedUnjudged.push({ scenario: scenario.id, phase: phase.id, key: row.key, label: row.label,
          ownerChain: row.ownerChain, effectiveWidth: row.effectiveWidth, effectiveHeight: row.effectiveHeight });
    }
    for (const phase of measured.phases) for (const overlap of phase.overlaps) {
      if (overlap.width > tolerance && overlap.height > tolerance)
        materialOverlaps.push({ scenario: scenario.id, phase: phase.id, ...overlap });
    }
  }

  const expectedLineage = contract.scenarios.flatMap((scenario) => scenario.targets)
    .reduce((sum, target) => sum + target.sourceEntries.length, 0);
  if (expectedLineage !== contract.expectedSourceLineage)
    failures.push(`계약 source lineage ${expectedLineage} ≠ ${contract.expectedSourceLineage}`);
  if (artifact.platform !== contract.platform) failures.push(`platform ${artifact.platform} ≠ ${contract.platform}`);
  const allowedFontScales = contract.fontScales ?? [contract.fontScale];
  if (!allowedFontScales.some((value) => Math.abs(value - artifact.fontScale) < 1e-6))
    failures.push(`fontScale ${artifact.fontScale} ∉ [${allowedFontScales.join(', ')}]`);
  return { tolerance, lineage, observedUnjudged, materialOverlaps, failures };
}

function options(argv) {
  return Object.fromEntries(argv.filter((arg) => arg.startsWith('--')).map((arg) => {
    const index = arg.indexOf('=');
    return index < 0 ? [arg.slice(2), true] : [arg.slice(2, index), arg.slice(index + 1)];
  }));
}

async function connectInspector(url) {
  const pages = await fetch(`${url.replace(/\/$/, '')}/json/list`).then((response) => response.json());
  const evaluate = async (socket, expression) => {
    const id = Math.floor(Math.random() * 1_000_000_000);
    return await new Promise((resolveValue, reject) => {
      const timeout = setTimeout(() => reject(new Error('Hermes 평가 시간 초과')), 15_000);
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timeout); socket.removeEventListener('message', listener);
        if (message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.result.exceptionDetails)));
        else resolveValue(message.result?.result?.value);
      };
      socket.addEventListener('message', listener);
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
  };
  // Metro reload 뒤 이전 inspector page가 잠시 남을 수 있다. 가장 최신 page부터 고른다.
  for (const page of pages.slice().reverse()) {
    const socket = await new Promise((resolveSocket, reject) => {
      const candidate = new WebSocket(page.webSocketDebuggerUrl);
      candidate.onerror = reject;
      candidate.onopen = () => resolveSocket(candidate);
    });
    const roots = await evaluate(socket,
      "typeof __REACT_DEVTOOLS_GLOBAL_HOOK__==='object'?[...__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.keys()].reduce((n,id)=>n+__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots(id).size,0):0");
    if (roots > 0) return { socket, evaluate: (expression) => evaluate(socket, expression) };
    socket.close();
  }
  throw new Error('React Native Hermes inspector를 찾지 못했다');
}

function runtimeExpression(operation) {
  return `(()=>{
    const op=${JSON.stringify(operation)};
    const hook=__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const rendererId=[...hook.renderers.keys()].find(id=>hook.getFiberRoots(id).size>0);
    const roots=[...hook.getFiberRoots(rendererId)].map(root=>root.current);
    const state=globalThis.__MARGINCOOK_NATIVE_TOUCH__??={};
    const name=f=>{const t=f?.elementType||f?.type;return typeof t==='string'?t:(t?.displayName||t?.name||'')};
    const owners=f=>{const out=[];for(let n=f?._debugOwner;n&&out.length<12;n=n._debugOwner){const v=name(n);if(v&&!out.includes(v))out.push(v)}return out};
    const text=f=>{let out='';const seen=new Set();const walk=n=>{if(!n||seen.has(n))return;seen.add(n);const p=n.memoizedProps||{};if(typeof p.children==='string'||typeof p.children==='number')out+=' '+p.children;walk(n.child);walk(n.sibling)};walk(f?.child);return out.replace(/\\s+/g,' ').trim()};
    const hostChild=f=>{const q=f?.child?[f.child]:[];const seen=new Set();while(q.length){const n=q.shift();if(!n||seen.has(n))continue;seen.add(n);if(n.tag===5)return n;if(n.child)q.push(n.child);if(n.sibling)q.push(n.sibling)}return null};
    const hostParent=f=>{for(let n=f?.return;n;n=n.return)if(n.tag===5)return n;return null};
    const slop=v=>typeof v==='number'?{top:v,right:v,bottom:v,left:v}:{top:v?.top??v?.vertical??0,right:v?.right??v?.horizontal??0,bottom:v?.bottom??v?.vertical??0,left:v?.left??v?.horizontal??0};
    const buttons=[];const seen=new Set();
    const walk=f=>{if(!f||seen.has(f))return;seen.add(f);const p=f.memoizedProps||{};if(name(f)==='Pressable'&&p.accessibilityRole==='button'){const host=hostChild(f),parent=hostParent(f);if(host&&parent){const label=String(p.accessibilityLabel||text(f)||'(unlabelled)');buttons.push({fiber:f,host,parent,label,ownerChain:owners(f),hitSlop:slop(p.hitSlop??host.memoizedProps?.hitSlop),nativeTag:host.stateNode?.canonical?.nativeTag,parentNativeTag:parent.stateNode?.canonical?.nativeTag})}}walk(f.child);walk(f.sibling)};
    roots.forEach(walk);
    const active=[...new Map(buttons.filter(b=>Number.isFinite(b.nativeTag)).map(b=>[b.nativeTag,b])).values()];
    if(op.kind==='press'){
      const found=active.find(b=>(!op.ownerPattern||new RegExp(op.ownerPattern,'u').test(b.ownerChain.join('>')))&&new RegExp(op.labelPattern,'u').test(b.label));
      if(!found)throw new Error('action target 없음: '+op.labelPattern);
      const press=found.fiber.memoizedProps?.onPress;if(typeof press!=='function')throw new Error('onPress 없음');press();return JSON.stringify({pressed:found.label});
    }
    state.rows=[];state.pending=0;state.done=false;
    const measure=(node,method,target,key)=>{state.pending++;nativeFabricUIManager[method](node.stateNode.node,(...values)=>{target[key]=values;state.pending--;if(state.pending===0)state.done=true})};
    for(const b of active){const row={key:b.ownerChain.join('>')+'|'+b.label+'|'+b.nativeTag,label:b.label,ownerChain:b.ownerChain,hitSlop:b.hitSlop,nativeTag:b.nativeTag,parentNativeTag:b.parentNativeTag,parent:{}};state.rows.push(row);measure(b.host,'measure',row,'relativeMeasure');measure(b.host,'measureInWindow',row,'windowMeasure');measure(b.parent,'measureInWindow',row.parent,'windowMeasure')}
    if(state.pending===0)state.done=true;return JSON.stringify({rows:state.rows.length,pending:state.pending});
  })()`;
}

async function navigate(evaluate, route) {
  const expression = `(()=>{const modules=[...__r.getModules().entries()];const hit=modules.find(([,m])=>String(m.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/expo-router/build/exports.js'));if(!hit)throw new Error('expo-router exports module 없음');__r(hit[0]).router.replace(${JSON.stringify(route)});return hit[0]})()`;
  await evaluate(expression); await sleep(1700);
}

async function runtimeDevice(evaluate) {
  return JSON.parse(await evaluate(`JSON.stringify((()=>{
    const modules=[...__r.getModules().entries()];
    const loadSuffix=suffix=>{const hit=modules.find(([,m])=>String(m.verboseName||'').replaceAll('\\\\','/').endsWith(suffix));return hit?__r(hit[0]):null};
    const rn=loadSuffix('/node_modules/react-native/index.js')||loadSuffix('/node_modules/react-native/index.js?');
    const constants=loadSuffix('/node_modules/expo-constants/build/Constants.js')?.default;
    return {platform:rn?.Platform?.OS||'unknown',density:rn?.PixelRatio?.get?.()??null,fontScale:rn?.PixelRatio?.getFontScale?.()??null,
      osVersion:String(rn?.Platform?.Version??'unknown'),reactNativeVersion:rn?.Platform?.constants?.reactNativeVersion??null,
      expoVersion:constants?.expoVersion??constants?.expoConfig?.sdkVersion??null,
      appVersion:constants?.expoConfig?.version??null,bundleId:constants?.expoConfig?.android?.package??constants?.expoConfig?.ios?.bundleIdentifier??null};
  })())`));
}

async function collect(evaluate, density, ownerPattern) {
  await evaluate(runtimeExpression({ kind: 'collect' }));
  let state;
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(50);
    state = JSON.parse(await evaluate('JSON.stringify(globalThis.__MARGINCOOK_NATIVE_TOUCH__)'));
    if (state.done) break;
  }
  if (!state?.done) throw new Error('native measure callback 완료 실패');
  const rows = state.rows.filter((row) => row.windowMeasure?.[2] > 0 && row.windowMeasure?.[3] > 0)
    .filter((row) => !ownerPattern || matches(row.ownerChain.join('>'), ownerPattern)).map((row) => {
    const [relativeX, relativeY, relativeWidth, relativeHeight] = row.relativeMeasure;
    const [x, y, width, height] = row.windowMeasure;
    const [parentX, parentY, parentWidth, parentHeight] = row.parent.windowMeasure;
    const touch = effectiveTouchRect({ x, y, width, height }, { x: parentX, y: parentY, width: parentWidth, height: parentHeight }, row.hitSlop);
    return { ...row, relativeFrame: { x: relativeX, y: relativeY, width: relativeWidth, height: relativeHeight },
      windowFrame: { x, y, width, height }, parentFrame: { x: parentX, y: parentY, width: parentWidth, height: parentHeight },
      touchRect: touch.raw, effectiveRect: touch.effective, effectiveWidth: touch.width, effectiveHeight: touch.height,
      clippedByParent: touch.clipped, pass44: touch.width + physicalHalfPixelTolerance(density) >= 44 && touch.height + physicalHalfPixelTolerance(density) >= 44 };
  });
  const overlaps = [];
  for (let left = 0; left < rows.length; left++) for (let right = left + 1; right < rows.length; right++) {
    if (rows[left].parentNativeTag !== rows[right].parentNativeTag) continue;
    const overlap = rectOverlap(rows[left].effectiveRect, rows[right].effectiveRect);
    if (overlap.width > 0 && overlap.height > 0)
      overlaps.push({ left: rows[left].key, right: rows[right].key, ...overlap });
  }
  return { rows, overlaps };
}

async function main() {
  const opt = options(process.argv.slice(2));
  const root = resolve(opt.root ?? defaultRoot);
  const contractPath = resolve(opt.contract ?? join(root, 'scripts/native-touch-runtime-contract.json'));
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const platform = String(opt.platform ?? contract.platform);
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const diagnostic = opt.diagnostic === true;
  if (!diagnostic && (!opt['expect-commit'] || head !== opt['expect-commit'])) throw new Error(`--expect-commit 불일치: ${head}`);
  if (!diagnostic && dirty) throw new Error('추적 파일이 변경된 트리에서는 네이티브 증거를 만들지 않는다');
  const fixtures = Object.fromEntries(Object.entries(opt).filter(([key]) => key.startsWith('fixture-')).map(([key, value]) => [key.slice(8), value]));
  const renderRoute = (route) => route.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    if (!fixtures[key]) throw new Error(`fixture 누락: ${key}`); return fixtures[key];
  });
  const inspector = await connectInspector(String(opt.inspector ?? 'http://127.0.0.1:8081'));
  const scenarios = [];
  const measuredDevice = await runtimeDevice(inspector.evaluate);
  const density = Number(measuredDevice.density);
  const fontScale = Number(measuredDevice.fontScale);
  if (!(density > 0)) throw new Error('런타임에서 유효한 density를 읽지 못했다');
  if (opt.density && Math.abs(Number(opt.density) - density) > 1e-6)
    throw new Error(`--density ${opt.density} ≠ 런타임 ${density}`);
  if (opt['font-scale'] && Math.abs(Number(opt['font-scale']) - fontScale) > 1e-6)
    throw new Error(`--font-scale ${opt['font-scale']} ≠ 런타임 ${fontScale}`);
  if (platform !== measuredDevice.platform) throw new Error(`platform ${platform} ≠ 런타임 ${measuredDevice.platform}`);
  try {
    for (const scenario of contract.scenarios) {
      const route = renderRoute(scenario.route); await navigate(inspector.evaluate, route);
      const phases = [{ id: 'initial', ...await collect(inspector.evaluate, density, scenario.activeOwnerPattern) }];
      for (const action of scenario.actions ?? []) {
        await inspector.evaluate(runtimeExpression({ kind: 'press', ...action })); await sleep(600);
        phases.push({ id: action.phase, ...await collect(inspector.evaluate, density, action.activeOwnerPattern ?? scenario.activeOwnerPattern) });
      }
      scenarios.push({ id: scenario.id, route, phases });
      console.log(`${scenario.id}: ${phases.map((phase) => `${phase.id} ${phase.rows.length}`).join(' · ')}`);
    }
  } finally { inspector.socket.close(); }
  const artifact = {
    schemaVersion: 1, platform, fontScale,
    device: { id: String(opt.device ?? 'unknown'), ...measuredDevice, density },
    manifest: { evidenceStatus: diagnostic ? 'DIAGNOSTIC_DIRTY_NOT_EVIDENCE' : 'EXACT_COMMIT_EVIDENCE',
      productCommit: head, productTree: spawnSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
      scriptSha256: sha256(normalizedText(here)), contractSha256: sha256(normalizedText(contractPath)), node: process.version },
    scenarios,
  };
  artifact.evaluation = evaluateNativeArtifact(artifact, contract);
  const knownPath = resolve(opt.known ?? join(root, 'scripts/native-touch-runtime-known.json'));
  const ratchetKey = `${platform}@${fontScale}`;
  const knownAll = existsSync(knownPath) ? JSON.parse(readFileSync(knownPath, 'utf8')) : { schemaVersion: 1, baselines: {} };
  const snapshot = nativeRatchetSnapshot(artifact.evaluation);
  if (opt['update-known']) {
    if (!diagnostic) throw new Error('--update-known은 진단 실행에서만 허용한다. exact 실행은 이미 정한 목록을 검증한다');
    knownAll.baselines ??= {};
    knownAll.baselines[ratchetKey] = snapshot;
    writeFileSync(knownPath, JSON.stringify(knownAll, null, 2) + '\n');
  } else {
    artifact.evaluation.failures.push(...compareNativeRatchet(snapshot, knownAll.baselines?.[ratchetKey]));
  }
  artifact.evaluation.ratchet = { key: ratchetKey, snapshot,
    knownSha256: existsSync(knownPath) ? sha256(normalizedText(knownPath)) : null };
  const outputPath = resolve(opt.out ?? join(root, 'docs/prototypes', `native-touch-${platform}-${fontScale}x.json`));
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + '\n');
  console.log(`네이티브 터치 감사: lineage ${artifact.evaluation.lineage.length} · 새 무판정 미달 ${artifact.evaluation.observedUnjudged.length} · 중첩 ${artifact.evaluation.materialOverlaps.length}`);
  if (artifact.evaluation.failures.length) {
    console.error(artifact.evaluation.failures.map((failure) => `  - ${failure}`).join('\n')); process.exit(1);
  }
  console.log(`PASS ${basename(outputPath)}`);
}

if (resolve(process.argv[1] ?? '') === resolve(here)) main().catch((error) => { console.error(error.stack ?? String(error)); process.exit(1); });
