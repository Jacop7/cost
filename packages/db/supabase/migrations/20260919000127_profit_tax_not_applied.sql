-- 손익 앱의 tax_exclusive 저장값은 "별도 청구"가 아니라 "세금 미적용"으로 사용한다.
-- 과거 판매 스냅샷은 그대로 두고 이 함수가 생성하는 새 quote부터 세액을 0으로 확정한다.
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

  if p_price_basis = 'tax_exclusive' then
    for v_component in select value from jsonb_array_elements(p_components) loop
      v_components := v_components || jsonb_build_array(
        v_component || jsonb_build_object('unrounded_amount', 0, 'rounded_amount', 0));
    end loop;
    return jsonb_build_object(
      'listed_total', p_listed_total,
      'net_sales', p_listed_total,
      'customer_total', p_listed_total,
      'tax_total', 0,
      'merchant_tax_liability', 0,
      'marketplace_tax_liability', 0,
      'components', v_components);
  end if;

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
  v_net_raw := p_listed_total / v_multiplier;

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
    'net_sales', p_listed_total - v_tax,
    'customer_total', p_listed_total,
    'tax_total', v_tax,
    'merchant_tax_liability', v_merchant,
    'marketplace_tax_liability', v_marketplace,
    'components', v_components);
end;
$$;

revoke all on function public.calculate_international_tax(
  public.tax_price_basis,smallint,public.tax_treatment,numeric,jsonb)
  from public,anon,authenticated,costkeep_rpc_executor,service_role;

comment on function public.calculate_international_tax(
  public.tax_price_basis,smallint,public.tax_treatment,numeric,jsonb) is
  '손익 세금 numeric 권위 계산. tax_inclusive만 세액을 차감하고 tax_exclusive 호환값은 세금 미적용으로 0원을 반환한다.';
