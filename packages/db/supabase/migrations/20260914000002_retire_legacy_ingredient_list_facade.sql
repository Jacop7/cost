-- ingredient_list_v2 is the only current mobile list contract because it includes
-- stock_tracking. Keep the v1 function for the v2 facade's internal call, but close
-- its direct Data API grant so an old client cannot hide cost-only material state.
begin;

revoke all on function public.ingredient_list(uuid)
  from public, anon, authenticated, service_role;

do $contract$
begin
  if has_function_privilege('authenticated', 'public.ingredient_list(uuid)', 'EXECUTE') then
    raise exception 'legacy ingredient_list must not remain a mobile facade';
  end if;
  if not has_function_privilege('authenticated', 'public.ingredient_list_v2(uuid)', 'EXECUTE') then
    raise exception 'ingredient_list_v2 must remain the current mobile facade';
  end if;
end;
$contract$;

notify pgrst, 'reload schema';
commit;
