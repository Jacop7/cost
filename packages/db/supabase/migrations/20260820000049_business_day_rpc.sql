-- ════════════════════════════════════════════════════════════════
-- 0049 · 영업 상태 전이 — 시작 / 브레이크 / 종료 / 자동 종료
--
-- 사장님 명세 그대로다.
--   시작   business_day 행 + 스냅샷. **둘 다 성공해야** 영업 중.
--   영업 중 예정 종료를 지나도 영업 중이면 같은 영업일 유지.
--   브레이크 상태만 바꾼다. business_day_id·스냅샷 그대로.
--   종료   실제 종료 시각 저장, 장부 잠금.
--
--   자동 종료  예정 22:00 → 22:00 알림 → 22:50 예고 → 23:00 자동 종료
--              단, 예정 뒤에도 활동이 있었으면 **마지막 활동 + 1시간**으로 미룬다.
--              22:35 에 마지막 판매면 23:35 에 종료된다. 늦게 장사한 날의
--              매출이 잘리면 안 된다.
-- ════════════════════════════════════════════════════════════════

-- 자동 종료까지 남은 여유. 예정 종료 뒤 활동이 없으면 이만큼 뒤에 닫는다.
create or replace function public.auto_close_grace()
returns interval language sql immutable as $fn$ select interval '1 hour' $fn$;

-- ── 지금 열려 있는 영업일 ─────────────────────────────────────
create or replace function public.current_business_day(p_store uuid)
returns business_days language sql stable security invoker as $fn$
  select * from business_days
   where store_id = p_store and status <> 'closed'
   order by business_date desc limit 1;
$fn$;

-- ── 영업 시작 ─────────────────────────────────────────────────
create or replace function public.open_business_day(p_store uuid, p_date date default null)
returns jsonb language plpgsql security invoker as $fn$
declare
  v_date date := coalesce(p_date, business_day());
  v_open business_days;
  v_snap jsonb;
  v_id   uuid;
begin
  perform assert_my_store(p_store);

  if v_date > business_day() then
    raise exception '미래 날짜로는 영업을 시작할 수 없어요' using errcode = '22000';
  end if;

  -- 이미 열린 날이 있으면 그걸 돌려준다. 두 번 눌러도 새로 만들지 않는다(불변식 8).
  v_open := current_business_day(p_store);
  if v_open.id is not null then
    if v_open.business_date = v_date then
      return jsonb_build_object('business_day_id', v_open.id, 'business_date', v_open.business_date,
                                'status', v_open.status, 'already_open', true);
    end if;
    raise exception '% 영업이 아직 열려 있어요. 먼저 종료해 주세요', v_open.business_date
      using errcode = '22000';
  end if;

  -- 같은 날을 다시 여는 건 종료를 되돌리는 일이라 별도 경로여야 한다.
  if exists (select 1 from business_days where store_id = p_store and business_date = v_date) then
    raise exception '% 영업은 이미 종료됐어요', v_date using errcode = '23505';
  end if;

  -- ⚠ 스냅샷이 비면 그날 아무 값도 못 쓴다. 행만 만들고 넘어가면 안 된다.
  v_snap := build_day_snapshot(p_store);
  if v_snap is null or v_snap = '{}'::jsonb then
    raise exception '오늘 적용할 값을 만들지 못했어요' using errcode = '22000';
  end if;

  insert into business_days (store_id, business_date, status, planned_close_at, snapshot)
       values (p_store, v_date, 'open', planned_close(p_store, v_date), v_snap)
    returning id into v_id;

  return jsonb_build_object('business_day_id', v_id, 'business_date', v_date,
                            'status', 'open', 'already_open', false);
end;
$fn$;

-- ── 브레이크 ↔ 영업 중 ────────────────────────────────────────
-- 상태만 바꾼다. 스냅샷·business_day_id 는 손대지 않는다.
create or replace function public.set_break(p_store uuid, p_on boolean)
returns jsonb language plpgsql security invoker as $fn$
declare v_day business_days;
begin
  perform assert_my_store(p_store);
  v_day := current_business_day(p_store);
  if v_day.id is null then
    raise exception '영업 중이 아니에요' using errcode = '22000';
  end if;

  update business_days
     set status = (case when p_on then 'break' else 'open' end)::business_day_status,
         last_activity_at = now()
   where id = v_day.id;

  return jsonb_build_object('business_day_id', v_day.id,
                            'status', case when p_on then 'break' else 'open' end);
end;
$fn$;

-- ── 활동 기록 ─────────────────────────────────────────────────
-- 판매·재고 처리가 있을 때마다 불러 자동 종료를 미룬다.
create or replace function public.touch_business_day(p_store uuid)
returns uuid language plpgsql security invoker as $fn$
declare v_day business_days;
begin
  v_day := current_business_day(p_store);
  if v_day.id is null then return null; end if;
  update business_days set last_activity_at = now() where id = v_day.id;
  return v_day.id;
end;
$fn$;

-- ── 영업 종료 ─────────────────────────────────────────────────
create or replace function public.close_business_day(
  p_store uuid, p_method business_close_method default 'manual'
) returns jsonb language plpgsql security invoker as $fn$
declare
  v_day business_days;
  v_sum jsonb;
