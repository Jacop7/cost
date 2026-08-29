/*
 * 0158 · 활동 추적 잔재 제거 — touch_business_day() · last_activity_at 응답
 *
 * last_activity_at 은 "자동 마감을 마지막 활동 + 1시간으로 미루던" 시절의 재료다.
 * 0139 가 그 밀림을 없앴다(마감은 예정 종료 + 유예 하나) — 이후로 이 값은
 * 아무 판단에도 안 쓰이는데 쓰는 손(touch_business_day)만 남아 있었다.
 * 죽은 값을 계속 쓰면 다음 사람이 "무언가 따라가는 값"으로 읽고 다시 기댄다.
 *
 * 컬럼 자체는 남긴다 — 지난 기록이고, 시험 09·26·27 이 "아무도 안 따라간다"를
 * 증명하는 표지로 세팅해 쓴다. 지우는 것은 쓰는 손과 응답 노출이다.
 */

-- ── ① e10 — 과거/오늘 가리지 않고 더는 찍지 않는다 ──────────────
do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'e10_sale_recorded';
  v_def := replace(v_def, chr(13) || chr(10), chr(10));
  v_old := array_to_string(array[
    '  /*',
    '   * ⚠ 과거 정정 중에는 **오늘 영업일을 건드리지 않는다**(0148).',
    '   *   지난주 판매를 고치는 것이 오늘의 `last_activity_at` 을 밀면, 오늘 마지막',
    '   *   활동이 언제였는지가 틀려진다. 과거를 고치는 일과 오늘 장사하는 일은 다르다.',
    '   */',
    '  if not p_allow_closed then',
    '    perform touch_business_day(p_store);',
    '  end if;'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0158: e10 의 touch 블록을 못 찾았습니다';
  end if;
  v_new := '  -- 활동 도장은 0158 에서 지웠다 — 자동 마감이 활동을 안 보므로(0139) 죽은 값이었다.';
  execute replace(v_def, v_old, v_new);
end $$;

drop function public.touch_business_day(uuid);

-- ── ② 브레이크 몸통 — 활동 도장 없이 상태만 ─────────────────────
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

  update business_days set status = v_to where id = v_day.id;

  perform record_state_transition(v_day, v_day.status, v_to, p_method);

  return jsonb_build_object('business_day_id', v_day.id, 'status', v_to::text, 'method', p_method);
end;
$$;
revoke execute on function public.set_break_row(uuid, boolean, text) from public, anon, authenticated;

-- ── ③ 응답에서 걷어낸다 — 상태 카드·종료 결과 ───────────────────
do $$
declare
  v_def text;
  v_old text;
begin
  -- business_day_state 의 응답 키
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'business_day_state';
  v_def := replace(v_def, chr(13) || chr(10), chr(10));
  v_old := array_to_string(array[
    '    ''close_method'', v_done.close_method,',
    '    ''last_activity_at'', coalesce(v_day.last_activity_at, v_done.last_activity_at),'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0158: business_day_state 의 last_activity_at 키를 못 찾았습니다';
  end if;
  execute replace(v_def, v_old, '    ''close_method'', v_done.close_method,');

  -- close_business_day_row 의 반환 키
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'close_business_day_row';
  v_def := replace(v_def, chr(13) || chr(10), chr(10));
  v_old := array_to_string(array[
    '    ''planned_close_at'', v_day.planned_close_at,',
    '    ''last_activity_at'', v_day.last_activity_at,'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0158: close_business_day_row 의 last_activity_at 키를 못 찾았습니다';
  end if;
  execute replace(v_def, v_old, '    ''planned_close_at'', v_day.planned_close_at,');
end $$;

comment on column public.business_days.last_activity_at is
'죽은 값(0158) — 자동 마감이 활동을 안 보게 된(0139) 뒤로 아무 판단에도 안 쓴다. 쓰는 손(touch_business_day)과 응답 노출은 지웠고, 컬럼은 지난 기록과 "아무도 안 따라간다" 시험 표지로만 남는다. 새 코드가 기대면 안 된다.';

-- ── ④ 사후조건 — 어느 함수도 이 값을 더는 만지지 않는다 ────────
do $$
declare
  r record;
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'touch_business_day') then
    raise exception '0158: touch_business_day 가 남아 있습니다';
  end if;
  for r in
    select p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and pg_get_functiondef(p.oid) ~ 'touch_business_day|last_activity_at'
  loop
    raise exception '0158: % 가 아직 활동 추적을 만집니다', r.proname;
  end loop;
end $$;
