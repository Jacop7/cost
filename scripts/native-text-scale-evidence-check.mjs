#!/usr/bin/env node
/** 같은 실제 기기의 1×/2× Text host frame을 대조해 글자 확대가 실제 레이아웃에 반영됐는지 단언한다. */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { textSha256 } from '../docs/prototypes/full-page-flow-prototype-text-sha256.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sameDevice = (a, b) => a.platform === b.platform && a.density === b.density && a.osVersion === b.osVersion
  && a.model === b.model
  && a.screen?.width === b.screen?.width && a.screen?.height === b.screen?.height
  && a.window?.width === b.window?.width && a.window?.height === b.window?.height;

const structuralPairs = (leftRows, rightRows) => {
  const group = (rows) => {
    const result = new Map();
    for (const row of rows) {
      const base = JSON.stringify([row.ownerChain ?? [], row.fontSize ?? null, row.lineHeight ?? null,
        row.allowFontScaling ?? null, row.maxFontSizeMultiplier ?? null]);
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
  // 오류 문구·로그 숫자처럼 문자열은 실행 시점에 바뀔 수 있다. 확대 여부는 같은 owner 역할과
  // typography 계약의 순서쌍으로 대조하고, label은 사람이 읽는 원시 관측으로만 보존한다.
  const matched = structuralPairs(one.rows ?? [], two.rows ?? []);
  const scalable = matched.filter(([left, right]) => left.allowFontScaling && right.allowFontScaling && left.fontSize && right.fontSize);
  const enlarged = scalable.filter(([left, right]) => right.windowMeasure[2] > left.windowMeasure[2] + 0.5
    || right.windowMeasure[3] > left.windowMeasure[3] + 0.5);
  const isProductPair = ([left, right]) => [left, right].every((row) => !(row.ownerChain ?? [])
    .some((owner) => /^_?LogBox/.test(owner)));
  const productScalable = scalable.filter(isProductPair);
  const productEnlarged = enlarged.filter(isProductPair);
  if (matched.length < 5) failures.push(`같은 Text host 매칭 ${matched.length} < 5`);
  if (scalable.length < 5) failures.push(`확대 가능한 Text host 매칭 ${scalable.length} < 5`);
  if (enlarged.length < 3) failures.push(`2×에서 실제 width/height가 커진 Text host ${enlarged.length} < 3`);
  if (productScalable.length < 3) failures.push(`LogBox를 제외한 제품 Text host 매칭 ${productScalable.length} < 3`);
  if (productEnlarged.length < 3) failures.push(`2×에서 실제 커진 제품 Text host ${productEnlarged.length} < 3`);
  return { failures, summary: { oneRows: one.rows?.length ?? 0, twoRows: two.rows?.length ?? 0,
    matched: matched.length, scalable: scalable.length, enlarged: enlarged.length,
    productScalable: productScalable.length, productEnlarged: productEnlarged.length } };
}

export function verifyNativeTextScale(repoRoot = root) {
  const failures = [];
  const names = ['native-text-scale-ios-1x.json', 'native-text-scale-ios-2x.json'];
  if (names.some((name) => !existsSync(join(repoRoot, 'docs/prototypes', name))))
    return { failures: ['iOS 1×/2× 실제 Text host 확대 증거가 없다'], summary: null };
  const [one, two] = names.map((name) => JSON.parse(normalized(join(repoRoot, 'docs/prototypes', name))));
  const currentScript = textSha256(readFileSync(join(repoRoot, 'scripts/native-text-scale-audit.mjs')));
  const currentAppTree = spawnSync('git', ['rev-parse', 'HEAD:apps/mobile'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
  for (const [index, artifact] of [one, two].entries()) {
    const name = names[index];
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
  console.log(`PASS iOS Text 확대 — 매칭 ${result.summary.matched} · 확대 ${result.summary.enlarged}`
    + ` · 제품 ${result.summary.productEnlarged}/${result.summary.productScalable}`);
}
