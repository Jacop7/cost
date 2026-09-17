-- Applied migrations are immutable. Verify their cumulative function definitions:
-- a missing replacement or duplicate JSON key must not pass silently in fresh/upgrade suites.
-- Catalog-only: no customer rows, inventory events, or business snapshots are changed.
do $test$
declare spec record; body text; occurrences integer;
begin
  for spec in select * from (values
    ('public.settings_lists(uuid)', 'c.kind = ''material'' and false'),
    ('public.settings_lists(uuid)', 'm.store_id = p_store and m.active and false'),
    ('public.last_entity_change(uuid,text,uuid)', 'v_legacy_at timestamptz'),
    ('public.last_entity_change(uuid,text,uuid)', 'into v_legacy_event from public.material_retirement_archive'),
    ('public.last_entity_change(uuid,text,uuid)', 'v_legacy_at:=v_legacy_event.occurred_at'),
    ('public.last_entity_change(uuid,text,uuid)', 'public.configuration_change_operation_json(v_legacy_event)'),
    ('public.last_entity_change(uuid,text,uuid)', '''has_legacy_history'',true'),
    ('public.sales_range(uuid,date,date)', '''net_sales'', (select coalesce(sum(coalesce(ts.net_sales,'),
    ('public.sales_range(uuid,date,date)', 'ts.sales_channel_code::text=c.code')
  ) as expected(signature, anchor) loop
    body := replace(pg_get_functiondef(spec.signature::regprocedure), E'\r\n', E'\n');
    occurrences := (length(body) - length(replace(body, spec.anchor, ''))) / length(spec.anchor);
    if occurrences <> 1 then
      raise exception 'linked migration postcondition: % anchor % occurred % times, expected 1',
        spec.signature, spec.anchor, occurrences;
    end if;
  end loop;
  -- JSONB collapses duplicate object keys, so inspect the key in source as well.
  body := pg_get_functiondef('public.sales_range(uuid,date,date)'::regprocedure);
  occurrences := (length(body) - length(replace(body, '''net_sales''', ''))) / length('''net_sales''');
  if occurrences <> 1 then
    raise exception 'linked migration postcondition: sales_range net_sales key occurs % times, expected 1', occurrences;
  end if;
  raise notice 'linked migration postconditions: 10 catalog assertions passed';
end $test$;
