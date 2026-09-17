// Real two-session completion/cancellation ordering, synthetic fresh_* DB only.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const db = process.argv[2];
if (!/^fresh_[a-z0-9_]+$/.test(db ?? '')) throw Error('Disposable fresh_* DB required');
const args = ['exec','-i',process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_costkeep','psql','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-qAt'];
function q(sql) {
  const r=spawnSync('docker',args,{input:sql,encoding:'utf8'});
  if(r.status!==0) throw Error(r.stderr); return r.stdout.trim();
}
function session(name,sql,hold=false) {
  const child=spawn('docker',args); let out='',err='',ready;
  const started=new Promise(resolve=>{ready=resolve;});
  const timer=setTimeout(()=>child.kill(),30000);
  child.stdout.on('data',b=>{out+=b;if(out.includes('READY')) ready();});
  child.stderr.on('data',b=>{err+=b;});
  const done=new Promise((resolve,reject)=>{
    child.on('error',reject);
    child.on('close',code=>{clearTimeout(timer);ready();code===0?resolve(out):reject(Error(err));});
  });
  done.catch(()=>{});
  child.stdin.write(`set application_name='${name}'; ${sql}\n`);
  if(!hold) child.stdin.end();
  return {started,done,release:()=>child.stdin.end('commit;\n')};
}
for(const kind of ['deduct','discard']) for(const order of ['inbound-first','resolution-first']) {
  const actor=randomUUID(),key=randomUUID();
  const auth=`set local role authenticated;set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}';`;
  const store=q(`begin;insert into auth.users(id) values('${actor}');${auth}select public.create_store('입고 확인 경합','Asia/Seoul')->>'store_id';commit;`);
  const ingredient=q(`begin;${auth}select save_ingredient('${store}','{"name":"입고 경합 재료","base_unit":"g","per_volume":1}');commit;`);
  q(`begin;${auth}select quick_inbound('${store}','${ingredient}',1000,4000,1,null,null,'seed');commit;`);
  const inbound=`select change_stock_quantity('${ingredient}','${kind}',100,1000,'시험','${key}');`;
  const resolve=`select resolve_stock_quantity('${store}','${ingredient}','${key}');`;
  const guardedInbound=`do $$ begin perform change_stock_quantity('${ingredient}','${kind}',100,1000,'시험','${key}'); raise exception 'late inbound was accepted'; exception when sqlstate '45010' then null; end $$;`;
  const firstName='inbound-first-'+randomUUID(),secondName='inbound-second-'+randomUUID();
  const first=session(firstName,`begin;${auth}${order==='inbound-first'?inbound:resolve}select 'READY';`,true);
  await first.started;
  const second=session(secondName,`begin;${auth}${order==='inbound-first'?resolve:guardedInbound}commit;`);
  let blocked=false;
  try {
    for(let n=0;n<20&&!blocked;n++) {
      blocked=q(`select exists(select 1 from pg_stat_activity a join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid)) where a.application_name='${secondName}' and b.application_name='${firstName}' and a.wait_event_type='Lock');`)==='t';
      if(!blocked) await new Promise(r=>setTimeout(r,60));
    }
  } finally {first.release();}
  const [,secondOutput]=await Promise.all([first.done,second.done]);
  if(!blocked) throw Error('No observed lock wait');
  const events=Number(q(`select count(*) from inventory_events where store_id='${store}' and type in ('discard','stocktake');`));
  if(events!==(order==='inbound-first'?1:0)) throw Error('Unexpected ledger count '+events);
  if(order==='inbound-first'&&!secondOutput.includes('recorded')) throw Error('Receipt not returned');
  const stock=Number(q(`select stock_total from inventory_states where ingredient_id='${ingredient}';`));
  if(stock!==(order==='inbound-first'?900:1000))throw Error('Unexpected stock '+stock);
  console.log(`PASS ${kind} ${order}: observed session lock, ledger=${events}, no duplicate or delayed inbound`);
}
