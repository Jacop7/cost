-- Closed ingredient records remain readable history, not editable draft targets.
-- Apply after 0196: both editing paths already lock the scoped ingredient row.
-- Check active under that lock, before memo retry/CAS or the general form write.
-- No data rewrite, public signature, grant or ledger change.
begin;

do $patch$
declare
  d text;
  anchor text := 'select * into v_before from ingredients where id = v_id and store_id = p_store for update;';
  replacement text;
begin
  d := replace(pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure), chr(13), '');
  -- Exactly the memo and general-edit lookups from 0196 must be present.
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 2 then
    raise exception 'ingredient inactive edit guard requires exactly two locked lookups';
  end if;
  replacement := anchor || $body$
      if found and v_before.active is not true then
        raise exception '삭제된 식재료는 수정할 수 없습니다' using errcode = 'P0002';
      end if;
  $body$;
  d := replace(d, anchor, replacement);
  execute d;
end;
$patch$;

commit;
