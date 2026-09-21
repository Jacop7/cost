-- SALES-CHANNEL-LIFECYCLE · 일별/기간/메뉴/채널 읽기를 UUID 채널 resolver로 통일

begin;

-- 상세 화면의 기존 계산 본체는 보존하고 채널 배열과 권위 합계를 덧씌운다.
alter function public.day_menu_detail(uuid,date,uuid) rename to day_menu_detail_legacy_0131;
revoke all on function public.day_menu_detail_legacy_0131(uuid,date,uuid)
  from public,anon,authenticated,service_role;

create function public.day_menu_detail(p_store uuid,p_date date,p_recipe uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_result jsonb; v_item uuid; v_channels jsonb; v_qty numeric;
begin
  perform public.assert_my_store(p_store);
  v_result:=public.day_menu_detail_legacy_0131(p_store,p_date,p_recipe);
  select it.id into v_item from public.daily_sales ds join public.daily_sales_items it
    on it.daily_sales_id=ds.id where ds.store_id=p_store and ds.sale_date=p_date
      and it.recipe_id=p_recipe;
  if v_item is null then return v_result; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'sales_channel_id',sales_channel_id,'code',channel_code,'name',channel_name,
      'quantity',quantity,'listed_total',listed_total,'net_sales',net_sales,
      'customer_total',customer_total,'tax_total',tax_total)
      order by sort_order,sales_channel_id),'[]'::jsonb),coalesce(sum(quantity),0)
    into v_channels,v_qty from public.sales_item_channel_accounting_rows(v_item);
  return v_result||jsonb_build_object('qty',v_qty,'channels',v_channels,
    'qty_hall',coalesce((select sum(quantity) from public.sales_item_channel_accounting_rows(v_item)
      where channel_code='hall'),0),
    'qty_delivery',coalesce((select sum(quantity) from public.sales_item_channel_accounting_rows(v_item)
      where channel_code='delivery'),0),
    'qty_takeout',coalesce((select sum(quantity) from public.sales_item_channel_accounting_rows(v_item)
      where channel_code='takeout'),0));
end $fn$;

alter function public.range_menu_detail(uuid,date,date,uuid) rename to range_menu_detail_legacy_0131;
revoke all on function public.range_menu_detail_legacy_0131(uuid,date,date,uuid)
  from public,anon,authenticated,service_role;

create function public.range_menu_detail(p_store uuid,p_from date,p_to date,p_recipe uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_result jsonb; v_channels jsonb; v_qty numeric;
begin
  perform public.assert_my_store(p_store);
  v_result:=public.range_menu_detail_legacy_0131(p_store,p_from,p_to,p_recipe);
  with rows as (
    select q.* from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      cross join lateral public.sales_item_channel_accounting_rows(it.id) q
    where ds.store_id=p_store and ds.sale_date between p_from and p_to and it.recipe_id=p_recipe
  ), grouped as (
    select sales_channel_id,channel_code,channel_name,min(sort_order) sort_order,
      sum(quantity) quantity,sum(listed_total) listed_total,sum(net_sales) net_sales,
      sum(customer_total) customer_total,sum(tax_total) tax_total from rows
    group by sales_channel_id,channel_code,channel_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'sales_channel_id',sales_channel_id,'code',channel_code,'name',channel_name,
      'quantity',quantity,'listed_total',listed_total,'net_sales',net_sales,
      'customer_total',customer_total,'tax_total',tax_total)
      order by sort_order,sales_channel_id),'[]'::jsonb),coalesce(sum(quantity),0)
    into v_channels,v_qty from grouped;
  return v_result||jsonb_build_object('qty',v_qty,'channels',v_channels);
end $fn$;

