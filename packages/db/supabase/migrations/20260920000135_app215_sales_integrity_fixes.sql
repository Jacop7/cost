-- APP-215 전수조사: 세금 별도 계약, 동적 채널 과거 원장, 빈 메뉴 초안 복구.
-- 이미 적용된 0127~0130은 불변으로 두고 전진 보정한다.

create or replace function public.calculate_international_tax(
  p_price_basis public.tax_price_basis,
  p_minor_unit smallint,
  p_treatment public.tax_treatment,
  p_listed_total numeric,
  p_components jsonb
)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v_component jsonb;
  v_components jsonb := '[]'::jsonb;
  v_primary_count integer;
  v_primary_rate numeric := 0;
  v_multiplier numeric := 1;
  v_net_raw numeric;
  v_rate numeric;
  v_basis numeric;
  v_unrounded numeric;
  v_rounded numeric;
  v_tax numeric := 0;
  v_merchant numeric := 0;
  v_marketplace numeric := 0;
  v_applies boolean;
begin
  if p_minor_unit not in (0, 2) or p_listed_total < 0
     or jsonb_typeof(p_components) is distinct from 'array' then
    raise exception '국제 세금 계산 입력이 올바르지 않아요'
      using errcode = '22000', detail = 'INVALID_INTERNATIONAL_TAX_INPUT';
  end if;

  select count(*) filter (where x->>'kind' = 'primary') into v_primary_count
    from jsonb_array_elements(p_components) x;
  if v_primary_count <> 1 then
    raise exception '기본세 구성 항목은 정확히 하나여야 해요'
      using errcode = '22000', detail = 'PRIMARY_TAX_COMPONENT_REQUIRED';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_components) x
     group by x->>'component_id' having count(*) > 1
  ) then
    raise exception '세금 구성 항목 ID가 중복됐어요'
      using errcode = '22000', detail = 'DUPLICATE_TAX_COMPONENT';
  end if;

  for v_component in select value from jsonb_array_elements(p_components) loop
    begin
      v_rate := (v_component->>'rate_pct')::numeric / 100;
    exception when others then
      raise exception '세금 구성 항목의 세율이 올바르지 않아요'
        using errcode = '22000', detail = 'INVALID_TAX_COMPONENT_RATE';
    end;
    if coalesce(v_component->>'component_id', '') = ''
       or v_component->>'kind' not in ('primary', 'additional')
       or v_component->>'calculation_basis' not in ('primary_tax_exclusive', 'primary_tax_inclusive')
       or v_component->>'remittance_owner' not in ('merchant', 'marketplace')
       or v_rate is null or v_rate < 0 or v_rate >= 1
       or jsonb_typeof(v_component->'applies_to_treatments') is distinct from 'array' then
      raise exception '세금 구성 항목의 모양이 올바르지 않아요'
        using errcode = '22000', detail = 'INVALID_TAX_COMPONENT';
    end if;
    if v_component->>'kind' = 'primary' and p_treatment = 'taxable' then
      v_primary_rate := v_rate;
    end if;
  end loop;

  v_multiplier := 1 + v_primary_rate;
  for v_component in select value from jsonb_array_elements(p_components) loop
    if v_component->>'kind' = 'additional'
       and (v_component->'applies_to_treatments') ? p_treatment::text then
      v_rate := (v_component->>'rate_pct')::numeric / 100;
      v_basis := case when v_component->>'calculation_basis' = 'primary_tax_inclusive'
                      then 1 + v_primary_rate else 1 end;
      v_multiplier := v_multiplier + v_rate * v_basis;
    end if;
  end loop;
  v_net_raw := case when p_price_basis = 'tax_inclusive'
                    then p_listed_total / v_multiplier else p_listed_total end;

  for v_component in select value from jsonb_array_elements(p_components) loop
    v_rate := (v_component->>'rate_pct')::numeric / 100;
    v_applies := case when v_component->>'kind' = 'primary'
                      then p_treatment = 'taxable'
                      else (v_component->'applies_to_treatments') ? p_treatment::text end;
    v_basis := case when v_component->>'calculation_basis' = 'primary_tax_inclusive'
                    then 1 + v_primary_rate else 1 end;
    v_unrounded := case when v_applies then v_net_raw * v_rate * v_basis else 0 end;
    v_rounded := round(v_unrounded, p_minor_unit);
    v_tax := v_tax + v_rounded;
    if v_component->>'remittance_owner' = 'merchant' then
      v_merchant := v_merchant + v_rounded;
    else
      v_marketplace := v_marketplace + v_rounded;
    end if;
    v_components := v_components || jsonb_build_array(
      v_component || jsonb_build_object(
        'unrounded_amount', v_unrounded,
        'rounded_amount', v_rounded));
  end loop;

  return jsonb_build_object(
    'listed_total', p_listed_total,
    'net_sales', case when p_price_basis = 'tax_inclusive' then p_listed_total - v_tax else p_listed_total end,
    'customer_total', case when p_price_basis = 'tax_inclusive' then p_listed_total else p_listed_total + v_tax end,
    'tax_total', v_tax,
    'merchant_tax_liability', v_merchant,
    'marketplace_tax_liability', v_marketplace,
    'components', v_components);
