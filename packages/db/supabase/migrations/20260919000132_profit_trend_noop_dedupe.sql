-- 계산 금액이 완전히 같은 구성 교체·원복은 설정 이력만 남기고 손익 추이를 중복 적재하지 않는다.
begin;

do $patch$
declare d text; a text; z text;
begin
  d:=replace(pg_get_functiondef('public.recompute_recipe(uuid,trend_cause,date,uuid)'::regprocedure),chr(13),'');
  a:='  insert into profit_trends (';
  z:='  if v_prev.id is not null'||chr(10)||
    '     and v_prev.price is not distinct from r.price'||chr(10)||
    '     and v_prev.material_cost is not distinct from v_material'||chr(10)||
    '     and v_prev.extra_cost is not distinct from v_extra'||chr(10)||
    '     and v_prev.tax_amount is not distinct from v_tax'||chr(10)||
    '     and v_prev.fixed_cost is not distinct from v_fixed'||chr(10)||
    '     and v_prev.fixed_rate is not distinct from coalesce(v_rate,0)'||chr(10)||
    '     and v_prev.profit_amount is not distinct from v_profit then'||chr(10)||
    '    return;'||chr(10)||
    '  end if;'||chr(10)||chr(10)||a;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
    raise exception '00132 recompute_recipe insert anchor';
  end if;
  execute replace(d,a,z);
end $patch$;

commit;
