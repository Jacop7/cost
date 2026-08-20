-- ════════════════════════════════════════════════════════════════
-- 0083 · 손익 변동에 **금액**을 남긴다 (RCP-16)
--
-- 기획: 레시피 손익 변동 최종기획 · 프로토타입 recipe-profit-history.html
--
-- 지금 profit_trends 는 `순이익률 33.72% · 재료비율 23.39%` 만 남긴다.
-- 서버는 전체 손익을 계산해 놓고 **금액을 버린다.** 그래서 화면이
-- "얼마에서 얼마로 움직였나"에 답하지 못하고 비율만 되뇐다.
--
-- 사장님의 질문은 하나다 — **언제, 무엇 때문에, 얼마만큼.**
--   08/20 14:41  고춧가루 단가 반영   4,046.69원  +32원
--
-- 그래서 계산한 값을 그대로 적재한다: 판매가·재료비·부자재·세금·고정지출·순이익.
--
-- ⚠ 과거 행의 금액은 **역산하지 않는다.** 당시 판매가·세금·고정지출률을 알 수 없다.
--   현재 값을 넣으면 그럴듯한 거짓 기록이 된다(기획 11절).
--   옛 비율 행은 지우지 않고 RCP-10 그래프에 그대로 둔다.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 스냅샷 컬럼 ────────────────────────────────────────────
-- 기존 행 때문에 금액은 전부 nullable 이다. "값이 없다"와 "0원"은 다르다.
alter table profit_trends
  add column if not exists occurred_at          timestamptz,
  add column if not exists previous_snapshot_id uuid references profit_trends (id),
  add column if not exists price                numeric,
  add column if not exists material_cost        numeric,
  add column if not exists extra_cost           numeric,
  add column if not exists tax_amount           numeric,
  add column if not exists fixed_cost           numeric,
  add column if not exists fixed_rate           numeric,
  add column if not exists profit_amount        numeric,
  add column if not exists source_type          text,
  add column if not exists source_entity_id     uuid,
  add column if not exists source_label         text,
  add column if not exists summary              text,
  add column if not exists calculation_version  int  not null default 2,
  add column if not exists is_baseline          boolean not null default false;

comment on column profit_trends.occurred_at is
  '사건이 실제 일어난 시각. trend_date 는 영업일이라 같은 날 두 번을 구분하지 못한다.';
comment on column profit_trends.previous_snapshot_id is
  '비교 기준이 되는 직전 스냅샷. 전후값은 이 링크로만 만든다 — 시각으로 다시 찾지 않는다.';
comment on column profit_trends.calculation_version is
  '손익 공식 버전. 1=비율만 남기던 시절, 2=tax_of()·고정지출률 포함 금액 스냅샷(0083).';
comment on column profit_trends.is_baseline is
  '비교 기준용 첫 스냅샷. 변동이 아니므로 RCP-16 목록에 나오지 않는다.';

-- 옛 행은 공식 버전 1 이다. 금액이 없다는 사실 자체가 기록이다.
update profit_trends set calculation_version = 1 where profit_amount is null;
update profit_trends set occurred_at = created_at where occurred_at is null;
alter table profit_trends alter column occurred_at set not null;
alter table profit_trends alter column occurred_at set default clock_timestamp();

-- RCP-16 은 금액이 있는 비-기준 행만 최신순으로 훑는다.
create index if not exists profit_trends_history_idx
  on profit_trends (recipe_id, occurred_at desc, id desc)
  where profit_amount is not null and not is_baseline;


-- ── 2. 금액 표기 ──────────────────────────────────────────────
-- 32 → 32,  45.46 → 45.46,  2806.40 → 2,806.40.
-- 정수면 소수점을 붙이지 않는다. "재료비 32.00원 감소"는 사람이 읽는 문장이 아니다.
create or replace function public.money_short(p numeric)
returns text language sql stable as $fn$
  select case when p is null then null
              when round(p, 2) = round(p, 0) then to_char(round(p, 0), 'FM999,999,999,990')
              else to_char(round(p, 2), 'FM999,999,999,990.00') end;
$fn$;


