import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { win32 } from 'node:path';

// A file existing at SHELL is not proof it is Bash (PowerShell can launch .sh asynchronously).
export const bashProbe = 'test -n "${BASH_VERSION:-}" || exit 1; printf CODEX_VERIFY_BASH_READY; exit 37';
export function findBash({ platform = process.platform, env = process.env,
  exists = existsSync, spawn = spawnSync } = {}) {
  const candidates = platform === 'win32' ? [
    env.SHELL,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    env.ProgramW6432 ? win32.join(env.ProgramW6432, 'Git', 'bin', 'bash.exe') : null,
  ].filter((path) => path && win32.isAbsolute(path) && /^bash\.exe$/i.test(win32.basename(path)) && exists(path)) : ['bash'];
  for (const candidate of new Set(candidates)) {
    const result = spawn(candidate, ['--noprofile', '--norc', '-c', bashProbe], {
      encoding: 'utf8', timeout: 5000, windowsHide: true, shell: false,
    });
    if (!result.error && !result.signal && result.status === 37 && result.stdout === 'CODEX_VERIFY_BASH_READY') return candidate;
  }
  return null;
}
