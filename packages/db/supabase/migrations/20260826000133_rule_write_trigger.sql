-- ════════════════════════════════════════════════════════════════
-- 0133 · 규칙 이력 보호를 **권한에만 기대지 않는다**
--
-- 0132 가 `authenticated`·`anon` 의 직접 쓰기 권한을 걷었다. 맞는 조치인데,
-- 그 보호는 **권한 한 줄에만** 서 있다. 나중에 누군가
--     grant all on all tables in schema public to authenticated;
-- 한 줄을 돌리면 조용히 풀린다 — 실제로 내 새 DB 빌드 스크립트가 그러고 있었고,
-- 그래서 새 DB 에서만 권한이 `arwdDxt` 로 돌아가 있었다(개발 DB 는 걷힌 채였다).
-- 권한이 풀렸는지는 아무도 안 본다. 그게 이런 보호의 문제다.
--
-- 그래서 테이블 자체에 문을 하나 더 단다.
--
-- ⚠ 판별은 간단하다. `set_operating_hours` 는 `security definer` 라 **소유자로** 돈다.
--   앱이 직접 쓰면 `authenticated`(또는 `anon`)로 온다. 그 둘만 막으면 된다.
--   마이그레이션·시드·트리거(전부 definer)는 소유자라 그대로 통과한다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.operating_rules_rpc_only() returns trigger
language plpgsql as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception '영업시간은 영업시간 화면에서만 바꿀 수 있어요'
      using errcode = '42501',
            detail  = '규칙 이력을 직접 고치면 과거 날짜 해석이 바뀝니다. set_operating_hours() 를 쓰세요.';
  end if;
  return coalesce(new, old);
end $fn$;

comment on function public.operating_rules_rpc_only() is
  '규칙 이력은 set_operating_hours() 로만 바꾼다(0133). 권한이 풀려도 이 문은 닫혀 있다.';

/*
 * ⚠ 이름이 `00_` 으로 시작하는 이유 — 같은 시점의 트리거는 **이름 순서**로 돈다.
 *   `operating_rules_guard`(겹침·형식 검사)가 먼저 돌면, 앱이 남의 규칙을 밀어 넣을 때
 *   `영업시간 규칙이 겹쳐요`(23505) 가 먼저 나온다. 인가 실패를 업무 오류로 알려 주는 셈이다.
 *   인가는 언제나 제일 먼저 본다.
 */
drop trigger if exists operating_rules_rpc_only_trg on public.operating_rules;
drop trigger if exists operating_rules_00_rpc_only on public.operating_rules;
create trigger operating_rules_00_rpc_only
  before insert or update or delete on public.operating_rules
  for each row execute function public.operating_rules_rpc_only();


-- ── 사후 확인 ────────────────────────────────────────────────────
/*
 * 실제로 `authenticated` 로 내려가서 막히는지 본다.
 * ⚠ "트리거가 붙었다"만 보면 안 된다 — 붙어 있는데 조건이 틀려 아무도 안 막을 수 있다.
 *   0132 의 확인이 권한만 봤다가 새 DB 에서 권한이 되살아난 걸 못 잡았다.
 */
do $v$
declare v_store uuid; v_ok boolean := false;
begin
  select id into v_store from public.stores limit 1;
  if v_store is null then return; end if;

  begin
    set local role authenticated;
    update public.operating_rules set weekly_hours = weekly_hours where store_id = v_store;
  exception when insufficient_privilege then
    v_ok := true;
  end;
  reset role;

  if not v_ok then
    raise exception '0133: authenticated 가 규칙을 직접 고칠 수 있습니다';
  end if;

  -- 인가 트리거가 **제일 먼저** 도는가. 이름 순서라 이름이 뒤면 다른 오류가 먼저 난다.
  if (select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'operating_rules' and not t.tgisinternal
       order by tgname limit 1) <> 'operating_rules_00_rpc_only' then
    raise exception '0133: 인가 트리거가 첫 번째가 아닙니다';
  end if;

  -- 소유자는 통과해야 한다. 안 그러면 마이그레이션·시드가 막힌다.
  update public.operating_rules set weekly_hours = weekly_hours where store_id = v_store;
end $v$;

select public.assert_no_rpc_overloads();
