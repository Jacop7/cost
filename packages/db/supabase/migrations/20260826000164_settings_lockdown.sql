/*
 * 0164 · settings 직접 쓰기 봉쇄 + 동기화 트리거 제거 + 없는 시각 거부 (검토 재재검토)
 *
 * ① 판본 우회의 마지막 문 — save_settings 는 막았지만(0163) 인증 사용자가 `settings`
 *    테이블을 **직접** 고칠 수 있었고, 동기화 트리거(settings_sync_operating_rule)가
 *    영업시간을 규칙에 옮기면서 revision 은 안 올렸다. 실측:
 *        09:00–21:00 · revision 1  →  settings 직접 변경  →  03:00–04:00 · revision 1
 *    · settings 의 INSERT/UPDATE/DELETE 를 앱 롤에서 걷어낸다(읽기만). 쓰기 RPC
 *      (save_settings · save_store_tax)는 SECURITY DEFINER 로 — 첫 줄 assert_my_store.
 *    · 동기화 트리거는 **지운다.** settings 는 표시 폼이고 권위는 규칙이다(0130 이후).
 *      남겨 두면 apply_operating_hours 의 settings 되비추기가 트리거를 깨워, 첫 영업
 *      전 매장의 요일별 편집을 dow1 값으로 균일하게 덮고 revision 도 안 올린다.
 *
 * ② DST 봄 전환 — 존재하지 않는 시각(뉴욕 3/8 02:30)을 고르면 PostgreSQL 이 03:30 으로
 *    조용히 옮겼다. 역변환이 고른 벽시계와 다르면 거부한다.
 */

-- ── ① settings — 읽기만 ─────────────────────────────────────────
-- 호스티드 DB는 로컬 fresh DB와 달리 선행 blanket grant가 없을 수 있다.
-- '읽기만'은 기존 권한에 기대지 않고 이 migration이 직접 만든다.
grant select on public.settings to authenticated;
revoke insert, update, delete, truncate on public.settings from anon, authenticated;
drop policy if exists settings_insert on public.settings;
drop policy if exists settings_update on public.settings;
drop policy if exists settings_delete on public.settings;
-- 읽기 정책(settings_select)은 그대로 — 화면이 표시 폼을 읽는다.

drop trigger if exists settings_sync_operating_rule_trg on public.settings;
drop function if exists public.settings_sync_operating_rule();

