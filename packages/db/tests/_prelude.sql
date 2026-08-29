-- ════════════════════════════════════════════════════════════════
-- 테스트 공통 서두 — 러너가 각 테스트 파일 앞에 붙인다.
--
-- 원칙 3가지
--  1. 트랜잭션 안에서만 돌고 **롤백한다**. 시드를 더럽히지 않으니 순서에 무관하다.
--  2. 내부 공식까지 재는 백색상자 스위트는 `sikjae_rpc_executor` + 실제 JWT 클레임으로 돈다.
--     이 역할은 RLS를 우회하지 않는다. 앱 롤의 직접 공격면은 34번이 `authenticated`로 따로 잰다.
--  3. 실패는 예외로 던진다. psql 이 ON_ERROR_STOP 으로 즉시 비정상 종료한다.
--
-- ⚠ psql 은 dollar-quote 안에서 :변수 를 치환하지 않는다(함수 본문 보호).
--   그래서 do 블록에서 쓸 값은 반드시 **함수**로 노출한다. pg_temp.store() 참고.
-- ════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set QUIET on
\pset pager off

begin;

set local role sikjae_rpc_executor;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- ── 시드 고정 ID (바뀌면 테스트가 먼저 터진다 — 그게 맞다) ──────

create function pg_temp.store() returns uuid
language sql immutable as $h$ select '00000000-0000-0000-0000-0000000000b1'::uuid $h$;

create function pg_temp.owner() returns uuid
language sql immutable as $h$ select '00000000-0000-0000-0000-0000000000a1'::uuid $h$;

/*
 * 계정당 매장은 하나다(0167 UNIQUE). 교차 매장 시험(27 ⑰ · 29 뉴욕 · 30 · 31)의 두 번째 매장은
 * **다른 사장님** 것이다 — 문지기 assert_my_store 는 p_store 만 보므로 남남이어도 통과하고,
 * 재려는 경계("메뉴가 남의 매장 것")는 그와 별개의 검사다. 운영 스키마에 시험용 우회는 없다.
 */

/** 다른 사장님 — auth.users 행을 만든다(소유자). ⚠ 끝나면 롤이 authenticated 다. */
create function pg_temp.new_owner() returns uuid
language plpgsql as $h$
declare v uuid := gen_random_uuid();
begin
  set local role postgres;
  insert into auth.users (id) values (v);
  set local role sikjae_rpc_executor;
  return v;
end $h$;

/** 설정 판본(0171) — save_settings 의 p_base_revision 으로 되보낼 현재 값. 시험은 늘 최신 판본으로 저장한다. */
create function pg_temp.settings_rev(p_store uuid) returns integer
language sql stable as $h$ select revision from settings where store_id = p_store $h$;

/** 세션의 사장님을 바꾼다(JWT 클레임). 블록 끝에 pg_temp.as_owner(pg_temp.owner()) 로 되돌릴 것. */
create function pg_temp.as_owner(p_uid uuid) returns void
language plpgsql as $h$
begin
  set local role postgres;
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role sikjae_rpc_executor;
end $h$;

/*
 * 시험이 말하는 '오늘' — 시드 매장의 **판매 영업일**(0154).
 * 예전엔 전역 business_day() 였는데 0155 에서 지웠다 — settings limit 1 이라
 * 매장을 안 가렸다. 지금은 매장 컨텍스트가 규칙으로 구한다.
 */
create function pg_temp.today() returns date
language sql stable as $h$
  select (resolve_sales_business_context(pg_temp.store())).sales_date
$h$;

/*
 * 영업시간 저장 — 앱 문(set_operating_hours)은 편집 기준 판본이 **필수**다(0163).
 * 시험이 매번 열린 행의 rule_id·revision 을 읽어 싣는다. 화면이 하는 일과 같다.
 */
