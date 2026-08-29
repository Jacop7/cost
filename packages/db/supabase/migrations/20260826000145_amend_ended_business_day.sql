-- ════════════════════════════════════════════════════════════════
-- 0145 · 종료된 장부를 **다시 열지 않고** 고친다 (기획서 §6.4)
--
-- 0139 가 과거 날짜 판매를 막았다. 기획서가 그렇게 정했기 때문이다 —
--     "종료된 장부를 다시 열지 않는다. 정정 RPC 로 수정한다."
-- 그 정정 RPC 가 여기다.
--
-- ── 문은 둘, 몸통은 하나 ────────────────────────────────────────
--     save_sale                  ← 살아 있는 오늘 장부
--     amend_ended_business_day   ← 종료된 / 아예 없는 과거 장부
--                ↓ 둘 다
--     apply_sale_items           ← 판매·기타매출·지출을 실제로 반영하는 몸통
--
-- 문을 나누는 이유: 두 경로는 **규칙이 다르다.** 오늘은 마감 기한 검사와 판본 충돌이
-- 필요하고, 과거는 기한과 무관하되 허용 기간·감사 기록·기준 품질이 필요하다.
-- 한 함수에 두 규칙을 넣으면 분기가 늘고, 그 분기가 곧 0138 의
-- `p_date = business_day()` 같은 구멍이 된다.
--
-- 몸통을 나누지 않는 이유: 판매 반영이 두 벌이면 "오늘 적은 것과 나중에 고친 것의
-- 재고 차감이 다르다" 가 된다. `close_business_day` / `close_due_business_days` 가
-- 몸통을 공유한 것과 같은 짜임이다.
--
-- ── 종료 상태를 안 바꾼다 ───────────────────────────────────────
-- `status` · `closed_at` · `close_method` 를 건드리지 않는다. 그래야 "다시 열지 않는다"
-- 가 말이 아니라 사실이 된다. 흔적은 `business_day_revisions` 에만 남는다.
-- ════════════════════════════════════════════════════════════════

-- ── ⓪ 판매 이벤트도 몸통 계열이다 ──────────────────────────────
/*
 * `e10_sale_recorded` 는 종료된 날을 스스로 막는다. 그런데 정정은 **종료된 날에 쓰는
 * 것이 목적**이라 그 문지기에 걸린다(시드가 8/05 에서 그렇게 죽었다).
 *
 * 문지기를 없애지 않는다 — 대신 **누가 통과할 수 있는지**를 좁힌다.
 *   · `p_allow_closed` 를 더한다. 기본은 `false` 라 기존 호출은 그대로다.
 *   · 그리고 이 함수를 앱 롤에서 걷는다. 이제 부르는 곳은 `apply_sale_items` 뿐이고,
 *     그건 이미 소유자 전용이다. 인자를 열어 둔 채 함수를 열어 두면 그게 곧 문이다 —
 *     `close_business_day_row` 에서 지적받은 그 모양이다.
 *
 * ⚠ 시험 36곳이 이 함수를 직접 부른다. 소유자로 부르는 `pg_temp.e10()` 로 옮긴다.
 *   시험이 할 수 있는 일과 앱 사용자가 할 수 있는 일은 다르다(0141 과 같은 판단).
 */
do $m0$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'e10_sale_recorded';
  if v_def is null then raise exception '0145: e10_sale_recorded 가 없습니다'; end if;
  if position('p_allow_closed' in v_def) > 0 then return; end if;

  v_def := replace(v_def, 'p_qty_waste numeric DEFAULT 0)',
                          'p_qty_waste numeric DEFAULT 0, p_allow_closed boolean DEFAULT false)');
  v_def := replace(v_def, '  if v_bday.status = ''closed'' then',
                          '  if v_bday.status = ''closed'' and not p_allow_closed then');
  execute v_def;
  /*
   * ⚠ 인자를 더하면 `create or replace` 가 **새 함수**를 만든다 — 옛 것이 남아 오버로드가
   *   된다(`assert_no_rpc_overloads` 가 잡았다). 그러면 인자를 안 주는 호출이 옛 함수로
   *   가서 문지기가 그대로 살아 있는 것처럼 보인다. 옛 시그니처를 지운다.
   */
  drop function if exists public.e10_sale_recorded(uuid, date, uuid, numeric, numeric, numeric, numeric);
