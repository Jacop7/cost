-- 고정 지출 기준이 없으면 메뉴 손익 추이에 과거 월 비율이나 0%를 확정 기록하지 않는다.
-- 메뉴 변경 자체는 entity_change_events가 보존하고, profit_trends는 계산 가능한 손익만 기록한다.
begin;

do $patch$
declare
  d text;
  a text;
  z text;
  nl text := chr(10);
begin
  d := replace(
    pg_get_functiondef('public.recompute_recipe(uuid,trend_cause,date,uuid)'::regprocedure),
    chr(13),
    ''
  );

  a := '  v_rate := fixed_cost_rate(r.store_id, v_month);' || nl ||
       '  if v_rate is null then' || nl ||
       '    select fixed_cost_rate(r.store_id, month) into v_rate' || nl ||
       '      from fixed_costs_monthly' || nl ||
       '     where store_id = r.store_id and month <= v_month' || nl ||
       '       and fixed_cost_rate(r.store_id, month) is not null' || nl ||
       '     order by month desc limit 1;' || nl ||
       '  end if;' || nl ||
       '  v_fixed := coalesce(v_rate, 0) * r.price;';
  z := '  v_rate := fixed_cost_rate(r.store_id, v_month);' || nl ||
       '  if v_rate is null then' || nl ||
       '    return;' || nl ||
       '  end if;' || nl ||
       '  v_fixed := v_rate * r.price;';
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception '00136 recompute_recipe fixed basis anchor';
  end if;
  d := replace(d, a, z);

  a := '     and v_prev.fixed_rate is not distinct from coalesce(v_rate,0)';
  z := '     and v_prev.fixed_rate is not distinct from v_rate';
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception '00136 recompute_recipe dedupe anchor';
  end if;
  d := replace(d, a, z);

  a := '      v_fixed, coalesce(v_rate, 0), v_profit, v_type,';
  z := '      v_fixed, v_rate, v_profit, v_type,';
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception '00136 recompute_recipe insert anchor';
  end if;

  execute replace(d, a, z);
end $patch$;

comment on function public.recompute_recipe(uuid, trend_cause, date, uuid) is
  '메뉴 손익을 재계산해 계산 가능한 스냅샷만 기록한다. 고정 지출 기준 미입력은 과거 비율이나 0%로 추정하지 않는다.';

commit;
