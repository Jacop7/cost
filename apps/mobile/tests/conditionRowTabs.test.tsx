import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConditionRow, FilterButton } from '@/components/history/HistoryLayout';
import { ScrollTabs } from '@/components/kit';
import { COLOR } from '@/theme/tokens';

describe('큰 글자 조건 행과 공용 탭', () => {
  it('조건 그룹과 오른쪽 건수 슬롯을 분리하고 두 그룹 모두 줄바꿈 공간을 허용한다', () => {
    const onPress = vi.fn();
    render(<ConditionRow right={<span>총 3건</span>}>
      <FilterButton label="전체" onPress={onPress} />
      <FilterButton label="최근 3개월" onPress={onPress} />
      <FilterButton label="최신순" onPress={onPress} />
    </ConditionRow>);
    const chip = screen.getByRole('button', { name: '최신순 변경' });
    const group = chip.parentElement!;
    const row = group.parentElement!;
    expect(getComputedStyle(group).flexWrap).toBe('wrap');
    expect(getComputedStyle(row).flexWrap).toBe('wrap');
    expect(group.contains(screen.getByText('총 3건'))).toBe(false);
    fireEvent.click(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('스크롤 탭은 선택 의미와 폐기 역할 색을 보존하고 정확한 인덱스를 전달한다', () => {
    const onChange = vi.fn();
    render(<ScrollTabs tabs={['수량 조정', '완전 소진', '폐기']} active={2}
      activeColors={[undefined, undefined, COLOR.status.negative]} onChange={onChange} />);
    const waste = screen.getByRole('tab', { name: '폐기' });
    expect(waste.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('폐기').style.fontWeight).toBe('700');
    fireEvent.click(screen.getByRole('tab', { name: '완전 소진' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
