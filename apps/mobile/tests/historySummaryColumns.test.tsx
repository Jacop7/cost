import { createElement } from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutChangeEvent } from 'react-native';
import { SummaryCard } from '@/components/history/HistoryLayout';
import { space } from '@/theme/tokens';

const mock = vi.hoisted(() => ({ layout: undefined as undefined | ((event: LayoutChangeEvent) => void) }));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, View: (props: React.ComponentProps<typeof rn.View>) => {
    if (props.onLayout) mock.layout = props.onLayout;
    return createElement(rn.View, props);
  } };
});
// Test the native/web onLayout contract, not jsdom's nonexistent layout engine.
describe('요약 열 너비의 실측 파생', () => {
  beforeEach(() => { mock.layout = undefined; });
  it('같은 실측 폭을 모든 pair에 적용하고 회전/리사이즈를 반영한다', () => {
    render(<SummaryCard label="현재" value="4.6kg" metrics={[
      { label: '입고', value: '+2kg' }, { label: '판매 소진', value: '0g' },
      { label: '폐기', value: '−987654.3kg' }, { label: '조정', value: '1kg' },
    ]} />);
    expect(mock.layout).toBeTypeOf('function');
    const widths = () => ['입고', '판매 소진', '폐기', '조정'].map((label) =>
      getComputedStyle(screen.getByText(label).parentElement!).minWidth);
    for (const width of [358, 288, 358]) {
      act(() => mock.layout!({ nativeEvent: { layout: { width, height: 100, x: 0, y: 0 } } } as LayoutChangeEvent));
      expect(widths()).toEqual(Array(4).fill(`${(width - space.md * 3) / 2}px`));
    }
    const previous = widths();
    for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      act(() => mock.layout!({ nativeEvent: { layout: { width, height: 100, x: 0, y: 0 } } } as LayoutChangeEvent));
      expect(widths()).toEqual(previous);
    }
  });
});
