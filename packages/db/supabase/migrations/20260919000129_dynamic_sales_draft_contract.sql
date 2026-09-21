-- 0129 · 동적 판매 채널 초안/확정 쓰기 계약
begin;

alter table public.store_tax_components add column if not exists default_remittance_owner
  public.tax_remittance_owner not null default 'merchant';

create or replace function public.sales_item_channel_rows(p_item uuid)
returns table(sales_channel_id uuid,channel_code text,channel_name text,quantity numeric)
language sql stable security definer set search_path=public,pg_temp as $fn$
  select q.sales_channel_id,q.channel_code_snapshot,q.channel_name_snapshot,q.quantity
  from public.daily_sales_item_channel_quantities q where q.daily_sales_item_id=p_item
  union all
  select c.id,c.code,c.name,case c.code when 'hall' then i.qty_hall
    when 'delivery' then i.qty_delivery else i.qty_takeout end
  from public.daily_sales_items i join public.sales_channels c on c.store_id=i.store_id
    and c.code in ('hall','delivery','takeout')
  where i.id=p_item and not exists(select 1 from public.daily_sales_item_channel_quantities q
    where q.daily_sales_item_id=p_item);
$fn$;

create or replace function public.sales_item_total_quantity(p_item uuid)
returns numeric language sql stable security definer set search_path=public,pg_temp as $fn$
  select coalesce(sum(quantity),0) from public.sales_item_channel_rows(p_item);
$fn$;

create or replace function public.sales_draft_line_channel_rows(p_line uuid)
returns table(sales_channel_id uuid,channel_code text,channel_name text,sort_order integer,quantity numeric)
language sql stable security definer set search_path=public,pg_temp as $fn$
  select m.sales_channel_id,m.channel_code_snapshot,m.channel_name_snapshot,m.sort_order,coalesce(q.quantity,0)
  from public.sales_draft_menu_lines l
  join public.sales_draft_channel_manifests m on m.draft_id=l.draft_id
  left join public.sales_draft_menu_channel_quantities q
    on q.draft_menu_line_id=l.id and q.sales_channel_id=m.sales_channel_id
  where l.id=p_line order by m.sort_order,m.sales_channel_id;
$fn$;

