import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { CardFooterAction } from '@/components/kit/CardFooterAction';
import { COMPONENT, minTouchTarget } from '@/theme/tokens';

it('카드 하단 행동은 접기·펼치기·자세히 보기 공통 크기를 유지한다', () => {
  render(<CardFooterAction onPress={() => undefined}>자세히 보기</CardFooterAction>);

  const button = screen.getByRole('button', { name: '자세히 보기' });
  const label = screen.getByText('자세히 보기');

  expect(COMPONENT.cardFooter.minHeight).toBe(minTouchTarget);
  expect(button.style.minHeight).toBe(`${COMPONENT.cardFooter.minHeight}px`);
  expect(label.style.fontSize).toBe(`${COMPONENT.cardFooter.fontSize}px`);
  expect(label.style.fontWeight).toBe('700');
});

it('비활성 카드 하단 행동은 누름을 막고 접근성 상태를 알린다', () => {
  const onPress = vi.fn();
  render(<CardFooterAction onPress={onPress} disabled>채널 추가</CardFooterAction>);

  const button = screen.getByRole('button', { name: '채널 추가' });
  expect(button.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(button);
  expect(onPress).not.toHaveBeenCalled();
});
