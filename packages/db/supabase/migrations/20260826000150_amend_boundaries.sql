-- ════════════════════════════════════════════════════════════════
-- 0150 · 정정의 경계 셋 (0149 후속)
--
-- 0149 는 "무엇을 기준으로 쓰는가" 를 정했다. 그런데 **누구 것을, 언제 만드는가** 가
-- 안 정해져 있었다. 셋 다 실측으로 재현했다.
--
--   ① 남의 매장 메뉴가 우리 장부에 들어왔다.
--      `add_to_day_basis` 가 `p_recipe` 의 `store_id` 를 안 봤고, 정정 RPC 는
--      `security definer` 라 RLS 도 지나간다.
--      실측: 매장 A 장부에 매장 B 의 `남의 메뉴`(판매가 7,777)가 판매행으로 저장됐다.
--
--   ② `changed=false` 인데 장부 기준이 바뀌었다.
--      그날 기준에 없는 메뉴를 **0개**로 보내면, 수량을 보기도 전에 기준부터 더했다.
--      실측: basis exact → estimated_current, 메뉴 기준 추가됨, 판매 판본 4→4,
--      감사 판본 0→0. 바뀐 것을 아무도 안 남긴 변경이다.
--
--   ③ 이미 열려 있던 장부의 기타매출 세율이 안 굳었다.
--      0149 는 **새로 만드는** 스냅샷에만 `etc_tax_rate` 를 넣었다. 그전에 열린
--      오늘 장부에는 없어서, 같은 영업일 안에서도 설정을 바꾸면 세율이 따라 움직였다.
--      실측: 1,000원 → 100원(10%), 세율을 20% 로 바꾼 뒤 2,000원 → 400원.
-- ════════════════════════════════════════════════════════════════

-- ── ① 기준은 그 매장 것만 더한다 ────────────────────────────────
/*
 * `recipe_snapshot_entry(p_recipe)` 는 매장을 안 가린다 — 넘긴 id 의 레시피를 그대로
 * 만들어 준다. 정정 RPC 는 definer 라 RLS 도 안 걸린다. 그래서 매장 경계를 지킬 곳이
 * **여기 한 곳**이다. `assert_my_store(p_store)` 는 "이 사람이 이 매장 사람인가" 만
 * 보지, "이 메뉴가 이 매장 것인가" 는 안 본다.
 */
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

  /*
   * ⚠ **남의 매장 메뉴는 여기서 끊는다**(0150). 실측: 매장 A 의 과거 장부에
   *   매장 B 의 메뉴가 판매가 7,777 로 들어갔다. 스냅샷도 판매행도 만들어졌다.
   */
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
  '그날 기준에 없는 메뉴를 그 시점 값으로 더한다 — 순수 추가라 이미 기록된 숫자는 안 움직인다(0062). 그 매장 메뉴만 더한다(0150). 종료된 장부에는 정정 경로에서만 더하고, 그때 basis_quality 를 estimated_current 로 내린다(0149).';

/*
 * ⚠ **몸통이다.** `p_allow_closed => true` 로 부르면 종료된 장부의 기준을 바꾸고
 *   basis_quality 를 내릴 수 있다 — 판본 검사도 감사 기록도 없이. 문은 정정 RPC 다.
 */
revoke execute on function public.add_to_day_basis(uuid, date, uuid, boolean)
  from public, anon, authenticated, service_role;


-- ── ② 기준은 **바꿀 판매가 있을 때만** 더한다 ───────────────────
do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if v_def is null then raise exception '0150: e10_sale_recorded 가 없습니다'; end if;
  if position('if v_item is null and v_total = 0 then' in v_def) > 0 then return; end if;

  -- ②-1 기준 해석을 통째로 들어낸다. 수량 합계만 남긴다.
  v_old := '  v_snap := v_bday.snapshot #> array[''recipes'', p_recipe::text];
  if v_snap is null then
    -- ⚠ 막지 않고 **더한다**(0062). 오늘 기록이 없는 메뉴라 움직일 숫자가 없다.
    --   영업 중에 만든 새 메뉴, 껐다 다시 켠 메뉴가 여기로 온다.
    v_snap  := add_to_day_basis(p_store, p_date, p_recipe, p_allow_closed);
    v_added := true;
  end if;

  v_name  := v_snap->>''name'';
  v_price := (v_snap->>''price'')::numeric;
  v_mat   := coalesce((v_snap->>''material_cost'')::numeric, 0);
  v_extra := coalesce((v_snap->>''extra_cost'')::numeric, 0);
  v_mode  := coalesce((v_snap->>''tax_mode'')::tax_mode, ''included'');
  v_tax   := coalesce((v_snap->>''tax'')::numeric,
                      tax_of(v_price, v_mode, coalesce(v_snap->''tax_items'', ''[]''::jsonb)));

  v_total := coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0)
           + coalesce(p_qty_takeout,0) + coalesce(p_qty_waste,0);

  /*
   * ⚠ `판매 중지` 는 **오늘 파는 것**을 막는 스위치다(0149). 과거에 실제로 판 기록을
   *   고치는 데는 안 걸린다 — 실측: 제육볶음을 중지하니 3일 전 수량 수정이 거절됐다.
   *   과거 정정은 지금 파는지가 아니라 그날 무엇이 있었는지를 따른다.
   */
  if v_total > 0 and not p_allow_closed then
    if not coalesce((select active from recipes where id = p_recipe), true) then
      raise exception ''%은(는) 판매 중지된 메뉴예요. 레시피에서 판매를 다시 켜 주세요'', v_name
        using errcode = ''22000'';
    end if;
    -- ⚠ 재고가 없다고 막지 않는다(0102). 막으면 음수가 된 메뉴를 영영 못 고친다.
    --   부족은 응답의 shortages 로 알린다.
  end if;
