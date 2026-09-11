#!/usr/bin/env node
/**
 * Expo 개발 빌드의 Fabric frame을 Hermes inspector에서 읽어 실제 터치 영역을 잰다.
 * 정적 `visual + hitSlop * 2` 합산과 달리 React Native의 플랫폼별 touch clipping을 포함한다.
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

export function fontScaleMatches(contract, platform, evidenceScale, actualScale) {
  const policy = contract.fontScalePolicies?.[platform]?.[String(evidenceScale)]
    ?? { mode: 'exact', value: evidenceScale };
  if (!Number.isFinite(actualScale) || !Number.isFinite(Number(policy.value))) return false;
  return policy.mode === 'minimum'
    ? actualScale + 1e-6 >= Number(policy.value)
    : Math.abs(actualScale - Number(policy.value)) < 1e-6;
}

export function resolveActionForFontScale(action, fontScale) {
  const keyed = action?.yByFontScale?.[String(fontScale)];
  return keyed === undefined ? action : { ...action, y: Number(keyed) };
}

export function resolveActionForRuntime(action, platform, fontScale) {
  const resolved = resolveActionForFontScale(action, fontScale);
  const runtimeKey = `${platform}@${fontScale}`;
  const x = action?.xByRuntime?.[runtimeKey] ?? action?.xByFontScale?.[String(fontScale)];
  const y = action?.yByRuntime?.[runtimeKey] ?? action?.yByFontScale?.[String(fontScale)];
  return {
    ...resolved,
    ...(x === undefined ? {} : { x: Number(x) }),
    ...(y === undefined ? {} : { y: Number(y) }),
  };
}

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

export function effectiveTouchRect(frame, parentFrames, hitSlop) {
  const slop = slopBox(hitSlop);
  const raw = {
    left: frame.x - slop.left,
    top: frame.y - slop.top,
    right: frame.x + frame.width + slop.right,
    bottom: frame.y + frame.height + slop.bottom,
  };
  const parents = (Array.isArray(parentFrames) ? parentFrames : [parentFrames]).map((parentFrame) => ({
    left: parentFrame.x,
    top: parentFrame.y,
    right: parentFrame.x + parentFrame.width,
    bottom: parentFrame.y + parentFrame.height,
  }));
  const effective = parents.reduce((result, parent) => ({
    left: Math.max(result.left, parent.left),
    top: Math.max(result.top, parent.top),
    right: Math.min(result.right, parent.right),
    bottom: Math.min(result.bottom, parent.bottom),
  }), raw);
  return {
    raw,
    effective,
    width: Math.max(0, effective.right - effective.left),
    height: Math.max(0, effective.bottom - effective.top),
    clipped: Object.keys(raw).some((key) => Math.abs(raw[key] - effective[key]) > 1e-7),
  };
}

/**
 * 실제 3점 탭으로 확인한 공통 경계를 한곳에 둔다.
 * Android와 iOS 모두 직접 host parent에서 hitSlop을 자른다. 명시적 시각 clipping
 * 경계도 두 플랫폼 모두 터치 경계다.
 */
export function ancestorClipsTouch(ancestor, index, _platform) {
  return ancestor?.clipsVisual === true || index === 0;
}

export function physicalHalfPixelTolerance(density) {
  if (!(density > 0)) throw new Error(`유효한 density가 아니다: ${density}`);
  // 판정은 물리 픽셀에서 한다: effective_dp*density >= 44*density - 0.5 - eps.
  return (0.5 + 1e-3) / density;
}

/** Expo Router 탭 아래의 실제 화면을 명시해 같은 이름의 숨은 route를 만들지 않는다. */
export function tabScopedRoute(route) {
  return /^\/(ingredients|recipes|orders|sales|my)(?:\/|\?|$)/.test(route) ? `/(tabs)${route}` : route;
}

export function tabRootForRoute(route) {
  const match = route.match(/^\/\(tabs\)\/(ingredients|recipes|orders|sales|my)(?:\/|\?|$)/);
  return match ? `/(tabs)/${match[1]}` : null;
}

