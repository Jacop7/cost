-- 0110 · 매출 작성 완료: 초안, 확정 원장, 불변 판본을 한 트랜잭션으로 묶는다.
begin;

drop function if exists public.get_sales_command_receipt(uuid,text,uuid);
create or replace function public.get_sales_command_receipt(
  p_store uuid,p_command_kind text,p_request_key uuid,p_payload_hash text
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v public.sales_command_receipts;
begin
  perform public.assert_my_store(p_store);
  select * into v from public.sales_command_receipts
   where store_id=p_store and command_kind=p_command_kind and request_key=p_request_key
     and user_id is not distinct from auth.uid();
  if not found then return null; end if;
  if v.payload_hash<>p_payload_hash then
    raise exception '같은 요청 키의 완료 내용이 달라요'
      using errcode='45021',detail='IDEMPOTENCY_PAYLOAD_MISMATCH';
  end if;
  return jsonb_build_object('payload_hash',v.payload_hash,'result',v.result,'created_at',v.created_at);
end $fn$;

create or replace function public.sales_day_accounting_summary(
  p_store uuid,p_date date,p_fixed_rate numeric
) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v jsonb; v_listed numeric:=0; v_customer numeric:=0; v_net numeric:=0; v_tax numeric:=0;
begin
  v:=public.sales_summary(p_store,p_date,p_date);
  select coalesce(sum((public.sales_item_accounting_totals(i.id)->>'listed_total')::numeric),0),
         coalesce(sum((public.sales_item_accounting_totals(i.id)->>'customer_total')::numeric),0),
         coalesce(sum((public.sales_item_accounting_totals(i.id)->>'net_sales')::numeric),0),
         coalesce(sum((public.sales_item_accounting_totals(i.id)->>'tax_total')::numeric),0)
    into v_listed,v_customer,v_net,v_tax
  from public.daily_sales ds
  join public.daily_sales_items i on i.daily_sales_id=ds.id
  where ds.store_id=p_store and ds.sale_date=p_date;
  if exists(select 1 from public.daily_sales where store_id=p_store and sale_date=p_date) then
    select v_listed+coalesce((public.daily_sales_etc_accounting_totals(ds.id)->>'listed_total')::numeric,0),
           v_customer+coalesce((public.daily_sales_etc_accounting_totals(ds.id)->>'customer_total')::numeric,0),
           v_net+coalesce((public.daily_sales_etc_accounting_totals(ds.id)->>'net_sales')::numeric,0),
           v_tax+coalesce((public.daily_sales_etc_accounting_totals(ds.id)->>'tax_total')::numeric,0)
      into v_listed,v_customer,v_net,v_tax
    from public.daily_sales ds
    where ds.store_id=p_store and ds.sale_date=p_date;
  end if;
  v:=v||jsonb_build_object('listed_total',v_listed,'customer_total',v_customer,
    'revenue',v_customer,'net_sales',v_net,'tax',v_tax,'fixed_rate',p_fixed_rate,
    'fixed_rate_provisional',p_fixed_rate is null,'uncomputed_day_count',case when p_fixed_rate is null then 1 else 0 end);
  if p_fixed_rate is null then
    v:=v||jsonb_build_object('fixed_cost',null,'profit',null,'profit_rate',null);
  else
    v:=v||jsonb_build_object('fixed_cost',v_customer*p_fixed_rate,
      'profit',v_net-coalesce((v->>'material_cost')::numeric,0)
        -coalesce((v->>'extra_material_cost')::numeric,0)
        -coalesce((v->>'waste_loss')::numeric,0)
        -coalesce((v->>'daily_extra')::numeric,0)-v_customer*p_fixed_rate,
      'profit_rate',case when v_customer=0 then null else
        (v_net-coalesce((v->>'material_cost')::numeric,0)
          -coalesce((v->>'extra_material_cost')::numeric,0)
          -coalesce((v->>'waste_loss')::numeric,0)
          -coalesce((v->>'daily_extra')::numeric,0)-v_customer*p_fixed_rate)/v_customer end);
  end if;
  return v;
end $fn$;

-- 수정 초안이 최신 확정 목표와 같은지 ID와 표시 순서에 영향받지 않고 비교한다.
create or replace function public.sales_draft_matches_committed(p_draft uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $fn$
  with d as (
    select store_id,business_date from public.sales_day_drafts where id=p_draft
  ), draft_menu as (
    select m.recipe_id,
      sum(case when m.deleted then 0 else m.qty_hall end) qty_hall,
      sum(case when m.deleted then 0 else m.qty_delivery end) qty_delivery,
      sum(case when m.deleted then 0 else m.qty_takeout end) qty_takeout,
      sum(case when m.deleted then 0 else m.qty_waste end) qty_waste
    from public.sales_draft_menu_lines m where m.draft_id=p_draft group by m.recipe_id
  ), committed_menu as (
    select i.recipe_id,sum(i.qty_hall) qty_hall,sum(i.qty_delivery) qty_delivery,
      sum(i.qty_takeout) qty_takeout,sum(coalesce(i.qty_waste,0)) qty_waste
    from d join public.daily_sales s on s.store_id=d.store_id and s.sale_date=d.business_date
    join public.daily_sales_items i on i.daily_sales_id=s.id group by i.recipe_id
  ), menu_diff as (
    select 1 from draft_menu x full join committed_menu y using(recipe_id)
    where coalesce(x.qty_hall,0)<>coalesce(y.qty_hall,0)
       or coalesce(x.qty_delivery,0)<>coalesce(y.qty_delivery,0)
       or coalesce(x.qty_takeout,0)<>coalesce(y.qty_takeout,0)
       or coalesce(x.qty_waste,0)<>coalesce(y.qty_waste,0)
  ), draft_etc as (
    select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (
      select jsonb_build_object('name',e.name,'price',e.price,'qty',e.qty,'channel',e.channel) v
      from public.sales_draft_etc_lines e where e.draft_id=p_draft and not e.deleted) q
  ), committed_etc as (
    select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (
      select jsonb_build_object('name',coalesce(x->>'name','기타 매출'),
        'price',coalesce((x->>'price')::numeric,0),'qty',coalesce((x->>'qty')::numeric,1),
        'channel',coalesce(nullif(x->>'channel',''),'hall')) v
      from d join public.daily_sales s on s.store_id=d.store_id and s.sale_date=d.business_date
      cross join lateral jsonb_array_elements(coalesce(s.etc_items,'[]'::jsonb)) x) q
  ), draft_extra as (
    select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (
      select jsonb_build_object('name',e.name,'amount',e.amount,'memo',e.memo) v
      from public.sales_draft_expense_lines e where e.draft_id=p_draft and not e.deleted) q
  ), committed_extra as (
    select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) value from (
      select jsonb_build_object('name',coalesce(x->>'name','추가 지출'),
        'amount',coalesce((x->>'amount')::numeric,0),'memo',x->>'memo') v
      from d join public.daily_sales s on s.store_id=d.store_id and s.sale_date=d.business_date
      cross join lateral jsonb_array_elements(coalesce(s.extra_items,'[]'::jsonb)) x) q
  )
  select not exists(select 1 from menu_diff)
    and (select value from draft_etc)=(select value from committed_etc)
    and (select value from draft_extra)=(select value from committed_extra);
$fn$;

create or replace function public.ensure_sales_inventory_component_baseline(p_sales_item uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $fn$
declare rec record; comp record; v_active numeric; v_gap numeric; v_piece numeric; v_batch uuid;
begin
  for rec in
    -- reported_count_delta가 논리 판매량이다. 재실사 해소 행은 물리 count_delta=0이지만
    -- 논리 소비는 남으므로 count_delta만 합치면 다음 정정에서 같은 양을 다시 차감한다.
    select e.store_id,e.ingredient_id,e.waste,
      sum(-coalesce(e.reported_count_delta,e.count_delta)) quantity,max(e.seq) source_sequence
    from public.inventory_events e where e.sales_item_id=p_sales_item
    group by e.store_id,e.ingredient_id,e.waste
    having sum(-coalesce(e.reported_count_delta,e.count_delta))>=0
  loop
    select coalesce(sum(c.quantity),0)-coalesce(sum((select sum(o.quantity)
      from public.sales_inventory_component_offsets o where o.component_id=c.id)),0)
      into v_active from public.sales_inventory_delta_components c
      where c.sales_item_id=p_sales_item and c.ingredient_id=rec.ingredient_id and c.waste=rec.waste;
    v_active:=coalesce(v_active,0);
    if rec.quantity>v_active+1e-9 then
      select b.id into v_batch from public.inventory_count_lines l
      join public.inventory_count_batches b on b.id=l.batch_id
      where l.ingredient_id=rec.ingredient_id and rec.source_sequence<=b.event_sequence_high_watermark
      order by b.counted_at desc limit 1;
      insert into public.sales_inventory_delta_components(store_id,sales_item_id,ingredient_id,waste,
        quantity,stock_effect,source_event_sequence,absorbed_by_count_batch_id)
      values (rec.store_id,p_sales_item,rec.ingredient_id,rec.waste,rec.quantity-v_active,
        case when v_batch is null then 'normal' else 'absorbed' end,rec.source_sequence,v_batch);
    elsif rec.quantity<v_active-1e-9 then
      v_gap:=v_active-rec.quantity;
      for comp in
        select c.*,c.quantity-coalesce((select sum(o.quantity)
          from public.sales_inventory_component_offsets o where o.component_id=c.id),0) available
        from public.sales_inventory_delta_components c
        where c.sales_item_id=p_sales_item and c.ingredient_id=rec.ingredient_id and c.waste=rec.waste
          and c.quantity>coalesce((select sum(o.quantity)
            from public.sales_inventory_component_offsets o where o.component_id=c.id),0)
        order by c.created_at desc,c.id desc
      loop
        exit when v_gap<=1e-9;
        v_piece:=least(v_gap,comp.available);
        insert into public.sales_inventory_component_offsets(store_id,component_id,quantity)
        values (rec.store_id,comp.id,v_piece);
        v_gap:=v_gap-v_piece;
      end loop;
    end if;
  end loop;
end $fn$;

-- 새 수명주기 전용 판매 재고 조정. 논리 소비 component와 실제 stock effect를
-- 분리해 전체 실사가 흡수한 증분이 다음 정정에서 다시 차감되지 않게 한다.
create or replace function public.reconcile_sales_consumption_components(
  p_sales_item uuid,p_zero boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  it public.daily_sales_items;
  ds public.daily_sales;
  v_sold numeric;
  v_waste numeric;
  rec record;
  comp record;
  v_delta numeric;
  v_remaining numeric;
  v_piece numeric;
  v_before numeric;
  v_taken numeric;
  v_event uuid;
  v_seq bigint;
  v_batch uuid;
  v_effect text;
  v_draft uuid;
  v_short jsonb:='[]'::jsonb;
  v_lines integer:=0;
begin
  select * into it from public.daily_sales_items where id=p_sales_item for update;
  if not found then raise exception '판매 재고 행을 찾을 수 없어요' using errcode='P0002'; end if;
  select * into ds from public.daily_sales where id=it.daily_sales_id;
  v_sold:=case when p_zero or it.recipe_id is null then 0 else it.qty_hall+it.qty_delivery+it.qty_takeout end;
  v_waste:=case when p_zero or it.recipe_id is null then 0 else coalesce(it.qty_waste,0) end;
  v_draft:=nullif(current_setting('costkeep.sales_resolved_draft',true),'')::uuid;
  perform public.ensure_sales_inventory_component_baseline(p_sales_item);

  for rec in
    with target as (
      select n.ingredient_id,false waste,sum(n.amount) need
      from public.day_stock_needs(ds.store_id,ds.sale_date,it.recipe_id,v_sold) n group by 1
      union all
      select n.ingredient_id,true,sum(n.amount)
      from public.day_stock_needs(ds.store_id,ds.sale_date,it.recipe_id,v_waste) n group by 1
    ), applied as (
      select c.ingredient_id,c.waste,
        sum(c.quantity)-coalesce(sum((select sum(o.quantity)
          from public.sales_inventory_component_offsets o where o.component_id=c.id)),0) taken
      from public.sales_inventory_delta_components c
      where c.sales_item_id=p_sales_item group by c.ingredient_id,c.waste
    )
    select coalesce(t.ingredient_id,a.ingredient_id) ingredient_id,
      coalesce(t.waste,a.waste) waste,coalesce(t.need,0) need,coalesce(a.taken,0) taken,i.name
    from target t full join applied a using(ingredient_id,waste)
    join public.ingredients i on i.id=coalesce(t.ingredient_id,a.ingredient_id)
  loop
    v_delta:=rec.need-rec.taken;
    if abs(v_delta)<1e-9 then continue; end if;
    if v_delta>0 then
      v_batch:=null;
      if current_setting('costkeep.sales_inventory_resolved',true)='on' then
        select p.resolved_by_count_batch_id into v_batch
        from public.pending_sales_inventory_resolution p
        where p.draft_id=v_draft and p.ingredient_id=rec.ingredient_id
          and p.waste=rec.waste and p.status='resolved'
        order by p.created_at desc limit 1;
        if v_batch is null then
          raise exception '재실사 해소 정보를 찾을 수 없어요'
            using errcode='45036',detail='RESOLVED_COMPONENT_BATCH_MISSING';
        end if;
        insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
          volume_delta,sales_item_id,waste,note,occurred_at,business_day_id,stock_effect,
          resolved_by_count_batch_id,unit_normalized)
        values (it.store_id,rec.ingredient_id,
          (case when rec.waste then 'discard' else 'consume' end)::public.inventory_event_type,
          0,-v_delta,case when rec.waste then v_delta end,p_sales_item,rec.waste,
          it.menu_name||' 재실사 반영 판매 조정',clock_timestamp(),ds.business_day_id,
          'resolved_by_count',v_batch,true)
        returning id,seq into v_event,v_seq;
        v_effect:='resolved_by_count';
      else
        v_before:=public.stock_total_base(rec.ingredient_id);
        v_taken:=public.consume_stock(rec.ingredient_id,v_delta,true);
        if v_delta>v_before then
          v_short:=v_short||jsonb_build_array(jsonb_build_object('ingredient_id',rec.ingredient_id,
            'name',rec.name,'needed',v_delta,'available',v_before,'shortage',v_delta-v_before,
            'stock_after',v_before-v_delta));
        end if;
        insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
          volume_delta,sales_item_id,waste,note,occurred_at,business_day_id,stock_effect,unit_normalized)
        values (it.store_id,rec.ingredient_id,
          (case when rec.waste then 'discard' else 'consume' end)::public.inventory_event_type,
          -v_taken,-v_delta,case when rec.waste then v_delta end,p_sales_item,rec.waste,
          it.menu_name||case when rec.waste then ' 조리 후 폐기' else ' 판매 소진' end,
          clock_timestamp(),ds.business_day_id,'normal',true)
        returning id,seq into v_event,v_seq;
        v_effect:='normal';
      end if;
      insert into public.sales_inventory_delta_components(store_id,sales_item_id,ingredient_id,waste,
        quantity,stock_effect,source_event_id,source_event_sequence,resolved_by_count_batch_id)
      values (it.store_id,p_sales_item,rec.ingredient_id,rec.waste,v_delta,v_effect,v_event,v_seq,v_batch);
    else
      v_remaining:=-v_delta;
      for comp in
        select c.*,c.quantity-coalesce((select sum(o.quantity)
          from public.sales_inventory_component_offsets o where o.component_id=c.id),0) available
        from public.sales_inventory_delta_components c
        where c.sales_item_id=p_sales_item and c.ingredient_id=rec.ingredient_id and c.waste=rec.waste
          and c.quantity>coalesce((select sum(o.quantity)
            from public.sales_inventory_component_offsets o where o.component_id=c.id),0)
        order by c.created_at desc,c.id desc
      loop
        exit when v_remaining<=1e-9;
        perform 1 from public.sales_inventory_delta_components where id=comp.id for update;
        v_piece:=least(v_remaining,comp.available);
        if comp.stock_effect='normal' then
          perform public.restore_stock(rec.ingredient_id,v_piece);
          insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
            sales_item_id,waste,note,occurred_at,business_day_id,stock_effect,unit_normalized)
          values (it.store_id,rec.ingredient_id,'adjust',v_piece,v_piece,p_sales_item,rec.waste,
            it.menu_name||' 판매 수량 감소',clock_timestamp(),ds.business_day_id,'normal',true)
          returning id into v_event;
        else
          insert into public.inventory_events(store_id,ingredient_id,type,count_delta,reported_count_delta,
            sales_item_id,waste,note,occurred_at,business_day_id,stock_effect,
            absorbed_by_count_batch_id,resolved_by_count_batch_id,unit_normalized)
          values (it.store_id,rec.ingredient_id,'adjust',0,v_piece,p_sales_item,rec.waste,
            it.menu_name||' 실사 흡수 판매 수량 감소',clock_timestamp(),ds.business_day_id,
            comp.stock_effect,comp.absorbed_by_count_batch_id,comp.resolved_by_count_batch_id,true)
          returning id into v_event;
        end if;
        insert into public.sales_inventory_component_offsets(store_id,component_id,quantity,inventory_event_id)
        values (it.store_id,comp.id,v_piece,v_event);
        v_remaining:=v_remaining-v_piece;
      end loop;
      if v_remaining>1e-9 then
        raise exception '판매 재고 component가 목표 수량과 맞지 않아요'
          using errcode='23514',detail='SALES_COMPONENT_UNDERFLOW';
      end if;
    end if;
    perform public.refresh_order_candidate(rec.ingredient_id);
    v_lines:=v_lines+1;
  end loop;
  return jsonb_build_object('sales_item_id',p_sales_item,'lines',v_lines,
    'sold_qty',v_sold,'waste_qty',v_waste,'shortages',v_short,'component_ledger',true);
