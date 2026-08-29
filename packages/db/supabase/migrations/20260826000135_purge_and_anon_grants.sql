-- ════════════════════════════════════════════════════════════════
-- 0135 · 익명 사용자가 **모든 매장의 수정 내역을 지울 수 있었다**
--
-- 실측(일회용 새 DB) —
--     45일 전으로 늙힌 수정내역 128건
--     set role anon; select purge_entity_changes(1);   →  128
--     남은 수정내역 0건
--
-- 원인이 둘 겹쳤다.
--   ① `purge_entity_changes` 가 `security definer` 인데 **매장을 안 가린다.**
--      의도한 것이다 — "매장·행을 골라 지울 수 있으면 definer 로 연 문이 넓어진다"(0076).
--      대신 **누가 부를 수 있는지**가 좁아야 하는데 그게 안 좁았다.
--   ② 함수 실행 권한의 기본값이 넓다. Postgres 는 새 함수에 `PUBLIC` 실행 권한을 주고,
--      Supabase 의 기본 권한이 `anon` 에도 준다. 그래서 로그인도 안 한 사람이 부를 수 있었다.
--
-- 그리고 `p_days` 를 받으니 `1` 을 넣어 **보관 기간을 무시**할 수 있었다.
-- 보관 기간은 정책이지 호출자가 정할 값이 아니다.
--
-- ⚠ 남는 위험은 정직하게 적어 둔다 — 인증 사용자는 여전히 이 함수를 부를 수 있고,
--   그러면 **모든 매장의 30일 지난** 수정 내역이 지워진다. 그건 0076 의 보관 정책이
--   영업 시작 때마다 하는 일과 같다(어차피 지워질 것을 조금 일찍 지우는 셈).
--   더 좁히려면 `open_business_day` 를 definer 로 바꿔야 하는데, 그 함수는 하는 일이
--   많아 definer 로 돌리면 RLS 를 통째로 우회한다 — 그게 더 큰 문을 여는 일이다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 보관 기간을 인자에서 뺀다 ─────────────────────────────────
create or replace function public.purge_entity_changes() returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare v_n int;
begin
  /*
   * ⚠ 30일은 **정책**이다(0076). 호출자가 정하지 않는다 —
   *   예전엔 `p_days` 를 받아서 `1` 을 넣으면 어제 것까지 지워졌다.
   *   이 테이블 하나만, 조건은 나이 하나뿐인 것은 그대로다.
   */
  delete from entity_change_events
   where occurred_at < clock_timestamp() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

comment on function public.purge_entity_changes() is
  '수정 내역 보관 기간 청소(30일 고정, 0135). 기간은 정책이라 인자로 안 받는다. 계산 근거인 원장·스냅샷·추이는 건드리지 않는다(0076).';

-- 부르는 곳을 새 시그니처로 옮긴 뒤에 옛 것을 지운다.
do $m$
declare v_def text; v_old text := 'begin perform purge_entity_changes(30); exception when others then null; end;';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_business_day';
  if v_def is null then raise exception '0135: open_business_day 가 없습니다'; end if;

  if position('purge_entity_changes(30)' in v_def) = 0 then
    if position('purge_entity_changes()' in v_def) > 0 then return; end if;   -- 이미 적용됨
    raise exception '0135: open_business_day 의 청소 호출을 못 찾았습니다';
  end if;
  execute replace(v_def, v_old,
    'begin perform purge_entity_changes(); exception when others then null; end;');
end $m$;

drop function if exists public.purge_entity_changes(integer);


-- ── ② 누가 부를 수 있는가 ───────────────────────────────────────
/*
 * ⚠ `revoke ... from public` 을 **먼저** 한다. `public` 은 모든 롤을 포함하므로,
 *   anon 만 걷어내도 public 을 통해 그대로 부를 수 있다.
 *   (실제로 이 함수는 `PUBLIC=X` 였고 anon 은 그것 덕에 불렀다.)
 */
revoke execute on function public.purge_entity_changes() from public;
revoke execute on function public.purge_entity_changes() from anon;
-- 영업 시작(open_business_day, invoker)이 부른다. 그 경로가 유일한 정상 호출이다.
grant execute on function public.purge_entity_changes() to authenticated, service_role;

-- 매장을 안 가리는 나머지 definer 함수들도 anon 에게서 걷는다.
-- (지금은 해가 없다 — `my_store_ids()` 는 로그인 안 하면 빈 값이고, 트리거 함수는
--  직접 부를 수 없다. 그래도 열어 둘 이유가 없다.)
revoke execute on function public.my_store_ids() from public, anon;
grant execute on function public.my_store_ids() to authenticated, service_role;
revoke execute on function public.settings_sync_operating_rule() from public, anon;
revoke execute on function public.stores_default_operating_rule() from public, anon;


