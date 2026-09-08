import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasePriceCard } from '@/features/ingredients/components/BasePriceCard';
import { HistoryFilterSheet, PeriodSheet } from '@/features/ingredients/screens/HistoryFilterSheet';
import { RecentChangeRow } from '@/features/changes/components/RecentChangeRow';
import { IngCard } from '@/features/ingredients/components/IngCard';

// Structural and interaction guards only. Layout/overflow is measured separately by Chromium.
describe('식재료 큰 글자 계약', () => {
  it('카드 이름은 공용 배지 사이에서 소실되지 않도록 그룹이 래핑되며 원래 상태/수량을 유지한다', () => {
    const press = vi.fn();
    render(<IngCard onPress={press} g={{ id: 'ingredient-1', name: '설탕', categoryName: '상온가공·건식',
      baseUnit: 'g', perVolume: 1000, safetyStock: 2000, vendorName: null, memo: null,
      stockTotal: -750, basePrice: 4, soonOut: false, lastInboundAt: '2026-09-08' }} />);
    const name = screen.getByText('설탕');
    expect(getComputedStyle(name.parentElement!).flexWrap).toBe('wrap');
    expect(getComputedStyle(name).maxWidth).toBe('100%');
    expect(screen.getByText('소진')).toBeTruthy();
    expect(screen.getByText(/750g/).textContent).toMatch(/[−-]750g/);
    fireEvent.click(screen.getByRole('button', { name: '설탕 상세' }));
    expect(press).toHaveBeenCalledOnce();
  });

  it('현재 매출 반영 배지는 한 줄 계약과 전체 접근성 라벨을 유지하며 부모 폭 안에서 축소된다', () => {
    const press = vi.fn();
    render(<RecentChangeRow change={{ occurredAt: '2026-09-08T01:00:00Z', eventId: 'change-1', displayState: 'reflected', hasHistory: true }} onPress={press} />);
    const badge = screen.getByText('현재 매출 반영');
    expect(getComputedStyle(badge.parentElement!).maxWidth).toBe('100%');
    expect(getComputedStyle(badge.parentElement!.parentElement!).flexShrink).toBe('1');
    expect(badge.parentElement!.parentElement!.style.flex).not.toBe('1 1 0%');
    const label = screen.getByText(/^최근 수정/);
    expect(getComputedStyle(label).flexShrink).toBe('1');
    const row = screen.getByRole('button', { name: /현재 매출 반영.*수정 내역 보기/ });
    fireEvent.click(row);
    expect(press).toHaveBeenCalledOnce();
  });

  it('기준 단가와 최저/최고 값은 계산값 그대로이며 요약 그룹에 줄바꿈을 허용한다', () => {
    render(<BasePriceCard unit="g" basePrice={4} purchase={{ count: 1, avg: 4, low: 3, high: 5 }} orders={[]} onSeeAll={() => {}} />);
    const average = screen.getByText('가중평균');
    expect(getComputedStyle(average.parentElement!.parentElement!).flexWrap).toBe('wrap');
    const minimum = screen.getByText('최저');
    expect(getComputedStyle(minimum.parentElement!.parentElement!).flexWrap).toBe('wrap');
    expect(screen.getAllByText('4.00원/g')).toHaveLength(2);
    expect(screen.getByText('3.00원/g')).toBeTruthy();
    expect(screen.getByText('5.00원/g')).toBeTruthy();
  });

  it('조회 시트는 서버 날짜의 기간과 유형/정렬 선택을 그대로 적용한다', async () => {
    const apply = vi.fn();
    render(<HistoryFilterSheet today="2026-09-08" visible onClose={() => {}}
      value={{ period: '최근 3개월', kind: '전체', order: '최신순' }} kinds={['전체', '입고', '폐기']} onApply={apply} />);
    await waitFor(() => expect(screen.getByText('2026.06.10')).toBeTruthy());
    const end = screen.getByText('2026.09.08');
    expect(getComputedStyle(end.parentElement!).flexWrap).toBe('wrap');
    fireEvent.click(screen.getByRole('button', { name: '오늘' }));
    fireEvent.click(screen.getByRole('button', { name: '폐기' }));
    fireEvent.click(screen.getByRole('button', { name: '오래된순' }));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    expect(apply).toHaveBeenCalledWith({ period: '오늘', kind: '폐기', order: '오래된순' });
  });

  it('기간 전용 시트도 동일 날짜 줄바꿈을 쓰고 기간만 전달한다', async () => {
    const apply = vi.fn();
    render(<PeriodSheet today="2026-09-08" visible onClose={() => {}} value="최근 3개월" onApply={apply} />);
    await waitFor(() => expect(screen.getByText('2026.09.08')).toBeTruthy());
    expect(getComputedStyle(screen.getByText('2026.09.08').parentElement!).flexWrap).toBe('wrap');
    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    expect(screen.getByText('처음')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(apply).toHaveBeenCalledWith('전체');
  });
});
