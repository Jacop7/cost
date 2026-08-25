-- ════════════════════════════════════════════════════════════════
-- 0125 · 상태 응답에 매장 현지 날짜를 싣는다 (1단계 앱 준비)
--
-- 1단계의 남은 절반은 앱이다 — 기획서 §11 1단계:
--     "판매 화면의 todayBusiness() 사용을 제거하고 서버 business_date 를 사용한다"
--
-- 지금 앱은 `currentBusinessDay()` 로 **직접** 오늘을 만든다. 그게 이렇다 —
--     export const BUSINESS_TZ_OFFSET_MIN = 9 * 60;   // KST 고정 오프셋
-- 즉 앱과 DB 가 각자 오늘을 계산한다(기획서 §2.1). 지금은 둘 다 서울이라 같지만,
-- 매장 시간대가 서울이 아니거나 서머타임이 있는 곳이면 갈린다.
-- (`businessDate.ts` 머리말도 "고정 오프셋이라 DST 지역엔 못 쓴다" 고 적어 뒀다.)
--
-- 서버가 답을 갖고 있으니 **서버가 말해 주면 된다.**
-- 상태 응답에는 이미 `today`(판매 영업일)와 `business_date`(그 장부의 날짜)가 있다.
-- 없는 건 **일반 기록용 현지 날짜**다 — 발주·입고·재고 화면이 쓸 날짜.
--
-- ⚠ 셋은 서로 다른 것이다. 같은 값일 때가 많아서 헷갈리기 쉽다.
--     local_date    매장 달력의 오늘. 영업시간과 무관하다. 발주·입고·재고가 쓴다.
--     today         판매 영업일 기준의 오늘(cutoff 반영). 3단계에서 정리된다.
--     business_date 지금 열려 있는(또는 오늘 닫힌) **장부의 날짜**.
--                   새벽 영업 중이면 전날일 수 있다.
--
-- ⚠ 왕복을 늘리지 않으려고 기존 상태 응답에 얹는다. 3단계에서
--   `sync_business_context` 가 이 응답을 대체할 때 그대로 들고 간다(기획서 §7.4).
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';

  if v_def is null then
    raise exception '0125: business_day_state 가 없습니다' using errcode = '45003';
  end if;
  if position($x$'local_date'$x$ in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$    'today', v_date,$x$,
    $x$    'today', v_date,
    -- 매장 달력의 오늘(0125). 영업시간과 무관하다 — 발주·입고·재고 화면이 이걸 쓴다.
    -- ⚠ `today` 와 다른 값이다. 지금은 cutoff 가 0 이라 같아 보일 뿐이다.
    'local_date', store_local_date(p_store),$x$);
  if v_new = v_def then
    raise exception '0125: 상태 응답의 today 줄을 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';

  if position($x$'local_date', store_local_date(p_store)$x$ in v_def) = 0 then
    raise exception '0125: 현지 날짜가 안 실렸습니다' using errcode = '45003';
  end if;
  -- 지우면 안 되는 것들 — 상태 응답의 본체다.
  if position($x$'business_date'$x$ in v_def) = 0
     or position($x$'status'$x$ in v_def) = 0
     or position('auto_close_due' in v_def) = 0 then
    raise exception '0125: 상태 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