-- ── ③ 앞으로 만들 함수의 기본값 ─────────────────────────────────
/*
 * 이번 일의 뿌리는 "새 함수는 누구나 부를 수 있다"는 기본값이다.
 * 다음 함수가 또 definer 로 만들어지면 같은 일이 반복된다.
 *
 * ⚠ `alter default privileges` 는 **앞으로 만들어질** 객체에만 적용된다.
 *   위 ② 가 지금 있는 함수를 따로 다루는 이유다.
 */
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

/*
 * ⚠ 그런데 기본값만으로는 **지금 있는 함수**가 안 걷힌다. 그리고 측정해 보니
 *   `alter default privileges` 를 먼저 깔아 둔 새 DB 에서도 새로 만든 함수에
 *   `=X/postgres`(PUBLIC 실행)가 그대로 붙었다 — 이 DB 의 template 이 들고 있는
 *   기본값이 이긴다. 기본값에만 기대면 안 된다는 뜻이다.
 *
 *   그래서 지금 있는 함수 전체에서 명시적으로 걷는다.
 *   이 앱은 `SessionGate` 가 로그인 전 화면을 통째로 막으므로 anon 이 부를 것이 없다.
 */
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated, service_role;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_n int;
  v_ok boolean;
  v_original_role name := current_user;
begin
  -- 인자 있는 옛 함수가 남아 있으면 그리로 다시 샌다.
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'purge_entity_changes'
     and pg_get_function_identity_arguments(p.oid) <> '';
  if v_n > 0 then raise exception '0135: 인자 있는 purge_entity_changes 가 남았습니다'; end if;

  if has_function_privilege('anon', 'public.purge_entity_changes()', 'execute') then
    raise exception '0135: anon 이 아직 청소를 부를 수 있습니다';
  end if;
  if has_function_privilege('public', 'public.purge_entity_changes()', 'execute') then
    raise exception '0135: PUBLIC 이 아직 청소를 부를 수 있습니다';
  end if;
  if not has_function_privilege('authenticated', 'public.purge_entity_changes()', 'execute') then
    raise exception '0135: 영업 시작이 청소를 못 부릅니다';
  end if;

  -- ⚠ 권한만 보지 않는다. **실제로 anon 으로 내려가서** 막히는지 본다.
  v_ok := false;
  -- 전환 실패와 함수 실행 거부는 둘 다 42501이다. 전환을 예외 블록 밖에서
  -- 먼저 끝내고 역할을 확인해야 함수 권한 거부만 성공 조건으로 셀 수 있다.
  set local role anon;
  if current_user <> 'anon' then
    raise exception '0135: anon 역할로 전환하지 못했습니다';
  end if;
  begin
    perform public.purge_entity_changes();
  exception when insufficient_privilege then
    -- 스키마 USAGE 같은 다른 42501과 구분해 청소 함수의 실행 거부만 센다.
    if position('purge_entity_changes' in sqlerrm) = 0 then
      raise exception '0135: anon 권한 거부가 청소 함수가 아닌 곳에서 났습니다: %', sqlerrm;
    end if;
    v_ok := true;
  end;
  -- Supabase CLI는 별도 로그인 롤로 접속한 뒤 `postgres`로 전환해 migration을
  -- 실행한다. 여기서 `reset role`을 쓰면 전환 전 로그인 롤로 돌아가 이후
  -- 사후 검증 함수의 EXECUTE 권한이 사라진다. 시작 역할을 정확히 복원한다.
  execute format('set local role %I', v_original_role);
  if current_user <> v_original_role then
    raise exception '0135: 익명 실행 검사 뒤 원래 역할을 복원하지 못했습니다';
  end if;
  if not v_ok then raise exception '0135: anon 이 실제로 청소를 실행했습니다'; end if;

  -- anon 이 부를 수 있는 함수가 하나도 없어야 한다.
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'execute');
  if v_n > 0 then
    raise exception '0135: anon 이 부를 수 있는 함수가 %개 남았습니다', v_n;
  end if;

  -- 그렇다고 인증 사용자까지 막으면 앱이 통째로 죽는다.
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and not has_function_privilege('authenticated', p.oid, 'execute');
  if v_n > 0 then
    raise exception '0135: 인증 사용자가 못 부르는 함수가 %개 있습니다', v_n;
  end if;

  -- 영업 시작이 새 시그니처를 부르는가.
  if position('purge_entity_changes()' in (
       select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'open_business_day')) = 0 then
    raise exception '0135: open_business_day 가 새 청소 함수를 안 부릅니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
