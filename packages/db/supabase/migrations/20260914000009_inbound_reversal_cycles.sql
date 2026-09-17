begin;

-- E11 returned an order to 'ordered' but left its original receipts unlinked.
-- Re-receiving that order made the next E11 subtract every historical receipt.
-- Compensate each original in the current cycle and link its opposite event.
-- Existing unlinked compensation marks a cycle boundary; never rewrite history.
do $migration$
declare definition text; anchor text; replacement text;
begin
  definition:=replace(pg_get_functiondef('public.e11_inbound_reverted(uuid,text)'::regprocedure),chr(13),'');
  anchor:=$old$    select ingredient_id, sum(count_delta) as delta
      from inventory_events
     where order_record_id = p_order and type = 'inbound'
       and not exists (select 1 from inventory_events r where r.reverses_event_id = inventory_events.id)
     group by ingredient_id$old$;
  replacement:=$new$    select original.id, original.ingredient_id, original.count_delta as delta
      from inventory_events original
     where original.order_record_id = p_order and original.type = 'inbound'
       -- Legacy E11's order-linked adjust also ended the preceding receipt cycle.
       and original.seq > coalesce((select max(compensation.seq) from inventory_events compensation
         where compensation.order_record_id=p_order and compensation.type='adjust'),0)
       and not exists (select 1 from inventory_events reversal where reversal.reverses_event_id=original.id)
       and not exists (select 1 from stock_event_reversal_receipts receipt where receipt.event_id=original.id)
     order by original.seq$new$;
  anchor:=replace(anchor,chr(13),''); replacement:=replace(replacement,chr(13),'');
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception '00009 E11 current-cycle query anchor must occur exactly once';
  end if;
  definition:=replace(definition,anchor,replacement);

  anchor:='(store_id, ingredient_id, type, count_delta, order_record_id, note, occurred_at, unit_normalized)';
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception '00009 E11 compensation columns anchor must occur exactly once';
  end if;
  definition:=replace(definition,anchor,
    '(store_id, ingredient_id, type, count_delta, order_record_id, note, occurred_at, unit_normalized, reverses_event_id)');
  anchor:='       now(), true);';
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception '00009 E11 compensation value anchor must occur exactly once';
  end if;
  definition:=replace(definition,anchor,'       now(), true, ev.id);');
  execute definition;

  -- History cancels one original, while E11 cancels all receipts in its cycle.
  -- Earlier cancelled cycles must not disqualify a new single-receipt cycle.
  definition:=replace(pg_get_functiondef('public.stock_revert_candidates(uuid)'::regprocedure),chr(13),'');
  anchor:='and (select count(*) from inventory_events i where i.order_record_id=o.id and i.type=''inbound'')=1';
  replacement:=$new$and (select count(*) from inventory_events i where i.order_record_id=o.id and i.type='inbound'
          and i.seq > coalesce((select max(c.seq) from inventory_events c
            where c.order_record_id=o.id and c.type='adjust'),0)
          and not exists(select 1 from inventory_events r where r.reverses_event_id=i.id)
          and not exists(select 1 from stock_event_reversal_receipts receipt where receipt.event_id=i.id))=1$new$;
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception '00009 history current-cycle count anchor must occur exactly once';
  end if;
  execute replace(definition,anchor,replace(replacement,chr(13),''));
end $migration$;

select public.assert_no_rpc_overloads();
commit;
