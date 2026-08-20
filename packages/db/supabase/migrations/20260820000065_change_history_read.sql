-- ════════════════════════════════════════════════════════════════
-- 0065 · 수정 내역 읽기
--
-- 상세 화면의 한 줄(`최근 수정 08.18 09:10 · 현재 매출 반영 ›`)과
-- 그 줄을 눌러 여는 목록을 같은 판정으로 그린다.
--
-- ⚠ 커서는 (occurred_at, id) 복합이다. 시각만 쓰면 같은 순간에 기록된
--   이벤트가 페이지 경계에서 새거나 겹친다 — 전파는 한 트랜잭션에서
--   여러 건이 같은 시각으로 들어간다.
-- ════════════════════════════════════════════════════════════════

/** 이벤트 한 건을 화면 모양으로. 반영 상태는 읽는 시점에 계산한다. */
create or replace function public.change_event_json(p_event entity_change_events)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'id', p_event.id,
    'occurred_at', p_event.occurred_at,
    'title', p_event.title,
    'source_type', p_event.source_type,
    'source_entity_id', p_event.source_entity_id,
    'correlation_id', p_event.correlation_id,
    'changes', p_event.changes,
    'affects_sales', p_event.affects_sales,
    'state', entity_change_state(p_event),
    -- 자동 전파라면 원본이 무엇이었는지 이름으로 보여 준다.
    'source_name', case p_event.source_type
      when 'ingredient' then (select name from ingredients where id = p_event.source_entity_id)
      when 'inbound'    then (select name from ingredients where id = p_event.entity_id)
      else null end,
    -- 이 변경이 몇 개 메뉴로 퍼졌나. 식재료 카드의 마지막 줄이 된다.
    'affected_recipes', (
      select count(*) from entity_change_events e
       where e.correlation_id = p_event.correlation_id and e.entity_type = 'recipe'
         and e.id <> p_event.id));
$fn$;

/**
 * 상세 화면 한 줄에 쓸 마지막 변경.
 * 기록이 없으면 생성일을 최근 수정일로 쓰고 '최초 등록'이라 부른다.
 */
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
    return change_event_json(v_ev) || jsonb_build_object('has_history', true);
  end if;

  -- 아직 아무것도 안 고쳤다 — 등록 시각이 마지막 변경이다.
  if p_entity_type = 'ingredient' then
    select created_at into v_at from ingredients where id = p_entity_id;
  else
    select created_at into v_at from recipes where id = p_entity_id;
  end if;

  return jsonb_build_object(
    'id', null, 'occurred_at', v_at, 'title', '최초 등록',
    'source_type', 'direct', 'changes', '[]'::jsonb,
    'affects_sales', false, 'state', 'irrelevant',
    'affected_recipes', 0, 'has_history', false);
end;
$fn$;

/**
 * 수정 내역 목록. 최신순, 커서 페이지네이션.
 * p_cursor 형식은 '<occurred_at ISO>|<id>' — 마지막으로 받은 항목 그대로다.
 */
create or replace function public.entity_change_history(
  p_store uuid, p_entity_type text, p_entity_id uuid,
  p_cursor text default null, p_limit int default 20
) returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_at    timestamptz;
  v_id    uuid;
  v_rows  entity_change_events[];
  v_last  entity_change_events;
begin
  perform assert_my_store(p_store);

  if p_cursor is not null and p_cursor <> '' then
    v_at := split_part(p_cursor, '|', 1)::timestamptz;
    v_id := nullif(split_part(p_cursor, '|', 2), '')::uuid;
  end if;

  select array_agg(e order by e.occurred_at desc, e.id desc) into v_rows
    from (
      select * from entity_change_events e
       where e.store_id = p_store
         and e.entity_type = p_entity_type
         and e.entity_id = p_entity_id
         -- 복합 커서 — 같은 시각이 여럿이어도 순서가 흔들리지 않는다.
         and (v_at is null or (e.occurred_at, e.id) < (v_at, v_id))
       order by e.occurred_at desc, e.id desc
       limit v_limit
    ) e;

  if v_rows is null then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null);
  end if;

  v_last := v_rows[array_length(v_rows, 1)];

  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(change_event_json(x)), '[]'::jsonb)
                from unnest(v_rows) x),
    -- 받은 개수가 한 페이지에 못 미치면 끝이다.
    'next_cursor', case when array_length(v_rows, 1) < v_limit then null
                        else v_last.occurred_at::text || '|' || v_last.id::text end);
end;
$fn$;

comment on function public.entity_change_history(uuid, text, uuid, text, int) is
  '수정 내역 목록 — 최신순, (occurred_at, id) 복합 커서(0065).';

select public.assert_no_rpc_overloads();
