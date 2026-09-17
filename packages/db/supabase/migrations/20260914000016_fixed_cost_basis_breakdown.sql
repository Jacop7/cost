-- 0016: completed-month fixed-cost basis must carry one coherent breakdown.
--
-- 0015 changed the authoritative rate from the target month's row to the
-- preceding 1-3 completed months.  Older readers still paired that rate with
-- the target month's items/revenue, which could make every displayed row
-- disagree with the authoritative total.  Aggregate the same completed-month
-- rows for the rate, average amounts and item proportions, and freeze that
-- bundle in new business-day snapshots.
begin;

create or replace function public.fixed_cost_basis_result(p_store uuid, p_month text)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_basis int;
  v_result jsonb;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or to_char(to_date(p_month || '-01','YYYY-MM-DD'),'YYYY-MM') <> p_month then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode='22000';
  end if;
  select fixed_cost_basis_months into v_basis from public.settings where store_id=p_store;
  if v_basis is null then v_basis:=3; end if;

  with wanted as (
    select g as position,
      to_char(to_date(p_month || '-01','YYYY-MM-DD') - make_interval(months=>g),'YYYY-MM') as month
    from generate_series(1,v_basis) g
  ), monthly as (
    select w.position,w.month,f.total_revenue,f.items,
      f.id is not null and f.total_revenue>0 as entered,
      case when f.id is null then null else coalesce((select sum((i->>'total')::numeric)
        from jsonb_array_elements(f.items) i),0) end as total_fixed
    from wanted w left join public.fixed_costs_monthly f on f.store_id=p_store and f.month=w.month
  ), item_totals as (
    select i->>'key' as key,sum((i->>'total')::numeric) as total
    from monthly m cross join lateral jsonb_array_elements(case when m.entered then m.items else '[]'::jsonb end) i
    group by i->>'key'
  ), aggregate as (
    select count(*) filter(where entered)::int entered_months,
      bool_and(entered) applied,
      min(month) from_month,max(month) to_month,
      coalesce(jsonb_agg(month order by position) filter(where not entered),'[]'::jsonb) missing_months,
      sum(total_revenue) filter(where entered) revenue_sum,
      sum(total_fixed) filter(where entered) fixed_sum,
      jsonb_agg(jsonb_build_object(
        'month',month,'entered',entered,'total_revenue',case when entered then total_revenue else null end,
        'total_fixed',case when entered then total_fixed else null end,
        'rate',case when entered then total_fixed/total_revenue else null end,
        'items',case when entered then items else '[]'::jsonb end
      ) order by position) months
    from monthly
  )
  select jsonb_build_object(
    'target_month',p_month,'basis_months',v_basis,'from_month',from_month,'to_month',to_month,
    'entered_months',entered_months,'missing_months',missing_months,'applied',applied,
    'rate',case when applied then fixed_sum/revenue_sum else null end,
    'average_revenue',case when applied then revenue_sum/v_basis else null end,
    'average_fixed',case when applied then fixed_sum/v_basis else null end,
    'items',case when applied then coalesce((select jsonb_agg(
      jsonb_build_object('key',key,'total',total/v_basis) order by key) from item_totals),'[]'::jsonb)
      else '[]'::jsonb end,
    'revision',coalesce((select revision from public.settings where store_id=p_store),1),
    'months',months
  ) into v_result from aggregate;
  return v_result;
end;
$$;

