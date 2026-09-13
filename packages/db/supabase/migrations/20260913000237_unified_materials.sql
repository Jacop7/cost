-- Retire the separate supplies feature. Historical snapshots and ledgers are immutable.
-- User decision: gas charges leave current menus; monthly fixed amounts are entered later.
begin;

do $$ declare s record; begin
  for s in select id from public.stores order by id loop
    perform public.lock_business_scope(s.id);
  end loop;
  if exists(select 1 from public.business_days where status in ('open','break')) then
    raise exception '재료 통합은 영업 종료 후 실행해야 합니다' using errcode='55000';
  end if;
  if exists(select 1 from public.materials m join public.ingredients i on i.id=m.id)
    or exists(select 1 from public.recipe_extra_costs e left join public.materials m on m.id=e.material_id
      join public.recipes r on r.id=e.recipe_id where m.id is null or e.qty<=0
      or e.store_id<>m.store_id or e.store_id<>r.store_id or e.amount_per_serving<>m.unit_cost*e.qty)
    or exists(select 1 from public.materials where name not in ('뚝배기 가스비','불판 가스비') and unit_label<>'개')
    or exists(select 1 from public.materials m join public.ingredients i
      on i.store_id=m.store_id and lower(btrim(i.name))=lower(btrim(m.name)) and i.active and m.active) then
    raise exception '재료 통합 사전 조건을 확인해 주세요' using errcode='22000';
  end if;
end $$;

alter table public.ingredients add column stock_tracking boolean not null default true;
alter table public.ingredients add column cost_scope text not null default 'production'
  check(cost_scope in ('production','sale_only'));
alter table public.daily_sales_items add column unit_waste_cost numeric
  check(unit_waste_cost >= 0);
create table public.material_retirement_archive (
  id uuid primary key, store_id uuid not null references public.stores(id) on delete cascade,
  source_material jsonb not null, source_extras jsonb not null,
  ingredient_id uuid references public.ingredients(id) on delete restrict,
  disposition text not null check(disposition in ('migrated','fixed_cost_manual')),
  archived_at timestamptz not null default clock_timestamp()
);
alter table public.material_retirement_archive enable row level security;
create policy material_retirement_archive_owner_read on public.material_retirement_archive for select
  to margincook_rpc_executor using(store_id in (select public.my_store_ids()));
revoke all on public.material_retirement_archive from public,anon,authenticated,service_role;
grant select on public.material_retirement_archive to margincook_rpc_executor;

create temporary table unified_cost_before on commit drop as
select r.id,public.recipe_material_cost(r.id)+coalesce(sum(e.amount_per_serving),0) total,
  coalesce(sum(e.amount_per_serving) filter(where m.name in ('뚝배기 가스비','불판 가스비')),0) gas
from public.recipes r left join public.recipe_extra_costs e on e.recipe_id=r.id
left join public.materials m on m.id=e.material_id group by r.id;

-- Category identity is mapped per store; names alone never merge material identities.
insert into public.categories(store_id,name,kind,sort_order)
select distinct c.store_id,c.name,'ingredient'::public.category_kind,c.sort_order from public.categories c
where c.kind='material' and not exists(select 1 from public.categories x
 where x.store_id=c.store_id and x.kind='ingredient' and lower(btrim(x.name))=lower(btrim(c.name)))
on conflict do nothing;

insert into public.ingredients(id,store_id,name,category_id,base_unit,per_volume,purchase_price,
  menu_unit_price_override,purchase_unit_label,memo,active,created_at,updated_at,stock_tracking)
select m.id,m.store_id,m.name,ic.id,'ea',1,m.unit_cost,m.unit_cost,m.unit_label,m.memo,m.active,
  m.created_at,m.updated_at,false from public.materials m
left join public.categories c on c.id=m.category_id
left join public.categories ic on ic.store_id=m.store_id and ic.kind='ingredient'
 and lower(btrim(ic.name))=lower(btrim(c.name))
where m.name not in ('뚝배기 가스비','불판 가스비');
update public.ingredients set cost_scope='sale_only'
where id in (select id from public.materials);

