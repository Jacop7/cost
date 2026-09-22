/**
 * Real useSession + SessionGate + the app QueryClient + useSalesDay.
 * Only Supabase transport/auth events are synthetic. No account or token access.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthSession = { user: { id: string } } | null;
type Listener = (event: string, session: AuthSession) => void;
const m = vi.hoisted(() => ({
  actor: 'actor-a' as string | null,
  listeners: new Set<Listener>(),
  stores: vi.fn(), rpc: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), getUserIdentities: vi.fn(), signOut: vi.fn(), signIn: vi.fn(), signUp: vi.fn(),
  cacheCountAtSignOut: -1,
}));
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  rpcError: (error: unknown) => error,
  supabase: {
    rpc: m.rpc,
    from: (table: string) => {
      if (table !== 'stores') throw new Error(`Unexpected fixture table: ${table}`);
      const chain = { select: () => chain, order: () => chain, limit: () => m.stores(m.actor) };
      return chain;
    },
    auth: {
      getSession: m.getSession, getUser: m.getUser, getUserIdentities: m.getUserIdentities,
      signOut: m.signOut, signInWithPassword: m.signIn, signUp: m.signUp,
      onAuthStateChange: (listener: Listener) => {
        m.listeners.add(listener);
        const initial = m.actor ? { user: { id: m.actor } } : null;
        void Promise.resolve().then(() => { if (m.listeners.has(listener)) listener('INITIAL_SESSION', initial); });
        return { data: { subscription: { unsubscribe: () => m.listeners.delete(listener) } } };
      },
    },
  },
}));

import { SessionGate, useSessionState } from '@/lib/SessionProvider';
import { qk, queryClient } from '@/lib/queryClient';
import { useSalesDay } from '@/features/sales/hooks';
import { useRetireAccount } from '@/features/my/hooks';

const DATE = '2026-09-14';
const observed: { actor: string | null; store: string | null; revenue: number | undefined }[] = [];
function response(revenue: number) {
  return { data: { sale_date: DATE, revision: 3, etc_revenue: 0, daily_extra: 0,
    etc_items: [], extra_items: [], items: [], summary: { revenue },
    basis_quality: null, has_ledger: false, day_status: null, editable: true }, error: null };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function Probe() {
  const session = useSessionState();
  const day = useSalesDay(DATE);
  const retire = useRetireAccount();
  observed.push({ actor: session.userId, store: session.storeId, revenue: day.data?.summary.revenue });
  return <div>
    <div data-testid="scope">{session.userId}|{session.storeId}</div>
    <div data-testid="revenue">{day.data?.summary.revenue ?? 'pending'}</div>
    <button onClick={() => retire.mutate(undefined)}>fixture retire</button>
  </div>;
}
const tree = () => <QueryClientProvider client={queryClient}><SessionGate><Probe /></SessionGate></QueryClientProvider>;
async function publish(actor: string | null, event = actor ? 'SIGNED_IN' : 'SIGNED_OUT') {
  await act(async () => {
    m.actor = actor;
    for (const listener of [...m.listeners]) listener(event, actor ? { user: { id: actor } } : null);
  });
}
async function readyA() {
  render(tree());
  await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('111'));
}
async function signOutThenResolveB() {
  await publish(null);
  expect(screen.queryByTestId('scope')).toBeNull();
  await publish('actor-b');
  // The existing gate exposes retry after sign-out. The fixed event handler may
  // already be resolving B, in which case its loading gate has no retry button.
  const retry = screen.queryByRole('button', { name: '다시 시도' });
  if (retry) fireEvent.click(retry);
  await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
}

beforeEach(() => {
  queryClient.clear(); observed.length = 0; m.listeners.clear(); m.actor = 'actor-a'; m.cacheCountAtSignOut = -1;
  m.getSession.mockReset().mockImplementation(async () => ({ data: { session: m.actor ? { user: { id: m.actor } } : null } }));
  m.getUser.mockReset().mockImplementation(async () => ({ data: { user: m.actor ? { id: m.actor } : null }, error: null }));
  m.getUserIdentities.mockReset().mockResolvedValue({ data: { identities: [{ provider: 'email' }] }, error: null });
  m.stores.mockReset().mockImplementation(async (actor: string | null) => ({ data: actor ? [{ id: actor === 'actor-a' ? 'store-a' : 'store-b' }] : [], error: null }));
  m.signIn.mockReset().mockImplementation(async () => { throw new Error('No development login is expected in this fixture'); });
  m.signUp.mockReset().mockImplementation(async () => { throw new Error('No signup is expected in this fixture'); });
  m.signOut.mockReset().mockImplementation(async () => {
    m.cacheCountAtSignOut = queryClient.getQueryCache().getAll().length;
    m.actor = null;
    for (const listener of [...m.listeners]) listener('SIGNED_OUT', null);
    return { error: null };
  });
  m.rpc.mockReset().mockImplementation(async (name: string, input?: { p_store?: string }) => {
    if (name === 'retire_my_account') return { data: { deleted: true, archived_store_count: 1 }, error: null };
    if (name === 'sales_day_read') return { data: {}, error: null };
    if (name !== 'sales_day') throw new Error(`Unexpected fixture RPC: ${name}`);
    return response(input?.p_store === 'store-a' ? 111 : 222);
  });
});
afterEach(() => { queryClient.clear(); vi.unstubAllGlobals(); });

describe('세션 소유자와 판매 캐시의 실제 경계', () => {
  it('초기 매장 조회 중 로그아웃하면 늦은 ready가 화면을 다시 열지 않는다', async () => {
    const pending = deferred<{ data: { id: string }[]; error: null }>();
    m.stores.mockReturnValueOnce(pending.promise);
    render(tree());
    await waitFor(() => expect(m.stores).toHaveBeenCalledOnce());
    await publish(null);
    expect(screen.queryByTestId('scope')).toBeNull();
    await act(async () => { pending.resolve({ data: [{ id: 'store-a' }], error: null }); });
    expect(screen.queryByTestId('scope')).toBeNull();
    expect(observed).toHaveLength(0);
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('A에서 B로 인증 이벤트가 오면 이전 화면을 숨긴 뒤 B 매장을 해석한다', async () => {
    await readyA();
    const pendingB = deferred<{ data: { id: string }[]; error: null }>();
    m.stores.mockImplementation((actor: string | null) => actor === 'actor-b' ? pendingB.promise : Promise.resolve({ data: [{ id: 'store-a' }], error: null }));
    await publish('actor-b');
    expect(screen.queryByTestId('scope')).toBeNull();
    await act(async () => { pendingB.resolve({ data: [{ id: 'store-b' }], error: null }); });
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('222'));
  });

  it('일반 로그아웃은 화면뿐 아니라 이전 소유자의 캐시도 비운다', async () => {
    await readyA();
    expect(queryClient.getQueryData(qk.salesDay(DATE))).toBeTruthy();
    await publish(null);
    expect(screen.queryByTestId('scope')).toBeNull();
    expect(queryClient.getQueryData(qk.salesDay(DATE))).toBeUndefined();
  });

  it('같은 날짜로 B가 ready가 되어도 30초 이내 A 캐시를 한 번도 표시하지 않는다', async () => {
    await readyA(); observed.length = 0;
    await signOutThenResolveB();
    expect(observed.filter(row => row.actor === 'actor-b' && row.revenue === 111)).toEqual([]);
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('222'));
    expect(m.rpc).toHaveBeenCalledWith('sales_day', { p_store: 'store-b', p_date: DATE });
  });

  it('로그아웃 전에 시작한 A 지연 응답이 B의 같은 날짜 캐시를 채우지 않는다', async () => {
    await readyA();
    const lateA = deferred<ReturnType<typeof response>>();
    m.rpc.mockImplementation(async (name: string, input: { p_store: string }) => {
      if (name === 'sales_day_read') return { data: {}, error: null };
      if (name !== 'sales_day') throw new Error(`Unexpected fixture RPC: ${name}`);
      return input.p_store === 'store-a' ? lateA.promise : response(222);
    });
    let refetch!: Promise<unknown>;
    await act(async () => { refetch = queryClient.refetchQueries({ queryKey: qk.salesDay(DATE) }); });
    await waitFor(() => expect(m.rpc).toHaveBeenCalledTimes(4));
    observed.length = 0;
    await signOutThenResolveB();
    await act(async () => { lateA.resolve(response(999)); await refetch; });
    expect(queryClient.getQueryData(qk.salesDay(DATE))).toMatchObject({ summary: { revenue: 222 } });
    expect(observed.filter(row => row.actor === 'actor-b' && (row.revenue === 111 || row.revenue === 999))).toEqual([]);
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('222'));
  });

  it('동일 사용자 TOKEN_REFRESHED는 캐시와 화면을 불필요하게 초기화하지 않는다', async () => {
    await readyA();
    const originalCache = queryClient.getQueryData(qk.salesDay(DATE));
    const originalNode = screen.getByTestId('scope');
    await publish('actor-a', 'TOKEN_REFRESHED');
    expect(screen.getByTestId('scope')).toBe(originalNode);
    expect(queryClient.getQueryData(qk.salesDay(DATE))).toBe(originalCache);
    expect(m.stores).toHaveBeenCalledOnce();
    expect(m.rpc).toHaveBeenCalledTimes(2);
  });

  it.each(['getSession', 'getUser'] as const)('초기 %s의 지연 응답은 이후 B 인증을 덮어쓰지 않는다', async stage => {
    const late = deferred<unknown>();
    m[stage].mockReturnValueOnce(late.promise);
    render(tree());
    await waitFor(() => expect(m[stage]).toHaveBeenCalledOnce());
    await publish('actor-b');
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
    await act(async () => { late.resolve(stage === 'getSession'
      ? { data: { session: { user: { id: 'actor-a' } } }, error: null }
      : { data: { user: { id: 'actor-a' } }, error: null }); });
    expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b');
    expect(observed.filter(row => row.actor === 'actor-a')).toEqual([]);
    expect(m.stores).not.toHaveBeenCalledWith('actor-a');
  });

  it('로그아웃이 중복되어도 이전 초기 조회를 막고 새 로그인은 허용한다', async () => {
    const late = deferred<{ data: { id: string }[]; error: null }>();
    m.stores.mockReturnValueOnce(late.promise);
    render(tree()); await waitFor(() => expect(m.stores).toHaveBeenCalledOnce());
    await publish(null); await publish(null);
    await act(async () => { late.resolve({ data: [{ id: 'store-a' }], error: null }); });
    expect(screen.queryByTestId('scope')).toBeNull();
    await publish('actor-b');
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
    expect(observed.filter(row => row.actor === 'actor-a')).toEqual([]);
  });

  it('로그아웃과 같은 사용자 재로그인이 한 렌더로 합쳐져도 이전 캐시를 재사용하지 않는다', async () => {
    await readyA();
    m.rpc.mockResolvedValue(response(333));
    await act(async () => {
      m.actor = null;
      for (const listener of [...m.listeners]) listener('SIGNED_OUT', null);
      m.actor = 'actor-a';
      for (const listener of [...m.listeners]) listener('SIGNED_IN', { user: { id: 'actor-a' } });
      await waitFor(() => expect(m.stores).toHaveBeenCalledTimes(2));
    });
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('333'));
  });

  it('이전 쿼리 취소가 끝나기 전에는 B가 ready여도 화면을 열지 않는다', async () => {
    await readyA();
    const barrier = deferred<void>();
    const cancel = queryClient.cancelQueries.bind(queryClient);
    vi.spyOn(queryClient, 'cancelQueries').mockImplementation(async (...args) => { await cancel(...args); await barrier.promise; });
    await publish('actor-b');
    await waitFor(() => expect(m.stores).toHaveBeenCalledWith('actor-b'));
    expect(screen.queryByTestId('scope')).toBeNull();
    expect(observed.filter(row => row.actor === 'actor-b')).toEqual([]);
    await act(async () => { barrier.resolve(); });
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('222'));
  });

  it('빈 운영 세션은 개발 로그인을 시도하지 않으며 이후 로그인 이벤트로 복구한다', async () => {
    vi.stubGlobal('__DEV__', false); m.actor = null;
    render(tree());
    await screen.findByText('Costkeep 로그인');
    expect(m.signIn).not.toHaveBeenCalled(); expect(m.stores).not.toHaveBeenCalled();
    await publish('actor-b');
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
  });

  it('이메일 로그인은 입력을 검증하고 비밀번호를 가린 채 인증한다', async () => {
    vi.stubGlobal('__DEV__', false); m.actor = null;
    m.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'fixture rejected' } });
    render(tree());
    await screen.findByText('Costkeep 로그인');
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('이메일과 비밀번호를 모두 입력해 주세요.')).toBeTruthy();
    expect(m.signIn).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: ' owner@example.com ' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('이메일 또는 비밀번호를 확인해 주세요.')).toBeTruthy();
    expect(m.signIn).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'secret' });
    // 오류 문구는 비동기 submit의 finally 렌더보다 먼저 보일 수 있다. 로딩 중
    // 두 번째 클릭은 제품 계약상 무시되므로, 재시도 가능 상태를 확인한 뒤 누른다.
    await waitFor(() => expect((screen.getByRole('button', { name: '로그인' }) as HTMLButtonElement).disabled).toBe(false));
    m.signIn.mockRejectedValueOnce(new Error('fixture offline'));
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('로그인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.')).toBeTruthy();
  });

  it('이메일 로그인 성공은 저장된 세션·매장 확인 뒤 업무 화면을 연다', async () => {
    vi.stubGlobal('__DEV__', false); m.actor = null;
    m.signIn.mockImplementation(async () => {
      m.actor = 'actor-b';
      for (const listener of [...m.listeners]) listener('SIGNED_IN', { user: { id: 'actor-b' } });
      return { data: { user: { id: 'actor-b' } }, error: null };
    });
    render(tree());
    await screen.findByText('Costkeep 로그인');
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'pilot@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
    expect(m.getUser).toHaveBeenCalled();
  });

  it('회원가입은 필수값·8자·비밀번호 확인을 검증하고 이메일을 정규화한다', async () => {
    vi.stubGlobal('__DEV__', false); m.actor = null;
    m.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'email_address_invalid' } });
    render(tree());
    await screen.findByText('Costkeep 로그인');
    fireEvent.click(screen.getByRole('button', { name: '처음이신가요? 회원가입' }));
    await screen.findByText('Costkeep 회원가입');
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).type).toBe('password');
    expect((screen.getByLabelText('비밀번호 확인') as HTMLInputElement).type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('이메일과 비밀번호 확인까지 모두 입력해 주세요.')).toBeTruthy();
    expect(m.signUp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: ' new@example.com ' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('비밀번호는 8자 이상 입력해 주세요.')).toBeTruthy();
    expect(m.signUp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password8' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password9' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('비밀번호 확인이 일치하지 않아요.')).toBeTruthy();
    expect(m.signUp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password8' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('이메일 형식을 확인해 주세요.')).toBeTruthy();
    expect(m.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password8' });

    m.signUp.mockRejectedValueOnce(new Error('fixture offline'));
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('회원가입하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.', {}, { timeout: 3000 })).toBeTruthy();
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('new@example.com');
  });

  it('이메일 확인이 필요한 가입은 성공을 과장하지 않고 로그인·재시도를 제공한다', async () => {
    vi.stubGlobal('__DEV__', false); m.actor = null;
    m.signUp.mockResolvedValue({ data: { user: { id: 'pending-user' }, session: null }, error: null });
    render(tree());
    await screen.findByText('Costkeep 로그인');
    fireEvent.click(screen.getByRole('button', { name: '처음이신가요? 회원가입' }));
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'pending@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password8' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password8' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('이메일을 확인해 주세요')).toBeTruthy();
    expect(m.stores).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '로그인으로 돌아가기' }));
    await screen.findByText('Costkeep 로그인');
    expect((screen.getByLabelText('이메일') as HTMLInputElement).value).toBe('pending@example.com');
  });

  it('즉시 세션 가입은 사용자 검증→최초 매장 생성→업무 진입으로 이어진다', async () => {
    vi.stubGlobal('__DEV__', false); m.actor = null;
    let created = false;
    m.stores.mockImplementation(async (actor: string | null) => ({
      data: actor && created ? [{ id: 'store-b' }] : [], error: null,
    }));
    m.signUp.mockImplementation(async () => {
      m.actor = 'actor-b';
      for (const listener of [...m.listeners]) listener('SIGNED_IN', { user: { id: 'actor-b' } });
      return { data: { user: { id: 'actor-b' }, session: { user: { id: 'actor-b' } } }, error: null };
    });
    m.rpc.mockImplementation(async (name: string, input?: { p_store?: string }) => {
      if (name === 'create_store') { created = true; return { data: { store_id: 'store-b', created: true }, error: null }; }
      if (name === 'sales_day_read') return { data: {}, error: null };
      if (name !== 'sales_day') throw new Error(`Unexpected fixture RPC: ${name}`);
      return response(input?.p_store === 'store-b' ? 222 : 111);
    });
    render(tree());
    await screen.findByText('Costkeep 로그인');
    fireEvent.click(screen.getByRole('button', { name: '처음이신가요? 회원가입' }));
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password8' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password8' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    await screen.findByText('첫 매장을 연결해 주세요');
    expect(m.getUser).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('매장 이름'), { target: { value: ' 첫 매장 ' } });
    fireEvent.click(screen.getByRole('button', { name: '매장 시작하기' }));
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
    expect(m.rpc).toHaveBeenCalledWith('create_store', { p_name: '첫 매장' });
  });

  it('A 로그아웃 뒤 B 가입으로 진입해도 A의 같은 날짜 캐시를 표시하지 않는다', async () => {
    vi.stubGlobal('__DEV__', false);
    await readyA(); observed.length = 0;
    await publish(null);
    m.signUp.mockImplementation(async () => {
      m.actor = 'actor-b';
      for (const listener of [...m.listeners]) listener('SIGNED_IN', { user: { id: 'actor-b' } });
      return { data: { user: { id: 'actor-b' }, session: { user: { id: 'actor-b' } } }, error: null };
    });
    fireEvent.click(screen.getByRole('button', { name: '처음이신가요? 회원가입' }));
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'b@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password8' } });
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: 'password8' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('222'));
    expect(observed.filter(row => row.actor === 'actor-b' && row.revenue === 111)).toEqual([]);
  });

  it('로그인 계정에 매장이 없으면 create_store 성공 후 같은 계정 범위를 다시 연다', async () => {
    vi.stubGlobal('__DEV__', false);
    let created = false;
    m.stores.mockImplementation(async (actor: string | null) => ({
      data: actor && created ? [{ id: 'store-a' }] : [], error: null,
    }));
    m.rpc.mockImplementation(async (name: string, input?: { p_store?: string; p_name?: string }) => {
      if (name === 'create_store') {
        created = true;
        return { data: { store_id: 'store-a', created: true }, error: null };
      }
      if (name === 'sales_day_read') return { data: {}, error: null };
      if (name !== 'sales_day') throw new Error(`Unexpected fixture RPC: ${name}`);
      return response(input?.p_store === 'store-a' ? 111 : 222);
    });
    render(tree());
    await screen.findByText('첫 매장을 연결해 주세요');
    fireEvent.click(screen.getByRole('button', { name: '매장 시작하기' }));
    expect(await screen.findByText('매장 이름을 입력해 주세요.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('매장 이름'), { target: { value: ' 파일럿 식당 ' } });
    fireEvent.click(screen.getByRole('button', { name: '매장 시작하기' }));
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-a|store-a'));
    expect(m.rpc).toHaveBeenCalledWith('create_store', { p_name: '파일럿 식당' });
    expect(m.stores).toHaveBeenCalledTimes(2);
  });

  it('매장 연결 전 다른 초대 계정으로 안전하게 돌아갈 수 있다', async () => {
    vi.stubGlobal('__DEV__', false);
    m.stores.mockResolvedValue({ data: [], error: null });
    render(tree());
    await screen.findByText('첫 매장을 연결해 주세요');
    fireEvent.click(screen.getByRole('button', { name: '다른 계정으로 로그인' }));
    await screen.findByText('Costkeep 로그인');
    expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.queryByTestId('scope')).toBeNull();
  });

  it('매장 생성 응답이 유실돼도 이름을 보존하고 재시도에서 기존 매장을 연다', async () => {
    vi.stubGlobal('__DEV__', false);
    let created = false;
    m.stores.mockImplementation(async (actor: string | null) => ({
      data: actor && created ? [{ id: 'store-a' }] : [], error: null,
    }));
    m.rpc.mockImplementation(async (name: string, input?: { p_store?: string }) => {
      if (name === 'create_store') {
        if (!created) {
          created = true;
          throw new Error('fixture response lost after commit');
        }
        return { data: { store_id: 'store-a', created: false }, error: null };
      }
      if (name === 'sales_day_read') return { data: {}, error: null };
      if (name !== 'sales_day') throw new Error(`Unexpected fixture RPC: ${name}`);
      return response(input?.p_store === 'store-a' ? 111 : 222);
    });
    render(tree());
    await screen.findByText('첫 매장을 연결해 주세요');
    fireEvent.change(screen.getByLabelText('매장 이름'), { target: { value: '응답 유실 식당' } });
    fireEvent.click(screen.getByRole('button', { name: '매장 시작하기' }));
    expect(await screen.findByText('매장을 만들지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.')).toBeTruthy();
    expect((screen.getByLabelText('매장 이름') as HTMLInputElement).value).toBe('응답 유실 식당');
    await waitFor(() => expect(screen.getByRole('button', { name: '매장 시작하기' }).getAttribute('aria-busy')).not.toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: '매장 시작하기' }));
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-a|store-a'));
    expect(m.rpc.mock.calls.filter(([name]) => name === 'create_store')).toHaveLength(2);
  });

  it.each(['getSession', 'getUser', 'stores'] as const)('%s 조회 실패는 로그아웃 없이 막고 명시 재시도로 복구한다', async stage => {
    m[stage].mockRejectedValueOnce(new Error('fixture temporary failure'));
    render(tree());
    await screen.findByText('서버에 연결하지 못했어요');
    expect(screen.queryByTestId('scope')).toBeNull(); expect(m.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('111'));
  });

  it('인증 콜백이 실행되는 동안에는 Supabase 재조회 함수를 호출하지 않는다', async () => {
    await readyA();
    const before = m.getUser.mock.calls.length;
    act(() => {
      m.actor = 'actor-b';
      for (const listener of [...m.listeners]) listener('SIGNED_IN', { user: { id: 'actor-b' } });
      expect(m.getUser).toHaveBeenCalledTimes(before);
      expect(m.stores).toHaveBeenCalledOnce();
    });
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('actor-b|store-b'));
  });

  it('개발용 초기 로그인은 인증 이벤트가 원 초기 조회를 대체해도 한 번만 매장을 읽는다', async () => {
    m.actor = null;
    m.signIn.mockImplementation(async () => {
      m.actor = 'actor-a';
      for (const listener of [...m.listeners]) listener('SIGNED_IN', { user: { id: 'actor-a' } });
      return { data: { user: { id: 'actor-a' } }, error: null };
    });
    render(tree());
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('111'));
    expect(m.signIn).toHaveBeenCalledOnce(); expect(m.stores).toHaveBeenCalledOnce();
  });

  it('개발용 만료 세션은 정리 후 자동 로그인하되 옛 조회를 재사용하지 않는다', async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
    m.signIn.mockImplementation(async () => {
      m.actor = 'actor-a';
      for (const listener of [...m.listeners]) listener('SIGNED_IN', { user: { id: 'actor-a' } });
      return { data: { user: { id: 'actor-a' } }, error: null };
    });
    render(tree());
    await waitFor(() => expect(screen.getByTestId('revenue').textContent).toBe('111'));
    expect(m.signOut).toHaveBeenCalledOnce(); expect(m.signIn).toHaveBeenCalledOnce();
    expect(m.stores).toHaveBeenCalledOnce();
  });

  it('실제 인증 시험에서는 만료된 개발 세션을 데모 계정으로 다시 열지 않는다', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEV_AUTO_LOGIN', 'false');
    m.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
    render(tree());
    await waitFor(() => expect(screen.getByText('Costkeep 로그인')).toBeTruthy());
    expect(m.signOut).toHaveBeenCalledOnce();
    expect(m.signIn).not.toHaveBeenCalled();
    expect(screen.queryByTestId('scope')).toBeNull();
  });

  it('탈퇴 성공은 기존처럼 캐시를 먼저 비운 뒤 로컬 로그아웃한다', async () => {
    await readyA();
    fireEvent.click(screen.getByRole('button', { name: 'fixture retire' }));
    await waitFor(() => expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(m.cacheCountAtSignOut).toBe(0);
    expect(screen.queryByTestId('scope')).toBeNull();
    expect(queryClient.getQueryData(qk.salesDay(DATE))).toBeUndefined();
  });
});
