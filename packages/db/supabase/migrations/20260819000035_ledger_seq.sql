-- ════════════════════════════════════════════════════════════════
-- 0035 · 원장에 기록 순서 보존
--
-- `occurred_at` 은 **영업일 자정**으로 통일되어 있다(과거 날짜 등록을 허용하기 위해서다).
-- 그래서 같은 날 여러 사건이 있으면 순서를 알 수 없고, 정렬이 무작위가 된다.
-- 그 결과 잔량 누적이 이렇게 보였다:
--
--   08-19 입고  +3,000  → 잔량 2,410
--   08-19 소진    -120  → 잔량  -590     ← 입고보다 먼저로 정렬돼 음수
--
-- 최종 잔량은 맞지만 중간이 음수라 사장님은 "재고가 마이너스였다"고 읽는다.
-- 사건이 **기록된 순서**를 컬럼으로 남겨 정렬 기준을 확정한다.
-- ════════════════════════════════════════════════════════════════

alter table inventory_events add column if not exists seq bigint;

-- 기존 행 backfill — 같은 날이면 입고를 먼저 둔다.
-- 재고가 들어온 뒤에 빠지는 것이 물리적으로 맞는 순서다.
with ordered as (
  select id, row_number() over (
           order by occurred_at,
                    case type when 'inbound' then 0 when 'stocktake' then 1 else 2 end,
                    id) as rn
    from inventory_events
   where seq is null
)
update inventory_events ev set seq = ordered.rn from ordered where ordered.id = ev.id;

create sequence if not exists inventory_events_seq_seq;
select setval('inventory_events_seq_seq', coalesce((select max(seq) from inventory_events), 0) + 1, false);

alter table inventory_events alter column seq set default nextval('inventory_events_seq_seq');
alter table inventory_events alter column seq set not null;

create index if not exists inventory_events_ing_seq_idx on inventory_events (ingredient_id, seq);

comment on column inventory_events.seq is
  '기록 순서. occurred_at 은 영업일 자정이라 같은 날 사건의 선후를 구분하지 못한다(0035).';

create or replace function public.stock_history(
  p_ingredient uuid, p_from date default null, p_to date default null
) returns table (
  id uuid, occurred_on date, type inventory_event_type,
  count_delta numeric, volume_delta numeric, note text, balance numeric
) language sql stable security invoker as $fn$
  select e.id, e.occurred_on, e.type, e.count_delta, e.volume_delta, e.note, e.balance
    from (
      select ev.id,
             (ev.occurred_at at time zone business_tz())::date as occurred_on,
             ev.type, ev.count_delta, ev.volume_delta, ev.note, ev.seq,
             sum(ev.count_delta) over (order by ev.seq
                                       rows between unbounded preceding and current row) as balance
        from inventory_events ev
       where ev.ingredient_id = p_ingredient
    ) e
   where (p_from is null or e.occurred_on >= p_from)
     and (p_to   is null or e.occurred_on <= p_to)
   order by e.seq desc;
$fn$;

select public.assert_no_rpc_overloads();
