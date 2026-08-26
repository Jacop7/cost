-- ════════════════════════════════════════════════════════════════
-- 0148 · "안 바뀌었다" 가 정말 안 바뀐 것이어야 한다
--
-- 0147 은 판본과 감사 기록을 안 올리게 했다. 그런데 **다른 것들이 여전히 움직였다.**
-- 자국이 남으면 그건 무변경이 아니다 — 나중에 "누가 언제 건드렸나" 를 볼 때 거짓말한다.
--
-- 자국 셋:
--   ① 정정 RPC 가 판정 **전에** `daily_sales.updated_at` 을 갱신했다
--   ② 공통 몸통이 기타매출·지출을 쓰면서 `updated_at` 을 **선갱신**했다
--   ③ `e10_sale_recorded` 가 `touch_business_day(p_store)` 를 불렀다
--
-- ⚠ ③ 은 **실제 변경 정정에서도 잘못이다.** 지난주 판매를 고치는 것이
--   오늘 영업일의 `last_activity_at` 을 밀면, 오늘 마지막 활동이 언제였는지가 틀려진다.
--   과거를 고치는 일과 오늘 장사하는 일은 다른 일이다.
-- ════════════════════════════════════════════════════════════════

-- ── ③ 과거 정정은 오늘을 건드리지 않는다 ────────────────────────
do $m$
declare v_def text; v_old text := '  perform touch_business_day(p_store);';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if v_def is null then raise exception '0148: e10_sale_recorded 가 없습니다'; end if;
  -- ⚠ 표식을 좁게 잡는다. 처음엔 `p_allow_closed then` 으로 뒀는데, 그건 위쪽의
  --   `if v_bday.status = 'closed' and not p_allow_closed then` 에도 걸려 **첫 실행부터**
  --   이미 적용된 것으로 읽고 지나갔다.
  if position('if not p_allow_closed then' in v_def) > 0 then return; end if;
  if position(v_old in v_def) = 0 then
    raise exception '0148: e10 의 touch 호출을 못 찾았습니다';
  end if;

  execute replace(v_def, v_old, concat_ws(chr(10),
    '  /*',
    '   * ⚠ 과거 정정 중에는 **오늘 영업일을 건드리지 않는다**(0148).',
    '   *   지난주 판매를 고치는 것이 오늘의 `last_activity_at` 을 밀면, 오늘 마지막',
    '   *   활동이 언제였는지가 틀려진다. 과거를 고치는 일과 오늘 장사하는 일은 다르다.',
    '   */',
    '  if not p_allow_closed then',
    '    perform touch_business_day(p_store);',
    '  end if;'));
end $m$;


-- ── ②' e10 의 자기 upsert 도 선갱신이었다 ───────────────────────
/*
 * 세 번째 선갱신 지점. 검토 목록에 없었고 나도 못 봤다 — 사보타주가 안 잡혀서
 * `daily_sales` 에 UPDATE 가 오면 예외를 던지는 트리거를 걸고 호출 경로를 읽어 찾았다:
 *
 *   e10_sale_recorded line 63
 *     insert into daily_sales ... on conflict do update
 *       set updated_at = now(), business_day_id = excluded.business_day_id
 *
 * 수량이 하나도 안 바뀌어도 메뉴 줄마다 이 upsert 가 돌면서 시각을 찍었다.
 * `save_sale`(오늘 장부)은 끝에서 `revision + 1, updated_at = now()` 를 따로 찍으니
 * 여기서 빼도 오늘 경로는 그대로다.
 */
do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if v_def is null then raise exception '0148: e10_sale_recorded 가 없습니다'; end if;
  if position('is distinct from excluded.business_day_id' in v_def) > 0 then return; end if;

  v_old := '  on conflict (store_id, sale_date)
    do update set updated_at = now(), business_day_id = excluded.business_day_id
  returning id into v_ds;';
  if position(v_old in v_def) = 0 then
    raise exception '0148: e10 의 daily_sales upsert 를 못 찾았습니다';
  end if;

  execute replace(v_def, v_old, concat_ws(chr(10),
    '  on conflict (store_id, sale_date)',
    '    -- ⚠ 여기서 시각을 안 찍는다(0148). 이을 것이 없으면 쓰기 자체를 안 한다 —',
    '    --   `daily_sales_touch` 트리거가 UPDATE 가 돌기만 하면 시각을 다시 찍는다.',
    '    do update set business_day_id = excluded.business_day_id',
    '     where daily_sales.business_day_id is distinct from excluded.business_day_id',
    '  returning id into v_ds;',
    '',
    '  -- 이을 것이 없어 아무 행도 안 건드렸을 때. 그 행은 이미 옳다.',
    '  if v_ds is null then',
    '    select id into v_ds from daily_sales',
    '     where store_id = p_store and sale_date = p_date;',
    '  end if;'));
