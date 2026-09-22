import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickInboundScreen } from '@/features/ingredients/screens/QuickInboundScreen';
import { SessionGate } from '@/lib/SessionProvider';
import type { SessionState } from '@/lib/session';
import { inboundIntentBusy, keepInboundIntent, readInboundIntent } from '@/features/ingredients/inboundIntentStorage';

// Real screen, date gate, session gate and useQuickInbound mutation. Reads,
// useSession, router and Supabase transport are synthetic. No auth/network/DB.
const m = vi.hoisted(() => ({ date: '2030-07-15', id: 'ingredient-a',
  session: { phase: 'ready', userId: 'principal-a', storeId: 'store-a', message: null, retry: () => {},
    signIn: async () => null, signUp: async () => ({ error: null, confirmationRequired: false }),
    socialAvailability: async () => ({ google: false, apple: false }), signInSocial: async () => null, linkSocial: async () => null,
    createStore: async () => null, signOut: async () => null } as SessionState,
  rpc: vi.fn(), toast: vi.fn(), replace: vi.fn(), ensure: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ useSession: () => m.session }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: m.rpc } }));
vi.mock('expo-secure-store', () => ({})); // Web tests exercise real localStorage; native adapter has separate tests.
vi.mock('@/lib/toast', () => ({ showToast: m.toast }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: m.id }),
  useRouter: () => ({ push: vi.fn(), replace: m.replace }), router: { canGoBack: () => false, replace: m.replace, back: vi.fn() } }));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div data-testid="dialog">{children}</div> : null }));
