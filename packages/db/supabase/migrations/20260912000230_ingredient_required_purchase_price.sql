-- Current form contract requires an explicit purchase price. Historical nulls and
-- legacy callers are preserved; a missing price is never inferred from receipts.
begin;
do $patch$
declare d text; anchor text := '    v_new := v_id is null;';
begin
  d:=replace(pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure),chr(13),'');
  if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then
    raise exception '0230: ingredient full-write anchor must occur once';
  end if;
  execute replace(d,anchor,$sql$
    if p_payload ? 'contract_version' and p_payload->>'contract_version' not in ('1','2') then
      raise exception '지원하지 않는 식재료 저장 형식입니다' using errcode='22000';
    end if;
    if p_payload->>'contract_version'='2' then
      if jsonb_typeof(p_payload->'purchase_price') is distinct from 'number' then
        raise exception '구매 가격을 입력해 주세요' using errcode='22000';
      end if;
      if (p_payload->>'purchase_price')::numeric<0 then
        raise exception '구매 가격은 0 이상이어야 합니다' using errcode='22000';
      end if;
    end if;
$sql$||anchor);
end $patch$;
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
