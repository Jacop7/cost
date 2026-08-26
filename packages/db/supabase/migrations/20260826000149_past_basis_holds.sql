-- ════════════════════════════════════════════════════════════════
-- 0149 · 과거 기준은 과거 것이다 (기획서 §6.4)
--
-- 정정 RPC 는 "다시 열지 않고 고친다" 를 지켰지만, **고칠 때 무엇을 기준으로 쓰는지**
-- 를 안 정했다. 그래서 두 곳이 현재를 봤다.
--
--   ① 기타 매출 세금이 **현재 세율**로 다시 계산됐다.
--      실측: 저장된 2,636.36원(9.0909%) → 세율을 20% 로 바꾼 뒤 같은 내용을 그대로
--      다시 보내니 5,800원. 사장님은 아무것도 안 고쳤는데 과거 세금과 손익이 움직였다.
--   ② **현재 판매 중지한 메뉴**의 과거 수량을 못 고쳤다.
--      실측: 제육볶음을 판매 중지하니 3일 전 수량 수정이 22000 으로 거절됐다.
--      과거 정정은 지금 파는지가 아니라 **그날 무엇이 있었는지**를 따라야 한다.
--
-- 규칙:
--   · 기타 매출 내용이 같으면 세금도 그대로 둔다 — 계산 자체를 안 한다.
--   · 금액을 고칠 때는 **그날 저장된 세율**을 쓴다.
--   · 그날 세율이 기록에 없으면 현재 세율을 쓰되 `basis_quality = estimated_current` 로
--     내린다. 화면은 `원가·손익은 현재 기준으로 계산했어요` 를 그때 보여 준다.
--   · 앞으로 만드는 스냅샷에는 `etc_tax_rate` 를 담는다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 스냅샷에 그날 기타매출 세율을 담는다 ──────────────────────
/*
 * 메뉴 세금은 `recipes` 항목마다 `tax` 로 굳어 있는데, 기타 매출은 굳는 곳이 없었다.
 * 매출 자체는 사장님이 적은 실제 기록이고 세율만 매장 설정이라 그날 값이 필요하다.
 */
create or replace function public.build_day_snapshot(p_store uuid, p_date date)
returns jsonb
language sql
stable
as $fn$
  select jsonb_build_object(
    'taken_at', now(),
    'fixed_rate', coalesce(fixed_cost_rate(p_store, to_char(p_date, 'YYYY-MM')), 0),
    'fixed_items', coalesce(
      (select f.items from fixed_costs_monthly f
        where f.store_id = p_store and f.month = to_char(p_date, 'YYYY-MM')), '[]'::jsonb),
    -- 기타 매출에 매길 세율(0149). 메뉴 세금과 달리 굳는 곳이 여기밖에 없다.
    'etc_tax_rate', store_tax_rate(p_store),
    -- 재료 단가 — 폐기 손실과 재료 되짚기가 그날 값을 쓰려면 여기 있어야 한다(0058).
    'ingredients', coalesce((
      select jsonb_object_agg(i.id::text, jsonb_build_object(
               'name', i.name, 'base_unit', i.base_unit,
               'unit_price', base_unit_price(i.id)))
        from ingredients i where i.store_id = p_store), '{}'::jsonb),
    'recipes', coalesce((
      select jsonb_object_agg(r.id::text, recipe_snapshot_entry(r.id))
        from recipes r where r.store_id = p_store and r.active), '{}'::jsonb));
$fn$;

comment on function public.build_day_snapshot(uuid, date) is
  '그날의 기준값 한 벌 — 고정지출·기타매출 세율·재료 단가·메뉴. 한 번 정해지면 그날 안 움직인다(0062·0149).';

create or replace function public.day_etc_tax_rate(p_store uuid, p_date date)
returns numeric
language sql
stable
as $fn$
  -- 그날 스냅샷에 담긴 기타매출 세율. 없으면 null — 부르는 쪽이 어떻게 할지 정한다.
  select (snapshot->>'etc_tax_rate')::numeric
    from business_days
   where store_id = p_store and business_date = p_date;
$fn$;

comment on function public.day_etc_tax_rate(uuid, date) is
  '그날 기타매출 세율(0149). 스냅샷에 없으면 null 이고, 그때는 현재 세율을 쓰되 basis_quality 를 estimated_current 로 내린다.';

revoke execute on function public.day_etc_tax_rate(uuid, date) from public, anon;
grant  execute on function public.day_etc_tax_rate(uuid, date) to authenticated, service_role;