';
  if position(v_old in v_def) = 0 then
    raise exception '0150: e10 의 기준 해석 구간을 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old,
'  v_total := coalesce(p_qty_hall,0) + coalesce(p_qty_delivery,0)
           + coalesce(p_qty_takeout,0) + coalesce(p_qty_waste,0);
');

  -- ②-2 판매행을 잡은 **뒤에** 기준을 정한다.
  v_old := '  select id into v_item
    from daily_sales_items
   where daily_sales_id = v_ds and recipe_id = p_recipe
   for update;

  if v_item is null then
    if v_total = 0 then
      return jsonb_build_object(''daily_sales_id'', v_ds, ''sales_item_id'', null, ''skipped'', true);
    end if;
    insert into daily_sales_items';
  if position(v_old in v_def) = 0 then
    raise exception '0150: e10 의 판매행 조회 구간을 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old,
'  select id into v_item
    from daily_sales_items
   where daily_sales_id = v_ds and recipe_id = p_recipe
   for update;

  /*
   * ⚠ **여기서야 기준을 정한다**(0150). 예전엔 맨 위에서 정했는데, 그러면 아무것도
   *   안 파는 호출(0개, 기존 기록도 없음)이 종료된 장부에 기준을 더하고
   *   `basis_quality` 를 내렸다 — 실측: changed=false 인데 exact → estimated_current,
   *   감사 기록은 0건. 기준을 더하는 것은 **장부를 바꾸는 일**이다.
   *   바꿀 판매가 있을 때만 한다.
   */
  if v_item is null and v_total = 0 then
    return jsonb_build_object(''daily_sales_id'', v_ds, ''sales_item_id'', null, ''skipped'', true);
  end if;

  v_snap := v_bday.snapshot #> array[''recipes'', p_recipe::text];
  if v_snap is null then
    -- ⚠ 막지 않고 **더한다**(0062). 그날 기록이 없는 메뉴라 움직일 숫자가 없다.
    --   영업 중에 만든 새 메뉴, 껐다 다시 켠 메뉴가 여기로 온다.
    v_snap  := add_to_day_basis(p_store, p_date, p_recipe, p_allow_closed);
    v_added := true;
  end if;

  v_name  := v_snap->>''name'';
  v_price := (v_snap->>''price'')::numeric;
  v_mat   := coalesce((v_snap->>''material_cost'')::numeric, 0);
  v_extra := coalesce((v_snap->>''extra_cost'')::numeric, 0);
  v_mode  := coalesce((v_snap->>''tax_mode'')::tax_mode, ''included'');
  v_tax   := coalesce((v_snap->>''tax'')::numeric,
                      tax_of(v_price, v_mode, coalesce(v_snap->''tax_items'', ''[]''::jsonb)));

  /*
   * ⚠ `판매 중지` 는 **오늘 파는 것**을 막는 스위치다(0149). 과거에 실제로 판 기록을
   *   고치는 데는 안 걸린다 — 실측: 제육볶음을 중지하니 3일 전 수량 수정이 거절됐다.
   *   과거 정정은 지금 파는지가 아니라 그날 무엇이 있었는지를 따른다.
   */
  if v_total > 0 and not p_allow_closed then
    if not coalesce((select active from recipes where id = p_recipe), true) then
      raise exception ''%은(는) 판매 중지된 메뉴예요. 레시피에서 판매를 다시 켜 주세요'', v_name
        using errcode = ''22000'';
    end if;
    -- ⚠ 재고가 없다고 막지 않는다(0102). 막으면 음수가 된 메뉴를 영영 못 고친다.
    --   부족은 응답의 shortages 로 알린다.
  end if;

  if v_item is null then
    insert into daily_sales_items');

  execute v_def;
end $m$;


-- ── ②' 기준이 내려갔으면 그것도 변경이다 ────────────────────────
/*
 * 감사 기록이 남길 것은 판매 숫자만이 아니다. `basis_quality` 가 내려갔다는 것은
 * **그날 손익을 무엇으로 계산했는지**가 바뀌었다는 뜻이라, 숫자보다 오래 남는다.
 */
alter table business_day_revisions
  add column if not exists before_basis_quality day_basis_quality,
  add column if not exists after_basis_quality  day_basis_quality;

comment on column business_day_revisions.before_basis_quality is
  '정정 전 그날 기준 품질(0150). 옛 기록은 null 이다 — 그때는 안 남겼다.';
