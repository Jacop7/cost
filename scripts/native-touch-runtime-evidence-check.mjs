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
  fontScaleMatches,
  nativeRatchetSnapshot,
  recomputeNativeArtifactDerived,
} from './native-touch-runtime-audit.mjs';

const here = fileURLToPath(import.meta.url);
const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const TAP_PROBE_IDS = ['inside-effective-rect', 'outside-direct-parent', 'outside-overflow-visible-grandparent'];
const tapProbeExpectation = (platform, id) => {
  if (!TAP_PROBE_IDS.includes(id)) return null;
  if (id === 'outside-direct-parent') return 'blocked';
  return 'fires';
};

export function nativeCoverage(artifact) {
  const rows = (artifact.scenarios ?? []).flatMap((scenario) =>
    (scenario.phases ?? []).flatMap((phase) => phase.rows ?? []));
  const fullyVisibleRows = rows.filter((row) => row.visibilityDisposition === 'fullyVisible').length;
  const excludedScrollableOrRootRows = rows.filter((row) => row.visibilityDisposition === 'excludedScrollableOrRoot').length;
  const targetShortCount = (artifact.evaluation?.lineage ?? []).reduce((sum, item) => sum + (item.short ?? 0), 0);
  return { observedRows: rows.length, fullyVisibleRows, excludedScrollableOrRootRows, targetShortCount };
}

export function scaledLayoutWitness(one, two) {
  const grouped = (artifact) => {
    const result = new Map();
    for (const scenario of artifact.scenarios ?? []) for (const phase of scenario.phases ?? [])
      for (const row of phase.rows ?? []) {
        const key = JSON.stringify([scenario.id, phase.id, row.ownerChain ?? [], row.label ?? null]);
        if (!result.has(key)) result.set(key, []);
        result.get(key).push(row);
      }
    for (const rows of result.values()) rows.sort((a, b) => a.windowMeasure[1] - b.windowMeasure[1]
      || a.windowMeasure[0] - b.windowMeasure[0]);
    return result;
  };
  const left = grouped(one), right = grouped(two);
  let paired = 0, dimensionChanged = 0;
  for (const [key, rows] of left) {
    const peers = right.get(key) ?? [];
    for (let index = 0; index < Math.min(rows.length, peers.length); index++) {
      paired++;
      if (Math.abs(rows[index].windowMeasure[2] - peers[index].windowMeasure[2]) > 0.5
        || Math.abs(rows[index].windowMeasure[3] - peers[index].windowMeasure[3]) > 0.5) dimensionChanged++;
    }
  }
  return { paired, dimensionChanged };
}

export function validateTapProbeData(probe, expected) {
  const failures = [];
  if (probe.platform !== expected.platform) failures.push(`${expected.name}: platform이 ${expected.platform}이 아니다`);
  if (probe.manifest?.evidenceStatus !== 'EXACT_COMMIT_EVIDENCE') failures.push(`${expected.name}: exact commit 증거가 아니다`);
  for (const id of TAP_PROBE_IDS) {
    const disposition = tapProbeExpectation(expected.platform, id);
    const item = probe.empiricalTapProbe?.find((candidate) => candidate.id === id);
    if (!item) failures.push(`${expected.name}: empiricalTapProbe ${id} 누락`);
    else if (disposition === 'blocked' ? item.onPressCount !== 0 : item.onPressCount < 1)
      failures.push(`${expected.name}: ${id} onPress ${item.onPressCount} 은 ${disposition === 'blocked' ? '= 0' : '>= 1'}을 만족하지 않는다`);
  }
  if ((probe.empiricalTapProbe?.length ?? 0) !== TAP_PROBE_IDS.length)
    failures.push(`${expected.name}: empiricalTapProbe는 정확히 ${TAP_PROBE_IDS.length}건이어야 한다`);
  return failures;
}

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
  const ratchetKey = `${artifact.platform}@${expected.evidenceScale}`;
  if (!same(stored.ratchet?.snapshot, snapshot)) failures.push(`${expected.name}: 저장 ratchet snapshot이 재계산과 다르다`);
  failures.push(...compareNativeRatchet(snapshot, known.baselines?.[ratchetKey]).map((item) => `${expected.name}: ${item}`));
  if (artifact.manifest?.evidenceStatus !== 'EXACT_COMMIT_EVIDENCE') failures.push(`${expected.name}: exact commit 증거가 아니다`);
  if (artifact.platform !== expected.platform
    || artifact.manifest?.evidenceScale !== expected.evidenceScale
    || !fontScaleMatches(contract, expected.platform, expected.evidenceScale, artifact.fontScale))
    failures.push(`${expected.name}: ${expected.platform}@${expected.evidenceScale} 증거 셀에 맞지 않는 실제 fontScale ${artifact.fontScale}`);
  if (artifact.manifest?.derivation?.auditSha256 !== expected.scriptSha256)
    failures.push(`${expected.name}: 현재 파생 감사기 SHA 불일치`);
  if (artifact.manifest?.derivation?.contractSha256 !== expected.contractSha256)
    failures.push(`${expected.name}: 현재 파생 계약 SHA 불일치`);
  if (artifact.manifest?.derivation?.semantics !== 'direct-parent-touch-clipping-v3')
    failures.push(`${expected.name}: 플랫폼별 터치 파생 계약 기록이 없다`);
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

