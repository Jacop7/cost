-- ════════════════════════════════════════════════════════════════
-- 0057 · 화면이 한 번에 물어볼 것 — business_day_state()
--
-- 0048~0049 가 영업일을 만들었지만 화면이 쓰려면 네 번 물어야 한다
-- (current_business_day · auto_close_due · unacked_auto_close · settings).
-- 매출 화면은 열릴 때마다 이걸 본다 — 왕복 네 번은 그대로 체감이 된다.
--
-- 한 번에 준다. 화면이 판단할 것을 서버가 이미 판단해 둔다:
--   status  none(아직 시작 전) / open / break / closed
--   past_planned  예정 종료를 지났다 → "영업을 종료할까요?"
--   warn_soon     자동 종료 10분 전 → "10분 후 자동 종료돼요"
--   unacked       지난 자동 종료 알림 → [확인] [영업 기록 수정]
-- ════════════════════════════════════════════════════════════════

create or replace function public.business_day_state(p_store uuid)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_date date := business_day();
  v_day  business_days;
  v_due  jsonb;
  v_set  settings;
  v_done business_days;
begin
  perform assert_my_store(p_store);

  v_day := current_business_day(p_store);
  v_due := auto_close_due(p_store);
  select * into v_set from settings where store_id = p_store;

  -- 오늘 이미 종료했는지 — 열린 날이 없을 때만 의미가 있다.
  if v_day.id is null then
    select * into v_done from business_days
     where store_id = p_store and business_date = v_date;
  end if;

  return jsonb_build_object(
    'today', v_date,
    -- ⚠ status 는 네 가지다. 'none' 은 "오늘 아직 시작 안 함"이고 'closed' 는 "오늘 이미 끝냄"이라
    --   화면이 다른 것을 그려야 한다(시작 버튼 vs 되돌리기).
    'status', coalesce(v_day.status::text, case when v_done.id is null then 'none' else 'closed' end),
    'business_day_id', coalesce(v_day.id, v_done.id),
    'business_date', coalesce(v_day.business_date, v_done.business_date, v_date),
    'opened_at', coalesce(v_day.opened_at, v_done.opened_at),
    'planned_close_at', coalesce(v_day.planned_close_at, v_done.planned_close_at),
    'closed_at', v_done.closed_at,
    'close_method', v_done.close_method,
    'last_activity_at', coalesce(v_day.last_activity_at, v_done.last_activity_at),
    -- 자동 종료는 마지막 활동 뒤로 미뤄지므로 예정 시각과 다를 수 있다.
    'auto_close_at', v_due->'auto_close_at',
    'past_planned', coalesce((v_due->>'past_planned')::boolean, false),
    'warn_soon', coalesce((v_due->>'warn_soon')::boolean, false),
    'due', coalesce((v_due->>'due')::boolean, false),
    -- 아직 확인 안 한 자동 종료 — 다음 앱 실행 때 알린다.
    'unacked', unacked_auto_close(p_store),
    -- 영업시간 설정. 화면이 "22:00 종료 예정"을 그릴 때 쓴다.
    'hours', jsonb_build_object(
      'open_time', v_set.open_time, 'close_time', v_set.close_time,
      'break_start', v_set.break_start, 'break_end', v_set.break_end,
      'overnight', v_set.close_time < v_set.open_time));
end;
$fn$;

comment on function public.business_day_state(uuid) is
  '매출 화면이 한 번에 읽는 영업일 상태 — 상태·예정/자동 종료·미확인 알림·영업시간(0057).';

select public.assert_no_rpc_overloads();
