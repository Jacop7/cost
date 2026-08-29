/*
 * 0163 · 판본 검사 우회 봉쇄 + 늦은 개점 DST (검토 P1-1 재검토 · P1-3)
 *
 * ① 판본 우회 — 0159 는 토큰이 없으면 검사를 생략했다. 그 생략이 곧 문이었다:
 *    인증 사용자가 토큰 없이 set_operating_hours 를 부르거나, save_settings 에
 *    시간 키를 실으면(그 몸통이 토큰 없이 set_operating_hours 를 불렀다) 다른 기기의
 *    변경을 조용히 덮었다.
 *    · 앱 문(set_operating_hours)은 rule_id + revision **둘 다 필수**다.
 *    · 무판본 저장은 내부 함수(apply_operating_hours)로 갈랐다 — 시드·소유자용,
 *      앱 롤에는 안 열린다.
 *    · save_settings 는 영업시간 키를 **거부**한다. 영업시간의 문은 하나다.
 *
 * ② DST — 늦은 개점의 "다음 날 그 시각"을 `timestamptz + interval '1 day'` 로
 *    구해서, 서머타임이 바뀌는 날엔 한 시간 어긋났다(뉴욕 10/31 02:30 + 1일 =
 *    11/1 01:30 EST). 다음 **현지 날짜**를 먼저 만들고 시간대를 적용한다.
 */

-- ── ① 순수 계산: 늦은 개점의 종료 시각 (DST 안전) ─────────────────
create or replace function public.late_close_at(
  p_date date, p_close time, p_tz text, p_now timestamptz
) returns timestamptz
language sql
stable
as $$
  -- 오늘 그 시각이 이미 지났으면 **다음 현지 날짜**의 그 시각이다. 날짜에 하루를
  -- 더한 뒤 시간대를 적용해야 서머타임 경계에서도 현지 벽시계가 맞는다.
  select case
    when (p_date::timestamp + p_close) at time zone p_tz > p_now
      then (p_date::timestamp + p_close) at time zone p_tz
    else ((p_date + 1)::timestamp + p_close) at time zone p_tz
  end;
$$;
comment on function public.late_close_at(date, time, text, timestamptz) is
'늦은 개점(0162)의 종료 시각. 지났으면 다음 현지 날짜의 그 시각 — timestamptz+1day 가 아니라 date+1 뒤 시간대 적용(DST 안전, 0163).';
revoke execute on function public.late_close_at(date, time, text, timestamptz) from public, anon;
grant  execute on function public.late_close_at(date, time, text, timestamptz) to authenticated, service_role;

