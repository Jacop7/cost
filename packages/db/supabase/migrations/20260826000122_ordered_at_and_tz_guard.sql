-- ════════════════════════════════════════════════════════════════
-- 0122 · 1단계 마무리 — 전역 기본값과 시간대 검증
--
-- 0121 이 함수 13개를 옮겼지만 **테이블 기본값에 남은 게 있었다.**
--
--     order_records.ordered_at  default  business_day()
--
-- 지금은 `e7_place_order` 가 날짜를 명시하므로 앱에서는 안 틀린다. 그런데
-- 직접 삽입이나 새 쓰기 경로가 생기면 **판매 영업일이 발주일에 다시 들어간다.**
-- 그러면 자정 너머 영업하는 집에서 새벽 입고가 어제 발주로 적힌다.
--
-- ⚠ 행의 `store_id` 를 모르는 **전역 기본값은 쓰면 안 된다.** 매장마다 시간대가
--   다를 수 있는데 기본값 표현식은 그 행이 어느 매장인지 모른다.
--   기본값을 없애고 **넣는 쪽이 반드시 정하게** 한다.
--   확인함: `order_records` 에 insert 하는 함수는 `e7_place_order` 하나뿐이고,
--   거기서 `ordered_at` 을 항상 명시한다(`coalesce(p_ordered_at, store_local_date(p_store))`).
--
-- 그리고 시간대 값에 검증이 없었다 —
--   `timezone` 은 설명만 IANA 였고 실제로는 아무 문자열이나 들어갔다.
--   틀린 값이 들어가면 그 매장의 입고·발주·재고 수정이 **날짜 계산 단계에서 전부** 죽는다.
--   설정 한 줄이 매장을 통째로 멈추게 두면 안 된다.
-- ════════════════════════════════════════════════════════════════

-- ── ① 전역 기본값 제거 ────────────────────────────────────────
-- 남은 행은 이미 값이 있다. 앞으로 안 넣으면 not null 이 잡는다.
alter table order_records alter column ordered_at drop default;

do $chk$
begin
  if exists (select 1 from order_records where ordered_at is null) then
    raise exception '0122: ordered_at 이 빈 발주가 있습니다 — 기본값을 지우기 전에 채워야 합니다'
      using errcode = '45003';
  end if;
end
$chk$;

alter table order_records alter column ordered_at set not null;

comment on column order_records.ordered_at is
  '발주일. **매장 현지 달력 날짜**다(0121). ⚠ 전역 기본값을 두지 않는다(0122) — '
  '기본값 표현식은 그 행이 어느 매장인지 몰라서 남의 시간대로 날짜를 정하게 된다. '
  '넣는 쪽(e7_place_order)이 store_local_date 로 정해서 반드시 명시한다.';


-- ── ② 시간대 값 검증 + updated_at ─────────────────────────────
-- ⚠ CHECK 제약으로는 못 한다. `pg_timezone_names` 조회는 immutable 이 아니다.
--   트리거로 막는다.
create or replace function public.store_time_settings_guard()
returns trigger language plpgsql as $fn$
begin
  if new.timezone is null or btrim(new.timezone) = '' then
    raise exception '시간대를 골라 주세요' using errcode = '22000';
  end if;

  -- PostgreSQL 이 아는 이름인가. 'Asia/Seoul' 은 되고 'Asia/Seoul '·'KST+9' 는 막는다.
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception '알 수 없는 시간대예요 (%). 지역/도시 형식이어야 해요 — 예: Asia/Seoul', new.timezone
      using errcode = '22000';
  end if;

  new.updated_at := now();
  return new;
end $fn$;

drop trigger if exists store_time_settings_guard_trg on store_time_settings;
create trigger store_time_settings_guard_trg
  before insert or update on store_time_settings
  for each row execute function public.store_time_settings_guard();


-- ── ③ 서울은 **백필용**이지 영구 기본값이 아니다 ──────────────
/*
 * 지금 서울로 채워 둔 건 **이미 있는 매장**을 멈추지 않게 하려는 것이다.
 * 해외 매장이 생기면 서울이 맞을 리 없는데, 값이 이미 들어 있으면
 * 사장님도 화면도 "이건 정해진 값"으로 읽는다. 그래서 **정했는지**를 따로 남긴다.
 *
 * 앱은 `confirmed = false` 면 첫 기록 전에 시간대를 고르게 해야 한다.
 * 서버는 막지 않는다 — 시간대를 안 골랐다고 장사를 못 하게 하는 게 더 나쁘다.
 */
alter table store_time_settings
  add column if not exists confirmed boolean not null default false;

comment on column store_time_settings.confirmed is
  '사장님이 시간대를 **직접 고른** 적이 있는가(0122). false 면 백필·기본값으로 들어간 '
  '''Asia/Seoul'' 이라는 뜻이다. 앱은 첫 기록 전에 고르게 해야 한다. '
  '⚠ 서버는 막지 않는다 — 시간대를 안 골랐다고 장사를 못 하게 하는 건 더 나쁘다.';

-- 지금 있는 행들은 백필로 들어온 것이다. 정한 적이 없다.
update store_time_settings set confirmed = false where confirmed is null;


-- ── 되읽어서 확인한다 ─────────────────────────────────────────
do $chk$
declare v_ok boolean;
begin
  -- 기본값이 사라졌나
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'order_records'
                and column_name = 'ordered_at' and column_default is not null) then
    raise exception '0122: ordered_at 기본값이 남아 있습니다' using errcode = '45003';
  end if;

  -- 틀린 시간대를 막나
  begin
    insert into store_time_settings (store_id, timezone)
    values ('00000000-0000-0000-0000-0000000000ff', '아무거나');
    v_ok := false;
  exception
    when sqlstate '22000' then v_ok := true;   -- 우리가 막았다
    when others then v_ok := true;             -- 외래키 등 다른 이유로도 못 들어간다
  end;
  if not v_ok then
    raise exception '0122: 틀린 시간대가 통과했습니다' using errcode = '45003';
  end if;

  -- 맞는 시간대는 통과하고 updated_at 이 갱신되나
  if exists (select 1 from stores) then
    update store_time_settings
       set timezone = timezone, updated_at = '2000-01-01'::timestamptz
     where store_id = (select id from stores limit 1);
    if (select updated_at from store_time_settings
         where store_id = (select id from stores limit 1)) < now() - interval '1 minute' then
      raise exception '0122: updated_at 이 자동 갱신되지 않습니다' using errcode = '45003';
    end if;
  end if;
end
$chk$;

select public.assert_no_rpc_overloads();
