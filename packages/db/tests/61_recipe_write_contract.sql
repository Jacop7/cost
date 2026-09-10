-- 0204 core contracts promoted from isolated candidate v8; fresh execution required.
set local role postgres;
set local statement_timeout='20s';
set local lock_timeout='5s';
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

create function pg_temp.check_that(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'F2_ASSERT: %',label; end if; end $$;
create function pg_temp.expect_error(sql text,code text,message_part text default null,exact_detail text default null)
returns void language plpgsql as $$
declare got text; msg text; got_detail text;
begin
  begin execute sql;
  exception when others then
    get stacked diagnostics got=returned_sqlstate,msg=message_text,got_detail=pg_exception_detail;
  end;
  if got is distinct from code
     or (message_part is not null and position(message_part in coalesce(msg,''))=0)
     or (exact_detail is not null and got_detail is distinct from exact_detail) then
    raise exception 'F2_ASSERT expected % / % / DETAIL %, got % / % / DETAIL %',
      code,message_part,exact_detail,got,msg,got_detail;
  end if;
end $$;
-- Privileged OBSERVATION only, not used to execute product mutations.
create function pg_temp.inspect_recipe(id uuid) returns jsonb language sql security definer
set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object(
  'recipe',(select to_jsonb(r) from public.recipes r where r.id=$1),
  'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.recipe_lines l where l.recipe_id=$1),
  'extras',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.recipe_extra_costs e where e.recipe_id=$1),
  'profits',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.profit_trends t where t.recipe_id=$1),
  'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.entity_change_events a where a.entity_id=$1),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(x) order by x.request_id),'[]') from public.recipe_write_receipts x where x.result_id=$1),
  -- now() is constant inside this transaction. Transaction-local physical write
  -- counters also catch an UPDATE that happened to leave every column identical.
  'writeCounts',(select jsonb_agg(jsonb_build_array(relname,n_tup_ins,n_tup_upd,n_tup_del) order by relname)
    from pg_stat_xact_user_tables where schemaname='public' and relname in
      ('recipes','recipe_lines','recipe_extra_costs','profit_trends','entity_change_events')));
$$;
-- v6 미실행 초안: 현재 세션의 실제 임시 namespace에 USAGE만 부여한다.
do $temp_usage$
declare actual_name name;
begin
  select nspname into strict actual_name from pg_namespace where oid=pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated,service_role',actual_name);
end $temp_usage$;
grant execute on function pg_temp.check_that(boolean,text),pg_temp.expect_error(text,text,text,text),pg_temp.inspect_recipe(uuid)
  to authenticated,service_role;
set local role authenticated;

do $core$
declare
 s uuid := '00000000-0000-0000-0000-0000000000b1';
 actor_a uuid := '00000000-0000-0000-0000-0000000000a1'; actor_b uuid := gen_random_uuid();
 id uuid; deleted_id uuid; second_id uuid; t text; privilege_name text;
 create_body jsonb; first_full jsonb; body jsonb; old_state jsonb; new_state jsonb;
 revision text; deleted_rows int;