comment on column business_day_revisions.after_basis_quality is
  '정정 후 그날 기준 품질(0150). 앞 값과 다르면 그것만으로도 변경이다.';

do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if v_def is null then raise exception '0150: 정정 RPC 가 없습니다'; end if;
  if position('v_bq0' in v_def) > 0 then return; end if;

  v_old := '  v_changed boolean;';
  if position(v_old in v_def) = 0 then
    raise exception '0150: 정정 RPC 의 선언부를 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old, concat_ws(chr(10),
    '  v_changed boolean;',
    '  v_bq0     day_basis_quality;   -- 몸통이 손대기 전 그날 기준 품질(0150)'));

  v_old := '  v_before := sales_summary(p_store, p_date, p_date);';
  if position(v_old in v_def) = 0 then
    raise exception '0150: 정정 RPC 의 전 상태 수집을 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old, concat_ws(chr(10),
    '  v_bq0    := v_day.basis_quality;',
    v_old));

  v_old := '  v_changed := v_created or v_bdet is distinct from v_adet or v_before is distinct from v_after;';
  if position(v_old in v_def) = 0 then
    raise exception '0150: 정정 RPC 의 무변경 판정을 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old, concat_ws(chr(10),
    '  /*',
    '   * ⚠ `basis_quality` 가 바뀌었으면 **그것만으로도 변경이다**(0150). 판매 숫자가',
    '   *   그대로여도 그날 손익을 무엇으로 계산했는지가 바뀌었다. 이걸 안 세면',
    '   *   `changed=false` 인데 장부 기준만 조용히 오염된다 — 실측으로 그랬다.',
    '   */',
    '  v_changed := v_created or v_bdet is distinct from v_adet',
    '               or v_before is distinct from v_after',
    '               or v_bq0 is distinct from v_day.basis_quality;'));

  v_old := '  insert into business_day_revisions
    (business_day_id, revision_no, reason,
     before_summary, after_summary, before_detail, after_detail, changed_by)
  values (v_day.id, v_audit, p_reason, v_before, v_after, v_bdet, v_adet, auth.uid());';
  if position(v_old in v_def) = 0 then
    raise exception '0150: 정정 RPC 의 감사 기록 삽입을 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old,
'  insert into business_day_revisions
    (business_day_id, revision_no, reason,
     before_summary, after_summary, before_detail, after_detail, changed_by,
     before_basis_quality, after_basis_quality)
  values (v_day.id, v_audit, p_reason, v_before, v_after, v_bdet, v_adet, auth.uid(),
          v_bq0, v_day.basis_quality);');

  execute v_def;
end $m$;


-- ── ③ 이미 열려 있던 장부에도 세율을 한 번 굳힌다 ───────────────
/*
 * 0149 는 **앞으로 만드는** 스냅샷만 고쳤다. 그 시점에 이미 열려 있던 장부는 그대로라,
 * 같은 영업일 안에서 설정을 바꾸면 기타매출 세금이 따라 움직였다.
 *
 * ⚠ **종료된 장부는 안 채운다.** 그날 세율이 얼마였는지 지금은 알 수 없다.
 *   비워 두면 0149 규칙이 `현재 세율 + estimated_current` 로 정직하게 처리한다.
 *   지금 값으로 채우면 그게 그날 값인 척하게 된다 — 그게 더 나쁘다.
 */
update business_days
   set snapshot = jsonb_set(coalesce(snapshot, '{}'::jsonb), '{etc_tax_rate}',
                            to_jsonb(store_tax_rate(store_id)), true)
 where status::text <> 'closed'
   and not (coalesce(snapshot, '{}'::jsonb) ? 'etc_tax_rate');


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text; v_n int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'add_to_day_basis';
  if position('and store_id = p_store' in v_def) = 0 then
    raise exception '0150: 기준 더하기가 아직 매장을 안 가립니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if position('if v_item is null and v_total = 0 then' in v_def) = 0 then
    raise exception '0150: e10 가 아직 팔지도 않고 기준부터 더합니다';
  end if;
  -- 기준 해석이 판매행 조회 **뒤에** 와야 한다. 순서까지 본다.
  if position('for update;' in v_def) > position('add_to_day_basis(p_store' in v_def) then
    raise exception '0150: e10 의 기준 해석이 아직 판매행 조회보다 앞섭니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if position('or v_bq0 is distinct from v_day.basis_quality' in v_def) = 0 then
    raise exception '0150: 기준 품질 변경이 아직 변경으로 안 셉니다';
  end if;
  if position('before_basis_quality, after_basis_quality' in v_def) = 0 then
    raise exception '0150: 감사 기록이 기준 품질 전후를 안 남깁니다';
  end if;

  select count(*) into v_n from business_days
   where status::text <> 'closed'
     and not (coalesce(snapshot, '{}'::jsonb) ? 'etc_tax_rate');
  if v_n > 0 then
    raise exception '0150: 세율이 안 굳은 열린 장부가 % 개 남았습니다', v_n;
  end if;
end $v$;

select public.assert_no_rpc_overloads();
