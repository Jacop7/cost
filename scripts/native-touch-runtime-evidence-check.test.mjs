#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateArtifactData, verifyRepositoryEvidence } from './native-touch-runtime-evidence-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const contract = json('scripts/native-touch-runtime-contract.json');
const known = json('scripts/native-touch-runtime-known.json');
const source = json('docs/prototypes/native-touch-android-1x.json');
const expected = {
  name: 'fixture', platform: 'android', fontScale: 1,
  scriptSha256: source.manifest.scriptSha256,
  contractSha256: source.manifest.contractSha256,
};

test('저장소의 양 플랫폼·두 배율 exact 증거는 원시 frame 재계산과 현재 제품 범위에 결속된다', () => {
  assert.deepEqual(verifyRepositoryEvidence(root).failures, []);
});

test('저장 요약만 0으로 고쳐도 원시 frame 재계산이 잡는다', () => {
  const broken = structuredClone(source);
  broken.scenarios[0].phases[0].rows[0].effectiveHeight = 20;
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /원시 frame 재계산/);
});

test('저장 effectiveWidth만 통과값으로 조작해도 원시 frame 재계산이 잡는다', () => {
  const broken = structuredClone(source);
  broken.scenarios[0].phases[0].rows[0].effectiveWidth = 20;
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /저장 effectiveWidth/);
});

test('저장 overlaps를 비워도 원시 frame 재계산이 잡는다', () => {
  const broken = structuredClone(source);
  const phase = broken.scenarios[0].phases[0];
  const right = structuredClone(phase.rows[0]);
  right.key = `${right.key}-overlap`;
  right.nativeTag += 999999;
  phase.rows.push(right);
  phase.overlaps = [];
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /저장 overlaps/);
});

test('진단 산출물을 exact 증거로 받지 않는다', () => {
  const broken = structuredClone(source);
  broken.manifest.evidenceStatus = 'DIAGNOSTIC_DIRTY_NOT_EVIDENCE';
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /exact commit/);
});

test('감사기나 계약 SHA가 달라지면 낡은 증거다', () => {
  const broken = structuredClone(source);
  broken.manifest.scriptSha256 = '0'.repeat(64);
  broken.manifest.contractSha256 = '1'.repeat(64);
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /감사기 SHA 불일치/);
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /계약 SHA 불일치/);
});

test('iOS는 model·OS를 요구하지만 Android 전용 API level을 요구하지 않는다', () => {
  const ios = structuredClone(source);
  ios.platform = 'ios'; ios.fontScale = 1;
  ios.device = { ...ios.device, id: '00008110-example', model: 'iPhone', osVersion: '18.6', apiLevel: null };
  const failures = validateArtifactData(ios, contract, known, { ...expected, platform: 'ios' });
  assert.doesNotMatch(failures.join('\n'), /API 식별/);
});
