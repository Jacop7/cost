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

for (const argument of process.argv.slice(2)) {
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
  if (artifact.platform === 'ios' && !artifact.device?.model) {
    const tapPath = resolve(root, 'docs/prototypes/native-touch-ios-tap-probe.json');
    const tap = JSON.parse(normalized(tapPath));
    if (tap.device?.osVersion !== artifact.device?.osVersion || tap.device?.density !== artifact.device?.density)
      throw new Error(`${path}: iOS 탭 증거와 기기 OS/density가 다르다`);
    artifact.device.model = tap.device.model;
    artifact.manifest.deviceIdentitySupplement = {
      source: 'native-touch-ios-tap-probe.json',
      reason: 'React Native Platform.constants가 iOS 실제 모델을 반환하지 않음',
    };
  }
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${path}: ${artifact.evaluation.failures.length ? 'FAIL' : 'PASS'}`);
}