do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'open_business_day';
  v_def := replace(v_def, chr(13) || chr(10), chr(10));
  v_old := array_to_string(array[
    '    v_planned := (v_date::timestamp + p_close_time) at time zone ctx.timezone;',
    '    -- 고른 시각이 이미 지났으면 다음 날 그 시각이다(새벽 마감).',
    '    if v_planned <= clock_timestamp() then',
    '      v_planned := v_planned + interval ''1 day'';',
    '    end if;'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0163: open_business_day 의 늦은 개점 계산 줄을 못 찾았습니다';
  end if;
  v_new := array_to_string(array[
    '    -- 지났으면 다음 **현지 날짜**의 그 시각 — DST 안전 계산(0163).',
    '    v_planned := late_close_at(v_date, p_close_time, ctx.timezone, clock_timestamp());'
  ], E'\n');
  execute replace(v_def, v_old, v_new);
end $$;

-- ── ② 무판본 저장은 내부 함수로 — 0159 의 몸통 그대로 ─────────────
create or replace function public.apply_operating_hours(
  p_store uuid, p_weekly_hours jsonb, p_weekly_breaks jsonb default '{}'::jsonb,
  p_base_rule_id uuid default null, p_base_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_today   date;
  v_cur     public.operating_rules;
  v_from    date;
  v_open    business_days;
  v_id      uuid;
  v_rev     integer;
begin
  perform assert_weekly_hours(p_weekly_hours);
  perform assert_weekly_breaks(p_weekly_breaks);
  perform assert_weekly_schedule(p_weekly_hours, p_weekly_breaks);   -- 뜻 검증(0156)

  -- ⚠ **맨 먼저** 잡는다. `open_business_day` 와 같은 키다(0132).
  perform lock_business_scope(p_store);

  -- ⚠ 달력 날짜다. 판매 영업일이 아니다 — 규칙은 달력으로 갈아 끼운다.
  v_today := store_local_date(p_store);

  select * into v_open from business_days
   where store_id = p_store and status <> 'closed'
   order by business_date desc limit 1
     for update;

  if v_open.id is not null then
    -- 영업 중이다. 오늘은 옛 규칙으로 끝낸다.
    v_from := greatest(v_open.business_date, v_today) + 1;
  elsif exists (select 1 from business_days where store_id = p_store and business_date = v_today) then
    -- 오늘은 이미 닫았다. 그날을 다시 해석하면 안 된다.
    v_from := v_today + 1;
  else
    -- 오늘 아직 안 열었다. 오늘부터 적용해도 지나간 것을 건드리지 않는다.
    v_from := v_today;
  end if;

  select * into v_cur from public.operating_rules
   where store_id = p_store and effective_to is null
     for update;

  /*
   * 판본 검사(0159) — 잠금을 쥔 뒤에 잰다. 편집 기준은 항상 **열린 행**이다.
   * ⚠ 토큰이 없으면 생략한다 — 이 함수는 **내부용**이다(시드·소유자). 앱 문
   *   (set_operating_hours)은 토큰을 필수로 요구하고 나서야 여기로 온다(0163).
   */
  if p_base_rule_id is not null then
    if v_cur.id is distinct from p_base_rule_id
       or v_cur.revision is distinct from p_base_revision then
      raise exception '다른 기기에서 영업시간이 변경됐어요. 최신 값을 다시 확인해 주세요.'
        using errcode = '45009', detail = 'REVISION_CONFLICT';
    end if;
  end if;

  if v_cur.id is not null and v_cur.effective_from = v_from then
    update public.operating_rules
       set weekly_hours = p_weekly_hours, weekly_breaks = p_weekly_breaks,
           created_at = now(), created_by = auth.uid(),
           revision = revision + 1
     where id = v_cur.id
    returning id, revision into v_id, v_rev;
  else
    if v_cur.id is not null then
      if v_cur.effective_from > v_from then
        raise exception '이미 %부터 적용될 규칙이 있어요', v_cur.effective_from using errcode = '22000';
      end if;
      -- 옛 규칙은 **전날까지**. 그래야 과거 해석이 그대로 남는다.
      update public.operating_rules set effective_to = v_from - 1 where id = v_cur.id;
    end if;

    insert into public.operating_rules (store_id, effective_from, effective_to,
                                        weekly_hours, weekly_breaks, created_by)
         values (p_store, v_from, null, p_weekly_hours, p_weekly_breaks, auth.uid())
      returning id, revision into v_id, v_rev;
  end if;

  -- `settings` 는 화면이 읽는 **표시 폼**이라 최신 값을 비춘다(get_settings 의 open_minutes 등).
  -- ⚠ 권위는 규칙이다. settings 로는 더 이상 영업시간이 **들어오지** 않는다(0163).
  update settings
     set open_time   = (p_weekly_hours->'1'->>'open')::time,
         close_time  = (p_weekly_hours->'1'->>'close')::time,
         break_start = (p_weekly_breaks->'1'->>'start')::time,
         break_end   = (p_weekly_breaks->'1'->>'end')::time,
         updated_at  = now()
   where store_id = p_store;

  return jsonb_build_object(
    'rule_id', v_id,
    'rule_revision', v_rev,
    'effective_from', v_from,
    'applies_today', v_from <= v_today,
    'open_business_date', v_open.business_date);
end;
$$;
comment on function public.apply_operating_hours(uuid, jsonb, jsonb, uuid, integer) is
'영업시간 저장 몸통(0163). 토큰이 null 이면 판본 검사를 생략하므로 앱 롤에 열지 않는다 — 시드·소유자용. 앱 문은 set_operating_hours.';
revoke execute on function public.apply_operating_hours(uuid, jsonb, jsonb, uuid, integer)
  from public, anon, authenticated;
grant  execute on function public.apply_operating_hours(uuid, jsonb, jsonb, uuid, integer) to service_role;

-- ── ③ 앱 문 — 토큰 둘 다 필수 ───────────────────────────────────
create or replace function public.set_operating_hours(
  p_store uuid, p_weekly_hours jsonb, p_weekly_breaks jsonb default '{}'::jsonb,
  p_base_rule_id uuid default null, p_base_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄
  /*
   * 편집 기준 판본이 없으면 저장하지 않는다(0163). 0159 는 "없으면 생략"이었고,
   * 그 생략이 곧 우회로였다 — 어느 판본을 보고 편집했는지 모르는 저장은
   * 다른 기기의 변경을 덮을 수밖에 없다.
   */
  if p_base_rule_id is null or p_base_revision is null then
    raise exception '영업시간을 다시 불러온 뒤 저장해 주세요 (편집 기준 판본이 없어요)'
      using errcode = '22000', detail = 'BASE_REQUIRED';
  end if;
  return apply_operating_hours(p_store, p_weekly_hours, p_weekly_breaks, p_base_rule_id, p_base_revision);
end;
$$;

-- ── ④ save_settings — 영업시간 키를 거부한다 ────────────────────
create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void
language plpgsql
as $$
begin
  perform assert_my_store(p_store);
  perform lock_business_scope(p_store);   -- 0134 와 같은 순서

  /*
   * 영업시간은 여기로 안 들어온다(0163). 예전엔 이 몸통이 토큰 없이
   * set_operating_hours 를 불러 판본 검사를 우회했다. 문은 하나다 — MY > 영업시간.
   * 조용히 무시하면 화면은 저장된 줄 안다 — 거부한다.
   */
  if p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end'] then
    raise exception '영업시간은 영업시간 화면에서만 바꿀 수 있어요'
      using errcode = '22000', detail = 'HOURS_NOT_HERE';
  end if;

  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;

  update settings set
    locale             = coalesce(nullif(p_payload->>'locale',''), locale),
    unit_price_digits  = coalesce((p_payload->>'unit_price_digits')::int, unit_price_digits),
    quantity_digits    = coalesce((p_payload->>'quantity_digits')::int, quantity_digits),
    money_digits       = coalesce((p_payload->>'money_digits')::int, money_digits),
    default_target_profit_rate = coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate),
    alert_morning_summary = coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary),
    alert_inbound_delay   = coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay),
    alert_price_spike     = coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike),
    alert_target_miss     = coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss),
    updated_at         = now()
  where store_id = p_store;
