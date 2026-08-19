-- ════════════════════════════════════════════════════════════════
-- 0047 · 영업시간과 영업일 경계
--
-- 사장님: "총 영업 시간 10~새벽 2시 16시간이잖아"
--
-- ── 무엇이 잘못됐나 ──────────────────────────────────────────
-- business_day() 가 **자정**을 경계로 썼다.
--   select (p_at at time zone business_tz())::date
-- 10:00~02:00 영업이면 새벽 1시 매출이 **다음 날**로 잡혀 하루 장사가 둘로 쪼개진다.
--   실측: 2026-08-21 01:00 판매 → 지금 규칙 8/21, 맞는 날 8/20.
--
-- ── 경계를 어떻게 정하나 ─────────────────────────────────────
-- 영업 종료 시각이 시작보다 **이르면**(자정을 넘김) 그 시각이 경계다.
--   10:00~02:00 → 02:00 이 경계.  01:00 은 어제 영업일, 03:00 은 오늘.
-- 넘지 않으면 자정 그대로다.
--   11:00~21:00 → 경계 00:00. 종료 뒤에 적어도 같은 날이다.
--
-- ⚠ 기본값은 11:00~22:00(자정 안 넘음)으로 둔다. 경계가 00:00 이라
--   기존 동작이 그대로다 — 마이그레이션이 과거 데이터의 날짜를 옮기지 않는다.
--   야간 영업 매장은 마이페이지에서 종료 시각을 바꾸면 그때부터 적용된다.
--
-- ⚠ business_day() 는 store 인자를 받지 않는다. 1차는 단일 매장이고(다점포는 3차),
--   RLS 아래에서 settings 한 행이 곧 내 매장이다. 다점포로 갈 때 인자를 받게 바꾼다.
-- ════════════════════════════════════════════════════════════════

alter table settings add column if not exists open_time   time not null default '11:00';
alter table settings add column if not exists close_time  time not null default '22:00';
alter table settings add column if not exists break_start time;
alter table settings add column if not exists break_end   time;

comment on column settings.open_time  is '영업 시작 시각.';
comment on column settings.close_time is '영업 종료 시각. 시작보다 이르면 자정을 넘는 영업이고, 이 시각이 영업일 경계가 된다(0047).';
comment on column settings.break_start is '브레이크 타임 시작(선택). 판매가 없는 시간대다.';
comment on column settings.break_end   is '브레이크 타임 종료(선택).';

-- 종료가 시작과 같으면 24시간 영업으로 읽히는데, 그건 경계를 정할 수 없다.
do $ck$
begin
  alter table settings add constraint settings_hours_ck
    check (open_time <> close_time) not valid;
exception when duplicate_object then null;
end $ck$;

-- ── 영업일 경계 ───────────────────────────────────────────────
-- 자정을 넘는 영업만 오프셋을 준다. 안 넘으면 0(자정 경계 그대로).
create or replace function public.business_cutoff()
returns interval language sql stable as $fn$
  select coalesce(
    (select case when s.close_time < s.open_time then s.close_time - '00:00'::time
                 else '0'::interval end
       from settings s limit 1),
    '0'::interval);
$fn$;

comment on function public.business_cutoff() is
  '영업일 경계 오프셋. 자정을 넘는 영업이면 종료 시각, 아니면 0(0047).';

-- ⚠ 반환형·인자가 그대로라 create or replace 로 바꿀 수 있다.
create or replace function public.business_day(p_at timestamptz default now())
returns date language sql stable as $fn$
  select ((p_at at time zone business_tz()) - business_cutoff())::date;
$fn$;

comment on function public.business_day(timestamptz) is
  '영업일. 자정이 아니라 **영업 종료 시각**이 경계다 — 새벽 장사가 전날에 묶인다(0047).';

-- ── 저장·조회에 영업시간을 싣는다 ─────────────────────────────
-- 반환형이 기존과 달라 create or replace 로는 못 바꾼다.
drop function if exists public.save_settings(uuid, jsonb);
drop function if exists public.get_settings(uuid);

create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void language plpgsql security invoker as $fn$
declare
  v_open  time := nullif(p_payload->>'open_time','')::time;
  v_close time := nullif(p_payload->>'close_time','')::time;
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
end;
$fn$;

create or replace function public.get_settings(p_store uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'locale', s.locale,
    'currency', s.currency,
    'unit_price_digits', s.unit_price_digits,
    'quantity_digits', s.quantity_digits,
    'money_digits', s.money_digits,
    'unit_system', s.unit_system,
    'default_target_profit_rate', s.default_target_profit_rate,
    'alert_morning_summary', s.alert_morning_summary,
    'alert_inbound_delay', s.alert_inbound_delay,
    'alert_price_spike', s.alert_price_spike,
    'alert_target_miss', s.alert_target_miss,
    'open_time', to_char(s.open_time, 'HH24:MI'),
    'close_time', to_char(s.close_time, 'HH24:MI'),
    'break_start', to_char(s.break_start, 'HH24:MI'),
    'break_end', to_char(s.break_end, 'HH24:MI'),
    -- 자정을 넘는 영업인지. 화면이 "다음날 02:00" 처럼 적어 줘야 헷갈리지 않는다.
    'overnight', (s.close_time < s.open_time),
    -- 총 영업 시간(분). 10:00~02:00 이면 960분 = 16시간.
    'open_minutes', (extract(epoch from
        case when s.close_time < s.open_time
             then (s.close_time - s.open_time) + interval '24 hours'
             else (s.close_time - s.open_time) end) / 60)::int)
    from settings s where s.store_id = p_store;
$fn$;

select public.assert_no_rpc_overloads();
