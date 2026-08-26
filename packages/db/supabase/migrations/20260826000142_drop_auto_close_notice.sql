-- ════════════════════════════════════════════════════════════════
-- 0142 · 자동 마감 **사전 예고**도 껍데기였다
--
-- `business_day_state` 가 네 값을 준다 —
--     auto_close_at · past_planned · warn_soon · due
-- 앱에는 타입 선언과 파싱만 있고 **그리는 자리가 하나도 없다.** 세어 봤다:
--     autoCloseAt 0 · pastPlanned 0 · warnSoon 0 · due 0 (businessDay.ts 밖 사용처)
-- 그리고 `auto_close_due()` 는 사실상 이 응답을 만들려고만 존재한다
--     (부르는 곳: business_day_state 하나).
--
-- 기획서 §6.1 의 `영업 중` 규격에도 그런 예고가 없다 — 카드에는
--     `영업일 + 시간 + 상태/행동` 한 줄
-- 뿐이고, "영업을 종료할까요?" 나 "10분 후 자동 종료돼요" 는 어디에도 없다.
-- §5-4 가 확인 배너를 없앤 것과 같은 결정이다.
--
-- 0141 에서 확인 배너를 지운 것과 **같은 기준**으로 함께 지운다.
-- 남겨 두면 다음 사람이 "쓰다 만 기능" 으로 읽고 되살린다.
--
-- ⚠ 남기는 것: `planned_close_at`(화면이 `11:00–22:00` 을 그리는 근거) ·
--   `closed_at` · `close_method`. 이건 실제로 그려진다.
--
-- ⚠ 60초 재조회는 그대로 둔다. 이제 그 목적은 **크론이 닫은 상태를 따라잡는 것**이다 —
--   예고를 갱신하려던 게 아니다.
-- ════════════════════════════════════════════════════════════════

do $m$
declare v_def text; v_line text; v_n int := 0;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';
  if v_def is null then raise exception '0142: business_day_state 가 없습니다'; end if;

  -- 응답 조립에서 네 줄을 걷어낸다. 한 줄씩 지운다(여러 줄을 묶으면 공백 하나에 어긋난다).
  for v_line in
    select line
      from regexp_split_to_table(v_def, E'\n') as line
     where line ~ '''(auto_close_at|past_planned|warn_soon|due)'''
       and btrim(line) not like '--%'
  loop
    v_def := replace(v_def, v_line || E'\n', '');
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then return; end if;   -- 이미 적용됨
  if v_n <> 4 then
    raise exception '0142: 걷어낸 줄이 %개입니다 — 4개여야 합니다', v_n;
  end if;

  /*
   * ⚠ 응답 줄만 지우면 **호출이 남는다.** 처음에 그렇게 했다가 `business_day_state` 가
   *   `auto_close_due` 를 계속 부르는 채로 그 함수를 지워, 판매 화면이 통째로 죽었다.
   *   값을 만드는 자리와 쓰는 자리를 **같이** 걷어야 한다.
   */
  for v_line in
    select line
      from regexp_split_to_table(v_def, chr(10)) as line
     where line like '%auto_close_due(%' or line ~ '^\s*v_due\s+jsonb;'
  loop
    v_def := replace(v_def, v_line || chr(10), '');
  end loop;

  if position('auto_close_due' in v_def) > 0 then
    raise exception '0142: business_day_state 가 아직 auto_close_due 를 부릅니다';
  end if;

  execute v_def;
end $m$;

comment on function public.business_day_state(uuid) is
  '매출 화면이 한 번에 읽는 영업일 상태 — 상태·영업시간·예정 종료(0057·0142). 자동 마감 사전 예고와 미확인 알림은 기획에서 빠져 함께 걷어냈다.';

-- 이 응답을 만들려고만 있던 함수다.
drop function if exists public.auto_close_due(uuid);


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_def text; v_key text;
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'auto_close_due') then
    raise exception '0142: auto_close_due 가 남았습니다';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'business_day_state';

  -- 지운 키가 **코드에** 남아 있으면 안 된다(주석은 뺀다 — 일곱 번째다).
  foreach v_key in array array['auto_close_at', 'past_planned', 'warn_soon'] loop
    if exists (
      select 1 from regexp_split_to_table(v_def, E'\n') as line
       where line like '%' || v_key || '%' and btrim(line) not like '--%')
    then
      raise exception '0142: business_day_state 가 아직 % 를 줍니다', v_key;
    end if;
  end loop;

  -- 남겨야 할 키는 그대로다.
  foreach v_key in array array['''status''', '''business_date''', '''local_date''',
                               '''planned_close_at''', '''closed_at''', '''close_method'''] loop
    if position(v_key in v_def) = 0 then
      raise exception '0142: business_day_state 에서 % 키가 사라졌습니다', v_key;
    end if;
  end loop;
end $v$;

select public.assert_no_rpc_overloads();
