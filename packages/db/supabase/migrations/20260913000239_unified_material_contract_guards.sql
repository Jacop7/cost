-- Forward validation for already applied 0237/0238. Never rewrite migration receipts.
begin;
do $validate$
declare f record; src text; anchor text;
begin
  for f in select * from (values
    ('public.settings_lists(uuid)', 'c.kind = ''material'' and false'),
    ('public.settings_lists(uuid)', 'm.store_id = p_store and m.active and false'),
    ('public.last_entity_change(uuid,text,uuid)', 'v_legacy_at timestamptz'),
    ('public.last_entity_change(uuid,text,uuid)', '''has_legacy_history'',true'),
    ('public.save_recipe(uuid,jsonb)', E'\nbegin\n  if jsonb_typeof(p_payload->''extras'')'),
    ('public.save_category(uuid,jsonb)', E'\nbegin\n  if p_payload->>''kind''=''material''')
  ) x(signature,expected) loop
    select replace(p.prosrc,E'\r\n',E'\n') into src from pg_proc p where p.oid=f.signature::regprocedure;
    anchor:=f.expected;
    if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then
      raise exception '0239 unified material contract mismatch: % / %',f.signature,anchor using errcode='55000';
    end if;
  end loop;
end $validate$;

-- Costs belong to one sale/menu identity. Quantity edits keep their frozen cost;
-- changing that identity would retain a cost from a different opening snapshot.
create function public.guard_sales_item_cost_identity() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.recipe_id is distinct from old.recipe_id or new.daily_sales_id is distinct from old.daily_sales_id then
    raise exception '판매 기록의 메뉴와 영업일은 변경할 수 없습니다' using errcode='22000';
  end if;
  return new;
end $$;
revoke all on function public.guard_sales_item_cost_identity() from public,anon,authenticated,service_role;
create trigger daily_sales_items_cost_identity
before update of recipe_id,daily_sales_id on public.daily_sales_items
for each row execute function public.guard_sales_item_cost_identity();
commit;
