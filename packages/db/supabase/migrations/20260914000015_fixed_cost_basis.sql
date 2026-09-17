-- 고정 지출은 대상 월을 제외한 직전 완료 1~3개월의 가중 평균률을 사용한다.
-- 필요한 월이 하나라도 없거나 월매출이 0이면 null(미적용)이며 누락 월을 0원으로 만들지 않는다.
begin;

alter table public.settings
  add column if not exists fixed_cost_basis_months smallint not null default 3
  check (fixed_cost_basis_months in (1,2,3));

create or replace function public.fixed_cost_basis_result(p_store uuid, p_month text)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_basis int;
  v_result jsonb;
begin
  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or to_char(to_date(p_month || '-01','YYYY-MM-DD'),'YYYY-MM') <> p_month then
    raise exception '월 형식이 올바르지 않습니다 (YYYY-MM)' using errcode='22000';
  end if;
  select fixed_cost_basis_months into v_basis from public.settings where store_id=p_store;
  if v_basis is null then v_basis:=3; end if;

  with wanted as (
    select g as position,
      to_char(to_date(p_month || '-01','YYYY-MM-DD') - make_interval(months=>g),'YYYY-MM') as month
    from generate_series(1,v_basis) g
  ), monthly as (
    select w.position,w.month,f.total_revenue,f.items,
      f.id is not null and f.total_revenue>0 as entered,
      case when f.id is null then null else coalesce((select sum((i->>'total')::numeric)
        from jsonb_array_elements(f.items) i),0) end as total_fixed
    from wanted w left join public.fixed_costs_monthly f on f.store_id=p_store and f.month=w.month
  ), aggregate as (
    select count(*) filter(where entered)::int entered_months,
      bool_and(entered) applied,
      min(month) from_month,max(month) to_month,
      coalesce(jsonb_agg(month order by position) filter(where not entered),'[]'::jsonb) missing_months,
      sum(total_revenue) filter(where entered) revenue_sum,
      sum(total_fixed) filter(where entered) fixed_sum,
      jsonb_agg(jsonb_build_object(
        'month',month,'entered',entered,'total_revenue',case when entered then total_revenue else null end,
        'total_fixed',case when entered then total_fixed else null end,
        'rate',case when entered then total_fixed/total_revenue else null end,
        'items',case when entered then items else '[]'::jsonb end
      ) order by position) months
    from monthly
  )
  select jsonb_build_object(
    'target_month',p_month,'basis_months',v_basis,'from_month',from_month,'to_month',to_month,
    'entered_months',entered_months,'missing_months',missing_months,'applied',applied,
    'rate',case when applied then fixed_sum/revenue_sum else null end,
    'average_revenue',case when applied then revenue_sum/v_basis else null end,
    'average_fixed',case when applied then fixed_sum/v_basis else null end,
    'revision',coalesce((select revision from public.settings where store_id=p_store),1),
    'months',months
  ) into v_result from aggregate;
  return v_result;
end;
$$;

create or replace function public.fixed_cost_rate(p_store uuid,p_month text)
returns numeric language sql stable security invoker set search_path='pg_catalog','public' as $$
  select (public.fixed_cost_basis_result(p_store,p_month)->>'rate')::numeric
$$;

create or replace function public.get_fixed_cost_basis(p_store uuid,p_month text)
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public' as $$
begin
  perform public.assert_my_store(p_store);
  return public.fixed_cost_basis_result(p_store,p_month);
end;
$$;

