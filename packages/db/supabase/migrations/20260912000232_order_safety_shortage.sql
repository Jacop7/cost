-- 최소 발주 보정을 폐기한다. 후보는 기준단위 부족량을 제공하고,
-- 실제 E7 수량은 사용자가 선택한 구매 옵션의 용량으로 입력한다.
-- 과거 min_order_qty/원장 원문은 호환·감사를 위해 보존한다.
begin;
do $patch$
declare d text; anchor text;
begin
  d := replace(pg_get_functiondef('public.refresh_order_candidate(uuid)'::regprocedure),chr(13),'');
  anchor := E'v_rec_qty := greatest(\n    ceil((v_safe - v_total) / nullif(ing.per_volume, 0)),\n    coalesce(ing.min_order_qty, 1));';
  if position(anchor in d)=0 then raise exception 'order candidate contract drift'; end if;
  d := replace(d,anchor,'v_rec_qty := 0; -- deprecated: no option has been selected yet');
  d := replace(d,'권장 발주량 = 안전재고까지 채우는 데 필요한 구매단위 개수(최소 발주량 이상)','후보 단계에서는 구매 개수를 정하지 않는다.');
  execute d;
  d := pg_get_functiondef('public.order_board(uuid)'::regprocedure);
  anchor := '''reasons'', c.reasons, ''recommended_qty'', c.recommended_qty, ''status'', c.status,';
  if position(anchor in d)=0 then raise exception 'order board contract drift'; end if;
  execute replace(d,anchor,'''reasons'', c.reasons, ''recommended_qty'', 0, ''status'', c.status,
               ''shortage_total'', greatest(0, i.safety_stock - stock_total_base(i.id)),');
  d := pg_get_functiondef('public.save_ingredient(uuid,jsonb)'::regprocedure);
  anchor := 'if p_payload->>''contract_version''=''3'' then';
  if position(anchor in d)=0 then raise exception 'profile contract drift'; end if;
  execute replace(d,anchor,anchor || E'\n    p_payload := p_payload || jsonb_build_object(''min_order_qty'',case when v_before.id is null then 1 else v_before.min_order_qty end);');
end $patch$;
comment on column public.ingredients.min_order_qty is '폐기된 최소 발주 설정. 과거 값 보존 전용이며 발주 계산에는 사용하지 않는다(0232).';
comment on column public.order_candidates.recommended_qty is '폐기된 후보 권장 개수. 신규 계산은 0, order_board.shortage_total과 구매 옵션 용량으로 발주 입력한다(0232).';
select public.assert_no_rpc_overloads();
commit;
