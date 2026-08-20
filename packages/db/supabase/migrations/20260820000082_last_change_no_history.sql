-- ════════════════════════════════════════════════════════════════
-- 0082 · 한 번도 안 고친 항목은 상태를 말하지 않는다
--
-- 사장님: "최근 수정 03:56 / 매출 계산과 무관 이렇게 뜨는데 수정내역에는 없다"
--
-- 재현됐다. 한 번도 안 고친 식재료에서
--   occurred_at   = created_at (08/20 03:56)   ← 등록 시각
--   display_state = 'irrelevant'               ← "매출 계산과 무관"
--   has_history   = false
--   내역 건수     = 0
--
-- 상세는 "최근 **수정** 03:56 · 매출 계산과 무관" 이라 해 놓고 눌러 보면 비어 있다.
-- 두 가지가 거짓말이다.
--   ① '수정'이 아니라 **등록**이다
--   ② 있지도 않은 변경에 대해 "매출과 무관하다"고 **주장**한다
--
-- 상태를 **null 로 준다.** 변경이 없으면 말할 상태도 없다.
-- 화면은 그때 배지를 그리지 않고 '등록'이라고 부른다.
--
-- ⚠ 키는 그대로 둔다. 키가 사라지면 앱 파서가 계약 위반으로 터진다(0081) —
--   그건 서버가 모양을 바꿨을 때만 나야 하는 신호다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.last_entity_change(
  p_store uuid, p_entity_type text, p_entity_id uuid
) returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_ev entity_change_events;
  v_at timestamptz;
begin
  select * into v_ev from entity_change_events
   where store_id = p_store and entity_type = p_entity_type and entity_id = p_entity_id
   order by occurred_at desc, id desc limit 1;

  if v_ev.id is not null then
    return jsonb_build_object(
      'occurred_at', v_ev.occurred_at,
      'event_id', v_ev.id,
      'display_state', entity_change_state(v_ev),
      'has_history', true);
  end if;

  if p_entity_type = 'ingredient' then
    select created_at into v_at from ingredients where id = p_entity_id;
  else
    select created_at into v_at from recipes where id = p_entity_id;
  end if;

  -- ⚠ display_state 는 **null** 이다. 'irrelevant' 로 채우면 화면이
  --   "매출 계산과 무관"이라고 없는 사실을 주장한다.
  return jsonb_build_object(
    'occurred_at', v_at,
    'event_id', null,
    'display_state', null,
    'has_history', false);
end;
$fn$;

comment on function public.last_entity_change(uuid, text, uuid) is
  '상세 한 줄이 쓰는 마지막 변경. 기록이 없으면 등록 시각과 **null 상태**를 준다(0082).';

select public.assert_no_rpc_overloads();
