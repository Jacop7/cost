-- ════════════════════════════════════════════════════════════════
-- 0088 · 세금 저장 → 전 레시피 손익 변동에 기록 (0087 의 뒷부분)
--
-- ⚠ 0087 과 나눈 이유: `alter type ... add value` 로 넣은 enum 값은
--   **같은 트랜잭션 안에서 쓸 수 없다.** 한 파일에 두면 마이그레이션이 터진다.
--
-- 고정지출(E4)과 같은 짜임이다 —
--   저장 → 전 레시피 재계산 → 손익 변동 한 줄씩 + 수정 내역 한 묶음.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 세금 원인의 제목 ───────────────────────────────────────
create or replace function public.profit_event_title(p_source_type text, p_label text)
returns text language sql immutable as $fn$
  select case p_source_type
    when 'ingredient' then coalesce(p_label || ' 단가 반영', '식재료 단가 반영')
    when 'fixed_cost' then '고정지출 반영'
    when 'tax'        then '세금 반영'
    else '레시피 수정' end;
$fn$;


-- ── 2. recompute_recipe 가 'tax' 를 알아듣게 ──────────────────
-- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 이 파일의 CRLF 와
--   pg_get_functiondef() 의 LF 가 어긋나 절대 안 맞는다(0084 에서 걸렸다).
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recompute_recipe';

  if v_def is null then
    raise exception '0088: recompute_recipe 가 없습니다' using errcode = '45003';
  end if;
  if position($x$when 'tax' then 'tax'$x$ in v_def) > 0 then return; end if;

  v_new := replace(v_def,
    $x$  v_type := case p_cause when 'material' then 'ingredient'$x$,
    $x$  v_type := case p_cause when 'tax' then 'tax' when 'material' then 'ingredient'$x$);
  if v_new = v_def then
    raise exception '0088: recompute_recipe 의 v_type 분기를 못 찾았습니다' using errcode = '45003';
  end if;
  v_def := v_new;

  -- 세금 원인의 부제. 고정지출이 '고정지출 설정' 이듯 세금은 '세금 설정' 이다.
  v_new := replace(v_def,
    $x$  v_label := case p_cause$x$,
    $x$  v_label := case p_cause when 'tax' then '세금 설정'$x$);
  if v_new = v_def then
    raise exception '0088: recompute_recipe 의 v_label 분기를 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;


-- ── 3. 레시피의 세금은 **매장 설정을 따른다** ─────────────────
-- save_recipe 본문을 조각내 고치는 대신 트리거로 못 박는다.
-- 그래야 어느 경로로 써도(앱·관리자·마이그레이션) 어긋날 수 없다 —
-- 절대원칙 2 와 같은 이유: 값이 바뀌는 길은 하나여야 한다.
create or replace function public.recipes_tax_from_store()
returns trigger language plpgsql as $fn$
declare v_mode tax_mode; v_items jsonb;
begin
  select s.tax_mode, s.tax_items into v_mode, v_items
    from settings s where s.store_id = new.store_id;

  -- 설정이 아직 없는 매장이면 들어온 값을 그대로 둔다. null 로 덮으면 NOT NULL 이 터진다.
  if found then
    new.tax_mode  := v_mode;
    new.tax_items := v_items;
  end if;
  return new;
end;
$fn$;

drop trigger if exists recipes_tax_from_store_trg on recipes;
create trigger recipes_tax_from_store_trg
  before insert or update on recipes
  for each row execute function public.recipes_tax_from_store();

comment on function public.recipes_tax_from_store() is
  '레시피의 세금은 매장 설정(settings.tax_*)을 따른다(0087). 레시피마다 다르게 둘 수 없다.';

-- 레시피별 세금 항목 저장 RPC 는 이제 갈 곳이 없다.
drop function if exists public.save_recipe_tax_items(uuid, uuid, jsonb);


-- ── 4. 세금 저장 ──────────────────────────────────────────────
create or replace function public.save_store_tax(
  p_store uuid,
  p_mode  tax_mode,
  p_items jsonb default '[]'::jsonb
) returns jsonb language plpgsql as $fn$
declare
  v_mode0  tax_mode;
  v_items0 jsonb;
  v_items  jsonb;
  v_day    date := business_day();
  v_month  text := to_char(business_day(), 'YYYY-MM');
  v_rate   numeric;
  v_corr   uuid := gen_random_uuid();
  v_ext    numeric;
  v_t0     numeric;
  v_t1     numeric;
  rec      record;
  v_n      int := 0;
begin
  perform assert_my_store(p_store);
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
$fn$;

comment on function public.save_store_tax(uuid, tax_mode, jsonb) is
  '매장 세금 저장 + 전 레시피 전파(0087). 세금이 바뀌는 **유일한 길**이다. 고정지출(E4)과 같은 짜임.';


-- ── 5. 설정 읽기에 세금을 얹는다 ──────────────────────────────
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_settings';

  if v_def is null then
    raise exception '0088: get_settings 가 없습니다' using errcode = '45003';
  end if;
  if position('tax_mode' in v_def) > 0 then return; end if;

  v_new := replace(v_def,
    $x$    'locale', s.locale,$x$,
    $x$    'locale', s.locale, 'tax_mode', s.tax_mode, 'tax_items', s.tax_items,$x$);
  if v_new = v_def then
    raise exception '0088: get_settings 의 locale 줄을 못 찾았습니다' using errcode = '45003';
  end if;
  execute v_new;
end
$mig$;

select public.assert_no_rpc_overloads();
