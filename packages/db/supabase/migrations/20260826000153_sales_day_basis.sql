-- ════════════════════════════════════════════════════════════════
-- 0153 · 하루 장부가 **어떤 장부인지**도 알려 준다 (기획서 §6.4 화면)
--
-- §6.4 화면이 물어야 하는 것이 셋인데 `sales_day` 는 하나도 안 줬다.
--   ① 이 날 손익을 **무엇을 기준으로** 계산했나 → `원가·손익은 현재 기준으로 계산했어요` 배지
--   ② 이 날 **장부가 있나 · 살아 있나** → `판매 내역 수정` 인가 `판매 내역 추가` 인가,
--      그리고 오늘 판매 화면으로 보낼지 정정 화면으로 보낼지
--   ③ 이 날을 **고칠 수 있나** → 지난달 1일~오늘. 앱이 이 규칙을 두 벌 갖지 않는다.
--
-- ⚠ 예전엔 `daily_sales` 가 없으면 **아무 행도 안 줬다**(null). 그러면 기록 없는 과거
--   날짜에서 ①②③ 을 물어볼 수가 없다 — 화면이 물어야 할 때가 바로 그때다.
--   빈 장부도 한 줄로 답한다. 앱은 이미 null 을 빈 장부로 바꿔 쓰고 있었으므로
--   보이는 결과는 같다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.sales_day(p_store uuid, p_date date)
returns jsonb
language sql
stable
as $fn$
  select jsonb_build_object(
    'sale_date', p_date,
    'daily_sales_id', ds.id,
    -- 화면은 이 값을 들고 있다가 저장할 때 되보낸다(0117). 없으면 낡은 저장을 못 막는다.
    'revision', coalesce(ds.revision, 0),
    'etc_revenue', coalesce(ds.etc_revenue, 0),
    'daily_extra', coalesce(ds.daily_extra, 0),
    'etc_items',   coalesce(ds.etc_items, '[]'::jsonb),
    'extra_items', coalesce(ds.extra_items, '[]'::jsonb),
    /*
     * ① 그날 손익의 계산 기준(0144·0149). `estimated_current` 면 원가·손익을 **현재**
     *   값으로 계산했다는 뜻이다 — 매출과 판매 수량은 사장님이 적은 실제 기록이므로
     *   `전체가 추정` 처럼 말하면 안 된다.
     * ⚠ 장부가 없으면 null 이다. `exact` 로 채우지 않는다 — 없는 것과 정확한 것은 다르다.
     */
    'basis_quality', bd.basis_quality,
    -- ② 장부가 있나 · 살아 있나. 없으면 둘 다 null/false 다.
    'has_ledger', bd.id is not null,
    'day_status', bd.status,
    -- ③ 고칠 수 있는 기간인가(§6.4: 지난달 1일~오늘). 규칙은 서버 한 곳에만 둔다.
    'editable', sale_date_allowed(p_store, p_date),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', it.id, 'recipe_id', it.recipe_id, 'menu_name', it.menu_name,
               'unit_price', it.unit_price, 'unit_material_cost', it.unit_material_cost,
               'unit_extra_cost', it.unit_extra_cost,
               'qty_hall', it.qty_hall, 'qty_delivery', it.qty_delivery,
               'qty_takeout', it.qty_takeout, 'qty_waste', coalesce(it.qty_waste, 0),
               'qty', it.qty_hall + it.qty_delivery + it.qty_takeout)
             order by (it.qty_hall + it.qty_delivery + it.qty_takeout) desc), '[]'::jsonb)
      from daily_sales_items it
     where it.daily_sales_id = ds.id
       and it.qty_hall + it.qty_delivery + it.qty_takeout + coalesce(it.qty_waste,0) > 0),
    'summary', sales_summary(p_store, p_date, p_date)
  )
  /*
   * ⚠ **한 줄은 반드시 나온다.** 예전엔 `from daily_sales` 라 기록이 없으면 답이 없었다.
   *   기록 없는 날에도 "고칠 수 있나 · 장부가 있나" 는 답해야 한다.
   */
  from (select 1) z
  left join daily_sales ds
    on ds.store_id = p_store and ds.sale_date = p_date
  left join business_days bd
    on bd.store_id = p_store and bd.business_date = p_date;
$fn$;

comment on function public.sales_day(uuid, date) is
  '하루 장부 — 판매·기타매출·지출·합계에 더해 그날 기준 품질·장부 상태·수정 가능 여부까지(0153). 기록이 없는 날도 한 줄로 답한다.';


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_store uuid; v_r jsonb;
begin
  select id into v_store from stores limit 1;
  if v_store is null then return; end if;   -- 빈 DB 면 잴 것이 없다

  -- 기록이 **없을** 날. 허용 기간 밖이라 editable 은 false 여야 한다.
  v_r := sales_day(v_store, store_local_date(v_store) - 400);
  if v_r is null then
    raise exception '0153: 기록 없는 날에 아무 답도 안 합니다';
  end if;
  if (v_r->>'has_ledger')::boolean then
    raise exception '0153: 없는 장부를 있다고 합니다';
  end if;
  if v_r->>'basis_quality' is not null then
    raise exception '0153: 없는 장부에 기준 품질을 지어냅니다';
  end if;
  if (v_r->>'editable')::boolean then
    raise exception '0153: 허용 기간 밖인데 고칠 수 있다고 합니다';
  end if;

  -- 오늘은 언제나 고칠 수 있는 기간 안이다.
  v_r := sales_day(v_store, store_local_date(v_store));
  if not (v_r->>'editable')::boolean then
    raise exception '0153: 오늘을 고칠 수 없다고 합니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
