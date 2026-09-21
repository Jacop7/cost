// 같은 E7 요청 키가 두 세션에서 겹쳐도 한 묶음만 저장되는지 실제 lock wait로 확인한다.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const db = process.argv[2];
if (!/^fresh_[a-z0-9_]+$/.test(db ?? '')) throw Error('Disposable fresh_* DB required');
const args = ['exec', '-i', process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_costkeep',
  'psql', '-X', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'];

function query(sql) {
  const result = spawnSync('docker', args, { input: sql, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || 'Database command failed');
  return result.stdout.trim();
}

function session(name, sql, hold = false) {
  const child = spawn('docker', args);
  let output = '', error = '', ready;
  const started = new Promise(resolve => { ready = resolve; });
  const timer = setTimeout(() => child.kill(), 30000);
  child.stdout.on('data', bytes => { output += bytes; if (output.includes('READY')) ready(); });
  child.stderr.on('data', bytes => { error += bytes; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer); ready();
      if (code === 0) resolve(output); else reject(Error(error || `${name} exited ${code}`));
    });
  });
  done.catch(() => {});
  child.stdin.write(`set application_name='${name}';${sql}\n`);
  if (!hold) child.stdin.end();
  return { started, done, release: () => child.stdin.end('commit;\n') };
}

const actor = randomUUID();
const auth = `set local role authenticated;set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}';`;
const store = query(`begin;insert into auth.users(id) values('${actor}');${auth}
  select create_store('E7 중복 경합','Asia/Seoul')->>'store_id';commit;`);
const ingredient = query(`begin;${auth}select save_ingredient('${store}',
  '{"contract_version":3,"name":"E7 경합 재료","base_unit":"g","safety_stock":1000}');commit;`);
const requestKey = randomUUID();
const payload = JSON.stringify([{
  ingredient_id: ingredient, vendor_id: null, brand_id: null,
  volume: 1000, amount: 4000, qty: 2,
  expected_at: query(`select (store_local_date('${store}')+1)::text;`), source: 'manual',
}]).replaceAll("'", "''");
const call = `select place_orders('${store}','${payload}'::jsonb,'${requestKey}');`;
const firstName = `e7-first-${randomUUID()}`;
const secondName = `e7-second-${randomUUID()}`;
const first = session(firstName, `begin;${auth}${call}select 'READY';`, true);
await first.started;
const second = session(secondName, `begin;${auth}${call}commit;`);
let blocked = false;
try {
  for (let attempt = 0; attempt < 30 && !blocked; attempt++) {
    blocked = query(`select exists(select 1 from pg_stat_activity a
      join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid))
      where a.application_name='${secondName}' and b.application_name='${firstName}'
        and a.wait_event_type='Lock');`) === 't';
    if (!blocked) await new Promise(resolve => setTimeout(resolve, 60));
  }
} finally {
  first.release();
}
const [, output] = await Promise.all([first.done, second.done]);
if (!blocked) throw Error('same request key: no actual lock wait observed');
if (!output.includes('"duplicate": true')) throw Error(`second request did not reuse receipt: ${output}`);
const state = JSON.parse(query(`select jsonb_build_object(
  'orders',(select count(*) from order_records where store_id='${store}' and ingredient_id='${ingredient}'),
  'receipts',(select count(*) from order_placement_receipts where store_id='${store}' and request_key='${requestKey}'),
  'events',(select count(*) from inventory_events where store_id='${store}' and ingredient_id='${ingredient}'))`));
if (state.orders !== 1 || state.receipts !== 1 || state.events !== 0)
  throw Error(`same request key: inconsistent final state ${JSON.stringify(state)}`);
console.log(`PASS same-key: lock observed; ${JSON.stringify(state)}`);
