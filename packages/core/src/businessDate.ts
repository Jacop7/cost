/**
 * 영업일·영업월 — 순수 날짜 변환.
 *
 * ⚠ **앱은 더 이상 이 파일로 "오늘"도 "이번 달"도 세지 않는다.** 날짜 권위는 서버 하나다 —
 *   판매 영업일은 `business_day_state().business_date`, 일반 기록의 달력 날짜는
 *   `store_local_date()`, 그 달은 그 값의 앞 7글자(`store_local_month()` 과 같다).
 *   앱에서는 `useSalesBusinessDate()` · `useStoreLocalDate()` 로 받는다.
 *   앱과 DB 가 각자 오늘을 계산하면 자정 전후에 하루가 갈린다(기획서 §2.1).
 *
 *   일(day) 은 0125 에서, 월(month) 은 0126 에서 닫았다. 두 번에 나뉜 이유가 곧 교훈이다 —
 *   일만 옮기고 "앱에서 오늘을 지웠다"고 적었는데 `currentBusinessMonth` 가 네 군데
 *   살아 있었다. 뉴욕 매장의 8/31 22:00 은 서울로 9/1 이라, 서버는 8월 장부를 보는데
 *   고정지출 화면만 9월을 열었다.
 *
 *   그래서 지금 `currentBusinessDay()` · `currentBusinessMonth()` 는 **부르는 곳이 없다**
 *   (레포 전체 확인, 주석 언급 제외). 새로 부르지 않는다 — 서버 날짜를 받아
 *   `businessDay(at)` 처럼 인자를 주는 변환만 쓴다.
 *   (`+09:00` 고정 오프셋이라 매장 시간대가 KST 가 아니면 애초에 틀린 값을 낸다.)
 *
 * 아래는 옮겨 오기 전의 배경 설명이다 —
 *
 * 문제 배경:
 *   앱은 기기 로컬(한국 사장님이면 KST)로 날짜를 만들고, SQL 은 `to_char(now(),'YYYY-MM')` ·
 *   `current_date` 로 **UTC** 날짜를 찍는다. KST 00:00~09:00 구간에서 9시간이 어긋나
 *   - `recompute_recipe` 가 **전월** 고정지출률로 이번 달 손익을 확정하고
 *   - `profit_trends`·`price_trends` 날짜가 하루 밀리며(append-only 라 되돌릴 수 없다)
 *   - 발주 `ordered_at` 이 하루 밀려 도착 예정·입고 지연 판정이 틀어진다.
 *
 * 규칙:
 *   영업일은 **매장 시간대의 자정~자정**이다. 1차 범위는 한국 매장이므로 KST(+09:00) 고정이며,
 *   `offsetMin` 인자로 매장별 시간대를 넣을 수 있게 확장 지점을 열어 둔다.
 *
 * ⚠ 고정 오프셋 방식이라 서머타임(DST)이 있는 지역에는 그대로 쓸 수 없다.
 *   KST·JST 는 DST 가 없어 안전하다. 유럽·미주 매장을 지원하게 되면 매장 시간대 컬럼과
 *   IANA 타임존 기반 변환으로 바꿔야 한다(그때 이 파일 한 곳만 고치면 된다).
 *
 * Intl/`toLocaleString` 을 쓰지 않는 이유는 locale.ts 와 같다 — Hermes 의 Intl 은 플랫폼 ICU 에
 * 의존해 기기마다 결과가 달라질 수 있는데, 손익이 귀속되는 날짜는 기기와 무관해야 한다.
 */

/** 영업 기준 시간대 오프셋(분). KST = UTC+09:00. */
export const BUSINESS_TZ_OFFSET_MIN = 9 * 60;

const MS_PER_MIN = 60_000;
const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' 형식만 허용한다(월·일 두 자리 고정). */
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC 시각을 영업 시간대로 옮긴 "가상 UTC" Date. getUTC* 로 읽으면 영업 기준 연·월·일이 된다. */
function shifted(at: Date, offsetMin: number): Date | null {
  const t = at.getTime();
  if (!Number.isFinite(t) || !Number.isFinite(offsetMin)) return null;
  return new Date(t + offsetMin * MS_PER_MIN);
}

/**
 * 영업월 'YYYY-MM'. 고정지출·월 손익의 귀속 월 키로 쓴다.
 * 예: UTC 2026-06-30T23:00Z → KST 로는 7월 1일 08시이므로 '2026-07'.
 */
export function businessMonth(at: Date, offsetMin: number = BUSINESS_TZ_OFFSET_MIN): string | null {
  const d = shifted(at, offsetMin);
  if (d === null) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/**
 * 영업일 'YYYY-MM-DD'. 추이 스냅샷·발주일·입고일의 귀속 날짜로 쓴다.
 * 예: UTC 2026-06-30T15:00Z → KST 로는 이미 7월 1일 자정이므로 '2026-07-01'.
 */
export function businessDay(at: Date, offsetMin: number = BUSINESS_TZ_OFFSET_MIN): string | null {
  const d = shifted(at, offsetMin);
  if (d === null) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * 영업일 하루에 해당하는 UTC 구간 — `[startUtc, endUtc)`.
 * 기간 집계 질의에서 쓴다. 끝을 배타(exclusive)로 둬서 인접한 날과 겹치지 않는다.
 * 형식이 잘못된 문자열은 null.
 */
export function businessDayRangeUtc(
  ymd: string,
  offsetMin: number = BUSINESS_TZ_OFFSET_MIN,
): { startUtc: Date; endUtc: Date } | null {
  const m = YMD_RE.exec(ymd);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // 영업 시간대의 자정을 UTC 로 되돌린다.
  const startMs = Date.UTC(year, month - 1, day) - offsetMin * MS_PER_MIN;
  const start = new Date(startMs);

  // 되돌린 값이 입력과 같은 날짜로 재해석되지 않으면 존재하지 않는 날짜(예: 2월 30일)다.
  if (businessDay(start, offsetMin) !== ymd) return null;

  return { startUtc: start, endUtc: new Date(startMs + 24 * 60 * MS_PER_MIN) };
}

/**
 * 지금 이 순간의 영업월 'YYYY-MM'. 호출부가 null 을 신경 쓰지 않아도 되게 문자열을 보장한다.
 * `new Date()` 는 항상 유효하므로 폴백은 실제로는 도달하지 않지만, 타입 구멍을 남기지 않기 위해 둔다.
 */
export function currentBusinessMonth(offsetMin: number = BUSINESS_TZ_OFFSET_MIN): string {
  return businessMonth(new Date(), offsetMin) ?? new Date().toISOString().slice(0, 7);
}

/** 지금 이 순간의 영업일 'YYYY-MM-DD'. 위와 같은 이유로 문자열을 보장한다. */
export function currentBusinessDay(offsetMin: number = BUSINESS_TZ_OFFSET_MIN): string {
  return businessDay(new Date(), offsetMin) ?? new Date().toISOString().slice(0, 10);
}
