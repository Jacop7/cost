-- ════════════════════════════════════════════════════════════════
-- 0129 · 영업시간 규칙에 **버전**을 준다 (기획서 §4.4 · §7.1)
--
-- 지금은 `settings` 에 `open_time/close_time/break_start/break_end` 가 한 벌 있다.
-- 그래서 영업시간을 고치면 **과거 해석까지 바뀐다**(§2.2) — 8월 내내 11–22시로 적힌
-- 장부를 두고 18–02시로 바꾸면, 8월 예정 종료 시각이 통째로 새 값으로 다시 계산된다.
-- 이미 닫힌 날의 `planned_close_at` 은 저장돼 있어 안 움직이지만, 그 날짜를 다시
-- 계산하는 곳(되짚기·과거 정정)은 새 설정을 본다.
--
-- 규칙에 `effective_from` 을 주면 과거는 과거 규칙으로 남는다.
--
-- ── 이번 마이그레이션의 범위 ────────────────────────────────────
--   ○ operating_rules 테이블 + 겹침 방지 + 형식 검증
--   ○ settings 의 현재 시간을 **첫 규칙**으로 이관 (값은 안 바뀐다)
--   ○ 날짜로 규칙을 찾는 읽기 함수
--   ○ planned_close() 가 **그 날짜에 유효한 규칙**을 보게 한다
--   ✕ business_days 컬럼·open_business_day·save_settings 는 0130 에서
--   ✕ business_cutoff()/business_day() 는 **안 건드린다** — 판매 영업일 무리는
--     3-3 단계다. 여기서 같이 옮기면 새벽 판매가 어느 장부로 갈지가 한꺼번에 바뀐다.
--
-- ── 이름에 대하여 ──────────────────────────────────────────────
-- 기획서는 `business_days.scheduled_close_at` 이라 부른다. 그런데 그 값은 이미
-- **`planned_close_at`** 이라는 이름으로 있고, DB 함수 6곳·앱 4줄·시험 2파일이 읽는다.
-- 뜻이 같은 이름을 하나 더 만들면 두 값이 갈릴 자리가 생긴다. 이름은 `planned_close_at`
-- 을 유지하고, **뜻**을 기획서대로 맞춘다 — 영업 시작 때 그날 규칙으로 고정.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.operating_rules (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,

  /*
   * ⚠ 첫 규칙의 `effective_from` 은 `-infinity` 다. 과장이 아니라 사실이다 —
   *   이 규칙이 생기기 전의 모든 날짜는 이 시간으로 영업했다. 어중간한 날짜를 넣으면
   *   그보다 이른 장부(시드는 2026-07-30 부터다)를 물어볼 때 규칙이 **없는** 날이 생기고,
   *   그러면 예정 종료가 null 이 된다.
   */
  effective_from date not null,
  effective_to   date,          -- null = 지금 쓰는 규칙. 매장당 하나뿐이다.

  /*
   * 요일별 영업시간. 키는 '0'(일)~'6'(토) — `extract(dow from date)` 와 같은 번호다.
   *   {"0": {"open":"11:00","close":"22:00","closed":false}, ... }
   *
   * ⚠ `closed` 는 **정기 휴무**라는 뜻이고, 그날도 `open`/`close` 는 채워 둔다.
   *   비워 두면 사장님이 휴무일에 그냥 열었을 때 예정 종료가 null 이 된다.
   *   그러면 자동 마감이 `마지막 활동 + 1시간` 으로만 굴러가 하염없이 밀린다.
   *
   * `close_day_offset` 은 저장하지 않는다 — `close < open` 이면 1, 아니면 0 으로
   *   서버가 계산한다(기획서 §7.1). 저장하면 둘이 어긋날 자리가 생긴다.
   */
  weekly_hours  jsonb not null,

  /*
   * 요일별 브레이크. 1차는 하루 한 구간이다(기획서 §7.1).
   *   {"0": {"start":"15:00","end":"17:00"}, "1": null, ... }
   * 키가 없거나 null 이면 그 요일은 브레이크가 없다.
   */
  weekly_breaks jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  created_by    uuid,

  constraint operating_rules_range check (effective_to is null or effective_to >= effective_from)
);

