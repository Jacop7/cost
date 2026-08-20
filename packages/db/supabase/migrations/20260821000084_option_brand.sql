-- ════════════════════════════════════════════════════════════════
-- 0084 · 구매 옵션에 브랜드를 내려준다
--
-- 사장님: "좌측 텍스트 구성 — 브랜드 / 제품명 / 금액"
--
-- 그런데 브랜드는 **어디에도 없었다.**
--   · brands 테이블 0행
--   · purchase_options.brand_id 채워진 행 0건
--   · ingredient_detail 이 brand 를 아예 안 내려줌
--   · 앱에 브랜드 입력 칸 없음
--
-- 컬럼과 테이블만 있고 아무도 안 쓰는 상태였다. 화면부터 붙이면 영원히 빈 줄이 된다.
-- 여기서는 **서버가 내려주는 것까지** 한다 — 값이 생기면 화면이 바로 받는다.
--
-- ⚠ 값이 없으면 null 이다. 빈 문자열로 채우지 않는다 —
--   화면이 "브랜드가 있는데 이름이 비었다"와 "브랜드가 없다"를 구분해야 한다.
-- ════════════════════════════════════════════════════════════════

do $mig$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ingredient_detail';

  if v_def is null then
    raise exception '0084: ingredient_detail 이 없습니다' using errcode = '45003';
  end if;

  -- 다시 돌려도 같은 결과여야 한다.
  if position('brand_name' in v_def) > 0 then
    return;
  end if;

  /*
   * ⚠ 여러 줄을 통째로 비교하지 않는다. 이 파일은 Windows 에서 CRLF 로 저장되고
   *   pg_get_functiondef() 는 LF 만 쓴다 — 줄이 하나라도 걸치면 절대 안 맞는다.
   *   (여기서 한 번 걸렸다.) **한 줄 안에서 끝나는 조각**만 바꾼다.
   */
  v_new := replace(v_def,
    $x$'volume', po.volume, 'amount', po.amount, 'vendor_name', pv.name)$x$,
    $x$'volume', po.volume, 'amount', po.amount, 'vendor_name', pv.name,$x$ ||
    $x$ 'brand_id', po.brand_id, 'brand_name', pb.name)$x$);

  if v_new = v_def then
    raise exception '0084: options 의 jsonb_build_object 를 못 찾았습니다' using errcode = '45003';
  end if;
  v_def := v_new;

  v_new := replace(v_def,
    $x$from purchase_options po left join vendors pv on pv.id = po.vendor_id$x$,
    $x$from purchase_options po left join vendors pv on pv.id = po.vendor_id$x$ ||
    $x$ left join brands pb on pb.id = po.brand_id$x$);

  if v_new = v_def then
    raise exception '0084: options 의 join 절을 못 찾았습니다' using errcode = '45003';
  end if;

  execute v_new;
end
$mig$;

comment on column purchase_options.brand_id is
  '제조사·브랜드. 같은 제품을 여러 구매처에서 살 때 무엇을 사는지 구분한다(0084). 입력은 선택.';

select public.assert_no_rpc_overloads();