insert into public.material_retirement_archive(id,store_id,source_material,source_extras,ingredient_id,disposition)
select m.id,m.store_id,to_jsonb(m),coalesce((select jsonb_agg(to_jsonb(e) order by e.id)
 from public.recipe_extra_costs e where e.material_id=m.id),'[]'),
 case when m.name in ('뚝배기 가스비','불판 가스비') then null else m.id end,
 case when m.name in ('뚝배기 가스비','불판 가스비') then 'fixed_cost_manual' else 'migrated' end
from public.materials m;

insert into public.recipe_lines(id,store_id,recipe_id,ingredient_id,input_qty)
select e.id,e.store_id,e.recipe_id,a.ingredient_id,e.qty*r.base_servings
from public.recipe_extra_costs e join public.recipes r on r.id=e.recipe_id
join public.material_retirement_archive a on a.id=e.material_id and a.disposition='migrated';
update public.recipes set edit_revision=edit_revision+1
where id in (select recipe_id from public.recipe_extra_costs);
delete from public.recipe_extra_costs;

create view public.archived_recipe_extra_costs with (security_invoker=true) as
select (jsonb_populate_record(null::public.recipe_extra_costs,e)).*
from public.material_retirement_archive a cross join lateral jsonb_array_elements(a.source_extras) e;
revoke all on public.archived_recipe_extra_costs from public,anon,authenticated,service_role;
grant select on public.archived_recipe_extra_costs to margincook_rpc_executor;
do $patch$ declare sig text; d text; begin
  foreach sig in array array['public.sales_extra_usage(uuid,date,date)','public.range_menu_detail(uuid,date,date,uuid)'] loop
    d:=pg_get_functiondef(sig::regprocedure);
    if position('from recipe_extra_costs ec' in d)=0 then raise exception '0237 legacy extras anchor: %',sig; end if;
    execute replace(d,'from recipe_extra_costs ec','from public.archived_recipe_extra_costs ec');
  end loop;
end $patch$;

do $$ begin
  if exists(select 1 from unified_cost_before b where
    abs(public.recipe_material_cost(b.id)-(b.total-b.gas))>0.00000001) then
    raise exception '재료 이관 전후 메뉴 원가가 다릅니다';
  end if;
  if exists(select 1 from public.inventory_events e join public.material_retirement_archive a on a.ingredient_id=e.ingredient_id)
    or exists(select 1 from public.inventory_states e join public.material_retirement_archive a on a.ingredient_id=e.ingredient_id) then
    raise exception '이관 재료에 재고를 생성하면 안 됩니다';
  end if;
end $$;

-- New history captures tracking separately from monetary needs. Old rows default to tracked.
create function public.day_stock_needs(p_store uuid,p_date date,p_recipe uuid,p_servings numeric)
returns table(ingredient_id uuid,amount numeric) language sql stable set search_path=public,pg_temp as $$
  select (l->>'ingredient_id')::uuid,(l->>'per_serving')::numeric*p_servings
  from jsonb_array_elements(coalesce(public.day_recipe_snapshot(p_store,p_date,p_recipe)->'lines','[]')) l
  where coalesce((l->>'per_serving')::numeric,0)>0 and coalesce((l->>'stock_tracking')::boolean,true)
$$;
revoke all on function public.day_stock_needs(uuid,date,uuid,numeric) from public,anon,authenticated,service_role;
grant execute on function public.day_stock_needs(uuid,date,uuid,numeric) to margincook_rpc_executor;

