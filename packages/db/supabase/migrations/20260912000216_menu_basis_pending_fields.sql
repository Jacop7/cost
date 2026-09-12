-- Displayed opening-basis fields can change without changing monetary totals.
-- They need pending history, but must not create a financial trend by themselves.
begin;
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.recipe_edit_apply_v3(uuid,jsonb)'::regprocedure);
  a:='    v_money := v_composition or (v_before.price';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0216 pending basis anchor'; end if;
  execute replace(d,a,'    v_money := (v_before.base_servings is distinct from v_servings)
      or (v_before.target_profit_rate is distinct from coalesce((p_payload->>''target_profit_rate'')::numeric,v_before.target_profit_rate))
      or v_composition or (v_before.price');
end $patch$;
commit;