end $m0$;

revoke execute on function public.e10_sale_recorded(uuid, date, uuid, numeric, numeric, numeric, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.e10_sale_recorded(uuid, date, uuid, numeric, numeric, numeric, numeric, boolean)
  to service_role;


-- ── ① 몸통 ──────────────────────────────────────────────────────
/**
 * 판매·기타매출·추가지출을 그날 장부에 반영한다. **문지기 노릇을 안 한다** —
 * 권한·기간·상태 확인은 부르는 쪽 몫이다.
 *
 * ⚠ `save_sale` 의 4·5 단계를 그대로 옮긴 것이다. 옮기면서 규칙을 바꾸지 않았다 —
 *   보낸 메뉴만 고치고(0117), 기타/지출은 배열 통째 교체, 합계는 항목에서 계산.
 */
-- 같은 이유로 옛 시그니처를 먼저 지운다(인자를 더했다).
drop function if exists public.apply_sale_items(uuid, date, uuid, jsonb, jsonb, jsonb);

create or replace function public.apply_sale_items(
  p_store       uuid,
  p_date        date,
  p_sales       uuid,
  p_items       jsonb,
  p_etc_items   jsonb,
  p_extra_items jsonb,
  -- ⚠ 정정 경로만 `true` 를 준다. 기본이 `false` 라 오늘 저장은 그대로 막힌다.
  p_allow_closed boolean default false
) returns jsonb
language plpgsql
as $fn$
declare
  v_item   jsonb;
  v_result jsonb := '[]'::jsonb;
  v_etc    numeric;
  v_extra  numeric;
begin
  /*
   * ⚠ **전체 교체가 아니다**(0117). 안 보낸 메뉴는 그대로 둔다.
   *   예전엔 "목록에 없으면 0 으로" 루프가 있었고, 그게 낡은 화면이 남의 판매를
   *   지우는 통로였다. 지울 때는 0 을 명시해서 보낸다.
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
   *   여럿일 수 있어 무엇이 같은 항목인지 정할 수 없다. 대신 부르는 쪽의 판본 검사가
   *   낡은 배열을 아예 못 들어오게 막는다.
   */
  if p_etc_items is not null then
    -- 합계는 항목에서 **계산**한다. 화면이 보낸 합계를 믿으면 둘이 어긋난다.
    select coalesce(sum(coalesce((x->>'price')::numeric,0) * coalesce((x->>'qty')::numeric,1)), 0)
      into v_etc from jsonb_array_elements(p_etc_items) x;
    update daily_sales
       set etc_items = p_etc_items, etc_revenue = v_etc,
           etc_tax = round(v_etc * store_tax_rate(p_store), 2), updated_at = now()
     where id = p_sales;
  end if;
  if p_extra_items is not null then
    select coalesce(sum(coalesce((x->>'amount')::numeric,0)), 0)
      into v_extra from jsonb_array_elements(p_extra_items) x;
    update daily_sales
       set extra_items = p_extra_items, daily_extra = v_extra, updated_at = now()
     where id = p_sales;
  end if;

  return v_result;
end $fn$;

comment on function public.apply_sale_items(uuid, date, uuid, jsonb, jsonb, jsonb, boolean) is
  '판매 반영 몸통(0145). save_sale 과 amend_ended_business_day 가 같이 쓴다 — 두 벌이면 오늘 적은 것과 나중에 고친 것의 재고 차감이 갈린다. 권한·기간·상태 확인은 부르는 쪽 몫이다.';

revoke execute on function public.apply_sale_items(uuid, date, uuid, jsonb, jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;


-- ── ② save_sale 이 몸통을 부른다 ────────────────────────────────
/*
 * ⚠ 그러면서 `save_sale` 도 `security definer` 가 된다.
 *   몸통은 문지기가 없어서 소유자 전용이고(위 revoke), `save_sale` 은 invoker 라
 *   앱 롤로 돌기 때문에 그대로면 **몸통을 못 부른다**(실제로 시험 5개가 빨개졌다).
 *
 *   답은 두 갈래였다 —
 *     ⓐ 몸통을 authenticated 에게 연다  → 문지기 없는 함수를 사용자에게 여는 것.
 *        `close_business_day_row` 에서 지적받은 바로 그 실수다.
 *     ⓑ `save_sale` 을 definer 로 돌린다 → `close_business_day` 와 같은 모양.
 *   ⓑ 를 택한다. **첫 줄이 `assert_my_store`** 라 권한 경계는 명시돼 있다.
 */
do $m$
declare v_def text; v_i int; v_j int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  if v_def is null then raise exception '0145: save_sale 이 없습니다'; end if;
  if position('apply_sale_items' in v_def) > 0 then return; end if;   -- 이미 적용됨

  v_i := position('  -- ── 4) 보낸 메뉴만 고친다' in v_def);
  v_j := position('  -- ── 6) 판본을 올린다' in v_def);
  if v_i = 0 or v_j = 0 or v_j < v_i then
    raise exception '0145: save_sale 의 4~5 단계를 못 찾았습니다';
  end if;

  v_def := left(v_def, v_i - 1)
        || '  -- ── 4·5) 판매·기타매출·지출 반영 — **몸통**이 한다(0145).' || chr(10)
        || '  v_result := apply_sale_items(p_store, p_date, v_sales, p_items, p_etc_items, p_extra_items);' || chr(10)
        || chr(10)
        || substr(v_def, v_j);

  execute v_def;
end $m$;

/*
 * ⚠ definer 전환은 **따로** 돈다. 위 블록에 넣었더니 "몸통 호출이 이미 있으면 return"
 *   하는 조기 반환에 걸려 전환이 건너뛰어졌다 — 0142 에서 지적받은 그 모양이다.
 *   각 단계는 자기 조건만 보고 자기 일만 한다.
 */
do $m2$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  if v_def is null then raise exception '0145: save_sale 이 없습니다'; end if;
  if position('SECURITY DEFINER' in v_def) > 0 then return; end if;

  execute replace(v_def, ' LANGUAGE plpgsql' || chr(10),
                         ' LANGUAGE plpgsql' || chr(10)
                         || ' SECURITY DEFINER' || chr(10)
                         || ' SET search_path TO ''public''' || chr(10));
end $m2$;

revoke execute on function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer) from public, anon;
grant execute on function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer) to authenticated, service_role;



