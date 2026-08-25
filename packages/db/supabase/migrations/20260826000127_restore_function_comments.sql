-- ════════════════════════════════════════════════════════════════
-- 0127 · drop/create 로 잃어버린 함수 코멘트 복구
--
-- `create or replace` 는 코멘트를 지키지만 `drop function` + `create` 는 가져간다.
-- 시그니처가 바뀔 때마다 drop 이 필요했고, 그때 코멘트를 다시 달지 않았다.
-- 마이그레이션이 선언한 61개를 DB 와 대조해 빈 것 5개를 찾았고,
-- 그중 `real_loss_rate` 는 0041 에서 **함수 자체를 없앤 것**이라 정상이다.
--
-- ⚠ 원문을 그대로 붙이지 않는다. 시그니처와 동작이 그 사이에 바뀌었다 —
--   낡은 설명은 코멘트가 없는 것보다 나쁘다. 지금 코드를 읽고 다시 썼다.
--
-- 원인 추적:
--   build_day_snapshot   0048 선언 → **0124(내 것)** 가 (uuid) → (uuid, date) 로 바꾸며 drop
--   e10_sale_recorded    0019 선언 → 0030 이 drop (뒤에 qty_waste 인자도 붙었다)
--   e1_confirm_inbound   0009 선언 → 0012·0015 가 drop (뒤에 occurred_at 인자가 붙었다)
--   ingredient_list      0024 선언 → 0041(로스율 제거) 이 drop
--
-- `business_day_state` 도 같이 다시 단다. 마이그레이션 탓이 아니라 **개발 DB 에서
-- 손으로 drop/create 한 탓**이라 새 DB 에는 0057 의 것이 그대로 있다. 다시 다는 게
-- 해롭지 않고, 같은 일이 벌어진 DB 를 스스로 고쳐 준다.
-- ════════════════════════════════════════════════════════════════

comment on function public.business_day_state(uuid) is
  '매출 화면이 한 번에 읽는 영업일 상태 — 상태·예정/자동 종료·미확인 알림·영업시간(0057).';

comment on function public.build_day_snapshot(uuid, date) is
  '그 영업일의 기준값을 만든다. 레시피별 판매가·재료 구성(1인분량+단가)·부자재 내역·고정지출률. '
  '되짚기 9곳이 이 위에 서 있어 하루 동안 고정이다. 날짜를 인자로 받는다(0124) — '
  '1/31 영업이 2/1 새벽까지 이어져도 1월 고정지출률을 쓴다.';

comment on function public.e10_sale_recorded(uuid, date, uuid, numeric, numeric, numeric, numeric) is
  'E10 판매 등록. 판매 시점 원가·세금 항목을 그날 스냅샷에서 읽어 남기고 E8(재고 소진)까지 '
  '한 트랜잭션으로 처리한다. 매장·배달·포장 3채널 + 조리 폐기(qty_waste)를 받는다 — '
  '폐기도 재고에서 빠지지만 매출에는 안 잡힌다. 0028 목표치 대조라 재호출해도 두 번 안 빠진다.';

comment on function public.e1_confirm_inbound(uuid, numeric, text, date) is
  'E1 입고 확정. 멱등성 키 재호출은 no-op, 남은 수량을 넘는 입고는 클램프, 이미 전량 입고면 no-op. '
  '입고일(p_occurred_at)은 앱이 아니라 서버의 매장 현지 날짜를 기본값으로 쓴다(0121).';

comment on function public.ingredient_list(uuid) is
  '식재료 목록 + 파생값(재고 총량·기준단가)을 한 번에. 앱이 총량을 다시 계산하지 않게 한다(절대원칙 3).';


-- ── 사후 확인 ────────────────────────────────────────────────────
-- 네 개가 실제로 붙었는지 본다. 시그니처를 하나라도 잘못 적으면
-- `comment on function` 이 없는 함수를 만들어 내지 않고 그냥 실패해야 한다.
do $v$
declare
  v_missing text;
begin
  select string_agg(x.fn, ', ')
    into v_missing
    from (values ('build_day_snapshot'), ('e10_sale_recorded'),
                 ('e1_confirm_inbound'), ('ingredient_list'),
                 ('business_day_state')) as x(fn)
   where not exists (
     select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = x.fn
        and obj_description(p.oid, 'pg_proc') is not null);

  if v_missing is not null then
    raise exception '0127: 코멘트가 안 붙은 함수가 있습니다 — %', v_missing;
  end if;
end $v$;

select public.assert_no_rpc_overloads();
