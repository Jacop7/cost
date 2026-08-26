/*
 * 0166 · TRUNCATE 봉쇄 · 미래 테이블까지 · 단일 매장 계약 · 백필 보존
 *
 * ① TRUNCATE — 0165 는 TRIGGER·REFERENCES 만 걷어냈다. 실측: 28개 중 23개에서
 *    인증·익명 롤이 TRUNCATE 를 쓸 수 있었고, **RLS 는 TRUNCATE 에 적용되지 않는다** —
 *    price_trends 100건이 0건이 됐다(검토자가 재현·롤백). 전 테이블에서 회수한다.
 *
 * ② 미래 테이블 — 회수는 그 순간 존재하는 테이블에만 걸린다. `alter default privileges`
 *    로 앞으로 만들 테이블도 TRUNCATE·TRIGGER·REFERENCES 없이 태어나게 한다.
 *    (0165 이후 만든 테이블이 다시 열려 있던 이유가 이것이다.)
 *
 * ③ 단일 매장 — create_store 를 두 번 부르면 매장이 둘 생겼고, 앱은 정렬 없이 첫 행을
 *    골라 어느 쪽이 잡힐지 알 수 없었다. 1차 범위는 매장 하나다(기획서 §12) —
 *    이미 있으면 **그 매장을 돌려준다**(created=false). 새로 만들지 않는다.
 *
 * ④ 백필 보존 — 0165 의 규칙 백필이 표시 폼을 무시하고 11–22 을 넣었다. 06–14 로 쓰던
 *    매장이 규칙만 11–22 가 된다. 아직 문(0159)을 한 번도 안 지난 규칙(revision=1)에
 *    한해 표시 폼 값으로 맞춘다 — 문을 지난 규칙은 사장님이 정한 값이라 안 건드린다.
 */

-- ── ① 지금 있는 테이블 — TRUNCATE 회수 ──────────────────────────
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke truncate on public.%I from public, anon, authenticated', r.relname);
  end loop;
end $$;

-- ── ② 앞으로 만들 테이블 — 기본 권한에서 빼 둔다 ────────────────
/*
 * ⚠ 마이그레이션은 postgres 로 돌지만, 대시보드·확장이 만드는 테이블은 supabase_admin
 *   소유일 수 있다. 두 롤 모두에 걸되, 권한이 없으면 경고만 남기고 넘어간다 —
 *   기본 권한 하나 때문에 마이그레이션 전체가 멈추면 안 된다.
 */
do $$
declare r text;
begin
  foreach r in array array['postgres', 'supabase_admin']
  loop
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke truncate, trigger, references on tables from anon, authenticated', r);
    exception when others then
      raise warning '0166: %의 기본 권한을 못 바꿨습니다 — % (%)', r, sqlerrm, sqlstate;
    end;
  end loop;
end $$;

-- ── ③ 단일 매장 계약 ────────────────────────────────────────────
create or replace function public.create_store(p_name text, p_timezone text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id  uuid;
  v_uid uuid := auth.uid();
  v_new boolean := false;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception '매장 이름을 적어 주세요' using errcode = '22000';
  end if;

  -- 매장 잠금과 같은 급의 직렬화 — 두 번 눌러도 둘이 생기지 않는다.
  perform pg_advisory_xact_lock(hashtextextended('create_store:' || v_uid::text, 0));

  /*
   * 1차 범위는 **매장 하나**다(기획서 §12). 이미 있으면 그걸 돌려준다 —
   * 두 번 눌러 매장이 둘이 되면 앱이 어느 쪽을 잡을지 알 수 없다(실측).
   * 정렬은 앱과 같은 기준이다(created_at, id) — 어느 쪽에서 봐도 같은 매장이어야 한다.
   */
  select id into v_id from stores where owner_id = v_uid
   order by created_at, id limit 1;

  if v_id is null then
    -- 트리거 셋(시간대·규칙·설정)이 같은 트랜잭션에서 따라붙는다(0165 ②).
    insert into stores (owner_id, name) values (v_uid, btrim(p_name)) returning id into v_id;
    v_new := true;
  end if;

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
    -- 새로 만들었나. false 면 이미 있던 매장을 돌려준 것이다(0166).
    'created', v_new,
    'timezone', store_timezone(v_id),
    'local_date', store_local_date(v_id));
