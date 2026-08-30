-- ════════════════════════════════════════════════════════════════
-- 31 · settings 직접 쓰기 봉쇄 (0164) — 판본 우회의 마지막 문
--
-- 실측된 우회: 인증 사용자가 settings 를 직접 고치면 동기화 트리거가 영업시간을
-- 규칙에 옮기면서 revision 은 안 올렸다(09:00–21:00 · rev 1 → 03:00–04:00 · rev 1).
-- 이제 settings 는 앱 롤이 읽기만 하고, 쓰기는 definer RPC 둘(save_settings ·
-- save_store_tax)뿐이며, 동기화 트리거는 없다 — 표시 폼이 규칙에 닿을 길이 없다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_store uuid := pg_temp.store();
  v_rule0 record;
  v_rule1 record;
begin
  select id, revision, weekly_hours into v_rule0
    from operating_rules where store_id = v_store and effective_to is null;

  -- ① 앱 롤의 직접 DML 은 권한부터 없다.
  perform pg_temp.raises('settings UPDATE 는 42501',
    format($q$update settings set open_time = '03:00', close_time = '04:00' where store_id = %L$q$, v_store), '42501');
  perform pg_temp.raises('settings INSERT 도 42501',
    format($q$insert into settings (store_id) values (%L) on conflict do nothing$q$, v_store), '42501');
  perform pg_temp.raises('settings DELETE 도 42501',
    format($q$delete from settings where store_id = %L$q$, v_store), '42501');

  /*
   * ①-b 트리거·참조도 없다(0165). 0164 는 INSERT/UPDATE/DELETE 만 걷어내서 `rxt` 가
   *     남았고, 인증 롤이 실제로 트리거를 붙일 수 있었다 — 그 트리거는 definer RPC 가
   *     그 테이블을 쓸 때도 발동해 정상 저장을 멈춘다.
   * ⚠ 트리거 함수는 **소유자로** 미리 만든다. 안 그러면 함수 생성(스키마 CREATE 권한)에서
   *   먼저 막혀 "트리거를 못 만든다"를 잘못 증명한다 — 실제로 그렇게 착각했다.
   */
  set local role postgres;
  execute $f$create or replace function pg_temp_probe_trg() returns trigger language plpgsql as $b$ begin return new; end $b$$f$;
  set local role margincook_rpc_executor;
  perform pg_temp.raises('settings 에 트리거를 못 붙인다',
    'create trigger probe_trg before update on public.settings for each row execute function pg_temp_probe_trg()', '42501');
  perform pg_temp.raises('operating_rules 에도 못 붙인다',
    'create trigger probe_trg2 before update on public.operating_rules for each row execute function pg_temp_probe_trg()', '42501');
  perform pg_temp.raises('쓰기가 열린 테이블(recipes)에도 못 붙인다',
    'create trigger probe_trg3 before update on public.recipes for each row execute function pg_temp_probe_trg()', '42501');
  perform pg_temp.ok('어떤 테이블에도 TRIGGER/REFERENCES 가 없다',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (has_table_privilege('authenticated', c.oid, 'TRIGGER')
             or has_table_privilege('authenticated', c.oid, 'REFERENCES'))) = 0);
  -- ② 그래도 읽기는 된다 — 화면이 표시 폼을 읽는다.
  perform pg_temp.ok('settings 읽기는 된다',
    exists (select 1 from settings where store_id = v_store));

  -- ③ 규칙·판본은 그대로다 — 우회가 실제로 막혔다는 증거.
  select id, revision, weekly_hours into v_rule1
    from operating_rules where store_id = v_store and effective_to is null;
  perform pg_temp.ok('규칙 행이 그대로', v_rule1.id = v_rule0.id);
  perform pg_temp.ok('판본이 그대로', v_rule1.revision = v_rule0.revision);
  perform pg_temp.ok('시간표가 그대로', v_rule1.weekly_hours = v_rule0.weekly_hours);

  -- ④ 쓰기 RPC 는 살아 있다(definer) — 설정은 여전히 저장된다.
  -- 금액 자릿수는 통화가 정한다(0168) — 사장님이 고치는 자릿수는 수량 쪽이다.
  perform save_settings(v_store, jsonb_build_object('quantity_digits', 2), pg_temp.settings_rev(v_store));
  perform pg_temp.eq_t('save_settings 는 definer 로 통과', (select quantity_digits::text from settings where store_id = v_store), '2');
  perform save_store_tax(v_store,
    (select tax_mode from settings where store_id = v_store),
    (select coalesce(tax_items, '[]'::jsonb) from settings where store_id = v_store),
    pg_temp.settings_rev(v_store));
  perform pg_temp.ok('save_store_tax 도 definer 로 통과', true);

  -- ⑤ 동기화 트리거가 없다 — 소유자가 표시 폼을 바꿔도 규칙은 안 움직인다.
  perform pg_temp.ok('동기화 트리거가 없다',
    not exists (select 1 from pg_trigger where tgname = 'settings_sync_operating_rule_trg'));
  set local role postgres;
  update settings set open_time = '03:00', close_time = '04:00' where store_id = v_store;
  set local role margincook_rpc_executor;
  select id, revision, weekly_hours into v_rule1
    from operating_rules where store_id = v_store and effective_to is null;
  perform pg_temp.ok('표시 폼을 바꿔도 규칙 시간표는 그대로 — 실측 우회가 닫혔다',
    v_rule1.weekly_hours = v_rule0.weekly_hours and v_rule1.revision = v_rule0.revision);

  -- ⑥ 정식 문으로 바꾸면 판본이 오른다.
  perform pg_temp.set_hours(
    (select jsonb_object_agg(d::text, jsonb_build_object('open','10:00','close','20:00')) from generate_series(0, 6) d));
  perform pg_temp.ok('정식 문은 판본을 올린다',
    (select max(revision) from operating_rules where store_id = v_store) > v_rule0.revision
    or (select count(*) from operating_rules where store_id = v_store) > 1);