create or replace function public.sales_draft_payload(p_draft uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare
  v_store uuid; v_manifest jsonb; v_items jsonb; v_etc_items jsonb; v_etc_tax_items jsonb; v_extra_items jsonb;
  v_business_date date; v_menu_revenue numeric:=0; v_menu_net numeric:=0;
  v_qty numeric:=0; v_material numeric:=0; v_extra_material numeric:=0;
  v_waste numeric:=0; v_etc_revenue numeric:=0; v_etc_tax numeric:=0; v_etc_net numeric:=0;
  v_daily_extra numeric:=0; v_revenue numeric:=0; v_net numeric:=0;
  v_tax numeric:=0; v_fixed numeric:=0; v_expense numeric:=0; v_profit numeric:=0;
  v_fixed_rate numeric; v_etc_tax_rate numeric:=0; v_etc_quote jsonb;
begin
  select d.store_id,b.manifest,d.business_date into v_store,v_manifest,v_business_date
  from public.sales_day_drafts d join public.sales_basis_versions b on b.id=d.basis_version_id
  where d.id=p_draft;
  v_manifest:=coalesce(v_manifest,'{}'::jsonb);
  v_fixed_rate:=nullif(v_manifest->>'fixed_rate','')::numeric;
  v_etc_tax_rate:=coalesce(nullif(v_manifest->>'etc_tax_rate','')::numeric,0);

  with line_values as (
    select m.*,r.item,
      coalesce((select sum(q.quantity) from public.sales_draft_menu_channel_quantities q
        where q.draft_menu_line_id=m.id),m.qty_hall+m.qty_delivery+m.qty_takeout) sold,
      coalesce((select jsonb_agg(jsonb_build_object('sales_channel_id',x.sales_channel_id,
        'code',x.channel_code,'name',x.channel_name,'quantity',x.quantity) order by x.sort_order,x.sales_channel_id)
        from public.sales_draft_line_channel_rows(m.id) x),'[]'::jsonb) channels,
      coalesce((select sum(x.quantity) from public.sales_draft_line_channel_rows(m.id) x where x.channel_code='hall'),0) q_hall,
      coalesce((select sum(x.quantity) from public.sales_draft_line_channel_rows(m.id) x where x.channel_code='delivery'),0) q_delivery,
      coalesce((select sum(x.quantity) from public.sales_draft_line_channel_rows(m.id) x where x.channel_code='takeout'),0) q_takeout
    from public.sales_draft_menu_lines m
    cross join lateral (select v_manifest#>array['recipes',m.recipe_id::text] item) r
    where m.draft_id=p_draft
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'recipe_id',recipe_id,'menu_name',menu_name,
      'price',coalesce((item->>'price')::numeric,0),'channels',channels,
      'qty_hall',q_hall,'qty_delivery',q_delivery,'qty_takeout',q_takeout,
      'qty_waste',qty_waste,'deleted',deleted) order by sort_order,id),'[]'::jsonb),
    coalesce(sum(case when deleted then 0 else sold end*coalesce((item->>'customer_total')::numeric,(item->>'price')::numeric,0)),0),
    coalesce(sum(case when deleted then 0 else sold end),0),
    coalesce(sum(case when deleted then 0 else sold end*coalesce((item->>'net_sales')::numeric,
      (item->>'price')::numeric-coalesce((item->>'tax')::numeric,0),(item->>'price')::numeric,0)),0),
    coalesce(sum(case when deleted then 0 else sold end*coalesce((item->>'material_cost')::numeric,0)),0),
    coalesce(sum(case when deleted then 0 else sold end*coalesce((item->>'extra_cost')::numeric,0)),0),
    coalesce(sum(case when deleted then 0 else qty_waste end*coalesce((item->>'waste_material_cost')::numeric,
      (item->>'material_cost')::numeric,0)),0)
  into v_items,v_menu_revenue,v_qty,v_menu_net,v_material,v_extra_material,v_waste from line_values;

  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'price',e.price,'qty',e.qty,
      'sales_channel_id',e.sales_channel_id,'channel',e.channel,'channel_name',e.channel_name_snapshot,
      'deleted',e.deleted) order by e.sort_order,e.id),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'price',e.price,'qty',e.qty,
      'channel',case when e.channel in ('hall','delivery','takeout') then e.channel else 'hall' end,
      'deleted',e.deleted) order by e.sort_order,e.id),'[]'::jsonb),
    coalesce(sum(case when e.deleted then 0 else e.price*e.qty end),0)
  into v_etc_items,v_etc_tax_items,v_etc_revenue
  from public.sales_draft_etc_lines e where e.draft_id=p_draft;

  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'amount',x.amount,
      'memo',x.memo,'deleted',x.deleted) order by x.sort_order,x.id),'[]'::jsonb),
    coalesce(sum(case when x.deleted then 0 else x.amount end),0)
  into v_extra_items,v_daily_extra from public.sales_draft_expense_lines x where x.draft_id=p_draft;

  v_etc_quote:=public.sales_etc_tax_quote(v_store,v_business_date,v_etc_tax_items);
  if coalesce((v_etc_quote->>'applied')::boolean,false) then
    v_etc_tax:=coalesce((v_etc_quote->>'tax_total')::numeric,0);
    v_etc_net:=coalesce((v_etc_quote->>'net_sales')::numeric,0);
  else
    v_etc_tax:=round(v_etc_revenue*v_etc_tax_rate,2); v_etc_net:=v_etc_revenue-v_etc_tax;
  end if;
  v_revenue:=v_menu_revenue+v_etc_revenue; v_net:=v_menu_net+v_etc_net; v_tax:=v_revenue-v_net;
  v_fixed:=case when v_fixed_rate is null then null else v_revenue*v_fixed_rate end;
  v_profit:=case when v_fixed is null then null else v_net-v_material-v_extra_material-v_waste-v_daily_extra-v_fixed end;
  v_expense:=case when v_profit is null then null else v_revenue-v_profit end;
  return jsonb_build_object('channel_contract_version',2,'items',v_items,'etc_items',v_etc_items,
    'extra_items',v_extra_items,'channels',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.sales_channel_id,'code',m.channel_code_snapshot,'name',m.channel_name_snapshot,'sort_order',m.sort_order)
      order by m.sort_order,m.sales_channel_id) from public.sales_draft_channel_manifests m where m.draft_id=p_draft),'[]'::jsonb),
    'summary',jsonb_build_object('from',v_business_date,'to',v_business_date,'days',1,
      'revenue',v_revenue,'etc_revenue',v_etc_revenue,'qty',v_qty,'material_cost',v_material,
      'extra_material_cost',v_extra_material,'tax',v_tax,'waste_loss',v_waste,
      'waste_ingredient',0,'waste_menu',v_waste,'daily_extra',v_daily_extra,
      'fixed_cost',v_fixed,'fixed_rate',v_fixed_rate,'fixed_rate_provisional',v_fixed_rate is null,
      'expense',v_expense,'profit',v_profit,
      'expense_rate',case when v_expense is null or v_revenue=0 then null else v_expense/v_revenue end,
      'profit_rate',case when v_profit is null or v_revenue=0 then null else v_profit/v_revenue end));