-- 부족 검사는 신규 channels 배열의 합을 우선한다. 구형 입력은 3열을 계속 읽는다.
do $patch$
declare v_def text; v_new text;
begin
  v_def:=replace(pg_get_functiondef('public.sale_shortages(uuid,date,jsonb)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    $old$coalesce((x->>'qty_hall')::numeric, 0)
         + coalesce((x->>'qty_delivery')::numeric, 0)
         + coalesce((x->>'qty_takeout')::numeric, 0) as sold,$old$,
    $new$case when jsonb_typeof(x->'channels')='array' then coalesce((
             select sum(coalesce((q->>'quantity')::numeric,0))
             from jsonb_array_elements(x->'channels') q),0)
           else coalesce((x->>'qty_hall')::numeric,0)
             +coalesce((x->>'qty_delivery')::numeric,0)
             +coalesce((x->>'qty_takeout')::numeric,0) end as sold,$new$);
  if v_new=v_def then raise exception '0131: sale_shortages 동적 수량 교체 실패'; end if;
  execute v_new;
end $patch$;

create or replace function public.sales_etc_by_channel(p_store uuid,p_from date,p_to date)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  with days as (
    select * from public.daily_sales where store_id=p_store and sale_date between p_from and p_to
  ), items as (
    select e.channel_code_snapshot code,e.sales_channel_id,e.channel_name_snapshot channel_name,
      e.unit_price*e.quantity amount,
      coalesce((e.tax_snapshot->>'net_sales')::numeric,e.unit_price*e.quantity) net_sales,
      coalesce((e.tax_snapshot->>'tax_total')::numeric,0) tax
    from days d join public.daily_sales_etc_lines e on e.daily_sales_id=d.id
    where d.channel_storage_version=2
    union all
    select nullif(i->>'channel',''),c.id,coalesce(c.name,'채널 미지정'),
      coalesce((i->>'price')::numeric,0)*coalesce((i->>'qty')::numeric,1),
      coalesce((i->>'price')::numeric,0)*coalesce((i->>'qty')::numeric,1),
      coalesce((i->>'price')::numeric,0)*coalesce((i->>'qty')::numeric,1)*coalesce(d.etc_tax,0)
        /nullif(d.etc_revenue,0)
    from days d cross join lateral jsonb_array_elements(coalesce(d.etc_items,'[]'::jsonb)) i
    left join public.sales_channels c on c.store_id=d.store_id and c.code=i->>'channel'
    where d.channel_storage_version=1 and d.etc_tax_snapshot is null
    union all
    select nullif(i->>'channel',''),c.id,coalesce(c.name,'채널 미지정'),
      coalesce((i->>'price')::numeric,0)*coalesce((i->>'quantity')::numeric,1),
      coalesce((i->'quote'->>'net_sales')::numeric,0),coalesce((i->'quote'->>'tax_total')::numeric,0)
    from days d cross join lateral jsonb_array_elements(coalesce(d.etc_tax_snapshot->'lines','[]'::jsonb)) i
    left join public.sales_channels c on c.store_id=d.store_id and c.code=i->>'channel'
    where d.channel_storage_version=1 and d.etc_tax_snapshot is not null
  ), split as (
    select code,sales_channel_id,max(channel_name) channel_name,sum(amount) amount,
      sum(net_sales) net_sales,coalesce(sum(tax),0) tax from items
    group by code,sales_channel_id
  )
  select jsonb_build_object('from',p_from,'to',p_to,
    'total',coalesce((select sum(amount) from split),0),
    'channels',coalesce((select jsonb_agg(jsonb_build_object('sales_channel_id',sales_channel_id,
      'code',code,'name',channel_name,'amount',amount,'net_sales',net_sales,'tax',tax)
      order by channel_name,sales_channel_id) from split where sales_channel_id is not null),'[]'::jsonb),
    'by_channel',coalesce((select jsonb_object_agg(code,jsonb_build_object(
      'sales_channel_id',sales_channel_id,'name',channel_name,'amount',amount,
      'net_sales',net_sales,'tax',tax)) from split where code is not null),'{}'::jsonb),
    'unassigned',coalesce((select sum(amount) from split where sales_channel_id is null),0),
    'unassigned_tax',coalesce((select sum(tax) from split where sales_channel_id is null),0),
    'unassigned_net_sales',coalesce((select sum(net_sales) from split where sales_channel_id is null),0));
$fn$;

create or replace function public.sales_authoritative_range_detail_base_0121(
  p_store uuid,p_from date,p_to date
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  with lines as (
    select it.*,ds.sale_date,public.sales_item_total_quantity(it.id) qty,
      public.sales_item_accounting_totals(it.id) accounting
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), menu_rows as (
    select recipe_id,menu_name,sum(qty) qty,
      sum(coalesce((select sum(r.quantity) from public.sales_item_channel_rows(id) r where r.channel_code='hall'),0)) qty_hall,
      sum(coalesce((select sum(r.quantity) from public.sales_item_channel_rows(id) r where r.channel_code='delivery'),0)) qty_delivery,
      sum(coalesce((select sum(r.quantity) from public.sales_item_channel_rows(id) r where r.channel_code='takeout'),0)) qty_takeout,
      sum(coalesce(qty_waste,0)) qty_waste,sum((accounting->>'customer_total')::numeric) revenue,
      sum(unit_material_cost*qty) material
    from lines where qty>0 group by recipe_id,menu_name
  ), menu_json as (
    select coalesce(jsonb_agg(jsonb_build_object('recipe_id',m.recipe_id,'menu_name',m.menu_name,
      'qty',m.qty,'qty_hall',m.qty_hall,'qty_delivery',m.qty_delivery,'qty_takeout',m.qty_takeout,
      'qty_waste',m.qty_waste,'revenue',m.revenue,'unit_price',case when m.qty=0 then 0 else m.revenue/m.qty end,
      'unit_material_cost',case when m.qty=0 then 0 else m.material/m.qty end,'material',m.material,
      'channels',coalesce((select jsonb_agg(jsonb_build_object('sales_channel_id',x.sales_channel_id,
        'code',x.channel_code,'name',x.channel_name,'quantity',x.quantity) order by x.sort_order,x.sales_channel_id)
        from (select q.sales_channel_id,q.channel_code,q.channel_name,min(q.sort_order) sort_order,sum(q.quantity) quantity
          from lines l cross join lateral public.sales_item_channel_accounting_rows(l.id) q
          where l.recipe_id is not distinct from m.recipe_id and l.menu_name=m.menu_name
          group by q.sales_channel_id,q.channel_code,q.channel_name) x),'[]'::jsonb))
      order by m.qty desc,m.menu_name),'[]'::jsonb) value from menu_rows m
  ), catalog_sources as (
    select c.id,c.code,c.name,c.sort_order from public.sales_channels c where c.store_id=p_store and c.active
    union all
    select m.sales_channel_id,m.channel_code_snapshot,m.channel_name_snapshot,m.sort_order
      from public.sales_day_heads h join public.sales_version_channel_manifests m on m.version_id=h.current_version_id
      where h.store_id=p_store and h.business_date between p_from and p_to
    union all
    select q.sales_channel_id,q.channel_code_snapshot,q.channel_name_snapshot,c.sort_order
      from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      join public.daily_sales_item_channel_quantities q on q.daily_sales_item_id=it.id
      left join public.sales_channels c on c.id=q.sales_channel_id
      where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), channel_catalog as (
    select id,max(code) code,max(name) name,min(coalesce(sort_order,2147483647)) sort_order
      from catalog_sources group by id
  ), menu_channel_rows as (
    select q.sales_channel_id,max(q.channel_code) code,max(q.channel_name) name,min(q.sort_order) sort_order,
      sum(q.customer_total) amount,sum(q.quantity) qty,
      sum(l.unit_material_cost*q.quantity) material,sum(q.tax_total) tax,sum(q.net_sales) net_sales
    from lines l cross join lateral public.sales_item_channel_accounting_rows(l.id) q
    group by q.sales_channel_id
  ), etc_lines as (
    select d.sale_date,e.sales_channel_id,e.channel_code_snapshot code,e.channel_name_snapshot name,
      e.unit_price*e.quantity listed,coalesce((e.tax_snapshot->>'customer_total')::numeric,e.unit_price*e.quantity) amount,
      e.quantity qty,coalesce((e.tax_snapshot->>'tax_total')::numeric,0) tax,
      coalesce((e.tax_snapshot->>'net_sales')::numeric,e.unit_price*e.quantity) net_sales
    from public.daily_sales d join public.daily_sales_etc_lines e on e.daily_sales_id=d.id
    where d.store_id=p_store and d.sale_date between p_from and p_to and d.channel_storage_version=2
    union all
    select d.sale_date,c.id,nullif(x->>'channel',''),coalesce(c.name,'채널 미지정'),
      coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1),
      coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1),coalesce((x->>'qty')::numeric,1),
      coalesce(d.etc_tax,0)*coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)/nullif(d.etc_revenue,0),
      coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1)
    from public.daily_sales d cross join lateral jsonb_array_elements(coalesce(d.etc_items,'[]'::jsonb)) x
    left join public.sales_channels c on c.store_id=d.store_id and c.code=x->>'channel'
    where d.store_id=p_store and d.sale_date between p_from and p_to
      and d.channel_storage_version=1 and d.etc_tax_snapshot is null
    union all
    select d.sale_date,c.id,nullif(x->>'channel',''),coalesce(c.name,'채널 미지정'),
      coalesce((x->>'price')::numeric,0)*coalesce((x->>'quantity')::numeric,1),
      coalesce((x->'quote'->>'customer_total')::numeric,0),coalesce((x->>'quantity')::numeric,1),
      coalesce((x->'quote'->>'tax_total')::numeric,0),coalesce((x->'quote'->>'net_sales')::numeric,0)
    from public.daily_sales d cross join lateral jsonb_array_elements(coalesce(d.etc_tax_snapshot->'lines','[]'::jsonb)) x
    left join public.sales_channels c on c.store_id=d.store_id and c.code=x->>'channel'
    where d.store_id=p_store and d.sale_date between p_from and p_to
      and d.channel_storage_version=1 and d.etc_tax_snapshot is not null
  ), etc_channels as (
    select sales_channel_id,max(code) code,max(name) name,sum(amount) amount,sum(qty) qty,
      coalesce(sum(tax),0) tax,sum(net_sales) net_sales from etc_lines
    where sales_channel_id is not null group by sales_channel_id
  ), menu_daily as (
    select l.sale_date,q.sales_channel_id,sum(q.customer_total) amount
    from lines l cross join lateral public.sales_item_channel_accounting_rows(l.id) q
    group by l.sale_date,q.sales_channel_id
  ), etc_daily as (
    select sale_date,sales_channel_id,sum(amount) amount from etc_lines
      where sales_channel_id is not null group by sale_date,sales_channel_id
  ), channel_daily as (
    select coalesce(m.sale_date,e.sale_date) sale_date,coalesce(m.sales_channel_id,e.sales_channel_id) sales_channel_id,
      coalesce(m.amount,0)+coalesce(e.amount,0) amount from menu_daily m full join etc_daily e
      on e.sale_date=m.sale_date and e.sales_channel_id=m.sales_channel_id
  ), version_days as (
    select distinct ds.sale_date business_date,
      public.sales_effective_day_summary(p_store,ds.sale_date) summary
      from public.daily_sales ds where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), fixed_channels as (
    select d.sales_channel_id,case when bool_or(jsonb_typeof(v.summary->'fixed_cost') is distinct from 'number')
      then null else sum(case when coalesce((v.summary->>'revenue')::numeric,0)>0
        then (v.summary->>'fixed_cost')::numeric*d.amount/(v.summary->>'revenue')::numeric else 0 end) end amount
    from channel_daily d join version_days v on v.business_date=d.sale_date group by d.sales_channel_id
  ), fixed_totals as (
    select case when bool_or(jsonb_typeof(summary->'fixed_cost') is distinct from 'number') then null
      else coalesce(sum((summary->>'fixed_cost')::numeric),0) end total from version_days
  ), channel_json as (
    select coalesce(jsonb_agg(jsonb_build_object('sales_channel_id',c.id,'code',c.code,'name',c.name,
      'amount',coalesce(m.amount,0)+coalesce(e.amount,0),'qty',coalesce(m.qty,0)+coalesce(e.qty,0),
      'material',coalesce(m.material,0),'tax',coalesce(m.tax,0)+coalesce(e.tax,0),
      'net_sales',coalesce(m.net_sales,0)+coalesce(e.net_sales,0),'fixed_cost',f.amount,
      'etc_revenue',coalesce(e.amount,0)) order by c.sort_order,c.id),'[]'::jsonb) value
    from channel_catalog c left join menu_channel_rows m on m.sales_channel_id=c.id
      left join etc_channels e on e.sales_channel_id=c.id left join fixed_channels f on f.sales_channel_id=c.id
  )
  select jsonb_build_object('from',p_from,'to',p_to,'menu',menu_json.value,'channels',channel_json.value,
    'unassigned_revenue',coalesce((select sum(amount) from etc_lines where sales_channel_id is null),0),
    'fixed_cost_total',fixed_totals.total,'fixed_cost_unallocated',case when fixed_totals.total is null then null
      else greatest(fixed_totals.total-coalesce((select sum(amount) from fixed_channels where amount is not null),0),0) end)
  from menu_json cross join channel_json cross join fixed_totals;
