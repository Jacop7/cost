-- ════════════════════════════════════════════════════════════════
-- 0121 · 영업시간 재설계 1단계 — 날짜를 가른다
--
-- 지금은 날짜가 하나뿐이다. `business_day()` 가 발주·입고·재고·추이·판매를
-- 전부 담당하는데, 그 정의가 이렇다 —
--
--     business_cutoff() = case when s.close_time < s.open_time
--                              then s.close_time - '00:00'::time else '0' end   ← **지금 설정**
--     business_day(at)  = ((at at time zone business_tz()) - business_cutoff())::date
--     business_tz()     = 'Asia/Seoul'                                          ← 하드코딩
--
-- 문제가 셋이다(기획서 §2.2 · §2.3).
--   ① 영업시간을 고치면 **과거 날짜 해석이 바뀐다.** cutoff 가 지금 설정을 읽으므로,
--      새벽 2시 마감으로 바꾸는 순간 지난달 01:00 입고가 전날 입고로 재해석된다.
--      이미 원장에 박힌 날짜와 갈린다.
--   ② 매장 인자가 없다. 매장이 둘이 되면 남의 시간대로 내 날짜를 잰다.
--   ③ 시간대가 코드에 박혀 있다.
--
-- 기획서 §4.1 —
--     store_local_date = 매장 IANA 시간대의 **달력 날짜**. 영업 종료 시각과 **무관**하다.
--     "서울 매장 01:00 입고는 현지 달력의 오늘 입고다."
--
-- 그래서 일반 기록(발주·입고·재고·가격추이·손익추이·수정내역)을 여기로 옮긴다.
--
-- ⚠ **판매·영업일 무리는 건드리지 않는다.** 거기는 cutoff 가 의미가 있다
--   (새벽 영업이면 전날 장부다). 3단계에서 `sync_business_context` 로 통째로 간다.
--   지금 옮기면 새벽 판매가 다음 날 장부로 새 버린다.
--     남겨 두는 것: business_day_state · day_menu_basis · e10_sale_recorded ·
--                   open_business_day · save_sale
--
-- ⚠ 오늘은 **값이 안 바뀐다.** 영업시간이 11:00–22:00 이라 cutoff 가 0 이고 매장도 하나다.
--   실측: cutoff = 00:00:00 · business_day() = 2026-08-25 · 현지 달력 = 2026-08-25
--   그래서 이 단계는 회귀 확인이 쉽다 — 무엇도 달라지면 안 된다.
--   달라지는 건 **나중에 영업시간을 자정 너머로 바꿨을 때**이고, 그때 안 깨지는 게 목적이다.
-- ════════════════════════════════════════════════════════════════

