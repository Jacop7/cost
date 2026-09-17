import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesInventoryCountScreen from '@/features/sales/screens/SalesInventoryCountScreen';
import { keepInventoryCountIntent, readInventoryCountIntent } from '@/features/sales/inventoryCountOperation';

const mock = vi.hoisted(() => ({
  replace: vi.fn(), begin: vi.fn(), commit: vi.fn(), cancel: vi.fn(),
}));
const activeSession = '00000000-0000-4000-8000-000000000101';
const greenOnionId = '00000000-0000-4000-8000-000000000102';
const eggId = '00000000-0000-4000-8000-000000000103';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: mock.replace }),
  useLocalSearchParams: () => ({ date: '2026-09-15' }),
}));
vi.mock('@/lib/SessionProvider', () => ({ useSessionState: () => ({
  userId: 'actor-a', storeId: 'store-a',
}) }));
vi.mock('@/features/sales/lifecycle', async original => ({
  ...await original<Record<string, unknown>>(),
  useBeginInventoryCount: () => ({ mutateAsync: mock.begin, isPending: false }),
  useCommitInventoryCount: () => ({ mutateAsync: mock.commit, isPending: false }),
  useCancelInventoryCount: () => ({ mutateAsync: mock.cancel, isPending: false }),
}));

describe('매출 보류 해소용 전체 재고 실사', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mock.begin.mockResolvedValue({
      id: activeSession, status: 'active', cutoffBusinessDate: '2026-09-15',
      observationStartedAt: '2026-09-16T01:00:00Z', expiresAt: '2026-09-16T05:00:00Z',
      targets: [
        { ingredientId: greenOnionId, name: '대파', baseUnit: 'g', stockTotal: 812 },
        { ingredientId: eggId, name: '계란', baseUnit: '개', stockTotal: 30 },
      ],
    });
    mock.commit.mockResolvedValue({ batch_id: 'batch-1', duplicate: false });
    mock.cancel.mockResolvedValue({ status: 'cancelled' });
  });

  it('시작 후 모든 식재료를 입력해야 원자적 실사를 완료한다', async () => {
    render(<SalesInventoryCountScreen />);
    fireEvent.click(screen.getByRole('button', { name: '실사 시작' }));
    const greenOnion = await screen.findByLabelText('대파 실제 재고');
    const egg = screen.getByLabelText('계란 실제 재고');
    expect(screen.getByRole('button', { name: '실사 완료' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(greenOnion, { target: { value: '750.5' } });
    fireEvent.change(egg, { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '실사 완료' }));
    await waitFor(() => expect(mock.commit).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: activeSession,
      counts: [
        { ingredientId: greenOnionId, countedQuantity: 750.5 },
        { ingredientId: eggId, countedQuantity: 28 },
      ],
    })));
    expect(mock.replace).toHaveBeenCalledWith('/sales/write?date=2026-09-15');
  });

  it('실사 중 재고가 바뀌면 성공으로 위장하지 않고 재시작을 요청한다', async () => {
    mock.commit.mockResolvedValue({ status: 'invalidated', reason: 'INVENTORY_CHANGED' });
    render(<SalesInventoryCountScreen />);
    fireEvent.click(screen.getByRole('button', { name: '실사 시작' }));
    fireEvent.change(await screen.findByLabelText('대파 실제 재고'), { target: { value: '750' } });
    fireEvent.change(screen.getByLabelText('계란 실제 재고'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '실사 완료' }));
    expect(await screen.findByText(/실사 중 재고가 변경됐어요/)).toBeTruthy();
    expect(mock.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '실사 시작' })).toBeTruthy();
  });

  it('완료 전 저장한 요청의 만료가 확정되면 의도를 정리하고 새 실사를 시작한다', async () => {
    const expiredSession = '10000000-0000-4000-8000-000000000001';
    await keepInventoryCountIntent({ version: 1, scope: { actorId: 'actor-a', storeId: 'store-a' },
      sessionId: expiredSession, requestKey: '10000000-0000-4000-8000-000000000002',
      targetIds: ['10000000-0000-4000-8000-000000000003'],
      counts: { '10000000-0000-4000-8000-000000000003': '10' }, prepared: true });
    mock.commit.mockRejectedValue(Object.assign(new Error('만료'), {
      code: '45030', detail: 'COUNT_SESSION_EXPIRED',
    }));
    render(<SalesInventoryCountScreen />);
    fireEvent.click(screen.getByRole('button', { name: '실사 시작' }));
    expect(await screen.findByLabelText('대파 실제 재고')).toBeTruthy();
    expect(mock.commit).toHaveBeenCalledWith(expect.objectContaining({ sessionId: expiredSession }));
    expect(mock.begin).toHaveBeenCalledTimes(1);
    expect(await readInventoryCountIntent({ actorId: 'actor-a', storeId: 'store-a' }))
      .toMatchObject({ sessionId: activeSession, prepared: false });
  });

  it('입력 중이던 종료 세션은 새 요청 키로 교체한다', async () => {
    const expiredSession = '20000000-0000-4000-8000-000000000001';
    await keepInventoryCountIntent({ version: 1, scope: { actorId: 'actor-a', storeId: 'store-a' },
      sessionId: expiredSession, requestKey: '20000000-0000-4000-8000-000000000002',
      targetIds: ['20000000-0000-4000-8000-000000000003'],
      counts: { '20000000-0000-4000-8000-000000000003': '10' }, prepared: false });
    mock.begin
      .mockResolvedValueOnce({ id: expiredSession, status: 'expired', cutoffBusinessDate: '2026-09-15',
        observationStartedAt: '', expiresAt: '', targets: [] })
      .mockResolvedValueOnce({ id: '30000000-0000-4000-8000-000000000001', status: 'active',
        cutoffBusinessDate: '2026-09-15', observationStartedAt: '2026-09-16T01:00:00Z',
        expiresAt: '2026-09-16T05:00:00Z', targets: [
          { ingredientId: '30000000-0000-4000-8000-000000000003', name: '대파', baseUnit: 'g', stockTotal: 812 },
        ] });
    render(<SalesInventoryCountScreen />);
    fireEvent.click(screen.getByRole('button', { name: '실사 시작' }));
    expect(await screen.findByLabelText('대파 실제 재고')).toBeTruthy();
    expect(mock.begin).toHaveBeenCalledTimes(2);
    expect(mock.begin.mock.calls[1]?.[0]).not.toBe(expiredSession);
    expect(await readInventoryCountIntent({ actorId: 'actor-a', storeId: 'store-a' }))
      .toMatchObject({ sessionId: '30000000-0000-4000-8000-000000000001', prepared: false });
  });
});
