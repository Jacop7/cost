import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STOCK_STATE_LABEL, stockStateOf, type StockState } from '@sikjae/core';
import { STATUS } from '../src/theme/tokens';

const mobileRoot = resolve('.').endsWith('apps\\mobile') || resolve('.').endsWith('apps/mobile')
  ? resolve('.')
  : join(resolve('.'), 'apps/mobile');

describe('P2-3 재고 상태 공개 계약', () => {
  it('kit 키·라벨은 core의 여유/소진 임박/소진 세 단계와 같다', () => {
    const states: StockState[] = ['ok', 'low', 'out'];
    expect(Object.keys(STATUS).sort()).toEqual([...states].sort());
    for (const state of states) expect(STATUS[state].label).toBe(STOCK_STATE_LABEL[state].label);
  });

  it('판정 경계는 core 하나가 소진·소진 임박·여유를 만든다', () => {
    expect(stockStateOf({ stockTotal: 0, safetyStock: 5, soonOut: false })).toBe('out');
    expect(stockStateOf({ stockTotal: 5, safetyStock: 5, soonOut: false })).toBe('low');
    expect(stockStateOf({ stockTotal: 6, safetyStock: 5, soonOut: false })).toBe('ok');
  });

  it('재고 표시 화면은 판정식을 복사하지 않고 stockStateOf 결과만 쓴다', () => {
    const paths = [
      'src/features/ingredients/components/IngCard.tsx',
      'src/features/ingredients/screens/IngredientDetailScreen.tsx',
      'src/features/ingredients/screens/IngredientListScreen.tsx',
    ];
    const sources = paths.map((path) => [path, readFileSync(join(mobileRoot, path), 'utf8')] as const);
    for (const [path, source] of sources) {
      expect(source, `${path}: core 판정 호출`).toContain('stockStateOf(');
      expect(source, `${path}: 0 이하 판정 복사`).not.toMatch(/stockTotal\s*<=\s*0/);
      expect(source, `${path}: 안전재고 판정 복사`).not.toMatch(/stockTotal\s*<=?\s*[^\n;]*safetyStock/);
    }
  });
});
