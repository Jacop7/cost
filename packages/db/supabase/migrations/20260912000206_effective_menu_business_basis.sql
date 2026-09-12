-- Saved configuration remains editable. Current menu financial readers hold the opening
-- basis until the active day closes. Stock, stop-selling, and dated ledgers stay live/dated.
begin;

-- An overnight active day must not skip today's unopened business date. Its own
-- frozen snapshot still owns sales until close; the next opening uses the new profile.
create or replace function public.next_unopened_business_date(p_store uuid)
returns date language plpgsql stable set search_path=pg_catalog,public as $$
declare v_date date:=public.store_local_date(p_store);
begin
  while exists(select 1 from public.business_days where store_id=p_store and business_date=v_date) loop
    v_date:=v_date+1;
  end loop;
  return v_date;
end $$;

create function public.active_menu_business_basis(p_recipe uuid)
returns jsonb language sql stable set search_path=pg_catalog,public as $$
  select (d.snapshot#>array['recipes',r.id::text]) || jsonb_build_object(
    'business_date',d.business_date,'business_day_id',d.id,
    'fixed_rate',d.snapshot->'fixed_rate','fixed_items',coalesce(d.snapshot->'fixed_items','[]'),
    'fixed_revenue',d.snapshot->'fixed_revenue','fixed_total',d.snapshot->'fixed_total')
  from public.recipes r join public.business_days d on d.store_id=r.store_id
  where r.id=p_recipe and d.status in ('open','break')
    and jsonb_typeof(d.snapshot#>array['recipes',r.id::text])='object'
  order by d.business_date desc limit 1
$$;
revoke all on function public.active_menu_business_basis(uuid) from public,anon,authenticated,service_role;
grant execute on function public.active_menu_business_basis(uuid) to margincook_rpc_executor;

create function public.with_effective_menu_detail(p_detail jsonb)
returns jsonb language plpgsql stable set search_path=pg_catalog,public as $$
declare b jsonb; v jsonb; lines jsonb; extras jsonb;
begin
  if p_detail is null then return null; end if;
  b:=public.active_menu_business_basis((p_detail->>'id')::uuid);
  if b is null then return p_detail||jsonb_build_object('application_mode','immediate'); end if;
  select coalesce(jsonb_agg(x||jsonb_build_object(
    'id',coalesce(x->>'id',x->>'ingredient_id'),'input_qty',(x->>'per_serving')::numeric*(b->>'base_servings')::numeric,
    'stock_total',public.stock_total_base((x->>'ingredient_id')::uuid),
    'safety_stock',i.safety_stock,'soon_out',coalesce(inv.soon_out,false)) order by x->>'name'),'[]') into lines
    from jsonb_array_elements(b->'lines') x
    left join public.ingredients i on i.id=(x->>'ingredient_id')::uuid
    left join public.inventory_states inv on inv.ingredient_id=i.id;
  select coalesce(jsonb_agg(x||jsonb_build_object('id',coalesce(x->>'id','basis-'||n::text)) order by n),'[]') into extras
    from jsonb_array_elements(b->'extras') with ordinality e(x,n);
  v:=p_detail||jsonb_build_object('price',b->'price','base_servings',b->'base_servings',
    'target_profit_rate',coalesce(b->'target_profit_rate',p_detail->'target_profit_rate'),
    'material_cost',b->'material_cost','extra_cost',b->'extra_cost',
    'tax',b->'tax','tax_mode',b->'tax_mode','tax_items',b->'tax_items',
    'tax_breakdown',public.tax_breakdown((b->>'price')::numeric,(b->>'tax_mode')::public.tax_mode,b->'tax_items'),
    'fixed_rate',b->'fixed_rate','fixed_items',b->'fixed_items',
    'fixed_month',left(b->>'business_date',7),'lines',lines,'extras',extras,
    'application_mode','after_close');
  return p_detail||jsonb_build_object('application_mode','after_close','effective',v);
end $$;
revoke all on function public.with_effective_menu_detail(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.with_effective_menu_detail(jsonb) to margincook_rpc_executor;

-- Add metadata only to snapshots created in the future; never rewrite an existing ledger.
do $patch$
declare s text;
begin
  s:=pg_get_functiondef('public.recipe_snapshot_entry(uuid,date)'::regprocedure);
  s:=replace(s,'''base_servings'',r.base_servings,','''base_servings'',r.base_servings,''target_profit_rate'',r.target_profit_rate,');
  s:=replace(s,'''name'',ec.name,''qty'',ec.qty,','''id'',ec.id,''material_id'',ec.material_id,''name'',ec.name,''qty'',ec.qty,');
  execute s;
  s:=pg_get_functiondef('public.build_day_snapshot(uuid,date)'::regprocedure);
  s:=replace(s,'''taken_at'',now(),','''taken_at'',now(),
    ''fixed_revenue'',(select total_revenue from public.fixed_costs_monthly where store_id=p_store and month=to_char(p_date,''YYYY-MM'')),
    ''fixed_total'',(select sum((x->>''total'')::numeric) from public.fixed_costs_monthly f cross join lateral jsonb_array_elements(f.items) x where f.store_id=p_store and f.month=to_char(p_date,''YYYY-MM'')),
    ''materials'',coalesce((select jsonb_object_agg(id::text,jsonb_build_object(''unit_cost'',unit_cost)) from public.materials where store_id=p_store),''{}''::jsonb),');
  execute s;
  s:=pg_get_functiondef('public.recipe_detail(uuid)'::regprocedure);
  if position('  select jsonb_build_object(' in s)=0 or position('  from recipes r' in s)=0 then raise exception 'effective detail anchor missing'; end if;
  s:=replace(s,E'  select jsonb_build_object(\n    ''id''',E'  select public.with_effective_menu_detail(jsonb_build_object(\n    ''id''');
  s:=replace(s,E'  )\n  from recipes r',E'  ))\n  from recipes r');
  execute s;
end $patch$;

create or replace function public.current_recipe_tax_quote(p_recipe uuid,p_date date)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select case when not (public.app_capabilities()#>>'{international_tax,read_enabled}')::boolean then null
    when b.value is not null and p_date in (public.store_local_date(r.store_id),(b.value->>'business_date')::date)
    then nullif(b.value->'tax_quote','null'::jsonb)
    else public.recipe_tax_quote_for_price(r.id,
      case when p_date=public.store_local_date(r.store_id) then public.current_tax_settings_date(r.store_id) else p_date end,r.price) end
  from public.recipes r left join lateral (select public.active_menu_business_basis(r.id) value) b on true
  where r.id=p_recipe
$$;

-- Every list amount uses the same effective detail; edit_revision, availability and stock stay live.
create or replace function public.recipe_list(p_store uuid)
returns table(id uuid,name text,price numeric,tax_mode public.tax_mode,base_servings integer,target_profit_rate numeric,
  avg_monthly_sales numeric,active boolean,category_id uuid,category_name text,material_cost numeric,extra_cost numeric,
  tax numeric,fixed_cost numeric,profit numeric,profit_rate numeric,material_rate numeric,unknown_cost_lines integer,blocked_by text,edit_revision text)
language sql stable security definer set search_path=public,pg_temp as $$
  with basis as (
    select r.*,c.name cat_name,public.active_menu_business_basis(r.id) b,
      public.current_recipe_tax_quote(r.id,public.store_local_date(r.store_id)) q
    from public.recipes r left join public.categories c on c.id=r.category_id where r.store_id=p_store
  ), amounts as (
    select b.*,
      case when b.b is null then b.price else (b.b->>'price')::numeric end pr,
      case when b.b is null then public.recipe_material_cost(b.id) else (b.b->>'material_cost')::numeric end mat,
      case when b.b is null then coalesce((select sum(amount_per_serving) from public.recipe_extra_costs where recipe_id=b.id),0) else (b.b->>'extra_cost')::numeric end ext,
      case when b.b is null then coalesce(public.fixed_cost_rate(b.store_id,public.store_local_month(b.store_id)),0) else (b.b->>'fixed_rate')::numeric end rate,
      coalesce((b.q->>'tax_total')::numeric,(b.b->>'tax')::numeric,public.tax_of(b.price,b.tax_mode,b.tax_items)) tx
    from basis b
  )
  select a.id,a.name,a.pr,coalesce((a.b->>'tax_mode')::public.tax_mode,a.tax_mode),coalesce((a.b->>'base_servings')::integer,a.base_servings),
    coalesce((a.b->>'target_profit_rate')::numeric,a.target_profit_rate),a.avg_monthly_sales,coalesce(a.active,true),
    a.category_id,a.cat_name,a.mat,a.ext,a.tx,a.rate*a.pr,
    coalesce((a.q->>'net_sales')::numeric,a.pr-a.tx)-a.mat-a.ext-a.rate*a.pr,
    case when a.pr>0 then (coalesce((a.q->>'net_sales')::numeric,a.pr-a.tx)-a.mat-a.ext-a.rate*a.pr)/a.pr else 0 end,
    case when a.pr>0 then a.mat/a.pr else 0 end,
    case when a.b is null then (select count(*)::int from public.recipe_lines l where l.recipe_id=a.id and l.ingredient_id is not null and public.base_unit_price(l.ingredient_id) is null)
      else (select count(*)::int from jsonb_array_elements(a.b->'lines') l where nullif(l->'unit_price','null'::jsonb) is null) end,
    public.recipe_blocked_by(a.id),a.edit_revision::text
  from amounts a order by coalesce(a.active,true) desc,a.name
$$;

do $patch$
declare s text;
begin
  s:=pg_get_functiondef('public.current_tax_settings_date(uuid)'::regprocedure);
  s:=replace(s,'where store_id=p_store and business_date=d and status=''closed''','where store_id=p_store and status=''closed''');
  s:=replace(s,'if exists(select 1 from public.business_days where store_id=p_store and status in (''open'',''break'')) then return d; end if;',
    'if exists(select 1 from public.business_days where store_id=p_store and status in (''open'',''break'')) then return (select business_date from public.business_days where store_id=p_store and status in (''open'',''break'') order by business_date desc limit 1); end if;');
  execute s;
  s:=pg_get_functiondef('public.record_configuration_change(uuid,text,text,jsonb,jsonb,date)'::regprocedure);
  execute replace(s,'p_source=''fixed_cost'' or not exists','not exists');
  s:=pg_get_functiondef('public.recipe_price_recommendation(uuid,uuid)'::regprocedure);
  s:=replace(s,'body jsonb;','body jsonb; b jsonb;');
  s:=replace(s,' return public.recipe_draft_preview(p_store,body);',
    ' b:=public.active_menu_business_basis(p_recipe);
 if b is not null then body:=body||jsonb_build_object(''price'',b->''price'',''base_servings'',b->''base_servings'',
   ''target_profit_rate'',coalesce(b->''target_profit_rate'',body->''target_profit_rate''),
   ''lines'',coalesce((select jsonb_agg(jsonb_build_object(''ingredient_id'',x->''ingredient_id'',''input_qty'',(x->>''per_serving'')::numeric*(b->>''base_servings'')::numeric)) from jsonb_array_elements(b->''lines'') x),''[]''),
   ''extras'',coalesce((select jsonb_agg(jsonb_build_object(''material_id'',null,''qty'',coalesce(x->''qty'',''0''),''amount'',x->''amount'')) from jsonb_array_elements(b->''extras'') x),''[]'')); end if;
 return public.recipe_draft_preview(p_store,body);');
  execute s;
  s:=pg_get_functiondef('public.recipe_draft_preview_internal(uuid,jsonb)'::regprocedure);
  s:=replace(s,'declare settings_date date;','declare settings_date date; active_snapshot jsonb; basis_date date;');
  s:=replace(s,' material numeric:=0;',' material numeric:=0;');
  s:=replace(s,' foreach mode in array array[''lines'',''extras''] loop',
    ' select snapshot,business_date into active_snapshot,basis_date from public.business_days where store_id=p_store and status in (''open'',''break'') order by business_date desc limit 1;
 foreach mode in array array[''lines'',''extras''] loop');
  s:=replace(s,'unit_price:=public.base_unit_price((x->>''ingredient_id'')::uuid);',
    'unit_price:=case when active_snapshot->''ingredients'' ? (x->>''ingredient_id'') then (active_snapshot#>>array[''ingredients'',x->>''ingredient_id'',''unit_price''])::numeric else public.base_unit_price((x->>''ingredient_id'')::uuid) end;');
  s:=replace(s,'if qty>0 and unit_price is null then missing_extra:=',
    'if active_snapshot is not null and not(active_snapshot ? ''materials'') then unit_price:=null;
         elsif active_snapshot->''materials'' ? (x->>''material_id'') then unit_price:=(active_snapshot#>>array[''materials'',x->>''material_id'',''unit_cost''])::numeric; end if;
         if qty>0 and unit_price is null then missing_extra:=');
  s:=replace(s,' fixed:=rate*price;',
    ' if active_snapshot is not null then rate:=(active_snapshot->>''fixed_rate'')::numeric; revenue:=(active_snapshot->>''fixed_revenue'')::numeric; fixed_total:=(active_snapshot->>''fixed_total'')::numeric; end if;
 fixed:=rate*price;');
  s:=replace(s,'''fixed_month'',to_char(d,''YYYY-MM'')','''fixed_month'',to_char(coalesce(basis_date,d),''YYYY-MM'')');
  execute s;
  s:=pg_get_functiondef('public.recipe_price_simulation(uuid,uuid,numeric)'::regprocedure);
  s:=replace(s,'declare settings_date date;','declare settings_date date; b jsonb;');
  s:=replace(s,'  d:=public.store_local_date(p_store);',
    '  b:=public.active_menu_business_basis(p_recipe);
  if b is not null then r.base_servings:=(b->>''base_servings'')::integer; r.target_profit_rate:=coalesce((b->>''target_profit_rate'')::numeric,r.target_profit_rate); end if;
  d:=public.store_local_date(p_store);');
  s:=replace(s,'  fixed:=rate*p_price;',
    '  if b is not null then material:=(b->>''material_cost'')::numeric; extra:=(b->>''extra_cost'')::numeric; rate:=(b->>''fixed_rate'')::numeric;
    select coalesce(jsonb_agg(x->''ingredient_id''),''[]'') into missing from jsonb_array_elements(b->''lines'') x where nullif(x->''unit_price'',''null''::jsonb) is null;
    if jsonb_array_length(missing)>0 then material:=null; end if;
    revenue:=(b->>''fixed_revenue'')::numeric; fixed_total:=(b->>''fixed_total'')::numeric;
  end if;
  fixed:=rate*p_price;');
  s:=replace(s,'''fixed_month'',to_char(d,''YYYY-MM'')','''fixed_month'',coalesce(left(b->>''business_date'',7),to_char(d,''YYYY-MM''))');
  execute s;
end $patch$;

-- Financial trend entries are created when the new basis becomes effective, not while waiting.
do $lock$
declare sig text; s text;
begin
  foreach sig in array array['public.save_fixed_costs(uuid,text,numeric,jsonb)','public.save_ingredient(uuid,jsonb)',
    'public.quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,date,text)'] loop
    s:=pg_get_functiondef(sig::regprocedure);
    if position('perform assert_my_store(p_store);' in s)=0 then raise exception 'business lock anchor missing %',sig; end if;
    execute replace(s,'perform assert_my_store(p_store);','perform assert_my_store(p_store); perform public.lock_business_scope(p_store);');
  end loop;
  foreach sig in array array['public.e1_confirm_inbound(uuid,numeric,text,date)','public.e11_inbound_reverted(uuid,text)'] loop
    s:=pg_get_functiondef(sig::regprocedure);
    execute replace(s,'  select * into o from order_records where id = p_order for update;',
      '  perform public.lock_business_scope(store_id) from public.order_records where id=p_order;
  select * into o from order_records where id = p_order for update;');
  end loop;
  s:=pg_get_functiondef('public.revert_latest_stock_event(uuid)'::regprocedure);
  execute replace(s,'  -- Match E1/E11 lock order:',
    '  perform public.lock_business_scope(ev.store_id);
  -- Match E1/E11 lock order:');
end $lock$;

do $patch$
declare s text;
begin
  s:=pg_get_functiondef('public.recompute_recipe(uuid,trend_cause,date,uuid)'::regprocedure);
  s:=replace(s,'  if not found then return; end if;',
    '  if not found then return; end if;
  if v_day=public.store_local_date(r.store_id) and public.active_menu_business_basis(p_recipe) is not null then return; end if;');
  execute s;
  s:=pg_get_functiondef('public.close_business_day_row(uuid,business_close_method)'::regprocedure);
  s:=replace(s,'  select * into v_day from business_days where id = p_day_id for update;',
    '  perform public.lock_business_scope(store_id) from public.business_days where id=p_day_id;
  select * into v_day from business_days where id = p_day_id for update;');
  s:=replace(s,'  v_at  timestamptz;','  v_at  timestamptz; menu_row record; old_basis jsonb; current_basis jsonb; tax_quote jsonb; new_fixed numeric;');
  s:=replace(s,'  perform record_state_transition(',
    '  for menu_row in select id from public.recipes where store_id=v_day.store_id loop
    old_basis:=v_day.snapshot#>array[''recipes'',menu_row.id::text];
    if old_basis is null then continue; end if;
    current_basis:=public.recipe_snapshot_entry(menu_row.id,public.store_local_date(v_day.store_id));
    tax_quote:=public.current_recipe_tax_quote(menu_row.id,public.store_local_date(v_day.store_id));
    current_basis:=current_basis||jsonb_build_object(''tax'',coalesce(tax_quote->''tax_total'',current_basis->''tax''));
    new_fixed:=coalesce(public.fixed_cost_rate(v_day.store_id,public.store_local_month(v_day.store_id)),0)*(current_basis->>''price'')::numeric;
    if row(current_basis->''price'',current_basis->''material_cost'',current_basis->''extra_cost'',current_basis->''tax'',new_fixed)
      is distinct from row(old_basis->''price'',old_basis->''material_cost'',old_basis->''extra_cost'',old_basis->''tax'',(v_day.snapshot->>''fixed_rate'')::numeric*(old_basis->>''price'')::numeric) then
      perform public.recompute_recipe(menu_row.id,
        case when current_basis->''price'' is distinct from old_basis->''price'' then ''recipe''::public.trend_cause
          when (select jsonb_agg(jsonb_build_array(x->''ingredient_id'',x->''per_serving'') order by x->>''ingredient_id'') from jsonb_array_elements(current_basis->''lines'') x)
            is distinct from (select jsonb_agg(jsonb_build_array(x->''ingredient_id'',x->''per_serving'') order by x->>''ingredient_id'') from jsonb_array_elements(old_basis->''lines'') x) then ''recipe''::public.trend_cause
          when current_basis->''material_cost'' is distinct from old_basis->''material_cost'' then ''material''::public.trend_cause
          when current_basis->''extra_cost'' is distinct from old_basis->''extra_cost'' then ''recipe''::public.trend_cause
          when current_basis->''tax'' is distinct from old_basis->''tax'' then ''tax''::public.trend_cause
          else ''fixed''::public.trend_cause end,
        public.store_local_date(v_day.store_id),null);
    end if;
  end loop;
  perform record_state_transition(');
  execute s;
end $patch$;

notify pgrst,'reload schema';
commit;
