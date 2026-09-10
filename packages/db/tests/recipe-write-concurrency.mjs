/** 0204 real-session CAS/replay races. Commits fixtures; explicit local fresh_* only. */
import { spawn,spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { recipeWriteSessionName } from './recipe-write-session-name.mjs';
const db=process.argv[2],container=process.env.SUPABASE_DB_CONTAINER??'supabase_db_margincook';
assert.match(db??'',/^fresh_[a-zA-Z0-9_]+$/);assert.match(container,/^[a-zA-Z0-9_-]+$/);
const context=spawnSync('docker',['context','inspect'],{encoding:'utf8',timeout:10000});
assert.equal(context.status,0);assert.match(JSON.parse(context.stdout)[0].Endpoints.docker.Host,/^(npipe:|unix:)/);
const args=['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const store='00000000-0000-0000-0000-0000000000b1',actor='00000000-0000-0000-0000-0000000000a1';
const auth=`set local role authenticated;set local request.jwt.claims=${lit(JSON.stringify({sub:actor,role:'authenticated'}))};`;
function q(sql){const x=spawnSync('docker',args,{input:sql,encoding:'utf8',timeout:10000});assert.equal(x.status,0,x.stderr);return x.stdout.trim();}
assert.equal(q(`select to_regclass('public.recipe_write_receipts') is not null`),'t');
const call=b=>`select public.save_recipe(${lit(store)}::uuid,${lit(JSON.stringify(b))}::jsonb)`;
const create=()=>({contract_version:2,patch:'create',request_id:randomUUID(),name:'0204 race '+randomUUID(),price:12000,base_servings:1,target_profit_rate:30});
function session(label){
 const name=recipeWriteSessionName();const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='',closed=false;
 p.stdout.on('data',d=>{out+=d});p.stderr.on('data',d=>{err+=d});
 const done=new Promise(resolve=>p.on('close',code=>{closed=true;resolve({code,out,err})}));
 p.stdin.write(`set application_name=${lit(name)};set statement_timeout='12s';set idle_in_transaction_session_timeout='12s';begin;${auth}
`);
 return {name,p,done,get out(){return out},get err(){return err},get closed(){return closed},send(sql){p.stdin.write(sql+'\n')},end(){p.stdin.end()},async close(){if(!closed && !p.stdin.writableEnded){p.stdin.end('rollback;\n\\q\n');}return done;}};
}
async function until(fn,label){const deadline=Date.now()+7000;while(Date.now()<deadline){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Missing barrier: '+label);}
async function race(label,first,second,conflict){
 const a=session(label+'A'),b=session(label+'B');let observation;
 try{
  a.send(call(first)+';\n\\echo READY');await until(()=>a.out.includes('READY')||a.closed,'A ready');assert.ok(a.out.includes('READY'),a.err);
  b.send(call(second)+';commit;');b.end();
  await until(()=>{assert.equal(b.closed,false,b.err);observation=JSON.parse(q(`select jsonb_build_object('a',a.pid,'b',b.pid,'blocked',a.pid=any(pg_blocking_pids(b.pid))) from pg_stat_activity a,pg_stat_activity b where a.application_name=${lit(a.name)} and b.application_name=${lit(b.name)};`)||'null');return observation?.blocked===true;},'B actually waits on A');
  assert.notEqual(observation.a,observation.b);a.send('commit;');a.end();const [ar,br]=await Promise.all([a.done,b.done]);assert.equal(ar.code,0,ar.err);
  const id=ar.out.split('\n').find(x=>/^[0-9a-f-]{36}$/.test(x));assert.ok(id);
  if(conflict){assert.notEqual(br.code,0);assert.match(br.err,/45009/);assert.match(br.err,/DETAIL:.*REVISION_CONFLICT/);}
  else {assert.equal(br.code,0,br.err);assert.equal(br.out.trim(),id);}
  const receiptCount=Number(q(`select count(*) from public.recipe_write_receipts where store_id=${lit(store)} and request_id in (${lit(first.request_id)},${lit(second.request_id)});`));assert.equal(receiptCount,1);
  console.log(JSON.stringify({label,observation,result:'PASS',id,receiptCount}));return id;
 }finally{await a.close();await b.close();}
}
const sameCreate=create();const id=await race('same-create',sameCreate,sameCreate,false);
const active={contract_version:2,patch:'active',request_id:randomUUID(),id,expected_revision:'1',active:false};
await race('same-active',active,active,false);
assert.equal(q(`select active::text||':'||edit_revision::text from public.recipes where id=${lit(id)}`),'false:2');
const resume={...active,request_id:randomUUID(),expected_revision:'2',active:true};
await race('different-active-same-basis',resume,{...resume,request_id:randomUUID(),active:false},true);
assert.equal(q(`select active::text||':'||edit_revision::text from public.recipes where id=${lit(id)}`),'true:3');
const full={...sameCreate,patch:'full',request_id:randomUUID(),id,expected_revision:'3',price:13000};
await race('full-vs-memo',full,{contract_version:2,patch:'memo',request_id:randomUUID(),id,expected_revision:'3',memo:'stale'},true);
assert.equal(q(`select price::text||':'||edit_revision::text from public.recipes where id=${lit(id)}`),'13000:4');
console.log('PASS recipe v2 two-session contracts');
