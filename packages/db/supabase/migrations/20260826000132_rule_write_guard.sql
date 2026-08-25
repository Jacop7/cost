-- ════════════════════════════════════════════════════════════════
-- 0132 · 규칙 이력을 손으로 못 고치게 · 영업 시작과 시간 변경의 경합을 막는다
--
-- 0129~0131 검토에서 나온 두 구멍이다.
--
-- ── ① 규칙 이력이 직접 수정·삭제될 수 있었다 ────────────────────
-- RLS 는 **어느 매장인지**만 가른다. 내 매장이면 과거 규칙을 직접 update/delete 할 수
-- 있었고, 그러면 0130 이 세운 소급 방지가 통째로 무너진다 —
-- 8월 규칙의 시각을 손으로 고치면 8월 예정 종료가 다시 계산된다. 막으려던 그것이다.
--
-- 쓰기는 `set_operating_hours()` **한 문**으로만 들어온다. 그 함수만이
-- 시작일을 정하고 옛 규칙을 전날까지로 닫는다.
--
-- ── ② 영업 시작과 시간 변경이 겹칠 수 있었다 ────────────────────
-- `set_operating_hours` 의 `for update` 는 **영업일 행이 이미 있을 때만** 잠근다.
-- 아직 안 열었으면 아무것도 안 잠기고, 이런 순서가 가능했다 —
--
--     A 시간 변경  : 열린 영업일 없음 확인
--     B 영업 시작  : 옛 규칙으로 오늘 장부를 만든다
--     A 시간 변경  : 새 규칙을 **오늘부터** 적용
--
-- 결과는 화면은 새 규칙인데 열린 장부는 옛 규칙을 가리키는 상태다.
-- 없는 행은 잠글 수 없으니, 두 함수가 **매장 단위 권고 잠금**을 맨 먼저 같이 잡는다.
-- ════════════════════════════════════════════════════════════════

-- ── 매장 단위 잠금 ──────────────────────────────────────────────
/**
 * 영업일과 영업시간 규칙을 건드리는 문 전체를 한 줄로 세운다.
 *
 * ⚠ 행 잠금으로는 안 된다 — 막아야 하는 경합이 **아직 없는 행**을 만드는 쪽이다.
 *   권고 잠금은 트랜잭션이 끝나면 저절로 풀린다(`_xact_`).
 *   키는 매장마다 다르므로 다른 매장끼리는 서로 안 기다린다.
 */
create or replace function public.lock_business_scope(p_store uuid) returns void
language sql volatile as $fn$
  select pg_advisory_xact_lock(hashtextextended('business_scope:' || p_store::text, 0));
$fn$;

comment on function public.lock_business_scope(uuid) is
  '영업일 생성과 영업시간 규칙 변경을 매장 단위로 직렬화한다(0132). 두 함수가 맨 먼저 같이 잡는다.';


-- ── ① 쓰기는 RPC 한 문으로만 ────────────────────────────────────
revoke insert, update, delete, truncate on public.operating_rules from anon, authenticated;

-- 조회는 남긴다. RLS 가 매장을 가른다.
grant select on public.operating_rules to authenticated;

drop policy if exists operating_rules_rw on public.operating_rules;

-- 읽기 정책만 둔다. 쓰기 정책이 없으면 insert/update/delete 는 정책 부재로도 막힌다.
drop policy if exists operating_rules_read on public.operating_rules;
create policy operating_rules_read on public.operating_rules
  for select to authenticated
  using (store_id in (select public.my_store_ids()));


-- ── 두 함수가 같은 잠금을 맨 먼저 잡는다 ────────────────────────
do $m$
declare
  v_def text;
  v_old text := '  perform assert_my_store(p_store);';
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_business_day';
  if v_def is null then raise exception '0132: open_business_day 가 없습니다'; end if;

  if position('lock_business_scope' in v_def) > 0 then
    return;   -- 이미 적용됨
  end if;
  if position(v_old in v_def) = 0 then
    raise exception '0132: open_business_day 의 권한 확인 줄을 못 찾았습니다';
  end if;

  v_new := concat_ws(chr(10),
    '  perform assert_my_store(p_store);',
    '  -- ⚠ 영업시간 변경과 한 줄로 세운다(0132). 안 그러면 옛 규칙으로 연 장부에',
    '  --   새 규칙이 오늘부터 붙는 순간이 생긴다.',
    '  perform lock_business_scope(p_store);');

  execute replace(v_def, v_old, v_new);
end $m$;


-- ── set_operating_hours 다시 쓰기 (definer + 잠금) ───────────────
/**
 * 영업시간을 바꾼다. **오늘 장부는 안 건드린다.**
 *
 * 시작일 정하기 —
 *   영업 중이면      : 그 영업일 다음 날부터 (오늘은 옛 규칙으로 끝낸다)
 *   영업 중이 아니면 : 오늘 아직 안 열었으면 오늘부터, 이미 닫았으면 다음 날부터
 *
 * ⚠ `security definer` 다(0132). `operating_rules` 의 직접 쓰기 권한을 걷어냈기 때문에,
 *   규칙을 바꾸는 길은 이 함수뿐이다. 그래서 권한 확인을 **여기서 반드시** 한다 —
 *   `assert_my_store` 가 첫 줄인 이유다.
 *
 * ⚠ 같은 날 두 번 고치면 **덮어쓴다.** 새 규칙을 또 만들면 같은 `effective_from` 이
 *   둘이 되어 겹침 트리거에 걸린다. 아직 시작 안 한 예약 규칙은 고쳐도 잃을 게 없다.
 */