comment on table public.operating_rules is
  '영업시간 규칙의 버전(0129). effective_to is null 인 행이 지금 쓰는 규칙이다. 영업시간을 고쳐도 과거 규칙은 남는다 — 그래야 과거 날짜 해석이 안 바뀐다(기획서 §2.2).';

create index if not exists operating_rules_store_from_idx
  on public.operating_rules (store_id, effective_from desc);

-- 매장당 '지금 규칙'은 하나뿐이다.
create unique index if not exists operating_rules_one_open_idx
  on public.operating_rules (store_id) where effective_to is null;

create unique index if not exists operating_rules_store_from_uniq
  on public.operating_rules (store_id, effective_from);


-- ── 형식 검증 ────────────────────────────────────────────────────
/*
 * 요일 7개가 다 있고, 시각이 실제로 시각인지 본다.
 * ⚠ 여기서 안 막으면 `('25:00')::time` 이 저장 시점이 아니라 **읽는 시점에** 터진다.
 *   그때는 판매 화면이 통째로 안 열린다 — 원인에서 제일 먼 자리에서 죽는 셈이다.
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
    -- 형식이 틀리면 여기서 22007 로 터진다. 저장 시점에 터지는 게 맞다.
    perform (v->>'open')::time, (v->>'close')::time;
    if (v ? 'closed') and jsonb_typeof(v->'closed') <> 'boolean' then
      raise exception '%요일의 휴무 표시가 참/거짓이 아니에요', d using errcode = '22000';
    end if;
  end loop;
  return true;
end $fn$;

create or replace function public.assert_weekly_breaks(p jsonb) returns boolean
language plpgsql immutable as $fn$
declare d int; v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception '브레이크는 요일별 객체여야 해요' using errcode = '22000';
  end if;
  for d in 0..6 loop
    v := p -> d::text;
    -- 없는 요일 · null 은 '브레이크 없음' 이다. 정상이다.
    if v is null or jsonb_typeof(v) = 'null' then continue; end if;
    if jsonb_typeof(v) <> 'object' or (v->>'start') is null or (v->>'end') is null then
      raise exception '%요일 브레이크는 start/end 가 있어야 해요', d using errcode = '22000';
    end if;
    perform (v->>'start')::time, (v->>'end')::time;
  end loop;
  return true;
end $fn$;


-- ── 겹침 방지 ────────────────────────────────────────────────────
/*
 * btree_gist 가 안 깔려 있어 exclusion constraint 를 못 쓴다. 트리거로 막는다.
 * 겹치면 `operating_rule_at()` 이 두 규칙 중 아무거나 고르게 되고,
 * 그건 "어제와 오늘의 영업시간이 실행할 때마다 달라진다"는 뜻이다.
 */
/*
 * 시각 표기를 **한 형태로** 맞춘다.
 *
 * ⚠ 안 맞추면 저장한 그대로 나온다 — 이관본은 `'22:00:00'`, 화면이 보낸 것은 `'02:00'`.
 *   같은 뜻인데 문자열이 달라서, 앱이 문자열을 비교하거나 그대로 그리는 순간 갈린다.
 *   `::time::text` 는 언제나 `HH:MM:SS` 라 초도 안 잃는다.
 */
create or replace function public.normalize_day_times(p jsonb, variadic p_keys text[]) returns jsonb
language plpgsql immutable as $fn$
declare d int; v jsonb; k text; out_ jsonb := p;
begin
  for d in 0..6 loop
    v := p -> d::text;
    if v is null or jsonb_typeof(v) <> 'object' then continue; end if;
    foreach k in array p_keys loop
      if (v->>k) is not null then
        v := jsonb_set(v, array[k], to_jsonb((v->>k)::time::text));
      end if;
    end loop;
    out_ := jsonb_set(out_, array[d::text], v);
  end loop;
  return out_;
end $fn$;

