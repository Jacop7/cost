import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickInboundScreen } from '@/features/ingredients/screens/QuickInboundScreen';
import { SessionGate } from '@/lib/SessionProvider';
import type { SessionState } from '@/lib/session';

// Real screen, date gate, session gate and useQuickInbound mutation. Reads,
// useSession, router and Supabase transport are synthetic. No auth/network/DB.
const m = vi.hoisted(() => ({ date: '2030-07-15', id: 'ingredient-a',
  session: { phase: 'ready', userId: 'principal-a', storeId: 'store-a', message: null, retry: () => {} } as SessionState,
  rpc: vi.fn(), toast: vi.fn(), replace: vi.fn(), ensure: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ useSession: () => m.session }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: m.rpc } }));
vi.mock('@/lib/toast', () => ({ showToast: m.toast }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: m.id }),
  useRouter: () => ({ push: vi.fn() }), router: { canGoBack: () => false, replace: m.replace, back: vi.fn() } }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="dialog">{children}</div> : null }));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: () => ({ date: m.date, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/master-data/hooks', () => ({ useEnsureVendor: () => m.ensure }));
vi.mock('@/features/ingredients/hooks', async original => ({
  ...await original<typeof import('@/features/ingredients/hooks')>(),
  useIngredientDetail: (id: string) => ({ data: { id, name: id, baseUnit: 'g', stockTotal: 5000, basePrice: 4,
    options: [{ id: 'option-a', name: '대파 1kg', volume: 1000, amount: 4000, vendorId: 'vendor-a', vendorName: '구매처', url: null }] },
    isLoading: false, error: null, isFetched: true, refetch: vi.fn() }),
  useQuickInboundPreview: () => ({ data: undefined, isLoading: false, error: null }),
}));
type Request = { payload: Record<string, unknown>; scope: { principal: string | null; store: string | null }; finish: (r: unknown) => void };
let requests: Request[]; let client: QueryClient;
const tree = () => <QueryClientProvider client={client}><SessionGate><QuickInboundScreen /></SessionGate></QueryClientProvider>;
const choose = () => {
  fireEvent.click(screen.getByRole('button', { name: /^구매한 곳 선택/ }));
  fireEvent.click(within(screen.getByTestId('dialog')).getByRole('button', { name: /구매처 · 대파 1kg/ }));
};
async function send() {
  const previous = requests.length;
  fireEvent.click(screen.getByRole('button', { name: /^재고 .* 추가$|^재고 추가$/ }));
  fireEvent.click(screen.getByRole('button', { name: '입고' }));
  await waitFor(() => expect(requests).toHaveLength(previous + 1));
  return requests.at(-1)!;
}
async function finish(request: Request, error = false) {
  await act(async () => request.finish({ data: error ? null : { order_id: 'fixture-order' }, error: error ? { message: '응답 확인 실패', code: 'FIXTURE' } : null }));
  await waitFor(() => expect(client.getMutationCache().getAll().every(v => v.state.status !== 'pending')).toBe(true));
}
const closeError = () => fireEvent.click(screen.getByRole('button', { name: '확인' }));

describe('입고 화면의 대상·세션·세대별 지연 응답 격리', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.date = '2030-07-15'; m.id = 'ingredient-a';
    m.session = { phase: 'ready', userId: 'principal-a', storeId: 'store-a', message: null, retry: () => {} };
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    requests = []; m.ensure.mockResolvedValue('vendor-a');
    m.rpc.mockImplementation((name, payload) => {
      if (name !== 'quick_inbound') throw Error(`Unexpected RPC ${name}`);
      return new Promise(resolve => requests.push({ payload: structuredClone(payload),
        scope: { principal: m.session.userId, store: m.session.storeId }, finish: resolve }));
    });
  });
  afterEach(() => client.clear());

  it('control: same mounted screen retries an uncertain response with the identical payload/key', async () => {
    render(tree()); choose(); const first = await send(); await finish(first, true); closeError();
    const second = await send();
    expect(second.payload).toEqual(first.payload); await finish(second);
  });
  it('control: confirmed success followed by an intended new identical inbound receives a new key', async () => {
    const view = render(tree()); choose(); const first = await send(); await finish(first);
    await waitFor(() => expect(m.toast).toHaveBeenCalledTimes(1));
    view.unmount(); render(tree()); choose(); const second = await send(); await finish(second);
    expect(second.payload.p_idempotency_key).not.toBe(first.payload.p_idempotency_key);
    const { p_idempotency_key: a, ...pa } = first.payload; const { p_idempotency_key: b, ...pb } = second.payload;
    expect(pb).toEqual(pa);
  });
  for (const transition of ['target', 'target-roundtrip', 'store-ready-to-ready', 'principal-ready-to-ready', 'date-remount', 'signout-remount'] as const) {
    for (const outcome of ['success', 'error'] as const) {
      it(`late ${outcome}: ${transition} must not affect the new screen`, async () => {
        const view = render(tree()); choose(); const first = await send();
        if (transition === 'target') m.id = 'ingredient-b';
        if (transition === 'target-roundtrip') { m.id = 'ingredient-b'; view.rerender(tree()); m.id = 'ingredient-a'; }
        if (transition === 'store-ready-to-ready') m.session = { ...m.session, storeId: 'store-b' };
        if (transition === 'principal-ready-to-ready') m.session = { ...m.session, userId: 'principal-b' };
        if (transition === 'date-remount') m.date = '2030-07-16';
        if (transition === 'signout-remount') {
          m.session = { ...m.session, phase: 'signed-out', userId: null, storeId: null }; view.rerender(tree());
          expect(screen.getByText('로그인이 필요해요')).toBeTruthy();
          m.session = { ...m.session, phase: 'ready', userId: 'principal-b', storeId: 'store-b' };
        }
        view.rerender(tree());
        await finish(first, outcome === 'error');
        expect.soft(m.replace).not.toHaveBeenCalled(); expect.soft(m.toast).not.toHaveBeenCalled();
        expect.soft(screen.queryByText('응답 확인 실패')).toBeNull();
      });
    }
  }
  for (const outcome of ['success', 'error'] as const) {
    it(`A→B→A에서 옛 ${outcome} 정리가 새 제출의 대기 상태와 재시도 키를 바꾸지 않는다`, async () => {
      const view = render(tree()); choose(); const first = await send();
      m.id = 'ingredient-b'; view.rerender(tree()); m.id = 'ingredient-a'; view.rerender(tree());
      choose(); const second = await send();
      await act(async () => first.finish({ data: {}, error: outcome === 'error' ? { message: '옛 입고 오류' } : null }));
      await waitFor(() => expect(client.getMutationCache().getAll()[0]!.state.status).not.toBe('pending'));
      expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
      expect(screen.queryByText('옛 입고 오류')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: '입고' }));
      expect(requests).toHaveLength(2);
      await finish(second, true); closeError(); const retry = await send();
      expect(retry.payload).toEqual(second.payload);
      expect(retry.payload.p_idempotency_key).not.toBe(first.payload.p_idempotency_key);
      await finish(retry); await waitFor(() => expect(m.toast).toHaveBeenCalledTimes(1));
    });
  }
  for (const transition of ['target', 'target-roundtrip', 'store', 'principal'] as const) {
    for (const outcome of ['resolve', 'reject'] as const) {
      it(`구매처 ${outcome} 지연 중 ${transition} 변경: 이전 초안으로 입고하지 않고 현재 준비 상태를 보존한다`, async () => {
        const vendorRequests: { resolve: (id: string) => void; reject: (error: Error) => void }[] = [];
        m.ensure.mockImplementation(() => new Promise((resolve, reject) => vendorRequests.push({ resolve, reject })));
        const view = render(tree());
        const prepareDirect = () => {
          fireEvent.click(screen.getByRole('button', { name: /^구매한 곳 선택/ }));
          fireEvent.click(within(screen.getByTestId('dialog')).getByRole('button', { name: /^직접 입력/ }));
          for (const [name, value] of [['구매처', '직접 구매처'], ['개당 용량', '1000'], ['실제 결제금액', '4000']]) {
            fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
          }
          fireEvent.click(screen.getByRole('button', { name: /^재고 .* 추가$|^재고 추가$/ }));
          fireEvent.click(screen.getByRole('button', { name: '입고' }));
        };
        prepareDirect(); await waitFor(() => expect(vendorRequests).toHaveLength(1));
        if (transition === 'target' || transition === 'target-roundtrip') m.id = 'ingredient-b';
        if (transition === 'target-roundtrip') { view.rerender(tree()); m.id = 'ingredient-a'; }
        if (transition === 'store') m.session = { ...m.session, storeId: 'store-b' };
        if (transition === 'principal') m.session = { ...m.session, userId: 'principal-b' };
        view.rerender(tree());
        // A new editor must be usable while the previous vendor promise is pending.
        prepareDirect(); await waitFor(() => expect(vendorRequests).toHaveLength(2));
        await act(async () => {
          if (outcome === 'resolve') vendorRequests[0]!.resolve('old-vendor');
          else vendorRequests[0]!.reject(new Error('옛 구매처 오류'));
        });
        expect(m.rpc).not.toHaveBeenCalled();
        expect(screen.queryByText('옛 구매처 오류')).toBeNull();
        expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
        // Old cleanup must not release the new pending submission or run ensureVendor twice.
        const confirm = screen.getByRole('button', { name: '입고' }); fireEvent.click(confirm);
        expect(vendorRequests).toHaveLength(2);
        await act(async () => vendorRequests[1]!.resolve('new-vendor'));
        await waitFor(() => expect(requests).toHaveLength(1));
        expect(requests[0]!.payload).toMatchObject({ p_store: m.session.storeId, p_ingredient: m.id, p_vendor: 'new-vendor' });
        await finish(requests[0]!);
        await waitFor(() => expect(m.toast).toHaveBeenCalledTimes(1));
      });
    }
  }
  for (const outcome of ['resolve', 'reject'] as const) {
    it(`구매처 조회 중 화면 이탈 뒤 ${outcome}: 추가 입고 RPC와 UI 효과가 없다`, async () => {
      let resolve!: (id: string) => void; let reject!: (error: Error) => void;
      m.ensure.mockImplementation(() => new Promise((done, fail) => { resolve = done; reject = fail; }));
      const view = render(tree());
      fireEvent.click(screen.getByRole('button', { name: /^구매한 곳 선택/ }));
      fireEvent.click(within(screen.getByTestId('dialog')).getByRole('button', { name: /^직접 입력/ }));
      for (const [name, value] of [['구매처', '직접 구매처'], ['개당 용량', '1000'], ['실제 결제금액', '4000']]) {
        fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
      }
      fireEvent.click(screen.getByRole('button', { name: /^재고 .* 추가$|^재고 추가$/ }));
      fireEvent.click(screen.getByRole('button', { name: '입고' }));
      expect(m.ensure).toHaveBeenCalledOnce(); view.unmount();
      await act(async () => { if (outcome === 'resolve') resolve('old-vendor'); else reject(new Error('옛 구매처 오류')); });
      expect(m.rpc).not.toHaveBeenCalled(); expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
    });
  }
});
