-- ════════════════════════════════════════════════════════════════
-- 0045 · 발주일을 지정할 수 있게 한다
--
-- 발견 경위: 구매 이력 화면(ING-09)을 실제 데이터로 확인하다 드러났다.
-- 대파 구매 8건이 **전부 오늘 날짜**였다. 시드는 3주치를 하루씩 재생하는데
-- 발주일만 오늘로 몰려 "이력"이 아니라 한 날 무더기로 보였다.
--
-- 원인: E1(입고 확정)은 p_occurred_at 을 받는데 E7(발주 등록)은 안 받아
-- ordered_at 이 항상 default(오늘)로 박혔다. 그래서 단가 추이(price_trends)는
-- 7/29~8/19 로 퍼져 있는데 발주일만 한 점에 뭉쳐 있었다.
--
-- 사장님 쪽에서도 필요하다 — 어제 전화로 주문한 걸 오늘 앱에 적는 일이 흔하다.
-- 그때 발주일이 오늘로 박히면 "언제 시켰더라"가 영영 틀어진다.
--
-- ⚠ 인자가 늘어나므로 create or replace 로는 못 바꾼다. 기존 시그니처를 지우고
--   다시 만든다 — 남겨 두면 오버로드가 되어 PostgREST 가 어느 쪽을 부를지 모른다.
-- ════════════════════════════════════════════════════════════════

drop function if exists public.e7_place_order(uuid, uuid, uuid, uuid, numeric, numeric, numeric, date, order_source);

create or replace function public.e7_place_order(
  p_store uuid, p_ingredient uuid, p_vendor uuid, p_brand uuid,
  p_volume numeric, p_amount numeric, p_qty numeric, p_expected date,
  p_source order_source default 'manual',
  p_ordered_at date default null
) returns uuid language plpgsql as $fn$
declare
  v_order uuid;
  v_day   date := coalesce(p_ordered_at, business_day());
begin
  -- 아직 일어나지 않은 일을 기록할 수는 없다(recompute_recipe 와 같은 규칙).
  if v_day > business_day() then
    raise exception '미래 날짜로는 발주를 기록할 수 없습니다 (요청 %, 오늘 %)', v_day, business_day()
      using errcode = '22000';
  end if;
  -- 입고 예정일이 발주일보다 앞설 수는 없다.
  if p_expected is not null and p_expected < v_day then
    raise exception '입고 예정일이 발주일보다 빠릅니다' using errcode = '22000';
  end if;

  insert into order_records (store_id, ingredient_id, vendor_id, brand_id,
                             volume, amount, qty, ordered_at, expected_at, status, source)
       values (p_store, p_ingredient, p_vendor, p_brand,
               p_volume, p_amount, p_qty, v_day, p_expected, 'ordered', p_source)
    returning id into v_order;

  -- 후보 상태 '주문함' 전환 (재고·단가는 변동 없음 — 절대원칙 2)
  update order_candidates set status = 'ordered'
   where store_id = p_store and ingredient_id = p_ingredient;

  return v_order;
end;
$fn$;

comment on function public.e7_place_order(uuid, uuid, uuid, uuid, numeric, numeric, numeric, date, order_source, date) is
  'E7 발주 등록 — 기록만 한다. p_ordered_at 으로 지난 날짜의 발주도 적을 수 있다(0045).';

select public.assert_no_rpc_overloads();