$fn$;

-- 기존 삭제 메뉴 표기 wrapper는 새 base를 그대로 소비한다.
create or replace function public.sales_authoritative_range_detail(p_store uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_result jsonb; v_menu jsonb;
begin
  perform public.assert_my_store(p_store);
  v_result:=public.sales_authoritative_range_detail_base_0121(p_store,p_from,p_to);
  select coalesce(jsonb_agg(row_value||jsonb_build_object('is_deleted',case
      when nullif(row_value->>'recipe_id','') is null then true
      else coalesce((select r.deleted_at is not null from public.recipes r
        where r.store_id=p_store and r.id=(row_value->>'recipe_id')::uuid),true) end)
      order by ord),'[]'::jsonb) into v_menu
    from jsonb_array_elements(coalesce(v_result->'menu','[]'::jsonb)) with ordinality rows(row_value,ord);
  return jsonb_set(v_result,'{menu}',v_menu,true);
end $fn$;

-- legacy range의 일별 합계는 호환 3열과 같은 총량을 유지한다. 메뉴/채널은 UUID 권위 응답으로 교체한다.
create or replace function public.sales_range(p_store uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_legacy jsonb; v_detail jsonb;
begin
  perform public.assert_my_store(p_store);
  v_legacy:=jsonb_build_object('from',p_from,'to',p_to,'summary',public.sales_summary(p_store,p_from,p_to),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',d.sale_date,
      'revenue',coalesce((public.sales_effective_day_summary(p_store,d.sale_date)->>'revenue')::numeric,0),
      'qty',coalesce((public.sales_effective_day_summary(p_store,d.sale_date)->>'qty')::numeric,0),
      'material',coalesce((public.sales_effective_day_summary(p_store,d.sale_date)->>'material_cost')::numeric,0),
      'profit',(public.sales_effective_day_summary(p_store,d.sale_date)->>'profit')::numeric)
      order by d.sale_date) from (select distinct sale_date from public.daily_sales
        where store_id=p_store and sale_date between p_from and p_to) d),'[]'::jsonb));
  v_detail:=public.sales_authoritative_range_detail(p_store,p_from,p_to);
  return v_legacy||jsonb_build_object('menu',v_detail->'menu','channels',v_detail->'channels');
