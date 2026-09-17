-- 구매처 수정은 요청 매장에 존재하는 정확한 한 행만 성공해야 한다.
-- 예전 함수는 없는 ID나 다른 매장 ID를 UPDATE 0행으로 흘린 뒤 그 ID를 그대로 반환했다.
create or replace function public.save_vendor(p_store uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_name text := btrim(p_payload->>'name');
begin
  perform assert_my_store(p_store);
  if v_name is null or v_name = '' then
    raise exception '거래처 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if exists (
    select 1
      from vendors
     where store_id = p_store
       and not hidden
       and lower(btrim(name)) = lower(v_name)
       and (v_id is null or id <> v_id)
  ) then
    raise exception '이미 같은 이름의 거래처가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into vendors (store_id, name, hidden)
    values (p_store, v_name, false)
    returning id into v_id;
  else
    update vendors
       set name = v_name
     where id = v_id
       and store_id = p_store;

    if not found then
      raise exception '구매처를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;

  return v_id;
end;
$fn$;

comment on function public.save_vendor(uuid,jsonb) is
  '구매처 생성·수정. 수정 ID는 요청 매장에 존재해야 하며 없거나 타 매장이면 P0002(0012).';