end;
$$;
comment on function public.create_store(text, text) is
'매장 생성의 공식 문(0165·0166). 1차 범위는 매장 하나 — 이미 있으면 created=false 로 그 매장을 돌려준다. 매장·시간대·영업규칙·설정을 한 트랜잭션으로 만들고 셋이 다 생겼는지 확인한다.';
revoke execute on function public.create_store(text, text) from public, anon;
grant  execute on function public.create_store(text, text) to authenticated, service_role;

-- ── ④ 백필 보존 — 문을 안 지난 규칙만 표시 폼에 맞춘다 ──────────
update public.operating_rules r
   set weekly_hours = (select jsonb_object_agg(d::text, jsonb_build_object(
                                'open',   s.open_time::text,
                                'close',  s.close_time::text,
                                'closed', coalesce((r.weekly_hours -> d::text ->> 'closed')::boolean, false)))
                         from generate_series(0, 6) d),
       weekly_breaks = case when s.break_start is null or s.break_end is null then r.weekly_breaks
                            else (select jsonb_object_agg(d::text, jsonb_build_object(
                                           'start', s.break_start::text, 'end', s.break_end::text))
                                    from generate_series(0, 6) d) end
  from public.settings s
 where s.store_id = r.store_id
   and r.effective_to is null
   -- 문(0159)을 한 번도 안 지난 규칙만이다. 지난 규칙은 사장님이 정한 값이다.
   and r.revision = 1
   and s.open_time is not null and s.close_time is not null
   and (r.weekly_hours -> '1' ->> 'open') is distinct from s.open_time::text;

-- ── ⑤ 사후조건 ──────────────────────────────────────────────────
do $$
declare
  v_n int;
  v_def text;
begin
  select count(*) into v_n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
          or has_table_privilege('anon', c.oid, 'TRUNCATE')
          or has_table_privilege('authenticated', c.oid, 'TRIGGER')
          or has_table_privilege('authenticated', c.oid, 'REFERENCES'));
  if v_n > 0 then
    raise exception '0166: %개 테이블에 TRUNCATE/TRIGGER/REFERENCES 가 남아 있습니다', v_n;
  end if;

  -- 미래 테이블 — 기본 권한이 실제로 걸렸는지 만들어서 본다(만들고 지운다).
  create table public._acl_probe_0166 (id int);
  if has_table_privilege('authenticated', 'public._acl_probe_0166', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public._acl_probe_0166', 'TRIGGER')
     or has_table_privilege('authenticated', 'public._acl_probe_0166', 'REFERENCES') then
    drop table public._acl_probe_0166;
    raise exception '0166: 새로 만든 테이블이 아직 TRUNCATE/TRIGGER/REFERENCES 로 열립니다';
  end if;
  drop table public._acl_probe_0166;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'create_store';
  if position('''created'', v_new' in v_def) = 0 or position('advisory' in v_def) = 0 then
    raise exception '0166: create_store 가 단일 매장 계약을 안 지킵니다';
  end if;

  -- 백필 보존 — 문을 안 지난 규칙이 표시 폼과 어긋난 매장이 없다.
  select count(*) into v_n
    from public.operating_rules r join public.settings s on s.store_id = r.store_id
   where r.effective_to is null and r.revision = 1
     and s.open_time is not null
     and (r.weekly_hours -> '1' ->> 'open') is distinct from s.open_time::text;
  if v_n > 0 then
    raise exception '0166: 규칙과 표시 폼이 어긋난 매장이 %개 있습니다', v_n;
  end if;
end $$;
