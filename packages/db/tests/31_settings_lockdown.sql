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
  set local role authenticated;
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
  perform save_settings(v_store, jsonb_build_object('money_digits', 2));
  perform pg_temp.eq_t('save_settings 는 definer 로 통과', (select money_digits::text from settings where store_id = v_store), '2');
  perform save_store_tax(v_store,
    (select tax_mode from settings where store_id = v_store),
    (select coalesce(tax_items, '[]'::jsonb) from settings where store_id = v_store));
  perform pg_temp.ok('save_store_tax 도 definer 로 통과', true);

  -- ⑤ 동기화 트리거가 없다 — 소유자가 표시 폼을 바꿔도 규칙은 안 움직인다.
  perform pg_temp.ok('동기화 트리거가 없다',
    not exists (select 1 from pg_trigger where tgname = 'settings_sync_operating_rule_trg'));
  set local role postgres;
  update settings set open_time = '03:00', close_time = '04:00' where store_id = v_store;
  set local role authenticated;
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
  v_id  uuid;
  v_res jsonb;
begin
  -- ① 직접 생성도 살아 있다 — 트리거 셋이 definer 라 앱 롤로 만들어진다.
  insert into stores (owner_id, name) values (pg_temp.owner(), '시험 매장 신규직접')
    returning id into v_id;
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
                          '[{"name":"부가세","rate":9.0909}]'::jsonb);
  perform pg_temp.ok('세금 저장이 changed 를 답한다', v_res ? 'changed');
  perform pg_temp.eq('저장된 세금 항목이 실제로 있다',
    (select jsonb_array_length(tax_items) from settings where store_id = v_id), 1, 0);
  /*
   * ③ 공식 문(create_store) — 1차 범위는 매장 하나라, 이미 있으면 **그 매장**을 답한다(0166).
   * ⚠ 여기서 개수 합(3)으로 재면 안 된다. 이 파일 앞 블록이 예약 규칙을 만들어 두면
   *   규칙이 2개라 합이 4가 된다 — 실제로 그렇게 빨개졌다. 있음/없음으로 잰다.
   */
  v_res := create_store('시험 매장 공식문', 'America/New_York');
  v_id := (v_res->>'store_id')::uuid;
  perform pg_temp.eq_t('공식 문: 시간대가 정해진다', v_res->>'timezone', 'America/New_York');
  perform pg_temp.ok('공식 문: 설정·규칙·시간대가 모두 있다',
    exists (select 1 from settings where store_id = v_id)
    and exists (select 1 from operating_rules where store_id = v_id)
    and exists (select 1 from store_time_settings where store_id = v_id));
  perform pg_temp.ok('공식 문: 정한 시간대는 confirmed 다',
    (select confirmed from store_time_settings where store_id = v_id));
  perform pg_temp.raises('공식 문: 이름이 비면 거부', $q$select create_store('   ')$q$, '22000');
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
  set local role authenticated;
  perform pg_temp.ok('새로 만든 테이블도 TRUNCATE/TRIGGER/REFERENCES 가 닫혀 있다',
    not has_table_privilege('authenticated', 'public._probe_future_acl', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public._probe_future_acl', 'TRIGGER')
    and not has_table_privilege('authenticated', 'public._probe_future_acl', 'REFERENCES'));
  set local role postgres;
  drop table public._probe_future_acl;
  set local role authenticated;
end $t$;


-- ── 단일 매장 계약과 백필 보존 (0166) ───────────────────────────
do $t$
declare
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
  set local role postgres;
  insert into stores (owner_id, name) values (pg_temp.owner(), '백필 시험 매장') returning id into v_store;
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
  set local role authenticated;
  perform pg_temp.eq_t('백필이 표시 폼(06:00~14:00)을 보존한다',
    (store_hours_on(v_store, store_local_date(v_store))->>'open_time') || '~' ||
    (store_hours_on(v_store, store_local_date(v_store))->>'close_time'), '06:00:00~14:00:00');
end $t$;