-- New snapshots freeze the exact rate denominator, numerator and item mix.
create or replace function public.build_day_snapshot(p_store uuid,p_date date)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'taken_at',now(),
    'fixed_basis',fb.value,
    'fixed_revenue',(fb.value->>'average_revenue')::numeric,
    'fixed_total',(fb.value->>'average_fixed')::numeric,
    'materials',coalesce((select jsonb_object_agg(id::text,jsonb_build_object('unit_cost',unit_cost)) from public.materials where store_id=p_store),'{}'::jsonb),
    'fixed_rate',coalesce((fb.value->>'rate')::numeric,0),
    'fixed_items',coalesce(fb.value->'items','[]'::jsonb),
    'etc_tax_rate',public.store_tax_rate(p_store),
    'ingredients',coalesce((select jsonb_object_agg(i.id::text,jsonb_build_object(
      'name',i.name,'base_unit',i.base_unit,'stock_tracking',i.stock_tracking,'cost_scope',i.cost_scope,'unit_price',public.current_ingredient_unit_price(i.id)))
      from public.ingredients i where i.store_id=p_store),'{}'::jsonb),
    'recipes',coalesce((select jsonb_object_agg(r.id::text,
      public.recipe_snapshot_entry(r.id,p_date)) from public.recipes r
      where r.store_id=p_store and r.active),'{}'::jsonb))
  from lateral (select public.fixed_cost_basis_result(p_store,to_char(p_date,'YYYY-MM')) value) fb
$$;

