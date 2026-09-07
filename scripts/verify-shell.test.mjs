import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { findBash, bashProbe } from './verify-shell.mjs';

const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const pass = { status: 37, stdout: 'CODEX_VERIFY_BASH_READY' };
test('PowerShell SHELL is never executed as Bash', () => {
  const seen = [];
  assert.equal(findBash({ platform: 'win32', env: { SHELL: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' }, exists: () => true,
    spawn: (path, args, opts) => { seen.push(path); assert.deepEqual(args, ['--noprofile', '--norc', '-c', bashProbe]); assert.equal(opts.shell, false); return pass; } }), gitBash);
  assert.deepEqual(seen, [gitBash]);
});
test('exit zero, missing marker, signal and timeout cannot pass the Bash probe', () => {
  for (const result of [{ status: 0, stdout: pass.stdout }, { status: 37, stdout: '' }, { ...pass, signal: 'SIGTERM' }, { ...pass, error: new Error('timeout') }]) {
    assert.equal(findBash({ platform: 'win32', env: {}, exists: () => true, spawn: () => result }), null);
  }
});
test('relative/WSL alias is ignored; valid explicit Bash must pass probe', () => {
  for (const shell of ['bash.exe', 'C:\\Windows\\System32\\wsl.exe']) {
    assert.equal(findBash({ platform: 'win32', env: { SHELL: shell }, exists: () => false,
      spawn: () => { throw Error('must not spawn'); } }), null);
  }
  assert.equal(findBash({ platform: 'win32', env: { SHELL: 'D:\\Git\\bin\\bash.exe' }, exists: () => true, spawn: () => pass }), 'D:\\Git\\bin\\bash.exe');
});
test('POSIX Bash is also probed rather than assumed', () => {
  assert.equal(findBash({ platform: 'linux', spawn: () => pass }), 'bash');
  assert.equal(findBash({ platform: 'linux', spawn: () => ({ status: 127 }) }), null);
});
test('actual Bash child finishes and preserves nonzero status', () => {
  const bash = findBash();
  assert.ok(bash, 'Real Bash required; not skipped');
  const started = Date.now();
  const result = spawnSync(bash, ['--noprofile', '--norc', '-c', 'sleep 0.1; printf CHILD_FINISHED; exit 29'], { encoding: 'utf8', timeout: 5000, windowsHide: true, shell: false });
  assert.equal(result.status, 29);
  assert.equal(result.stdout, 'CHILD_FINISHED');
  assert.ok(Date.now() - started >= 80);
});
test('full verify consumes the verified selector and runs its regression', () => {
  const source = readFileSync(new URL('./verify.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ findBash \} from '\.\/verify-shell\.mjs'/);
  assert.match(source, /scripts\/verify-shell\.test\.mjs/);
  assert.doesNotMatch(source, /function findBash/);
});
