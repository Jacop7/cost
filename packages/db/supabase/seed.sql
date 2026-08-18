-- ════════════════════════════════════════════════════════════════
-- seed.sql · 개발용 시드 (supabase db reset 시 자동 적용)
--
-- ▸ 원칙: **화면에서 등록하는 것과 똑같은 경로로만 만든다.**
--   테이블에 직접 INSERT 하지 않고 save_ingredient / save_recipe / e7 / e1 / e10 을 부른다.
--   직접 넣으면 "산 적 없는 재고", "발주 없는 입고" 처럼 실제로는 만들어질 수 없는 상태가 생기고,
--   그 위에서 계산한 원가·손익은 앱에서 재현되지 않는다. (이전 시드에서 실제로 그랬다.)
--
-- ▸ 시간: 오늘 하루치가 아니라 **최근 3주**를 날짜순으로 재생한다.
--   입고 → 판매 → 입고 → 판매 … 순서를 지켜야 재고가 음수로 빠지지 않고,
--   단가 추이·손익 추이·매출 분석의 기간 선택이 실제로 볼 게 있는 상태가 된다.
--
-- ▸ 검산 고정: AGENTS.md 의 기준값을 깨뜨리지 않는다.
--     대파 4.7059원/g · 돼지고기 13.0 · 양파 2.1 · 다진마늘 8.5
--     제육볶음 1인분 재료비 2,834.55 / 고정지출률 31.3%
--   base_unit_price 는 **전체 입고 이력의 가중평균**이므로, 이 네 품목은 매번 같은 단가로
--   재입고한다(계약 단가를 쓰는 거래처). 단가가 움직이는 그래프는 나머지 품목이 담당한다.
--
-- ⚠ 개발 전용. 운영 시드는 별도.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 인증 (postgres 권한 필요) ──────────────────────────────
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- ⚠ 토큰 컬럼들은 **빈 문자열**이어야 한다. GoTrue 는 NOT NULL string 으로 스캔하므로
  --   NULL 이면 로그인 시 500 이 난다:
  --     "Scan error on column index 3, name confirmation_token: converting NULL to string is unsupported"
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          confirmation_token, recovery_token,
                          email_change, email_change_token_new, email_change_token_current,
                          phone_change, phone_change_token, reauthentication_token,
                          raw_app_meta_data, raw_user_meta_data)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'demo@sikjae.local', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
          '', '', '', '', '', '', '', '',
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
  on conflict (id) do nothing;

  -- 이메일 로그인은 identities 행도 있어야 provider 매칭이 된다.
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user, v_user::text,
          jsonb_build_object('sub', v_user::text, 'email', 'demo@sikjae.local', 'email_verified', true),
          'email', now(), now(), now())
  on conflict do nothing;

  insert into stores (id, owner_id, name)
  values ('00000000-0000-0000-0000-0000000000b1', v_user, '한끼 백반')
  on conflict (id) do nothing;
end $$;

-- ── 2. 여기서부터는 **앱과 같은 권한**으로 ────────────────────
-- superuser 로 만들면 RLS 를 우회해버려 "시드는 되는데 앱에서는 안 되는" 상태를 못 잡는다.
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

do $$
declare
  v_store uuid := '00000000-0000-0000-0000-0000000000b1';

  -- 거래처
  vd_nong uuid; vd_chuk uuid; vd_mart uuid; vd_online uuid;
  -- 카테고리
  c_meat uuid; c_sea uuid; c_veg uuid; c_grain uuid; c_dairy uuid; c_frozen uuid;
  c_sauce uuid; c_spice uuid; c_drink uuid; c_dry uuid; c_tofu uuid; c_bake uuid;
  -- 식재료
  i_pa uuid; i_pork uuid; i_onion uuid; i_garlic uuid;
  i_kimchi uuid; i_tofu uuid; i_egg uuid; i_gochu uuid; i_doenjang uuid;
  i_gochujang uuid; i_rice uuid; i_hobak uuid; i_cheong uuid; i_oil uuid;
  i_sugar uuid; i_soy uuid; i_beef uuid; i_anchovy uuid;
  -- 레시피
  r_jeyuk uuid; r_kimchi uuid; r_doenjang uuid; r_gyeran uuid; r_sundubu uuid;
  r_rice uuid; r_sauce uuid; r_bulgogi uuid;

  d       int;
  v_day   date;
  o       uuid;
  v_seq   int := 0;

  -- 하루 판매량에 요일 색을 준다. 전부 같은 숫자면 매출 그래프가 직선이라
  -- "이 화면이 진짜 데이터를 그리고 있나"를 확인할 수 없다.
  v_w     numeric;