end;
$$;

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
    on l.daily_sales_item_id=s.id
      and l.sales_channel_code::text=q.channel_code;
$fn$;

create or replace function public.save_sales_draft(p_store uuid,p_draft uuid,p_base_revision integer,
  p_items jsonb,p_etc_items jsonb,p_extra_items jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_draft public.sales_day_drafts; v_expected uuid[]; v_supplied uuid[];
  v_expected_etc uuid[]; v_supplied_etc uuid[]; v_expected_extra uuid[]; v_supplied_extra uuid[];
  v_payload jsonb; v_dynamic boolean; v_manifest_count integer;
begin
  perform public.assert_my_store(p_store); perform public.lock_store_write_scope(p_store);
  perform public.expire_inventory_count_session(p_store);
  if exists(select 1 from public.inventory_count_sessions where store_id=p_store and status='active') then
    raise exception '재고 실사 중에는 매출을 저장할 수 없어요' using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  select * into v_draft from public.sales_day_drafts where id=p_draft for update;
  if not found or v_draft.store_id<>p_store then raise exception '매출 초안을 찾을 수 없어요' using errcode='P0002',detail='SALES_DRAFT_NOT_FOUND'; end if;
  if v_draft.status<>'editing' then raise exception '수정할 수 없는 매출 초안이에요' using errcode='45041',detail='SALES_DRAFT_NOT_EDITABLE'; end if;
  if v_draft.business_date<public.sales_editable_from(p_store) then
    update public.sales_day_drafts set status='expired' where id=p_draft;
    return jsonb_build_object('draft_id',p_draft,'business_date',v_draft.business_date,'kind',v_draft.draft_kind,
      'status','expired','revision',v_draft.draft_revision,'payload_hash',v_draft.payload_hash,
      'expires_at',v_draft.expires_at,'payload',public.sales_draft_payload(p_draft));
  end if;
  if v_draft.draft_revision<>p_base_revision then raise exception '다른 기기에서 초안이 변경됐어요' using errcode='45009',detail='DRAFT_REVISION_CONFLICT'; end if;
  perform public.assert_sales_basis_version(p_store,v_draft.basis_version_id,v_draft.business_date,
    v_draft.draft_kind='initial' and v_draft.draft_revision=0);
  if jsonb_typeof(coalesce(p_items,'null'::jsonb))<>'array' or jsonb_typeof(coalesce(p_etc_items,'null'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_extra_items,'null'::jsonb))<>'array' then
    raise exception '메뉴·기타 매출·추가 지출의 전체 상태를 보내 주세요' using errcode='45043',detail='DRAFT_TARGET_INCOMPLETE';
  end if;
  select array_agg(recipe_id order by recipe_id) into v_expected from public.sales_draft_menu_lines where draft_id=p_draft;
  select array_agg((x->>'recipe_id')::uuid order by (x->>'recipe_id')::uuid) into v_supplied from jsonb_array_elements(p_items) x;
  if jsonb_array_length(p_items)<>coalesce(cardinality(v_supplied),0) or v_expected is distinct from v_supplied then
    raise exception '메뉴 전체 상태를 보내 주세요. 삭제는 0 또는 삭제 표시로 남겨야 해요' using errcode='45043',detail='DRAFT_TARGET_INCOMPLETE';
  end if;
  select count(*) into v_manifest_count from public.sales_draft_channel_manifests where draft_id=p_draft;
  select case
    when jsonb_array_length(p_items)=0 then true
    else coalesce(bool_and(jsonb_typeof(x->'channels')='array'),false)
  end into v_dynamic
  from jsonb_array_elements(p_items) x;
  if exists(select 1 from public.sales_draft_channel_manifests where draft_id=p_draft
      and channel_code_snapshot not in ('hall','delivery','takeout')) and not v_dynamic then
    raise exception '판매 채널 기능이 변경됐어요. 앱을 업데이트한 뒤 다시 시도해 주세요.' using errcode='45044',detail='CLIENT_UPGRADE_REQUIRED';
  end if;
  if v_dynamic and exists(select 1 from jsonb_array_elements(p_items) x where
    (select count(*) from jsonb_array_elements(x->'channels'))<>v_manifest_count
    or exists(select 1 from jsonb_array_elements(x->'channels') c
      where not exists(select 1 from public.sales_draft_channel_manifests m
        where m.draft_id=p_draft and m.sales_channel_id=(c->>'sales_channel_id')::uuid))) then
    raise exception '초안에 허용된 판매 채널 전체 수량을 보내 주세요' using errcode='45043',detail='DRAFT_CHANNEL_TARGET_INCOMPLETE';
  end if;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_expected_etc from public.sales_draft_etc_lines where draft_id=p_draft;
  select coalesce(array_agg((x->>'id')::uuid order by (x->>'id')::uuid),'{}'::uuid[]) into v_supplied_etc from jsonb_array_elements(p_etc_items) x;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_expected_extra from public.sales_draft_expense_lines where draft_id=p_draft;
  select coalesce(array_agg((x->>'id')::uuid order by (x->>'id')::uuid),'{}'::uuid[]) into v_supplied_extra from jsonb_array_elements(p_extra_items) x;
  if exists(select 1 from unnest(v_expected_etc) id where not id=any(v_supplied_etc))
     or exists(select 1 from unnest(v_expected_extra) id where not id=any(v_supplied_extra)) then
    raise exception '기존 기타 매출과 추가 지출은 삭제 표시를 포함해 모두 보내 주세요' using errcode='45043',detail='DRAFT_TARGET_INCOMPLETE';
  end if;

  delete from public.sales_draft_menu_lines where draft_id=p_draft;
  insert into public.sales_draft_menu_lines(id,draft_id,recipe_id,menu_name,qty_hall,qty_delivery,qty_takeout,qty_waste,deleted,sort_order)
  select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),p_draft,(x->>'recipe_id')::uuid,
    coalesce(nullif(x->>'menu_name',''),r.name),
    case when jsonb_typeof(x->'channels')='array' then coalesce((select sum((c->>'quantity')::numeric)
      from jsonb_array_elements(x->'channels') c join public.sales_channels ch on ch.id=(c->>'sales_channel_id')::uuid
      where ch.code not in ('delivery','takeout')),0) else coalesce((x->>'qty_hall')::numeric,0) end,
    case when jsonb_typeof(x->'channels')='array' then coalesce((select sum((c->>'quantity')::numeric)
      from jsonb_array_elements(x->'channels') c join public.sales_channels ch on ch.id=(c->>'sales_channel_id')::uuid where ch.code='delivery'),0)
      else coalesce((x->>'qty_delivery')::numeric,0) end,
    case when jsonb_typeof(x->'channels')='array' then coalesce((select sum((c->>'quantity')::numeric)
      from jsonb_array_elements(x->'channels') c join public.sales_channels ch on ch.id=(c->>'sales_channel_id')::uuid where ch.code='takeout'),0)
      else coalesce((x->>'qty_takeout')::numeric,0) end,
    coalesce((x->>'qty_waste')::numeric,0),coalesce((x->>'deleted')::boolean,false),ord::integer
  from jsonb_array_elements(p_items) with ordinality a(x,ord)
  join public.recipes r on r.id=(x->>'recipe_id')::uuid and r.store_id=p_store;

  if v_dynamic then
    delete from public.sales_draft_menu_channel_quantities q using public.sales_draft_menu_lines m
      where q.draft_menu_line_id=m.id and m.draft_id=p_draft;
    insert into public.sales_draft_menu_channel_quantities(draft_menu_line_id,sales_channel_id,quantity)
    select m.id,(c->>'sales_channel_id')::uuid,coalesce((c->>'quantity')::numeric,0)
    from jsonb_array_elements(p_items) x join public.sales_draft_menu_lines m
      on m.draft_id=p_draft and m.recipe_id=(x->>'recipe_id')::uuid
    cross join lateral jsonb_array_elements(x->'channels') c;
  end if;

  delete from public.sales_draft_etc_lines where draft_id=p_draft;
  insert into public.sales_draft_etc_lines(id,draft_id,name,price,qty,channel,sales_channel_id,deleted,sort_order)
  select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),p_draft,coalesce(nullif(x->>'name',''),'기타 매출'),
    coalesce((x->>'price')::numeric,0),coalesce((x->>'qty')::numeric,1),coalesce(nullif(x->>'channel',''),''),
    case when nullif(x->>'sales_channel_id','') is not null then (x->>'sales_channel_id')::uuid
      else (select id from public.sales_channels c where c.store_id=p_store and c.code=nullif(x->>'channel','')) end,
    coalesce((x->>'deleted')::boolean,false),ord::integer
  from jsonb_array_elements(p_etc_items) with ordinality a(x,ord);
  if exists(select 1 from public.sales_draft_etc_lines e left join public.sales_draft_channel_manifests m
    on m.draft_id=e.draft_id and m.sales_channel_id=e.sales_channel_id
    where e.draft_id=p_draft and not e.deleted and m.sales_channel_id is null) then
    raise exception '기타 매출의 판매 채널을 선택해 주세요' using errcode='22000',detail='ETC_SALES_CHANNEL_REQUIRED';
  end if;
  delete from public.sales_draft_expense_lines where draft_id=p_draft;
  insert into public.sales_draft_expense_lines(id,draft_id,name,amount,memo,deleted,sort_order)
  select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),p_draft,coalesce(nullif(x->>'name',''),'추가 지출'),
    coalesce((x->>'amount')::numeric,0),x->>'memo',coalesce((x->>'deleted')::boolean,false),ord::integer
  from jsonb_array_elements(p_extra_items) with ordinality a(x,ord);
  perform public.assert_sales_draft_sellable(p_store,p_draft);
  v_payload:=public.sales_draft_payload(p_draft);
  update public.sales_day_drafts set status='editing',channel_storage_version=2,draft_revision=draft_revision+1,
    payload_hash=public.sales_json_sha256(v_payload),last_saved_by=auth.uid(),last_saved_at=clock_timestamp()
  where id=p_draft returning * into v_draft;
  return jsonb_build_object('draft_id',v_draft.id,'business_date',v_draft.business_date,'kind',v_draft.draft_kind,
    'status',v_draft.status,'revision',v_draft.draft_revision,'payload_hash',v_draft.payload_hash,
    'expires_at',v_draft.expires_at,'last_saved_at',v_draft.last_saved_at,'payload',v_payload);
