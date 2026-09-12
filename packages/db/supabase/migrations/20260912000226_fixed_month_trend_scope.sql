begin;
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.e4_fixed_cost_saved(uuid,text,numeric)'::regprocedure);
  a:='if p_prev_rate is null or p_prev_rate is distinct from v_rate then';
  if position(a in d)=0 then raise exception '0226 fixed trend month anchor'; end if;
  execute replace(d,a,'if p_month=public.store_local_month(p_store) and (p_prev_rate is null or p_prev_rate is distinct from v_rate) then');
end $patch$;
commit;
