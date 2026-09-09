-- Final change-history contract §7.1: purchasing links are direct changes.
-- Snapshot labels/values at write time; no inventory or price propagation.
create or replace function public.capture_purchase_option_change()
returns trigger language plpgsql security invoker set search_path = public as $fn$
declare
  previous purchase_options;
  current_row purchase_options;
  target purchase_options;
  changes jsonb;
  unit_name text;
begin
  if tg_op <> 'INSERT' then previous := old; end if;
  if tg_op <> 'DELETE' then current_row := new; end if;
  target := case when tg_op = 'DELETE' then old else new end;
  -- Cascading physical parent deletion is not a surviving ingredient edit.
  select base_unit::text into unit_name from ingredients where id = target.ingredient_id;
  if not found then return null; end if;
  changes := change_line('purchase_name', '구매 링크 이름', previous.purchase_name, current_row.purchase_name)
    || change_line('vendor', '구매처', vendor_name(previous.vendor_id), vendor_name(current_row.vendor_id))
    || change_line('volume', '용량', previous.volume, current_row.volume, unit_name)
    || change_line('amount', '금액', previous.amount, current_row.amount, '원')
    || change_line('url', '구매 링크', previous.url, current_row.url);
  perform record_entity_change(target.store_id, 'ingredient', target.ingredient_id, 'direct',
    case tg_op when 'INSERT' then '구매 링크 추가' when 'DELETE' then '구매 링크 삭제' else '구매 링크 수정' end,
    changes, false);
  return null;
end
$fn$;
revoke all on function public.capture_purchase_option_change() from public, anon, authenticated;
grant execute on function public.capture_purchase_option_change() to margincook_rpc_executor;
create trigger purchase_option_change_history
after insert or update or delete on public.purchase_options
for each row execute function public.capture_purchase_option_change();
