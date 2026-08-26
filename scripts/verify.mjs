/**
 * 전체 검증을 **한 명령**으로 묶는다 — `pnpm verify`.
 *
 * 왜 있나 — 지금까지 타입·시험·새 DB·업그레이드 경로·번들을 따로따로 돌렸다.
 * 각각은 통과했지만 자동으로 도는 것이 없어서, 다음 변경에서 하나를 빼먹으면 아무도 모른다.
 *
 * 도는 것 —
 *   ① 타입          `pnpm -r typecheck`
 *   ② 시험 3종      `pnpm -r test` (core · db · mobile)
 *   ③ 새 DB         마이그레이션 전체를 빈 DB 에 태우고 DB 시험을 다시
 *   ④ 업그레이드 경로 마이그레이션 **순서**를 태운다
 *   ⑤ 웹 번들       Metro 가 실제로 묶는지
 *
 * ⚠ ③④ 는 로컬 supabase 컨테이너가 필요하다. 없으면 **건너뛰지 않고 실패**한다 —
 *   조용히 건너뛰면 "통과" 가 거짓이 된다. DB 없이 앞부분만 보려면 `--no-db`,
 *   번들을 빼려면 `--no-bundle` 을 준다(무엇을 뺐는지 끝에 적힌다).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2));
const skipDb = args.has('--no-db');
const skipBundle = args.has('--no-bundle');

const results = [];
let failed = 0;

function step(name, fn) {
  const started = Date.now();
  process.stdout.write(`\n━━ ${name}\n`);
  let ok = false;
  try { ok = fn() !== false; } catch (e) { console.error(String(e?.message ?? e)); ok = false; }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ name, ok, secs });
  if (!ok) failed++;
  return ok;
}

/** 하위 명령. 실패하면 그대로 알린다 — 출력은 감추지 않는다. */
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: root, ...opts });
  if (r.error) console.error(`실행 실패: ${cmd} — ${r.error.message}`);
  return r.status === 0;
}

/**
 * pnpm 을 **자기 자신이 실행된 방식 그대로** 부른다.
 *
 * ⚠ `pnpm.cmd` 를 PATH 에서 찾으면 안 된다. corepack 으로만 쓰는 환경에서는 없어서
 *   0.0초 만에 조용히 실패한다 — 실제로 그랬다(① ② 가 FAIL 인데 아무 말이 없었다).
 *   `pnpm verify` 로 들어오면 `npm_execpath` 가 pnpm 의 js 를 가리킨다. 그걸 node 로 돈다.
 */
function pnpmRun(cmdArgs) {
  const exec = process.env.npm_execpath;
  if (exec && /\.(c|m)?js$/.test(exec)) return run(process.execPath, [exec, ...cmdArgs]);
  /*
   * `node scripts/verify.mjs` 로 곧장 부르면 `npm_execpath` 가 없다. PATH 의 pnpm 을
   * 먼저 보고, 없으면 corepack 으로 간다 — corepack 만 쓰는 환경이 실제로 있다.
   */
  const shell = process.platform === 'win32';
  const direct = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  if (spawnSync(direct, ['--version'], { shell, stdio: 'ignore' }).status === 0) {
    return run(direct, cmdArgs, { shell });
  }
  console.log('  (PATH 에 pnpm 이 없어 corepack 으로 부릅니다)');
  return run('corepack', ['pnpm', ...cmdArgs], { shell });
}

/**
 * bash 를 찾는다.
 *
 * ⚠ Windows 에서 그냥 `bash` 를 부르면 **WSL** 이 잡힌다. 그쪽에는 이 저장소도
 *   `/bin/bash` 도 없어서 `execvpe(/bin/bash) failed` 로 끝난다 — 실제로 그랬다.
 *   Git Bash 를 명시로 찾는다.
 */
function findBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.SHELL,
    String.raw`C:\Program Files\Git\bin\bash.exe`,
    String.raw`C:\Program Files (x86)\Git\bin\bash.exe`,
    process.env.ProgramW6432 ? join(process.env.ProgramW6432, 'Git', 'bin', 'bash.exe') : null,
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

const BASH = findBash();

step('① 타입 (pnpm -r typecheck)', () => pnpmRun(['-r', 'typecheck']));