-- save_settings — 몸통은 0163 그대로, definer 로만.
create or replace function public.save_settings(p_store uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄
  perform lock_business_scope(p_store);   -- 0134 와 같은 순서

  -- 영업시간은 여기로 안 들어온다(0163). 문은 하나다 — MY > 영업시간(판본 필수).
  if p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end'] then
    raise exception '영업시간은 영업시간 화면에서만 바꿀 수 있어요'
      using errcode = '22000', detail = 'HOURS_NOT_HERE';
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
    updated_at         = now()
  where store_id = p_store;
end;
$$;
comment on function public.save_settings(uuid, jsonb) is
'설정 저장(언어·자릿수·알림). 영업시간 키는 거부한다(0163) — 그 문은 set_operating_hours(판본 필수)뿐이다. settings 는 앱 롤이 직접 못 쓰므로 definer 다(0164). 매장 잠금을 맨 먼저 잡아 순서를 통일한다(0134).';
revoke execute on function public.save_settings(uuid, jsonb) from public, anon;
grant  execute on function public.save_settings(uuid, jsonb) to authenticated, service_role;

-- save_store_tax — 몸통 그대로, definer 로만.
create or replace function public.save_store_tax(p_store uuid, p_mode tax_mode, p_items jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_mode0  tax_mode;
  v_items0 jsonb;
  v_items  jsonb;
  v_day    date := store_local_date(p_store);
  v_month  text := to_char(store_local_date(p_store), 'YYYY-MM');
  v_rate   numeric;
  v_corr   uuid := gen_random_uuid();
  v_ext    numeric;
  v_t0     numeric;
  v_t1     numeric;
  rec      record;
  v_n      int := 0;
begin
  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄 (definer, 0164)
  v_items := assert_tax_items(coalesce(p_items, '[]'::jsonb));

  select tax_mode, tax_items into v_mode0, v_items0 from settings where store_id = p_store;

  update settings
     set tax_mode = p_mode, tax_items = v_items, updated_at = now()
   where store_id = p_store;

  -- 아무것도 안 바뀌었으면 여기서 끝난다. 같은 값을 다시 저장했다고 전 메뉴
  -- 손익 변동에 줄이 쌓이면 목록이 쓰레기가 된다(E4 와 같은 규칙).
  if v_mode0 is not distinct from p_mode and coalesce(v_items0, '[]'::jsonb) = v_items then
    return jsonb_build_object('changed', false, 'recipes', 0);
  end if;

  v_rate := coalesce(fixed_cost_rate(p_store, v_month), 0);

  for rec in select id, price from recipes where store_id = p_store and coalesce(active, true) loop
    v_t0 := tax_of(rec.price, v_mode0, coalesce(v_items0, '[]'::jsonb));
    v_t1 := tax_of(rec.price, p_mode, v_items);

    -- 트리거가 매장 설정을 그대로 실어 준다. 여기서는 재계산이 목적이다.
    update recipes set updated_at = now() where id = rec.id;

    perform recompute_recipe(rec.id, 'tax', v_day);
    v_n := v_n + 1;

    -- ── 수정 내역(0063) ──────────────────────────────────────
    -- 세금은 식재료도 레시피도 아니라 담을 엔터티가 없다. 영향을 받은
    -- **메뉴 쪽에** 남기고 correlation_id 로 한 묶음으로 묶는다.
    v_ext := coalesce((select sum(ec.amount_per_serving)
                         from recipe_extra_costs ec where ec.recipe_id = rec.id), 0);
    perform record_entity_change(
      p_store, 'recipe', rec.id, 'fixed_cost', '세금 반영',
      change_line('tax', '세금', round(v_t0, 2), round(v_t1, 2), '원', 'derived')
      || change_line('profit', '순이익',
           round(rec.price - recipe_material_cost(rec.id) - v_ext - v_t0 - v_rate * rec.price, 2),
           round(rec.price - recipe_material_cost(rec.id) - v_ext - v_t1 - v_rate * rec.price, 2),
           '원', 'derived'),
      true, null, v_corr, '세금 설정 변경');
  end loop;

  return jsonb_build_object('changed', true, 'recipes', v_n,
                            'mode', p_mode, 'items', v_items);
end;
$$;
revoke execute on function public.save_store_tax(uuid, tax_mode, jsonb) from public, anon;
grant  execute on function public.save_store_tax(uuid, tax_mode, jsonb) to authenticated, service_role;

-- ── ② 없는 시각 거부 — late_close_at 을 plpgsql 로 (역변환 검증) ──
drop function public.late_close_at(date, time, text, timestamptz);
create function public.late_close_at(
  p_date date, p_close time, p_tz text, p_now timestamptz
) returns timestamptz
language plpgsql
stable
as $$
declare
  v_day date := p_date;
  v     timestamptz;
begin
  v := (v_day::timestamp + p_close) at time zone p_tz;
  if v <= p_now then
    -- 오늘 그 시각이 지났으면 **다음 현지 날짜**의 그 시각(DST 안전, 0163).
    v_day := p_date + 1;
    v := (v_day::timestamp + p_close) at time zone p_tz;
  end if;
  /*
   * 존재하지 않는 시각(봄 전환일의 건너뛴 한 시간)은 PostgreSQL 이 조용히 옆 시각으로
   * 옮긴다 — 뉴욕 3/8 02:30 → 03:30. 역변환한 벽시계가 고른 값과 다르면 그날엔 없는
   * 시각이다. 조용히 저장하지 않고 거부한다(0164).
   */
  if (v at time zone p_tz)::time <> p_close or (v at time zone p_tz)::date <> v_day then
    raise exception '%는 그날 서머타임 때문에 없는 시각이에요. 다른 시간을 골라 주세요', p_close
      using errcode = '22000', detail = 'NONEXISTENT_LOCAL_TIME';
  end if;
  return v;
end;
$$;
comment on function public.late_close_at(date, time, text, timestamptz) is
'늦은 개점(0162)의 종료 시각. 지났으면 다음 현지 날짜의 그 시각(DST 안전, 0163). 그날 없는 시각(봄 전환)은 거부(0164).';
revoke execute on function public.late_close_at(date, time, text, timestamptz) from public, anon;
grant  execute on function public.late_close_at(date, time, text, timestamptz) to authenticated, service_role;

-- ── ③ 사후조건 ──────────────────────────────────────────────────
do $$
declare v_n int;
begin
  if has_table_privilege('authenticated', 'public.settings', 'insert')
     or has_table_privilege('authenticated', 'public.settings', 'update')
     or has_table_privilege('authenticated', 'public.settings', 'delete')
     or has_table_privilege('authenticated', 'public.settings', 'truncate') then
    raise exception '0164: settings 직접 쓰기가 아직 열려 있습니다';
  end if;
  if not has_table_privilege('authenticated', 'public.settings', 'select') then
    raise exception '0164: settings 읽기까지 막혔습니다 — 표시 폼을 못 읽습니다';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.settings'::regclass) then
    raise exception '0164: settings 에 RLS 가 꺼져 있습니다 — SELECT 부여가 매장 경계를 넘습니다';
  end if;
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.settings'::regclass
       and polcmd = 'r'
  ) then
    raise exception '0164: settings 읽기 정책이 없습니다 — 표시 폼을 못 읽습니다';
  end if;
  select count(*) into v_n from pg_policy where polrelid = 'public.settings'::regclass and polcmd <> 'r';
  if v_n > 0 then
    raise exception '0164: settings 에 쓰기 정책 %개가 남아 있습니다', v_n;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'settings_sync_operating_rule_trg') then
    raise exception '0164: 동기화 트리거가 남아 있습니다';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'settings_sync_operating_rule') then
    raise exception '0164: 동기화 함수가 남아 있습니다';
  end if;
  if not (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'save_settings') then
    raise exception '0164: save_settings 가 definer 가 아닙니다 — 앱이 설정을 못 저장합니다';
  end if;
  if not (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'save_store_tax') then
    raise exception '0164: save_store_tax 가 definer 가 아닙니다';
  end if;

  -- 봄 전환 표본: 뉴욕 2026-03-08 02:00→03:00. 3/7 02:30 이 지난 뒤의 "다음 날 02:30"은 없는 시각이다.
  begin
    perform late_close_at('2026-03-07', '02:30', 'America/New_York', '2026-03-08 08:00:00+00');
    raise exception '0164: 없는 시각(봄 전환)을 통과시켰습니다';
  exception when sqlstate '22000' then null;
  end;
  -- 가을 되돌림(겹치는 시각)은 여전히 허용 — 벽시계가 존재한다.
  if late_close_at('2026-10-31', '02:30', 'America/New_York', '2026-11-01 08:00:00+00')
     <> '2026-11-01 07:30:00+00'::timestamptz then
    raise exception '0164: 가을 되돌림 계산이 바뀌었습니다';
  end if;
end $$;
