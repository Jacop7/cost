/**
 * DB 회귀 스위트 러너.
 *
 * 새 의존성을 붙이지 않는다(가이드 P2). psql 의 ON_ERROR_STOP 만으로 충분하다 —
 * 단언이 실패하면 예외가 나고, psql 이 비정상 종료하고, 여기서 빨간 줄이 뜬다.
 *
 * 각 테스트는 _prelude.sql 이 연 트랜잭션 안에서 돌고 **롤백된다**.
 * 그래서 순서에 상관없이 돌릴 수 있고, 시드를 다시 만들 필요가 없다.
 *
 *   node tests/run.mjs           전부
 *   node tests/run.mjs 05        05 로 시작하는 파일만
 */
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_sikjae';
const filter = process.argv[2] ?? '';

const prelude = readFileSync(join(DIR, '_prelude.sql'), 'utf8');
const files = readdirSync(DIR)
  .filter((f) => /^\d\d_.*\.sql$/.test(f))
  .filter((f) => (filter ? f.startsWith(filter) : true))
  .sort();

if (files.length === 0) {
  console.error(`테스트 파일이 없습니다 (필터: "${filter}")`);
  process.exit(1);
}

let failed = 0;
const t0 = Date.now();

for (const file of files) {
  const sql = `${prelude}\n${readFileSync(join(DIR, file), 'utf8')}\nrollback;\n`;
  const r = spawnSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
    { input: sql, encoding: 'utf8' },
  );

  // psql 은 NOTICE(= ok 줄)를 stderr 로 보낸다. 실패 판정은 종료코드로만 한다.
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const ok = r.status === 0;
  if (!ok) failed += 1;

  console.log(`${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${file}`);
  // 통과하면 ok 줄만, 실패하면 전문을 보여준다.
  const lines = out.split('\n').filter((l) => l.trim() && !l.startsWith('SET') && l !== 'ROLLBACK');
  for (const l of ok ? lines.filter((l) => l.includes('ok ')) : lines) {
    console.log(`      ${l.replace(/^NOTICE:\s*/, '')}`);
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n${files.length - failed}/${files.length} 통과  (${secs}s)`);
process.exit(failed > 0 ? 1 : 0);
