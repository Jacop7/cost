-- ════════════════════════════════════════════════════════════════
-- 0138 · 0137 의 다섯 구멍
--
-- ① 내부 마감 몸통이 인증 사용자에게 열려 있었다
-- ② 자동 마감의 `closed_at` 이 판매보다 이른 시각이었다  ← 제일 큰 것
-- ③ 판매 저장이 잠근 뒤 기한을 안 봤다
-- ④ 수동 마감과 크론이 겹치면 **실패**로 셌다
-- ⑤ 30일 청소를 매분 돌렸다
-- ════════════════════════════════════════════════════════════════

-- ── ① 몸통은 소유자만 부른다 ───────────────────────────────────
/*
 * `close_business_day_row` 는 **권한 검사를 안 한다**. 그런데 0137 이 그걸
 * 인증 사용자에게 열어 뒀다(기본 권한이 authenticated 에 준다).
 * 그러면 사장님이 직접 불러 `close_method`·`closed_at` 을 **아무 값으로나** 적을 수 있다.
 * RLS 가 남의 매장은 막지만, 자기 매장의 정상 마감 규칙은 그대로 우회된다.
 *
 * 몸통은 소유자만 부른다. 사람이 들어오는 문은 `close_business_day` 하나다.
 */
revoke execute on function public.close_business_day_row(uuid, business_close_method, timestamptz)
  from public, anon, authenticated, service_role;

/*
 * 그래서 `close_business_day` 를 `security definer` 로 돌린다 — 그래야 소유자 자격으로
 * 몸통을 부를 수 있다.
 *
 * ⚠ definer 는 RLS 를 지나간다. 그러니 **첫 줄이 권한 검사**여야 한다.
 *   0135 가 가르쳐 준 모양이다 — 매장을 안 가리는 definer 가 사고의 씨앗이었다.
 */
create or replace function public.close_business_day(
  p_store uuid,
  p_method business_close_method default 'manual'
) returns jsonb
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
  -- 직접 닫을 때는 **지금**이 종료 시각이다. 사장님이 실제로 그때 닫았다.
  return close_business_day_row(v_day.id, p_method, now());
end $fn$;

revoke execute on function public.close_business_day(uuid, business_close_method) from public, anon;
grant execute on function public.close_business_day(uuid, business_close_method) to authenticated, service_role;


-- ── ② 자동 마감 시각은 **기한**이다 ─────────────────────────────
/*
 * 0137 은 `closed_at` 을 **예정 종료**로 적었다. 화면 규격(§6.1 `자동 종료 11:00–22:00`)
 * 을 따르려던 것인데, 그러면 장부 안에서 모순이 생긴다 —
 *
 *     판매 기록  22:45
 *     영업 종료  22:00      ← 종료된 뒤에 판매가 있다
 *
 * 22:00~23:00 판매를 받아들이기로 한 이상 `closed_at` 은 그보다 뒤여야 한다.
 * 화면의 `11:00–22:00` 은 `closed_at` 이 아니라 **`planned_close_at`** 으로 그리면 된다.
 * 둘은 뜻이 다른 값이고, 섞은 게 잘못이었다.
 *
 * 그래서 `closed_at = planned_close_at + auto_close_grace()` — **기한** 그 자체다.
 * ⚠ 크론이 늦게 돌아도 이 값은 안 흔들린다. 실행 시각(`now()`)을 쓰면
 *   서버가 잠깐 멈춘 날만 종료 시각이 튄다.
 *
 * ── ④ 45002 는 실패가 아니다 ──
 * 후보를 읽은 뒤 사장님이 먼저 직접 닫으면 몸통이 `45002` 를 낸다. 그건 경합의 정상
 * 결말이지 실패가 아니다. `skipped` 로 따로 센다 — 안 그러면 매분 `failed: 1` 이 쌓여
 * 진짜 실패가 그 속에 묻힌다.
 *
 * ── ⑤ 청소는 여기서 빠진다 ──
 * 매분 전 매장 청소는 값이 비싸다(`occurred_at` 단독 인덱스도 없었다).
 * 하루 한 번 따로 돈다(아래 크론).
 */
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
  v_due     timestamptz;
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
    v_due := r.planned_close_at + auto_close_grace();
    begin
      -- 영업 시작·영업시간 변경과 같은 줄에 선다(0132).
      perform lock_business_scope(r.store_id);
      perform close_business_day_row(r.id, 'auto', v_due);
      v_closed := v_closed + 1;
      v_days := v_days || jsonb_build_object(
        'store_id', r.store_id, 'business_date', r.business_date, 'closed_at', v_due);
    exception
      when sqlstate '45002' then
        -- 그사이 사장님이 직접 닫았다. 경합의 정상 결말이다.
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

comment on function public.close_due_business_days() is
  '기한이 지난 영업일을 모두 닫는 스윕(0137·0138). 종료 시각은 예정 종료 + 유예(= 기한)로 적는다 — 실행 시각이 아니다. 청소는 별도 크론이다.';

revoke execute on function public.close_due_business_days() from public, anon, authenticated;
grant execute on function public.close_due_business_days() to service_role;


-- ── ③ 판매 저장이 잠근 뒤 기한을 본다 ───────────────────────────
/*
 * 기획서 §2.4 마지막 줄 — "자동 마감 시각이 지나도 열린 행이면 판매를 계속 받을 수 있다".
 * 크론이 1분마다 돌아도 그 1분 사이는 열려 있다.
 *
 * ⚠ `now()` 가 아니라 `clock_timestamp()` 다. `now()` 는 **트랜잭션 시작 시각**에
 *   고정된다. 잠금을 기다리는 동안 기한이 지나도 `now()` 로는 안 지난 것으로 보여
 *   판매가 통과한다 — 잠금을 기다린 트랜잭션일수록 더 잘 새는 셈이다.
 */
