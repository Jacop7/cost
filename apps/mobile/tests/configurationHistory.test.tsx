import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseConfigurationEvent } from '@/features/changes/configurationHistory';
import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
import ConfigurationHistoryScreen from '@/features/changes/screens/ConfigurationHistoryScreen';
import { IngredientLegacyHistory } from '@/features/changes/components/IngredientLegacyHistory';

const mock = vi.hoisted(() => ({ history: vi.fn(), revert: vi.fn(), push: vi.fn(), more: vi.fn(), retry: vi.fn(), params: {} as Record<string, string> }));
vi.mock('@/features/changes/configurationHistory', async original => ({
  ...await original<typeof import('@/features/changes/configurationHistory')>(), useConfigurationHistory: mock.history,
  useIngredientLegacyHistory: mock.history,
  useRevertFixedCostReentry: () => ({ mutate: mock.revert, isPending: false }),
}));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: () => ({ data: {
  timezone: 'Asia/Seoul', localDate: '2026-09-12', status: 'open', openedAt: '2026-09-12T02:00:00Z',
  plannedCloseAt: '2026-09-12T12:00:00Z',
} }) }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => mock.params, useRouter: () => ({ push: mock.push }), router: { canGoBack: () => false, replace: vi.fn() } }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null,
}));

const taxEvent = () => parseConfigurationEvent({ id: '2', source: 'tax_profile', occurred_at: '2026-09-12T01:20:00Z', effective_from: '2026-09-13',
  source_type: 'direct', operation: 'update', operation_subject_type: 'tax', operation_subject_id: null,
  before_value: { components: [{ key: 'vat', name: '부가세', rate_pct: 10 }] }, after_value: { components: [{ key: 'vat', name: '부가세', rate_pct: 12 }] } });
const state = (items = [taxEvent()]) => ({ data: { pages: [{ items, count: items.length, counts: { all: items.length, settings: items.length, monthly: 0 } }] }, isLoading: false, error: null,
  hasNextPage: false, isFetchingNextPage: false, fetchNextPage: mock.more, refetch: mock.retry });

