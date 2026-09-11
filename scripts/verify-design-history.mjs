import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Historical failures remain failures. This audit is not the current product gate.
const cwd = fileURLToPath(new URL('..', import.meta.url));
const results = [];
for (const args of [
  ['scripts/three-surface-p0-check.mjs'],
  ['scripts/design-token-s4-check.mjs'],
  ['--test', 'scripts/design-token-s4-check.test.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) console.error(result.error);
  results.push({ command: args.join(' '), ok: result.status === 0 });
}
console.log('Historical design audit — not current UI approval');
for (const { command, ok } of results) console.log((ok ? 'PASS ' : 'FAIL ') + command);
process.exitCode = results.every(({ ok }) => ok) ? 0 : 1;
