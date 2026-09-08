import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasePriceCard, type InboundRecord } from '@/features/ingredients/components/BasePriceCard';
const record = (id: string, overrides: Partial<InboundRecord> = {}): InboundRecord => ({
  id, orderedAt: '2030-07-15', status: 'received', volume: 1000, amount: 4000,
  qty: 2, receivedQty: 2, vendorName: id, unitPrice: 4, ...overrides,
});
describe('식재료 상세 기준 단가 미리보기', () => {
  it('서버 확정 단가를 보존하고 입고 대기·취소·미수령을 제외한 3건만 보여준다', () => {
    const more = vi.fn();
    render(<BasePriceCard unit="g" basePrice={7} purchase={{ count: 4, avg: 6, low: 4, high: 4 }} onSeeAll={more}
      orders={[record('대기', { status: 'ordered' }), record('취소', { status: 'canceled' }), record('미수령', { receivedQty: 0 }),
        record('입고1'), record('입고2'), record('입고3'), record('입고4')]} />);
    expect(screen.getByText('7.00원/g')).toBeTruthy(); expect(screen.getByText('6.00원/g')).toBeTruthy();
    for (const name of ['대기', '취소', '미수령', '입고4']) expect(screen.queryByText(new RegExp(name))).toBeNull();
    expect(screen.getByText('최저 · 최고 · 입고1')).toBeTruthy();
    expect(screen.getByText('입고2')).toBeTruthy(); expect(screen.getByText('입고3')).toBeTruthy();
    expect(screen.getAllByText('총 2kg (1kg × 2개) · 8,000원')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '입고 이력 전체 보기' })); expect(more).toHaveBeenCalledOnce();
  });
  it('부분 입고는 실제 수령분 금액·용량만 표시하고 3건 이하면 전체보기는 숨긴다', () => {
    render(<BasePriceCard unit="g" basePrice={4} purchase={{ count: 1, avg: 4, low: 4, high: 4 }} onSeeAll={() => {}}
      orders={[record('부분', { status: 'partial', qty: 3, receivedQty: 1 })]} />);
    expect(screen.getByText('총 1kg (1kg × 3개 중 1개) · 4,000원 · 도착분만 반영')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '입고 이력 전체 보기' })).toBeNull();
  });
});
