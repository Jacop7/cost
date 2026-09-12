begin;
-- Advancing an existing future reservation must carry its saved choices as well.
-- The original profile start bounds the read; no historical intent is inferred.
create or replace function public.tax_override_carry(p_profile uuid,p_date date)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select distinct on (o.recipe_id) o.recipe_id,o.store_id,o.tax_category,o.treatment,o.inherit_default,o.revision,o.updated_at
    from public.menu_tax_overrides o join public.store_tax_profiles p on p.id=o.tax_profile_id
    where o.tax_profile_id=p_profile and o.effective_from<=greatest(p_date,p.effective_from)
    order by o.recipe_id,o.effective_from desc
  ) x
$$;
commit;
