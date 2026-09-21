-- Applied migrations are immutable. Verify their cumulative function definitions:
-- a missing replacement or duplicate JSON key must not pass silently in fresh/upgrade suites.
-- Catalog-only: no customer rows, inventory events, or business snapshots are changed.
do $test$
declare spec record; body text; occurrences integer;
begin
  for spec in select * from (values
    ('public.settings_lists(uuid)', 'c.kind = ''material'' and false',1),
    ('public.settings_lists(uuid)', 'm.store_id = p_store and m.active and false',1),
    ('public.last_entity_change(uuid,text,uuid)', 'v_legacy_at timestamptz',1),
    ('public.last_entity_change(uuid,text,uuid)', 'into v_legacy_event from public.material_retirement_archive',1),
    ('public.last_entity_change(uuid,text,uuid)', 'v_legacy_at:=v_legacy_event.occurred_at',1),
    ('public.last_entity_change(uuid,text,uuid)', 'public.configuration_change_operation_json(v_legacy_event)',1),
    ('public.last_entity_change(uuid,text,uuid)', '''has_legacy_history'',true',1),
    ('public.sales_range(uuid,date,date)', 'public.sales_authoritative_range_detail(p_store,p_from,p_to)',1),
    ('public.sales_authoritative_range_detail_base_0121(uuid,date,date)',
      'public.sales_item_channel_accounting_rows(l.id)',3)
  ) as expected(signature, anchor, expected_count) loop
    body := replace(pg_get_functiondef(spec.signature::regprocedure), E'\r\n', E'\n');
    occurrences := (length(body) - length(replace(body, spec.anchor, ''))) / length(spec.anchor);
    if occurrences <> spec.expected_count then
      raise exception 'linked migration postcondition: % anchor % occurred % times, expected %',
        spec.signature, spec.anchor, occurrences,spec.expected_count;
    end if;
  end loop;
  -- JSONB collapses duplicate object keys, so inspect the key in source as well.
  body := pg_get_functiondef('public.sales_authoritative_range_detail_base_0121(uuid,date,date)'::regprocedure);
  occurrences := (length(body) - length(replace(body, '''net_sales''', ''))) / length('''net_sales''');
  if occurrences <> 3 then
    raise exception 'linked migration postcondition: authoritative detail net_sales keys occur % times, expected 3', occurrences;
  end if;
  body := pg_get_functiondef('public.sales_item_channel_accounting_rows(uuid)'::regprocedure);
  if body like '%l.daily_sales_item_id = s.id AND s.channel_storage_version = 1%' then
    raise exception 'linked migration postcondition: legacy tax fallback is still restricted to storage version 1';
  end if;
  body := pg_get_functiondef('public.sales_tax_breakdown(uuid,date,date)'::regprocedure);
  if body not like '%daily_sales_item_tax_component_snapshots%' then
    raise exception 'linked migration postcondition: legacy component snapshots are absent from tax breakdown';
  end if;
  perform pg_temp.ok('이관된 기타 매출 수량은 snapshot quantity/qty와 일치',not exists(
    select 1 from public.daily_sales ds join public.daily_sales_etc_lines l on l.daily_sales_id=ds.id
     where ds.etc_tax_snapshot is not null
       and l.quantity is distinct from coalesce(nullif(ds.etc_tax_snapshot->>'quantity','')::numeric,
         nullif(ds.etc_tax_snapshot->>'qty','')::numeric,1)));
  perform pg_temp.ok('이관 수량 검사는 1개 초과 실제 행을 포함',exists(
    select 1 from public.daily_sales_etc_lines where quantity>1));
  raise notice 'linked migration postconditions: catalog and migrated-ledger assertions passed';
end $test$;
