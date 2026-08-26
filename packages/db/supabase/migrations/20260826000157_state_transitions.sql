/*
 * 0157 · 영업 상태 전이 통합 (기획서 §11, transition_business_state)
 *
 * 지금까지 브레이크는 set_break(true/false)가 **상태값만** 바꿨다 —
 * 허용 상태 검사도, 감사 기록도, 설정된 브레이크 시간의 자동 전환도 없었다.
 * 상태가 어떻게 바뀌었는지 아무도 몰랐고, 브레이크 설정은 표시일 뿐이었다.
 *
 * 이제 —
 *   · 전이는 한 문(transition_business_state)으로 들어온다:
 *       open(영업 전→시작) · start_break(영업 중→브레이크) ·
 *       resume(브레이크→재개) · end(영업/브레이크→종료)
 *   · 몸통(set_break_row)이 행을 잠그고 상태를 재확인한다 — 틀린 전이는 45014.
 *   · 모든 전이가 business_state_transitions 에 남는다: 전·후 상태, 시각,
 *     자동/직접, 누가. 시작·종료·자동 마감(크론)·자동 브레이크 전부 같은 표다.
 *   · 설정된 브레이크 시간이 되면 크론(apply_due_breaks)이 같은 몸통으로
 *     전환한다. 사장님이 창 안에서 손으로 바꿨으면 그 결정을 존중한다 —
 *     경계 이후의 전이 기록이 있으면 자동은 물러선다.
 *   · set_break() 는 지운다 — 옛 문이 남으면 검사 없는 경로가 남는 것이다.
 */

-- ── ① 감사 표 ───────────────────────────────────────────────────
create table if not exists public.business_state_transitions (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id),
  business_day_id uuid not null references public.business_days(id),
  -- 시작(영업 전→open)은 이전 상태가 없다 — null 이 '영업 전'이다.
  from_status     business_day_status,
  to_status       business_day_status not null,
  method          text not null check (method in ('manual', 'auto')),
  -- ⚠ clock_timestamp — now() 는 트랜잭션 시작에 고정돼 잠금을 기다린 시간이 지워진다.
  at              timestamptz not null default clock_timestamp(),
  by_user         uuid
);
comment on table public.business_state_transitions is
'영업 상태 전이 감사(0157). 시작·브레이크·재개·종료·자동 마감·자동 브레이크가 전부 여기 남는다. 자동 전환의 양보 판단(경계 이후 전이 존재)에도 쓴다.';

create index if not exists business_state_transitions_day_at_idx
  on public.business_state_transitions (business_day_id, at desc);

alter table public.business_state_transitions enable row level security;
revoke insert, update, delete, truncate on public.business_state_transitions from anon, authenticated;
drop policy if exists business_state_transitions_read on public.business_state_transitions;
create policy business_state_transitions_read on public.business_state_transitions
  for select to authenticated
  using (store_id in (select public.my_store_ids()));

-- ── ② 기록 도우미 + 브레이크 몸통 ───────────────────────────────
create or replace function public.record_state_transition(
  p_day public.business_days, p_from business_day_status, p_to business_day_status, p_method text
) returns void
language sql
as $$
  insert into public.business_state_transitions
    (store_id, business_day_id, from_status, to_status, method, by_user)
  values (p_day.store_id, p_day.id, p_from, p_to, p_method, auth.uid());
$$;
revoke execute on function public.record_state_transition(public.business_days, business_day_status, business_day_status, text)
  from public, anon, authenticated;

-- 브레이크 전환의 유일한 몸통 — 사람이 누르든 크론이 돌리든 여기로 온다.
create or replace function public.set_break_row(p_day_id uuid, p_on boolean, p_method text)
returns jsonb
language plpgsql
as $$
declare
  v_day      business_days;
  v_expected business_day_status := case when p_on then 'open' else 'break' end::business_day_status;
  v_to       business_day_status := case when p_on then 'break' else 'open' end::business_day_status;
begin
  -- ⚠ 잠그고 나서 상태를 본다 — 순서가 반대면 기다리는 사이 남이 바꾼 것을 못 본다.
  select * into v_day from business_days where id = p_day_id for update;
  if v_day.id is null then
    raise exception '영업일을 찾을 수 없어요' using errcode = '22000';
  end if;
  if v_day.status = 'closed' then
    raise exception '이미 종료된 영업일이에요' using errcode = '45002', detail = 'DAY_CLOSED';
  end if;
  if v_day.status <> v_expected then
    raise exception '%', case when p_on then '이미 브레이크 중이에요' else '브레이크 중이 아니에요' end
      using errcode = '45014', detail = 'INVALID_TRANSITION';
  end if;

  update business_days
     set status = v_to, last_activity_at = now()
   where id = v_day.id;

  perform record_state_transition(v_day, v_day.status, v_to, p_method);

  return jsonb_build_object('business_day_id', v_day.id, 'status', v_to::text, 'method', p_method);