end $t$;
-- ── 신규 매장 초기화 (0165) ─────────────────────────────────────
/*
 * 실측된 깨짐: 인증 롤이 stores 에 직접 insert 하면 시간대 트리거가 definer 가 아니라
 * 42501 로 매장 생성 자체가 죽었고, 통과해도 settings 행이 없어 save_store_tax 가
 * `update 0행` 에 changed=true 를 돌려줬다. 기본 영업시간도 규칙 09–21 vs 표시 11–22 로 갈렸다.
 */
do $t$
declare
  v_id    uuid;
  v_res   jsonb;
  v_other uuid;
  v_owner uuid := pg_temp.new_owner();   -- 계정당 매장 하나(0167) — 새 사장님
begin
  -- ① 소유자 픽스처 생성에도 트리거 셋이 따라붙는다. 앱 롤의 직접 INSERT 는 0167 로 없어졌다 —
  --    그 계약은 아래 '단일 매장' 블록이 잰다.
  set local role postgres;
  insert into stores (owner_id, name) values (v_owner, '시험 매장 신규직접')
    returning id into v_id;
  set local role margincook_rpc_executor;
  perform pg_temp.as_owner(v_owner);   -- 이 매장의 사장님으로 세금을 저장한다
  perform pg_temp.eq('직접 생성: 설정 행이 생긴다',
    (select count(*) from settings where store_id = v_id), 1, 0);
  perform pg_temp.eq('직접 생성: 시간대 행이 생긴다',
    (select count(*) from store_time_settings where store_id = v_id), 1, 0);
  perform pg_temp.eq('직접 생성: 영업규칙이 생긴다',
    (select count(*) from operating_rules where store_id = v_id), 1, 0);
  perform pg_temp.eq_t('기본 영업시간은 표시 폼과 같은 11:00~22:00',
    (store_hours_on(v_id, store_local_date(v_id))->>'open_time') || '~' ||
    (store_hours_on(v_id, store_local_date(v_id))->>'close_time'), '11:00:00~22:00:00');
  perform pg_temp.eq_t('규칙과 표시 폼이 안 갈린다',
    (select open_time::text || '~' || close_time::text from settings where store_id = v_id),
    '11:00:00~22:00:00');
  -- ② 세금 저장이 실제로 저장된다 — 0행에 성공을 돌려주지 않는다.
  v_res := save_store_tax(v_id, (select tax_mode from settings where store_id = v_id),
                          '[{"name":"부가세","rate":9.0909}]'::jsonb,
                          pg_temp.settings_rev(v_id));
  perform pg_temp.ok('세금 저장이 changed 를 답한다', v_res ? 'changed');
  perform pg_temp.eq('저장된 세금 항목이 실제로 있다',
    (select jsonb_array_length(tax_items) from settings where store_id = v_id), 1, 0);
  /*
   * ③ 공식 문(create_store) — 1차 범위는 매장 하나라, 이미 있으면 **그 매장**을 답하고
   *   시간대도 안 만진다(0166·0167). 그래서 새 매장의 시간대 계약은 **매장이 없는 계정**으로
   *   잰다 — 기존 사장님으로 부르면 created=false 에 기존 시간대가 온다(아래 '단일 매장' 블록).
   * ⚠ 여기서 개수 합(3)으로 재면 안 된다. 이 파일 앞 블록이 예약 규칙을 만들어 두면
   *   규칙이 2개라 합이 4가 된다 — 실제로 그렇게 빨개졌다. 있음/없음으로 잰다.
   */
  v_other := pg_temp.new_owner();
  set local role postgres;
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  set local role margincook_rpc_executor;
  -- 이름 검사는 **만들 때** 한다 — 매장이 이미 있으면 이름은 쓰이지 않고 그 매장이 온다.
  perform pg_temp.raises('공식 문: 이름이 비면 거부', $q$select create_store('   ')$q$, '22000');
  v_res := create_store('시험 매장 공식문', 'America/New_York');
  v_id := (v_res->>'store_id')::uuid;
  perform pg_temp.ok('공식 문: 새 계정이면 created=true', (v_res->>'created')::boolean is true);
  perform pg_temp.eq_t('공식 문: 시간대가 정해진다', v_res->>'timezone', 'America/New_York');
  perform pg_temp.ok('공식 문: 설정·규칙·시간대가 모두 있다',
    exists (select 1 from settings where store_id = v_id)
    and exists (select 1 from operating_rules where store_id = v_id)
    and exists (select 1 from store_time_settings where store_id = v_id));
  perform pg_temp.ok('공식 문: 정한 시간대는 confirmed 다',
    (select confirmed from store_time_settings where store_id = v_id));
  perform pg_temp.ok('공식 문: 매장이 있으면 빈 이름도 그 매장을 답한다(이름은 만들 때만 본다)',
    ((create_store('   '))->>'store_id')::uuid = v_id);
  set local role postgres;
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.owner(), 'role', 'authenticated')::text, true);
  set local role margincook_rpc_executor;
