/** 스테이징 국제 세금 facade·계산 계약을 영구 데이터 없이 검증한다. */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(DB_ROOT, '..', '..');
const SUPABASE_CLI = join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const SQL_PATH = join(DB_ROOT, 'scripts', 'staging-international-smoke.sql');
const REF_RE = /^[a-z0-9]{20}$/;
const projectRef = process.env.MARGINCOOK_STAGING_PROJECT_REF;
const residueSql = "select count(*)::int as synthetic_residue from auth.users where id::text like 'a71f0000-%';";

function fail(message, output = '') {
  if (output) process.stderr.write(output.endsWith('\n') ? output : `${output}\n`);
  console.error(`스테이징 국제 검산 실패: ${message}`);
  process.exit(1);
}

function query(args) {
  const result = spawnSync(process.execPath, [SUPABASE_CLI, 'db', 'query',
    '--linked', '--project-ref', projectRef, ...args, '--output', 'json'], {
    cwd: DB_ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function assertNoResidue(phase) {
  const result = query([residueSql]);
  if (result.status !== 0 || !/"synthetic_residue"\s*:\s*0/.test(result.output)) {
    fail(`${phase} 합성 계정 잔여가 0건이 아닙니다.`, result.output);
  }
}

if (!REF_RE.test(projectRef ?? '')) {
  fail('MARGINCOOK_STAGING_PROJECT_REF가 없거나 project ref 형식이 아닙니다.');
}
if (process.env.MARGINCOOK_PRODUCTION_PROJECT_REF === projectRef) {
  fail('스테이징 project ref가 운영 project ref와 같습니다.');
}

assertNoResidue('실행 전');
const smoke = query(['--file', SQL_PATH]);
// SQL의 마지막 예외가 단일 DO 문을 전부 롤백한다. 비정상 종료와 정확한 marker가 함께 있어야 성공이다.
const marker = /SYNTHETIC_ROLLBACK_OK ([^\r\n"]+)/.exec(smoke.output)?.[1]?.split('\\nCONTEXT:')[0];
if (smoke.status === 0 || !marker) fail('롤백 marker를 받지 못했습니다.', smoke.output);
assertNoResidue('실행 후');

console.log(`스테이징 국제 검산 통과 — ${marker.trim()}`);
