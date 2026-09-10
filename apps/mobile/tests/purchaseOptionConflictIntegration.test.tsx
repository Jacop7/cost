import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PurchaseOptionScreen } from '@/features/ingredients/screens/PurchaseOptionScreen';
import { qk } from '@/lib/queryClient';

const transport = vi.hoisted(() => ({ rpc: vi.fn(), params: { ingredient: 'g1', option: 'o1' } as { ingredient: string; option?: string }, userId: 'actor-a', storeId: 'store-a' }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: transport.rpc } }));
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => transport.storeId,
  useSessionState: () => ({ phase: 'ready', userId: transport.userId, storeId: transport.storeId }) }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => transport.params, useRouter: () => ({}),
  router: { canGoBack: () => false, replace: vi.fn(), back: vi.fn() } }));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null };
});
const rawOption = () => ({ id: 'o1', name: '대파', vendor_id: 'v1', vendor_name: '첫 구매처', brand_id: 'b1', brand_name: '브랜드',
  volume: 1000, amount: 4000, url: 'https://example.invalid', edit_revision: '9007199254740993' as unknown });
const rawDetail = (options: ReturnType<typeof rawOption>[]) => ({ id: 'g1', name: '대파', base_unit: 'g', options,
  last_change: { display_state: null, occurred_at: null, has_history: false } });
const clients: QueryClient[] = [];
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const submit = () => fireEvent.click(screen.getByRole('button', { name: '저장' }));
const saves = () => transport.rpc.mock.calls.filter(([name]) => name === 'save_purchase_option');
const payload = () => saves().at(-1)![1].p_payload;
const reads = () => transport.rpc.mock.calls.filter(([name]) => name === 'ingredient_detail');
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