end $fn$;

-- 0128은 국제 기타매출 snapshot의 quantity 대신 qty만 읽었다.
-- frozen snapshot을 권위로 normalized projection을 다시 만들어 이미 잘못 이관된 수량도 복구한다.
delete from public.daily_sales_etc_lines e
using public.daily_sales d
where e.daily_sales_id=d.id and d.etc_tax_snapshot is not null;

insert into public.daily_sales_etc_lines(
  id,daily_sales_id,store_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,
  name_snapshot,unit_price,quantity,tax_snapshot)
select coalesce(nullif(x.line->>'id','')::uuid,gen_random_uuid()),d.id,d.store_id,
  coalesce(nullif(x.line->>'sales_channel_id','')::uuid,c.id),
  coalesce(nullif(x.line->>'channel_code',''),nullif(x.line->>'channel','')),
  coalesce(nullif(x.line->>'channel_name',''),c.name,'채널 미지정'),
  coalesce(nullif(x.line->>'name',''),'기타 매출'),coalesce((x.line->>'price')::numeric,0),
  coalesce((x.line->>'quantity')::numeric,(x.line->>'qty')::numeric,1),x.line->'quote'
from public.daily_sales d
cross join lateral jsonb_array_elements(coalesce(d.etc_tax_snapshot->'lines','[]'::jsonb)) x(line)
left join public.sales_channels c on c.store_id=d.store_id
  and c.code=coalesce(nullif(x.line->>'channel_code',''),nullif(x.line->>'channel',''))
