-- 0191 · INTL-1F 세금 미포함가의 순매출·손익·영업일 기준을 확정 snapshot으로 통일
--
-- 0188~0190은 국제 세액과 현재 레시피 손익을 연결했지만, 세금 미포함가에서
-- `판매가-세금`을 순매출로 쓰는 legacy 경로가 영업일 기준·기간 손익·변경 이력에
-- 남아 있었다. 활성일 이후는 확정 quote/snapshot의 net_sales를 손익 권위로 쓴다.

begin;

-- 현재 메뉴 가격을 바꾸기 전/후로 비교할 수 있게 가격을 인자로 받는 내부 quote다.
create or replace function public.recipe_tax_quote_for_price(
  p_recipe uuid,p_date date,p_price numeric
)
returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
declare
  v_recipe public.recipes%rowtype;
  v_market public.store_market_profiles%rowtype;
  v_tax public.store_tax_profiles%rowtype;
  v_override public.menu_tax_overrides%rowtype;
  v_boundary date;
  v_treatment public.tax_treatment;
  v_components jsonb;
begin
  select * into v_recipe from public.recipes where id=p_recipe;
  if v_recipe.id is null or p_date is null or p_price is null then return null; end if;
  if not (public.app_capabilities()#>>'{international_tax,read_enabled}')::boolean then return null; end if;
  select activation_date into v_boundary from public.international_tax_activation_boundaries
   where store_id=v_recipe.store_id;
  if v_boundary is null or p_date<v_boundary then return null; end if;

  select * into v_market from public.store_market_profiles m
   where m.store_id=v_recipe.store_id and p_date>=m.effective_from
     and (m.effective_to is null or p_date<=m.effective_to)
   order by m.effective_from desc limit 1;
  if v_market.id is null then return null; end if;
  select * into v_tax from public.store_tax_profiles t
   where t.store_id=v_recipe.store_id and t.market_profile_id=v_market.id
     and p_date>=t.effective_from and (t.effective_to is null or p_date<=t.effective_to)
   order by t.effective_from desc limit 1;
  if v_tax.id is null then return null; end if;

  select * into v_override from public.menu_tax_overrides o
   where o.recipe_id=p_recipe and o.tax_profile_id=v_tax.id
     and o.effective_from<=p_date
   order by o.effective_from desc limit 1;
  if v_override.tax_category is not null then
    select treatment into v_treatment from public.tax_category_catalog c
     where c.tax_profile_id=v_tax.id and c.code=v_override.tax_category and c.active;
  else
    v_treatment:=coalesce(v_override.treatment,v_tax.default_treatment);
  end if;
  if v_treatment is null then
    raise exception '메뉴의 과세 상태를 확정할 수 없어요'
      using errcode='45013',detail='TAX_TREATMENT_NOT_AVAILABLE';
  end if;
  select jsonb_agg(jsonb_build_object(
    'component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
    'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
    'applies_to_treatments',to_jsonb(c.applies_to_treatments),
    'remittance_owner',r.remittance_owner) order by c.sort_order,c.id)
    into v_components from public.store_tax_components c
    join public.channel_tax_remittance r on r.tax_component_id=c.id
      and r.store_id=c.store_id and r.sales_channel_code='hall'
   where c.tax_profile_id=v_tax.id;
  if v_components is null then
    raise exception '메뉴 세금 구성 항목이 완결되지 않았어요'
      using errcode='45013',detail='TAX_PROFILE_INCOMPLETE';
  end if;
  return public.calculate_international_tax(
    v_market.price_basis,public.international_currency_minor_unit(v_market.currency_code),
    v_treatment,p_price,v_components);
end
$$;

create or replace function public.current_recipe_tax_quote(p_recipe uuid,p_date date)
returns jsonb
language sql stable security definer
set search_path=pg_catalog,public
as $$
  select public.recipe_tax_quote_for_price(r.id,p_date,r.price)
    from public.recipes r where r.id=p_recipe
$$;

-- 영업일 메뉴 기준에 세액과 순매출을 같이 굳힌다.
create or replace function public.recipe_snapshot_entry(p_recipe uuid,p_date date)
returns jsonb language sql stable
as $$
  select jsonb_build_object(
    'basis_at',clock_timestamp(),'name',r.name,'price',r.price,
    'tax_mode',r.tax_mode,'tax_items',coalesce(r.tax_items,'[]'::jsonb),
    'tax',coalesce((q.quote->>'tax_total')::numeric,public.tax_of(r.price,r.tax_mode,r.tax_items)),
    'net_sales',coalesce((q.quote->>'net_sales')::numeric,
      r.price-public.tax_of(r.price,r.tax_mode,r.tax_items)),
    'customer_total',coalesce((q.quote->>'customer_total')::numeric,r.price),
    'tax_quote',q.quote,
    'base_servings',r.base_servings,'material_cost',public.recipe_material_cost(r.id),
    'extra_cost',coalesce((select sum(ec.amount_per_serving)
      from public.recipe_extra_costs ec where ec.recipe_id=r.id),0),
    'extras',coalesce((select jsonb_agg(jsonb_build_object(
      'name',ec.name,'qty',ec.qty,'amount',ec.amount_per_serving))
      from public.recipe_extra_costs ec where ec.recipe_id=r.id),'[]'::jsonb),
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'ingredient_id',n.ingredient_id,'name',i.name,'base_unit',i.base_unit,
      'per_serving',n.amount,'unit_price',public.base_unit_price(n.ingredient_id)))
      from public.recipe_ingredient_needs(r.id,1) n
      join public.ingredients i on i.id=n.ingredient_id),'[]'::jsonb))
  from public.recipes r
  left join lateral (select public.recipe_tax_quote_for_price(r.id,p_date,r.price) quote) q on true
  where r.id=p_recipe
