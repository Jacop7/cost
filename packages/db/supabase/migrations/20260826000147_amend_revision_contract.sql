-- ════════════════════════════════════════════════════════════════
-- 0147 · 정정 RPC 의 응답 계약과 무변경 판정
--
-- ① 응답이 **다음 저장에 쓸 판본**을 안 줬다
-- ② 같은 값을 다시 보내도 정정 기록이 생겼다
-- ③ 감사 상세의 메뉴명이 **지금** 이름이었다
-- ════════════════════════════════════════════════════════════════

-- ── ③ 메뉴명은 판매 시점 이름 ───────────────────────────────────
/*
 * `recipes.name` 은 **지금** 이름이다. 메뉴 이름을 바꾸면 과거 감사 기록의 이름까지
 * 소급해서 바뀐다 — 무엇을 고쳤는지 되짚는 기록인데 그 이름이 흔들리면 못 믿는다.
 * `daily_sales_items.menu_name` 은 팔릴 때 굳은 값이다. 그쪽을 쓴다.
 */
create or replace function public.day_sales_detail(p_store uuid, p_date date)
returns jsonb
language sql
stable
as $fn$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'recipe_id', it.recipe_id,
               -- ⚠ 판매 시점에 굳은 이름이다. `recipes.name` 을 쓰면 과거가 소급된다.
               'name', it.menu_name,
               'qty_hall', it.qty_hall,
               'qty_delivery', it.qty_delivery,
               'qty_takeout', it.qty_takeout,
               'qty_waste', coalesce(it.qty_waste, 0))
             order by it.menu_name, it.recipe_id)
        from daily_sales ds
        join daily_sales_items it on it.daily_sales_id = ds.id
       where ds.store_id = p_store and ds.sale_date = p_date), '[]'::jsonb),
    'etc_items',    coalesce((select etc_items   from daily_sales
                               where store_id = p_store and sale_date = p_date), '[]'::jsonb),
    'extra_items',  coalesce((select extra_items from daily_sales
                               where store_id = p_store and sale_date = p_date), '[]'::jsonb),
    'etc_revenue',  coalesce((select etc_revenue from daily_sales
                               where store_id = p_store and sale_date = p_date), 0),
    'daily_extra',  coalesce((select daily_extra from daily_sales
                               where store_id = p_store and sale_date = p_date), 0));
$fn$;

comment on function public.day_sales_detail(uuid, date) is
  '그날 판매 상세(메뉴별·채널별 수량 + 기타매출·지출). 정정 감사 기록의 전후 값이다(0146). 메뉴명은 판매 시점에 굳은 daily_sales_items.menu_name 을 쓴다(0147).';


