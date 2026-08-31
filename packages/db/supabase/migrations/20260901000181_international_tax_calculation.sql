-- 0181 · INTL-1D 국제 세금 계산 몸통과 목표 수량 원장 reconciliation
--
-- 새 공식은 DB numeric이 확정하고 packages/core는 미리보기만 담당한다. 판매행의
-- 세 채널은 독립 계산선이며, 같은 목표 수량은 아무것도 쓰지 않는다. 이 migration은
-- 계산 몸통을 현행 판매 경로에 연결하지만 capability=false라 앱 쓰기는 아직 0090 계약이다.

begin;

-- 한 목표 변화가 여러 과거 이벤트를 상쇄할 수 있어 1:1 원본을 정직하게 고를 수 없다.
-- nullable·미검증 연결을 남기지 않고 계산선+구성 항목의 합계 원장으로 계약을 확정한다.
alter table public.sales_tax_events drop column reverses_event_id;

-- 0180의 감사 판정 시점은 불변 원본으로 남기고, 이후 기존 미래 장부 때문에 실제 적용
-- 경계를 전진시킨 값은 future_effective_from에 따로 반영한다.
alter table public.international_tax_migration_audits
  add column original_future_effective_from date;

-- 0180은 "내일부터 처음 비어 있는 날"을 골랐지만, 그 뒤 날짜에 이미 예약성 영업일이
-- 있으면 새 프로필 구간이 그 기존 장부를 삼킨다. 아직 국제 snapshot이 0건인 이 단계에서만
-- 자동 생성 프로필을 마지막 기존 영업일 다음 날로 전진시킨다. 사람이 만든 프로필은 건드리지 않는다.
do $future_boundary$
begin
  if exists (
    select 1 from public.international_tax_migration_audits a
    join public.daily_sales_item_tax_snapshots s
      on s.tax_profile_id=a.tax_profile_id or s.market_profile_id=a.market_profile_id
   where a.decision='auto_profile_created'
  ) then
    raise exception '0181: 자동 이관 프로필에 이미 판매 snapshot이 있어 적용 경계를 옮길 수 없습니다';
  end if;
end
$future_boundary$;
alter table public.store_market_profiles disable trigger user;
alter table public.store_tax_profiles disable trigger user;
alter table public.international_tax_migration_audits disable trigger user;
update public.international_tax_migration_audits
   set original_future_effective_from=future_effective_from
 where decision='auto_profile_created';
with desired as (
  select a.market_profile_id,a.tax_profile_id,
         greatest(a.future_effective_from,
                  coalesce(max(d.business_date)+1,a.future_effective_from)) effective_from
    from public.international_tax_migration_audits a
    left join public.business_days d on d.store_id=a.store_id
      and d.business_date >= a.future_effective_from
   where a.decision='auto_profile_created'
   group by a.market_profile_id,a.tax_profile_id,a.future_effective_from
), moved_tax as (
  update public.store_tax_profiles t set effective_from=x.effective_from
    from desired x where t.id=x.tax_profile_id and t.effective_from<x.effective_from
  returning t.id
)
update public.store_market_profiles m set effective_from=x.effective_from
  from desired x where m.id=x.market_profile_id and m.effective_from<x.effective_from;
with desired as (
  select a.id,
         greatest(a.future_effective_from,
                  coalesce(max(d.business_date)+1,a.future_effective_from)) effective_from
    from public.international_tax_migration_audits a
    left join public.business_days d on d.store_id=a.store_id
      and d.business_date >= a.future_effective_from
   where a.decision='auto_profile_created'
   group by a.id,a.future_effective_from
)
update public.international_tax_migration_audits a set future_effective_from=x.effective_from
  from desired x where a.id=x.id and a.future_effective_from<x.effective_from;
alter table public.international_tax_migration_audits enable trigger user;
alter table public.store_tax_profiles enable trigger user;
alter table public.store_market_profiles enable trigger user;
alter table public.international_tax_migration_audits
  add constraint international_tax_migration_audits_boundary_ck check (
    (decision='auto_profile_created'
      and original_future_effective_from is not null
      and original_future_effective_from <= future_effective_from)
    or
    (decision='manual_review_required' and original_future_effective_from is null)
  );