-- ── 3. 대표 원인 — **한 곳에서만** ────────────────────────────
-- 목록 줄("재료비 32원 감소")과 상세 시트("재료비 2,838.40 → 2,806.40")는
-- 같은 항목을 가리켜야 한다. 두 곳에서 따로 고르면 언젠가 어긋난다.
--
-- 규칙: 순이익에 **가장 크게** 영향을 준 구성요소 하나. 나머지는 스냅샷에 남아 있다.
create or replace function public.profit_delta_cause(p_prev profit_trends, p_cur profit_trends)
returns jsonb language sql stable as $fn$
  select jsonb_build_object(
    'key', d.key, 'label', d.label,
    'before', d.before, 'after', d.after, 'delta', d.after - d.before,
    'summary', d.label || ' ' || money_short(abs(d.after - d.before)) || '원 '
               || case when d.after > d.before then '증가' else '감소' end)
  from (
    select v.key, v.label, v.before, v.after
      from (values
        ('price',         '판매가',   p_prev.price,         p_cur.price),
        ('material_cost', '재료비',   p_prev.material_cost, p_cur.material_cost),
        ('extra_cost',    '부자재',   p_prev.extra_cost,    p_cur.extra_cost),
        ('tax_amount',    '세금',     p_prev.tax_amount,    p_cur.tax_amount),
        ('fixed_cost',    '고정지출', p_prev.fixed_cost,    p_cur.fixed_cost)
      ) v(key, label, before, after)
     -- 1원의 100분의 1도 못 움직였으면 변동이 아니다. 부동소수 찌꺼기를 사건으로 만들지 않는다.
     where v.before is not null and v.after is not null
       and round(abs(v.after - v.before), 2) >= 0.01
     order by abs(v.after - v.before) desc, v.key
     limit 1
  ) d;
$fn$;

comment on function public.profit_delta_cause(profit_trends, profit_trends) is
  '두 스냅샷 사이의 대표 원인 한 줄. 아무것도 안 움직였으면 null — 그런 재계산은 목록에 없다.';

-- 제목은 출처에서 나온다. 저장하지 않는다 — 같은 문장을 두 벌 갖지 않기 위해서다.
create or replace function public.profit_event_title(p_source_type text, p_label text)
returns text language sql immutable as $fn$
  select case p_source_type
    when 'ingredient' then coalesce(p_label || ' 단가 반영', '식재료 단가 반영')
    when 'fixed_cost' then '고정지출 반영'
    else '레시피 수정' end;
$fn$;


-- ── 4. recompute_recipe — 계산한 값을 버리지 않는다 ───────────
-- ⚠ drop 후 재생성이다. 인자를 늘리면 오버로드가 생기고
--   assert_no_rpc_overloads() 가 막는다 — PostgREST 가 어느 쪽을 부를지 모르게 된다.
drop function if exists public.recompute_recipe(uuid, trend_cause, date);
drop function if exists public.recompute_recipe(uuid, trend_cause, date, uuid);

create function public.recompute_recipe(
  p_recipe      uuid,
  p_cause       trend_cause,
  p_occurred_at date default null,
  p_source      uuid default null   -- 원인이 된 식재료(material 일 때). 나머지는 문맥이 정한다.
) returns void language plpgsql as $fn$
declare
  r          recipes%rowtype;
  v_day      date := coalesce(p_occurred_at, business_day());
  v_month    text;
  v_tax      numeric;
  v_material numeric := 0;
  v_extra    numeric := 0;
  v_fixed    numeric;
  v_rate     numeric;
  v_profit   numeric;
  v_pr       numeric;
  v_mr       numeric;
  v_at       timestamptz;
  v_type     text;
  v_label    text;
  v_prev     profit_trends;
  v_row      profit_trends;
  v_cause    jsonb;
