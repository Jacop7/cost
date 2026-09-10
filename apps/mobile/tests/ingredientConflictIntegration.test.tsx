import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientDetailScreen } from '@/features/ingredients/screens/IngredientDetailScreen';
import { qk } from '@/lib/queryClient';

const transport = vi.hoisted(() => ({ rpc: vi.fn(), routeId: 'g1', dismiss: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: transport.rpc } }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-fixture' }));
vi.mock('@/features/business-day/businessDay', () => ({ useBusinessDay: () => ({ data: { timezone: 'Asia/Seoul' } }) }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: transport.routeId }), useRouter: () => ({ push: vi.fn() }),
  router: { canGoBack: () => false, replace: vi.fn(), back: vi.fn() },
}));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Keyboard: { ...rn.Keyboard, dismiss: transport.dismiss }, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) =>
    visible ? <div data-testid="memo-modal">{children}</div> : null };
});

const clients: QueryClient[] = [];
const dialog = () => within(screen.getByTestId('memo-modal'));
const input = () => dialog().getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement;
const raw = (memo: string) => ({ id: 'g1', name: '대파', base_unit: 'g', per_volume: 1000,
  stock_total: 5000, base_price: 4, safety_stock: 1000, min_order_qty: 1, memo,
  category_id: 'c1', category_name: '농산', options: [], orders: [], price_trends: [],
  last_change: { display_state: null, occurred_at: '2030-01-01T00:00:00Z', has_history: false } });

