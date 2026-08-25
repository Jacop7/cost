-- ════════════════════════════════════════════════════════════════
-- 0119 · 화면이 판본을 알아야 하고, 부족 검사는 못 쟀으면 못 쟀다고 해야 한다
--
-- ① `sales_day` 가 `revision` 을 안 준다
--    0117 이 판본 검사를 넣었지만, 화면이 그 값을 받을 길이 없으면 되보낼 수도 없다.
--    조회에 실어 준다.
--
-- ② `sale_shortages` 가 **못 쟀을 때도 0 건이라고 답한다**
--    필요량은 그날 스냅샷에서 온다(`day_ingredient_needs`). 영업을 시작하기 전에는
--    스냅샷이 없으니 필요량이 전부 0 이고, 결과는 `부족 0건` 이다.
--    "재고가 넉넉하다"와 "아직 잴 수 없다"가 **같은 답으로 나온다.**
--
--    실제로 이 구멍으로 경고가 통째로 새어 나갔다 —
--      영업 전에 판매를 누르면 45001 로 막히고, 영업을 시작한 뒤 그대로 재시도한다.
--      그런데 첫 검사는 스냅샷이 없을 때 이미 `0건` 을 받아 놨다.
--      재시도 경로가 검사를 다시 안 하므로, 부족한 채로 조용히 저장된다.
--
--    서버가 `has_basis` 로 사실을 말한다. 화면은 이게 false 면 `0건` 을 믿지 않는다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 조회에 판본을 싣는다 ────────────────────────────────────
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sales_day';

  if v_def is null then
    raise exception '0119: sales_day 가 없습니다' using errcode = '45003';
  end if;
  if position($x$'revision'$x$ in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$    'daily_sales_id', ds.id,$x$,
    $x$    'daily_sales_id', ds.id,
    -- 화면은 이 값을 들고 있다가 저장할 때 되보낸다(0117). 없으면 낡은 저장을 못 막는다.
    'revision', coalesce(ds.revision, 0),$x$);
  if v_new = v_def then
    raise exception '0119: sales_day 머리를 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;


-- ── ② 부족 검사가 못 쟀으면 못 쟀다고 말한다 ──────────────────
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sale_shortages';

  if v_def is null then
    raise exception '0119: sale_shortages 가 없습니다' using errcode = '45003';
  end if;
  if position($x$'has_basis'$x$ in v_def) > 0 then return; end if;

  v_new := replace(v_def,
    $x$    'mode', 'sale',$x$,
    $x$    'mode', 'sale',
    -- ⚠ 그날 스냅샷이 있어야 필요량을 잴 수 있다. 없으면 이 함수의 `0건` 은
    --   "넉넉하다"가 아니라 **"못 쟀다"** 는 뜻이다. 화면이 둘을 구별해야 한다.
    'has_basis', coalesce(jsonb_typeof(day_snapshot(p_store, p_date) -> 'recipes') = 'object'
                          and (select count(*) > 0
                                 from jsonb_each(day_snapshot(p_store, p_date) -> 'recipes')), false),$x$);
  if v_new = v_def then
    raise exception '0119: sale_shortages 머리를 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare v_d text; v_s text;
begin
  select pg_get_functiondef(p.oid) into v_d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sales_day';
  select pg_get_functiondef(p.oid) into v_s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sale_shortages';

  if position($x$'revision'$x$ in v_d) = 0 then
    raise exception '0119: sales_day 에 판본이 안 실렸습니다' using errcode = '45003';
  end if;
  if position('summary' in v_d) = 0 or position('etc_items' in v_d) = 0 then
    raise exception '0119: sales_day 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
  if position($x$'has_basis'$x$ in v_s) = 0 then
    raise exception '0119: sale_shortages 에 기준 여부가 안 실렸습니다' using errcode = '45003';
  end if;
  if position('day_ingredient_needs' in v_s) = 0 or position('ingredient_count' in v_s) = 0 then
    raise exception '0119: sale_shortages 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
