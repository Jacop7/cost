import { fireEvent, render, screen } from '@testing-library/react';
import { StyleSheet } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { rowMinHeight } from '@/theme/tokens';

describe('공용 선택 행의 native 경계 간격', () => {
  it('인접 행은 한 물리 픽셀의 간격을 두고 마지막 행은 추가 간격 없이 끝난다', () => {
    const onPress = vi.fn();
    render(<>
      <SelectionRow label="최신순" accessibilityLabel="최신순" selected onPress={onPress} />
      <SelectionRow label="오래된순" accessibilityLabel="오래된순" selected={false} last onPress={onPress} />
    </>);
    const first = screen.getByRole('button', { name: '최신순' });
    const last = screen.getByRole('button', { name: '오래된순' });
    expect(Number.parseFloat(getComputedStyle(first).marginBottom)).toBe(StyleSheet.hairlineWidth);
    expect(Number.parseFloat(getComputedStyle(last).marginBottom)).toBe(0);
    expect(Number.parseFloat(getComputedStyle(first).minHeight)).toBe(rowMinHeight.oneLine);
    expect(first.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(last);
    expect(onPress).toHaveBeenCalledOnce();
  });
});
