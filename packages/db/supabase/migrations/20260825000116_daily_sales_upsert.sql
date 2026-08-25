-- ════════════════════════════════════════════════════════════════
-- 0116 · 기타 매출 동시 저장이 23505 로 죽는다
--
-- 동시성 감사에서 나왔다(프로브 A 가 2/2 재현).
--
--     select id into v_sales from daily_sales where store_id = p_store and sale_date = p_date;
--     if v_sales is null then
--       insert into daily_sales (store_id, sale_date) values (p_store, p_date) returning id into v_sales;
--     end if;
--
-- 보고 나서 넣는다. 둘이 동시에 보면 **둘 다 없다고 보고 둘 다 넣는다.**
--
--     ERROR: 23505: duplicate key value violates unique constraint
--            "daily_sales_store_id_sale_date_key"
--     CONTEXT: insert into daily_sales (store_id, sale_date) values (p_store, p_date) returning id
--     → 이어서 25P02 (트랜잭션이 통째로 죽는다)
--
-- ⚠ 메뉴 판매는 이 병이 없다. `e10_sale_recorded` 가 같은 행을
--   `insert ... on conflict (store_id, sale_date) do update` 로 잡아서 **행 락으로 직렬화**된다.
--   실제로 그 덕에 55회 동시 저장에서 0028 목표치 대조가 그대로 성립했다.
--   기타 매출·추가 지출만 그 락을 안 타고 맨손으로 들어갔다.
--
-- 같은 자리를 같은 방법으로 잡는다 — 보고 나서 넣지 말고 **넣으면서 잡는다**.
-- ⚠ `do nothing` 이 아니라 `do update` 여야 한다. `do nothing` 은 충돌 시
--   아무 행도 반환하지 않아 v_sales 가 null 로 남고, 바로 아래 update 가 조용히 0행을 친다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';

  if v_def is null then
    raise exception '0116: save_sale 이 없습니다' using errcode = '45003';
  end if;
  if position('0116' in v_def) > 0 then return; end if;

  -- ⚠ 한 줄 안에서 끝나는 조각만 바꾼다. 여러 줄은 파일 CRLF 와 서버 LF 가 어긋난다(0084).
  v_new := replace(v_def,
    $x$      insert into daily_sales (store_id, sale_date) values (p_store, p_date) returning id into v_sales;$x$,
    $x$      -- 0116 · 보고 나서 넣지 말고 넣으면서 잡는다. 동시 저장이 23505 로 죽던 자리다.
      insert into daily_sales (store_id, sale_date) values (p_store, p_date)
      on conflict (store_id, sale_date) do update set updated_at = now()
      returning id into v_sales;$x$);
  if v_new = v_def then
    raise exception '0116: daily_sales 삽입 줄을 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_sale';

  if position('0116' in v_def) = 0 then
    raise exception '0116: 상향 병합이 안 들어갔습니다' using errcode = '45003';
  end if;
  -- 0115 의 영업일 가드가 살아 있어야 한다. 같은 함수를 두 번 고치는 중이다.
  if position('0115' in v_def) = 0 then
    raise exception '0116: 0115 영업일 가드를 함께 지웠습니다' using errcode = '45003';
  end if;
  if position('e10_sale_recorded' in v_def) = 0
     or position('etc_revenue' in v_def) = 0
     or position('daily_extra' in v_def) = 0 then
    raise exception '0116: 저장 본체를 함께 지웠습니다' using errcode = '45003';
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
