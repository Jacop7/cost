import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RecipeCurrentProfit, RecipeInternationalComposition } from '@/features/recipes/RecipeInternationalComposition';
import { parseDraftPreview } from '@/features/recipes/draftPreviewContract';
import type { useRecipeRecommendation } from '@/features/recipes/draftPreviewQuery';
import { actor, store, recipe, previewInput, previewRaw } from './fixtures/recipeDraftPreview';

function query() {
  return { data: parseDraftPreview(previewRaw({ ...previewInput(), recipe_id: recipe }), actor, store, undefined, recipe),
    isFetching: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useRecipeRecommendation>;
}
it('국제 손익도 상세 공통 행을 사용하고 인분 선택의 서버 금액을 표시한다', () => {
  const source = query();
  const change = vi.fn();
  const view = render(<RecipeCurrentProfit query={source} comparison="one" onComparisonChange={change} />);
  const profitRow = () => within(screen.getByText('순이익').parentElement!.parentElement!);
  expect(profitRow().getByText('$7.87')).toBeTruthy();
  expect(screen.getByText('(−) 식재료 원가')).toBeTruthy();
  expect(screen.queryByText('고객 결제액')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: '2인분' }));
  expect(change).toHaveBeenCalledWith('batch');
  view.rerender(<RecipeCurrentProfit query={source} comparison="batch" onComparisonChange={change} />);
  expect(profitRow().getByText('$15.74')).toBeTruthy();
});
it('도넛 요약에서 결제액과 순매출을 중복 행으로 늘리지 않는다', () => {
  render(<RecipeInternationalComposition query={query()} comparison="one" />);
  expect(screen.getByText('소계')).toBeTruthy();
  expect(screen.queryByText('세전 순매출')).toBeNull();
  expect(screen.queryByText('고객 결제액')).toBeNull();
});
it('서버 금액이 없는 응답은 확정된 손익처럼 표시하지 않는다', () => {
  const source = { data: undefined, isFetching: false, error: new Error('조회 실패'), refetch: vi.fn() } as unknown as ReturnType<typeof useRecipeRecommendation>;
  render(<RecipeCurrentProfit query={source} comparison="one" onComparisonChange={vi.fn()} />);
  expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
  expect(screen.queryByText('순이익')).toBeNull();
});
