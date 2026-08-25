-- ════════════════════════════════════════════════════════════════
-- 0102 · 판 만큼 원장에 적는다 — 모자라면 음수 재고
--
-- 사장님: "지금 현재 재고 0g 입니다. 기획안대로면 −750g 이어야 합니다"
--
-- `consume_stock` 이 `least(p_amount, 재고)` 로 **이벤트 자체를 잘랐다.**
-- 소고기 1,500g 이 필요했는데 750g 만 원장에 남았고, "1,500g 이 필요했다"는
-- 사실이 어디에도 없다. 부족분이 장부에서 사라진 것이다.
--
-- 이제 필요량 전체를 적고 잔액이 음수가 되게 둔다. 음수 재고는 오류가 아니라
-- **현실과 기록의 불일치를 보존한 상태**다(기획안 §7).
--     · 입고를 안 적었거나  · 판매를 잘못 적었거나
--   어느 쪽이든 사장님이 고쳐야 할 일이고, 0 으로 덮으면 고칠 단서가 사라진다.
--
-- ⚠ 0028 목표치 대조가 오히려 **튼튼해진다.** 예전엔 잘린 탓에
--   `taken < need` 가 남아 다음 호출이 또 차감했다. 이제 `taken = need` 라
--   같은 판매를 두 번 저장해도 재고가 두 번 빠지지 않는다.
--
-- ⚠ 폐기는 **그대로 둔다**(기획안 §5.6). 장부에 없던 재료까지 폐기 손실로 잡히면
--   월 손익이 부풀기 때문이다. 초과 폐기 정책은 따로 정한다.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 잔액 제약을 푼다 ───────────────────────────────────────
-- ⚠ 되돌리려면 모든 음수를 실사로 정정한 뒤에야 제약을 다시 걸 수 있다(기획안 §9.3).
alter table inventory_states drop constraint if exists inventory_states_stock_total_check;

comment on column inventory_states.stock_total is
  '장부 재고. **음수가 될 수 있다**(0102) — 판매가 재고보다 많으면 부족분이 음수로 남는다. '
  '사용자 입력 수량·단가·금액은 여전히 음수가 될 수 없다. 음수인 것은 계산 결과인 이 잔액뿐이다.';


-- ── 2. 소진은 필요량 전체를 적는다 ────────────────────────────
-- 부르는 곳이 셋이고 정책이 다르다 — 판매·입고취소는 음수 허용, 폐기는 아니다.
-- 그래서 인자로 가른다. 2인자 판은 지워서 어느 쪽인지 헷갈리지 않게 한다.
drop function if exists public.consume_stock(uuid, numeric);

create or replace function public.consume_stock(
  p_ingredient uuid, p_amount numeric, p_allow_negative boolean default false)
returns numeric language plpgsql as $fn$
declare
  v_before numeric;
  v_take   numeric;
begin
  if p_amount is null or p_amount <= 0 then return 0; end if;

  select stock_total into v_before
    from public.inventory_states
   where ingredient_id = p_ingredient
   for update;

  if not found then return 0; end if;

  -- ⚠ 음수를 허용하면 **필요량 전체**를 뺀다. 자르면 원장에 부족분이 안 남는다.
  v_take := case when p_allow_negative then p_amount
                 else least(p_amount, coalesce(v_before, 0)) end;

  update public.inventory_states
     set stock_total = stock_total - v_take,
         updated_at = now()
   where ingredient_id = p_ingredient;

  return v_take;
end;
$fn$;

comment on function public.consume_stock(uuid, numeric, boolean) is
  '재고를 뺀다. `p_allow_negative` 면 **필요량 전체**를 빼고 잔액이 음수가 될 수 있다(0102). '
  '판매 소진·입고 취소는 true, 폐기는 false — 초과 폐기는 아직 범위 밖이다.';