describe('세금·고정 지출·부자재 공통 수정 내역', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.params = { kind: 'tax' }; mock.history.mockReturnValue(state()); });
  it('부자재 이름·단가·단위·삭제 상태의 실제 전후 값을 표시한다', () => {
    const before = { material_id: 'm1', name: '용기', unit_cost: 300, unit_label: '개', active: true };
    const event = parseConfigurationEvent({ id: 'm2', source: 'material', occurred_at: '2026-09-12T01:20:00Z', application_mode: 'next_business',
      source_type: 'direct', operation: 'update', operation_subject_type: 'material', operation_subject_id: 'm1',
      before_value: before, after_value: { ...before, name: '새 용기', unit_cost: 450 } });
    expect(event.title).toBe('새 용기 수정');
    expect(event.changes).toContainEqual({ key: 'material.cost', label: '단가', before: '300원', after: '450원' });
    mock.params = { kind: 'material' }; mock.history.mockReturnValue(state([event]));
    render(<ConfigurationHistoryScreen />);
    expect(mock.history).toHaveBeenCalledWith('material', undefined, 'all');
    fireEvent.click(screen.getByRole('button', { name: /새 용기 수정/ }));
    expect(screen.getAllByText('매출 작성 완료 후 반영')).toHaveLength(2);
    expect(screen.getByText('300원')).toBeTruthy(); expect(screen.getByText('450원')).toBeTruthy();
    expect(parseConfigurationEvent({ id: 'm3', source: 'material', occurred_at: '2026-09-12T01:20:00Z',
      source_type: 'direct', operation: 'delete', operation_subject_type: 'material', operation_subject_id: 'm1',
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
    expect(event.changes).toContainEqual({ key: 'fixed.labor.lines.entries', label: '인건비 세부 항목', before: '직원 · 1,000원', after: '—' });
    expect(event.changes.find(x => x.key === 'fixed.labor.weight.hall')?.after).toBe('100%');
  });
  it('고정 지출 계산 기간·사용자 항목명·영향 월의 전후 값을 해석한다', () => {
    const event = parseConfigurationEvent({ id: '4', source: 'fixed_cost', occurred_at: '2026-09-12T01:20:00Z',
      change_type: 'settings_reentry', affected_months: ['2026-08'],
      before_value: { basis_months: 2, items: [{ key: 'custom-a', label: '창고 임차료', total: 300 }],
        months: [{ month: '2026-08', exists: false, total_revenue: null, items: null }] },
      after_value: { basis_months: 3, items: [{ key: 'custom-a', label: '창고 임차료', total: 500 }],
        months: [{ month: '2026-08', exists: true, total_revenue: 10000, items: [{ key: 'custom-a', total: 500 }] }] } });
    expect(event.title).toBe('항목 구성 변경');
    expect(event.changes).toContainEqual({ key: 'basis_months', label: '고정 지출 기준', before: '최근 2개월 평균', after: '최근 3개월 평균' });
    expect(event.changes).toContainEqual({ key: 'fixed.custom-a.total', label: '창고 임차료 합계', before: '300원', after: '500원' });
    expect(event.changes).toContainEqual({ key: 'month.2026-08.revenue', label: '8월 매출', before: '—', after: '10,000원' });
    expect(event.changes).toContainEqual({ key: 'month.2026-08.fixed', label: '8월 고정 지출', before: '—', after: '500원' });
  });
  it('고정 지출 수정 내역은 분리 탭 없이 한 목록으로 연다', () => {
    mock.params = { kind: 'fixed_cost' };
    mock.history.mockReturnValue(state([]));
    render(<ConfigurationHistoryScreen />);
    expect(mock.history).toHaveBeenCalledWith('fixed_cost', undefined, 'all');
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText('고정 지출')).toBeNull();
    expect(screen.queryByText('총 0건')).toBeNull();
    expect(screen.queryByText('설정 변경')).toBeNull();
    expect(screen.queryByText('월별 입력')).toBeNull();
    expect(screen.getByText('아직 기록된 수정 내역이 없어요')).toBeTruthy();
  });
  it('고정 지출은 의미 뱃지 하나를 쓰고 기간·항목 동시 변경만 두 개를 표시한다', () => {
    const fixed = (id: string, title: string, changeType: string, beforeValue: object, afterValue: object, operation = 'update') =>
      parseConfigurationEvent({ id, title, source: 'fixed_cost', source_type: 'direct', operation,
        operation_subject_type: 'fixed_cost', operation_subject_id: null, change_type: changeType,
        occurred_at: '2026-09-12T01:20:00Z', before_value: beforeValue, after_value: afterValue });
    const events = [
      fixed('basis', '기간 사건', 'settings_basis', { basis_months: 2 }, { basis_months: 3 }),
      fixed('items', '항목 사건', 'settings_items', { items: [{ key: 'rent', total: 1 }] }, { items: [{ key: 'rent', total: 2 }] }),
      fixed('monthly-create', '월 등록 사건', 'monthly_input', {}, { total_revenue: 1, items: [] }, 'create'),
      fixed('monthly-update', '월 수정 사건', 'monthly_input', { total_revenue: 1, items: [] }, { total_revenue: 2, items: [] }),
      fixed('restore', '복구 사건', 'restore', {}, { reverted: true }),
      fixed('combined', '동시 사건', 'settings_reentry', { basis_months: 2, items: [{ key: 'rent', total: 1 }] },
        { basis_months: 3, items: [{ key: 'rent', total: 2 }], reentry_session_id: 'session' }),
      fixed('legacy', '과거 사건', 'unknown', {}, {} , 'unknown'),
    ];
    mock.params = { kind: 'fixed_cost' }; mock.history.mockReturnValue(state(events));
    render(<ConfigurationHistoryScreen />);
    expect(within(screen.getByRole('button', { name: /기간 사건/ })).getByText('평균 기간 수정')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /항목 사건/ })).getByText('지출 항목 수정')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /월 등록 사건/ })).getByText('월별 금액 등록')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /월 수정 사건/ })).getByText('월별 금액 수정')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /복구 사건/ })).getByText('이전 버전 복구')).toBeTruthy();
    const combined = screen.getByRole('button', { name: /동시 사건/ });
    expect(within(combined).getByText('평균 기간 수정')).toBeTruthy();
    expect(within(combined).getByText('지출 항목 수정')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /과거 사건/ })).getByText('이전 기록')).toBeTruthy();
    expect(screen.queryByText('변경')).toBeNull();
  });
  it('고정 지출은 현재 반영 상태와 실제 예정 종료일을 목록·상세에 표시한다', () => {
    const reflected = parseConfigurationEvent({ id: 'current', title: '반영된 사건', source: 'fixed_cost',
      source_type: 'direct', operation: 'update', change_type: 'monthly_input', application_mode: 'immediate',
      occurred_at: '2026-09-12T01:20:00Z', before_value: { total_revenue: 1 }, after_value: { total_revenue: 2 } });
    const scheduled = parseConfigurationEvent({ id: 'scheduled', title: '반영 예정 사건', source: 'fixed_cost',
      source_type: 'direct', operation: 'update', change_type: 'monthly_input', application_mode: 'next_business',
      occurred_at: '2026-09-12T03:20:00Z', before_value: { total_revenue: 2 }, after_value: { total_revenue: 3 } });
    mock.params = { kind: 'fixed_cost' }; mock.history.mockReturnValue(state([scheduled, reflected]));
    render(<ConfigurationHistoryScreen />);

    expect(within(screen.getByRole('button', { name: /반영된 사건/ })).getByText('현재 매출에 반영 중')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /반영 예정 사건/ })).getByText('9월 12일 반영')).toBeTruthy();
    expect(screen.queryByText('영업 종료 후 적용')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /반영 예정 사건/ }));
    expect(screen.getAllByText('9월 12일 반영')).toHaveLength(2);
  });
  it('저장 완료된 최근 고정 지출 구성 변경은 상세에서 이전 값으로 복구한다', () => {
    const event = parseConfigurationEvent({ id: '3', source: 'fixed_cost', occurred_at: '2026-09-12T01:20:00Z', month: '2026-09',
      change_type: 'settings_reentry', affected_months: ['2026-06', '2026-07', '2026-08'], reversible: true, latest_change_id: '3',
      before_value: { items: [{ key: 'labor', total: 1000 }] },
      after_value: { items: [{ key: 'labor', total: 2000 }], reentry_session_id: 'session-1', reentry_reversible: true } });
    mock.params = { kind: 'fixed_cost' }; mock.history.mockReturnValue(state([event]));
    render(<ConfigurationHistoryScreen />);
    expect(screen.queryByRole('button', { name: '복구' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '항목 구성 변경 자세히 보기' }));
    expect(screen.getByText('변경 내용')).toBeTruthy();
    const affectedMonths = screen.getByTestId('fixed-cost-affected-months');
    expect(within(affectedMonths).getByText('대상 월')).toBeTruthy();
    expect(within(affectedMonths).getByText('2026년 6월, 7월, 8월')).toBeTruthy();
    expect(getComputedStyle(screen.getByText('1,000원')).color).toBe(getComputedStyle(screen.getByText('2,000원')).color);
    fireEvent.click(screen.getByRole('button', { name: '이전 상태로 복구' }));
    expect(screen.getByText(/2026년 6월.*7월.*8월.*변경 전 상태/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '복구' }));
    expect(mock.revert).toHaveBeenCalledWith({ changeId: '3', latestChangeId: '3' }, expect.any(Object));
  });
  it('메뉴와 같은 최근 수정 행에서 월별 내역으로 이동한다', () => {
    render(<ConfigurationHistoryLink kind="fixed_cost" month="2026-09" />);
    expect(screen.getByText('26-09-12 10:20 수정')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /수정 내역 보기/ }));
    expect(mock.push).toHaveBeenCalledWith('/my/configuration-history?kind=fixed_cost&scope=monthly&month=2026-09');
    expect(mock.history).toHaveBeenCalledWith('fixed_cost', '2026-09', 'monthly');
  });
  it('고정 지출 최근 변경은 7일 안의 현재 반영과 반영 예정 상태만 표시한다', () => {
    const current = parseConfigurationEvent({ id: 'current', source: 'fixed_cost', change_type: 'monthly_input', month: '2026-09',
      occurred_at: '2026-09-12T01:20:00Z', application_mode: 'immediate', before_value: {}, after_value: { total_revenue: 1, items: [] } });
    mock.history.mockReturnValue(state([current]));
    const view = render(<ConfigurationHistoryLink kind="fixed_cost" />);
    expect(screen.getByText('현재 매출에 반영 중')).toBeTruthy();
    expect(screen.getByText('26-09-12 10:20 수정')).toBeTruthy();
    expect(screen.queryByText('26-09-12 10:20 변경')).toBeNull();

    const scheduled = parseConfigurationEvent({ id: 'scheduled', source: 'fixed_cost', change_type: 'monthly_input', month: '2026-09',
      occurred_at: '2026-09-12T03:20:00Z', application_mode: 'next_business', before_value: {}, after_value: { total_revenue: 2, items: [] } });
    mock.history.mockReturnValue(state([scheduled])); view.rerender(<ConfigurationHistoryLink kind="fixed_cost" />);
    expect(screen.getByText('9/12 반영 예정')).toBeTruthy();
    expect(screen.queryByText('영업 종료 후 반영 예정')).toBeNull();

    const old = { ...current, id: 'old', occurredAt: '2026-09-05T01:20:00Z' };
    mock.history.mockReturnValue(state([old])); view.rerender(<ConfigurationHistoryLink kind="fixed_cost" />);
    expect(screen.queryByText('현재 매출에 반영 중')).toBeNull();
    expect(screen.queryByText('기록 없음')).toBeNull();
  });
  it('기록이 없어도 진입 행을 유지하고 통신 오류와 구별한다', () => {
    mock.history.mockReturnValue(state([])); const view = render(<ConfigurationHistoryLink kind="tax" />);
    expect(screen.getByText('기록 없음')).toBeTruthy();
    mock.history.mockReturnValue({ ...state([]), data: undefined, error: new Error('offline') }); view.rerender(<ConfigurationHistoryLink kind="tax" />);
    expect(screen.getByText('내역 확인이 필요해요')).toBeTruthy(); expect(screen.queryByText('기록 없음')).toBeNull();
  });
  it('목록 선택으로 변경 전후와 적용일을 확인하고 다음 페이지를 요청한다', () => {
    mock.history.mockReturnValue({ ...state(), hasNextPage: true }); render(<ConfigurationHistoryScreen />);
    fireEvent.click(screen.getByRole('button', { name: /세금 수정/ }));
    expect(screen.getByText('10%')).toBeTruthy(); expect(screen.getByText('12%')).toBeTruthy();
    const detailTitle = screen.getAllByText('세금 수정').at(-1)!;
    expect(detailTitle.nextElementSibling?.textContent).toBe('26-09-12 10:20');
    expect(within(detailTitle.parentElement!.previousElementSibling as HTMLElement).getByText('수정')).toBeTruthy();
    expect(screen.getAllByText('2026-09-13부터 적용').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '더 보기' })); expect(mock.more).toHaveBeenCalledOnce();
  });
  it.each([['create', '등록'], ['delete', '삭제'], ['unknown', '변경']] as const)('설정 %s 분류를 목록·상세·최근 변경에 동일하게 표시한다', (operation, label) => {
    const event = { ...taxEvent(), title: '보존할 사건 제목', operation };
    mock.history.mockReturnValue(state([event]));
    render(<ConfigurationHistoryLink kind="tax" />);
    expect(screen.getByText(`26-09-12 10:20 ${label}`)).toBeTruthy();
    render(<ConfigurationHistoryScreen />);
    const row = screen.getByRole('button', { name: /보존할 사건 제목/ });
    expect(within(row).getByText('26-09-12 10:20')).toBeTruthy();
    expect(within(row).getByText(label)).toBeTruthy();
    fireEvent.click(row);
    const detailTitle = screen.getAllByText('보존할 사건 제목').at(-1)!;
    expect(within(detailTitle.parentElement!.previousElementSibling as HTMLElement).getByText(label)).toBeTruthy();
  });
  it('값 차이가 없는 사건에 적용 시점 변경을 만들어내지 않는다', () => {
    const event = parseConfigurationEvent({ id: 'unchanged', source: 'tax_profile', occurred_at: '2026-09-12T01:20:00Z',
      source_type: 'direct', operation: 'unknown', title: '보존된 세금 기록', before_value: { components: [] }, after_value: { components: [] } });
    mock.history.mockReturnValue(state([event]));
    render(<ConfigurationHistoryScreen />);
    fireEvent.click(screen.getByRole('button', { name: /보존된 세금 기록/ }));
    expect(screen.getAllByText('기록된 값 변경 없음')).toHaveLength(1);
    expect(screen.queryByText('적용 시점 변경')).toBeNull();
  });
  it('빈 내역에는 공통 빈 데이터 문구를 보여준다', () => {
    mock.history.mockReturnValue(state([])); mock.params = { kind: 'fixed_cost', month: '2026-09' }; render(<ConfigurationHistoryScreen />);
    expect(screen.getByText('아직 기록된 수정 내역이 없어요')).toBeTruthy();
    expect(mock.history).toHaveBeenCalledWith('fixed_cost', '2026-09', 'monthly');
  });
  it('통합 전 이력도 분류·제목·서버 날짜 순서의 공통 상세 헤더를 쓴다', () => {
    const event = parseConfigurationEvent({ id: 'legacy', source: 'material', occurred_at: '2026-09-12T01:20:00Z',
      before_value: { material_id: 'm', name: '통합 용기', unit_cost: 300 },
      after_value: { material_id: 'm', name: '통합 용기', unit_cost: 450 } });
    mock.history.mockReturnValue(state([event]));
    render(<IngredientLegacyHistory id="ingredient" />);
    fireEvent.click(screen.getByRole('button', { name: '통합 전 수정 내역 1건' }));
    const title = screen.getByText('통합 용기 변경');
    expect(title.nextElementSibling?.textContent).toBe('26-09-12 10:20');
    expect(within(title.parentElement!.previousElementSibling as HTMLElement).getByText('변경')).toBeTruthy();
    expect(getComputedStyle(screen.getByTestId('legacy-history-value-row')).flexDirection).toBe('column');
    expect(screen.getByText('300원')).toBeTruthy(); expect(screen.getByText('450원')).toBeTruthy();
  });
});