comment on column public.international_tax_migration_audits.original_future_effective_from is
  '0180 감사 판정 당시의 최초 미래 적용일. 0181이 기존 미래 장부 뒤로 실제 적용 경계를 전진해도 바꾸지 않는다.';
comment on column public.international_tax_migration_audits.future_effective_from is
  '실제 자동 프로필 적용 경계. original_future_effective_from보다 앞설 수 없으며 0181에서 기존 미래 장부 뒤로만 전진할 수 있다.';
comment on table public.international_tax_migration_audits is
  'INTL-1C 이관 판정 감사. 0180 원본 경계는 original_future_effective_from에 불변 보존하고, 기존 미래 장부와 충돌하지 않도록 전진한 실제 경계만 future_effective_from에 기록한다.';

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

create or replace function public.apply_international_tax_for_sales_item(
  p_sales_item uuid,
  p_force boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap jsonb := public.app_capabilities();
  v_item public.daily_sales_items%rowtype;
  v_sales public.daily_sales%rowtype;
  v_day public.business_days%rowtype;
  v_market public.store_market_profiles%rowtype;
  v_profile public.store_tax_profiles%rowtype;
  v_snapshot public.daily_sales_item_tax_snapshots%rowtype;
  v_override public.menu_tax_overrides%rowtype;
  v_treatment public.tax_treatment;
  v_category text;
  v_channel public.international_sales_channel_code;
  v_quantity numeric;
  v_components jsonb;
  v_quote jsonb;
  v_component record;
  v_snapshot_id uuid;
  v_delta numeric;
  v_changed boolean;
  v_revision integer;
  v_expected integer;
  v_joined integer;
  v_first_market_date date;
  v_results jsonb := '[]'::jsonb;
begin
  if p_force and (
       session_user <> 'postgres'
       or current_setting('margincook.international_tax_force', true) is distinct from 'owner_test'
     ) then
    raise exception '국제 세금 강제 계산은 소유자 시험 경로에서만 실행할 수 있어요'
      using errcode='42501', detail='INTERNATIONAL_TAX_FORCE_FORBIDDEN';
  end if;
  if not p_force and not (v_cap#>>'{international_tax,write_enabled}')::boolean then
    return jsonb_build_object('enabled', false, 'changed', false, 'lines', v_results);
  end if;

  -- 실제 판매 저장과 같은 잠금 순서: 영업일 → 판매행. 트리거 경로에서도 save_sale/amend가
  -- 이미 영업일을 먼저 잠갔으므로 크론·판매 경합의 전역 순서를 바꾸지 않는다.
  select ds.* into v_sales
    from public.daily_sales_items i
    join public.daily_sales ds on ds.id = i.daily_sales_id
   where i.id = p_sales_item;
  if v_sales.id is null or v_sales.business_day_id is null then
    raise exception '국제 세금 계산에 연결된 영업일을 찾을 수 없어요'
      using errcode = '22000', detail = 'BUSINESS_DAY_REQUIRED';
  end if;
  -- 앱의 직접 호출만 소유 매장 검사를 통과해야 한다. AFTER trigger는 원래 쓰기 RPC가
  -- 이미 매장 경계를 검사한 뒤이며, JWT가 없는 소유자 백필까지 auth.uid()로 막지 않는다.
  if not p_force and pg_trigger_depth() = 0 then
    perform public.assert_my_store(v_sales.store_id);
  end if;
  select * into v_day from public.business_days where id = v_sales.business_day_id for update;
  select * into v_item from public.daily_sales_items where id = p_sales_item for update;
  if v_item.id is null or v_item.store_id <> v_sales.store_id or v_day.store_id <> v_sales.store_id then
    raise exception '국제 세금 계산선의 매장 경계가 맞지 않아요'
      using errcode = '23514', detail = 'INTERNATIONAL_TAX_STORE_MISMATCH';
  end if;
  v_revision := v_day.revision_no + case when v_day.status = 'closed' then 1 else 0 end;

  foreach v_channel in array enum_range(null::public.international_sales_channel_code) loop
    v_quantity := case v_channel
      when 'hall' then v_item.qty_hall
      when 'delivery' then v_item.qty_delivery
      when 'takeout' then v_item.qty_takeout end;

    select * into v_snapshot
      from public.daily_sales_item_tax_snapshots s
     where s.daily_sales_item_id = v_item.id and s.sales_channel_code = v_channel
     for update;

    if v_snapshot.id is null and coalesce(v_quantity, 0) = 0 then
      continue;
    end if;

    if v_snapshot.id is null then
      select * into v_market from public.store_market_profiles m
       where m.store_id = v_item.store_id
         and v_sales.sale_date >= m.effective_from
         and (m.effective_to is null or v_sales.sale_date <= m.effective_to);
      if v_market.id is null then
        select min(m.effective_from) into v_first_market_date
          from public.store_market_profiles m where m.store_id=v_item.store_id;
        if v_first_market_date is null or v_sales.sale_date < v_first_market_date then
          -- 수동 검토 대상이라 프로필이 아직 없거나 국제 계산 적용 전인 판매는 0090
          -- legacy 합계를 그대로 보존한다. 과거 정정도 국제 snapshot을 새로 만들거나
          -- 현재 프로필로 추정하지 않으며, INTL-1E 활성화 전에 수동 검토 매장을 해소한다.
          continue;
        end if;
        raise exception '% 판매일의 시장 프로필을 찾을 수 없어요', v_sales.sale_date
          using errcode = '45013', detail = 'MARKET_PROFILE_NOT_AVAILABLE';
      end if;
      select * into v_profile from public.store_tax_profiles t
       where t.store_id = v_item.store_id and t.market_profile_id = v_market.id
         and v_sales.sale_date >= t.effective_from
         and (t.effective_to is null or v_sales.sale_date <= t.effective_to);
      if v_profile.id is null then
        raise exception '% 판매일의 세금 프로필을 찾을 수 없어요', v_sales.sale_date
          using errcode = '45013', detail = 'TAX_PROFILE_NOT_AVAILABLE';
      end if;

      select * into v_override from public.menu_tax_overrides o
       where o.recipe_id = v_item.recipe_id and o.tax_profile_id = v_profile.id;
      v_category := null;
      if v_override.recipe_id is not null and v_override.tax_category is not null then
        v_category := v_override.tax_category;
        select c.treatment into v_treatment from public.tax_category_catalog c
         where c.tax_profile_id = v_profile.id and c.code = v_category and c.active;
      elsif v_override.recipe_id is not null then
        v_treatment := v_override.treatment;
      else
        v_treatment := v_profile.default_treatment;
      end if;
      if v_treatment is null then
        raise exception '메뉴 과세 상태를 확정할 수 없어요'
          using errcode = '45013', detail = 'TAX_TREATMENT_NOT_AVAILABLE';
      end if;

      select count(*) into v_expected from public.store_tax_components c where c.tax_profile_id = v_profile.id;
      select count(*) into v_joined
        from public.store_tax_components c
        join public.channel_tax_remittance r
          on r.tax_component_id = c.id and r.store_id = c.store_id and r.sales_channel_code = v_channel
       where c.tax_profile_id = v_profile.id;
      if v_expected = 0 or v_expected <> v_joined then
        raise exception '세금 구성 항목과 채널 납부 주체가 완결되지 않았어요'
          using errcode = '45013', detail = 'TAX_PROFILE_INCOMPLETE';
      end if;
      select jsonb_agg(jsonb_build_object(
               'component_id', c.id, 'kind', c.kind, 'name', c.name,
               'rate_pct', c.rate_pct, 'jurisdiction_level', c.jurisdiction_level,
               'calculation_basis', c.calculation_basis,
               'applies_to_treatments', to_jsonb(c.applies_to_treatments),
               'remittance_owner', r.remittance_owner) order by c.id)
        into v_components
        from public.store_tax_components c
        join public.channel_tax_remittance r
          on r.tax_component_id = c.id and r.store_id = c.store_id and r.sales_channel_code = v_channel
       where c.tax_profile_id = v_profile.id;
      v_quote := public.calculate_international_tax(
        v_market.price_basis, public.international_currency_minor_unit(v_market.currency_code),
        v_treatment, v_item.unit_price * v_quantity, v_components);

      insert into public.daily_sales_item_tax_snapshots(
        store_id,daily_sales_item_id,sales_channel_code,
        market_profile_id,market_profile_revision,tax_profile_id,tax_profile_revision,
        country_code,region_code,currency_code,minor_unit,price_basis,treatment,tax_category,
        calculation_version,unit_price,final_quantity,listed_total,net_sales,customer_total,tax_total,
        merchant_tax_liability,marketplace_tax_liability,input_snapshot,amount_snapshot
      ) values (
        v_item.store_id,v_item.id,v_channel,
        v_market.id,v_market.revision,v_profile.id,v_profile.revision,
        v_market.country_code,v_market.region_code,v_market.currency_code,
        public.international_currency_minor_unit(v_market.currency_code),v_market.price_basis,
        v_treatment,v_category,'international_tax_v1',v_item.unit_price,v_quantity,
        (v_quote->>'listed_total')::numeric,(v_quote->>'net_sales')::numeric,
        (v_quote->>'customer_total')::numeric,(v_quote->>'tax_total')::numeric,
        (v_quote->>'merchant_tax_liability')::numeric,(v_quote->>'marketplace_tax_liability')::numeric,
        jsonb_build_object('unit_price',v_item.unit_price,'quantity',v_quantity,'components',v_components),v_quote
      ) returning id into v_snapshot_id;

      insert into public.daily_sales_item_tax_component_snapshots(
        store_id,sales_tax_snapshot_id,component_id_snapshot,kind,name,rate_pct,
        jurisdiction_level,calculation_basis,applies_to_treatments,remittance_owner,
        unrounded_amount,rounded_amount)
      select v_item.store_id,v_snapshot_id,(q->>'component_id')::uuid,
             (q->>'kind')::public.tax_component_kind,q->>'name',(q->>'rate_pct')::numeric,
             (q->>'jurisdiction_level')::public.tax_jurisdiction_level,
             (q->>'calculation_basis')::public.tax_calculation_basis,
             array(select jsonb_array_elements_text(q->'applies_to_treatments'))::public.tax_treatment[],
             (q->>'remittance_owner')::public.tax_remittance_owner,
             (q->>'unrounded_amount')::numeric,(q->>'rounded_amount')::numeric
        from jsonb_array_elements(v_quote->'components') q;

      insert into public.sales_tax_events(
        store_id,daily_sales_item_id,sales_channel_code,component_id_snapshot,
        delta_amount,target_quantity,calculation_version,business_day_revision_no)
      select v_item.store_id,v_item.id,v_channel,(q->>'component_id')::uuid,
             (q->>'rounded_amount')::numeric,v_quantity,'international_tax_v1',v_revision
        from jsonb_array_elements(v_quote->'components') q
       where (q->>'rounded_amount')::numeric <> 0;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('channel',v_channel,'created',true,'changed',true,'snapshot_id',v_snapshot_id));
      continue;
    end if;

    select jsonb_agg(jsonb_build_object(
             'component_id',c.component_id_snapshot,'kind',c.kind,'name',c.name,
             'rate_pct',c.rate_pct,'jurisdiction_level',c.jurisdiction_level,
             'calculation_basis',c.calculation_basis,
             'applies_to_treatments',to_jsonb(c.applies_to_treatments),
             'remittance_owner',c.remittance_owner) order by c.component_id_snapshot)
      into v_components
      from public.daily_sales_item_tax_component_snapshots c
     where c.sales_tax_snapshot_id = v_snapshot.id;
    v_quote := public.calculate_international_tax(
      v_snapshot.price_basis,v_snapshot.minor_unit,v_snapshot.treatment,
      v_snapshot.unit_price * v_quantity,v_components);
    v_changed := v_snapshot.final_quantity is distinct from v_quantity
      or v_snapshot.amount_snapshot is distinct from v_quote;
    if not v_changed then
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('channel',v_channel,'created',false,'changed',false,'snapshot_id',v_snapshot.id));
      continue;
    end if;

    for v_component in
      select c.id,c.component_id_snapshot,c.rounded_amount,
             (q.value->>'unrounded_amount')::numeric as target_unrounded,
             (q.value->>'rounded_amount')::numeric as target_rounded
        from public.daily_sales_item_tax_component_snapshots c
        join jsonb_array_elements(v_quote->'components') q(value)
          on q.value->>'component_id' = c.component_id_snapshot::text
       where c.sales_tax_snapshot_id = v_snapshot.id
       order by c.component_id_snapshot
    loop
      v_delta := v_component.target_rounded - v_component.rounded_amount;
      if v_delta <> 0 then
        insert into public.sales_tax_events(
          store_id,daily_sales_item_id,sales_channel_code,component_id_snapshot,
          delta_amount,target_quantity,calculation_version,business_day_revision_no)
        values (v_item.store_id,v_item.id,v_channel,v_component.component_id_snapshot,
                v_delta,v_quantity,'international_tax_v1',v_revision);
      end if;
      update public.daily_sales_item_tax_component_snapshots
         set unrounded_amount=v_component.target_unrounded,rounded_amount=v_component.target_rounded
       where id=v_component.id
         and (unrounded_amount is distinct from v_component.target_unrounded
           or rounded_amount is distinct from v_component.target_rounded);
    end loop;
    update public.daily_sales_item_tax_snapshots
       set final_quantity=v_quantity,
           listed_total=(v_quote->>'listed_total')::numeric,
           net_sales=(v_quote->>'net_sales')::numeric,
           customer_total=(v_quote->>'customer_total')::numeric,
           tax_total=(v_quote->>'tax_total')::numeric,
           merchant_tax_liability=(v_quote->>'merchant_tax_liability')::numeric,
           marketplace_tax_liability=(v_quote->>'marketplace_tax_liability')::numeric,
           input_snapshot=jsonb_build_object('unit_price',unit_price,'quantity',v_quantity,'components',v_components),
           amount_snapshot=v_quote,updated_at=clock_timestamp()
     where id=v_snapshot.id;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('channel',v_channel,'created',false,'changed',true,'snapshot_id',v_snapshot.id));
  end loop;

  return jsonb_build_object(
    'enabled',true,
    'changed',exists(select 1 from jsonb_array_elements(v_results) r where (r->>'changed')::boolean),
    'lines',v_results);
