-- ════════════════════════════════════════════════════════════════
-- 0076 · 수정 내역 보관 30일
--
-- 사장님 결정:
--   화면      최근 7일만 본다
--   서버      30일 보관 (문제 확인용)
--   핵심 장부 영구 보존
--
-- ⚠ **지우는 것은 수정 내역뿐이다.** 이건 "왜 값이 바뀌었나"를 사람이 읽는
--   설명이지, 재고·단가·손익을 계산하는 근거가 아니다.
--
--   지우지 않는 것 — 계산의 근거이자 장부다
--     inventory_events   재고 원장 (입고·소진·실사·폐기)
--     order_records      구매/입고 이력 → **기준단가가 여기서 나온다**
--     daily_sales(_items) 매출 장부
--     business_days      영업일 스냅샷 (그날 기준값)
--     price_trends · profit_trends  추이 그래프 (절대원칙 4)
--     ingredients.updated_at 등 마스터의 갱신 시각
--
--   entity_change_events 를 다 지워도 위 값은 하나도 안 움직인다.
--   실제로 그런지 테스트가 확인한다(16_change_retention).
--
-- ── 왜 크론이 아니라 영업 시작에 붙였나 ──────────────────────
-- pg_cron 은 쓸 수 있지만(미설치) 스케줄러를 하나 더 들이면 그게 도는지
-- 안 도는지를 또 봐야 한다. 영업 시작은 **하루 한 번 자연스럽게 도는 자리**다.
-- 며칠 쉬어서 안 돌면 그동안 안 지워질 뿐, 잘못된 값이 생기지는 않는다.
-- ════════════════════════════════════════════════════════════════

-- ⚠ **security definer 여야 한다.** 테스트를 쓰다 걸렸다 —
--   invoker 로 두면 RLS 에 막혀 **0건 삭제**하고 조용히 성공한다.
--   보관 정책이 도는 줄 알았는데 아무것도 안 지워지는 상태가 된다.
--
-- ⚠ 그렇다고 DELETE 정책을 열지는 않는다. 이 원장은 append-only 다 —
--   사용자가 자기 수정 이력을 골라 지울 수 있으면 근거가 사라진다.
--   지우는 길은 **나이로만** 지우는 이 함수 하나뿐이다.
create or replace function public.purge_entity_changes(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_n int;
begin
  -- ⚠ 이 테이블 하나만 건드린다. 원장·스냅샷·추이는 대상이 아니다.
  --   조건도 나이뿐이다 — 매장·행을 골라 지울 수 있으면 definer 로 연 문이 넓어진다.
  delete from entity_change_events
   where occurred_at < clock_timestamp() - make_interval(days => greatest(coalesce(p_days, 30), 1));
  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;

revoke all on function public.purge_entity_changes(int) from public;
grant execute on function public.purge_entity_changes(int) to authenticated, service_role;

comment on function public.purge_entity_changes(int) is
  '수정 내역 보관 기간 청소(기본 30일). 계산 근거인 원장·스냅샷·추이는 건드리지 않는다(0076).';

-- ── 영업 시작 때 하루 한 번 청소한다 ─────────────────────────
do $mig$
declare v_src text;
begin
  select pg_get_functiondef('public.open_business_day(uuid,date)'::regprocedure) into v_src;

  -- 스냅샷을 만들어 행을 넣은 뒤, 돌려주기 직전에 붙인다.
  v_src := replace(
    v_src,
    '  return jsonb_build_object(''business_day_id'', v_id, ''business_date'', v_date,',
    '  -- 하루 한 번 도는 자리라 여기서 오래된 수정 내역을 청소한다(0076).'
    || chr(10) || '  -- 실패해도 영업 시작이 막히면 안 된다 — 청소는 곁일이다.'
    || chr(10) || '  begin perform purge_entity_changes(30); exception when others then null; end;'
    || chr(10) || chr(10) || '  return jsonb_build_object(''business_day_id'', v_id, ''business_date'', v_date,');

  if v_src not like '%purge_entity_changes%' then
    raise exception '0076: open_business_day 에 청소를 붙일 자리를 찾지 못했습니다';
  end if;
  execute v_src;
end $mig$;

select public.assert_no_rpc_overloads();
