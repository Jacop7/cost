-- SALES-CHANNEL-LIFECYCLE · 동적 채널별 세금·손익의 단일 읽기 계약
--
-- 구형 3열은 업그레이드 호환용으로 남기되, channel_storage_version=2 판매는
-- UUID 채널 수량과 아래 v2 세금 snapshot만 권위로 읽는다.

begin;

create table public.daily_sales_item_channel_tax_snapshots_v2 (
  daily_sales_item_id uuid not null references public.daily_sales_items(id) on delete cascade,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  channel_code_snapshot text not null,
  channel_name_snapshot text not null,
  final_quantity numeric not null check(final_quantity>=0),
  listed_total numeric not null,
  net_sales numeric not null,
  customer_total numeric not null,
  tax_total numeric not null,
  merchant_tax_liability numeric not null default 0,
  marketplace_tax_liability numeric not null default 0,
  input_snapshot jsonb not null,
  amount_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(daily_sales_item_id,sales_channel_id)
);

create table public.sales_tax_events_v2 (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  daily_sales_item_id uuid not null references public.daily_sales_items(id) on delete restrict,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  channel_name_snapshot text not null,
  component_id_snapshot uuid,
  component_name_snapshot text not null,
  delta_amount numeric not null,
  target_quantity numeric not null check(target_quantity>=0),
  business_day_revision_no integer not null,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.daily_sales_item_channel_tax_snapshots_v2 enable row level security;
alter table public.sales_tax_events_v2 enable row level security;
grant create on schema public to costkeep_rpc_executor;
alter table public.daily_sales_item_channel_tax_snapshots_v2 owner to costkeep_rpc_executor;
alter table public.sales_tax_events_v2 owner to costkeep_rpc_executor;
revoke all on public.daily_sales_item_channel_tax_snapshots_v2,public.sales_tax_events_v2
  from public,anon,authenticated;
grant all on public.daily_sales_item_channel_tax_snapshots_v2,public.sales_tax_events_v2
  to costkeep_rpc_executor,service_role;
revoke create on schema public from costkeep_rpc_executor;

-- 신규/legacy 저장 형식을 한 곳에서 회계 행으로 해석한다.
create or replace function public.sales_item_channel_accounting_rows(p_item uuid)
returns table(
  sales_channel_id uuid,channel_code text,channel_name text,sort_order integer,quantity numeric,
  listed_total numeric,net_sales numeric,customer_total numeric,tax_total numeric,
  merchant_tax_liability numeric,marketplace_tax_liability numeric
) language sql stable security definer set search_path=public,pg_temp as $fn$
  with src as (
    select i.*,d.channel_storage_version
    from public.daily_sales_items i join public.daily_sales d on d.id=i.daily_sales_id
    where i.id=p_item
  ), q as (
    select r.sales_channel_id,r.channel_code,r.channel_name,
      coalesce(c.sort_order,2147483647) sort_order,r.quantity
    from public.sales_item_channel_rows(p_item) r
    left join public.sales_channels c on c.id=r.sales_channel_id
  )
  select q.sales_channel_id,q.channel_code,q.channel_name,q.sort_order,q.quantity,
    coalesce(v.listed_total,l.listed_total,s.unit_price*q.quantity),
    coalesce(v.net_sales,l.net_sales,
      (s.unit_price-coalesce(s.unit_tax,case when coalesce(s.tax_mode,'included')='included'
        then s.unit_price*10/110 else 0 end))*q.quantity),
    coalesce(v.customer_total,l.customer_total,s.unit_price*q.quantity),
    coalesce(v.tax_total,l.tax_total,
      coalesce(s.unit_tax,case when coalesce(s.tax_mode,'included')='included'
        then s.unit_price*10/110 else 0 end)*q.quantity),
    coalesce(v.merchant_tax_liability,l.merchant_tax_liability,0),
    coalesce(v.marketplace_tax_liability,l.marketplace_tax_liability,0)
  from src s join q on true
  left join public.daily_sales_item_channel_tax_snapshots_v2 v
    on s.channel_storage_version=2 and v.daily_sales_item_id=s.id
      and v.sales_channel_id=q.sales_channel_id
  left join public.daily_sales_item_tax_snapshots l
    on s.channel_storage_version=1 and l.daily_sales_item_id=s.id
      and l.sales_channel_code::text=q.channel_code;
$fn$;

create or replace function public.sales_item_accounting_totals(p_item uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  select jsonb_build_object(
    'listed_total',coalesce(sum(listed_total),0),
    'net_sales',coalesce(sum(net_sales),0),
    'customer_total',coalesce(sum(customer_total),0),
    'tax_total',coalesce(sum(tax_total),0),
    'merchant_tax_liability',coalesce(sum(merchant_tax_liability),0),
    'marketplace_tax_liability',coalesce(sum(marketplace_tax_liability),0))
  from public.sales_item_channel_accounting_rows(p_item);
$fn$;

-- trigger 70이 UUID 수량을 먼저 동기화하고, legacy 국제 세금 trigger 80이 호환
-- snapshot을 만든 뒤, 90이 UUID별 구성 항목 반올림을 다시 확정한다.
create or replace function public.refresh_dynamic_sales_item_tax()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_draft uuid:=nullif(current_setting('costkeep.sales_dynamic_draft_id',true),'')::uuid;
  v_sales public.daily_sales; v_market public.store_market_profiles; v_profile public.store_tax_profiles;
  v_override public.menu_tax_overrides; v_treatment public.tax_treatment; v_category text;
  v_row record; v_components jsonb; v_quote jsonb; v_old jsonb; v_component record;
  v_revision integer:=0; v_total_tax numeric:=0; v_total_qty numeric:=0;
begin
  if v_draft is null or pg_trigger_depth()>1 then return new; end if;
  select * into v_sales from public.daily_sales where id=new.daily_sales_id;
  if coalesce(v_sales.channel_storage_version,1)<>2 then return new; end if;
  select coalesce(b.revision_no,0)+case when b.status='closed' then 1 else 0 end into v_revision
    from public.business_days b where b.id=v_sales.business_day_id;
  select * into v_market from public.store_market_profiles m where m.store_id=new.store_id
    and v_sales.sale_date>=m.effective_from and (m.effective_to is null or v_sales.sale_date<=m.effective_to);
  if v_market.id is not null then
    select * into v_profile from public.store_tax_profiles t where t.store_id=new.store_id
      and t.market_profile_id=v_market.id and v_sales.sale_date>=t.effective_from
      and (t.effective_to is null or v_sales.sale_date<=t.effective_to);
  end if;
  if v_profile.id is not null then
    select * into v_override from public.menu_tax_overrides o
      where o.recipe_id=new.recipe_id and o.tax_profile_id=v_profile.id;
    if v_override.tax_category is not null then
      v_category:=v_override.tax_category;
      select treatment into v_treatment from public.tax_category_catalog
        where tax_profile_id=v_profile.id and code=v_category and active;
    else
      v_treatment:=coalesce(v_override.treatment,v_profile.default_treatment);
    end if;
  end if;

  for v_row in
    select q.*,c.code,c.name from public.daily_sales_item_channel_quantities q
      join public.sales_channels c on c.id=q.sales_channel_id
      where q.daily_sales_item_id=new.id order by c.sort_order,c.id
  loop
    select amount_snapshot into v_old from public.daily_sales_item_channel_tax_snapshots_v2
      where daily_sales_item_id=new.id and sales_channel_id=v_row.sales_channel_id;
    if v_profile.id is not null and v_treatment is not null then
      select jsonb_agg(jsonb_build_object(
        'component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
        'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
        'applies_to_treatments',to_jsonb(c.applies_to_treatments),
        'remittance_owner',coalesce(r.remittance_owner,c.default_remittance_owner))
        order by c.sort_order,c.id) into v_components
      from public.store_tax_components c left join public.channel_tax_remittance r
        on r.tax_component_id=c.id and r.store_id=c.store_id
          and r.sales_channel_code::text=v_row.code
      where c.tax_profile_id=v_profile.id;
      if v_components is null then
        raise exception '세금 구성 항목을 확정할 수 없어요'
          using errcode='45013',detail='TAX_PROFILE_INCOMPLETE';
      end if;
      v_quote:=public.calculate_international_tax(v_market.price_basis,
        public.international_currency_minor_unit(v_market.currency_code),v_treatment,
        new.unit_price*v_row.quantity,v_components);
    else
      v_quote:=jsonb_build_object(
        'listed_total',new.unit_price*v_row.quantity,
        'net_sales',(new.unit_price-coalesce(new.unit_tax,case when coalesce(new.tax_mode,'included')='included'
          then new.unit_price*10/110 else 0 end))*v_row.quantity,
        'customer_total',new.unit_price*v_row.quantity,
        'tax_total',coalesce(new.unit_tax,case when coalesce(new.tax_mode,'included')='included'
          then new.unit_price*10/110 else 0 end)*v_row.quantity,
        'merchant_tax_liability',0,'marketplace_tax_liability',0,'components','[]'::jsonb);
      v_components:='[]'::jsonb;
    end if;

    for v_component in
      with old_rows as (select x->>'component_id' id,x->>'name' name,(x->>'rounded_amount')::numeric amount
        from jsonb_array_elements(coalesce(v_old->'components','[]'::jsonb)) x),
      new_rows as (select x->>'component_id' id,x->>'name' name,(x->>'rounded_amount')::numeric amount
        from jsonb_array_elements(coalesce(v_quote->'components','[]'::jsonb)) x)
      select coalesce(n.id,o.id) id,coalesce(n.name,o.name,'기본 세금') name,
        coalesce(n.amount,0)-coalesce(o.amount,0) delta
      from old_rows o full join new_rows n using(id)
    loop
      if v_component.delta<>0 then
        insert into public.sales_tax_events_v2(store_id,daily_sales_item_id,sales_channel_id,
          channel_name_snapshot,component_id_snapshot,component_name_snapshot,delta_amount,
          target_quantity,business_day_revision_no)
        values(new.store_id,new.id,v_row.sales_channel_id,v_row.name,
          nullif(v_component.id,'')::uuid,v_component.name,v_component.delta,v_row.quantity,v_revision);
      end if;
    end loop;

    insert into public.daily_sales_item_channel_tax_snapshots_v2(
      daily_sales_item_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,final_quantity,
      listed_total,net_sales,customer_total,tax_total,merchant_tax_liability,
      marketplace_tax_liability,input_snapshot,amount_snapshot)
    values(new.id,v_row.sales_channel_id,v_row.code,v_row.name,v_row.quantity,
      (v_quote->>'listed_total')::numeric,(v_quote->>'net_sales')::numeric,
      (v_quote->>'customer_total')::numeric,(v_quote->>'tax_total')::numeric,
      coalesce((v_quote->>'merchant_tax_liability')::numeric,0),
      coalesce((v_quote->>'marketplace_tax_liability')::numeric,0),
      jsonb_build_object('unit_price',new.unit_price,'quantity',v_row.quantity,
        'tax_profile_id',v_profile.id,'tax_profile_revision',v_profile.revision,
        'treatment',v_treatment,'tax_category',v_category,'components',v_components),v_quote)
    on conflict(daily_sales_item_id,sales_channel_id) do update set
      channel_code_snapshot=excluded.channel_code_snapshot,
      channel_name_snapshot=excluded.channel_name_snapshot,final_quantity=excluded.final_quantity,
      listed_total=excluded.listed_total,net_sales=excluded.net_sales,
      customer_total=excluded.customer_total,tax_total=excluded.tax_total,
      merchant_tax_liability=excluded.merchant_tax_liability,
      marketplace_tax_liability=excluded.marketplace_tax_liability,
      input_snapshot=excluded.input_snapshot,amount_snapshot=excluded.amount_snapshot,
      updated_at=clock_timestamp();
    v_total_tax:=v_total_tax+(v_quote->>'tax_total')::numeric;
    v_total_qty:=v_total_qty+v_row.quantity;
  end loop;
  delete from public.daily_sales_item_channel_tax_snapshots_v2 t where t.daily_sales_item_id=new.id
    and not exists(select 1 from public.daily_sales_item_channel_quantities q
      where q.daily_sales_item_id=new.id and q.sales_channel_id=t.sales_channel_id);
  update public.daily_sales_items set unit_tax=case when v_total_qty=0 then 0 else v_total_tax/v_total_qty end,
    unit_tax_calculation_version=case when v_profile.id is null then unit_tax_calculation_version
      else 'international_tax_v1' end where id=new.id;
  return new;
end $fn$;

drop trigger if exists daily_sales_items_90_dynamic_tax on public.daily_sales_items;
create trigger daily_sales_items_90_dynamic_tax after insert or update on public.daily_sales_items
for each row execute function public.refresh_dynamic_sales_item_tax();

grant create on schema public to costkeep_rpc_executor;
alter function public.sales_item_channel_accounting_rows(uuid) owner to costkeep_rpc_executor;
alter function public.sales_item_accounting_totals(uuid) owner to costkeep_rpc_executor;
alter function public.refresh_dynamic_sales_item_tax() owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.sales_item_channel_accounting_rows(uuid),
  public.sales_item_accounting_totals(uuid),public.refresh_dynamic_sales_item_tax()
  from public,anon,authenticated,service_role;
grant execute on function public.sales_item_channel_accounting_rows(uuid),
  public.sales_item_accounting_totals(uuid),public.refresh_dynamic_sales_item_tax()
  to costkeep_rpc_executor;

notify pgrst,'reload schema';
commit;