create or replace function public.operating_rules_no_overlap() returns trigger
language plpgsql as $fn$
declare v_other date;
begin
  perform assert_weekly_hours(new.weekly_hours);
  perform assert_weekly_breaks(new.weekly_breaks);

  -- 검증을 통과한 뒤에 정규화한다. 순서가 중요하다 — 못 읽는 값을 먼저 캐스팅하면
  -- 여기서 22007 로 터져 위의 친절한 메시지가 안 나온다.
  new.weekly_hours  := normalize_day_times(new.weekly_hours, 'open', 'close');
  new.weekly_breaks := normalize_day_times(new.weekly_breaks, 'start', 'end');

  select effective_from into v_other
    from public.operating_rules
   where store_id = new.store_id
     and id <> new.id
     and daterange(effective_from, effective_to, '[]')
         && daterange(new.effective_from, new.effective_to, '[]')
   limit 1;

  if v_other is not null then
    raise exception '영업시간 규칙이 겹쳐요 (기존 %부터)', v_other using errcode = '23505';
  end if;
  return new;
end $fn$;

drop trigger if exists operating_rules_guard on public.operating_rules;
create trigger operating_rules_guard
  before insert or update on public.operating_rules
  for each row execute function public.operating_rules_no_overlap();


-- ── RLS ─────────────────────────────────────────────────────────
alter table public.operating_rules enable row level security;

drop policy if exists operating_rules_rw on public.operating_rules;
-- settings·business_days 와 같은 술어를 쓴다. 새 방식을 만들지 않는다.
create policy operating_rules_rw on public.operating_rules
  for all to authenticated
  using (store_id in (select public.my_store_ids()))
  with check (store_id in (select public.my_store_ids()));

grant select, insert, update, delete on public.operating_rules to authenticated;


-- ── 이관 ─────────────────────────────────────────────────────────
/*
 * 지금 설정을 **첫 규칙**으로 옮긴다. 값은 하나도 안 바뀐다 —
 * 7일 모두 같은 시간이고, 그게 지금 동작 그대로다.
 * (요일별로 다르게 두는 건 스키마만 열어 두고 화면은 뒤에서 붙인다.)
 */
insert into public.operating_rules (store_id, effective_from, effective_to, weekly_hours, weekly_breaks)
select s.store_id,
       '-infinity'::date,
       null,
       (select jsonb_object_agg(d::text, jsonb_build_object(
                 'open',   to_char(coalesce(s.open_time,  '09:00'::time), 'HH24:MI:SS'),
                 'close',  to_char(coalesce(s.close_time, '21:00'::time), 'HH24:MI:SS'),
                 'closed', false))
          from generate_series(0, 6) d),
       case when s.break_start is null or s.break_end is null then '{}'::jsonb
            else (select jsonb_object_agg(d::text, jsonb_build_object(
                           'start', to_char(s.break_start, 'HH24:MI:SS'),
                           'end',   to_char(s.break_end,   'HH24:MI:SS')))
                    from generate_series(0, 6) d)
       end
  from public.settings s
 where not exists (select 1 from public.operating_rules r where r.store_id = s.store_id);

-- 매장이 설정 없이 만들어졌을 수도 있다. 그런 매장도 규칙은 있어야 한다.
insert into public.operating_rules (store_id, effective_from, effective_to, weekly_hours, weekly_breaks)
select st.id, '-infinity'::date, null,
       (select jsonb_object_agg(d::text, jsonb_build_object(
                 'open', '09:00', 'close', '21:00', 'closed', false))
          from generate_series(0, 6) d),
       '{}'::jsonb
  from public.stores st
 where not exists (select 1 from public.operating_rules r where r.store_id = st.id);


/*
 * ⚠ **새로 만들어지는 매장**에도 규칙이 있어야 한다.
 *   위 이관은 마이그레이션이 도는 순간의 매장만 채운다. 그 뒤에 생기는 매장
 *   (시드가 만드는 매장이 그렇다)은 규칙이 없어서 `planned_close()` 가 null 을 내고,
 *   `open_business_day` 가 not-null 제약에 걸려 **영업 시작 자체가 막힌다.**
 *   0121 의 `store_time_settings` 와 똑같은 함정이라 똑같이 막는다.
 */
