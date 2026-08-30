import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../../..');
const rootPackage = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const dbPackage = JSON.parse(readFileSync(resolve(root, 'packages/db/package.json'), 'utf8'));
const config = readFileSync(resolve(root, 'packages/db/supabase/config.toml'), 'utf8');
const resetScript = readFileSync(resolve(root, 'packages/db/scripts/reset-local.mjs'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(rootPackage.packageManager === 'pnpm@9.12.0', 'packageManager must stay pinned to pnpm@9.12.0');
assert(dbPackage.devDependencies?.supabase === '2.116.0', 'Supabase CLI must stay exactly pinned to 2.116.0');
assert(!/^\[inbucket\]$/m.test(config), 'deprecated [inbucket] config must not return');
assert(/^\[local_smtp\]$/m.test(config), '[local_smtp] config is required for CLI v2');
assert(dbPackage.scripts?.reset === 'node scripts/reset-local.mjs', 'db reset must use the ACL-aware wrapper');
assert(!Object.hasOwn(dbPackage.scripts ?? {}, 'push'), 'ambiguous db push script must not return');
for (const name of ['deploy:staging:plan', 'deploy:staging:apply', 'deploy:production:plan', 'deploy:production:apply']) {
  assert(dbPackage.scripts?.[name]?.includes('deploy-guard.mjs'), `explicit deploy script missing: ${name}`);
  assert(rootPackage.scripts?.[`db:${name}`]?.includes(`@margincook/db ${name}`), `root deploy alias missing: db:${name}`);
}
assert(!Object.keys(dbPackage.scripts ?? {}).some((name) => /^deploy:(staging|production)$/.test(name)),
  'a mutating deployment command must end with :apply');
assert(/\['fix', 'check'\]/.test(resetScript), 'db reset must finish with admin ACL fix/check');

for (const [name, command] of Object.entries(rootPackage.scripts ?? {})) {
  if (/^pnpm(?:\s|$)/.test(command)) {
    throw new Error(`root script ${name} bypasses the pinned package manager: ${command}`);
  }
}

const cli = resolve(root, 'node_modules/supabase/dist/supabase.js');
const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
assert(version.status === 0, `Supabase CLI version probe failed: ${version.stderr || version.stdout}`);
assert(version.stdout.trim() === '2.116.0', `installed Supabase CLI is ${version.stdout.trim()}, expected 2.116.0`);

console.log('ok  Supabase CLI 2.116.0 · pnpm 9.12.0 · local_smtp contract');
