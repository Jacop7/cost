-- ════════════════════════════════════════════════════════════════
-- 0093 · 기타 매출에도 판매 채널이 있다
--
-- 사장님: "기타 매출 추가할 때 판매 채널 선택하는 것 있어야 해"
--
-- 지금 장부에는 소주 14병이 매장에서 나갔는지 배달로 나갔는지가 없다.
-- 그래서 채널별 손익이 기타 매출을 통째로 빼고 계산한다
-- (SalesChannelScreen: "기타 매출은 채널이 없으므로 분모에서 뺀다").
-- 실측 08-22 기준 146,000원 — 하루 매출의 27.6% 가 채널 장부 밖에 있다.
--
-- ⚠ **이미 쌓인 줄은 채우지 않는다.** 그 소주가 매장이었는지 우리는 모른다.
--   `channel` 이 없으면 '미지정'이고, 지금처럼 채널 분할에서 빠진다.
--   화면이 그 몫을 따로 보여 주니 사장님이 고칠 수 있다.
--   추정해서 넣으면 "배달이 적자"라는 잘못된 결론이 나온다(0043 과 같은 함정).
--
-- ⚠ 채널은 매장·배달앱·포장 **3개 고정**이다. 네 번째는 없다 —
--   `daily_sales_items` 가 세 컬럼이라 수량을 넣을 곳이 없다.
-- ════════════════════════════════════════════════════════════════

-- ── 1. 못 쓰는 채널 코드는 못 들어온다 ────────────────────────
-- ⚠ save_sale 본문을 조각내 고치지 않는다. 여러 줄 치환은 파일 CRLF 와
--   pg_get_functiondef() 의 LF 가 어긋나 안 맞는다(0084). 트리거로 못 박는다(0087 과 같은 수).
create or replace function public.daily_sales_etc_channel() returns trigger
language plpgsql as $fn$
declare v_bad text;
begin
  select i->>'channel' into v_bad
    from jsonb_array_elements(
           case when jsonb_typeof(new.etc_items) = 'array' then new.etc_items else '[]'::jsonb end) i
   where jsonb_typeof(i -> 'channel') = 'string'
     and (i->>'channel') not in ('hall', 'delivery', 'takeout')
   limit 1;

  if v_bad is not null then
    raise exception '기타 매출의 판매 채널이 올바르지 않습니다: %', v_bad using errcode = '45004';
  end if;
  return new;
end
$fn$;

comment on function public.daily_sales_etc_channel() is
  '기타 매출 줄의 channel 을 매장·배달앱·포장으로 막는다(0093). '
  '값이 없으면 미지정이고, 그건 허용한다 — 옛 장부가 그렇다.';

drop trigger if exists daily_sales_etc_channel_trg on daily_sales;
create trigger daily_sales_etc_channel_trg
  before insert or update of etc_items on daily_sales
  for each row execute function public.daily_sales_etc_channel();


-- ── 2. 채널별 기타 매출 ───────────────────────────────────────
-- ⚠ sales_range 는 건드리지 않는다. 거기 channels 는 여러 줄짜리 CTE 라
--   조각 치환이 위험하다. 채널 화면이 고정지출을 따로 받아 오는 것과 같은 짜임이다.
create or replace function public.sales_etc_by_channel(p_store uuid, p_from date, p_to date)
returns jsonb language sql stable as $fn$
  with items as (
    select ds.sale_date,
           nullif(i->>'channel', '') as code,
           coalesce((i->>'price')::numeric, 0) * coalesce((i->>'qty')::numeric, 1) as amount
      from daily_sales ds
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(ds.etc_items) = 'array' then ds.etc_items else '[]'::jsonb end) i
     where ds.store_id = p_store and ds.sale_date between p_from and p_to
  ),
  -- 세금은 하루치 한 덩어리로 얼어 있다(0091). 같은 날 기타 매출은 같은 요율이라
  -- 금액 비중으로 나누는 게 배분이 아니라 **정확한 분해**다.
  day_tax as (
    select ds.sale_date, coalesce(ds.etc_tax, 0) as tax,
           (select coalesce(sum(coalesce((j->>'price')::numeric, 0)
                              * coalesce((j->>'qty')::numeric, 1)), 0)
              from jsonb_array_elements(
                case when jsonb_typeof(ds.etc_items) = 'array' then ds.etc_items else '[]'::jsonb end) j) as total
      from daily_sales ds
     where ds.store_id = p_store and ds.sale_date between p_from and p_to
  ),
  split as (
    select it.code,
           sum(it.amount) as amount,
           sum(it.amount * dt.tax / nullif(dt.total, 0)) as tax
      from items it join day_tax dt on dt.sale_date = it.sale_date
     group by it.code
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'total', (select coalesce(sum(amount), 0) from split),
    'by_channel', (select coalesce(jsonb_object_agg(code, jsonb_build_object(
                       'amount', amount, 'tax', coalesce(tax, 0))), '{}'::jsonb)
                     from split where code is not null),
    'unassigned', (select coalesce(sum(amount), 0) from split where code is null),
    'unassigned_tax', (select coalesce(sum(tax), 0) from split where code is null)
  );
$fn$;

comment on function public.sales_etc_by_channel(uuid, date, date) is
  '채널별 기타 매출(0093). 채널이 없는 옛 줄은 unassigned 로 따로 준다 — '
  '⚠ 매장으로 밀어 넣지 않는다. 모르는 것을 아는 척하면 채널 손익이 거짓말이 된다.';

select public.assert_no_rpc_overloads();
