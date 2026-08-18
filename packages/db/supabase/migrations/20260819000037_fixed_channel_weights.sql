-- ════════════════════════════════════════════════════════════════
-- 0037 · 고정지출의 채널 배분 비중 (RCP-15)
--
-- 지금은 고정지출을 채널별로 나눌 때 **매출 비중**만 쓴다. 그런데 실제로는 항목마다 다르다:
--   · 플랫폼 수수료·배달대행 → 배달에만 든다
--   · 포장비 → 배달·포장에만 든다
--   · 인건비·임대료 → 세 채널이 나눠 진다
--
-- 매출 비중으로만 나누면 매장이 배달 수수료를 떠안아 "매장이 적자"로 보인다.
-- 항목별 비중을 저장해 그대로 배분한다. 비중이 없으면 지금처럼 매출 비중으로 떨어진다.
--
-- 비중은 `fixed_costs_monthly.items[].weights` 에 넣는다 — jsonb 라 스키마 변경이 없다.
--   예) {"hall": 30, "delivery": 50, "takeout": 20}
-- ════════════════════════════════════════════════════════════════

-- 항목별 채널 배분까지 풀어주는 조회.
-- 화면이 items 를 직접 파싱하면 "비중 없음 → 매출 비중" 규칙이 앱에도 복제된다.
create or replace function public.sales_channel_fixed(p_store uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_month   text := to_char(p_from, 'YYYY-MM');
  v_rate    numeric;
  v_revenue numeric;
  v_fix_sum numeric;
  v_total   numeric;
  v_ch      jsonb;
begin
  v_rate := fixed_cost_rate(p_store, v_month);
  if v_rate is null then
    select month, fixed_cost_rate(p_store, month) into v_month, v_rate
      from fixed_costs_monthly
     where store_id = p_store and month <= to_char(p_from, 'YYYY-MM')
       and fixed_cost_rate(p_store, month) is not null
     order by month desc limit 1;
  end if;

  v_revenue := (sales_summary(p_store, p_from, p_to)->>'revenue')::numeric;
  v_total   := coalesce(v_rate, 0) * v_revenue;

  select coalesce((select sum((i->>'total')::numeric) from jsonb_array_elements(items) i), 0)
    into v_fix_sum from fixed_costs_monthly where store_id = p_store and month = v_month;

  -- 채널별 메뉴 매출 — 비중이 없는 항목의 폴백 기준이다.
  select coalesce(jsonb_object_agg(c.code, c.amount), '{}'::jsonb) into v_ch
    from jsonb_to_recordset(sales_range(p_store, p_from, p_to)->'channels')
         as c(code text, amount numeric);

  return jsonb_build_object(
    'month', v_month,
    'total', v_total,
    'provisional', (fixed_cost_rate(p_store, to_char(p_from,'YYYY-MM')) is null),
    'channels', (
      select coalesce(jsonb_object_agg(code, amt), '{}'::jsonb)
      from (
        select ch.code,
               sum(
                 case
                   -- 비중이 있으면 그대로 나눈다.
                   when jsonb_typeof(i->'weights') = 'object'
                        and coalesce((select sum(value::numeric) from jsonb_each_text(i->'weights')), 0) > 0
                   then (v_total * ((i->>'total')::numeric / nullif(v_fix_sum, 0)))
                        * coalesce((i->'weights'->>ch.code)::numeric, 0)
                        / (select sum(value::numeric) from jsonb_each_text(i->'weights'))
                   -- 없으면 채널 매출 비중으로.
                   else (v_total * ((i->>'total')::numeric / nullif(v_fix_sum, 0)))
                        * coalesce((v_ch->>ch.code)::numeric, 0)
                        / nullif((select sum(value::numeric) from jsonb_each_text(v_ch)), 0)
                 end
               ) as amt
          from sales_channels ch
          left join fixed_costs_monthly f
            on f.store_id = p_store and f.month = v_month
          left join lateral jsonb_array_elements(coalesce(f.items, '[]'::jsonb)) i on true
         where ch.store_id = p_store
         group by ch.code) x),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', i->>'key',
               'month_total', (i->>'total')::numeric,
               'amount', v_total * ((i->>'total')::numeric / nullif(v_fix_sum, 0)),
               'weights', coalesce(i->'weights', 'null'::jsonb))
             order by (i->>'total')::numeric desc)
      from fixed_costs_monthly f, jsonb_array_elements(f.items) i
     where f.store_id = p_store and f.month = v_month), '[]'::jsonb));
end;
$fn$;

comment on function public.sales_channel_fixed(uuid, date, date) is
  '고정지출을 채널별로 배분. 항목에 weights 가 있으면 그대로, 없으면 채널 매출 비중(0037).';

-- 항목별 비중은 저장 함수가 그대로 통과시킨다(화면이 items 에 실어 보낸다).
-- 합이 100 이 아니어도 위 함수가 비율로 정규화하므로 강제하지 않는다 —
-- 사장님이 "매장 3 배달 5 포장 2" 처럼 적어도 동작해야 한다.
create or replace function public.save_fixed_costs(
  p_store uuid, p_month text, p_total_revenue numeric, p_items jsonb
) returns jsonb language plpgsql security invoker as $fn$
declare v_item jsonb; v_norm jsonb := '[]'::jsonb;
begin
  perform assert_my_store(p_store);
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode = '22000';
  end if;
  if coalesce(p_total_revenue, -1) < 0 then
    raise exception '월 매출은 0 이상이어야 합니다' using errcode = '22000';
  end if;

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
  return e4_fixed_cost_saved(p_store, p_month);
end;
$fn$;

select public.assert_no_rpc_overloads();
