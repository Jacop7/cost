/*
 * 0154 · 매장별 영업 컨텍스트 — 판매·영업일 무리를 전역 날짜에서 뗀다 (기획서 §11, 3-3)
 *
 * 지금까지 판매 다섯 함수(business_day_state · open_business_day · day_menu_basis ·
 * save_sale · e10_sale_recorded)는 `business_day()` 를 봤다. 그 정의는
 * `business_cutoff()` → `settings limit 1` — **매장을 안 가리는 전역 값**이라
 * 다매장·다시간대에서 날짜가 틀린다(서울 매장의 새벽 판매가 뉴욕 매장 설정에 좌우된다).
 *
 * `resolve_sales_business_context(p_store, p_at)` 가 매장 시간대 · 현지 날짜 ·
 * 판매 영업일 · 적용 규칙 · 열린 영업일을 **한 번에** 계산하고, 다섯 함수가 이걸 쓴다.
 *
 * 함께 넣는 원자화 둘 —
 *   · 첫 판매 = 영업 시작 + 저장 한 트랜잭션(save_sale p_open_day). 예전엔 RPC 두 번이라
 *     열기만 되고 저장이 죽으면 빈 영업일이 남았다.
 *   · 기한 지난 옛 영업일 = 자동 마감 + 오늘 열기 한 트랜잭션(open_business_day).
 *     예전엔 close → open 두 번이라 사이에 다른 기기가 끼어들 수 있었다.
 *
 * 상태 카드의 영업시간은 이제 **그 장부가 연 시점의 규칙**이다 — 영업 중 설정을 바꿔도
 * 오늘 카드는 오늘 굳은 규칙을 말한다. 새 규칙은 다음 영업일부터다(0132 와 같은 선).
 *
 * ⚠ `business_day()` · `business_cutoff()` 삭제는 0155 다 — 시험·프렐류드가 아직 부른다.
 */

-- ── ① 컨텍스트 타입 ──────────────────────────────────────────────
create type public.sales_business_context as (
  timezone              text,
  local_date            date,     -- 매장 달력의 오늘. 영업시간과 무관하다(§4.1).
  sales_date            date,     -- 판매가 속할 영업일. 자정 넘김이면 새벽엔 어제다.
  sales_rule_id         uuid,     -- sales_date 에 적용되는 규칙
  open_day_id           uuid,     -- 열린 영업일(없으면 null)
  open_business_date    date,
  open_status           business_day_status,
  open_planned_close_at timestamptz,
  open_rule_id          uuid,
  open_expired          boolean   -- 예정 종료 + 유예가 지났다(크론이 곧 닫는다)
);

-- ── ② 시간표 빌더를 규칙 id 기준으로 내린다 ─────────────────────
-- 지금까지 store_hours_on 이 유일한 빌더였는데, 상태 카드가 **굳은 규칙**(장부의
-- operating_rule_id)으로 그리려면 "규칙을 직접 찍어 읽는" 입구가 필요하다.
-- 같은 모양을 두 곳에서 만들면 반드시 어긋나므로, 빌더는 여기 하나로 내리고
-- store_hours_on 은 규칙 찾기 + 위임만 남긴다.
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
      -- 종료가 시작보다 이르면 다음 날로 넘어간다는 뜻이다.
      'close_day_offset', case when (h->>'close')::time < (h->>'open')::time then 1 else 0 end,
      'break_start',      b->>'start',
      'break_end',        b->>'end')
  end
  from public.operating_rules r
  left join lateral (select r.weekly_hours  -> extract(dow from p_date)::int::text) x(h) on true
  left join lateral (select r.weekly_breaks -> extract(dow from p_date)::int::text) y(b) on true
  where r.id = p_rule;
$$;
comment on function public.rule_hours_on(uuid, date) is
'특정 규칙의 그 날짜(요일) 시간표. store_hours_on 과 business_day_state(굳은 규칙 카드)가 같은 빌더를 쓴다(0154).';

revoke execute on function public.rule_hours_on(uuid, date) from public, anon;
grant  execute on function public.rule_hours_on(uuid, date) to authenticated, service_role;

