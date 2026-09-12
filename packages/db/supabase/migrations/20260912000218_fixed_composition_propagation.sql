-- Fixed-cost composition is part of a menu's displayed basis, even at equal totals.
begin;
create function public.pending_recipe_tax_quote(p_recipe uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select public.recipe_tax_quote_for_price(r.id,public.next_unopened_business_date(r.store_id),r.price)
  from public.recipes r where r.id=p_recipe
$$;
revoke all on function public.pending_recipe_tax_quote(uuid) from public,anon,authenticated,service_role;
grant execute on function public.pending_recipe_tax_quote(uuid) to margincook_rpc_executor;
create function public.fixed_change_label(p_items jsonb)
returns text language sql immutable set search_path=pg_catalog,public as $$
  select coalesce(string_agg(
    case x->>'key' when 'labor' then '인건비' when 'rent' then '임대료' when 'utility' then '공과금'
      when 'commission' then '플랫폼 수수료' when 'marketing' then '광고/홍보' else x->>'key' end
    ||' '||trim_scale((x->>'total')::numeric)::text||'원'
    ||case when jsonb_array_length(coalesce(x->'lines','[]'))>0 then ' ('||
      (select string_agg(coalesce(l->>'name','항목')||' '||coalesce(l->>'amount','0')||'원',', ' order by n)
       from jsonb_array_elements(x->'lines') with ordinality a(l,n))||')' else '' end,
    ' · ' order by x->>'key'),'없음') from jsonb_array_elements(coalesce(p_items,'[]')) x
$$;
revoke all on function public.fixed_change_label(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.fixed_change_label(jsonb) to margincook_rpc_executor;

do $patch$
declare d text; a text; start_at integer; end_at integer;
begin
  d:=replace(pg_get_functiondef('public.e4_fixed_cost_saved(uuid,text,numeric)'::regprocedure),chr(13),'');
  start_at:=position('    -- ── 수정 내역(0063)' in d); end_at:=position('  end loop;' in d);
  if start_at=0 or end_at<=start_at then raise exception '0218 old fixed event anchors'; end if;
  -- Move audit ownership to the writer that has the full before/after configuration.
  execute substring(d from 1 for start_at-1)||substring(d from end_at);

  d:=pg_get_functiondef('public.save_fixed_costs(uuid,text,numeric,jsonb)'::regprocedure);
  d:=regexp_replace(d,'declare','declare v_before_items jsonb; v_before_revenue numeric; v_result jsonb; v_after_rate numeric; v_net numeric; v_cost numeric; v_rec record; v_changes jsonb; v_corr uuid:=gen_random_uuid();','i');
  a:='  v_prev := fixed_cost_rate(p_store, p_month);';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0218 fixed before anchor'; end if;
  d:=replace(d,a,a||' select items,total_revenue into v_before_items,v_before_revenue from public.fixed_costs_monthly where store_id=p_store and month=p_month for update;');
  a:='  insert into fixed_costs_monthly (store_id, month, total_revenue, items, updated_at)';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0218 no-op anchor'; end if;
  d:=replace(d,a,$new$  if v_before_items is not distinct from v_norm and v_before_revenue is not distinct from p_total_revenue then
    return jsonb_build_object('month',p_month,'rate',v_prev,'revenue',p_total_revenue,'fixed',
      coalesce((select sum((x->>'total')::numeric) from jsonb_array_elements(v_norm) x),0));
  end if;
$new$||a);
  a:='  return e4_fixed_cost_saved(p_store, p_month, v_prev);';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception '0218 fixed after anchor'; end if;
  execute replace(d,a,$new$  v_result:=e4_fixed_cost_saved(p_store,p_month,v_prev);
  v_after_rate:=public.fixed_cost_rate(p_store,p_month);
  -- A different historical/future month does not alter today's menu basis.
  if p_month=public.store_local_month(p_store) then
    for v_rec in select id,price from public.recipes where store_id=p_store loop
      select coalesce((public.pending_recipe_tax_quote(r.id)->>'net_sales')::numeric,
        r.price-public.tax_of(r.price,r.tax_mode,r.tax_items)),public.recipe_material_cost(r.id)+
        coalesce((select sum(amount_per_serving) from public.recipe_extra_costs where recipe_id=r.id),0)
        into v_net,v_cost from public.recipes r where r.id=v_rec.id;
      v_changes:=public.change_line('fixed_items','고정지출 항목',public.fixed_change_label(v_before_items),public.fixed_change_label(v_norm),null,'derived')
        ||public.change_line('fixed_revenue','배분 기준 매출',v_before_revenue,p_total_revenue,'원','derived')
        ||public.change_line('fixed_rate','고정지출률',coalesce(v_prev,0)*100,coalesce(v_after_rate,0)*100,'%','derived')
        ||public.change_line('fixed_cost','고정지출',coalesce(v_prev,0)*v_rec.price,coalesce(v_after_rate,0)*v_rec.price,'원','derived')
        ||public.change_line('profit','순이익',v_net-v_cost-coalesce(v_prev,0)*v_rec.price,v_net-v_cost-coalesce(v_after_rate,0)*v_rec.price,'원','derived');
      if v_changes='[]'::jsonb and v_before_items is distinct from v_norm then
        v_changes:=jsonb_build_array(jsonb_build_object('key','fixed_detail','label','고정지출 세부 설정',
          'before','이전 설정','after','변경한 설정','unit',null,'change_kind','derived','before_items',v_before_items,'after_items',v_norm));
      end if;
      perform public.record_entity_change(p_store,'recipe',v_rec.id,'fixed_cost','고정지출 반영',v_changes,true,null,v_corr,p_month||' 고정지출 항목·금액 변경');
    end loop;
  end if;
  return v_result;$new$);
end $patch$;
commit;