// Actual screen, actual query/mutation hooks and actual QueryClient. Only transport/session,
// navigation and native modal host are fixtures. This is NOT a DB CAS or native geometry test.
describe('메모 충돌 복구 실제 화면↔훅↔캐시 연결', () => {
  let serverMemo: string;
  let readFailure: boolean;
  let missing: boolean;
  beforeEach(() => {
    serverMemo = '처음 메모'; readFailure = false; missing = false; transport.routeId = 'g1';
    transport.dismiss.mockReset();
    transport.rpc.mockReset().mockImplementation(async (name: string, args: { p_payload?: Record<string, unknown>; p_ingredient?: string }) => {
      if (name === 'ingredient_detail' && missing) return { data: null, error: null };
      if (name === 'ingredient_detail') return readFailure
        ? { data: raw('옛 응답'), error: { message: '조회 연결 실패' } }
        : { data: { ...raw(serverMemo), id: args.p_ingredient }, error: null };
      if (name === 'save_ingredient') {
        if (args.p_payload?.expected_memo !== serverMemo) return { data: null, error: { code: '45009', details: 'REVISION_CONFLICT', message: '메모 충돌' } };
        serverMemo = String(args.p_payload?.memo);
        return { data: 'g1', error: null };
      }
      return { data: [], error: null };
    });
  });
  afterEach(() => clients.splice(0).forEach(c => c.clear()));
  const saves = () => transport.rpc.mock.calls.filter(([name]) => name === 'save_ingredient');
  async function open() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    clients.push(client);
    const view = render(<QueryClientProvider client={client}><IngredientDetailScreen /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: '메모 수정' }));
    expect(input().value).toBe('처음 메모');
    fireEvent.change(input(), { target: { value: '내 초안' } });
    serverMemo = '다른 기기의 메모';
    return { view, client };
  }
  async function acknowledge() {
    fireEvent.click(await screen.findByRole('button', { name: '확인 후 계속 수정' }));
    expect(input().value).toBe('내 초안');
  }

  it('사전 캐시 갱신 없이 45009→재조회→확인→명시적 저장 성공', async () => {
    await open(); fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(saves()).toHaveLength(1);
    expect(dialog().getByRole('button', { name: '완료' }).getAttribute('aria-disabled')).toBe('true');
    await acknowledge();
    expect(saves()).toHaveLength(1); // acknowledgement is not a write
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByTestId('memo-modal')).toBeNull());
    expect(serverMemo).toBe('내 초안');
    expect(saves()[1]?.[1].p_payload).toEqual({ id: 'g1', patch: 'memo', memo: '내 초안', expected_memo: '다른 기기의 메모' });
  });

  it('최신 조회 실패는 초안을 지우거나 캐시의 옛값으로 승인하지 않는다', async () => {
    await open(); readFailure = true;
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await screen.findByText('조회 연결 실패');
    expect(input().value).toBe('내 초안');
    expect(screen.queryByRole('button', { name: '확인 후 계속 수정' })).toBeNull();
    fireEvent.click(dialog().getByRole('button', { name: '완료' })); expect(saves()).toHaveLength(1);
    readFailure = false;
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    await acknowledge();
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await waitFor(() => expect(serverMemo).toBe('내 초안'));
  });

  it('확인 후 다시 다른 기기가 수정하면 두 번째 충돌도 자동 덮어쓰기 없이 복구한다', async () => {
    await open(); fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await acknowledge(); serverMemo = '또 다른 수정';
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(saves()).toHaveLength(2); expect(serverMemo).toBe('또 다른 수정');
    await acknowledge(); fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByTestId('memo-modal')).toBeNull());
    expect(saves()).toHaveLength(3); expect(serverMemo).toBe('내 초안');
  });

  it('충돌 조회에서 대상이 없어져도 초안과 안내를 유지하며 저장을 차단한다', async () => {
    await open(); missing = true;
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await screen.findByText('식재료를 찾을 수 없어요. 삭제 여부를 확인해 주세요.');
    expect(input().value).toBe('내 초안');
    expect(dialog().getByRole('button', { name: '완료' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: '확인 후 계속 수정' })).toBeNull();
    fireEvent.click(dialog().getByRole('button', { name: '취소' }));
    expect(screen.queryByTestId('memo-modal')).toBeNull(); expect(saves()).toHaveLength(1);
  });

  it('다른 대상 진입 뒤 이전 저장 성공 응답은 새 메모 초안을 닫지 않는다', async () => {
    const { view, client } = await open();
    let finish!: (value: unknown) => void;
    const normal = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name: string, args: unknown) => name === 'save_ingredient'
      ? new Promise(resolve => { finish = resolve; }) : normal(name, args));
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await waitFor(() => expect(saves()).toHaveLength(1));
    transport.routeId = 'g2';
    view.rerender(<QueryClientProvider client={client}><IngredientDetailScreen /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: '메모 수정' }));
    fireEvent.change(input(), { target: { value: '새 대상 초안' } });
    await act(async () => finish({ data: 'g1', error: null }));
    expect(input().value).toBe('새 대상 초안');
  });

  it('충돌 없는 배경 조회가 null이어도 열린 메모는 안내와 함께 완료를 차단한다', async () => {
    const { client } = await open(); missing = true;
    await act(async () => { await client.refetchQueries({ queryKey: qk.ingredient('g1'), exact: true }); });
    await waitFor(() => expect(client.getQueryData(qk.ingredient('g1'))).toBeNull());
    expect(input().value).toBe('내 초안');
    expect(dialog().getByRole('button', { name: '완료' }).getAttribute('aria-disabled')).toBe('true');
    expect(dialog().getByText('식재료를 찾을 수 없어 저장할 수 없어요. 입력한 메모는 보존했습니다.')).toBeTruthy();
    fireEvent.click(dialog().getByRole('button', { name: '완료' })); expect(saves()).toHaveLength(0);
    missing = false;
    await act(async () => { await client.refetchQueries({ queryKey: qk.ingredient('g1'), exact: true }); });
    await waitFor(() => expect(dialog().getByRole('button', { name: '완료' }).getAttribute('aria-disabled')).not.toBe('true'));
    expect(input().value).toBe('내 초안');
    // Returning data is not permission to silently adopt its memo baseline.
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await acknowledge(); expect(saves()[0]?.[1].p_payload.expected_memo).toBe('처음 메모');
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await waitFor(() => expect(serverMemo).toBe('내 초안'));
  });

  it('메모 충돌 안내는 입력 위에 놓고 새 충돌에서만 키보드를 해제한다', async () => {
    await open(); expect(transport.dismiss).not.toHaveBeenCalled();
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    const heading = dialog().getByText('다른 곳에서 수정됐어요');
    expect(heading.compareDocumentPosition(input()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(transport.dismiss).toHaveBeenCalledOnce();
    fireEvent.change(input(), { target: { value: '내 초안 보완' } });
    expect(transport.dismiss).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '확인 후 계속 수정' })); serverMemo = '두 번째 수정';
    fireEvent.click(dialog().getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(transport.dismiss).toHaveBeenCalledTimes(2);
    expect(input().value).toBe('내 초안 보완');
  });
});