-- ── ② 기타 매출 세금은 그날 세율을 따른다 ───────────────────────
create or replace function public.apply_sale_items(
  p_store       uuid,
  p_date        date,
  p_sales       uuid,
  p_items       jsonb,
  p_etc_items   jsonb,
  p_extra_items jsonb,
  p_allow_closed boolean default false
) returns jsonb
language plpgsql
as $fn$
declare
  v_item      jsonb;
  v_result    jsonb := '[]'::jsonb;
  v_etc       numeric;
  v_etc_tax   numeric;
  v_extra     numeric;
  v_cur_items jsonb;
  v_rate      numeric;
  v_estimated boolean := false;
begin
  /*
   * ⚠ **전체 교체가 아니다**(0117). 안 보낸 메뉴는 그대로 둔다.
   *   지울 때는 0 을 명시해서 보낸다.
   */
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_result := v_result || jsonb_build_array(
      e10_sale_recorded(
        p_store, p_date, (v_item->>'recipe_id')::uuid,
        coalesce((v_item->>'qty_hall')::numeric, 0),
        coalesce((v_item->>'qty_delivery')::numeric, 0),
        coalesce((v_item->>'qty_takeout')::numeric, 0),
        coalesce((v_item->>'qty_waste')::numeric, 0),
        p_allow_closed));
  end loop;

  /*
   * ⚠ 기타/지출은 배열 통째 교체다. 항목 단위 병합은 하지 않는다 — 같은 이름이
   *   여럿일 수 있어 무엇이 같은 항목인지 정할 수 없다.
   * ⚠ `updated_at` 은 **여기서 안 찍는다**(0148). 부르는 쪽이 실제 변경을 확인한
   *   뒤에 한 번만 찍는다. 그리고 값이 같으면 UPDATE 자체를 안 돌린다 —
   *   `touch_updated_at` 트리거가 UPDATE 마다 시각을 다시 찍기 때문이다.
   */
  if p_etc_items is not null then
    select etc_items into v_cur_items from daily_sales where id = p_sales;

    /*
     * ⚠ **내용이 같으면 손대지 않는다**(0149). 화면은 고친 칸만 보내지 않고 화면에
     *   있는 값을 통째로 보낸다. 여기서 현재 세율로 다시 계산하면 사장님이 아무것도
     *   안 고쳤는데 과거 세금이 움직인다 — 실측 2,636.36원 → 5,800원.
     */
    if v_cur_items is distinct from p_etc_items then
      -- 합계는 항목에서 **계산**한다. 화면이 보낸 합계를 믿으면 둘이 어긋난다.
      select coalesce(sum(coalesce((x->>'price')::numeric,0) * coalesce((x->>'qty')::numeric,1)), 0)
        into v_etc from jsonb_array_elements(p_etc_items) x;

      -- 금액을 고칠 때는 **그날 세율**로 매긴다.
      v_rate := day_etc_tax_rate(p_store, p_date);
      if v_rate is null then
        /*
         * 그날 세율이 기록에 없다(0149 이전에 열린 장부, 또는 정정이 만든 장부).
         * 현재 세율로 계산하되 **그렇게 했다고 남긴다.** 조용히 현재값을 쓰면
         * 나중에 그 숫자가 무엇이었는지 되짚을 수 없다.
         */
        v_rate      := store_tax_rate(p_store);
        v_estimated := p_allow_closed;
      end if;
      v_etc_tax := round(v_etc * v_rate, 2);

      update daily_sales
         set etc_items = p_etc_items, etc_revenue = v_etc, etc_tax = v_etc_tax
       where id = p_sales
         and (etc_items   is distinct from p_etc_items
           or etc_revenue is distinct from v_etc
           or etc_tax     is distinct from v_etc_tax);
    end if;
  end if;

  if p_extra_items is not null then
    select coalesce(sum(coalesce((x->>'amount')::numeric,0)), 0)
      into v_extra from jsonb_array_elements(p_extra_items) x;
    update daily_sales
       set extra_items = p_extra_items, daily_extra = v_extra
     where id = p_sales
       and (extra_items is distinct from p_extra_items
         or daily_extra is distinct from v_extra);
  end if;

  -- 현재 세율을 빌려 썼다면 그날 기준은 더 이상 그날 것이 아니다.
  if v_estimated then
    update business_days
       set basis_quality = 'estimated_current'
     where store_id = p_store and business_date = p_date
       and basis_quality <> 'estimated_current';
  end if;

  return v_result;
end $fn$;