function gitNormalizedText(root, commit, path) {
  const result = spawnSync('git', ['show', `${commit}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git show ${commit}:${path} 실패: ${result.stderr.trim()}`);
  return result.stdout.replace(/\r\n/g, '\n');
}

function provenanceFailures(root, item, name, entries) {
  const failures = [];
  const commit = item.manifest?.productCommit;
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) return [`${name}: 완전한 productCommit이 없다`];
  for (const [manifestKey, path] of entries) {
    let historical;
    try { historical = sha256(gitNormalizedText(root, commit, path)); }
    catch (error) { failures.push(`${name}: ${error.message}`); continue; }
    if (item.manifest?.[manifestKey] !== historical)
      failures.push(`${name}: ${manifestKey}가 productCommit의 ${path}와 다르다`);
  }
  return failures;
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
  const matrix = (contract.evidenceMatrix ?? (contract.platforms ?? [contract.platform]).flatMap((platform) =>
    contract.fontScales.map((evidenceScale) => ({ platform, evidenceScale, file: `native-touch-${platform}-${evidenceScale}x.json` }))))
    .map((entry) => ({ ...entry, evidenceScale: entry.evidenceScale ?? entry.fontScale }));
  const requiredPlatforms = options.requirePlatforms ?? contract.closedPlatforms ?? contract.platforms ?? [contract.platform];
  const requiredMatrix = matrix.filter(({ platform }) => requiredPlatforms.includes(platform));
  const artifacts = requiredMatrix.flatMap(({ platform, evidenceScale, file: name }) => {
    const path = join(root, 'docs/prototypes', name);
    if (!existsSync(path)) {
      failures.push(`MISSING ${name} — ${platform}@${evidenceScale} 접근성 셀 증거가 없다`);
      return [];
    }
    const artifact = JSON.parse(normalized(path));
    failures.push(...validateArtifactData(artifact, contract, known, { ...expected, name, platform, evidenceScale }));
    failures.push(...provenanceFailures(root, artifact, name, [
      ['scriptSha256', 'scripts/native-touch-runtime-audit.mjs'],
      ['contractSha256', 'scripts/native-touch-runtime-contract.json'],
    ]));
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
    const scope = ['apps/mobile'];
    const changed = spawnSync('git', ['diff', '--quiet', productCommit, 'HEAD', '--', ...scope], { cwd: root });
    if (changed.status !== 0) failures.push('productCommit 뒤 앱이 바뀌어 증거가 낡았다');
  }
  for (const platform of contract.requireScaledLayoutWitness ?? []) {
    if (!requiredPlatforms.includes(platform)) continue;
    const one = artifacts.find((item) => item.platform === platform && item.manifest?.evidenceScale === 1);
    const two = artifacts.find((item) => item.platform === platform && item.manifest?.evidenceScale === 2);
    if (one && two) {
      const witness = scaledLayoutWitness(one, two);
      if (witness.paired < 1 || witness.dimensionChanged < 1)
        failures.push(`${platform}@2: 실제 접근성 확대에서 크기가 달라진 동일 제품 frame이 없다 (${witness.dimensionChanged}/${witness.paired})`);
    }
  }
  const tapProbes = requiredPlatforms.flatMap((platform) => {
    const name = `native-touch-${platform}-tap-probe.json`;
    const path = join(root, 'docs/prototypes', name);
    if (!existsSync(path)) { failures.push(`MISSING ${name} — ${platform} 실제 탭 3점 증거가 없다`); return []; }
    const probe = JSON.parse(normalized(path));
    failures.push(...validateTapProbeData(probe, { name, platform }));
    failures.push(...provenanceFailures(root, probe, name, [
      ['scriptSha256', 'scripts/native-touch-runtime-tap-probe.mjs'],
      ['auditSha256', 'scripts/native-touch-runtime-audit.mjs'],
      ['contractSha256', 'scripts/native-touch-runtime-contract.json'],
    ]));
    const commit = probe.manifest?.productCommit;
    if (!/^[0-9a-f]{40}$/.test(commit ?? '')) failures.push(`${name}: 완전한 productCommit이 없다`);
    else {
      const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: root });
      if (ancestor.status !== 0) failures.push(`${name}: productCommit ${commit}은 HEAD의 조상이 아니다`);
      else if (probe.manifest?.productTree !== git(root, ['rev-parse', `${commit}^{tree}`])) failures.push(`${name}: productTree 불일치`);
      const changed = spawnSync('git', ['diff', '--quiet', commit, 'HEAD', '--', 'apps/mobile'], { cwd: root });
      if (changed.status !== 0) failures.push(`${name}: productCommit 뒤 앱이 바뀌어 실제 탭 증거가 낡았다`);
    }
    return [probe];
  });
  return { artifacts, tapProbes, failures, requiredMatrix };
}