begin
  perform assert_my_store(p_store);
  v_day := current_business_day(p_store);
  if v_day.id is null then
    raise exception '영업 중이 아니에요' using errcode = '22000';
  end if;

  -- 그날 장부를 집계해 함께 남긴다. 나중에 무엇을 고쳐도 이 값이 그날의 기록이다.
  v_sum := sales_summary(p_store, v_day.business_date, v_day.business_date);

  update business_days
     set status       = 'closed',
         closed_at    = now(),
         close_method = p_method,
         snapshot     = snapshot || jsonb_build_object('closing', v_sum)
   where id = v_day.id;

  return jsonb_build_object(
    'business_day_id', v_day.id, 'business_date', v_day.business_date,
    'closed_at', now(), 'close_method', p_method,
    'planned_close_at', v_day.planned_close_at,
    'last_activity_at', v_day.last_activity_at,
    'summary', v_sum);
end;
$fn$;

-- ── 종료를 되돌린다 ───────────────────────────────────────────
-- 실수는 나중에 발견된다. 다시 열어 고치고 다시 닫는다.
-- ⚠ 스냅샷은 그대로 둔다. 다시 열었다고 그날 기준값이 바뀌면 안 된다.
create or replace function public.reopen_business_day(p_store uuid, p_date date)
returns jsonb language plpgsql security invoker as $fn$
declare v_open business_days;
begin
  perform assert_my_store(p_store);

  v_open := current_business_day(p_store);
  if v_open.id is not null then
    raise exception '% 영업이 열려 있어요. 먼저 종료해 주세요', v_open.business_date
      using errcode = '22000';
  end if;

  update business_days
     set status = 'open', closed_at = null, close_method = null, last_activity_at = now()
   where store_id = p_store and business_date = p_date and status = 'closed';

  if not found then
    raise exception '종료된 영업일을 찾을 수 없어요' using errcode = 'P0002';
  end if;
  return jsonb_build_object('business_date', p_date, 'status', 'open');
end;
$fn$;

-- ── 자동 종료 판정 ────────────────────────────────────────────
-- 언제 닫아야 하는지 계산해서 화면이 알림을 띄우고, 지났으면 닫는다.
create or replace function public.auto_close_due(p_store uuid)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_day  business_days;
  v_due  timestamptz;
begin
  v_day := current_business_day(p_store);
  if v_day.id is null then
    return jsonb_build_object('open', false);
  end if;

  -- 예정 종료 뒤에도 활동이 있었으면 마지막 활동 + 1시간으로 미룬다.
  v_due := greatest(v_day.planned_close_at, v_day.last_activity_at + auto_close_grace());

  return jsonb_build_object(
    'open', true,
    'business_day_id', v_day.id,
    'business_date', v_day.business_date,
    'status', v_day.status,
    'planned_close_at', v_day.planned_close_at,
    'last_activity_at', v_day.last_activity_at,
    'auto_close_at', v_due,
    -- 예정 종료를 지났다 → "영업을 종료할까요?"
    'past_planned', now() >= v_day.planned_close_at,
    -- 자동 종료 10분 전 → "10분 후 자동 종료돼요"
    'warn_soon', now() >= v_due - interval '10 minutes' and now() < v_due,
    'due', now() >= v_due);
end;
$fn$;

-- 지났으면 닫는다. 화면이 열릴 때·주기적으로 부른다.
create or replace function public.close_if_due(p_store uuid)
returns jsonb language plpgsql security invoker as $fn$
declare v_state jsonb;
begin
  v_state := auto_close_due(p_store);
  if (v_state->>'open')::boolean is not true then return jsonb_build_object('closed', false); end if;
  if (v_state->>'due')::boolean is not true then
    return jsonb_build_object('closed', false, 'state', v_state);
  end if;
  return jsonb_build_object('closed', true, 'result', close_business_day(p_store, 'auto'));
end;
$fn$;

-- ── 다음 실행 때 알려줄 것 ────────────────────────────────────
-- "어제 영업이 23:00에 자동 종료됐어요" — 확인하지 않은 자동 종료를 돌려준다.
alter table business_days add column if not exists auto_close_ack boolean not null default false;

comment on column business_days.auto_close_ack is
  '자동 종료를 사장님이 확인했는지. 다음 앱 실행 때 한 번만 알린다(0049).';

create or replace function public.unacked_auto_close(p_store uuid)
returns jsonb language sql stable security invoker as $fn$
  select case when b.id is null then null else jsonb_build_object(
    'business_day_id', b.id,
    'business_date', b.business_date,
    'planned_close_at', b.planned_close_at,
    'closed_at', b.closed_at,
    'last_activity_at', b.last_activity_at) end
    from (select * from business_days
           where store_id = p_store and close_method = 'auto' and not auto_close_ack
           order by business_date desc limit 1) b;
$fn$;

create or replace function public.ack_auto_close(p_business_day uuid)
returns void language sql security invoker as $fn$
  update business_days set auto_close_ack = true where id = p_business_day;
$fn$;

select public.assert_no_rpc_overloads();