create or replace function public.store_hours_on(p_store uuid, p_date date)
returns jsonb
language sql
stable
as $$
  select public.rule_hours_on(r.id, p_date)
    from public.operating_rule_at(p_store, p_date) r
   where r.id is not null;
$$;

-- ── ③ 매장별 영업 컨텍스트 ──────────────────────────────────────
create or replace function public.resolve_sales_business_context(
  p_store uuid, p_at timestamptz default now()
) returns public.sales_business_context
language plpgsql
stable
as $$
declare
  ctx     public.sales_business_context;
  v_prev  jsonb;
  v_close timestamptz;
  v_open  business_days;
begin
  ctx.timezone   := store_timezone(p_store);
  ctx.local_date := (p_at at time zone ctx.timezone)::date;
  ctx.sales_date := ctx.local_date;

  /*
   * 자정 넘김 — **어제 규칙**이 오늘 새벽까지 이어지면, 그 종료 시각 전의 판매는
   * 어제 영업일이다(§2.2). 오늘 규칙이 아니라 어제 규칙을 보는 이유:
   * 판매가 속할 영업일은 "그 영업일이 언제 끝나는가" 로 정해지기 때문이다.
   * ⚠ 유예(auto_close_grace)는 더하지 않는다. 유예는 열린 장부가 저장을 받아 주는
   *   기간이지 날짜 해석이 아니다 — 02:00 종료면 02:00 부터는 오늘이다.
   */
  v_prev := store_hours_on(p_store, ctx.local_date - 1);
  if v_prev is not null
     and not coalesce((v_prev->>'closed')::boolean, false)
     and coalesce((v_prev->>'close_day_offset')::int, 0) = 1 then
    v_close := planned_close(p_store, ctx.local_date - 1);
    if v_close is not null and p_at < v_close then
      ctx.sales_date := ctx.local_date - 1;
    end if;
  end if;

  ctx.sales_rule_id := (store_hours_on(p_store, ctx.sales_date)->>'rule_id')::uuid;

  v_open := current_business_day(p_store);
  ctx.open_day_id           := v_open.id;
  ctx.open_business_date    := v_open.business_date;
  ctx.open_status           := v_open.status;
  ctx.open_planned_close_at := v_open.planned_close_at;
  ctx.open_rule_id          := v_open.operating_rule_id;
  ctx.open_expired          := v_open.id is not null
                               and v_open.planned_close_at is not null
                               and p_at >= v_open.planned_close_at + auto_close_grace();
  return ctx;
end;
$$;
comment on function public.resolve_sales_business_context(uuid, timestamptz) is
'매장 시간대·현지 날짜·판매 영업일·적용 규칙·열린 영업일을 한 번에. 판매·영업일 무리의 유일한 날짜 권위다(0154).';

revoke execute on function public.resolve_sales_business_context(uuid, timestamptz) from public, anon;
grant  execute on function public.resolve_sales_business_context(uuid, timestamptz) to authenticated, service_role;

