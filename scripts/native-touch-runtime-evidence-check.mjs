#!/usr/bin/env node
/** 커밋에 보존된 Android 네이티브 터치 증거를 원시 frame부터 다시 판정한다. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  compareNativeRatchet,
  evaluateNativeArtifact,
  nativeRatchetSnapshot,
} from './native-touch-runtime-audit.mjs';

const here = fileURLToPath(import.meta.url);
const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function validateArtifactData(artifact, contract, known, expected) {
  const failures = [];
  const recomputed = evaluateNativeArtifact(artifact, contract);
  const stored = artifact.evaluation ?? {};
  for (const key of ['tolerance', 'lineage', 'observedUnjudged', 'materialOverlaps', 'failures']) {
    if (!same(stored[key], recomputed[key])) failures.push(`${expected.name}: 저장 판정 ${key}가 원시 frame 재계산과 다르다`);
  }
  const snapshot = nativeRatchetSnapshot(recomputed);
  const ratchetKey = `${artifact.platform}@${artifact.fontScale}`;
  if (!same(stored.ratchet?.snapshot, snapshot)) failures.push(`${expected.name}: 저장 ratchet snapshot이 재계산과 다르다`);
  failures.push(...compareNativeRatchet(snapshot, known.baselines?.[ratchetKey]).map((item) => `${expected.name}: ${item}`));
  if (artifact.manifest?.evidenceStatus !== 'EXACT_COMMIT_EVIDENCE') failures.push(`${expected.name}: exact commit 증거가 아니다`);
  if (artifact.platform !== expected.platform || artifact.fontScale !== expected.fontScale)
    failures.push(`${expected.name}: platform/fontScale이 ${expected.platform}@${expected.fontScale}가 아니다`);
  if (artifact.manifest?.scriptSha256 !== expected.scriptSha256) failures.push(`${expected.name}: 감사기 SHA 불일치`);
  if (artifact.manifest?.contractSha256 !== expected.contractSha256) failures.push(`${expected.name}: 계약 SHA 불일치`);
  if (stored.failures?.length) failures.push(`${expected.name}: 저장된 실패 ${stored.failures.length}건`);
  return failures;
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function verifyRepositoryEvidence(root = defaultRoot) {
  const contractPath = join(root, 'scripts/native-touch-runtime-contract.json');
  const auditPath = join(root, 'scripts/native-touch-runtime-audit.mjs');
  const known = JSON.parse(normalized(join(root, 'scripts/native-touch-runtime-known.json')));
  const contract = JSON.parse(normalized(contractPath));
  const expected = {
    platform: contract.platform,
    scriptSha256: sha256(normalized(auditPath)),
    contractSha256: sha256(normalized(contractPath)),
  };
  const failures = [];
  const artifacts = contract.fontScales.map((fontScale) => {
    const name = `native-touch-${contract.platform}-${fontScale}x.json`;
    const path = join(root, 'docs/prototypes', name);
    const artifact = JSON.parse(normalized(path));
    failures.push(...validateArtifactData(artifact, contract, known, { ...expected, name, fontScale }));
    return artifact;
  });
  const commits = [...new Set(artifacts.map((item) => item.manifest?.productCommit))];
  if (commits.length !== 1 || !/^[0-9a-f]{40}$/.test(commits[0] ?? '')) failures.push('두 배율이 하나의 완전한 productCommit에 결속되지 않았다');
  else {
    const productCommit = commits[0];
    const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', productCommit, 'HEAD'], { cwd: root });
    if (ancestor.status !== 0) failures.push(`productCommit ${productCommit}은 HEAD의 조상이 아니다`);
    const tree = git(root, ['rev-parse', `${productCommit}^{tree}`]);
    if (artifacts.some((item) => item.manifest?.productTree !== tree)) failures.push('저장 productTree가 productCommit tree와 다르다');
    const scope = ['apps/mobile', 'scripts/native-touch-runtime-audit.mjs', 'scripts/native-touch-runtime-contract.json', 'scripts/native-touch-runtime-known.json'];
    const changed = spawnSync('git', ['diff', '--quiet', productCommit, 'HEAD', '--', ...scope], { cwd: root });
    if (changed.status !== 0) failures.push('productCommit 뒤 앱 또는 네이티브 측정 계약이 바뀌어 증거가 낡았다');
  }
  return { artifacts, failures };
}

if (resolve(process.argv[1] ?? '') === resolve(here)) {
  try {
    const { artifacts, failures } = verifyRepositoryEvidence();
    for (const artifact of artifacts) console.log(`${artifact.platform}@${artifact.fontScale} — target ${artifact.evaluation.lineage.length} · 미달 ${artifact.evaluation.observedUnjudged.length} · 중첩 ${artifact.evaluation.materialOverlaps.length}`);
    if (failures.length) {
      console.error(failures.map((item) => `  - ${item}`).join('\n'));
      process.exit(1);
    }
    console.log('네이티브 터치 증거 PASS');
  } catch (error) {
    console.error(error.stack ?? String(error));
    process.exit(1);
  }
}