end;
$$;

-- ── ⑤ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_operating_hours';
  if position('BASE_REQUIRED' in v_def) = 0 or position('apply_operating_hours' in v_def) = 0
     or position('update public.operating_rules' in v_def) > 0 then
    raise exception '0163: 앱 문이 토큰을 요구하지 않거나 규칙을 직접 씁니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_settings';
  -- 실제 호출만 본다 — 설명 주석에 이름이 있는 건 괜찮다.
  if position('perform set_operating_hours' in v_def) > 0 or position('HOURS_NOT_HERE' in v_def) = 0 then
    raise exception '0163: save_settings 가 아직 영업시간을 받습니다';
  end if;

  if has_function_privilege('authenticated', 'public.apply_operating_hours(uuid, jsonb, jsonb, uuid, integer)', 'execute') then
    raise exception '0163: 무판본 몸통이 앱 롤에 열려 있습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'open_business_day';
  if position('late_close_at' in v_def) = 0 or position('interval ''1 day''' in v_def) > 0 then
    raise exception '0163: 늦은 개점이 아직 interval 덧셈으로 계산합니다';
  end if;

  -- DST 표본: 뉴욕 2026-11-01 02:00 에 EDT→EST. 10/31 02:30 이 지난 뒤의 "다음 날 02:30"은
  -- 11/1 02:30 **EST**(07:30Z)여야 한다. interval 덧셈이면 06:30Z(01:30 EST)가 나온다.
  if late_close_at('2026-10-31', '02:30', 'America/New_York', '2026-11-01 08:00:00+00')
     <> '2026-11-01 07:30:00+00'::timestamptz then
    raise exception '0163: 늦은 개점 DST 계산이 틀렸습니다 (%)',
      late_close_at('2026-10-31', '02:30', 'America/New_York', '2026-11-01 08:00:00+00');
  end if;
end $$;