end $fn$;

create or replace function public.finalize_sales_draft(
  p_store uuid,p_draft uuid,p_base_revision integer,
  p_request_key uuid,p_payload_hash text,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
  v_draft public.sales_day_drafts;
  v_receipt public.sales_command_receipts;
  v_items jsonb;
  v_etc jsonb;
  v_extra jsonb;
  v_write jsonb;
  v_detail jsonb;
  v_summary jsonb;
  v_day public.business_days;
  v_ledger_revision integer;
  v_version_no integer;
  v_version public.sales_day_versions;
  v_fixed_rate numeric;
  v_result jsonb;
  v_current_detail jsonb;
  v_cutoff date;
  v_basis public.sales_basis_versions;
  v_inventory_resolved boolean:=false;
  v_sales uuid;
  v_current_revision integer;
  v_head public.sales_day_heads;
begin
  perform public.assert_my_store(p_store);
  if p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception '올바르지 않은 요청 해시예요' using errcode='22000',detail='INVALID_PAYLOAD_HASH';
  end if;
  perform public.lock_store_write_scope(p_store);
  perform public.expire_inventory_count_session(p_store);
  if exists(select 1 from public.inventory_count_sessions where store_id=p_store and status='active') then
    raise exception '재고 실사 중에는 매출 작성을 완료할 수 없어요'
      using errcode='45027',detail='INVENTORY_COUNT_ACTIVE';
  end if;
  if not exists(select 1 from public.sales_lifecycle_cutover_state
                where store_id=p_store and phase='active') then
    raise exception '매출 전환 확인이 필요해요'
      using errcode='45040',detail='SALES_LIFECYCLE_NOT_ACTIVE';
  end if;

  select * into v_receipt from public.sales_command_receipts
   where store_id=p_store and command_kind='finalize_sales_draft' and request_key=p_request_key
   for update;
  if found then
    if v_receipt.user_id is distinct from auth.uid() then
      raise exception '이 완료 요청을 확인할 권한이 없어요'
        using errcode='42501',detail='COMMAND_RECEIPT_OWNER_MISMATCH';
    end if;
    if v_receipt.payload_hash<>p_payload_hash then
      raise exception '같은 요청 키의 완료 내용이 달라요'
        using errcode='45021',detail='IDEMPOTENCY_PAYLOAD_MISMATCH';
    end if;
    return v_receipt.result || jsonb_build_object('duplicate',true);
  end if;

  select * into v_draft from public.sales_day_drafts where id=p_draft for update;
  if not found or v_draft.store_id<>p_store then
    raise exception '매출 초안을 찾을 수 없어요' using errcode='P0002',detail='SALES_DRAFT_NOT_FOUND';
  end if;
  if v_draft.status not in ('editing','pending_inventory_resolution') then
    raise exception '완료할 수 없는 매출 초안이에요' using errcode='45041',detail='SALES_DRAFT_NOT_EDITABLE';
  end if;
  if v_draft.business_date<public.sales_editable_from(p_store) then
    update public.sales_day_drafts set status='expired' where id=p_draft;
    update public.pending_sales_inventory_resolution
       set status='abandoned'
     where draft_id=p_draft and status='pending';
    return jsonb_build_object('draft_id',p_draft,'business_date',v_draft.business_date,
      'status','expired','duplicate',false);
  end if;
  if v_draft.draft_revision<>p_base_revision then
    raise exception '다른 기기에서 초안이 변경됐어요'
      using errcode='45009',detail='DRAFT_REVISION_CONFLICT';
  end if;
  if v_draft.payload_hash<>p_payload_hash then
    raise exception '완료하려는 내용이 최신 초안과 달라요'
      using errcode='45009',detail='DRAFT_PAYLOAD_MISMATCH';
  end if;

  select * into v_basis from public.sales_basis_versions
   where id=v_draft.basis_version_id and store_id=p_store;
  if not found then
    raise exception '매출 계산 기준을 찾을 수 없어요'
      using errcode='P0002',detail='SALES_BASIS_NOT_FOUND';
  end if;
  perform public.assert_sales_basis_version(p_store,v_draft.basis_version_id,
    v_draft.business_date,v_draft.draft_kind='initial' and v_draft.draft_revision=0);

  select coalesce(revision,0) into v_current_revision from public.daily_sales
   where store_id=p_store and sale_date=v_draft.business_date for update;
  v_current_revision:=coalesce(v_current_revision,0);
  if v_current_revision<>v_draft.base_ledger_revision then
    raise exception '다른 기기에서 판매 내역이 변경됐어요. 최신 내역을 다시 확인해 주세요.'
      using errcode='45009',detail='REVISION_CONFLICT';
  end if;

  -- 값이 같은 수정은 감사 원장·head·완료 시각을 올리지 않고 초안과 명령만 닫는다.
  if v_draft.draft_kind='amendment' and public.sales_draft_matches_committed(p_draft) then
    select * into v_head from public.sales_day_heads
     where store_id=p_store and business_date=v_draft.business_date;
    if found then
      update public.sales_day_drafts set status='finalized',finalized_at=clock_timestamp()
       where id=p_draft;
      v_result:=jsonb_build_object('draft_id',p_draft,'status','finalized','duplicate',false,
        'no_change',true,'business_date',v_draft.business_date,
        'version_id',v_head.current_version_id,'ledger_revision',v_head.ledger_revision);
      insert into public.sales_command_receipts(store_id,user_id,command_kind,request_key,payload_hash,result)
      values (p_store,auth.uid(),'finalize_sales_draft',p_request_key,p_payload_hash,v_result);
      return v_result;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'recipe_id',m.recipe_id,'qty_hall',case when m.deleted then 0 else m.qty_hall end,
    'qty_delivery',case when m.deleted then 0 else m.qty_delivery end,
    'qty_takeout',case when m.deleted then 0 else m.qty_takeout end,
    'qty_waste',case when m.deleted then 0 else m.qty_waste end)
    order by m.sort_order,m.id),'[]'::jsonb) into v_items
  from public.sales_draft_menu_lines m where m.draft_id=p_draft;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'name',e.name,'price',e.price,'qty',e.qty,'channel',e.channel)
    order by e.sort_order,e.id) filter(where not e.deleted),'[]'::jsonb) into v_etc
  from public.sales_draft_etc_lines e where e.draft_id=p_draft;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'name',x.name,'amount',x.amount,'memo',x.memo)
    order by x.sort_order,x.id) filter(where not x.deleted),'[]'::jsonb) into v_extra
  from public.sales_draft_expense_lines x where x.draft_id=p_draft;

  -- 실사 컷오프 이전 판매 수량 정정은 현재 재고를 임의로 되감지 않는다.
  select inventory_cutoff_business_date into v_cutoff from public.stores where id=p_store;
  if v_draft.draft_kind='initial' and v_cutoff is not null
     and v_draft.business_date<=v_cutoff then
    raise exception '재고 실사에 포함된 날짜의 매출은 새로 완료할 수 없어요'
      using errcode='45052',detail='SALES_INITIAL_BEFORE_INVENTORY_CUTOFF';
  end if;
  -- 실사 뒤 과거 판매를 줄이는 정정은 component 원장의 최신순 상쇄로 처리한다.
  -- normal component만 E9로 복원하고 실사에 흡수된 component는 stock 0이므로 재실사가 필요 없다.
  -- 증가분은 판매일만으로 실사 전후를 추정하지 않는다. 정확한 발생 시각이 없는 과거 판매
  -- 입력은 모두 보류하고, 사용자가 시작한 후속 전체 실사가 해당 증가분을 흡수한 뒤 확정한다.
  if v_draft.draft_kind='amendment' and v_draft.business_date<=v_cutoff
     and exists(select 1 from public.sales_draft_inventory_deltas(p_draft) where delta>1e-9) then
    insert into public.pending_sales_inventory_resolution(store_id,draft_id,line_id,ingredient_id,waste,
      base_revision,basis_version_id,target_hash,delta,reported_at,status)
    select p_store,p_draft,x.line_id,x.ingredient_id,x.waste,v_draft.base_ledger_revision,
      v_draft.basis_version_id,p_payload_hash,x.delta,clock_timestamp(),'pending'
    from public.sales_draft_inventory_deltas(p_draft) x where x.delta>1e-9
    on conflict (draft_id,line_id,ingredient_id,waste,target_hash) do nothing;
    select exists(select 1 from public.pending_sales_inventory_resolution p
      where p.draft_id=p_draft and p.base_revision=v_draft.base_ledger_revision
        and p.basis_version_id=v_draft.basis_version_id and p.target_hash=p_payload_hash)
      and not exists(select 1 from public.pending_sales_inventory_resolution p
      where p.draft_id=p_draft and p.base_revision=v_draft.base_ledger_revision
        and p.basis_version_id=v_draft.basis_version_id and p.target_hash=p_payload_hash
        and p.status<>'resolved') into v_inventory_resolved;
    if not v_inventory_resolved then
      update public.sales_day_drafts set status='pending_inventory_resolution' where id=p_draft;
      update public.stores set inventory_recount_required=true where id=p_store;
      return jsonb_build_object('draft_id',p_draft,'status','pending_inventory_resolution',
        'requires_inventory_recount',true,'cutoff_business_date',v_cutoff);
    end if;
    perform set_config('costkeep.sales_inventory_resolved','on',true);
    perform set_config('costkeep.sales_resolved_draft',p_draft::text,true);
  end if;

  -- active 전환 뒤에는 옛 공개 쓰기를 막지만, 이 확정 트랜잭션은 같은 원장 몸통을 사용한다.
  perform set_config('costkeep.sales_finalize','on',true);
  if v_draft.draft_kind='initial' then
    insert into public.business_days(store_id,business_date,status,opened_at,
      planned_close_at,last_activity_at,snapshot,operating_rule_id,scheduled_open_at,basis_quality)
    values (p_store,v_draft.business_date,'closed',null,
      public.planned_close(p_store,v_draft.business_date),clock_timestamp(),v_basis.manifest,
      (select id from public.operating_rule_at(p_store,v_draft.business_date)),
      public.scheduled_open_at(p_store,v_draft.business_date),
      case when v_basis.basis_quality='exact' then 'exact'::public.day_basis_quality
           else 'estimated_current'::public.day_basis_quality end)
    on conflict (store_id,business_date) do nothing;
    select * into v_day from public.business_days
     where store_id=p_store and business_date=v_draft.business_date for update;
    if not found then
      raise exception '확정할 영업일을 만들지 못했어요' using errcode='P0002',detail='BUSINESS_DAY_NOT_FOUND';
    end if;
    if public.sales_json_sha256(public.sales_normalize_basis_manifest(v_day.snapshot))<>v_basis.manifest_sha256 then
      raise exception '매출 계산 기준이 초안과 달라요'
        using errcode='45009',detail='SALES_BASIS_CONFLICT';
    end if;
    insert into public.daily_sales(store_id,sale_date,business_day_id)
    values (p_store,v_draft.business_date,v_day.id)
    on conflict (store_id,sale_date) do update set business_day_id=excluded.business_day_id
      where public.daily_sales.business_day_id is distinct from excluded.business_day_id
    returning id,revision into v_sales,v_current_revision;
    if v_sales is null then
      select id,revision into v_sales,v_current_revision from public.daily_sales
       where store_id=p_store and sale_date=v_draft.business_date for update;
    end if;
    if coalesce(v_current_revision,0)<>v_draft.base_ledger_revision then
      raise exception '다른 기기에서 판매 내역이 변경됐어요. 최신 내역을 다시 확인해 주세요.'
        using errcode='45009',detail='REVISION_CONFLICT';
    end if;
    v_write:=jsonb_build_object('items',public.apply_sale_items(
      p_store,v_draft.business_date,v_sales,v_items,v_etc,v_extra,true));
    update public.daily_sales set revision=revision+1,updated_at=clock_timestamp()
     where id=v_sales returning revision into v_current_revision;
  else
    select * into v_day from public.business_days
     where store_id=p_store and business_date=v_draft.business_date for update;
    if not found or public.sales_json_sha256(public.sales_normalize_basis_manifest(v_day.snapshot))<>v_basis.manifest_sha256 then
      raise exception '매출 계산 기준이 초안과 달라요'
        using errcode='45009',detail='SALES_BASIS_CONFLICT';
    end if;
    v_write:=public.amend_ended_business_day(p_store,v_draft.business_date,
      v_draft.base_ledger_revision,v_items,v_etc,v_extra,p_reason);
  end if;

  select coalesce(revision,0) into v_ledger_revision from public.daily_sales
   where store_id=p_store and sale_date=v_draft.business_date;
  v_detail:=public.day_sales_detail(p_store,v_draft.business_date);
  v_summary:=public.sales_day_accounting_summary(p_store,v_draft.business_date,
    nullif(v_basis.manifest->>'fixed_rate','')::numeric);
  select * into v_day from public.business_days
   where store_id=p_store and business_date=v_draft.business_date;
  v_fixed_rate:=case when coalesce((v_summary->>'fixed_rate_provisional')::boolean,false)
                     then null else nullif(v_basis.manifest->>'fixed_rate','')::numeric end;
  select coalesce(max(version_no),0)+1 into v_version_no from public.sales_day_versions
   where store_id=p_store and business_date=v_draft.business_date;

  insert into public.sales_day_versions(store_id,business_date,version_no,source_draft_id,
    basis_version_id,basis_quality,payload,summary,customer_total,net_sales,fixed_rate,finalized_by)
  values (p_store,v_draft.business_date,v_version_no,p_draft,v_draft.basis_version_id,
    v_basis.basis_quality,v_detail,v_summary,
    coalesce((v_summary->>'customer_total')::numeric,(v_summary->>'revenue')::numeric,0),
    coalesce((v_summary->>'net_sales')::numeric,(v_summary->>'revenue')::numeric,0),
    v_fixed_rate,auth.uid()) returning * into v_version;

  insert into public.sales_day_heads(store_id,business_date,current_version_id,ledger_revision)
  values (p_store,v_draft.business_date,v_version.id,greatest(v_ledger_revision,1))
  on conflict (store_id,business_date) do update
    set current_version_id=excluded.current_version_id,
        ledger_revision=excluded.ledger_revision,updated_at=clock_timestamp();
  update public.sales_day_drafts set status='finalized',finalized_at=clock_timestamp()
   where id=p_draft;
  update public.sales_calendar_days set day_kind='expected',revision=revision+1,
    updated_at=clock_timestamp() where store_id=p_store and business_date=v_draft.business_date;

  v_result:=jsonb_build_object('draft_id',p_draft,'status','finalized','duplicate',false,
    'business_date',v_draft.business_date,'version_id',v_version.id,
    'version_no',v_version.version_no,'ledger_revision',greatest(v_ledger_revision,1),
    'summary',v_summary,'detail',v_detail,'write_result',v_write);
  insert into public.sales_command_receipts(store_id,user_id,command_kind,request_key,payload_hash,result)
  values (p_store,auth.uid(),'finalize_sales_draft',p_request_key,p_payload_hash,v_result);
  return v_result;