end $fn$;

-- 동적 채널 수량이 권위이므로 판매 중지/삭제 메뉴 검증도 채널 행 전체를 본다.
-- 전환 전 초안은 채널 행이 없을 수 있어 기존 3개 수량 열을 호환 경로로 유지한다.
create or replace function public.assert_sales_draft_sellable(p_store uuid,p_draft uuid)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_name text;
begin
  select m.menu_name into v_name
    from public.sales_draft_menu_lines m
    left join public.recipes r on r.id=m.recipe_id and r.store_id=p_store
   where m.draft_id=p_draft and not m.deleted
     and (case when exists (
       select 1 from public.sales_draft_menu_channel_quantities q
        where q.draft_menu_line_id=m.id
     ) then coalesce((
       select sum(q.quantity) from public.sales_draft_menu_channel_quantities q
        where q.draft_menu_line_id=m.id
     ),0) else m.qty_hall+m.qty_delivery+m.qty_takeout end)>0
     and (r.id is null or not coalesce(r.active,false) or r.deleted_at is not null)
   order by m.sort_order,m.id limit 1;
  if found then
    raise exception '%은(는) 판매 중지되었거나 삭제된 메뉴예요. 수량을 0으로 바꿔 주세요',v_name
      using errcode='22000',detail='DRAFT_MENU_NOT_SELLABLE';
  end if;
end $fn$;

