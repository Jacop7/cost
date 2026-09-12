-- Direct purchase-price/capacity edits set current menu cost. The next successful
-- inbound/cancellation returns to the received-quantity weighted average.
-- Actual inbound valuation and historical inventory/sales ledgers remain unchanged.
begin;
alter table public.ingredients add column menu_unit_price_override numeric
  check (menu_unit_price_override is null or (menu_unit_price_override>=0 and menu_unit_price_override<'Infinity'::numeric));

create function public.current_ingredient_unit_price(p_ingredient uuid)
returns numeric language sql stable set search_path=public,pg_temp as $$
  select coalesce(i.menu_unit_price_override,public.base_unit_price(i.id))
    from public.ingredients i where i.id=p_ingredient
$$;
revoke all on function public.current_ingredient_unit_price(uuid) from public,anon,authenticated,service_role;
grant execute on function public.current_ingredient_unit_price(uuid) to margincook_rpc_executor;

-- Explicit consumer list: snapshots capture the current menu basis once; old
-- snapshots, day_unit_price historical fallback, waste/stock valuation stay intact.
do $readers$
declare sig text; d text;
begin
  foreach sig in array array[
    'public.add_to_day_basis(uuid,date,uuid,boolean)',
    'public.build_day_snapshot(uuid,date)',
    'public.ingredient_detail(uuid)',
    'public.recipe_material_cost(uuid,integer)',
    'public.recipe_detail(uuid)',
    'public.recipe_snapshot_entry(uuid,date)'
  ] loop
    d:=pg_get_functiondef(sig::regprocedure);
    if position('base_unit_price(' in d)=0 then raise exception '0214 missing reader anchor: %',sig; end if;
    execute replace(d,'base_unit_price(','current_ingredient_unit_price(');
  end loop;
  -- Resolve existing overload-free facades by catalog to preserve their exact
  -- arguments/defaults and ownership; each must contain a priced reader.
  foreach sig in array array['ingredient_list','recipe_list','recipe_draft_preview_internal','recipe_price_simulation'] loop
    select pg_get_functiondef(p.oid) into strict d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=sig and p.prokind='f';
    if position('base_unit_price(' in d)=0 then raise exception '0214 missing reader anchor: %',sig; end if;
    execute replace(d,'base_unit_price(','current_ingredient_unit_price(');
  end loop;
  select pg_get_functiondef(p.oid) into strict d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='quick_inbound_preview' and p.prokind='f';
  if position('''base_price_before'', base_unit_price(p_ingredient)' in d)=0 then raise exception '0214 preview anchor'; end if;
  execute replace(d,'''base_price_before'', base_unit_price(p_ingredient)',
    '''base_price_before'', current_ingredient_unit_price(p_ingredient)');
end $readers$;

do $writer$
declare d text; a text; b text;
begin
  d:=replace(pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure),chr(13),'');
  d:=replace(d,'base_unit_price(','current_ingredient_unit_price(');
  a:='  v_new       boolean;';
  b:=a||E'\n  v_after ingredients; v_costs jsonb; v_corr uuid:=gen_random_uuid(); rec record;\n  v_old numeric; v_new_cost numeric; v_net numeric; v_extra numeric; v_fixed numeric; v_day date;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0214 declaration'; end if;
  d:=replace(d,a,b);
  a:='    v_price0 := current_ingredient_unit_price(v_id);';
  b:=a||$sql$
    select coalesce(jsonb_object_agg(x.recipe_id::text,public.recipe_material_cost(x.recipe_id)),'{}'::jsonb)
      into v_costs from (select distinct recipe_id from public.recipe_lines
        where ingredient_id=v_id and store_id=p_store) x;
$sql$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0214 before'; end if;
  d:=replace(d,a,b);
  a:='  -- 안전재고·개당용량이 바뀌면 발주 후보 판정도 바뀐다.';
  b:=$sql$
  select * into v_after from public.ingredients where id=v_id and store_id=p_store;
  if v_new or row(v_before.purchase_price,v_before.per_volume)
      is distinct from row(v_after.purchase_price,v_after.per_volume) then
    update public.ingredients set menu_unit_price_override=purchase_price/nullif(per_volume,0)
      where id=v_id and store_id=p_store;
  end if;
  v_day:=public.store_local_date(p_store);
$sql$||a;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0214 after'; end if;
  d:=replace(d,a,b);
  a:='      v_ch, v_price0 is distinct from v_price1);';
  b:='      v_ch, v_price0 is distinct from v_price1, null, v_corr);';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0214 correlation'; end if;
  d:=replace(d,a,b);
  a:=E'\n\n  return v_id;';
  b:=$sql$

  if not v_new and v_price0 is distinct from v_price1 then
    if v_price1 is not null then
      insert into public.price_trends(store_id,ingredient_id,trend_date,unit_price)
        values(p_store,v_id,v_day,v_price1);
    end if;
    v_fixed:=coalesce(public.fixed_cost_rate(p_store,public.store_local_month(p_store)),0);
    for rec in select r.id,r.price,r.active from public.recipes r where r.store_id=p_store
      and exists(select 1 from public.recipe_lines l where l.recipe_id=r.id and l.ingredient_id=v_id) loop
      v_old:=(v_costs->>rec.id::text)::numeric;
      v_new_cost:=public.recipe_material_cost(rec.id);
      v_net:=coalesce((public.recipe_tax_quote_for_price(rec.id,v_day,rec.price)->>'net_sales')::numeric,
        (select price-public.tax_of(price,tax_mode,tax_items) from public.recipes where id=rec.id));
      select coalesce(sum(amount_per_serving),0) into v_extra from public.recipe_extra_costs where recipe_id=rec.id;
      if rec.active and v_old is distinct from v_new_cost then
        perform public.recompute_recipe(rec.id,'material',v_day,v_id);
      end if;
      perform public.record_entity_change(p_store,'recipe',rec.id,'ingredient','식재료 단가 반영',
        public.change_line('material_cost','식재료비',v_old,v_new_cost,'원','derived')
        ||public.change_line('profit','순이익',v_net-v_old-v_extra-v_fixed*rec.price,
          v_net-v_new_cost-v_extra-v_fixed*rec.price,'원','derived'),
        true,v_id,v_corr,v_after.name||' 구매 가격·용량 변경');
    end loop;
  end if;

  return v_id;
$sql$;
  a:=replace(a,chr(13),''); b:=replace(b,chr(13),'');
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0214 propagation'; end if;
  execute replace(d,a,b);
end $writer$;

do $inbound$
declare sig text; d text; a text; b text;
begin
  foreach sig in array array[
    'public.e1_confirm_inbound(uuid,numeric,text,date)',
    'public.e11_inbound_reverted(uuid,text)'
  ] loop
    d:=replace(pg_get_functiondef(sig::regprocedure),chr(13),'');
    -- Both the before value and idempotent returns reflect current menu cost.
    d:=replace(d,'base_unit_price(','current_ingredient_unit_price(');
    a:='  v_unit := current_ingredient_unit_price(o.ingredient_id);';
    b:=$sql$  update public.ingredients set menu_unit_price_override=null
    where id=o.ingredient_id and store_id=o.store_id and menu_unit_price_override is not null;
$sql$||a;
    if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0214 inbound reset: %',sig; end if;
    d:=replace(d,a,replace(b,chr(13),''));
    -- A duplicate/no-op returns above the reset. A successful inbound/cancel
    -- keeps the existing ledger path, correlation and frozen-business handling.
    execute d;
  end loop;
end $inbound$;
comment on column public.ingredients.menu_unit_price_override is
  'Current menu unit cost from explicit purchase price/capacity edit; cleared by next successful inbound/cancellation. Not inventory valuation.';
select public.assert_no_rpc_overloads();
commit;