/** react-native-screens에서 2만 활성 화면이다. screen 조상이 없는 modal/root는 유지한다. */
export function isActiveScreenStateList(states) {
  return states.length === 0 || states.every((state) => state === 2);
}

export function rectOverlap(left, right) {
  return {
    width: Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left)),
    height: Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top)),
  };
}

const rectOfFrame = (frame) => ({
  left: frame.x, top: frame.y, right: frame.x + frame.width, bottom: frame.y + frame.height,
});

export function classifyVisibility(frame, ancestors, density) {
  const tolerance = physicalHalfPixelTolerance(density);
  const raw = rectOfFrame(frame);
  const clippingAncestors = [];
  for (const ancestor of ancestors) {
    // React Native View의 기본 overflow는 visible이다. 부모 frame 밖이라는 사실만으로
    // 시각적으로 잘렸다고 추론하지 않고, 실제 clipping 경계만 가시성 판정에 쓴다.
    if (ancestor.clipsVisual === false) continue;
    const bounds = rectOfFrame(ancestor.frame);
    if (raw.left < bounds.left - tolerance || raw.top < bounds.top - tolerance
      || raw.right > bounds.right + tolerance || raw.bottom > bounds.bottom + tolerance) {
      clippingAncestors.push({ nativeTag: ancestor.nativeTag ?? null, kind: ancestor.kind ?? 'nonScroll',
        hostName: ancestor.hostName ?? null, ownerChain: ancestor.ownerChain ?? [],
        overflow: ancestor.overflow ?? null, clipsVisual: ancestor.clipsVisual ?? true });
    }
  }
  if (!clippingAncestors.length) return { visualFullyVisible: true, visibilityDisposition: 'fullyVisible', clippingAncestors };
  // RN은 가장 가까운 clipping 경계에서 먼저 잘린다. ScrollView 밖의 항목은 그 뒤의 화면
  // 컨테이너도 기하상 벗어나 보이지만, 도달 방법은 스크롤이므로 첫 경계의 역할로 판정한다.
  const safelyExcluded = ['scrollViewport', 'root'].includes(clippingAncestors[0].kind);
  return {
    visualFullyVisible: false,
    visibilityDisposition: safelyExcluded ? 'excludedScrollableOrRoot' : 'clippedByNonScroll',
    clippingAncestors,
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
    const currentKeys = new Set(current[field].map((item) => item.key));
    for (const key of baseline.keys()) {
      if (!currentKeys.has(key)) failures.push(`사라진 네이티브 ${field}: ${key} — known 갱신 필요`);
    }
  }
  return failures;
}

const frameFromMeasure = (measure, label) => {
  if (!Array.isArray(measure) || measure.length < 4 || measure.slice(0, 4).some((value) => !Number.isFinite(value)))
    throw new Error(`${label} 원시 measure가 유효하지 않다`);
  return { x: measure[0], y: measure[1], width: measure[2], height: measure[3] };
};

