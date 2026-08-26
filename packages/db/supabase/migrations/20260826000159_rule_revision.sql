/*
 * 0159 · 영업시간 규칙 판본 — 예약 변경 유실을 막는다 (검토 P1-1)
 *
 * 실측된 구멍: 두 기기가 같은 규칙을 편집하면 나중 저장이 먼저 저장한 변경을
 * **조용히 덮었다.** set_operating_hours 가 열린 규칙 행(effective_to null)을
 * 그대로 갱신하는데, 화면이 어느 판본을 보고 편집했는지 아무도 안 물었다.
 *
 * daily_sales.revision(0117)과 같은 짜임 —
 *   · operating_rules.revision: 열린 행의 판본. 갱신마다 오른다.
 *   · 화면은 편집 기준(열린 행 = 예약이 있으면 예약, 없으면 현재)의
 *     rule_id + revision 을 들고 있다가 저장에 되보낸다.
 *   · 어긋나면 45009 REVISION_CONFLICT — 판매 저장과 같은 코드라 앱 처리도 같다.
 *   · 토큰 없는 호출(시드·마이그레이션·옛 경로)은 검사를 건너뛴다 —
 *     save_sale 의 p_base_revision null 과 같은 규칙이다.
 */

-- ── ① 판본 컬럼 ─────────────────────────────────────────────────
alter table public.operating_rules
  add column if not exists revision integer not null default 1;
comment on column public.operating_rules.revision is
'열린 규칙 행의 판본(0159). set_operating_hours 가 갱신할 때마다 오른다 — 화면이 이 값을 되보내 낡은 편집을 45009 로 걸러 낸다.';

-- ── ② 저장 문 — 판본 검사 (서명이 늘어나므로 옛 서명을 지운다) ──
drop function public.set_operating_hours(uuid, jsonb, jsonb);

create function public.set_operating_hours(
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
  perform assert_my_store(p_store);
  perform assert_weekly_hours(p_weekly_hours);
  perform assert_weekly_breaks(p_weekly_breaks);
  perform assert_weekly_schedule(p_weekly_hours, p_weekly_breaks);   -- 뜻 검증(0156)

  /*
   * ⚠ **맨 먼저** 잡는다. `open_business_day` 와 같은 키다.
   *   예전엔 아래 `for update` 만 있었는데, 그건 영업일 행이 **이미 있을 때만** 잠근다.
   *   아직 안 열었으면 아무것도 안 잠겨서, 확인과 적용 사이에 영업이 시작될 수 있었다.
   */
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
   * ── 판본 검사(0159) — 잠금을 쥔 뒤에 잰다 ─────────────────────
   * 편집 기준은 항상 **열린 행**이다. 예약이 있으면 예약이 곧 열린 행이고,
   * 없으면 현재 규칙이 열린 행이다 — 화면의 기준(pending ?? current)과 같은 행이다.
   * 다른 기기가 먼저 저장했으면 id 나 판본이 달라져 있다.
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

  /*
   * `settings` 는 화면이 고쳐 쓰는 **입력 폼**이라 최신 값을 그대로 비춘다.
   * ⚠ 권위는 규칙이다. `planned_close()` 는 이제 settings 를 안 본다.
   *   (전역 business_cutoff 는 0155 에서 지웠다 — 날짜 권위는 매장 컨텍스트다.)
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
    -- 다음 저장에 되보낼 판본(0159). 화면은 이걸 들고 있다가 실어 보낸다.
    'rule_revision', v_rev,
    'effective_from', v_from,
    'applies_today', v_from <= v_today,
    'open_business_date', v_open.business_date);
end;
$$;

revoke execute on function public.set_operating_hours(uuid, jsonb, jsonb, uuid, integer) from public, anon;
grant  execute on function public.set_operating_hours(uuid, jsonb, jsonb, uuid, integer) to authenticated, service_role;

-- ── ③ 상태 RPC — 편집 기준의 판본을 함께 준다 ───────────────────
create or replace function public.operating_hours_status(p_store uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'local_date', store_local_date(p_store),
    -- 매장 시간대. confirmed=false 면 백필/기본값이라 사장님이 아직 안 정한 것이다 —
    -- 화면이 "기기 시간대로 시작할까요?" 를 물을 근거다(0122·0156).
    'timezone', store_timezone(p_store),
    'timezone_confirmed', coalesce(
      (select t.confirmed from store_time_settings t where t.store_id = p_store), false),
    -- 오늘 실제로 적용 중인 시간. `settings` 가 아니라 **규칙**에서 온다.
    'today', store_hours_on(p_store, store_local_date(p_store)),
    -- 지금 적용 중인 규칙 전체(주간) — 요일별 편집 화면의 초깃값이다(0156).
    -- revision(0159): 예약이 없을 때는 이 행이 편집 기준이라 판본을 함께 보낸다.
    'current_rule', (
      select jsonb_build_object(
               'rule_id', r.id,
               'revision', r.revision,
               'effective_from', nullif(r.effective_from, '-infinity'::date),
               'weekly_hours', r.weekly_hours,
               'weekly_breaks', r.weekly_breaks)
        from public.operating_rule_at(p_store, store_local_date(p_store)) r
       where r.id is not null),
    /*
     * 아직 시작 안 한 규칙. 있으면 **이게 편집 기준이다**(0159) — 화면이 예약 주간표를
     * 통째로 받아 이어서 편집하고, rule_id·revision 을 저장에 되보낸다.
     * 예전엔 effective_from + 그날 시간만 줘서, 재진입한 화면이 현재 규칙으로
     * 다시 편집했다 — 예약 변경이 조용히 사라졌다(검토 P1-1).
     */
    'pending', (
      select jsonb_build_object(
               'rule_id', p.id,
               'revision', p.revision,
               'effective_from', p.effective_from,
               'hours', store_hours_on(p_store, p.effective_from),
               'weekly_hours', p.weekly_hours,
               'weekly_breaks', p.weekly_breaks)
        from public.operating_rules p
       where p.store_id = p_store
         and p.effective_from > store_local_date(p_store)
       order by p.effective_from
       limit 1));
$$;

-- ── ④ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  v_n int;
  v_def text;
begin
  select count(*) into v_n
    from pg_proc where pronamespace = 'public'::regnamespace and proname = 'set_operating_hours';
  if v_n <> 1 then
    raise exception '0159: set_operating_hours 서명이 %개입니다 — PostgREST 가 못 고릅니다', v_n;
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_operating_hours';
  if position('REVISION_CONFLICT' in v_def) = 0 then
    raise exception '0159: 판본 검사가 빠졌습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'operating_hours_status';
  if position('''revision'', r.revision' in v_def) = 0
     or position('''revision'', p.revision' in v_def) = 0
     or position('''rule_id'', p.id' in v_def) = 0 then
    raise exception '0159: 상태 RPC 가 편집 기준 판본을 안 줍니다';
  end if;
end $$;
