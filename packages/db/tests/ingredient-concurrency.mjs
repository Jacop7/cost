// Real two-session locking. Synthetic fixtures only; refuses the live database.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';

const db = process.argv[2];
assert.match(db ?? '', /^fresh_[a-z0-9_]+$/);
const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';
const store = '00000000-0000-0000-0000-0000000000b1';
const auth = `set request.jwt.claims='{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}'; set role authenticated;`;
const args = ['exec','-i',container,'psql','-U','postgres','-d',db,'-qAt','-v','ON_ERROR_STOP=1'];
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const runId = Date.now().toString(36);
function q(sql) {
  const r = spawnSync('docker',args,{input:sql,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  return r.stdout.trim();
}
function session(name, sql) {
  let output = '', errors = '', readyResolve;
  const ready = new Promise(resolve => { readyResolve=resolve; });
  const child=spawn('docker',args);
  child.stdout.on('data', chunk => { output+=chunk; if(output.includes('HELD')) readyResolve(); });
  child.stderr.on('data', chunk => { errors+=chunk; });
  const done=new Promise(resolve => child.on('close',code => { readyResolve(); resolve({code,output,errors}); }));
  child.stdin.end(`\\set VERBOSITY verbose\nset application_name=${quote(name)}; set statement_timeout='10s'; ${auth} ${sql}`);
  return {ready,done};
}
async function race(label, first, second, rejected=false) {
  const a=session(`ing-a-${runId}`,`begin; ${first}; select 'HELD'; select pg_sleep(2); commit;`);
  await a.ready;
  const bName=`ing-b-${runId}`;
  const b=session(bName,second);
  let waited=false;
  for(let n=0;n<12;n++) {
    waited=q(`select exists(select 1 from pg_stat_activity where application_name=${quote(bName)} and wait_event_type='Lock')`)==='t';
    if(waited) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  const [ar,br]=await Promise.all([a.done,b.done]);
  assert.equal(ar.code,0,ar.errors);
  assert.ok(waited,`${label}: actual lock wait not observed`);
  if(rejected) { assert.notEqual(br.code,0); assert.match(br.errors,/40001/); }
  else assert.equal(br.code,0,br.errors);
  console.log(`PASS ${label} — 실제 잠금 대기 관측`);
}
function ingredient(label) {
  return q(`${auth} select save_ingredient('${store}',jsonb_build_object('name',${quote(`경합-${runId}-${label}`)},'base_unit','g','per_volume',1000,'safety_stock',0,'min_order_qty',1));`);
}
const inbound=(id,key,volume=1000)=>`select quick_inbound('${store}','${id}',${volume},4000,1,null,null,${quote(`${runId}-${key}`)})`;
const change=(id,kind,key,expected=1000)=>`select change_stock_quantity('${id}',${quote(kind)},100,${expected},'경합 시험 사유',${quote(`${runId}-${key}`)})`;
function check(id,stock,orders) {
  assert.equal(Number(q(`select stock_total from inventory_states where ingredient_id='${id}'`)),stock);
  assert.equal(Number(q(`select sum(count_delta) from inventory_events where ingredient_id='${id}'`)),stock);
  if(orders!==undefined) assert.equal(Number(q(`select count(*) from order_records where ingredient_id='${id}'`)),orders);
}
const same=ingredient('동일입고');
await race('같은 키 입고 재시도',inbound(same,'same'),inbound(same,'same'));
check(same,1000,1);
const separate=ingredient('별도입고');
await race('동일 값 별도 입고',inbound(separate,'separate-a'),inbound(separate,'separate-b'));
check(separate,2000,2);
for(const kind of ['deduct','discard']) {
  const id=ingredient(kind);
  q(`${auth} ${inbound(id,`${kind}-initial`)};`);
  await race(`입고와 ${kind} 경합`,inbound(id,`${kind}-concurrent`,200),change(id,kind,`${kind}-stale`),true);
  check(id,1200,2);
  await race(`${kind} 동일 요청 재시도`,change(id,kind,`${kind}-retry`,1200),change(id,kind,`${kind}-retry`,1200));
  check(id,1100,2);
  await race(`${kind} 별도 요청의 오래된 확인`,change(id,kind,`${kind}-first`,1100),change(id,kind,`${kind}-second`,1100),true);
  check(id,1000,2);
}
console.log('PASS 8개 경합 시나리오·원장 합계·입고 건수 — 사용자 DB 미접근');
