-- ════════════════════════════════════════════════════════════════
-- seed.sql · 개발용 시드 (supabase db reset 시 자동 적용)
-- 기본 카테고리 12종 + 검산 데모 데이터(한끼 백반 / 제육볶음).
-- ⚠ 개발 전용. 운영 시드는 별도.
-- ════════════════════════════════════════════════════════════════

-- 고정 UUID (재실행 안전)
do $$
declare
  v_user  uuid := '00000000-0000-0000-0000-0000000000a1';
  v_store uuid := '00000000-0000-0000-0000-0000000000b1';
begin
  -- 데모 로그인 사용자 (로컬 전용)
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'demo@sikjae.local', crypt('demo1234', gen_salt('bf')), now(), now(), now())
  on conflict (id) do nothing;

  insert into stores (id, owner_id, name) values (v_store, v_user, '한끼 백반')
  on conflict (id) do nothing;

  insert into settings (store_id) values (v_store) on conflict do nothing;

  -- 기본 카테고리 12종 (③ 3.2 / ④ 4.1) — 로스율 기본값 일부
  insert into categories (store_id, name, sort_order, default_loss_rate) values
    (v_store, '축산-계란',        1, 0),
    (v_store, '수산-해조류',      2, 10),
    (v_store, '농산(신선)',       3, 12),
    (v_store, '곡물-견과-분말',   4, 0),
    (v_store, '유제품',           5, 0),
    (v_store, '냉동식품',         6, 0),
    (v_store, '소스-유지류-장류', 7, 0),
    (v_store, '향신료-허브',      8, 5),
    (v_store, '음료-주류',        9, 0),
    (v_store, '상온가공-건식',   10, 0),
    (v_store, '두부-발효식품',   11, 0),
    (v_store, '베이커리',        12, 0)
  on conflict do nothing;
end $$;

-- ── 검산 데모: 대파/돼지고기/양파/다진마늘 + 제육볶음 ──────────
do $$
declare
  v_store uuid := '00000000-0000-0000-0000-0000000000b1';
  c_veg  uuid; c_meat uuid; c_sauce uuid;
  i_pa uuid; i_pork uuid; i_onion uuid; i_garlic uuid;
  r_jeyuk uuid;
begin
  if exists (select 1 from ingredients where store_id = v_store) then return; end if;

  select id into c_veg   from categories where store_id=v_store and name='농산(신선)';
  select id into c_meat  from categories where store_id=v_store and name='축산-계란';
  select id into c_sauce from categories where store_id=v_store and name='소스-유지류-장류';

  insert into ingredients (store_id,name,category_id,base_unit,per_volume,purchase_unit_label,loss_rate,safety_stock,min_order_qty)
    values (v_store,'대파',c_veg,'g',1000,'단',15,2,1) returning id into i_pa;
  insert into ingredients (store_id,name,category_id,base_unit,per_volume,purchase_unit_label,loss_rate,safety_stock,min_order_qty)
    values (v_store,'돼지고기 앞다리',c_meat,'g',5000,'팩',0,1,1) returning id into i_pork;
  insert into ingredients (store_id,name,category_id,base_unit,per_volume,purchase_unit_label,loss_rate,safety_stock,min_order_qty)
    values (v_store,'양파',c_veg,'g',1200,'망',10,3,1) returning id into i_onion;
  insert into ingredients (store_id,name,category_id,base_unit,per_volume,purchase_unit_label,loss_rate,safety_stock,min_order_qty)
    values (v_store,'다진마늘',c_sauce,'g',1000,'통',0,2,1) returning id into i_garlic;

  -- 재고 상태 (대파 미개봉2·개봉1 / 양파 부족 / 다진마늘 곧소진)
  insert into inventory_states (ingredient_id,store_id,sealed_count,opened_count,soon_out) values
    (i_pa, v_store, 2, 1, false),
    (i_pork, v_store, 1, 1, false),
    (i_onion, v_store, 0, 1, false),
    (i_garlic, v_store, 0, 1, true);

  -- 대파 구매 이력 → 기준단가 4.71원/g (가중평균 3.83 ÷ 0.85 ≈ 4.51, 단가 미리보기는 4.71)
  insert into order_records (store_id,ingredient_id,volume,amount,qty,ordered_at,status,source) values
    (v_store,i_pa,1000,4000,2,'2026-06-03','received','manual'),
    (v_store,i_pa,1000,3600,3,'2026-05-28','received','manual'),
    (v_store,i_pa,1000,4200,1,'2026-05-20','received','manual');

  -- 제육볶음 (10인분, 판매가 12,000, 부가세 포함, 목표 40%)
  insert into recipes (store_id,name,price,tax_mode,base_servings,target_profit_rate,avg_monthly_sales)
    values (v_store,'제육볶음',12000,'included',10,40,300) returning id into r_jeyuk;

  -- 재료 라인 (10인분 입력량)
  insert into recipe_lines (store_id,recipe_id,ingredient_id,input_qty) values
    (v_store,r_jeyuk,i_pork,2000),   -- 1인분 200g
    (v_store,r_jeyuk,i_onion,680),   -- 1인분 68g
    (v_store,r_jeyuk,i_pa,300);      -- 1인분 30g
  insert into recipe_extra_costs (store_id,recipe_id,name,amount_per_serving)
    values (v_store,r_jeyuk,'특수 포장용기',300);

  -- 6월 고정 지출 → 고정지출률 31.3%
  insert into fixed_costs_monthly (store_id,month,total_revenue,items) values
    (v_store,'2026-06',12000000, jsonb_build_array(
      jsonb_build_object('key','labor','mode','total','total',6500000,'lines','[]'::jsonb),
      jsonb_build_object('key','commission','mode','total','total',1100000,'lines','[]'::jsonb),
      jsonb_build_object('key','delivery','mode','total','total',227000,'lines','[]'::jsonb),
      jsonb_build_object('key','packing','mode','total','total',160000,'lines','[]'::jsonb),
      jsonb_build_object('key','ads','mode','total','total',253000,'lines','[]'::jsonb)
    ));
end $$;
