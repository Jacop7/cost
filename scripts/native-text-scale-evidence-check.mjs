#!/usr/bin/env node
/** 같은 실제 기기의 1×/2× Text host frame을 대조해 글자 확대가 실제 레이아웃에 반영됐는지 단언한다. */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { textSha256 } from '../docs/prototypes/full-page-flow-prototype-text-sha256.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sameDevice = (a, b) => Boolean(a.model) && Boolean(b.model)
  && a.platform === b.platform && a.density === b.density && a.osVersion === b.osVersion
  && a.model === b.model
  && a.screen?.width === b.screen?.width && a.screen?.height === b.screen?.height
  && a.window?.width === b.window?.width && a.window?.height === b.window?.height;

const structuralPairs = (leftRows, rightRows, includeLabel = false) => {
  const group = (rows) => {
    const result = new Map();
    for (const row of rows) {
      const base = JSON.stringify([row.ownerChain ?? [], row.fontSize ?? null, row.lineHeight ?? null,
        row.allowFontScaling ?? null, row.maxFontSizeMultiplier ?? null, includeLabel ? row.label ?? null : null]);
      if (!result.has(base)) result.set(base, []);
      result.get(base).push(row);
    }
    for (const values of result.values()) values.sort((a, b) => a.windowMeasure[1] - b.windowMeasure[1]
      || a.windowMeasure[0] - b.windowMeasure[0] || String(a.label).localeCompare(String(b.label)));
    return result;
  };
  const left = group(leftRows), right = group(rightRows), pairs = [];
  for (const [base, values] of left) {
    const peers = right.get(base) ?? [];
    for (let index = 0; index < Math.min(values.length, peers.length); index++) pairs.push([values[index], peers[index]]);
  }
  return pairs;
};