end $fn$;

-- A delta already absorbed by a verified whole-store count updates accounting only.
-- Patch the private consumption call while preserving every later e10 contract.
do $patch$
declare v_def text; v_new text; v_amend text;
begin
  v_def:=replace(pg_get_functiondef('public.e10_sale_recorded(uuid,date,uuid,numeric,numeric,numeric,numeric,boolean)'::regprocedure),chr(13),'');
  if position('reconcile_sales_consumption_components' in v_def)=0 then
    v_new:=replace(v_def,
      '  v_consume := reconcile_sales_consumption(v_item, false);',
      concat_ws(chr(10),
        '  if current_setting(''costkeep.sales_finalize'',true)=''on'' then',
        '    v_consume:=public.reconcile_sales_consumption_components(v_item,false);',
        '  else',
        '    v_consume:=public.reconcile_sales_consumption(v_item,false);',
        '  end if;'));
    if v_new=v_def then raise exception '0110: e10 재고 해소 분기 위치를 찾지 못했습니다'; end if;
    execute v_new;
  end if;
  v_amend:=replace(pg_get_functiondef('public.amend_ended_business_day(uuid,date,integer,jsonb,jsonb,jsonb,text)'::regprocedure),chr(13),'');
  if position('costkeep.sales_finalize' in v_amend)=0 then
    v_new:=replace(v_amend,
      '  if not sale_date_allowed(p_store, p_date) then',
      concat_ws(chr(10),
        '  if current_setting(''costkeep.sales_finalize'',true) is distinct from ''on''',
        '     and not sale_date_allowed(p_store,p_date) then'));
    if v_new=v_amend then raise exception '0110: amendment 편집창 분기 위치를 찾지 못했습니다'; end if;
    execute v_new;
  end if;
