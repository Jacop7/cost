import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCard } from '@/components/history/HistoryLayout';

// Structural guard. Actual line placement/font enlargement belongs to browser evidence.
describe('공용 이력 요약의 역할 그룹', () => {
  for (const sample of [
    { label: '현재 재고', value: '4.6kg' },
    { label: '기준단가', value: '4.00원/g', sub: '4,000원 지출' },
    { label: '전체 합계', value: '100g', sub: '400원' },
    { label: '긴 요약 제목', value: '123,456,789.00원/ml', sub: '아주 긴 보조 설명' },
  ]) {
    it(`${sample.label}: 값과 보조는 함께 래핑하고 표시 문자열을 보존한다`, () => {
      render(<SummaryCard {...sample} />);
      const label = screen.getByText(sample.label), value = screen.getByText(sample.value);
      const group = value.parentElement!;
      expect(getComputedStyle(label.parentElement!).flexWrap).toBe('wrap');
      expect(getComputedStyle(group).flexWrap).toBe('wrap');
      expect(getComputedStyle(group).justifyContent).toBe('flex-end');
      expect(getComputedStyle(group).maxWidth).toBe('100%');
      expect(getComputedStyle(value).maxWidth).toBe('100%');
      expect(getComputedStyle(label).maxWidth).toBe('100%');
      if (sample.sub) {
        const sub = screen.getByText(`· ${sample.sub}`);
        expect(sub.parentElement).toBe(group);
        expect(getComputedStyle(sub).maxWidth).toBe('100%');
      }
    });
  }
});
