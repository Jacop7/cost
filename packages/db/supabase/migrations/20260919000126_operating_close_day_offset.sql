/*
 * 0126 · 영업 종료일(당일/익일)을 시각과 분리한다.
 *
 * 예전 규칙은 close < open 일 때만 익일로 계산했다. MY-09 2a 시각 휠은 종료일을
 * 직접 고를 수 있으므로 weekly_hours.<dow>.close_day_offset(0|1)을 권위값으로
 * 저장한다. 필드가 없는 과거 규칙은 기존 대소 비교로 그대로 읽는다.
 */

create or replace function public.assert_weekly_hours(p jsonb) returns boolean
language plpgsql immutable as $fn$
declare d int; v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception '영업시간은 요일별 객체여야 해요' using errcode = '22000';
  end if;
  for d in 0..6 loop
    v := p -> d::text;
    if v is null or jsonb_typeof(v) <> 'object' then
      raise exception '영업시간에 %요일이 없어요', d using errcode = '22000';
    end if;
    if (v->>'open') is null or (v->>'close') is null then
      raise exception '%요일의 시작/종료 시각이 비었어요', d using errcode = '22000';
    end if;
    perform (v->>'open')::time, (v->>'close')::time;
    if (v ? 'closed') and jsonb_typeof(v->'closed') <> 'boolean' then
      raise exception '%요일의 휴무 표시가 참/거짓이 아니에요', d using errcode = '22000';
    end if;
    if (v ? 'close_day_offset')
       and (jsonb_typeof(v->'close_day_offset') <> 'number' or (v->>'close_day_offset') not in ('0', '1')) then
      raise exception '%요일의 종료일은 당일 또는 익일이어야 해요', d using errcode = '22000';
    end if;
  end loop;
  return true;
end $fn$;

create or replace function public.assert_weekly_schedule(p_hours jsonb, p_breaks jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  d int;
  h jsonb; b jsonb; nh jsonb;
  v_open time; v_close time; v_bs time; v_be time; v_next_open time;
  v_close_day_offset int;
  v_overnight boolean;
  dow_name constant text[] := array['일','월','화','수','목','금','토'];
begin
  for d in 0..6 loop
    h := p_hours -> d::text;
    b := p_breaks -> d::text;
    if b is not null and jsonb_typeof(b) = 'null' then b := null; end if;

    if coalesce((h->>'closed')::boolean, false) then
      if b is not null then
        raise exception '%요일은 휴무인데 브레이크가 있어요', dow_name[d + 1] using errcode = '22000';
      end if;
      continue;
    end if;

    v_open := (h->>'open')::time;
    v_close := (h->>'close')::time;
    v_close_day_offset := coalesce(
      case when h ? 'close_day_offset' then (h->>'close_day_offset')::int end,
      case when v_close < v_open then 1 else 0 end);

    if v_open = v_close then
      raise exception '%요일 시작과 종료가 같아요 — 영업일 경계를 정할 수 없어요',
        dow_name[d + 1] using errcode = '22000';
    end if;
    if v_close_day_offset = 0 and v_close < v_open then
      raise exception '%요일 종료가 시작보다 빨라요 — 종료일을 익일로 바꿔 주세요',
        dow_name[d + 1] using errcode = '22000';
    end if;
    v_overnight := v_close_day_offset = 1;

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
      if v_bs > v_be then
        raise exception '%요일 브레이크가 자정을 넘어요 — 자정 전이나 후 한쪽에만 둘 수 있어요',
          dow_name[d + 1] using errcode = '22000';
      end if;
      if v_overnight then
        if not (v_bs >= v_open or v_be <= v_close) then
          raise exception '%요일 브레이크(%~%)가 영업시간 밖이에요',
            dow_name[d + 1], v_bs, v_be using errcode = '22000';
        end if;
      elsif v_bs < v_open or v_be > v_close then
        raise exception '%요일 브레이크(%~%)가 영업시간(%~%) 밖이에요',
          dow_name[d + 1], v_bs, v_be, v_open, v_close using errcode = '22000';
      end if;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.rule_hours_on(p_rule uuid, p_date date)
returns jsonb
language sql
stable
as $$
  select case when r.id is null then null else
    jsonb_build_object(
      'rule_id',          r.id,
      'effective_from',   nullif(r.effective_from, '-infinity'::date),
      'open_time',        h->>'open',
      'close_time',       h->>'close',
      'closed',           coalesce((h->>'closed')::boolean, false),
      'close_day_offset', coalesce(
        case when h ? 'close_day_offset' then (h->>'close_day_offset')::int end,
        case when (h->>'close')::time < (h->>'open')::time then 1 else 0 end),
      'break_start',      b->>'start',
      'break_end',        b->>'end')
  end
  from public.operating_rules r
  left join lateral (select r.weekly_hours  -> extract(dow from p_date)::int::text) x(h) on true
  left join lateral (select r.weekly_breaks -> extract(dow from p_date)::int::text) y(b) on true
  where r.id = p_rule;
$$;

comment on function public.rule_hours_on(uuid, date) is
'특정 규칙의 그 날짜 시간표(0126). close_day_offset 명시값을 우선하고 과거 규칙은 시각 대소로 호환한다.';
comment on function public.assert_weekly_schedule(jsonb, jsonb) is
'주간 영업시간·브레이크 의미 검증(0126). 종료일 명시값, 다음 날 겹침, 브레이크 범위를 검증한다.';

-- These are implementation helpers used by the authoritative settings/business-day
-- facades.  The mobile app never calls them directly, so keep them off PostgREST's
-- authenticated RPC surface.
revoke execute on function public.assert_weekly_hours(jsonb) from public, anon, authenticated;
grant execute on function public.assert_weekly_hours(jsonb) to costkeep_rpc_executor, service_role;
revoke execute on function public.assert_weekly_schedule(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.assert_weekly_schedule(jsonb, jsonb) to costkeep_rpc_executor, service_role;
revoke execute on function public.rule_hours_on(uuid, date) from public, anon, authenticated;
grant execute on function public.rule_hours_on(uuid, date) to costkeep_rpc_executor, service_role;

do $$
declare
  v_hours jsonb;
  v_def text;
begin
  v_hours := (select jsonb_object_agg(d::text, jsonb_build_object(
    'open', '11:00', 'close', '02:00', 'close_day_offset', 1, 'closed', d = 0))
    from generate_series(0, 6) d);
  perform assert_weekly_hours(v_hours);
  perform assert_weekly_schedule(v_hours, '{}'::jsonb);

  begin
    perform assert_weekly_hours(jsonb_set(v_hours, '{1,close_day_offset}', '2'::jsonb));
    raise exception '0126: 종료일 2를 통과시켰습니다';
  exception when sqlstate '22000' then null;
  end;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'rule_hours_on';
  if position('h ? ''close_day_offset''' in v_def) = 0 then
    raise exception '0126: rule_hours_on 이 종료일 명시값을 읽지 않습니다';
  end if;
end $$;