revoke execute on function public.apply_sale_items(uuid, date, uuid, jsonb, jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;


-- ── ③ 종료된 장부에도 기준을 더할 수 있다 ───────────────────────
/*
 * §6.4 의 `판매 내역 추가` 는 그날 기준에 없는 메뉴로도 들어온다 — 그때 만든 메뉴,
 * 그때 꺼 뒀던 메뉴. 여기서 막으면 그 화면 자체가 성립하지 않는다.
 * 더하는 것은 **순수 추가**라 이미 기록된 숫자를 안 움직인다(0062). 다만 더한 값은
 * 그날 값이 아니라 지금 값이므로 그 장부는 `estimated_current` 로 내린다.
 *
 * ⚠ 인자를 더하면 `create or replace` 가 **덮어쓰지 않고 겹치기를 만든다.**
 *   옛 서명을 먼저 지운다(assert_no_rpc_overloads 가 잡아 준 적이 있다).
 */
drop function if exists public.add_to_day_basis(uuid, date, uuid);

create or replace function public.add_to_day_basis(
  p_store uuid, p_date date, p_recipe uuid, p_allow_closed boolean default false)
returns jsonb language plpgsql security invoker as $fn$
declare
  v_day   business_days;
  v_entry jsonb;
begin
  select * into v_day from business_days
   where store_id = p_store and business_date = p_date
   for update;

  if v_day.id is null then
    raise exception '아직 영업을 시작하지 않았어요' using errcode = '45001', detail = 'BEFORE_OPEN';
  end if;
  if v_day.status = 'closed' and not p_allow_closed then
    raise exception '% 영업이 종료되어 판매를 저장할 수 없어요', p_date
      using errcode = '45002', detail = 'DAY_CLOSED';
  end if;

  -- 이미 있으면 그대로 둔다. 다시 넣으면 오늘 기준이 지금 값으로 바뀐다 —
  -- 그게 바로 막으려던 일이다(불변식: 한 번 정해진 기준은 그날 안 움직인다).
  v_entry := v_day.snapshot #> array['recipes', p_recipe::text];
  if v_entry is not null then
    return v_entry;
  end if;

  v_entry := recipe_snapshot_entry(p_recipe);
  if v_entry is null then
    -- 레시피 자체가 없다. 화면이 분기할 수 있게 **안정된 코드**로 돌려준다(0149).
    raise exception '그날 기준에도 없고 지금도 없는 메뉴예요'
      using errcode = '45013', detail = 'BASIS_NOT_AVAILABLE';
  end if;

  update business_days
     set snapshot = jsonb_set(
           -- 이 메뉴가 쓰는 재료 중 오늘 기준에 없는 것(영업 중에 만든 재료)도 함께 담는다.
           jsonb_set(snapshot, '{ingredients}',
             coalesce(snapshot->'ingredients', '{}'::jsonb) || coalesce((
               select jsonb_object_agg(i.id::text, jsonb_build_object(
                        'name', i.name, 'base_unit', i.base_unit,
                        'unit_price', base_unit_price(i.id)))
                 from recipe_lines l join ingredients i on i.id = l.ingredient_id
                where l.recipe_id = p_recipe and l.ingredient_id is not null
                  and not (coalesce(snapshot->'ingredients', '{}'::jsonb) ? i.id::text)),
               '{}'::jsonb)),
           array['recipes', p_recipe::text], v_entry, true)
   where id = v_day.id;

  -- 종료된 장부에 **지금 값**을 더했다. 그 장부의 기준은 더 이상 그날 것이 아니다.
  if v_day.status = 'closed' then
    update business_days set basis_quality = 'estimated_current'
     where id = v_day.id and basis_quality <> 'estimated_current';
  end if;

  return v_entry;
end;
$fn$;

comment on function public.add_to_day_basis(uuid, date, uuid, boolean) is
  '그날 기준에 없는 메뉴를 그 시점 값으로 더한다 — 순수 추가라 이미 기록된 숫자는 안 움직인다(0062). 종료된 장부에는 정정 경로에서만 더하고, 그때 basis_quality 를 estimated_current 로 내린다(0149).';

/*
 * ⚠ **몸통이다.** `p_allow_closed => true` 로 부르면 종료된 장부의 기준을 바꾸고
 *   basis_quality 를 내릴 수 있다 — 판본 검사도 감사 기록도 없이. 문은 정정 RPC 다.
 */
revoke execute on function public.add_to_day_basis(uuid, date, uuid, boolean)
  from public, anon, authenticated, service_role;


-- ── ④ 과거 정정은 그날 기준만 본다 ──────────────────────────────
do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if v_def is null then raise exception '0149: e10_sale_recorded 가 없습니다'; end if;
  if position('if not p_allow_closed and p_date > business_day()' in v_def) > 0 then return; end if;

  -- ④-1 미래 검사는 오늘 경로에서만. 정정 RPC 가 이미 매장 현지 날짜로 걸렀다.
  v_old := '  if p_date > business_day() then';
  if position(v_old in v_def) = 0 then
    raise exception '0149: e10 의 미래 날짜 검사를 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old, concat_ws(chr(10),
    '  /*',
    '   * ⚠ 이 검사는 **오늘 경로 전용**이다(0149). `business_day()` 는 매장을 안 가리는',
    '   *   전역 함수라 과거 정정에 쓰면 엉뚱한 날을 미래로 본다. 정정 RPC 는 이미',
    '   *   `sale_date_allowed(p_store, p_date)` 로 매장 현지 날짜 기준으로 걸렀다.',
    '   */',
    '  if not p_allow_closed and p_date > business_day() then'));

  -- ④-2 판매 중지는 **오늘** 파는 것을 막는 스위치다. 과거 기록에는 안 걸린다.
  v_old := '  if v_total > 0 then
    if not coalesce((select active from recipes where id = p_recipe), true) then';
  if position(v_old in v_def) = 0 then
    raise exception '0149: e10 의 판매 중지 검사를 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old, concat_ws(chr(10),
    '  /*',
    '   * ⚠ `판매 중지` 는 **오늘 파는 것**을 막는 스위치다(0149). 과거에 실제로 판 기록을',
    '   *   고치는 데는 안 걸린다 — 실측: 제육볶음을 중지하니 3일 전 수량 수정이 거절됐다.',
    '   *   과거 정정은 지금 파는지가 아니라 그날 무엇이 있었는지를 따른다.',
    '   */',
    '  if v_total > 0 and not p_allow_closed then',
    '    if not coalesce((select active from recipes where id = p_recipe), true) then'));

  -- ④-3 그날 기준에 없으면 더한다 — 종료된 장부에도.
  v_old := '    v_snap  := add_to_day_basis(p_store, p_date, p_recipe);';
  if position(v_old in v_def) = 0 then
    raise exception '0149: e10 의 add_to_day_basis 호출을 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old,
    '    v_snap  := add_to_day_basis(p_store, p_date, p_recipe, p_allow_closed);');

  execute v_def;
