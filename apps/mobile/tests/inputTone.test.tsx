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

  it('숫자 키패드 입력은 쉼표로 표시하고 상태에는 쉼표 없는 값을 전달한다', () => {
    const onChangeText = vi.fn();
    render(<Input value="20000" onChangeText={onChangeText} keyboardType="number-pad" accessibilityLabel="금액" />);

    const input = screen.getByLabelText('금액') as HTMLInputElement;
    expect(input.value).toBe('20,000');
    fireEvent.change(input, { target: { value: '30,000' } });
    expect(onChangeText).toHaveBeenCalledWith('30000');
  });

  it('통화 입력은 포커스가 없을 때 통화 소수 자릿수를 채운다', () => {
    render(<Input value="20000" onChangeText={() => undefined} keyboardType="decimal-pad"
      numberFormat={{ fixedDigits: 2 }} accessibilityLabel="달러 금액" />);
    expect((screen.getByLabelText('달러 금액') as HTMLInputElement).value).toBe('20,000.00');
  });
});
