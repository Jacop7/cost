-- ════════════════════════════════════════════════════════════════
-- 0068 · 기준 확정 시각과 변경 시각은 **벽시계**로 잰다
--
-- 테스트를 쓰다 걸렸다. 한 트랜잭션 안에서 now() 는 **트랜잭션 시작 시각**이라
-- 언제나 같은 값이다. 그래서
--   영업 시작(basis_at = now()) → 곧바로 레시피 수정(occurred_at = now())
-- 이 두 시각이 똑같아지고, `occurred_at > basis_at` 이 거짓이 되어
-- **영업 중 수정이 '반영됨'으로 잘못 표시**된다.
--
-- clock_timestamp() 는 호출 순간의 실제 시각이라 같은 트랜잭션 안에서도 앞뒤가 갈린다.
-- 전파처럼 한 트랜잭션에서 여러 건이 들어가도 순서가 그대로 남는다 —
-- 어차피 한 묶음은 correlation_id 로 묶으므로 시각이 조금씩 달라도 상관없다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.recipe_snapshot_entry(p_recipe uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    -- ⚠ now() 가 아니다. 위 설명 참조.
    'basis_at', clock_timestamp(),
    'name', r.name,
    'price', r.price,
    'tax_mode', r.tax_mode,
    'tax_items', coalesce(r.tax_items, '[]'::jsonb),
    'tax', tax_of(r.price, r.tax_mode, r.tax_items),
    'base_servings', r.base_servings,
    'material_cost', recipe_material_cost(r.id),
    'extra_cost', coalesce((select sum(ec.amount_per_serving)
                              from recipe_extra_costs ec where ec.recipe_id = r.id), 0),
    'extras', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', ec.name, 'qty', ec.qty, 'amount', ec.amount_per_serving))
                          from recipe_extra_costs ec where ec.recipe_id = r.id), '[]'::jsonb),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                          'ingredient_id', l.ingredient_id,
                          'name', i.name,
                          'base_unit', i.base_unit,
                          'per_serving', l.input_qty / nullif(r.base_servings, 0),
                          'unit_price', base_unit_price(l.ingredient_id)))
                          from recipe_lines l
                          join ingredients i on i.id = l.ingredient_id
                         where l.recipe_id = r.id and l.ingredient_id is not null), '[]'::jsonb))
    from recipes r where r.id = p_recipe;
$fn$;

alter table entity_change_events alter column occurred_at set default clock_timestamp();

create or replace function public.record_entity_change(
  p_store uuid, p_entity_type text, p_entity_id uuid,
  p_source change_source, p_title text, p_changes jsonb,
  p_affects boolean default false,
  p_source_entity uuid default null,
  p_correlation uuid default null
) returns uuid language plpgsql security invoker as $fn$
declare
  v_day business_days;
  v_id  uuid;
begin
  if coalesce(jsonb_array_length(p_changes), 0) = 0 then
    return null;
  end if;

  v_day := current_business_day(p_store);

  insert into entity_change_events
    (store_id, entity_type, entity_id, source_type, source_entity_id, correlation_id,
     title, changes, affects_sales, business_day_id, actor_id, occurred_at)
  values
    (p_store, p_entity_type, p_entity_id, p_source, p_source_entity,
     coalesce(p_correlation, gen_random_uuid()),
     p_title, p_changes, p_affects, v_day.id, auth.uid(), clock_timestamp())
  returning id into v_id;

  return v_id;
end;
$fn$;

select public.assert_no_rpc_overloads();
