-- ════════════════════════════════════════════════════════════════
-- 0115 · 기타 매출·추가 지출이 영업일을 안 보고 들어갔다
--
-- 동시성 감사에서 나왔다. `save_sale` 은 메뉴 판매를 `e10_sale_recorded` 로 넘기고,
-- 거기에 영업일 가드가 있다(45001 아직 영업 전 · 45002 이미 종료).
-- 그런데 **기타 매출·추가 지출 분기는 그 함수를 안 거친다** — 바로 daily_sales 를 쓴다.
--
--     if p_etc_items is not null or p_extra_items is not null then
--       select id into v_sales from daily_sales where ...;
--       if v_sales is null then insert into daily_sales ... end if;   ← 가드 없음
--       update daily_sales set etc_items = ..., etc_revenue = ...;
--
-- 여태 안 들킨 이유: 그날 수량>0 인 메뉴 줄이 하나라도 있으면 `save_sale` 의
-- '화면에서 지운 메뉴' 루프가 `e10_sale_recorded(..., 0,0,0,0)` 을 부르고,
-- **그게 대신 걸려서** 45002 가 났다. 우연히 막혀 있었던 것이다.
--
-- 실측(메뉴 판매를 전부 0 으로 비운 종료된 날):
--     영업 상태 closed · 수량>0 인 메뉴 줄 0개
--     → 기타 매출 490,000원이 그대로 들어갔다. 아무도 안 막았다.
--
-- 굳힌 마감값과 장부가 갈린다. 매출이 늘어나는 쪽이라 손익이 통째로 어긋난다.
--
-- ⚠ 메뉴 판매와 **같은 가드**를 쓴다. 두 벌로 적으면 언젠가 갈린다.
--   `business_day_of(p_store, p_date)` 한 곳에서 상태를 읽는다.
-- ⚠ 영업일 자체를 새로 만들지는 않는다. 그건 영업 시작(0048)의 몫이다 —
--   여기서 만들면 "기타 매출을 적었더니 영업이 시작됐다"가 된다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';

  if v_def is null then
    raise exception '0115: save_sale 이 없습니다' using errcode = '45003';
  end if;
  if position('0115' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$  if p_etc_items is not null or p_extra_items is not null then$x$,
    $x$  if p_etc_items is not null or p_extra_items is not null then
    -- ⚠ 기타 매출·추가 지출도 **영업일을 지킨다**(0115). 예전엔 이 분기가
    --   e10_sale_recorded 를 안 거쳐서 가드를 통째로 비껴갔다 —
    --   종료된 날에 490,000원이 들어가는 걸 실측했다.
    declare v_g record;
    begin
      v_g := business_day_of(p_store, p_date);
      if v_g.id is null then
        raise exception '아직 영업을 시작하지 않았어요' using errcode = '45001';
      end if;
      if v_g.status = 'closed' then
        raise exception '% 영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요', p_date
          using errcode = '45002';
      end if;
    end;$x$);
  if v_new = v_def then
    raise exception '0115: 기타/추가 분기를 못 찾았습니다' using errcode = '45003';
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
   where n.nspname = 'public' and p.proname = 'save_sale';

  if position('0115' in v_def) = 0 then
    raise exception '0115: 가드가 안 들어갔습니다' using errcode = '45003';
  end if;
  -- 지우면 안 되는 것들 — save_sale 의 본체다.
  if position('e10_sale_recorded' in v_def) = 0
     or position('etc_revenue' in v_def) = 0
     or position('daily_extra' in v_def) = 0
     or position('미래 날짜의 매출은 등록할 수 없어요' in v_def) = 0 then
    raise exception '0115: 저장 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
