import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientFormScreen } from '@/features/ingredients/screens/IngredientFormScreen';

const transport = vi.hoisted(() => ({ rpc: vi.fn(), replace: vi.fn(), back: vi.fn(), scrollTo: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: transport.rpc } }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-fixture' }));
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: transport.replace }),
  router: { canGoBack: () => false, replace: transport.replace, back: transport.back },
}));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  const react = await import('react');
  return { ...rn, Keyboard: { ...rn.Keyboard, dismiss: transport.dismiss },
    ScrollView: react.forwardRef((props: React.ComponentProps<typeof rn.ScrollView>, ref) => {
      react.useImperativeHandle(ref, () => ({ scrollTo: transport.scrollTo }));
      return <rn.ScrollView {...props} />;
    }),
    Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div>{children}</div> : null };
});

const raw = () => ({ id: 'g1', name: '대파', category_id: 'c1', category_name: '농산',
  base_unit: 'g', per_volume: 1000, purchase_price: 4000, safety_stock: 2000,
  min_order_qty: 1, default_vendor_id: 'v1', memo: '원래 메모', stock_total: 5000,
  base_price: 4, options: [], orders: [], price_trends: [],
  last_change: { display_state: null, occurred_at: null, has_history: false } });
const clients: QueryClient[] = [];
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const submit = () => fireEvent.click(screen.getByRole('button', { name: '저장' }));
const saves = () => transport.rpc.mock.calls.filter(([name]) => name === 'save_ingredient');
const payload = () => saves().at(-1)![1].p_payload;

