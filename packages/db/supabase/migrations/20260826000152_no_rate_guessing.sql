-- ════════════════════════════════════════════════════════════════
-- 0152 · 역산한 세율은 "그때 세율" 이 아니다 — 자동 복원을 걷는다
--
-- 0151 은 열린 장부의 세율을 `etc_tax ÷ etc_revenue` 로 되짚었다. 그런데 `etc_tax` 는
-- **소수 둘째 자리로 반올림돼 저장**된다. 나눗셈으로 나오는 건 그때 세율이 아니라
-- "저장된 합계를 재현하는 유효 세율" 이다. 실측:
--
--     실제 세율        9.0909090909%   (부가세 포함가 10/110)
--     기존 기타매출    1원  → 저장된 세금 0.09원
--     역산 세율        9.0000000000%
--     이후 10,000원    실제 909.09원 vs 역산 900.00원   → 9.09원 어긋남
--
-- 매출이 작을수록 오차가 커진다. 그 값을 그날 기준으로 굳히면 앞으로의 정정이
-- 조용히 틀어진다 — 0149~0151 이 내내 막아 온 바로 그 일이다.
--
-- ⚠ `estimated_current` 를 붙여 넘어갈 수도 없다. 그건 "현재 기준으로 계산했다" 는
--   뜻이고 화면 문구도 그렇게 나간다. 역산 세율은 현재 기준도 아니다 — 붙이면 거짓말이다.
--   따로 상태를 만들 수도 있지만, 지금 필요한 것은 **추측하지 않는 것**이다.
--
-- 그래서 규칙을 이렇게 정한다.
--   · 굳은 세율로 그날 기타매출 세금이 재현되면 → 그대로 둔다
--   · 재현되지 않으면 → **멈춘다.** 사람이 그날 세율을 확인해 직접 넣는다
--
-- (개발 DB 는 열린 장부에 기타 매출이 0원이라 0151 의 되짚기가 실제로 고친 행은 0건이다.
--  어디에도 역산 값이 굳지 않았다.)
-- ════════════════════════════════════════════════════════════════

-- ── ① 일회성 helper 를 앱에서 뗀다 ──────────────────────────────
/*
 * `etc_tax_rate_of_record()` 는 0151 의 백필과 그 시험에서만 썼는데 `authenticated` 에
 * 실행 권한이 갔고 생성 타입에도 노출됐다. 앱 기능이 아니다. 그리고 이제 백필도 없앤다.
 */
drop function if exists public.etc_tax_rate_of_record(uuid, date);


-- ── ② 재현되면 유지, 아니면 중단 ────────────────────────────────
do $v$
declare v_list text;
begin
  select string_agg(
           format('%s(기타매출 %s원 · 저장된 세금 %s원 · 굳은 세율 %s → %s원)',
                  bd.business_date, ds.etc_revenue, ds.etc_tax,
                  coalesce((bd.snapshot->>'etc_tax_rate'), '(없음)'),
                  round(ds.etc_revenue
                        * coalesce((bd.snapshot->>'etc_tax_rate')::numeric, 0), 2)),
           chr(10) || '    ' order by bd.business_date)
    into v_list
    from business_days bd
    join daily_sales ds
      on ds.store_id = bd.store_id and ds.sale_date = bd.business_date
   where bd.status::text <> 'closed'
     and coalesce(ds.etc_revenue, 0) > 0
     and ds.etc_tax is not null
     and round(ds.etc_revenue
               * coalesce((bd.snapshot->>'etc_tax_rate')::numeric, -1), 2)
         is distinct from round(ds.etc_tax, 2);

  if v_list is not null then
    raise exception E'0152: 굳은 세율로 그날 기타매출 세금을 재현하지 못하는 열린 장부가 있습니다.\n'
      '    %\n'
      '  세금은 반올림돼 저장되므로 나눗셈으로는 그때 세율을 되짚을 수 없습니다(실측 9.09원 어긋남).\n'
      '  그날 세율을 확인해 직접 넣은 뒤 다시 올려 주세요:\n'
      '    update business_days set snapshot = jsonb_set(snapshot, ''{etc_tax_rate}'', to_jsonb(<세율>::numeric))\n'
      '     where store_id = <매장> and business_date = <날짜>;', v_list;
  end if;
end $v$;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'etc_tax_rate_of_record') then
    raise exception '0152: 일회성 helper 가 아직 남아 있습니다';
  end if;

  /*
   * 0150 의 채움은 그대로 둔다 — 기록이 **없는** 열린 장부에 지금 세율을 굳히는 것은
   * 추측이 아니다. 아직 아무것도 안 팔았으니 지금 세율이 그날 세율이다.
   */
  if exists (select 1 from business_days
              where status::text <> 'closed'
                and not (coalesce(snapshot, '{}'::jsonb) ? 'etc_tax_rate')) then
    raise exception '0152: 세율이 안 굳은 열린 장부가 있습니다';
  end if;
end $v$;

select public.assert_no_rpc_overloads();