begin
  if v_day > business_day() then
    raise exception '미래 날짜로는 기록할 수 없습니다 (요청 %, 오늘 %)', v_day, business_day();
  end if;
  v_month := to_char(v_day, 'YYYY-MM');

  select * into r from recipes where id = p_recipe;
  if not found then return; end if;

  v_material := recipe_material_cost(p_recipe);   -- 반제품 포함

  select coalesce(sum(amount_per_serving), 0) into v_extra
    from recipe_extra_costs where recipe_id = p_recipe;

  v_tax := tax_of(r.price, r.tax_mode, r.tax_items);

  -- 해당 월 률이 없으면 **가장 최근 입력 월**로 잠정 적용한다(④ 2).
  -- 0% 로 확정하면 순이익률이 부풀려진다(실증: 33.49% → 64.79%).
  v_rate := fixed_cost_rate(r.store_id, v_month);
  if v_rate is null then
    select fixed_cost_rate(r.store_id, month) into v_rate
      from fixed_costs_monthly
     where store_id = r.store_id and month <= v_month
       and fixed_cost_rate(r.store_id, month) is not null
     order by month desc limit 1;
  end if;
  v_fixed := coalesce(v_rate, 0) * r.price;

  v_profit := r.price - v_tax - v_material - v_extra - v_fixed;
  v_pr := case when r.price > 0 then round(v_profit / r.price * 100, 2) else 0 end;
  v_mr := case when r.price > 0 then round(v_material / r.price * 100, 2) else 0 end;

  -- ⚠ now() 가 아니라 clock_timestamp() 다. now() 는 트랜잭션 안에서 고정이라
  --   한 번에 여러 레시피를 다시 계산하면 전부 같은 시각이 되고 순서가 무너진다(0068).
  v_at := case when v_day = business_day() then clock_timestamp()
               else (v_day + time '23:59') at time zone business_tz() end;

  v_type := case p_cause when 'material' then 'ingredient'
                         when 'fixed'    then 'fixed_cost'
                         else                 'recipe' end;
  v_label := case p_cause
    when 'material' then (select i.name from ingredients i where i.id = p_source)
    when 'fixed'    then '고정지출 설정'
    else                 '직접 수정' end;

  -- 비교 대상은 **금액이 있는** 직전 스냅샷이다. 옛 비율 행과는 뺄셈이 성립하지 않는다.
  select * into v_prev from profit_trends
   where recipe_id = p_recipe and profit_amount is not null
   order by occurred_at desc, id desc limit 1;

  -- 대표 원인은 **넣기 전에** 만든다.
  -- ⚠ profit_trends 는 append-only 다 — RLS 에 UPDATE 정책이 아예 없다(0018).
  --   넣고 나서 요약을 채우려 하면 조용히 거부당하고 summary 가 null 로 남는다.
  --   (실제로 그렇게 났다. 오류도 안 난다 — RLS 는 0건 갱신을 성공으로 돌려준다.)
  v_row.price         := r.price;
  v_row.material_cost := v_material;
  v_row.extra_cost    := v_extra;
  v_row.tax_amount    := v_tax;
  v_row.fixed_cost    := v_fixed;
  v_cause := profit_delta_cause(v_prev, v_row);

  insert into profit_trends (
      store_id, recipe_id, trend_date, profit_rate, material_rate, cause,
      occurred_at, previous_snapshot_id, price, material_cost, extra_cost, tax_amount,
      fixed_cost, fixed_rate, profit_amount, source_type, source_entity_id, source_label,
      summary, is_baseline)
  values (
      r.store_id, p_recipe, v_day, v_pr, v_mr, p_cause,
      v_at, v_prev.id, r.price, v_material, v_extra, v_tax,
      v_fixed, coalesce(v_rate, 0), v_profit, v_type,
      coalesce(p_source, case when p_cause = 'recipe' then p_recipe end), v_label,
      v_cause ->> 'summary',
      -- 비교할 앞이 없으면 그 자체가 기준선이다. 첫 점을 '변동'이라 부르지 않는다.
      v_prev.id is null);
end;
$fn$;

comment on function public.recompute_recipe(uuid, trend_cause, date, uuid) is
  '손익 재계산 + 스냅샷 1건. 계산한 금액을 전부 남긴다(0083). 옛 버전은 비율만 남겼다.';


-- ── 5. 원인이 된 식재료를 넘긴다 ──────────────────────────────
-- 재료 경로 4개만 인자가 하나 는다. 함수 본문 400여 줄을 통째로 복사해 오면
-- 바뀐 곳이 어디인지 아무도 못 찾는다 — **바뀌는 한 줄만** 바꾼다.
--
-- ⚠ 못 찾으면 예외다. 조용히 넘어가면 제목이 "식재료 단가 반영"으로 뭉개진 채
--   아무도 모른다. 나중에 변수명이 바뀌면 여기서 걸린다.
do $mig$
declare
  v_fn   text;
  v_from text;
  v_to   text;
  v_def  text;
  v_map  text[][] := array[
    ['e1_confirm_inbound',
     'recompute_recipe(rec.recipe_id, ''material'', v_today)',
     'recompute_recipe(rec.recipe_id, ''material'', v_today, o.ingredient_id)'],
    ['e11_inbound_reverted',
     'recompute_recipe(rec.recipe_id, ''material'', v_day)',
     'recompute_recipe(rec.recipe_id, ''material'', v_day, o.ingredient_id)'],
    ['e2_discard',
     'recompute_recipe(rec.recipe_id, ''material'', v_day)',
     'recompute_recipe(rec.recipe_id, ''material'', v_day, p_ingredient)'],
    ['e2_discard_reverted',
     'recompute_recipe(rec.recipe_id, ''material'', v_day)',
     'recompute_recipe(rec.recipe_id, ''material'', v_day, ev.ingredient_id)']
  ];
  v_i int;