end;
$$;

create or replace function public.reconcile_international_tax_after_sale_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_international_tax_for_sales_item(new.id, false);
  return new;
end;
$$;

create trigger daily_sales_items_80_international_tax
after insert or update of qty_hall,qty_delivery,qty_takeout on public.daily_sales_items
for each row execute function public.reconcile_international_tax_after_sale_item();

-- 계산선의 최종 상태를 commit 전에 DB가 강제한다. 계산 중간에는 이벤트와 스냅샷이
-- 잠시 어긋날 수 있으므로 deferred constraint trigger다.
create or replace function public.assert_sales_tax_line_balanced()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
  v_channel public.international_sales_channel_code;
  v_snapshot public.daily_sales_item_tax_snapshots%rowtype;
begin
  if tg_table_name = 'daily_sales_item_tax_snapshots' then
    v_item := new.daily_sales_item_id; v_channel := new.sales_channel_code;
  elsif tg_table_name = 'daily_sales_item_tax_component_snapshots' then
    select s.daily_sales_item_id,s.sales_channel_code into v_item,v_channel
      from public.daily_sales_item_tax_snapshots s where s.id=new.sales_tax_snapshot_id;
  else
    v_item := new.daily_sales_item_id; v_channel := new.sales_channel_code;
  end if;
  select * into v_snapshot from public.daily_sales_item_tax_snapshots s
   where s.daily_sales_item_id=v_item and s.sales_channel_code=v_channel;
  if v_snapshot.id is null then return null; end if;
  if coalesce((select sum(c.rounded_amount) from public.daily_sales_item_tax_component_snapshots c
                where c.sales_tax_snapshot_id=v_snapshot.id),0) <> v_snapshot.tax_total
     or coalesce((select sum(c.rounded_amount) from public.daily_sales_item_tax_component_snapshots c
                   where c.sales_tax_snapshot_id=v_snapshot.id and c.remittance_owner='merchant'),0)
          <> v_snapshot.merchant_tax_liability
     or coalesce((select sum(c.rounded_amount) from public.daily_sales_item_tax_component_snapshots c
                   where c.sales_tax_snapshot_id=v_snapshot.id and c.remittance_owner='marketplace'),0)
          <> v_snapshot.marketplace_tax_liability
     or exists (
       select 1 from public.daily_sales_item_tax_component_snapshots c
        where c.sales_tax_snapshot_id=v_snapshot.id
          and coalesce((select sum(e.delta_amount) from public.sales_tax_events e
                         where e.daily_sales_item_id=v_item and e.sales_channel_code=v_channel
                           and e.component_id_snapshot=c.component_id_snapshot),0) <> c.rounded_amount
     ) then
    raise exception '판매 세금 구성·납부 부채·이벤트 원장이 맞지 않아요'
      using errcode='23514',detail='SALES_TAX_LINE_UNBALANCED';
  end if;
  return null;
