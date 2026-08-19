-- ════════════════════════════════════════════════════════════════
-- 0060 · ORD-04 레시피 계산기(E6) 제거
--
-- 2차 범위로 미뤄 둔 기능이었는데(7h-worklog §1132: "P2 — 2차 범위. 구현하지 않는다")
-- 스키마·RPC·타입·발주 후보 사유에는 자리가 남아 있었다. 화면이 없으니 아무도
-- 만들 수 없는 상태인데, 발주 후보 사유 목록에는 '레시피 계산'이 떠 있었다 —
-- 사장님이 고를 수 없는 것을 보여 주고 있었다.
--
-- 1차 범위에서 발주 후보는 **안전재고 미달**과 **곧 소진** 둘로 뜬다.
-- '수동'은 사장님이 직접 담은 것이다.
--
-- ⚠ 전파 이벤트 번호는 그대로 둔다. E7(발주 등록)을 E6 으로 당기면 지금까지 쓴
--   문서·주석·커밋의 번호가 전부 어긋난다. E6 자리는 비워 둔다.
-- ════════════════════════════════════════════════════════════════

drop function if exists public.e6_recipe_calc(uuid, date, date, jsonb, jsonb);

-- 실행 기록 테이블 — 한 번도 쓰인 적이 없다(행 0).
drop table if exists public.recipe_calc_runs;

-- ── 발주 후보 사유에서 'recipe' 를 뺀다 ───────────────────────
-- Postgres 는 enum 값을 하나만 지울 수 없다. 타입을 다시 만든다.
-- 의존은 order_candidates.reasons 한 곳뿐이고, 만드는 쪽(refresh_order_candidate)은
-- safety_stock·soon_out 만 넣는다 — 실제로 'recipe' 가 박힌 행은 없다.
do $mig$
declare v_bad int;
begin
  select count(*) into v_bad
    from order_candidates c
   where exists (select 1 from unnest(c.reasons) r where r::text = 'recipe');
  if v_bad > 0 then
    raise exception '레시피 계산 사유가 붙은 후보가 %건 있습니다. 먼저 정리해 주세요', v_bad
      using errcode = '22000';
  end if;
end $mig$;

-- 다시 실행해도 안전하게 — 앞선 시도가 중간에서 멈췄을 수 있다.
do $mig$
begin
  if exists (select 1 from pg_type where typname = 'candidate_reason')
     and not exists (select 1 from pg_type where typname = 'candidate_reason_old') then
    alter type candidate_reason rename to candidate_reason_old;
  end if;
end $mig$;

drop type if exists candidate_reason;
create type candidate_reason as enum ('safety_stock', 'soon_out', 'manual');

-- ⚠ using 절에는 서브쿼리를 못 쓴다("cannot use subquery in transform expression").
--   enum → text → enum 은 배열 원소마다 적용되므로 이 캐스팅 한 줄이면 된다.
alter table order_candidates
  alter column reasons drop default,
  alter column reasons type candidate_reason[] using reasons::text[]::candidate_reason[],
  alter column reasons set default '{}';

drop type candidate_reason_old;

comment on type candidate_reason is
  '발주 후보가 뜬 이유 — 안전재고 미달 · 곧 소진 · 수동. 레시피 계산은 1차 범위 밖(0060).';

select public.assert_no_rpc_overloads();
