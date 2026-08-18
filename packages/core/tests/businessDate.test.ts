/**
 * 영업일·영업월 경계 — 가이드 §12 "날짜가 KST/UTC 변환으로 하루 밀리지 않는다".
 *
 * 문제: 앱은 기기 로컬(KST)로 날짜를 만들고, SQL 은 `to_char(now(),'YYYY-MM')`·`current_date` 로
 * UTC 기준 날짜를 찍는다. KST 00:00~09:00 구간에서 9시간이 어긋나 다음이 발생한다.
 *   - `recompute_recipe` 가 **전월** 고정지출률로 이번 달 손익을 확정한다
 *   - `profit_trends`·`price_trends` 의 날짜가 하루 밀린다 (append-only 라 되돌릴 수 없다)
 *   - 발주 `ordered_at` 이 하루 밀려 도착 예정·입고 지연 판정이 틀어진다
 *
 * 해결: 영업일 기준을 core 한 곳에서 정의하고 앱·SQL 이 같은 규칙을 쓴다.
 * 모든 테스트는 명시적 UTC 시각을 입력해 실행 시점·기기 시간대에 의존하지 않는다.
 */
import { describe, it, expect } from 'vitest';
import {
  BUSINESS_TZ_OFFSET_MIN,
  businessDay,
  businessMonth,
  businessDayRangeUtc,
  currentBusinessDay,
  currentBusinessMonth,
} from '../src';

/** UTC 시각을 만든다 (테스트 결정성을 위해 항상 UTC 로 지정). */
const utc = (iso: string) => new Date(iso);

describe('영업월 (businessMonth) — 월 경계', () => {
  it('KST 7월 1일 08:00 은 7월이다 (UTC 로는 아직 6월 30일 23:00)', () => {
    expect(businessMonth(utc('2026-06-30T23:00:00Z'))).toBe('2026-07');
  });

  it('KST 7월 1일 00:00 은 7월이다 (UTC 6월 30일 15:00)', () => {
    expect(businessMonth(utc('2026-06-30T15:00:00Z'))).toBe('2026-07');
  });

  it('KST 6월 30일 23:59 는 아직 6월이다 (UTC 6월 30일 14:59)', () => {
    expect(businessMonth(utc('2026-06-30T14:59:59Z'))).toBe('2026-06');
  });

  it('연말 경계 — KST 2027년 1월 1일 01:00 은 2027-01', () => {
    expect(businessMonth(utc('2026-12-31T16:00:00Z'))).toBe('2027-01');
  });

  it('연말 경계 — KST 2026년 12월 31일 23:00 은 2026-12', () => {
    expect(businessMonth(utc('2026-12-31T14:00:00Z'))).toBe('2026-12');
  });

  it('월은 항상 두 자리로 패딩한다', () => {
    expect(businessMonth(utc('2026-03-15T00:00:00Z'))).toBe('2026-03');
  });
});

describe('영업일 (businessDay) — 일 경계', () => {
  it('KST 7월 1일 08:00 은 2026-07-01', () => {
    expect(businessDay(utc('2026-06-30T23:00:00Z'))).toBe('2026-07-01');
  });

  it('KST 자정 직후는 이미 다음 날이다', () => {
    expect(businessDay(utc('2026-06-30T15:00:00Z'))).toBe('2026-07-01');
  });

  it('KST 자정 1분 전은 아직 전날이다', () => {
    expect(businessDay(utc('2026-06-30T14:59:00Z'))).toBe('2026-06-30');
  });

  it('윤년 2월 29일을 정확히 다룬다', () => {
    expect(businessDay(utc('2028-02-28T15:00:00Z'))).toBe('2028-02-29');
    expect(businessMonth(utc('2028-02-28T15:00:00Z'))).toBe('2028-02');
  });

  it('윤년 다음 날은 3월 1일', () => {
    expect(businessDay(utc('2028-02-29T15:00:00Z'))).toBe('2028-03-01');
  });

  it('일·월도 두 자리 패딩', () => {
    expect(businessDay(utc('2026-03-05T00:00:00Z'))).toBe('2026-03-05');
  });
});

