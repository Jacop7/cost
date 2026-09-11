import { createHash } from 'node:crypto';

// A structurally valid historical manifest is not coverage of today's product.
export function validateHeadCoverage({ changedProductPaths, dirtyProduct, targetIsAncestor }) {
  const errors = [];
  if (targetIsAncestor !== true) errors.push('Manifest target is not an ancestor of HEAD');
  if (!Array.isArray(changedProductPaths) || changedProductPaths.length > 0)
    errors.push('Manifest target does not cover committed product changes at HEAD');
  if (typeof dirtyProduct !== 'string' || dirtyProduct.trim() !== '')
    errors.push('Product worktree/index contains changes outside the frozen manifest');
  return errors;
}

export function validateManifestBytes(bytes, reference) {
  const errors = [];
  if (bytes.includes(13) || bytes.at(-1) !== 10 || bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))) errors.push('Manifest must be LF, final newline, no BOM');
  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) errors.push('Manifest raw SHA mismatch');
  const oid = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (oid !== reference.blobOid) errors.push('Manifest blob mismatch');
  return errors;
}

const BATCH = Object.freeze({
  internationalTax: 'B4_SALES_MY_ORDERS_AND_INTERNATIONAL',
  recipes: 'B3_RECIPE_WRITE_AND_SALES_STATE',
  ingredientsAndInventory: 'B1_INGREDIENT_AND_INVENTORY',
  salesMyOrders: 'B4_SALES_MY_ORDERS_AND_INTERNATIONAL',
  sharedPlatform: 'B2_SHARED_KIT_AND_PLATFORM',
  gate: 'B5_P3_GATE_AND_RELEASE_READINESS',
});
const ROOTS = ['apps/mobile', 'packages/db', 'packages/core', 'packages/types'];
const CONFIG = ['.gitattributes', 'AGENTS.md', 'package.json', 'pnpm-lock.yaml'];
const CONTRACTS = ['approved-visual-changes', 'baseline', 'byte-artifacts', 'migration-backlog']
  .map(name => `docs/prototypes/three-surface-${name}.json`);
const PRECEDENCE = ['internationalTax', 'recipes', 'ingredientsAndInventory', 'salesMyOrders', 'sharedPlatform'];
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a.length === b.length && new Set(a).size === a.length && a.every(x => b.includes(x));

export function selectedGatePaths(changed) {
  const prototypes = changed.filter(p => /^docs\/prototypes\/full-page-flow-prototype-[^/]+\.test\.mjs$/.test(p));
  const modules = prototypes.map(p => p.replace(/\.test\.mjs$/, '.mjs'));
  return changed.filter(p => p.startsWith('scripts/') || p.startsWith('.github/')
    || CONFIG.includes(p) || CONTRACTS.includes(p) || prototypes.includes(p) || modules.includes(p));
}

export function validateCandidateContract(decision, manifest, changed) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const ids = [...new Set(Object.values(BATCH))];
  check(sameSet(decision.reviewBatches.map(b => b.id), ids), 'Unexpected decision batch IDs');
  check(sameSet(manifest.productScopeRoots, ROOTS), 'Product scope roots changed');
  check(manifest.gateAndCiSelection.mode === 'CONSERVATIVE_ALL_CHANGED_AUTOMATION', 'Unknown gate selection mode');
  check(sameSet(manifest.gateAndCiScopePaths, selectedGatePaths(changed)), 'Gate selection differs from independent git delta rule');
  check(JSON.stringify(manifest.testOwnershipRule.precedence) === JSON.stringify(PRECEDENCE), 'Test precedence changed');
  check(JSON.stringify(decision.candidateScopeManifest.hashContract) === JSON.stringify(manifest.hashContract), 'Hash contracts differ');
  check(manifest.hashContract.algorithm === 'sha256-raw-bytes-v1'
    && manifest.hashContract.canonicalLineEndings === 'LF' && manifest.hashContract.gitObject === 'blob', 'Unsupported hash contract');
  for (const e of manifest.entries) {
    if (e.layer === 'gate-and-ci') check(e.batch === BATCH.gate, `Gate assigned outside B5: ${e.path}`);
    if (!/^(apps\/mobile\/tests|packages\/core\/tests)\//.test(e.path)) continue;
    let expected = BATCH.sharedPlatform;
    for (const group of PRECEDENCE.slice(0, -1)) {
      const patterns = manifest.testOwnershipRule[group];
      if (!Array.isArray(patterns) || patterns.some(p => typeof p !== 'string' || !/^\*[^*?\[\]]+\*$/.test(p))) {
        errors.push(`Unsupported test glob: ${group}`);
        continue;
      }
      if (patterns.some(p => e.path.toLowerCase().includes(p.slice(1, -1).toLowerCase()))) {
        expected = BATCH[group];
        break;
      }
    }
    check(e.batch === expected, `Test ownership differs: ${e.path}`);
  }
  return errors;
}