create or replace function public.stores_default_operating_rule() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.operating_rules (store_id, effective_from, effective_to, weekly_hours, weekly_breaks)
  select new.id, '-infinity'::date, null,
         (select jsonb_object_agg(d::text, jsonb_build_object(
                   'open', '09:00', 'close', '21:00', 'closed', false))
            from generate_series(0, 6) d),
         '{}'::jsonb
   where not exists (select 1 from public.operating_rules r where r.store_id = new.id);
  return new;
end $fn$;

/*
 * ⚠ 그리고 **settings 행이 오면 그 값으로 맞춘다.**
 *   위 트리거는 매장이 생기는 순간에 도는데, 그때는 아직 `settings` 가 없어서
 *   어쩔 수 없이 상수를 쓴다. 그런데 `settings` 의 컬럼 기본값은 11:00~22:00 이라
 *   두 값이 갈린다 — 새 DB 에서 실제로 갈렸고 시험 09·25 가 그걸 잡았다.
 *
 *   그래서 settings 행이 들어오면 그게 이긴다. 단, **장부가 하나라도 있으면 안 건드린다** —
 *   그건 과거를 다시 해석하는 짓이다.
 */
create or replace function public.settings_sync_operating_rule() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  update public.operating_rules r
     set weekly_hours = (select jsonb_object_agg(d::text, jsonb_build_object(
                                 'open',   coalesce(new.open_time,  '09:00'::time)::text,
                                 'close',  coalesce(new.close_time, '21:00'::time)::text,
                                 'closed', false))
                           from generate_series(0, 6) d),
         weekly_breaks = case when new.break_start is null or new.break_end is null then '{}'::jsonb
                              else (select jsonb_object_agg(d::text, jsonb_build_object(
                                             'start', new.break_start::text,
                                             'end',   new.break_end::text))
                                      from generate_series(0, 6) d) end
   where r.store_id = new.store_id
     and r.effective_to is null
     and not exists (select 1 from public.business_days b where b.store_id = new.store_id);
  return new;
end $fn$;

drop trigger if exists settings_sync_operating_rule_trg on public.settings;
create trigger settings_sync_operating_rule_trg
  after insert on public.settings
  for each row execute function public.settings_sync_operating_rule();

drop trigger if exists stores_default_operating_rule_trg on public.stores;
create trigger stores_default_operating_rule_trg
  after insert on public.stores
  for each row execute function public.stores_default_operating_rule();

-- ── 읽기 ─────────────────────────────────────────────────────────
/** 그 날짜에 유효한 규칙. 없으면 null — 부르는 쪽이 그걸 알아야 한다. */
create or replace function public.operating_rule_at(p_store uuid, p_date date)
returns public.operating_rules
language sql stable as $fn$
  select r.* from public.operating_rules r
   where r.store_id = p_store
     and r.effective_from <= p_date
     and (r.effective_to is null or r.effective_to >= p_date)
   order by r.effective_from desc
   limit 1;
$fn$;

comment on function public.operating_rule_at(uuid, date) is
  '그 날짜에 유효한 영업시간 규칙(0129). 과거 날짜를 물으면 그때 규칙이 나온다 — 지금 설정이 아니다.';

/**
 * 그 날짜의 영업시간 한 줄. `close_day_offset` 은 여기서 **계산**한다(기획서 §7.1).
 *
 * ⚠ 요일은 **매장 현지 날짜**의 요일이다. `p_date` 가 이미 현지 날짜이므로
 *   `extract(dow from p_date)` 로 충분하다 — 여기서 시간대를 또 씌우면 안 된다.
 */
create or replace function public.store_hours_on(p_store uuid, p_date date)
returns jsonb
language sql stable as $fn$
  select case when r.id is null then null else
    jsonb_build_object(
      'rule_id',          r.id,
      'effective_from',   nullif(r.effective_from, '-infinity'::date),
      'open_time',        h->>'open',
      'close_time',       h->>'close',
      'closed',           coalesce((h->>'closed')::boolean, false),
      -- 종료가 시작보다 이르면 다음 날로 넘어간다는 뜻이다.
      'close_day_offset', case when (h->>'close')::time < (h->>'open')::time then 1 else 0 end,
      'break_start',      b->>'start',
      'break_end',        b->>'end')
  end
  from public.operating_rule_at(p_store, p_date) r
  left join lateral (select r.weekly_hours  -> extract(dow from p_date)::int::text) x(h) on true
  left join lateral (select r.weekly_breaks -> extract(dow from p_date)::int::text) y(b) on true;
