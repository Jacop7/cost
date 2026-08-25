-- ════════════════════════════════════════════════════════════════
-- 0118 · 영업 종료가 영업일 행을 안 잠갔다 — 판매가 마감 손익에서 샌다
--
-- `close_business_day` 는 이랬다 —
--     v_day := current_business_day(p_store);        ← 잠금 없이 읽고
--     v_sum := sales_summary(...);                   ← 그날 장부를 집계하고
--     update business_days set status = 'closed', snapshot = ... || closing;
--
-- 집계와 상태 변경 사이에 판매가 커밋되면 **원장에는 있고 마감 손익에는 없는**
-- 판매가 생긴다. 그날 장부는 영원히 그 상태로 굳는다(마감값은 스냅샷에 박힌다).
--
-- 0117 에서 `save_sale` 은 영업일 행을 먼저 잠그고 상태를 다시 읽게 했다.
-- 종료 쪽도 **같은 행을 같은 순서로** 잠가야 규칙이 선다.
--
--     판매가 먼저 잠그면  → 판매가 커밋되고, 종료는 그 판매까지 집계한다
--     종료가 먼저 잠그면  → 종료가 끝나고, 판매는 45002 로 거부된다
--
-- 어느 쪽이든 **한쪽만 이긴다.** 지금처럼 둘 다 이기는 일은 없다.
--
-- ⚠ 잠금 순서는 온 코드에서 하나다 — **영업일 → 그날 매출**.
--   뒤집는 곳이 생기면 교착이 난다.
-- ⚠ 잠근 **뒤에** 상태를 다시 읽는다. 잠금을 기다리는 동안 남이 닫았을 수 있다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'close_business_day';

  if v_def is null then
    raise exception '0118: close_business_day 가 없습니다' using errcode = '45003';
  end if;
  if position('0118' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$  v_sum := sales_summary(p_store, v_day.business_date, v_day.business_date);$x$,
    $x$  -- ⚠ 집계하기 **전에** 잠근다(0118). save_sale 과 같은 행·같은 순서다.
  --   안 잠그면 집계와 상태 변경 사이에 들어온 판매가 마감 손익에서 샌다.
  perform 1 from business_days where id = v_day.id for update;

  -- 잠금을 기다리는 동안 남이 닫았을 수 있다. 잠근 뒤에 다시 읽는다.
  if (select status::text from business_days where id = v_day.id) = 'closed' then
    raise exception '이미 종료된 영업일이에요' using errcode = '45002';
  end if;

  v_sum := sales_summary(p_store, v_day.business_date, v_day.business_date);$x$);
  if v_new = v_def then
    raise exception '0118: 집계 줄을 못 찾았습니다' using errcode = '45003';
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
   where n.nspname = 'public' and p.proname = 'close_business_day';

  if position('0118' in v_def) = 0 or position('for update' in v_def) = 0 then
    raise exception '0118: 잠금이 안 들어갔습니다' using errcode = '45003';
  end if;
  -- 잠금이 **집계보다 앞**이어야 한다. 뒤면 아무 소용이 없다.
  if position('for update' in v_def) > position('v_sum := sales_summary' in v_def) then
    raise exception '0118: 잠금이 집계보다 뒤에 있습니다' using errcode = '45003';
  end if;
  -- 지우면 안 되는 것들 — 종료의 본체다.
  if position('closing' in v_def) = 0
     or position('close_method' in v_def) = 0
     or position('영업 중이 아니에요' in v_def) = 0 then
    raise exception '0118: 종료 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
