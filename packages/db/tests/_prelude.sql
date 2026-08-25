-- ════════════════════════════════════════════════════════════════
-- 테스트 공통 서두 — 러너가 각 테스트 파일 앞에 붙인다.
--
-- 원칙 3가지
--  1. 트랜잭션 안에서만 돌고 **롤백한다**. 시드를 더럽히지 않으니 순서에 무관하다.
--  2. `authenticated` 역할 + JWT 클레임으로 돈다. RLS 를 우회하지 않는다 —
--     RLS 를 켠 채로 통과해야 실제 앱과 같은 조건이다.
--  3. 실패는 예외로 던진다. psql 이 ON_ERROR_STOP 으로 즉시 비정상 종료한다.
--
-- ⚠ psql 은 dollar-quote 안에서 :변수 를 치환하지 않는다(함수 본문 보호).
--   그래서 do 블록에서 쓸 값은 반드시 **함수**로 노출한다. pg_temp.store() 참고.
-- ════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set QUIET on
\pset pager off

begin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- ── 시드 고정 ID (바뀌면 테스트가 먼저 터진다 — 그게 맞다) ──────

create function pg_temp.store() returns uuid
language sql immutable as $h$ select '00000000-0000-0000-0000-0000000000b1'::uuid $h$;

create function pg_temp.owner() returns uuid
language sql immutable as $h$ select '00000000-0000-0000-0000-0000000000a1'::uuid $h$;

-- ── 단언 헬퍼 (pg_temp = 이 세션에서만 산다) ────────────────────

create function pg_temp.ok(p_label text, p_cond boolean) returns void
language plpgsql as $h$
begin
  if p_cond is not true then
    raise exception E'FAIL  %\n        기대: 참, 실제: %', p_label, coalesce(p_cond::text, 'null');
  end if;
  raise notice '  ok   %', p_label;
end $h$;

create function pg_temp.eq(p_label text, p_got numeric, p_want numeric, p_tol numeric default 0.005)
returns void language plpgsql as $h$
begin
  if p_got is null or abs(p_got - p_want) > p_tol then
    raise exception E'FAIL  %\n        기대: %, 실제: %', p_label, p_want, coalesce(p_got::text, 'null');
  end if;
  raise notice '  ok   %  = %', p_label, round(p_got, 4);
end $h$;

create function pg_temp.eq_t(p_label text, p_got text, p_want text) returns void
language plpgsql as $h$
begin
  if p_got is distinct from p_want then
    raise exception E'FAIL  %\n        기대: %, 실제: %', p_label, p_want, coalesce(p_got, 'null');
  end if;
  raise notice '  ok   %  = %', p_label, p_got;
end $h$;

-- 어떤 SQL 이 **반드시 실패해야** 할 때. 성공하면 그게 버그다.
create function pg_temp.raises(p_label text, p_sql text, p_errcode text default null)
returns void language plpgsql as $h$
declare v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if p_errcode is not null and v_state <> p_errcode then
      raise exception E'FAIL  %\n        기대 errcode: %, 실제: %', p_label, p_errcode, v_state;
    end if;
    raise notice '  ok   %  (거부됨 %)', p_label, v_state;
    return;
  end;
  raise exception E'FAIL  %\n        거부되어야 하는데 성공했다', p_label;
end $h$;

-- ── 자주 쓰는 조회 ─────────────────────────────────────────────

create function pg_temp.ing(p_name text) returns uuid
language sql stable as $h$
  select id from ingredients where name = p_name and store_id = pg_temp.store()
$h$;

create function pg_temp.rcp(p_name text) returns uuid
language sql stable as $h$
  select id from recipes where name = p_name and store_id = pg_temp.store()
$h$;

-- ── 영업일 준비 ────────────────────────────────────────────────
/*
 * 오늘 영업일을 **열린 상태로** 만들어 준다. 이미 열려 있으면 그대로 둔다.
 *
 * ⚠ 이게 없으면 시험이 **바깥 세상에 기댄다.** 실제로 그랬다 —
 *   앱의 자동 마감이 22:00 에 오늘 장부를 닫아 버리자 시험 다섯 개가 빨개졌고,
 *   사람이 앱에서 되열어야 초록이 됐다. 그건 검증이 아니라 운이다.
 *
 * ⚠ 트랜잭션 안에서 돌고 롤백되므로 진짜 장부를 바꾸지 않는다.
 *   각 시험 파일이 제 손으로 begin/exception 을 적던 걸 여기로 모은다.
 */
create function pg_temp.open_today() returns date
language plpgsql as $h$
declare v_day date := business_day();
begin
  -- 없으면 연다.
  begin
    perform open_business_day(pg_temp.store(), v_day);
    return v_day;
  exception when others then null;
  end;

  -- 닫혀 있으면 되연다.
  if (select status::text from business_days
       where store_id = pg_temp.store() and business_date = v_day) = 'closed' then
    begin
      perform reopen_business_day(pg_temp.store(), v_day);
    exception when others then null;
    end;
  end if;

  -- 다른 날이 열려 있어 오늘을 못 열었으면 그 날을 닫고 오늘을 연다.
  if not exists (select 1 from business_days
                  where store_id = pg_temp.store() and business_date = v_day
                    and status::text <> 'closed') then
    begin
      perform close_business_day(pg_temp.store());
      perform open_business_day(pg_temp.store(), v_day);
    exception when others then null;
    end;
  end if;

  return v_day;
end $h$;
