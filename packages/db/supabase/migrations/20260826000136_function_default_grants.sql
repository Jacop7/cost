-- ════════════════════════════════════════════════════════════════
-- 0136 · 앞으로 만들 함수의 기본 권한을 **실제로** 좁힌다
--
-- ⚠ 먼저 0135 의 설명을 바로잡는다. 거기 이렇게 적었다 —
--     "새 DB 에 기본값을 먼저 깔아도 PUBLIC 이 그대로 붙는다 — template 의 기본값이 이긴다"
--   **틀렸다.** template 과 무관하다. 진짜 이유는 이것이다:
--
--     `alter default privileges IN SCHEMA public revoke execute on functions from public`
--     는 **스키마별** 기본값만 건드린다. 그런데 함수의 `PUBLIC EXECUTE` 는 PostgreSQL 의
--     **전역** 기본값이라 스키마를 지정하면 안 걷힌다. `IN SCHEMA` 를 빼야 한다.
--
--   그리고 anon 은 Supabase 가 넣어 둔 **스키마별** 기본값이라 그건 `IN SCHEMA` 로 걷어야 한다.
--   둘의 층이 달라서 한 문장으로는 안 되고, 실제로 0135 는 절반만 걷었다.
--
--   틀린 설명을 남겨 두면 다음 사람이 "template 문제니까 어쩔 수 없다"고 읽는다.
--   그래서 고치는 김에 이유도 같이 적는다.
--
-- 실측 —
--     IN SCHEMA 만  : PUBLIC=true  anon=true
--     교정 후       : PUBLIC=false anon=false auth=true svc=true
-- ════════════════════════════════════════════════════════════════

-- ── ① 전역 기본값에서 PUBLIC 을 뺀다 (IN SCHEMA 없이) ───────────
alter default privileges for role postgres
  revoke execute on functions from public;

-- ── ② 스키마별 기본값에서 anon 을 뺀다 (IN SCHEMA 로) ───────────
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema extensions
  revoke execute on functions from anon;

-- ── ③ 쓸 롤에만 준다 ────────────────────────────────────────────
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated, service_role;


-- ── ④ 지금 있는 함수는 방어선으로 한 번 더 ──────────────────────
-- 기본값은 **앞으로** 만들어질 함수 이야기다. 지금 것은 따로 걷어야 한다(0135 가 했다).
-- 다시 해도 해가 없고, 0135 와 0136 사이에 만들어진 것이 있으면 여기서 걸린다.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated, service_role;


-- ── ⑤ 청소 실패를 삼키지 않는다 ─────────────────────────────────
/*
 * `open_business_day` 가 청소를 `exception when others then null` 로 감싸고 있었다.
 * 영업 시작을 막지 않으려는 뜻은 맞다 — 청소는 곁일이다.
 * 그런데 **아무 데도 안 남기면** "왜 오래된 수정 내역이 안 지워지지" 를 추적할 수 없다.
 * 막지는 않되 서버 로그에는 남긴다.
 *
 * ⚠ 정기 청소 경로는 pg_cron 단계에서 따로 붙인다. 영업 시작에만 매달려 있으면
 *   한동안 문을 안 연 매장은 영영 안 지워진다.
 */
do $m$
declare
  v_def text;
  v_old text := '  begin perform purge_entity_changes(); exception when others then null; end;';
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_business_day';
  if v_def is null then raise exception '0136: open_business_day 가 없습니다'; end if;

  if position('수정 내역 청소 실패' in v_def) > 0 then return; end if;   -- 이미 적용됨
  if position(v_old in v_def) = 0 then
    raise exception '0136: open_business_day 의 청소 호출을 못 찾았습니다';
  end if;

  v_new := concat_ws(chr(10),
    '  begin',
    '    perform purge_entity_changes();',
    '  exception when others then',
    '    -- 청소가 실패해도 영업 시작은 막지 않는다(곁일이다). 다만 삼키지도 않는다 —',
    '    -- 로그에 안 남기면 "왜 안 지워지지" 를 추적할 방법이 없다(0136).',
    '    raise warning ''수정 내역 청소 실패: % (%)'', sqlerrm, sqlstate;',
    '  end;');

  execute replace(v_def, v_old, v_new);
end $m$;


-- ── 사후 확인 ────────────────────────────────────────────────────
/*
 * ⚠ 권한 값을 읽는 것만으로는 부족하다. 0135 의 확인이 딱 그래서 통과했다 —
 *   "지금 있는 함수에 anon 이 없다"는 맞았고, "앞으로 만들 함수"는 안 봤다.
 *   그래서 여기서는 **함수를 진짜로 하나 만들어** 본다.
 */
do $v$
declare v_pub boolean; v_anon boolean; v_auth boolean; v_svc boolean;
begin
  create function public.zz_default_grant_probe() returns int language sql as 'select 1';

  -- `has_function_privilege('public', …)` 가 PUBLIC pseudo-role 을 그대로 본다.
  v_pub  := has_function_privilege('public', 'public.zz_default_grant_probe()', 'execute');
  v_anon := has_function_privilege('anon', 'public.zz_default_grant_probe()', 'execute');
  v_auth := has_function_privilege('authenticated', 'public.zz_default_grant_probe()', 'execute');
  v_svc  := has_function_privilege('service_role', 'public.zz_default_grant_probe()', 'execute');

  drop function public.zz_default_grant_probe();

  if v_pub then raise exception '0136: 새 함수에 PUBLIC 실행 권한이 붙습니다'; end if;
  if v_anon then raise exception '0136: 새 함수에 anon 실행 권한이 붙습니다'; end if;
  if not v_auth then raise exception '0136: 새 함수를 인증 사용자가 못 부릅니다'; end if;
  if not v_svc then raise exception '0136: 새 함수를 service_role 이 못 부릅니다'; end if;
end $v$;

do $v$
declare v_n int; v_def text;
begin
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'execute');
  if v_n > 0 then raise exception '0136: anon 이 부를 수 있는 함수가 %개 남았습니다', v_n; end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'open_business_day';
  if position('raise warning' in v_def) = 0 then
    raise exception '0136: 청소 실패가 아직 조용합니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