alter function public.assert_sales_draft_sellable(uuid,uuid) owner to costkeep_rpc_executor;
revoke all on function public.assert_sales_draft_sellable(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assert_sales_draft_sellable(uuid,uuid) to costkeep_rpc_executor,service_role;

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
  select coalesce(bool_and(jsonb_typeof(x->'channels')='array'),false) into v_dynamic from jsonb_array_elements(p_items) x;
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

create or replace function public.sales_draft_matches_committed(p_draft uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $fn$
  with d as (select store_id,business_date from public.sales_day_drafts where id=p_draft),
  draft_menu as (select m.recipe_id,q.sales_channel_id,sum(case when m.deleted then 0 else q.quantity end) quantity
    from public.sales_draft_menu_lines m join public.sales_draft_menu_channel_quantities q on q.draft_menu_line_id=m.id
    where m.draft_id=p_draft group by m.recipe_id,q.sales_channel_id),
  committed_menu as (select i.recipe_id,q.sales_channel_id,sum(q.quantity) quantity from d
    join public.daily_sales s on s.store_id=d.store_id and s.sale_date=d.business_date
    join public.daily_sales_items i on i.daily_sales_id=s.id
    join public.daily_sales_item_channel_quantities q on q.daily_sales_item_id=i.id group by i.recipe_id,q.sales_channel_id),
  menu_diff as (select 1 from draft_menu x full join committed_menu y using(recipe_id,sales_channel_id)
    where coalesce(x.quantity,0)<>coalesce(y.quantity,0)),
  waste_diff as (select 1 from (select recipe_id,sum(case when deleted then 0 else qty_waste end) q
    from public.sales_draft_menu_lines where draft_id=p_draft group by recipe_id) x full join
    (select i.recipe_id,sum(i.qty_waste) q from d join public.daily_sales s on s.store_id=d.store_id and s.sale_date=d.business_date
      join public.daily_sales_items i on i.daily_sales_id=s.id group by i.recipe_id) y using(recipe_id)
    where coalesce(x.q,0)<>coalesce(y.q,0)),
  draft_etc as (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (select jsonb_build_object(
    'name',e.name,'price',e.price,'qty',e.qty,'sales_channel_id',e.sales_channel_id) v
    from public.sales_draft_etc_lines e where e.draft_id=p_draft and not e.deleted) q),
  committed_etc as (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (select jsonb_build_object(
    'name',e.name_snapshot,'price',e.unit_price,'qty',e.quantity,'sales_channel_id',e.sales_channel_id) v
    from d join public.daily_sales s on s.store_id=d.store_id and s.sale_date=d.business_date
    join public.daily_sales_etc_lines e on e.daily_sales_id=s.id) q),
  draft_extra as (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (select jsonb_build_object(
    'name',x.name,'amount',x.amount,'memo',coalesce(x.memo,'')) v from public.sales_draft_expense_lines x
    where x.draft_id=p_draft and not x.deleted) q),
  committed_extra as (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (select jsonb_build_object(
    'name',coalesce(x->>'name','추가 지출'),'amount',coalesce((x->>'amount')::numeric,0),'memo',coalesce(x->>'memo','')) v
    from d join public.daily_sales s on s.store_id=d.store_id and s.sale_date=d.business_date
    cross join lateral jsonb_array_elements(coalesce(s.extra_items,'[]'::jsonb)) x) q)
  select not exists(select 1 from menu_diff) and not exists(select 1 from waste_diff)
    and (select value from draft_etc)=(select value from committed_etc)
    and (select value from draft_extra)=(select value from committed_extra);
$fn$;

-- finalize 내부의 e10 호출 전에 현재 초안 id를 설정하고, item trigger가 정확한 채널 행을 만든다.
create or replace function public.sales_sync_final_item_channels()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_draft uuid:=nullif(current_setting('costkeep.sales_dynamic_draft_id',true),'')::uuid; v_line uuid;
begin
  if v_draft is null then return new; end if;
  select id into v_line from public.sales_draft_menu_lines where draft_id=v_draft and recipe_id=new.recipe_id;
  if v_line is null then return new; end if;
  delete from public.daily_sales_item_channel_quantities where daily_sales_item_id=new.id;
  insert into public.daily_sales_item_channel_quantities(daily_sales_item_id,sales_channel_id,
    channel_code_snapshot,channel_name_snapshot,quantity)
  select new.id,m.sales_channel_id,m.channel_code_snapshot,m.channel_name_snapshot,coalesce(q.quantity,0)
  from public.sales_draft_channel_manifests m left join public.sales_draft_menu_channel_quantities q
    on q.draft_menu_line_id=v_line and q.sales_channel_id=m.sales_channel_id where m.draft_id=v_draft;
  update public.daily_sales set channel_storage_version=2 where id=new.daily_sales_id;
  return new;
end $fn$;
drop trigger if exists daily_sales_items_70_dynamic_channels on public.daily_sales_items;
create trigger daily_sales_items_70_dynamic_channels after insert or update on public.daily_sales_items
for each row execute function public.sales_sync_final_item_channels();

create or replace function public.sales_sync_final_etc_lines()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_draft uuid:=nullif(current_setting('costkeep.sales_dynamic_draft_id',true),'')::uuid;
  v_boundary date;
begin
  if v_draft is null then
    -- 구형 저장 경로가 daily_sales.etc_items를 직접 갱신해도 UUID 채널 원장을 함께 만든다.
    -- 국제 세금 활성 경계 뒤에는 채널 없는 기타 매출을 매장으로 임의 추정하지 않는다.
    select activation_date into v_boundary from public.international_tax_activation_boundaries
      where store_id=new.store_id;
    if v_boundary is not null and new.sale_date>=v_boundary and exists (
      select 1 from jsonb_array_elements(coalesce(new.etc_items,'[]'::jsonb)) x
      left join public.sales_channels c on c.store_id=new.store_id and c.active
        and (c.id=nullif(x->>'sales_channel_id','')::uuid or c.code=nullif(x->>'channel',''))
      where c.id is null
    ) then
      raise exception '기타 매출의 판매 채널을 선택해 주세요'
        using errcode='22000',detail='ETC_SALES_CHANNEL_REQUIRED';
    end if;
    delete from public.daily_sales_etc_lines where daily_sales_id=new.id;
    insert into public.daily_sales_etc_lines(id,daily_sales_id,store_id,sales_channel_id,
      channel_code_snapshot,channel_name_snapshot,name_snapshot,unit_price,quantity,tax_snapshot)
    select coalesce(nullif(x->>'id','')::uuid,gen_random_uuid()),new.id,new.store_id,c.id,
      coalesce(c.code,nullif(x->>'channel','')),coalesce(c.name,'채널 미지정'),
      coalesce(nullif(x->>'name',''),'기타 매출'),coalesce((x->>'price')::numeric,0),
      coalesce((x->>'qty')::numeric,1),x->'quote'
    from jsonb_array_elements(coalesce(new.etc_items,'[]'::jsonb)) x
    left join public.sales_channels c on c.store_id=new.store_id
      and (c.id=nullif(x->>'sales_channel_id','')::uuid or c.code=nullif(x->>'channel',''));
    new.channel_storage_version:=2;
    return new;
  end if;
  delete from public.daily_sales_etc_lines where daily_sales_id=new.id;
  insert into public.daily_sales_etc_lines(id,daily_sales_id,store_id,sales_channel_id,channel_code_snapshot,
    channel_name_snapshot,name_snapshot,unit_price,quantity)
  select e.id,new.id,new.store_id,e.sales_channel_id,nullif(e.channel,''),e.channel_name_snapshot,e.name,e.price,e.qty
  from public.sales_draft_etc_lines e where e.draft_id=v_draft and not e.deleted;
  new.channel_storage_version:=2;
  return new;
end $fn$;
drop trigger if exists daily_sales_70_dynamic_etc_lines on public.daily_sales;
create trigger daily_sales_70_dynamic_etc_lines before update of etc_items on public.daily_sales
for each row execute function public.sales_sync_final_etc_lines();

create or replace function public.day_sales_detail(p_store uuid,p_date date)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $fn$
  select jsonb_build_object('channel_contract_version',2,
    'channels',coalesce((select jsonb_agg(jsonb_build_object('id',m.sales_channel_id,'code',m.channel_code_snapshot,
      'name',m.channel_name_snapshot,'sort_order',m.sort_order) order by m.sort_order,m.sales_channel_id)
      from public.sales_day_heads h join public.sales_version_channel_manifests m on m.version_id=h.current_version_id
      where h.store_id=p_store and h.business_date=p_date),
      (select jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'sort_order',c.sort_order)
        order by c.sort_order,c.id) from public.sales_channels c where c.store_id=p_store and c.active),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(jsonb_build_object('recipe_id',it.recipe_id,'name',it.menu_name,
      'channels',coalesce((select jsonb_agg(jsonb_build_object('sales_channel_id',q.sales_channel_id,
        'code',q.channel_code,'name',q.channel_name,'quantity',q.quantity) order by q.channel_code,q.sales_channel_id)
        from public.sales_item_channel_rows(it.id) q),'[]'::jsonb),
      'qty_hall',coalesce((select sum(q.quantity) from public.sales_item_channel_rows(it.id) q where q.channel_code='hall'),0),
      'qty_delivery',coalesce((select sum(q.quantity) from public.sales_item_channel_rows(it.id) q where q.channel_code='delivery'),0),
      'qty_takeout',coalesce((select sum(q.quantity) from public.sales_item_channel_rows(it.id) q where q.channel_code='takeout'),0),
      'qty_waste',coalesce(it.qty_waste,0)) order by it.menu_name,it.recipe_id)
      from public.daily_sales ds join public.daily_sales_items it on it.daily_sales_id=ds.id
      where ds.store_id=p_store and ds.sale_date=p_date),'[]'::jsonb),
    'etc_items',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name_snapshot,
      'price',e.unit_price,'qty',e.quantity,'sales_channel_id',e.sales_channel_id,
      'channel',e.channel_code_snapshot,'channel_name',e.channel_name_snapshot) order by e.created_at,e.id)
      from public.daily_sales ds join public.daily_sales_etc_lines e on e.daily_sales_id=ds.id
      where ds.store_id=p_store and ds.sale_date=p_date),'[]'::jsonb),
    'extra_items',coalesce((select extra_items from public.daily_sales where store_id=p_store and sale_date=p_date),'[]'::jsonb),
    'etc_revenue',coalesce((select etc_revenue from public.daily_sales where store_id=p_store and sale_date=p_date),0),
    'daily_extra',coalesce((select daily_extra from public.daily_sales where store_id=p_store and sale_date=p_date),0));
