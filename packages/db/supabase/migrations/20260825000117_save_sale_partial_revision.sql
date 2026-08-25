-- ════════════════════════════════════════════════════════════════
-- 0117 · 낡은 화면이 남의 기록을 지운다 — 부분 수정 + 판본 검사
--
-- 실측(동시성도 필요 없다. 화면이 낡기만 하면 된다):
--     기기 A 저장 → 제육 5 · 김치 0
--     기기 B 저장 → 제육 0 · 김치 3      ← 제육 5개가 사라짐
--     두 호출 다 **성공**을 반환한다. 아무도 모른다.
--
-- 원인이 둘이고, 둘 다 막아야 한다.
--
--   ① `save_sale` 이 **전체 교체**였다. 목록에 없는 메뉴를 0 으로 만들었다.
--      → **부분 수정**으로 바꾼다. 안 보낸 메뉴는 손대지 않는다.
--        ⚠ 그래서 이제 **지울 때는 0 을 명시**해야 한다. 빼먹으면 그대로 남는다.
--        앱은 늘 화면의 전체 목록을 보내므로 동작은 같다.
--
--   ② 같은 메뉴를 두 곳에서 고치면 여전히 나중 것이 이긴다.
--      기타 매출·추가 지출은 **배열 통째로** 덮어써서 더 심하다 —
--      A 가 소주를 넣고 B 가 맥주를 넣으면 둘 중 하나만 남는다(0116 은 오류만 없앴다).
--      → **판본 검사**로 막는다. 낡은 판본으로 들어온 저장은 거부한다.
--
-- ⚠ 영업일 행을 **먼저** 잠근다(0118 과 같은 순서). 잠근 **뒤에** 상태를 다시 읽는다.
--   그래야 규칙이 선다 —
--     판매가 먼저 잠그면 → 종료 손익에 포함된다
--     종료가 먼저 잠그면 → 판매는 45002 로 거부된다
--   잠금 전에 읽으면 그 사이 종료된 걸 못 보고 종료된 장부에 판매가 들어간다.
--
-- ⚠ 잠금 순서는 **영업일 → 그날 매출** 하나뿐이다. 뒤집는 곳이 생기면 교착이 난다.
-- ════════════════════════════════════════════════════════════════

-- ── 판본 ──────────────────────────────────────────────────────
-- 그날 매출이 바뀔 때마다 1 씩 오른다. 화면은 마지막으로 본 판본을 들고 있다가
-- 저장할 때 같이 보낸다. 서버 판본과 다르면 그 화면은 낡은 것이다.
alter table daily_sales add column if not exists revision integer not null default 0;

comment on column daily_sales.revision is
  '그날 매출의 판본(0117). save_sale 이 성공할 때마다 1 오른다. '
  '화면이 마지막으로 본 값을 되보내고, 서버 값과 다르면 45009 로 거부한다 — '
  '낡은 화면이 남의 기록을 덮어쓰는 걸 막는 유일한 장치다.';


-- ── 인자가 하나 늘었다. 옛 판을 지워야 오버로드가 안 생긴다 ───
drop function if exists public.save_sale(uuid, date, jsonb, jsonb, jsonb);

create or replace function public.save_sale(
  p_store uuid,
  p_date date,
  p_items jsonb,
  p_etc_items jsonb default null,
  p_extra_items jsonb default null,
  -- 화면이 마지막으로 본 판본. null 이면 검사하지 않는다(시드·테스트·서버 내부 호출).
  p_base_revision integer default null)
returns jsonb language plpgsql as $function$
declare
  v_item    jsonb;
  v_sales   uuid;
  v_result  jsonb := '[]'::jsonb;
  v_etc     numeric;
  v_extra   numeric;
  v_bday    record;
  v_status  text;
  v_rev     integer;
  v_work    boolean;