end $patch$;

grant create on schema public to costkeep_rpc_executor;
do $m$
begin
  alter function public.sales_draft_matches_committed(uuid) owner to costkeep_rpc_executor;
  alter function public.ensure_sales_inventory_component_baseline(uuid) owner to costkeep_rpc_executor;
  alter function public.reconcile_sales_consumption_components(uuid,boolean) owner to costkeep_rpc_executor;
  alter function public.get_sales_command_receipt(uuid,text,uuid,text) owner to costkeep_rpc_executor;
  alter function public.sales_day_accounting_summary(uuid,date,numeric) owner to costkeep_rpc_executor;
  alter function public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text) owner to costkeep_rpc_executor;
end $m$;
revoke create on schema public from costkeep_rpc_executor;
revoke all on function public.get_sales_command_receipt(uuid,text,uuid,text),
  public.sales_draft_matches_committed(uuid),
  public.ensure_sales_inventory_component_baseline(uuid),
  public.reconcile_sales_consumption_components(uuid,boolean),
  public.sales_day_accounting_summary(uuid,date,numeric),
  public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text) from public,anon;
grant execute on function public.get_sales_command_receipt(uuid,text,uuid,text),
  public.finalize_sales_draft(uuid,uuid,integer,uuid,text,text) to authenticated;

commit;
