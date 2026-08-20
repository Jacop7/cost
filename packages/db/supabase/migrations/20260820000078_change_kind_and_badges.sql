-- ════════════════════════════════════════════════════════════════
-- 0078 · 수정 내역 공통 규격 — 직접 수정 / 자동 갱신, 배지 2건
--
-- 기획: docs/식재료-레시피-수정내역-최종기획.md (개정)
-- 프로토타입: docs/prototypes/unified-change-history-all-cases.html
--
-- 세 가지가 바뀐다.
--
-- ① **한 사건 안에서 값을 두 갈래로 나눈다**(change_kind)
--    direct  사장님이 친 값        판매가 9,500 → 9,000
--    derived 그 결과로 계산된 값    세금 863.64 → 818.18 · 순이익 …
--    지금은 한 덩어리라 "내가 세금을 고쳤나?" 로 읽힌다.
--
-- ② **제목을 용어표대로**
--    메뉴 수정                     → 레시피 수정
--    기준 단가 변경                → 입고 단가 반영
--    입고 취소로 기준 단가 변경    → 입고 취소 반영
--    OO 기준 단가 자동 반영        → 식재료 단가 반영
--    고정 지출 자동 반영           → 고정지출 반영
--    '수정'은 사장님의 행동, '반영'은 사건의 원인이다.
--
-- ③ **상태 배지는 목록 전체에서 최대 2건**
--    과거 사건마다 '현재 매출 반영'을 붙이면 현재 값이 여러 개인 것처럼 보인다.
--    서버가 그 두 건의 id 만 정해 준다 — 앱이 고르면 두 화면이 다르게 고른다.
-- ════════════════════════════════════════════════════════════════

-- ── 사건 한 줄 요약 ───────────────────────────────────────────
-- 목록에 `판매가 외 3개 항목 변경` 처럼 나간다. 기록하는 쪽이 무슨 일이 있었는지
-- 가장 잘 아니까 그때 적는다 — 나중에 changes 를 보고 되짚으면 문구가 흔들린다.
alter table entity_change_events add column if not exists summary text;

-- ── change_line 이 갈래를 받는다 ──────────────────────────────
-- ⚠ 기본값은 'direct' 다. 기존 호출부는 사장님이 친 값을 적고 있었다.
create or replace function public.change_line(
  p_key text, p_label text, p_before anyelement, p_after anyelement,
  p_unit text default null, p_kind text default 'direct'
) returns jsonb language sql immutable as $fn$
  select case
    when p_before is not distinct from p_after then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'key', p_key, 'label', p_label,
      'before', p_before, 'after', p_after, 'unit', p_unit,
      -- direct  사장님이 친 값 · derived 그 결과로 계산된 값
      'change_kind', case when p_kind = 'derived' then 'derived' else 'direct' end))
  end;
$fn$;

comment on function public.change_line(text, text, anyelement, anyelement, text, text) is
  '전후가 다를 때만 한 줄. change_kind 로 직접 수정/자동 갱신을 가른다(0078).';

-- ── 기록이 요약을 함께 받는다 ─────────────────────────────────
create or replace function public.record_entity_change(
  p_store uuid, p_entity_type text, p_entity_id uuid,
  p_source change_source, p_title text, p_changes jsonb,
  p_affects boolean default false,
  p_source_entity uuid default null,
  p_correlation uuid default null,
  p_summary text default null
) returns uuid language plpgsql security invoker as $fn$
declare
  v_day business_days;
  v_id  uuid;
  v_sum text := p_summary;
  v_first text;
  v_n   int;
begin
  if coalesce(jsonb_array_length(p_changes), 0) = 0 then
    return null;
  end if;

  -- 요약을 안 주면 **직접 수정한 줄**로 만든다. 계산 결과를 대표로 내세우면
  -- "내가 순이익을 고쳤나?" 로 읽힌다.
  if v_sum is null then
    select c->>'label', count(*) over () into v_first, v_n
      from jsonb_array_elements(p_changes) c
     where coalesce(c->>'change_kind', 'direct') = 'direct'
     limit 1;
    if v_first is null then
      select c->>'label', count(*) over () into v_first, v_n
        from jsonb_array_elements(p_changes) c limit 1;
    end if;
    v_sum := case when coalesce(v_n, 0) > 1
                  then v_first || ' 외 ' || (v_n - 1) || '개 항목 변경'
                  else v_first || ' 변경' end;
  end if;

  v_day := current_business_day(p_store);

  insert into entity_change_events
    (store_id, entity_type, entity_id, source_type, source_entity_id, correlation_id,
     title, summary, changes, affects_sales, business_day_id, actor_id, occurred_at)
  values
    (p_store, p_entity_type, p_entity_id, p_source, p_source_entity,
     coalesce(p_correlation, gen_random_uuid()),
     p_title, v_sum, p_changes, p_affects, v_day.id, auth.uid(), clock_timestamp())
  returning id into v_id;

  return v_id;
end;
$fn$;

-- ── 사건 한 건의 화면 모양 ────────────────────────────────────
-- ⚠ state 를 더 이상 사건마다 붙이지 않는다. 어느 사건에 배지를 달지는
--   목록 전체를 보고 정해야 하므로 entity_change_history 가 id 로 알려 준다.
create or replace function public.change_event_json(p_event entity_change_events)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'id', p_event.id,
    'occurred_at', p_event.occurred_at,
    'title', p_event.title,
    'summary', coalesce(p_event.summary, p_event.title),
    'source_type', p_event.source_type,
    'source_entity_id', p_event.source_entity_id,
    'correlation_id', p_event.correlation_id,
    'changes', p_event.changes,
    'affects_sales', p_event.affects_sales,
    'state', entity_change_state(p_event),
    'source_name', case p_event.source_type
      when 'ingredient' then (select name from ingredients where id = p_event.source_entity_id)
      when 'inbound'    then (select name from ingredients where id = p_event.entity_id)
      else null end,
    'affected_recipes', (
      select count(*) from entity_change_events e
       where e.correlation_id = p_event.correlation_id and e.entity_type = 'recipe'
         and e.id <> p_event.id));