export function recomputeNativeArtifactDerived(artifact) {
  const result = structuredClone(artifact);
  const density = Number(result.device?.density);
  for (const scenario of result.scenarios ?? []) for (const phase of scenario.phases ?? []) {
    for (const row of phase.rows ?? []) {
      const relative = frameFromMeasure(row.relativeMeasure, `${scenario.id}/${phase.id}/${row.key} relative`);
      const windowFrame = frameFromMeasure(row.windowMeasure, `${scenario.id}/${phase.id}/${row.key} window`);
      const ancestorRows = Array.isArray(row.ancestors) && row.ancestors.length
        ? row.ancestors : [row.parent];
      const ancestorMeasures = ancestorRows.map((ancestor, index) => frameFromMeasure(ancestor.windowMeasure,
        `${scenario.id}/${phase.id}/${row.key} ancestor[${index}]`));
      const touchAncestorMeasures = ancestorMeasures.filter((_, index) =>
        ancestorClipsTouch(ancestorRows[index], index, result.platform));
      const touch = effectiveTouchRect(windowFrame, touchAncestorMeasures, row.hitSlop);
      const visualAncestorMeasures = ancestorMeasures.filter((_, index) => ancestorRows[index]?.clipsVisual !== false);
      const visual = visualAncestorMeasures.length
        ? effectiveTouchRect(windowFrame, visualAncestorMeasures, 0)
        : { raw: rectOfFrame(windowFrame), effective: rectOfFrame(windowFrame), width: windowFrame.width,
          height: windowFrame.height, clipped: false };
      row.relativeFrame = relative;
      row.windowFrame = windowFrame;
      row.parentFrame = ancestorMeasures[0];
      row.ancestorFrames = ancestorMeasures;
      row.touchRect = touch.raw;
      row.effectiveRect = touch.effective;
      row.effectiveWidth = touch.width;
      row.effectiveHeight = touch.height;
      row.clippedByParent = touch.clipped;
      row.visualRect = visual.effective;
      row.visualWidth = visual.width;
      row.visualHeight = visual.height;
      const visibility = classifyVisibility(windowFrame, ancestorRows.map((ancestor, index) => ({
        frame: ancestorMeasures[index], nativeTag: ancestor?.nativeTag, kind: ancestor?.kind,
        hostName: ancestor?.hostName, ownerChain: ancestor?.ownerChain,
        overflow: ancestor?.overflow, clipsVisual: ancestor?.clipsVisual,
      })), density);
      row.visualFullyVisible = visibility.visualFullyVisible;
      row.visibilityDisposition = visibility.visibilityDisposition;
      row.clippingAncestors = visibility.clippingAncestors;
      row.pass44 = touch.width + physicalHalfPixelTolerance(density) >= 44
        && touch.height + physicalHalfPixelTolerance(density) >= 44;
    }
    phase.excludedPartiallyVisible = phase.rows.filter((row) => row.visibilityDisposition === 'excludedScrollableOrRoot')
      .map((row) => ({ key: row.key, label: row.label, ownerChain: row.ownerChain,
        windowFrame: row.windowFrame, visualRect: row.visualRect, visualWidth: row.visualWidth,
        visualHeight: row.visualHeight, clippingAncestors: row.clippingAncestors }));
    const judgedRows = phase.rows.filter((row) => row.visibilityDisposition !== 'excludedScrollableOrRoot');
    phase.overlaps = [];
    for (let left = 0; left < judgedRows.length; left++) for (let right = left + 1; right < judgedRows.length; right++) {
      if (judgedRows[left].parentNativeTag !== judgedRows[right].parentNativeTag) continue;
      const overlap = rectOverlap(judgedRows[left].effectiveRect, judgedRows[right].effectiveRect);
      if (overlap.width > 0 && overlap.height > 0)
        phase.overlaps.push({ left: judgedRows[left].key, right: judgedRows[right].key, ...overlap });
    }
  }
  return result;
}

const matches = (value, pattern) => !pattern || new RegExp(pattern, 'u').test(value ?? '');

export function evaluateNativeArtifact(artifact, contract) {
  const failures = [];
  for (const scenario of artifact.scenarios) {
    if (scenario.measurementFailure) failures.push(`시나리오 측정 실패: ${scenario.id}: ${scenario.measurementFailure}`);
  }
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
        .filter((row) => row.visibilityDisposition !== 'excludedScrollableOrRoot')
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
      if (row.visibilityDisposition === 'excludedScrollableOrRoot') continue;
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
  const allowedPlatforms = contract.platforms ?? [contract.platform];
  if (!allowedPlatforms.includes(artifact.platform)) failures.push(`platform ${artifact.platform} ∉ [${allowedPlatforms.join(', ')}]`);
  const evidenceScale = Number(artifact.manifest?.evidenceScale ?? artifact.fontScale);
  const allowedEvidenceScales = contract.fontScales ?? [contract.fontScale];
  if (!allowedEvidenceScales.includes(evidenceScale)
    || !fontScaleMatches(contract, artifact.platform, evidenceScale, artifact.fontScale))
    failures.push(`fontScale ${artifact.fontScale}은 ${artifact.platform}@${evidenceScale} 계약을 만족하지 않는다`);
  return { tolerance, lineage, observedUnjudged, materialOverlaps, failures };
}