end;
$$;
comment on function public.set_break_row(uuid, boolean, text) is
'브레이크 전환 몸통(0157). 행 잠금 + 상태 재확인 + 감사 기록. 매장 검사가 없으므로 앱 롤에 열지 않는다.';
revoke execute on function public.set_break_row(uuid, boolean, text) from public, anon, authenticated;

-- ── ③ 전이 한 문 ────────────────────────────────────────────────
create or replace function public.transition_business_state(p_store uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_day business_days;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄

  if p_action = 'open' then
    -- 시작은 open_business_day 가 몸통이다 — 스냅샷 굳히기·기한 지난 옛 날 처리까지.
    return open_business_day(p_store);
  elsif p_action = 'end' then
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
comment on function public.transition_business_state(uuid, text) is
'영업 상태 전이의 한 문(0157): open · start_break · resume · end. 몸통이 행 잠금·상태 재확인·감사 기록을 한다.';
revoke execute on function public.transition_business_state(uuid, text) from public, anon;
grant  execute on function public.transition_business_state(uuid, text) to authenticated, service_role;

-- ── ④ 시작·종료 몸통에도 기록을 단다 ────────────────────────────
-- 종료 몸통 — close_business_day_row 가 닫을 때 전이를 남긴다(수동·자동 공통).
do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'close_business_day_row';
  v_old := '  return jsonb_build_object(';
  if position(v_old in v_def) = 0 then
    raise exception '0157: close_business_day_row 반환 앵커를 못 찾았습니다';
  end if;
  v_new := array_to_string(array[
    '  perform record_state_transition(v_day, v_day.status, ''closed''::business_day_status, p_method::text);',
    '',
    '  return jsonb_build_object('
  ], E'\n');
  execute replace(v_def, v_old, v_new);
end $$;

-- 시작 몸통 — open_business_day 가 행을 만들 때 전이(영업 전→open)를 남긴다.
do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'open_business_day';
  v_old := array_to_string(array[
    '    returning id into v_id;'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0157: open_business_day 삽입 앵커를 못 찾았습니다';
  end if;
  v_new := array_to_string(array[
    '    returning id into v_id;',
    '',
    '  -- 전이 감사(0157) — 시작은 이전 상태가 없다(null = 영업 전).',
    '  perform record_state_transition(',
    '    (select d from business_days d where d.id = v_id),',
    '    null, ''open''::business_day_status, ''manual'');'
  ], E'\n');
  execute replace(v_def, v_old, v_new);
end $$;

-- ── ⑤ 자동 브레이크 — 크론이 같은 몸통을 돌린다 ─────────────────
create or replace function public.apply_due_breaks()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r          record;
  v_h        jsonb;
  v_bs       time; v_be time;
  v_start_at timestamptz; v_end_at timestamptz;
  v_offset   int;
  v_started  int := 0;
  v_resumed  int := 0;
  v_skipped  int := 0;
  v_failed   int := 0;
begin
  for r in
    select d.*, store_timezone(d.store_id) as tz
      from business_days d
     where d.status in ('open', 'break')
  loop
    begin
      -- 브레이크 시간표는 **그 장부가 굳힌 규칙**에서 온다(0154 카드와 같은 원천).
      v_h := case when r.operating_rule_id is not null
                  then rule_hours_on(r.operating_rule_id, r.business_date)
                  else store_hours_on(r.store_id, r.business_date) end;
      v_bs := (v_h->>'break_start')::time;
      v_be := (v_h->>'break_end')::time;
      if v_bs is null or v_be is null then continue; end if;

      /*
       * 자정 넘김 영업의 새벽 브레이크는 달력상 **다음 날**이다.
       * 검증(0156)이 브레이크를 저녁(bs≥open) 아니면 새벽(be≤close) 한쪽으로
       * 좁혀 놨으므로, bs 가 시작 시각보다 이르면 새벽 구간이다.
       */
      v_offset := case when coalesce((v_h->>'close_day_offset')::int, 0) = 1
                        and v_bs < (v_h->>'open_time')::time
                       then 1 else 0 end;
      v_start_at := ((r.business_date + v_offset)::timestamp + v_bs) at time zone r.tz;
      v_end_at   := ((r.business_date + v_offset)::timestamp + v_be) at time zone r.tz;

      if r.status = 'open'
         and clock_timestamp() >= v_start_at and clock_timestamp() < v_end_at then
        /*
         * ⚠ 경계 이후에 어떤 전이든 있으면 물러선다. 사장님이 창 안에서 재개했는데
         *   1분 뒤 크론이 다시 브레이크를 걸면 안 된다 — 자동 브레이크 자신의 기록도
         *   여기 남으므로 같은 창에서 두 번 걸리지도 않는다.
         */
        if not exists (select 1 from business_state_transitions t
                        where t.business_day_id = r.id and t.at >= v_start_at) then
          perform set_break_row(r.id, true, 'auto');
          v_started := v_started + 1;
        else
          v_skipped := v_skipped + 1;
        end if;
      elsif r.status = 'break' and clock_timestamp() >= v_end_at then
        if not exists (select 1 from business_state_transitions t
                        where t.business_day_id = r.id and t.at >= v_end_at) then
          perform set_break_row(r.id, false, 'auto');
          v_resumed := v_resumed + 1;
        else
          v_skipped := v_skipped + 1;
        end if;
      end if;
    exception
      when sqlstate '45014' or sqlstate '45002' then
        -- 그사이 사장님이 먼저 바꿨다. 경합의 정상 결말이지 실패가 아니다.
        v_skipped := v_skipped + 1;
      when others then
        v_failed := v_failed + 1;
        raise warning '자동 브레이크 실패 store=% date=%: % (%)',
          r.store_id, r.business_date, sqlerrm, sqlstate;
    end;
  end loop;

  return jsonb_build_object(
    'break_started', v_started, 'resumed', v_resumed, 'skipped', v_skipped, 'failed', v_failed);
end;
$$;
comment on function public.apply_due_breaks() is
'설정된 브레이크 시간의 자동 전환(0157). pg_cron 이 1분마다 부른다. 경계 이후 전이가 있으면 물러선다 — 사장님 결정이 이긴다.';

-- 사람은 못 부른다 — close_due_business_days 와 같은 자세(0137).
revoke execute on function public.apply_due_breaks() from public, anon, authenticated;
grant  execute on function public.apply_due_breaks() to service_role;

-- 크론 등록 — 0137 과 같은 조건부.
do $c$
declare v_db text := current_setting('cron.database_name', true);
begin
  if v_db is null or v_db <> current_database() then
    raise notice '0157: 이 DB(%)는 크론 대상이 아닙니다', current_database();
    return;
  end if;
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '0157: pg_cron 이 없어 스케줄을 걸지 않습니다';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.schedule('sikjae-apply-breaks', '* * * * *',
                        'select public.apply_due_breaks()');
  raise notice '0157: 크론 등록 — sikjae-apply-breaks (1분마다)';
exception when others then
  raise warning '0157: 크론 등록 실패 — % (%). 함수는 만들어졌습니다.', sqlerrm, sqlstate;
end $c$;

-- ── ⑥ 옛 문 삭제 ────────────────────────────────────────────────
-- "시험이 쓴다"는 이유로도 안 남긴다 — 검사 없는 경로가 남는 것이다.
drop function public.set_break(uuid, boolean);

-- ── ⑦ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  v_def text;
  v_n   int;
begin
  -- 옛 문이 없다.
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'set_break') then
    raise exception '0157: set_break 이 남아 있습니다';
  end if;

  -- 몸통·감사·자동이 이어져 있다.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'close_business_day_row';
  if position('record_state_transition' in v_def) = 0 then
    raise exception '0157: 종료 몸통이 전이를 기록하지 않습니다';
  end if;
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'open_business_day';
  if position('record_state_transition' in v_def) = 0 then
    raise exception '0157: 시작 몸통이 전이를 기록하지 않습니다';
  end if;
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'apply_due_breaks';
  if position('set_break_row' in v_def) = 0 then
    raise exception '0157: 자동 브레이크가 같은 몸통을 안 씁니다';
  end if;

  -- 사람이 자동 브레이크·몸통을 직접 못 부른다.
  if has_function_privilege('authenticated', 'public.apply_due_breaks()', 'execute') then
    raise exception '0157: 인증 사용자가 자동 브레이크를 부를 수 있습니다';
  end if;
  if has_function_privilege('authenticated', 'public.set_break_row(uuid, boolean, text)', 'execute') then
    raise exception '0157: 인증 사용자가 브레이크 몸통을 직접 부를 수 있습니다';
  end if;

  -- 감사 표는 앱 롤이 못 쓴다(읽기만).
  if has_table_privilege('authenticated', 'public.business_state_transitions', 'insert') then
    raise exception '0157: 감사 표에 직접 쓸 수 있습니다';
  end if;
end $$;
