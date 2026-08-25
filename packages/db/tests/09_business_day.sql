-- ════════════════════════════════════════════════════════════════
-- 09 · 영업일 — 시작 / 브레이크 / 종료 / 자동 종료 (0048·0049)
--
-- 사장님 명세를 그대로 못 박는다.
--   시작   행 + 스냅샷이 **둘 다** 있어야 영업 중
--   브레이크 상태만 바뀌고 스냅샷·id 는 그대로
--   종료   실제 시각·방식 저장, 그날 집계 함께 남김
--   자동   예정 뒤 활동이 있으면 마지막 활동 + 1시간으로 미룸
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_open  jsonb;
  v_id    uuid;
  v_snap  jsonb;
  v_close jsonb;
  v_day   date := business_day();
begin
  -- ── 시작: 행과 스냅샷이 함께 만들어진다 ─────────────────────
  /*
   * ⚠ 먼저 **열린 상태를 만들어 둔다.** 오늘 장부가 닫혀 있으면 아래 호출이
   *   `이미 종료됐어요`(23505)로 터진다 — 실제로 자동 마감이 돈 뒤 그렇게 빨개졌다.
   *   시험이 바깥 세상의 시각에 기대면 안 된다.
   *   열려 있으면 아래 호출은 '이미 열려 있음' 경로를 타고 그 행을 돌려준다(불변식 8).
   */
  perform pg_temp.open_today();
  v_open := open_business_day(pg_temp.store());
  v_id := (v_open->>'business_day_id')::uuid;
  perform pg_temp.ok('영업 시작 → id 반환', v_id is not null);
  /*
   * ⚠ '이미 열려 있으면 그걸 돌려준다'가 계약이다(불변식 8). 그때 상태는
   *   브레이크일 수도 있다 — 시드가 깨끗하다고 가정하면 언젠가 반드시 깨진다.
   *   여기서 확인할 건 **영업이 시작돼 있다**는 것이지 정확히 'open' 인지가 아니다.
   */
  perform pg_temp.ok('영업이 시작된 상태다',
    (v_open->>'status') in ('open', 'break'));

  select snapshot into v_snap from business_days where id = v_id;
  perform pg_temp.ok('스냅샷이 비어 있지 않다', v_snap is not null and v_snap <> '{}'::jsonb);
  perform pg_temp.ok('스냅샷에 고정지출률이 있다', (v_snap->>'fixed_rate') is not null);
  perform pg_temp.eq('스냅샷 고정지출률 = 그때 값',
    (v_snap->>'fixed_rate')::numeric * 100, 31.30, 0.01);
  perform pg_temp.ok('스냅샷에 레시피가 담겼다',
    (select count(*) from jsonb_object_keys(v_snap->'recipes')) > 0);

  -- 재료 구성이 1인분량과 단가를 함께 갖는다 — 나중에 단가가 올라도 그날 원가는 그대로.
  declare j jsonb := v_snap#>'{recipes}'->(pg_temp.rcp('제육볶음')::text);
  begin
    perform pg_temp.eq('제육볶음 판매가 스냅샷', (j->>'price')::numeric, 12000, 0);
    perform pg_temp.eq('제육볶음 재료비 스냅샷', (j->>'material_cost')::numeric, 2806.40, 0.01);
    perform pg_temp.eq('재료 줄 4개', jsonb_array_length(j->'lines'), 4, 0);
    perform pg_temp.ok('재료 줄마다 1인분량과 단가가 있다',
      not exists (select 1 from jsonb_array_elements(j->'lines') l
                   where (l->>'per_serving') is null or (l->>'unit_price') is null));
    -- 부자재 내역까지 담아야 나중에 항목을 지워도 그날 상세에 남는다.
    perform pg_temp.eq('부자재 내역 1개', jsonb_array_length(j->'extras'), 1, 0);
  end;

  -- ── 두 번 눌러도 새로 만들지 않는다 (불변식 8) ──────────────
  perform pg_temp.ok('재시작은 같은 영업일을 돌려준다',
    (open_business_day(pg_temp.store())->>'already_open')::boolean is true);
  perform pg_temp.eq('영업일 행은 하나뿐',
    (select count(*) from business_days where store_id = pg_temp.store() and business_date = v_day), 1, 0);

  -- ── 브레이크: 상태만 바뀐다 ─────────────────────────────────
  perform pg_temp.eq_t('브레이크 전환', set_break(pg_temp.store(), true)->>'status', 'break');
  perform pg_temp.eq_t('브레이크 중에도 같은 영업일',
    (select id::text from business_days where store_id = pg_temp.store() and status = 'break'), v_id::text);
  perform pg_temp.ok('브레이크가 스냅샷을 바꾸지 않는다',
    (select snapshot from business_days where id = v_id) = v_snap);
  perform pg_temp.eq_t('영업 재개', set_break(pg_temp.store(), false)->>'status', 'open');

  -- ── 자동 종료: 예정 뒤 활동이 있으면 미룬다 ─────────────────
  update business_days
     set planned_close_at = (v_day + time '22:00') at time zone business_tz(),
         last_activity_at = (v_day + time '21:47') at time zone business_tz()
   where id = v_id;
  perform pg_temp.eq_t('활동 21:47 → 자동 종료 22:47',
    to_char((auto_close_due(pg_temp.store())->>'auto_close_at')::timestamptz at time zone business_tz(), 'HH24:MI'),
    '22:47');

  update business_days
     set last_activity_at = (v_day + time '22:35') at time zone business_tz() where id = v_id;
  perform pg_temp.eq_t('활동 22:35 → 자동 종료 23:35',
    to_char((auto_close_due(pg_temp.store())->>'auto_close_at')::timestamptz at time zone business_tz(), 'HH24:MI'),
    '23:35');

  /*
   * 아직 안 됐으면 닫지 않는다.
   *
   * ⚠ **지금 시각에 기대지 않는다.** 바로 위에서 활동 시각을 22:35 로 박아 뒀는데,
   *   그 상태로 이 단언을 하면 "지금이 23:35 이전" 이라는 숨은 전제가 생긴다.
   *   실제로 밤에 돌리면 빨개진다. 활동을 **지금**으로 옮겨 종료 예정을 미래로 민다
   *   (`auto_close_due` 는 `greatest(예정 종료, 마지막 활동 + 1시간)` 이라
   *    지금+1시간은 언제 돌려도 미래다).
   */
  update business_days set last_activity_at = now() where id = v_id;
  perform pg_temp.ok('아직 때가 아니면 안 닫는다',
    (close_if_due(pg_temp.store())->>'closed')::boolean is false);

  /*
   * 반대쪽도 잰다 — 때가 **지났으면** 닫는다. 이것도 시각에 안 기댄다.
   * 예정 종료와 마지막 활동을 둘 다 과거로 밀어 놓는다.
   */
  update business_days
     set planned_close_at = now() - interval '3 hours',
         last_activity_at = now() - interval '3 hours'
   where id = v_id;
  perform pg_temp.ok('때가 지났으면 닫는다',
    (close_if_due(pg_temp.store())->>'closed')::boolean is true);
  perform pg_temp.eq_t('자동으로 닫혔다고 남는다',
    (select close_method::text from business_days where id = v_id), 'auto');

  -- 아래 수동 종료 시험을 위해 되열어 둔다.
  perform reopen_business_day(pg_temp.store(), v_day);
  update business_days set last_activity_at = now() where id = v_id;

  -- ── 종료: 시각·방식·집계가 남는다 ───────────────────────────
  v_close := close_business_day(pg_temp.store());
  perform pg_temp.eq_t('종료 방식이 수동', v_close->>'close_method', 'manual');
  perform pg_temp.ok('실제 종료 시각이 남는다', (v_close->>'closed_at') is not null);
  perform pg_temp.ok('그날 집계가 함께 남는다', (v_close->'summary') is not null);
  perform pg_temp.eq_t('상태가 종료',
    (select status::text from business_days where id = v_id), 'closed');
  perform pg_temp.ok('종료해도 스냅샷의 레시피는 그대로',
    (select snapshot->'recipes' from business_days where id = v_id) = v_snap->'recipes');

  -- ── 종료 뒤에는 영업 조작이 막힌다 ──────────────────────────
  perform pg_temp.raises('종료 후 브레이크 거부',
    format('select set_break(%L, true)', pg_temp.store()), '22000');
  perform pg_temp.raises('같은 날 재시작 거부',
    format('select open_business_day(%L, %L)', pg_temp.store(), v_day), '23505');

  -- ── 다시 열어 고칠 수 있다 ──────────────────────────────────
  perform pg_temp.eq_t('종료 되돌리기', reopen_business_day(pg_temp.store(), v_day)->>'status', 'open');
  perform pg_temp.ok('되돌려도 스냅샷은 그대로',
    (select snapshot->'recipes' from business_days where id = v_id) = v_snap->'recipes');

  -- ── 자동 종료 기록과 확인 ───────────────────────────────────
  perform close_business_day(pg_temp.store(), 'auto');
  declare u jsonb := unacked_auto_close(pg_temp.store());
  begin
    perform pg_temp.ok('자동 종료가 다음 실행 때 알려진다', u is not null);
    perform pg_temp.eq_t('알림이 그 날짜를 가리킨다', u->>'business_date', v_day::text);
    perform ack_auto_close((u->>'business_day_id')::uuid);
    -- ⚠ '알림이 하나도 없다'가 아니라 **이 영업일이 다시 안 뜬다**를 본다.
    --   다른 날 자동 종료가 확인 안 된 채 남아 있을 수 있다(08-22 가 그랬다).
    perform pg_temp.ok('확인하면 다시 안 알린다',
      coalesce(unacked_auto_close(pg_temp.store())->>'business_day_id', '') <> (u->>'business_day_id'));
  end;

  -- 수동 종료는 알리지 않는다 — 사장님이 직접 눌렀으니 이미 안다.
  -- ⚠ '알림이 없다'로 보면 안 된다. 확인 안 한 **다른 날** 자동 종료가 남아 있을 수
  --   있어서(08-22 가 그랬다) 이 파일이 날짜에 따라 빨개진다.
  --   불변식은 '알림이 없다'가 아니라 **뜨는 게 있다면 그건 자동 종료다** 이다.
  perform pg_temp.ok('수동 종료는 알림 대상이 아니다',
    coalesce((select close_method::text from business_days
               where id = (unacked_auto_close(pg_temp.store())->>'business_day_id')::uuid), 'auto') = 'auto');
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 0050·0051 · 오늘 값은 하루 동안 고정된다
--
-- 사장님: "계속 판매가만 생각하고 있는데 세부 항목도 영향 있다니까"
-- 판매가뿐 아니라 재료 줄·부자재 항목·고정지출 항목까지 그날 값이어야 한다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_rcp  uuid := pg_temp.rcp('제육볶음');
  v_day  date := business_day();
  b0     jsonb;
  b1     jsonb;