begin
 perform pg_temp.check_that(current_user='authenticated','actual product calls use authenticated');
 create_body := jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
   'name','F2 core '||gen_random_uuid()::text,'price',12000,'base_servings',1,'target_profit_rate',30,
   'lines','[]'::jsonb,'extras',jsonb_build_array(
       jsonb_build_object('name','fraction','qty',1::numeric/3,'amount',100),
       jsonb_build_object('name','other','qty',2,'amount',50)));
 id := public.save_recipe(s,create_body);
 perform pg_temp.check_that(recipe_detail(id)->>'edit_revision'='1','create revision exactly one');
 old_state := pg_temp.inspect_recipe(id);
 perform pg_temp.check_that(jsonb_array_length(old_state->'receipts')=1,'one create receipt');

 -- One changed full request, then a stale request from the SAME captured basis.
 first_full := (create_body-array['request_id','patch']) || jsonb_build_object(
   'patch','full','id',id,'request_id',gen_random_uuid()::text,'expected_revision','1','price',13000);
 perform public.save_recipe(s,first_full);
 perform pg_temp.check_that(recipe_detail(id)->>'edit_revision'='2','full change increments exactly once');
 old_state := pg_temp.inspect_recipe(id);
 body := first_full || jsonb_build_object('request_id',gen_random_uuid()::text,'memo','stale');
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,body),'45009','다른 곳에서','REVISION_CONFLICT');
 perform pg_temp.check_that(pg_temp.inspect_recipe(id)=old_state,'stale request writes nothing including receipt');

 -- Same content in reversed extras order: no-op must keep all IDs and timestamps.
 body := first_full || jsonb_build_object('request_id',gen_random_uuid()::text,'expected_revision','2',
   'extras',jsonb_build_array((first_full->'extras')->1,(first_full->'extras')->0));
 perform public.save_recipe(s,body);
 new_state := pg_temp.inspect_recipe(id);
 perform pg_temp.check_that(new_state-'receipts'=old_state-'receipts','normalized no-op does not churn rows/profit/audit/time');
 perform pg_temp.check_that(jsonb_array_length(new_state->'receipts')=jsonb_array_length(old_state->'receipts')+1,'new no-op key creates one receipt');
 perform pg_temp.check_that(recipe_detail(id)->>'edit_revision'='2','no-op revision unchanged');

 -- Strict fingerprint presence differs even if semantic result would be unchanged.
 old_state := new_state;
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,body||jsonb_build_object('memo',null)),'22000','요청 ID');
 perform pg_temp.check_that(pg_temp.inspect_recipe(id)=old_state,'fingerprint mismatch writes nothing');
 body := first_full || jsonb_build_object('request_id',gen_random_uuid()::text,'expected_revision','2','price',14000);
 perform public.save_recipe(s,body);
 old_state := pg_temp.inspect_recipe(id);
 perform pg_temp.check_that(public.save_recipe(s,first_full)=id,'exact old receipt returns original UUID after newer edit');
 perform pg_temp.check_that(pg_temp.inspect_recipe(id)=old_state,'replay preserves newer edit and all receipts');

 -- Inactive exact replay and ordinary explicit resume are separate contracts.
 revision := recipe_detail(id)->>'edit_revision';
 body := jsonb_build_object('contract_version',2,'patch','active','request_id',gen_random_uuid()::text,
    'id',id,'expected_revision',revision,'active',false);
 perform public.save_recipe(s,body);
 old_state := pg_temp.inspect_recipe(id);
 perform pg_temp.check_that(public.save_recipe(s,create_body)=id,'inactive exact create replay allowed');
 perform pg_temp.check_that(pg_temp.inspect_recipe(id)=old_state,'inactive replay is no-write');
 body := body||jsonb_build_object('request_id',gen_random_uuid()::text,'expected_revision',recipe_detail(id)->>'edit_revision','active',true);
 perform public.save_recipe(s,body);
 perform pg_temp.check_that((recipe_detail(id)->>'active')::boolean,'normal resume succeeds');
 perform pg_temp.check_that((recipe_detail(id)->>'edit_revision')::bigint=revision::bigint+2,'stop and resume each increment once');

 -- Children-only changes and narrow memo writes each own one aggregate revision.
 revision := recipe_detail(id)->>'edit_revision';
 body := (create_body-array['request_id','patch']) || jsonb_build_object(
   'patch','full','id',id,'request_id',gen_random_uuid()::text,'expected_revision',revision,'price',14000,
   'extras',jsonb_build_array(jsonb_build_object('name','fraction','qty',1::numeric/3,'amount',101),
                             jsonb_build_object('name','other','qty',2,'amount',50)));
 perform public.save_recipe(s,body);
 perform pg_temp.check_that((recipe_detail(id)->>'edit_revision')::bigint=revision::bigint+1,'children-only full increments exactly once');
 revision := recipe_detail(id)->>'edit_revision';
 body := jsonb_build_object('contract_version',2,'patch','memo','request_id',gen_random_uuid()::text,
   'id',id,'expected_revision',revision,'memo','memo only');
 perform public.save_recipe(s,body);
 perform pg_temp.check_that((recipe_detail(id)->>'edit_revision')::bigint=revision::bigint+1,'memo increments exactly once');
 old_state := pg_temp.inspect_recipe(id);
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,
   body||jsonb_build_object('request_id',gen_random_uuid()::text,'memo','stale memo')),'45009','다른 곳에서','REVISION_CONFLICT');
 perform pg_temp.check_that(pg_temp.inspect_recipe(id)=old_state,'stale narrow memo writes nothing');

 -- Old envelopes and missing basis fail before a product mutation.
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,
   create_body-array['contract_version','request_id','patch']),'22000','v2 요청');
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,
   (body-'expected_revision')||jsonb_build_object('request_id',gen_random_uuid()::text)),'22000','기준판본');
 perform pg_temp.check_that(pg_temp.inspect_recipe(id)=old_state,'invalid protocol/basis writes nothing');

 -- A valid envelope must reach each original guard, not fail BASE_REQUIRED.
 body := create_body || jsonb_build_object('request_id',gen_random_uuid()::text,'name','   ');
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,body),'22000','메뉴 이름');
 body := create_body || jsonb_build_object('request_id',gen_random_uuid()::text,'name','negative','price',-1);
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,body),'22000','판매가');
 body := create_body || jsonb_build_object('request_id',gen_random_uuid()::text,'name','zero basis','base_servings',0);
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,body),'22000','기준 인분');

 -- No-op memo receipt with a truly deleted target; existing create replay tests stay above.
 -- Test-only initialization creates no E3/profit/audit history. Keep every FK and trigger enabled.
 set local role postgres;
 insert into public.recipes as fixture (store_id,name,price,base_servings,target_profit_rate,memo)
 values(s,'F2 no-op memo deleted target '||gen_random_uuid()::text,12000,1,30,'unchanged memo')
 returning fixture.id into deleted_id;
 set local role authenticated;
 perform pg_temp.check_that(current_user='authenticated','no-op memo receipt uses authenticated RPC');
 old_state := pg_temp.inspect_recipe(deleted_id);
 perform pg_temp.check_that(recipe_detail(deleted_id)->>'edit_revision'='1','minimal fixture has initial revision one');
 perform pg_temp.check_that(jsonb_array_length(old_state->'lines')=0 and jsonb_array_length(old_state->'extras')=0,
   'minimal fixture has no child references');
 perform pg_temp.check_that(jsonb_array_length(old_state->'profits')=0 and jsonb_array_length(old_state->'audit')=0
   and jsonb_array_length(old_state->'receipts')=0,'minimal fixture starts without history or receipt');
 body := jsonb_build_object('contract_version',2,'patch','memo','request_id',gen_random_uuid()::text,
   'id',deleted_id,'expected_revision',recipe_detail(deleted_id)->>'edit_revision',
   'memo',old_state#>'{recipe,memo}');
 perform pg_temp.check_that(public.save_recipe(s,body)=deleted_id,'same memo no-op returns the existing target');
 new_state := pg_temp.inspect_recipe(deleted_id);
 perform pg_temp.check_that(new_state-'receipts'=old_state-'receipts',
   'same memo creates no product/child/profit/audit/revision or physical write');
 perform pg_temp.check_that(jsonb_array_length(new_state->'receipts')=1,'same memo no-op creates exactly one receipt');
 perform pg_temp.check_that(new_state#>>'{receipts,0,patch}'='memo'
   and new_state#>>'{receipts,0,actor_id}'=actor_a::text
   and new_state#>>'{receipts,0,target_id}'=deleted_id::text
   and new_state#>>'{receipts,0,result_id}'=deleted_id::text
   and new_state#>>'{receipts,0,expected_revision}'=body->>'expected_revision'
   and new_state#>'{receipts,0,request_fingerprint}'=body,'real memo receipt preserves the exact request envelope');
 old_state := new_state;
 set local role postgres;
 delete from public.recipes where recipes.id=deleted_id;
 get diagnostics deleted_rows=row_count;
 perform pg_temp.check_that(deleted_rows=1,'a real recipe row was deleted');
 set local role authenticated;
 new_state := pg_temp.inspect_recipe(deleted_id);
 perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,body),'P0002','메뉴');
 perform pg_temp.check_that(pg_temp.inspect_recipe(deleted_id)=new_state,'deleted memo replay writes nothing');
 perform pg_temp.check_that(new_state->'recipe'='null'::jsonb,'deleted replay does not recreate recipe');
 perform pg_temp.check_that(new_state->'receipts'=old_state->'receipts','receipt survives target deletion unchanged');

 -- Effective privileges and actual SQL denial, distinct from RLS returning zero rows.
 foreach t in array array['recipes','recipe_lines','recipe_extra_costs','materials','categories'] loop
   foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
     perform pg_temp.check_that(has_table_privilege('margincook_rpc_executor','public.'||t,privilege_name),t||' executor '||privilege_name);
   end loop;
   perform pg_temp.expect_error(format('insert into public.%I select * from public.%I where false',t,t),'42501');
   perform pg_temp.expect_error(format('update public.%I set store_id=store_id where false',t),'42501');
   perform pg_temp.expect_error(format('delete from public.%I where false',t),'42501');
 end loop;
 perform pg_temp.check_that(has_function_privilege('authenticated','public.save_recipe(uuid,jsonb)','EXECUTE'),'authenticated facade grant');
 perform pg_temp.check_that(has_function_privilege('service_role','public.save_recipe(uuid,jsonb)','EXECUTE'),'service facade grant');
 perform pg_temp.expect_error('select * from public.recipe_write_receipts','42501');
 perform pg_temp.expect_error(format('select public.recipe_edit_apply_v2(%L,%L::jsonb)',s,create_body),'42501');
 set local role service_role;
 perform pg_temp.expect_error('select * from public.recipe_write_receipts','42501');
 set local role authenticated;
 perform pg_temp.check_that(current_user='authenticated','role restored after permission probes');
