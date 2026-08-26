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
