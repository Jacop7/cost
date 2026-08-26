-- ════════════════════════════════════════════════════════════════
-- 0146 · 0145 의 구멍 넷
--
-- ① 바꿀 게 없어도 **가짜 장부**가 생겼다
-- ② 기타매출·지출만 넣으면 **영업일 연결이 끊겼다**
-- ③ 감사 기록이 **실제 변경을 못 남겼다**
-- ④ 기록 없는 **오늘**을 종료 장부로 만들어 영업 시작을 막을 수 있었다  ← 제일 나쁜 것
--
-- 그리고 `p_base_revision` 을 필수로 굳힌다.
-- ════════════════════════════════════════════════════════════════

-- ── ③ 감사에 실제 변경을 남길 자리 ──────────────────────────────
/*
 * 0144 는 `before_summary`/`after_summary` 만 남겼다. 그런데 그건 **합계**다 —
 * 매장 1개를 배달 1개로 옮기면 총판매량과 금액이 그대로라 전후가 **똑같아진다.**
 * 실제로 그렇게 재 보니 채널 수량은 바뀌었는데 감사 기록은 아무 차이도 안 보였다.
 * §6.4 가 요구한 "변경 전후 값" 을 못 지키는 셈이다.
 *
 * 합계 옆에 **상세**를 같이 남긴다. 무엇이 달라졌는지는 이 둘을 비교하면 나온다 —
 * 차이를 미리 계산해 저장하면 그 계산이 두 곳이 되고, 둘이 어긋나는 날이 온다.
 */
alter table public.business_day_revisions
  add column if not exists before_detail jsonb,
  add column if not exists after_detail  jsonb;

comment on column public.business_day_revisions.before_detail is
  '정정 전 그날 판매 상세 — 메뉴별·채널별 수량과 기타매출·추가지출(0146). 합계만으로는 채널 이동 같은 변경이 안 보인다.';
comment on column public.business_day_revisions.after_detail is
  '정정 후 그날 판매 상세(0146). before_detail 과 비교하면 무엇이 달라졌는지 나온다.';

/**
 * 그날 판매 상세 한 덩이. 감사 기록의 전후 값으로 쓴다.
 *
 * ⚠ 채널을 **따로** 담는다. 합쳐서 담으면 매장↔배달 이동이 안 보인다 —
 *   그게 0145 감사 기록의 구멍이었다.
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
               'name', r.name,
               'qty_hall', it.qty_hall,
               'qty_delivery', it.qty_delivery,
               'qty_takeout', it.qty_takeout,
               'qty_waste', coalesce(it.qty_waste, 0))
             order by r.name)
        from daily_sales ds
        join daily_sales_items it on it.daily_sales_id = ds.id
        left join recipes r on r.id = it.recipe_id
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
  '그날 판매 상세(메뉴별·채널별 수량 + 기타매출·지출). 정정 감사 기록의 전후 값이다(0146).';


-- ── ①②④⑤ 정정 RPC 다시 ────────────────────────────────────────
/*
 * ⚠ `p_base_revision` 이 **필수**가 됐다(0146). 신규 RPC 라 부르는 화면이 아직 없어
 *   지금이 굳힐 마지막 기회다. 선택값으로 두면 "안 보내면 검사도 없다" 가 되고,
 *   그건 0117 이 판매 저장에서 막아 놓은 **낡은 화면 덮어쓰기**가 이 문으로 다시
 *   들어오는 길이다.
 */
