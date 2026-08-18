-- ════════════════════════════════════════════════════════════════
-- 0012 · E1 구버전 오버로드 제거 (P0, 멱등성 우회 경로)
--
-- 증상 (생성 타입·pg_proc 조회로 실증):
--   e1_confirm_inbound(p_order uuid, p_actual_qty numeric)                       ← 0007 판(가드 없음)
--   e1_confirm_inbound(p_order uuid, p_actual_qty numeric, p_idempotency_key text) ← 0009 판(가드 있음)
--   **두 개가 동시에 존재한다.**
--
-- 원인:
--   `create or replace function` 은 **인자 시그니처가 다르면 교체가 아니라 새 함수 생성**이다.
--   0009 에서 `p_idempotency_key` 를 추가하면서 구버전이 그대로 남았다.
--
-- 영향 (P0):
--   인자 2개로 호출하면 PostgREST 가 **구버전을 선택**한다. 구버전에는
--     · 행 잠금(for update) 없음        → 동시 호출 시 재고 이중 증가
--     · 멱등성 키 검사 없음             → 재시도마다 추이·이벤트 중복 적재
--     · 남은 수량 클램프 없음           → received_qty > qty 과입고
--     · 취소/전량입고 가드 없음
--   즉 0009 의 방어를 **인자 하나 빼는 것만으로 통째로 우회**할 수 있다.
--   생성 타입도 오버로드 2개를 그대로 노출해 앱이 실수로 구버전을 부르기 쉽다.
--
-- 해결: 구버전을 삭제한다. 신버전은 `p_idempotency_key text default null` 이라
--   기존의 2인자 호출도 그대로 받는다(기본값으로 채워짐) — 호출부 변경 불필요.
-- ════════════════════════════════════════════════════════════════

drop function if exists public.e1_confirm_inbound(uuid, numeric);

-- 남은 것이 정확히 하나인지 확인한다. 둘 이상이면 인자 개수로 선택이 갈려 방어가 다시 새어나간다.
do $$
declare v_count int;
begin
  select count(*) into v_count
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e1_confirm_inbound';
  if v_count <> 1 then
    raise exception 'e1_confirm_inbound 오버로드가 %개다. 정확히 1개여야 한다.', v_count;
  end if;
end $$;