begin
  -- ⚠ 앞 블록이 영업일을 닫아 뒀다. 판매를 받으려면 다시 열어야 한다 —
  --   그 자체가 "종료된 날은 못 판다"는 계약의 확인이기도 하다.
  perform reopen_business_day(pg_temp.store(), v_day);
  perform e10_sale_recorded(pg_temp.store(), v_day, v_rcp, 10, 0, 0, 0);
  b0 := day_menu_detail(pg_temp.store(), v_day, v_rcp);

  perform pg_temp.eq('그날 판매가', (b0->>'price')::numeric, 12000, 0);
  perform pg_temp.eq('그날 재료비', (b0->>'material_cost')::numeric, 2806.40, 0.01);
  perform pg_temp.eq('그날 부자재', (b0->>'extra_cost')::numeric, 300, 0.01);
  perform pg_temp.eq('재료 줄 4개', jsonb_array_length(b0->'lines'), 4, 0);
  perform pg_temp.eq('부자재 줄 1개', jsonb_array_length(b0->'extras'), 1, 0);
  perform pg_temp.ok('고정지출 항목별 배분이 있다', jsonb_array_length(b0->'fixed_items') > 0);
  perform pg_temp.eq('고정지출 항목 합 = 고정비',
    (select sum((i->>'amount')::numeric) from jsonb_array_elements(b0->'fixed_items') i),
    (b0->>'fixed_cost')::numeric, 0.01);

  -- ── 세부를 크게 흔든다 ──────────────────────────────────────
  -- 부자재 삭제 + 인건비 인상 + 재료 단가 급등. 셋 다 지난 장부를 건드리면 안 된다.
  perform save_recipe(pg_temp.store(), jsonb_build_object(
    'id', v_rcp, 'name', '제육볶음', 'price', 12000, 'base_servings', 10,
    'extras', jsonb_build_array()));
  perform save_fixed_costs(pg_temp.store(), business_month(), 12000000,
    (select jsonb_agg(case when x->>'key' = 'labor'
        then jsonb_set(jsonb_set(x, '{total}', '3000000'), '{lines}', '[]'::jsonb) || '{"mode":"total"}'::jsonb
        else x end)
       from fixed_costs_monthly, jsonb_array_elements(items) x
      where store_id = pg_temp.store() and month = business_month()));
  perform e1_confirm_inbound(
    e7_place_order(pg_temp.store(), pg_temp.ing('돼지고기 앞다리'),
      (select id from vendors where store_id = pg_temp.store() limit 1),
      null, 5000, 120000, 4, v_day), 4, 'TEST-SPIKE');

  b1 := day_menu_detail(pg_temp.store(), v_day, v_rcp);

  perform pg_temp.eq('판매가 그대로', (b1->>'price')::numeric, (b0->>'price')::numeric, 0);
  perform pg_temp.eq('재료비 그대로', (b1->>'material_cost')::numeric, (b0->>'material_cost')::numeric, 0.0001);
  perform pg_temp.eq('부자재 그대로', (b1->>'extra_cost')::numeric, (b0->>'extra_cost')::numeric, 0.0001);
  perform pg_temp.eq('고정비 그대로', (b1->>'fixed_cost')::numeric, (b0->>'fixed_cost')::numeric, 0.0001);
  perform pg_temp.eq('순이익 그대로', (b1->>'profit')::numeric, (b0->>'profit')::numeric, 0.0001);
  -- 지운 부자재가 그날 세부에는 남아야 한다 — 그날 실제로 들어간 원가다.
  perform pg_temp.eq('지운 부자재가 그날엔 남는다',
    jsonb_array_length(b1->'extras'), 1, 0);
  perform pg_temp.eq('급등한 재료의 그날 금액도 그대로',
    (select (l->>'amount')::numeric from jsonb_array_elements(b1->'lines') l
      where l->>'name' = '돼지고기 앞다리'),
    (select (l->>'amount')::numeric from jsonb_array_elements(b0->'lines') l
      where l->>'name' = '돼지고기 앞다리'), 0.0001);

  -- 반대로 레시피 화면(현재값)은 바뀌어야 한다 — "앞으로 이렇게 판다"이므로.
  perform pg_temp.ok('레시피 현재값은 바뀐다',
    (select material_cost from recipe_list(pg_temp.store()) where id = v_rcp) > 2806.40);