$$;

create or replace function public.build_day_snapshot(p_store uuid,p_date date)
returns jsonb language sql stable
as $$
  select jsonb_build_object(
    'taken_at',now(),
    'fixed_rate',coalesce(public.fixed_cost_rate(p_store,to_char(p_date, 'YYYY-MM')),0),
    'fixed_items',coalesce((select f.items from public.fixed_costs_monthly f
      where f.store_id=p_store and f.month=to_char(p_date, 'YYYY-MM')),'[]'::jsonb),
    'etc_tax_rate',public.store_tax_rate(p_store),
    'ingredients',coalesce((select jsonb_object_agg(i.id::text,jsonb_build_object(
      'name',i.name,'base_unit',i.base_unit,'unit_price',public.base_unit_price(i.id)))
      from public.ingredients i where i.store_id=p_store),'{}'::jsonb),
    'recipes',coalesce((select jsonb_object_agg(r.id::text,
      public.recipe_snapshot_entry(r.id,p_date)) from public.recipes r
      where r.store_id=p_store and r.active),'{}'::jsonb))
$$;

-- 판매행의 회계용 합계. revenue 표시는 listed_total을 유지하고,
-- 손익은 net_sales를 쓴다. 세금 미포함가는 tax_total을 또 빼지 않는다.
create or replace function public.sales_item_accounting_totals(p_item uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public
as $$
  with i as (
    select x.*,(x.qty_hall+x.qty_delivery+x.qty_takeout) q
      from public.daily_sales_items x where x.id=p_item
  ), s as (
    select count(*) n,coalesce(sum(listed_total),0) listed,
      coalesce(sum(net_sales),0) net,coalesce(sum(customer_total),0) customer,
      coalesce(sum(tax_total),0) tax
      from public.daily_sales_item_tax_snapshots where daily_sales_item_id=p_item
  )
  select jsonb_build_object(
    'listed_total',case when s.n>0 then s.listed else i.unit_price*i.q end,
    'net_sales',case when s.n>0 then s.net else
      (i.unit_price-coalesce(i.unit_tax,case when coalesce(i.tax_mode,'included')='included'
        then i.unit_price*10/110 else 0 end))*i.q end,
    'customer_total',case when s.n>0 then s.customer else i.unit_price*i.q end,
    'tax_total',case when s.n>0 then s.tax else
      coalesce(i.unit_tax,case when coalesce(i.tax_mode,'included')='included'
        then i.unit_price*10/110 else 0 end)*i.q end)
  from i cross join s
$$;

create or replace function public.daily_sales_etc_accounting_totals(p_sales uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public
as $$
  select jsonb_build_object(
    'listed_total',d.etc_revenue,
    'net_sales',case when d.etc_tax_snapshot is not null then coalesce((
      select sum((x->'quote'->>'net_sales')::numeric)
        from jsonb_array_elements(d.etc_tax_snapshot->'lines') x),0)
      -- 국제 스냅샷 이전 장부는 옛 손익 계약대로 기타매출 전체를 순매출로 보존한다.
      -- etc_tax는 당시 화면의 세금 표시값일 뿐 과거 손익에서 차감하지 않았다.
      else d.etc_revenue end,
    'customer_total',case when d.etc_tax_snapshot is not null then coalesce((
      select sum((x->'quote'->>'customer_total')::numeric)
        from jsonb_array_elements(d.etc_tax_snapshot->'lines') x),0)
      else d.etc_revenue end,
    'tax_total',coalesce(d.etc_tax,0))
  from public.daily_sales d where d.id=p_sales
$$;

-- 기존 함수는 크고 여러 개의 화면 계약이다. 확정된 조각만 교체하고,
-- 조각이 하나라도 맞지 않으면 배포를 멈춘다.
do $patch$
declare v_def text;v_new text;
begin
  v_def:=replace(pg_get_functiondef('public.add_to_day_basis(uuid,date,uuid,boolean)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'v_entry := recipe_snapshot_entry(p_recipe);',
    'v_entry := recipe_snapshot_entry(p_recipe, p_date);');
  if v_new=v_def then raise exception '0191: add_to_day_basis snapshot 인자 교체 실패'; end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.e10_sale_recorded(uuid,date,uuid,numeric,numeric,numeric,numeric,boolean)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'  v_consume := reconcile_sales_consumption(v_item, false);',
    '  v_consume := reconcile_sales_consumption(v_item, false);' || chr(10) ||
    '  -- AFTER trigger가 국제 확정 세액을 unit_tax에 투영한 뒤 응답도 다시 읽는다.' || chr(10) ||
    '  select unit_tax into v_tax from daily_sales_items where id=v_item;');
  if v_new=v_def then raise exception '0191: e10 확정 세액 재조회 교체 실패'; end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.day_menu_basis(uuid,date)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    $old$      'profit',        b.price - b.material_cost - b.extra_cost - b.tax - v_rate * b.price,$old$,
    $new$      'profit',        b.net_sales - b.material_cost - b.extra_cost - v_rate * b.price,$new$);
  v_new:=replace(v_new,
    $old$      'current_profit',        r.price - cur.material_cost - cur.extra_cost - cur.tax - v_rate * r.price,$old$,
    $new$      'current_profit',        cur.net_sales - cur.material_cost - cur.extra_cost - v_rate * r.price,$new$);
  v_new:=replace(v_new,
    '             tax_of(r.price, r.tax_mode, r.tax_items) as tax',
    '             coalesce((public.current_recipe_tax_quote(r.id,v_date)->>''tax_total'')::numeric,' || chr(10) ||
    '               tax_of(r.price,r.tax_mode,r.tax_items)) as tax,' || chr(10) ||
    '             coalesce((public.current_recipe_tax_quote(r.id,v_date)->>''net_sales'')::numeric,' || chr(10) ||
    '               r.price-tax_of(r.price,r.tax_mode,r.tax_items)) as net_sales');
  v_new:=replace(v_new,
    $old$             (v_snap #>> array['recipes', r.id::text, 'tax'])::numeric           as tax$old$,
    $new$             (v_snap #>> array['recipes', r.id::text, 'tax'])::numeric           as tax,$new$ || chr(10) ||
    $new$             (v_snap #>> array['recipes', r.id::text, 'net_sales'])::numeric     as net_sales$new$);
  v_new:=replace(v_new,
    '             coalesce(s.tax, cur.tax)                   as tax',
    '             coalesce(s.tax, cur.tax)                   as tax,' || chr(10) ||
    '             coalesce(s.net_sales, s.price-s.tax, cur.net_sales) as net_sales');
  if position('b.net_sales - b.material_cost' in v_new)=0
     or position('cur.net_sales - cur.material_cost' in v_new)=0
     or position('as net_sales' in v_new)=0 then
    raise exception '0191: day_menu_basis 순매출 조각 교체 실패';
  end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.sales_summary(uuid,date,date)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'  v_revenue    numeric := 0;',
    '  v_revenue    numeric := 0;' || chr(10) || '  v_net        numeric := 0;');
  v_new:=replace(v_new,'  v_etc        numeric := 0;',
    '  v_etc        numeric := 0;' || chr(10) || '  v_etc_net    numeric := 0;');
  v_new:=replace(v_new,
    '  into v_revenue, v_qty, v_material, v_extra_mat, v_waste_menu, v_tax',
    '  into v_revenue, v_qty, v_material, v_extra_mat, v_waste_menu, v_tax');
  -- 메뉴 net은 별도 집계해 기존 SELECT 컬럼 순서를 흔들지 않는다.
  v_new:=replace(v_new,
    '  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*), coalesce(sum(etc_tax), 0)',
    '  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*), coalesce(sum(etc_tax), 0)');
  v_new:=replace(v_new,
    '  v_revenue := v_revenue + v_etc;',
    '  select coalesce(sum((public.sales_item_accounting_totals(it.id)->>''net_sales'')::numeric),0)' || chr(10) ||
    '    into v_net from daily_sales ds join daily_sales_items it on it.daily_sales_id=ds.id' || chr(10) ||
    '   where ds.store_id=p_store and ds.sale_date between p_from and p_to;' || chr(10) ||
    '  select coalesce(sum((public.daily_sales_etc_accounting_totals(ds.id)->>''net_sales'')::numeric),0)' || chr(10) ||
    '    into v_etc_net from daily_sales ds' || chr(10) ||
    '   where ds.store_id=p_store and ds.sale_date between p_from and p_to;' || chr(10) || chr(10) ||
    '  v_revenue := v_revenue + v_etc;');
  v_new:=replace(v_new,
    $old$    'revenue', v_revenue, 'etc_revenue', v_etc, 'qty', v_qty,$old$,
    $new$    'revenue', v_revenue, 'net_sales', v_net + v_etc_net,
    'etc_revenue', v_etc, 'qty', v_qty,$new$);
  v_new:=replace(v_new,
    $old$    'profit', v_revenue - v_material - v_extra_mat - v_tax$old$,
    $new$    'profit', v_net + v_etc_net - v_material - v_extra_mat$new$);
  if position('v_net + v_etc_net - v_material' in v_new)=0
     or position('''net_sales'', v_net + v_etc_net' in v_new)=0
     or position('sales_item_accounting_totals' in v_new)=0 then
    raise exception '0191: sales_summary 순매출 조각 교체 실패';
  end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.day_menu_detail(uuid,date,uuid)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'  v_tax    numeric;',
    '  v_tax    numeric;' || chr(10) || '  v_net    numeric;' || chr(10) || '  v_customer numeric;');
  v_new:=replace(v_new,
    $old$  v_tax   := coalesce(v_item.unit_tax,
                      case when coalesce(v_item.tax_mode,'included') = 'included'
                           then v_price * 10 / 110 else 0 end);$old$,
    $new$  v_tax   := coalesce(v_item.unit_tax,
                      case when coalesce(v_item.tax_mode,'included') = 'included'
                           then v_price * 10 / 110 else 0 end);
  v_net := coalesce((public.sales_item_accounting_totals(v_item.id)->>'net_sales')::numeric
                    / nullif(v_qty,0),v_price-v_tax);
  v_customer := coalesce((public.sales_item_accounting_totals(v_item.id)->>'customer_total')::numeric
                         / nullif(v_qty,0),v_price);$new$);
  v_new:=replace(v_new,$old$    'tax', v_tax,$old$,
    $new$    'tax', v_tax,'net_sales',v_net,'customer_total',v_customer,$new$);
  v_new:=replace(v_new,$old$    'profit', v_price - v_mat - v_extra - v_fixed - v_tax,$old$,
    $new$    'profit', v_net - v_mat - v_extra - v_fixed,$new$);
  if position('v_net - v_mat - v_extra' in v_new)=0 or position('customer_total' in v_new)=0 then
    raise exception '0191: day_menu_detail 순매출 조각 교체 실패';
  end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.range_menu_detail(uuid,date,date,uuid)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'  v_revenue  numeric := 0;',
    '  v_revenue  numeric := 0;' || chr(10) || '  v_net      numeric := 0;');
  v_new:=replace(v_new,
    '  if v_name is null then',
    '  select coalesce(sum((public.sales_item_accounting_totals(it.id)->>''net_sales'')::numeric),0)' || chr(10) ||
    '    into v_net from daily_sales ds join daily_sales_items it on it.daily_sales_id=ds.id' || chr(10) ||
    '   where ds.store_id=p_store and ds.sale_date between p_from and p_to and it.recipe_id=p_recipe;' || chr(10) || chr(10) ||
    '  if v_name is null then');
  v_new:=replace(v_new,
    $old$    'profit', v_revenue - v_material - v_waste_mat - v_extra - v_fixed - v_tax,$old$,
    $new$    'profit', v_net - v_material - v_waste_mat - v_extra - v_fixed,$new$);
  v_new:=replace(v_new,
    '                               then (v_revenue - v_material - v_extra - v_fixed - v_tax) / v_qty',
    '                               then (v_net - v_material - v_extra - v_fixed) / v_qty');
  if position('v_net - v_material - v_waste_mat' in v_new)=0
     or position('(v_net - v_material - v_extra - v_fixed) / v_qty' in v_new)=0 then
    raise exception '0191: range_menu_detail 순매출 조각 교체 실패';
  end if;
  execute v_new;

  -- 변경 이력도 화면 손익과 같은 net_sales를 써야 한다. 세금 미포함가에서
  -- 판매가-tax를 또 적용하면 감사 카드만 순이익이 낮아진다.
  v_def:=replace(pg_get_functiondef('public.save_recipe(uuid,jsonb)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'  v_tax1     numeric;',
    '  v_tax1     numeric;' || chr(10) ||
    '  v_net0     numeric;' || chr(10) || '  v_net1     numeric;' || chr(10) ||
    '  v_quote0   jsonb;' || chr(10) || '  v_quote1   jsonb;' || chr(10) ||
    '  v_day      date := store_local_date(p_store);');
  v_new:=replace(v_new,
    '    v_tax0 := tax_of(v_before.price, v_before.tax_mode, v_before.tax_items);',
    '    v_quote0 := public.recipe_tax_quote_for_price(v_id,v_day,v_before.price);' || chr(10) ||
    '    v_tax0 := coalesce((v_quote0->>''tax_total'')::numeric,' || chr(10) ||
    '      tax_of(v_before.price,v_before.tax_mode,v_before.tax_items));' || chr(10) ||
    '    v_net0 := coalesce((v_quote0->>''net_sales'')::numeric,v_before.price-v_tax0);');
  v_new:=replace(v_new,
    '    select tax_of(price, tax_mode, tax_items) into v_tax1 from recipes where id = v_id;',
    '    v_quote1 := public.recipe_tax_quote_for_price(v_id,v_day,(p_payload->>''price'')::numeric);' || chr(10) ||
    '    select coalesce((v_quote1->>''tax_total'')::numeric,tax_of(price,tax_mode,tax_items)),' || chr(10) ||
    '           coalesce((v_quote1->>''net_sales'')::numeric,price-tax_of(price,tax_mode,tax_items))' || chr(10) ||
    '      into v_tax1,v_net1 from recipes where id=v_id;');
  v_new:=replace(v_new,
    '                     round(v_before.price - v_mat0 - v_ext0 - v_tax0 - v_rate * v_before.price, 2),',
    '                     round(v_net0 - v_mat0 - v_ext0 - v_rate * v_before.price, 2),');
  v_new:=replace(v_new,
    $old$                     round((p_payload->>'price')::numeric - v_mat1 - v_ext1 - v_tax1
                           - v_rate * (p_payload->>'price')::numeric, 2), '원', 'derived')$old$,
    $new$                     round(v_net1 - v_mat1 - v_ext1
                           - v_rate * (p_payload->>'price')::numeric, 2), '원', 'derived')$new$);
  if position('v_quote0 := public.recipe_tax_quote_for_price' in v_new)=0
     or position('round(v_net0 - v_mat0' in v_new)=0
     or position('round(v_net1 - v_mat1' in v_new)=0 then
    raise exception '0191: save_recipe 감사 순매출 조각 교체 실패';
  end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.e1_confirm_inbound(uuid,numeric,text,date)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'  v_price0   numeric;',
    '  v_price0   numeric;' || chr(10) || '  v_net0     numeric;' || chr(10) || '  v_quote0   jsonb;');
  v_new:=replace(v_new,
    $old$    select price, tax_of(price, tax_mode, tax_items) into v_price0, v_tax0
      from recipes where id = rec.recipe_id;$old$,
    $new$    select price into v_price0 from recipes where id=rec.recipe_id;
    v_quote0 := public.recipe_tax_quote_for_price(rec.recipe_id,v_today,v_price0);
    select coalesce((v_quote0->>'tax_total')::numeric,tax_of(price,tax_mode,tax_items)),
           coalesce((v_quote0->>'net_sales')::numeric,price-tax_of(price,tax_mode,tax_items))
      into v_tax0,v_net0 from recipes where id=rec.recipe_id;$new$);
  v_new:=replace(v_new,'round(v_price0 - v_mat0 - v_tax0 - v_rate0 * v_price0',
    'round(v_net0 - v_mat0 - v_rate0 * v_price0');
  v_new:=replace(v_new,'round(v_price0 - recipe_material_cost(rec.recipe_id) - v_tax0 - v_rate0 * v_price0',
    'round(v_net0 - recipe_material_cost(rec.recipe_id) - v_rate0 * v_price0');
  if position('v_quote0 := public.recipe_tax_quote_for_price(rec.recipe_id,v_today' in v_new)=0
     or position('round(v_net0 - v_mat0' in v_new)=0 then
    raise exception '0191: e1 입고 감사 순매출 조각 교체 실패';
  end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.e11_inbound_reverted(uuid,text)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,'  v_tax0     numeric;',
    '  v_tax0     numeric;' || chr(10) || '  v_net0     numeric;' || chr(10) || '  v_quote0   jsonb;');
  v_new:=replace(v_new,
    $old$    select price, tax_of(price, tax_mode, tax_items) into v_price0, v_tax0
      from recipes where id = rec.recipe_id;$old$,
    $new$    select price into v_price0 from recipes where id=rec.recipe_id;
    v_quote0 := public.recipe_tax_quote_for_price(rec.recipe_id,v_day,v_price0);
    select coalesce((v_quote0->>'tax_total')::numeric,tax_of(price,tax_mode,tax_items)),
           coalesce((v_quote0->>'net_sales')::numeric,price-tax_of(price,tax_mode,tax_items))
      into v_tax0,v_net0 from recipes where id=rec.recipe_id;$new$);
  v_new:=replace(v_new,'round(v_price0 - v_mat0 - v_tax0 - v_rate0 * v_price0',
    'round(v_net0 - v_mat0 - v_rate0 * v_price0');
  v_new:=replace(v_new,'round(v_price0 - recipe_material_cost(rec.recipe_id) - v_tax0 - v_rate0 * v_price0',
    'round(v_net0 - recipe_material_cost(rec.recipe_id) - v_rate0 * v_price0');
  if position('v_quote0 := public.recipe_tax_quote_for_price(rec.recipe_id,v_day' in v_new)=0
     or position('round(v_net0 - v_mat0' in v_new)=0 then
    raise exception '0191: e11 입고 취소 감사 순매출 조각 교체 실패';
  end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.e4_fixed_cost_saved(uuid,text,numeric)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    'round(r.price - recipe_material_cost(r.id) - v_ext' || chr(10) ||
    '                             - tax_of(r.price, r.tax_mode, r.tax_items) - v_rate0 * r.price, 2)',
    'round(coalesce((public.current_recipe_tax_quote(r.id,v_day)->>''net_sales'')::numeric,' || chr(10) ||
    '                                      r.price-tax_of(r.price,r.tax_mode,r.tax_items))' || chr(10) ||
    '                             - recipe_material_cost(r.id) - v_ext - v_rate0 * r.price, 2)');
  v_new:=replace(v_new,
    'round(r.price - recipe_material_cost(r.id) - v_ext' || chr(10) ||
    '                             - tax_of(r.price, r.tax_mode, r.tax_items)' || chr(10) ||
    '                             - coalesce(v_rate, 0) * r.price, 2)',
    'round(coalesce((public.current_recipe_tax_quote(r.id,v_day)->>''net_sales'')::numeric,' || chr(10) ||
    '                                      r.price-tax_of(r.price,r.tax_mode,r.tax_items))' || chr(10) ||
    '                             - recipe_material_cost(r.id) - v_ext' || chr(10) ||
    '                             - coalesce(v_rate,0) * r.price, 2)');
  if position('current_recipe_tax_quote(r.id,v_day)' in v_new)=0
     or position('r.price - recipe_material_cost(r.id) - v_ext' in v_new)>0 then
    raise exception '0191: e4 고정지출 감사 순매출 조각 교체 실패';
  end if;
  execute v_new;
end
$patch$;

drop function public.recipe_snapshot_entry(uuid);

revoke execute on function public.recipe_tax_quote_for_price(uuid,date,numeric),
  public.current_recipe_tax_quote(uuid,date),public.recipe_snapshot_entry(uuid,date),
  public.sales_item_accounting_totals(uuid),public.daily_sales_etc_accounting_totals(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.recipe_tax_quote_for_price(uuid,date,numeric),
  public.current_recipe_tax_quote(uuid,date),public.recipe_snapshot_entry(uuid,date),
  public.sales_item_accounting_totals(uuid),public.daily_sales_etc_accounting_totals(uuid)
  to margincook_rpc_executor;

comment on function public.recipe_tax_quote_for_price(uuid,date,numeric) is
  '레시피·일자·가격의 국제 세금 quote. 가격 수정 전후 감사 계산에도 쓴다.';
comment on function public.sales_item_accounting_totals(uuid) is
  '국제 snapshot이 있으면 listed/net/customer/tax 확정 합계, 없으면 legacy 합계를 돌려준다.';

do $verify$
declare v text;
begin
  if to_regprocedure('public.recipe_snapshot_entry(uuid)') is not null then
    raise exception '0191: 날짜 없는 snapshot 함수가 남았습니다';
  end if;
  v:=lower(pg_get_functiondef('public.build_day_snapshot(uuid,date)'::regprocedure));
  if position('recipe_snapshot_entry(r.id,p_date)' in replace(v,' ',''))=0 then
    raise exception '0191: build_day_snapshot이 해당 날짜를 넘기지 않습니다';
  end if;
  v:=lower(pg_get_functiondef('public.sales_summary(uuid,date,date)'::regprocedure));
  if position('v_net + v_etc_net' in v)=0 then
    raise exception '0191: sales_summary가 순매출로 손익을 계산하지 않습니다';
  end if;
  if has_function_privilege('authenticated','public.sales_item_accounting_totals(uuid)','execute')
     or has_function_privilege('authenticated','public.recipe_tax_quote_for_price(uuid,date,numeric)','execute') then
    raise exception '0191: 회계·세금 내부 함수가 앱에 열렸습니다';
  end if;
  foreach v in array array[
    lower(pg_get_functiondef('public.save_recipe(uuid,jsonb)'::regprocedure)),
    lower(pg_get_functiondef('public.e1_confirm_inbound(uuid,numeric,text,date)'::regprocedure)),
    lower(pg_get_functiondef('public.e11_inbound_reverted(uuid,text)'::regprocedure)),
    lower(pg_get_functiondef('public.e4_fixed_cost_saved(uuid,text,numeric)'::regprocedure))]
  loop
    if position('recipe_tax_quote' in v)=0 then
      raise exception '0191: 변경 이력 함수가 국제 순매출 권위를 쓰지 않습니다';
    end if;
  end loop;
end
$verify$;

commit;
