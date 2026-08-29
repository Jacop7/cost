-- ═══════════════════════════════════════════════════════════════
-- 33 · 계정 삭제는 접근만 끊고 매장·거래 원장을 보존한다
-- ══════════════════════════════════════════════════════════════

-- ── 1. 스키마·권한 계약 ───────────────────────────────────────────────────────────

select pg_temp.ok('stores.owner_id 는 nullable 다', not (
  select attnotnull from pg_attribute
   where attrelid = 'stores'::regclass and attname = 'owner_id'));

select pg_temp.ok('auth 계정 삭제는 store owner 연결만 null 로 바꾼다', exists (
  select 1 from pg_constraint
   where conrelid = 'stores'::regclass
     and conname = 'stores_owner_id_fkey'
     and pg_get_constraintdef(oid) like '%ON DELETE SET NULL%'));

select pg_temp.ok('authenticated 는 자기 계정 탈퇴 문만 열려 있다',
  has_function_privilege('authenticated', 'retire_my_account()', 'EXECUTE'));
select pg_temp.ok('authenticated 는 물리 삭제 문을 열 수 없다',
  not has_function_privilege('authenticated', 'purge_archived_store(uuid,text)', 'EXECUTE'));
select pg_temp.ok('anon 은 계정 탈퇴 문을 열 수 없다',
  not has_function_privilege('anon', 'retire_my_account()', 'EXECUTE'));

-- ── 2. 현재 계정 탈퇴: 모든 store FK 하위 행 수가 그대로다 ────────────────────────────────

create temporary table account_retention_counts (
  child_table regclass primary key,
  fk_column name not null,
  before_count bigint not null
) on commit drop;

do $t$
declare
  r record;
  v_count bigint;
begin
  set local role postgres;
  for r in
    select c.conrelid::regclass as child_table, a.attname as fk_column
      from pg_constraint c
      join unnest(c.conkey) with ordinality k(attnum, ord) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       and c.confrelid = 'stores'::regclass
       and cardinality(c.conkey) = 1
  loop
    execute format('select count(*) from %s where %I = $1', r.child_table, r.fk_column)
      into v_count using pg_temp.store();
    insert into account_retention_counts values (r.child_table, r.fk_column, v_count);
  end loop;
  set local role sikjae_rpc_executor;
end $t$;

select pg_temp.ok('시드에 보존할 재고 원장이 실제로 있다',
  (select before_count from account_retention_counts where child_table = 'inventory_events'::regclass) > 0);
select pg_temp.ok('시드에 보존할 판매 원장이 실제로 있다',
  (select before_count from account_retention_counts where child_table = 'daily_sales'::regclass) > 0);

do $t$
declare v_result jsonb;
begin
  v_result := retire_my_account();
  perform pg_temp.ok('탈퇴 RPC 가 계정 삭제를 알린다', (v_result->>'deleted')::boolean);
  perform pg_temp.eq('탈퇴한 매장 1개', (v_result->>'archived_store_count')::numeric, 1);
end $t$;

set local role postgres;

select pg_temp.ok('auth.users 계정은 삭제된다',
  not exists (select 1 from auth.users where id = pg_temp.owner()));
select pg_temp.ok('매장은 owner 없는 archive 상태로 남는다', exists (
  select 1 from stores where id = pg_temp.store()
    and owner_id is null and archived_at is not null and archive_reason = 'account_deleted'));
select pg_temp.ok('계정 탈퇴 감사 이벤트가 남는다', exists (
  select 1 from store_lifecycle_events
   where store_id = pg_temp.store() and event_type = 'account_deleted'
     and former_owner_id = pg_temp.owner()));

do $t$
declare
  r record;
  v_after bigint;
begin
  for r in select * from account_retention_counts loop
    execute format('select count(*) from %s where %I = $1', r.child_table, r.fk_column)
      into v_after using pg_temp.store();
    if v_after <> r.before_count then
      raise exception E'FAIL  계정 탈퇴로 % 행이 바뀌었습니다\n        기대: %, 실제: %',
        r.child_table, r.before_count, v_after;
    end if;
  end loop;
  raise notice '  ok   store FK 하위 테이블 전체 행 수 보존';
end $t$;

-- 소유자의 옛 JWT가 남아 있어도 어떤 매장도 안 보이고 새 매장도 못 만든다.
set local role sikjae_rpc_executor;
select pg_temp.eq('탈퇴한 JWT 의 매장 스코프는 0', (
  select count(*) from stores where owner_id = auth.uid() and archived_at is null), 0);
select pg_temp.eq('탈퇴한 JWT 로 매장 행을 직접 조회해도 0',
  (select count(*) from stores where id = pg_temp.store()), 0);
