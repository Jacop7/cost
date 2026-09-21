// Capture a real full verify run without staging, resetting or touching a remote DB.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputFlag = process.argv.indexOf('--output');
if (outputFlag >= 0 && (!process.argv[outputFlag + 1] || process.argv[outputFlag + 1].startsWith('--'))) {
  throw Error('--output requires a repository-relative evidence path');
}
const outputRelative = outputFlag >= 0
  ? process.argv[outputFlag + 1]
  : 'docs/ai-review/evidence/TEAM-SERVICE-VERIFY-PREWORK-20260906-001.json';
if (!outputRelative.startsWith('docs/ai-review/evidence/') || !outputRelative.endsWith('.json')) {
  throw Error('--output must be a JSON file under docs/ai-review/evidence/');
}
const output = resolve(root, outputRelative);
if (existsSync(output)) throw Error('Evidence already exists; do not overwrite');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const sha = (text) => createHash('sha256').update(text).digest('hex');
function snapshot() {
  const names = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
    'apps', 'packages', 'scripts', '.github', '.npmrc', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
    'AGENTS.md', 'ARCHITECTURE.md', 'docs/team/chats', '.codex/mission-relay/model-plan.json', '.codex/mission-relay/model-plan.json.sha256')
    .split('\0').filter(Boolean))].filter(p => !p.includes('/node_modules/') && !p.includes('/dist/')).sort();
  return { head: git('rev-parse', 'HEAD').trim(), branch: git('branch', '--show-current').trim(),
    dirty: git('-c', 'core.quotepath=false', 'status', '--short').trimEnd().split('\n'),
    files: names.map(path => ({ path, sha256: existsSync(resolve(root, path)) ? sha(readFileSync(resolve(root, path))) : null })) };
}
const before = snapshot();
const started_at = new Date().toISOString();
const invocation = process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', 'corepack pnpm verify']] : ['corepack', ['pnpm', 'verify']];
const child = spawn(invocation[0], invocation[1], { cwd: root, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = '', error = null;
child.stdout.on('data', chunk => { const text = chunk.toString(); stdout += text; process.stdout.write(text); });
child.stderr.on('data', chunk => { const text = chunk.toString(); stderr += text; process.stderr.write(text); });
child.on('error', value => { error = String(value); });
child.on('close', (exit_code, signal) => {
  const after = snapshot();
  const beforeMap = new Map(before.files.map(f => [f.path, f.sha256]));
  const afterMap = new Map(after.files.map(f => [f.path, f.sha256]));
  const changed_inputs = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].filter(p => beforeMap.get(p) !== afterMap.get(p));
  const stages = [...stdout.matchAll(/^  (ok\s*|FAIL\s*|건너뜀) ([①②③④⑤⑥].*)$/gm)].map(m => ({ status: m[1].trim(), label: m[2] }));
  const record = { kind: 'ACTUAL_FULL_VERIFY_WORKING_TREE_OBSERVATION_NOT_ADMISSION', started_at, ended_at: new Date().toISOString(),
    command: ['corepack', 'pnpm', 'verify'], invocation, environment: { node: process.version, platform: process.platform,
      scope: 'Local existing development DB rollback tests plus unique disposable fresh/upgrade DBs; no remote apply/reset',
      shell_fix: 'verify-shell.mjs probes Bash version marker and nonzero child exit; not SHELL file existence' },
    before, after, changed_inputs, head_stable: before.head === after.head, stages, exit_code, signal, error,
    stdout, stderr, stdout_sha256: sha(stdout), stderr_sha256: sha(stderr),
    full_verify_passed: exit_code === 0 && stages.length === 6 && stages.every(s => s.status === 'ok') && changed_inputs.length === 0 && before.head === after.head,
    independent_review: false, implementation_admission: false, send_enabled: false,
    limitations: 'Working-tree hashes, not a committed clean snapshot or captured database backup; concurrent input drift is explicit. Capture is not an independent review.' };
  writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ evidence: output, exit_code, stages, changed_inputs, full_verify_passed: record.full_verify_passed }));
  process.exitCode = exit_code ?? 1;
});
