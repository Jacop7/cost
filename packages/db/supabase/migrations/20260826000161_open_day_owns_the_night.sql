/*
 * 0161 · 열린 장부가 밤을 소유한다 (검토 P1-3)
 *
 * 구멍: resolve_sales_business_context 가 판매 영업일을 **규칙으로만** 계산했다.
 * 휴무일(일요일)에 예외적으로 18:00~02:00 영업을 시작하면, 월요일 01:00 판매가
 * 열려 있는 일요일 장부가 아니라 규칙 계산(월요일)으로 갔다 — 같은 밤 장사가
 * 두 날로 쪼개진다. 연장 영업(규칙 종료 뒤 planned 를 늦춘 날)도 같은 구멍이다.
 *
 * 고침: **열린 영업일이 있고 그 굳은 예정 종료 전이면, 그 장부의 날이 판매
 * 영업일이다.** 장부가 굳힌 값(규칙·종료 시각)이 규칙 조회보다 우선한다 —
 * 상태 카드(0154)와 같은 원칙이다. 예정 종료가 지났으면 기존 규칙 계산으로
 * 떨어진다(낡은 장부 처리 그대로).
 */

create or replace function public.resolve_sales_business_context(
  p_store uuid, p_at timestamptz default now()
) returns public.sales_business_context
language plpgsql
stable
as $$
declare
  ctx     public.sales_business_context;
  v_prev  jsonb;
  v_close timestamptz;
  v_open  business_days;
begin
  ctx.timezone   := store_timezone(p_store);
  ctx.local_date := (p_at at time zone ctx.timezone)::date;

  v_open := current_business_day(p_store);
  ctx.open_day_id           := v_open.id;
  ctx.open_business_date    := v_open.business_date;
  ctx.open_status           := v_open.status;
  ctx.open_planned_close_at := v_open.planned_close_at;
  ctx.open_rule_id          := v_open.operating_rule_id;
  ctx.open_expired          := v_open.id is not null
                               and v_open.planned_close_at is not null
                               and p_at >= v_open.planned_close_at + auto_close_grace();

  /*
   * ── 판매 영업일 ────────────────────────────────────────────────
   * ① 열린 장부가 있고 **그 장부의 창 안**이면 그 장부의 날이다(0161).
   *    창 = [연 시각, 굳은 예정 종료). 휴무일 수동 개점·연장 영업의 새벽 판매가
   *    열린 장부로 붙는 근거다 — 장부가 굳힌 값이 규칙 조회를 이긴다(0154 원칙).
   * ⚠ 하한(연 시각)이 없으면 과거 시각 조회까지 삼킨다 — 실측: 어제 정오를 물었는데
   *   오늘 장부가 "내 날"이라고 답했다(시험 23 ④가 잡았다).
   */
  if v_open.id is not null and v_open.planned_close_at is not null
     and p_at < v_open.planned_close_at
     and p_at >= coalesce(v_open.opened_at, v_open.scheduled_open_at,
                          (v_open.business_date::timestamp) at time zone ctx.timezone) then
    ctx.sales_date    := v_open.business_date;
    ctx.sales_rule_id := v_open.operating_rule_id;
    return ctx;
  end if;

  /*
   * ② 열린 장부가 없거나 이미 예정 종료를 지났다 — 규칙으로 계산한다.
   *    **어제 규칙**이 자정을 넘기고 아직 그 종료 시각 전이면, 판매는 어제
   *    영업일이다(§2.2). 판매가 속할 영업일은 "그 영업일이 언제 끝나는가"로
   *    정해지기 때문이다.
   * ⚠ 유예(auto_close_grace)는 더하지 않는다. 유예는 열린 장부가 저장을 받아
   *   주는 기간이지 날짜 해석이 아니다 — 02:00 종료면 02:00 부터는 오늘이다.
   */
  ctx.sales_date := ctx.local_date;
  v_prev := store_hours_on(p_store, ctx.local_date - 1);
  if v_prev is not null
     and not coalesce((v_prev->>'closed')::boolean, false)
     and coalesce((v_prev->>'close_day_offset')::int, 0) = 1 then
    v_close := planned_close(p_store, ctx.local_date - 1);
    if v_close is not null and p_at < v_close then
      ctx.sales_date := ctx.local_date - 1;
    end if;
  end if;

  ctx.sales_rule_id := (store_hours_on(p_store, ctx.sales_date)->>'rule_id')::uuid;
  return ctx;
end;
$$;

-- ── 사후조건 ────────────────────────────────────────────────────
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname = 'resolve_sales_business_context';
  if position('v_open.planned_close_at' in v_def) = 0
     or position('ctx.sales_date    := v_open.business_date' in v_def) = 0 then
    raise exception '0161: 열린 장부 우선 분기가 빠졌습니다';
  end if;
end $$;