begin
  perform assert_my_store(p_store);
  if p_date > business_day() then
    raise exception '미래 날짜의 매출은 등록할 수 없어요' using errcode = '22000';
  end if;

  v_work := coalesce(jsonb_array_length(p_items), 0) > 0
            or p_etc_items is not null or p_extra_items is not null;

  if v_work then
    -- ── 1) 영업일을 먼저 잠근다 ─────────────────────────────
    v_bday := business_day_of(p_store, p_date);
    if v_bday.id is null then
      raise exception '아직 영업을 시작하지 않았어요' using errcode = '45001';
    end if;

    -- ⚠ 잠금을 잡고 **그다음에** 상태를 읽는다. 순서가 반대면 잠금을 기다리는 동안
    --   종료된 것을 못 보고, 마감된 장부에 판매가 들어간다.
    perform 1 from business_days where id = v_bday.id for update;
    select status::text into v_status from business_days where id = v_bday.id;
    if v_status = 'closed' then
      raise exception '% 영업은 종료됐어요. 고치려면 영업 기록을 다시 열어 주세요', p_date
        using errcode = '45002';
    end if;

    -- ── 2) 그날 매출 행을 만들면서 잠근다 ───────────────────
    -- 보고 나서 넣지 않는다(0116). 이 upsert 가 잡는 행 락이 동시 저장을 줄 세운다.
    insert into daily_sales (store_id, sale_date) values (p_store, p_date)
    on conflict (store_id, sale_date) do update set updated_at = now()
    returning id, revision into v_sales, v_rev;

    -- ── 3) 판본 검사 ────────────────────────────────────────
    -- ⚠ 잠금을 쥔 뒤에 잰다. 먼저 재면 재는 사이에 남이 커밋할 수 있다.
    if p_base_revision is not null and v_rev is distinct from p_base_revision then
      raise exception '다른 기기에서 판매 내역이 변경됐어요. 최신 내역을 다시 확인해 주세요.'
        using errcode = '45009';
    end if;
  end if;

  -- ── 4) 보낸 메뉴만 고친다 ─────────────────────────────────
  -- ⚠ **전체 교체가 아니다**(0117). 안 보낸 메뉴는 그대로 둔다.
  --   예전엔 여기 아래에 "목록에 없으면 0 으로" 루프가 있었고, 그게 낡은 화면이
  --   남의 판매를 지우는 통로였다. 지울 때는 0 을 명시해서 보낸다.
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_result := v_result || jsonb_build_array(
      e10_sale_recorded(
        p_store, p_date, (v_item->>'recipe_id')::uuid,
        coalesce((v_item->>'qty_hall')::numeric, 0),
        coalesce((v_item->>'qty_delivery')::numeric, 0),
        coalesce((v_item->>'qty_takeout')::numeric, 0),
        coalesce((v_item->>'qty_waste')::numeric, 0)));
  end loop;

  -- ── 5) 기타 매출·추가 지출 ────────────────────────────────
  -- ⚠ 여기는 여전히 배열 통째 교체다. 항목 단위 병합은 하지 않는다 —
  --   같은 이름이 여럿일 수 있어 무엇이 같은 항목인지 정할 수 없다.
  --   대신 위의 판본 검사가 낡은 배열을 아예 못 들어오게 막는다.
  if p_etc_items is not null or p_extra_items is not null then
    -- 합계는 항목에서 **계산**한다. 화면이 보낸 합계를 믿으면 둘이 어긋난다.
    if p_etc_items is not null then
      select coalesce(sum(coalesce((x->>'price')::numeric,0) * coalesce((x->>'qty')::numeric,1)), 0)
        into v_etc from jsonb_array_elements(p_etc_items) x;
      update daily_sales
         set etc_items = p_etc_items, etc_revenue = v_etc,
             etc_tax = round(v_etc * store_tax_rate(p_store), 2), updated_at = now()
       where id = v_sales;
    end if;
    if p_extra_items is not null then
      select coalesce(sum(coalesce((x->>'amount')::numeric,0)), 0)
        into v_extra from jsonb_array_elements(p_extra_items) x;
      update daily_sales
         set extra_items = p_extra_items, daily_extra = v_extra, updated_at = now()
       where id = v_sales;
    end if;
  end if;

  -- ── 6) 판본을 올린다 ──────────────────────────────────────
  if v_work then
    update daily_sales
       set revision = revision + 1, updated_at = now()
     where id = v_sales
    returning revision into v_rev;
  end if;

  -- 화면은 이 판본을 들고 있다가 다음 저장에 되보낸다.
  return jsonb_build_object('sale_date', p_date, 'items', v_result, 'revision', v_rev);
end;
$function$;

comment on function public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer) is
  '그날 매출 저장(0117). **부분 수정**이다 — 보낸 메뉴만 고치고 안 보낸 메뉴는 그대로 둔다. '
  '지울 때는 0 을 명시한다. p_base_revision 을 주면 낡은 화면의 저장을 45009 로 거부한다. '
  '영업일 행을 먼저 잠그고 상태를 다시 읽으므로, 종료와 경합해도 한쪽만 이긴다.';

select public.assert_no_rpc_overloads();