select pg_temp.eq('탈퇴한 JWT 로 재고 원장을 조회해도 0',
  (select count(*) from inventory_events where store_id = pg_temp.store()), 0);
select pg_temp.raises('탈퇴한 JWT 로 assert_my_store 우회 불가',
  format('select assert_my_store(%L)', pg_temp.store()), '42501');
select pg_temp.raises('탈퇴한 JWT 로 새 매장 생성 불가',
  $$select create_store('우회 매장', 'Asia/Seoul')$$, '42501');

-- ── 3. Dashboard/Admin 에서 auth.users 를 직접 삭제해도 보존된다 ──────────────────

do $t$
declare
  v_owner uuid;
  v_store uuid;
begin
  v_owner := pg_temp.new_owner();
  perform pg_temp.as_owner(v_owner);
  v_store := (create_store('외부 삭제 시험', 'Asia/Seoul')->>'store_id')::uuid;

  set local role postgres;
  delete from auth.users where id = v_owner;
  perform pg_temp.ok('외부 auth 삭제에도 매장이 남는다', exists (
    select 1 from stores where id = v_store and owner_id is null
      and archived_at is not null and archive_reason = 'account_deleted'));
  perform pg_temp.ok('외부 auth 삭제도 감사 이벤트를 남긴다', exists (
    select 1 from store_lifecycle_events where store_id = v_store
      and event_type = 'account_deleted' and former_owner_id = v_owner));
  set local role sikjae_rpc_executor;
end $t$;

-- ── 4. 폐점은 계정을 유지하고 기존 매장 접근만 끊는다 ──────────────────────────────

create temporary table archived_store_probe (owner_id uuid, store_id uuid, replacement_id uuid) on commit drop;

do $t$
declare
  v_owner uuid;
  v_store uuid;
  v_new uuid;
  v_result jsonb;
begin
  v_owner := pg_temp.new_owner();
  perform pg_temp.as_owner(v_owner);
  v_store := (create_store('폐점 시험', 'Asia/Seoul')->>'store_id')::uuid;
  v_result := archive_my_store(v_store, '폐점 시험 사유');
  perform pg_temp.ok('폐점 RPC 가 archive 완료를 알린다', (v_result->>'archived')::boolean);
  perform pg_temp.eq('폐점 즉시 기존 매장 접근 0', (
    select count(*) from stores where owner_id = auth.uid() and archived_at is null), 0);
  v_new := (create_store('새 시작', 'Asia/Seoul')->>'store_id')::uuid;
  perform pg_temp.ok('계정은 새 매장을 만들 수 있다', v_new <> v_store);
  insert into archived_store_probe values (v_owner, v_store, v_new);
end $t$;

set local role postgres;
select pg_temp.ok('폐점 매장은 소유권 없는 archive 상태다', exists (
  select 1 from stores s join archived_store_probe p on p.store_id = s.id
   where s.owner_id is null and s.archive_reason = 'store_archived' and s.archived_at is not null));
select pg_temp.ok('폐점 이벤트에 사유가 남는다', exists (
  select 1 from store_lifecycle_events e join archived_store_probe p on p.store_id = e.store_id
   where e.event_type = 'store_archived' and e.reason = '폐점 시험 사유'));

-- ── 5. 물리 삭제는 승인·보존 종료·백업 근거가 모두 있을 때만 ────────────────

select pg_temp.raises('운영자도 매장을 직접 delete 할 수 없다',
  format('delete from stores where id = %L', (select store_id from archived_store_probe)), '42501');
select pg_temp.raises('감사 원장 update 금지',
  format($sql$update store_lifecycle_events set reason = '변조' where store_id = %L$sql$,
         (select store_id from archived_store_probe)), '42501');
select pg_temp.raises('감사 원장 truncate 금지',
  $$truncate store_lifecycle_events$$, '42501');

do $t$
declare v_store uuid;
begin
  select store_id into v_store from archived_store_probe;
  set local role service_role;
  perform schedule_store_purge(
    v_store,
    clock_timestamp(),
    '운영책임자',
    'APPROVAL-TEST-001',
    '보존 기간 종료');
  perform purge_archived_store(v_store, 'BACKUP-SHA256-TEST');
  set local role postgres;
end $t$;

select pg_temp.ok('승인된 물리 삭제는 매장을 지운다', not exists (
  select 1 from stores where id = (select store_id from archived_store_probe)));
select pg_temp.ok('매장 물리 삭제 후에도 감사 원장은 남는다', exists (
  select 1 from store_lifecycle_events e join archived_store_probe p on p.store_id = e.store_id
   where e.event_type = 'physical_purge'
     and e.approval_reference = 'APPROVAL-TEST-001'
     and e.backup_reference = 'BACKUP-SHA256-TEST'));

set local role sikjae_rpc_executor;