-- ── ①② 정정 RPC 다시 ───────────────────────────────────────────
create or replace function public.amend_ended_business_day(
  p_store         uuid,
  p_date          date,
  p_base_revision integer,
  p_items         jsonb default '[]'::jsonb,
  p_etc_items     jsonb default null,
  p_extra_items   jsonb default null,
  p_reason        text  default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_day     business_days;
  v_sales   uuid;
  v_rev     integer;   -- daily_sales.revision — **다음 저장에 되보낼 값**
  v_audit   integer;   -- business_days.revision_no — 정정 횟수(감사용)
  v_before  jsonb;
  v_after   jsonb;
  v_bdet    jsonb;
  v_adet    jsonb;
  v_result  jsonb;
  v_snap    jsonb;
  v_created boolean := false;
  v_changed boolean;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄

  -- 보낸 것이 아예 없으면 장부를 만들기도 전에 돌려보낸다(0146 ①).
  if coalesce(jsonb_array_length(p_items), 0) = 0
     and p_etc_items is null and p_extra_items is null then
    raise exception '고칠 내용이 없어요' using errcode = '45012', detail = 'NO_CHANGES';
  end if;

  if not sale_date_allowed(p_store, p_date) then
    raise exception '% 은 입력할 수 있는 기간이 아니에요 (지난달 1일부터 오늘까지)', p_date
      using errcode = '45010', detail = 'SALE_DATE_OUT_OF_RANGE';
  end if;

  perform lock_business_scope(p_store);   -- 0132 와 같은 줄

  select * into v_day from business_days
   where store_id = p_store and business_date = p_date
     for update;

  if v_day.id is not null and v_day.status::text <> 'closed' then
    raise exception '% 은 아직 영업 중이에요. 판매 화면에서 저장해 주세요', p_date
      using errcode = '45011', detail = 'DAY_IS_LIVE';
  end if;

  if v_day.id is null then
    -- 장부 없는 **오늘**은 여기서 안 만든다. 그건 영업 시작이 할 일이다(0146 ④).
    if p_date >= store_local_date(p_store) then
      raise exception '오늘은 아직 영업을 시작하지 않았어요'
        using errcode = '45001', detail = 'BEFORE_OPEN';
    end if;

    v_snap := build_day_snapshot(p_store, p_date);
    if v_snap is null or v_snap = '{}'::jsonb then
      raise exception '% 의 기준값을 만들지 못했어요', p_date using errcode = '22000';
    end if;
    insert into business_days (store_id, business_date, status, snapshot,
                               opened_at, planned_close_at, closed_at, close_method,
                               operating_rule_id, scheduled_open_at, basis_quality)
         values (p_store, p_date, 'closed', v_snap,
                 null, planned_close(p_store, p_date), null, null,
                 (select id from operating_rule_at(p_store, p_date)),
                 scheduled_open_at(p_store, p_date), 'estimated_current')
      returning * into v_day;
    v_created := true;
  end if;

  v_before := sales_summary(p_store, p_date, p_date);
  v_bdet   := day_sales_detail(p_store, p_date);

  -- `business_day_id` 를 항상 잇는다(0146 ②).
  insert into daily_sales (store_id, sale_date, business_day_id)
       values (p_store, p_date, v_day.id)
  on conflict (store_id, sale_date) do update
     set business_day_id = excluded.business_day_id, updated_at = now()
  returning id, revision into v_sales, v_rev;

  -- ⚠ 잠금을 쥔 뒤에 잰다. 먼저 재면 재는 사이에 남이 커밋할 수 있다.
  if v_rev is distinct from p_base_revision then
    raise exception '다른 기기에서 판매 내역이 변경됐어요. 최신 내역을 다시 확인해 주세요.'
      using errcode = '45009', detail = 'REVISION_CONFLICT';
  end if;

  v_result := apply_sale_items(p_store, p_date, v_sales, p_items, p_etc_items, p_extra_items, true);

  v_after := sales_summary(p_store, p_date, p_date);
  v_adet  := day_sales_detail(p_store, p_date);

  /*
   * ② **정말로 달라졌을 때만** 판본을 올리고 감사에 남긴다.
   *
   *   화면이 기존 수량을 그대로 되보내는 일은 흔하다(저장 버튼을 두 번 누르거나,
   *   다른 칸만 고치고 저장하거나). 0146 은 그때도 판본을 올리고 감사 기록을 만들었다 —
   *   `before_detail = after_detail` 인 "아무것도 안 바뀐 정정" 이 쌓인다.
   *   감사 기록이 잡음으로 차면 진짜 변경을 그 속에서 못 찾는다.
   *
   *   ⚠ 장부를 **새로 만든 경우**는 달라진 것이다. 판매가 그대로여도 없던 장부가 생겼다.
   */
  v_changed := v_created or v_bdet is distinct from v_adet or v_before is distinct from v_after;

  if not v_changed then
    return jsonb_build_object(
      'business_day_id', v_day.id,
      'business_date', p_date,
      'created', false,
      'changed', false,
      'basis_quality', v_day.basis_quality,
      -- ⚠ 판본은 **안 올랐다**. 화면이 그대로 다시 쓸 수 있어야 한다.
      'revision', v_rev,
      'audit_revision_no', v_day.revision_no,
      'items', v_result,
      'before_summary', v_before, 'after_summary', v_after,
      'before_detail', v_bdet,   'after_detail', v_adet);
  end if;

  update daily_sales set revision = revision + 1, updated_at = now()
   where id = v_sales
  returning revision into v_rev;

  -- 마감 집계도 새 값으로 맞춘다. 원래 값은 감사 기록에 그대로 있다.
  update business_days
     set snapshot    = snapshot || jsonb_build_object('closing', v_after),
         revision_no = revision_no + 1
   where id = v_day.id
  returning revision_no into v_audit;

  insert into business_day_revisions
    (business_day_id, revision_no, reason,
     before_summary, after_summary, before_detail, after_detail, changed_by)
  values (v_day.id, v_audit, p_reason, v_before, v_after, v_bdet, v_adet, auth.uid());

  /*
   * ① 두 판본은 **다른 값**이다. 섞으면 화면이 다음 저장에서 즉시 45009 를 맞는다 —
   *   0146 은 응답의 `revision_no` 에 감사용 값(1)을 담았는데 실제 다음 판본은 5였다.
   *     revision          : `daily_sales.revision`   — 화면이 다음 저장에 되보낼 값
   *     audit_revision_no : `business_days.revision_no` — 이 장부를 몇 번 정정했나
   */
  return jsonb_build_object(
    'business_day_id', v_day.id,
    'business_date', p_date,
    'created', v_created,
    'changed', true,
    'basis_quality', v_day.basis_quality,
    'revision', v_rev,
    'audit_revision_no', v_audit,
    'items', v_result,
    'before_summary', v_before, 'after_summary', v_after,
    'before_detail', v_bdet,   'after_detail', v_adet);
end $fn$;

comment on function public.amend_ended_business_day(uuid, date, integer, jsonb, jsonb, jsonb, text) is
  '종료된 과거 영업일을 다시 열지 않고 정정한다(0145~0147, 기획서 §6.4). 응답의 revision 은 다음 저장에 되보낼 판본이고 audit_revision_no 는 정정 횟수다 — 둘은 다른 값이다.';


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';

  -- ① 두 판본을 따로 준다.
  if position('''revision'', v_rev' in v_def) = 0
     or position('''audit_revision_no''' in v_def) = 0 then
    raise exception '0147: 응답이 두 판본을 따로 안 줍니다';
  end if;
  -- ② 무변경 판정이 있다.
  if position('v_changed' in v_def) = 0 then
    raise exception '0147: 무변경 판정이 없습니다';
  end if;
  -- ③ 메뉴명이 판매 시점 값이다(코드 줄만 본다 — 주석 제외).
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), chr(10)) as line
     where n.nspname = 'public' and p.proname = 'day_sales_detail'
       and line like '%r.name%' and btrim(line) not like '--%')
  then
    raise exception '0147: 감사 상세가 아직 지금 레시피명을 씁니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