$fn$;

-- 국제 기타매출 계산은 사용자 채널에서 구성 항목의 기본 납부 주체를 사용한다.
create or replace function public.apply_international_tax_for_daily_sales(p_sales uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare
  v_cap jsonb:=public.app_capabilities(); v_test boolean:=session_user='postgres'
    and current_setting('costkeep.international_tax_force',true) is not distinct from 'owner_test'
    and current_setting('costkeep.international_tax_activation_test',true) is not distinct from 'on';
  v_sales public.daily_sales; v_market public.store_market_profiles; v_profile public.store_tax_profiles;
  v_boundary date; v_item public.daily_sales_etc_lines; v_components jsonb; v_quote jsonb;
  v_lines jsonb:='[]'::jsonb; v_total numeric:=0;
begin
  if not (v_cap#>>'{international_tax,write_enabled}')::boolean and not v_test then return jsonb_build_object('enabled',false,'changed',false); end if;
  select * into v_sales from public.daily_sales where id=p_sales for update;
  if v_sales.id is null then raise exception '기타매출 장부를 찾을 수 없어요' using errcode='22000',detail='DAILY_SALES_NOT_FOUND'; end if;
  select activation_date into v_boundary from public.international_tax_activation_boundaries where store_id=v_sales.store_id;
  if v_boundary is null or v_sales.sale_date<v_boundary then return jsonb_build_object('enabled',true,'changed',false,
    'reason',case when v_boundary is null then 'not_activated' else 'before_activation' end); end if;
  select * into v_market from public.store_market_profiles m where m.store_id=v_sales.store_id
    and v_sales.sale_date>=m.effective_from and (m.effective_to is null or v_sales.sale_date<=m.effective_to);
  select * into v_profile from public.store_tax_profiles t where t.store_id=v_sales.store_id and t.market_profile_id=v_market.id
    and v_sales.sale_date>=t.effective_from and (t.effective_to is null or v_sales.sale_date<=t.effective_to);
  if v_market.id is null or v_profile.id is null then raise exception '기타매출 판매일의 국제 세금 프로필을 찾을 수 없어요'
    using errcode='45013',detail='TAX_PROFILE_NOT_AVAILABLE'; end if;
  for v_item in select * from public.daily_sales_etc_lines where daily_sales_id=p_sales order by created_at,id loop
    select jsonb_agg(jsonb_build_object('component_id',c.id,'kind',c.kind,'name',c.name,'rate_pct',c.rate_pct,
      'jurisdiction_level',c.jurisdiction_level,'calculation_basis',c.calculation_basis,
      'applies_to_treatments',to_jsonb(c.applies_to_treatments),'remittance_owner',coalesce(r.remittance_owner,c.default_remittance_owner))
      order by c.sort_order,c.id) into v_components
    from public.store_tax_components c left join public.channel_tax_remittance r on r.tax_component_id=c.id
      and r.store_id=c.store_id and r.sales_channel_code::text=v_item.channel_code_snapshot where c.tax_profile_id=v_profile.id;
    if v_components is null then raise exception '기타매출 세금 구성 항목이 완결되지 않았어요' using errcode='45013',detail='TAX_PROFILE_INCOMPLETE'; end if;
    v_quote:=public.calculate_international_tax(v_market.price_basis,public.international_currency_minor_unit(v_market.currency_code),
      v_profile.default_treatment,v_item.unit_price*v_item.quantity,v_components);
    v_total:=v_total+(v_quote->>'tax_total')::numeric;
    update public.daily_sales_etc_lines set tax_snapshot=v_quote where id=v_item.id;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_item.id,'name',v_item.name_snapshot,
      'sales_channel_id',v_item.sales_channel_id,'channel',v_item.channel_code_snapshot,
      'channel_name',v_item.channel_name_snapshot,'price',v_item.unit_price,'quantity',v_item.quantity,'quote',v_quote));
  end loop;
  update public.daily_sales set etc_tax=v_total,etc_tax_calculation_version='international_tax_v1',
    etc_tax_snapshot=jsonb_build_object('calculation_version','international_tax_v1','market_profile_id',v_market.id,
      'market_profile_revision',v_market.revision,'tax_profile_id',v_profile.id,'tax_profile_revision',v_profile.revision,
      'country_code',v_market.country_code,'region_code',v_market.region_code,'currency_code',v_market.currency_code,
      'minor_unit',public.international_currency_minor_unit(v_market.currency_code),'price_basis',v_market.price_basis,
      'treatment',v_profile.default_treatment,'lines',v_lines,'tax_total',v_total) where id=p_sales;
  return jsonb_build_object('enabled',true,'changed',true,'tax_total',v_total,'lines',v_lines);
