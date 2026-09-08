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

  for (const count of [1, 2, 3, 4]) {
    it(`${count}개 metric은 순서·0·부호를 보존하고 역할 칸 단위로 줄바꿈한다`, () => {
      const metrics = [
        { label: '입고', value: '+2kg' },
        { label: '판매 소진', value: '0g' },
        { label: '폐기', value: '−987654.3kg' },
        { label: '기간 최고', value: '12,345,678.90원/g' },
      ].slice(0, count);
      render(<SummaryCard label="측정" value="4.6kg" metrics={metrics} />);
      for (const metric of metrics) {
        const value = screen.getByText(metric.value), label = screen.getByText(metric.label);
        const cell = value.parentElement!;
        expect(label.parentElement).toBe(cell);
        expect(getComputedStyle(cell).maxWidth).toBe('100%');
        expect(getComputedStyle(cell.parentElement!).flexWrap).toBe('wrap');
        expect(getComputedStyle(value).whiteSpace).not.toBe('nowrap');
        expect(getComputedStyle(label).whiteSpace).not.toBe('nowrap');
      }
      const container = screen.getByText(metrics[0]!.value).parentElement!.parentElement!.parentElement!;
      expect(container.children.length).toBe(Math.ceil(count / 2));
      const text = container.textContent!;
      expect(metrics.map((m) => text.indexOf(m.label))).toEqual(metrics.map((m) => text.indexOf(m.label)).sort((a, b) => a - b));
    });
  }
});
