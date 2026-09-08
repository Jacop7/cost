import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from '@/components/kit';
import { COMPONENT } from '@/theme/tokens';

describe('Input 의미 색 계약', () => {
  it('화면 전용 입력을 만들지 않고 공용 크기와 danger 역할을 함께 적용한다', () => {
    const onChangeText = vi.fn();
    render(
      <Input
        value="2"
        onChangeText={onChangeText}
        suffix="kg"
        tone="danger"
        accessibilityLabel="폐기 수량"
      />,
    );

    const input = screen.getByLabelText('폐기 수량') as HTMLInputElement;
    const shell = input.parentElement as HTMLElement;
    expect(shell.style.paddingTop).toBe(`${COMPONENT.input.paddingVertical}px`);
    expect(getComputedStyle(shell).borderTopWidth).toBe(`${COMPONENT.input.activeBorderWidth}px`);
    expect(screen.getByText('kg').style.fontWeight).toBe(COMPONENT.input.textWeight);

    fireEvent.change(input, { target: { value: '3' } });
    expect(onChangeText).toHaveBeenCalledWith('3');
  });
});
