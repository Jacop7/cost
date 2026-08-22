-- ════════════════════════════════════════════════════════════════
-- 0090 · 세금은 **사장님이 적은 항목의 합**이다 — 부가세 모드를 없앤다
--
-- 사장님: "세금 이 기능 삭제하고, 그냥 개인이 추가하는 00%가 레시피에 적용되면
--          되게 해줘. 0원이면 알아서 면세라고 사용자가 생각하겠지?"
--
-- 포함/별도/면세 세 갈래는 사장님이 답해야 할 질문이 하나 더 생기는 것이었다.
-- 이제 규칙이 하나다 — **판매가 × Σ(항목 요율)**. 항목이 없으면 0원이고,
-- 그게 면세다. 사장님은 자기가 적은 것만 보면 된다.
--
-- ⚠ **금액이 바뀌면 안 된다.** 지금 매장은 '포함'이라 세금이 판매가의 10/110 이다.
--   모드를 그냥 없애면 세금이 0원이 되고 순이익이 1,090.91원 뛴다.
--   그래서 그 부가세를 **항목으로 옮겨 적는다** — 금액은 그대로고, 이제 눈에 보이고
--   고칠 수 있다. 면세 매장이면 그 항목을 지우면 된다.
--
-- ⚠ 10% 가 아니라 **9.0909…%** 다. 부가세 포함 가격에서 부가세는 판매가의 10/110 이다.
--   10 을 적으면 메뉴당 109원이 더 빠진다(12,000원 기준 1,200 vs 1,090.91).
-- ════════════════════════════════════════════════════════════════

-- ── 1. 세금 = 항목의 합. 모드는 더 이상 보지 않는다 ───────────
create or replace function public.tax_of(p_price numeric, p_mode tax_mode, p_items jsonb)
returns numeric language sql immutable as $fn$
  select coalesce((select sum(p_price * (i->>'rate')::numeric / 100)
                     from jsonb_array_elements(
                            case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
                    where coalesce((i->>'rate')::numeric, 0) > 0), 0);
$fn$;

comment on function public.tax_of(numeric, tax_mode, jsonb) is
  '세금 = 판매가 × Σ(항목 요율). 부가세도 항목 하나다(0090). '
  '⚠ p_mode 는 더 이상 읽지 않는다 — 인자를 지우면 이 함수를 부르는 15곳과 '
  '영업일 스냅샷을 전부 고쳐야 해서 자리만 남겨 뒀다.';

-- 내역도 같은 규칙이다. 기본으로 끼워 넣는 줄은 없다.
create or replace function public.tax_breakdown(p_price numeric, p_mode tax_mode, p_items jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce((select jsonb_agg(jsonb_build_object(
                     'name', i->>'name',
                     'rate', (i->>'rate')::numeric,
                     'amount', p_price * (i->>'rate')::numeric / 100,
                     'builtin', false))
                     from jsonb_array_elements(
                            case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
                    where coalesce((i->>'rate')::numeric, 0) > 0), '[]'::jsonb);
$fn$;

comment on column settings.tax_mode is
  '⚠ 0090 이후 쓰지 않는다. 세금은 tax_items 의 합이다. 컬럼은 스냅샷 호환으로만 남았다.';


-- ── 2. 쓰던 부가세를 항목으로 옮겨 적는다 ─────────────────────
-- 금액은 한 푼도 달라지지 않는다. 보이고 고칠 수 있게 될 뿐이다.
do $mig$
declare
  v_vat numeric := round(100.0 * 10 / 110, 10);   -- 9.0909090909
  rec   record;
begin
  for rec in
    select s.store_id, s.tax_items
      from settings s
     where s.tax_mode = 'included'
       and not exists (select 1 from jsonb_array_elements(s.tax_items) i
                        where i->>'name' = '부가세')
  loop
    update settings
       set tax_items = jsonb_build_array(jsonb_build_object('name', '부가세', 'rate', v_vat))
                       || coalesce(rec.tax_items, '[]'::jsonb)
     where store_id = rec.store_id;
  end loop;

  -- 트리거가 매장 값을 레시피에 실어 준다. 값이 그대로라 손익은 안 움직인다 —
  -- recompute 를 부르지 않는 이유다. 없는 변동을 목록에 쌓지 않는다.
  update recipes r set updated_at = now()
   where exists (select 1 from settings s where s.store_id = r.store_id);
end
$mig$;

select public.assert_no_rpc_overloads();