end $fn$;

-- 기존 finalize 몸통은 보존하고, 초안 context를 trigger에 전달한다.
alter function public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text)
  rename to finalize_sales_draft_legacy_0129;
create or replace function public.finalize_sales_draft(p_store uuid,p_draft uuid,p_base_revision integer,
  p_request_key uuid,p_payload_hash text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_result jsonb; v_version uuid;
begin
  perform set_config('costkeep.sales_dynamic_draft_id',p_draft::text,true);
  v_result:=public.finalize_sales_draft_legacy_0129(p_store,p_draft,p_base_revision,p_request_key,p_payload_hash,p_reason);
  v_version:=nullif(v_result->>'version_id','')::uuid;
  if v_version is not null then
    insert into public.sales_version_channel_manifests(version_id,sales_channel_id,channel_code_snapshot,channel_name_snapshot,sort_order)
    select v_version,m.sales_channel_id,m.channel_code_snapshot,m.channel_name_snapshot,m.sort_order
    from public.sales_draft_channel_manifests m where m.draft_id=p_draft on conflict do nothing;
    update public.sales_day_versions set channel_storage_version=2 where id=v_version;
  end if;
  return v_result;
end $fn$;

grant create on schema public to costkeep_rpc_executor;
alter function public.sales_item_channel_rows(uuid) owner to costkeep_rpc_executor;
alter function public.sales_item_total_quantity(uuid) owner to costkeep_rpc_executor;
alter function public.sales_draft_line_channel_rows(uuid) owner to costkeep_rpc_executor;
alter function public.sales_draft_payload(uuid) owner to costkeep_rpc_executor;
alter function public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb) owner to costkeep_rpc_executor;
alter function public.sales_draft_matches_committed(uuid) owner to costkeep_rpc_executor;
alter function public.sales_sync_final_item_channels() owner to costkeep_rpc_executor;
-- 활성 경계 원장은 앱 역할에 닫혀 있으므로 이 내부 trigger만 postgres 권위로 읽는다.
alter function public.sales_sync_final_etc_lines() owner to postgres;
alter function public.day_sales_detail(uuid,date) owner to costkeep_rpc_executor;
alter function public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

revoke all on function public.sales_item_channel_rows(uuid),public.sales_item_total_quantity(uuid),
  public.sales_draft_line_channel_rows(uuid),public.sales_draft_payload(uuid),
  public.sales_draft_matches_committed(uuid),public.day_sales_detail(uuid,date),
  public.finalize_sales_draft_legacy_0129(uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.sales_sync_final_etc_lines() from public,anon,authenticated,service_role,costkeep_rpc_executor;
revoke all on function public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb),
  public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text) from public,anon,service_role;
grant execute on function public.save_sales_draft(uuid,uuid,integer,jsonb,jsonb,jsonb),
  public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text) to authenticated;
grant execute on function public.sales_item_channel_rows(uuid),public.sales_item_total_quantity(uuid),
  public.sales_draft_line_channel_rows(uuid),public.sales_draft_payload(uuid),public.sales_draft_matches_committed(uuid),
  public.day_sales_detail(uuid,date),public.finalize_sales_draft_legacy_0129(uuid,uuid,integer,uuid,text,text) to costkeep_rpc_executor;

notify pgrst,'reload schema';
commit;
