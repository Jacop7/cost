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
  if(rejected) {
    const expectedCode=rejected===true?'40001':rejected;
    assert.match(expectedCode,/^[A-Z0-9]{5}$/, 'Expected a SQLSTATE error code');
    assert.notEqual(br.code,0);
    assert.match(br.errors,new RegExp(`\\b${expectedCode}\\b`));
  }
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
// 0196: competing edit snapshots must be checked after the ingredient row lock.
const row=id=>JSON.parse(q(`select to_jsonb(i) from ingredients i where id=${quote(id)}`));
const memo=(id,value,expected)=>`select save_ingredient('${store}',${quote(JSON.stringify({ id, patch:'memo', memo:value, expected_memo:expected }))}::jsonb)`;
function form(snapshot, name) {
  const expected=Object.fromEntries(['name','category_id','base_unit','per_volume','purchase_price',
    'safety_stock','min_order_qty','default_vendor_id','memo'].map(key=>[key,snapshot[key]]));
  return `select save_ingredient('${store}',${quote(JSON.stringify({ ...expected, id:snapshot.id, name, expected }))}::jsonb)`;
}
function editState(id) {
  return {
    inventory:q(`select jsonb_build_object('events',(select count(*) from inventory_events where ingredient_id=${quote(id)}),
      'sum',(select coalesce(sum(count_delta),0) from inventory_events where ingredient_id=${quote(id)}),
      'state',(select to_jsonb(s) from inventory_states s where ingredient_id=${quote(id)}))`),
    changes:Number(q(`select count(*) from entity_change_events where entity_id=${quote(id)}`)),
  };
}
function preservedEditFields(before, after, changed=[]) {
  const ignore=new Set(['updated_at',...changed]);
  const comparable=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!ignore.has(key)));
  assert.deepEqual(comparable(after),comparable(before),'Unrelated ingredient fields changed');
}
{
  const id=ingredient('메모동시수정');
  const before=row(id), initial=editState(id);
  await race('메모 A와 오래된 메모 B',memo(id,'먼저 저장한 메모',before.memo),memo(id,'오래된 메모',before.memo),true);
  const after=row(id);
  assert.equal(after.memo,'먼저 저장한 메모');
  preservedEditFields(before,after,['memo']);
  assert.deepEqual(editState(id),initial,'Memo conflict wrote inventory or change history');
}
{
  const id=ingredient('메모와전체폼');
  const before=row(id), initial=editState(id);
  await race('메모 A와 오래된 전체 폼 B',memo(id,'새 메모',before.memo),form(before,`${before.name}-stale`),true);
  const after=row(id);
  assert.equal(after.memo,'새 메모');
  assert.equal(after.name,before.name);
  preservedEditFields(before,after,['memo']);
  assert.deepEqual(editState(id),initial,'Rejected full form wrote inventory or change history');
}
{
  const id=ingredient('이름과메모');
  const before=row(id), initial=editState(id);
  await race('이름 수정 A와 독립 메모 B',form(before,`${before.name}-new`),memo(id,'독립 메모',before.memo));
  const after=row(id), final=editState(id);
  assert.equal(after.name,`${before.name}-new`);
  assert.equal(after.memo,'독립 메모');
  preservedEditFields(before,after,['name','memo']);
  assert.equal(final.inventory,initial.inventory,'Name/memo edits wrote inventory');
  assert.equal(final.changes,initial.changes+1,'Only the name edit should record a change event');
}
// 0197: an inactive target must be rejected after the waiting writer obtains the lock.
for(const kind of ['memo','form']) {
  for(const deactivateFirst of [true,false]) {
    const label=`삭제경합-${kind}-${deactivateFirst?'삭제먼저':'수정먼저'}`;
    const id=ingredient(label);
    q(`${auth} ${inbound(id,`${label}-initial`)};`);
    const before=row(id), initial=editState(id);
    const edit=kind==='memo'?memo(id,'삭제 경합 메모',before.memo):form(before,`${before.name}-edited`);
    const deactivate=`select deactivate_ingredient(${quote(id)})`;
    await race(deactivateFirst?`삭제 A와 ${kind} 수정 B`:`${kind} 수정 A와 삭제 B`,
      deactivateFirst?deactivate:edit, deactivateFirst?edit:deactivate, deactivateFirst?'P0002':false);
    const after=row(id), final=editState(id);
    assert.equal(after.active,false,'A concurrent edit revived a deactivated ingredient');
    if(deactivateFirst) {
      preservedEditFields(before,after,['active']);
      assert.equal(final.changes,initial.changes,'Rejected inactive edit recorded a change event');
    } else {
      assert.equal(after.memo,kind==='memo'?'삭제 경합 메모':before.memo);
      assert.equal(after.name,kind==='form'?`${before.name}-edited`:before.name);
      preservedEditFields(before,after,['active',kind==='memo'?'memo':'name']);
      assert.equal(final.changes,initial.changes+(kind==='form'?1:0),
        'Only a successful full-form edit should record a change event');
    }
    assert.equal(final.inventory,initial.inventory,'Deactivation/edit race changed prior inventory');
    check(id,1000,1);
  }
}
console.log('PASS 15개 경합 시나리오·원장 합계·입고 건수·수정 충돌·삭제 경합 — 사용자 DB 미접근');
