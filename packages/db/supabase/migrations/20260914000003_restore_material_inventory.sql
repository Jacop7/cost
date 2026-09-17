-- All current materials use the existing inventory workflow. Frozen business-day
-- snapshots retain their original tracking flags; no historical ledger is backfilled.
begin;

do $$ declare s record; begin
  for s in select id from public.stores order by id loop
    perform public.lock_business_scope(s.id);
  end loop;
  if exists(select 1 from public.business_days where status in ('open','break')) then
    raise exception '재료 재고 전환은 영업 종료 후 실행해야 합니다' using errcode='55000';
  end if;
end $$;

update public.ingredients set stock_tracking=true where not stock_tracking;

-- Old clients must not reintroduce the removed opt-out. Keep the column and the
-- historical snapshot reader for corrections of business days closed before this fix.
do $patch$ declare d text; anchor text; begin
  d:=pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure);
  anchor:='  if p_payload->>''contract_version''=''3'' then';
  if position(anchor in d)=0 then raise exception 'inventory registration anchor missing'; end if;
  execute replace(d,anchor,
    E'  if p_payload->>''stock_tracking''=''false'' then raise exception ''모든 재료는 재고를 관리합니다. 화면을 다시 불러와 주세요.'' using errcode=''55000''; end if;\n'||anchor);
end $patch$;

notify pgrst,'reload schema';
commit;
