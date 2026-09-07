import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HubHeader, HubHeaderAction } from '@/components/kit';
import { COMPONENT, TYPE } from '@/theme/tokens';

describe('HubHeader 공용 계약', () => {
  it('메인 제목을 TYPE.display와 공용 여백으로 그린다', () => {
    render(<HubHeader testID="ING-01/header" title="식재료" />);

    const root = screen.getByTestId('ING-01/header');
    const title = screen.getByText('식재료');
    expect(root.style.backgroundColor).toBe('rgb(242, 244, 246)');
    expect(title.style.fontSize).toBe(`${TYPE.display.fontSize}px`);
    expect(title.style.lineHeight).toBe(`${TYPE.display.lineHeight}px`);
    expect(title.getAttribute('aria-label')).toBeNull();
  });

  it('부제 헤더는 72dp 최소 높이와 줄바꿈 가능한 글자를 유지한다', () => {
    render(<HubHeader testID="MY-01/header" title="마이페이지" subtitle="기준값과 기본 설정을 관리해요" />);

    expect(screen.getByTestId('MY-01/header').style.minHeight).toBe(`${COMPONENT.hubHeader.subtitleMinHeight}px`);
    expect(screen.getByText('기준값과 기본 설정을 관리해요').getAttribute('aria-label')).toBeNull();
  });

  it('아이콘 행동은 이름과 선택 상태를 보존한다', () => {
    const onPress = vi.fn();
    render(<HubHeaderAction label="검색" icon="search" selected onPress={onPress} />);

    const button = screen.getByRole('button', { name: '검색' });
    expect(button.getAttribute('aria-label')).toBe('검색');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('일반 행동에는 거짓 selected=false 상태를 붙이지 않는다', () => {
    render(<HubHeaderAction label="매출 분석" icon="calendar" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: '매출 분석' }).getAttribute('aria-label')).toBe('매출 분석');
  });
});