$fn$;

comment on function public.store_hours_on(uuid, date) is
  '그 날짜의 영업시간(0129) — 요일별 규칙에서 뽑고 close_day_offset 은 계산한다.';

/** 그 날짜의 예정 시작 시각. */
create or replace function public.scheduled_open_at(p_store uuid, p_date date)
returns timestamptz
language sql stable as $fn$
  select (p_date::timestamp + (h->>'open_time')::time) at time zone store_timezone(p_store)
    from public.store_hours_on(p_store, p_date) h
   where h is not null;
$fn$;


-- ── planned_close 를 규칙 기반으로 ───────────────────────────────
/*
 * 예전:  settings 의 **지금** 시간으로 계산 → 과거 날짜를 물어도 지금 설정이 나온다
 * 지금:  그 날짜에 유효한 **그때** 규칙으로 계산
 *
 * ⚠ 값은 지금 당장 안 바뀐다. 규칙이 하나뿐이고 그게 settings 를 그대로 옮긴 것이라
 *   모든 날짜가 같은 답을 낸다. 이 마이그레이션 끝에서 그걸 대조한다.
 */
create or replace function public.planned_close(p_store uuid, p_date date)
returns timestamptz
language sql stable as $fn$
  select ((p_date + (h->>'close_day_offset')::int)::timestamp + (h->>'close_time')::time)
           at time zone store_timezone(p_store)
    from public.store_hours_on(p_store, p_date) h
   where h is not null;
$fn$;

comment on function public.planned_close(uuid, date) is
  '그 영업일의 예정 종료 시각(0129). 그 날짜에 유효한 규칙으로 계산한다 — 지금 설정이 아니다. 기획서의 scheduled_close_at 이 이 값이다.';


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_store uuid;
  v_n     int;
  v_old   timestamptz;
  v_new   timestamptz;
  v_d     date;
begin
  -- 매장마다 '지금 규칙'이 정확히 하나.
  select count(*) into v_n
    from public.stores st
   where (select count(*) from public.operating_rules r
           where r.store_id = st.id and r.effective_to is null) <> 1;
  if v_n > 0 then
    raise exception '0129: 지금 규칙이 하나가 아닌 매장이 %개 있습니다', v_n;
  end if;

  for v_store in select id from public.stores loop
    -- 어느 날짜를 물어도 규칙이 나와야 한다. 아주 옛날도.
    if public.store_hours_on(v_store, date '2000-01-01') is null then
      raise exception '0129: 옛 날짜에 규칙이 없습니다 (매장 %)', v_store;
    end if;

    /*
     * ⚠ 값이 안 바뀌었는지 **직접 계산해서** 대조한다.
     *   요일 7개가 다 같은 시간이므로 어느 요일을 물어도 옛 공식과 같아야 한다.
     *   ("같은 값을 옮겼으니 같겠지" 로 넘기면, to_char 로 분을 잘라 먹는 것 같은
     *     실수가 그대로 지나간다 — 초 단위 설정이면 실제로 잘린다.)
     */
    for v_d in select generate_series(date '2026-08-24', date '2026-08-30', '1 day')::date loop
      select ((v_d + case when s.close_time < s.open_time then 1 else 0 end)::timestamp + s.close_time)
               at time zone public.store_timezone(v_store)
        into v_old
        from public.settings s where s.store_id = v_store;
      v_new := public.planned_close(v_store, v_d);
      if v_old is distinct from v_new then
        raise exception '0129: %의 예정 종료가 바뀌었습니다 — 옛 % / 새 %', v_d, v_old, v_new;
      end if;
    end loop;
  end loop;
end $v$;

select public.assert_no_rpc_overloads();
