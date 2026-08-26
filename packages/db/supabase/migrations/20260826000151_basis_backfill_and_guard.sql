-- ════════════════════════════════════════════════════════════════
-- 0151 · 0150 의 두 자리를 좁힌다
--
--   ① 교차 매장 방어가 **새로 들어오는 것**만 막았다.
--      스냅샷에 이미 기준이 있으면 매장을 보기 전에 돌려줬다. 지금 DB 는 0건이지만,
--      막는 자리가 뒤에 있으면 뒤늦게 발견됐을 때 이미 퍼진 뒤다.
--   ② 열린 장부 세율 채움이 **기존 기록을 안 봤다.**
--      배포 전에 기타 매출이 이미 있었다면 그 세금은 그때 세율로 계산돼 있는데,
--      0150 은 거기에 지금 세율을 굳혔다. 기록과 기준이 어긋난다.
--        기존 기타매출 세금 10% 로 계산 → 설정이 20% 로 바뀜 → 0150 이 20% 를 굳힘
--      (개발 DB 는 열린 장부의 기타 매출이 0원이라 실제 어긋남은 없었다.
--       그래도 배포 대상마다 다르니 규칙으로 닫는다.)
-- ════════════════════════════════════════════════════════════════

-- ── ① 남의 매장 메뉴는 스냅샷에 있어도 안 준다 ──────────────────
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

  /*
   * ⚠ 매장 검사를 **가장 앞으로** 옮긴다(0151). 0150 은 더하는 길만 막아서, 스냅샷에
   *   이미 섞여 들어간 기준은 아래 `이미 있으면 그대로 둔다` 로 그냥 통과했다.
   *
   * ⚠ **지운 메뉴와 구별한다.** `recipes` 에 아예 없는 것(사장님이 지운 메뉴)은
   *   여기서 안 막는다 — 그날 기준에 남아 있으면 과거 판매를 계속 고칠 수 있어야 한다.
   *   끊는 것은 **다른 매장 것으로 존재하는** 경우뿐이다.
   */
  if exists (select 1 from recipes where id = p_recipe and store_id <> p_store) then
    raise exception '그날 기준에도 없고 지금도 없는 메뉴예요'
      using errcode = '45013', detail = 'BASIS_NOT_AVAILABLE';
  end if;

  -- 이미 있으면 그대로 둔다. 다시 넣으면 오늘 기준이 지금 값으로 바뀐다 —
  -- 그게 바로 막으려던 일이다(불변식: 한 번 정해진 기준은 그날 안 움직인다).
  v_entry := v_day.snapshot #> array['recipes', p_recipe::text];
  if v_entry is not null then
    return v_entry;
  end if;

  -- 더할 때는 **그 매장 것**이어야 한다. 지운 메뉴도 여기서 걸린다 — 더할 값이 없다.
  if not exists (select 1 from recipes
                  where id = p_recipe and store_id = p_store) then
    raise exception '그날 기준에도 없고 지금도 없는 메뉴예요'
      using errcode = '45013', detail = 'BASIS_NOT_AVAILABLE';
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
  '그날 기준에 없는 메뉴를 그 시점 값으로 더한다 — 순수 추가라 이미 기록된 숫자는 안 움직인다(0062). 다른 매장 메뉴는 스냅샷에 있어도 안 준다(0151). 종료된 장부에는 정정 경로에서만 더하고, 그때 basis_quality 를 estimated_current 로 내린다(0149).';

revoke execute on function public.add_to_day_basis(uuid, date, uuid, boolean)
  from public, anon, authenticated, service_role;


-- ── ①' 판매 경로에도 같은 문을 단다 ────────────────────────────
/*
 * ⚠ `add_to_day_basis` 한 곳만으로는 못 막는다. `e10_sale_recorded` 는 그날 기준에
 *   그 메뉴가 **이미 있으면 그 함수를 아예 안 부른다** — 그러면 매장 검사도 안 돈다.
 *   시험에서 오염된 장부를 손으로 만들어 보고 알았다(정정이 그대로 성공했다).
 *   그래서 판매 경로에도 같은 문을 단다. 아무것도 쓰기 전에 끊는다.
 */
do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if v_def is null then raise exception '0151: e10_sale_recorded 가 없습니다'; end if;
  if position('store_id <> p_store' in v_def) > 0 then return; end if;

  v_old := '  if v_bday.status = ''closed'' and not p_allow_closed then
    raise exception ''% 영업이 종료되어 판매를 저장할 수 없어요'', p_date
      using errcode = ''45002'', detail = ''DAY_CLOSED'';
  end if;';
  if position(v_old in v_def) = 0 then
    raise exception '0151: e10 의 종료 검사를 못 찾았습니다';
  end if;

  execute replace(v_def, v_old, concat_ws(chr(10),
    v_old,
    '',
    '  /*',
    '   * ⚠ **다른 매장 메뉴는 여기서 끊는다**(0151). 그날 기준에 이미 섞여 들어와 있으면',
    '   *   `add_to_day_basis` 를 안 불러서 그쪽 검사가 안 돈다. 여기가 판매 경로의 첫 문이다.',
    '   * ⚠ `지운 메뉴`(recipes 에 아예 없음)와는 구별한다 — 그건 그날 기준이 남아 있으면',
    '   *   과거 판매를 계속 고칠 수 있어야 한다. 끊는 것은 다른 매장 것으로 **존재하는** 경우뿐이다.',
    '   */',
    '  if exists (select 1 from recipes where id = p_recipe and store_id <> p_store) then',
    '    raise exception ''그날 기준에도 없고 지금도 없는 메뉴예요''',
    '      using errcode = ''45013'', detail = ''BASIS_NOT_AVAILABLE'';',
    '  end if;'));