begin
  if exists (select 1 from ingredients where store_id = v_store) then
    raise notice '시드 생략 — 이미 데이터가 있습니다';
    return;
  end if;

  insert into settings (store_id) values (v_store) on conflict do nothing;

  -- ── 거래처 (MY-03) ──────────────────────────────────────────
  vd_nong   := save_vendor(v_store, '{"name":"성동청과"}');
  vd_chuk   := save_vendor(v_store, '{"name":"마장축산"}');
  vd_mart   := save_vendor(v_store, '{"name":"동네마트"}');
  vd_online := save_vendor(v_store, '{"name":"식자재쇼핑몰"}');

  -- ── 카테고리 12종 (③ 3.2 / ④ 4.1) ─────────────────────────
  c_meat      := save_category(v_store, '{"name":"축산-계란","sort_order":1,"default_loss_rate":0}');
  c_sea       := save_category(v_store, '{"name":"수산-해조류","sort_order":2,"default_loss_rate":10}');
  c_veg       := save_category(v_store, '{"name":"농산(신선)","sort_order":3,"default_loss_rate":12}');
  c_grain     := save_category(v_store, '{"name":"곡물-견과-분말","sort_order":4,"default_loss_rate":0}');
  c_dairy     := save_category(v_store, '{"name":"유제품","sort_order":5,"default_loss_rate":0}');
  c_frozen    := save_category(v_store, '{"name":"냉동식품","sort_order":6,"default_loss_rate":0}');
  c_sauce     := save_category(v_store, '{"name":"소스-유지류-장류","sort_order":7,"default_loss_rate":0}');
  c_spice     := save_category(v_store, '{"name":"향신료-허브","sort_order":8,"default_loss_rate":5}');
  c_drink     := save_category(v_store, '{"name":"음료-주류","sort_order":9,"default_loss_rate":0}');
  c_dry       := save_category(v_store, '{"name":"상온가공-건식","sort_order":10,"default_loss_rate":0}');
  c_tofu      := save_category(v_store, '{"name":"두부-발효식품","sort_order":11,"default_loss_rate":0}');
  c_bake      := save_category(v_store, '{"name":"베이커리","sort_order":12,"default_loss_rate":0}');

  -- ── 판매 채널 (SALES) ───────────────────────────────────────
  perform save_channel(v_store, '{"code":"hall","name":"매장","fee_rate":0}');
  perform save_channel(v_store, '{"code":"delivery","name":"배달앱","fee_rate":14.7,"fee_note":"중개+결제+배달비 합산"}');
  perform save_channel(v_store, '{"code":"takeout","name":"포장","fee_rate":3.3,"fee_note":"포장 주문 중개"}');

  -- ── 식재료 (ING-02 등록 화면과 같은 함수) ───────────────────
  -- 검산 4종 — 단가가 고정이어야 하는 품목
  i_pa     := save_ingredient(v_store, jsonb_build_object('name','대파','category_id',c_veg,'base_unit','g','per_volume',1000,'loss_rate',15,'safety_stock',2,'min_order_qty',1,'default_vendor_id',vd_nong));
  i_pork   := save_ingredient(v_store, jsonb_build_object('name','돼지고기 앞다리','category_id',c_meat,'base_unit','g','per_volume',5000,'loss_rate',0,'safety_stock',2,'min_order_qty',1,'default_vendor_id',vd_chuk));
  i_onion  := save_ingredient(v_store, jsonb_build_object('name','양파','category_id',c_veg,'base_unit','g','per_volume',1200,'loss_rate',10,'safety_stock',3,'min_order_qty',1,'default_vendor_id',vd_nong));
  i_garlic := save_ingredient(v_store, jsonb_build_object('name','다진마늘','category_id',c_sauce,'base_unit','g','per_volume',1000,'loss_rate',0,'safety_stock',2,'min_order_qty',1,'default_vendor_id',vd_online));

  -- 나머지 — 단가가 움직이는 품목들
  i_kimchi    := save_ingredient(v_store, jsonb_build_object('name','배추김치','category_id',c_tofu,'base_unit','g','per_volume',10000,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_tofu      := save_ingredient(v_store, jsonb_build_object('name','두부','category_id',c_tofu,'base_unit','ea','per_volume',1,'loss_rate',0,'safety_stock',10,'min_order_qty',10,'default_vendor_id',vd_mart,'memo','찌개용 부침두부. 유통기한 짧음'));
  i_egg       := save_ingredient(v_store, jsonb_build_object('name','계란','category_id',c_meat,'base_unit','ea','per_volume',30,'loss_rate',3,'safety_stock',2,'min_order_qty',1,'default_vendor_id',vd_mart));
  i_gochu     := save_ingredient(v_store, jsonb_build_object('name','고춧가루','category_id',c_spice,'base_unit','g','per_volume',1000,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_doenjang  := save_ingredient(v_store, jsonb_build_object('name','된장','category_id',c_sauce,'base_unit','g','per_volume',3000,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_gochujang := save_ingredient(v_store, jsonb_build_object('name','고추장','category_id',c_sauce,'base_unit','g','per_volume',3000,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_rice      := save_ingredient(v_store, jsonb_build_object('name','쌀','category_id',c_grain,'base_unit','g','per_volume',10000,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_hobak     := save_ingredient(v_store, jsonb_build_object('name','애호박','category_id',c_veg,'base_unit','g','per_volume',300,'loss_rate',8,'safety_stock',5,'min_order_qty',5,'default_vendor_id',vd_nong));
  i_cheong    := save_ingredient(v_store, jsonb_build_object('name','청양고추','category_id',c_veg,'base_unit','g','per_volume',200,'loss_rate',10,'safety_stock',3,'min_order_qty',3,'default_vendor_id',vd_nong));
  i_oil       := save_ingredient(v_store, jsonb_build_object('name','식용유','category_id',c_sauce,'base_unit','ml','per_volume',1800,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_sugar     := save_ingredient(v_store, jsonb_build_object('name','설탕','category_id',c_grain,'base_unit','g','per_volume',3000,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_soy       := save_ingredient(v_store, jsonb_build_object('name','진간장','category_id',c_sauce,'base_unit','ml','per_volume',1800,'loss_rate',0,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));
  i_beef      := save_ingredient(v_store, jsonb_build_object('name','소고기 불고기감','category_id',c_meat,'base_unit','g','per_volume',1000,'loss_rate',0,'safety_stock',2,'min_order_qty',1,'default_vendor_id',vd_chuk));
  i_anchovy   := save_ingredient(v_store, jsonb_build_object('name','국물용 멸치','category_id',c_sea,'base_unit','g','per_volume',500,'loss_rate',5,'safety_stock',1,'min_order_qty',1,'default_vendor_id',vd_online));

  -- ── 구매 옵션 (ING-05) ──────────────────────────────────────
  -- 같은 재료를 어디서 얼마에 살 수 있는지. 발주 화면이 여기서 값을 채운다.
  perform save_purchase_option(v_store, jsonb_build_object('ingredient_id',i_pork,'purchase_name','앞다리살 5kg 박스','vendor_id',vd_chuk,'volume',5000,'amount',65000));
  perform save_purchase_option(v_store, jsonb_build_object('ingredient_id',i_pork,'purchase_name','앞다리살 2kg 소포장','vendor_id',vd_mart,'volume',2000,'amount',27600));
  perform save_purchase_option(v_store, jsonb_build_object('ingredient_id',i_garlic,'purchase_name','다진마늘 1kg','vendor_id',vd_online,'volume',1000,'amount',8500,'url','https://example.com/garlic-1kg'));
  perform save_purchase_option(v_store, jsonb_build_object('ingredient_id',i_kimchi,'purchase_name','포기김치 10kg','vendor_id',vd_online,'volume',10000,'amount',32000,'url','https://example.com/kimchi-10kg'));
  perform save_purchase_option(v_store, jsonb_build_object('ingredient_id',i_rice,'purchase_name','신동진 10kg','vendor_id',vd_online,'volume',10000,'amount',32000));
  perform save_purchase_option(v_store, jsonb_build_object('ingredient_id',i_oil,'purchase_name','카놀라유 1.8L','vendor_id',vd_online,'volume',1800,'amount',6500));

  -- ── 레시피 (RCP-03 등록 화면과 같은 함수) ───────────────────
  --
  -- ⚠ 제육볶음은 검산 고정값이다.
  --   1인분 = 200g 돼지 + 50g 양파 + 25g 대파 + 1.4g 마늘
  --         = 200×13.0 + 50×2.1 + 25×4.7059 + 1.4×8.5 = 2,834.55
  --   + 부가 원가 300 / 판매가 12,000 부가세포함 / 고정지출률 31.3%
  --   → 순이익 4,014원 · 33.4% (AGENTS.md)
  r_jeyuk := save_recipe(v_store, jsonb_build_object(
    'name','제육볶음','price',12000,'tax_mode','included','base_servings',10,
    'target_profit_rate',40,'avg_monthly_sales',300,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id',i_pork,  'input_qty',2000),
      jsonb_build_object('ingredient_id',i_onion, 'input_qty', 500),
      jsonb_build_object('ingredient_id',i_pa,    'input_qty', 250),
      jsonb_build_object('ingredient_id',i_garlic,'input_qty',  14)),
    'extras', jsonb_build_array(jsonb_build_object('name','특수 포장용기','amount',300))));

  r_kimchi := save_recipe(v_store, jsonb_build_object(
    'name','김치찌개','price',9000,'tax_mode','included','base_servings',10,
    'target_profit_rate',35,'avg_monthly_sales',260,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id',i_kimchi,'input_qty',2500),
      jsonb_build_object('ingredient_id',i_pork,  'input_qty', 800),
      jsonb_build_object('ingredient_id',i_tofu,  'input_qty',   5),
      jsonb_build_object('ingredient_id',i_pa,    'input_qty', 200),
      jsonb_build_object('ingredient_id',i_garlic,'input_qty',  20),
      jsonb_build_object('ingredient_id',i_gochu, 'input_qty',  60),
      jsonb_build_object('ingredient_id',i_gochujang,'input_qty',150),
      jsonb_build_object('ingredient_id',i_cheong, 'input_qty', 100)),
    'extras', jsonb_build_array(jsonb_build_object('name','뚝배기 가스비','amount',120))));

  r_doenjang := save_recipe(v_store, jsonb_build_object(
    'name','된장찌개','price',8000,'tax_mode','included','base_servings',10,
    'target_profit_rate',35,'avg_monthly_sales',210,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id',i_doenjang,'input_qty',450),
      jsonb_build_object('ingredient_id',i_tofu,    'input_qty',  5),
      jsonb_build_object('ingredient_id',i_hobak,   'input_qty',600),
      jsonb_build_object('ingredient_id',i_onion,   'input_qty',400),
      jsonb_build_object('ingredient_id',i_pa,      'input_qty',150),
      jsonb_build_object('ingredient_id',i_anchovy, 'input_qty',120),
      jsonb_build_object('ingredient_id',i_garlic,  'input_qty', 20)),
    'extras', jsonb_build_array(jsonb_build_object('name','뚝배기 가스비','amount',120))));

  r_sundubu := save_recipe(v_store, jsonb_build_object(
    'name','순두부찌개','price',9000,'tax_mode','included','base_servings',10,
    'target_profit_rate',35,'avg_monthly_sales',180,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id',i_tofu,   'input_qty', 10),
      jsonb_build_object('ingredient_id',i_gochu,  'input_qty', 80),
      jsonb_build_object('ingredient_id',i_onion,  'input_qty',300),
      jsonb_build_object('ingredient_id',i_pa,     'input_qty',150),
      jsonb_build_object('ingredient_id',i_egg,    'input_qty', 10),
      jsonb_build_object('ingredient_id',i_anchovy,'input_qty',100),
      jsonb_build_object('ingredient_id',i_oil,    'input_qty',100)),
    'extras', jsonb_build_array(jsonb_build_object('name','뚝배기 가스비','amount',120))));

  r_gyeran := save_recipe(v_store, jsonb_build_object(
    'name','계란말이','price',7000,'tax_mode','included','base_servings',10,
    'target_profit_rate',45,'avg_monthly_sales',150,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id',i_egg,   'input_qty', 40),
      jsonb_build_object('ingredient_id',i_onion, 'input_qty',300),
      jsonb_build_object('ingredient_id',i_pa,    'input_qty',150),
      jsonb_build_object('ingredient_id',i_oil,   'input_qty',120))));

  r_rice := save_recipe(v_store, jsonb_build_object(
    'name','공기밥','price',1000,'tax_mode','included','base_servings',10,
    'target_profit_rate',60,'avg_monthly_sales',900,
    'lines', jsonb_build_array(jsonb_build_object('ingredient_id',i_rice,'input_qty',1200))));

  -- 반제품 — 이것 자체는 팔지 않는다(active=false). 불고기가 재료로 쓴다.
  -- 반제품이 섞인 원가·소진 경로가 실제로 도는지 확인하는 용도이기도 하다.
  r_sauce := save_recipe(v_store, jsonb_build_object(
    'name','불고기 양념장','price',0,'tax_mode','exempt','base_servings',20,
    'target_profit_rate',0,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id',i_soy,   'input_qty',400),
      jsonb_build_object('ingredient_id',i_sugar, 'input_qty',300),
      jsonb_build_object('ingredient_id',i_onion, 'input_qty',400),
      jsonb_build_object('ingredient_id',i_garlic,'input_qty', 60),
      jsonb_build_object('ingredient_id',i_pa,    'input_qty',100))));
  perform deactivate_recipe(r_sauce);

  r_bulgogi := save_recipe(v_store, jsonb_build_object(
    'name','소불고기','price',14000,'tax_mode','included','base_servings',10,
    'target_profit_rate',35,'avg_monthly_sales',120,
    'lines', jsonb_build_array(
      jsonb_build_object('ingredient_id',i_beef,'input_qty',1500),
      jsonb_build_object('ingredient_id',i_onion,'input_qty',600),
      jsonb_build_object('sub_recipe_id', r_sauce,'input_qty', 10)),   -- 양념장 10인분분
    'extras', jsonb_build_array(jsonb_build_object('name','불판 가스비','amount',200))));

  -- ── 고정지출 (MY-05) ────────────────────────────────────────
  -- 고정지출률 **31.3%** (3,756,000 / 12,000,000) — AGENTS.md 검산값.
  -- ⚠ 항목을 고칠 땐 합계를 반드시 다시 맞출 것.
  --
  -- 지난달과 이번달 둘 다 넣는다. recompute_recipe 는 `business_month()`(오늘 기준)로
  -- 고정지출률을 찾으므로 과거 월만 있으면 오늘 조회가 null 이 되어 고정지출 0 으로 계산된다
  -- (실증: 33.49% 여야 할 값이 64.79% 로 나왔다).
  perform save_fixed_costs(v_store, m, 12000000, jsonb_build_array(
      jsonb_build_object('key','labor',     'mode','total','total',2400000,'lines','[]'::jsonb),
      jsonb_build_object('key','commission','mode','total','total', 603000,'lines','[]'::jsonb),
      jsonb_build_object('key','packing',   'mode','total','total', 380000,'lines','[]'::jsonb),
      jsonb_build_object('key','delivery',  'mode','total','total', 120000,'lines','[]'::jsonb),
      jsonb_build_object('key','ads',       'mode','total','total', 253000,'lines','[]'::jsonb)
    ))  -- 2,400,000 + 603,000 + 380,000 + 120,000 + 253,000 = 3,756,000
  from (select distinct m from unnest(array[
          to_char((business_day() - 30)::date, 'YYYY-MM'),
          business_month()]) m) months;

  -- ══════════════════════════════════════════════════════════
  -- 최근 3주 재생 — 입고와 판매를 **날짜 순서대로**
  -- ══════════════════════════════════════════════════════════
  for d in reverse 21 .. 0 loop
    v_day := business_day() - d;
    v_seq := v_seq + 1;

    -- ── 입고 (E7 발주 → E1 입고 확정) ───────────────────────
    -- 첫날은 개업 재고를 크게 채우고, 이후 3일마다 보충한다.
    if v_seq = 1 then
      o := e7_place_order(v_store, i_pork,      vd_chuk,   null, 5000, 65000, 4, v_day); perform e1_confirm_inbound(o, 4, 'S1-PORK',   v_day);
      o := e7_place_order(v_store, i_pa,        vd_nong,   null, 1000,  4000, 4, v_day); perform e1_confirm_inbound(o, 4, 'S1-PA',     v_day);
      o := e7_place_order(v_store, i_onion,     vd_nong,   null, 1200,  2268, 6, v_day); perform e1_confirm_inbound(o, 6, 'S1-ONION',  v_day);
      o := e7_place_order(v_store, i_garlic,    vd_online, null, 1000,  8500, 2, v_day); perform e1_confirm_inbound(o, 2, 'S1-GARLIC', v_day);
      o := e7_place_order(v_store, i_kimchi,    vd_online, null,10000, 32000, 3, v_day); perform e1_confirm_inbound(o, 3, 'S1-KIMCHI', v_day);
      o := e7_place_order(v_store, i_tofu,      vd_mart,   null,    1,  1800,60, v_day); perform e1_confirm_inbound(o,60, 'S1-TOFU',   v_day);
      o := e7_place_order(v_store, i_egg,       vd_mart,   null,   30,  8700, 4, v_day); perform e1_confirm_inbound(o, 4, 'S1-EGG',    v_day);
      o := e7_place_order(v_store, i_gochu,     vd_online, null, 1000, 28000, 2, v_day); perform e1_confirm_inbound(o, 2, 'S1-GOCHU',  v_day);
      o := e7_place_order(v_store, i_doenjang,  vd_online, null, 3000, 12000, 1, v_day); perform e1_confirm_inbound(o, 1, 'S1-DEN',    v_day);
      o := e7_place_order(v_store, i_gochujang, vd_online, null, 3000, 15000, 2, v_day); perform e1_confirm_inbound(o, 2, 'S1-GOJ',    v_day);
      o := e7_place_order(v_store, i_rice,      vd_online, null,10000, 32000, 4, v_day); perform e1_confirm_inbound(o, 4, 'S1-RICE',   v_day);
      o := e7_place_order(v_store, i_hobak,     vd_nong,   null,  300,  1500,12, v_day); perform e1_confirm_inbound(o,12, 'S1-HOBAK',  v_day);
      o := e7_place_order(v_store, i_cheong,    vd_nong,   null,  200,  2000, 6, v_day); perform e1_confirm_inbound(o, 6, 'S1-CHEONG', v_day);
      o := e7_place_order(v_store, i_oil,       vd_online, null, 1800,  6500, 2, v_day); perform e1_confirm_inbound(o, 2, 'S1-OIL',    v_day);
      o := e7_place_order(v_store, i_sugar,     vd_online, null, 3000,  5400, 1, v_day); perform e1_confirm_inbound(o, 1, 'S1-SUGAR',  v_day);
      o := e7_place_order(v_store, i_soy,       vd_online, null, 1800,  7200, 2, v_day); perform e1_confirm_inbound(o, 2, 'S1-SOY',    v_day);
      o := e7_place_order(v_store, i_beef,      vd_chuk,   null, 1000, 28000, 4, v_day); perform e1_confirm_inbound(o, 4, 'S1-BEEF',   v_day);
      o := e7_place_order(v_store, i_anchovy,   vd_online, null,  500,  9800, 4, v_day); perform e1_confirm_inbound(o, 4, 'S1-ANCH',   v_day);

    elsif d % 3 = 0 then
      -- 정기 보충. 검산 4종은 **같은 단가**로만 재입고한다(계약 단가).
      o := e7_place_order(v_store, i_pork,   vd_chuk,   null, 5000, 65000, 3, v_day); perform e1_confirm_inbound(o, 3, 'S'||v_seq||'-PORK',  v_day);
      o := e7_place_order(v_store, i_pa,     vd_nong,   null, 1000,  4000, 3, v_day); perform e1_confirm_inbound(o, 3, 'S'||v_seq||'-PA',    v_day);
      o := e7_place_order(v_store, i_onion,  vd_nong,   null, 1200,  2268, 4, v_day); perform e1_confirm_inbound(o, 4, 'S'||v_seq||'-ONION', v_day);

      -- 나머지는 시세를 탄다 — 단가 추이 그래프가 실제로 움직이도록.
      o := e7_place_order(v_store, i_tofu,   vd_mart,   null,    1, 1800 + (v_seq % 4) * 50, 50, v_day);
      perform e1_confirm_inbound(o, 50, 'S'||v_seq||'-TOFU', v_day);
      o := e7_place_order(v_store, i_hobak,  vd_nong,   null,  300, 1500 + (v_seq % 5) * 180, 4, v_day);
      perform e1_confirm_inbound(o, 4, 'S'||v_seq||'-HOBAK', v_day);
      o := e7_place_order(v_store, i_egg,    vd_mart,   null,   30, 8700 + (v_seq % 3) * 400, 3, v_day);
      perform e1_confirm_inbound(o, 3, 'S'||v_seq||'-EGG', v_day);
      o := e7_place_order(v_store, i_kimchi, vd_online, null,10000, 32000 + (v_seq % 4) * 1500, 1, v_day);
      perform e1_confirm_inbound(o, 1, 'S'||v_seq||'-KIMCHI', v_day);
      o := e7_place_order(v_store, i_beef,   vd_chuk,   null, 1000, 28000 + (v_seq % 6) * 900, 2, v_day);
      perform e1_confirm_inbound(o, 2, 'S'||v_seq||'-BEEF', v_day);

    elsif d % 7 = 2 then
      -- 주 1회 소모품
      o := e7_place_order(v_store, i_rice,      vd_online, null,10000, 32000, 2, v_day); perform e1_confirm_inbound(o, 2, 'S'||v_seq||'-RICE',   v_day);
      o := e7_place_order(v_store, i_oil,       vd_online, null, 1800,  6500, 1, v_day); perform e1_confirm_inbound(o, 1, 'S'||v_seq||'-OIL',    v_day);
      o := e7_place_order(v_store, i_cheong,    vd_nong,   null,  200,  2000, 4, v_day); perform e1_confirm_inbound(o, 4, 'S'||v_seq||'-CHEONG', v_day);
      o := e7_place_order(v_store, i_anchovy,   vd_online, null,  500,  9800, 2, v_day); perform e1_confirm_inbound(o, 2, 'S'||v_seq||'-ANCH',   v_day);
      o := e7_place_order(v_store, i_garlic,    vd_online, null, 1000,  8500, 1, v_day); perform e1_confirm_inbound(o, 1, 'S'||v_seq||'-GARLIC', v_day);
      -- 장류는 3일 보충에 넣으면 금방 넘친다. 주 1회가 실제 발주 주기에 가깝다.
      o := e7_place_order(v_store, i_gochu,     vd_online, null, 1000, 28000, 1, v_day); perform e1_confirm_inbound(o, 1, 'S'||v_seq||'-GOCHU',  v_day);
      o := e7_place_order(v_store, i_doenjang,  vd_online, null, 3000, 12000, 1, v_day); perform e1_confirm_inbound(o, 1, 'S'||v_seq||'-DEN',    v_day);
      o := e7_place_order(v_store, i_gochujang, vd_online, null, 3000, 15000, 1, v_day); perform e1_confirm_inbound(o, 1, 'S'||v_seq||'-GOJ',    v_day);
    end if;

    -- ── 판매 (E10 → E8 소진) ────────────────────────────────
    -- 주말(금·토)이 성수기. extract(dow): 0=일 … 5=금 6=토
    v_w := case extract(dow from v_day)::int
             when 5 then 1.35 when 6 then 1.45 when 0 then 0.75 when 1 then 0.85 else 1.0 end;

    perform save_sale(v_store, v_day, jsonb_build_array(
      jsonb_build_object('recipe_id', r_jeyuk,
        'qty_hall',     round(9 * v_w + (v_seq % 4)),
        'qty_delivery', round(5 * v_w + (v_seq % 3)),
        'qty_takeout',  round(2 * v_w),
        -- 조리 폐기 — 미리 볶아뒀다가 못 판 분량. 재료는 나갔고 매출은 0.
        'qty_waste',    case when v_seq % 6 = 0 then 2 else 0 end),
      jsonb_build_object('recipe_id', r_kimchi,
        'qty_hall',     round(8 * v_w + (v_seq % 3)),
        'qty_delivery', round(3 * v_w),
        'qty_takeout',  round(1 * v_w)),
      jsonb_build_object('recipe_id', r_doenjang,
        'qty_hall',     round(6 * v_w + (v_seq % 2)),
        'qty_delivery', round(2 * v_w),
        'qty_takeout',  0),
      jsonb_build_object('recipe_id', r_sundubu,
        'qty_hall',     round(5 * v_w),
        'qty_delivery', round(2 * v_w),
        'qty_takeout',  0),
      jsonb_build_object('recipe_id', r_gyeran,
        'qty_hall',     round(4 * v_w + (v_seq % 3)),
        'qty_delivery', round(1 * v_w),
        'qty_takeout',  0),
      jsonb_build_object('recipe_id', r_bulgogi,
        'qty_hall',     round(3 * v_w),
        'qty_delivery', round(1 * v_w),
        'qty_takeout',  0),
      jsonb_build_object('recipe_id', r_rice,
        'qty_hall',     round(22 * v_w),
        'qty_delivery', round(9 * v_w),
        'qty_takeout',  round(3 * v_w))),
      -- 기타 매출 — 레시피에 없는 음료. 재료 차감 없이 매출에만 더해진다.
      jsonb_build_array(
        jsonb_build_object('name','음료(캔)', 'price',2000,'qty', round(7 * v_w)),
        jsonb_build_object('name','소주·맥주','price',5000,'qty', round(3 * v_w))),
      -- 당일 일회성 지출 — 고정지출에는 들어가지 않는다.
      case when d % 7 = 1
        then jsonb_build_array(jsonb_build_object('name','얼음·소모품','amount',45000,'memo','주 1회 구매'))
        else '[]'::jsonb end);

    -- ── 폐기 (E2) — 주 1회 상하는 채소 ──────────────────────
    -- 폐기가 있어야 실측 로스율이 잡히고, 기준단가가 추정 로스율에서 실측으로 넘어간다.
    -- e2_discard 는 "버린 양"이 아니라 **남은 양**을 받는다. 220g 을 버린 셈으로 기록한다.
    --
    -- ⚠ 검산 4종(대파·돼지고기·양파·다진마늘)에는 폐기를 넣지 않는다.
    --   real_loss_rate 는 폐기가 **한 건이라도** 있으면 추정 로스율을 통째로 대체한다.
    --   대파에 150g 폐기(0.6%)를 넣었더니 15% 추정이 0.6% 로 바뀌어
    --   기준단가가 4.7059 → 4.0000, 제육볶음 재료비가 2,834.55 → 2,816.90 으로 어긋났다.
    if d = 9 then
      perform e2_discard(i_hobak, greatest(stock_total_base(i_hobak) - 220, 0), v_day);
    elsif d = 4 then
      perform e2_discard(i_cheong, greatest(stock_total_base(i_cheong) - 120, 0), v_day);
    end if;
  end loop;

  -- ── 진행 중인 발주 (ORD 대기 탭) ────────────────────────────
  -- 아직 도착하지 않은 주문이 있어야 "입고 대기" 탭이 빈 화면이 아니다.
  o := e7_place_order(v_store, i_pork,  vd_chuk,   null, 5000, 65000, 2, business_day() + 1);
  o := e7_place_order(v_store, i_kimchi,vd_online, null,10000, 33500, 2, business_day() + 2);
  o := e7_place_order(v_store, i_egg,   vd_mart,   null,   30,  9100, 3, business_day() + 1);

  raise notice '시드 완료 — 식재료 18 · 메뉴 7(+반제품 1) · 22일치 매출·입고';
end $$;

reset role;
