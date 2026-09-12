-- Separate ingredient identity from receipt entry. Legacy price-edit contracts remain valid.
begin;
do $patch$
declare d text; a text;
begin
  d:=replace(pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure),chr(13),'');
  a:='not in (''1'',''2'')';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0231 version anchor'; end if;
  d:=replace(d,a,'not in (''1'',''2'',''3'')');
  a:='  if v_name is null or v_name = '''' then';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0231 profile anchor'; end if;
  -- v_before has already been read under the existing store/ingredient locks and
  -- optimistic revision check. Hidden values must never come from a stale client.
  d:=replace(d,a,$body$
  if p_payload->>'contract_version'='3' then
    if p_payload ? 'per_volume' or p_payload ? 'purchase_price' then
      raise exception '식재료 정보에서는 용량과 구매 가격을 변경할 수 없습니다' using errcode='22000';
    end if;
    p_payload:=p_payload || jsonb_build_object(
      'per_volume',case when v_new then 1 else v_before.per_volume end,
      'purchase_price',case when v_new then null else v_before.purchase_price end);
  end if;
$body$||a);
  execute d;
end $patch$;
select public.assert_no_rpc_overloads();
notify pgrst,'reload schema';
commit;
