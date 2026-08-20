-- ════════════════════════════════════════════════════════════════
-- 0086 · 폐기 삭제 — 최근 7일치만
--
-- 사장님: "⋮ 넣어줘 삭제 최근 7일치만 넣지 뭐"
--
-- 0085 에서 통째로 없앴다가 되살린다. 다만 두 가지가 달라졌다.
--
--   ① **기간 제한** — 7일이 지난 폐기는 지울 수 없다.
--      원장은 시간이 지날수록 월 손익·로스율·추이의 근거가 된다. 지난달 폐기를
--      오늘 지우면 이미 확정된 장부가 소급해서 흔들린다. 오입력은 며칠 안에
--      알아채지, 한 달 뒤에 알아채지 않는다.
--
--   ② **화면에서 숨긴다** — 지운 폐기는 폐기 목록·로스율에서 사라진다.
--      '삭제'라 해 놓고 취소선 그은 줄이 남으면 지운 게 아니다.
--      원장 자체는 그대로다 — 재고 변동 내역에서 '(취소됨)' 으로 볼 수 있다.
--
-- ⚠ 서버가 막는다. 화면에서 ⋮ 를 감추는 건 안내일 뿐이고, 진짜 경계는 여기다.
-- ════════════════════════════════════════════════════════════════

/** 폐기를 지울 수 있는 기간. 한 곳에서만 정한다 — 화면·서버가 갈리면 안 된다. */
create or replace function public.discard_delete_days()
returns int language sql immutable as $fn$ select 7 $fn$;

comment on function public.discard_delete_days() is
  '폐기 삭제 가능 기간(일). 오늘 포함 최근 N 영업일. 넘기면 원장이 확정된 것으로 본다(0086).';

create or replace function public.e2_discard_reverted(p_event uuid, p_reason text default null)
returns jsonb language plpgsql as $fn$
declare
  ev     inventory_events%rowtype;
  v_unit numeric;
  v_day  date := business_day();
  rec    record;
begin
  -- FOR UPDATE 를 쓰지 않는다 — inventory_events 에는 원장 보존을 위해 UPDATE 정책이
  -- 없고, RLS 아래 FOR UPDATE 는 UPDATE 정책 검사에 걸려 0행을 돌려준다.
  -- 중복은 유니크 인덱스(reverses_event_id)가 막는다.
  select * into ev from inventory_events where id = p_event;
  if not found then raise exception '폐기 기록을 찾을 수 없습니다' using errcode = 'P0002'; end if;
  if ev.type <> 'discard' then
    raise exception '폐기 기록이 아닙니다' using errcode = '22000';
  end if;
  if ev.sales_item_id is not null then
    raise exception '조리 폐기는 그 날 매출에서 수량을 고쳐 주세요' using errcode = '22000';
  end if;

  -- ⚠ 여기가 진짜 경계다. 화면이 ⋮ 를 감추는 것과는 별개로 서버가 거절한다.
  if business_day(ev.occurred_at) < v_day - (discard_delete_days() - 1) then
    raise exception '%일이 지난 폐기는 지울 수 없어요 (기록일 %)',
      discard_delete_days(), business_day(ev.occurred_at) using errcode = '22000';
  end if;

  if exists (select 1 from inventory_events r where r.reverses_event_id = p_event) then
    return jsonb_build_object('event_id', p_event, 'already_reverted', true);
  end if;

  perform restore_stock(ev.ingredient_id, coalesce(ev.volume_delta, 0));

  insert into inventory_events
    (store_id, ingredient_id, type, count_delta, occurred_at, note, reverses_event_id, unit_normalized)
  values
    (ev.store_id, ev.ingredient_id, 'adjust', coalesce(ev.volume_delta, 0), now(),
     coalesce(p_reason, '폐기 삭제'), p_event, true);

  -- 폐기는 기준단가를 바꾸지 않는다(0041). 그래도 추이는 남긴다 — 절대원칙 4.
  v_unit := base_unit_price(ev.ingredient_id);
  if v_unit is not null then
    insert into price_trends (store_id, ingredient_id, trend_date, unit_price)
         values (ev.store_id, ev.ingredient_id, v_day, v_unit);
  end if;

  for rec in
    select distinct recipe_id from recipe_lines
     where ingredient_id = ev.ingredient_id and store_id = ev.store_id
  loop
    perform recompute_recipe(rec.recipe_id, 'material', v_day, ev.ingredient_id);
  end loop;

  perform refresh_order_candidate(ev.ingredient_id);

  return jsonb_build_object(
    'event_id', p_event, 'already_reverted', false,
    'restored', coalesce(ev.volume_delta, 0), 'unit_price', v_unit);
end;
$fn$;

comment on function public.e2_discard_reverted(uuid, text) is
  '폐기 삭제(E2 상쇄). 최근 discard_delete_days() 일치만 가능하다(0086). '
  '원장은 지우지 않고 반대 이벤트를 쌓는다 — 재고는 돌아오고 로스율에서 빠진다. '
  '조리 폐기는 매출이 주인이라 여기서 못 고친다.';

select public.assert_no_rpc_overloads();
