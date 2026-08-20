-- ════════════════════════════════════════════════════════════════
-- 0080 · 옛 시그니처를 지우고, 오버로드 가드를 넓힌다
--
-- 0078 이 `change_line` 과 `record_entity_change` 에 인자를 하나씩 더하면서
-- **옛 시그니처가 그대로 남았다.** `create or replace` 는 인자가 다르면
-- 교체가 아니라 새 함수를 만든다.
--
--   change_line('name', '이름', v_before.name, v_name)
--   → ERROR: function change_line(unknown, unknown, text, text) is not unique
--
-- ⚠ 더 나쁜 건 `assert_no_rpc_overloads()` 가 이걸 **통과시켰다**는 것이다.
--   가드가 전파 RPC 이름 패턴(`e1_`, `recompute_recipe`, …)만 보고 있었다.
--   오늘 두 번 "clean" 이라고 말해 놓고 두 번 다 오버로드가 남아 있었다.
--   가드가 못 잡는 가드는 없느니만 못하다 — public 전체를 본다.
-- ════════════════════════════════════════════════════════════════

drop function if exists public.change_line(text, text, anyelement, anyelement, text);
drop function if exists public.record_entity_change(
  uuid, text, uuid, change_source, text, jsonb, boolean, uuid, uuid);

-- ── 가드를 public 전체로 ──────────────────────────────────────
create or replace function public.assert_no_rpc_overloads()
returns void language plpgsql stable as $fn$
declare r record; msg text := '';
begin
  for r in
    select p.proname, count(*) as c,
           string_agg(pg_get_function_identity_arguments(p.oid), E'\n      ') as sigs
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       -- ⚠ 여기에 이름을 넣는 순간 "일부러 둘"이라는 뜻이다. 지금은 하나도 없다.
       and p.proname <> all (array[]::text[])
     group by p.proname having count(*) > 1
  loop
    msg := msg || format(E'\n  %s (%s개)\n      %s', r.proname, r.c, r.sigs);
  end loop;

  if msg <> '' then
    -- ⚠ raise 의 서식 문자열은 하나여야 한다. 이어 붙이면 문법 오류다.
    raise exception E'함수 오버로드 발견 — 호출부가 어느 쪽을 부르는지 알 수 없다:%

인자를 더할 때는 옛 시그니처를 drop 해야 한다. create or replace 는 인자가 다르면 새 함수를 만든다.', msg;
  end if;
end;
$fn$;

comment on function public.assert_no_rpc_overloads() is
  'public 스키마 전체에서 같은 이름의 함수가 둘 이상인지 본다(0080). '
  '전에는 전파 RPC 이름만 봐서 다른 오버로드를 놓쳤다.';

select public.assert_no_rpc_overloads();
