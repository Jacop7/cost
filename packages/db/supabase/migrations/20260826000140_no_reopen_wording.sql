-- ════════════════════════════════════════════════════════════════
-- 0140 · 없는 길을 안내하지 않는다
--
-- 종료된 장부에 판매를 저장하면 서버가 이렇게 말했다 —
--     "영업은 종료됐어요. **고치려면 영업 기록을 다시 열어 주세요**"
--
-- 그런데 0139 부터 다시 여는 길은 없다. 기획서 §6.4 가 그렇게 정했다 —
--     "종료된 장부를 다시 열지 않는다. 정정 RPC 로 수정한다."
-- 정정 RPC(`amend_ended_business_day`)는 아직 없다.
--
-- 그래서 지금 저 문구는 **존재하지 않는 경로를 시키는 말**이다. 사장님은 화면을 뒤지며
-- "다시 열기" 버튼을 찾다가 못 찾는다. 없는 길을 알려 주느니 사실만 말하는 게 낫다.
--
-- ⚠ 앱의 `isClosedError` 가 이 문구로 판별한다. 공통 조각을 `영업이 종료되어` 로 옮기고
--   앱도 같이 고친다 — 한쪽만 바꾸면 화면이 오류를 못 알아본다.
-- ════════════════════════════════════════════════════════════════

do $m$
declare
  r      record;
  v_def  text;
  v_old  text := '영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요';
  v_new  text := '영업이 종료되어 판매를 저장할 수 없어요';
  v_n    int := 0;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and position(v_old in pg_get_functiondef(p.oid)) > 0
     order by p.proname
  loop
    v_def := pg_get_functiondef(r.oid);
    execute replace(v_def, v_old, v_new);
    v_n := v_n + 1;
    raise notice '0140: % 문구 교체', r.proname;
  end loop;

  if v_n = 0 then
    raise exception '0140: 바꿀 문구를 가진 함수가 하나도 없습니다 — 이미 바뀌었거나 조각이 틀렸습니다';
  end if;
end $m$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_names text;
begin
  -- 옛 문구가 **코드에** 남아 있으면 안 된다(주석은 뺀다 — 여섯 번째 교훈이다).
  select string_agg(distinct p.proname, ', ') into v_names
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'\n') as line
   where n.nspname = 'public' and p.prokind = 'f'
     and line like '%다시 열어 주세요%'
     and btrim(line) not like '--%';
  if v_names is not null then
    raise exception '0140: 옛 문구가 남은 함수 — %', v_names;
  end if;

  -- 새 문구는 실제로 붙었는가.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'save_sale'
       and position('영업이 종료되어 판매를 저장할 수 없어요' in pg_get_functiondef(p.oid)) > 0)
  then
    raise exception '0140: save_sale 에 새 문구가 없습니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
