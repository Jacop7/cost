-- ════════════════════════════════════════════════════════════════
-- 0143 · 0142 의 조기 반환이 **바로 그 사고를 재현할 수 있다**
--
-- 0142 는 이렇게 생겼다 —
--     응답 키 넷을 지운다 → 지운 게 0개면 `return` → (밖에서) auto_close_due 삭제
--
-- 그런데 "응답 키는 이미 없는데 **호출만 남은**" 상태에서 이 마이그레이션이 돌면,
-- 조기 반환이 호출 제거를 건너뛰고 그다음 `drop function` 이 실행된다.
-- 결과는 `business_day_state` 가 없는 함수를 부르는 상태 — **판매 화면이 통째로 죽는다.**
-- 0142 를 만들다가 실제로 겪은 그 상태다. 그걸 막으려고 넣은 코드가 그 상태를
-- 다시 만들 수 있게 생긴 셈이다.
--
-- ⚠ 0142 는 이미 푸시됐으므로 고치지 않는다. 여기서 **결과를 보장**한다 —
--   조건 없이 호출·변수를 걷고, 없어야 할 키 **넷 전부**를 확인한다.
--   `due` 가 0142 의 확인 배열에서 빠져 있었던 것도 여기서 메운다.
--
-- 이 마이그레이션은 몇 번을 돌려도 같다.
-- ════════════════════════════════════════════════════════════════

do $m$
declare v_def text; v_line text; v_changed boolean := false;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';
  if v_def is null then raise exception '0143: business_day_state 가 없습니다'; end if;

  -- ① 응답 키 넷. `due` 도 포함한다(0142 확인 배열이 빠뜨렸다).
  for v_line in
    select line
      from regexp_split_to_table(v_def, chr(10)) as line
     where line ~ '''(auto_close_at|past_planned|warn_soon|due)'''
       and btrim(line) not like '--%'
  loop
    v_def := replace(v_def, v_line || chr(10), '');
    v_changed := true;
  end loop;

  /*
   * ② 호출과 변수. **조건 없이** 돈다 —
   *   ①에서 지운 게 없더라도 여기는 지나가야 한다. 그게 0142 의 구멍이었다.
   */
  for v_line in
    select line
      from regexp_split_to_table(v_def, chr(10)) as line
     where line like '%auto_close_due(%'
        or line ~ '^\s*v_due\s+jsonb;'
  loop
    v_def := replace(v_def, v_line || chr(10), '');
    v_changed := true;
  end loop;

  if v_changed then execute v_def; end if;
end $m$;

drop function if exists public.auto_close_due(uuid);


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text; v_key text;
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'auto_close_due') then
    raise exception '0143: auto_close_due 가 남았습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';

  -- 없어야 할 키 **넷**. 따옴표까지 붙여 정확히 본다 — `due` 만 맨몸으로 찾으면
  -- `auto_close_due`·`v_due` 같은 것에 걸린다.
  foreach v_key in array array['''auto_close_at''', '''past_planned''',
                               '''warn_soon''', '''due'''] loop
    if exists (
      select 1 from regexp_split_to_table(v_def, chr(10)) as line
       where line like '%' || v_key || '%' and btrim(line) not like '--%')
    then
      raise exception '0143: business_day_state 가 아직 % 를 줍니다', v_key;
    end if;
  end loop;

  -- 호출도 남으면 안 된다. 이게 이 마이그레이션의 요지다.
  if exists (
    select 1 from regexp_split_to_table(v_def, chr(10)) as line
     where line like '%auto_close_due%' and btrim(line) not like '--%')
  then
    raise exception '0143: business_day_state 가 아직 auto_close_due 를 부릅니다';
  end if;

  -- 남겨야 할 키는 그대로다.
  foreach v_key in array array['''status''', '''business_date''', '''local_date''',
                               '''planned_close_at''', '''closed_at''', '''close_method''',
                               '''hours'''] loop
    if position(v_key in v_def) = 0 then
      raise exception '0143: business_day_state 에서 % 키가 사라졌습니다', v_key;
    end if;
  end loop;
end $v$;

select public.assert_no_rpc_overloads();