// Actual form, query/mutation hooks and QueryClient. Transport CAS is only a fixture,
// not proof of database concurrency, unit precision in general, or native geometry.
describe('식재료 폼 충돌의 실제 훅·캐시·payload 연결', () => {
  let server: ReturnType<typeof raw>;
  beforeEach(() => {
    server = raw(); transport.replace.mockReset(); transport.back.mockReset(); transport.scrollTo.mockReset(); transport.dismiss.mockReset();
    transport.rpc.mockReset().mockImplementation(async (name: string, args: { p_ingredient?: string; p_payload?: Record<string, unknown> }) => {
      if (name === 'ingredient_detail') return { data: { ...server, id: args.p_ingredient,
        ...(args.p_ingredient === 'g2' ? { name: '두 번째 식재료' } : {}) }, error: null };
      if (name === 'settings_lists') return { data: { categories: [
        { id: 'c1', name: '농산' }, { id: 'c2', name: '가공' },
      ] }, error: null };
      if (name === 'save_ingredient') {
        const p = args.p_payload!;
        if (Object.entries(p.expected as Record<string, unknown>).some(([k, v]) =>
          server[k as keyof typeof server] !== v)) return { data: null, error: { code: '45009', details: 'REVISION_CONFLICT', message: '다른 기기에서 변경됐어요' } };
        server = { ...server, ...p } as typeof server;
        return { data: p.id, error: null };
      }
      return { data: [], error: null };
    });
  });
  afterEach(() => clients.splice(0).forEach(c => c.clear()));
  async function open() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    clients.push(client);
    const view = render(<QueryClientProvider client={client}><IngredientFormScreen id="g1" /></QueryClientProvider>);
    await waitFor(() => expect(value('식재료명')).toBe('대파'));
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).not.toBe('true'));
    // Async query hydration also changes RN Web's PressResponder configuration.
    // Flush its passive effect before the first single click; input text alone
    // does not establish that the newly enabled button is ready to dispatch.
    await act(async () => {});
    return { client, view };
  }
  async function acknowledge() {
    fireEvent.click(await screen.findByRole('button', { name: '확인 후 계속 수정' }));
  }
  async function saved() {
    await waitFor(() => expect(transport.replace).toHaveBeenCalledWith('/ingredients/g1'));
  }

  it.each([{code:'40001'},{code:'40001',details:'REVISION_CONFLICT'},{code:'45009'},{code:'45009',details:'OPTION_EDIT_CONFLICT'},{code:'PT409',details:'REVISION_CONFLICT'}])('폼 일반 $code/$details는 초안과 원본을 유지하고 복구 조회하지 않는다',async error=>{
    await open();change('식재료명','보존 초안');const beforeReads=transport.rpc.mock.calls.filter(([name])=>name==='ingredient_detail').length;
    const original=transport.rpc.getMockImplementation()!;transport.rpc.mockImplementation((name,args)=>name==='save_ingredient'?Promise.resolve({data:null,error:{...error,message:'일반 실패'}}):original(name,args));
    submit();await screen.findByText('일반 실패');expect(saves()).toHaveLength(1);expect(value('식재료명')).toBe('보존 초안');
    expect(transport.rpc.mock.calls.filter(([name])=>name==='ingredient_detail')).toHaveLength(beforeReads);expect(screen.queryByRole('button',{name:'확인 후 계속 수정'})).toBeNull();
  });
  it('카테고리 충돌 확인 후 표시 라벨과 RPC category_id가 같은 최신 카테고리다', async () => {
    await open(); change('식재료명', '내 이름');
    server = { ...server, category_id: 'c2', category_name: '가공' };
    submit(); await acknowledge();
    expect(screen.getByRole('button', { name: '카테고리 변경, 가공' })).toBeTruthy();
    expect(saves()).toHaveLength(1); submit(); await saved();
    expect(payload()).toMatchObject({ name: '내 이름', category_id: 'c2', expected: { category_id: 'c2' } });
  });

  it('kg 표시의 미수정 용량은 최신2500g을 2.5로 표시하고 저장시2500을 보낸다', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: '단위 g 변경' }));
    fireEvent.click(screen.getByRole('button', { name: 'kg' }));
    expect(screen.queryByLabelText('개당 용량')).toBeNull();
    server = { ...server, per_volume: 2500 }; submit(); await acknowledge();
    expect(screen.queryByLabelText('개당 용량')).toBeNull();
    expect(screen.getByRole('button', { name: '단위 kg 변경' })).toBeTruthy();
    expect(saves()).toHaveLength(1); submit(); await saved();
    expect(payload()).toMatchObject({ contract_version: 3, base_unit: 'g', expected: { per_volume: 2500 } });
    expect(payload()).not.toHaveProperty('per_volume');
  });

  it('미수정 최소발주는 최신5를 표시하고 RPC에도5를 보낸다', async () => {
    await open(); server = { ...server, min_order_qty: 5 }; submit(); await acknowledge();
    expect(screen.queryByLabelText('최소 발주')).toBeNull(); expect(saves()).toHaveLength(1);
    submit(); await saved(); expect(payload()).toMatchObject({ expected: { min_order_qty: 5 } });
  });

  it('폼 확인→재충돌→재확인 뒤에도 초안을 유지하고 명시 저장만 성공한다', async () => {
    await open(); change('식재료명', '보존할 초안'); server = { ...server, purchase_price: 5000 };
    submit(); await acknowledge(); expect(saves()).toHaveLength(1);
    server = { ...server, purchase_price: 6000 }; submit(); await acknowledge();
    expect(saves()).toHaveLength(2); expect(value('식재료명')).toBe('보존할 초안');
    expect(screen.queryByLabelText('구매 가격')).toBeNull(); expect(server.name).toBe('대파');
    expect(transport.replace).not.toHaveBeenCalled();
    submit(); await saved(); expect(saves()).toHaveLength(3);
    expect(payload()).toMatchObject({ name: '보존할 초안', contract_version: 3, expected: { purchase_price: 6000 } });
    expect(payload()).not.toHaveProperty('purchase_price');
  });

  it('메모만 변경된 충돌도 최신 메모와 유지 방식을 알리고 숨은 값들을 보존한다', async () => {
    await open(); change('식재료명', '내 이름'); server = { ...server, memo: '새 메모' };
    submit(); await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(screen.getByText('메모가 변경됐어요. 이 화면에서는 최신 메모를 유지합니다.')).toBeTruthy();
    expect(screen.getByText('새 메모')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '메모' })).toBeNull();
    await acknowledge(); submit(); await saved();
    expect(payload()).toMatchObject({ memo: '새 메모', default_vendor_id: 'v1', expected: { memo: '새 메모', default_vendor_id: 'v1' } });
  });

  it('숨은 구매처가 바뀌어도 입력란을 복원하지 않고 확인한 최신값을 보존한다', async () => {
    await open(); server = { ...server, default_vendor_id: 'v2' }; submit(); await acknowledge();
    expect(screen.queryByRole('textbox', { name: /구매처|거래처/ })).toBeNull();
    submit(); await saved(); expect(payload()).toMatchObject({ default_vendor_id: 'v2', memo: '원래 메모', expected: { default_vendor_id: 'v2' } });
  });

  it('폼 대상 변경 후 이전 저장 성공이 새 대상 초안을 닫거나 이동시키지 않는다', async () => {
    const { client, view } = await open();
    let finish!: (value: unknown) => void;
    const normal = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name: string, args: unknown) => name === 'save_ingredient'
      ? new Promise(resolve => { finish = resolve; }) : normal(name, args));
    submit(); await waitFor(() => expect(saves()).toHaveLength(1));
    const pending = client.getMutationCache().getAll()[0]!;
    view.rerender(<QueryClientProvider client={client}><IngredientFormScreen id="g2" /></QueryClientProvider>);
    await waitFor(() => expect(value('식재료명')).toBe('두 번째 식재료'));
    change('식재료명', '새 대상 초안');
    await act(async () => finish({ data: 'g1', error: null }));
    await waitFor(() => expect(pending.state.status).toBe('success'));
    expect(value('식재료명')).toBe('새 대상 초안');
    expect(transport.replace).not.toHaveBeenCalled(); expect(transport.back).not.toHaveBeenCalled();
  });

  it('하단에서 저장한 새 충돌만 안내로1회 이동하고 조회/초안 렌더는 반복 이동하지 않는다', async () => {
    await open(); change('안전재고', '3'); server = { ...server, purchase_price: 5000 };
    let finish!: (value: unknown) => void;
    const normal = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name: string, args: unknown) => name === 'ingredient_detail'
      ? new Promise(resolve => { finish = resolve; }) : normal(name, args));
    expect(transport.scrollTo).not.toHaveBeenCalled(); submit();
    await screen.findByText('최신 내용을 불러오는 중…');
    expect(transport.scrollTo).toHaveBeenCalledOnce();
    expect(transport.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    expect(transport.dismiss).toHaveBeenCalledOnce();
    change('안전재고', '4');
    await act(async () => finish({ data: { ...server }, error: null }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    await act(async () => finish({ data: { ...server }, error: null }));
    await acknowledge(); expect(value('안전재고')).toBe('4');
    expect(transport.scrollTo).toHaveBeenCalledOnce(); expect(transport.dismiss).toHaveBeenCalledOnce();
    server = { ...server, purchase_price: 6000 }; submit();
    await screen.findByText('최신 내용을 불러오는 중…');
    expect(transport.scrollTo).toHaveBeenCalledTimes(2); expect(transport.dismiss).toHaveBeenCalledTimes(2);
    await act(async () => finish({ data: { ...server }, error: null }));
    await acknowledge(); expect(transport.scrollTo).toHaveBeenCalledTimes(2);
    expect(value('안전재고')).toBe('4'); expect(saves()).toHaveLength(2);
  });
});
