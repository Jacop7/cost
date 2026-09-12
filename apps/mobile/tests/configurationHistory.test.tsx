import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseConfigurationEvent } from '@/features/changes/configurationHistory';
import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
import ConfigurationHistoryScreen from '@/features/changes/screens/ConfigurationHistoryScreen';

const mock = vi.hoisted(() => ({ history: vi.fn(), push: vi.fn(), more: vi.fn(), retry: vi.fn(), params: {} as Record<string, string> }));
vi.mock('@/features/changes/configurationHistory', async original => ({
  ...await original<typeof import('@/features/changes/configurationHistory')>(), useConfigurationHistory: mock.history,
}));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }) }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => mock.params, useRouter: () => ({ push: mock.push }), router: { canGoBack: () => false, replace: vi.fn() } }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null,
}));

const taxEvent = () => parseConfigurationEvent({ id: '2', source: 'tax_profile', occurred_at: '2026-09-12T01:20:00Z', effective_from: '2026-09-13',
  before_value: { components: [{ key: 'vat', name: '부가세', rate_pct: 10 }] }, after_value: { components: [{ key: 'vat', name: '부가세', rate_pct: 12 }] } });
const state = (items = [taxEvent()]) => ({ data: { pages: [{ items, count: items.length }] }, isLoading: false, error: null,
  hasNextPage: false, isFetchingNextPage: false, fetchNextPage: mock.more, refetch: mock.retry });

describe('세금·고정 지출·부자재 공통 수정 내역', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.params = { kind: 'tax' }; mock.history.mockReturnValue(state()); });
  it('부자재 이름·단가·단위·삭제 상태의 실제 전후 값을 표시한다', () => {
    const before = { material_id: 'm1', name: '용기', unit_cost: 300, unit_label: '개', active: true };
    const event = parseConfigurationEvent({ id: 'm2', source: 'material', occurred_at: '2026-09-12T01:20:00Z', application_mode: 'next_business',
      before_value: before, after_value: { ...before, name: '새 용기', unit_cost: 450 } });
    expect(event.title).toBe('새 용기 수정');
    expect(event.changes).toContainEqual({ key: 'material.cost', label: '기준 단가', before: '300원', after: '450원' });
    mock.params = { kind: 'material' }; mock.history.mockReturnValue(state([event]));
    render(<ConfigurationHistoryScreen />);
    expect(mock.history).toHaveBeenCalledWith('material', undefined);
    expect(screen.getByText('부자재')).toBeTruthy();
    expect(screen.getByText('영업 종료 후 적용')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /새 용기 수정/ }));
    expect(screen.getByText('300원')).toBeTruthy(); expect(screen.getByText('450원')).toBeTruthy();
    expect(parseConfigurationEvent({ id: 'm3', source: 'material', occurred_at: '2026-09-12T01:20:00Z',
      before_value: before, after_value: { ...before, active: false } }).title).toBe('용기 삭제');
  });
  it('부자재 기록이 없어도 공통 상단 카드에서 실제 내역으로 이동한다', () => {
    mock.history.mockReturnValue(state([]));
    render(<ConfigurationHistoryLink kind="material" />);
    fireEvent.click(screen.getByRole('button', { name: '부자재 수정 내역 보기' }));
    expect(mock.push).toHaveBeenCalledWith('/my/configuration-history?kind=material');
  });
  it('부자재의 자유 입력값은 세금 enum 이름과 같아도 그대로 보존한다', () => {
    const event = parseConfigurationEvent({ id: 'm4', source: 'material', occurred_at: '2026-09-12T01:20:00Z',
      before_value: { material_id: 'm', name: 'old', memo: '이전 메모' },
      after_value: { material_id: 'm', name: 'delivery', memo: 'custom' } });
    expect(event.changes.find(c => c.key === 'material.name')?.after).toBe('delivery');
    expect(event.changes.find(c => c.key === 'material.memo')?.after).toBe('custom');
  });
  it('세율이 바뀐 항목만 전후 값으로 표시한다', () => {
    expect(taxEvent().changes).toEqual([{ key: 'tax.vat.rate', label: '부가세 세율', before: '10%', after: '12%' }]);
    expect(() => parseConfigurationEvent({})).toThrow('수정 내역 응답');
  });
  it('고정 지출 변경·삭제·배분 변경을 표시하고 금액을 구분한다', () => {
    const event = parseConfigurationEvent({ id: '3', source: 'fixed_cost', occurred_at: '2026-09-12T01:20:00Z', month: '2026-09',
      before_value: { total_revenue: 10000, items: [{ key: 'labor', total: 1000, lines: [{ name: '직원', amount: 1000 }], weights: null }] },
      after_value: { total_revenue: 20000, items: [{ key: 'labor', total: 2000, lines: [], weights: { hall: 100 } }] } });
    expect(event.changes).toContainEqual({ key: 'total_revenue', label: '총 월매출', before: '10,000원', after: '20,000원' });
    expect(event.changes).toContainEqual({ key: 'fixed.labor.0.amount', label: '인건비 · 직원', before: '1,000원', after: '—' });
    expect(event.changes.find(x => x.key === 'fixed.labor.weight.hall')?.after).toBe('100%');
  });
  it('메뉴와 같은 최근 수정 행에서 월별 내역으로 이동한다', () => {
    render(<ConfigurationHistoryLink kind="fixed_cost" month="2026-09" />);
    expect(screen.getByText('26-09-12 10:20 수정')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /수정 내역 보기/ }));
    expect(mock.push).toHaveBeenCalledWith('/my/configuration-history?kind=fixed_cost&month=2026-09');
    expect(mock.history).toHaveBeenCalledWith('fixed_cost', '2026-09');
  });
  it('기록이 없어도 진입 행을 유지하고 통신 오류와 구별한다', () => {
    mock.history.mockReturnValue(state([])); const view = render(<ConfigurationHistoryLink kind="tax" />);
    expect(screen.getByText('기록 없음')).toBeTruthy();
    mock.history.mockReturnValue({ ...state([]), data: undefined, error: new Error('offline') }); view.rerender(<ConfigurationHistoryLink kind="tax" />);
    expect(screen.getByText('내역 확인이 필요해요')).toBeTruthy(); expect(screen.queryByText('기록 없음')).toBeNull();
  });
  it('목록 선택으로 변경 전후와 적용일을 확인하고 다음 페이지를 요청한다', () => {
    mock.history.mockReturnValue({ ...state(), hasNextPage: true }); render(<ConfigurationHistoryScreen />);
    expect(screen.getByText('1건')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /세금 수정/ }));
    expect(screen.getByText('10%')).toBeTruthy(); expect(screen.getByText('12%')).toBeTruthy();
    expect(screen.getAllByText('2026-09-13부터 적용').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '더 보기' })); expect(mock.more).toHaveBeenCalledOnce();
  });
  it('빈 내역에는 공통 빈 데이터 문구를 보여준다', () => {
    mock.history.mockReturnValue(state([])); mock.params = { kind: 'fixed_cost', month: '2026-09' }; render(<ConfigurationHistoryScreen />);
    expect(screen.getByText('아직 기록된 수정 내역이 없어요')).toBeTruthy();
    expect(mock.history).toHaveBeenCalledWith('fixed_cost', '2026-09');
  });
});
