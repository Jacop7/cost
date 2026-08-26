-- ════════════════════════════════════════════════════════════════
-- 0141 · 되열기와 자동 종료 확인을 **서버에서** 없앤다
--
-- 0140 은 앱의 훅만 지웠다. 그런데 RPC 는 그대로 열려 있었다 —
--     reopen_business_day(uuid, date)  authenticated = true
-- 즉 화면에 버튼만 없을 뿐, 인증 사용자는 종료된 장부를 **그대로 다시 열 수 있었다.**
-- 기획서 §6.4 가 "종료된 장부를 다시 열지 않는다" 로 정한 것을 앱 화면 하나로만
-- 막고 있었던 셈이다. 규칙은 서버에 있어야 한다.
--
-- "시험이 쓴다"는 이유로 운영 함수를 남기면 안 된다. 시험은 소유자로 직접 고치면 된다 —
-- 그건 시험이 할 수 있는 일이고, 앱 사용자가 할 수 있는 일과는 다르다.
--
-- ── 자동 종료 확인 배너도 같이 ─────────────────────────────────
-- 기획서 §5-4: "예정 종료는 **정상 동작이므로 매일 확인 배너를 띄우지 않는다.**"
-- §6.1 도 상태 카드에 추가 행동 버튼·종료 원인 문장을 두지 말라고 못 박았다.
-- 그래서 `ack_auto_close`·`unacked_auto_close`·`business_day_state.unacked` ·
-- `business_days.auto_close_ack` 은 전부 **껍데기**다. 화면에 붙일 계획이 없다.
-- 남겨 두면 다음 사람이 "쓰다 만 기능" 으로 읽고 되살린다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 되열기 삭제 ───────────────────────────────────────────────
drop function if exists public.reopen_business_day(uuid, date);


-- ── ② 확인 배너 일체 삭제 ───────────────────────────────────────
/*
 * `business_day_state` 에서 `unacked` 를 뺀다.
 * ⚠ 응답 키를 빼는 건 앱 계약 변경이다. 앱의 `BusinessDayState.unacked` 도 같은
 *   커밋에서 지운다 — 한쪽만 지우면 화면이 `undefined` 를 그린다.
 */
do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';
  if v_def is null then raise exception '0141: business_day_state 가 없습니다'; end if;

  if position('unacked' in v_def) = 0 then return; end if;   -- 이미 적용됨

  -- 응답 조립에서 그 줄 하나만 걷어낸다.
  select line into v_old
    from regexp_split_to_table(v_def, E'\n') as line
   where line like '%unacked%'
   limit 1;
  if v_old is null then raise exception '0141: unacked 줄을 못 찾았습니다'; end if;

  execute replace(v_def, v_old || E'\n', '');
end $m$;

drop function if exists public.ack_auto_close(uuid);
drop function if exists public.unacked_auto_close(uuid);

-- 그 둘만 쓰던 컬럼이다. 남겨 두면 되살릴 자리가 된다.
alter table public.business_days drop column if exists auto_close_ack;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_n int; v_def text; v_key text;
begin
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('reopen_business_day', 'ack_auto_close', 'unacked_auto_close');
  if v_n > 0 then raise exception '0141: 지워야 할 함수가 %개 남았습니다', v_n; end if;

  if exists (select 1 from information_schema.columns
              where table_name = 'business_days' and column_name = 'auto_close_ack') then
    raise exception '0141: auto_close_ack 컬럼이 남았습니다';
  end if;

  /*
   * 상태 RPC 가 `unacked` 를 더 이상 조립하지 않는다.
   * ⚠ 실제로 불러 보지 않는다 — `business_day_state` 는 첫 줄이 `assert_my_store` 라
   *   마이그레이션(로그인 없음)에서는 언제나 막힌다. 처음에 그렇게 짰다가 걸렸다.
   *   대신 정의를 본다. **주석 줄은 뺀다**(이 저장소에서 여섯 번 겪은 함정이다).
   */
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'
') as line
     where n.nspname = 'public' and p.proname = 'business_day_state'
       and line like '%unacked%'
       and btrim(line) not like '--%')
  then
    raise exception '0141: business_day_state 가 아직 unacked 를 조립합니다';
  end if;

  -- 있어야 할 키가 같이 날아가지 않았는지도 본다.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';
  foreach v_key in array array['''status''', '''business_date''', '''local_date''',
                               '''planned_close_at''', '''auto_close_at'''] loop
    if position(v_key in v_def) = 0 then
      raise exception '0141: business_day_state 에서 % 키가 사라졌습니다', v_key;
    end if;
  end loop;
end $v$;

select public.assert_no_rpc_overloads();
