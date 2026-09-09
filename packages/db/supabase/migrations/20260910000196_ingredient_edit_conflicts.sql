-- F8: memo-only writes and optimistic checks for the current ingredient form.
-- Existing RPC grants, RLS and legacy clients remain intact. No ledger rewrite.
begin;
do $patch$
declare d text; anchor text;
begin
  d := replace(pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure), chr(13), '');
  anchor := 'select * into v_before from ingredients where id = v_id and store_id = p_store;';
  if (length(d)-length(replace(d,anchor,'')))/length(anchor) <> 1 then
    raise exception 'ingredient edit lock anchor must occur exactly once';
  end if;
  d := replace(d, anchor, $body$
    select * into v_before from ingredients where id = v_id and store_id = p_store for update;
    if not found then
      raise exception '식재료를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
    if p_payload ? 'expected' then
      if jsonb_typeof(p_payload->'expected') is distinct from 'object'
         or not (to_jsonb(v_before) @> (p_payload->'expected')) then
        raise exception '다른 곳에서 식재료가 수정됐어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.' using errcode = '40001';
      end if;
    end if;
  $body$);
  anchor := 'v_new := v_id is null;';
  if (length(d)-length(replace(d,anchor,'')))/length(anchor) <> 1 then
    raise exception 'ingredient memo patch anchor must occur exactly once';
  end if;
  d := replace(d, anchor, $body$
    if p_payload->>'patch' = 'memo' then
      if v_id is null or not (p_payload ? 'memo') or not (p_payload ? 'expected_memo') then
        raise exception '메모 수정 정보가 올바르지 않습니다' using errcode = '22000';
      end if;
      select * into v_before from ingredients where id = v_id and store_id = p_store for update;
      if not found then
        raise exception '식재료를 찾을 수 없습니다' using errcode = 'P0002';
      end if;
      -- Same-value retry is a no-op even if the first successful response was lost.
      if v_before.memo is not distinct from nullif(p_payload->>'memo','') then
        return v_id;
      end if;
      if v_before.memo is distinct from nullif(p_payload->>'expected_memo','') then
        raise exception '다른 곳에서 메모가 수정됐어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.' using errcode = '40001';
      end if;
      update ingredients set memo = nullif(p_payload->>'memo',''), updated_at = now()
        where id = v_id and store_id = p_store;
      return v_id;
    end if;
    v_new := v_id is null;
  $body$);
  execute d;
end;
$patch$;
commit;
