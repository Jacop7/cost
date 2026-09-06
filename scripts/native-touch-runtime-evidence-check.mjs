#!/usr/bin/env node
/** 커밋에 보존된 Android·iOS 네이티브 터치 증거를 원시 frame부터 다시 판정한다. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  compareNativeRatchet,
  evaluateNativeArtifact,
  nativeRatchetSnapshot,
  recomputeNativeArtifactDerived,
} from './native-touch-runtime-audit.mjs';

const here = fileURLToPath(import.meta.url);
const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function validateArtifactData(artifact, contract, known, expected) {
  const failures = [];
  let rebuilt;
  try {
    rebuilt = recomputeNativeArtifactDerived(artifact);
  } catch (error) {
    failures.push(`${expected.name}: 원시 frame 재계산 실패 — ${error.message}`);
    return failures;
  }
  for (let scenarioIndex = 0; scenarioIndex < rebuilt.scenarios.length; scenarioIndex++) {
    const rebuiltScenario = rebuilt.scenarios[scenarioIndex];
    const storedScenario = artifact.scenarios[scenarioIndex];
    for (let phaseIndex = 0; phaseIndex < rebuiltScenario.phases.length; phaseIndex++) {
      const rebuiltPhase = rebuiltScenario.phases[phaseIndex];
      const storedPhase = storedScenario.phases[phaseIndex];
      for (let rowIndex = 0; rowIndex < rebuiltPhase.rows.length; rowIndex++) {
        const rebuiltRow = rebuiltPhase.rows[rowIndex];
        const storedRow = storedPhase.rows[rowIndex];
        for (const key of ['relativeFrame', 'windowFrame', 'parentFrame', 'ancestorFrames', 'touchRect',
          'effectiveRect', 'effectiveWidth', 'effectiveHeight', 'clippedByParent', 'visualRect', 'visualWidth',
          'visualHeight', 'visualFullyVisible', 'visibilityDisposition', 'clippingAncestors', 'pass44']) {
          if (!same(storedRow[key], rebuiltRow[key]))
            failures.push(`${expected.name}: ${rebuiltScenario.id}/${rebuiltPhase.id}/${rowIndex} 저장 ${key}가 원시 frame 재계산과 다르다`);
        }
      }
      if (!same(storedPhase.overlaps, rebuiltPhase.overlaps))
        failures.push(`${expected.name}: ${rebuiltScenario.id}/${rebuiltPhase.id} 저장 overlaps가 원시 frame 재계산과 다르다`);
      if (!same(storedPhase.excludedPartiallyVisible, rebuiltPhase.excludedPartiallyVisible))
        failures.push(`${expected.name}: ${rebuiltScenario.id}/${rebuiltPhase.id} 저장 excludedPartiallyVisible이 원시 frame 재계산과 다르다`);
    }
  }
  const recomputed = evaluateNativeArtifact(rebuilt, contract);
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
  if (artifact.manifest?.measurementScope !== 'scenario-active-owner-pattern')
    failures.push(`${expected.name}: 시나리오 활성 owner 범위 기록이 없다`);
  if (!Array.isArray(artifact.manifest?.excludedOwnerChains))
    failures.push(`${expected.name}: 제외 owner 목록이 기록되지 않았다`);
  if (!artifact.device?.id || artifact.device.id === 'unknown' || !artifact.device?.model
    || !artifact.device?.osVersion || artifact.device.osVersion === 'unknown')
    failures.push(`${expected.name}: 기기 ID/model/OS 식별이 완전하지 않다`);
  if (artifact.platform === 'android' && artifact.device?.apiLevel == null)
    failures.push(`${expected.name}: Android API 식별이 완전하지 않다`);
  if (stored.failures?.length) failures.push(`${expected.name}: 저장된 실패 ${stored.failures.length}건`);
  return failures;
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function verifyRepositoryEvidence(root = defaultRoot, options = {}) {
  const contractPath = join(root, 'scripts/native-touch-runtime-contract.json');
  const auditPath = join(root, 'scripts/native-touch-runtime-audit.mjs');
  const known = JSON.parse(normalized(join(root, 'scripts/native-touch-runtime-known.json')));
  const contract = JSON.parse(normalized(contractPath));
  const expected = {
    scriptSha256: sha256(normalized(auditPath)),
    contractSha256: sha256(normalized(contractPath)),
  };
  const failures = [];
  const matrix = contract.evidenceMatrix ?? (contract.platforms ?? [contract.platform]).flatMap((platform) =>
    contract.fontScales.map((fontScale) => ({ platform, fontScale, file: `native-touch-${platform}-${fontScale}x.json` })));
  const requiredPlatforms = options.requirePlatforms ?? contract.closedPlatforms ?? contract.platforms ?? [contract.platform];
  const requiredMatrix = matrix.filter(({ platform }) => requiredPlatforms.includes(platform));
  const artifacts = requiredMatrix.flatMap(({ platform, fontScale, file: name }) => {
    const path = join(root, 'docs/prototypes', name);
    if (!existsSync(path)) {
      failures.push(`MISSING ${name} — ${platform}@${fontScale} exact 증거가 없다`);
      return [];
    }
    const artifact = JSON.parse(normalized(path));
    failures.push(...validateArtifactData(artifact, contract, known, { ...expected, name, platform, fontScale }));
    return [artifact];
  });
  const commits = [...new Set(artifacts.map((item) => item.manifest?.productCommit))];
  if (artifacts.length !== requiredMatrix.length) failures.push(`요구 증거 ${requiredMatrix.length}칸 중 ${artifacts.length}칸만 존재한다`);
  if (commits.length !== 1 || !/^[0-9a-f]{40}$/.test(commits[0] ?? '')) failures.push('요구 플랫폼·배율이 하나의 완전한 productCommit에 결속되지 않았다');
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
  return { artifacts, failures, requiredMatrix };
}

export function buildEvidenceReceipt(root, verification, requirePlatforms) {
  const checkerPath = join(root, 'scripts/native-touch-runtime-evidence-check.mjs');
  const contractPath = join(root, 'scripts/native-touch-runtime-contract.json');
  const auditPath = join(root, 'scripts/native-touch-runtime-audit.mjs');
  const knownPath = join(root, 'scripts/native-touch-runtime-known.json');
  const cells = verification.requiredMatrix.map(({ platform, fontScale, file }) => {
    const path = join(root, 'docs/prototypes', file);
    if (!existsSync(path)) return { platform, fontScale, file, status: 'MISSING' };
    const artifact = JSON.parse(normalized(path));
    return {
      platform,
      fontScale,
      file,
      status: 'PRESENT',
      textSha256: sha256(normalized(path)),
      productCommit: artifact.manifest?.productCommit ?? null,
      productTree: artifact.manifest?.productTree ?? null,
      device: artifact.device ?? null,
      targetCount: artifact.evaluation?.lineage?.length ?? null,
      observedUnjudgedCount: artifact.evaluation?.observedUnjudged?.length ?? null,
      materialOverlapCount: artifact.evaluation?.materialOverlaps?.length ?? null,
      failureCount: artifact.evaluation?.failures?.length ?? null,
    };
  });
  return {
    schemaVersion: 1,
    status: verification.failures.length ? 'FAIL' : 'PASS',
    requirePlatforms,
    contracts: {
      checker: { path: 'scripts/native-touch-runtime-evidence-check.mjs', textSha256: sha256(normalized(checkerPath)) },
      audit: { path: 'scripts/native-touch-runtime-audit.mjs', textSha256: sha256(normalized(auditPath)) },
      contract: { path: 'scripts/native-touch-runtime-contract.json', textSha256: sha256(normalized(contractPath)) },
      known: { path: 'scripts/native-touch-runtime-known.json', textSha256: sha256(normalized(knownPath)) },
    },
    cells,
    failures: verification.failures,
  };
}

if (resolve(process.argv[1] ?? '') === resolve(here)) {
  try {
    const requireArg = process.argv.slice(2).find((arg) => arg.startsWith('--require='))?.slice('--require='.length);
    const requirePlatforms = requireArg === 'all' ? ['android', 'ios']
      : requireArg ? requireArg.split(',').map((item) => item.trim()).filter(Boolean) : undefined;
    const outputArg = process.argv.slice(2).find((arg) => arg.startsWith('--output='))?.slice('--output='.length);
    const verification = verifyRepositoryEvidence(defaultRoot, { requirePlatforms });
    const { artifacts, failures } = verification;
    if (outputArg) {
      const resolvedPlatforms = requirePlatforms ?? [...new Set(verification.requiredMatrix.map((item) => item.platform))];
      writeFileSync(resolve(outputArg), `${JSON.stringify(buildEvidenceReceipt(defaultRoot, verification, resolvedPlatforms), null, 2)}\n`);
    }
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