-- ── 매장 시간대 ───────────────────────────────────────────────
create table if not exists store_time_settings (
  store_id   uuid primary key references stores(id) on delete cascade,
  timezone   text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table store_time_settings is
  '매장별 시간대(0121). `business_tz()` 의 하드코딩 ''Asia/Seoul'' 을 대신한다. '
  '영업시간과는 별개다 — 시간대는 달력 날짜를 정하고, 영업시간은 장부 한 장을 정한다.';
comment on column store_time_settings.timezone is
  'IANA 시간대 문자열. ⚠ ''+09:00'' 같은 고정 오프셋을 넣지 않는다 — 서머타임이 있는 나라에서 어긋난다.';

-- 이미 있는 매장을 채운다.
insert into store_time_settings (store_id, timezone)
select s.id, 'Asia/Seoul' from stores s
on conflict (store_id) do nothing;

/*
 * ⚠ 백필만으로는 부족하다. 마이그레이션은 **시드보다 먼저** 돈다 — 새로 깐 DB 에서는
 *   여기서 `stores` 가 비어 있고, 그 뒤에 시드가 만든 매장은 시간대 행을 영영 못 받는다.
 *   (`store_timezone` 이 서울로 떨어져 동작은 하지만, 영업시간 설정 화면이 고칠 행이 없다.)
 *   실측: 새 DB 에 깔았더니 store_time_settings 가 비어 있었다.
 *   매장이 생기는 순간 같이 만든다.
 */
create or replace function public.stores_default_time_settings()
returns trigger language plpgsql as $fn$
begin
  insert into public.store_time_settings (store_id, timezone)
  values (new.id, 'Asia/Seoul')
  on conflict (store_id) do nothing;
  return new;
end $fn$;

drop trigger if exists stores_default_time_settings_trg on stores;
create trigger stores_default_time_settings_trg
  after insert on stores
  for each row execute function public.stores_default_time_settings();

alter table store_time_settings enable row level security;

drop policy if exists store_time_settings_rw on store_time_settings;
create policy store_time_settings_rw on store_time_settings
  for all using (store_id in (select my_store_ids())) with check (store_id in (select my_store_ids()));

grant select, insert, update on store_time_settings to authenticated;


-- ── 매장의 시간대 ─────────────────────────────────────────────
create or replace function public.store_timezone(p_store uuid)
returns text language sql stable as $fn$
  -- ⚠ 없으면 서울로 떨어진다. 매장이 아직 시간대를 안 정했다고 날짜 계산이 멈추면 안 된다.
  select coalesce((select timezone from public.store_time_settings where store_id = p_store),
                  'Asia/Seoul');
$fn$;

comment on function public.store_timezone(uuid) is
  '매장 시간대(0121). 등록이 없으면 ''Asia/Seoul''.';


-- ── 매장 현지 날짜 ────────────────────────────────────────────
create or replace function public.store_local_date(p_store uuid, p_at timestamptz default now())
returns date language sql stable as $fn$
  -- ⚠ **cutoff 를 빼지 않는다.** 그게 business_day() 와의 차이 전부다.
  --   영업 종료 시각이 몇 시든 달력 날짜는 달력 날짜다(기획서 §4.1).
  select (p_at at time zone public.store_timezone(p_store))::date;
$fn$;

comment on function public.store_local_date(uuid, timestamptz) is
  '매장 현지 달력 날짜(0121). 발주·입고·재고·가격추이·손익추이·수정내역이 쓴다. '
  '⚠ 영업 종료 시각과 **무관**하다 — 영업시간을 고쳐도 과거 날짜 해석이 안 바뀐다. '
  '판매 장부의 날짜는 이게 아니다. 그건 sales_business_day 이고 서버가 정한다.';


-- ── 일반 기록 무리를 옮긴다 ───────────────────────────────────
-- 함수마다 매장을 알아내는 길이 다르다. **null 로 얼버무리지 않는다** —
-- 매장이 둘이 되는 날 그게 그대로 버그가 된다.
do $mig$
declare
  r        record;
  v_def    text;
  v_new    text;
  v_n      int := 0;
begin
  for r in
    select * from (values
      ('e1_confirm_inbound',    '(select store_id from order_records where id = p_order)'),
      ('e2_discard',            '(select store_id from ingredients where id = p_ingredient)'),
      ('e2_discard_reverted',   '(select store_id from inventory_events where id = p_event)'),
      ('e5_stock_adjusted',     '(select store_id from ingredients where id = p_ingredient)'),
      ('e7_place_order',        'p_store'),
      ('e11_inbound_reverted',  '(select store_id from order_records where id = p_order)'),
      ('quick_inbound',         'p_store'),
      ('e4_fixed_cost_saved',   'p_store'),
      ('recipe_detail',         '(select store_id from recipes where id = p_recipe)'),
      ('recompute_recipe',      '(select store_id from recipes where id = p_recipe)'),
      ('retire_channel',        '(select store_id from sales_channels where id = p_id)'),
      ('save_store_tax',        'p_store'),
      ('fixed_cost_revenue_check', 'p_store')
    ) as t(fn, store_expr)
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;

    if v_def is null then
      raise exception '0121: % 가 없습니다', r.fn using errcode = '45003';
    end if;
    if position('store_local_date' in v_def) > 0 then continue; end if;
    if position('business_day()' in v_def) = 0 then
      raise exception '0121: % 안에 business_day() 가 없습니다 — 목록이 낡았습니다', r.fn
        using errcode = '45003';
    end if;

    -- 한 함수 안에 여러 번 나온다(기본값 · 미래 날짜 가드 · 오류 문구). 전부 바꾼다.
    v_new := replace(v_def, 'business_day()', 'store_local_date(' || r.store_expr || ')');
    execute v_new;
    v_n := v_n + 1;
  end loop;

  raise notice '0121: 일반 기록 함수 %개를 store_local_date 로 옮겼습니다', v_n;
end
$mig$;


-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare
  r      record;
  v_def  text;
  v_bad  text := '';
begin
  -- ① 옮긴 함수에 business_day() 가 남아 있으면 안 된다.
  for r in
    select unnest(array['e1_confirm_inbound','e2_discard','e2_discard_reverted','e5_stock_adjusted',
                        'e7_place_order','e11_inbound_reverted','quick_inbound','e4_fixed_cost_saved',
                        'recipe_detail','recompute_recipe','retire_channel','save_store_tax',
                        'fixed_cost_revenue_check']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    if position('business_day()' in v_def) > 0 then v_bad := v_bad || ' ' || r.fn; end if;
    if position('store_local_date' in v_def) = 0 then v_bad := v_bad || ' !' || r.fn; end if;
  end loop;
  if v_bad <> '' then
    raise exception '0121: 안 옮겨진 함수가 있습니다 —%', v_bad using errcode = '45003';
  end if;

  -- ② 판매·영업일 무리는 **그대로 있어야** 한다. 여기를 건드리면 새벽 판매가 샌다.
  for r in
    select unnest(array['business_day_state','day_menu_basis','e10_sale_recorded',
                        'open_business_day','save_sale']) as fn
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = r.fn;
    if position('business_day()' in v_def) = 0 then
      raise exception '0121: 판매 무리의 % 를 건드렸습니다 — 3단계 몫입니다', r.fn
        using errcode = '45003';
    end if;
  end loop;

  /*
   * ⚠ 여기에 "오늘 두 날짜가 같다"는 검사를 넣었다가 **뺐다.**
   *
   *   18:00–02:00 매장에 새벽 1시에 배포하면 정상적으로
   *       현지 날짜 = 오늘 · 판매 영업일 = 어제
   *   가 된다. 그게 맞는 동작인데 마이그레이션이 그걸 보고 터진다.
   *   **배포 시각에 따라 실패하는 검증은 검증이 아니다.**
   *
   *   값이 안 바뀌는지는 테스트 23 이 **고정된 시각**으로 확인한다. 거기가 맞는 자리다.
   */
end
$chk$;

select public.assert_no_rpc_overloads();
