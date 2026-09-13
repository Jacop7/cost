-- Menu removal is distinct from sales stop. Historical rows and ledgers survive.
begin;
alter table public.recipes add column deleted_at timestamptz,
  add column deleted_by uuid,
  add column deletion_base_revision bigint;
alter table public.recipes add constraint recipe_deletion_consistent check (
  (deleted_at is null and deleted_by is null and deletion_base_revision is null)
  or (deleted_at is not null and deleted_by is not null and deletion_base_revision > 0 and active = false));

create function public.delete_recipe(p_store uuid, p_recipe uuid, p_expected_revision text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.recipes; expected bigint;
begin
  perform public.assert_my_store(p_store);
  if p_expected_revision is null or p_expected_revision !~ '^[1-9][0-9]*$' then
    raise exception '메뉴 판본을 다시 확인해 주세요.' using errcode='22000';
  end if;
  begin expected := p_expected_revision::bigint;
  exception when numeric_value_out_of_range then
    raise exception '메뉴 판본을 다시 확인해 주세요.' using errcode='22000'; end;
  perform public.lock_business_scope(p_store);
  perform public.assert_my_store(p_store);
  select * into r from public.recipes where store_id=p_store and id=p_recipe for no key update;
  if not found then raise exception '메뉴를 찾을 수 없어요.' using errcode='P0002'; end if;
  -- Lost-response retries acknowledge only the same actor and observed revision.
  if r.deleted_at is not null then
    if r.deleted_by=auth.uid() and r.deletion_base_revision=expected then return; end if;
    raise exception '이미 삭제된 메뉴예요. 목록을 다시 불러와 주세요.' using errcode='45009';
  end if;
  if exists(select 1 from public.business_days where store_id=p_store and status in ('open','break')) then
    raise exception '영업 중·브레이크 중에는 메뉴를 삭제할 수 없어요. 영업 종료 후 다시 시도해 주세요.'
      using errcode='55000',detail='RECIPE_DELETE_DURING_BUSINESS';
  end if;
  if r.edit_revision<>expected then
    raise exception '메뉴가 변경됐어요. 목록을 다시 불러온 후 삭제해 주세요.' using errcode='45009';
  end if;
  update public.recipes set active=false, deleted_at=clock_timestamp(), deleted_by=auth.uid(),
    deletion_base_revision=expected, edit_revision=expected+1 where id=p_recipe and store_id=p_store;
end $$;
grant create on schema public to margincook_rpc_executor;
alter function public.delete_recipe(uuid,uuid,text) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.delete_recipe(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.delete_recipe(uuid,uuid,text) to authenticated;

-- Keep existing read formulas and ACLs; change only current-list eligibility.
do $patch$
declare sig text; source text; anchor text; replacement text;
begin
  foreach sig in array array['public.recipe_list(uuid)','public.recipe_pick_list(uuid,uuid)','public.save_recipe(uuid,jsonb)'] loop
    source:=pg_get_functiondef(sig::regprocedure);
    if sig='public.recipe_list(uuid)' then
      anchor:='where r.store_id=p_store'; replacement:=anchor||' and r.deleted_at is null';
    elsif sig='public.recipe_pick_list(uuid,uuid)' then
      anchor:='where r.store_id = p_store'; replacement:=anchor||' and r.deleted_at is null';
    else
      -- save_recipe already holds the same business lock here. Old receipt replay
      -- remains read-only; a fresh edit cannot revive or rewrite a removed menu.
      anchor:='v_target := (p_payload->>''id'')::uuid;';
      replacement:=anchor||E'\n    if exists(select 1 from public.recipes where id=v_target and store_id=p_store and deleted_at is not null) then\n      raise exception ''삭제된 메뉴는 수정할 수 없어요.'' using errcode=''45009'';\n    end if;';
    end if;
    if (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1 then
      raise exception '0236 source anchor mismatch: %',sig;
    end if;
    execute replace(source,anchor,replacement);
  end loop;
end $patch$;
notify pgrst, 'reload schema';
commit;
