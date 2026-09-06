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

test('저장소의 두 exact 증거는 원시 frame 재계산과 현재 제품 범위에 결속된다', () => {
  assert.deepEqual(verifyRepositoryEvidence(root).failures, []);
});

test('저장 요약만 0으로 고쳐도 원시 frame 재계산이 잡는다', () => {
  const broken = structuredClone(source);
  broken.scenarios[0].phases[0].rows[0].effectiveHeight = 20;
  assert.match(validateArtifactData(broken, contract, known, expected).join('\n'), /원시 frame 재계산/);
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