-- ── ②-b 기한 검사에서 역할 예외를 없앤다 ────────────────────────
/*
 * 0139 는 기한 검사를 `current_user in ('authenticated','anon')` 일 때만 걸었다.
 * 시드가 과거 날짜를 넣어야 해서 소유자를 빼 준 것이었다.
 *
 * ⚠ 그런데 `save_sale` 이 definer 가 되면서 `current_user` 는 **언제나 소유자**다.
 *   즉 그 조건은 이제 **아무에게도 안 걸린다** — 앱 사용자에게도 안 걸린다.
 *   26번이 `기한이 지나면 열려 있어도 안 받는다` 로 그걸 잡았다.
 *
 * 역할로 가르는 방식 자체를 버린다. 기한은 **누구에게나** 같다.
 * 과거 기록은 이제 제 길이 생겼다 — `amend_ended_business_day`. 시드도 그 길로 간다.
 */
do $m3$
declare v_def text; v_old text := '    if current_user in (''authenticated'', ''anon'')';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  if position(v_old in v_def) = 0 then return; end if;   -- 이미 적용됨

  -- 조건 첫 줄을 통째로 바꾼다. 뒤의 `and v_status <> 'closed'` 부터는 그대로다.
  -- 두 줄 결합 anchor가 없으면 치환이 조용히 무효가 되고 기한 검사가 죽는다 — 중단한다.
  if position(v_old || chr(10) || '       and v_status <> ''closed''' in v_def) = 0 then
    raise exception '0145: 기한 검사의 역할 조건 두 줄을 못 찾았습니다';
  end if;
  execute replace(v_def, v_old || chr(10) || '       and v_status <> ''closed''',
                         '    if v_status <> ''closed''');
end $m3$;

