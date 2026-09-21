// E1 입고와 E12 취소가 같은 발주를 동시에 잠글 때의 실제 2세션 직렬화.
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

for (const scenario of ['cancel-first', 'inbound-first', 'cancel-cancel']) {
  const actor = randomUUID();
  const auth = `set local role authenticated;set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}';`;
  const store = query(`begin;insert into auth.users(id) values('${actor}');${auth}
    select create_store('E12 입고 경합','Asia/Seoul')->>'store_id';commit;`);
  const ingredient = query(`begin;${auth}select save_ingredient('${store}',
    '{"contract_version":3,"name":"E12 경합 재료","base_unit":"g","safety_stock":1000}');commit;`);
  const order = query(`begin;${auth}select e7_place_order('${store}','${ingredient}',null,null,1000,4000,2,null,'manual');commit;`);
  const key = randomUUID();
  const cancel = `select e12_order_canceled('${order}','동시 취소');`;
  const inbound = `select e1_confirm_inbound('${order}',1,'${key}');`;
  const rejectedInbound = `do $$begin perform e1_confirm_inbound('${order}',1,'${key}');
    raise exception 'canceled order accepted inbound'; exception when sqlstate '22000' then null; end$$;select 'INBOUND_REJECTED';`;
  const rejectedCancel = `do $$begin perform e12_order_canceled('${order}','입고 뒤 취소');
    raise exception 'partially received order was canceled'; exception when raise_exception then null; end$$;select 'CANCEL_REJECTED';`;
  const firstSql = scenario === 'inbound-first' ? inbound : cancel;
  const secondSql = scenario === 'cancel-first' ? rejectedInbound
    : scenario === 'inbound-first' ? rejectedCancel : cancel;
  const firstName = `e12-first-${randomUUID()}`;
  const secondName = `e12-second-${randomUUID()}`;
  const first = session(firstName, `begin;${auth}${firstSql}select 'READY';`, true);
  await first.started;
  const second = session(secondName, `begin;${auth}${secondSql}commit;`);
  let blocked = false;
  try {
    for (let attempt = 0; attempt < 30 && !blocked; attempt++) {
      blocked = query(`select exists(select 1 from pg_stat_activity a
        join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid))
        where a.application_name='${secondName}' and b.application_name='${firstName}'
          and a.wait_event_type='Lock');`) === 't';
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 60));
    }
  } finally { first.release(); }
  const [, output] = await Promise.all([first.done, second.done]);
  if (!blocked) throw Error(`${scenario}: no actual lock wait observed`);

  const state = JSON.parse(query(`select jsonb_build_object(
    'status',(select status from order_records where id='${order}'),
    'received',(select received_qty from order_records where id='${order}'),
    'events',(select count(*) from inventory_events where order_record_id='${order}'),
    'stock',coalesce((select stock_total from inventory_states where ingredient_id='${ingredient}'),0));`));
  if (scenario === 'inbound-first') {
    if (state.status !== 'partial' || state.received !== 1 || state.events !== 1 || state.stock !== 1000)
      throw Error(`${scenario}: inconsistent final state ${JSON.stringify(state)}`);
    if (!output.includes('CANCEL_REJECTED')) throw Error(`${scenario}: missing rejection proof`);
  } else {
    if (state.status !== 'canceled' || state.received !== 0 || state.events !== 0 || state.stock !== 0)
      throw Error(`${scenario}: inconsistent final state ${JSON.stringify(state)}`);
    if (scenario === 'cancel-first' && !output.includes('INBOUND_REJECTED'))
      throw Error(`${scenario}: missing rejection proof`);
    if (scenario === 'cancel-cancel' && !output.includes('"already_canceled": true'))
      throw Error(`${scenario}: second cancellation was not idempotent`);
  }
  console.log(`PASS ${scenario}: lock observed; ${JSON.stringify(state)}`);
}
