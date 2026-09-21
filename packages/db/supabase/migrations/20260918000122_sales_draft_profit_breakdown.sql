-- 매출 작성 미리보기에서도 확정 손익 화면과 같은 서버 계산 항목을 제공한다.
-- 클라이언트는 이 값을 다시 계산하지 않고 공용 손익 계산 카드를 그린다.
begin;

create or replace function public.sales_draft_payload(p_draft uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_manifest jsonb; v_items jsonb; v_etc_items jsonb; v_extra_items jsonb;
  v_business_date date; v_menu_revenue numeric:=0; v_menu_net numeric:=0;
  v_qty numeric:=0; v_material numeric:=0; v_extra_material numeric:=0;
  v_waste numeric:=0; v_etc_revenue numeric:=0; v_etc_tax numeric:=0;
  v_daily_extra numeric:=0; v_revenue numeric:=0; v_net numeric:=0;
  v_tax numeric:=0; v_fixed numeric:=0; v_expense numeric:=0; v_profit numeric:=0;
  v_fixed_rate numeric:=0; v_etc_tax_rate numeric:=0;
begin
  select b.manifest,d.business_date into v_manifest,v_business_date
  from public.sales_day_drafts d
  join public.sales_basis_versions b on b.id=d.basis_version_id
  where d.id=p_draft;
  v_manifest:=coalesce(v_manifest,'{}'::jsonb);
  v_fixed_rate:=coalesce(nullif(v_manifest->>'fixed_rate','')::numeric,0);
  v_etc_tax_rate:=coalesce(nullif(v_manifest->>'etc_tax_rate','')::numeric,0);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'recipe_id',m.recipe_id,'menu_name',m.menu_name,
      'price',coalesce((r.item->>'price')::numeric,0),
      'qty_hall',m.qty_hall,'qty_delivery',m.qty_delivery,
      'qty_takeout',m.qty_takeout,'qty_waste',m.qty_waste,'deleted',m.deleted)
      order by m.sort_order,m.id),'[]'::jsonb),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      * coalesce((r.item->>'customer_total')::numeric,(r.item->>'price')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      * coalesce((r.item->>'net_sales')::numeric,
        (r.item->>'price')::numeric-coalesce((r.item->>'tax')::numeric,0),(r.item->>'price')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      * coalesce((r.item->>'material_cost')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_hall+m.qty_delivery+m.qty_takeout end
      * coalesce((r.item->>'extra_cost')::numeric,0)),0),
    coalesce(sum(case when m.deleted then 0 else m.qty_waste end
      * coalesce((r.item->>'waste_material_cost')::numeric,(r.item->>'material_cost')::numeric,0)),0)
  into v_items,v_menu_revenue,v_qty,v_menu_net,v_material,v_extra_material,v_waste
  from public.sales_draft_menu_lines m
  cross join lateral (select v_manifest#>array['recipes',m.recipe_id::text] item) r
  where m.draft_id=p_draft;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',e.name,'price',e.price,'qty',e.qty,'channel',e.channel,'deleted',e.deleted)
      order by e.sort_order,e.id),'[]'::jsonb),
    coalesce(sum(case when e.deleted then 0 else e.price*e.qty end),0)
  into v_etc_items,v_etc_revenue
  from public.sales_draft_etc_lines e where e.draft_id=p_draft;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'name',x.name,'amount',x.amount,'memo',x.memo,'deleted',x.deleted)
      order by x.sort_order,x.id),'[]'::jsonb),
    coalesce(sum(case when x.deleted then 0 else x.amount end),0)
  into v_extra_items,v_daily_extra
  from public.sales_draft_expense_lines x where x.draft_id=p_draft;

  v_etc_tax:=round(v_etc_revenue*v_etc_tax_rate,2);
  v_revenue:=v_menu_revenue+v_etc_revenue;
  v_net:=v_menu_net+v_etc_revenue-v_etc_tax;
  v_tax:=v_revenue-v_net;
  v_fixed:=v_revenue*v_fixed_rate;
  v_profit:=v_net-v_material-v_extra_material-v_waste-v_daily_extra-v_fixed;
  v_expense:=v_revenue-v_profit;

  return jsonb_build_object(
    'items',v_items,'etc_items',v_etc_items,'extra_items',v_extra_items,
    'summary',jsonb_build_object(
      'from',v_business_date,'to',v_business_date,'days',1,
      'revenue',v_revenue,'etc_revenue',v_etc_revenue,'qty',v_qty,
      'material_cost',v_material,'extra_material_cost',v_extra_material,
      'tax',v_tax,'waste_loss',v_waste,'waste_ingredient',0,'waste_menu',v_waste,
      'daily_extra',v_daily_extra,'fixed_cost',v_fixed,'fixed_rate',v_fixed_rate,
      'fixed_rate_provisional',nullif(v_manifest->>'fixed_rate','') is null,
      'expense',v_expense,'profit',v_profit,
      'expense_rate',case when v_revenue=0 then 0 else v_expense/v_revenue end,
      'profit_rate',case when v_revenue=0 then 0 else v_profit/v_revenue end));
end;
$fn$;

comment on function public.sales_draft_payload(uuid) is
  '매출 초안 입력값과 영업일 기준 판매가, 손익 계산 상세 미리보기를 반환한다.';

commit;
