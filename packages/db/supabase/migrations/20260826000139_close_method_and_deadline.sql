-- ════════════════════════════════════════════════════════════════
-- 0139 · 0138 의 나머지 넷
--
-- ① 사장님이 `자동 종료` 를 위조할 수 있었다
-- ② 수동 마감의 `closed_at` 도 잠금보다 **먼저** 정해졌다
-- ③ 판매 기한 검사의 `p_date = business_day()` 예외는 기획서와 **반대**였다
-- ④ 앱이 보는 자동 마감 예고(`auto_close_due`)가 아직 활동을 따라갔다
-- ════════════════════════════════════════════════════════════════

-- ── ①② 종료 시각은 몸통이 **잠근 뒤에** 정한다 ─────────────────
/*
 * 0138 은 wrapper 가 `now()` 를 인자로 넘겼다. 그런데 몸통은 그 뒤에 행 잠금을 기다린다 —
 * 판매 저장이 잠금을 쥐고 있으면 이렇게 된다:
 *
 *     수동 종료 요청  22:30:00   ← 이 시각이 인자로 굳는다
 *     판매 저장 완료  22:30:05
 *     closed_at 기록  22:30:00   ← 또 판매보다 종료가 먼저다
 *
 * 0138 이 자동 마감에서 고친 것과 **같은 모양의 실수**가 수동 쪽에 남아 있었다.
 * 인자를 아예 없앤다. 종료 시각은 몸통이 잠근 뒤에 정한다 —
 *     manual → `clock_timestamp()`  (잠금을 얻은 바로 그때)
 *     auto   → `planned_close_at + auto_close_grace()`  (기한, 고정)
 *
 * ⚠ `now()` 가 아니라 `clock_timestamp()` 다. `now()` 는 트랜잭션 시작 시각이라
 *   잠금을 오래 기다렸을수록 더 이른 값이 된다 — 고치려는 그 현상 그대로다.
 */
drop function if exists public.close_business_day_row(uuid, business_close_method, timestamptz);

create or replace function public.close_business_day_row(
  p_day_id uuid,
  p_method business_close_method
) returns jsonb
language plpgsql
as $fn$
declare
  v_day business_days;
  v_sum jsonb;
  v_at  timestamptz;
begin
  -- ⚠ 집계하기 **전에** 잠근다(0118). save_sale 과 같은 행·같은 순서다.
  select * into v_day from business_days where id = p_day_id for update;
  if v_day.id is null then
    raise exception '영업일을 찾을 수 없어요' using errcode = '22000';
  end if;
  if v_day.status::text = 'closed' then
    raise exception '이미 종료된 영업일이에요' using errcode = '45002';
  end if;

  -- 잠금을 얻은 **뒤에** 시각을 정한다(0139).
  v_at := case
            when p_method = 'auto' then v_day.planned_close_at + auto_close_grace()
            else clock_timestamp()
          end;

  v_sum := sales_summary(v_day.store_id, v_day.business_date, v_day.business_date);

  update business_days
     set status       = 'closed',
         closed_at    = v_at,
         close_method = p_method,
         snapshot     = snapshot || jsonb_build_object('closing', v_sum)
   where id = v_day.id;

  return jsonb_build_object(
    'business_day_id', v_day.id, 'business_date', v_day.business_date,
    'closed_at', v_at, 'close_method', p_method,
    'planned_close_at', v_day.planned_close_at,
    'last_activity_at', v_day.last_activity_at,
    'summary', v_sum);
end $fn$;

comment on function public.close_business_day_row(uuid, business_close_method) is
  '영업일 한 줄을 닫는 몸통(0137·0139). 종료 시각은 **잠근 뒤에** 정한다 — manual 은 그때, auto 는 기한. 권한 확인은 부르는 쪽 몫이다.';

revoke execute on function public.close_business_day_row(uuid, business_close_method)
  from public, anon, authenticated, service_role;


-- ── ① 공개 문은 방식을 안 받는다 ────────────────────────────────
/*
 * `close_business_day(p_store, p_method)` 가 인증 사용자에게 열려 있어서
 * `close_business_day(내 매장, 'auto')` 로 **자동 종료를 위조**할 수 있었다.
 * 화면은 그 값으로 `자동 영업종료` 뱃지를 그리고, 종료 시각도 기한으로 적힌다.
 *
 * 공개 문은 인자를 안 받는다. 사람이 누르면 언제나 `manual` 이다.
 * `auto` 는 크론만 고른다.
 */
