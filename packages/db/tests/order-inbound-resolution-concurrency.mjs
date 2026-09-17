// Real E1/resolution lock ordering with synthetic data in an explicitly disposable DB.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const db = process.argv[2];
if (!/^fresh_[a-z0-9_]+$/.test(db ?? '')) throw Error('Disposable fresh_* DB required');
const args = ['exec', '-i', process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_costkeep', 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'];
function q(sql) {
  const result = spawnSync('docker', args, { input: sql, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr); return result.stdout.trim();
}
function session(name, sql, hold = false) {
  const child = spawn('docker', args); let out = '', err = '', ready;
  const started = new Promise(resolve => { ready = resolve; });
  const timer = setTimeout(() => child.kill(), 30000);
  child.stdout.on('data', bytes => { out += bytes; if (out.includes('READY')) ready(); });
  child.stderr.on('data', bytes => { err += bytes; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timer); ready(); code === 0 ? resolve(out) : reject(Error(err)); });
  });
  done.catch(() => {});
  child.stdin.write(`set application_name='${name}'; ${sql}\n`);
  if (!hold) child.stdin.end();
  return { started, done, release: () => child.stdin.end('commit;\n') };
}
for (const scenario of ['inbound-first', 'resolution-first', 'same-request', 'separate-requests']) {
  const actor = randomUUID(), key = randomUUID();
  const auth = `set local role authenticated;set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}';`;
  const store = q(`begin;insert into auth.users(id) values('${actor}');${auth}select public.create_store('발주 입고 경합','Asia/Seoul')->>'store_id';commit;`);
  const ingredient = q(`begin;${auth}select save_ingredient('${store}','{"name":"입고 경합 재료","base_unit":"g","per_volume":1}');commit;`);
  const order = q(`begin;${auth}select e7_place_order('${store}','${ingredient}',null,null,1000,4000,5,null,'manual');commit;`);
  const inbound = `select e1_confirm_inbound('${order}',3,'${key}');`;
  const resolve = `select resolve_order_inbound('${store}','${order}','${key}');`;
  const late = `do $$ begin perform e1_confirm_inbound('${order}',3,'${key}'); raise exception 'late E1 was accepted'; exception when sqlstate '45010' then null; end $$;`;
  const firstSql = scenario === 'resolution-first' ? resolve : inbound;
  const secondSql = scenario === 'resolution-first' ? late : scenario === 'inbound-first' ? resolve
    : scenario === 'same-request' ? inbound : `select e1_confirm_inbound('${order}',3,'${randomUUID()}');`;
  const firstName = 'e1-first-' + randomUUID(), secondName = 'e1-second-' + randomUUID();
  const first = session(firstName, `begin;${auth}${firstSql}select 'READY';`, true);
  await first.started;
  const second = session(secondName, `begin;${auth}${secondSql}commit;`);
  let blocked = false;
  try {
    for (let attempt = 0; attempt < 20 && !blocked; attempt++) {
      blocked = q(`select exists(select 1 from pg_stat_activity a join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid)) where a.application_name='${secondName}' and b.application_name='${firstName}' and a.wait_event_type='Lock');`) === 't';
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 60));
    }
  } finally { first.release(); }
  const [, output] = await Promise.all([first.done, second.done]);
  if (!blocked) throw Error('No observed lock wait: ' + scenario);
  const expectedCount = scenario === 'resolution-first' ? 0 : scenario === 'separate-requests' ? 2 : 1;
  const expectedQuantity = scenario === 'resolution-first' ? 0 : scenario === 'separate-requests' ? 5 : 3;
  const events = Number(q(`select count(*) from inventory_events where order_record_id='${order}' and type='inbound';`));
  const total = Number(q(`select coalesce(sum(count_delta),0) from inventory_events where order_record_id='${order}';`));
  const quantity = Number(q(`select received_qty from order_records where id='${order}';`));
  const stock = Number(q(`select coalesce((select stock_total from inventory_states where ingredient_id='${ingredient}'),0);`));
  if (events !== expectedCount || quantity !== expectedQuantity || total !== expectedQuantity * 1000 || stock !== total)
    throw Error(`${scenario}: events=${events}, quantity=${quantity}, ledger=${total}, stock=${stock}`);
  if (scenario === 'inbound-first' && !output.includes('"status": "recorded"')) throw Error('Missing recorded resolution');
  if (scenario === 'same-request' && !output.includes('"duplicate": true')) throw Error('Missing duplicate response');
  if (scenario === 'separate-requests' && !output.includes('"received_qty": 2')) throw Error('Remaining quantity cap changed');
  console.log(`PASS ${scenario}: observed lock wait, events=${events}, received=${quantity}, ledger=stock=${stock}`);
}