create or replace function public.set_operating_hours(
  p_store uuid,
  p_weekly_hours jsonb,
  p_weekly_breaks jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_today   date;
  v_cur     public.operating_rules;
  v_from    date;
  v_open    business_days;
  v_id      uuid;
begin
  perform assert_my_store(p_store);
  perform assert_weekly_hours(p_weekly_hours);
  perform assert_weekly_breaks(p_weekly_breaks);

  /*
   * ⚠ **맨 먼저** 잡는다. `open_business_day` 와 같은 키다.
   *   예전엔 아래 `for update` 만 있었는데, 그건 영업일 행이 **이미 있을 때만** 잠근다.
   *   아직 안 열었으면 아무것도 안 잠겨서, 확인과 적용 사이에 영업이 시작될 수 있었다.
   */
  perform lock_business_scope(p_store);

  -- ⚠ 달력 날짜다. 판매 영업일이 아니다 — 규칙은 달력으로 갈아 끼운다.
  v_today := store_local_date(p_store);

  select * into v_open from business_days
   where store_id = p_store and status <> 'closed'
   order by business_date desc limit 1
     for update;

  if v_open.id is not null then
    -- 영업 중이다. 오늘은 옛 규칙으로 끝낸다.
    v_from := greatest(v_open.business_date, v_today) + 1;
  elsif exists (select 1 from business_days where store_id = p_store and business_date = v_today) then
    -- 오늘은 이미 닫았다. 그날을 다시 해석하면 안 된다.
    v_from := v_today + 1;
  else
    -- 오늘 아직 안 열었다. 오늘부터 적용해도 지나간 것을 건드리지 않는다.
    v_from := v_today;
  end if;

  select * into v_cur from public.operating_rules
   where store_id = p_store and effective_to is null
     for update;

  if v_cur.id is not null and v_cur.effective_from = v_from then
    update public.operating_rules
       set weekly_hours = p_weekly_hours, weekly_breaks = p_weekly_breaks,
           created_at = now(), created_by = auth.uid()
     where id = v_cur.id
    returning id into v_id;

  else
    if v_cur.id is not null then
      if v_cur.effective_from > v_from then
        raise exception '이미 %부터 적용될 규칙이 있어요', v_cur.effective_from using errcode = '22000';
      end if;
      -- 옛 규칙은 **전날까지**. 그래야 과거 해석이 그대로 남는다.
      update public.operating_rules set effective_to = v_from - 1 where id = v_cur.id;
    end if;

    insert into public.operating_rules (store_id, effective_from, effective_to,
                                        weekly_hours, weekly_breaks, created_by)
         values (p_store, v_from, null, p_weekly_hours, p_weekly_breaks, auth.uid())
      returning id into v_id;
  end if;

  /*
   * `settings` 는 화면이 고쳐 쓰는 **입력 폼**이라 최신 값을 그대로 비춘다.
   * ⚠ 권위는 규칙이다. `planned_close()` 는 이제 settings 를 안 본다.
   *   (`business_cutoff()` 는 아직 settings 를 본다 — 3-3 단계다.)
   */
  update settings
     set open_time   = (p_weekly_hours->'1'->>'open')::time,
         close_time  = (p_weekly_hours->'1'->>'close')::time,
         break_start = (p_weekly_breaks->'1'->>'start')::time,
         break_end   = (p_weekly_breaks->'1'->>'end')::time,
         updated_at  = now()
   where store_id = p_store;

  return jsonb_build_object(
    'rule_id', v_id,
    'effective_from', v_from,
    'applies_today', v_from <= v_today,
    'open_business_date', v_open.business_date);
end $fn$;

comment on function public.set_operating_hours(uuid, jsonb, jsonb) is
  '영업시간 변경(0130·0132). 규칙을 바꾸는 유일한 문이다 — 직접 쓰기는 막혀 있다. 매장 단위 잠금을 open_business_day 와 함께 잡는다.';

revoke all on function public.set_operating_hours(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.set_operating_hours(uuid, jsonb, jsonb) to authenticated;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text; v_n int;
begin
  -- 쓰기 권한이 정말 걷혔는가.
  select count(*) into v_n
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'operating_rules'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if v_n > 0 then
    raise exception '0132: operating_rules 에 직접 쓰기 권한이 %건 남았습니다', v_n;
  end if;

  -- 조회는 남아야 한다. 안 그러면 화면이 영업시간을 못 읽는다.
  select count(*) into v_n
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'operating_rules'
     and grantee = 'authenticated' and privilege_type = 'SELECT';
  if v_n = 0 then
    raise exception '0132: authenticated 의 조회 권한까지 걷혔습니다';
  end if;

  -- 두 함수가 같은 잠금을 잡는가.
  for v_def in
    select pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('open_business_day', 'set_operating_hours')
  loop
    if position('lock_business_scope' in v_def) = 0 then
      raise exception '0132: 잠금을 안 잡는 함수가 있습니다';
    end if;
  end loop;

  -- definer 로 바뀌었는가.
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'set_operating_hours' and p.prosecdef;
  if v_n <> 1 then
    raise exception '0132: set_operating_hours 가 security definer 가 아닙니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
