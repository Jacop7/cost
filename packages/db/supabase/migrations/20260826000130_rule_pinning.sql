-- ════════════════════════════════════════════════════════════════
-- 0130 · 영업일은 **시작할 때 그날 규칙에 못 박힌다** · 규칙 변경은 소급하지 않는다
--
-- 0129 가 규칙에 버전을 줬다. 이제 두 가지를 잇는다.
--
--   ④ 영업 시작 시 예정 종료 고정
--      `business_days` 에 `operating_rule_id` · `scheduled_open_at` 을 남긴다.
--      예정 종료는 이미 `planned_close_at` 에 저장된다 — 0129 머리말 참고.
--      그래서 나중에 영업시간을 바꿔도 **그날 장부의 예정 종료는 안 움직인다.**
--
--   ⑤ 규칙 변경은 이미 열린 영업일에 소급하지 않는다
--      영업시간을 바꾸면 **새 규칙**이 생기고, 그 시작일은 다음 영업일이다.
--      영업 중이면 오늘은 옛 규칙 그대로다(기획서 §6.3).
--
-- ⚠ 자동 마감이 `마지막 활동 + 1시간` 으로 밀리는 것은 **여기서 안 고친다.**
--   그건 `close_due_business_days()` + pg_cron 과 같이 가야 한다 —
--   지금 밀림만 없애면 앱을 안 여는 동안 아무도 안 닫아 준다.
--   `planned_close_at` 이 제 값으로 고정되는 것이 그 단계의 전제다.
-- ════════════════════════════════════════════════════════════════

alter table public.business_days
  add column if not exists operating_rule_id uuid references public.operating_rules(id),
  add column if not exists scheduled_open_at timestamptz;

comment on column public.business_days.operating_rule_id is
  '이 영업일을 시작할 때 유효했던 영업시간 규칙(0130). 나중에 규칙을 바꿔도 이 장부는 그때 규칙으로 읽는다.';
comment on column public.business_days.scheduled_open_at is
  '그 규칙이 말하는 예정 시작 시각(0130). opened_at 은 사장님이 실제로 누른 시각이라 다르다.';
comment on column public.business_days.planned_close_at is
  '예정 종료 시각 — 기획서의 scheduled_close_at 이다(0130). 영업 시작 때 그날 규칙으로 고정된다.';

-- 이미 있는 장부에도 그날 규칙을 채운다. 규칙이 하나뿐이라 전부 같은 것을 가리킨다.
-- ⚠ `from` 절의 함수는 갱신 대상 행을 못 본다. 스칼라 하위질의로 쓴다.
update public.business_days d
   set operating_rule_id = (select id from public.operating_rule_at(d.store_id, d.business_date)),
       scheduled_open_at = coalesce(d.scheduled_open_at,
                                    public.scheduled_open_at(d.store_id, d.business_date))
 where d.operating_rule_id is null;


-- ── ④ 영업 시작 때 규칙을 못 박는다 ──────────────────────────────
do $m$
declare
  v_def text;
  v_new text;
  /*
   * ⚠ 조각은 **한 줄씩** 잡는다. 두 줄을 이어 붙였다가 안 맞아서 한 번 막혔다 —
   *   여러 줄을 합치면 눈에 안 보이는 공백 하나에 통째로 어긋난다.
   *   이 저장소가 한 줄 조각만 쓰기로 한 이유가 그것이다.
   */
  v_cols text := '(store_id, business_date, status, planned_close_at, snapshot)';
  v_vals text := '       values (p_store, v_date, ''open'', planned_close(p_store, v_date), v_snap)';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_business_day';
  if v_def is null then raise exception '0130: open_business_day 가 없습니다'; end if;

  -- 이미 적용된 DB 라면 조용히 지나간다. **크게 터뜨리는 건 "모르는 모양"일 때만**이다 —
  -- 이미 맞는 것과 못 알아보는 것은 다르다.
  if position('operating_rule_id, scheduled_open_at' in v_def) > 0 then
    return;
  end if;

  if position(v_cols in v_def) = 0 then
    raise exception '0130: insert 컬럼 목록을 못 찾았습니다 — 그 사이에 바뀌었습니다';
  end if;
  if position(v_vals in v_def) = 0 then
    raise exception '0130: insert values 줄을 못 찾았습니다 — 그 사이에 바뀌었습니다';
  end if;

  v_new := replace(v_def, v_cols,
    '(store_id, business_date, status, planned_close_at, snapshot, operating_rule_id, scheduled_open_at)');
  v_new := replace(v_new, v_vals,
    concat_ws(chr(10),
      '       values (p_store, v_date, ''open'', planned_close(p_store, v_date), v_snap,',
      '               (select id from operating_rule_at(p_store, v_date)),',
      '               scheduled_open_at(p_store, v_date))'));
  execute v_new;
