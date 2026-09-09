#!/usr/bin/env node
// Scoped succession preflight only. Does not replace P0, verify, or release approval.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { classifyIngredientScope } from './ingredient-p3-scope.mjs';
import { scopedPathspec } from './native-product-evidence-scope.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const APPROVED = '087571504c65f074a3e6d9da4ff7ee2c26459e2a';
const BASELINE = 'c0b0b85e94c68487c10e6ff809f376f77bb23b90';
const BASELINE_BLOB = 'f16a22c689ba7dd7eb8410ada1cab914b29869cd';
const baselinePath = 'docs/prototypes/three-surface-baseline.json';
const run = args => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  if (result.status !== 0) throw new Error(`Git read failed: ${args[0]}: ${result.stderr.trim()}`);
  return result.stdout;
};
const paths = args => run(args).split('\0').filter(Boolean);
const tree = commit => Object.fromEntries(paths(['ls-tree', '-rz', commit]).map(line => {
  const match = line.match(/^\d+ blob ([0-9a-f]{40})\t([\s\S]+)$/);
  return match ? [match[2], match[1]] : null;
}).filter(Boolean));

try {
  const decision = JSON.parse(readFileSync(resolve(root, 'docs/prototypes/ingredient-p3-scope-decision.json'), 'utf8'));
  if (decision.schemaVersion !== 1 || decision.decisionId !== 'INGREDIENT-P3-20260910'
    || decision.approvedCommit !== APPROVED || decision.baselineCommit !== BASELINE
    || decision.baselineBlob !== BASELINE_BLOB || decision.authority !== 'USER_EXPLICIT_SCOPED_APPROVAL'
    || decision.scope !== 'ingredient-44-audit-items'
    || decision.approvalStatement !== '식재료 범위의 기준 승계 승인'
    || decision.permission !== 'P0_TO_P3_CHANGE_AND_REVERIFY_ONLY'
    || decision.mainMerge !== false || decision.productionDeployment !== false
    || decision.preserveExistingFailures !== true || decision.preserveRequiredTests !== true)
    throw new Error('Scoped human decision contract mismatch');
  const approvedTree = tree(APPROVED);
  const currentTree = tree('HEAD');
  if (approvedTree[baselinePath] !== BASELINE_BLOB) throw new Error('Original baseline blob mismatch');
  for (const path of [baselinePath, 'scripts/three-surface-p0-check.mjs', 'scripts/verify.mjs']) {
    const expectedBlob = approvedTree[path];
    if (!expectedBlob || currentTree[path] !== expectedBlob
      || run(['rev-parse', `:${path}`]).trim() !== expectedBlob
      || run(['hash-object', '--path', path, path]).trim() !== expectedBlob)
      throw new Error(`Original P0 baseline/gate/wiring changed in HEAD, index or worktree: ${path}`);
  }
  const baseline = JSON.parse(run(['show', `${APPROVED}:${baselinePath}`]));
  if (baseline.baselineCommit !== BASELINE) throw new Error('Baseline commit mismatch');
  const pathspec = scopedPathspec(baseline.scope.productRoots);
  const approvedChanged = new Set(paths(['diff', '--name-only', '-z', BASELINE, APPROVED, '--', ...pathspec]));
  if (!Array.isArray(decision.entries) || decision.entries.length === 0
    || decision.entries.some(entry => approvedTree[entry.path] !== entry.blob || !approvedChanged.has(entry.path)))
    throw new Error('Approved entries must bind to changed blobs at the exact approved commit');
  const dirty = [...new Set([
    ...paths(['diff', '--name-only', '-z', '--', ...pathspec]),
    ...paths(['diff', '--cached', '--name-only', '-z', '--', ...pathspec]),
    ...paths(['ls-files', '--others', '--exclude-standard', '-z', '--', ...pathspec]),
  ])];
  const changed = [...new Set([...paths(['diff', '--name-only', '-z', BASELINE, 'HEAD', '--', ...pathspec]), ...dirty])];
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', APPROVED, 'HEAD'], { cwd: root }).status === 0;
  const result = classifyIngredientScope({ changedPaths: changed, approvedEntries: decision.entries,
    currentBlobs: currentTree, approvedCommitIsAncestor: ancestor, dirtyPaths: dirty });
  console.log(JSON.stringify({ kind: 'SCOPED_SUCCESSION_PREFLIGHT_NOT_RELEASE_APPROVAL',
    approvedCommit: APPROVED, allowedCount: result.allowed.length, blockedCount: result.blocked.length,
    ...result, originalP0GatePreserved: true, requiredVerificationComplete: false }, null, 2));
  process.exitCode = result.errors.length || result.blocked.length ? 1 : 0;
} catch (error) {
  console.error(`INGREDIENT_P3_SCOPE_FAIL: ${error.message}`);
  process.exitCode = 1;
}