$fn$;

-- ── 목록: 요약 + 배지 대상 두 건 ──────────────────────────────
drop function if exists public.entity_change_history(uuid, text, uuid, text, int, int);

create or replace function public.entity_change_history(
  p_store uuid, p_entity_type text, p_entity_id uuid,
  p_cursor text default null, p_limit int default 20,
  p_days int default 7
) returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_from  timestamptz := case when p_days is not null
                              then clock_timestamp() - make_interval(days => p_days) end;
  v_at    timestamptz;
  v_id    uuid;
  v_rows  entity_change_events[];
  v_last  entity_change_events;
  v_count int;  v_direct int;  v_auto int;  v_lastat timestamptz;
  v_ref   uuid;  v_unref uuid;  v_unref_state text;
begin
  perform assert_my_store(p_store);

  if p_cursor is not null and p_cursor <> '' then
    v_at := split_part(p_cursor, '|', 1)::timestamptz;
    v_id := nullif(split_part(p_cursor, '|', 2), '')::uuid;
  end if;

  -- ── 창 전체 요약 — 페이지가 아니라 기간 전부를 센다 ─────────
  select count(*),
         count(*) filter (where e.source_type = 'direct'),
         count(*) filter (where e.source_type <> 'direct'),
         max(e.occurred_at)
    into v_count, v_direct, v_auto, v_lastat
    from entity_change_events e
   where e.store_id = p_store and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id
     and (v_from is null or e.occurred_at >= v_from);

  -- ── 배지를 달 두 건을 **서버가 고른다** ─────────────────────
  -- 앱이 고르면 식재료 화면과 레시피 화면이 다르게 고를 수 있다.
  select e.id into v_ref
    from entity_change_events e
   where e.store_id = p_store and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id and e.affects_sales
     and (v_from is null or e.occurred_at >= v_from)
     and entity_change_state(e) = 'reflected'
   order by e.occurred_at desc, e.id desc limit 1;

  select e.id, entity_change_state(e) into v_unref, v_unref_state
    from entity_change_events e
   where e.store_id = p_store and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id and e.affects_sales
     and (v_from is null or e.occurred_at >= v_from)
     and entity_change_state(e) in ('not_reflected', 'partial')
   order by e.occurred_at desc, e.id desc limit 1;

  select array_agg(e order by e.occurred_at desc, e.id desc) into v_rows
    from (
      select * from entity_change_events e
       where e.store_id = p_store and e.entity_type = p_entity_type
         and e.entity_id = p_entity_id
         and (v_from is null or e.occurred_at >= v_from)
         and (v_at is null or (e.occurred_at, e.id) < (v_at, v_id))
       order by e.occurred_at desc, e.id desc
       limit v_limit
    ) e;

  v_last := case when v_rows is null then null else v_rows[array_length(v_rows, 1)] end;

  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(change_event_json(x)) from unnest(coalesce(v_rows, '{}')) x),
                      '[]'::jsonb),
    'next_cursor', case when v_rows is null or array_length(v_rows, 1) < v_limit then null
                        else v_last.occurred_at::text || '|' || v_last.id::text end,
    'summary', jsonb_build_object(
      'days', p_days,
      'count', v_count,
      'direct_count', v_direct,
      'auto_count', v_auto,
      'last_at', v_lastat,
      -- 이 두 건에만 배지를 단다. 나머지 매출 영향 사건은 배지 없이 둔다.
      'latest_reflected_event_id', v_ref,
      'latest_unreflected_event_id', v_unref,
      'latest_unreflected_state', v_unref_state));
end;
$fn$;

comment on function public.entity_change_history(uuid, text, uuid, text, int, int) is
  '수정 내역 목록 — 기본 7일. 요약과 **배지를 달 두 건**을 서버가 정한다(0078).';

-- ── 상세의 최근 수정 ─────────────────────────────────────────
-- 기획: `last_change = { occurred_at, event_id, display_state }`
-- ⚠ 기록이 없으면 생성일만 준다. 목록에 가짜 '최초 등록' 사건을 만들지 않는다.
create or replace function public.last_entity_change(
  p_store uuid, p_entity_type text, p_entity_id uuid
) returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_ev entity_change_events;
  v_at timestamptz;
begin
  select * into v_ev from entity_change_events
   where store_id = p_store and entity_type = p_entity_type and entity_id = p_entity_id
   order by occurred_at desc, id desc limit 1;

  if v_ev.id is not null then
    return jsonb_build_object(
      'occurred_at', v_ev.occurred_at,
      'event_id', v_ev.id,
      'display_state', entity_change_state(v_ev),
      'has_history', true);
  end if;

  if p_entity_type = 'ingredient' then
    select created_at into v_at from ingredients where id = p_entity_id;
  else
    select created_at into v_at from recipes where id = p_entity_id;
  end if;

  return jsonb_build_object(
    'occurred_at', v_at, 'event_id', null,
    'display_state', 'irrelevant', 'has_history', false);
end;
$fn$;

select public.assert_no_rpc_overloads();
