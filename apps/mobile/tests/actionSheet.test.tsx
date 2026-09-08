import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActionSheet } from '@/components/kit';
import { COMPONENT } from '@/theme/tokens';

describe('ActionSheet 공용 계약', () => {
  it('배경 닫기와 항목 버튼을 형제로 두고 기존 Expo 시각값을 유지한다', () => {
    const onClose = vi.fn();
    const onEdit = vi.fn();
    render(
      <ActionSheet
        visible
        onClose={onClose}
        items={[{ label: '수정', onPress: onEdit }, { label: '삭제', danger: true, onPress: vi.fn() }]}
      />,
    );

    const edit = screen.getByRole('button', { name: '수정' });
    expect(edit.style.paddingTop).toBe(`${COMPONENT.actionSheet.rowPaddingVertical}px`);
    expect(screen.getByText('수정').style.fontWeight).toBe(COMPONENT.actionSheet.textWeight);
    expect(document.querySelector('button button')).toBeNull();

    fireEvent.click(edit);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
