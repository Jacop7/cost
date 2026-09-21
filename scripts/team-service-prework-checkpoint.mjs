// Creates a hash-only checkpoint for team-service prework and Router contract bytes.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'docs/ai-review/evidence/TEAM-SERVICE-PREWORK-CHECKPOINT-002.json');
if (existsSync(output)) throw new Error('checkpoint already exists; refusing overwrite');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const files = [];
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const candidate = join(path, entry.name);
    if (entry.isDirectory()) visit(candidate);
    else if (entry.isFile()) files.push(candidate);
  }
}
const routerRoot = resolve(root, '.codex/team-router');
visit(routerRoot);
const router = files.sort().map((path) => ({
  path: relative(root, path).replaceAll('\\', '/'),
  sha256: sha(path),
  bytes: statSync(path).size,
  tracked: Boolean(git('ls-files', '--', relative(root, path))),
}));
const selected = [
  'docs/ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json',
  'docs/team/service-flow-acceptance.json',
  'docs/team/host-scope-003.json',
  'docs/ai-review/evidence/TEAM-SERVICE-HOST-SCOPE-003-PREFLIGHT.json',
  'docs/ai-review/evidence/TEAM-SERVICE-HOST-SCOPE-003.json',
  'docs/ai-review/evidence/TEAM-SERVICE-HOST-SCOPE-003-CORRECTION-001.json',
  'docs/ai-review/evidence/TEAM-SERVICE-LOCAL-ADMISSION-SOL-003.json',
  'docs/ai-review/evidence/TEAM-SERVICE-PREWORK-20260906-DISPOSITION-001.md',
  'docs/ai-review/evidence/TEAM-SERVICE-PREWORK-20260906-D1-FABLE-001.md',
  'scripts/team-service-cooperative-contract.test.mjs',
  'scripts/team-service-plan-contract.test.mjs',
  'scripts/team-service-host-scope-003.mjs',
  '.codex/mission-relay/model-plan.json',
  '.codex/mission-relay/model-plan.json.sha256',
].map((path) => ({ path, sha256: sha(resolve(root, path)), bytes: statSync(resolve(root, path)).size }));
const result = {
  schema_version: 1,
  kind: 'TEAM_SERVICE_PREWORK_HASH_CHECKPOINT_NOT_COMMIT_NOT_ACTIVATION',
  recorded_at: new Date().toISOString(),
  repository: { root: 'C:/Users/jacop/\uD504\uB85C\uC81D\uD2B8/\uC2DD\uC790\uC7AC\uAD00\uB9AC\uC571', branch: git('branch', '--show-current'), head: git('rev-parse', 'HEAD') },
  selected_inputs: selected,
  router_contract_inventory: router,
  router_inventory_result: router.length === 4 && router.every((row) => /^[a-f0-9]{64}$/.test(row.sha256))
    ? 'BYTES_HASH_INVENTORIED_UNTRACKED_NOT_ACTIVATED'
    : 'INVENTORY_INCOMPLETE',
  user_dirty_files_staged: false,
  stash_or_reset_performed: false,
  provider_endpoint_ids_exported: false,
  claims: { service_ready: false, send_enabled: false, router_recovered: false, full_verify_passed: false },
};
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ output, selected: selected.length, router_files: router.length, router_inventory_result: result.router_inventory_result }, null, 2));
