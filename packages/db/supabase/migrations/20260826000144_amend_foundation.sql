-- ════════════════════════════════════════════════════════════════
-- 0144 · 과거 정정의 바닥 — 기준 품질 · 판본 · 감사 · 결과 코드
--
-- 0139 에서 과거 날짜 판매를 막았고, 그 자리를 메울 정정 RPC 가 아직 없다.
-- 이 마이그레이션은 그 RPC 가 설 바닥만 놓는다(0145 가 함수를 만든다).
--
-- ── 결과 코드에 대하여 ─────────────────────────────────────────
-- 기획서 §3.3 은 "앱이 한국어 문자열을 검사하는 분기를 없앤다" 고 했다.
-- 그런데 코드베이스 주석에는 이렇게 적혀 있었다 —
--     "PostgREST 응답에 SQLSTATE 가 그대로 오지 않는 경우가 있어서다"
-- **실측했더니 틀렸다.** 로컬 스택에서 그대로 온다:
--     {"code":"45010","details":"SALE_DATE_OUT_OF_RANGE","hint":null,"message":"…"}
-- `errcode` → `code`, `detail` → `details`.
--
-- 그래서 통로를 새로 만들지 않는다. 지금 쓰는 `raise … using errcode` 에
-- **`detail` 로 안정된 이름**을 붙이면 그게 곧 결과 코드다.
-- 앱은 문구 대신 `code`(SQLSTATE)로 가른다.
--
--     45001  BEFORE_OPEN            아직 영업을 시작하지 않았다
--     45002  DAY_CLOSED             종료됐거나 자동 마감 기한이 지났다
--     45009  REVISION_CONFLICT      낡은 화면이 덮어쓰려 한다
--     45010  SALE_DATE_OUT_OF_RANGE 허용 기간(지난달 1일~오늘) 밖이다   ← 신설
-- ════════════════════════════════════════════════════════════════

-- ── ① 기준 품질 ─────────────────────────────────────────────────
do $m$
begin
  if not exists (select 1 from pg_type where typname = 'day_basis_quality') then
    create type public.day_basis_quality as enum ('exact', 'estimated_current');
  end if;
end $m$;

alter table public.business_days
  add column if not exists basis_quality public.day_basis_quality not null default 'exact',
  add column if not exists revision_no integer not null default 0;

/*
 * ⚠ 뜻을 좁게 적는다. `estimated_current` 는 **원가·손익 계산 기준만** 그날 값이
 *   아니라는 뜻이다. 매출과 판매 수량은 사장님이 적은 **실제 기록**이다.
 *   "이 날은 추정치" 처럼 넓게 읽히면 사장님이 자기가 적은 매출까지 의심하게 된다.
 */
comment on column public.business_days.basis_quality is
  '그날 원가·손익을 무엇으로 계산했는가. exact = 그날 스냅샷 / estimated_current = 당시 기록이 없어 저장 시점의 판매가·원가로 계산(0144). ⚠ 매출·판매 수량은 어느 쪽이든 사장님이 적은 실제 기록이다 — 이 값은 계산 기준만 가리킨다.';

comment on column public.business_days.revision_no is
  '이 영업일이 종료 뒤 정정된 횟수(0144). 0 이면 종료 이후 손대지 않았다.';


-- ── ② 감사 기록 ─────────────────────────────────────────────────
create table if not exists public.business_day_revisions (
  id              uuid primary key default gen_random_uuid(),
  business_day_id uuid not null references public.business_days(id) on delete cascade,
  revision_no     integer not null,
  reason          text,
  /*
   * 정정 **전후** 집계를 통째로 남긴다. 무엇이 얼마나 달라졌는지는 이 둘을 빼면 나온다 —
   * 항목별 차이를 따로 저장하면 그 계산이 두 곳이 되고, 둘이 어긋나는 날이 온다.
   */
  before_summary  jsonb not null,
  after_summary   jsonb not null,
  changed_by      uuid,
  changed_at      timestamptz not null default now(),
  constraint business_day_revisions_uniq unique (business_day_id, revision_no)
);

comment on table public.business_day_revisions is
  '종료된 영업일을 정정한 기록(0144). 기획서 §6.4 — 변경 전후 값과 사용자·시각을 남긴다. 장부를 다시 열지 않으므로 이것이 유일한 흔적이다.';

create index if not exists business_day_revisions_day_ix
  on public.business_day_revisions (business_day_id, revision_no desc);

alter table public.business_day_revisions enable row level security;

/*
 * 읽기만 연다. 쓰기는 정정 RPC 하나뿐이다(0145) — `operating_rules` 와 같은 짜임이다.
 * 감사 기록을 손으로 고칠 수 있으면 감사 기록이 아니다.
 */
drop policy if exists business_day_revisions_read on public.business_day_revisions;
create policy business_day_revisions_read on public.business_day_revisions
  for select to authenticated
  using (business_day_id in (
    select id from public.business_days where store_id in (select public.my_store_ids())));

revoke insert, update, delete, truncate on public.business_day_revisions from anon, authenticated;
grant select on public.business_day_revisions to authenticated;

-- 권한이 되살아나도 닫혀 있게(0133 과 같은 이유).
create or replace function public.business_day_revisions_rpc_only() returns trigger
language plpgsql as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception '정정 기록은 직접 고칠 수 없어요'
      using errcode = '42501', detail = 'AUDIT_WRITE_FORBIDDEN';
  end if;
  return coalesce(new, old);
end $fn$;

