import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { findBash } from './verify-shell.mjs';

/** Run all independent contracts, even after a failure; never turn failures into PASS. */
export function runContractChecks(run, BASH) {
  const results = [];
  const check = (cmd, args) => {
    let ok = false;
    try { ok = run(cmd, args) === true; } catch (error) { console.error(error); }
    results.push({ command: [cmd, ...args].join(' '), ok });
  };
  // Historical P0/S4 snapshot equality is now an explicit audit, not a UI freeze.
  check('node', ['--test', 'scripts/verify-contracts.test.mjs']);
  check('node', ['--test', 'scripts/p0-backlog-summary.test.mjs']);
  check('node', ['scripts/three-surface-sync-check.mjs']);
  check('node', ['scripts/three-surface-visual-diff-check.mjs']);
  check('node', ['scripts/three-surface-byte-artifacts-check.mjs']);
  check('node', ['--test',
    'docs/prototypes/full-page-flow-prototype-app-map-check.test.mjs',
    'docs/prototypes/full-page-flow-prototype-axis-measure.test.mjs',
    'docs/prototypes/full-page-flow-prototype-doc-claims-check.test.mjs',
    'docs/prototypes/full-page-flow-prototype-text-sha256.test.mjs',
  ]);
  check('node', ['scripts/design-token-contrast.mjs']);
  check('node', ['--test', 'scripts/design-token-contrast.test.mjs']);
  check('node', ['scripts/design-token-color-usage.mjs']);
  check('node', ['--test', 'scripts/design-token-color-usage.test.mjs']);
  check('node', ['scripts/design-token-s3d-diff.mjs']);
  check('node', ['--test', 'scripts/design-token-s3d-diff.test.mjs']);
  check('node', ['scripts/design-token-s4-check.mjs', '--current']);
  check('node', ['--test', 'scripts/design-token-s4-current.test.mjs']);
  check('node', ['scripts/touch-target-audit.mjs']);
  check('node', ['--test', 'scripts/touch-target-audit.test.mjs']);
  check('node', ['scripts/native-touch-runtime-evidence-check.mjs']);
  check('node', ['scripts/native-touch-runtime-evidence-check.mjs', '--verify-receipt']);
  check('node', ['--test', 'scripts/native-touch-runtime-evidence-check.test.mjs']);
  check('node', ['--test', 'scripts/native-touch-runtime-rederive.test.mjs']);
  check('node', ['scripts/native-text-scale-evidence-check.mjs']);
  check('node', ['--test', 'scripts/native-text-scale-evidence-check.test.mjs']);
  check('node', ['--test', 'scripts/native-text-scale-rederive.test.mjs']);
  check('node', ['--test', 'scripts/verify-shell.test.mjs']);
  check('node', ['scripts/team-service-local-tests.mjs']);
  check('node', ['packages/db/scripts/cli-contract.test.mjs']);
  check('node', ['packages/db/scripts/deploy-guard.test.mjs']);
  check('node', ['packages/db/scripts/admin-acl-source-scan.test.mjs']);
  check('node', ['scripts/ci-contract.test.mjs']);
  check('node', ['scripts/protected-gate-validator.test.mjs']);
  check('node', ['scripts/github-ruleset.test.mjs']);
  check('node', ['scripts/ops-monitoring.test.mjs']);
  check('node', ['scripts/docs-graph-check.mjs', '--activation']);
  check('node', ['--test', 'scripts/docs-graph-check.test.mjs']);
  if (!BASH) { console.error('bash 를 못 찾았습니다 (Git Bash 필요).'); results.push({ command: 'admin-acl.test.sh', ok: false }); }
  else check(BASH, ['packages/db/scripts/admin-acl.test.sh']);
  console.log('\n③ 개별 검사 결과');
  for (const { command, ok } of results) console.log((ok ? 'PASS ' : 'FAIL ') + command);
  return results.every(({ ok }) => ok);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const ok = runContractChecks((cmd, args) => {
    const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
    if (result.error) console.error(result.error);
    return result.status === 0;
  }, findBash());
  process.exitCode = ok ? 0 : 1;
}