end $m$;
-- ── ② 몸통은 값이 같으면 아예 쓰지 않는다 ──────────────────────
/*
 * `updated_at` 은 "이 행이 실제로 바뀐 시각" 이어야 한다. 몸통이 쓸 때마다 찍으면
 * 값이 그대로여도 시각만 새로 찍힌다 — 무변경 정정이 자국을 남기는 통로였다.
 *
 * ⚠ **`set updated_at = now()` 를 지우는 것만으로는 못 막았다.** `daily_sales` 에는
 *   `daily_sales_touch → touch_updated_at` 트리거가 있어서 UPDATE 가 돌기만 하면
 *   `new.updated_at := now()` 를 다시 찍는다. 사보타주를 걸었는데 시험이 조용해서
 *   이유를 찾다가 알았다 — 처음 고침은 겉모습만 바꾼 것이었다.
 *   자국을 안 남기는 길은 하나뿐이다: **값이 같으면 UPDATE 를 안 돌린다.**
 */
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
  v_item   jsonb;
  v_result jsonb := '[]'::jsonb;
  v_etc     numeric;
  v_etc_tax numeric;
  v_extra   numeric;
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
    -- 합계는 항목에서 **계산**한다. 화면이 보낸 합계를 믿으면 둘이 어긋난다.
    select coalesce(sum(coalesce((x->>'price')::numeric,0) * coalesce((x->>'qty')::numeric,1)), 0)
      into v_etc from jsonb_array_elements(p_etc_items) x;
    v_etc_tax := round(v_etc * store_tax_rate(p_store), 2);
    update daily_sales
       set etc_items = p_etc_items, etc_revenue = v_etc, etc_tax = v_etc_tax
     where id = p_sales
       and (etc_items   is distinct from p_etc_items
         or etc_revenue is distinct from v_etc
         or etc_tax     is distinct from v_etc_tax);
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

  return v_result;
end $fn$;

revoke execute on function public.apply_sale_items(uuid, date, uuid, jsonb, jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;

/*
 * ⚠ `save_sale` 은 늘 `updated_at` 을 찍어야 한다 — 오늘 장부는 "마지막으로 저장한 시각"
 *   이 의미가 있다. 몸통에서 뺐으니 그쪽 판본 갱신 줄이 대신 찍는다.
 *   이미 `set revision = revision + 1, updated_at = now()` 라 그대로 성립한다.
 */


-- ── ① 정정 RPC 는 판정 전에 아무 자국도 남기지 않는다 ───────────
do $m$
declare
  v_def text;
  v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if v_def is null then raise exception '0148: 정정 RPC 가 없습니다'; end if;
  if position('is distinct from excluded.business_day_id' in v_def) > 0 then return; end if;

  v_old := '  on conflict (store_id, sale_date) do update
     set business_day_id = excluded.business_day_id, updated_at = now()';
  if position(v_old in v_def) = 0 then
    raise exception '0148: 정정 RPC 의 upsert 를 못 찾았습니다';
  end if;

  execute replace(v_def, v_old, concat_ws(chr(10),
    '  on conflict (store_id, sale_date) do update',
    '     -- ⚠ 시각을 여기서 안 찍는다(0148). 판정 전에 찍으면 무변경 정정이 자국을 남긴다.',
    '     --   그리고 이을 것이 없으면 쓰기 자체를 안 한다.',
    '     set business_day_id = excluded.business_day_id',
    '   where daily_sales.business_day_id is distinct from excluded.business_day_id'));
end $m$;

/*
 * ⚠ `on conflict … where` 가 안 맞으면 `returning` 이 **아무 행도 안 준다.**
 *   그러면 `v_sales`·`v_rev` 가 null 이 되고 판본 검사가 엉뚱하게 돈다.
 *   못 받았을 때 다시 읽는 줄을 넣는다.
 */
do $m$
declare v_def text; v_old text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if position('v_sales is null then' in v_def) > 0 then return; end if;

  v_old := '  returning id, revision into v_sales, v_rev;';
  if position(v_old in v_def) = 0 then
    raise exception '0148: 정정 RPC 의 returning 을 못 찾았습니다';
  end if;

  execute replace(v_def, v_old, concat_ws(chr(10),
    '  returning id, revision into v_sales, v_rev;',
    '',
    '  -- 이을 것이 없어 upsert 가 아무 행도 안 건드렸을 때. 그 행은 이미 옳다.',
    '  if v_sales is null then',
    '    select id, revision into v_sales, v_rev from daily_sales',
    '     where store_id = p_store and sale_date = p_date;',
    '  end if;'));
end $m$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if position('if not p_allow_closed then' in v_def) = 0 then
    raise exception '0148: e10 가 과거 정정 중에도 오늘을 건드립니다';
  end if;
  if position('is distinct from excluded.business_day_id' in v_def) = 0 then
    raise exception '0148: e10 의 upsert 가 아직 매번 시각을 찍습니다';
  end if;
  if exists (
    select 1 from regexp_split_to_table(v_def, chr(10)) as line
     where line like '%updated_at%' and btrim(line) not like '--%'
       and btrim(line) not like '*%')
  then
    raise exception '0148: e10 가 아직 시각을 선갱신합니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'apply_sale_items';
  if exists (
    select 1 from regexp_split_to_table(v_def, chr(10)) as line
     where line like '%updated_at%' and btrim(line) not like '--%'
       and btrim(line) not like '*%')
  then
    raise exception '0148: 몸통이 아직 시각을 선갱신합니다';
  end if;
  -- ⚠ 시각 줄을 지우는 것만으로는 안 된다(트리거). 값이 같으면 안 쓰는지까지 본다.
  if position('etc_items   is distinct from p_etc_items' in v_def) = 0
     or position('extra_items is distinct from p_extra_items' in v_def) = 0 then
    raise exception '0148: 몸통이 값이 같아도 UPDATE 를 돌립니다 (트리거가 시각을 찍습니다)';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if position('is distinct from excluded.business_day_id' in v_def) = 0 then
    raise exception '0148: 정정 RPC 가 아직 판정 전에 씁니다';
  end if;
  if position('v_sales is null then' in v_def) = 0 then
    raise exception '0148: upsert 가 빈손일 때를 안 다룹니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
