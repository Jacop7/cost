import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const database=process.argv[2];
if (!/^fresh_[a-z0-9_]+$/.test(database ?? '')) throw Error('Fresh test database required');
const args=['exec','-i','supabase_db_costkeep','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'];
function sql(source) {
  const result=spawnSync('docker',args,{input:source,encoding:'utf8'});
  if (result.status) throw Error(result.stderr);
  return result.stdout.trim();
}
const owner=randomUUID(), recipe=randomUUID();
sql(`insert into auth.users(id) values('${owner}');`);
const claims=`select set_config('request.jwt.claims','{"sub":"${owner}","role":"authenticated"}',false);`;
const store=sql(`${claims} select public.create_store('메뉴 삭제 경합','Asia/Seoul')->>'store_id';`).split('\n').at(-1);
sql(`${claims} insert into public.recipes(id,store_id,name,price,base_servings) values('${recipe}','${store}','삭제 경합 메뉴',1000,1);`);

// A business transition owns the common lock first; deletion must see its committed
// open state instead of the pre-lock closed state. This never touches a live store.
const writer=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
let output='',errors='';
writer.stderr.on('data',data=>{errors+=data;});
const locked=new Promise((resolve,reject)=>{
  writer.stdout.on('data',data=>{output+=data; if(output.includes('DELETE_TEST_LOCKED')) resolve();});
  writer.on('error',reject);
  writer.on('exit',code=>{if(!output.includes('DELETE_TEST_LOCKED')) reject(Error(errors||`exit ${code}`));});
});
const finished=new Promise((resolve,reject)=>writer.on('exit',code=>code===0?resolve():reject(Error(errors))));
writer.stdin.write(`${claims} begin; select public.lock_business_scope('${store}'); select 'DELETE_TEST_LOCKED';\n`);
await locked;
const deleter=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
let deleteErrors='';
deleter.stderr.on('data',data=>{deleteErrors+=data;});
const deleted=new Promise(resolve=>deleter.on('exit',resolve));
deleter.stdin.end(`\\set VERBOSITY verbose\n${claims} set role authenticated; select public.delete_recipe('${store}','${recipe}','1');`);
writer.stdin.end(`select pg_sleep(0.5); insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
  values('${store}',public.store_local_date('${store}'),'open',clock_timestamp()+interval '1 hour','{}'); commit;`);
await finished;
assert.notEqual(await deleted,0);
assert.match(deleteErrors,/RECIPE_DELETE_DURING_BUSINESS/);
assert.equal(sql(`select deleted_at is null and active from public.recipes where id='${recipe}'`),'t');
console.log('PASS business start / delete race: opening commit blocks deletion and preserves menu');
