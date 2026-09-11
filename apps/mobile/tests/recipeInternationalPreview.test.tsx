vi.mock('@/features/recipes/draftPreviewQuery', () => ({ useRecipeDraftPreview: mock.preview, useRecipeRecommendation: () => ({ data: undefined, isFetching: false, error: null, refetch: vi.fn() }) }));
import { useEffect, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeAddScreen from '@/features/recipes/screens/RecipeAddScreen';
import { emptyDraft, useRecipeDraft } from '@/features/recipes/draftStore';
import type { RecipeDetail } from '@/features/recipes/hooks';
import type { RecipeIntent } from '@/features/recipes/intentStorage';
import { draftPreviewInput } from '@/features/recipes/draftPreviewInput';
import { parseDraftPreview } from '@/features/recipes/draftPreviewContract';
import { previewRaw, previewInput, actor, store } from './fixtures/recipeDraftPreview';
import { freezeRecipeValue } from '@/features/recipes/writeContract';

const mock = vi.hoisted(() => ({
  detail: vi.fn(), save: vi.fn(), capabilities: vi.fn(), refetch: vi.fn(), preview: vi.fn(),
  routeId: undefined as string | undefined, pendingIntent: null as RecipeIntent | null,
}));
vi.mock('react-native', async original => ({ ...await original<typeof import('react-native')>(),
  Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <div>{children}</div> : null,
}));
vi.mock('expo-router', () => ({
  useFocusEffect: (fn: () => void | (() => void)) => useEffect(fn, [fn]),
  useLocalSearchParams: () => ({ id: mock.routeId }), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  router: { canGoBack: () => false, replace: vi.fn() },
}));
vi.mock('@/lib/SessionProvider', () => ({
  useSessionState: () => ({ userId: 'preview-actor' }), useStoreId: () => 'preview-store',
}));
vi.mock('@/features/recipes/hooks', () => ({
  useRecipeDetail: mock.detail,
  useSaveRecipe: () => ({ mutate: mock.save, isPending: false, intentReady: true, pendingIntent: mock.pendingIntent }),
}));
vi.mock('@/features/master-data/hooks', () => ({
  useSettingsLists: () => ({ data: { recipeCategories: [{ id: 'category', name: '한식' }] }, isLoading: false, error: null }),
}));
vi.mock('@/features/settings/hooks', () => ({
  useStoreSettings: () => ({ data: { taxItems: [{ name: '기존 세금', rate: 10 }] }, isLoading: false, error: null }),
}));
vi.mock('@/features/international-tax', () => ({ useAppCapabilities: mock.capabilities }));

const scope = { actorId: 'preview-actor', storeId: 'preview-store' };
const detail: RecipeDetail = {
  id: '00000000-0000-4000-8000-000000000001', editRevision: '1', name: '미리보기 메뉴', price: 1000, active: true,
  sales30d: { qty: 0, revenue: 0, waste: 0 }, memo: '입력 메모',
  lastChange: { occurredAt: '2026-09-10T01:00:00Z', eventId: null, displayState: null, hasHistory: false },
  taxMode: 'included', taxItems: [], taxBreakdown: [], tax: 0, baseServings: 1,
  targetProfitRate: 30, avgMonthlySales: null, materialCost: 0, extraCost: 950,
  fixedRate: 0, fixedMonth: '2026-09', fixedItems: [], categoryId: 'category', lines: [],
  extras: [{ id: 'extra', materialId: 'material', name: '용기', amount: 950, qty: 1 }],
};
const state = (data: unknown, isLoading = false, error: Error | null = null) => ({ data, isLoading, error, refetch: mock.refetch });
const capability = (readEnabled: boolean) => ({ internationalTax: { readEnabled } });

function prepare(mode: 'create' | 'edit') {
  mock.routeId = mode === 'edit' ? detail.id : undefined;
  mock.detail.mockReturnValue(state(mode === 'edit' ? detail : undefined));
  useRecipeDraft.getState().reset({ ...emptyDraft(), scopeKey: JSON.stringify(scope),
    name: detail.name, categoryId: 'category', categoryName: '한식', price: '1000', memo: detail.memo ?? '',
    baseServings: '1', targetProfitRate: '30',
    extras: [{ materialId: 'material', name: '용기', unitCost: 950, amountPerServing: 950, qty: 1 }],
  });
}
function expectBlocked() {
  expect(screen.queryByText('순이익')).toBeNull();
  expect(screen.queryByText('목표 미달')).toBeNull();
  expect(screen.queryByText('목표 달성')).toBeNull();
  expect(screen.queryByText('100원')).toBeNull();
  expect(screen.queryByText('권장 판매가')).toBeNull();
  expect(screen.queryByRole('button', { name: '권장 판매가 적용' })).toBeNull();
  expect(screen.getByRole('textbox', { name: '판매가' })).toHaveProperty('value', '1000');
}

// Real form, draft store, editor recovery and kit controls; only domain reads,
// write transport and navigation are mocked. No DB/formula authority claim.
describe.each(['create', 'edit'] as const)('F4-5 %s 손익 미리보기 capability 경계', mode => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.pendingIntent = null; mock.preview.mockReturnValue({ data: undefined, isFetching: false, error: null, refetch: vi.fn() });
    mock.capabilities.mockReturnValue(state(capability(false))); prepare(mode);
  });
  afterEach(() => { cleanup(); useRecipeDraft.getState().reset(emptyDraft()); });

  it.each([
    ['active', () => state(capability(true))],
    ['pending', () => state(undefined, true)],
    ['error', () => state(undefined, false, new Error('조회 실패'))],
    ['missing', () => state(undefined)],
    ['cached false with error', () => state(capability(false), false, new Error('재조회 실패'))],
  ] as const)('%s에서는 기존 세금·목표·권장가를 숨기고 초안과 저장 입력을 보존한다', (_name, response) => {
    mock.capabilities.mockReturnValue(response());
    render(<RecipeAddScreen />);
    const before = structuredClone(useRecipeDraft.getState().draft);
    expectBlocked();
    expect(useRecipeDraft.getState().draft).toEqual(before);
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: mode === 'edit' ? '저장' : '레시피 추가' }));
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(mock.save.mock.calls[0]![0]).toMatchObject({ price: 1000, name: detail.name, baseServings: 1, targetProfitRate: 30 });
    expect(useRecipeDraft.getState().draft).toEqual(before);
  });

  it('현재 초안을 서버 견적에 전달하고 권장가 적용은 초안 가격만 바꾼다', () => {
    mock.capabilities.mockReturnValue(state(capability(true)));
    const current = useRecipeDraft.getState().draft;
    useRecipeDraft.getState().reset({ ...current, id: mode === 'edit' ? detail.id : undefined, loaded: true, price: '12.34', baseServings: '2', lines: [], extras: [] });
    const input = { ...previewInput(), recipe_id: mode === 'edit' ? detail.id : null, lines: [], extras: [] };
    mock.preview.mockReturnValue({ data: parseDraftPreview(previewRaw(input), actor, store, input), isFetching: false, error: null, refetch: vi.fn() });
    render(<RecipeAddScreen />);
    expect(mock.preview).toHaveBeenLastCalledWith(draftPreviewInput(useRecipeDraft.getState().draft));
    expect(screen.getByText('$7.87')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '권장 판매가 적용' }));
    expect(useRecipeDraft.getState().draft.price).toBe('4');
    expect(useRecipeDraft.getState().draft.name).toBe(current.name);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('성공한 명시적 false에서는 기존 미리보기와 권장가 적용을 유지한다', () => {
    render(<RecipeAddScreen />);
    expect(screen.getByText('100원')).toBeTruthy();
    expect(screen.getByText('목표 미달')).toBeTruthy();
    expect(useRecipeDraft.getState().draft.price).toBe('1000');
    fireEvent.click(screen.getByRole('button', { name: '권장 판매가 적용' }));
    expect(useRecipeDraft.getState().draft.price).toBe('1600');
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('false→true 전환 즉시 미리보기·적용 버튼을 숨기고 작성 중 초안을 유지한다', () => {
    const view = render(<RecipeAddScreen />);
    expect(screen.getByRole('button', { name: '권장 판매가 적용' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '메뉴명' }), { target: { value: '계속 작성 중' } });
    const before = structuredClone(useRecipeDraft.getState().draft);
    mock.capabilities.mockReturnValue(state(capability(true)));
    view.rerender(<RecipeAddScreen />);
    expectBlocked(); expect(useRecipeDraft.getState().draft).toEqual(before);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it.each(['error', 'missing'] as const)('%s 재시도는 capability만 재조회하고 초안을 보존한다', status => {
    mock.capabilities.mockReturnValue(state(undefined, false, status === 'error' ? new Error('조회 실패') : null));
    render(<RecipeAddScreen />);
    const before = structuredClone(useRecipeDraft.getState().draft);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mock.refetch).toHaveBeenCalledTimes(1);
    expect(useRecipeDraft.getState().draft).toEqual(before);
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('국제 세금 활성 상태에도 F2 이전 요청 확인은 원래 request ID와 payload를 보존한다', () => {
    const payload = freezeRecipeValue({ request_id: '00000000-0000-4000-8000-000000000011',
      patch: 'full', id: detail.id, expected_revision: '1', name: '이전 요청', price: 777,
      base_servings: 1, target_profit_rate: 30, lines: [], extras: [] });
    mock.pendingIntent = { version: 1, scope, payload };
    mock.capabilities.mockReturnValue(state(capability(true)));
    render(<RecipeAddScreen />);
    const before = structuredClone(useRecipeDraft.getState().draft);
    const original = structuredClone(payload);
    expectBlocked();
    fireEvent.click(screen.getByRole('button', { name: '이전 저장 결과 확인' }));
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(mock.save.mock.calls[0]![0]).toEqual({ resumeRequestId: payload.request_id });
    expect(mock.pendingIntent.payload).toEqual(original);
    expect(useRecipeDraft.getState().draft).toEqual(before);
  });
});