end $core$;

-- Additive read contract keeps bigint precision at both entry points.
set local role postgres;
do $read_revision$
declare s uuid:=pg_temp.store(); r uuid; q jsonb; b jsonb;
begin
  insert into public.recipes(store_id,name,price,edit_revision)
    values(s,'0204 big revision '||gen_random_uuid(),1000,9007199254740993) returning id into r;
  set local role authenticated;
  q:=public.recipe_detail(r);
  perform pg_temp.check_that(jsonb_typeof(q->'edit_revision')='string' and q->>'edit_revision'='9007199254740993','detail exact bigint string');
  perform pg_temp.check_that((select edit_revision='9007199254740993' from public.recipe_list(s) where id=r),'list exact bigint string');
  b:=jsonb_build_object('contract_version',2,'request_id',gen_random_uuid()::text,'patch','active',
    'id',r,'expected_revision','9007199254740993','active',false);
  perform pg_temp.check_that(public.save_recipe(s,b)=r,'active returns exact requested ID');
  perform pg_temp.check_that(public.recipe_detail(r)->>'edit_revision'='9007199254740994','active increments bigint once');
  perform pg_temp.check_that(public.save_recipe(s,b)=r and public.recipe_detail(r)->>'edit_revision'='9007199254740994','active exact replay preserves revision');
  perform pg_temp.expect_error(format('select public.save_recipe(%L,%L::jsonb)',s,b||jsonb_build_object('request_id',gen_random_uuid()::text)),
    '45009',null,'REVISION_CONFLICT');
end $read_revision$;
