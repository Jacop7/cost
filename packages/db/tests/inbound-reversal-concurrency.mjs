// Real E1/E11 transaction ordering on synthetic disposable databases only.
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
  child.stdin.write(`set application_name='${name}'; ${sql}\n`);
  if (!hold) child.stdin.end();
  return { started, done, release: () => child.stdin.end('commit;\n') };
}

for (const order of ['cancel-first', 'inbound-first', 'cancel-cancel']) {
  const actor = randomUUID();
  const auth = `set local role authenticated;set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}';`;
  const store = query(`begin;insert into auth.users(id) values('${actor}');${auth}
    select create_store('반복 입고 취소 경합','Asia/Seoul')->>'store_id';commit;`);
  const ingredient = query(`begin;${auth}select save_ingredient('${store}',
    '{"name":"입고 취소 경합 재료","base_unit":"g","per_volume":1000,"purchase_price":4000}');commit;`);
  // Date preparation is fixture-only; E7/E1/E11 still run as the application role.
  const localDate = query(`select store_local_date('${store}');`);
  const record = query(`begin;${auth}select e7_place_order('${store}','${ingredient}',null,null,1000,4000,3,'${localDate}'::date);commit;`);
  query(`begin;${auth}
    select e1_confirm_inbound('${record}',1,'${randomUUID()}');
    select e11_inbound_reverted('${record}');
    select e1_confirm_inbound('${record}',1,'${randomUUID()}');commit;`);
  const originalRows = JSON.parse(query(`select jsonb_agg(to_jsonb(e) order by e.seq)
    from inventory_events e where e.order_record_id='${record}' and e.type='inbound';`));
  const inbound = `select e1_confirm_inbound('${record}',1,'${randomUUID()}');`;
  const cancel = `select e11_inbound_reverted('${record}','동시 취소');`;
  const firstName = `reversal-first-${randomUUID()}`, secondName = `reversal-second-${randomUUID()}`;
  const first = session(firstName, `begin;${auth}${order === 'inbound-first' ? inbound : cancel}select 'READY';`, true);
  await first.started;
  const second = session(secondName, `begin;${auth}${order === 'cancel-first' ? inbound : cancel}commit;`);
  let blocked = false;
  try {
    for (let n = 0; n < 30 && !blocked; n++) {
      blocked = query(`select exists(select 1 from pg_stat_activity a
        join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid))
        where a.application_name='${secondName}' and b.application_name='${firstName}' and a.wait_event_type='Lock');`) === 't';
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 60));
    }
  } finally { first.release(); }
  await Promise.all([first.done, second.done]);
  if (!blocked) throw Error(`${order}: no actual lock wait observed`);
  const expectedStock = order === 'cancel-first' ? 1000 : 0;
  const expectedReversals = order === 'inbound-first' ? 3 : 2;
  const result = JSON.parse(query(`select jsonb_build_object(
    'stock', (select stock_total from inventory_states where ingredient_id='${ingredient}'),
    'ledger', (select sum(count_delta) from inventory_events where ingredient_id='${ingredient}'),
    'received', (select received_qty from order_records where id='${record}'),
    'status', (select status from order_records where id='${record}'),
    'reversals', (select count(*) from inventory_events r join inventory_events e on e.id=r.reverses_event_id
      where e.order_record_id='${record}' and e.type='inbound' and r.count_delta=-e.count_delta),
    'originals', (select jsonb_agg(to_jsonb(e) order by e.seq) from inventory_events e
      where e.order_record_id='${record}' and e.type='inbound'));`));
  if (result.stock !== expectedStock || result.ledger !== expectedStock)
    throw Error(`${order}: stock/ledger ${result.stock}/${result.ledger}, expected ${expectedStock}`);
  if (result.received !== expectedStock / 1000 || result.status !== (expectedStock ? 'partial' : 'ordered'))
    throw Error(`${order}: wrong order state ${result.status}/${result.received}`);
  if (result.reversals !== expectedReversals)
    throw Error(`${order}: reversal links ${result.reversals}, expected ${expectedReversals}`);
  for (const original of originalRows) {
    if (JSON.stringify(result.originals.find(row => row.id === original.id)) !== JSON.stringify(original))
      throw Error(`${order}: original inbound row was rewritten`);
  }
  console.log(`PASS ${order}: observed transaction lock, stock=ledger=${expectedStock}, exact reversals=${expectedReversals}, originals preserved`);
}