function options(argv) {
  return Object.fromEntries(argv.filter((arg) => arg.startsWith('--')).map((arg) => {
    const index = arg.indexOf('=');
    return index < 0 ? [arg.slice(2), true] : [arg.slice(2, index), arg.slice(index + 1)];
  }));
}

export async function connectInspector(url, desiredPlatform, { fetchImpl = fetch, WebSocketImpl = WebSocket, timeoutMs = 15_000 } = {}) {
  const response = await fetchImpl(`${url.replace(/\/$/, '')}/json/list`);
  if (!response.ok) throw new Error(`Inspector 목록 HTTP ${response.status}`);
  const pages = await response.json();
  const evaluate = async (socket, expression) => {
    const id = Math.floor(Math.random() * 1_000_000_000);
    return await new Promise((resolveValue, reject) => {
      const timeout = setTimeout(() => {
        socket.removeEventListener('message', listener);
        reject(new Error('Hermes 평가 시간 초과'));
      }, timeoutMs);
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
  const failures = [];
  for (const page of pages.slice().reverse()) {
    let socket;
    try {
      socket = await new Promise((resolveSocket, reject) => {
        const candidate = new WebSocketImpl(page.webSocketDebuggerUrl);
        const timer = setTimeout(() => { candidate.close(); reject(new Error('Hermes 연결 시간 초과')); }, timeoutMs);
        candidate.onerror = () => { clearTimeout(timer); candidate.close(); reject(new Error('Hermes 연결 실패')); };
        candidate.onopen = () => { clearTimeout(timer); resolveSocket(candidate); };
      });
      const roots = await evaluate(socket,
        "typeof __REACT_DEVTOOLS_GLOBAL_HOOK__==='object'?[...__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers.keys()].reduce((n,id)=>n+__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots(id).size,0):0");
      const runtimePlatform = roots > 0 ? await evaluate(socket, `(()=>{const modules=[...__r.getModules().entries()];const hit=modules.find(([,m])=>String(m.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/react-native/index.js'));return hit?__r(hit[0]).Platform.OS:'unknown'})()`) : 'unknown';
      if (roots > 0 && (!desiredPlatform || runtimePlatform === desiredPlatform))
        return { socket, page, runtimePlatform, evaluate: (expression) => evaluate(socket, expression) };
      socket.close();
    } catch (error) {
      socket?.close();
      failures.push(`${page.id ?? 'page'}: ${error.message}`);
    }
  }
  throw new Error(`React Native ${desiredPlatform ?? ''} Hermes inspector를 찾지 못했다${failures.length ? ` (${failures.join('; ')})` : ''}`);
}

export function centeredScrollOffset(row) {
  const ancestors = row?.ancestors ?? [];
  const viewportIndex = ancestors.findIndex(a => /ScrollView/.test(a.hostName)
    && a.overflow === 'scroll');
  const viewport = ancestors[viewportIndex]?.windowMeasure;
  const content = ancestors[viewportIndex - 1]?.windowMeasure;
  const target = row?.windowMeasure;
  if (viewportIndex < 1 || [target, viewport, content].some(frame => !Array.isArray(frame)
    || frame.length < 4 || !frame.slice(0, 4).every(Number.isFinite)
    || frame[2] <= 0 || frame[3] <= 0)) throw new Error('scroll target/content/viewport 측정이 유효하지 않다');
  return Math.max(0, Math.min(content[3] - viewport[3],
    target[1] - content[1] + target[3] / 2 - viewport[3] / 2));
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
    const text=f=>{let out='';const seen=new Set();const walk=n=>{if(!n||seen.has(n))return;seen.add(n);const p=n.memoizedProps;if(typeof p==='string'||typeof p==='number')out+=' '+p;walk(n.child);walk(n.sibling)};walk(f?.child);return out.replace(/\\s+/g,' ').trim()};
    const hostChild=f=>{const q=f?.child?[f.child]:[];const seen=new Set();while(q.length){const n=q.shift();if(!n||seen.has(n))continue;seen.add(n);if(n.tag===5)return n;if(n.child)q.push(n.child);if(n.sibling)q.push(n.sibling)}return null};
    const hostAncestors=f=>{const out=[];for(let n=f?.return;n;n=n.return)if(n.tag===5)out.push(n);return out};
    const flatStyle=s=>Array.isArray(s)?Object.assign({},...s.filter(Boolean).map(flatStyle)):(s&&typeof s==='object'?s:{});
    const slop=v=>typeof v==='number'?{top:v,right:v,bottom:v,left:v}:{top:v?.top??v?.vertical??0,right:v?.right??v?.horizontal??0,bottom:v?.bottom??v?.vertical??0,left:v?.left??v?.horizontal??0};
    const buttons=[];const seen=new Set();
    const walk=f=>{if(!f||seen.has(f))return;seen.add(f);const p=f.memoizedProps||{};if(name(f)==='Pressable'&&p.accessibilityRole==='button'){const host=hostChild(f),ancestors=hostAncestors(f);if(host&&ancestors.length){const label=String(p.accessibilityLabel||text(f)||'(unlabelled)');const screenActivityStates=ancestors.filter(n=>name(n)==='RNSScreen'&&n.memoizedProps?.activityState!=null).map(n=>n.memoizedProps.activityState);buttons.push({fiber:f,host,ancestors,label,ownerChain:owners(f),hitSlop:slop(p.hitSlop??host.memoizedProps?.hitSlop),nativeTag:host.stateNode?.canonical?.nativeTag,parentNativeTag:ancestors[0].stateNode?.canonical?.nativeTag,screenActivityStates})}}walk(f.child);walk(f.sibling)};
    roots.forEach(walk);
    const active=[...new Map(buttons.filter(b=>Number.isFinite(b.nativeTag)&&(b.screenActivityStates.length===0||b.screenActivityStates.every(s=>s===2))).map(b=>[b.nativeTag,b])).values()];
    if(op.kind==='snapshot'){
      const rows=active.filter(b=>!op.ownerPattern||new RegExp(op.ownerPattern,'u').test(b.ownerChain.join('>')))
        .map(b=>({nativeTag:b.nativeTag,label:b.label,ownerChain:b.ownerChain,screenActivityStates:b.screenActivityStates}))
        .sort((a,b)=>a.nativeTag-b.nativeTag);
      return JSON.stringify(rows);
    }
    if(op.kind==='press'||op.kind==='pressIfPresent'){
      const found=active.find(b=>(!op.ownerPattern||new RegExp(op.ownerPattern,'u').test(b.ownerChain.join('>')))&&new RegExp(op.labelPattern,'u').test(b.label));
      if(!found&&op.kind==='pressIfPresent')return JSON.stringify({pressed:null});
      if(!found)throw new Error('action target 없음: '+op.labelPattern);
      const press=found.fiber.memoizedProps?.onPress;if(typeof press!=='function')throw new Error('onPress 없음');press();return JSON.stringify({pressed:found.label});
    }
    if(op.kind==='scroll'){
      const found=active.find(b=>(!op.ownerPattern||new RegExp(op.ownerPattern,'u').test(b.ownerChain.join('>')))&&new RegExp(op.labelPattern,'u').test(b.label));
      if(!found)throw new Error('scroll target 없음: '+op.labelPattern);
      for(let n=found.fiber;n;n=n.return)if(name(n)==='ScrollView'&&typeof n.stateNode?.scrollTo==='function'){
        n.stateNode.scrollTo({x:Number(op.x||0),y:Number(op.y||0),animated:false});return JSON.stringify({scrolled:found.label,x:Number(op.x||0),y:Number(op.y||0)});
      }
      throw new Error('scroll ancestor 없음: '+op.labelPattern);
    }
    state.rows=[];state.pending=0;state.done=false;
    const measure=(node,method,target,key)=>{state.pending++;nativeFabricUIManager[method](node.stateNode.node,(...values)=>{target[key]=values;state.pending--;if(state.pending===0)state.done=true})};
    for(const b of active){const row={key:b.ownerChain.join('>')+'|'+b.label+'|'+b.nativeTag,label:b.label,ownerChain:b.ownerChain,hitSlop:b.hitSlop,nativeTag:b.nativeTag,parentNativeTag:b.parentNativeTag,screenActivityStates:b.screenActivityStates,ancestors:b.ancestors.map((n,index)=>{const chain=owners(n),hostName=name(n),directOwner=name(n?._debugOwner),hostIdentity=hostName+'>'+directOwner,scroll=/ScrollView|FlatList|VirtualizedList/.test(hostIdentity),root=index===b.ancestors.length-1,platformWrapper=/RNSScreen|RCTModalHostView/.test(hostIdentity),overflow=flatStyle(n.memoizedProps?.style).overflow??n.memoizedProps?.overflow??'visible',clipsVisual=!platformWrapper&&(scroll||root||overflow==='hidden'||overflow==='scroll'),clipsTouch=clipsVisual||index===0;return {nativeTag:n.stateNode?.canonical?.nativeTag,hostName,directOwner,ownerChain:chain,kind:scroll?'scrollViewport':root?'root':'nonScroll',overflow,platformWrapper,clipsVisual,clipsTouch}})};state.rows.push(row);measure(b.host,'measure',row,'relativeMeasure');measure(b.host,'measureInWindow',row,'windowMeasure');for(const ancestor of row.ancestors){const node=b.ancestors[row.ancestors.indexOf(ancestor)];measure(node,'measureInWindow',ancestor,'windowMeasure')}}
    if(state.pending===0)state.done=true;return JSON.stringify({rows:state.rows.length,pending:state.pending});
  })()`;
}

async function closeTransientLayers(evaluate) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = JSON.parse(await evaluate(runtimeExpression({ kind: 'pressIfPresent', ownerPattern: 'Sheet|Modal|Popover', labelPattern: '^닫기$' })));
    if (!result.pressed) return;
    await sleep(350);
  }
  throw new Error('닫기 가능한 임시 레이어가 4회 뒤에도 남았다');
}

async function navigate(evaluate, route) {
  const routerCall = (method, value) => `(()=>{const modules=[...__r.getModules().entries()];const hit=modules.find(([,m])=>String(m.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/expo-router/build/exports.js'));if(!hit)throw new Error('expo-router exports module 없음');__r(hit[0]).router.${method}(${value === undefined ? '' : JSON.stringify(value)});return hit[0]})()`;
  const root = tabRootForRoute(route);
  if (root) {
    await evaluate(routerCall('replace', root));
    await sleep(350);
    await evaluate(`(()=>{const modules=[...__r.getModules().entries()];const hit=modules.find(([,m])=>String(m.verboseName||'').replaceAll('\\\\','/').endsWith('/node_modules/expo-router/build/exports.js'));if(!hit)throw new Error('expo-router exports module 없음');const router=__r(hit[0]).router;if(router.canDismiss())router.dismissAll();return router.canDismiss()})()`);
    await sleep(350);
    await evaluate(routerCall('replace', root));
    await sleep(350);
  }
  if (!root || route !== root) await evaluate(routerCall('navigate', route));
}

export async function waitForStableOwner(evaluate, ownerPattern, { attempts = 40, consecutive = 3, delayMs = 250 } = {}) {
  let previous = null;
  let stable = 0;
  for (let attempt = 0; attempt < attempts; attempt++) {
    await sleep(delayMs);
    const rows = JSON.parse(await evaluate(runtimeExpression({ kind: 'snapshot', ownerPattern })));
    const key = JSON.stringify(rows);
    stable = rows.length > 0 && key === previous ? stable + 1 : rows.length > 0 ? 1 : 0;
    if (stable >= consecutive) return rows;
    previous = key;
  }
  throw new Error(`활성 owner가 안정되지 않았다: ${ownerPattern}`);
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
      appVersion:constants?.expoConfig?.version??null,bundleId:constants?.expoConfig?.android?.package??constants?.expoConfig?.ios?.bundleIdentifier??null,
      model:rn?.Platform?.constants?.Model??rn?.Platform?.constants?.model??null,
      apiLevel:rn?.Platform?.OS==='android'?rn?.Platform?.Version:null};
  })())`));
}

async function collect(evaluate, density, ownerPattern, platform) {
  await evaluate(runtimeExpression({ kind: 'collect', platform }));
  let state;
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(50);
    state = JSON.parse(await evaluate('JSON.stringify(globalThis.__MARGINCOOK_NATIVE_TOUCH__)'));
    if (state.done) break;
  }
  if (!state?.done) throw new Error('native measure callback 완료 실패');
  const visibleRows = state.rows.filter((row) => row.windowMeasure?.[2] > 0 && row.windowMeasure?.[3] > 0);
  const excludedOwnerChains = [...new Set(visibleRows
    .filter((row) => ownerPattern && !matches(row.ownerChain.join('>'), ownerPattern))
    .map((row) => row.ownerChain.join('>')))].sort();
  const activeRows = visibleRows.filter((row) => !ownerPattern || matches(row.ownerChain.join('>'), ownerPattern));
  const rebuilt = recomputeNativeArtifactDerived({ platform, device: { density }, scenarios: [{ id: 'runtime', phases: [{ id: 'runtime', rows: activeRows }] }] });
  const phase = rebuilt.scenarios[0].phases[0];
  return { rows: phase.rows, overlaps: phase.overlaps,
    excludedOwnerChains, excludedPartiallyVisible: phase.excludedPartiallyVisible };
}

export async function captureNativeScenario(id, route, capture) {
  const measured = { id, route, phases: [] };
  try { await capture(measured.phases); }
  catch (error) { measured.measurementFailure = String(error?.message ?? error); }
  return measured;
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
  if (opt.scenario && !diagnostic) throw new Error('--scenario는 일부 화면만 보는 진단 실행에서만 허용한다');
  const fixtures = Object.fromEntries(Object.entries(opt).filter(([key]) => key.startsWith('fixture-')).map(([key, value]) => [key.slice(8), value]));
  const renderRoute = (route) => route.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    if (!fixtures[key]) throw new Error(`fixture 누락: ${key}`); return fixtures[key];
  });
  const inspector = await connectInspector(String(opt.inspector ?? 'http://127.0.0.1:8081'), platform);
  const scenarios = [];
  const measuredDevice = await runtimeDevice(inspector.evaluate);
  const density = Number(measuredDevice.density);
  const fontScale = Number(measuredDevice.fontScale);
  const evidenceScale = Number(opt['font-scale']);
  if (!(density > 0)) throw new Error('런타임에서 유효한 density를 읽지 못했다');
  if (opt.density && Math.abs(Number(opt.density) - density) > 1e-6)
    throw new Error(`--density ${opt.density} ≠ 런타임 ${density}`);
  if (!(evidenceScale > 0) || !fontScaleMatches(contract, platform, evidenceScale, fontScale))
    throw new Error(`런타임 ${platform}@${fontScale}가 --font-scale ${opt['font-scale']} 계약을 만족하지 않는다`);
  if (platform !== measuredDevice.platform) throw new Error(`platform ${platform} ≠ 런타임 ${measuredDevice.platform}`);
  try {
    const selectedScenarios = opt.scenario
      ? contract.scenarios.filter((scenario) => scenario.id === opt.scenario)
      : contract.scenarios;
    if (!selectedScenarios.length) throw new Error(`scenario 없음: ${opt.scenario}`);
    for (const scenario of selectedScenarios) {
      const route = tabScopedRoute(renderRoute(scenario.route));
      const measured = await captureNativeScenario(scenario.id, route, async (phases) => {
        await closeTransientLayers(inspector.evaluate);
        await navigate(inspector.evaluate, route);
        await waitForStableOwner(inspector.evaluate, scenario.activeOwnerPattern);
        phases.push({ id: 'initial', ...await collect(inspector.evaluate, density, scenario.activeOwnerPattern, platform) });
        for (const action of scenario.actions ?? []) {
          let resolvedAction = resolveActionForRuntime(action, platform, evidenceScale);
          if (action.kind === 'scroll' && action.align === 'center') {
            const before = await collect(inspector.evaluate, density, scenario.activeOwnerPattern, platform);
            const target = before.rows.find(row => matches(row.ownerChain.join('>'), action.ownerPattern)
              && matches(row.label, action.labelPattern));
            if (!target) throw new Error(`scroll target 없음: ${action.labelPattern}`);
            resolvedAction = { ...resolvedAction, y: centeredScrollOffset(target) };
          }
          await inspector.evaluate(runtimeExpression({ kind: resolvedAction.kind ?? 'press', ...resolvedAction }));
          const actionOwnerPattern = action.activeOwnerPattern ?? scenario.activeOwnerPattern;
          await waitForStableOwner(inspector.evaluate, actionOwnerPattern);
          phases.push({ id: action.phase, action: resolvedAction,
            ...await collect(inspector.evaluate, density, actionOwnerPattern, platform) });
        }
      });
      scenarios.push(measured);
      console.log(`${scenario.id}: ${measured.phases.map((phase) => `${phase.id} ${phase.rows.length}`).join(' · ')}${measured.measurementFailure ? ' · FAILED (원인 원본 보존)' : ''}`);
    }
  } finally { inspector.socket.close(); }
  const artifact = {
    schemaVersion: 1, platform, fontScale,
    device: { id: String(opt.device ?? 'unknown'), ...measuredDevice, density },
    manifest: { evidenceStatus: diagnostic ? 'DIAGNOSTIC_DIRTY_NOT_EVIDENCE' : 'EXACT_COMMIT_EVIDENCE',
      evidenceScale,
      measurementScope: 'scenario-active-owner-pattern',
      excludedOwnerChains: [...new Set(scenarios.flatMap((scenario) => scenario.phases)
        .flatMap((phase) => phase.excludedOwnerChains ?? []))].sort(),
      inspectorPage: { title: inspector.page?.title ?? null, deviceName: inspector.page?.deviceName ?? null },
      productCommit: head, productTree: spawnSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
      scriptSha256: sha256(normalizedText(here)), contractSha256: sha256(normalizedText(contractPath)), node: process.version },
    scenarios,
  };
  artifact.evaluation = evaluateNativeArtifact(artifact, contract);
  const knownPath = resolve(opt.known ?? join(root, 'scripts/native-touch-runtime-known.json'));
  const ratchetKey = `${platform}@${evidenceScale}`;
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
  const outputPath = resolve(opt.out ?? join(root, 'docs/prototypes', `native-touch-${platform}-${evidenceScale}x.json`));
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2) + '\n');
  console.log(`네이티브 터치 감사: lineage ${artifact.evaluation.lineage.length} · 새 무판정 미달 ${artifact.evaluation.observedUnjudged.length} · 중첩 ${artifact.evaluation.materialOverlaps.length}`);
  if (artifact.evaluation.failures.length) {
    console.error(artifact.evaluation.failures.map((failure) => `  - ${failure}`).join('\n')); process.exit(1);
  }
  console.log(`PASS ${basename(outputPath)}`);
}

if (resolve(process.argv[1] ?? '') === resolve(here)) main().catch((error) => { console.error(error.stack ?? String(error)); process.exit(1); });