// Actual screen/hooks/QueryClient. Only transport and native Modal are substituted;
// mock CAS verifies app wiring, not PostgreSQL concurrency or native geometry.
describe('구매 옵션 판본·복구의 실제 화면/훅 연결', () => {
  let server: ReturnType<typeof rawOption>[];
  let conflictCode: '40001' | '45009';
  beforeEach(() => {
    conflictCode = '45009';
    server = [rawOption()]; transport.params = { ingredient: 'g1', option: 'o1' }; transport.userId = 'actor-a'; transport.storeId = 'store-a';
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    transport.rpc.mockReset().mockImplementation(async (name: string, args: { p_ingredient?: string; p_payload?: Record<string, unknown> }) => {
      if (name === 'ingredient_detail') return { data: { ...rawDetail(server.map(o => ({ ...o }))), id: args.p_ingredient }, error: null };
      if (name === 'settings_lists') return { data: { vendors: [{ id: 'v1', name: '첫 구매처' }, { id: 'v2', name: '최신 구매처' }] }, error: null };
      if (name === 'save_purchase_option') {
        const p = args.p_payload!;
        if (!p.id) return { data: 'created', error: null };
        if (!server.length) return { data: null, error: { code: 'P0002', details: 'OPTION_NOT_FOUND', message: '없음' } };
        if (p.expected_revision !== server[0]!.edit_revision) return { data: null, error: { code: conflictCode, details: conflictCode === '45009' ? 'REVISION_CONFLICT' : 'OPTION_EDIT_CONFLICT', message: '충돌' } };
        return { data: 'o1', error: null };
      }
      return { data: [], error: null };
    });
  });
  afterEach(() => clients.splice(0).forEach(client => client.clear()));
  async function open({ blocked = false }: { blocked?: boolean } = {}) {
    const expected = { ...server[0]! };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    clients.push(client);
    const view = render(<QueryClientProvider client={client}><PurchaseOptionScreen /></QueryClientProvider>);
    // Establish complete initial form/query state before a single user click.
    // Invalid-revision cases intentionally expect the blocked state instead.
    await waitFor(() => {
      expect(value('옵션 이름')).toBe(expected.name);
      expect(value('용량')).toBe(String(expected.volume));
      expect(value('금액')).toBe(String(expected.amount));
      expect(value('구매 링크')).toBe(expected.url);
      expect(screen.getByRole('button', { name: '구매처 변경, ' + expected.vendor_name })).toBeTruthy();
      const query = client.getQueryCache().getAll().find(query => query.queryKey.includes('purchase-option-editor'));
      expect(query?.state.status).toBe('success'); expect(query?.state.fetchStatus).toBe('idle');
      expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBe(blocked ? 'true' : null);
    });
    // RN-web updates PressResponder configuration in a passive effect. Flush
    // effects without sleeping, extending timeouts, or retrying the click.
    await act(async () => {});
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBe(blocked ? 'true' : null);
    return { client, view, redraw: () => view.rerender(<QueryClientProvider client={client}><PurchaseOptionScreen /></QueryClientProvider>) };
  }
  it('큰 판본을 원문 문자열로 보내고 brand_id를 생략한다', async () => {
    await open(); submit(); await waitFor(() => expect(saves()).toHaveLength(1));
    expect(payload().expected_revision).toBe('9007199254740993');
    expect(payload()).not.toHaveProperty('brand_id');
  });
  it('초기 조회 중 저장 없음·필수값 누락 클릭 쓰기0·활성 확인 뒤 클릭 쓰기1', async () => {
    const initial = deferred<{ data: ReturnType<typeof rawDetail>; error: null }>();
    const original = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name, args) => name === 'ingredient_detail' ? initial.promise : original(name, args));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    clients.push(client);
    render(<QueryClientProvider client={client}><PurchaseOptionScreen /></QueryClientProvider>);
    expect(screen.getByText('불러오는 중이에요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull(); expect(saves()).toHaveLength(0);
    await act(async () => initial.resolve({ data: rawDetail(server), error: null }));
    await waitFor(() => {
      expect(value('옵션 이름')).toBe('대파'); expect(value('용량')).toBe('1000'); expect(value('금액')).toBe('4000');
      expect(value('구매 링크')).toBe('https://example.invalid');
      expect(screen.getByRole('button', { name: '구매처 변경, 첫 구매처' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBeNull();
    });
    expect(saves()).toHaveLength(0);
    change('옵션 이름', '');
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBe('true');
    submit(); expect(saves()).toHaveLength(0);
    change('옵션 이름', '대파');
    expect(screen.getByRole('button', { name: '저장' }).getAttribute('aria-disabled')).toBeNull();
    submit(); await waitFor(() => expect(saves()).toHaveLength(1));
    expect(payload()).toMatchObject({ expected_revision: '9007199254740993', vendor_id: 'v1', volume: 1000, amount: 4000 });
  });
  it.each(['45009', '40001'] as const)('%s의 정확한 새/legacy detail 조합 후 초안 유지·최신 금액 확인(RPC0)·별도 저장에서 새 판본을 보낸다', async code => {
    conflictCode = code;
    await open(); change('옵션 이름', '내 이름');
    server = [{ ...server[0]!,  amount: 5000, edit_revision: '9007199254740994' }];
    submit();
    fireEvent.click(await screen.findByRole('button', { name: '확인 후 계속 수정' }));
    expect(value('옵션 이름')).toBe('내 이름'); expect(value('금액')).toBe('5000'); expect(saves()).toHaveLength(1);
    submit(); await waitFor(() => expect(saves()).toHaveLength(2));
    expect(payload()).toMatchObject({ purchase_name: '내 이름', amount: 5000, expected_revision: '9007199254740994' });
  });
  it.each([
    { code: '40001', details: undefined },
    { code: '40001', details: 'SERIALIZATION_FAILURE' },
    { code: '40001', details: 'REVISION_CONFLICT' },
    { code: '45009', details: undefined },
    { code: '45009', details: 'OPTION_EDIT_CONFLICT' },
    { code: '45009', details: 'OTHER_DOMAIN_CONFLICT' },
    { code: 'PT409', details: 'OPTION_EDIT_CONFLICT' },
    { code: 'PT409', details: undefined },
    { code: 'PT409', details: 'OTHER_DOMAIN_CONFLICT' },
    { code: '42501', details: 'OPTION_EDIT_CONFLICT' },
  ])('다른 오류 $code/$details는 U6 판본 복구나 자동 쓰기로 바꾸지 않는다', async error => {
    await open(); change('옵션 이름', '보존 초안'); const beforeReads = reads().length;
    const original = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name, args) => name === 'save_purchase_option'
      ? Promise.resolve({ data: null, error: { ...error, message: '일반 실패' } }) : original(name, args));
    submit(); await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(value('옵션 이름')).toBe('보존 초안'); expect(saves()).toHaveLength(1); expect(reads()).toHaveLength(beforeReads);
    expect(screen.queryByRole('button', { name: '확인 후 계속 수정' })).toBeNull();
  });
  it('P0002는 초안을 보존하고 같은 ID 저장이나 자동 생성을 막는다', async () => {
    await open(); change('옵션 이름', '남길 초안'); server = []; submit();
    await screen.findByText('현재 구매 옵션을 찾을 수 없어요');
    expect(value('옵션 이름')).toBe('남길 초안'); submit();
    expect(saves()).toHaveLength(1); expect(screen.queryByRole('button', { name: '추가' })).toBeNull();
  });
  it('양쪽 금액 수정은 필드 선택 후 확인해야 하고 확인 자체는 저장하지 않는다', async () => {
    await open(); change('금액', '4500');
    server = [{ ...server[0]!, amount: 5000, edit_revision: '2' }]; submit();
    const acknowledge = await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(acknowledge.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(acknowledge); expect(value('금액')).toBe('4500'); expect(saves()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '금액 최신 값 사용' })); fireEvent.click(acknowledge);
    expect(value('금액')).toBe('5000'); expect(saves()).toHaveLength(1); submit();
    await waitFor(() => expect(saves()).toHaveLength(2)); expect(payload()).toMatchObject({ amount: 5000, expected_revision: '2' });
  });
  it('kg와 구매처의 최신 표시·RPC 값이 일치한다', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: '단위 g 변경' })); fireEvent.click(screen.getByRole('button', { name: 'kg' }));
    server = [{ ...server[0]!, volume: 2500, vendor_id: 'v2', vendor_name: '최신 구매처', edit_revision: '2' }]; submit();
    fireEvent.click(await screen.findByRole('button', { name: '확인 후 계속 수정' }));
    expect(value('용량')).toBe('2.5'); expect(screen.getByRole('button', { name: '구매처 변경, 최신 구매처' })).toBeTruthy();
    submit(); await waitFor(() => expect(saves()).toHaveLength(2)); expect(payload()).toMatchObject({ volume: 2500, vendor_id: 'v2', expected_revision: '2' });
  });
  it('background refetch는 열린 초안과 원래 baseline을 변경하지 않는다', async () => {
    const { client } = await open(); change('옵션 이름', '내 초안');
    server = [{ ...server[0]!, name: '서버 변경', amount: 5000, edit_revision: '2' }];
    await act(async () => { await client.invalidateQueries({ queryKey: qk.ingredient('g1') }); });
    expect(value('옵션 이름')).toBe('내 초안'); expect(value('금액')).toBe('4000'); submit();
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(payload().expected_revision).toBe('9007199254740993');
    expect(screen.getByRole('button', { name: '옵션 이름 내 입력 유지' })).toBeTruthy();
  });
  it('재확인 뒤 다시 충돌해도 자동 쓰기를 하지 않는다', async () => {
    await open(); change('옵션 이름', '내 이름'); server = [{ ...server[0]!, amount: 5000, edit_revision: '2' }]; submit();
    fireEvent.click(await screen.findByRole('button', { name: '확인 후 계속 수정' }));
    server = [{ ...server[0]!, amount: 6000, edit_revision: '3' }]; submit();
    fireEvent.click(await screen.findByRole('button', { name: '확인 후 계속 수정' }));
    expect(saves()).toHaveLength(2); expect(value('금액')).toBe('6000');
    submit(); await waitFor(() => expect(saves()).toHaveLength(3)); expect(payload().expected_revision).toBe('3');
  });
  it.each([undefined, null, 1, '0'])('판본 %s 응답은 1회 갱신 뒤 막고 무한 조회하지 않는다', async revision => {
    server = [{ ...server[0]!, edit_revision: revision }]; await open({ blocked: true });
    await screen.findByText('최신 편집 정보를 받지 못했어요. 다시 불러오거나 앱 업데이트를 확인해 주세요.');
    expect(reads()).toHaveLength(2); submit(); expect(saves()).toHaveLength(0);
  });
  it('최신 조회 실패 중에도 폼을 유지하고 명시 조회 재시도만 허용한다', async () => {
    await open(); change('옵션 이름', '보존 초안');
    const original = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name, args) => name === 'ingredient_detail'
      ? Promise.resolve({ data: null, error: { message: '연결 실패' } }) : original(name, args));
    server = [{ ...server[0]!, amount: 5000, edit_revision: '2' }]; submit();
    await screen.findByText('최신 내용을 불러오지 못했어요. 다시 시도해 주세요.');
    expect(value('옵션 이름')).toBe('보존 초안'); submit(); expect(saves()).toHaveLength(1);
    transport.rpc.mockImplementation(original); fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    await screen.findByRole('button', { name: '확인 후 계속 수정' }); expect(saves()).toHaveLength(1);
  });
  it('40001 뒤 성공 조회에서 옵션이 없으면 찾을 수 없음으로 전환한다', async () => {
    await open(); change('옵션 이름', '보존 초안');
    const original = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name, args) => {
      if (name === 'save_purchase_option') { server = []; return Promise.resolve({ data: null, error: { code: '40001', details: 'OPTION_EDIT_CONFLICT', message: '충돌' } }); }
      return original(name, args);
    });
    submit(); await screen.findByText('현재 구매 옵션을 찾을 수 없어요'); expect(value('옵션 이름')).toBe('보존 초안'); submit(); expect(saves()).toHaveLength(1);
  });
  it('같은 틱의 중복 저장은 RPC 한 번만 실행한다', async () => {
    await open(); const pending = deferred<{ data: string; error: null }>();
    const original = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name, args) => name === 'save_purchase_option' ? pending.promise : original(name, args));
    act(() => { submit(); submit(); }); await waitFor(() => expect(saves()).toHaveLength(1));
    await act(async () => pending.resolve({ data: 'o1', error: null }));
  });
  it('신규 생성은 판본 없이 기존 입력·단위 검증을 통과해 추가한다', async () => {
    transport.params = { ingredient: 'g1' };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
    render(<QueryClientProvider client={client}><PurchaseOptionScreen /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('button', { name: '구매 옵션 추가' }));
    change('옵션 이름', '새 옵션'); change('용량', '1000'); change('금액', '4000'); change('구매 링크', 'example.invalid');
    fireEvent.click(screen.getByRole('button', { name: '구매처 변경, 지정 안 함' }));
    fireEvent.click(screen.getByRole('button', { name: '첫 구매처' }));
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    await waitFor(() => expect(saves()).toHaveLength(1)); expect(payload()).not.toHaveProperty('expected_revision');
    expect(payload()).toMatchObject({ id: '', purchase_name: '새 옵션', volume: 1000 });
  });
  it('재조회한 latest가 달라지면 이전 필드 선택을 무효화한다', async () => {
    await open(); change('금액', '4500'); server = [{ ...server[0]!, amount: 5000, edit_revision: '2' }]; submit();
    await screen.findByRole('button', { name: '확인 후 계속 수정' });
    fireEvent.click(screen.getByRole('button', { name: '금액 내 입력 유지' }));
    server = [{ ...server[0]!, amount: 6000, edit_revision: '3' }];
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    const acknowledge = await screen.findByRole('button', { name: '확인 후 계속 수정' });
    expect(acknowledge.getAttribute('aria-disabled')).toBe('true'); expect(value('금액')).toBe('4500');
    expect(screen.getAllByRole('alert')).toHaveLength(1); expect(saves()).toHaveLength(1);
  });
  it('같은 틱의 중복 확인은 최신값 적용을 되돌리지 않는다', async () => {
    await open(); server = [{ ...server[0]!, amount: 5000, edit_revision: '2' }]; submit();
    const acknowledge = await screen.findByRole('button', { name: '확인 후 계속 수정' });
    act(() => { fireEvent.click(acknowledge); fireEvent.click(acknowledge); });
    expect(value('금액')).toBe('5000'); expect(saves()).toHaveLength(1);
  });
  it('닫기와 같은 틱에 전달된 이전 저장 클릭은 쓰기를 시작하지 않는다', async () => {
    await open(); const save = screen.getByRole('button', { name: '저장' });
    const close = screen.getByRole('button', { name: '뒤로 가기' });
    act(() => { fireEvent.click(close); fireEvent.click(save); });
    expect(saves()).toHaveLength(0); expect(screen.queryByLabelText('옵션 이름')).toBeNull();
  });
  it('일반 저장 실패는 초안을 유지하고 사용자가 눌렀을 때만 재시도한다', async () => {
    await open(); change('옵션 이름', '내 초안');
    const original = transport.rpc.getMockImplementation()!; let reject = true;
    transport.rpc.mockImplementation((name, args) => name === 'save_purchase_option' && reject
      ? Promise.resolve({ data: null, error: { message: '연결 끊김', code: '08006' } }) : original(name, args));
    submit(); await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(value('옵션 이름')).toBe('내 초안'); expect(saves()).toHaveLength(1);
    reject = false; submit(); await waitFor(() => expect(saves()).toHaveLength(2));
  });
  it('같은 옵션을 닫고 다시 열었을 때 이전 충돌 조회는 새 편집을 잠그지 않는다', async () => {
    await open(); const pending = deferred<{ data: ReturnType<typeof rawDetail>; error: null }>();
    const original = transport.rpc.getMockImplementation()!;
    server = [{ ...server[0]!, edit_revision: '2' }];
    transport.rpc.mockImplementation((name, args) => name === 'ingredient_detail' ? pending.promise : original(name, args));
    submit(); await screen.findByText('최신 내용을 불러오는 중…');
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
    fireEvent.click(screen.getByRole('button', { name: '대파 구매 링크 메뉴 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '구매 링크 수정' })); change('옵션 이름', '다시 연 초안');
    await act(async () => pending.resolve({ data: rawDetail([{ ...rawOption(), name: '늦은 서버값', edit_revision: '2' }]), error: null }));
    expect(value('옵션 이름')).toBe('다시 연 초안'); expect(screen.queryByRole('button', { name: '확인 후 계속 수정' })).toBeNull();
  });
  it('actor A→B→A의 새 인스턴스는 A의 오래된 진행 중 조회를 받아들이지 않는다', async () => {
    const { redraw } = await open(); const pending = deferred<{ data: ReturnType<typeof rawDetail>; error: null }>();
    const original = transport.rpc.getMockImplementation()!; let hold = true;
    transport.rpc.mockImplementation((name, args) => name === 'ingredient_detail' && hold ? pending.promise : original(name, args));
    server = [{ ...server[0]!, edit_revision: '2' }]; submit(); await screen.findByText('최신 내용을 불러오는 중…');
    hold = false; transport.userId = 'actor-b'; server = [{ ...rawOption(), name: 'B 서버' }]; redraw();
    await waitFor(() => expect(value('옵션 이름')).toBe('B 서버'));
    transport.userId = 'actor-a'; server = [{ ...rawOption(), name: '새 A 서버', edit_revision: '3' }]; redraw();
    await waitFor(() => expect(value('옵션 이름')).toBe('새 A 서버'));
    await act(async () => pending.resolve({ data: rawDetail([{ ...rawOption(), name: '옛 A 응답' }]), error: null }));
    expect(value('옵션 이름')).toBe('새 A 서버');
    expect(screen.queryByRole('button', { name: '확인 후 계속 수정' })).toBeNull();
  });
  for (const outcome of ['success', 'error'] as const) {
    it(`같은 옵션 재진입 뒤 이전 삭제 ${outcome}는 새 초안/Alert를 변경하지 않는다`, async () => {
      await open(); const pending = deferred<{ data: null; error: null | { message: string } }>();
      const original = transport.rpc.getMockImplementation()!;
      transport.rpc.mockImplementation((name, args) => name === 'delete_purchase_option' ? pending.promise : original(name, args));
      fireEvent.click(screen.getByRole('button', { name: '더보기' }));
      fireEvent.click(screen.getByRole('button', { name: '구매 옵션 삭제' }));
      fireEvent.click(screen.getByRole('button', { name: '삭제' }));
      await waitFor(() => expect(transport.rpc.mock.calls.filter(([name]) => name === 'delete_purchase_option')).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }));
      fireEvent.click(screen.getByRole('button', { name: '대파 구매 링크 메뉴 열기' }));
      fireEvent.click(screen.getByRole('button', { name: '구매 링크 수정' })); change('옵션 이름', '새 초안');
      await act(async () => pending.resolve({ data: null, error: outcome === 'error' ? { message: '옛 삭제 실패' } : null }));
      expect(value('옵션 이름')).toBe('새 초안'); expect(Alert.alert).not.toHaveBeenCalled();
    });
  }
  it('unmount 후 충돌 응답은 조회나 Alert를 추가하지 않는다', async () => {
    const { view } = await open(); const pending = deferred<{ data: null; error: { code: string; message: string } }>();
    const original = transport.rpc.getMockImplementation()!;
    transport.rpc.mockImplementation((name, args) => name === 'save_purchase_option' ? pending.promise : original(name, args));
    submit(); await waitFor(() => expect(saves()).toHaveLength(1)); const count = reads().length; view.unmount();
    await act(async () => pending.resolve({ data: null, error: { code: '40001', message: '옛 충돌' } }));
    expect(reads()).toHaveLength(count); expect(Alert.alert).not.toHaveBeenCalled();
  });
  for (const scope of ['actor', 'store', 'ingredient', 'option'] as const) for (const outcome of ['success', 'error'] as const) {
    it(`${scope} 전환 뒤 이전 저장 ${outcome}는 새 폼/Alert를 변경하지 않는다`, async () => {
      const { redraw } = await open();
      const pending = deferred<{ data: string | null; error: null | { code: string; details: string; message: string } }>();
      const original = transport.rpc.getMockImplementation()!;
      transport.rpc.mockImplementation((name, args) => name === 'save_purchase_option' ? pending.promise : original(name, args));
      submit(); await waitFor(() => expect(saves()).toHaveLength(1));
      if (scope === 'actor') transport.userId = 'actor-b';
      if (scope === 'store') transport.storeId = 'store-b';
      if (scope === 'ingredient') transport.params = { ingredient: 'g2', option: 'o1' };
      if (scope === 'option') transport.params = { ingredient: 'g1', option: 'o2' };
      server = [{ ...rawOption(), id: scope === 'option' ? 'o2' : 'o1', name: '새 대상' }]; redraw();
      await waitFor(() => expect(value('옵션 이름')).toBe('새 대상'));
      change('옵션 이름', '새 초안');
      await act(async () => pending.resolve(outcome === 'success' ? { data: 'o1', error: null }
        : { data: null, error: { code: '40001', details: 'OPTION_EDIT_CONFLICT', message: '이전 오류' } }));
      expect(value('옵션 이름')).toBe('새 초안'); expect(Alert.alert).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: '확인 후 계속 수정' })).toBeNull();
    });
  }
});