-- ── ④ business_day_state — 컨텍스트 + 굳은 규칙 카드 ────────────
-- settings 를 더는 안 읽는다. 카드의 영업시간은
--   · 열려 있으면 **그 장부가 연 시점의 규칙**(operating_rule_id) — 영업 중 설정을
--     바꿔도 오늘 카드는 안 움직인다. 새 규칙은 다음 영업일부터다(0132).
--   · 안 열려 있으면 판매 영업일에 적용될 현재 규칙.
create or replace function public.business_day_state(p_store uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  ctx    public.sales_business_context;
  v_date date;
  v_day  business_days;
  v_done business_days;
  v_h    jsonb;
begin
  perform assert_my_store(p_store);

  ctx    := resolve_sales_business_context(p_store);
  v_date := ctx.sales_date;
  v_day  := current_business_day(p_store);

  -- 오늘 이미 종료했는지 — 열린 날이 없을 때만 의미가 있다.
  if v_day.id is null then
    select * into v_done from business_days
     where store_id = p_store and business_date = v_date;
  end if;

  v_h := case
    when v_day.id is not null and v_day.operating_rule_id is not null
      then rule_hours_on(v_day.operating_rule_id, v_day.business_date)
    when v_day.id is not null
      -- 규칙 없이 열린 옛 장부(0129 이전) — 그 날짜의 현재 해석으로라도 그린다.
      then store_hours_on(p_store, v_day.business_date)
    else store_hours_on(p_store, v_date)
  end;

  return jsonb_build_object(
    'today', v_date,
    -- 매장 달력의 오늘(0125). 영업시간과 무관하다 — 발주·입고·재고 화면이 이걸 쓴다.
    -- ⚠ `today`(판매 영업일)와 다른 값이다. 자정 넘김 새벽엔 실제로 갈린다.
    'local_date', ctx.local_date,
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
    -- 영업시간 — 열려 있으면 굳은 규칙, 아니면 현재 규칙(위 v_h). settings 가 아니다(0154).
    'hours', jsonb_build_object(
      'open_time',   v_h->>'open_time',
      'close_time',  v_h->>'close_time',
      'break_start', v_h->>'break_start',
      'break_end',   v_h->>'break_end',
      'closed',      coalesce((v_h->>'closed')::boolean, false),
      'overnight',   coalesce((v_h->>'close_day_offset')::int, 0) = 1));
end;
$$;

-- ── ⑤ open_business_day — 컨텍스트 날짜 + 기한 지난 옛 날 원자 마감 ──
-- ⚠ definer 다(0154) — 기한 지난 옛 날을 닫을 때 내부 함수 close_business_day_row 를
--   부르는데, 그건 매장 검사가 없는 내부용이라 앱 롤에 execute 를 줄 수 없다.
--   close_business_day·save_sale 과 같은 자세다: 첫 줄 assert_my_store 가 문지기다.
create or replace function public.open_business_day(p_store uuid, p_date date default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ctx     public.sales_business_context;
  v_date  date;
  v_open  business_days;
  v_snap  jsonb;
  v_id    uuid;
  v_stale date;
begin
  perform assert_my_store(p_store);
  -- ⚠ 영업시간 변경과 한 줄로 세운다(0132). 안 그러면 옛 규칙으로 연 장부에
  --   새 규칙이 오늘부터 붙는 순간이 생긴다.
  perform lock_business_scope(p_store);

  ctx    := resolve_sales_business_context(p_store);
  v_date := coalesce(p_date, ctx.sales_date);

  if v_date > ctx.sales_date then
    raise exception '미래 날짜로는 영업을 시작할 수 없어요' using errcode = '22000';
  end if;

  v_open := current_business_day(p_store);
  if v_open.id is not null then
    -- 이미 열린 날이 있으면 그걸 돌려준다. 두 번 눌러도 새로 만들지 않는다(불변식 8).
    if v_open.business_date = v_date then
      return jsonb_build_object('business_day_id', v_open.id, 'business_date', v_open.business_date,
                                'status', v_open.status, 'already_open', true);
    end if;

    /*
     * 다른 날이 열려 있다 — 예정 종료가 지났으면 **여기서 닫고 연다.**
     * 마감과 시작이 한 트랜잭션이다(0154). 예전엔 close → open RPC 두 번이라
     * 사이에 다른 기기가 끼어들 수 있었다.
     *
     * 방식은 시각이 정한다(0139) —
     *   · 기한(예정 종료 + 유예)까지 지났으면 **auto** — 크론이 닫은 것과 같은 기록이다
     *     (closed_at = 예정 종료 + 유예). 며칠 뒤에 열어도 장부엔 그날 종료로 남는다.
     *   · 유예 안이면 **manual** — 아직 어제 장부가 저장을 받는 시간인데 사장님이
     *     오늘을 시작했다. 사람이 닫는 것이므로 manual · 지금 시각이다.
     *     (이 분기가 없으면 유예 1시간 동안 `마감하고 시작` 이 서버에서 거절된다.)
     */
    if v_open.planned_close_at is not null
       and clock_timestamp() >= v_open.planned_close_at then
      perform close_business_day_row(v_open.id,
        case when clock_timestamp() >= v_open.planned_close_at + auto_close_grace()
             then 'auto'::business_close_method else 'manual'::business_close_method end);
      v_stale := v_open.business_date;
    else
      raise exception '% 영업이 아직 열려 있어요. 먼저 종료해 주세요', v_open.business_date
        using errcode = '22000';
    end if;
  end if;

  -- 같은 날을 다시 여는 건 종료를 되돌리는 일이라 별도 경로여야 한다.
  if exists (select 1 from business_days where store_id = p_store and business_date = v_date) then
    raise exception '% 영업은 이미 종료됐어요', v_date using errcode = '23505';
  end if;

  -- ⚠ 스냅샷이 비면 그날 아무 값도 못 쓴다. 행만 만들고 넘어가면 안 된다.
  v_snap := build_day_snapshot(p_store, v_date);
  if v_snap is null or v_snap = '{}'::jsonb then
    raise exception '오늘 적용할 값을 만들지 못했어요' using errcode = '22000';
  end if;

  insert into business_days (store_id, business_date, status, planned_close_at, snapshot, operating_rule_id, scheduled_open_at)
       values (p_store, v_date, 'open', planned_close(p_store, v_date), v_snap,
               (select id from operating_rule_at(p_store, v_date)),
               scheduled_open_at(p_store, v_date))
    returning id into v_id;

  -- 하루 한 번 도는 자리라 여기서 오래된 수정 내역을 청소한다(0076).
  begin
    perform purge_entity_changes();
  exception when others then
    -- 청소가 실패해도 영업 시작은 막지 않는다(곁일이다). 다만 삼키지도 않는다 —
    -- 로그에 안 남기면 "왜 안 지워지지" 를 추적할 방법이 없다(0136).
    raise warning '수정 내역 청소 실패: % (%)', sqlerrm, sqlstate;
  end;

  return jsonb_build_object('business_day_id', v_id, 'business_date', v_date,
                            'status', 'open', 'already_open', false,
                            -- 기한 지난 옛 날을 이 트랜잭션에서 닫았으면 그 날짜(아니면 null).
                            'closed_stale_date', v_stale);
end;
$$;

-- ── ⑥ day_menu_basis · e10 — 기본 날짜/미래 검사만 컨텍스트로 ────
-- 몸통은 안 바꾼다. 통째로 다시 쓰면 이 마이그레이션이 몸통의 주인이 되어
-- 앞선 수정(0149·0150)의 이유가 지워진다 — 바뀐 줄만 바꾼다(0150 과 같은 기법).
do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  -- day_menu_basis: 기본 날짜
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'day_menu_basis';
  v_old := 'v_date date := coalesce(p_date, business_day());';
  v_new := 'v_date date := coalesce(p_date, (resolve_sales_business_context(p_store)).sales_date);';
  if position(v_old in v_def) = 0 then
    raise exception '0154: day_menu_basis 에서 기본 날짜 줄을 못 찾았습니다';
  end if;
  execute replace(v_def, v_old, v_new);

  -- e10_sale_recorded: 오늘 경로의 미래 검사
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'e10_sale_recorded';
  -- ⚠ 문자열 안에 줄바꿈 리터럴을 두지 않는다(0150 관례) — 파일이 CRLF 로 변하면
  --   리터럴에 \r 이 끼어 position() 이 조용히 0 을 돌려준다.
  v_old := array_to_string(array[
    'if not p_allow_closed and p_date > business_day() then',
    '    raise exception ''미래 날짜로는 판매를 등록할 수 없습니다 (요청 %, 오늘 %)'', p_date, business_day()'
  ], E'\n');
  v_new := array_to_string(array[
    'if not p_allow_closed',
    '     and p_date > (resolve_sales_business_context(p_store)).sales_date then',
    '    raise exception ''미래 날짜로는 판매를 등록할 수 없습니다 (요청 %, 오늘 %)'',',
    '      p_date, (resolve_sales_business_context(p_store)).sales_date'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0154: e10_sale_recorded 에서 미래 검사 줄을 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old, v_new);

  -- 주석도 갱신한다 — 낡은 주석은 다음 작업자를 속인다(그리고 사후조건에도 걸린다).
  v_old := array_to_string(array[
    '   * ⚠ 이 검사는 **오늘 경로 전용**이다(0149). `business_day()` 는 매장을 안 가리는',
    '   *   전역 함수라 과거 정정에 쓰면 엉뚱한 날을 미래로 본다. 정정 RPC 는 이미'
  ], E'\n');
  v_new := array_to_string(array[
    '   * ⚠ 이 검사는 **오늘 경로 전용**이다(0149). 미래 판정은 매장 컨텍스트의',
    '   *   판매 영업일(sales_date) 기준이다(0154). 정정 RPC 는 이미'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0154: e10_sale_recorded 에서 옛 주석을 못 찾았습니다';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;

-- ── ⑦ save_sale — 컨텍스트 + 첫 판매의 원자적 영업 시작 ─────────
-- 인자가 늘어나므로(p_open_day) 옛 서명을 지우고 새로 만든다.
-- ⚠ create or replace 만 하면 **오버로드 두 개**가 생겨 PostgREST 가 못 고른다.
drop function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer);

create function public.save_sale(
  p_store uuid, p_date date, p_items jsonb,
  p_etc_items jsonb default null, p_extra_items jsonb default null,
  p_base_revision integer default null,
  p_open_day boolean default false
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item    jsonb;
  v_sales   uuid;
  v_result  jsonb := '[]'::jsonb;
  -- ⚠ `record` 가 아니라 타입이다(0154 실측). 장부 없는 날 business_day_of 가 null 복합값을
  --   돌려주는데, record 변수는 그걸 "아직 미할당"으로 취급해 `v_bday.id` 접근이
  --   55000 으로 터진다. 타입 있는 변수는 null 행이 되어 `.id is null` 이 그냥 참이다.
  v_bday    business_days;
  v_status  text;
  v_rev     integer;
  v_work    boolean;
  v_ctx     public.sales_business_context;
  v_opened  boolean := false;
begin
  perform assert_my_store(p_store);

  v_ctx := resolve_sales_business_context(p_store);
  if p_date > v_ctx.sales_date then
    raise exception '미래 날짜의 매출은 등록할 수 없어요' using errcode = '22000';
  end if;

  v_work := coalesce(jsonb_array_length(p_items), 0) > 0
            or p_etc_items is not null or p_extra_items is not null;

  if v_work then
    -- ── 1) 영업일을 먼저 잠근다 ─────────────────────────────
    v_bday := business_day_of(p_store, p_date);
    if v_bday.id is null then
      /*
       * 첫 판매가 영업 시작을 겸한다(0154). 화면이 45001 을 받고 "영업을 시작할까요?" 를
       * 확인한 뒤 p_open_day=true 로 다시 부른다. 열기와 저장이 **한 트랜잭션**이다 —
       * 예전엔 RPC 두 번이라 열기만 되고 저장이 죽으면 빈 영업일이 남았다.
       * ⚠ 오늘(판매 영업일)만이다. 과거 날짜는 정정 RPC 의 문이다(§6.4).
       *   기한 지난 옛 영업일이 남아 있으면 open_business_day 가 같은 트랜잭션에서
       *   auto 로 닫고 연다(⑤).
       */
      if p_open_day and p_date = v_ctx.sales_date then
        perform open_business_day(p_store, p_date);
        v_bday := business_day_of(p_store, p_date);
        v_opened := true;
      else
        raise exception '아직 영업을 시작하지 않았어요' using errcode = '45001', detail = 'BEFORE_OPEN';
      end if;
    end if;

    -- ⚠ 잠금을 잡고 **그다음에** 상태를 읽는다. 순서가 반대면 잠금을 기다리는 동안
    --   종료된 것을 못 보고, 마감된 장부에 판매가 들어간다.
    perform 1 from business_days where id = v_bday.id for update;
    select status::text into v_status from business_days where id = v_bday.id;

    -- ⚠ 자동 마감 기한이 지났으면 아직 열려 있어도 안 받는다(0139, 기획서 §2.4).
    --   `clock_timestamp()` 다 — `now()` 는 트랜잭션 시작 시각에 고정돼,
    --   잠금을 기다리는 동안 기한이 지나도 안 지난 것으로 보인다.
    --
    -- ⚠ 날짜 예외를 두지 않는다. 과거 판매는 정정 RPC 가 할 일이다(§6.4).
    -- ⚠ 규칙은 **앱 롤에만** 건다. 시드·마이그레이션은 소유자로 돌고 대상이 아니다.
    if v_status <> 'closed'
       and v_bday.planned_close_at is not null
       and clock_timestamp() >= v_bday.planned_close_at + auto_close_grace() then
      raise exception '% 영업이 종료되어 판매를 저장할 수 없어요', p_date
        using errcode = '45002', detail = 'DAY_CLOSED';
    end if;
    if v_status = 'closed' then
      raise exception '% 영업이 종료되어 판매를 저장할 수 없어요', p_date
        using errcode = '45002', detail = 'DAY_CLOSED';
    end if;

    -- ── 2) 그날 매출 행을 만들면서 잠근다 ───────────────────
    -- 보고 나서 넣지 않는다(0116). 이 upsert 가 잡는 행 락이 동시 저장을 줄 세운다.
    insert into daily_sales (store_id, sale_date) values (p_store, p_date)
    on conflict (store_id, sale_date) do update set updated_at = now()
    returning id, revision into v_sales, v_rev;

    -- ── 3) 판본 검사 ────────────────────────────────────────
    -- ⚠ 잠금을 쥔 뒤에 잰다. 먼저 재면 재는 사이에 남이 커밋할 수 있다.
    if p_base_revision is not null and v_rev is distinct from p_base_revision then
      raise exception '다른 기기에서 판매 내역이 변경됐어요. 최신 내역을 다시 확인해 주세요.'
        using errcode = '45009', detail = 'REVISION_CONFLICT';
    end if;
  end if;

  -- ── 4·5) 판매·기타매출·지출 반영 — **몸통**이 한다(0145).
  v_result := apply_sale_items(p_store, p_date, v_sales, p_items, p_etc_items, p_extra_items);

  -- ── 6) 판본을 올린다 ──────────────────────────────────────
  if v_work then
    update daily_sales
       set revision = revision + 1, updated_at = now()
     where id = v_sales
    returning revision into v_rev;
  end if;

  -- 화면은 이 판본을 들고 있다가 다음 저장에 되보낸다.
  return jsonb_build_object('sale_date', p_date, 'items', v_result, 'revision', v_rev,
                            -- 이 저장이 영업 시작을 겸했나(0154). 화면이 안내에 쓴다.
                            'day_opened', v_opened);