drop function if exists public.close_business_day(uuid, business_close_method);

create or replace function public.close_business_day(p_store uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare v_day business_days;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄
  v_day := current_business_day(p_store);
  if v_day.id is null then
    raise exception '영업 중이 아니에요' using errcode = '22000';
  end if;
  -- 사람이 닫으면 언제나 manual 이다. 방식은 **고를 수 없다**(0139).
  return close_business_day_row(v_day.id, 'manual');
end $fn$;

comment on function public.close_business_day(uuid) is
  '사장님이 직접 영업을 종료한다(0139). 방식은 늘 manual — auto 는 크론만 고른다.';

revoke execute on function public.close_business_day(uuid) from public, anon;
grant execute on function public.close_business_day(uuid) to authenticated, service_role;

/*
 * `close_if_due` 는 앱이 부르던 과도기 경로다. 앱에서 지웠고(0137) 크론이 대신한다.
 * 남겨 두면 **두 번째 마감 경로**가 되고, 그쪽은 활동을 따라가는 옛 규칙을 쓴다.
 */
drop function if exists public.close_if_due(uuid);


-- 스윕도 새 시그니처로.
create or replace function public.close_due_business_days()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r         record;
  v_closed  int := 0;
  v_skipped int := 0;
  v_failed  int := 0;
  v_days    jsonb := '[]'::jsonb;
  v_res     jsonb;
begin
  for r in
    select d.id, d.store_id, d.business_date, d.planned_close_at
      from business_days d
     where d.status::text <> 'closed'
       and d.planned_close_at is not null
       -- ⚠ 활동을 안 본다. 넣는 순간 §2.5 의 밀림이 돌아온다.
       and clock_timestamp() >= d.planned_close_at + auto_close_grace()
     order by d.planned_close_at
  loop
    begin
      perform lock_business_scope(r.store_id);   -- 0132 와 같은 줄
      v_res := close_business_day_row(r.id, 'auto');
      v_closed := v_closed + 1;
      v_days := v_days || jsonb_build_object(
        'store_id', r.store_id, 'business_date', r.business_date,
        'closed_at', v_res->>'closed_at');
    exception
      when sqlstate '45002' then
        -- 그사이 사장님이 직접 닫았다. 경합의 정상 결말이지 실패가 아니다.
        v_skipped := v_skipped + 1;
      when others then
        v_failed := v_failed + 1;
        raise warning '자동 마감 실패 store=% date=%: % (%)',
          r.store_id, r.business_date, sqlerrm, sqlstate;
    end;
  end loop;

  return jsonb_build_object(
    'closed', v_closed, 'skipped', v_skipped, 'failed', v_failed, 'days', v_days);
end $fn$;

revoke execute on function public.close_due_business_days() from public, anon, authenticated;
grant execute on function public.close_due_business_days() to service_role;


-- ── ④ 앱이 보는 예고도 같은 기한을 쓴다 ─────────────────────────
/*
 * `business_day_state` 가 `auto_close_due` 를 불러 `auto_close_at`·`warn_soon`·`due` 를
 * 화면에 준다. 그런데 그건 아직 `마지막 활동 + 1시간` 이었다.
 * 서버 스윕은 `예정 종료 + 유예` 로 닫는데 화면은 다른 시각을 예고하는 셈이다 —
 * 판매를 넣을수록 화면의 예고만 뒤로 밀리고, 실제로는 예고보다 먼저 닫힌다.
 */
create or replace function public.auto_close_due(p_store uuid)
returns jsonb
language plpgsql
stable
as $fn$
declare
  v_day business_days;
  v_due timestamptz;
begin
  v_day := current_business_day(p_store);
  if v_day.id is null then
    return jsonb_build_object('open', false);
  end if;

  -- ⚠ 활동을 안 본다(0139). 스윕과 **같은 식**이어야 화면이 거짓 예고를 안 한다.
  v_due := v_day.planned_close_at + auto_close_grace();

  return jsonb_build_object(
    'open', true,
    'business_day_id', v_day.id,
    'business_date', v_day.business_date,
    'status', v_day.status,
    'planned_close_at', v_day.planned_close_at,
    'last_activity_at', v_day.last_activity_at,
    'auto_close_at', v_due,
    -- 예정 종료를 지났다 → "영업을 종료할까요?"
    'past_planned', clock_timestamp() >= v_day.planned_close_at,
    -- 자동 종료 10분 전 → "10분 후 자동 종료돼요"
    'warn_soon', clock_timestamp() >= v_due - interval '10 minutes' and clock_timestamp() < v_due,
    'due', clock_timestamp() >= v_due);
end $fn$;

comment on function public.auto_close_due(uuid) is
  '자동 마감 예고(0139). 스윕과 같은 기한(예정 종료 + 유예)을 쓴다 — 화면이 다른 시각을 예고하면 안 된다.';


-- ── ③ 판매 기한 검사에서 예외를 없앤다 ──────────────────────────
/*
 * 0138 은 `p_date = business_day()` 일 때만 기한을 봤다. 과거 장부를 다시 열어 고치는
 * 흐름을 살리려던 것인데, **기획서 §6.4 는 정확히 반대**다 —
 *     "종료된 장부를 다시 열지 않는다. 정정 RPC 로 수정한다."
 * 게다가 `business_day()` 는 매장을 모르는 전역 함수라 다매장·다시간대에서 틀린다.
 * 그 전역 의존을 없애는 것도 재설계의 목표다.
 *
 * 그래서 예외를 걷어내고 **잠근 그 영업일의 기한**만 본다.
 *
 * ⚠ 그러면 과거 판매를 넣을 길이 없어진다. 그건 `amend_ended_business_day()` 가
 *   할 일이고 아직 없다 — **다음 작업이다.** 지금 앱에는 과거 매출 입력 화면이
 *   없으므로 당장 막히는 흐름은 없다.
 *
 * ⚠ 시드·마이그레이션은 소유자로 돈다. 이 규칙은 **앱 롤에만** 건다 —
 *   픽스처가 사용자 RPC 로 우회하는 게 아니라, 소유자 경로는 애초에 대상이 아니다.
 */
do $m$
declare
  v_def text;
  v_i   int;
  v_j   int;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  if v_def is null then raise exception '0139: save_sale 이 없습니다'; end if;

  -- 설명문에 같은 말이 있어도 적용 완료로 오인하지 않는다. 실제로 넣는 코드 줄만 본다.
  if position('if current_user in (''authenticated'', ''anon'')' in v_def) > 0 then
    return;
  end if;

  v_i := position('    -- ⚠ 자동 마감 기한이 지났으면' in v_def);
  if v_i = 0 then raise exception '0139: 0138 이 넣은 기한 검사를 못 찾았습니다'; end if;
  -- 그 블록의 끝. 바로 뒤에 원래 `if v_status = ''closed''` 가 온다.
  v_j := position('    if v_status = ''closed'' then' in v_def);
  if v_j = 0 or v_j < v_i then raise exception '0139: 원래 마감 검사를 못 찾았습니다'; end if;

  v_new := concat_ws(chr(10),
    '    -- ⚠ 자동 마감 기한이 지났으면 아직 열려 있어도 안 받는다(0139, 기획서 §2.4).',
    '    --   `clock_timestamp()` 다 — `now()` 는 트랜잭션 시작 시각에 고정돼,',
    '    --   잠금을 기다리는 동안 기한이 지나도 안 지난 것으로 보인다.',
    '    --',
    '    -- ⚠ 날짜 예외를 두지 않는다. 0138 은 `p_date = business_day()` 일 때만 봤는데',
    '    --   그건 §6.4("종료된 장부를 다시 열지 않는다")와 반대였고, `business_day()` 는',
    '    --   매장을 모르는 전역 함수라 다매장에서 틀린다.',
    '    --   과거 판매는 정정 RPC 가 할 일이다.',
    '    --',
    '    -- ⚠ 규칙은 **앱 롤에만** 건다. 시드·마이그레이션은 소유자로 돌고 대상이 아니다.',
    '    if current_user in (''authenticated'', ''anon'')',
    '       and v_status <> ''closed''',
    '       and v_bday.planned_close_at is not null',
    '       and clock_timestamp() >= v_bday.planned_close_at + auto_close_grace() then',
    '      raise exception ''% 영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요'', p_date',
    '        using errcode = ''45002'';',
    '    end if;',
    '');

  execute left(v_def, v_i - 1) || v_new || substr(v_def, v_j);
end $m$;


-- ── 크론 시각 설명 정정 ─────────────────────────────────────────
do $c$
declare v_db text := current_setting('cron.database_name', true);
begin
  if v_db is null or v_db <> current_database() then return; end if;
  /*
   * ⚠ `cron.timezone` 은 `GMT` 다. `17 4 * * *` 은 **04:17 UTC**(한국 13:17)이지
   *   "새벽 4시" 가 아니었다. 그리고 전 세계 매장을 받는 앱에 공통 한산 시간은 없다.
   *   시각은 UTC 로 못 박고, 부담은 `entity_change_events(occurred_at)` 인덱스로 다룬다.
   */
  perform cron.schedule('sikjae-purge-changes', '17 4 * * *',
                        'select public.purge_entity_changes()');
exception when others then
  raise warning '0139: 크론 갱신 실패 — % (%)', sqlerrm, sqlstate;
end $c$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_ok boolean;
  v_def text;
  v_original_role name := current_user;
begin
  -- ① 방식을 고를 수 있는 공개 문이 남아 있으면 안 된다.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'close_business_day'
                and pg_get_function_identity_arguments(p.oid) <> 'p_store uuid') then
    raise exception '0139: 방식을 받는 close_business_day 가 남았습니다';
  end if;

  v_ok := false;
  set local role authenticated;
  if current_user <> 'authenticated' then
    raise exception '0139: authenticated 역할로 전환하지 못했습니다';
  end if;
  begin
    perform public.close_business_day_row(gen_random_uuid(), 'auto');
  exception when insufficient_privilege then
    if position('close_business_day_row' in sqlerrm) = 0 then
      raise exception '0139: 인증 권한 거부가 마감 몸통이 아닌 곳에서 났습니다: %', sqlerrm;
    end if;
    v_ok := true;
  end;
  execute format('set local role %I', v_original_role);
  if current_user <> v_original_role then
    raise exception '0139: 마감 몸통 검사 뒤 원래 역할을 복원하지 못했습니다';
  end if;
  if not v_ok then raise exception '0139: 인증 사용자가 몸통을 직접 부릅니다'; end if;

  -- ② 몸통이 시각 인자를 안 받는다.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'close_business_day_row'
                and pg_get_function_identity_arguments(p.oid) like '%timestamp%') then
    raise exception '0139: 몸통이 아직 종료 시각을 인자로 받습니다';
  end if;

  /*
   * ③ 판매 기한 검사에 전역 business_day() 예외가 없다.
   * ⚠ **주석 줄은 뺀다.** 위 주석에 `p_date = business_day()` 라는 글자가 그대로 들어
   *   있어서, 통째로 훑으면 검증식이 자기 설명에 걸린다 — 이 저장소에서 다섯 번째다.
   *   설명을 잘 적을수록 더 잘 걸린다. 코드를 보고 싶으면 코드만 봐야 한다.
   */
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'
') as line
     where n.nspname = 'public' and p.proname = 'save_sale'
       and line like '%p_date = business_day()%'
       and btrim(line) not like '--%')
  then
    raise exception '0139: 판매 기한 검사에 전역 business_day() 예외가 남았습니다';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'
') as line
     where n.nspname = 'public' and p.proname = 'save_sale'
       and line like '%clock_timestamp() >= v_bday.planned_close_at%'
       and btrim(line) not like '--%')
  then
    raise exception '0139: 판매 기한 검사가 사라졌습니다';
  end if;

  -- ④ 예고가 활동을 안 본다.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'auto_close_due';
  if position('greatest(' in v_def) > 0 then
    raise exception '0139: 예고가 아직 마지막 활동을 섞습니다';
  end if;

  -- 두 번째 마감 경로가 없다.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'close_if_due') then
    raise exception '0139: close_if_due 가 남았습니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
