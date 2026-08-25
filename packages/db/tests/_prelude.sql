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
declare
  v_day date := business_day();
  v_n   int;
  v_st  text;
  v_other int;
begin
  /*
   * ⚠ 잡는 것은 **예상된 상태 충돌뿐**이다.
   *     22000  아직 열려 있음 · 영업 중이 아님 · 미래 날짜
   *     23505  이미 종료된 날
   *     P0002  되열 종료 기록이 없음
   *   `when others` 로 뭉뚱그리면 `open_business_day` **자체가 망가져도** 헬퍼가
   *   조용히 삼키고 날짜를 돌려준다. 그러면 시험 전체가 그 회귀를 못 본다.
   */

  -- 없으면 연다.
  begin
    perform open_business_day(pg_temp.store(), v_day);
  exception when sqlstate '22000' or sqlstate '23505' then null;
  end;

  -- 닫혀 있으면 되연다.
  if (select status::text from business_days
       where store_id = pg_temp.store() and business_date = v_day) = 'closed' then
    begin
      perform reopen_business_day(pg_temp.store(), v_day);
    exception when sqlstate '22000' or sqlstate 'P0002' then null;
    end;
  end if;

  -- 다른 날이 열려 있어 오늘을 못 열었으면 그 날을 닫고 오늘을 연다.
  if not exists (select 1 from business_days
                  where store_id = pg_temp.store() and business_date = v_day
                    and status::text <> 'closed') then
    begin
      perform close_business_day(pg_temp.store());
      perform open_business_day(pg_temp.store(), v_day);
    exception when sqlstate '22000' or sqlstate '23505' or sqlstate '45002' then null;
    end;
    -- 그래도 안 열렸으면 되열기를 한 번 더 시도한다(오늘이 이미 종료된 경우).
    if (select status::text from business_days
         where store_id = pg_temp.store() and business_date = v_day) = 'closed' then
      begin
        perform reopen_business_day(pg_temp.store(), v_day);
      exception when sqlstate '22000' or sqlstate 'P0002' then null;
      end;
    end if;
  end if;

  /*
   * ── 사후조건 ────────────────────────────────────────────────
   * ⚠ 여기가 없으면 위의 예외 처리들이 **실패를 성공처럼** 보이게 만든다.
   *   헬퍼는 "열어 준다" 고 약속했으므로, 못 열었으면 **여기서 터져야** 한다.
   *   안 터지면 그 뒤 시험이 엉뚱한 이유로 빨개지고 원인을 못 찾는다.
   */
  select count(*), max(status::text) into v_n, v_st
    from business_days where store_id = pg_temp.store() and business_date = v_day;

  if v_n <> 1 then
    raise exception 'open_today: 오늘(%) 영업일이 %개입니다 — 정확히 1개여야 합니다', v_day, v_n
      using errcode = '45003';
  end if;
  if v_st not in ('open', 'break') then
    raise exception 'open_today: 오늘(%) 영업일이 %입니다 — open 또는 break 여야 합니다', v_day, v_st
      using errcode = '45003';
  end if;

  select count(*) into v_other from business_days
   where store_id = pg_temp.store() and business_date <> v_day and status::text <> 'closed';
  if v_other > 0 then
    raise exception 'open_today: 다른 날짜에 열린 영업일이 %개 남아 있습니다', v_other
      using errcode = '45003';
  end if;

  return v_day;
end $h$;


/*
 * 오늘을 **영업 전**으로 되돌린다. `open_today()` 의 짝이다.
 *
 * ⚠ 예전엔 부르는 쪽마다 이렇게 적혀 있었다 —
 *       begin perform close_business_day(...); exception when others then null; end;
 *   닫혀 있을 때 나는 정상 실패를 넘기려던 것인데, `when others` 라 **모든** 실패를
 *   같이 삼킨다. 다음 단계에서 `close_business_day()` 자체를 고칠 텐데, 그때 진짜
 *   원인이 여기서 조용히 사라진다. 그래서 예상 SQLSTATE 만 잡고 사후조건을 확인한다.
 *
 *   22000 = 영업 중이 아니에요 (애초에 안 열림 — 원하는 상태가 이미 맞다)
 *   45002 = 이미 종료된 영업일이에요 (역시 원하는 상태다)
 */
create function pg_temp.close_today() returns date
language plpgsql as $h$
declare v_day date := business_day(); v_st text;
begin
  begin
    perform close_business_day(pg_temp.store());
  exception
    when sqlstate '22000' or sqlstate '45002' then null;
  end;

  -- ── 사후조건: 오늘이 열려 있지 않다 ──
  select max(status::text) into v_st
    from business_days
   where store_id = pg_temp.store() and business_date = v_day;

  if v_st in ('open', 'break') then
    raise exception 'close_today: 오늘(%) 영업일이 아직 %입니다 — 닫히지 않았습니다', v_day, v_st
      using errcode = '45003';
  end if;

  return v_day;
end $h$;