end $t$;


-- ── TRUNCATE 와 미래 테이블 (0166) ──────────────────────────────
/*
 * 실측된 구멍: 28개 중 23개에서 인증·익명 롤이 TRUNCATE 를 쓸 수 있었다.
 * **RLS 는 TRUNCATE 에 적용되지 않는다** — 남의 매장 행까지 통째로 사라진다
 * (검토자가 price_trends 100건 → 0건을 재현). 그리고 회수는 그때 있던 테이블에만
 * 걸리므로, 기본 권한을 안 바꾸면 다음에 만든 테이블이 다시 열린다.
 */
do $t$
declare v_n int;
begin
  perform pg_temp.raises('앱 롤은 TRUNCATE 를 못 한다',
    'truncate table public.price_trends', '42501');
  perform pg_temp.ok('어떤 테이블에도 TRUNCATE 가 없다(인증·익명)',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
             or has_table_privilege('anon', c.oid, 'TRUNCATE'))) = 0);

  -- 미래 테이블도 닫힌 채 태어난다 — 기본 권한(alter default privileges)이 걸렸는가.
  set local role postgres;
  create table public._probe_future_acl (id int);
  set local role margincook_rpc_executor;
  perform pg_temp.ok('새로 만든 테이블도 TRUNCATE/TRIGGER/REFERENCES 가 닫혀 있다',
    not has_table_privilege('authenticated', 'public._probe_future_acl', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public._probe_future_acl', 'TRIGGER')
    and not has_table_privilege('authenticated', 'public._probe_future_acl', 'REFERENCES'));
  set local role postgres;
  drop table public._probe_future_acl;
  set local role margincook_rpc_executor;
end $t$;


-- ── 단일 매장 계약과 백필 보존 (0166) ───────────────────────────
do $t$
declare
  v_owner_bf uuid;
  v_a jsonb; v_b jsonb;
  v_n int;
  v_store uuid;
begin
  /*
   * 두 번 눌러도 매장은 하나다(기획서 §12). 예전엔 둘이 생겼고, 앱은 정렬 없이 첫 행을
   * 골라 어느 쪽이 잡힐지 실행마다 달랐다.
   * ⚠ 시드 사장님은 이미 매장이 있다 — 그래서 첫 호출부터 created=false 여야 한다.
   */
  select count(*) into v_n from stores where owner_id = pg_temp.owner();
  v_a := create_store('중복 시험 매장');
  v_b := create_store('중복 시험 매장 2');
  perform pg_temp.eq('두 번 불러도 매장 수가 안 는다',
    (select count(*) from stores where owner_id = pg_temp.owner()), v_n, 0);
  perform pg_temp.eq_t('둘 다 같은 매장을 답한다', v_a->>'store_id', v_b->>'store_id');
  perform pg_temp.ok('이미 있으면 created=false', (v_a->>'created')::boolean is false);
  perform pg_temp.eq_t('앱과 같은 기준(created_at, id)으로 고른다',
    v_a->>'store_id',
    (select id::text from stores where owner_id = pg_temp.owner() order by created_at, id limit 1));

  /*
   * 백필 보존 — 표시 폼이 06:00–14:00 인 매장의 규칙을 11–22 로 덮으면 안 된다.
   * 문(0159)을 안 지난 규칙(revision=1)만 표시 폼을 따른다.
   */
  v_owner_bf := pg_temp.new_owner();   -- 계정당 매장 하나(0167)
  set local role postgres;
  insert into stores (owner_id, name) values (v_owner_bf, '백필 시험 매장') returning id into v_store;
  update settings set open_time = '06:00', close_time = '14:00' where store_id = v_store;
  delete from operating_rules where store_id = v_store;
  insert into operating_rules (store_id, effective_from, effective_to, weekly_hours, weekly_breaks)
       values (v_store, '-infinity', null,
               (select jsonb_object_agg(d::text, jsonb_build_object('open','11:00','close','22:00','closed',false))
                  from generate_series(0, 6) d), '{}'::jsonb);
  -- 0166 의 백필과 같은 문장(마이그레이션이 한 일을 여기서 재현해 잰다).
  update operating_rules r
     set weekly_hours = (select jsonb_object_agg(d::text, jsonb_build_object(
                                  'open', s.open_time::text, 'close', s.close_time::text,
                                  'closed', coalesce((r.weekly_hours -> d::text ->> 'closed')::boolean, false)))
                           from generate_series(0, 6) d)
    from settings s
   where s.store_id = r.store_id and r.store_id = v_store
     and r.effective_to is null and r.revision = 1
     and (r.weekly_hours -> '1' ->> 'open') is distinct from s.open_time::text;
  set local role margincook_rpc_executor;
  perform pg_temp.as_owner(v_owner_bf);   -- 그 매장은 다른 사장님 것 — 그 사장님으로 읽는다(RLS)
  perform pg_temp.eq_t('백필이 표시 폼(06:00~14:00)을 보존한다',
    (store_hours_on(v_store, store_local_date(v_store))->>'open_time') || '~' ||
    (store_hours_on(v_store, store_local_date(v_store))->>'close_time'), '06:00:00~14:00:00');
  perform pg_temp.as_owner(pg_temp.owner());
end $t$;


-- ── 단일 매장을 DB 가 지킨다 · create_store 재호출 무해 (0167) ────
do $t$
declare
  v_res jsonb;
  v_tz0 text;
  v_other uuid;
begin
  -- ① 재호출은 시간대를 안 바꾼다 — 열린 장부의 날짜와 현지 날짜가 갈라지면 안 된다(실측).
  perform pg_temp.open_today();   -- 영업 중이면 set_store_timezone 도 45011 인 상태
  v_tz0 := store_timezone(pg_temp.store());
  v_res := create_store('재호출', 'America/New_York');
  perform pg_temp.ok('있으면 created=false', (v_res->>'created')::boolean is false);
  perform pg_temp.eq_t('재호출은 시간대를 안 바꾼다', store_timezone(pg_temp.store()), v_tz0);
  perform pg_temp.eq_t('응답 시간대도 기존 값', v_res->>'timezone', v_tz0);

  -- ② 앱 롤의 stores 직접 쓰기는 권한부터 없다 — 매장은 create_store 로만 생긴다.
  --    RLS 만으로 막혀도 42501 이라 권한 자체를 따로 잰다(정책이 아니라 GRANT 가 닫혀야 한다).
  perform pg_temp.ok('stores 에 앱 롤 INSERT/UPDATE/DELETE GRANT 가 없다',
    not has_table_privilege('authenticated', 'public.stores', 'INSERT')
    and not has_table_privilege('authenticated', 'public.stores', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.stores', 'DELETE')
    and not has_table_privilege('anon', 'public.stores', 'INSERT'));
  perform pg_temp.raises('stores 직접 INSERT 는 42501',
    format($q$insert into stores (owner_id, name) values (%L, '직접')$q$, pg_temp.owner()), '42501');
  perform pg_temp.raises('stores 직접 UPDATE 도 42501',
    format($q$update stores set name = 'x' where id = %L$q$, pg_temp.store()), '42501');
  perform pg_temp.raises('stores 직접 DELETE 도 42501',
    format($q$delete from stores where id = %L$q$, pg_temp.store()), '42501');

  -- ③ 계정당 하나 — UNIQUE(owner_id). 소유자 직접 INSERT 로도 두 번째 매장은 안 생긴다.
  --    (첫 판은 exists 트리거 + 세션 플래그였고 두 세션 동시 INSERT 가 둘 다 통과했다 — 검토 재현.)
  set local role postgres;
  perform pg_temp.raises('같은 계정의 두 번째 매장은 23505 (UNIQUE)',
    format($q$insert into stores (owner_id, name) values (%L, '둘째')$q$, pg_temp.owner()), '23505');
  set local role margincook_rpc_executor;
  perform pg_temp.ok('stores.owner_id 에 UNIQUE 제약이 있다 — 트리거가 아니라 제약이다',
    exists (select 1 from pg_constraint c
             where c.conrelid = 'public.stores'::regclass and c.contype = 'u'
               and c.conkey = array[(select attnum from pg_attribute
                                      where attrelid = 'public.stores'::regclass and attname = 'owner_id')]));
  perform pg_temp.ok('시험용 우회(트리거·플래그)가 운영 스키마에 없다',
    not exists (select 1 from pg_trigger where tgname = 'stores_00_single_per_owner')
    and not exists (select 1 from pg_proc where proname = 'stores_single_per_owner'));

  -- ④ 다른 사장님은 제 매장 하나를 create_store 로 만든다 — 남남 시나리오의 기반.
  v_other := pg_temp.new_owner();
  set local role postgres;
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  set local role margincook_rpc_executor;
  v_res := create_store('남의 매장');
  perform pg_temp.ok('남의 계정은 새 매장을 만든다', (v_res->>'created')::boolean is true);
  set local role postgres;
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.owner(), 'role', 'authenticated')::text, true);
  set local role margincook_rpc_executor;
