import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientListScreen } from '@/features/ingredients/screens/IngredientListScreen';
import { UnitPickerSheet } from '@/features/ingredients/components/UnitPickerSheet';
import { StockRevertAction } from '@/features/ingredients/components/StockRevertAction';
import type { IngredientRow } from '@/features/ingredients/hooks';

const fixture = vi.hoisted(() => ({ rows: [] as IngredientRow[], rpc: vi.fn() }));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientList: () => ({
  data: fixture.rows, isLoading: false, error: null, refetch: vi.fn(),
}) }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { categories: [] } }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: fixture.rpc } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null };
});

const clients: QueryClient[] = [];
const row = (name: string, baseUnit: IngredientRow['baseUnit'], stockTotal: number, basePrice: number | null, safetyStock = 0): IngredientRow => ({
  id: name, name, baseUnit, stockTotal, basePrice, safetyStock, perVolume: 1000,
  categoryName: null, vendorName: null, memo: null, soonOut: false, lastInboundAt: null,
});
const order = () => screen.getAllByRole('button', { name: / 상세$/ }).map(b => b.getAttribute('aria-label')!.replace(/ 상세$/, ''));
const openSort = () => fireEvent.click(screen.getByRole('button', { name: /^정렬 기준:/ }));
const selectSort = (name: string) => { openSort(); fireEvent.click(screen.getByRole('button', { name })); };
function openRevert(action: '입고' | '차감' | '폐기') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><StockRevertAction eventId="fixture-event" ingredientId="fixture-ingredient" action={action} quantity="100g" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: `${action} 취소` }));
}

// Normal regression contracts only. Deferred U1/U2 diagnostics are stored under .codex/ingredient-44-study.
// RPC is never invoked here; cancellation is opened, not confirmed. No DB/native validation.
describe('식재료 정상 계약과 U4 취소 안내', () => {
  beforeEach(() => { fixture.rows = []; fixture.rpc.mockReset(); });
  afterEach(() => { clients.splice(0).forEach(c => c.clear()); expect(fixture.rpc).not.toHaveBeenCalled(); });

  it('같은 g 단위는 음수를 포함한 재고 오름차순, 단가 내림차순과 null 후순위를 유지한다', () => {
    fixture.rows = [row('많은재고', 'g', 1000, 4), row('단가없음', 'g', 500, null), row('음수재고', 'g', -750, 8)];
    render(<IngredientListScreen />); selectSort('잔여 적은 순');
    expect(order()).toEqual(['음수재고', '단가없음', '많은재고']);
    expect(within(screen.getByRole('button', { name: '음수재고 상세' })).getByText(/−750g/)).toBeTruthy();
    selectSort('단가 높은 순'); expect(order()).toEqual(['음수재고', '많은재고', '단가없음']);
  });

  it('ea는 사용자에게 개로 표시하고 무게·부피 차원을 개수 선택창에 섞지 않는다', () => {
    render(<UnitPickerSheet visible unit="개" base="개" onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: '개, 현재 선택됨' })).toBeTruthy();
    for (const unit of ['ea', 'g', 'kg', 'ml', 'L']) expect(screen.queryByRole('button', { name: unit })).toBeNull();
  });

  for (const action of ['차감', '폐기'] as const) {
    it(`U4: ${action} 취소의 실제 영향만 안내한다`, () => {
      openRevert(action);
      expect(screen.getByText(action === '차감' ? '차감한 수량이 재고로 돌아옵니다.' : '폐기한 수량이 재고로 돌아오고, 해당 폐기 손실이 취소됩니다.')).toBeTruthy();
      expect(screen.queryByText('재고와 기준 단가가 다시 계산됩니다.')).toBeNull();
    });
  }
});
