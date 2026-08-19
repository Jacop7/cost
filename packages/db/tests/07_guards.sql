-- ════════════════════════════════════════════════════════════════
-- 07 · 매장 격리와 입력 방어
--
-- 사장님 한 명이 쓰는 앱이라 지금은 티가 안 나지만, 매장이 둘이 되는 순간
-- 여기가 새면 남의 원가가 내 손익에 섞인다. 되돌릴 방법이 없는 종류의 사고다.
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_other uuid := '00000000-0000-0000-0000-0000000000ff';
  v_jeyuk uuid := pg_temp.rcp('제육볶음');
begin
  -- ── 남의 매장에는 쓸 수 없다 ─────────────────────────────────
  perform pg_temp.raises('남의 매장에 식재료 저장 거부',
    format('select save_ingredient(%L, %L::jsonb)', v_other, '{"name":"침입"}'), '42501');
  perform pg_temp.raises('남의 매장에 메뉴 저장 거부',
    format('select save_ingredient(%L, %L::jsonb)', v_other, '{"name":"침입2"}'), '42501');
  perform pg_temp.raises('남의 매장에 고정지출 저장 거부',
    format('select save_fixed_costs(%L, %L, 1000000, %L::jsonb)', v_other, '2026-08', '[]'), '42501');

  -- ── 남의 매장은 읽을 수도 없다 (RLS) ────────────────────────
  perform pg_temp.eq('내 매장만 보인다', (select count(*) from stores), 1, 0);
  perform pg_temp.eq('내 매장 재료만 보인다',
    (select count(*) from ingredients where store_id <> pg_temp.store()), 0, 0);

  -- ── 필수값·범위 ─────────────────────────────────────────────
  perform pg_temp.raises('빈 메뉴 이름 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(), '{"name":"  ","price":1000}'), '22000');
  perform pg_temp.raises('기준 인분 0 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
           '{"name":"인분0","price":1000,"base_servings":0}'), '22000');
  perform pg_temp.raises('음수 판매가 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
           '{"name":"음수가","price":-1}'), '22000');

  -- ── 중복 이름 ───────────────────────────────────────────────
  perform pg_temp.raises('같은 이름 메뉴 거부',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
           '{"name":"제육볶음","price":12000}'), '23505');

  -- ── 자기 자신을 재료로 쓸 수 없다 (무한 전개 방지) ──────────
  perform pg_temp.raises('메뉴가 자기 자신을 재료로 못 쓴다',
    format('select save_recipe(%L, %L::jsonb)', pg_temp.store(),
      jsonb_build_object(
        'id', v_jeyuk, 'name', '제육볶음', 'price', 12000,
        'lines', jsonb_build_array(
          jsonb_build_object('sub_recipe_id', v_jeyuk, 'input_qty', 1)))::text), '22000');

  -- ── 사용 중인 것은 지울 수 없다 ─────────────────────────────
  perform pg_temp.raises('메뉴가 쓰는 식재료 비활성 거부',
    format('select deactivate_ingredient(%L)', pg_temp.ing('대파')), '23503');
  perform pg_temp.raises('식재료가 든 카테고리 삭제 거부',
    format('select delete_category(%L)',
           (select category_id from ingredients where id = pg_temp.ing('대파'))), '23503');

  -- ── 미래 날짜로는 기록할 수 없다 ────────────────────────────
  -- 아직 일어나지 않은 일이 추이에 점을 찍으면 그래프가 앞질러 간다.
  perform pg_temp.raises('미래 날짜 폐기 거부',
    format('select e2_discard(%L, 0, %L::date)', pg_temp.ing('대파'), business_day() + 1));

  -- ── RPC 오버로드는 0 이어야 한다 ────────────────────────────
  -- 같은 이름 함수가 둘이면 PostgREST 가 어느 쪽을 부를지 모른다.
  perform assert_no_rpc_overloads();
  perform pg_temp.ok('RPC 오버로드 없음', true);
end $t$;