export function buildEvidenceReceipt(root, verification, requirePlatforms) {
  const checkerPath = join(root, 'scripts/native-touch-runtime-evidence-check.mjs');
  const contractPath = join(root, 'scripts/native-touch-runtime-contract.json');
  const auditPath = join(root, 'scripts/native-touch-runtime-audit.mjs');
  const knownPath = join(root, 'scripts/native-touch-runtime-known.json');
  const cells = verification.requiredMatrix.map(({ platform, evidenceScale, file }) => {
    const path = join(root, 'docs/prototypes', file);
    if (!existsSync(path)) return { platform, evidenceScale, file, status: 'MISSING' };
    const artifact = JSON.parse(normalized(path));
    return {
      platform,
      evidenceScale,
      actualFontScale: artifact.fontScale,
      file,
      status: 'PRESENT',
      textSha256: sha256(normalized(path)),
      productCommit: artifact.manifest?.productCommit ?? null,
      productTree: artifact.manifest?.productTree ?? null,
      device: artifact.device ?? null,
      targetCount: artifact.evaluation?.lineage?.length ?? null,
      coverage: nativeCoverage(artifact),
      observedUnjudgedCount: artifact.evaluation?.observedUnjudged?.length ?? null,
      materialOverlapCount: artifact.evaluation?.materialOverlaps?.length ?? null,
      failureCount: artifact.evaluation?.failures?.length ?? null,
    };
  });
  const tapProbeCells = requirePlatforms.map((platform) => {
    const file = `native-touch-${platform}-tap-probe.json`;
    const path = join(root, 'docs/prototypes', file);
    if (!existsSync(path)) return { platform, file, status: 'MISSING' };
    const probe = JSON.parse(normalized(path));
    return { platform, file, status: 'PRESENT', textSha256: sha256(normalized(path)),
      productCommit: probe.manifest?.productCommit ?? null, productTree: probe.manifest?.productTree ?? null,
      recordedResult: probe.status ?? null,
      currentContractResult: validateTapProbeData(probe, { name: file, platform }).length ? 'FAIL' : 'PASS',
      legacyEvaluationSuperseded: probe.status !== (validateTapProbeData(probe, { name: file, platform }).length ? 'FAIL' : 'PASS'),
      probeCount: probe.empiricalTapProbe?.length ?? null };
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
    tapProbeCells,
    failures: verification.failures,
  };
}

export function receiptHashFailures(root, receipt, resolveCellPath) {
  const failures = [];
  for (const item of Object.values(receipt.contracts ?? {})) {
    const path = join(root, item.path);
    if (!existsSync(path)) failures.push(`MISSING ${item.path} — 영수증 계약 파일이 없다`);
    else if (sha256(normalized(path)) !== item.textSha256) failures.push(`영수증 계약 해시 불일치: ${item.path}`);
  }
  for (const cell of receipt.cells ?? []) {
    if (cell.status !== 'PRESENT') continue;
    const path = resolveCellPath?.(cell) ?? join(root, 'docs/prototypes', cell.file);
    if (!existsSync(path)) failures.push(`MISSING ${cell.file} — 영수증 원시 증거가 없다`);
    else if (sha256(normalized(path)) !== cell.textSha256) failures.push(`영수증 원시 증거 해시 불일치: ${cell.file}`);
  }
  for (const cell of receipt.tapProbeCells ?? []) {
    if (cell.status !== 'PRESENT') continue;
    const path = resolveCellPath?.(cell) ?? join(root, 'docs/prototypes', cell.file);
    if (!existsSync(path)) failures.push(`MISSING ${cell.file} — 영수증 실제 탭 증거가 없다`);
    else if (sha256(normalized(path)) !== cell.textSha256) failures.push(`영수증 실제 탭 증거 해시 불일치: ${cell.file}`);
  }
  return failures;
}

export function verifyEvidenceReceipt(root = defaultRoot, receiptPath = join(root, 'docs/prototypes/native-touch-android-receipt.json')) {
  const failures = [];
  if (!existsSync(receiptPath)) return { receipt: null, expected: null, failures: [`MISSING ${receiptPath} — 네이티브 터치 영수증이 없다`] };
  const receipt = JSON.parse(normalized(receiptPath));
  const contract = JSON.parse(normalized(join(root, 'scripts/native-touch-runtime-contract.json')));
  failures.push(...receiptHashFailures(root, receipt));
  if (!same(receipt.requirePlatforms, contract.closedPlatforms))
    failures.push(`영수증 requirePlatforms ${JSON.stringify(receipt.requirePlatforms)}가 계약 closedPlatforms ${JSON.stringify(contract.closedPlatforms)}와 다르다`);
  const verification = verifyRepositoryEvidence(root, { requirePlatforms: receipt.requirePlatforms });
  const expected = buildEvidenceReceipt(root, verification, receipt.requirePlatforms);
  if (!same(receipt, expected)) failures.push('커밋된 네이티브 터치 영수증이 현재 원시 증거·계약·검사기의 재계산 결과와 다르다');
  failures.push(...verification.failures);
  return { receipt, expected, failures: [...new Set(failures)] };
}

if (resolve(process.argv[1] ?? '') === resolve(here)) {
  try {
    const requireArg = process.argv.slice(2).find((arg) => arg.startsWith('--require='))?.slice('--require='.length);
    const requirePlatforms = requireArg === 'all' ? ['android', 'ios']
      : requireArg ? requireArg.split(',').map((item) => item.trim()).filter(Boolean) : undefined;
    const outputArg = process.argv.slice(2).find((arg) => arg.startsWith('--output='))?.slice('--output='.length);
    const verifyReceiptArg = process.argv.slice(2).find((arg) => arg === '--verify-receipt' || arg.startsWith('--verify-receipt='));
    if (verifyReceiptArg) {
      const configuredPath = verifyReceiptArg.includes('=') ? verifyReceiptArg.slice(verifyReceiptArg.indexOf('=') + 1) : '';
      const receiptPath = configuredPath ? resolve(configuredPath) : join(defaultRoot, 'docs/prototypes/native-touch-android-receipt.json');
      const receiptVerification = verifyEvidenceReceipt(defaultRoot, receiptPath);
      if (receiptVerification.failures.length) {
        console.error(receiptVerification.failures.map((item) => `  - ${item}`).join('\n'));
        process.exit(1);
      }
      console.log(`네이티브 터치 영수증 PASS — ${receiptPath}`);
      process.exit(0);
    }
    const verification = verifyRepositoryEvidence(defaultRoot, { requirePlatforms });
    const { artifacts, failures } = verification;
    if (outputArg) {
      const resolvedPlatforms = requirePlatforms ?? [...new Set(verification.requiredMatrix.map((item) => item.platform))];
      writeFileSync(resolve(outputArg), `${JSON.stringify(buildEvidenceReceipt(defaultRoot, verification, resolvedPlatforms), null, 2)}\n`);
    }
    for (const artifact of artifacts) {
      const coverage = nativeCoverage(artifact);
      console.log(`${artifact.platform}@${artifact.fontScale} — target ${artifact.evaluation.lineage.length} · 유효 미달 ${coverage.targetShortCount} · 계약 밖 미판정 미달 ${artifact.evaluation.observedUnjudged.length} · 중첩 ${artifact.evaluation.materialOverlaps.length} · 커버리지 ${coverage.fullyVisibleRows}/${coverage.observedRows} (스크롤·루트 제외 ${coverage.excludedScrollableOrRootRows})`);
    }
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
