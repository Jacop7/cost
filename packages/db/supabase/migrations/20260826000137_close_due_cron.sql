-- ════════════════════════════════════════════════════════════════
-- 0137 · 자동 마감을 **서버가** 한다 (기획서 §2.4 · §2.5)
--
-- 지금까지 자동 마감은 앱이 상태를 조회할 때 딸려 돌았다(`close_if_due`). 그래서 —
--   · 앱을 안 열면 마감이 안 된다(§2.4). 8/22 장부에 `8/23 08:25` 가 찍혀 있었다.
--   · 마감 시각이 `max(예정 종료, 마지막 활동 + 1시간)` 이라 판매를 계속 넣으면
--     **끝없이 밀린다**(§2.5). 브레이크 버튼도 활동으로 쳐서 마감을 미뤘다.
--
-- 두 가지를 바꾼다.
--   ① 스윕을 서버가 돈다 — pg_cron 1분 간격.
--   ② 마감 기한이 **활동을 안 따라간다.** `예정 종료 + 고정 유예`다.
--
-- ── 두 가지 시각을 구분한다 ─────────────────────────────────────
--   **언제 닫을지** : `예정 종료 + auto_close_grace()`(1시간, 고정)
--       0시 정각에 칼같이 닫으면 마무리 중인 가게의 판매가 막힌다. 유예는 두되
--       **활동을 따라가지 않는다** — 그게 §2.5 가 지적한 밀림이다.
--   **무엇으로 적을지** : `예정 종료` 그 자체
--       기획서 §6.1 이 `자동 종료 11:00–22:00` 으로 보여 주라고 못 박았다.
--       실행 시각(`now()`)을 적으면 22:30 이나 다음 날 08:25 가 찍힌다.
--
-- ⚠ 그 결과 22:00~23:00 사이 판매는 받아들여지고 그날 장부에 남는데 `closed_at` 은
--   22:00 이다. 어색해 보이지만 화면 규격이 그걸 원한다 — 사장님에게 `22:00 에 닫혔다`
--   가 `23:04 에 닫혔다` 보다 뜻이 분명하다(예정대로 끝났다는 말이다).
--
-- ── 마감 본체를 한 곳으로 ───────────────────────────────────────
-- 수동 마감과 자동 마감이 **같은 몸통**을 쓴다. 두 벌로 두면 스냅샷·집계가 갈리고,
-- 그건 "직접 닫은 날과 자동으로 닫힌 날의 손익이 다르다"는 뜻이 된다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 마감 본체 ─────────────────────────────────────────────────
/**
 * 영업일 한 줄을 닫는다. **권한 확인을 안 한다** — 부르는 쪽이 책임진다.
 *   `close_business_day`      : 사장님이 직접. assert_my_store 를 먼저 한다.
 *   `close_due_business_days` : 스윕. definer 로 돌고 사람 없이 돈다.
 */
create or replace function public.close_business_day_row(
  p_day_id   uuid,
  p_method   business_close_method,
  p_closed_at timestamptz
) returns jsonb
language plpgsql
as $fn$
declare
  v_day business_days;
  v_sum jsonb;
begin
  -- ⚠ 집계하기 **전에** 잠근다(0118). save_sale 과 같은 행·같은 순서다.
  --   안 잠그면 집계와 상태 변경 사이에 들어온 판매가 마감 손익에서 샌다.
  select * into v_day from business_days where id = p_day_id for update;
  if v_day.id is null then
    raise exception '영업일을 찾을 수 없어요' using errcode = '22000';
  end if;

  -- 잠금을 기다리는 동안 남이 닫았을 수 있다. 잠근 뒤에 다시 읽는다.
  if v_day.status::text = 'closed' then
    raise exception '이미 종료된 영업일이에요' using errcode = '45002';
  end if;

  v_sum := sales_summary(v_day.store_id, v_day.business_date, v_day.business_date);

  update business_days
     set status       = 'closed',
         closed_at    = p_closed_at,
         close_method = p_method,
         snapshot     = snapshot || jsonb_build_object('closing', v_sum)
   where id = v_day.id;

  return jsonb_build_object(
    'business_day_id', v_day.id, 'business_date', v_day.business_date,
    'closed_at', p_closed_at, 'close_method', p_method,
    'planned_close_at', v_day.planned_close_at,
    'last_activity_at', v_day.last_activity_at,
    'summary', v_sum);