end $t$;

-- ════════════════════════════════════════════════════════════════
-- 0057 · 화면이 한 번에 읽는 상태
--
-- 네 함수를 따로 물으면 그 사이에 상태가 바뀔 수 있고, 왕복도 네 번이다.
-- 한 번에 나오는 값이 각 함수와 같은 말을 하는지 못 박는다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_day date := business_day();
  st    jsonb;
begin
  -- ── 시작 전 ─────────────────────────────────────────────────
  -- 'none' 은 "오늘 아직 시작 안 함"이다. 시드와 앞 블록이 오늘을 열어 두고 판매까지
  -- 넣어 뒀으므로, 그 날 행을 지워 시작 전 상태를 만든다.
  -- ⚠ 지우지 않고 날짜를 옮긴다. 매출·입출고·발주가 이 행을 참조하고 있어
  --   삭제는 외래키에 막히고, 참조를 끊으려면 원장을 건드려야 한다(원장은 고칠 대상이 아니다).
  --   전부 이 트랜잭션 안이라 롤백된다.
  perform close_business_day(pg_temp.store());
  update business_days set business_date = v_day - 400
   where store_id = pg_temp.store() and business_date = v_day;

  st := business_day_state(pg_temp.store());
  perform pg_temp.eq_t('시작 전 상태는 none', st->>'status', 'none');
  perform pg_temp.eq_t('오늘 날짜를 함께 준다', st->>'today', v_day::text);
  perform pg_temp.ok('영업시간 설정이 함께 온다', (st#>>'{hours,close_time}') is not null);
  perform pg_temp.ok('시작 전에는 자동 종료 예정이 없다', (st->>'auto_close_at') is null);

  -- ── 영업 중 ─────────────────────────────────────────────────
  perform open_business_day(pg_temp.store());
  st := business_day_state(pg_temp.store());
  perform pg_temp.eq_t('시작하면 open', st->>'status', 'open');
  perform pg_temp.ok('영업일 id 를 준다', (st->>'business_day_id') is not null);
  perform pg_temp.eq_t('예정 종료 시각이 설정과 같다',
    to_char((st->>'planned_close_at')::timestamptz at time zone business_tz(), 'HH24:MI'),
    to_char((select close_time from settings where store_id = pg_temp.store()), 'HH24:MI'));

  -- ── 브레이크 ────────────────────────────────────────────────
  perform set_break(pg_temp.store(), true);
  perform pg_temp.eq_t('브레이크가 상태에 보인다',
    business_day_state(pg_temp.store())->>'status', 'break');
  perform set_break(pg_temp.store(), false);

  -- ── 예정 종료를 지나면 알린다 ───────────────────────────────
  update business_days
     set planned_close_at = now() - interval '5 minutes',
         last_activity_at = now() - interval '5 minutes'
   where store_id = pg_temp.store() and business_date = v_day;
  st := business_day_state(pg_temp.store());
  perform pg_temp.ok('예정 종료를 지났다고 알린다', (st->>'past_planned')::boolean);
  perform pg_temp.ok('자동 종료 시각은 마지막 활동 + 1시간으로 미뤄진다',
    (st->>'auto_close_at')::timestamptz > now());

  -- 자동 종료 10분 전
  update business_days
     set last_activity_at = now() - auto_close_grace() + interval '5 minutes'
   where store_id = pg_temp.store() and business_date = v_day;
  perform pg_temp.ok('10분 전이면 곧 종료된다고 알린다',
    (business_day_state(pg_temp.store())->>'warn_soon')::boolean);

  -- ── 자동 종료 뒤 미확인 알림 ────────────────────────────────
  perform close_business_day(pg_temp.store(), 'auto');
  st := business_day_state(pg_temp.store());
  perform pg_temp.eq_t('종료하면 closed', st->>'status', 'closed');
  perform pg_temp.eq_t('종료 방식이 보인다', st->>'close_method', 'auto');
  perform pg_temp.ok('미확인 자동 종료를 알린다', (st->'unacked') is not null);
  declare v_acked uuid := (st#>>'{unacked,business_day_id}')::uuid;
  begin
    perform ack_auto_close(v_acked);
    -- ⚠ '알림이 사라진다'가 아니라 **이 영업일이 다시 안 뜬다**를 본다.
    --   확인 안 한 다른 날 자동 종료가 남아 있을 수 있다(08-22 가 그랬다).
    perform pg_temp.ok('확인하면 사라진다',
      coalesce((business_day_state(pg_temp.store())#>>'{unacked,business_day_id}'), '') <> v_acked::text);
  end;
end $t$;


-- ════════════════════════════════════════════════════════════════
-- 기타 매출·추가 지출도 영업일을 지킨다 (0115)
--
-- 동시성 감사에서 나왔다. `save_sale` 은 메뉴 판매를 `e10_sale_recorded` 로 넘기고
-- 거기 영업일 가드가 있는데, **기타/추가 분기는 그 함수를 안 거친다.**
--
-- 여태 안 들킨 이유: 그날 수량>0 인 메뉴 줄이 하나라도 있으면 '화면에서 지운 메뉴'
-- 루프가 `e10_sale_recorded(..., 0,0,0,0)` 을 불러 **그게 대신** 걸렸다.
-- 우연히 막혀 있었던 것이라, 메뉴 판매가 없는 날엔 그대로 뚫렸다.
-- 실측: 종료된 날에 490,000원이 들어갔다.
-- ════════════════════════════════════════════════════════════════
do $t$
declare
  v_day date := business_day();
  v_etc0 numeric;
begin
  -- ⚠ 메뉴 판매를 **전부 0 으로 비운다.** 하나라도 남아 있으면 다른 가드가 대신 걸려
  --   이 시험이 아무것도 안 재게 된다 — 실제로 그렇게 통과했었다.
  update daily_sales_items it set qty_hall = 0, qty_delivery = 0, qty_takeout = 0, qty_waste = 0
    from daily_sales ds where ds.id = it.daily_sales_id
     and ds.store_id = pg_temp.store() and ds.sale_date = v_day;

  -- ⚠ 앞선 블록들이 이 영업일을 이미 닫아 놨을 수 있다. 그러면 open 이 실패하고
  --   이어지는 close 가 `영업 중이 아니에요` 로 터진다 — 실제로 그렇게 터졌다.
  --   두 헬퍼가 각각 사후조건까지 확인한다(예전엔 `when others then null` 이라
  --   못 열어도 조용히 지나갔다).
  perform pg_temp.open_today();    -- 열려 있어야 닫을 수 있다
  perform pg_temp.close_today();   -- 그리고 닫는다
  perform pg_temp.eq_t('영업이 종료됐다',
    (select status::text from business_days where store_id = pg_temp.store() and business_date = v_day), 'closed');
  perform pg_temp.eq('수량>0 인 메뉴 줄이 없다',
    (select count(*) from daily_sales_items it join daily_sales ds on ds.id = it.daily_sales_id
      where ds.store_id = pg_temp.store() and ds.sale_date = v_day
        and it.qty_hall + it.qty_delivery + it.qty_takeout + coalesce(it.qty_waste, 0) > 0), 0, 0);

  select coalesce(etc_revenue, 0) into v_etc0
    from daily_sales where store_id = pg_temp.store() and sale_date = v_day;

  perform pg_temp.raises('종료된 날 기타 매출은 거부',
    format($q$select save_sale(%L, %L, null, %L::jsonb, null)$q$,
           pg_temp.store(), v_day,
           jsonb_build_array(jsonb_build_object('name','종료 후 주류','price',490000,'qty',1))::text),
    '45002');

  perform pg_temp.raises('종료된 날 추가 지출도 거부',
    format($q$select save_sale(%L, %L, null, null, %L::jsonb)$q$,
           pg_temp.store(), v_day,
           jsonb_build_array(jsonb_build_object('name','종료 후 얼음','amount',30000))::text),
    '45002');

  perform pg_temp.eq('기타 매출이 늘지 않았다',
    (select coalesce(etc_revenue, 0) from daily_sales
      where store_id = pg_temp.store() and sale_date = v_day), v_etc0, 0.001);
end $t$;