begin
  for v_i in 1 .. array_length(v_map, 1) loop
    v_fn   := v_map[v_i][1];
    v_from := v_map[v_i][2];
    v_to   := v_map[v_i][3];

    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn;

    if v_def is null then
      raise exception '0083: % 가 없습니다', v_fn using errcode = '45003';
    end if;
    -- 이미 바뀌어 있으면 그냥 넘어간다 — 다시 돌려도 같은 결과여야 한다.
    if position(v_to in v_def) > 0 then
      continue;
    end if;
    if position(v_from in v_def) = 0 then
      raise exception '0083: % 안에서 호출 한 줄을 못 찾았습니다 — %', v_fn, v_from
        using errcode = '45003';
    end if;

    execute replace(v_def, v_from, v_to);
  end loop;
end
$mig$;


-- ── 6. 기준선 적재 ────────────────────────────────────────────
-- 옛 비율 행에서 금액을 역산할 수는 없다. 그래서 **지금 손익**을 레시피마다 한 번
-- 기준선으로 찍는다. 이 점은 목록에 안 나오고, 다음 변경이 이것과 비교된다.
do $seed$
declare rec record;
begin
  for rec in
    select r.id from recipes r
     where not exists (select 1 from profit_trends t
                        where t.recipe_id = r.id and t.profit_amount is not null)
  loop
    perform recompute_recipe(rec.id, 'recipe', null);
  end loop;
end
$seed$;


-- ── 7. RCP-16 조회 ────────────────────────────────────────────
-- 커서는 (occurred_at, id) 다. 날짜만으로는 같은 날 세 번 고친 순서를 못 지킨다.
create or replace function public.recipe_profit_history(
  p_recipe    uuid,
  p_before    timestamptz default null,
  p_before_id uuid default null,
  p_limit     int default 20
) returns jsonb language plpgsql stable security invoker as $fn$
declare
  v_lim  int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_list jsonb;
  v_next jsonb := null;
begin
  -- ⚠ 빠진 금액을 0원으로 메꾸지 않는다. 스냅샷이 반쪽이면 그건 버그이고,
  --   화면은 "불러오지 못했어요"라고 말해야 한다(기획 14절).
  if exists (
    select 1 from profit_trends
     where recipe_id = p_recipe and profit_amount is not null
       and (price is null or material_cost is null or extra_cost is null
            or tax_amount is null or fixed_cost is null)
  ) then
    raise exception '손익 스냅샷이 불완전합니다 (레시피 %)', p_recipe using errcode = '45003';
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at desc, q.id desc), '[]'::jsonb)
    into v_list
    from (
      select b.id,
             b.occurred_at,
             profit_event_title(b.source_type, b.source_label) as title,
             b.summary,
             b.source_label,
             b.cause ->> 'key'                        as cause_key,
             b.cause ->> 'label'                      as cause_label,
             (b.cause ->> 'before')::numeric          as cause_before,
             (b.cause ->> 'after')::numeric           as cause_after,
             b.prev_profit                            as profit_before,
             b.profit_amount                          as profit_after,
             b.profit_amount - b.prev_profit          as profit_delta,
             b.prev_rate                              as rate_before,
             b.profit_rate                            as rate_after
        from (
          select c.id, c.occurred_at, c.source_type, c.source_label, c.summary,
                 c.profit_amount, c.profit_rate,
                 p.profit_amount as prev_profit,
                 p.profit_rate   as prev_rate,
                 profit_delta_cause(p, c) as cause
            from profit_trends c
            left join profit_trends p on p.id = c.previous_snapshot_id
           where c.recipe_id = p_recipe
             and c.profit_amount is not null
             and not c.is_baseline
             and (p_before is null
                  or (c.occurred_at, c.id) < (p_before, coalesce(p_before_id, c.id)))
        ) b
       -- 아무 구성요소도 안 움직인 재계산은 사건이 아니다(기획 5.3).
       where b.cause is not null
       order by b.occurred_at desc, b.id desc
       limit v_lim + 1
    ) q;

  if jsonb_array_length(v_list) > v_lim then
    v_next := jsonb_build_object(
      'occurred_at', v_list -> (v_lim - 1) -> 'occurred_at',
      'id',          v_list -> (v_lim - 1) -> 'id');
    v_list := (select jsonb_agg(e) from jsonb_array_elements(v_list) with ordinality t(e, i)
                where i <= v_lim);
  end if;

  return jsonb_build_object('rows', v_list, 'next', v_next);
end;
$fn$;

comment on function public.recipe_profit_history(uuid, timestamptz, uuid, int) is
  'RCP-16 손익 변동 목록. 금액 있는 비-기준 행만, (occurred_at, id) 커서로 페이지를 넘긴다(0083).';

select public.assert_no_rpc_overloads();
