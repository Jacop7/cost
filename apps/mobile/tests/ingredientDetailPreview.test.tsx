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
    const seller = screen.getByText('입고1');
    expect(seller.parentElement?.textContent).toBe('최저최고입고1');
    expect(seller.parentElement?.previousElementSibling?.textContent).toBe('07/15');
    expect(screen.getByText('입고2')).toBeTruthy(); expect(screen.getByText('입고3')).toBeTruthy();
    expect(screen.getAllByText('총 2kg')).toHaveLength(3);
    expect(screen.getAllByText('8,000원')).toHaveLength(3);
    expect(screen.getAllByText('총 2kg')[0]!.nextElementSibling?.textContent).toBe('(1kg × 2개)');
    expect(screen.getAllByText('8,000원')[0]!.parentElement).toBe(seller.parentElement?.parentElement);
    fireEvent.click(screen.getByRole('button', { name: '구매 이력 자세히보기' })); expect(more).toHaveBeenCalledOnce();
  });
  it('부분 입고는 실제 수령분 금액·용량만 표시하고 1건이어도 전체보기를 제공한다', () => {
    render(<BasePriceCard unit="g" basePrice={4} purchase={{ count: 1, avg: 4, low: 4, high: 4 }} onSeeAll={() => {}}
      orders={[record('부분', { status: 'partial', qty: 3, receivedQty: 1 })]} />);
    expect(screen.getByText('총 1kg').nextElementSibling?.textContent).toBe('(1kg × 3개 중 1개)\n도착분만 반영');
    expect(screen.getByText('4,000원')).toBeTruthy();
    expect(screen.getByRole('button', { name: '구매 이력 자세히보기' })).toBeTruthy();
  });
  it('구매 기록이 없어도 전체보기로 빈 구매 이력을 확인할 수 있다', () => {
    const more = vi.fn();
    render(<BasePriceCard unit="g" basePrice={null} purchase={{ count: 0, avg: null, low: null, high: null }} orders={[]} onSeeAll={more} />);
    fireEvent.click(screen.getByRole('button', { name: '구매 이력 자세히보기' }));
    expect(more).toHaveBeenCalledOnce();
  });
});
