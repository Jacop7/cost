import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { findBash } from './verify-shell.mjs';

// Device capture freshness is a separately reported release follow-up. Source,
// geometry, security and DB regression checks remain blocking.
export const NATIVE_EVIDENCE_CHECKS = [
  ['scripts/native-touch-runtime-evidence-check.mjs'],
  ['scripts/native-touch-runtime-evidence-check.mjs', '--verify-receipt'],
  ['scripts/native-text-scale-evidence-check.mjs'],
  ['--test', 'scripts/native-device-evidence.integration.mjs'],
];
const isNativeEvidence = args => NATIVE_EVIDENCE_CHECKS.some(expected => JSON.stringify(args) === JSON.stringify(expected));

export function runNativeEvidenceChecks(run) {
  const results = NATIVE_EVIDENCE_CHECKS.map(args => {
    try { return run('node', args) === true; } catch (error) { console.error(error); return false; }
  });
  return results.every(Boolean);
}

/** Run every check; preserve advisory failures instead of labeling them PASS. */
export function runContractChecks(run, BASH) {
  const results = [];
  const check = (cmd, args) => {
    let ok = false;
    try { ok = run(cmd, args) === true; } catch (error) { console.error(error); }
    results.push({ command: [cmd, ...args].join(' '), ok,
      blocking: !(cmd === 'node' && isNativeEvidence(args)) });
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
  check('node', ['--test', 'scripts/native-inspector-connection.test.mjs']);
  check('node', ['--test', 'scripts/native-current-contract.test.mjs']);
  check('node', ['scripts/native-touch-runtime-evidence-check.mjs', '--verify-receipt']);
  check('node', ['--test', 'scripts/native-touch-runtime-evidence-check.test.mjs']);
  check('node', ['--test', 'scripts/native-device-evidence.integration.mjs']);
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
  for (const { command, ok, blocking } of results)
    console.log((ok ? 'PASS ' : blocking === false ? 'ADVISORY_FAIL (배포 비차단·미완료) ' : 'FAIL ') + command);
  const advisoryFailures = results.filter(r => !r.ok && r.blocking === false).length;
  if (advisoryFailures) console.log(`네이티브 기기 증빙 ${advisoryFailures}건 미완료 — 전체 품질 검수 완료가 아닙니다.`);
  return results.every(({ ok, blocking }) => ok || blocking === false);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const run = (cmd, args) => {
    const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
    if (result.error) console.error(result.error);
    return result.status === 0;
  };
  const ok = process.argv.includes('--native-evidence-only')
    ? runNativeEvidenceChecks(run) : runContractChecks(run, findBash());
  process.exitCode = ok ? 0 : 1;
}