where d.etc_tax_snapshot is not null;

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
    select x.name,x.rate_pct,x.rounded_amount,'menu'::text
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      join public.daily_sales_item_tax_snapshots s on s.daily_sales_item_id=it.id
      join public.daily_sales_item_tax_component_snapshots x on x.sales_tax_snapshot_id=s.id
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
      and not exists(select 1 from public.daily_sales_item_channel_tax_snapshots_v2 v
        where v.daily_sales_item_id=s.daily_sales_item_id
          and v.channel_code_snapshot=s.sales_channel_code::text)
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


create or replace function public.assert_sales_draft_sellable(p_store uuid,p_draft uuid)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_name text;
  v_kind public.sales_draft_kind;
  v_date date;
begin
  select draft_kind,business_date into v_kind,v_date
  from public.sales_day_drafts where id=p_draft and store_id=p_store;

  select m.menu_name into v_name
    from public.sales_draft_menu_lines m
    left join public.recipes r on r.id=m.recipe_id and r.store_id=p_store
   where m.draft_id=p_draft and not m.deleted
     and (case when exists (
       select 1 from public.sales_draft_menu_channel_quantities q
        where q.draft_menu_line_id=m.id
     ) then coalesce((select sum(q.quantity) from public.sales_draft_menu_channel_quantities q
        where q.draft_menu_line_id=m.id),0)
     else m.qty_hall+m.qty_delivery+m.qty_takeout end)
       > case when v_kind='amendment' then coalesce((
           select sum(public.sales_item_total_quantity(it.id))
           from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
           where ds.store_id=p_store and ds.sale_date=v_date and it.recipe_id=m.recipe_id),0)
         else 0 end
     and (r.id is null or not coalesce(r.active,false) or r.deleted_at is not null)
   order by m.sort_order,m.id limit 1;
  if found then
    raise exception '%은(는) 판매 중지되었거나 삭제된 메뉴예요. 기존 수량보다 늘릴 수 없어요',v_name
      using errcode='22000',detail='DRAFT_MENU_NOT_SELLABLE';
  end if;
