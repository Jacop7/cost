-- ════════════════════════════════════════════════════════════════
-- 0091 · 기타 매출에도 세금이 붙는다
--
-- 사장님: "세금이 안 맞는데. 마이페이지에서 설정한 것과"
--
-- 실측(2026-08-22):
--     메뉴 매출  383,500 × 9.0909% = 34,864
--     기타 매출  146,000 × 0%      =      0   ← 여기가 빠져 있었다
--     화면 표시  34,864 / 529,500  = 6.6%    ← 설정한 9.09% 와 안 맞는다
--
-- 주류·음료도 과세 대상이다. 기타 매출만 세금을 안 물면 순이익이 부풀려진다.
-- 오늘 하루만 13,273원이다.
--
-- ⚠ **판매 시점에 얼린다.** 메뉴는 `daily_sales_items.unit_tax` 로 이미 그렇게
--   하고 있다(0052) — 세금 항목을 나중에 고쳐도 지난 장부가 안 움직인다.
--   기타 매출도 같아야 하므로 `daily_sales.etc_tax` 에 그때 금액을 적어 둔다.
--   집계 때 현재 요율을 곱하면, 요율을 한 번 고칠 때마다 지난달 장부가 통째로 흔들린다.
-- ════════════════════════════════════════════════════════════════

alter table daily_sales
  add column if not exists etc_tax numeric not null default 0;

comment on column daily_sales.etc_tax is
  '기타 매출에 붙은 세금. **저장 시점 요율로 얼린다**(0091) — daily_sales_items.unit_tax 와 같은 이유.';

-- ── 이미 쌓인 날 ─────────────────────────────────────────────
-- 지난 장부에 세금이 0으로 잡혀 있던 건 그 날의 사실이 아니라 **빠뜨린 것**이다.
-- 그래서 지금 요율로 채운다. 이후로는 저장 시점 요율이 그대로 얼어붙는다.
update daily_sales ds
   set etc_tax = round(ds.etc_revenue * coalesce(
         (select sum((i->>'rate')::numeric) / 100 from settings s,
                 jsonb_array_elements(s.tax_items) i
           where s.store_id = ds.store_id and coalesce((i->>'rate')::numeric, 0) > 0), 0), 2)
 where ds.etc_revenue > 0 and ds.etc_tax = 0;


-- ── 저장할 때 얼린다 ─────────────────────────────────────────
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';

  if v_def is null then
    raise exception '0091: save_sale 이 없습니다' using errcode = '45003';
  end if;
  if position('etc_tax' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 이 파일의 CRLF 와
  --   pg_get_functiondef() 의 LF 가 어긋나 안 맞는다(0084 에서 걸렸다).
  v_new := replace(v_def,
    $x$      update daily_sales set etc_items = p_etc_items, etc_revenue = v_etc, updated_at = now()$x$,
    $x$      update daily_sales set etc_items = p_etc_items, etc_revenue = v_etc, etc_tax = round(v_etc * store_tax_rate(p_store), 2), updated_at = now()$x$);
  if v_new = v_def then
    raise exception '0091: save_sale 의 기타 매출 갱신 줄을 못 찾았습니다' using errcode = '45003';
  end if;
  execute v_new;
end
$mig$;

/** 매장 세금 요율(0~1). 세금 계산이 두 벌이 되지 않게 여기서만 만든다. */
create or replace function public.store_tax_rate(p_store uuid)
returns numeric language sql stable as $fn$
  select coalesce((select sum((i->>'rate')::numeric) / 100
                     from settings s, jsonb_array_elements(s.tax_items) i
                    where s.store_id = p_store and coalesce((i->>'rate')::numeric, 0) > 0), 0);
$fn$;


-- ── 집계가 그 값을 더한다 ────────────────────────────────────
-- ⚠ sales_range 는 안 고친다. 거기 'tax' 는 **채널별** 값이라 메뉴에서만 나온다.
--   손익 계산 카드가 쓰는 총액은 sales_summary 하나다.
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sales_summary';

  if v_def is null then
    raise exception '0091: sales_summary 가 없습니다' using errcode = '45003';
  end if;
  if position('etc_tax' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 이 파일의 CRLF 와
  --   pg_get_functiondef() 의 LF 가 어긋나 안 맞는다(0084 에서 걸렸다).
  v_new := replace(v_def,
    $x$  v_etc        numeric := 0;$x$,
    $x$  v_etc        numeric := 0;$x$ || E'
' || $x$  v_etc_tax    numeric := 0;$x$);
  if v_new = v_def then
    raise exception '0091: v_etc 선언을 못 찾았습니다' using errcode = '45003';
  end if;
  v_def := v_new;

  v_new := replace(v_def,
    $x$  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*)$x$,
    $x$  select coalesce(sum(etc_revenue), 0), coalesce(sum(daily_extra), 0), count(*), coalesce(sum(etc_tax), 0)$x$);
  if v_new = v_def then
    raise exception '0091: 기타 매출 집계 select 를 못 찾았습니다' using errcode = '45003';
  end if;
  v_def := v_new;

  v_new := replace(v_def,
    $x$    into v_etc, v_extra, v_days$x$,
    $x$    into v_etc, v_extra, v_days, v_etc_tax$x$);
  if v_new = v_def then
    raise exception '0091: into 절을 못 찾았습니다' using errcode = '45003';
  end if;
  v_def := v_new;

  v_new := replace(v_def,
    $x$  v_revenue := v_revenue + v_etc;$x$,
    $x$  v_revenue := v_revenue + v_etc;$x$ || E'
' ||
    $x$  -- 기타 매출에 붙은 세금(0091). 저장 시점에 얼린 값이라 요율을 고쳐도 안 움직인다.$x$ || E'
' ||
    $x$  v_tax := v_tax + v_etc_tax;$x$);
  if v_new = v_def then
    raise exception '0091: v_revenue 합산 줄을 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

select public.assert_no_rpc_overloads();