end $fn$;

comment on function public.close_business_day_row(uuid, business_close_method, timestamptz) is
  '영업일 한 줄을 닫는 몸통(0137). 수동·자동 마감이 같이 쓴다 — 두 벌이면 스냅샷이 갈린다. 권한 확인은 부르는 쪽 몫이다.';

revoke execute on function public.close_business_day_row(uuid, business_close_method, timestamptz) from public, anon;


-- ── ② 수동 마감은 몸통을 부른다 ─────────────────────────────────
create or replace function public.close_business_day(
  p_store uuid,
  p_method business_close_method default 'manual'
) returns jsonb
language plpgsql
as $fn$
declare v_day business_days;
begin
  perform assert_my_store(p_store);
  v_day := current_business_day(p_store);
  if v_day.id is null then
    raise exception '영업 중이 아니에요' using errcode = '22000';
  end if;
  -- 직접 닫을 때는 **지금**이 종료 시각이다. 사장님이 실제로 그때 닫았다.
  return close_business_day_row(v_day.id, p_method, now());
end $fn$;


-- ── ③ 스윕 ──────────────────────────────────────────────────────
/**
 * 기한이 지난 영업일을 전부 닫는다. 사람 없이 도는 유일한 경로다.
 *
 * ⚠ `security definer` 다 — 크론은 로그인한 사람이 아니라 `auth.uid()` 가 없다.
 *   그래서 **아무도 이 함수를 직접 못 부르게** 해야 한다(아래 revoke).
 *   매장을 안 가리는 definer 는 지금까지 사고가 났던 모양 그대로다(0135).
 *
 * ⚠ 한 매장이 실패해도 나머지는 닫아야 한다. 그래서 매장마다 따로 감싼다 —
 *   대신 **삼키지 않는다.** 실패는 로그에 남기고 결과에도 센다.
 */
create or replace function public.close_due_business_days()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r        record;
  v_closed int := 0;
  v_failed int := 0;
  v_purged int := 0;
  v_days   jsonb := '[]'::jsonb;
begin
  for r in
    select d.id, d.store_id, d.business_date, d.planned_close_at
      from business_days d
     where d.status::text <> 'closed'
       and d.planned_close_at is not null
       -- ⚠ 활동을 안 본다. `last_activity_at` 을 넣는 순간 §2.5 의 밀림이 돌아온다.
       and now() >= d.planned_close_at + auto_close_grace()
     order by d.planned_close_at
  loop
    begin
      -- 영업 시작·영업시간 변경과 같은 줄에 선다(0132).
      perform lock_business_scope(r.store_id);
      -- 종료 시각은 **예정 종료**다. 실행 시각이 아니다(기획서 §6.1).
      perform close_business_day_row(r.id, 'auto', r.planned_close_at);
      v_closed := v_closed + 1;
      v_days := v_days || jsonb_build_object(
        'store_id', r.store_id, 'business_date', r.business_date,
        'closed_at', r.planned_close_at);
    exception when others then
      v_failed := v_failed + 1;
      raise warning '자동 마감 실패 store=% date=%: % (%)',
        r.store_id, r.business_date, sqlerrm, sqlstate;
    end;
  end loop;

  /*
   * 보관 기간 청소도 여기서 돈다(0136 이 남긴 숙제).
   * 영업 시작에만 매달려 있으면 **한동안 문을 안 연 매장은 영영 안 지워진다.**
   */
  begin
    v_purged := purge_entity_changes();
  exception when others then
    raise warning '수정 내역 청소 실패: % (%)', sqlerrm, sqlstate;
  end;

  return jsonb_build_object(
    'closed', v_closed, 'failed', v_failed, 'purged', v_purged, 'days', v_days);
end $fn$;

