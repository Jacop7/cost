-- ════════════════════════════════════════════════════════════════
-- 0134 · 잠금 순서를 하나로 · TRUNCATE 도 막는다
--
-- 0132·0133 검토에서 나온 두 구멍이다. 둘 다 "막았다고 생각한 것이 옆으로 새는" 종류다.
--
-- ── ① 잠금 순서가 갈렸다 (데드락) ───────────────────────────────
-- 같은 두 자원을 두 함수가 **다른 순서로** 잡고 있었다.
--
--     save_settings          : settings 행 잠금  →  advisory lock
--     set_operating_hours    : advisory lock     →  settings 행 잠금
--
-- 두 요청이 겹치면 서로를 기다리다 하나가 데드락으로 죽는다. 사장님 쪽에서는
-- `저장하지 못했어요` 가 이유 없이 뜨는 것으로 보인다.
--
-- `save_settings` 가 **아무것도 건드리기 전에** 같은 권고 잠금을 먼저 잡게 한다.
-- ⚠ 시간 키가 있을 때만 잡지 않는다. 조건을 달면 그 조건이 아래 분기와 어긋나는 날이
--   반드시 온다 — 순서는 하나여야 지켜진다. 설정 저장은 드물어서 값도 안 비싸다.
--   같은 트랜잭션에서 다시 잡는 것은 무해하다(권고 잠금은 셈으로 쌓인다).
--
-- ── ② TRUNCATE 가 0133 트리거를 비껴갔다 ────────────────────────
-- 0133 은 행 트리거라 INSERT/UPDATE/DELETE 만 본다. `truncate ... cascade` 는
-- 행 트리거도 RLS 도 거치지 않는다. 권한이 다시 풀리면(그게 0133 을 만든 이유다)
-- 규칙과 영업일이 한 번에 지워질 수 있다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 잠금 순서 통일 ────────────────────────────────────────────
create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void
language plpgsql
as $fn$
declare
  v_open   time := nullif(p_payload->>'open_time','')::time;
  v_close  time := nullif(p_payload->>'close_time','')::time;
  v_hours  jsonb;
  v_breaks jsonb;
  v_cur    public.operating_rules;
