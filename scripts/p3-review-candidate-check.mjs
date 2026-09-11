#!/usr/bin/env node
// Read-only candidate validation. Never replaces a product or release gate.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateCandidateContract, validateManifestBytes, validateHeadCoverage, validateGateCoverage, selectedGatePaths, candidateDiffArgs } from './p3-review-candidate-contract.mjs';
import { scopedPathspec, dirtyProductScope } from './native-product-evidence-scope.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32_000_000 });
const decisionPath = 'docs/ai-review/evidence/P3-RANGE-EXPANSION-DECISION-V2-CANDIDATE-20260911.json';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const equalSet = (a, b) => a.length === b.length && new Set(a).size === a.length && a.every(x => b.includes(x));
const canonical = path => {
  const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
  check(!bytes.includes(13) && bytes.at(-1) === 10 && !bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])), `Non-LF/BOM/missing final newline: ${path}`);
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
};

try {
  const { value: decision } = canonical(decisionPath);
  const { bytes, value: manifest } = canonical(decision.candidateScopeManifest.path);
  failures.push(...validateManifestBytes(bytes, decision.candidateScopeManifest));
  check(decision.mainMerge === false && decision.productionDeployment === false, 'Release permission must remain false');
  check(manifest.targetCommit === decision.targetProductCommit && manifest.baselineCommit === decision.baselineCommit, 'Target/baseline mismatch');
  const ids = decision.reviewBatches.map(b => b.id);
  check(equalSet(ids, manifest.batchIds) && equalSet(ids, decision.candidateScopeManifest.batchIds), 'Batch identifiers differ');
  const entries = manifest.entries;
  check(new Set(entries.map(e => e.path)).size === entries.length, 'Duplicate entries');
  const tree = new Map(git('ls-tree', '-rz', manifest.targetCommit).toString('utf8').split('\0').filter(Boolean).map(line => {
    const match = line.match(/^\d+ blob ([0-9a-f]{40})\t([\s\S]+)$/);
    return match ? [match[2], match[1]] : [null, null];
  }));
  for (const e of entries) {
    check(tree.get(e.path) === e.targetBlob, `Target blob differs: ${e.path}`);
    check(ids.includes(e.batch), `Unknown batch: ${e.path}`);
  }
  const changed = git(...candidateDiffArgs(manifest.baselineCommit, manifest.targetCommit)).toString('utf8').split('\0').filter(Boolean);
  failures.push(...validateCandidateContract(decision, manifest, changed));
  const headCommit = git('rev-parse', 'HEAD').toString().trim();
  const changedProductPaths = git(...candidateDiffArgs(manifest.targetCommit, headCommit),
    '--', ...scopedPathspec(manifest.productScopeRoots)).toString('utf8').split('\0').filter(Boolean);
  let targetIsAncestor = false;
  try { git('merge-base', '--is-ancestor', manifest.targetCommit, headCommit); targetIsAncestor = true; }
  catch { /* Missing/nonancestor targets never authorize coverage. */ }
  const coverageFailures = validateHeadCoverage({ changedProductPaths,
    dirtyProduct: dirtyProductScope(root, manifest.productScopeRoots), targetIsAncestor });
  const pathList = args => git(...args).toString('utf8').split('\0').filter(Boolean);
  const gateSubset = paths => [...new Set([
    ...selectedGatePaths(paths), ...paths.filter(p => manifest.gateAndCiScopePaths.includes(p)),
  ])];
  const changedGatePaths = gateSubset(pathList(candidateDiffArgs(manifest.targetCommit, headCommit)));
  const dirtyGatePaths = gateSubset([...new Set([
    ...pathList(candidateDiffArgs()),
    ...pathList(candidateDiffArgs('--cached')),
    ...pathList(['ls-files', '--others', '--exclude-standard', '-z']),
  ])]);
  const gateCoverageFailures = validateGateCoverage({ changedGatePaths, dirtyGatePaths });
  coverageFailures.push(...gateCoverageFailures);
  failures.push(...coverageFailures);
  const product = changed.filter(p => manifest.productScopeRoots.some(r => p === r || p.startsWith(`${r.replace(/\/$/, '')}/`)));
  check(equalSet(product, entries.filter(e => e.layer !== 'gate-and-ci').map(e => e.path)), 'Product scope differs from git delta');
  const gate = entries.filter(e => e.layer === 'gate-and-ci');
  check(equalSet(gate.map(e => e.path), manifest.gateAndCiScopePaths), 'Gate scope list differs');
  check(entries.length === manifest.changedFileCount && product.length === manifest.productChangedFileCount && gate.length === manifest.gateAndCiChangedFileCount, 'Manifest counts differ');
  for (const name of ['changedFileCount', 'productChangedFileCount', 'gateAndCiChangedFileCount']) check(manifest[name] === decision.candidateScopeManifest[name], `Decision count differs: ${name}`);
  const acceptancePath = new URL(`../${decision.humanAcceptanceRequired.acceptanceRecord.path}`, import.meta.url);
  const acceptancePresent = existsSync(acceptancePath);
  // A present acceptance record still needs separate authority and exact-commit validation.
  console.log(JSON.stringify({ kind: 'READ_ONLY_CANDIDATE_CHECK_NOT_RELEASE_APPROVAL', candidateValid: failures.length === 0,
    targetCommit: manifest.targetCommit, headCommit, candidateCoversHead: coverageFailures.length === 0,
    changedProductPaths, changedGatePaths, dirtyGatePaths, entries: entries.length, acceptancePresent, baselineWriteAuthorized: false, releaseApproved: false, failures }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} catch (error) {
  console.error(`P3_CANDIDATE_CHECK_FAIL: ${error.message}`);
  process.exitCode = 1;
}
