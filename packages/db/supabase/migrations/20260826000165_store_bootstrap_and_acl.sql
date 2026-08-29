/*
 * 0165 · 잠금 테이블의 남은 권한 회수 + 신규 매장 초기화 (검토 재재재검토)
 *
 * ① 읽기 전용이 읽기 전용이 아니었다 — 0164 가 INSERT/UPDATE/DELETE 만 걷어내서
 *    `authenticated` 에 **TRIGGER · REFERENCES** 가 남아 있었다(rxt). 실측: 인증 롤이
 *    `settings` 와 `operating_rules` 에 트리거를 실제로 붙였고, 그 트리거는 definer RPC
 *    (save_settings 등)가 그 테이블을 쓸 때도 발동해 **정상 저장을 멈출 수 있다.**
 *    다섯 잠금 테이블에서 권한을 통째로 회수하고 select 만 다시 준다.
 *
 * ② 신규 매장 초기화가 깨져 있었다 — 실측:
 *      · 인증 롤이 stores 에 직접 insert → `stores_default_time_settings` 트리거가
 *        definer 가 아니라 42501(store_time_settings 권한 없음)로 매장 생성 자체가 실패.
 *      · 트리거를 통과해도 settings 행은 아무도 안 만든다 → save_store_tax 는
 *        `update 0행` 인데 changed=true 를 돌려주고, 표시 설정은 계속 비어 있다.
 *      · 기본 영업시간이 규칙 09–21 vs settings 기본값 11–22 로 갈려 있었다.
 *    고침: 초기화 트리거 셋(시간대·규칙·설정)을 definer 로 통일하고 기본값을 11–22 로
 *    맞춘다. 공식 문 `create_store` RPC 를 두고(한 트랜잭션), settings 누락 매장은 백필한다.
 *    save_store_tax 는 행이 없으면 만들고, 그래도 0행이면 조용히 성공하지 않는다.
 */

-- ── ① 잠금 테이블 — 권한 통째 회수 후 select 만 ──────────────────
do $$
declare t text;
begin
  foreach t in array array['settings', 'operating_rules', 'store_time_settings',
                           'business_day_revisions', 'business_state_transitions']
  loop
    execute format('revoke all privileges on public.%I from public, anon, authenticated', t);
    -- 읽기는 남긴다 — RLS 가 행을 가른다. 쓰기·트리거·참조는 소유자와 service_role 만.
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

/*
 * ⚠ 쓰기가 열린 테이블(recipes·ingredients…)에서도 TRIGGER·REFERENCES 는 앱이 쓸 일이
 *   없다. 남겨 두면 인증 사용자가 아무 테이블에나 트리거를 붙여 **모든 세션의** 쓰기를
 *   멈출 수 있다(트리거는 붙인 사람만이 아니라 전부에게 발동한다). 통째로 걷어낸다.
 */
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke trigger, references on public.%I from public, anon, authenticated', r.relname);
  end loop;
end $$;

-- ── ② 초기화 트리거 — definer 통일 + 기본값 11–22 ────────────────
create or replace function public.stores_default_time_settings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- ⚠ definer 다(0165). 앱이 매장을 직접 만들 때 store_time_settings 는 앱 롤에 안 열려 있다.
  insert into public.store_time_settings (store_id, timezone)
  values (new.id, 'Asia/Seoul')
  on conflict (store_id) do nothing;
  return new;
end;
$$;

create or replace function public.stores_default_operating_rule()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- 기본 영업시간은 **11:00–22:00** 이다(0165) — settings 기본값·앱 표기와 같은 값이어야
  -- 신규 매장이 첫 화면부터 규칙과 표시 폼이 어긋나지 않는다(예전엔 규칙만 09–21 이었다).
  insert into public.operating_rules (store_id, effective_from, effective_to, weekly_hours, weekly_breaks)
  select new.id, '-infinity'::date, null,
         (select jsonb_object_agg(d::text, jsonb_build_object(
                   'open', '11:00', 'close', '22:00', 'closed', false))
            from generate_series(0, 6) d),
         '{}'::jsonb
   where not exists (select 1 from public.operating_rules r where r.store_id = new.id);
  return new;
