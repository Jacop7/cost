/**
 * `useSalesDay` · `useAmendPastSale` 의 **매핑**을 잰다.
 *
 * 왜 따로 두나 —
 *   계약 함수(`dayContract`)는 좋은 응답·나쁜 응답을 넣어 이미 잰다. 화면 시험은 훅을
 *   대신 세우므로 매핑을 안 지난다. 그래서 **그 사이가 비어 있었다** —
 *   훅이 계약을 안 부르고 예전처럼 `Number(r.revision ?? 0)` 으로 읽어도 아무 시험도
 *   빨개지지 않았다. 그 상태로 서버가 `revision` 을 빠뜨리면 화면은 판본 0 을 들고
 *   저장하러 갔다가 45009 를 맞는다 — 사장님 눈에는 이유 없이 저장이 막히는 것이다.
 *
 * 여기서는 supabase 응답만 흉내 내고, 훅이 그 응답을 어떻게 읽는지를 본다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { CONTRACT_HINT } from '@/features/sales/dayContract';
import { supabase } from '@/lib/supabase';
import { useAmendPastSale, useSalesDay } from '@/features/sales/hooks';

vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-1' }));

/** 재시도를 끄지 않으면 실패 시험이 몇 초씩 기다린다. */
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

/*
 * ⚠ 스파이를 **시험마다 새로 단다.** 모듈 바깥에서 한 번만 달았더니
 *   `restoreMocks: true` 가 매 시험 뒤에 원래 함수를 되돌려서, 스파이는 떨어져 나가고
 *   `supabase.rpc` 는 setup 의 "직접 부르면 안 됩니다" 스텁으로 남았다.
 *   그 스텁이 던진 오류를 **계약 오류로 착각해** 부정 시험들이 통과했다 —
 *   아무것도 안 재고 초록이던 상태다. 그래서 아래에서 오류 **내용**까지 확인한다.
 */
let rpc: ReturnType<typeof vi.spyOn>;

/** 계약이 막은 것인가(스텁이 막은 것이 아니라). */
const isContractError = (e: unknown) => String((e as Error)?.message ?? e).includes(CONTRACT_HINT);

/** 0153 이 실제로 주는 모양. */
const DAY = {
  sale_date: '2026-07-31',
  revision: 5,
  etc_revenue: 0, daily_extra: 0, etc_items: [], extra_items: [], items: [],
  summary: {},
  basis_quality: null, has_ledger: false, day_status: null, editable: true,
};

beforeEach(() => { rpc = vi.spyOn(supabase, 'rpc' as never); });

describe('useSalesDay 매핑', () => {
  it('판본을 그대로 읽는다', async () => {
    rpc.mockResolvedValue({ data: DAY, error: null } as never);
    const { result } = renderHook(() => useSalesDay('2026-07-31'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.revision).toBe(5);
    expect(result.current.data?.editable).toBe(true);
  });

  /*
   * ⚠ 이 줄이 핵심이다. 예전 매핑(`Number(r.revision ?? 0)`)이면 여기서 **성공하고**
   *   `revision: 0` 이 나온다 — 그 0 이 저장으로 나가면 45009 다.
   */
  it('판본이 빠지면 **오류로** 만든다 — 0 으로 메우지 않는다', async () => {
    const { revision: _drop, ...noRevision } = DAY;
    rpc.mockResolvedValue({ data: noRevision, error: null } as never);
    const { result } = renderHook(() => useSalesDay('2026-07-31'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isContractError(result.current.error)).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('장부가 있다면서 기준 품질이 없으면 오류다', async () => {
    rpc.mockResolvedValue({
      data: { ...DAY, has_ledger: true, day_status: 'closed', basis_quality: null }, error: null,
    } as never);
    const { result } = renderHook(() => useSalesDay('2026-07-31'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isContractError(result.current.error)).toBe(true);
  });

  /** 0153 부터 기록 없는 날도 한 줄로 답한다. 답이 없다는 건 계약이 어긋난 것이다. */
  it('아무 행도 안 주면 빈 장부로 메우지 않고 오류다', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never);
    const { result } = renderHook(() => useSalesDay('2026-07-31'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isContractError(result.current.error)).toBe(true);
  });
});

describe('useAmendPastSale 매핑', () => {
  const OK = {
    changed: true, created: false, revision: 9, audit_revision_no: 2,
    basis_quality: 'estimated_current', items: [],
  };

  it('두 판본을 각자 읽는다 — 섞으면 다음 저장이 45009 다(0147)', async () => {
    rpc.mockResolvedValue({ data: OK, error: null } as never);
    const { result } = renderHook(() => useAmendPastSale(), { wrapper });
    result.current.mutate({ date: '2026-07-31', baseRevision: 8, items: [] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.revision).toBe(9);
    expect(result.current.data?.auditRevisionNo).toBe(2);
  });

  it('판본이 빠지면 오류다 — 0 으로 메우지 않는다', async () => {
    const { revision: _drop, ...noRevision } = OK;
    rpc.mockResolvedValue({ data: noRevision, error: null } as never);
    const { result } = renderHook(() => useAmendPastSale(), { wrapper });
    result.current.mutate({ date: '2026-07-31', baseRevision: 8, items: [] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isContractError(result.current.error)).toBe(true);
  });

  /** `changed` 가 빠지면 예전 매핑은 `false` 로 읽었다 — "안 바뀌었어요" 라는 거짓말이다. */
  it('changed 가 빠지면 오류다 — 거짓말을 만들지 않는다', async () => {
    const { changed: _drop, ...noChanged } = OK;
    rpc.mockResolvedValue({ data: noChanged, error: null } as never);
    const { result } = renderHook(() => useAmendPastSale(), { wrapper });
    result.current.mutate({ date: '2026-07-31', baseRevision: 8, items: [] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isContractError(result.current.error)).toBe(true);
  });
});