end;
$$;

revoke execute on function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer, boolean)
  from public, anon;
grant  execute on function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer, boolean)
  to authenticated, service_role;

-- ── ⑧ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  r     record;
  v_def text;
  v_n   int;
begin
  -- 다섯 함수 전부 — 전역 날짜를 버리고 매장 컨텍스트를 쓴다.
  for r in
    select unnest(array['business_day_state','open_business_day','day_menu_basis',
                        'save_sale','e10_sale_recorded']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn;
    if position('business_day()' in v_def) > 0 then
      raise exception '0154: % 가 아직 전역 business_day() 를 봅니다', r.fn;
    end if;
    if position('resolve_sales_business_context' in v_def) = 0 then
      raise exception '0154: % 가 매장 컨텍스트를 안 씁니다', r.fn;
    end if;
  end loop;

  -- business_day_state 가 settings 를 더는 안 읽는다(전역 cutoff 의 뿌리였다).
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'business_day_state';
  if v_def ~ 'from settings' then
    raise exception '0154: business_day_state 가 아직 settings 를 읽습니다';
  end if;

  -- save_sale 은 서명이 하나여야 한다 — 둘이면 PostgREST 가 못 고른다.
  select count(*) into v_n
    from pg_proc where pronamespace = 'public'::regnamespace and proname = 'save_sale';
  if v_n <> 1 then
    raise exception '0154: save_sale 서명이 %개입니다 — 옛 서명이 남았습니다', v_n;
  end if;

  -- 시간표 빌더는 하나다 — store_hours_on 은 위임만 한다.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'store_hours_on';
  if position('rule_hours_on' in v_def) = 0 or position('jsonb_build_object' in v_def) > 0 then
    raise exception '0154: store_hours_on 이 rule_hours_on 에 위임하지 않습니다';
  end if;
end $$;