end $fn$;

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
      where o.recipe_id=new.recipe_id and o.tax_profile_id=v_profile.id
        and o.effective_from<=v_sales.sale_date
      order by o.effective_from desc limit 1;
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

create or replace function public.sales_authoritative_channel_profit(p_store uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_detail jsonb;
  v_channels jsonb;
  v_unallocated_fixed numeric;
  v_unallocated_waste numeric:=0;
  v_unallocated_daily_extra numeric:=0;
begin
  perform public.assert_my_store(p_store);
  v_detail:=public.sales_authoritative_range_detail(p_store,p_from,p_to);

  with direct_extra as (
    select q.sales_channel_id,
      sum(coalesce(it.unit_extra_cost,0)*q.quantity) extra_material
    from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      cross join lateral public.sales_item_channel_rows(it.id) q
    where ds.store_id=p_store and ds.sale_date between p_from and p_to
    group by q.sales_channel_id
  ), rows as (
    select ord,c,coalesce(a.extra_material,0) extra_material
    from jsonb_array_elements(coalesce(v_detail->'channels','[]'::jsonb))
      with ordinality x(c,ord)
    left join direct_extra a on a.sales_channel_id=(c->>'sales_channel_id')::uuid
  )
  select coalesce(jsonb_agg(c||jsonb_build_object(
      'extra_material_cost',extra_material,
      'waste_loss',0,
      'daily_extra',0,
      'profit',case when jsonb_typeof(c->'fixed_cost')='number'
        then (c->>'net_sales')::numeric-coalesce((c->>'material')::numeric,0)-extra_material
          -(c->>'fixed_cost')::numeric else null end)
      order by ord),'[]'::jsonb)
    into v_channels from rows;

  select
    coalesce(sum(coalesce((public.sales_effective_day_summary(p_store,d.sale_date)->>'waste_loss')::numeric,0)),0),
    coalesce(sum(coalesce((public.sales_effective_day_summary(p_store,d.sale_date)->>'daily_extra')::numeric,0)),0)
    into v_unallocated_waste,v_unallocated_daily_extra
  from (select distinct ds.sale_date from public.daily_sales ds
        where ds.store_id=p_store and ds.sale_date between p_from and p_to) d;

  v_unallocated_fixed:=(v_detail->>'fixed_cost_unallocated')::numeric;
  return jsonb_build_object(
    'channels',v_channels,
    'unassigned_revenue',coalesce((v_detail->>'unassigned_revenue')::numeric,0),
    'fixed_cost_total',v_detail->'fixed_cost_total',
    'fixed_rate_provisional',jsonb_typeof(v_detail->'fixed_cost_total') is distinct from 'number',
    'unallocated_fixed_cost',v_unallocated_fixed,
    'unallocated_waste_loss',v_unallocated_waste,
    'unallocated_daily_extra',v_unallocated_daily_extra);
end $fn$;

grant create on schema public to costkeep_rpc_executor;
alter function public.calculate_international_tax(public.tax_price_basis,smallint,public.tax_treatment,numeric,jsonb) owner to postgres;
alter function public.sales_item_channel_accounting_rows(uuid) owner to costkeep_rpc_executor;
alter function public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb) owner to costkeep_rpc_executor;
alter function public.sales_tax_breakdown(uuid,date,date) owner to costkeep_rpc_executor;
alter function public.assert_sales_draft_sellable(uuid,uuid) owner to costkeep_rpc_executor;
alter function public.refresh_dynamic_sales_item_tax() owner to postgres;
alter function public.sales_authoritative_channel_profit(uuid,date,date) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.calculate_international_tax(public.tax_price_basis,smallint,public.tax_treatment,numeric,jsonb) from public,anon,authenticated,costkeep_rpc_executor,service_role;
revoke all on function public.sales_item_channel_accounting_rows(uuid) from public,anon,authenticated;
grant execute on function public.sales_item_channel_accounting_rows(uuid) to costkeep_rpc_executor,service_role;
revoke all on function public.assert_sales_draft_sellable(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assert_sales_draft_sellable(uuid,uuid) to costkeep_rpc_executor,service_role;
revoke all on function public.refresh_dynamic_sales_item_tax() from public,anon,authenticated,costkeep_rpc_executor,service_role;
revoke all on function public.sales_authoritative_channel_profit(uuid,date,date) from public,anon,service_role;
grant execute on function public.sales_authoritative_channel_profit(uuid,date,date) to authenticated;
revoke all on function public.sales_tax_breakdown(uuid,date,date) from public,anon,authenticated;
grant execute on function public.sales_tax_breakdown(uuid,date,date) to authenticated,service_role;
revoke all on function public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb) to authenticated,service_role;