end;
$$;

create constraint trigger daily_sales_item_tax_snapshots_balanced
after insert or update on public.daily_sales_item_tax_snapshots
deferrable initially deferred for each row execute function public.assert_sales_tax_line_balanced();
create constraint trigger daily_sales_item_tax_components_balanced
after insert or update on public.daily_sales_item_tax_component_snapshots
deferrable initially deferred for each row execute function public.assert_sales_tax_line_balanced();
create constraint trigger sales_tax_events_balanced
after insert on public.sales_tax_events
deferrable initially deferred for each row execute function public.assert_sales_tax_line_balanced();

revoke all on function public.calculate_international_tax(public.tax_price_basis,smallint,public.tax_treatment,numeric,jsonb)
  from public,anon,authenticated,margincook_rpc_executor,service_role;
revoke all on function public.apply_international_tax_for_sales_item(uuid,boolean)
  from public,anon,authenticated,margincook_rpc_executor,service_role;
revoke all on function public.reconcile_international_tax_after_sale_item()
  from public,anon,authenticated,margincook_rpc_executor,service_role;
revoke all on function public.assert_sales_tax_line_balanced()
  from public,anon,authenticated,margincook_rpc_executor,service_role;

comment on function public.calculate_international_tax(public.tax_price_basis,smallint,public.tax_treatment,numeric,jsonb) is
  'INTL-1D numeric 권위 계산. 구성 항목별 minor unit 반올림 뒤 합계를 만들며 앱에는 직접 공개하지 않는다.';