-- ── 3. 판매 소진이 전체량을 적게 한다 ─────────────────────────
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'reconcile_sales_consumption';

  if v_def is null then
    raise exception '0102: reconcile_sales_consumption 이 없습니다' using errcode = '45003';
  end if;
  if position('consume_stock(rec.ingredient_id, v_delta, true)' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$      v_taken  := consume_stock(rec.ingredient_id, v_delta);$x$,
    $x$      v_taken  := consume_stock(rec.ingredient_id, v_delta, true);$x$);
  if v_new = v_def then
    raise exception '0102: 판매 소진 줄을 못 찾았습니다' using errcode = '45003';
  end if;

  -- 부족 안내에 **판 뒤 잔액**을 실어 준다. 화면이 `−750g` 을 그대로 보여 줄 수 있어야 한다.
  v_def := v_new;
  v_new := replace(v_def,
    $x$          'needed', v_delta, 'available', v_before, 'shortage', v_delta - v_before);$x$,
    $x$          'needed', v_delta, 'available', v_before, 'shortage', v_delta - v_before,$x$ || E'\n' ||
    $x$          'stock_after', v_before - v_delta);$x$);
  if v_new = v_def then
    raise exception '0102: 부족 안내 줄을 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;


-- ── 4. 입고 취소도 전체량을 되돌린다 ──────────────────────────
-- 잘못 등록한 입고는 통째로 되돌려야 한다. 결과가 음수여도 허용하지 않으면
-- 애초에 취소가 안 된다.
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e11_inbound_reverted';

  if v_def is null then return; end if;
  if position(', true)' in v_def) > 0 and position('consume_stock' in v_def) > 0 then return; end if;

  -- ⚠ 여러 줄 조각은 파일 CRLF 와 서버 LF 가 어긋난다(0084). 정규식으로 잡되
  --   `declare v_blocked` 부터 그 블록의 `end;` 까지만 비탐욕으로 도려낸다.
  --   `end if;` 는 `end;` 가 아니므로 안쪽에서 멈추지 않는다.
  v_new := regexp_replace(v_def,
    $re$declare v_blocked[\s\S]*?end;$re$,
    $rep$-- ⚠ 재고가 없다고 막지 않는다(0102). 막으면 음수가 된 메뉴를 영영 못 고친다.
    --   부족은 응답의 shortages 로 알린다.$rep$);

  if v_new = v_def then return; end if;
  execute v_new;
end
$mig$;

select public.assert_no_rpc_overloads();


-- ── 5. 재고가 없다고 판매를 막지 않는다 ───────────────────────
-- ⚠ 이걸 안 풀면 **한 번 음수가 된 메뉴를 영영 못 적는다.** 수량을 고치는 것조차 막힌다 —
--   실측: 소불고기 재고가 −750g 이 되자 같은 판매의 재조정이 22000 으로 튕겼다.
--   기획안 §2.1·§4.4: "판매는 재고 부족 여부와 관계없이 기록한다.
--   영업 중에는 재고 부족으로 판매를 막지 않고 필요한 전체 사용량을 계속 차감한다."
--   부족은 막는 게 아니라 **알리는 것**이다 — 응답의 shortages 와 매출 상단 안내가 그 몫이다.
--
-- ⚠ '판매 중지'(사장님이 끈 메뉴)는 그대로 막는다. 그건 재고가 아니라 **의도**다.
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';

  if v_def is null then
    raise exception '0102: e10_sale_recorded 가 없습니다' using errcode = '45003';
  end if;
  if position('만들 수 없어요' in v_def) = 0 then return; end if;

  -- ⚠ 여러 줄 조각은 파일 CRLF 와 서버 LF 가 어긋난다(0084). 정규식으로 잡되
  --   `declare v_blocked` 부터 그 블록의 `end;` 까지만 비탐욕으로 도려낸다.
  --   `end if;` 는 `end;` 가 아니므로 안쪽에서 멈추지 않는다.
  v_new := regexp_replace(v_def,
    $re$declare v_blocked[\s\S]*?end;$re$,
    $rep$-- ⚠ 재고가 없다고 막지 않는다(0102). 막으면 음수가 된 메뉴를 영영 못 고친다.
    --   부족은 응답의 shortages 로 알린다.$rep$);

  if v_new = v_def then
    raise exception '0102: 재고 차단 블록을 못 찾았습니다' using errcode = '45003';
  end if;
  execute v_new;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if position('만들 수 없어요' in v_def) > 0 then
    raise exception '0102: 차단이 남아 있습니다' using errcode = '45003';
  end if;
  if position('판매 중지된 메뉴예요' in v_def) = 0 then
    raise exception '0102: 판매 중지 가드까지 지웠습니다 — 그건 남아야 합니다' using errcode = '45003';
  end if;
end
$mig$;
