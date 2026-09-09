-- Capture the input snapshot in the same transaction as the derived price.
-- Existing events are immutable: do not guess/backfill old input values.
-- Surgical replacement preserves the later timezone/tax/ACL function changes.
do $migration$
declare
  original text := pg_get_functiondef('public.e1_confirm_inbound(uuid,numeric,text,date)'::regprocedure);
  needle text := 'change_line(''unit_price'', ''기준 단가'',';
  replacement text := $snapshot$change_line('received_quantity', '실입고량', null::numeric, v_base, v_unit0, 'direct')
      || change_line('paid_amount', '결제금액', null::numeric, o.amount * v_qty, '원', 'direct')
      || change_line('unit_price', '기준 단가',$snapshot$;
begin
  if (length(original) - length(replace(original, needle, ''))) / length(needle) <> 1
     or position('''received_quantity''' in original) > 0 then
    raise exception '0193: expected exactly one unmodified inbound change snapshot';
  end if;
  execute replace(original, needle, replacement);
end
$migration$;
