
-- ── 정정: 직전 고정지출률의 출처 ──────────────────
-- 처음엔 그날 스냅샷의 fixed_rate 를 "직전 값"으로 썼다. 그러면 같은 값을
-- 두 번 저장해도 매번 기록이 쌓인다 — 스냅샷은 그날 기준이지 저장 직전 값이
-- 아니기 때문이다. 테스트가 잡았다.
drop function if exists public.e4_fixed_cost_saved(uuid, text);

CREATE OR REPLACE FUNCTION public.e4_fixed_cost_saved(p_store uuid, p_month text, p_prev_rate numeric default null)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_rate numeric;
  v_rev  numeric;
  v_fix  numeric;
  v_mat  numeric;
  v_day  date;
  rec    record;
  -- 수정 내역용(0063) — 한 번의 고정지출 저장을 하나의 묶음으로
  v_corr  uuid := gen_random_uuid();
  v_rate0 numeric;
  v_ext   numeric;
begin
  -- ⚠ 직전 률은 **저장 직전**에만 알 수 있다. save_fixed_costs 가 잡아 넘겨준다.
  --   스냅샷에서 읽으면 "그날 기준"과 비교하게 돼서, 같은 값을 두 번 저장해도
  --   매번 기록이 쌓인다(실제로 그러했다).
  v_rate0 := p_prev_rate;

  v_rate := fixed_cost_rate(p_store, p_month);

  select total_revenue,
         coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i),0)
    into v_rev, v_fix
  from fixed_costs_monthly where store_id = p_store and month = p_month;

  -- **그 달의 마지막 날**(오늘을 넘지 않게)에 점을 찍는다.
  -- 과거 월을 수정했는데 오늘 날짜로 점을 찍으면 그 달의 추이가 아니라 오늘 추이가 된다.
  v_day := least((to_date(p_month, 'YYYY-MM') + interval '1 month - 1 day')::date, business_day());

  for rec in select id from recipes where store_id = p_store and coalesce(active, true) loop
    perform recompute_recipe(rec.id, 'fixed', v_day);

    -- ── 수정 내역(0063) ──────────────────────────────────────
    -- 고정지출은 식재료도 레시피도 아니라 원장에 담을 엔터티가 없다.
    -- 영향을 받은 **메뉴 쪽에** 남기고 correlation_id 로 한 묶음으로 묶는다.
    -- ⚠ 률이 실제로 달라졌을 때만이다. 항목 이름만 고친 저장은 기록하지 않는다.
    if v_rate0 is not null and round(v_rate0, 6) is distinct from round(coalesce(v_rate, 0), 6) then
      v_ext := coalesce((select sum(ec.amount_per_serving)
                           from recipe_extra_costs ec where ec.recipe_id = rec.id), 0);
      perform record_entity_change(
        p_store, 'recipe', rec.id, 'fixed_cost', '고정 지출 자동 반영',
        (select
           change_line('fixed_rate', '고정지출률',
                       round(v_rate0 * 100, 2), round(coalesce(v_rate, 0) * 100, 2), '%')
           || change_line('fixed_cost', '고정 지출',
                       round(v_rate0 * r.price, 2), round(coalesce(v_rate, 0) * r.price, 2), '원')
           || change_line('profit', '순이익',
                       round(r.price - recipe_material_cost(r.id) - v_ext
                             - tax_of(r.price, r.tax_mode, r.tax_items) - v_rate0 * r.price, 2),
                       round(r.price - recipe_material_cost(r.id) - v_ext
                             - tax_of(r.price, r.tax_mode, r.tax_items)
                             - coalesce(v_rate, 0) * r.price, 2), '원')
           from recipes r where r.id = rec.id),
        true, null, v_corr);
    end if;
  end loop;

  select coalesce(sum(material_cost),0) into v_mat
    from monthly_pl where store_id = p_store and month = p_month;

  insert into monthly_pl (store_id, month, revenue, fixed_cost, material_cost)
       values (p_store, p_month, coalesce(v_rev,0), coalesce(v_fix,0), coalesce(v_mat,0))
  on conflict (store_id, month) do update
       set revenue = excluded.revenue,
           fixed_cost = excluded.fixed_cost;

  return jsonb_build_object('month', p_month, 'rate', v_rate, 'revenue', v_rev, 'fixed', v_fix);
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_fixed_costs(p_store uuid, p_month text, p_total_revenue numeric, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare v_item jsonb; v_norm jsonb := '[]'::jsonb; v_prev numeric;
begin
  perform assert_my_store(p_store);
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode = '22000';
  end if;
  if coalesce(p_total_revenue, -1) < 0 then
    raise exception '월 매출은 0 이상이어야 합니다' using errcode = '22000';
  end if;

  -- 수정 내역용 — 고치기 전 률은 여기서만 알 수 있다(0069).
  v_prev := fixed_cost_rate(p_store, p_month);

  -- 합계는 세부 줄이 있으면 **줄의 합**이 진실이다. 화면이 보낸 합계를 믿으면 둘이 어긋난다.
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_norm := v_norm || jsonb_build_array(
      jsonb_build_object(
        'key',  v_item->>'key',
        'mode', coalesce(v_item->>'mode', 'total'),
        'total', case when coalesce(v_item->>'mode','total') = 'detail'
                      then coalesce((select sum((l->>'amount')::numeric)
                                       from jsonb_array_elements(coalesce(v_item->'lines','[]'::jsonb)) l), 0)
                      else coalesce((v_item->>'total')::numeric, 0) end,
        'lines', coalesce(v_item->'lines', '[]'::jsonb))
      || case when jsonb_typeof(v_item->'weights') = 'object'
              then jsonb_build_object('weights', v_item->'weights')
              else '{}'::jsonb end);
  end loop;

  insert into fixed_costs_monthly (store_id, month, total_revenue, items, updated_at)
  values (p_store, p_month, p_total_revenue, v_norm, now())
  on conflict (store_id, month) do update
    set total_revenue = excluded.total_revenue,
        items         = excluded.items,
        updated_at    = now();

  -- E4 — 고정지출률이 바뀌면 **전 메뉴 손익**이 함께 움직인다.
  return e4_fixed_cost_saved(p_store, p_month, v_prev);
end;
$function$;

select public.assert_no_rpc_overloads();
