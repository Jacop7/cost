-- F1: real detail JSON retains relation IDs, quantities and per-serving totals.
-- _prelude.sql owns the transaction; all fixtures roll back.
do $test$
declare
  s uuid := pg_temp.store();
  category uuid;
  material uuid;
  recipe uuid;
  detail jsonb;
  quantity numeric;
  event_hash text;
  day_hash text;
  used_before numeric;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) into event_hash from inventory_events e where store_id=s;
  select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) into day_hash from business_days where store_id=s;
  category := save_category(s,jsonb_build_object('name','F1 category '||gen_random_uuid(),'kind','recipe'));
  material := save_material(s,jsonb_build_object('name','F1 material '||gen_random_uuid(),'unit_cost',300,'unit_label','개'));

  foreach quantity in array array[0.5,2,0.25]::numeric[] loop
    recipe := save_recipe(s,jsonb_build_object('name','F1 recipe '||gen_random_uuid(),'price',12000,
      'base_servings',10,'category_id',category,'extras',jsonb_build_array(jsonb_build_object('material_id',material,'qty',quantity))));
    detail := recipe_detail(recipe);
    perform pg_temp.ok('recipe_detail category_id present and correct',detail->>'category_id'=category::text);
    perform pg_temp.ok('material_id retained',detail#>>'{extras,0,material_id}'=material::text);
    perform pg_temp.eq('fractional qty retained',(detail#>>'{extras,0,qty}')::numeric,quantity,0);
    perform pg_temp.eq('amount is row total, not unit cost',(detail#>>'{extras,0,amount}')::numeric,300*quantity,0);
    perform pg_temp.ok('same fixed-month response retained',detail->>'fixed_month'=store_local_month(s)
      and detail ? 'fixed_items' and detail ? 'fixed_rate');
    perform pg_temp.ok('other detail contracts retained',detail ?& array['last_change','tax','tax_items','tax_breakdown','sales_30d','lines','profit_trends']);
    perform save_recipe(s,jsonb_build_object('id',recipe,'name',detail->>'name','price',13000,
      'base_servings',detail->'base_servings','category_id',detail->'category_id','extras',detail->'extras'));
    perform pg_temp.ok('round trip keeps category', (select category_id=category from recipes where id=recipe));
    perform pg_temp.ok('round trip keeps material and qty',exists(select 1 from recipe_extra_costs
      where recipe_id=recipe and material_id=material and qty=quantity and amount_per_serving=300*quantity));
  end loop;

  select count(*) into used_before from recipe_extra_costs where material_id=material;
  perform save_material(s,jsonb_build_object('id',material,'name','F1 repriced '||material,'unit_cost',400,'unit_label','개'));
  perform pg_temp.ok('master reprices every preserved reference',not exists(select 1 from recipe_extra_costs
    where material_id=material and amount_per_serving<>400*qty));
  perform pg_temp.eq('master change reaches detail total',(recipe_detail(recipe)->>'extra_cost')::numeric,
    (select 400*qty from recipe_extra_costs where recipe_id=recipe),0);
  perform pg_temp.eq('master change reaches latest profit snapshot',(select extra_cost from profit_trends
    where recipe_id=recipe order by occurred_at desc,id desc limit 1),
    (select 400*qty from recipe_extra_costs where recipe_id=recipe),0);
  perform pg_temp.eq('used count unchanged',(select count(*) from recipe_extra_costs where material_id=material),used_before,0);
  perform pg_temp.eq('settings_lists used_count remains three',(select (x->>'used_count')::numeric
    from jsonb_array_elements(settings_lists(s)->'materials') x where x->>'id'=material::text),3,0);
  perform deactivate_material(material);
  detail := recipe_detail(recipe);
  perform pg_temp.ok('inactive reference still readable',detail#>>'{extras,0,material_id}'=material::text);
  perform save_recipe(s,jsonb_build_object('id',recipe,'name',detail->>'name','price',detail->'price',
    'base_servings',detail->'base_servings','category_id',detail->'category_id','extras',detail->'extras'));
  perform pg_temp.ok('inactive reference survives edit',exists(select 1 from recipe_extra_costs where recipe_id=recipe and material_id=material));

  recipe := save_recipe(s,jsonb_build_object('name','F1 standalone '||gen_random_uuid(),'price',12000,
    'base_servings',10,'extras',jsonb_build_array(jsonb_build_object('name','manual','qty',2,'amount',100))));
  detail := recipe_detail(recipe);
  perform pg_temp.ok('explicit null category is preserved',detail ? 'category_id' and detail->'category_id'='null'::jsonb);
  perform pg_temp.ok('explicit null material is preserved',detail#>'{extras,0,material_id}'='null'::jsonb);
  perform save_recipe(s,jsonb_build_object('id',recipe,'name',detail->>'name','price',detail->'price',
    'base_servings',detail->'base_servings','category_id',detail->'category_id','extras',detail->'extras'));
  perform pg_temp.ok('standalone qty2 total100 survives',exists(select 1 from recipe_extra_costs
    where recipe_id=recipe and material_id is null and qty=2 and amount_per_serving=100));
  -- Existing schema permits zero quantity; reading must not fabricate qty=1.
  update recipe_extra_costs set qty=0 where recipe_id=recipe;
  perform pg_temp.eq('stored zero qty is returned unchanged',(recipe_detail(recipe)#>>'{extras,0,qty}')::numeric,0,0);
  -- Existing save_recipe filters zero totals; do not silently change this policy in F1.
  perform save_recipe(s,jsonb_build_object('id',recipe,'name',detail->>'name','price',12000,'base_servings',10,
    'extras',jsonb_build_array(jsonb_build_object('name','zero','qty',2,'amount',0))));
  perform pg_temp.eq('zero-total write policy unchanged',(select count(*) from recipe_extra_costs where recipe_id=recipe),0,0);
  perform save_recipe(s,jsonb_build_object('id',recipe,'name',detail->>'name','price',12000,'base_servings',10,
    'extras',jsonb_build_array(jsonb_build_object('material_id',material,'qty',0))));
  perform pg_temp.eq('linked qty0 produces zero total and remains excluded on save',
    (select count(*) from recipe_extra_costs where recipe_id=recipe),0,0);

  recipe := save_recipe(s,jsonb_build_object('name','F1 mixed '||gen_random_uuid(),'price',12000,
    'base_servings',10,'category_id',category,'extras',jsonb_build_array(
      jsonb_build_object('material_id',material,'qty',0.25),
      jsonb_build_object('name','independent mixed','qty',2,'amount',123.45))));
  detail := recipe_detail(recipe);
  perform pg_temp.eq('mixed response has two distinct rows',jsonb_array_length(detail->'extras'),2,0);
  perform pg_temp.ok('mixed linked response preserves identity and quantity',exists(
    select 1 from jsonb_array_elements(detail->'extras') e where e->>'id' is not null
      and e->>'material_id'=material::text and (e->>'qty')::numeric=0.25 and (e->>'amount')::numeric=100));
  perform pg_temp.ok('mixed independent response preserves null reference and total',exists(
    select 1 from jsonb_array_elements(detail->'extras') e where e->>'id' is not null
      and e->'material_id'='null'::jsonb and e->>'name'='independent mixed'
      and (e->>'qty')::numeric=2 and (e->>'amount')::numeric=123.45));
  perform save_recipe(s,jsonb_build_object('id',recipe,'name',detail->>'name','price',13000,
    'base_servings',detail->'base_servings','category_id',detail->'category_id',
    'extras',(select jsonb_agg(e order by e->>'id' desc) from jsonb_array_elements(detail->'extras') e)));
  perform pg_temp.ok('mixed round trip preserves category',(select category_id=category from recipes where id=recipe));
  perform pg_temp.eq('mixed save keeps both rows',(select count(*) from recipe_extra_costs where recipe_id=recipe),2,0);
  perform pg_temp.ok('mixed linked row not confused with independent row',exists(select 1 from recipe_extra_costs
    where recipe_id=recipe and material_id=material and qty=0.25 and amount_per_serving=100));
  perform pg_temp.ok('mixed independent row not confused with linked row',exists(select 1 from recipe_extra_costs
    where recipe_id=recipe and material_id is null and name='independent mixed' and qty=2 and amount_per_serving=123.45));

  perform pg_temp.ok('inventory ledger unchanged',event_hash=(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from inventory_events e where store_id=s));
  perform pg_temp.ok('sales snapshots unchanged',day_hash=(select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) from business_days where store_id=s));
  perform pg_temp.ok('facade ACL preserved',has_function_privilege('authenticated','public.recipe_detail(uuid)','execute')
    and not has_function_privilege('anon','public.recipe_detail(uuid)','execute'));
end
$test$;