create function pg_temp.set_hours(p_hours jsonb, p_breaks jsonb default '{}'::jsonb) returns jsonb
language plpgsql as $h$
declare r record;
begin
  select id, revision into r from operating_rules
   where store_id = pg_temp.store() and effective_to is null;
  return set_operating_hours(pg_temp.store(), p_hours, p_breaks, r.id, r.revision);
end $h$;

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
/*
 * 시험 전용 영업 시작 문.
 *
 * 제품은 규칙 종료 뒤 종료 시각 없는 개점을 45015 로 거부한다. 시험 준비만 시드와 같은
 * 정식 늦은 개점 경로를 사용해 매장 현지 시각 두 시간 뒤를 고른다. 45015 를 삼키거나
 * 제품 규칙을 느슨하게 하지 않는다.
 */
create function pg_temp.open_for_test(p_store uuid, p_late_close_time time default null) returns jsonb
language plpgsql as $h$
declare
  v_result jsonb;
  v_count  integer;
  v_status text;
begin
  begin
    v_result := transition_business_state(p_store, 'open');
  exception
    when sqlstate '45015' then
      v_result := transition_business_state(
        p_store, 'open',
        coalesce(
          p_late_close_time,
          ((clock_timestamp() at time zone store_timezone(p_store)) + interval '2 hours')::time));
  end;

  select count(*), max(d.status::text) into v_count, v_status
    from business_days d
   where d.id = (v_result->>'business_day_id')::uuid
     and d.store_id = p_store;
  if v_count <> 1 or v_status not in ('open', 'break') then
    raise exception 'open_for_test: 반환 영업일이 매장에 열린 상태로 존재하지 않습니다'
      using errcode = '45003';
  end if;

  return v_result;
end $h$;

create function pg_temp.open_today() returns date
language plpgsql as $h$
declare
  v_day date := pg_temp.today();
  v_n   int;
  v_st  text;
  v_other int;
