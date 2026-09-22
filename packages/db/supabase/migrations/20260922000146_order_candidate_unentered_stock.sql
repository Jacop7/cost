-- 아직 재고를 기록하지 않은 재료는 0개로 확인된 재료와 구분한다.
begin;

do $patch$
declare
  d text;
  anchor text;
begin
  d := pg_get_functiondef('public.refresh_order_candidate(uuid)'::regprocedure);
  anchor := 'if not ing.stock_tracking then delete from public.order_candidates where ingredient_id=p_ingredient; return; end if;';
  if position(anchor in d) = 0 then
    raise exception 'order candidate unentered guard contract drift';
  end if;
  execute replace(d, anchor, anchor || E'\n  if not exists (select 1 from public.inventory_states where ingredient_id=p_ingredient) then\n    delete from public.order_candidates where ingredient_id=p_ingredient;\n    return;\n  end if;');

  -- 응답 타입은 유지하면서 미입력 수량만 NULL로 전달한다. 명시적으로 확인한 0은 0이다.
  d := pg_get_functiondef('public.ingredient_list(uuid)'::regprocedure);
  anchor := 'coalesce(stock_total_base(i.id), 0)';
  if position(anchor in d) = 0 then
    raise exception 'ingredient list unentered stock contract drift';
  end if;
  execute replace(d, anchor,
    'case when s.ingredient_id is null then null::numeric else stock_total_base(i.id) end');
end $patch$;

-- 기존에 잘못 만들어진 미입력 후보를 제거한다. 재고·단가 원장은 건드리지 않는다.
delete from public.order_candidates c
using public.ingredients i
where c.ingredient_id = i.id
  and i.stock_tracking
  and not exists (
    select 1 from public.inventory_states s where s.ingredient_id = i.id
  );

select public.assert_no_rpc_overloads();
commit;
