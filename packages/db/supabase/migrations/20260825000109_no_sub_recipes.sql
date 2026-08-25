-- ════════════════════════════════════════════════════════════════
-- 0109 · 반제품은 1차 범위 밖이다 — 예약을 기능처럼 쓰지 않는다
--
-- 사장님: "현재 앱 기획에는 반제품 기능이 없습니다. `sub_recipe_id` 는 2차 기능을
--          위해 예약했던 DB 잔재입니다. 이후 마이그레이션에서 이 예약 구조를
--          실제 기능처럼 확장해 버린 상태입니다."
--
-- 맞다. 읽는 쪽이 조용히 자라 있었다 —
--     recipe_ingredient_needs   하위 레시피로 재귀(깊이 5)
--     recipe_material_cost      같은 재귀
--     recipe_detail             하위 레시피 이름·원가를 조인
--     recipe_snapshot_entry     0098 에서 위 재귀를 스냅샷에까지 끌어왔다
--
-- 측정: `recipe_lines` 34줄 중 `sub_recipe_id` 가 있는 줄은 **0개**다.
--       그래서 지금은 전부 안 돌아가는 길이고, 값이 달라지는 곳도 없다.
--
-- ⚠ 그래서 읽는 쪽을 **지금 뜯지 않는다.** 소진·원가·스냅샷이 전부 걸려 있어
--   한 번에 들어내면 검산값(제육볶음 2,806.40 등)까지 흔들 수 있다.
--   대신 **데이터가 절대 생기지 않게** 막는다. 데이터가 없으면 그 길은 죽은 길이다.
--
--   ① 쓰기를 막는다 — save_recipe 가 거부한다
--   ② 저장을 막는다 — 제약으로 못 들어가게 한다
--
-- 2차에서 반제품을 열 때는 이 제약을 지우는 것부터 시작하면 된다.
-- 그때 이 파일이 "무엇을 다시 켜야 하는지" 목록이 된다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 저장 자체를 막는다 ──────────────────────────────────────
-- ⚠ 컬럼은 **지우지 않는다.** 지우면 2차에서 되살릴 때 타입·외래키를 다시 짜야 하고,
--   그 사이 이 컬럼을 읽는 함수 넷이 한꺼번에 깨진다. 비워 두는 것으로 충분하다.
alter table recipe_lines
  drop constraint if exists recipe_lines_no_sub_recipe;

alter table recipe_lines
  add constraint recipe_lines_no_sub_recipe
  check (sub_recipe_id is null and ingredient_id is not null);

comment on column recipe_lines.sub_recipe_id is
  '반제품(하위 레시피) 자리 — **1차에서는 항상 null 이다**(0109). '
  '2차 예약 컬럼이며 recipe_lines_no_sub_recipe 제약이 값이 들어가는 걸 막는다. '
  '읽는 쪽(recipe_ingredient_needs · recipe_material_cost · recipe_detail · '
  'recipe_snapshot_entry)에 재귀 경로가 남아 있지만 데이터가 없어 돌지 않는다. '
  '2차에서 열 때는 이 제약을 지우는 것부터 시작한다.';


-- ── ② 쓰기 경로에서 먼저 거부한다 ─────────────────────────────
-- 제약만 두면 오류 메시지가 `23514 check constraint` 로 나온다. 사장님 말로 돌려준다.
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_recipe';

  if v_def is null then
    raise exception '0109: save_recipe 가 없습니다' using errcode = '45003';
  end if;
  if position('반제품은 아직 쓸 수 없어요' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  --   자기 자신 참조를 막던 줄 **앞에** 한 줄을 더 세운다.
  v_new := replace(v_def,
    $x$        if nullif(v_line->>'sub_recipe_id','')::uuid = v_id then$x$,
    $x$        if nullif(v_line->>'sub_recipe_id','') is not null then raise exception '반제품은 아직 쓸 수 없어요' using errcode = '22000'; end if;
        if nullif(v_line->>'sub_recipe_id','')::uuid = v_id then$x$);
  if v_new = v_def then
    raise exception '0109: 반제품 줄을 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

-- 되읽어서 확인한다. execute 가 성공했다고 원하는 함수가 된 건 아니다(0102 의 교훈).
do $chk$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_recipe';
  if position('반제품은 아직 쓸 수 없어요' in v_def) = 0 then
    raise exception '0109: 반제품 거부가 안 들어갔습니다' using errcode = '45003';
  end if;
  -- 자기 자신 참조 가드는 남아 있어야 한다 — 2차에서 반제품을 열면 다시 필요하다.
  if position('메뉴가 자기 자신을 재료로 쓸 수 없어요' in v_def) = 0 then
    raise exception '0109: 자기참조 가드를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