begin
  /*
   * ⚠ 잡는 것은 **예상된 상태 충돌뿐**이다.
   *     22000  아직 열려 있음 · 영업 중이 아님 · 미래 날짜
   *     23505  이미 종료된 날
   *     45015  규칙 종료가 지난 늦은 개점 — 시드와 같이 두 시간 뒤 종료로 재시도
   *     P0002  되열 종료 기록이 없음
   *   `when others` 로 뭉뚱그리면 `open_business_day` **자체가 망가져도** 헬퍼가
   *   조용히 삼키고 날짜를 돌려준다. 그러면 시험 전체가 그 회귀를 못 본다.
   */

  -- 없으면 연다.
  begin
    perform pg_temp.open_for_test(pg_temp.store());   -- v_day = 판매 영업일이라 동치(0160)
  exception
    when sqlstate '22000' or sqlstate '23505' then null;
  end;

  -- 오늘이 아직 안 열렸다면 다른 날을 먼저 닫은 뒤 오늘을 연다.
  if not exists (select 1 from business_days
                  where store_id = pg_temp.store() and business_date = v_day
                    and status::text <> 'closed') then
    /*
     * 오늘의 닫힌 행을 먼저 되열면 다른 날짜의 열린 행과 둘이 동시에 열린다.
     * 반드시 다른 날짜를 먼저 닫고, 그 성공이 보존된 뒤 오늘을 열거나 되연다.
     *
     * 종료와 재개점을 같은 예외 블록에도 넣지 않는다.
     * 재개점이 23505(오늘 행이 이미 종료됨) 등으로 실패하면 PL/pgSQL 하위
     * 트랜잭션이 블록 전체를 되돌린다. 그러면 앞에서 성공한 종료까지 취소돼
     * 다른 날짜의 열린 장부가 남는다. 두 동작은 각각 제 결과를 보존해야 한다.
     */
    if exists (select 1 from business_days
                where store_id = pg_temp.store() and business_date <> v_day
                  and status::text <> 'closed') then
      begin
        perform transition_business_state(pg_temp.store(), 'end');
      exception when sqlstate '22000' or sqlstate '45002' then null;
      end;
    end if;

    -- 다른 날이 실제로 닫힌 뒤에만 오늘을 연다. 실패하면 아래 사후조건이 원인을 드러낸다.
    if not exists (select 1 from business_days
                    where store_id = pg_temp.store() and business_date <> v_day
                      and status::text <> 'closed') then
      if (select status::text from business_days
           where store_id = pg_temp.store() and business_date = v_day) = 'closed' then
        perform pg_temp.force_open(v_day);   -- 소유자로 직접 되돌린다(0141)
      else
        begin
          perform pg_temp.open_for_test(pg_temp.store());   -- v_day = 판매 영업일이라 동치(0160)
        exception when sqlstate '23505' then null;
        end;
      end if;
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

  /*
   * ⚠ 시각 독립(0158 검토에서 실측): 예정 종료 22:00 + 유예가 지난 23:00 이후에
   *   스위트를 돌리면 오늘 판매 저장이 전부 DAY_CLOSED 로 빨개졌다(08·20·21·22·27·29)
   *   — 시험이 바깥 세상의 시각에 기대고 있었다. 열린 오늘의 예정 종료가 이미
   *   지났으면 두 시간 뒤로 민다. 기한을 직접 재는 시험은 이 뒤에 제 손으로
   *   값을 다시 놓으므로 영향이 없다.
   */
  set local role postgres;
  update business_days
     set planned_close_at = clock_timestamp() + interval '2 hours'
   where store_id = pg_temp.store() and business_date = v_day
     and status::text <> 'closed'
     and planned_close_at is not null
     and planned_close_at <= clock_timestamp();
  set local role sikjae_rpc_executor;

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
declare v_id uuid; v_day date; v_st text;
begin
  /*
   * ⚠ **닫기 전에 실제로 열려 있는 행을 잡아 둔다.** 예전엔 `business_day()` 로 오늘을
   *   구해 그 날짜만 확인했는데, `business_day()` 는 `business_cutoff()` → `settings`
   *   를 읽는다. 시험 도중 영업시간을 18:00~02:00 으로 바꾸면 cutoff 가 생겨
   *   **검사 날짜가 전날로 옮겨 간다.** 실제 실행 시각이 00:00~02:00 이면 오늘 장부가
   *   안 닫혔는데도 사후조건이 통과한다 — 시각에 기대는 시험이 된다.
   *   여는 쪽이 만든 그 행을 그대로 따라가면 시각과 무관해진다.
   */
  select id, business_date into v_id, v_day
    from business_days
   where store_id = pg_temp.store() and status::text <> 'closed'
   order by business_date desc
   limit 1;

  if v_id is null then
    return pg_temp.today();   -- 열린 게 없다. 원하는 상태가 이미 맞다.
  end if;

  begin
    perform transition_business_state(pg_temp.store(), 'end');
  exception
    -- 22000 = 영업 중이 아니에요 / 45002 = 이미 종료된 영업일이에요. 둘 다 원하는 상태다.
    when sqlstate '22000' or sqlstate '45002' then null;
  end;

  -- ── 사후조건: **그 행**이 닫혔다 ──
  select status::text into v_st from business_days where id = v_id;
  if v_st is distinct from 'closed' then
    raise exception 'close_today: %(%) 영업일이 아직 %입니다 — 닫히지 않았습니다',
      v_day, v_id, coalesce(v_st, '(사라짐)')
      using errcode = '45003';
  end if;

  return v_day;
end $h$;


/*
 * 함수 **코드**에 그 글자가 있는가. 주석 줄은 뺀다.
 *
 * ⚠ 이 헬퍼가 있는 이유 — `pg_get_functiondef()` 를 통째로 `like` 로 훑는 단언을
 *   네 번 썼고 **네 번 다 자기 주석에 걸렸다.** 설명을 잘 적을수록 더 잘 걸린다.
 *   ("`clock_timestamp()` 다 — `now()` 는 …" 이라고 적어 두면 `now()` 로 바꿔 놔도
 *    `clock_timestamp` 가 주석에 남아 단언이 통과한다.)
 *   코드를 확인하고 싶으면 코드만 봐야 한다.
 */