create or replace function public.active_menu_business_basis(p_recipe uuid)
returns jsonb language sql stable set search_path=pg_catalog,public as $$
  select (d.snapshot#>array['recipes',r.id::text]) || jsonb_build_object(
    'business_date',d.business_date,'business_day_id',d.id,
    'fixed_rate',d.snapshot->'fixed_rate','fixed_items',coalesce(d.snapshot->'fixed_items','[]'),
    'fixed_revenue',d.snapshot->'fixed_revenue','fixed_total',d.snapshot->'fixed_total',
    'fixed_basis',d.snapshot->'fixed_basis')
  from public.recipes r join public.business_days d on d.store_id=r.store_id
  where r.id=p_recipe and d.status in ('open','break')
    and jsonb_typeof(d.snapshot#>array['recipes',r.id::text])='object'
  order by d.business_date desc limit 1
$$;

-- Current detail uses the current completed-month basis.  During an open day,
-- the effective branch continues to use the frozen opening snapshot.
create or replace function public.with_effective_menu_detail(p_detail jsonb)
returns jsonb language plpgsql stable set search_path=pg_catalog,public as $$
declare
  b jsonb; v jsonb; lines jsonb; extras jsonb; current_basis jsonb; current_detail jsonb;
  v_store uuid; v_month text;
begin
  if p_detail is null then return null; end if;
  select r.store_id,public.store_local_month(r.store_id) into v_store,v_month
    from public.recipes r where r.id=(p_detail->>'id')::uuid;
  current_basis:=public.fixed_cost_basis_result(v_store,v_month);
  current_detail:=p_detail||jsonb_build_object(
    'fixed_rate',coalesce((current_basis->>'rate')::numeric,0),
    'fixed_month',v_month,
    'fixed_items',coalesce(current_basis->'items','[]'::jsonb),
    'fixed_revenue',current_basis->'average_revenue',
    'fixed_total',current_basis->'average_fixed',
    'fixed_basis',current_basis);

  b:=public.active_menu_business_basis((p_detail->>'id')::uuid);
  if b is null then return current_detail||jsonb_build_object('application_mode','immediate'); end if;
  select coalesce(jsonb_agg(x||jsonb_build_object(
    'id',coalesce(x->>'id',x->>'ingredient_id'),'input_qty',(x->>'per_serving')::numeric*(b->>'base_servings')::numeric,
    'stock_total',public.stock_total_base((x->>'ingredient_id')::uuid),
    'safety_stock',i.safety_stock,'soon_out',coalesce(inv.soon_out,false)) order by x->>'name'),'[]') into lines
    from jsonb_array_elements(b->'lines') x
    left join public.ingredients i on i.id=(x->>'ingredient_id')::uuid
    left join public.inventory_states inv on inv.ingredient_id=i.id;
  select coalesce(jsonb_agg(x||jsonb_build_object('id',coalesce(x->>'id','basis-'||n::text)) order by n),'[]') into extras
    from jsonb_array_elements(b->'extras') with ordinality e(x,n);
  v:=current_detail||jsonb_build_object('price',b->'price','base_servings',b->'base_servings',
    'target_profit_rate',coalesce(b->'target_profit_rate',p_detail->'target_profit_rate'),
    'material_cost',b->'material_cost','extra_cost',b->'extra_cost',
    'tax',b->'tax','tax_mode',b->'tax_mode','tax_items',b->'tax_items',
    'tax_breakdown',public.tax_breakdown((b->>'price')::numeric,(b->>'tax_mode')::public.tax_mode,b->'tax_items'),
    'fixed_rate',b->'fixed_rate','fixed_items',coalesce(b->'fixed_items','[]'::jsonb),
    'fixed_revenue',b->'fixed_revenue','fixed_total',b->'fixed_total','fixed_basis',b->'fixed_basis',
    'fixed_month',left(b->>'business_date',7),'lines',lines,'extras',extras,
    'application_mode','after_close');
  return current_detail||jsonb_build_object('application_mode','after_close','effective',v);
end $$;

-- Historical readers without a snapshot use the item bundle from the same
-- target month selected by day_fixed_rate's fallback.
create or replace function public.day_fixed_items(p_store uuid,p_date date)
returns jsonb language plpgsql stable security invoker as $$
declare v_snapshot jsonb; v_month text; v_candidate text;
begin
  v_snapshot:=public.day_snapshot(p_store,p_date);
  if v_snapshot ? 'fixed_items' then return coalesce(v_snapshot->'fixed_items','[]'::jsonb); end if;
  v_month:=to_char(p_date,'YYYY-MM');
  if public.fixed_cost_rate(p_store,v_month) is not null then
    return coalesce(public.fixed_cost_basis_result(p_store,v_month)->'items','[]'::jsonb);
  end if;
  select f.month into v_candidate from public.fixed_costs_monthly f
   where f.store_id=p_store and f.month<=v_month
     and public.fixed_cost_rate(p_store,f.month) is not null
   order by f.month desc limit 1;
  return coalesce(public.fixed_cost_basis_result(p_store,v_candidate)->'items','[]'::jsonb);
end $$;

-- Add the coherent item bundle to both preview contracts and replace their
-- old target-month revenue/item reads with the completed-month basis.
do $patch$
declare d text; a text; z text;
begin
  d:=replace(pg_get_functiondef('public.recipe_price_simulation(uuid,uuid,numeric)'::regprocedure),chr(13),'');
  a:='declare settings_date date; b jsonb;';
  z:='declare settings_date date; b jsonb; fixed_basis jsonb; fixed_items jsonb;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0016 price declaration anchor'; end if;
  d:=replace(d,a,z);
  a:=$old$  rate:=public.fixed_cost_rate(p_store,to_char(d,'YYYY-MM'));
  select f.total_revenue,coalesce((select sum((x->>'total')::numeric) from jsonb_array_elements(f.items) x),0)
    into revenue,fixed_total from public.fixed_costs_monthly f where f.store_id=p_store and f.month=to_char(d,'YYYY-MM');$old$;
  z:=$new$  fixed_basis:=public.fixed_cost_basis_result(p_store,to_char(d,'YYYY-MM'));
  rate:=(fixed_basis->>'rate')::numeric;
  revenue:=(fixed_basis->>'average_revenue')::numeric;
  fixed_total:=(fixed_basis->>'average_fixed')::numeric;
  fixed_items:=coalesce(fixed_basis->'items','[]'::jsonb);$new$;
  if position(a in d)=0 then raise exception '0016 price basis anchor'; end if;
  d:=replace(d,a,z);
  a:='    revenue:=(b->>''fixed_revenue'')::numeric; fixed_total:=(b->>''fixed_total'')::numeric;';
  z:=a||E'\n    fixed_items:=coalesce(b->''fixed_items'',''[]''::jsonb);';
  if position(a in d)=0 then raise exception '0016 price active-basis anchor'; end if;
  d:=replace(d,a,z);
  a:='''fixed_total'',fixed_total,''fixed_rate'',rate,''target_profit_rate''';
  z:='''fixed_total'',fixed_total,''fixed_items'',fixed_items,''fixed_rate'',rate,''target_profit_rate''';
  if position(a in d)=0 then raise exception '0016 price response anchor'; end if;
  execute replace(d,a,z);

  d:=replace(pg_get_functiondef('public.recipe_draft_preview_internal(uuid,jsonb)'::regprocedure),chr(13),'');
  a:='declare settings_date date; active_snapshot jsonb; basis_date date;';
  z:='declare settings_date date; active_snapshot jsonb; basis_date date; fixed_basis jsonb; fixed_items jsonb;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0016 draft declaration anchor'; end if;
  d:=replace(d,a,z);
  a:=$old$ rate:=public.fixed_cost_rate(p_store,to_char(d,'YYYY-MM'));
 select f.total_revenue,coalesce((select sum((a->>'total')::numeric) from jsonb_array_elements(f.items) a),0) into revenue,fixed_total
   from public.fixed_costs_monthly f where f.store_id=p_store and f.month=to_char(d,'YYYY-MM');$old$;
  z:=$new$ fixed_basis:=public.fixed_cost_basis_result(p_store,to_char(d,'YYYY-MM'));
 rate:=(fixed_basis->>'rate')::numeric;
 revenue:=(fixed_basis->>'average_revenue')::numeric;
 fixed_total:=(fixed_basis->>'average_fixed')::numeric;
 fixed_items:=coalesce(fixed_basis->'items','[]'::jsonb);$new$;
  if position(a in d)=0 then raise exception '0016 draft basis anchor'; end if;
  d:=replace(d,a,z);
  a:='if active_snapshot is not null then rate:=(active_snapshot->>''fixed_rate'')::numeric; revenue:=(active_snapshot->>''fixed_revenue'')::numeric; fixed_total:=(active_snapshot->>''fixed_total'')::numeric; end if;';
  z:='if active_snapshot is not null then rate:=(active_snapshot->>''fixed_rate'')::numeric; revenue:=(active_snapshot->>''fixed_revenue'')::numeric; fixed_total:=(active_snapshot->>''fixed_total'')::numeric; fixed_items:=coalesce(active_snapshot->''fixed_items'',''[]''::jsonb); end if;';
  if position(a in d)=0 then raise exception '0016 draft active-basis anchor'; end if;
  d:=replace(d,a,z);
  a:='''fixed_rate'',rate,''target_profit_rate''';
  z:='''fixed_items'',fixed_items,''fixed_rate'',rate,''target_profit_rate''';
  if position(a in d)=0 then raise exception '0016 draft response anchor'; end if;
  execute replace(d,a,z);
end $patch$;

-- 0015 made both basis facades executor-owned. Keep the same hardened facade
-- contract as the rest of that role: SECURITY DEFINER with the audited path.
alter function public.get_fixed_cost_basis(uuid,text) security definer;
alter function public.get_fixed_cost_basis(uuid,text) set search_path to public, pg_temp;

-- A basis-month composition change is visible even when its total leaves the
-- aggregate rate unchanged.  Keep the menu audit event while recompute_recipe
-- itself remains conditional on a changed authoritative rate.
do $patch$
declare d text; a text; z text;
begin
  d:=replace(pg_get_functiondef('public.save_fixed_costs(uuid,text,numeric,jsonb)'::regprocedure),chr(13),'');
  a:='if v_prev is distinct from v_after_rate then';
  z:='if exists(select 1 from jsonb_array_elements(public.fixed_cost_basis_result(p_store,public.store_local_month(p_store))->''months'') m where m->>''month''=p_month) then';
  if (length(d)-length(replace(d,a,'')))/length(a)=1 then
    execute replace(d,a,z);
  elsif (length(d)-length(replace(d,z,'')))/length(z)<>1 then
    raise exception '0016 fixed composition basis anchor';
  end if;
end $patch$;

comment on function public.fixed_cost_basis_result(uuid,text) is
  '대상 월을 제외한 직전 완료 1~3개월의 합계비율·월평균 금액·항목별 월평균을 하나의 기준으로 반환한다.';

select public.assert_no_rpc_overloads();
commit;
