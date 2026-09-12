begin;
-- Legacy/no-profile quotes contain JSON null, not necessarily SQL NULL.
create or replace function public.applicable_tax_change_items(p_items jsonb,p_treatment public.tax_treatment)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(x order by n),'[]')
  from jsonb_array_elements(case when jsonb_typeof(p_items)='array' then p_items else '[]'::jsonb end) with ordinality a(x,n)
  where p_treatment is null or not (x ? 'applies_to_treatments')
    or case when x->>'kind'='primary' then p_treatment='taxable'
      else x->'applies_to_treatments' ? p_treatment::text end
$$;
-- Applicability is already resolved for this menu. Retain full scopes in history,
-- but expanding a rule to another treatment does not change this menu's money.
create or replace function public.tax_financial_change_rules(p_items jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(x-'key'-'name'-'sort_order'-'applies_to_treatments'
    order by (x-'key'-'name'-'sort_order'-'applies_to_treatments')::text),'[]')
  from jsonb_array_elements(case when jsonb_typeof(p_items)='array' then p_items else '[]'::jsonb end) x
$$;
commit;