create function pg_temp.fn_code_has(p_fn regprocedure, p_needle text) returns boolean
language sql stable as $h$
  select exists (
    select 1
      from regexp_split_to_table(pg_get_functiondef(p_fn), E'\n') as line
     where line like '%' || p_needle || '%'
       and btrim(line) not like '--%'
       and btrim(line) not like '*%'
       and btrim(line) not like '/*%')
$h$;


/*
 * 스윕을 소유자 자격으로 돌린다. 앱 롤은 못 부른다(0137·0138) —
 * 매장을 안 가리는 definer 라 사람에게는 아예 안 열었기 때문이다.
 */
create function pg_temp.as_owner_sweep() returns jsonb
language plpgsql as $h$
declare v_res jsonb;
begin
  set local role postgres;
  v_res := close_due_business_days();
  set local role sikjae_rpc_executor;
  return v_res;
end $h$;


/*
 * 그 날짜 장부를 **강제로 열린 상태로** 되돌린다. 시험 준비용이다.
 *
 * ⚠ 예전엔 `reopen_business_day()` 를 썼는데, 그건 운영 RPC 였고 인증 사용자에게
 *   열려 있었다 — 화면에 버튼만 없을 뿐 종료된 장부를 누구나 다시 열 수 있었다.
 *   기획서 §6.4 는 "종료된 장부를 다시 열지 않는다" 다. 그래서 그 함수를 지웠고(0141),
 *   시험은 **소유자로 직접** 고친다. 시험이 할 수 있는 일과 앱 사용자가 할 수 있는
 *   일은 다르다 — 그 차이를 없애려고 운영 함수를 남기면 안 된다.
 */
create function pg_temp.force_open(p_day date) returns void
language plpgsql as $h$
declare v_n int;
begin
  set local role postgres;
  update business_days
     set status = 'open', closed_at = null, close_method = null
   where store_id = pg_temp.store() and business_date = p_day;
  get diagnostics v_n = row_count;
  set local role sikjae_rpc_executor;

  /*
   * ⚠ 사후조건. 대상 행이 없어도 조용히 성공하면 **시험 준비가 실패한 걸 모른 채**
   *   본문이 돌고, 엉뚱한 자리에서 빨개진다. `open_today()` 가 사후조건을 갖게 된
   *   것과 같은 이유다.
   */
  if v_n <> 1 then
    raise exception 'force_open: %(%) 영업일이 %개입니다 — 정확히 1개여야 합니다',
      p_day, pg_temp.store(), v_n
      using errcode = '45003';
  end if;
end $h$;


/*
 * 판매 이벤트를 **소유자로** 부른다.
 *
 * ⚠ `e10_sale_recorded` 는 앱 롤에서 걷혔다(0145). 이제 몸통 계열이라 부르는 곳은
 *   `apply_sale_items` 뿐이고, 문은 `save_sale` 과 `amend_ended_business_day` 다.
 *   시험은 이벤트 자체를 직접 재야 하므로 소유자로 부른다 — 0141 의 `force_open`
 *   과 같은 판단이다.
 */
create function pg_temp.e10(
  p_store uuid, p_date date, p_recipe uuid,
  p_qty_hall numeric default 0, p_qty_delivery numeric default 0,
  p_qty_takeout numeric default 0, p_qty_waste numeric default 0,
  p_allow_closed boolean default false
) returns jsonb
language plpgsql as $h$
declare v jsonb;
begin
  set local role postgres;
  v := e10_sale_recorded(p_store, p_date, p_recipe,
                         p_qty_hall, p_qty_delivery, p_qty_takeout, p_qty_waste, p_allow_closed);
  set local role sikjae_rpc_executor;
  return v;
end $h$;
