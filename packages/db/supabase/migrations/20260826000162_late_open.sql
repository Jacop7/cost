/*
 * 0162 · 늦은 개점 — 오늘만, 종료 시간을 골라서 (검토 P1-4)
 *
 * 실측된 공백: 규칙 종료 + 유예가 지난 뒤(예: 22:00 마감 규칙에서 23:10) 영업을
 * 시작하면 — 직접 시작은 크론이 1분 안에 auto 로 닫고, 첫 판매와 함께 시작하면
 * 그 자리에서 45002 로 전체 롤백됐다. 늦은 밤 장사를 시스템이 못 받았다.
 *
 * 결정(검토 권장안): **오늘만 늦은 개점**.
 *   · 규칙상 오늘 영업이 이미 끝난 시각에 열려면 오늘 마칠 시간을 고른다(45015 로 요구).
 *   · 고른 시간은 그 영업일의 planned_close_at 에만 들어간다 — 주간 설정 불변.
 *   · 자동 종료는 고른 종료 + 기존 유예(게이트·크론이 planned 를 쓰므로 그대로 성립).
 *   · 다음 영업 시작과 겹치면 거부 — 겹치면 그 시각의 판매가 어느 날인지 모호해진다.
 *   · 기본값 제안(현지 지금 + 1시간, 15분 올림)은 화면 몫이다.
 */

-- ── ① 다음 영업 시작 — 겹침 검사의 기준 ─────────────────────────
create or replace function public.next_scheduled_open(p_store uuid, p_after date)
returns timestamptz
language plpgsql
stable
as $$
declare
  d int;
  h jsonb;
begin
  for d in 1..7 loop
    h := store_hours_on(p_store, p_after + d);
    if h is not null and not coalesce((h->>'closed')::boolean, false)
       and (h->>'open_time') is not null then
      return ((p_after + d)::timestamp + (h->>'open_time')::time)
               at time zone store_timezone(p_store);
    end if;
  end loop;
  return null;   -- 일주일 내 영업일이 없다(전 요일 휴무) — 겹칠 다음 시작도 없다.
end;
$$;
revoke execute on function public.next_scheduled_open(uuid, date) from public, anon;
grant  execute on function public.next_scheduled_open(uuid, date) to authenticated, service_role;

-- ── ② 시작 몸통 — 종료 시각 인자 (서명이 바뀌므로 옛 서명을 지운다) ──
drop function public.open_business_day(uuid, date);

