import { describe, expect, it, vi } from 'vitest';
import { menuSystemError, menuSystemTitle, profitSystemLabel, profitSystemSummary } from '@/lib/productTerms';
import { parseChangeEvent } from '@/features/changes/hooks';
import { RpcError } from '@/lib/supabase';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useProfitHistory } from '@/features/recipes/profitHistory';
import { useSaveFixedCosts } from '@/features/my/hooks';

const transport = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: transport.rpc }) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@/lib/supabase', async original => await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-a' }));

describe('메뉴 표시 용어와 사용자 데이터 경계', () => {
  it('재료 시스템 오류만 바꾸고 사용자 이름과 메모는 그대로 둔다', () => {
    const error = new RpcError('재료 입력을 확인해 주세요', '22023', 'INPUT_INVALID');
    expect(error).toMatchObject({ message: '재료 입력을 확인해 주세요', code: '22023', detail: 'INPUT_INVALID' });
    for (const value of ['엄마 재료 메모', '재료비', '부자재', '재료']) {
      expect(menuSystemError(value)).toBe(value);
    }
  });
  it('일반 Error를 사용하는 고정 지출 저장에서도 전파 오류의 표시 명칭을 맞춘다', async () => {
    const message = '손익 스냅샷이 불완전합니다 (레시피 22222222-2222-4222-8222-222222222222)';
    const error = { message, code: '45003' };
    transport.rpc.mockResolvedValueOnce({ data: null, error });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const hook = renderHook(() => useSaveFixedCosts(), { wrapper });
    try {
      await act(async () => {
        await expect(hook.result.current.mutateAsync({ month: '2026-09', totalRevenue: 100, items: [] }))
          .rejects.toThrow('손익 스냅샷이 불완전합니다 (메뉴 22222222-2222-4222-8222-222222222222)');
      });
      expect(error.message).toBe(message);
    } finally {
      hook.unmount();
      client.clear();
    }
  });

  it('이력 제목과 제목 대체 요약만 바꾸고 사용자 값과 입력 원장을 보존한다', () => {
    const raw = {
      title: '레시피 수정', source_name: '엄마 레시피',
      changes: [{ key: 'memo', label: '메모', before: '레시피 등록', after: '새 레시피 메모' }],
    };
    const original = JSON.stringify(raw);
    expect(parseChangeEvent(raw)).toMatchObject({
      title: '메뉴 수정', summary: '메뉴 수정', sourceName: '엄마 레시피',
      changes: [{ before: '레시피 등록', after: '새 레시피 메모' }],
    });
    expect(parseChangeEvent({ ...raw, summary: '엄마 레시피 메모 변경' }).summary).toBe('엄마 레시피 메모 변경');
    expect(JSON.stringify(raw)).toBe(original);
  });

  it('오류의 시스템 안내만 바꾸고 메뉴명·코드·상세는 보존한다', () => {
    const error = new RpcError('엄마 레시피은(는) 판매 중지된 메뉴예요. 레시피에서 판매를 다시 켜 주세요', '45001', 'RECIPE_STOPPED');
    expect(error).toMatchObject({
      message: '엄마 레시피은(는) 판매 중지된 메뉴예요. 메뉴에서 판매를 다시 켜 주세요',
      code: '45001', detail: 'RECIPE_STOPPED',
    });
  });

  it.each(['레시피 등록 메모', '우리 레시피', 'toString', '__proto__', 'constructor', ''])('알 수 없는 문구는 그대로 둔다: %s', value => {
    expect(menuSystemTitle(value)).toBe(value);
    expect(menuSystemError(value)).toBe(value);
  });
});


describe('손익·수정 내역의 서버 표시 라벨', () => {
  it('의미 키가 맞는 시스템 라벨만 번역한다', () => {
    expect(profitSystemLabel('material_cost', '재료비')).toBe('재료 원가');
    expect(profitSystemSummary('material_cost', '재료비 2,806.40원 감소')).toBe('재료 원가 2,806.40원 감소');
    expect(profitSystemSummary('fixed_cost', '고정지출 36원 증가')).toBe('고정 지출 36원 증가');
    expect(profitSystemSummary('price', '재료비 32원 감소')).toBe('재료비 32원 감소');
    expect(profitSystemSummary('material_cost', '재료비 관련 사용자 메모')).toBe('재료비 관련 사용자 메모');
    expect(profitSystemLabel('memo', '고정지출')).toBe('고정지출');
  });
  it('시스템 요약만 바꾸며 원장·사용자 이름·전후 값을 보존한다', () => {
    const raw = { title: '고정지출 반영', source_type: 'fixed_cost', source_name: '고정지출',
      summary: '2026-09 고정지출 항목·금액 변경',
      changes: [{ key: 'fixed_items', label: '고정지출 항목', before: '내 고정지출 이름', after: '새 고정지출 이름' }] };
    const original = JSON.stringify(raw);
    expect(parseChangeEvent(raw)).toMatchObject({ title: '고정 지출 반영', sourceName: '고정지출',
      summary: '2026-09 고정 지출 항목·금액 변경',
      changes: [{ label: '고정 지출 항목', before: '내 고정지출 이름', after: '새 고정지출 이름' }] });
    expect(parseChangeEvent({ ...raw, source_type: 'direct' }).summary).toBe(raw.summary);
    expect(JSON.stringify(raw)).toBe(original);
  });
});


describe('실제 손익 내역 RPC 표시 경계', () => {
  it('서버의 옛 시스템 문구를 표시할 때만 바꾸고 금액과 원문은 보존한다', async () => {
    const raw = { id: 'event-a', occurred_at: '2026-09-13T00:00:00Z',
      title: '고정지출 반영', summary: '고정지출 36원 증가', source_label: '고정지출 설정',
      cause_key: 'fixed_cost', cause_label: '고정지출', cause_before: 100, cause_after: 136,
      profit_before: 400, profit_after: 364, profit_delta: -36, rate_before: 40, rate_after: 36.4 };
    const original = JSON.stringify(raw);
    transport.rpc.mockResolvedValueOnce({ data: { rows: [raw], next: null }, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const hook = renderHook(() => useProfitHistory('recipe-a'), { wrapper });
    try {
      await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
      expect(hook.result.current.data?.pages[0]?.items[0]).toMatchObject({
        title: '고정 지출 반영', summary: '고정 지출 36원 증가', sourceLabel: '고정 지출 설정',
        cause: { label: '고정 지출', before: 100, after: 136 },
        profitBefore: 400, profitAfter: 364, profitDelta: -36, rateAfter: 36.4,
      });
      expect(JSON.stringify(raw)).toBe(original);
    } finally {
      hook.unmount();
      client.clear();
    }
  });
});