describe('영업일의 UTC 구간 (businessDayRangeUtc) — 집계 질의용', () => {
  /** 형식이 맞는 날짜는 null 이 아님을 확인한 뒤 값을 꺼낸다. */
  const range = (ymd: string) => {
    const r = businessDayRangeUtc(ymd);
    expect(r).not.toBeNull();
    return r!;
  };

  it('KST 2026-07-01 하루는 UTC 6/30 15:00 이상 7/1 15:00 미만이다', () => {
    const r = range('2026-07-01');
    expect(r.startUtc.toISOString()).toBe('2026-06-30T15:00:00.000Z');
    expect(r.endUtc.toISOString()).toBe('2026-07-01T15:00:00.000Z');
  });

  it('구간은 시작 포함·끝 배타라서 인접한 날과 겹치지 않는다', () => {
    expect(range('2026-07-01').endUtc.getTime()).toBe(range('2026-07-02').startUtc.getTime());
  });

  it('구간 경계 시각이 각각 올바른 영업일로 되돌아온다 (왕복)', () => {
    const r = range('2026-07-01');
    expect(businessDay(r.startUtc)).toBe('2026-07-01');
    expect(businessDay(new Date(r.endUtc.getTime() - 1))).toBe('2026-07-01');
    expect(businessDay(r.endUtc)).toBe('2026-07-02');
  });
});

describe('시간대 상수', () => {
  it('영업 기준 시간대는 KST(+09:00) 고정이다', () => {
    expect(BUSINESS_TZ_OFFSET_MIN).toBe(540);
  });

  it('오프셋을 명시하면 다른 시간대로도 계산할 수 있다 (매장별 시간대 확장 지점)', () => {
    // UTC 기준(오프셋 0)에서는 아직 6월이다 — 현재 SQL 이 만들어내는 값과 같다.
    expect(businessMonth(utc('2026-06-30T23:00:00Z'), 0)).toBe('2026-06');
    expect(businessDay(utc('2026-06-30T23:00:00Z'), 0)).toBe('2026-06-30');
  });

  it('현재 SQL(UTC)과 영업 기준(KST)이 실제로 어긋나는 구간을 고정한다 — 회귀 방지', () => {
    const at = utc('2026-06-30T23:00:00Z'); // KST 7/1 08:00
    expect(businessMonth(at, 0)).toBe('2026-06'); // SQL 현행
    expect(businessMonth(at)).toBe('2026-07'); // 영업 기준
    expect(businessMonth(at, 0)).not.toBe(businessMonth(at));
  });
});

describe('잘못된 입력 방어', () => {
  it('유효하지 않은 Date 는 null 을 돌려준다', () => {
    expect(businessDay(new Date('nope'))).toBeNull();
    expect(businessMonth(new Date('nope'))).toBeNull();
  });

  it('형식이 잘못된 영업일 문자열은 null 을 돌려준다', () => {
    expect(businessDayRangeUtc('2026-7-1')).toBeNull();
    expect(businessDayRangeUtc('')).toBeNull();
  });
});

describe('현재 시각 헬퍼 — 호출부가 null 을 다루지 않아도 된다', () => {
  it('영업월은 항상 YYYY-MM 문자열이다', () => {
    expect(currentBusinessMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('영업일은 항상 YYYY-MM-DD 문자열이다', () => {
    expect(currentBusinessDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('영업일의 앞 7자리는 영업월과 같다', () => {
    // 두 호출 사이에 자정이 지나면 어긋날 수 있으나, 같은 밀리초 기준으로 다시 비교해 안정화한다.
    const at = new Date();
    expect(businessDay(at)!.slice(0, 7)).toBe(businessMonth(at));
  });
});
