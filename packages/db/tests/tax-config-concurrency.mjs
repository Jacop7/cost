import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const db=process.argv[2];
if(!/^fresh_[a-z0-9_]+$/.test(db??''))throw Error('A disposable fresh_ database is required');
const args=['exec','-i',process.env.SUPABASE_DB_CONTAINER??'supabase_db_margincook','psql','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1'];
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
function sync(sql){const r=spawnSync('docker',args,{input:sql,encoding:'utf8'});if(r.status)throw Error(r.stderr);return r.stdout.trim();}
function run(sql){const p=spawn('docker',args);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.stdin.end(sql);return new Promise(resolve=>p.on('close',code=>resolve({code,out,err})));}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(tag,event){for(let n=0;n<30;n++){if(sync(`select count(*) from pg_stat_activity where application_name=${literal(tag)} and ${event};`)==='1')return;await pause(30);}throw Error('Missing lock barrier '+tag);}
const rows=[];
for(const scenario of ['two-writers','save-then-close','close-then-save']){
 const owner=randomUUID(),tag=randomUUID();
 const auth=`set local margincook.international_tax_force='owner_test'; set local request.jwt.claims=${literal(JSON.stringify({sub:owner,role:'authenticated'}))};`;
 sync(`begin;insert into auth.users(id) values(${literal(owner)});${auth} select public.create_store('세금 경합','Asia/Seoul');commit;`);
 const store=sync(`select id from public.stores where owner_id=${literal(owner)};`);
 const market={country_code:'KR',region_code:null,currency_code:'KRW',business_locale_code:'ko-KR',price_basis:'tax_inclusive'};
 const tax={default_treatment:'taxable',components:[{key:'primary',kind:'primary',name:'부가세',rate_pct:10,jurisdiction_level:'national',calculation_basis:'primary_tax_exclusive',applies_to_treatments:['taxable'],sort_order:0,remittance:{hall:'merchant',delivery:'merchant',takeout:'merchant'}}],categories:[]};
 const result=sync(`begin;${auth} set local role authenticated; select public.save_tax_configuration(${literal(store)},${literal(JSON.stringify(market))},${literal(JSON.stringify(tax))},null,null,null,null);commit;`).split('\n').find(x=>x.startsWith('{'));
 const v=JSON.parse(result);
 const recipe=sync(`insert into public.recipes(store_id,name,price) values(${literal(store)},'경합 메뉴',12000) returning id;`).split('\n')[0];
 const day=sync(`begin;${auth} insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
   values(${literal(store)},public.store_local_date(${literal(store)}),'open',clock_timestamp()+interval '1 hour',public.build_day_snapshot(${literal(store)},public.store_local_date(${literal(store)}))) returning id;commit;`).split('\n').find(x=>/^[0-9a-f-]{36}$/.test(x));
 market.price_basis='tax_exclusive';tax.components[0].rate_pct=20;
 const save=`set local role authenticated;select public.save_tax_configuration(${literal(store)},${literal(JSON.stringify(market))},${literal(JSON.stringify(tax))},${literal(v.market_profile_id)},${v.market_revision},${literal(v.profile_id)},${v.revision});`;
 const close=`select public.close_business_day_row(${literal(day)},'manual');`;
 const a=run(`begin;set local application_name=${literal('tax-a-'+tag)};${auth}${scenario==='close-then-save'?close:save}select pg_sleep(2);commit;`);
 await wait('tax-a-'+tag,"wait_event='PgSleep'");
 const b=run(`begin;set local application_name=${literal('tax-b-'+tag)};${auth}${scenario==='save-then-close'?close:save}commit;`);
 await wait('tax-b-'+tag,"wait_event_type='Lock'");
 const [ra,rb]=await Promise.all([a,b]);
 if(ra.code|| (scenario==='two-writers'?(!rb.code||!rb.err.includes('REVISION_CONFLICT')):rb.code))throw Error(JSON.stringify({scenario,ra,rb}));
 const state=JSON.parse(sync(`begin;${auth} select jsonb_build_object('status',(select status from public.business_days where id=${literal(day)}),
 'opening_tax',(select snapshot#>>array['recipes',${literal(recipe)},'tax'] from public.business_days where id=${literal(day)}),
 'current_tax',public.recipe_tax_app_state(${literal(store)},${literal(recipe)})#>'{quote,tax_total}',
 'pending',public.last_entity_change(${literal(store)},'recipe',${literal(recipe)})->'has_pending_change');commit;`).split('\n').find(x=>x.startsWith('{')));
 if(Number(state.opening_tax)!==1091||Number(state.current_tax)!==(scenario==='two-writers'?1091:2400)||state.pending!==(scenario==='two-writers'))throw Error(JSON.stringify({scenario,state}));
 rows.push({scenario,lockObserved:true,conflict:scenario==='two-writers',...state,pass:true});
}
console.log(JSON.stringify({database:db,runAt:new Date().toISOString(),results:rows},null,2));
