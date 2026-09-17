import { beforeEach, describe, expect, it, vi } from 'vitest';
import { latestOrderInboundDates, readOrderInboundDates, type OrderInboundDateEvent } from '@/features/orders/orderInboundDates';

const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: db }));
const event = (id: string, seq: number, occurred_at: string, extra: Partial<OrderInboundDateEvent> = {}): OrderInboundDateEvent => ({
  id, seq, occurred_at, order_record_id: 'order-a', type: 'inbound', reverses_event_id: null, ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const key of ['from', 'select', 'eq', 'in', 'order'] as const) db[key].mockReturnValue(db);
});

describe('입고 완료 실제 날짜', () => {
  it('입력 순서가 아닌 실제 발생일을 사용하고 주문별로 구분한다', () => {
    const dates = latestOrderInboundDates([
      event('later-date', 1, '2030-09-17T02:00:00Z'),
      event('backdated', 2, '2030-09-16T02:00:00Z'),
      event('other', 3, '2030-09-18T02:00:00Z', { order_record_id: 'order-b' }),
    ]);
    expect(dates.get('order-a')).toBe('2030-09-17T02:00:00Z');
    expect(dates.get('order-b')).toBe('2030-09-18T02:00:00Z');
  });

  it('취소된 입고와 이전 회차를 제외하고 재입고 날짜를 선택한다', () => {
    const dates = latestOrderInboundDates([
      event('old', 1, '2030-09-20T02:00:00Z'),
      event('legacy-cancel', 2, '2030-09-21T02:00:00Z', { type: 'adjust' }),
      event('new', 3, '2030-09-17T02:00:00Z'),
      event('reverted', 4, '2030-09-18T02:00:00Z'),
      event('reversal', 5, '2030-09-19T02:00:00Z', { type: 'reversal', reverses_event_id: 'reverted' }),
    ]);
    expect(dates.get('order-a')).toBe('2030-09-17T02:00:00Z');
    expect(latestOrderInboundDates([event('bad', 1, 'invalid')]).size).toBe(0);
  });

  it('두 번째 페이지의 취소까지 읽고 매장과 주문 범위를 제한한다', async () => {
    const first = Array.from({ length: 500 }, (_, i) => event(`e${i}`, i + 1, '2030-09-17T02:00:00Z'));
    db.range.mockResolvedValueOnce({ data: first, error: null })
      .mockResolvedValueOnce({ data: [event('cancel', 501, '2030-09-18T02:00:00Z', { type: 'adjust' })], error: null });
    expect((await readOrderInboundDates('store-a', ['order-a', 'order-a'])).size).toBe(0);
    expect(db.eq).toHaveBeenCalledWith('store_id', 'store-a');
    expect(db.in).toHaveBeenCalledWith('order_record_id', ['order-a']);
    expect(db.range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });

  it('완료 주문이 없으면 조회하지 않고, 조회 실패를 날짜 없음으로 숨기지 않는다', async () => {
    expect((await readOrderInboundDates('store-a', [])).size).toBe(0);
    expect(db.from).not.toHaveBeenCalled();
    db.range.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(readOrderInboundDates('store-a', ['order-a'])).rejects.toThrow('입고 날짜를 확인하지 못했어요');
  });
});