/*
 * ⚠ `opened_at` 의 NOT NULL 을 푼다.
 *   정정으로 만들어지는 과거 장부는 **아무도 연 적이 없다.** 지금까지는 그런 행이
 *   존재할 수 없어서 NOT NULL 이 맞았다. 이제 존재한다.
 *
 *   대안은 시각을 지어 넣는 것뿐이었다 — 예정 시작 시각을 적으면 "그때 열었다" 는
 *   거짓이 되고, `now()` 를 적으면 "오늘 그날 영업을 시작했다" 가 된다.
 *   비워 두는 것이 사실이다. 만들어진 시각은 `created_at` 에 이미 있다(§6.4 —
 *   "실제 판매일과 입력·수정한 시각을 별도로 기록한다").
 */
alter table public.business_days alter column opened_at drop not null;

comment on column public.business_days.opened_at is
  '사장님이 실제로 영업을 시작한 시각. ⚠ 정정으로 만들어진 과거 장부는 **null** 이다 — 아무도 연 적이 없다(0145). 만들어진 시각은 created_at 에 있다.';


-- ── ③ 정정 RPC ──────────────────────────────────────────────────
/**
 * 종료된(또는 아예 없는) 과거 영업일의 판매를 고친다.
 *
 * ⚠ `security definer` 다 — 몸통과 감사 기록 쓰기가 소유자 전용이기 때문이다.
 *   그래서 **첫 줄이 권한 확인**이다(0135 에서 배운 모양).
 *
 * 거절은 전부 안정된 코드로 나간다(0144):
 *     45010 SALE_DATE_OUT_OF_RANGE  허용 기간(지난달 1일~오늘) 밖
 *     45011 DAY_IS_LIVE             그날은 아직 살아 있다 → 보통 저장 경로로
 *     45009 REVISION_CONFLICT       낡은 화면
 */