create function public.open_business_day(
  p_store uuid, p_date date default null, p_close_time time default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ctx     public.sales_business_context;
  v_date  date;
  v_open  business_days;
  v_snap  jsonb;
  v_id    uuid;
  v_stale date;
  v_planned timestamptz;
  v_next    timestamptz;
begin
  perform assert_my_store(p_store);
  -- ⚠ 영업시간 변경과 한 줄로 세운다(0132). 안 그러면 옛 규칙으로 연 장부에
  --   새 규칙이 오늘부터 붙는 순간이 생긴다.
  perform lock_business_scope(p_store);

  ctx    := resolve_sales_business_context(p_store);
  v_date := coalesce(p_date, ctx.sales_date);

  if v_date > ctx.sales_date then
    raise exception '미래 날짜로는 영업을 시작할 수 없어요' using errcode = '22000';
  end if;

  v_open := current_business_day(p_store);
  if v_open.id is not null then
    -- 이미 열린 날이 있으면 그걸 돌려준다. 두 번 눌러도 새로 만들지 않는다(불변식 8).
    if v_open.business_date = v_date then
      if p_close_time is not null then
        -- 조용히 무시하면 사장님은 바뀐 줄 안다 — 이미 굳은 날의 종료는 여기서 못 바꾼다.
        raise exception '이미 시작한 날이에요 — 종료 시간은 시작할 때만 고를 수 있어요'
          using errcode = '22000';
      end if;
      return jsonb_build_object('business_day_id', v_open.id, 'business_date', v_open.business_date,
                                'status', v_open.status, 'already_open', true);
    end if;

    /*
     * 다른 날이 열려 있다 — 예정 종료가 지났으면 **여기서 닫고 연다.**
     * 마감과 시작이 한 트랜잭션이다(0154).
     * 방식은 시각이 정한다(0139) — 기한(예정+유예)까지 지났으면 auto(예정 시각 기록),
     * 유예 안이면 manual(지금 시각).
     */
    if v_open.planned_close_at is not null
       and clock_timestamp() >= v_open.planned_close_at then
      perform close_business_day_row(v_open.id,
        case when clock_timestamp() >= v_open.planned_close_at + auto_close_grace()
             then 'auto'::business_close_method else 'manual'::business_close_method end);
      v_stale := v_open.business_date;
    else
      raise exception '% 영업이 아직 열려 있어요. 먼저 종료해 주세요', v_open.business_date
        using errcode = '22000';
    end if;
  end if;

  -- 같은 날을 다시 여는 건 종료를 되돌리는 일이라 별도 경로여야 한다.
  if exists (select 1 from business_days where store_id = p_store and business_date = v_date) then
    raise exception '% 영업은 이미 종료됐어요', v_date using errcode = '23505';
  end if;

  /*
   * ── 늦은 개점(0162) ──────────────────────────────────────────
   * 규칙상 오늘 영업이 이미 끝난 시각이면, 그대로 열어 봐야 게이트(45002)와
   * 크론이 바로 닫는다. 오늘 마칠 시간을 골라야 연다 — 45015 는 오류가 아니라
   * "종료 시간을 골라 주세요"라는 다음 할 일이다(45001 과 같은 성격).
   */
  v_planned := planned_close(p_store, v_date);
  /*
   * ⚠ 오늘(판매 영업일)만이다. 과거 날짜 열기는 0160 부터 소유자 전용 재생 경로라
   *   "그날의 규칙 종료"가 그대로 굳는 게 맞다 — 실측: 시드의 22일 재생이 전부
   *   늦은 개점으로 읽혀 45015 에 걸렸다.
   */
  if v_date = ctx.sales_date
     and v_planned is not null and v_planned <= clock_timestamp() then
    if p_close_time is null then
      raise exception '오늘 영업시간이 이미 지났어요. 오늘 마칠 시간을 골라 주세요'
        using errcode = '45015', detail = 'LATE_OPEN';
    end if;
    v_planned := (v_date::timestamp + p_close_time) at time zone ctx.timezone;
    -- 고른 시각이 이미 지났으면 다음 날 그 시각이다(새벽 마감).
    if v_planned <= clock_timestamp() then
      v_planned := v_planned + interval '1 day';
    end if;
    -- 다음 영업 시작과 겹치면 그 시각의 판매가 어느 날인지 모호해진다 — 거부.
    v_next := next_scheduled_open(p_store, v_date);
    if v_next is not null and v_planned > v_next then
      raise exception '고른 종료(%)가 다음 영업 시작과 겹쳐요. 더 이른 시간을 골라 주세요',
        p_close_time using errcode = '22000';
    end if;
  elsif p_close_time is not null then
    -- 아직 영업시간 안 — 종료 시간을 받는 문은 늦은 개점뿐이다. 조용히 버리지 않는다.
    raise exception '아직 오늘 영업시간이에요 — 종료 시간은 늦은 개점에서만 고를 수 있어요'
      using errcode = '22000';
  end if;

  -- ⚠ 스냅샷이 비면 그날 아무 값도 못 쓴다. 행만 만들고 넘어가면 안 된다.
  v_snap := build_day_snapshot(p_store, v_date);
  if v_snap is null or v_snap = '{}'::jsonb then
    raise exception '오늘 적용할 값을 만들지 못했어요' using errcode = '22000';
  end if;

  insert into business_days (store_id, business_date, status, planned_close_at, snapshot, operating_rule_id, scheduled_open_at)
       values (p_store, v_date, 'open', v_planned, v_snap,
               (select id from operating_rule_at(p_store, v_date)),
               scheduled_open_at(p_store, v_date))
    returning id into v_id;

  -- 전이 감사(0157) — 시작은 이전 상태가 없다(null = 영업 전).
  perform record_state_transition(
    (select d from business_days d where d.id = v_id),
    null, 'open'::business_day_status, 'manual');

  -- 하루 한 번 도는 자리라 여기서 오래된 수정 내역을 청소한다(0076).
  begin
    perform purge_entity_changes();
  exception when others then
    -- 청소가 실패해도 영업 시작은 막지 않는다(곁일이다). 다만 삼키지도 않는다(0136).
    raise warning '수정 내역 청소 실패: % (%)', sqlerrm, sqlstate;
  end;

  return jsonb_build_object('business_day_id', v_id, 'business_date', v_date,
                            'status', 'open', 'already_open', false,
                            'closed_stale_date', v_stale,
                            -- 늦은 개점이었나 — 화면 안내용(고른 종료가 그대로 실렸다).
                            'late_open', v_planned is not null and p_close_time is not null,
                            'planned_close_at', v_planned);
end;
$$;
revoke execute on function public.open_business_day(uuid, date, time) from public, anon, authenticated;
comment on function public.open_business_day(uuid, date, time) is
'영업 시작 몸통(0160 내부 전용 · 0162 늦은 개점). 규칙 종료가 지난 시각이면 45015 로 종료 시간을 요구하고, 고른 시간은 그 영업일에만 굳는다(주간 설정 불변). 다음 영업 시작과 겹치면 거부.';

-- ── ③ 앱 문 — 전이·판매 저장으로 관통 ───────────────────────────
drop function public.transition_business_state(uuid, text);
create function public.transition_business_state(
  p_store uuid, p_action text, p_close_time time default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_day business_days;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄

  if p_action = 'open' then
    -- 시작은 open_business_day 가 몸통이다 — 스냅샷 굳히기·늦은 개점(0162)까지.
    return open_business_day(p_store, null, p_close_time);
  end if;

  if p_close_time is not null then
    raise exception '종료 시간은 영업 시작에서만 고를 수 있어요' using errcode = '22000';
  end if;

  if p_action = 'end' then
    return close_business_day(p_store);
  elsif p_action in ('start_break', 'resume') then
    v_day := current_business_day(p_store);
    if v_day.id is null then
      raise exception '영업 중이 아니에요' using errcode = '22000';
    end if;
    return set_break_row(v_day.id, p_action = 'start_break', 'manual');
  end if;

  raise exception '알 수 없는 전이예요: %', p_action using errcode = '22000';
end;
$$;
revoke execute on function public.transition_business_state(uuid, text, time) from public, anon;
grant  execute on function public.transition_business_state(uuid, text, time) to authenticated, service_role;

drop function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer, boolean);
create function public.save_sale(
  p_store uuid, p_date date, p_items jsonb,
  p_etc_items jsonb default null, p_extra_items jsonb default null,
  p_base_revision integer default null,
  p_open_day boolean default false,
  p_open_close_time time default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sales   uuid;
  v_result  jsonb := '[]'::jsonb;
  -- ⚠ `record` 가 아니라 타입이다(0154 실측) — null 행 필드 접근이 55000 으로 터진다.
  v_bday    business_days;
  v_status  text;
  v_rev     integer;
  v_work    boolean;
  v_ctx     public.sales_business_context;
  v_opened  boolean := false;
begin
  perform assert_my_store(p_store);

  v_ctx := resolve_sales_business_context(p_store);
  if p_date > v_ctx.sales_date then
    raise exception '미래 날짜의 매출은 등록할 수 없어요' using errcode = '22000';
  end if;

  v_work := coalesce(jsonb_array_length(p_items), 0) > 0
            or p_etc_items is not null or p_extra_items is not null;

  if v_work then
    -- ── 1) 영업일을 먼저 잠근다 ─────────────────────────────
    v_bday := business_day_of(p_store, p_date);
    if v_bday.id is null then
      /*
       * 첫 판매가 영업 시작을 겸한다(0154). 열기와 저장이 **한 트랜잭션**이다.
       * 늦은 밤이면 몸통이 45015 로 종료 시간을 요구하고, 화면이 고른 시간을
       * p_open_close_time 으로 되보낸다(0162) — 여전히 한 트랜잭션이다.
       * ⚠ 오늘(판매 영업일)만이다. 과거 날짜는 정정 RPC 의 문이다(§6.4).
       */
      if p_open_day and p_date = v_ctx.sales_date then
        perform open_business_day(p_store, p_date, p_open_close_time);
        v_bday := business_day_of(p_store, p_date);
        v_opened := true;
      else
        raise exception '아직 영업을 시작하지 않았어요' using errcode = '45001', detail = 'BEFORE_OPEN';
      end if;
    end if;

    -- ⚠ 잠금을 잡고 **그다음에** 상태를 읽는다. 순서가 반대면 잠금을 기다리는 동안
    --   종료된 것을 못 보고, 마감된 장부에 판매가 들어간다.
    perform 1 from business_days where id = v_bday.id for update;
    select status::text into v_status from business_days where id = v_bday.id;

    -- ⚠ 자동 마감 기한이 지났으면 아직 열려 있어도 안 받는다(0139, 기획서 §2.4).
    --   `clock_timestamp()` 다 — `now()` 는 트랜잭션 시작 시각에 고정된다.
    -- ⚠ 날짜 예외를 두지 않는다. 과거 판매는 정정 RPC 가 할 일이다(§6.4).
    if v_status <> 'closed'
       and v_bday.planned_close_at is not null
       and clock_timestamp() >= v_bday.planned_close_at + auto_close_grace() then
      raise exception '% 영업이 종료되어 판매를 저장할 수 없어요', p_date
        using errcode = '45002', detail = 'DAY_CLOSED';
    end if;
    if v_status = 'closed' then
      raise exception '% 영업이 종료되어 판매를 저장할 수 없어요', p_date
        using errcode = '45002', detail = 'DAY_CLOSED';
    end if;

    -- ── 2) 그날 매출 행을 만들면서 잠근다 ───────────────────
    -- 보고 나서 넣지 않는다(0116). 이 upsert 가 잡는 행 락이 동시 저장을 줄 세운다.
    insert into daily_sales (store_id, sale_date) values (p_store, p_date)
    on conflict (store_id, sale_date) do update set updated_at = now()
    returning id, revision into v_sales, v_rev;

    -- ── 3) 판본 검사 ────────────────────────────────────────
    -- ⚠ 잠금을 쥔 뒤에 잰다. 먼저 재면 재는 사이에 남이 커밋할 수 있다.
    if p_base_revision is not null and v_rev is distinct from p_base_revision then
      raise exception '다른 기기에서 판매 내역이 변경됐어요. 최신 내역을 다시 확인해 주세요.'
        using errcode = '45009', detail = 'REVISION_CONFLICT';
    end if;
  end if;

  -- ── 4·5) 판매·기타매출·지출 반영 — **몸통**이 한다(0145).
  v_result := apply_sale_items(p_store, p_date, v_sales, p_items, p_etc_items, p_extra_items);

  -- ── 6) 판본을 올린다 ──────────────────────────────────────
  if v_work then
    update daily_sales
       set revision = revision + 1, updated_at = now()
     where id = v_sales
    returning revision into v_rev;
  end if;

  -- 화면은 이 판본을 들고 있다가 다음 저장에 되보낸다.
  return jsonb_build_object('sale_date', p_date, 'items', v_result, 'revision', v_rev,
                            'day_opened', v_opened);