do $patch$ declare sig text; d text; anchor text; begin
  foreach sig in array array['public.recipe_snapshot_entry(uuid,date)','public.build_day_snapshot(uuid,date)'] loop
    d:=pg_get_functiondef(sig::regprocedure);
    anchor:='''base_unit'',i.base_unit,';
    if position(anchor in d)=0 then raise exception '0237 snapshot anchor: %',sig; end if;
    d:=replace(d,anchor,anchor||'''stock_tracking'',i.stock_tracking,''cost_scope'',i.cost_scope,');
    if sig='public.recipe_snapshot_entry(uuid,date)' then
      anchor:='''material_cost'',public.recipe_material_cost(r.id),';
      if position(anchor in d)=0 then raise exception '0237 waste snapshot anchor'; end if;
      d:=replace(d,anchor,anchor||'''waste_material_cost'',(select coalesce(sum(n.amount*public.current_ingredient_unit_price(i.id)),0) from public.recipe_ingredient_needs(r.id,1) n join public.ingredients i on i.id=n.ingredient_id where i.cost_scope=''production''),');
    end if;
    execute d;
  end loop;
  foreach sig in array array['public.reconcile_sales_consumption(uuid,boolean)','public.sale_shortages(uuid,date,jsonb)'] loop
    d:=pg_get_functiondef(sig::regprocedure);
    if position('day_ingredient_needs(' in d)=0 then raise exception '0237 consumption anchor: %',sig; end if;
    execute replace(d,'day_ingredient_needs(','day_stock_needs(');
  end loop;
  foreach sig in array array['public.recipe_blocked_by(uuid)','public.recipe_shortages(uuid)'] loop
    d:=pg_get_functiondef(sig::regprocedure);
    anchor:='where n.amount > 0';
    if position(anchor in d)>0 then d:=replace(d,anchor,'where i.stock_tracking and n.amount > 0');
    else
      anchor:='and n.amount > 0';
      if position(anchor in d)=0 then raise exception '0237 shortages anchor: %',sig; end if;
      d:=replace(d,anchor,'and i.stock_tracking and n.amount > 0');
    end if;
    execute d;
  end loop;
  d:=pg_get_functiondef('public.refresh_order_candidate(uuid)'::regprocedure);
  anchor:='if not found then return; end if;';
  if position(anchor in d)=0 then raise exception '0237 candidate anchor'; end if;
  execute replace(d,anchor,anchor||E'\n  if not ing.stock_tracking then delete from public.order_candidates where ingredient_id=p_ingredient; return; end if;');
  d:=pg_get_functiondef('public.ingredient_detail(uuid)'::regprocedure);
  anchor:='''base_unit'', i.base_unit,';
  if position(anchor in d)=0 then raise exception '0237 detail anchor'; end if;
  execute replace(d,anchor,anchor||'''stock_tracking'',i.stock_tracking,');
end $patch$;

-- A migrated packaging charge still applies to sales, not to cooking waste.
-- Capture the day snapshot once; old sales retain their original material-cost fallback.
create function public.capture_sales_waste_cost() returns trigger language plpgsql
set search_path=public,pg_temp as $$ declare snap jsonb; begin
  select public.day_recipe_snapshot(d.store_id,d.sale_date,new.recipe_id) into snap
  from public.daily_sales d where d.id=new.daily_sales_id;
  new.unit_waste_cost:=coalesce((snap->>'waste_material_cost')::numeric,new.unit_material_cost);
  return new;
end $$;
revoke all on function public.capture_sales_waste_cost() from public,anon,authenticated,service_role;
create trigger daily_sales_items_capture_waste before insert on public.daily_sales_items
for each row execute function public.capture_sales_waste_cost();
do $patch$ declare sig text; d text; anchor text; begin
  foreach sig in array array['public.sales_summary(uuid,date,date)','public.range_menu_detail(uuid,date,date,uuid)'] loop
    d:=pg_get_functiondef(sig::regprocedure);
    anchor:='it.unit_material_cost * coalesce(it.qty_waste, 0)';
    if position(anchor in d)=0 then raise exception '0237 waste total anchor: %',sig; end if;
    execute replace(d,anchor,'coalesce(it.unit_waste_cost,it.unit_material_cost) * coalesce(it.qty_waste, 0)');
  end loop;
  d:=pg_get_functiondef('public.sales_waste_breakdown(uuid,date,date)'::regprocedure);
  anchor:='coalesce(it.unit_material_cost, 0) * coalesce(it.qty_waste, 0)';
  if position(anchor in d)=0 then raise exception '0237 waste breakdown anchor'; end if;
  execute replace(d,anchor,'coalesce(it.unit_waste_cost,it.unit_material_cost,0) * coalesce(it.qty_waste, 0)');
end $patch$;

-- Cost-only ingredients must not accidentally acquire a ledger through an old URL/RPC.
create function public.require_stock_tracking_write() returns trigger language plpgsql
set search_path=public,pg_temp as $$ begin
  if exists(select 1 from public.ingredients where id=new.ingredient_id and not stock_tracking) then
    raise exception '재고를 관리하지 않는 재료입니다' using errcode='55000',detail='STOCK_TRACKING_DISABLED';
  end if;
  return new;