do $m$
declare
  v_def text;
  v_old text := '    select status::text into v_status from business_days where id = v_bday.id;';
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  if v_def is null then raise exception '0138: save_sale 이 없습니다'; end if;

  if position('오늘 장부에만' in v_def) > 0 then return; end if;   -- 이미 적용됨
  if position(v_old in v_def) = 0 then
    raise exception '0138: save_sale 의 상태 읽는 줄을 못 찾았습니다';
  end if;

  v_new := concat_ws(chr(10),
    '    select status::text into v_status from business_days where id = v_bday.id;',
    '',
    '    -- ⚠ 자동 마감 기한이 지났으면 아직 열려 있어도 안 받는다(0138, 기획서 §2.4).',
    '    --   `clock_timestamp()` 다 — `now()` 는 트랜잭션 시작 시각에 고정돼,',
    '    --   잠금을 기다리는 동안 기한이 지나도 안 지난 것으로 보인다.',
    '    --',
    '    -- ⚠ **오늘 장부에만** 건다. 처음엔 조건 없이 걸었다가 과거 날짜 판매가 통째로',
    '    --   막혔다 — 시드가 8/05 를 넣다 45002 로 죽어서 알았다. 과거 장부를 다시 열어',
    '    --   고치는 흐름(§6.4)도 같은 벽에 막힌다. 여기서 막아야 하는 건 **살아 있는**',
    '    --   오늘 장부가 기한을 넘긴 채 판매를 계속 받는 것 하나다.',
    '    if p_date = business_day()',
    '       and v_status <> ''closed''',
    '       and v_bday.planned_close_at is not null',
    '       and clock_timestamp() >= v_bday.planned_close_at + auto_close_grace() then',
    '      raise exception ''% 영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요'', p_date',
    '        using errcode = ''45002'';',
    '    end if;');

  execute replace(v_def, v_old, v_new);
end $m$;


-- ── ⑤ 청소는 하루 한 번 · 인덱스 ────────────────────────────────
-- 나이로만 지우는데 `occurred_at` 단독 인덱스가 없었다. 전 매장 삭제가 매번 전체 훑기였다.
create index if not exists entity_change_events_occurred_ix
  on public.entity_change_events (occurred_at);


-- ── 크론 ────────────────────────────────────────────────────────
do $c$
declare v_db text := current_setting('cron.database_name', true);
begin
  if v_db is null or v_db <> current_database() then
    raise notice '0138: 이 DB(%)는 크론 대상이 아닙니다', current_database();
    return;
  end if;

  perform cron.schedule('sikjae-close-due', '* * * * *',
                        'select public.close_due_business_days()');
  -- 청소는 하루 한 번. 새벽 4시대는 어느 매장도 안 붐빈다.
  perform cron.schedule('sikjae-purge-changes', '17 4 * * *',
                        'select public.purge_entity_changes()');
  raise notice '0138: 크론 — 마감 1분마다 · 청소 하루 1회';
exception when others then
  raise warning '0138: 크론 등록 실패 — % (%)', sqlerrm, sqlstate;
end $c$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare
  v_ok boolean;
  v_def text;
  v_original_role name := current_user;
begin
  -- ① 몸통은 아무도 못 부른다(소유자 제외).
  if has_function_privilege('authenticated',
       'public.close_business_day_row(uuid,business_close_method,timestamptz)', 'execute')
  then raise exception '0138: 인증 사용자가 마감 몸통을 직접 부를 수 있습니다'; end if;
  if has_function_privilege('service_role',
       'public.close_business_day_row(uuid,business_close_method,timestamptz)', 'execute')
  then raise exception '0138: service_role 이 마감 몸통을 직접 부를 수 있습니다'; end if;

  v_ok := false;
  set local role authenticated;
  if current_user <> 'authenticated' then
    raise exception '0138: authenticated 역할로 전환하지 못했습니다';
  end if;
  begin
    perform public.close_business_day_row(gen_random_uuid(), 'manual', now());
  exception when insufficient_privilege then
    if position('close_business_day_row' in sqlerrm) = 0 then
      raise exception '0138: 인증 권한 거부가 마감 몸통이 아닌 곳에서 났습니다: %', sqlerrm;
    end if;
    v_ok := true;
  end;
  execute format('set local role %I', v_original_role);
  if current_user <> v_original_role then
    raise exception '0138: 마감 몸통 검사 뒤 원래 역할을 복원하지 못했습니다';
  end if;
  if not v_ok then raise exception '0138: 인증 사용자가 실제로 몸통을 불렀습니다'; end if;

  -- 그래도 정상 문은 열려 있어야 한다.
  if not has_function_privilege('authenticated',
       'public.close_business_day(uuid,business_close_method)', 'execute')
  then raise exception '0138: 사장님이 영업을 못 닫습니다'; end if;

  -- ② 종료 시각이 기한인가.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'close_due_business_days';
  if position('auto_close_grace()' in v_def) = 0 then
    raise exception '0138: 스윕이 유예를 안 씁니다';
  end if;
  if position('''auto'', r.planned_close_at' in v_def) > 0 then
    raise exception '0138: 스윕이 아직 예정 종료를 종료 시각으로 적습니다';
  end if;

  -- ③ 판매 저장이 clock_timestamp 로 기한을 보는가.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';
  if position('clock_timestamp()' in v_def) = 0 then
    raise exception '0138: 판매 저장이 기한을 안 봅니다';
  end if;

  -- ④ 45002 를 따로 세는가.
  if position('skipped' in (
       select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'close_due_business_days')) = 0 then
    raise exception '0138: 스윕이 45002 를 실패로 셉니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