end;
$$;
revoke execute on function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer, boolean, time)
  from public, anon;
grant  execute on function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer, boolean, time)
  to authenticated, service_role;

-- ── ④ 상태 카드에 매장 시간대 — 화면이 현지 시각을 그릴 근거 ────
-- (검토 P2-6 도 같은 값이 필요하다 — 기기 시간대로 그리면 해외 매장이 틀린다.)
do $$
declare
  v_def text;
  v_old text := $a$    'local_date', ctx.local_date,$a$;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'business_day_state';
  if position(v_old in v_def) = 0 then
    raise exception '0162: business_day_state 앵커를 못 찾았습니다';
  end if;
  execute replace(v_def, v_old, array_to_string(array[
    $a$    'local_date', ctx.local_date,$a$,
    $a$    -- 매장 시간대(0162) — 화면이 예정·실제 종료를 **매장 현지**로 그린다(P2-6).$a$,
    $a$    'timezone', ctx.timezone,$a$
  ], E'\n'));
end $$;

-- ── ⑤ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  v_n int;
  v_def text;
begin
  for v_def in
    select proname from (values ('open_business_day'), ('transition_business_state'), ('save_sale')) t(proname)
  loop
    select count(*) into v_n from pg_proc
     where pronamespace = 'public'::regnamespace and proname = v_def;
    if v_n <> 1 then
      raise exception '0162: % 서명이 %개입니다', v_def, v_n;
    end if;
  end loop;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'open_business_day';
  if position('LATE_OPEN' in v_def) = 0 or position('next_scheduled_open' in v_def) = 0 then
    raise exception '0162: 늦은 개점 분기가 빠졌습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'business_day_state';
  if position('''timezone'', ctx.timezone' in v_def) = 0 then
    raise exception '0162: 상태 카드에 시간대가 빠졌습니다';
  end if;

  if has_function_privilege('authenticated', 'public.open_business_day(uuid, date, time)', 'execute') then
    raise exception '0162: 시작 몸통이 앱 롤에 열렸습니다 (0160 유지)';
  end if;
end $$;