end $m$;


-- ── ⑤ 정정 응답의 basis_quality 는 몸통이 내린 뒤 값이다 ────────
do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if v_def is null then raise exception '0149: 정정 RPC 가 없습니다'; end if;
  if position('select basis_quality into v_day.basis_quality' in v_def) > 0 then return; end if;

  v_old := '  v_result := apply_sale_items(p_store, p_date, v_sales, p_items, p_etc_items, p_extra_items, true);';
  if position(v_old in v_def) = 0 then
    raise exception '0149: 정정 RPC 의 몸통 호출을 못 찾았습니다';
  end if;

  execute replace(v_def, v_old, concat_ws(chr(10),
    v_old,
    '',
    '  -- 몸통이 그날 기준을 못 찾아 현재값을 빌려 썼을 수 있다(0149).',
    '  -- 응답에 담기 전에 다시 읽는다 — 위에서 잡은 값은 그 이전 것이다.',
    '  select basis_quality into v_day.basis_quality from business_days where id = v_day.id;'));
end $m$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text;
begin
  if (build_day_snapshot((select id from stores limit 1), current_date)->>'etc_tax_rate') is null then
    raise exception '0149: 스냅샷에 기타매출 세율이 없습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'apply_sale_items';
  if position('v_cur_items is distinct from p_etc_items' in v_def) = 0
     or position('day_etc_tax_rate' in v_def) = 0 then
    raise exception '0149: 몸통이 아직 현재 세율로 다시 계산합니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if position('if v_total > 0 and not p_allow_closed then' in v_def) = 0 then
    raise exception '0149: e10 가 아직 과거 정정에 판매 중지를 겁니다';
  end if;
  if position('if not p_allow_closed and p_date > business_day()' in v_def) = 0 then
    raise exception '0149: e10 가 아직 과거 정정에 전역 미래 검사를 겁니다';
  end if;
  if position('add_to_day_basis(p_store, p_date, p_recipe, p_allow_closed)' in v_def) = 0 then
    raise exception '0149: e10 가 종료 장부에 기준을 못 더합니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if position('select basis_quality into v_day.basis_quality' in v_def) = 0 then
    raise exception '0149: 정정 응답이 아직 옛 basis_quality 를 돌려줍니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