end;
$$;

-- 설정 행도 매장과 함께 생긴다 — 아무도 안 만들어 표시 설정이 비어 있었다.
create or replace function public.stores_default_settings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.settings (store_id) values (new.id) on conflict (store_id) do nothing;
  return new;
end;
$$;
drop trigger if exists stores_default_settings_trg on public.stores;
create trigger stores_default_settings_trg after insert on public.stores
  for each row execute function public.stores_default_settings();

-- ── ③ 공식 문 — 한 트랜잭션으로 매장을 만든다 ────────────────────
create or replace function public.create_store(p_name text, p_timezone text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception '매장 이름을 적어 주세요' using errcode = '22000';
  end if;

  -- 트리거 셋(시간대·규칙·설정)이 같은 트랜잭션에서 따라붙는다(0165 ②).
  insert into stores (owner_id, name) values (v_uid, btrim(p_name)) returning id into v_id;

  if p_timezone is not null then
    -- 가드 트리거(0122)가 시간대 이름을 검증한다. 사장님이 정한 값이므로 confirmed 다(0156).
    insert into store_time_settings (store_id, timezone, confirmed)
         values (v_id, p_timezone, true)
    on conflict (store_id) do update set timezone = excluded.timezone, confirmed = true;
  end if;

  -- 사후조건 — 셋이 다 있어야 매장이다. 하나라도 없으면 만들다 만 매장을 남기지 않는다.
  if not exists (select 1 from settings where store_id = v_id)
     or not exists (select 1 from operating_rules where store_id = v_id)
     or not exists (select 1 from store_time_settings where store_id = v_id) then
    raise exception '매장 초기화가 끝나지 않았어요' using errcode = '22000';
  end if;

  return jsonb_build_object(
    'store_id', v_id,
    'timezone', store_timezone(v_id),
    'local_date', store_local_date(v_id));
end;
$$;
comment on function public.create_store(text, text) is
'매장 생성의 공식 문(0165). 매장·시간대·영업규칙·설정을 한 트랜잭션으로 만들고 셋이 다 생겼는지 확인한다.';
revoke execute on function public.create_store(text, text) from public, anon;
grant  execute on function public.create_store(text, text) to authenticated, service_role;

-- ── ④ 백필 — 설정·규칙·시간대가 빠진 매장 ───────────────────────
insert into public.settings (store_id)
select s.id from public.stores s
 where not exists (select 1 from public.settings x where x.store_id = s.id)
on conflict (store_id) do nothing;

insert into public.store_time_settings (store_id, timezone)
select s.id, 'Asia/Seoul' from public.stores s
 where not exists (select 1 from public.store_time_settings x where x.store_id = s.id)
on conflict (store_id) do nothing;

insert into public.operating_rules (store_id, effective_from, effective_to, weekly_hours, weekly_breaks)
select s.id, '-infinity'::date, null,
       (select jsonb_object_agg(d::text, jsonb_build_object('open','11:00','close','22:00','closed',false))
          from generate_series(0, 6) d),
       '{}'::jsonb
  from public.stores s
 where not exists (select 1 from public.operating_rules r where r.store_id = s.id);

-- ── ⑤ save_store_tax — 0행 저장을 성공이라 하지 않는다 ───────────
do $$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_store_tax';
  v_def := replace(v_def, chr(13) || chr(10), chr(10));

  -- 선언부의 날짜 계산이 assert_my_store 보다 먼저 돈다 — 남의 매장 id 로도 계산이 일어난다.
  v_old := array_to_string(array[
    '  v_day    date := store_local_date(p_store);',
    '  v_month  text := to_char(store_local_date(p_store), ''YYYY-MM'');'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0165: save_store_tax 의 선언부를 못 찾았습니다';
  end if;
  v_def := replace(v_def, v_old, array_to_string(array[
    '  v_day    date;   -- 문지기(assert_my_store) 뒤에 채운다(0165)',
    '  v_month  text;'
  ], E'\n'));

  v_old := '  v_items := assert_tax_items(coalesce(p_items, ''[]''::jsonb));';
  if position(v_old in v_def) = 0 then
    raise exception '0165: save_store_tax 의 검증 줄을 못 찾았습니다';
  end if;
  v_new := array_to_string(array[
    '  v_day   := store_local_date(p_store);',
    '  v_month := to_char(v_day, ''YYYY-MM'');',
    '  v_items := assert_tax_items(coalesce(p_items, ''[]''::jsonb));',
    '',
    '  -- 설정 행이 없으면 만든다(0165). 예전엔 update 0행인데 changed=true 를 돌려줬다.',
    '  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;'
  ], E'\n');
  v_def := replace(v_def, v_old, v_new);

  v_old := array_to_string(array[
    '  update settings',
    '     set tax_mode = p_mode, tax_items = v_items, updated_at = now()',
    '   where store_id = p_store;'
  ], E'\n');
  if position(v_old in v_def) = 0 then
    raise exception '0165: save_store_tax 의 저장 줄을 못 찾았습니다';
  end if;
  v_new := array_to_string(array[
    '  update settings',
    '     set tax_mode = p_mode, tax_items = v_items, updated_at = now()',
    '   where store_id = p_store;',
    '  if not found then',
    '    raise exception ''매장 설정을 찾지 못했어요'' using errcode = ''22000'';',
    '  end if;'
  ], E'\n');
  execute replace(v_def, v_old, v_new);
end $$;

-- ── ⑥ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  r record;
  v_n int;
begin
  for r in select unnest(array['settings','operating_rules','store_time_settings',
                               'business_day_revisions','business_state_transitions']) as t
  loop
    if has_table_privilege('authenticated', format('public.%I', r.t), 'TRIGGER')
       or has_table_privilege('authenticated', format('public.%I', r.t), 'REFERENCES')
       or has_table_privilege('authenticated', format('public.%I', r.t), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', r.t), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', r.t), 'DELETE') then
      raise exception '0165: % 가 아직 읽기 전용이 아닙니다', r.t;
    end if;
    if not has_table_privilege('authenticated', format('public.%I', r.t), 'SELECT') then
      raise exception '0165: % 읽기까지 막혔습니다', r.t;
    end if;
  end loop;

  -- 어떤 테이블에도 트리거를 붙일 수 없다.
  select count(*) into v_n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('authenticated', c.oid, 'TRIGGER')
          or has_table_privilege('authenticated', c.oid, 'REFERENCES'));
  if v_n > 0 then
    raise exception '0165: %개 테이블에 TRIGGER/REFERENCES 가 남아 있습니다', v_n;
  end if;

  -- 초기화 트리거 셋이 전부 definer 다.
  for r in select p.proname, p.prosecdef
             from pg_trigger t join pg_proc p on p.oid = t.tgfoid
            where t.tgrelid = 'public.stores'::regclass and not t.tgisinternal
  loop
    if not r.prosecdef then
      raise exception '0165: 초기화 트리거 %가 definer 가 아닙니다', r.proname;
    end if;
  end loop;

  -- 백필 결과 — 빠진 매장이 없다.
  select count(*) into v_n from stores s
   where not exists (select 1 from settings x where x.store_id = s.id)
      or not exists (select 1 from operating_rules x where x.store_id = s.id)
      or not exists (select 1 from store_time_settings x where x.store_id = s.id);
  if v_n > 0 then
    raise exception '0165: 초기화가 빠진 매장이 %개 있습니다', v_n;
  end if;

  -- save_store_tax — 0행 방어와 문지기 순서.
  declare v_def text;
  begin
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_store_tax';
    if position('if not found then' in v_def) = 0 then
      raise exception '0165: save_store_tax 가 0행 저장을 성공으로 돌려줍니다';
    end if;
    if position('v_day    date := store_local_date' in v_def) > 0 then
      raise exception '0165: save_store_tax 의 날짜 계산이 아직 문지기보다 먼저입니다';
    end if;
  end;
end $$;