end $fn$;

-- 채널별 직접 귀속 금액은 detail, 공통비는 날짜별 채널 매출 비율로 배분한다.
create or replace function public.sales_authoritative_channel_profit(p_store uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_detail jsonb; v_channels jsonb; v_unallocated_fixed numeric;
begin
  perform public.assert_my_store(p_store);
  v_detail:=public.sales_authoritative_range_detail(p_store,p_from,p_to);
  with menu_daily as (
    select ds.sale_date,q.sales_channel_id,sum(q.customer_total) amount
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      cross join lateral public.sales_item_channel_accounting_rows(it.id) q
    where ds.store_id=p_store and ds.sale_date between p_from and p_to group by ds.sale_date,q.sales_channel_id
  ), etc_rows as (
    select ds.sale_date,e.sales_channel_id,sum(coalesce((e.tax_snapshot->>'customer_total')::numeric,e.unit_price*e.quantity)) amount
    from public.daily_sales ds join public.daily_sales_etc_lines e on e.daily_sales_id=ds.id
    where ds.store_id=p_store and ds.sale_date between p_from and p_to and ds.channel_storage_version=2
      and e.sales_channel_id is not null group by ds.sale_date,e.sales_channel_id
    union all
    select ds.sale_date,c.id,sum(coalesce((x->>'price')::numeric,0)*coalesce((x->>'qty')::numeric,1))
    from public.daily_sales ds cross join lateral jsonb_array_elements(coalesce(ds.etc_items,'[]'::jsonb)) x
      join public.sales_channels c on c.store_id=ds.store_id and c.code=x->>'channel'
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
      and ds.channel_storage_version=1 and ds.etc_tax_snapshot is null group by ds.sale_date,c.id
    union all
    select ds.sale_date,c.id,sum(coalesce((x->'quote'->>'customer_total')::numeric,0))
    from public.daily_sales ds cross join lateral jsonb_array_elements(coalesce(ds.etc_tax_snapshot->'lines','[]'::jsonb)) x
      join public.sales_channels c on c.store_id=ds.store_id and c.code=x->>'channel'
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
      and ds.channel_storage_version=1 and ds.etc_tax_snapshot is not null group by ds.sale_date,c.id
  ), etc_daily as (
    select sale_date,sales_channel_id,sum(amount) amount from etc_rows group by sale_date,sales_channel_id
  ), channel_daily as (
    select coalesce(m.sale_date,e.sale_date) sale_date,coalesce(m.sales_channel_id,e.sales_channel_id) sales_channel_id,
      coalesce(m.amount,0)+coalesce(e.amount,0) amount from menu_daily m full join etc_daily e
      on e.sale_date=m.sale_date and e.sales_channel_id=m.sales_channel_id
  ), allocations as (
    select d.sales_channel_id,
      sum(case when coalesce((s->>'revenue')::numeric,0)>0 then coalesce((s->>'extra_material_cost')::numeric,0)*d.amount/(s->>'revenue')::numeric else 0 end) extra_material,
      sum(case when coalesce((s->>'revenue')::numeric,0)>0 then coalesce((s->>'waste_loss')::numeric,0)*d.amount/(s->>'revenue')::numeric else 0 end) waste,
      sum(case when coalesce((s->>'revenue')::numeric,0)>0 then coalesce((s->>'daily_extra')::numeric,0)*d.amount/(s->>'revenue')::numeric else 0 end) daily_extra
    from channel_daily d cross join lateral public.sales_effective_day_summary(p_store,d.sale_date) s
    group by d.sales_channel_id
  ), rows as (
    select ord,c,coalesce(a.extra_material,0) extra_material,coalesce(a.waste,0) waste,
      coalesce(a.daily_extra,0) daily_extra from jsonb_array_elements(coalesce(v_detail->'channels','[]'::jsonb))
      with ordinality x(c,ord) left join allocations a on a.sales_channel_id=(c->>'sales_channel_id')::uuid
  )
  select coalesce(jsonb_agg(c||jsonb_build_object('extra_material_cost',extra_material,
      'waste_loss',waste,'daily_extra',daily_extra,'profit',case when jsonb_typeof(c->'fixed_cost')='number'
        then (c->>'net_sales')::numeric-coalesce((c->>'material')::numeric,0)-extra_material-waste
          -(c->>'fixed_cost')::numeric-daily_extra else null end) order by ord),'[]'::jsonb)
    into v_channels from rows;
  v_unallocated_fixed:=(v_detail->>'fixed_cost_unallocated')::numeric;
  return jsonb_build_object('channels',v_channels,
    'unassigned_revenue',coalesce((v_detail->>'unassigned_revenue')::numeric,0),
    'fixed_cost_total',v_detail->'fixed_cost_total',
    'fixed_rate_provisional',jsonb_typeof(v_detail->'fixed_cost_total') is distinct from 'number',
    'unallocated_fixed_cost',v_unallocated_fixed);
end $fn$;

create or replace function public.sales_channel_fixed(p_store uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_profit jsonb; v_summary jsonb; v_total numeric; v_channels jsonb; v_allocated numeric:=0;
begin
  perform public.assert_my_store(p_store);
  v_profit:=public.sales_authoritative_channel_profit(p_store,p_from,p_to);
  v_total:=nullif(v_profit->>'fixed_cost_total','')::numeric;
  if v_total is null then
    -- 전환 전 직접 판매 원장은 완료 판본이 없으므로 기존 일 합계를 호환 경로로 쓴다.
    v_summary:=public.sales_summary(p_store,p_from,p_to);
    v_total:=nullif(v_summary->>'fixed_cost','')::numeric;
    select coalesce(jsonb_object_agg(x->>'code',case
        when coalesce((v_summary->>'revenue')::numeric,0)>0
          then v_total*(x->>'amount')::numeric/(v_summary->>'revenue')::numeric else 0 end),'{}'::jsonb),
      coalesce(sum(case when coalesce((v_summary->>'revenue')::numeric,0)>0
        then v_total*(x->>'amount')::numeric/(v_summary->>'revenue')::numeric else 0 end),0)
      into v_channels,v_allocated from jsonb_array_elements(v_profit->'channels') x;
    return jsonb_build_object('month',to_char(p_from,'YYYY-MM'),'total',v_total,
      'provisional',coalesce((v_summary->>'fixed_rate_provisional')::boolean,false),
      'channels',v_channels,'unallocated',case when v_total is null then null
        else greatest(v_total-v_allocated,0) end,'items','[]'::jsonb);
  end if;
  return jsonb_build_object('month',to_char(p_from,'YYYY-MM'),'total',v_total,
    'provisional',coalesce((v_profit->>'fixed_rate_provisional')::boolean,false),
    'channels',coalesce((select jsonb_object_agg(x->>'code',(x->>'fixed_cost')::numeric)
      from jsonb_array_elements(v_profit->'channels') x where jsonb_typeof(x->'fixed_cost')='number'),'{}'::jsonb),
    'unallocated',v_profit->'unallocated_fixed_cost','items','[]'::jsonb);
end $fn$;

-- 세금 상세도 UUID 채널 snapshot의 구성 항목 반올림 합을 우선한다.
create or replace function public.sales_tax_breakdown(p_store uuid,p_from date,p_to date)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  with item_components as (
    select coalesce(x->>'name','기본 세금') name,coalesce((x->>'rate_pct')::numeric,0) rate,
      coalesce((x->>'rounded_amount')::numeric,0) amount,'menu'::text source
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      join public.daily_sales_item_channel_tax_snapshots_v2 s on s.daily_sales_item_id=it.id
      cross join lateral jsonb_array_elements(coalesce(s.amount_snapshot->'components','[]'::jsonb)) x
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
    union all
    select coalesce(x->>'name','기본 세금'),coalesce((x->>'rate_pct')::numeric,0),
      coalesce((x->>'rounded_amount')::numeric,0),'etc'
    from public.daily_sales ds join public.daily_sales_etc_lines e on e.daily_sales_id=ds.id
      cross join lateral jsonb_array_elements(coalesce(e.tax_snapshot->'components','[]'::jsonb)) x
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), grouped as (
    select name,rate,sum(amount) amount,sum(amount) filter(where source='menu') menu_amount,
      sum(amount) filter(where source='etc') etc_amount from item_components group by name,rate
  ), menu_totals as (
    select coalesce(sum((public.sales_item_accounting_totals(it.id)->>'tax_total')::numeric),0) menu_total
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), etc_totals as (
    select coalesce(sum(ds.etc_tax),0) etc_total from public.daily_sales ds
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
  ), totals as (
    select menu_total,etc_total from menu_totals cross join etc_totals
  )
  select jsonb_build_object('from',p_from,'to',p_to,'total',menu_total+etc_total,
    'menu_total',menu_total,'etc_total',etc_total,'items',coalesce((select jsonb_agg(jsonb_build_object(
      'name',name,'rate',rate,'amount',amount,'menu_amount',coalesce(menu_amount,0),
      'etc_amount',coalesce(etc_amount,0)) order by amount desc) from grouped),'[]'::jsonb)) from totals;
$fn$;

grant create on schema public to costkeep_rpc_executor;
alter function public.day_menu_detail(uuid,date,uuid) owner to costkeep_rpc_executor;
alter function public.range_menu_detail(uuid,date,date,uuid) owner to costkeep_rpc_executor;
alter function public.sale_shortages(uuid,date,jsonb) owner to costkeep_rpc_executor;
alter function public.sales_etc_by_channel(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.sales_authoritative_range_detail_base_0121(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.sales_authoritative_range_detail(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.sales_range(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.sales_authoritative_channel_profit(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.sales_channel_fixed(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.sales_tax_breakdown(uuid,date,date) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.day_menu_detail(uuid,date,uuid),public.range_menu_detail(uuid,date,date,uuid),
  public.sale_shortages(uuid,date,jsonb),public.sales_etc_by_channel(uuid,date,date),
  public.sales_authoritative_range_detail(uuid,date,date),public.sales_range(uuid,date,date),
  public.sales_authoritative_channel_profit(uuid,date,date),public.sales_channel_fixed(uuid,date,date),
  public.sales_tax_breakdown(uuid,date,date) from public,anon,service_role;
grant execute on function public.day_menu_detail(uuid,date,uuid),public.range_menu_detail(uuid,date,date,uuid),
  public.sale_shortages(uuid,date,jsonb),public.sales_etc_by_channel(uuid,date,date),
  public.sales_authoritative_range_detail(uuid,date,date),public.sales_range(uuid,date,date),
  public.sales_authoritative_channel_profit(uuid,date,date),public.sales_channel_fixed(uuid,date,date),
  public.sales_tax_breakdown(uuid,date,date) to authenticated;
grant execute on function public.day_menu_detail_legacy_0131(uuid,date,uuid),
  public.range_menu_detail_legacy_0131(uuid,date,date,uuid),
  public.sales_authoritative_range_detail_base_0121(uuid,date,date) to costkeep_rpc_executor;

notify pgrst,'reload schema';
commit;