const dominantTapViewport = (tap) => {
  const frames = [];
  for (const phase of Object.values(tap.frames ?? {})) for (const ancestor of phase.ancestors ?? [])
    if (ancestor.host === 'RNSScreenContentWrapper' && ancestor.frame) frames.push(ancestor.frame);
  const counts = new Map();
  for (const frame of frames) {
    const key = `${Number(frame?.[2])}x${Number(frame?.[3])}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const winner = [...counts].filter(([key]) => !key.includes('NaN')).sort((a, b) => b[1] - a[1])[0];
  if (!winner) return null;
  const [width, height] = winner[0].split('x').map(Number);
  return { width, height };
};

const identitySupplementFailures = (artifact, tap, name) => {
  const failures = [];
  const supplement = artifact.manifest?.deviceIdentitySupplement;
  const viewport = dominantTapViewport(tap);
  if (!artifact.device?.model) failures.push(`${name}: iOS 기기 model이 비어 있다`);
  if (!supplement || supplement.source !== 'native-touch-ios-tap-probe.json')
    failures.push(`${name}: iOS model 보충 출처가 없다`);
  if (artifact.device?.model !== tap.device?.model || artifact.device?.osVersion !== tap.device?.osVersion
    || artifact.device?.density !== tap.device?.density)
    failures.push(`${name}: 탭 probe와 model·OS·density가 일치하지 않는다`);
  if (!viewport || artifact.device?.screen?.width !== viewport.width
    || JSON.stringify(supplement?.matched?.contentViewportDp) !== JSON.stringify(viewport))
    failures.push(`${name}: 탭 probe와 화면 콘텐츠 viewport 결속이 없다`);
  return failures;
};

export function compareTextScale(one, two) {
  const failures = [];
  if (one.platform !== 'ios' || two.platform !== 'ios' || one.fontScale !== 1 || !(two.fontScale >= 2))
    failures.push('증거쌍이 ios@1 / ios@2 이상이 아니다');
  if (one.device?.platform !== one.platform || two.device?.platform !== two.platform
    || one.device?.fontScale !== one.fontScale || two.device?.fontScale !== two.fontScale)
    failures.push('산출물 배율·플랫폼과 런타임 device 값이 일치하지 않는다');
  if (!sameDevice(one.device ?? {}, two.device ?? {})) failures.push('1×/2× 기기·screen·window dp가 같지 않다');
  for (const [label, rows] of [['1×', one.rows ?? []], ['2×', two.rows ?? []]]) {
    if (new Set(rows.map((row) => row.key)).size !== rows.length) failures.push(`${label} Text host key가 중복된다`);
    if (rows.some((row) => !Array.isArray(row.windowMeasure) || row.windowMeasure.length < 4
      || !row.windowMeasure.slice(0, 4).every(Number.isFinite))) failures.push(`${label} Text host frame이 유효하지 않다`);
  }
  // 상태와 문구가 다른 Text host는 확대 전후의 통제쌍이 아니다. 구조 역할 대조는 진단 문맥으로
  // 보존하되, 통과 증거는 같은 owner·typography·label의 제품 Text가 실제 배율에 비례해 커진 쌍이다.
  const matched = structuralPairs(one.rows ?? [], two.rows ?? []);
  const scalable = matched.filter(([left, right]) => left.allowFontScaling && right.allowFontScaling && left.fontSize && right.fontSize);
  const enlarged = scalable.filter(([left, right]) => right.windowMeasure[2] > left.windowMeasure[2] + 0.5
    || right.windowMeasure[3] > left.windowMeasure[3] + 0.5);
  const isProductPair = ([left, right]) => [left, right].every((row) => !(row.ownerChain ?? [])
    .some((owner) => /^_?LogBox/.test(owner)));
  const productScalable = scalable.filter(isProductPair);
  const productEnlarged = enlarged.filter(isProductPair);
  const controlled = structuralPairs(one.rows ?? [], two.rows ?? [], true)
    .filter(([left, right]) => left.allowFontScaling && right.allowFontScaling && left.fontSize && right.fontSize)
    .filter(isProductPair);
  const expectedRatio = two.fontScale / one.fontScale;
  const proportional = controlled.filter(([left, right]) => {
    const widthRatio = right.windowMeasure[2] / left.windowMeasure[2];
    const heightRatio = right.windowMeasure[3] / left.windowMeasure[3];
    return Math.abs(widthRatio - expectedRatio) <= 0.15 && Math.abs(heightRatio - expectedRatio) <= 0.15;
  });
  if (controlled.length < 1) failures.push('같은 문구·역할의 통제 제품 Text host가 없다');
  if (proportional.length < 1) failures.push(`실제 배율 ${expectedRatio.toFixed(3)}에 비례해 커진 통제 제품 Text host가 없다`);
  return { failures, summary: { oneRows: one.rows?.length ?? 0, twoRows: two.rows?.length ?? 0,
    matched: matched.length, scalable: scalable.length, enlarged: enlarged.length,
    productScalable: productScalable.length, productEnlarged: productEnlarged.length,
    controlledProduct: controlled.length, proportionalProduct: proportional.length,
    controlledLabels: proportional.map(([left]) => left.label) } };
}

export function verifyNativeTextScale(repoRoot = root) {
  const failures = [];
  const names = ['native-text-scale-ios-1x.json', 'native-text-scale-ios-2x.json'];
  if (names.some((name) => !existsSync(join(repoRoot, 'docs/prototypes', name))))
    return { failures: ['iOS 1×/2× 실제 Text host 확대 증거가 없다'], summary: null };
  const [one, two] = names.map((name) => JSON.parse(normalized(join(repoRoot, 'docs/prototypes', name))));
  const tap = JSON.parse(normalized(join(repoRoot, 'docs/prototypes/native-touch-ios-tap-probe.json')));
  const currentScript = textSha256(readFileSync(join(repoRoot, 'scripts/native-text-scale-audit.mjs')));
  const currentAppTree = spawnSync('git', ['rev-parse', 'HEAD:apps/mobile'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
  for (const [index, artifact] of [one, two].entries()) {
    const name = names[index];
    failures.push(...identitySupplementFailures(artifact, tap, name));
    if (artifact.manifest?.evidenceStatus !== 'EXACT_COMMIT_EVIDENCE') failures.push(`${name}: exact commit 증거가 아니다`);
    if (artifact.manifest?.scriptSha256 !== currentScript) failures.push(`${name}: 측정 스크립트 SHA 불일치`);
    if (artifact.manifest?.appTree !== currentAppTree) failures.push(`${name}: 현재 apps/mobile tree와 다르다`);
    const commit = artifact.manifest?.productCommit;
    if (!/^[0-9a-f]{40}$/.test(commit ?? '')) failures.push(`${name}: 완전한 productCommit이 없다`);
    else {
      const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: repoRoot });
      if (ancestor.status !== 0) failures.push(`${name}: productCommit이 HEAD의 조상이 아니다`);
      const committedAppTree = spawnSync('git', ['rev-parse', `${commit}:apps/mobile`], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
      if (committedAppTree !== artifact.manifest?.appTree) failures.push(`${name}: productCommit의 apps/mobile tree와 다르다`);
    }
  }
  const comparison = compareTextScale(one, two);
  failures.push(...comparison.failures);
  return { failures, summary: comparison.summary };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = verifyNativeTextScale(root);
  if (result.failures.length) { console.error(result.failures.map((item) => `- ${item}`).join('\n')); process.exit(1); }
  console.log(`PASS iOS Text 확대 — 통제 제품 ${result.summary.proportionalProduct}/${result.summary.controlledProduct}`
    + ` · 문구 ${result.summary.controlledLabels.join(', ')}`);
}
