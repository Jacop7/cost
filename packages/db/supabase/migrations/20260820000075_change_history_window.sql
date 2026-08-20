-- ════════════════════════════════════════════════════════════════
-- 0075 · 수정 내역에 기간과 요약을 붙인다
--
-- 프로토타입: docs/prototypes/ingredient-recipe-change-history.html
--   상단  `최근 7일 기준 3건` · `최근 수정 오늘 03:56` · `직접 수정 2건 · 자동 변경 1건`
--
-- 세 숫자를 화면이 세면 안 된다. 한 페이지(20건)만 받아 놓고 세면 그 페이지 안의
-- 개수일 뿐인데 사장님은 전체라고 읽는다. 서버가 창(window) 전체를 세서 준다.
--
-- ⚠ 기간을 좁히면 그 밖의 기록이 **닿을 수 없게** 된다. p_days 가 null 이면 전체다 —
--   화면은 7일·30일·전체를 고를 수 있게 두고, 좁혔다는 사실을 상단에 밝힌다.
-- ════════════════════════════════════════════════════════════════

drop function if exists public.entity_change_history(uuid, text, uuid, text, int);

create or replace function public.entity_change_history(
  p_store uuid, p_entity_type text, p_entity_id uuid,
  p_cursor text default null, p_limit int default 20,
  p_days int default null
) returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_from  timestamptz := case when p_days is not null
                              then clock_timestamp() - make_interval(days => p_days) end;
  v_at    timestamptz;
  v_id    uuid;
  v_rows  entity_change_events[];
  v_last  entity_change_events;
  v_count int;
  v_direct int;
  v_auto  int;
  v_lastat timestamptz;
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
   where e.store_id = p_store
     and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id
     and (v_from is null or e.occurred_at >= v_from);

  select array_agg(e order by e.occurred_at desc, e.id desc) into v_rows
    from (
      select * from entity_change_events e
       where e.store_id = p_store
         and e.entity_type = p_entity_type
         and e.entity_id = p_entity_id
         and (v_from is null or e.occurred_at >= v_from)
         -- 복합 커서 — 같은 시각이 여럿이어도 순서가 흔들리지 않는다.
         and (v_at is null or (e.occurred_at, e.id) < (v_at, v_id))
       order by e.occurred_at desc, e.id desc
       limit v_limit
    ) e;

  v_last := case when v_rows is null then null
                 else v_rows[array_length(v_rows, 1)] end;

  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(change_event_json(x)) from unnest(coalesce(v_rows, '{}')) x),
                      '[]'::jsonb),
    'next_cursor', case when v_rows is null or array_length(v_rows, 1) < v_limit then null
                        else v_last.occurred_at::text || '|' || v_last.id::text end,
    'summary', jsonb_build_object(
      'days', p_days,
      'count', v_count,
      'direct', v_direct,
      'auto', v_auto,
      'last_at', v_lastat));
end;
$fn$;

comment on function public.entity_change_history(uuid, text, uuid, text, int, int) is
  '수정 내역 목록 — 최신순, (occurred_at, id) 복합 커서. p_days 로 기간을 좁히고 '
  '요약(건수·직접/자동·최근 시각)은 **창 전체**를 센다(0075).';

select public.assert_no_rpc_overloads();
