-- 24 · recipe_detail completed-month fixed-cost basis contract (0016)
-- The rate, denominator, numerator and displayed item mix must all come from
-- one fixed_cost_basis_result. The target month's draft row is excluded.

do $t$
declare
  v_rid uuid:=pg_temp.rcp('제육볶음');
  v_store uuid:=pg_temp.store();
  v_res jsonb; v_basis jsonb; v_month text; v_rate numeric; v_sum numeric;
begin
  v_res:=public.recipe_detail(v_rid);
  v_month:=v_res->>'fixed_month';
  v_basis:=public.fixed_cost_basis_result(v_store,v_month);

  perform pg_temp.ok('fixed_month is present and store-local',
    v_res ? 'fixed_month' and v_month=public.store_local_month(v_store));
  perform pg_temp.ok('fixed_month is YYYY-MM',v_month~'^\d{4}-(0[1-9]|1[0-2])$');
  perform pg_temp.ok('fixed_items is an array',jsonb_typeof(v_res->'fixed_items')='array');
  perform pg_temp.ok('detail returns the exact completed-month item mix',v_res->'fixed_items'=v_basis->'items');
  perform pg_temp.ok('detail carries the complete basis receipt',v_res->'fixed_basis'=v_basis);
  perform pg_temp.ok('detail denominator and numerator match the basis',
    v_res->'fixed_revenue'=v_basis->'average_revenue' and v_res->'fixed_total'=v_basis->'average_fixed');

  v_rate:=(v_res->>'fixed_rate')::numeric;
  select coalesce(sum((x->>'total')::numeric),0) into v_sum
    from jsonb_array_elements(v_res->'fixed_items') x;
  if (v_basis->>'applied')::boolean then
    perform pg_temp.eq('item average sums to average fixed cost',v_sum,(v_basis->>'average_fixed')::numeric,0.0000001);
    perform pg_temp.eq('item sum / average revenue equals rate',
      v_sum/(v_basis->>'average_revenue')::numeric,v_rate,0.0000001);
    perform pg_temp.eq('seed fixed-cost rate remains 31.3%',v_rate,0.313,0.0000001);
  else
    perform pg_temp.eq('incomplete basis reads as zero in recipe detail',v_rate,0,0.0000001);
    perform pg_temp.eq('incomplete basis has no allocatable items',v_sum,0,0.0000001);
  end if;
end $t$;

do $t$
declare
  v_rid uuid:=pg_temp.rcp('제육볶음');
  v_store uuid:=pg_temp.store();
  v_now text:=public.store_local_month(pg_temp.store());
  v_prev text; v_res jsonb; v_sum numeric;
begin
  v_prev:=to_char(to_date(v_now||'-01','YYYY-MM-DD')-interval '1 month','YYYY-MM');
  perform public.save_fixed_cost_basis(v_store,1::smallint,pg_temp.settings_rev(v_store));

  perform public.save_fixed_costs(v_store,v_prev,2000000,
    ('[{"key":"rent","mode":"total","total":250000,"lines":[],"weights":null},'
      ||'{"key":"ads","mode":"total","total":150000,"lines":[],"weights":null}]')::jsonb);
  perform public.save_fixed_costs(v_store,v_now,9000000,
    '[{"key":"rent","mode":"total","total":9000000,"lines":[],"weights":null}]'::jsonb);

  v_res:=public.recipe_detail(v_rid);
  select coalesce(sum((x->>'total')::numeric),0) into v_sum
    from jsonb_array_elements(v_res->'fixed_items') x;
  perform pg_temp.eq_t('target month remains the store-local month',v_res->>'fixed_month',v_now);
  perform pg_temp.eq('previous completed month sets the rate',(v_res->>'fixed_rate')::numeric,0.2,0.0000001);
  perform pg_temp.eq('previous completed month sets item average',v_sum,400000,0.0000001);
  perform pg_temp.eq('previous completed month sets revenue average',(v_res->>'fixed_revenue')::numeric,2000000,0.0000001);
  perform pg_temp.ok('target-month draft does not leak into item mix',
    not(v_res->'fixed_items' @> '[{"total":9000000}]'::jsonb));
  perform pg_temp.ok('both completed-month item keys are preserved',jsonb_array_length(v_res->'fixed_items')=2);

  delete from public.fixed_costs_monthly where store_id=v_store and month=v_prev;
  v_res:=public.recipe_detail(v_rid);
  perform pg_temp.eq('missing completed month removes the applied rate',(v_res->>'fixed_rate')::numeric,0,0.0000001);
  perform pg_temp.ok('missing completed month removes allocatable items',v_res->'fixed_items'='[]'::jsonb);
  perform pg_temp.ok('target-month draft still cannot fill the missing completed month',v_res->'fixed_total'='null'::jsonb);
end $t$;
