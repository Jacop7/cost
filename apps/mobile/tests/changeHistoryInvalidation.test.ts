import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';

describe('수정 내역 갱신 연결', () => {
  it('구매 링크 저장/삭제는 상세와 수정 목록을 함께 갱신한다', () => {
    const qc = new QueryClient();
    const detail = qk.ingredient('ingredient-a');
    const history = [...qk.changeHistory('ingredient', 'ingredient-a'), 7];
    const recipe = [...qk.changeHistory('recipe', 'recipe-a'), 7];
    [detail, history, recipe].forEach(key => qc.setQueryData(key, {}));
    invalidate(qc, invalidateOn.purchaseOptionSaved('ingredient-a'));
    expect(qc.getQueryState(detail)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(history)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(recipe)?.isInvalidated).toBe(false);
  });
  it('고정지출/영업일 변경은 관련 수정내역과 상태 배지 재조회', () => {
    const qc = new QueryClient();
    const ingredient = [...qk.changeHistory('ingredient', 'i'), 7];
    const recipe = [...qk.changeHistory('recipe', 'r'), 7];
    [ingredient, recipe].forEach(key => qc.setQueryData(key, {}));
    invalidate(qc, invalidateOn.e4());
    expect(qc.getQueryState(recipe)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(ingredient)?.isInvalidated).toBe(false);
    invalidate(qc, invalidateOn.businessDay());
    expect(qc.getQueryState(ingredient)?.isInvalidated).toBe(true);
  });
});
