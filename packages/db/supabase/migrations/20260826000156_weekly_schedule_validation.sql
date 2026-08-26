/*
 * 0156 · 주간 일정 의미 검증 + 매장 시간대 경로 (기획서 §11, 영업시간 설정 완성)
 *
 * 지금까지 영업시간 검증은 **모양**뿐이었다(assert_weekly_hours/breaks — 키가 있는지,
 * 시각 형식인지). 뜻이 틀린 값이 다 들어갔다 —
 *   시작=종료(경계를 못 정함) · 영업시간 밖 브레이크 · 자정 넘김이 다음 날 영업과 겹침.
 * 겹치면 그 시각의 판매가 어느 영업일인지 **정의가 안 된다** — resolve_sales_business_context
 * 가 어제 규칙을 보고 어제라 하는데, 오늘 규칙도 그 시각에 열려 있으면 둘 다 맞는 말이 된다.
 *
 * 매장 시간대도 여기서 문을 하나로 좁힌다 — set_store_timezone RPC.
 * 직접 쓰기(테이블)는 막는다: 영업 중에 시간대가 바뀌면 열린 장부의 날짜 해석이
 * 흔들리는데, 테이블 직접 쓰기는 그 검사를 못 한다.
 */

-- ── ① 의미 검증 — 모양이 아니라 뜻 ──────────────────────────────
create or replace function public.assert_weekly_schedule(p_hours jsonb, p_breaks jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  d int;
  h jsonb; b jsonb; nh jsonb;
  v_open time; v_close time; v_bs time; v_be time; v_next_open time;
  v_overnight boolean;
  dow_name constant text[] := array['일','월','화','수','목','금','토'];
begin
  for d in 0..6 loop
    h := p_hours -> d::text;
    b := p_breaks -> d::text;
    if b is not null and jsonb_typeof(b) = 'null' then b := null; end if;

    if coalesce((h->>'closed')::boolean, false) then
      -- 휴무일의 브레이크는 뜻이 없다. 조용히 무시하면 화면과 저장값이 어긋난다.
      if b is not null then
        raise exception '%요일은 휴무인데 브레이크가 있어요', dow_name[d + 1] using errcode = '22000';
      end if;
      continue;
    end if;

    v_open := (h->>'open')::time;
    v_close := (h->>'close')::time;
    if v_open = v_close then
      raise exception '%요일 시작과 종료가 같아요 — 영업일 경계를 정할 수 없어요',
        dow_name[d + 1] using errcode = '22000';
    end if;
    v_overnight := v_close < v_open;

    /*
     * 자정 넘김이면 다음 날 영업과 겹치면 안 된다. 겹치면 그 시각의 판매가
     * 어느 영업일인지 정할 수 없다. 종료 = 다음 날 시작(02:00 마감 · 02:00 오픈)은
     * 허용한다 — 경계 시각부터는 다음 영업일이다(시험 29 ②).
     */
    if v_overnight then
      nh := p_hours -> ((d + 1) % 7)::text;
      if not coalesce((nh->>'closed')::boolean, false) then
        v_next_open := (nh->>'open')::time;
        if v_close > v_next_open then
          raise exception '%요일 영업이 다음 날 %까지인데 %요일 영업이 %에 시작해요 — 겹칠 수 없어요',
            dow_name[d + 1], v_close, dow_name[((d + 1) % 7) + 1], v_next_open
            using errcode = '22000';
        end if;
      end if;
    end if;

    if b is not null then
      v_bs := (b->>'start')::time;
      v_be := (b->>'end')::time;
      if v_bs = v_be then
        raise exception '%요일 브레이크 시작과 종료가 같아요', dow_name[d + 1] using errcode = '22000';
      end if;
      -- 자정을 넘는 브레이크는 받지 않는다 — 화면도 안 만들고, 영업일 경계와 겹쳐
      -- "어느 날의 브레이크인가"가 모호해진다. 자정 전·후 한쪽에만 둔다.
      if v_bs > v_be then
        raise exception '%요일 브레이크가 자정을 넘어요 — 자정 전이나 후 한쪽에만 둘 수 있어요',
          dow_name[d + 1] using errcode = '22000';
      end if;
      if v_overnight then
        -- 저녁 구간(bs가 시작 이후)이거나 새벽 구간(be가 종료 이전)이어야 한다.
        if not (v_bs >= v_open or v_be <= v_close) then
          raise exception '%요일 브레이크(%~%)가 영업시간 밖이에요',
            dow_name[d + 1], v_bs, v_be using errcode = '22000';
        end if;
      else
        if v_bs < v_open or v_be > v_close then
          raise exception '%요일 브레이크(%~%)가 영업시간(%~%) 밖이에요',
            dow_name[d + 1], v_bs, v_be, v_open, v_close using errcode = '22000';
        end if;
      end if;
    end if;
  end loop;
  return true;
end;
$$;
comment on function public.assert_weekly_schedule(jsonb, jsonb) is
'주간 영업시간·브레이크의 의미 검증(0156). 모양은 assert_weekly_hours/breaks, 뜻은 여기 — 시작=종료 · 다음 날 겹침 · 영업시간 밖/자정 넘김/영점 브레이크를 거부한다.';

revoke execute on function public.assert_weekly_schedule(jsonb, jsonb) from public, anon;
grant  execute on function public.assert_weekly_schedule(jsonb, jsonb) to authenticated, service_role;

-- ── ② 쓰는 문 두 곳이 모두 거친다 ───────────────────────────────
-- set_operating_hours — 모양 검증 다음에 의미 검증.
do $$
declare
  v_def text;
  v_old text := '  perform assert_weekly_breaks(p_weekly_breaks);';
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_operating_hours';
  if position(v_old in v_def) = 0 then
    raise exception '0156: set_operating_hours 에서 모양 검증 줄을 못 찾았습니다';
  end if;
  v_new := array_to_string(array[
    '  perform assert_weekly_breaks(p_weekly_breaks);',
    '  perform assert_weekly_schedule(p_weekly_hours, p_weekly_breaks);   -- 뜻 검증(0156)'
  ], E'\n');
  execute replace(v_def, v_old, v_new);
end $$;

-- settings_sync_operating_rule — 첫 영업 전 부트스트랩 경로도 같은 검증을 거친다.
-- 안 거치면 save_settings 로 영업시간 밖 브레이크가 규칙에 들어간다.
create or replace function public.settings_sync_operating_rule()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hours  jsonb;
  v_breaks jsonb;
begin
  v_hours := (select jsonb_object_agg(d::text, jsonb_build_object(
                       'open',   coalesce(new.open_time,  '09:00'::time)::text,
                       'close',  coalesce(new.close_time, '21:00'::time)::text,
                       'closed', false))
                from generate_series(0, 6) d);
  v_breaks := case when new.break_start is null or new.break_end is null then '{}'::jsonb
                   else (select jsonb_object_agg(d::text, jsonb_build_object(
                                  'start', new.break_start::text,
                                  'end',   new.break_end::text))
                           from generate_series(0, 6) d) end;

  perform assert_weekly_schedule(v_hours, v_breaks);   -- 뜻 검증(0156)

  update public.operating_rules r
     set weekly_hours = v_hours, weekly_breaks = v_breaks
   where r.store_id = new.store_id
     and r.effective_to is null
     and not exists (select 1 from public.business_days b where b.store_id = new.store_id);
  return new;
end;
$$;

-- ── ③ 매장 시간대 — 문 하나(RPC), 영업 중 변경 금지 ─────────────
create or replace function public.set_store_timezone(p_store uuid, p_timezone text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_open business_days;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄
  perform lock_business_scope(p_store);

  /*
   * 영업 중에는 못 바꾼다. 시간대가 바뀌면 "오늘"이 통째로 움직이는데,
   * 열린 장부의 business_date 는 이미 굳어 있다 — 장부와 날짜 계산이 갈라진다.
   * 종료 후 바꾸면 다음 영업 시작부터 새 시간대다.
   */
  v_open := current_business_day(p_store);
  if v_open.id is not null then
    raise exception '영업 중에는 시간대를 바꿀 수 없어요. 먼저 영업을 종료해 주세요'
      using errcode = '45011', detail = 'DAY_IS_LIVE';
  end if;

  -- 시간대 문자열 검증은 테이블 가드 트리거(0122)가 한다 — 검증을 두 곳에 두지 않는다.
  -- 이 문으로 들어온 값은 사장님이 **정한** 값이다(confirmed, 0122) — 백필 기본값과
  -- 구별돼야 앱이 "기기 시간대로 시작할까요?" 를 그만 묻는다.
  insert into store_time_settings (store_id, timezone, confirmed)
       values (p_store, p_timezone, true)
  on conflict (store_id) do update set timezone = excluded.timezone, confirmed = true;

  return jsonb_build_object('timezone', p_timezone, 'local_date', store_local_date(p_store));
end;
$$;
comment on function public.set_store_timezone(uuid, text) is
'매장 시간대 변경의 유일한 문(0156). 영업 중이면 45011 — 열린 장부의 날짜 해석이 흔들리면 안 된다.';

revoke execute on function public.set_store_timezone(uuid, text) from public, anon;
grant  execute on function public.set_store_timezone(uuid, text) to authenticated, service_role;

-- 직접 쓰기는 막는다 — operating_rules 와 같은 자세(0132).
revoke insert, update, delete, truncate on public.store_time_settings from anon, authenticated;
drop policy if exists store_time_settings_rw on public.store_time_settings;
drop policy if exists store_time_settings_read on public.store_time_settings;
create policy store_time_settings_read on public.store_time_settings
  for select to authenticated
  using (store_id in (select public.my_store_ids()));

-- ── ④ 상태 RPC 확장 — 화면이 주간 규칙과 시간대를 한 번에 받는다 ─
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
    'current_rule', (
      select jsonb_build_object(
               'rule_id', r.id,
               'effective_from', nullif(r.effective_from, '-infinity'::date),
               'weekly_hours', r.weekly_hours,
               'weekly_breaks', r.weekly_breaks)
        from public.operating_rule_at(p_store, store_local_date(p_store)) r
       where r.id is not null),
    /*
     * 아직 시작 안 한 규칙. 있으면 화면이 "○월 ○일부터 적용돼요" 라고 말할 수 있다.
     * ⚠ `effective_from > 오늘` 인 것만이다. 오늘부터인 규칙은 이미 `today` 다.
     */
    'pending', (
      select jsonb_build_object(
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

-- ── ⑤ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'set_operating_hours';
  if position('assert_weekly_schedule' in v_def) = 0 then
    raise exception '0156: set_operating_hours 가 의미 검증을 안 부릅니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'settings_sync_operating_rule';
  if position('assert_weekly_schedule' in v_def) = 0 then
    raise exception '0156: settings_sync_operating_rule 이 의미 검증을 안 부릅니다';
  end if;

  if has_table_privilege('authenticated', 'public.store_time_settings', 'insert')
     or has_table_privilege('authenticated', 'public.store_time_settings', 'update')
     or has_table_privilege('authenticated', 'public.store_time_settings', 'delete') then
    raise exception '0156: store_time_settings 직접 쓰기가 아직 열려 있습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'operating_hours_status';
  if position('current_rule' in v_def) = 0 or position('timezone_confirmed' in v_def) = 0 then
    raise exception '0156: operating_hours_status 확장이 빠졌습니다';
  end if;

  -- 검증 함수가 실제로 무는지 — 대표 사례 셋.
  begin
    perform assert_weekly_schedule(
      (select jsonb_object_agg(d::text, jsonb_build_object('open','10:00','close','10:00')) from generate_series(0,6) d),
      '{}'::jsonb);
    raise exception '0156: 시작=종료를 통과시켰습니다';
  exception when sqlstate '22000' then null;
  end;
  begin
    perform assert_weekly_schedule(
      (select jsonb_object_agg(d::text, jsonb_build_object('open','11:00','close','22:00')) from generate_series(0,6) d),
      jsonb_build_object('1', jsonb_build_object('start','23:00','end','23:30')));
    raise exception '0156: 영업시간 밖 브레이크를 통과시켰습니다';
  exception when sqlstate '22000' then null;
  end;
  begin
    /*
     * ⚠ 겹침 표본은 요일별로 달라야 한다. 균일한 주간표는 겹침이 성립 불가다 —
     *   자정 넘김이면 close < open 인데 다음 날 open 이 같은 값이라 close > next_open
     *   이 될 수 없다. 처음 표본(전 요일 18:00~11:00)이 그래서 통과해 버렸다.
     */
    perform assert_weekly_schedule(
      jsonb_set(
        (select jsonb_object_agg(d::text, jsonb_build_object('open','02:00','close','22:00')) from generate_series(0,6) d),
        '{1}', jsonb_build_object('open','18:00','close','02:30')),   -- 월 새벽 2:30 마감 · 화 2:00 오픈
      '{}'::jsonb);
    raise exception '0156: 다음 날 겹침을 통과시켰습니다';
  exception when sqlstate '22000' then null;
  end;
end $$;