end $m$;


-- ── ② 열린 장부 세율은 **기존 기록이 있으면 그 기록을 따른다** ──
/*
 * 기타 매출 세금이 이미 있으면 그때 쓴 세율은 되짚을 수 있다 — `etc_tax ÷ etc_revenue`.
 * 지금 세율을 굳히는 것보다 이쪽이 옳다. 기록이 먼저고 설정은 나중이다.
 *
 * ⚠ **못 설명할 때만** 고친다. 굳어 있는 세율로 기록이 재현되면 그건 이미 맞는 값이다.
 *   0150 이 옳게 채운 장부와 새로 열린 장부를 건드리지 않으려는 조건이다.
 * ⚠ 종료된 장부는 여전히 안 건드린다(0150). 비워 두는 것이 정직하다.
 */
create or replace function public.etc_tax_rate_of_record(p_store uuid, p_date date)
returns numeric
language sql
stable
as $fn$
  /*
   * 그날 기타매출 **기록에서 되짚은** 세율. 설정도 스냅샷도 안 본다 —
   * 기록이 먼저고 설정은 나중이다. 되짚을 기록이 없으면 null.
   */
  select case when coalesce(etc_revenue, 0) > 0 and etc_tax is not null
              then round(etc_tax / etc_revenue, 12) end
    from daily_sales
   where store_id = p_store and sale_date = p_date;
$fn$;

comment on function public.etc_tax_rate_of_record(uuid, date) is
  '그날 기타매출 기록에서 되짚은 세율 — etc_tax ÷ etc_revenue(0151). 열린 장부에 세율을 굳힐 때 지금 설정보다 이 값이 먼저다.';

revoke execute on function public.etc_tax_rate_of_record(uuid, date) from public, anon;
grant  execute on function public.etc_tax_rate_of_record(uuid, date) to authenticated, service_role;

update business_days bd
   set snapshot = jsonb_set(coalesce(bd.snapshot, '{}'::jsonb), '{etc_tax_rate}',
                            to_jsonb(etc_tax_rate_of_record(bd.store_id, bd.business_date)), true)
  from daily_sales ds
 where ds.store_id = bd.store_id
   and ds.sale_date = bd.business_date
   and bd.status::text <> 'closed'
   and etc_tax_rate_of_record(bd.store_id, bd.business_date) is not null
   -- ⚠ **못 설명할 때만** 고친다. 굳은 세율로 기록이 재현되면 그건 이미 맞는 값이다.
   and round(ds.etc_revenue
             * coalesce((bd.snapshot->>'etc_tax_rate')::numeric, -1), 2)
       is distinct from round(ds.etc_tax, 2);


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_n int; v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'add_to_day_basis';
  -- 매장 검사가 `이미 있으면 그대로 둔다` 보다 **앞**이어야 한다. 순서까지 본다.
  if position('store_id <> p_store' in v_def) = 0
     or position('store_id <> p_store' in v_def) > position('if v_entry is not null then' in v_def) then
    raise exception '0151: 매장 검사가 아직 기존 기준 반환보다 뒤에 있습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if position('store_id <> p_store' in v_def) = 0 then
    raise exception '0151: 판매 경로에 매장 검사가 없습니다';
  end if;
  -- 아무것도 쓰기 전에 끊어야 한다. 판매행 upsert 보다 앞인지 본다.
  if position('store_id <> p_store' in v_def) > position('insert into daily_sales ' in v_def) then
    raise exception '0151: 판매 경로의 매장 검사가 쓰기보다 뒤에 있습니다';
  end if;

  /*
   * 지금 DB 에 남의 매장 것이 섞여 있지 않다는 것도 **여기서 못 박는다.**
   * 위 함수는 앞으로 들어올 것만 막는다. 이미 들어온 것이 있으면 사람이 봐야 한다.
   */
  select count(*) into v_n
    from daily_sales_items it
    join daily_sales ds on ds.id = it.daily_sales_id
    join recipes r on r.id = it.recipe_id
   where r.store_id <> ds.store_id;
  if v_n > 0 then
    raise exception '0151: 다른 매장 메뉴로 기록된 판매행이 %건 있습니다 — 손으로 정정한 뒤 다시 올리세요', v_n;
  end if;

  select count(*) into v_n
    from business_days bd
    cross join lateral jsonb_object_keys(coalesce(bd.snapshot->'recipes', '{}'::jsonb)) k
    join recipes r on r.id::text = k
   where r.store_id <> bd.store_id;
  if v_n > 0 then
    raise exception '0151: 다른 매장 메뉴가 담긴 영업일 기준이 %건 있습니다 — 손으로 정정한 뒤 다시 올리세요', v_n;
  end if;

  -- 열린 장부의 세율이 그날 기록을 설명해야 한다.
  select count(*) into v_n
    from business_days bd
    join daily_sales ds on ds.store_id = bd.store_id and ds.sale_date = bd.business_date
   where bd.status::text <> 'closed'
     and coalesce(ds.etc_revenue, 0) > 0
     and ds.etc_tax is not null
     and round(ds.etc_revenue * coalesce((bd.snapshot->>'etc_tax_rate')::numeric, -1), 2)
         is distinct from round(ds.etc_tax, 2);
  if v_n > 0 then
    raise exception '0151: 굳은 세율이 그날 기타매출 세금을 설명하지 못하는 열린 장부가 %건 남았습니다', v_n;
  end if;
end $v$;

select public.assert_no_rpc_overloads();
