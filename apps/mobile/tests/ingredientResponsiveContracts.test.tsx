import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BasePriceCard } from '@/features/ingredients/components/BasePriceCard';
import { HistoryFilterSheet, PeriodSheet } from '@/features/ingredients/screens/HistoryFilterSheet';
import { RecentChangeRow } from '@/features/changes/components/RecentChangeRow';
import { RecipeDetailRow } from '@/features/recipes/components/RecipeDetailParts';
import { IngCard } from '@/features/ingredients/components/IngCard';

// 서버가 제공한 매장 시간대 fixture. 기기 시간대는 사용하지 않는다.
vi.mock('@/features/business-day/businessDay', () => ({
  useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }),
}));

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

  it('상태는 본문 텍스트, 일시는 수정 접미사 한 줄로 표시하고 이력 이동을 유지한다', () => {
    const press = vi.fn();
    render(<RecentChangeRow change={{ occurredAt: '2026-09-08T01:00:00Z', eventId: 'change-1', displayState: 'reflected', hasHistory: true }} onPress={press} />);
    const status = screen.getByText('현재 매출에 반영 중');
    render(<RecipeDetailRow label="판매가" value="12,000원" />);
    expect(getComputedStyle(status).fontSize).toBe(getComputedStyle(screen.getByText('판매가')).fontSize);
    expect(getComputedStyle(status).color).toBe('rgb(25, 31, 40)');
    expect(getComputedStyle(status.parentElement!).flexShrink).toBe('1');
    expect(status.parentElement!.style.flex).not.toBe('1 1 0%');
    const label = screen.getByText('26-09-08 10:00 수정');
    expect(screen.queryByText('최근 수정')).toBeNull();
    expect(label.textContent).toBe('26-09-08 10:00 수정');
    const row = screen.getByRole('button', { name: /현재 매출에 반영 중.*수정 내역 보기/ });
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

  it.each(['not_reflected', 'partial'] as const)('서버가 %s인 변경을 주면 같은 스타일로 두 상태를 표시하고 반영 후 숨긴다', displayState => {
    const change = { occurredAt: '2026-09-08T01:00:00Z', eventId: 'pending-1', displayState, hasHistory: true };
    const press = vi.fn();
    const view = render(<RecentChangeRow change={change} onPress={press} />);
    expect(screen.getByText('현재 매출에 반영 중')).toBeTruthy();
    const pending = screen.getByText('영업 종료 후 반영 예정');
    expect(getComputedStyle(pending).color).toBe(getComputedStyle(screen.getByText('현재 매출에 반영 중')).color);
    expect(getComputedStyle(pending).fontSize).toBe(getComputedStyle(screen.getByText('현재 매출에 반영 중')).fontSize);
    expect(pending.parentElement!.parentElement!.querySelector('svg')).toBeTruthy();
    expect(screen.getAllByText('26-09-08 10:00 수정')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /영업 종료 후 반영 예정.*수정 내역 보기/ }));
    expect(press).toHaveBeenCalledOnce();
    view.rerender(<RecentChangeRow change={{ ...change, displayState: 'reflected' }} onPress={press} />);
    expect(screen.queryByText('영업 종료 후 반영 예정')).toBeNull();
  });

  it.each(['irrelevant', null] as const)('무관하거나 모르는 상태 %s에는 예정 안내를 만들지 않는다', displayState => {
    render(<RecentChangeRow change={{ occurredAt: '2026-09-08T01:00:00Z', eventId: 'change-1', displayState, hasHistory: true }} onPress={() => {}} />);
    expect(screen.queryByText('영업 종료 후 반영 예정')).toBeNull();
    expect(screen.getByText('현재 매출에 반영 중')).toBeTruthy();
    expect(screen.queryByText('매출 계산과 무관')).toBeNull();
  });

  it('최근 이름 수정이 무관해도 서버 요약에 대기가 있으면 두 상태를 유지한다', () => {
    render(<RecentChangeRow change={{ occurredAt: '2026-09-08T01:00:00Z', eventId: 'name-change', displayState: 'irrelevant', hasHistory: true, hasPendingChange: true, pendingOccurredAt: '2026-09-08T00:30:00Z' }} onPress={() => {}} />);
    expect(screen.getByText('현재 매출에 반영 중')).toBeTruthy();
    expect(screen.getByText('영업 종료 후 반영 예정')).toBeTruthy();
    expect(screen.queryByText('매출 계산과 무관')).toBeNull();
    expect(screen.getByText('26-09-08 10:00 수정')).toBeTruthy();
    expect(screen.getByText('26-09-08 09:30 수정')).toBeTruthy();
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