end $m$;


-- ── ⑤ 영업시간 변경은 새 규칙을 만든다 (소급 없음) ────────────────
/**
 * 영업시간을 바꾼다. **오늘 장부는 안 건드린다.**
 *
 * 시작일 정하기 —
 *   영업 중이면      : 오늘 다음 날부터 (오늘은 옛 규칙으로 끝낸다)
 *   영업 중이 아니면 : 오늘 아직 안 열었으면 오늘부터, 이미 닫았으면 다음 날부터
 *
 * ⚠ 같은 날 두 번 고치면 **덮어쓴다.** 새 규칙을 또 만들면 같은 `effective_from` 이
 *   둘이 되어 겹침 트리거에 걸린다. 아직 시작 안 한 예약 규칙은 고쳐도 잃을 게 없다.
 */
create or replace function public.set_operating_hours(
  p_store uuid,
  p_weekly_hours jsonb,
  p_weekly_breaks jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
as $fn$
declare
  v_today   date;
  v_cur     public.operating_rules;
  v_from    date;
  v_open    business_days;
  v_id      uuid;
begin
  perform assert_my_store(p_store);
  perform assert_weekly_hours(p_weekly_hours);
  perform assert_weekly_breaks(p_weekly_breaks);

  -- ⚠ 달력 날짜다. 판매 영업일이 아니다 — 규칙은 달력으로 갈아 끼운다.
  v_today := store_local_date(p_store);

  /*
   * ⚠ 잠근다. 안 잠그면 이 사이에 `open_business_day` 가 끼어들어
   *   **옛 규칙으로 못 박아야 할 날을 새 규칙으로** 열 수 있다.
   *   business_days → operating_rules 순서는 다른 곳과 같다.
   */
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

  if v_cur.id is not null and v_cur.effective_from = v_from then
    -- 아직 시작 안 한 예약 규칙을 다시 고치는 경우. 덮어쓴다.
    update public.operating_rules
       set weekly_hours = p_weekly_hours, weekly_breaks = p_weekly_breaks,
           created_at = now(), created_by = auth.uid()
     where id = v_cur.id
    returning id into v_id;

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
      returning id into v_id;
  end if;

  /*
   * `settings` 는 화면이 고쳐 쓰는 **입력 폼**이라 최신 값을 그대로 비춘다.
   * ⚠ 권위는 규칙이다. `planned_close()` 는 이제 settings 를 안 본다.
   *   (`business_cutoff()` 는 아직 settings 를 본다 — 3-3 단계다.)
   */
  update settings
     set open_time   = (p_weekly_hours->'1'->>'open')::time,
         close_time  = (p_weekly_hours->'1'->>'close')::time,
         break_start = (p_weekly_breaks->'1'->>'start')::time,
         break_end   = (p_weekly_breaks->'1'->>'end')::time,
         updated_at  = now()
   where store_id = p_store;

  return jsonb_build_object(
    'rule_id', v_id,
    'effective_from', v_from,
    -- 오늘부터인지 다음 날부터인지 화면이 그대로 말해 준다(기획서 §6.3).
    'applies_today', v_from <= v_today,
    'open_business_date', v_open.business_date);
end $fn$;

comment on function public.set_operating_hours(uuid, jsonb, jsonb) is
  '영업시간 변경(0130). 새 규칙을 만들고 옛 규칙은 전날까지로 닫는다 — 이미 열린 영업일에는 소급하지 않는다(기획서 §6.3).';

grant execute on function public.set_operating_hours(uuid, jsonb, jsonb) to authenticated;


-- ── save_settings 도 규칙을 갱신한다 ─────────────────────────────
/*
 * ⚠ 이걸 안 하면 앱의 기존 저장 경로(MY > 영업시간)가 `settings` 만 고치고 규칙은 옛
 *   값으로 남는다. 그러면 화면(`business_day_state.hours` → settings)과 실제 예정 종료
 *   (`planned_close()` → 규칙)가 **서로 다른 시간을 말한다.**
 *   새 DB 에서 실제로 갈렸고 시험 09·25 가 잡았다.
 *
 * ⚠ 여기는 조각 치환이 아니라 **통째로 다시 쓴다.** 이 함수는 짧고, 붙일 자리가
 *   본문 한가운데라 조각으로 끼우면 깨지기 쉽다(실제로 한 번 깨졌다).
 *   원본 대비 바뀐 것은 맨 끝 `if` 하나뿐이다.
 */
create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void
language plpgsql
as $fn$
declare
  v_open   time := nullif(p_payload->>'open_time','')::time;
  v_close  time := nullif(p_payload->>'close_time','')::time;
  v_hours  jsonb;
  v_breaks jsonb;
  v_cur    public.operating_rules;
begin
  perform assert_my_store(p_store);

  if v_open is not null and v_close is not null and v_open = v_close then
    raise exception '영업 시작과 종료 시각이 같을 수 없어요' using errcode = '22000';
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
    open_time          = coalesce(v_open, open_time),
    close_time         = coalesce(v_close, close_time),
    -- 브레이크는 지우는 것도 뜻이 있다 — 키를 보냈으면 값이 비어도 반영한다.
    break_start        = case when p_payload ? 'break_start'
                              then nullif(p_payload->>'break_start','')::time else break_start end,
    break_end          = case when p_payload ? 'break_end'
                              then nullif(p_payload->>'break_end','')::time else break_end end,
    updated_at         = now()
  where store_id = p_store;

  -- ── 여기부터가 0130 에서 더한 부분 ──
  if not (p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end']) then
    return;   -- 시간과 무관한 저장(언어·자릿수·알림)은 규칙을 안 건드린다.
  end if;

  -- 지금 규칙의 요일별 휴무 표시는 지키고 시각만 갈아 끼운다.
  -- (요일별 화면이 붙기 전이라 이 화면은 7일을 같은 시각으로 보낸다.)
  select * into v_cur from public.operating_rules
   where store_id = p_store and effective_to is null;

  select jsonb_object_agg(d::text, jsonb_build_object(
           'open',   s.open_time::text,
           'close',  s.close_time::text,
           'closed', coalesce((v_cur.weekly_hours -> d::text ->> 'closed')::boolean, false)))
    into v_hours
    from generate_series(0, 6) d, settings s
   where s.store_id = p_store;

  select case when s.break_start is null or s.break_end is null then '{}'::jsonb
              else jsonb_object_agg(d::text, jsonb_build_object(
                     'start', s.break_start::text, 'end', s.break_end::text)) end
    into v_breaks
    from generate_series(0, 6) d, settings s
   where s.store_id = p_store
   group by s.break_start, s.break_end;

  perform set_operating_hours(p_store, v_hours, coalesce(v_breaks, '{}'::jsonb));
end $fn$;

comment on function public.save_settings(uuid, jsonb) is
  '설정 저장. 영업시간 키가 오면 set_operating_hours 로 규칙까지 간다(0130) — settings 만 고치면 화면과 예정 종료가 갈린다.';


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_def text;
  v_n   int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_business_day';
  if position('operating_rule_id, scheduled_open_at' in v_def) = 0 then
    raise exception '0130: open_business_day 가 규칙을 안 남깁니다';
  end if;

  select count(*) into v_n from public.business_days where operating_rule_id is null;
  if v_n > 0 then
    raise exception '0130: 규칙이 안 채워진 영업일이 %개 있습니다', v_n;
  end if;

  select count(*) into v_n from public.business_days where scheduled_open_at is null;
  if v_n > 0 then
    raise exception '0130: 예정 시작이 비어 있는 영업일이 %개 있습니다', v_n;
  end if;
end $v$;

select public.assert_no_rpc_overloads();