comment on function public.apply_international_tax_for_sales_item(uuid,boolean) is
  '판매행의 세 채널 목표 수량을 당시 프로필 snapshot·append-only 세금 이벤트로 reconcile한다. p_force는 소유자 시험 전용이며 앱 역할에는 실행 권한이 없다.';

do $verify$
declare v_cap jsonb:=public.app_capabilities();
begin
  if (v_cap#>>'{international_tax,read_enabled}')::boolean
     or (v_cap#>>'{international_tax,write_enabled}')::boolean then
    raise exception '0181: 계산 몸통 단계에서 국제 세금 capability를 켰습니다';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public'
              and table_name='sales_tax_events' and column_name='reverses_event_id') then
    raise exception '0181: 의미를 보장할 수 없는 reverses_event_id가 남았습니다';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.daily_sales_items'::regclass
                  and tgname='daily_sales_items_80_international_tax' and not tgisinternal) then
    raise exception '0181: 판매 저장과 국제 세금 계산 몸통이 연결되지 않았습니다';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='assert_sales_tax_line_balanced'
       and p.prosecdef
  ) then
    raise exception '0181: deferred 세금 불변식이 앱 세션 권한에 기대고 있습니다';
  end if;
  if exists (
    select 1 from public.international_tax_migration_audits
     where decision='auto_profile_created'
       and (original_future_effective_from is null
         or original_future_effective_from > future_effective_from)
  ) then
    raise exception '0181: 감사 당시 최초 적용 경계가 보존되지 않았습니다';
  end if;
  if exists (
    select 1
      from unnest(array['anon','authenticated','margincook_rpc_executor','service_role']) role_name,
           unnest(array[
             'public.calculate_international_tax(tax_price_basis,smallint,tax_treatment,numeric,jsonb)',
             'public.apply_international_tax_for_sales_item(uuid,boolean)',
             'public.reconcile_international_tax_after_sale_item()',
             'public.assert_sales_tax_line_balanced()'
           ]) signature
     where has_function_privilege(role_name,signature,'execute')
  ) then
    raise exception '0181: 내부 국제 세금 계산·쓰기·검증 몸통이 앱·서비스 역할에 열렸습니다';
  end if;
end
$verify$;

commit;