comment on function public.close_due_business_days() is
  '기한이 지난 영업일을 모두 닫는 스윕(0137). pg_cron 이 1분마다 부른다. 종료 시각은 예정 종료로 적는다 — 실행 시각이 아니다.';

-- ⚠ 사람은 못 부른다. 매장을 안 가리는 definer 라 인증 사용자에게도 열면 안 된다.
revoke execute on function public.close_due_business_days() from public, anon, authenticated;
grant execute on function public.close_due_business_days() to service_role;


-- ── ④ 크론 ──────────────────────────────────────────────────────
/*
 * ⚠ 조건부다. pg_cron 은 `cron.database_name` 이 가리키는 DB 에서만 돈다.
 *   일회용 새 DB(`fresh_*`)에서는 걸지 않는다 — 걸어 봐야 안 돌고, `create extension`
 *   이 실패하면 마이그레이션 전체가 멈춰 새 DB 검증이 통째로 막힌다.
 */
do $c$
declare v_db text := current_setting('cron.database_name', true);
begin
  if v_db is null or v_db <> current_database() then
    raise notice '0137: 이 DB(%)는 크론 대상이 아니라 스케줄을 걸지 않습니다', current_database();
    return;
  end if;
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '0137: pg_cron 이 없어 스케줄을 걸지 않습니다';
    return;
  end if;

  create extension if not exists pg_cron;

  -- 같은 이름으로 다시 걸면 갈아 끼워진다(pg_cron 1.4+).
  perform cron.schedule('sikjae-close-due', '* * * * *',
                        'select public.close_due_business_days()');
  raise notice '0137: 크론 등록 — sikjae-close-due (1분마다)';
exception when others then
  -- 크론을 못 걸어도 마이그레이션은 통과시킨다. 스윕 함수 자체는 이미 만들어졌고,
  -- 그게 없으면 아무것도 못 하지만 크론은 환경 문제라 여기서 막을 일이 아니다.
  raise warning '0137: 크론 등록 실패 — % (%). 스윕 함수는 만들어졌습니다.', sqlerrm, sqlstate;
end $c$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_ok boolean;
  v_original_role name := current_user;
begin
  -- 스윕은 사람이 못 부른다.
  if has_function_privilege('authenticated', 'public.close_due_business_days()', 'execute') then
    raise exception '0137: 인증 사용자가 스윕을 부를 수 있습니다';
  end if;
  if has_function_privilege('anon', 'public.close_due_business_days()', 'execute') then
    raise exception '0137: anon 이 스윕을 부를 수 있습니다';
  end if;

  -- 실제로 내려가서도 막히는지.
  v_ok := false;
  set local role authenticated;
  if current_user <> 'authenticated' then
    raise exception '0137: authenticated 역할로 전환하지 못했습니다';
  end if;
  begin
    perform public.close_due_business_days();
  exception when insufficient_privilege then
    if position('close_due_business_days' in sqlerrm) = 0 then
      raise exception '0137: 인증 권한 거부가 스윕 함수가 아닌 곳에서 났습니다: %', sqlerrm;
    end if;
    v_ok := true;
  end;
  execute format('set local role %I', v_original_role);
  if current_user <> v_original_role then
    raise exception '0137: 스윕 실행 검사 뒤 원래 역할을 복원하지 못했습니다';
  end if;
  if not v_ok then raise exception '0137: 인증 사용자가 실제로 스윕을 돌렸습니다'; end if;

  /*
   * 마감 기한에 활동이 섞이면 안 된다(§2.5).
   * ⚠ **주석 줄은 뺀다.** 위 함수의 설명문에 `last_activity_at` 이라는 글자가 들어 있어서,
   *   통째로 훑으면 검증식이 자기 설명에 걸린다(실제로 걸렸다).
   */
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'
') as line
     where n.nspname = 'public' and p.proname = 'close_due_business_days'
       and line like '%last_activity_at%'
       and btrim(line) not like '--%'
       and btrim(line) not like '*%'
       and btrim(line) not like '/*%')
  then
    raise exception '0137: 스윕이 last_activity_at 을 봅니다 — 마감이 다시 밀립니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