-- 이름이 `00_` 인 이유는 0133 과 같다 — 인가가 제일 먼저 돈다.
drop trigger if exists business_day_revisions_00_rpc_only on public.business_day_revisions;
create trigger business_day_revisions_00_rpc_only
  before insert or update or delete on public.business_day_revisions
  for each row execute function public.business_day_revisions_rpc_only();

drop trigger if exists business_day_revisions_00_no_truncate on public.business_day_revisions;
create trigger business_day_revisions_00_no_truncate
  before truncate on public.business_day_revisions
  for each statement execute function public.operating_rules_no_truncate();


-- ── ③ 허용 기간 ─────────────────────────────────────────────────
/**
 * 판매를 적을 수 있는 기간 — 매장 현지 날짜 기준 **지난달 1일 ~ 오늘**(기획서 §6.4).
 * 예: 2026-08-24 에는 2026-07-01 ~ 2026-08-24.
 *
 * ⚠ 전역 `business_day()` 를 안 쓴다. 그건 매장을 모른다 — 다매장·다시간대에서 틀린다.
 */
create or replace function public.sale_date_allowed(p_store uuid, p_date date)
returns boolean
language sql
stable
as $fn$
  -- ⚠ `date - interval` 은 timestamp 가 된다. `::date` 로 다시 좁히지 않으면
  --   비교가 timestamp 로 승격돼 경계 하루가 흔들린다.
  select p_date >= (date_trunc('month', store_local_date(p_store))::date - interval '1 month')::date
     and p_date <= store_local_date(p_store);
$fn$;

comment on function public.sale_date_allowed(uuid, date) is
  '그 날짜에 판매를 적을 수 있는가 — 매장 현지 날짜 기준 지난달 1일~오늘(0144, 기획서 §6.4).';


-- ── ④ 기존 거절에 안정된 이름을 붙인다 ──────────────────────────
/*
 * 문구는 사람이 읽는 것이고, `detail` 은 앱이 읽는 것이다. 지금까지 앱은 문구를 읽었다 —
 * 그래서 0140 에서 문구를 고칠 때 판별식도 같이 고쳐야 했다. 그런 짝을 없앤다.
 */
do $m$
declare
  r     record;
  v_def text;
  v_n   int := 0;
  -- 문구 조각 → 붙일 이름
  v_map jsonb := jsonb_build_object(
    '''45001''',                        'BEFORE_OPEN',
    '''45002''',                        'DAY_CLOSED',
    '''45009''',                        'REVISION_CONFLICT');
  v_code text;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and pg_get_functiondef(p.oid) ~ 'errcode = ''4500[129]'''
  loop
    v_def := pg_get_functiondef(r.oid);
    for v_code in select * from jsonb_object_keys(v_map) loop
      -- 이미 이름이 붙은 것은 건드리지 않는다.
      v_def := replace(v_def,
        'using errcode = ' || v_code || ';',
        'using errcode = ' || v_code || ', detail = ''' || (v_map->>v_code) || ''';');
    end loop;
    if v_def <> pg_get_functiondef(r.oid) then
      execute v_def;
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice '0144: 결과 코드 이름을 붙인 함수 %개', v_n;
end $m$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_store uuid;
  v_today date;
  v_ok boolean;
  v_original_role name := current_user;
begin
  select id into v_store from public.stores limit 1;
  if v_store is null then return; end if;
  v_today := public.store_local_date(v_store);

  -- 허용 기간이 §6.4 예시대로인가.
  if not public.sale_date_allowed(v_store, v_today) then
    raise exception '0144: 오늘이 허용 기간 밖입니다';
  end if;
  if not public.sale_date_allowed(v_store,
       (date_trunc('month', v_today)::date - interval '1 month')::date) then
    raise exception '0144: 지난달 1일이 허용 기간 밖입니다';
  end if;
  if public.sale_date_allowed(v_store,
       (date_trunc('month', v_today)::date - interval '1 month' - interval '1 day')::date) then
    raise exception '0144: 지난달 1일 하루 전이 허용 기간 안입니다';
  end if;
  if public.sale_date_allowed(v_store, v_today + 1) then
    raise exception '0144: 내일이 허용 기간 안입니다';
  end if;

  -- 감사 기록을 앱 롤이 직접 못 쓴다. 권한 값이 아니라 **실제로** 확인한다.
  v_ok := false;
  set local role authenticated;
  if current_user <> 'authenticated' then
    raise exception '0144: authenticated 역할로 전환하지 못했습니다';
  end if;
  begin
    insert into public.business_day_revisions
      (business_day_id, revision_no, before_summary, after_summary)
    values (gen_random_uuid(), 1, '{}'::jsonb, '{}'::jsonb);
  exception when insufficient_privilege then
    if position('business_day_revisions' in sqlerrm) = 0 then
      raise exception '0144: 인증 권한 거부가 감사 기록 표가 아닌 곳에서 났습니다: %', sqlerrm;
    end if;
    v_ok := true;
  end;
  execute format('set local role %I', v_original_role);
  if current_user <> v_original_role then
    raise exception '0144: 감사 기록 검사 뒤 원래 역할을 복원하지 못했습니다';
  end if;
  if not v_ok then raise exception '0144: 앱 롤이 감사 기록을 직접 씁니다'; end if;

  -- 결과 코드 이름이 붙었는가.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'save_sale'
       and pg_get_functiondef(p.oid) like '%detail = ''DAY_CLOSED''%')
  then
    raise exception '0144: save_sale 의 45002 에 이름이 안 붙었습니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