create or replace function public.save_fixed_cost_basis(p_store uuid,p_months smallint,p_base_revision integer default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public' as $$
declare
  v_old smallint; v_revision integer; v_month text; v_before numeric; v_after numeric;
  v_rec record; v_corr uuid:=gen_random_uuid(); v_changes jsonb;
begin
  perform public.assert_my_store(p_store);
  perform public.lock_business_scope(p_store);
  if p_months not in (1,2,3) or p_months is null then
    raise exception '고정 지출 기준은 최근 1~3개월 중에서 선택해 주세요' using errcode='22000';
  end if;
  select fixed_cost_basis_months,revision into v_old,v_revision from public.settings where store_id=p_store for update;
  if not found then raise exception '매장 설정을 찾지 못했어요' using errcode='22000'; end if;
  if p_base_revision is null then
    raise exception '설정 판본이 필요해요 — 설정을 다시 불러온 뒤 저장해 주세요' using errcode='22000',detail='BASE_REQUIRED';
  end if;
  if p_base_revision<>v_revision then
    raise exception '다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요' using errcode='45009',detail='REVISION_CONFLICT';
  end if;
  if v_old=p_months then return jsonb_build_object('changed',false,'revision',v_revision,'months',v_old); end if;

  v_month:=public.store_local_month(p_store);
  v_before:=public.fixed_cost_rate(p_store,v_month);
  update public.settings set fixed_cost_basis_months=p_months,revision=revision+1,updated_at=now()
    where store_id=p_store returning revision into v_revision;
  v_after:=public.fixed_cost_rate(p_store,v_month);

  perform public.record_configuration_change(p_store,'fixed_cost',v_month,
    jsonb_build_object('basis_months',v_old),jsonb_build_object('basis_months',p_months));
  if v_before is distinct from v_after then
    for v_rec in select id,price from public.recipes where store_id=p_store and coalesce(active,true) loop
      perform public.recompute_recipe(v_rec.id,'fixed',public.store_local_date(p_store));
      v_changes:=public.change_line('fixed_basis','고정 지출 기준','최근 '||v_old||'개월 평균','최근 '||p_months||'개월 평균',null,'derived')
        ||public.change_line('fixed_rate','고정 지출률',coalesce(v_before,0)*100,coalesce(v_after,0)*100,'%', 'derived')
        ||public.change_line('fixed_cost','고정 지출',coalesce(v_before,0)*v_rec.price,coalesce(v_after,0)*v_rec.price,'원','derived');
      perform public.record_entity_change(p_store,'recipe',v_rec.id,'fixed_cost','고정지출 반영',v_changes,true,null,v_corr,'고정 지출 계산 기준 변경');
    end loop;
  end if;
  return jsonb_build_object('changed',true,'revision',v_revision,'months',p_months,'rate',v_after);
end;
$$;

-- 저장 월이 현재 계산 구간에 포함되면 현재 메뉴 손익까지 다시 계산하도록 기존 E4 문을 교정한다.
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.e4_fixed_cost_saved(uuid,text,numeric)'::regprocedure);
  d:=replace(d,'v_rate := fixed_cost_rate(p_store, p_month);','v_rate := fixed_cost_rate(p_store, public.store_local_month(p_store));');
  d:=replace(d,$old$v_day := least((to_date(p_month, 'YYYY-MM') + interval '1 month - 1 day')::date, store_local_date(p_store));$old$,'v_day := store_local_date(p_store);');
  d:=replace(d,'if p_month=public.store_local_month(p_store) and (p_prev_rate is null or p_prev_rate is distinct from v_rate) then','if p_prev_rate is distinct from v_rate then');
  execute d;

  d:=pg_get_functiondef('public.save_fixed_costs(uuid,text,numeric,jsonb)'::regprocedure);
  a:='v_prev := fixed_cost_rate(p_store, p_month);';
  if position(a in d)>0 then
    d:=replace(d,a,'v_prev := fixed_cost_rate(p_store, public.store_local_month(p_store));');
  elsif position('v_prev := fixed_cost_rate(p_store, public.store_local_month(p_store));' in d)=0 then
    raise exception '0015 save_fixed_costs before-rate anchor';
  end if;
  a:='v_after_rate:=public.fixed_cost_rate(p_store,p_month);';
  if position(a in d)>0 then
    d:=replace(d,a,'v_after_rate:=public.fixed_cost_rate(p_store,public.store_local_month(p_store));');
  elsif position('v_after_rate:=public.fixed_cost_rate(p_store,public.store_local_month(p_store));' in d)=0 then
    raise exception '0015 save_fixed_costs after-rate anchor';
  end if;
  a:='if p_month=public.store_local_month(p_store) then';
  if position(a in d)>0 then
    d:=replace(d,a,$new$if exists(select 1 from jsonb_array_elements(public.fixed_cost_basis_result(p_store,public.store_local_month(p_store))->'months') m where m->>'month'=p_month) then$new$);
  elsif position('if v_prev is distinct from v_after_rate then' in d)>0 then
    d:=replace(d,'if v_prev is distinct from v_after_rate then',$new$if exists(select 1 from jsonb_array_elements(public.fixed_cost_basis_result(p_store,public.store_local_month(p_store))->'months') m where m->>'month'=p_month) then$new$);
  elsif position($new$if exists(select 1 from jsonb_array_elements(public.fixed_cost_basis_result(p_store,public.store_local_month(p_store))->'months') m where m->>'month'=p_month) then$new$ in d)=0 then
    raise exception '0015 save_fixed_costs audit anchor';
  end if;
  execute d;
end $patch$;

revoke all on function public.fixed_cost_basis_result(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.get_fixed_cost_basis(uuid,text) from public,anon;
revoke all on function public.save_fixed_cost_basis(uuid,smallint,integer) from public,anon;
grant execute on function public.get_fixed_cost_basis(uuid,text) to authenticated,service_role;
grant execute on function public.save_fixed_cost_basis(uuid,smallint,integer) to authenticated,service_role;

grant create on schema public to costkeep_rpc_executor;
alter function public.fixed_cost_basis_result(uuid,text) owner to costkeep_rpc_executor;
alter function public.get_fixed_cost_basis(uuid,text) owner to costkeep_rpc_executor;
revoke create on schema public from costkeep_rpc_executor;

comment on function public.fixed_cost_rate(uuid,text) is '대상 월 제외 직전 완료 1~3개월의 합계 고정 지출/합계 매출. 필요한 월 누락 또는 매출 0이면 null.';
comment on function public.get_fixed_cost_basis(uuid,text) is '회원 매장의 고정 지출 적용 기준·완료 월 범위·누락 월·월별 입력 상태를 반환한다.';
comment on function public.save_fixed_cost_basis(uuid,smallint,integer) is '최근 1/2/3개월 고정 지출 기준을 판본으로 저장하고 현재 메뉴 손익에 전파한다.';

commit;
