-- ════════════════════════════════════════════════════════════════
-- 0052 · 세금 항목 — 부가세 + 사장님이 추가하는 항목
--
-- 설계: 레시피_상세로직_v3 §168
--   "부가세(포함/별도/면세 토글)는 **기본** 세금 항목이며, 카드 수수료·기타 세금 등
--    '세금 항목'을 판매가 대비 %로 직접 추가할 수 있다.
--    모든 세금 항목을 합산해 손익표의 '(−) 세금' 행으로 차감한다."
--
-- recipes.tax_items 컬럼은 처음부터 있었는데 아무도 쓰지 않았다(전 메뉴 '{}').
-- 여기서 살린다.
--
-- ── 두 가지를 같이 고친다 ────────────────────────────────────
-- ① 세금 계산이 다섯 곳에 흩어져 각자 `10/110` 을 한다.
--    (day_menu_detail · recipe_list · recompute_recipe · sales_range · sales_summary)
--    항목이 늘면 다섯 곳을 다 고쳐야 하고, 하나만 빠뜨려도 조용히 어긋난다.
--    recipe_tax() 하나로 모은다.
-- ② 매출 줄에 **세금 금액이 저장되지 않는다**. 지금은 판매가와 모드로 되계산해서
--    맞았지만, 항목이 생기면 항목을 고치는 순간 지난 장부의 세금이 움직인다.
--    unit_tax 를 박아 그날 값으로 굳힌다.
--
-- ⚠ 항목이 비면 부가세만 남아 기존 값과 같다 — 검산 3종이 그대로다.
-- ════════════════════════════════════════════════════════════════

-- ⚠ 원래 text[] 였다. 이름과 요율을 함께 담아야 하므로 jsonb 여야 한다.
--   전 행이 '{}' 라 옮길 데이터가 없다 — 지금이 바꿀 수 있는 마지막 시점이다.
alter table recipes
  alter column tax_items drop default,
  alter column tax_items type jsonb using '[]'::jsonb,
  alter column tax_items set default '[]'::jsonb;

update recipes set tax_items = '[]'::jsonb where tax_items is null;

comment on column recipes.tax_items is
  '부가세 외 세금 항목. [{"name":"카드 수수료","rate":2.5}] — rate 는 판매가 대비 %(0052).';

-- ── 세금 한 곳에서 ────────────────────────────────────────────
-- 부가세(모드) + 추가 항목(판매가 대비 %)의 합.
create or replace function public.tax_of(p_price numeric, p_mode tax_mode, p_items jsonb)
returns numeric language sql immutable as $fn$
  select coalesce(
    case when p_mode = 'included' then p_price * 10 / 110 else 0 end
    + coalesce((select sum(p_price * (i->>'rate')::numeric / 100)
                  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
                 where coalesce((i->>'rate')::numeric, 0) > 0), 0), 0);
$fn$;

comment on function public.tax_of(numeric, tax_mode, jsonb) is
  '세금 = 부가세(모드) + 추가 항목(판매가 대비 %). 계산은 여기 한 곳뿐이다(0052).';

-- 항목별 내역. 화면이 '(−) 세금'을 펼칠 때 쓴다.
create or replace function public.tax_breakdown(p_price numeric, p_mode tax_mode, p_items jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce(
    case when p_mode = 'included'
         then jsonb_build_array(jsonb_build_object(
                'name', '부가세', 'rate', 100.0 * 10 / 110, 'amount', p_price * 10 / 110,
                'builtin', true))
         else '[]'::jsonb end
    || coalesce((select jsonb_agg(jsonb_build_object(
                  'name', i->>'name',
                  'rate', (i->>'rate')::numeric,
                  'amount', p_price * (i->>'rate')::numeric / 100,
                  'builtin', false))
                  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
                 where coalesce((i->>'rate')::numeric, 0) > 0), '[]'::jsonb),
    '[]'::jsonb);
$fn$;

-- ── 레시피의 세금 ─────────────────────────────────────────────
create or replace function public.recipe_tax(p_recipe uuid)
returns numeric language sql stable as $fn$
  select tax_of(r.price, r.tax_mode, r.tax_items) from recipes r where r.id = p_recipe;
$fn$;

-- ── 매출 줄에 세금을 굳힌다 ───────────────────────────────────
alter table daily_sales_items add column if not exists unit_tax numeric;

comment on column daily_sales_items.unit_tax is
  '판매 시점 세금(부가세 + 추가 항목). 나중에 항목을 고쳐도 그날 장부는 안 움직인다(0052).';

-- 과거 행 소급 — 그때는 부가세뿐이었으므로 모드로 되계산해도 값이 같다.
update daily_sales_items
   set unit_tax = case when coalesce(tax_mode,'included') = 'included'
                       then unit_price * 10 / 110 else 0 end
 where unit_tax is null;

-- ── 저장이 세금 항목을 받는다 ─────────────────────────────────
-- ⚠ save_recipe 는 0036 판을 그대로 두고 tax_items 만 얹는다.
create or replace function public.save_recipe_tax_items(p_store uuid, p_recipe uuid, p_items jsonb)
returns void language plpgsql security invoker as $fn$
declare i jsonb;
begin
  perform assert_my_store(p_store);

  for i in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if btrim(coalesce(i->>'name','')) = '' then
      raise exception '세금 항목 이름을 입력해 주세요' using errcode = '22000';
    end if;
    if coalesce((i->>'rate')::numeric, -1) < 0 or (i->>'rate')::numeric >= 100 then
      raise exception '세금 요율은 0 이상 100 미만이어야 해요' using errcode = '22000';
    end if;
  end loop;

  update recipes set tax_items = coalesce(p_items, '[]'::jsonb), updated_at = now()
   where id = p_recipe and store_id = p_store;
  if not found then
    raise exception '메뉴를 찾을 수 없습니다' using errcode = 'P0002';
  end if;

  -- 세금이 바뀌면 순이익이 바뀐다 — 추이에 점을 남긴다(절대원칙 4).
  perform recompute_recipe(p_recipe, 'recipe');
end;
$fn$;

select public.assert_no_rpc_overloads();