drop function if exists public.amend_ended_business_day(uuid, date, jsonb, jsonb, jsonb, text, integer);

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
  v_rev     integer;
  v_before  jsonb;
  v_after   jsonb;
  v_bdet    jsonb;
  v_adet    jsonb;
  v_result  jsonb;
  v_snap    jsonb;
  v_created boolean := false;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄

  /*
   * ① 바꿀 게 없으면 **아무것도 만들지 않는다.**
   *   0145 는 이 검사가 없어서 빈 호출만으로 종료 장부가 생기고 감사 기록까지 남았다
   *   (created=true · revision=1 · 기록 1건). 없던 영업일이 생기는 건 되돌리기 어렵다.
   *   `save_sale` 의 `v_work` 와 같은 판단이다.
   */
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
    /*
     * ④ **오늘은 여기서 만들지 않는다.**
     *   허용 기간이 오늘까지라, 영업 시작 전에 이 문으로 들어오면 오늘이 `closed` 로
     *   생긴다. 그 뒤 `open_business_day` 는 "이미 종료된 날" 이라며 거부한다 —
     *   **정정 RPC 한 번으로 그날 영업을 통째로 막을 수 있었다.**
     *
     *   규칙을 셋으로 가른다:
     *     이미 종료된 날(오늘 포함) → 정정 허용
     *     장부 없는 과거 날짜       → 생성 허용
     *     장부 없는 오늘            → 여기서 안 만든다. 영업 시작이 할 일이다.
     *
     *   45001 을 그대로 쓴다. 화면이 이미 그 코드로 "영업을 시작할까요?" 를 묻는다.
     */
    if p_date >= store_local_date(p_store) then
      raise exception '오늘은 아직 영업을 시작하지 않았어요'
        using errcode = '45001', detail = 'BEFORE_OPEN';
    end if;

    /*
     * 그날 기준값은 만들 수 없다 — 그때 판매가·원가가 기록돼 있지 않다.
     * 지금 값으로 스냅샷을 만들고 `estimated_current` 를 영구히 남긴다(§6.4).
     * ⚠ `opened_at`·`closed_at`·`close_method` 는 비운다. 아무도 연 적도 닫은 적도 없다.
     */
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

  -- 정정 **전** 값. 합계와 상세를 같이 뜬다(③).
  v_before := sales_summary(p_store, p_date, p_date);
  v_bdet   := day_sales_detail(p_store, p_date);

  /*
   * ② `business_day_id` 를 **항상** 넣는다.
   *   0145 는 이걸 빼서, 메뉴 없이 기타매출만 넣으면 `daily_sales.business_day_id` 가
   *   null 로 남았다. 메뉴가 있을 때만 `e10_sale_recorded` 가 우연히 채워 줬다 —
   *   우연에 기대는 연결이었다.
   */
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

  -- ⚠ 여기만 `true` 다. 종료된 날에 쓰는 것이 이 함수의 목적이기 때문이다.
  v_result := apply_sale_items(p_store, p_date, v_sales, p_items, p_etc_items, p_extra_items, true);

  update daily_sales set revision = revision + 1, updated_at = now()
   where id = v_sales
  returning revision into v_rev;

  v_after := sales_summary(p_store, p_date, p_date);
  v_adet  := day_sales_detail(p_store, p_date);

  /*
   * 마감 집계도 새 값으로 맞춘다. 안 맞추면 "장부에는 12만원인데 마감 요약은 9만원" 이
   * 남는다. 원래 값은 아래 감사 기록에 그대로 있다.
   */
  update business_days
     set snapshot    = snapshot || jsonb_build_object('closing', v_after),
         revision_no = revision_no + 1
   where id = v_day.id
  returning revision_no into v_rev;

  insert into business_day_revisions
    (business_day_id, revision_no, reason,
     before_summary, after_summary, before_detail, after_detail, changed_by)
  values (v_day.id, v_rev, p_reason, v_before, v_after, v_bdet, v_adet, auth.uid());

  return jsonb_build_object(
    'business_day_id', v_day.id,
    'business_date', p_date,
    'created', v_created,
    'basis_quality', v_day.basis_quality,
    'revision_no', v_rev,
    'items', v_result,
    'before_summary', v_before,
    'after_summary', v_after,
    'before_detail', v_bdet,
    'after_detail', v_adet);
end $fn$;

comment on function public.amend_ended_business_day(uuid, date, integer, jsonb, jsonb, jsonb, text) is
  '종료된 과거 영업일을 다시 열지 않고 정정한다(0145·0146, 기획서 §6.4). 상태·종료 시각·종료 방식을 안 건드리고 business_day_revisions 에만 흔적을 남긴다. 장부 없는 오늘은 만들지 않는다 — 그건 영업 시작이 할 일이다.';

revoke execute on function public.amend_ended_business_day(uuid, date, integer, jsonb, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.amend_ended_business_day(uuid, date, integer, jsonb, jsonb, jsonb, text)
  to authenticated, service_role;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if v_def is null then raise exception '0146: 정정 RPC 가 없습니다'; end if;

  -- ① 무변경 거절
  if position('NO_CHANGES' in v_def) = 0 then
    raise exception '0146: 무변경 거절이 없습니다';
  end if;
  -- ② 영업일 연결
  if position('business_day_id' in v_def) = 0 then
    raise exception '0146: daily_sales 에 영업일을 안 잇습니다';
  end if;
  -- ③ 상세 감사
  if position('day_sales_detail' in v_def) = 0 then
    raise exception '0146: 감사에 상세를 안 남깁니다';
  end if;
  -- ④ 오늘 생성 금지
  if position('p_date >= store_local_date(p_store)' in v_def) = 0 then
    raise exception '0146: 장부 없는 오늘을 여전히 만듭니다';
  end if;
  -- ⑤ 판본 필수
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'amend_ended_business_day'
                and pg_get_function_identity_arguments(p.oid) not like '%p_base_revision integer,%') then
    raise exception '0146: p_base_revision 이 필수가 아닙니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