end $$;
revoke all on function public.require_stock_tracking_write() from public,anon,authenticated,service_role;
create trigger inventory_states_tracking before insert or update on public.inventory_states
for each row execute function public.require_stock_tracking_write();
create trigger inventory_events_tracking before insert on public.inventory_events
for each row execute function public.require_stock_tracking_write();
create trigger order_records_tracking before insert or update on public.order_records
for each row execute function public.require_stock_tracking_write();

create function public.ingredient_list_v2(p_store uuid)
returns table(id uuid,name text,category_name text,base_unit public.base_unit,per_volume numeric,
 safety_stock numeric,vendor_name text,memo text,stock_total numeric,base_price numeric,soon_out boolean,
 last_inbound_at date,stock_tracking boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select l.*,i.stock_tracking from public.ingredient_list(p_store) l join public.ingredients i on i.id=l.id
$$;
grant create on schema public to margincook_rpc_executor;
alter function public.ingredient_list_v2(uuid) owner to margincook_rpc_executor;
revoke create on schema public from margincook_rpc_executor;
revoke all on function public.ingredient_list_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function public.ingredient_list_v2(uuid) to authenticated;

-- Retired APIs cannot recreate a hidden supplies list or restore stale menu extras.
do $patch$ declare sig text; d text; anchor text; begin
  d:=pg_get_functiondef('public.save_recipe(uuid,jsonb)'::regprocedure);
  anchor:='begin';
  if position(anchor in d)=0 then raise exception '0237 recipe writer anchor'; end if;
  d:=overlay(d placing anchor||E'\n  if jsonb_typeof(p_payload->''extras'')=''array'' and jsonb_array_length(p_payload->''extras'')>0 then raise exception ''부자재 기능이 재료로 통합됐어요. 메뉴를 다시 불러와 주세요.'' using errcode=''45009''; end if;'
    from position(anchor in d) for length(anchor));
  execute d;
  d:=pg_get_functiondef('public.settings_lists(uuid)'::regprocedure);
  -- Keep historical tables readable internally, but remove current feature entries.
  d:=replace(d,'c.kind = ''material''','c.kind = ''material'' and false');
  d:=replace(d,'m.store_id = p_store and m.active','m.store_id = p_store and m.active and false');
  execute d;
  d:=pg_get_functiondef('public.save_category(uuid,jsonb)'::regprocedure);
  anchor:='begin';
  if position(anchor in d)=0 then raise exception '0237 category anchor'; end if;
  execute overlay(d placing anchor||E'\n  if p_payload->>''kind''=''material'' then raise exception ''부자재 카테고리는 재료로 통합됐어요'' using errcode=''55000''; end if;'
    from position(anchor in d) for length(anchor));
  for sig in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('save_material','deactivate_material') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',sig);
  end loop;
end $patch$;
revoke all on public.materials from public,anon,authenticated,service_role;

-- Registration may select cost-only mode. Changing an existing mode requires a later
-- explicit transition contract; never reinterpret historical consumption here.
do $patch$ declare d text; anchor text; replacement text; begin
  d:=pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure);
  anchor:='  if p_payload->>''contract_version''=''3'' then';
  if position(anchor in d)=0 then raise exception '0237 ingredient validation anchor'; end if;
  replacement:=E'  if not v_new and p_payload ? ''stock_tracking'' and (p_payload->>''stock_tracking'')::boolean is distinct from v_before.stock_tracking then raise exception ''재고 관리 방식은 현재 변경할 수 없어요'' using errcode=''55000''; end if;\n'||anchor;
  d:=replace(d,anchor,replacement);
  anchor:='memo, purchase_price, active';
  if position(anchor in d)=0 then raise exception '0237 ingredient insert anchor'; end if;
  d:=replace(d,anchor,'memo, purchase_price, active, stock_tracking');
  anchor:='true'||E'\n    ) returning id into v_id;';
  if position(anchor in d)=0 then raise exception '0237 ingredient values anchor'; end if;
  d:=replace(d,anchor,'true, coalesce((p_payload->>''stock_tracking'')::boolean,true)'||E'\n    ) returning id into v_id;');
  execute d;
end $patch$;

notify pgrst,'reload schema';
commit;
