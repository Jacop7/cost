/**
 * 설정 저장 훅의 판본 계약을 재다.
 * 화면 시험은 훅을 대신 세우므로, 여기서는 실제 RPC 인자·응답 파싱·캐시 갱신을 끝까지 지킨다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  parseSettingsSaveResult,
  parseTaxSaveResult,
  useSaveSettings,
  useSaveStoreTax,
  type StoreSettings,
} from '@/features/settings/hooks';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-1' }));

const SETTINGS: StoreSettings = {
  unitSystem: 'metric', cupVolume: 200, defaultTargetProfitRate: 40,
  locale: 'ko', currency: 'KRW', unitPriceDigits: 2, quantityDigits: 2, moneyDigits: 0,
  alertMorningSummary: true, alertInboundDelay: true, alertPriceSpike: true, alertTargetMiss: true,
  openTime: '11:00', closeTime: '22:00', breakStart: null, breakEnd: null,
  overnight: false, openMinutes: 660, taxMode: 'included', taxItems: [], revision: 4,
};

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
let rpc: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(qk.storeSettings, SETTINGS);
  rpc = vi.spyOn(supabase, 'rpc' as never);
});

describe('설정 저장 응답 계약', () => {
  it('changed·revision·recipes 누락을 false/0 으로 메우지 않는다', () => {
    expect(() => parseSettingsSaveResult({ revision: 2 })).toThrow(/changed/);
    expect(() => parseSettingsSaveResult({ changed: true })).toThrow(/revision/);
    expect(() => parseSettingsSaveResult({ changed: true, revision: '2' })).toThrow(/revision/);
    expect(() => parseTaxSaveResult({ changed: true, revision: 2 })).toThrow(/recipes/);
    expect(parseTaxSaveResult({ changed: false, recipes: 0, revision: 2 })).toEqual({ changed: false, recipes: 0, revision: 2 });
  });
});

describe('useSaveSettings', () => {
  it('최신 캐시가 아니라 편집 시작 판본을 보내고, 응답 판본을 즉시 캐시에 올린다', async () => {
    // 배경 재조회로 캐시는 9가 됐지만 사용자 초안의 base는 4다.
    qc.setQueryData(qk.storeSettings, { ...SETTINGS, revision: 9 });
    rpc.mockResolvedValue({ data: { changed: true, revision: 5 }, error: null } as never);
    const { result } = renderHook(() => useSaveSettings(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ values: { alertPriceSpike: false }, baseRevision: 4 });
    });

    expect(rpc).toHaveBeenCalledWith('save_settings', expect.objectContaining({ p_base_revision: 4 }));
    expect(qc.getQueryData<StoreSettings>(qk.storeSettings)).toMatchObject({ alertPriceSpike: false, revision: 5 });
  });

  it('방금 받은 판본으로 재조회 전 다음 저장을 이어갈 수 있다', async () => {
    rpc
      .mockResolvedValueOnce({ data: { changed: true, revision: 5 }, error: null } as never)
      .mockResolvedValueOnce({ data: { changed: true, revision: 6 }, error: null } as never);
    const { result } = renderHook(() => useSaveSettings(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ values: { alertPriceSpike: false }, baseRevision: 4 }); });
    await act(async () => { await result.current.mutateAsync({ values: { alertTargetMiss: false }, baseRevision: 5 }); });
    expect(rpc.mock.calls.map((c) => (c[1] as { p_base_revision: number }).p_base_revision)).toEqual([4, 5]);
    expect(qc.getQueryData<StoreSettings>(qk.storeSettings)?.revision).toBe(6);
  });
});

describe('useSaveStoreTax', () => {
  it('편집 기준 판본을 보내고 세금·새 판본을 즉시 반영한다', async () => {
    rpc.mockResolvedValue({ data: { changed: true, recipes: 3, revision: 5 }, error: null } as never);
    const { result } = renderHook(() => useSaveStoreTax(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ items: [{ name: ' 부가세 ', rate: 9.09 }], baseRevision: 4 });
    });
    expect(rpc).toHaveBeenCalledWith('save_store_tax', expect.objectContaining({ p_base_revision: 4 }));
    await waitFor(() => expect(qc.getQueryData<StoreSettings>(qk.storeSettings)).toMatchObject({
      revision: 5, taxItems: [{ name: '부가세', rate: 9.09 }],
    }));
  });

  it('0% 항목도 유효한 설정으로 보존해 서버에 보낸다', async () => {
    rpc.mockResolvedValue({ data: { changed: true, recipes: 0, revision: 5 }, error: null } as never);
    const { result } = renderHook(() => useSaveStoreTax(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ items: [{ name: ' 영세 항목 ', rate: 0 }], baseRevision: 4 });
    });

    expect(rpc).toHaveBeenCalledWith('save_store_tax', expect.objectContaining({
      p_items: [{ name: '영세 항목', rate: 0 }],
      p_base_revision: 4,
    }));
    await waitFor(() => expect(qc.getQueryData<StoreSettings>(qk.storeSettings)).toMatchObject({
      revision: 5, taxItems: [{ name: '영세 항목', rate: 0 }],
    }));
  });
});
