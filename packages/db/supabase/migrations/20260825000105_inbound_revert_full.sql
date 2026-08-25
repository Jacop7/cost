-- ════════════════════════════════════════════════════════════════
-- 0105 · 입고 취소는 들어온 만큼 통째로 되돌린다
--
-- 0102 가 이 함수를 **못 고쳤다.** 4절이 5절을 복사해 온 탓에 `e11_inbound_reverted`
-- 안에서 `declare v_blocked` 블록을 찾았는데 그런 블록은 여기 없다. 못 찾으면
-- 조용히 `return` 하도록 적어 두어서, 마이그레이션은 성공했고 함수는 그대로였다.
--
-- 측정(트랜잭션 안에서 재현 후 롤백):
--     취소 전 재고    560g
--     취소할 입고량 1,200g
--     기획상 결과    −640g
--     실제 결과          0g      ← 640g 이 장부에서 사라졌다
--
-- ⚠ 이번엔 **못 고치면 실패시킨다.** 조용한 `return` 이 문제를 여기까지 끌고 왔다.
--   네 조각 전부 정확히 한 번씩 맞아야 하고, 하나라도 어긋나면 예외를 던진다.
--
-- 함께 걷어내는 것 — 전부 "0 에서 자른다"를 전제로 만든 장치다.
--   · 있는 수량까지만 취소            (consume_stock 기본값 false)
--   · 못 되돌린 몫을 v_short 로 모으기
--   · 원장 메모 `(재고 부족 N 미반영)`
--   · 응답의 `shortfall`             (앱·core 어디서도 안 읽는다 — 확인함)
--
-- 취소는 **되돌리기**다. 입고가 +1,200g 이었으면 취소는 −1,200g 이다.
-- 그 사이에 팔려나갔다면 결과가 음수인 게 맞다 — 실제로 그 재료는 마이너스다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare
  v_def text;
  v_new text;
  -- 조각이 안 맞으면 여기 이름이 예외 메시지에 실린다. 어디서 어긋났는지 바로 알려고.
  v_step text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e11_inbound_reverted';

  if v_def is null then
    raise exception '0105: e11_inbound_reverted 가 없습니다' using errcode = '45003';
  end if;

  -- 이미 고쳐졌으면 아무것도 안 한다. ⚠ 0102 처럼 느슨한 조각(`, true)`)으로 재지 않는다 —
  --   그건 함수 어디에나 있을 수 있어서 안 고친 것도 고쳤다고 읽었다.
  if position('consume_stock(ev.ingredient_id, ev.delta, true)' in v_def) > 0 then
    return;
  end if;

  -- ── ① 되돌릴 양을 자르지 않는다 ───────────────────────────
  v_step := '소진 호출';
  v_new := replace(v_def,
    $x$consume_stock(ev.ingredient_id, ev.delta)$x$,
    $x$consume_stock(ev.ingredient_id, ev.delta, true)$x$);
  if v_new = v_def then
    raise exception '0105: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;
  v_def := v_new;

  -- ── ② 못 되돌린 몫을 모으던 블록 ──────────────────────────
  -- ⚠ 여러 줄이라 파일 CRLF 와 서버 LF 가 어긋난다(0084). 정규식으로 잡는다.
  --   `end if;` 하나까지만 비탐욕으로 — 안쪽에 중첩 if 는 없다.
  v_step := '미반영 집계';
  v_new := regexp_replace(v_def,
    $re$-- 이미 팔려나가[\s\S]*?end if;$re$,
    $rep$-- ⚠ 자르지 않으므로 v_taken = ev.delta 다. 못 되돌린 몫이라는 개념 자체가 없다(0105).$rep$);
  if v_new = v_def then
    raise exception '0105: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;
  v_def := v_new;

  -- ── ③ 원장 메모의 `(재고 부족 N 미반영)` ──────────────────
  v_step := '원장 메모';
  v_new := regexp_replace(v_def,
    $re$coalesce\(p_reason, '입고 취소 보정'\)[\s\S]*?end,$re$,
    $rep$coalesce(p_reason, '입고 취소 보정'),$rep$);
  if v_new = v_def then
    raise exception '0105: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;
  v_def := v_new;

  -- ── ④ 응답의 shortfall 과 그 변수 ─────────────────────────
  v_step := '응답 shortfall';
  v_new := replace(v_def, $x$    'shortfall', v_short,$x$, $x$$x$);
  if v_new = v_def then
    raise exception '0105: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;
  v_def := v_new;

  v_step := 'v_short 선언';
  v_new := regexp_replace(v_def, $re$\n  v_short  numeric := 0;[^\n]*$re$, $rep$$rep$);
  if v_new = v_def then
    raise exception '0105: % 조각을 못 찾았습니다', v_step using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

-- ── 고쳐졌는지 되읽어서 확인한다 ──────────────────────────────
-- ⚠ execute 가 성공했다고 원하는 함수가 된 건 아니다. 0102 의 교훈이다.
do $chk$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e11_inbound_reverted';

  if position('consume_stock(ev.ingredient_id, ev.delta, true)' in v_def) = 0 then
    raise exception '0105: 소진 호출이 안 바뀌었습니다' using errcode = '45003';
  end if;
  if position('미반영' in v_def) > 0 then
    raise exception '0105: 미반영 메모가 남아 있습니다' using errcode = '45003';
  end if;
  if position('shortfall' in v_def) > 0 then
    raise exception '0105: 응답에 shortfall 이 남아 있습니다' using errcode = '45003';
  end if;
  -- 지우면 안 되는 것들 — 취소의 본체다.
  if position('reverted_base' in v_def) = 0
     or position('monthly_pl' in v_def) = 0
     or position('record_entity_change' in v_def) = 0
     or position('refresh_order_candidate' in v_def) = 0 then
    raise exception '0105: 취소 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
