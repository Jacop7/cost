import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dbRoot = resolve(here, '..');
const repoRoot = resolve(dbRoot, '../..');
const cli = resolve(repoRoot, 'node_modules/supabase/dist/supabase.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: dbRoot, stdio: 'inherit', ...options });
  if (result.error) console.error(`${command} 실행 실패: ${result.error.message}`);
  return result.status === 0;
}

function findBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.SHELL,
    String.raw`C:\Program Files\Git\bin\bash.exe`,
    String.raw`C:\Program Files (x86)\Git\bin\bash.exe`,
    process.env.ProgramW6432 ? join(process.env.ProgramW6432, 'Git', 'bin', 'bash.exe') : null,
  ].filter(Boolean);
  return candidates.find(existsSync) ?? null;
}

if (!existsSync(cli)) {
  console.error(`고정된 Supabase CLI를 찾을 수 없습니다: ${cli}`);
  process.exit(1);
}

if (!run(process.execPath, [cli, 'db', 'reset'])) process.exit(1);

const bash = findBash();
if (!bash) {
  console.error('Git Bash를 찾지 못해 로컬 ACL 보정을 실행할 수 없습니다.');
  process.exit(1);
}

for (const mode of ['fix', 'check']) {
  if (!run(bash, ['scripts/admin-acl.sh', '--local', 'postgres', mode])) process.exit(1);
}

console.log('Supabase 로컬 reset · admin ACL fix/check 완료');