/*
 * ⚠ `--no-db` 면 시험도 **DB 패키지를 뺀다.** `packages/db` 의 시험은 살아 있는
 *   supabase 컨테이너에 붙는다 — CI 처럼 DB 가 없는 곳에서 `pnpm -r test` 를 그냥
 *   부르면 거기서 깨진다. 라벨에도 무엇을 뺐는지 적는다, 안 그러면 초록이 거짓말한다.
 */
step(skipDb ? '② 시험 (core · mobile — DB 제외)' : '② 시험 (pnpm -r test)', () => (
  skipDb
    ? pnpmRun(['--filter', '@sikjae/core', '--filter', '@sikjae/mobile', 'test'])
    : pnpmRun(['-r', 'test'])
));

if (skipDb) {
  results.push({ name: '③ 새 DB', ok: true, secs: '0.0', skipped: true });
  results.push({ name: '④ 업그레이드 경로', ok: true, secs: '0.0', skipped: true });
} else {
  step('③ 새 DB (마이그레이션 전체 + 시험)', () => {
    if (!BASH) { console.error('bash 를 못 찾았습니다 (Git Bash 필요). --no-db 로 뺄 수 있습니다.'); return false; }
    const db = 'fresh_verify';
    if (!run(BASH, ['packages/db/scripts/fresh-db.sh', db])) return false;
    const ok = run('node', ['packages/db/tests/run.mjs'], { env: { ...process.env, PGDATABASE: db } });
    // ⚠ 실패해도 **반드시 치운다.** 남으면 다음 실행이 이미 있는 DB 를 만나 헷갈린다.
    run(BASH, ['packages/db/scripts/fresh-db.sh', '--drop', db], { stdio: 'ignore' });
    return ok;
  });
  step('④ 업그레이드 경로', () => {
    if (!BASH) { console.error('bash 를 못 찾았습니다 (Git Bash 필요).'); return false; }
    return run(BASH, ['packages/db/scripts/upgrade-check.sh']);
  });
}

if (skipBundle) {
  results.push({ name: '⑤ 웹 번들', ok: true, secs: '0.0', skipped: true });
} else {
  step('⑤ 웹 번들 (Metro export)', () => {
    /*
     * ⚠ dev 서버를 띄우고 curl 하지 않는다 — 포트가 겹치고, 죽이는 것을 잊으면 다음
     *   실행이 **옛 서버의 번들**을 받아 초록이 된다. `expo export` 는 한 번 묶고 끝난다.
     */
    const out = mkdtempSync(join(tmpdir(), 'verify-bundle-'));
    try {
      const ok = run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out], {
        shell: process.platform === 'win32',
        cwd: join(root, 'apps', 'mobile'),
        env: { ...process.env, EXPO_OFFLINE: '1' },
      });
      if (!ok) return false;
      if (!existsSync(join(out, 'index.html'))) {
        console.error('번들은 끝났는데 index.html 이 없습니다 — 결과를 못 믿습니다.');
        return false;
      }
      return true;
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
}

console.log('\n════ 검증 결과 ════');
for (const r of results) {
  const mark = r.skipped ? '건너뜀' : r.ok ? 'ok    ' : 'FAIL  ';
  console.log(`  ${mark} ${r.name}${r.skipped ? '' : `  (${r.secs}s)`}`);
}
/*
 * ⚠ 건너뛴 것이 있으면 **`전체 검증 통과` 라고 하지 않는다.** 한동안 "전체 통과가
 *   아닙니다" 라고 적어 놓고 바로 다음 줄에 "전체 검증 통과" 를 찍었다 — 스스로
 *   모순된 말이고, 훑어보는 사람은 뒤엣것만 읽는다.
 */
const skipped = results.filter((r) => r.skipped).map((r) => r.name);
const ran = results.length - skipped.length;
if (skipped.length) console.log(`\n⚠ 건너뛴 것: ${skipped.join(' · ')}`);
console.log(
  failed > 0
    ? `\n검증 실패 ${failed}건`
    : skipped.length
      ? `\n선택 범위 검증 통과 (${ran}/${results.length}단계) — 전체 통과가 아니다`
      : '\n전체 검증 통과',
);
process.exit(failed === 0 ? 0 : 1);