begin
  perform assert_my_store(p_store);

  /*
   * ⚠ **아무것도 건드리기 전에** 잡는다(0134). `set_operating_hours` 도 이걸 맨 먼저
   *   잡으므로 두 경로의 순서가 같아진다. 예전엔 여기서 settings 행을 먼저 잠그고
   *   나중에 권고 잠금을 잡아서, 반대 순서로 들어온 요청과 데드락이 났다.
   */
  perform lock_business_scope(p_store);

  if v_open is not null and v_close is not null and v_open = v_close then
    raise exception '영업 시작과 종료 시각이 같을 수 없어요' using errcode = '22000';
  end if;

  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;

  update settings set
    locale             = coalesce(nullif(p_payload->>'locale',''), locale),
    unit_price_digits  = coalesce((p_payload->>'unit_price_digits')::int, unit_price_digits),
    quantity_digits    = coalesce((p_payload->>'quantity_digits')::int, quantity_digits),
    money_digits       = coalesce((p_payload->>'money_digits')::int, money_digits),
    default_target_profit_rate = coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate),
    alert_morning_summary = coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary),
    alert_inbound_delay   = coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay),
    alert_price_spike     = coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike),
    alert_target_miss     = coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss),
    open_time          = coalesce(v_open, open_time),
    close_time         = coalesce(v_close, close_time),
    -- 브레이크는 지우는 것도 뜻이 있다 — 키를 보냈으면 값이 비어도 반영한다.
    break_start        = case when p_payload ? 'break_start'
                              then nullif(p_payload->>'break_start','')::time else break_start end,
    break_end          = case when p_payload ? 'break_end'
                              then nullif(p_payload->>'break_end','')::time else break_end end,
    updated_at         = now()
  where store_id = p_store;

  if not (p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end']) then
    return;   -- 시간과 무관한 저장(언어·자릿수·알림)은 규칙을 안 건드린다.
  end if;

  -- 지금 규칙의 요일별 휴무 표시는 지키고 시각만 갈아 끼운다.
  select * into v_cur from public.operating_rules
   where store_id = p_store and effective_to is null;

  select jsonb_object_agg(d::text, jsonb_build_object(
           'open',   s.open_time::text,
           'close',  s.close_time::text,
           'closed', coalesce((v_cur.weekly_hours -> d::text ->> 'closed')::boolean, false)))
    into v_hours
    from generate_series(0, 6) d, settings s
   where s.store_id = p_store;

  select case when s.break_start is null or s.break_end is null then '{}'::jsonb
              else jsonb_object_agg(d::text, jsonb_build_object(
                     'start', s.break_start::text, 'end', s.break_end::text)) end
    into v_breaks
    from generate_series(0, 6) d, settings s
   where s.store_id = p_store
   group by s.break_start, s.break_end;

  perform set_operating_hours(p_store, v_hours, coalesce(v_breaks, '{}'::jsonb));
end $fn$;

comment on function public.save_settings(uuid, jsonb) is
  '설정 저장. 영업시간 키가 오면 set_operating_hours 로 규칙까지 간다(0130). 매장 잠금을 맨 먼저 잡아 순서를 통일한다(0134).';


-- ── ② TRUNCATE 인가 ─────────────────────────────────────────────
/*
 * `truncate` 는 행 트리거를 안 부른다. 문장 트리거로 따로 막는다.
 *
 * ⚠ `for each statement` 다. 그리고 `truncate ... cascade` 로 **다른 테이블에서
 *   딸려 오는 경우에도** 각 테이블의 truncate 트리거가 돈다 — 그래서 여기 하나로
 *   규칙 테이블이 딸려 지워지는 것까지 막힌다.
 */
create or replace function public.operating_rules_no_truncate() returns trigger
language plpgsql as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception '영업시간 기록은 비울 수 없어요'
      using errcode = '42501',
            detail  = '규칙 이력이 사라지면 과거 날짜를 해석할 수 없습니다.';
  end if;
  return null;
end $fn$;

drop trigger if exists operating_rules_00_no_truncate on public.operating_rules;
create trigger operating_rules_00_no_truncate
  before truncate on public.operating_rules
  for each statement execute function public.operating_rules_no_truncate();

/*
 * 영업일도 같이 막는다. `truncate operating_rules cascade` 가 노리는 게 이쪽이고,
 * 애초에 장부를 통째로 비우는 건 어떤 화면에서도 하는 일이 아니다.
 */
create or replace function public.business_days_no_truncate() returns trigger
language plpgsql as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception '영업일 기록은 비울 수 없어요'
      using errcode = '42501',
            detail  = '장부를 통째로 비우는 화면은 없습니다.';
  end if;
  return null;
end $fn$;

drop trigger if exists business_days_00_no_truncate on public.business_days;
create trigger business_days_00_no_truncate
  before truncate on public.business_days
  for each statement execute function public.business_days_no_truncate();


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text; v_ok boolean;
begin
  -- ① save_settings 가 잠금을 **settings 를 건드리기 전에** 잡는가.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_settings';
  if position('lock_business_scope' in v_def) = 0 then
    raise exception '0134: save_settings 가 잠금을 안 잡습니다';
  end if;
  if position('lock_business_scope' in v_def) > position('insert into settings' in v_def) then
    raise exception '0134: save_settings 가 settings 를 건드린 뒤에 잠급니다 — 순서가 그대로입니다';
  end if;

  -- ② truncate 가 정말 막히는가. 트리거 존재만 보면 조건이 틀려도 통과한다.
  if exists (select 1 from public.stores) then
    v_ok := false;
    begin
      set local role authenticated;
      execute 'truncate public.operating_rules cascade';
    exception when insufficient_privilege then
      v_ok := true;
    end;
    reset role;
    if not v_ok then
      raise exception '0134: authenticated 가 규칙을 truncate 할 수 있습니다';
    end if;
  end if;
end $v$;

select public.assert_no_rpc_overloads();
