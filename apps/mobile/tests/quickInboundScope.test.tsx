import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickInboundScreen } from '@/features/ingredients/screens/QuickInboundScreen';
import { SessionGate } from '@/lib/SessionProvider';
import type { SessionState } from '@/lib/session';
import { inboundIntentBusy } from '@/features/ingredients/inboundIntentStorage';

// Real screen, date gate, session gate and useQuickInbound mutation. Reads,
// useSession, router and Supabase transport are synthetic. No auth/network/DB.
const m = vi.hoisted(() => ({ date: '2030-07-15', id: 'ingredient-a',
  session: { phase: 'ready', userId: 'principal-a', storeId: 'store-a', message: null, retry: () => {} } as SessionState,
  rpc: vi.fn(), toast: vi.fn(), replace: vi.fn(), ensure: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ useSession: () => m.session }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: m.rpc } }));
vi.mock('expo-secure-store', () => ({})); // Web tests exercise real localStorage; native adapter has separate tests.
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
async function clickReadyButton(name: string | RegExp) {
  await waitFor(() => expect(screen.getByRole('button', { name }).getAttribute('aria-disabled')).not.toBe('true'));
  // The journal read enables the DOM asynchronously. RN Web configures its
  // PressResponder in a passive effect; finish that commit before dispatching.
  await act(async () => {});
  const button = screen.getByRole('button', { name });
  expect(button.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(button);
}
async function send() {
  const previous = requests.length;
  const retry = screen.queryByRole('button', { name: '이 입고 다시 확인' });
  if (retry) {
    await clickReadyButton('이 입고 다시 확인');
  } else {
    await clickReadyButton(/^재고 .* 추가$|^재고 추가$/);
    fireEvent.click(screen.getByRole('button', { name: '입고' }));
  }
  await waitFor(() => expect(requests).toHaveLength(previous + 1));
  return requests.at(-1)!;
}
async function finish(request: Request, error = false) {
  await act(async () => request.finish({ data: error ? null : { order_id: 'fixture-order' }, error: error ? { message: '응답 확인 실패', code: 'FIXTURE' } : null }));
  await waitFor(() => expect(client.getMutationCache().getAll().every(v => v.state.status !== 'pending')).toBe(true));
  await waitFor(() => expect(inboundIntentBusy({ actorId: request.scope.principal!, storeId: request.scope.store!,
    ingredientId: request.payload.p_ingredient as string })).toBe(false));
}
const closeError = () => { const button = screen.queryByRole('button', { name: '확인' }); if (button) fireEvent.click(button); };

describe('입고 화면의 대상·세션·세대별 지연 응답 격리', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('U5-B: 응답 유실 후 같은 범위 재진입은 미확인 입고를 복원하고 명시 재시도만 허용한다', async () => {
    const view = render(tree()); choose(); const first = await send(); await finish(first, true);
    view.unmount(); render(tree());
    const retry = await screen.findByRole('button', { name: '이 입고 다시 확인' });
    expect(requests).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^재고 .* 추가$/ })).toBeNull();
    fireEvent.click(retry);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]!.payload).toEqual(first.payload);
    await finish(requests[1]!);
  });

  it('U5-B: 입고 보관 실패는 RPC를 보내지 않는다', async () => {
    const view = render(tree()); choose();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('저장 공간 오류'); });
    await clickReadyButton(/^재고 .* 추가$/);
    fireEvent.click(screen.getByRole('button', { name: '입고' }));
    await screen.findByText(/저장 공간 오류/);
    expect(requests).toHaveLength(0); view.unmount();
  });

  it('U5-B: 서버 날짜가 바뀌어도 미확인 입고는 원 날짜·키·금액으로만 다시 보낸다', async () => {
    const view = render(tree()); choose(); const first = await send(); await finish(first, true);
    m.date = '2030-07-16'; view.rerender(tree());
    await screen.findByText('원 입고일: 2030-07-15');
    expect(requests).toHaveLength(1);
    expect(screen.queryByRole('textbox', { name: '실제 결제금액' })).toBeNull();
    const retry = await send(); expect(retry.payload).toEqual(first.payload); await finish(retry);
  });

  it.each(['principal', 'store', 'ingredient'] as const)('U5-B: %s 변경은 이전 요청을 보내지 않고 원 범위 복귀 때만 복원한다', async field => {
    const view = render(tree()); choose(); const first = await send(); await finish(first, true);
    if (field === 'principal') m.session = { ...m.session, userId: 'principal-b' };
    if (field === 'store') m.session = { ...m.session, storeId: 'store-b' };
    if (field === 'ingredient') m.id = 'ingredient-b';
    view.rerender(tree()); choose(); const other = await send(); await finish(other);
    expect(other.payload.p_idempotency_key).not.toBe(first.payload.p_idempotency_key);
    if (field === 'principal') m.session = { ...m.session, userId: 'principal-a' };
    if (field === 'store') m.session = { ...m.session, storeId: 'store-a' };
    if (field === 'ingredient') m.id = 'ingredient-a';
    view.rerender(tree()); await screen.findByRole('button', { name: '이 입고 다시 확인' });
    expect(requests).toHaveLength(2);
    const retry = await send(); expect(retry.payload).toEqual(first.payload); await finish(retry);
  });

  it('U5-B: 저장소 읽기 실패는 새 쓰기를 잠그고 명시 재조회로만 해제한다', async () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('보관 정보 읽기 오류'); });
    render(tree()); await screen.findByText('보관 정보 읽기 오류');
    expect(screen.queryByRole('button', { name: /^재고 .* 추가$/ })).toBeNull(); expect(requests).toHaveLength(0);
    read.mockRestore(); fireEvent.click(screen.getByRole('button', { name: '입고 확인 정보 다시 불러오기' }));
    await screen.findByRole('button', { name: /^구매한 곳 선택/ }); choose(); await finish(await send());
  });

  it('U5-B: 확인정보 정리 실패는 성공 토스트나 새 K2를 허용하지 않는다', async () => {
    render(tree()); choose(); const first = await send();
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('확인정보 정리 오류'); });
    await finish(first); await screen.findByText('확인정보 정리 오류');
    expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
    remove.mockRestore(); const retry = await send(); expect(retry.payload).toEqual(first.payload); await finish(retry);
    expect(m.toast).toHaveBeenCalledTimes(1);
  });

  it('U5-B: 성공 형식이 불완전한 응답도 미확인 요청으로 남고 전역 retry가 자동 전송하지 않는다', async () => {
    client.setDefaultOptions({ mutations: { retry: 2, retryDelay: 0 } });
    render(tree()); choose(); const first = await send();
    await act(async () => first.finish({ data: {}, error: null }));
    await screen.findByText('입고 결과를 확인하지 못했어요. 같은 입고를 다시 확인해 주세요.');
    expect(requests).toHaveLength(1); expect(m.toast).not.toHaveBeenCalled();
    const retry = await send(); expect(retry.payload).toEqual(first.payload); await finish(retry);
  });

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
    it(`A→B→A에서 옛 ${outcome} 정리는 새 세대를 닫지 않고 원 요청의 명시 재시도를 보존한다`, async () => {
      const view = render(tree()); choose(); const first = await send();
      m.id = 'ingredient-b'; view.rerender(tree()); m.id = 'ingredient-a'; view.rerender(tree());
      const retryButton = await screen.findByRole('button', { name: '이 입고 다시 확인' });
      expect(retryButton.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(retryButton); expect(requests).toHaveLength(1);
      await act(async () => first.finish({ data: { order_id: 'fixture-order' }, error: outcome === 'error' ? { message: '옛 입고 오류' } : null }));
      await waitFor(() => expect(client.getMutationCache().getAll()[0]!.state.status).not.toBe('pending'));
      expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
      expect(screen.queryByText('옛 입고 오류')).toBeNull();
      const second = await send();
      expect(second.payload).toEqual(first.payload);
      fireEvent.click(screen.getByRole('button', { name: '이 입고 다시 확인' })); expect(requests).toHaveLength(2);
      await finish(second, true); closeError(); const retry = await send();
      expect(retry.payload).toEqual(second.payload);
      expect(retry.payload.p_idempotency_key).toBe(first.payload.p_idempotency_key);
      await finish(retry); await waitFor(() => expect(m.toast).toHaveBeenCalledTimes(1));
    });
  }
  for (const transition of ['target', 'target-roundtrip', 'store', 'principal'] as const) {
    for (const outcome of ['resolve', 'reject'] as const) {
      it(`구매처 ${outcome} 지연 중 ${transition} 변경: 이전 초안으로 입고하지 않고 현재 준비 상태를 보존한다`, async () => {
        const vendorRequests: { resolve: (id: string) => void; reject: (error: Error) => void }[] = [];
        m.ensure.mockImplementation(() => new Promise((resolve, reject) => vendorRequests.push({ resolve, reject })));
        const view = render(tree());
        const prepareDirect = async () => {
          fireEvent.click(screen.getByRole('button', { name: /^구매한 곳 선택/ }));
          fireEvent.click(within(screen.getByTestId('dialog')).getByRole('button', { name: /^직접 입력/ }));
          for (const [name, value] of [['구매처', '직접 구매처'], ['개당 용량', '1000'], ['실제 결제금액', '4000']]) {
            fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
          }
          await clickReadyButton(/^재고 .* 추가$|^재고 추가$/);
          fireEvent.click(screen.getByRole('button', { name: '입고' }));
        };
        await prepareDirect(); await waitFor(() => expect(vendorRequests).toHaveLength(1));
        if (transition === 'target' || transition === 'target-roundtrip') m.id = 'ingredient-b';
        if (transition === 'target-roundtrip') { view.rerender(tree()); m.id = 'ingredient-a'; }
        if (transition === 'store') m.session = { ...m.session, storeId: 'store-b' };
        if (transition === 'principal') m.session = { ...m.session, userId: 'principal-b' };
        view.rerender(tree());
        // A new editor must be usable while the previous vendor promise is pending.
        await prepareDirect(); await waitFor(() => expect(vendorRequests).toHaveLength(2));
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
      await clickReadyButton(/^재고 .* 추가$|^재고 추가$/);
      fireEvent.click(screen.getByRole('button', { name: '입고' }));
      expect(m.ensure).toHaveBeenCalledOnce(); view.unmount();
      await act(async () => { if (outcome === 'resolve') resolve('old-vendor'); else reject(new Error('옛 구매처 오류')); });
      expect(m.rpc).not.toHaveBeenCalled(); expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
    });
  }
});