vi.mock('@/features/business-day/businessDay', () => ({ useStoreLocalDate: () => ({ date: m.date, isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/features/master-data/hooks', () => ({ useEnsureVendor: () => m.ensure }));
vi.mock('@/features/ingredients/hooks', async original => ({
  ...await original<typeof import('@/features/ingredients/hooks')>(),
  useInventoryOccurrenceContext: () => ({ data: { requiresConfirmation: false }, isLoading: false, error: null, refetch: vi.fn() }),
  useIngredientDetail: (id: string) => ({ data: { id, name: id, baseUnit: 'g', stockTotal: 5000, basePrice: 4,
    options: [{ id: 'option-a', name: '대파 1kg', volume: 1000, amount: 4000, vendorId: 'vendor-a', vendorName: '구매처', url: null }] },
    isLoading: false, error: null, isFetched: true, refetch: vi.fn() }),
  useQuickInboundPreview: () => ({ data: undefined, isLoading: false, error: null }),
}));
type Request = { payload: Record<string, unknown>; scope: { principal: string | null; store: string | null }; finish: (r: unknown) => void };
let requests: Request[]; let client: QueryClient;
const tree = (editLayout = false) => <QueryClientProvider client={client}><SessionGate><QuickInboundScreen editLayout={editLayout} /></SessionGate></QueryClientProvider>;
const choose = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^구매처 선택/ }));
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
    await clickReadyButton(/^재고 .* 입고$|^입고$/);
    const recovery = screen.queryByRole('button', { name: '이 입고 다시 확인' });
    if (recovery) await clickReadyButton('이 입고 다시 확인');
    else fireEvent.click(screen.getByRole('button', { name: '입고' }));
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
async function resolvePending(request: Request) {
  const previousCount = requests.length;
  if (!screen.queryByRole('button', { name: '이 입고 다시 확인' })) await clickReadyButton(/^재고 .* 입고$/);
  await waitFor(() => expect(screen.getByRole('button', { name: '이 입고 다시 확인' }).getAttribute('aria-disabled')).not.toBe('true'));
  const original = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation((name, payload) => name === 'resolve_quick_inbound'
    ? Promise.resolve({ data: { status: 'recorded', order_id: 'fixture-order' }, error: null })
    : original(name, payload));
  await clickReadyButton('이 입고 다시 확인');
  await waitFor(async () => expect(await readInboundIntent({ actorId: request.scope.principal!,
    storeId: request.scope.store!, ingredientId: request.payload.p_ingredient as string })).toBeNull());
  expect(m.rpc).toHaveBeenCalledWith('resolve_quick_inbound', { p_store: request.scope.store,
    p_ingredient: request.payload.p_ingredient, p_request_key: request.payload.p_request_key });
  expect(requests).toHaveLength(previousCount);
}

describe('입고 화면의 대상·세션·세대별 지연 응답 격리', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks(); m.date = '2030-07-15'; m.id = 'ingredient-a';
    m.session = { phase: 'ready', userId: 'principal-a', storeId: 'store-a', message: null, retry: () => {},
      signIn: async () => null, signUp: async () => ({ error: null, confirmationRequired: false }),
      socialAvailability: async () => ({ google: false, apple: false }), signInSocial: async () => null, linkSocial: async () => null,
      createStore: async () => null, signOut: async () => null };
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    requests = []; m.ensure.mockResolvedValue('vendor-a');
    m.rpc.mockImplementation((name, payload) => {
      if (name !== 'record_current_quick_inbound') throw Error(`Unexpected RPC ${name}`);
      return new Promise(resolve => requests.push({ payload: structuredClone(payload),
        scope: { principal: m.session.userId, store: m.session.storeId }, finish: resolve }));
    });
  });
  afterEach(() => client.clear());

  it('U5-B: 응답 유실 후 같은 범위 재진입은 미확인 입고를 조회만 하고 재전송하지 않는다', async () => {
    const view = render(tree()); await choose(); const first = await send(); await finish(first, true);
    view.unmount(); render(tree());
    await screen.findByText('현재 재고');
    expect(screen.queryByRole('button', { name: '이 입고 다시 확인' })).toBeNull();
    expect(requests).toHaveLength(1);
    expect(screen.getByText('현재 재고')).toBeTruthy();
    await choose();
    await clickReadyButton(/^재고 .* 입고$/);
    expect(requests).toHaveLength(1);
    await resolvePending(first);
  });

  it.each(['recorded', 'not_recorded'] as const)('이전 요청 %s 확인 뒤 현재 입력은 새 입고이며 원 날짜로 재전송하지 않는다', async status => {
    const scope = { actorId: 'principal-a', storeId: 'store-a', ingredientId: 'ingredient-a' };
    await keepInboundIntent({ version: 1, scope, payload: { ingredientId: scope.ingredientId,
      volume: 1000, amount: 4000, qty: 1, vendorId: 'vendor-a', occurredAt: '2026-09-11', idempotencyKey: 'old-request' } });
    const original = m.rpc.getMockImplementation()!;
    m.rpc.mockImplementation((name, payload) => name === 'resolve_quick_inbound'
      ? Promise.resolve({ data: { status, ...(status === 'recorded' ? { order_id: 'old-order' } : {}) }, error: null })
      : original(name, payload));
    render(tree());
    await waitFor(async () => expect(await readInboundIntent(scope)).toBeNull());
    expect(requests).toHaveLength(0);
    expect(m.rpc).toHaveBeenCalledWith('resolve_quick_inbound', {
      p_store: scope.storeId, p_ingredient: scope.ingredientId, p_request_key: 'old-request',
    });
    expect(screen.queryByText('이전 입고 확인')).toBeNull();
    if (status === 'recorded') expect(m.toast).toHaveBeenCalledWith('2026-09-11 입고는 이미 반영됐어요.');
    else expect(m.toast).not.toHaveBeenCalled();
    await choose();
    fireEvent.change(screen.getByRole('textbox', { name: '개당 용량' }), { target: { value: '123' } });
    fireEvent.change(screen.getByRole('textbox', { name: '결제금액' }), { target: { value: '12888' } });
    const current = await send();
    expect(current.payload).toMatchObject({ p_volume: 123, p_amount: 12888 });
    expect(current.payload).not.toHaveProperty('p_occurred_at');
    expect(current.payload.p_request_key).not.toBe('old-request');
    await finish(current);
  });

  it('U5-B: 입고 보관 실패는 RPC를 보내지 않는다', async () => {
    const view = render(tree()); await choose();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('저장 공간 오류'); });
    await clickReadyButton(/^재고 .* 입고$/);
    fireEvent.click(screen.getByRole('button', { name: '입고' }));
    await screen.findByText(/저장 공간 오류/);
    expect(requests).toHaveLength(0); view.unmount();
  });

  it('U5-B: 서버 날짜가 바뀌면 이전 입고는 조회만 하고 현재 값은 새 키로 보낸다', async () => {
    const view = render(tree()); await choose(); const first = await send(); await finish(first, true);
    m.date = '2030-07-16'; view.rerender(tree());
    expect(requests).toHaveLength(1);
    await choose();
    fireEvent.change(screen.getByRole('textbox', { name: '결제금액' }), { target: { value: '9999' } });
    await clickReadyButton(/^재고 .* 입고$/);
    await screen.findByText('원 입고일: 2030-07-15');
    await resolvePending(first);
    const current = await send();
    expect(current.payload).toMatchObject({ p_amount: 9999 });
    expect(current.payload).not.toHaveProperty('p_occurred_at');
    expect(current.payload.p_request_key).not.toBe(first.payload.p_request_key);
    await finish(current);
  });

  it.each(['principal', 'store', 'ingredient'] as const)('U5-B: %s 변경은 이전 요청을 보내지 않고 원 범위 복귀 때만 복원한다', async field => {
    const view = render(tree()); await choose(); const first = await send(); await finish(first, true);
    if (field === 'principal') m.session = { ...m.session, userId: 'principal-b' };
    if (field === 'store') m.session = { ...m.session, storeId: 'store-b' };
    if (field === 'ingredient') m.id = 'ingredient-b';
    view.rerender(tree()); await choose(); const other = await send(); await finish(other);
    expect(other.payload.p_request_key).not.toBe(first.payload.p_request_key);
    if (field === 'principal') m.session = { ...m.session, userId: 'principal-a' };
    if (field === 'store') m.session = { ...m.session, storeId: 'store-a' };
    if (field === 'ingredient') m.id = 'ingredient-a';
    view.rerender(tree()); await choose();
    expect(screen.queryByRole('button', { name: '이 입고 다시 확인' })).toBeNull();
    expect(requests).toHaveLength(2);
    await resolvePending(first);
  });

  it('U5-B: 저장소 읽기 실패는 새 쓰기를 잠그고 명시 재조회로만 해제한다', async () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('보관 정보 읽기 오류'); });
    render(tree());
    await choose();
    await clickReadyButton(/^재고 .* 입고$/);
    await screen.findByText('보관 정보 읽기 오류');
    expect(requests).toHaveLength(0);
    read.mockRestore(); fireEvent.click(screen.getByRole('button', { name: '입고 확인 정보 다시 불러오기' }));
    await screen.findByRole('button', { name: /^구매처 선택/ }); await choose(); await finish(await send());
  });

  it('미확인 입고가 있어도 재고 수정의 기본 화면과 차감·폐기 탭을 유지한다', async () => {
    const view = render(tree()); await choose(); const first = await send(); await finish(first, true);
    view.unmount(); render(tree(true));
    await act(async () => {});
    expect(screen.queryByRole('button', { name: '이 입고 다시 확인' })).toBeNull();
    expect(screen.queryByText(/원 입고일:/)).toBeNull();
    expect(screen.getByText('재고 조정')).toBeTruthy();
    expect(screen.getByText('현재 재고')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^구매처 선택/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^재고 .* 입고$/ }).getAttribute('aria-disabled')).toBe('true');
    for (const [label, mode] of [['차감', 'deduct'], ['폐기', 'waste']]) {
      fireEvent.click(screen.getByRole('tab', { name: label }));
      expect(m.replace).toHaveBeenLastCalledWith(`/ingredients/add-stock/ingredient-a?mode=${mode}`);
    }
    expect(requests).toHaveLength(1);
  });

  it('U5-B: 확인정보 정리 실패는 성공 토스트나 새 K2를 허용하지 않는다', async () => {
    render(tree()); await choose(); const first = await send();
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('확인정보 정리 오류'); });
    await finish(first); await screen.findByText('확인정보 정리 오류');
    expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
    remove.mockRestore(); await resolvePending(first);
    expect(m.toast).not.toHaveBeenCalledWith('입고를 완료했어요.');
  });

  it('U5-B: 성공 형식이 불완전한 응답도 미확인 요청으로 남고 전역 retry가 자동 전송하지 않는다', async () => {
    client.setDefaultOptions({ mutations: { retry: 2, retryDelay: 0 } });
    render(tree()); await choose(); const first = await send();
    await act(async () => first.finish({ data: {}, error: null }));
    await screen.findByText('입고 결과를 확인하지 못했어요. 같은 입고를 다시 확인해 주세요.');
    expect(requests).toHaveLength(1); expect(m.toast).not.toHaveBeenCalled();
    await resolvePending(first);
  });

  it.each(['22000', '42501', 'P0002', 'NETWORK'])('resolver %s 오류는 과거 입고 재전송 없이 사유와 요청을 보존한다', async code => {
    render(tree()); await choose(); const first = await send(); await finish(first, true); closeError();
    const original = m.rpc.getMockImplementation()!;
    m.rpc.mockImplementation((name, payload) => name === 'resolve_quick_inbound'
      ? Promise.resolve({ data: null, error: { message: `확인 거절 ${code}`, code } }) : original(name, payload));
    if (!screen.queryByRole('button', { name: '이 입고 다시 확인' })) await clickReadyButton(/^재고 .* 입고$/);
    await clickReadyButton('이 입고 다시 확인');
    await screen.findByText(`확인 거절 ${code}`);
    expect(requests).toHaveLength(1);
    expect(await readInboundIntent({ actorId: 'principal-a', storeId: 'store-a', ingredientId: 'ingredient-a' }))
      .toMatchObject({ payload: { idempotencyKey: first.payload.p_request_key, occurredAt: '2030-07-15' } });
    expect(m.toast).not.toHaveBeenCalled();
  });
  it('control: confirmed success followed by an intended new identical inbound receives a new key', async () => {
    const view = render(tree()); await choose(); const first = await send(); await finish(first);
    await waitFor(() => expect(m.toast).toHaveBeenCalledTimes(1));
    view.unmount(); render(tree()); await choose(); const second = await send(); await finish(second);
    expect(second.payload.p_request_key).not.toBe(first.payload.p_request_key);
    const { p_request_key: a, ...pa } = first.payload; const { p_request_key: b, ...pb } = second.payload;
    expect(pb).toEqual(pa);
  });
  for (const transition of ['target', 'target-roundtrip', 'store-ready-to-ready', 'principal-ready-to-ready', 'date-remount', 'signout-remount'] as const) {
    for (const outcome of ['success', 'error'] as const) {
      it(`late ${outcome}: ${transition} must not affect the new screen`, async () => {
        const view = render(tree()); await choose(); const first = await send();
        if (transition === 'target') m.id = 'ingredient-b';
        if (transition === 'target-roundtrip') { m.id = 'ingredient-b'; view.rerender(tree()); m.id = 'ingredient-a'; }
        if (transition === 'store-ready-to-ready') m.session = { ...m.session, storeId: 'store-b' };
        if (transition === 'principal-ready-to-ready') m.session = { ...m.session, userId: 'principal-b' };
        if (transition === 'date-remount') m.date = '2030-07-16';
        if (transition === 'signout-remount') {
          m.session = { ...m.session, phase: 'signed-out', userId: null, storeId: null }; view.rerender(tree());
          expect(screen.getByText('Costkeep 로그인')).toBeTruthy();
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
    it(`A→B→A에서 옛 ${outcome} 정리는 새 세대를 닫지 않고 원 요청 결과만 확인한다`, async () => {
      const view = render(tree()); await choose(); const first = await send();
      m.id = 'ingredient-b'; view.rerender(tree()); m.id = 'ingredient-a'; view.rerender(tree());
      await choose();
      const submit = screen.getByRole('button', { name: /^재고 .* 입고$/ });
      expect(submit.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(submit); expect(requests).toHaveLength(1);
      await act(async () => first.finish({ data: { order_id: 'fixture-order' }, error: outcome === 'error' ? { message: '옛 입고 오류' } : null }));
      await waitFor(() => expect(client.getMutationCache().getAll()[0]!.state.status).not.toBe('pending'));
      expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
      expect(screen.queryByText('옛 입고 오류')).toBeNull();
      await resolvePending(first);
      expect(m.toast).not.toHaveBeenCalledWith('입고를 완료했어요.'); expect(m.replace).not.toHaveBeenCalled();
      const second = await send();
      expect(second.payload.p_request_key).not.toBe(first.payload.p_request_key);
      await finish(second); await waitFor(() => expect(m.toast).toHaveBeenCalledWith('입고를 완료했어요.'));
    });
  }
  for (const transition of ['target', 'target-roundtrip', 'store', 'principal'] as const) {
    for (const outcome of ['resolve', 'reject'] as const) {
      it(`구매처 ${outcome} 지연 중 ${transition} 변경: 이전 초안으로 입고하지 않고 현재 준비 상태를 보존한다`, async () => {
        const vendorRequests: { resolve: (id: string) => void; reject: (error: Error) => void }[] = [];
        m.ensure.mockImplementation(() => new Promise((resolve, reject) => vendorRequests.push({ resolve, reject })));
        const view = render(tree());
        const prepareDirect = async () => {
          fireEvent.click(await screen.findByRole('button', { name: /^구매처 선택/ }));
          fireEvent.click(within(screen.getByTestId('dialog')).getByRole('button', { name: /^직접 입력/ }));
          for (const [name, value] of [['구매처', '직접 구매처'], ['개당 용량', '1000'], ['결제금액', '4000']]) {
            fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
          }
          await clickReadyButton(/^재고 .* 입고$|^입고$/);
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
      fireEvent.click(await screen.findByRole('button', { name: /^구매처 선택/ }));
      fireEvent.click(within(screen.getByTestId('dialog')).getByRole('button', { name: /^직접 입력/ }));
      for (const [name, value] of [['구매처', '직접 구매처'], ['개당 용량', '1000'], ['결제금액', '4000']]) {
        fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
      }
      await clickReadyButton(/^재고 .* 입고$|^입고$/);
      fireEvent.click(screen.getByRole('button', { name: '입고' }));
      expect(m.ensure).toHaveBeenCalledOnce(); view.unmount();
      await act(async () => { if (outcome === 'resolve') resolve('old-vendor'); else reject(new Error('옛 구매처 오류')); });
      expect(m.rpc).not.toHaveBeenCalled(); expect(m.toast).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
    });
  }
});