end $t$;


-- ── 기본 권한 — postgres 와 supabase_admin 둘 다 닫혀 있다 (0166·0167) ──
/*
 * 검토 재현: supabase_admin 이 public 에 만든 테이블은 TRUNCATE/TRIGGER/REFERENCES 가 다시
 * 열렸다. postgres 는 그 롤의 기본 권한을 못 바꾸므로(멤버가 아니다) fresh-db.sh 가
 * 슈퍼유저 연결로 걷어낸다. 여기서는 **두 롤의 pg_default_acl** 을 잰다 — 표 하나 만들어
 * 보는 것은 postgres 만 할 수 있어(31 앞 블록), 나머지는 기본 권한 행 자체가 증거다.
 */
do $t$
declare v_open text;
begin
  select string_agg(r.rolname, ', ') into v_open
    from pg_default_acl a join pg_roles r on r.oid = a.defaclrole
   where a.defaclnamespace = 'public'::regnamespace and a.defaclobjtype = 'r'
     and r.rolname in ('postgres', 'supabase_admin')
     -- aclitem 글자: D=TRUNCATE t=TRIGGER x=REFERENCES. 앱 롤 항목에 하나라도 있으면 열린 것.
     and exists (select 1 from unnest(a.defaclacl) x
                  where x::text ~ '^(anon|authenticated)=' and x::text ~ '=[^/]*[Dtx]');
  /*
   * ⚠ "행이 있다"로 재지 않는다 — 새 DB 는 supabase_admin 의 기본 권한이 애초에 비어 있어
   *   회수가 무행(no-op)이고 pg_default_acl 에 행이 안 생긴다(실측). 열린 행이 **없음**이 계약이다.
   *   supabase_admin 으로 표를 실제로 만들어 보는 시험은 fresh-db.sh 의 슈퍼유저 단계가 한다
   *   (이 세션은 postgres 라 그 롤이 못 된다).
   */
  perform pg_temp.ok('postgres·supabase_admin 기본 권한에 TRUNCATE/TRIGGER/REFERENCES 가 없다',
    v_open is null);