create or replace function public.amend_ended_business_day(
  p_store         uuid,
  p_date          date,
  p_items         jsonb default '[]'::jsonb,
  p_etc_items     jsonb default null,
  p_extra_items   jsonb default null,
  p_reason        text  default null,
  p_base_revision integer default null
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
  v_result  jsonb;
  v_snap    jsonb;
  v_created boolean := false;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄

  if not sale_date_allowed(p_store, p_date) then
    raise exception '% 은 입력할 수 있는 기간이 아니에요 (지난달 1일부터 오늘까지)', p_date
      using errcode = '45010', detail = 'SALE_DATE_OUT_OF_RANGE';
  end if;

  -- 영업 시작·시간 변경·자동 마감과 같은 줄에 선다(0132).
  perform lock_business_scope(p_store);

  select * into v_day from business_days
   where store_id = p_store and business_date = p_date
     for update;

  if v_day.id is not null and v_day.status::text <> 'closed' then
    raise exception '% 은 아직 영업 중이에요. 판매 화면에서 저장해 주세요', p_date
      using errcode = '45011', detail = 'DAY_IS_LIVE';
  end if;

  /*
   * 장부가 아예 없는 날. 원자적으로 만든다.
   *
   * ⚠ 그날 기준값은 **만들 수 없다** — 그때 판매가·원가가 기록돼 있지 않다.
   *   지금 값으로 스냅샷을 만들고 `estimated_current` 를 영구히 남긴다.
   *   §6.4: "정상 장부처럼 조용히 섞지 않는다."
   *
   * ⚠ `closed_at` · `close_method` 는 비운다. 아무도 실제로 연 적도 닫은 적도 없다 —
   *   기한을 적어 넣으면 없던 영업을 있었던 것처럼 꾸미는 셈이다.
   */
  if v_day.id is null then
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

  -- 정정 **전** 집계. 뒤 값과 함께 감사에 남는다.
  v_before := sales_summary(p_store, p_date, p_date);

  insert into daily_sales (store_id, sale_date) values (p_store, p_date)
  on conflict (store_id, sale_date) do update set updated_at = now()
  returning id, revision into v_sales, v_rev;

  -- ⚠ 잠금을 쥔 뒤에 잰다. 먼저 재면 재는 사이에 남이 커밋할 수 있다.
  if p_base_revision is not null and v_rev is distinct from p_base_revision then
    raise exception '다른 기기에서 판매 내역이 변경됐어요. 최신 내역을 다시 확인해 주세요.'
      using errcode = '45009', detail = 'REVISION_CONFLICT';
  end if;

  -- ⚠ 여기만 `true` 다. 종료된 날에 쓰는 것이 이 함수의 목적이기 때문이다.
  v_result := apply_sale_items(p_store, p_date, v_sales, p_items, p_etc_items, p_extra_items, true);

  update daily_sales set revision = revision + 1, updated_at = now()
   where id = v_sales
  returning revision into v_rev;

  v_after := sales_summary(p_store, p_date, p_date);

  /*
   * 마감 집계도 새 값으로 맞춘다. 안 맞추면 "장부에는 12만원인데 마감 요약은 9만원" 이
   * 남는다. 원래 값은 아래 감사 기록의 `before_summary` 에 그대로 있다.
   */
  update business_days
     set snapshot    = snapshot || jsonb_build_object('closing', v_after),
         revision_no = revision_no + 1
   where id = v_day.id
  returning revision_no into v_rev;

  insert into business_day_revisions
    (business_day_id, revision_no, reason, before_summary, after_summary, changed_by)
  values (v_day.id, v_rev, p_reason, v_before, v_after, auth.uid());

  return jsonb_build_object(
    'business_day_id', v_day.id,
    'business_date', p_date,
    'created', v_created,
    'basis_quality', v_day.basis_quality,
    'revision_no', v_rev,
    'items', v_result,
    'before_summary', v_before,
    'after_summary', v_after);
end $fn$;

comment on function public.amend_ended_business_day(uuid, date, jsonb, jsonb, jsonb, text, integer) is
  '종료된 과거 영업일을 다시 열지 않고 정정한다(0145, 기획서 §6.4). 상태·종료 시각·종료 방식을 안 건드리고 business_day_revisions 에만 흔적을 남긴다.';

revoke execute on function public.amend_ended_business_day(uuid, date, jsonb, jsonb, jsonb, text, integer)
  from public, anon;
grant execute on function public.amend_ended_business_day(uuid, date, jsonb, jsonb, jsonb, text, integer)
  to authenticated, service_role;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text; v_ok boolean;
begin
  -- 몸통은 사람이 못 부른다.
  if has_function_privilege('authenticated',
       'public.apply_sale_items(uuid,date,uuid,jsonb,jsonb,jsonb,boolean)', 'execute') then
    raise exception '0145: 인증 사용자가 몸통을 직접 부를 수 있습니다';
  end if;

  -- save_sale 이 definer 여야 몸통을 부를 수 있다.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'save_sale' and p.prosecdef) then
    raise exception '0145: save_sale 이 definer 가 아닙니다 — 몸통을 못 부릅니다';
  end if;
  -- 그리고 첫 줄이 권한 확인이어야 한다. definer 는 RLS 를 지나간다.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'save_sale'
       and replace(pg_get_functiondef(p.oid), chr(13) || chr(10), chr(10))
           like '%begin' || chr(10) || '  perform assert_my_store(p_store);%')
  then
    raise exception '0145: save_sale 의 첫 줄이 권한 확인이 아닙니다';
  end if;

  -- save_sale 이 몸통을 부른다(두 벌로 갈리지 않았다).
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  if position('apply_sale_items(' in v_def) = 0 then
    raise exception '0145: save_sale 이 몸통을 안 부릅니다';
  end if;
  -- 옛 인라인 루프가 남아 있으면 두 벌이 된다.
  if exists (
    select 1 from regexp_split_to_table(v_def, chr(10)) as line
     where line like '%e10_sale_recorded(%' and btrim(line) not like '--%')
  then
    raise exception '0145: save_sale 에 옛 판매 루프가 남았습니다';
  end if;

  -- 정정 RPC 가 종료 상태를 안 건드리는가(코드 줄만 본다 — 주석 제외).
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'amend_ended_business_day';
  if exists (
    select 1 from regexp_split_to_table(v_def, chr(10)) as line
     where line ~ '^\s*(set|,)?\s*(status|closed_at|close_method)\s*='
       and btrim(line) not like '--%')
  then
    raise exception '0145: 정정 RPC 가 종료 상태를 고칩니다';
  end if;

  -- anon 은 못 부른다.
  if has_function_privilege('anon',
       'public.amend_ended_business_day(uuid,date,jsonb,jsonb,jsonb,text,integer)', 'execute') then
    raise exception '0145: anon 이 정정 RPC 를 부를 수 있습니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
