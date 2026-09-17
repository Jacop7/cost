-- Root entity creation stays in the append-only audit ledger, but it is not a modification.
-- The public ingredient/menu history, totals and state-badge selection all use the same visible set.
begin;

create or replace function public.entity_change_history(
  p_store uuid, p_entity_type text, p_entity_id uuid,
  p_cursor text default null, p_limit int default 20,
  p_days int default 7
) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $fn$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_from timestamptz := case when p_days is not null
    then clock_timestamp() - make_interval(days => p_days) end;
  v_at timestamptz;
  v_id uuid;
  v_rows public.entity_change_events[];
  v_last public.entity_change_events;
  v_count int; v_direct int; v_auto int; v_lastat timestamptz;
  v_ref uuid; v_unref uuid; v_unref_state text;
begin
  perform public.assert_my_store(p_store);

  if p_cursor is not null and p_cursor <> '' then
    v_at := split_part(p_cursor, '|', 1)::timestamptz;
    v_id := nullif(split_part(p_cursor, '|', 2), '')::uuid;
  end if;

  select count(*),
         count(*) filter (where e.source_type = 'direct'),
         count(*) filter (where e.source_type <> 'direct'),
         max(e.occurred_at)
    into v_count, v_direct, v_auto, v_lastat
    from public.entity_change_events e
   where e.store_id = p_store and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id
     and not (
       e.source_type = 'direct' and (
         (e.operation is not null and e.operation = 'create'
           and coalesce(e.operation_subject_type, e.entity_type) = e.entity_type
           and coalesce(e.operation_subject_id, e.entity_id::text) = e.entity_id::text)
         or
         (e.operation is null and jsonb_array_length(e.changes) = 1
           and e.changes#>>'{0,key}' = 'created'
           and e.changes#>'{0,before}' = 'null'::jsonb
           and e.changes#>'{0,after}' is not null
           and e.changes#>'{0,after}' <> 'null'::jsonb)
       )
     )
     and (v_from is null or e.occurred_at >= v_from);

  select e.id into v_ref
    from public.entity_change_events e
   where e.store_id = p_store and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id and e.affects_sales
     and not (
       e.source_type = 'direct' and (
         (e.operation is not null and e.operation = 'create'
           and coalesce(e.operation_subject_type, e.entity_type) = e.entity_type
           and coalesce(e.operation_subject_id, e.entity_id::text) = e.entity_id::text)
         or
         (e.operation is null and jsonb_array_length(e.changes) = 1
           and e.changes#>>'{0,key}' = 'created'
           and e.changes#>'{0,before}' = 'null'::jsonb
           and e.changes#>'{0,after}' is not null
           and e.changes#>'{0,after}' <> 'null'::jsonb)
       )
     )
     and (v_from is null or e.occurred_at >= v_from)
     and public.entity_change_state(e) = 'reflected'
   order by e.occurred_at desc, e.id desc limit 1;

  select e.id, public.entity_change_state(e) into v_unref, v_unref_state
    from public.entity_change_events e
   where e.store_id = p_store and e.entity_type = p_entity_type
     and e.entity_id = p_entity_id and e.affects_sales
     and not (
       e.source_type = 'direct' and (
         (e.operation is not null and e.operation = 'create'
           and coalesce(e.operation_subject_type, e.entity_type) = e.entity_type
           and coalesce(e.operation_subject_id, e.entity_id::text) = e.entity_id::text)
         or
         (e.operation is null and jsonb_array_length(e.changes) = 1
           and e.changes#>>'{0,key}' = 'created'
           and e.changes#>'{0,before}' = 'null'::jsonb
           and e.changes#>'{0,after}' is not null
           and e.changes#>'{0,after}' <> 'null'::jsonb)
       )
     )
     and (v_from is null or e.occurred_at >= v_from)
     and public.entity_change_state(e) in ('not_reflected', 'partial')
   order by e.occurred_at desc, e.id desc limit 1;

  select array_agg(e order by e.occurred_at desc, e.id desc) into v_rows
    from (
      select * from public.entity_change_events e
       where e.store_id = p_store and e.entity_type = p_entity_type
         and e.entity_id = p_entity_id
         and not (
           e.source_type = 'direct' and (
             (e.operation is not null and e.operation = 'create'
               and coalesce(e.operation_subject_type, e.entity_type) = e.entity_type
               and coalesce(e.operation_subject_id, e.entity_id::text) = e.entity_id::text)
             or
             (e.operation is null and jsonb_array_length(e.changes) = 1
               and e.changes#>>'{0,key}' = 'created'
               and e.changes#>'{0,before}' = 'null'::jsonb
               and e.changes#>'{0,after}' is not null
               and e.changes#>'{0,after}' <> 'null'::jsonb)
           )
         )
         and (v_from is null or e.occurred_at >= v_from)
         and (v_at is null or (e.occurred_at, e.id) < (v_at, v_id))
       order by e.occurred_at desc, e.id desc
       limit v_limit
    ) e;

  v_last := case when v_rows is null then null else v_rows[array_length(v_rows, 1)] end;

  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(public.change_event_json(x))
      from unnest(coalesce(v_rows, '{}')) x), '[]'::jsonb),
    'next_cursor', case when v_rows is null or array_length(v_rows, 1) < v_limit then null
      else v_last.occurred_at::text || '|' || v_last.id::text end,
    'summary', jsonb_build_object(
      'days', p_days,
      'count', v_count,
      'direct_count', v_direct,
      'auto_count', v_auto,
      'last_at', v_lastat,
      'latest_reflected_event_id', v_ref,
      'latest_unreflected_event_id', v_unref,
      'latest_unreflected_state', v_unref_state));
end;
$fn$;

-- 0174에서 봉인한 Data API facade 메타데이터를 유지한다. CREATE OR REPLACE의
-- 선언으로 SECURITY INVOKER로 되돌리면 authenticated 호출이 내부 helper에서 막힌다.
alter function public.entity_change_history(uuid,text,uuid,text,int,int) security definer;
alter function public.entity_change_history(uuid,text,uuid,text,int,int) set search_path=public,pg_temp;
alter function public.entity_change_history(uuid,text,uuid,text,int,int) owner to costkeep_rpc_executor;

comment on function public.entity_change_history(uuid,text,uuid,text,int,int) is
  '식재료·메뉴 수정 내역. 최초 등록은 감사 원장에 보존하되 목록·건수·상태 선정에서는 제외한다.';

select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