end $t$;


-- ── save_settings 계약 (0167) — 받는 키는 저장되고, 모르는 키는 거부 ──
do $t$
begin
  -- 전제: 이 블록은 언어가 ko 라고 가정한다. 매장이 en-US 면 KRW 저장이 거부돼 빨개진다(검토 지적) —
  -- 현재 언어에 기대지 않고 명시한다(스위트는 롤백되므로 되돌릴 필요가 없다).
  perform save_settings(pg_temp.store(), '{"locale":"ko"}'::jsonb, pg_temp.settings_rev(pg_temp.store()));
  perform save_settings(pg_temp.store(), jsonb_build_object('unit_system', 'metric', 'cup_volume', 200, 'currency', 'KRW'), pg_temp.settings_rev(pg_temp.store()));
  perform pg_temp.eq('cup_volume 이 실제로 저장된다',
    (select cup_volume from settings where store_id = pg_temp.store()), 200, 0);
  perform pg_temp.raises('모르는 키는 거부 — 조용히 버리지 않는다',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"theme":"dark"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  -- 값의 뜻(검토 P2) — 키가 맞아도 뜻이 틀리면 거부.
  perform pg_temp.raises('unit_system 은 metric 뿐(1차)',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"unit_system":"nonsense"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('컵 용량 음수는 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"cup_volume":-5}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('모르는 통화는 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"currency":"???"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('모르는 언어는 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"locale":"xx-XX"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('자릿수 범위 밖은 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"unit_price_digits":9}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('목표 이익률 100 초과는 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"default_target_profit_rate":150}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.eq_t('거부된 저장은 아무것도 안 바꿨다 — unit_system 그대로',
    (select unit_system from settings where store_id = pg_temp.store()), 'metric');
  perform save_settings(pg_temp.store(), '{"currency":"USD","locale":"en-US"}'::jsonb, pg_temp.settings_rev(pg_temp.store()));
  perform pg_temp.eq_t('목록 안의 통화·언어는 저장된다',
    (select currency || '/' || locale from settings where store_id = pg_temp.store()), 'USD/en-US');
  perform save_settings(pg_temp.store(), '{"currency":"KRW","locale":"ko"}'::jsonb, pg_temp.settings_rev(pg_temp.store()));

  -- ── 0168: 모양·JSON 타입 · 언어가 통화·자릿수를 정한다 ──
  perform pg_temp.raises('빈 {} 는 거부 — updated_at 만 바꾸는 저장은 없다',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('객체가 아니면 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '[1]', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('"yes" 는 참이 아니다 — 문자열 알림 값 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"alert_morning_summary":"yes"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('"abc" 컵 용량은 계약 오류(22000)지 원시 22P02 가 아니다',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"cup_volume":"abc"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('"2" 자릿수도 숫자 타입이어야 한다',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"money_digits":"2"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.ok('거부된 저장은 알림 값을 안 바꿨다',
    (select alert_morning_summary from settings where store_id = pg_temp.store()) is not null);

  perform save_settings(pg_temp.store(), '{"locale":"en-US"}'::jsonb, pg_temp.settings_rev(pg_temp.store()));
  perform pg_temp.eq_t('언어만 보내도 통화·금액 자릿수가 함께 파생된다 (en-US → USD·2)',
    (select locale || '/' || currency || '/' || money_digits from settings where store_id = pg_temp.store()), 'en-US/USD/2');
  perform pg_temp.raises('언어와 다른 통화를 같이 보내면 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"locale":"ja","currency":"USD"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('현재 언어(en-US)와 다른 통화만 보내도 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"currency":"KRW"}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.raises('통화와 다른 금액 자릿수도 거부',
    format('select save_settings(%L, %L::jsonb, %s)', pg_temp.store(), '{"money_digits":0}', pg_temp.settings_rev(pg_temp.store())), '22000');
  perform pg_temp.eq_t('거부된 요청은 언어를 안 바꿨다', (select locale from settings where store_id = pg_temp.store()), 'en-US');
  perform save_settings(pg_temp.store(), '{"locale":"ko"}'::jsonb, pg_temp.settings_rev(pg_temp.store()));
  perform pg_temp.eq_t('ko → KRW·0 으로 돌아온다',
    (select locale || '/' || currency || '/' || money_digits from settings where store_id = pg_temp.store()), 'ko/KRW/0');
  perform pg_temp.eq('locale_defaults 는 core LOCALES 의 열 개를 안다',
    (select count(*) from unnest(array['ko','en-US','ja','de','ar-SA','ar-AE','vi','es-ES','es-MX','pt-BR']) l
      where exists (select 1 from locale_defaults(l))), 10, 0);
  perform pg_temp.ok('표의 CHECK — RPC 밖에서도 언어 키는 목록 안이어야 한다',
    exists (select 1 from pg_constraint where conname = 'settings_locale_ck' and convalidated));
  -- 조합도 표가 지킨다(0169) — service_role·소유자 직접 갱신으로 en-US/KRW/0 을 못 넣는다(검토 실측).
  set local role postgres;
  perform pg_temp.raises('직접 갱신으로도 언어·통화·자릿수 조합을 못 깬다 (23514)',
    format($q$update settings set locale = 'en-US' where store_id = %L$q$, pg_temp.store()), '23514');
  perform pg_temp.raises('통화만 바꿔도 조합 위반',
    format($q$update settings set currency = 'USD' where store_id = %L$q$, pg_temp.store()), '23514');
  set local role margincook_rpc_executor;
  perform pg_temp.eq_t('조합 위반이 거부된 뒤에도 행은 그대로',
    (select locale || '/' || currency || '/' || money_digits from settings where store_id = pg_temp.store()), 'ko/KRW/0');
  perform pg_temp.eq_t('기본 언어 키는 ko (예전 ko-KR 은 0168 이 옮겼다)',
    (select column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'settings' and column_name = 'locale'), '''ko''::text');
end $t$;
