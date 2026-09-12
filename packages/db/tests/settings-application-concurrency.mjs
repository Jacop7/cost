// Real committed two-session ordering. Only disposable fresh_* databases are accepted.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const db = process.argv[2];
if (!db || !/^fresh_[a-z0-9_]+$/.test(db)) throw new Error('Explicit disposable fresh_* DB required');
const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'];
function q(sql) {
  const r = spawnSync('docker', args, { input: sql, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
function session(name, sql, hold = false) {
  const p = spawn('docker', args); let out = '', err = ''; let ready;
  const readyPromise = new Promise(resolve => { ready = resolve; });
  const timer = setTimeout(() => { p.kill(); }, 30000);
  p.stdout.on('data', x => { out += x; if (out.includes('READY')) ready(); });
  p.stderr.on('data', x => { err += x; });
  const done = new Promise((resolve, reject) => {
    p.on('error', reject);
    p.on('close', code => { clearTimeout(timer); ready(); code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`)); });
  });
  // Attach a handler immediately; done is still awaited by the caller.
  done.catch(() => {});
  p.stdin.write(`set application_name='${name}'; ${sql}\n`);
  if (!hold) p.stdin.end();
  return { ready: readyPromise, done, release: () => p.stdin.end('commit;\n') };
}
for (const kind of ['fixed', 'recipe']) for (const order of ['save-first', 'close-first']) {
  const actor = randomUUID(); const recipe = randomUUID(); const day = randomUUID();
  const store = q(`begin; insert into auth.users(id) values('${actor}');
    set local role authenticated; set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}';
    select public.create_store('Concurrent settings','Asia/Seoul')->>'store_id'; commit;`);
  q(`begin;
    insert into public.fixed_costs_monthly(store_id,month,total_revenue,items)
      values('${store}',public.store_local_month('${store}'),1000,'[{"key":"rent","total":100}]');
    insert into public.recipes(id,store_id,name,price,base_servings) values('${recipe}','${store}','Concurrent menu',1000,1);
    insert into public.business_days(id,store_id,business_date,status,planned_close_at,snapshot)
      values('${day}','${store}',public.store_local_date('${store}'),'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot('${store}',public.store_local_date('${store}')));
    commit;`);
  const auth = `set local role authenticated; set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}';`;
  const month = q(`select public.store_local_month('${store}');`);
  const body = JSON.stringify({ contract_version: 2, patch: 'full', id: recipe, expected_revision: '1', request_id: randomUUID(),
    name: 'Concurrent menu', price: 2000, base_servings: 1, target_profit_rate: 30, lines: [], extras: [] });
  const save = kind === 'fixed'
    ? `select public.save_fixed_costs('${store}','${month}',1000,'[{"key":"rent","total":200}]');`
    : `select public.save_recipe('${store}','${body}'::jsonb);`;
  const close = `select public.transition_business_state('${store}','end');`;
  const firstName = `config-first-${randomUUID()}`; const secondName = `config-second-${randomUUID()}`;
  const a = session(firstName, `begin; ${auth} ${order === 'save-first' ? save : close} select 'READY';`, true);
  await a.ready;
  const b = session(secondName, `begin; ${auth} ${order === 'save-first' ? close : save} commit;`);
  let waited = false;
  for (let n = 0; n < 8 && !waited; n++) {
    waited = q(`select exists(select 1 from pg_stat_activity where application_name='${secondName}' and wait_event_type='Lock' and wait_event='advisory');`) === 't';
    if (!waited) await new Promise(resolve => setTimeout(resolve, 70));
  }
  a.release();
  await Promise.all([a.done, b.done]);
  if (!waited) throw new Error(`${order}: real lock wait was not observed`);
  const result = JSON.parse(q(`begin; ${auth}
    select jsonb_build_object('status',(select status from public.business_days where id='${day}'),
      'frozen_rate',(select snapshot->'fixed_rate' from public.business_days where id='${day}'),
      'fixed',(select fixed_cost from public.recipe_list('${store}') where id='${recipe}'),
      'mode',public.recipe_detail('${recipe}')->'application_mode',
      'trends',(select count(*) from public.profit_trends where recipe_id='${recipe}'),
      'cause',(select cause::text from public.profit_trends where recipe_id='${recipe}' order by occurred_at desc limit 1)); rollback;`));
  if (result.status !== 'closed' || result.frozen_rate !== 0.1 || result.fixed !== 200 || result.mode !== 'immediate' || result.trends !== 1 || result.cause !== kind)
    throw new Error(`${order}: ${JSON.stringify(result)}`);
  console.log(`PASS ${kind}/${order}: observed advisory lock wait; new cost applied; closed basis preserved; exactly one ${kind} trend`);
}
