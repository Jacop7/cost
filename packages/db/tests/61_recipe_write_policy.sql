-- 0204 candidate v8 policy/actor regression; independent rollback by runner.
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
-- 관측 전용. 고정 표의 모든 행과 ACL/trigger/FK를 읽으며 제품 쓰기에는 사용하지 않는다.
create function pg_temp.inspect_fixture_scope() returns jsonb language sql security definer
set search_path=pg_catalog,public,pg_temp as $scope$
select jsonb_build_object(
'public.stores',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.stores t),
'public.store_lifecycle_events',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.store_lifecycle_events t),
'auth.users',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from auth.users t),
'auth.identities',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from auth.identities t),
'public.settings',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.settings t),
'public.operating_rules',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.operating_rules t),
'public.store_time_settings',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.store_time_settings t),
'public.categories',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.categories t),
'public.materials',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.materials t),
'public.recipes',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.recipes t),
'public.recipe_lines',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.recipe_lines t),
'public.recipe_extra_costs',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.recipe_extra_costs t),
'public.recipe_write_receipts',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.recipe_write_receipts t),
'public.entity_change_events',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.entity_change_events t),
'public.price_trends',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.price_trends t),
'public.profit_trends',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.profit_trends t),
'public.inventory_events',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.inventory_events t),
'public.inventory_states',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.inventory_states t),
'public.business_days',(select jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''))) from public.business_days t),
'relationAcl',(select md5(coalesce(jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.oid)::text,'')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth')),
'columnAcl',(select md5(coalesce(jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attacl) order by a.attrelid,a.attnum)::text,'')) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth') and a.attnum>0),
'triggers',(select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.oid)::text,'')) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth')),
'constraints',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by c.oid)::text,'')) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','auth')),
'schemaAcl',(select md5(coalesce(jsonb_agg(jsonb_build_array(oid,nspowner,nspacl) order by oid)::text,'')) from pg_namespace where nspname in ('public','auth'))
) || jsonb_build_object('physicalWrites',
  (select coalesce(jsonb_agg(jsonb_build_array(schemaname,relname,n_tup_ins,n_tup_upd,n_tup_del)
    order by schemaname,relname),'[]'::jsonb) from pg_stat_xact_all_tables where schemaname in ('public','auth')));
$scope$;
grant execute on function pg_temp.inspect_fixture_scope() to authenticated,service_role;
set local role authenticated;

-- 정상 제품 정책 시험. 이 블록은 원래 core와 별도 트랜잭션에서 실행 후 rollback한다.
do $policy_fixture$
declare
  store_a uuid := '00000000-0000-0000-0000-0000000000b1';
  actor_a uuid := '00000000-0000-0000-0000-0000000000a1';
  actor_b uuid := gen_random_uuid(); actor_c uuid := gen_random_uuid();
  store_b uuid; recipe_a uuid; recipe_b uuid;
  created jsonb; body jsonb; before_denial jsonb;
begin
  set local role postgres;
  perform pg_temp.check_that(session_user='postgres' and current_user='postgres',
    '정상 정책 fixture 초기화는 로컬 postgres 세션');
  perform pg_temp.check_that(exists(select 1 from public.stores st
    where st.id=store_a and st.owner_id=actor_a and st.archived_at is null), '기존 A/SA 소유권 전제');
  perform pg_temp.check_that(exists(select 1 from pg_trigger
    where tgrelid='public.stores'::regclass and tgname='stores_10_owner_lifecycle_guard'
      and tgfoid='public.store_owner_lifecycle_guard()'::regprocedure and tgenabled in ('O','A')),
    '정상 owner lifecycle trigger 활성 전제');
  select r.id into strict recipe_a from public.recipes r where r.store_id=store_a order by r.id limit 1;
  -- 로컬 prepare의 auth.users 최소 구조만 사용한다. hosted auth 초기화 계약으로 일반화하지 않는다.
  insert into auth.users(id) values(actor_b),(actor_c);
  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_b,'role','authenticated')::text,true);
  perform pg_temp.check_that(current_user='authenticated' and auth.uid()=actor_b,'B 실제 호출 역할/JWT');
  created := public.create_store('F2 정상 정책 매장 '||actor_b::text,'Asia/Seoul');
  store_b := (created->>'store_id')::uuid;
  perform pg_temp.check_that((created->>'created')::boolean and store_b is not null and store_b<>store_a,
    '공개 create_store가 별도 SB를 새로 생성');
  perform pg_temp.check_that(created->>'timezone'='Asia/Seoul','공개 create_store 시간대');
  set local role postgres;
  perform pg_temp.check_that(exists(select 1 from public.settings x where x.store_id=store_b)
    and exists(select 1 from public.operating_rules x where x.store_id=store_b)
    and exists(select 1 from public.store_time_settings x where x.store_id=store_b
      and x.timezone='Asia/Seoul' and x.confirmed), '새 매장 bootstrap 세 표');
  before_denial := pg_temp.inspect_fixture_scope();
  perform pg_temp.expect_error(format('update public.stores as st set owner_id=%L::uuid where st.id=%L::uuid',actor_c,store_b),
    '42501','소유권','STORE_OWNERSHIP_TRANSFER_FORBIDDEN');
  perform pg_temp.check_that(pg_temp.inspect_fixture_scope()=before_denial,
    '거부된 B→C 이전은 행/receipt/손익/감사/물리 쓰기 불변');
  perform pg_temp.check_that(exists(select 1 from public.stores st where st.id=store_b and st.owner_id=actor_b),
    '이전 거부 후 SB owner B 유지');
  set local role authenticated;
  perform pg_temp.check_that(current_user='authenticated' and auth.uid()=actor_b,'정상 쓰기는 B authenticated');
  body := jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
    'name','F2 B 자기매장 메뉴 '||actor_b::text,'price',12000,'base_servings',1,'target_profit_rate',30,
    'lines','[]'::jsonb,'extras','[]'::jsonb);
  recipe_b := public.save_recipe(store_b,body);
  perform pg_temp.check_that(recipe_b is not null and public.recipe_detail(recipe_b)->>'edit_revision'='1',
    'B 자기 매장 정상 v2 create와 읽기');
  before_denial := pg_temp.inspect_fixture_scope();
  body := body||jsonb_build_object('request_id',gen_random_uuid()::text,'name','F2 B 타매장 접근');
  perform pg_temp.expect_error(format('select public.save_recipe(%L::uuid,%L::jsonb)',store_a,body),
    '42501','이 매장에 대한 권한');
  perform pg_temp.check_that(public.recipe_detail(recipe_a) is null,'B의 A 매장 recipe_detail은 RLS null');
  perform pg_temp.check_that(pg_temp.inspect_fixture_scope()=before_denial,
    '타매장 쓰기 거부/읽기는 기존 SA와 모든 관측 행/receipt/물리 쓰기 불변');
  set local role postgres;
  perform pg_temp.check_that(exists(select 1 from public.stores st where st.id=store_a and st.owner_id=actor_a)
    and exists(select 1 from public.stores st where st.id=store_b and st.owner_id=actor_b), 'A/SA와 B/SB 소유권 유지');
  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_a,'role','authenticated')::text,true);
  perform pg_temp.check_that(current_user='authenticated' and auth.uid()=actor_a
    and public.recipe_detail(recipe_a) is not null,'정상 A 역할/JWT와 읽기 복구');
end $policy_fixture$;
