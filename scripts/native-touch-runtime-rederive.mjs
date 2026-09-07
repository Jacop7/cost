#!/usr/bin/env node
/** 보존된 원시 native frame을 현재 플랫폼별 터치 계약으로 다시 파생한다. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareNativeRatchet,
  evaluateNativeArtifact,
  nativeRatchetSnapshot,
  recomputeNativeArtifactDerived,
} from './native-touch-runtime-audit.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const contractPath = resolve(root, 'scripts/native-touch-runtime-contract.json');
const auditPath = resolve(root, 'scripts/native-touch-runtime-audit.mjs');
const knownPath = resolve(root, 'scripts/native-touch-runtime-known.json');
const contract = JSON.parse(normalized(contractPath));
const known = JSON.parse(normalized(knownPath));

/**
 * iOS Platform.constants가 모델명을 주지 않아 탭 증거로 보충할 때 같은 OS·density만으로는
 * 다른 크기의 iPhone을 같은 기기로 오인할 수 있다. 두 산출물이 공통으로 가진
 * RNSScreenContentWrapper의 화면 콘텐츠 폭·높이를 기기 크기 식별에 함께 쓴다.
 */
export function dominantScreenContentViewport(source) {
  const frames = [];
  for (const scenario of source.scenarios ?? []) for (const phase of scenario.phases ?? [])
    for (const row of phase.rows ?? []) for (const ancestor of row.ancestors ?? []) {
      if (ancestor.hostName === 'RNSScreenContentWrapper' && ancestor.windowMeasure) frames.push(ancestor.windowMeasure);
    }
  for (const phase of Object.values(source.frames ?? {})) for (const ancestor of phase.ancestors ?? []) {
    if (ancestor.host === 'RNSScreenContentWrapper' && ancestor.frame) frames.push(ancestor.frame);
  }
  const counts = new Map();
  for (const frame of frames) {
    const width = Number(frame?.[2]);
    const height = Number(frame?.[3]);
    if (!(width > 0 && height > 0)) continue;
    const key = `${width}x${height}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const winner = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!winner) return null;
  const [width, height] = winner[0].split('x').map(Number);
  return { width, height };
}

export function assertSameIosIdentity(source, tap, label = 'iOS 증거') {
  const sourceViewport = dominantScreenContentViewport(source);
  const tapViewport = dominantScreenContentViewport(tap);
  if (tap.device?.osVersion !== source.device?.osVersion || tap.device?.density !== source.device?.density)
    throw new Error(`${label}: iOS 탭 증거와 기기 OS/density가 다르다`);
  if (!sourceViewport || !tapViewport
    || sourceViewport.width !== tapViewport.width || sourceViewport.height !== tapViewport.height)
    throw new Error(`${label}: iOS 탭 증거와 화면 콘텐츠 width/height dp가 다르다`);
  return sourceViewport;
}

export function rederive(argument) {
  const path = resolve(argument);
  const source = JSON.parse(normalized(path));
  const artifact = recomputeNativeArtifactDerived(source);
  artifact.evaluation = evaluateNativeArtifact(artifact, contract);
  const snapshot = nativeRatchetSnapshot(artifact.evaluation);
  artifact.evaluation.failures.push(...compareNativeRatchet(snapshot,
    known.baselines?.[`${artifact.platform}@${artifact.fontScale}`]));
  artifact.evaluation.ratchet = { key: `${artifact.platform}@${artifact.fontScale}`, snapshot };
  artifact.manifest.derivation = {
    semantics: 'platform-touch-clipping-v2',
    auditSha256: sha256(normalized(auditPath)),
    contractSha256: sha256(normalized(contractPath)),
    source: 'preserved-raw-native-frames',
  };
  if (artifact.platform === 'ios') {
    const tapPath = resolve(root, 'docs/prototypes/native-touch-ios-tap-probe.json');
    const tap = JSON.parse(normalized(tapPath));
    const contentViewportDp = assertSameIosIdentity(artifact, tap, path);
    if (!artifact.device?.model) artifact.device.model = tap.device.model;
    artifact.manifest.deviceIdentitySupplement = {
      source: 'native-touch-ios-tap-probe.json',
      reason: 'React Native Platform.constants가 iOS 실제 모델을 반환하지 않음',
      matched: { osVersion: artifact.device.osVersion, density: artifact.device.density, contentViewportDp },
    };
  }
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${path}: ${artifact.evaluation.failures.length ? 'FAIL' : 'PASS'}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  for (const argument of process.argv.slice(2)) rederive(argument);
}
