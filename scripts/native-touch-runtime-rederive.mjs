#!/usr/bin/env node
/** 보존된 원시 native frame을 현재 플랫폼별 터치 계약으로 다시 파생한다. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
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
  // A tab page and a full-screen form have different content heights on the same
  // device. Compare the probe's route, rather than the most frequent wrapper
  // across unrelated screens (which also counts the outer navigation root).
  const normalizeRoute = route => String(route ?? '').replace('/(tabs)', '').split('?')[0];
  const matchingScenarios = (source.scenarios ?? []).filter(scenario =>
    tap.target?.route && normalizeRoute(scenario.route) === normalizeRoute(tap.target.route));
  if (tap.target?.route && source.scenarios?.some(scenario => scenario.route) && !matchingScenarios.length)
    throw new Error(`${label}: 탭 probe와 같은 화면의 viewport 증거가 없다`);
  const sourceViewport = dominantScreenContentViewport(matchingScenarios.length
    ? { scenarios: matchingScenarios.map(scenario => ({ ...scenario, phases: scenario.phases.map(phase => ({
      ...phase, rows: phase.rows.map(row => ({ ...row,
        ancestors: (row.ancestors ?? []).filter(ancestor => ancestor.hostName === 'RNSScreenContentWrapper').slice(0, 1),
      })),
    })) })) } : source);
  const tapViewport = dominantScreenContentViewport(tap);
  const sourceId = String(source.device?.id ?? '');
  const tapId = String(tap.device?.id ?? '');
  const stableId = (value) => value && value !== 'unknown' && value !== 'iphone-actual';
  if (!stableId(sourceId) || !stableId(tapId) || sourceId !== tapId)
    throw new Error(`${label}: iOS 탭 증거와 exact 기기 ID가 다르다`);
  if (tap.device?.osVersion !== source.device?.osVersion || tap.device?.density !== source.device?.density)
    throw new Error(`${label}: iOS 탭 증거와 기기 OS/density가 다르다`);
  if (!sourceViewport || !tapViewport
    || sourceViewport.width !== tapViewport.width)
    throw new Error(`${label}: iOS 탭 증거와 화면 콘텐츠 width dp가 다르다`);
  const sameScale = Number(source.device?.fontScale) === Number(tap.device?.fontScale);
  if (sameScale && sourceViewport.height !== tapViewport.height)
    throw new Error(`${label}: 같은 글자 배율인데 화면 콘텐츠 height dp가 다르다`);
  return {
    deviceId: sourceId,
    contentWidthDp: sourceViewport.width,
    sourceViewportDp: sourceViewport,
    tapViewportDp: tapViewport,
  };
}

export function rederive(argument) {
  const path = resolve(argument);
  const source = JSON.parse(normalized(path));
  const matrixCell = contract.evidenceMatrix?.find((item) => item.file === basename(path));
  const evidenceScale = Number(matrixCell?.evidenceScale ?? matrixCell?.fontScale ?? source.manifest?.evidenceScale ?? source.fontScale);
  if (!(evidenceScale > 0)) throw new Error(`${path}: 접근성 evidenceScale을 결정할 수 없다`);
  const artifact = recomputeNativeArtifactDerived(source);
  artifact.manifest.evidenceScale = evidenceScale;
  artifact.evaluation = evaluateNativeArtifact(artifact, contract);
  const snapshot = nativeRatchetSnapshot(artifact.evaluation);
  artifact.evaluation.failures.push(...compareNativeRatchet(snapshot,
    known.baselines?.[`${artifact.platform}@${evidenceScale}`]));
  artifact.evaluation.ratchet = { key: `${artifact.platform}@${evidenceScale}`, snapshot };
  artifact.manifest.derivation = {
    semantics: 'direct-parent-touch-clipping-v4',
    auditSha256: sha256(normalized(auditPath)),
    contractSha256: sha256(normalized(contractPath)),
    source: 'preserved-raw-native-frames',
  };
  if (artifact.platform === 'ios') {
    const tapPath = resolve(root, 'docs/prototypes/native-touch-ios-tap-probe.json');
    const tap = JSON.parse(normalized(tapPath));
    const identity = assertSameIosIdentity(artifact, tap, path);
    if (!artifact.device?.model) artifact.device.model = tap.device.model;
    artifact.manifest.deviceIdentitySupplement = {
      source: 'native-touch-ios-tap-probe.json',
      reason: 'React Native Platform.constants가 iOS 실제 모델을 반환하지 않음',
      matched: {
        deviceId: identity.deviceId,
        osVersion: artifact.device.osVersion,
        density: artifact.device.density,
        contentWidthDp: identity.contentWidthDp,
      },
      observed: {
        sourceContentViewportDp: identity.sourceViewportDp,
        tapContentViewportDp: identity.tapViewportDp,
      },
    };
  }
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${path}: ${artifact.evaluation.failures.length ? 'FAIL' : 'PASS'}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  for (const argument of process.argv.slice(2)) rederive(argument);
}
