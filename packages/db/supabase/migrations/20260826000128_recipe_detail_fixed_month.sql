-- ════════════════════════════════════════════════════════════════
-- 0128 · recipe_detail 이 고정지출 **비율과 항목을 같이** 낸다
--
-- 0126 에서 앱이 `useFixedCosts(localDate.slice(0,7))` 로 달을 맞췄다. 거의 맞지만
-- 서로 다른 RPC 두 번이라 매장 자정 사이에 갈릴 창이 남는다 —
--     ① business_day_state 가 local_date 를 준다        … 8/31
--     ② recipe_detail 이 그 사이에 호출되어 fixed_rate 를 낸다 … 9/1
-- 그러면 다시 **9월 비율을 8월 항목으로 쪼갠다.** 합계는 맞고 줄마다 틀린다 —
-- 화면에서 제일 알아채기 어려운 종류다.
--
-- 그래서 두 값을 **한 문장 안에서** 낸다. `language sql` 함수라 `now()` 가 문장 하나에
-- 고정되고, 아래 lateral 로 `store_local_month` 을 딱 한 번만 평가한다.
-- 앱은 이제 이 화면에서 고정지출 RPC 를 **부르지 않는다** — 갈릴 두 번이 없어진다.
--
-- 응답에 키 두 개가 는다(빼는 건 없다):
--   fixed_month : 비율을 낼 때 쓴 달('YYYY-MM')
--   fixed_items : 그 달의 고정지출 항목 배열(fixed_costs_monthly.items 그대로)
-- ════════════════════════════════════════════════════════════════

do $m$
declare
  v_def text;
  v_new text;
  v_old_tail text := '  from recipes r where r.id = p_recipe;';
  v_new_tail text := '  from recipes r'
                  || E'\n' || '  -- 한 번만 평가한다. 아래 세 자리가 반드시 같은 달을 봐야 한다.'
                  || E'\n' || '  cross join lateral (select store_local_month(r.store_id) as m) fm'
                  || E'\n' || '  where r.id = p_recipe;';
  v_old_rate text := '''fixed_rate'', coalesce(fixed_cost_rate(r.store_id, store_local_month(r.store_id)), 0),';
  v_new_rate text := '''fixed_rate'', coalesce(fixed_cost_rate(r.store_id, fm.m), 0),'
                  || E'\n' || '    -- 그 비율을 낸 달과 그 달의 항목을 같이 준다(0128).'
                  || E'\n' || '    ''fixed_month'', fm.m,'
                  || E'\n' || '    ''fixed_items'', coalesce('
                  || E'\n' || '      (select fcm.items from fixed_costs_monthly fcm'
                  || E'\n' || '        where fcm.store_id = r.store_id and fcm.month = fm.m), ''[]''::jsonb),';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recipe_detail';
  if v_def is null then
    raise exception '0128: recipe_detail 이 없습니다';
  end if;

  -- ⚠ 조각이 안 맞으면 **크게 터뜨린다.** 조용히 return 하면 마이그레이션이
  --   초록인데 아무것도 안 바뀐 상태가 된다(0102 §4 에서 실제로 그랬다).
  if position(v_old_tail in v_def) = 0 then
    raise exception '0128: 꼬리 조각을 못 찾았습니다 — recipe_detail 이 그 사이에 바뀌었습니다';
  end if;
  if position(v_old_rate in v_def) = 0 then
    raise exception '0128: fixed_rate 조각을 못 찾았습니다 — recipe_detail 이 그 사이에 바뀌었습니다';
  end if;

  v_new := replace(v_def, v_old_rate, v_new_rate);
  v_new := replace(v_new, v_old_tail, v_new_tail);
  execute v_new;
end $m$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_def text;
  v_res jsonb;
  v_rid uuid;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recipe_detail';

  if position('''fixed_month'', fm.m' in v_def) = 0
     or position('''fixed_items''' in v_def) = 0 then
    raise exception '0128: 새 정의에 fixed_month/fixed_items 가 없습니다';
  end if;
  -- 옛 호출이 남아 있으면 두 자리가 서로 다른 달을 볼 수 있다.
  if position('fixed_cost_rate(r.store_id, store_local_month(' in v_def) > 0 then
    raise exception '0128: fixed_rate 가 아직 store_local_month 을 따로 부릅니다';
  end if;

  -- 실제로 한 번 돌려 본다. 레시피가 없으면(빈 DB) 건너뛴다.
  select id into v_rid from recipes limit 1;
  if v_rid is not null then
    v_res := recipe_detail(v_rid);
    if v_res->>'fixed_month' is null then
      raise exception '0128: 응답에 fixed_month 가 비어 있습니다';
    end if;
    if jsonb_typeof(v_res->'fixed_items') <> 'array' then
      raise exception '0128: fixed_items 가 배열이 아닙니다 — %',
        jsonb_typeof(v_res->'fixed_items');
    end if;
    -- 비율을 낸 달과 항목을 가져온 달이 같은지. 이게 이 마이그레이션의 목적이다.
    if (v_res->>'fixed_month') is distinct from store_local_month((select store_id from recipes where id = v_rid)) then
      raise exception '0128: fixed_month(%) 가 매장 현지 달과 다릅니다', v_res->>'fixed_month';
    end if;
  end if;
end $v$;

select public.assert_no_rpc_overloads();
