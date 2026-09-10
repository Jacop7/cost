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

-- 의도적 합성 actor receipt 전제. 정상 발행 receipt 상태의 재현이 아니다.
-- 원래 core/정상 정책 시험과 별도 트랜잭션. 새 auth 사용자/recipe/receipt만 초기화 후 전체 rollback.
do $synthetic_actor_fixture$
declare
  store_a uuid := '00000000-0000-0000-0000-0000000000b1';
  actor_a uuid := '00000000-0000-0000-0000-0000000000a1';
  synthetic_actor_b uuid := gen_random_uuid();
  fixture_recipe_id uuid; request_key uuid := gen_random_uuid(); revision text;
  body jsonb; changed_body jsonb; before_call jsonb; initial_recipe jsonb;
begin
  set local role postgres;
  perform pg_temp.check_that(session_user='postgres' and current_user='postgres', '합성 초기화는 로컬 postgres 세션');
  perform pg_temp.check_that(exists(select 1 from public.stores st
    where st.id=store_a and st.owner_id=actor_a and st.archived_at is null), '현재 정상 owner A/SA');
  perform pg_temp.check_that(exists(select 1 from pg_class c
    where c.oid='public.recipe_write_receipts'::regclass and c.relowner='postgres'::regrole
      and c.relrowsecurity and not c.relforcerowsecurity), '합성 초기화의 기존 postgres 소유/비 FORCE RLS 전제');
  perform pg_temp.check_that(not exists(select 1 from pg_trigger
    where tgrelid='public.recipe_write_receipts'::regclass and not tgisinternal), 'receipt 사용자 trigger 없음 전제');
  perform pg_temp.check_that((select count(*)=1 from pg_constraint c
    where c.conrelid='public.recipe_write_receipts'::regclass and c.contype='f')
    and exists(select 1 from pg_constraint c where c.conrelid='public.recipe_write_receipts'::regclass
      and c.contype='f' and c.confrelid='public.stores'::regclass
      and c.conkey=array[(select attnum from pg_attribute
        where attrelid='public.recipe_write_receipts'::regclass and attname='store_id')]::smallint[]),
    'receipt FK는 store만 존재: actor/recipe FK 없음');
  insert into auth.users(id) values(synthetic_actor_b);
  insert into public.recipes as fixture (store_id,name,price,base_servings,target_profit_rate,memo)
    values(store_a,'F2 의도적 합성 actor target '||request_key::text,12000,1,30,'synthetic memo')
    returning fixture.id into fixture_recipe_id;
  initial_recipe := pg_temp.inspect_recipe(fixture_recipe_id);
  revision := initial_recipe#>>'{recipe,edit_revision}';
  perform pg_temp.check_that(revision='1' and jsonb_array_length(initial_recipe->'lines')=0
    and jsonb_array_length(initial_recipe->'extras')=0 and jsonb_array_length(initial_recipe->'profits')=0
    and jsonb_array_length(initial_recipe->'audit')=0 and jsonb_array_length(initial_recipe->'receipts')=0,
    '직접 recipe 초기화는 판본 1/자식·손익·감사·receipt 없음');
  body := jsonb_build_object('contract_version',2,'patch','memo','request_id',request_key::text,
    'id',fixture_recipe_id::text,'expected_revision',revision,'memo','synthetic memo');
  -- 새 행 한 개만 INSERT. 기존 정상 receipt UPDATE/DELETE, owner 변경, trigger/GUC/권한 변경 없음.
  insert into public.recipe_write_receipts(store_id,request_id,actor_id,target_id,result_id,patch,expected_revision,request_fingerprint)
    values(store_a,request_key,synthetic_actor_b,fixture_recipe_id,fixture_recipe_id,'memo',revision::bigint,body);
  perform pg_temp.check_that((select count(*)=1 from public.recipe_write_receipts x
    where x.store_id=store_a and x.request_id=request_key and x.actor_id=synthetic_actor_b
      and x.target_id=fixture_recipe_id and x.result_id=fixture_recipe_id and x.patch='memo'
      and x.expected_revision=revision::bigint and x.request_fingerprint=body), '합성 receipt 정확한 새 행/봉투');
  changed_body := body||jsonb_build_object('memo','different synthetic memo');
  perform pg_temp.check_that(changed_body is distinct from body
    and changed_body-'memo'=body-'memo', '두 번째 봉투는 유효한 memo 값만 달라 fingerprint가 다름');
  set local role authenticated;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_a,'role','authenticated')::text,true);
  perform pg_temp.check_that(current_user='authenticated' and auth.uid()=actor_a
    and public.recipe_detail(fixture_recipe_id) is not null,'합성 actor 시험의 호출자는 현재 정상 owner A');
  before_call := pg_temp.inspect_fixture_scope();
  perform pg_temp.expect_error(format('select public.save_recipe(%L::uuid,%L::jsonb)',store_a,body),
    '42501','작성자','RECIPE_REQUEST_ACTOR_MISMATCH');
  perform pg_temp.check_that(pg_temp.inspect_fixture_scope()=before_call,
    '동일 봉투의 actor 거부: recipe/receipt/손익/감사/물리 쓰기 불변');
  perform pg_temp.expect_error(format('select public.save_recipe(%L::uuid,%L::jsonb)',store_a,changed_body),
    '42501','작성자','RECIPE_REQUEST_ACTOR_MISMATCH');
  perform pg_temp.check_that(pg_temp.inspect_fixture_scope()=before_call,
    '다른 memo도 fingerprint보다 actor 우선: 모든 관측 행과 물리 쓰기 불변');
  perform pg_temp.check_that(current_user='authenticated' and auth.uid()=actor_a,'합성 시험 끝의 A 역할/JWT 유지');
end $synthetic_actor_fixture$;
