import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SortSheet } from '@/components/kit/SortSheet';
import { rowMinHeight } from '@/theme/tokens';

it('공통 정렬은 설명 없이 이름과 선택 상태만 표시하고 선택/닫기를 유지한다', () => {
  // 옛 호출자가 hint를 전달해도 공통 UI에 다시 노출하지 않는다.
  const options = [
    { key: 'recommended', label: '추천순', hint: '소진 → 소진 임박 → 여유' },
    { key: 'name', label: '이름순', hint: '가나다순' },
  ];
  const select = vi.fn(), close = vi.fn();
  render(<SortSheet visible options={options} value="recommended" onSelect={select} onClose={close} />);
  expect(screen.queryByText('소진 → 소진 임박 → 여유')).toBeNull();
  expect(screen.queryByText('가나다순')).toBeNull();
  expect(screen.getByRole('button', { name: '추천순' }).querySelector('svg')).not.toBeNull();
  expect(screen.getByRole('button', { name: '이름순' }).querySelector('svg')).toBeNull();
  expect(getComputedStyle(screen.getByRole('button', { name: '이름순' })).minHeight).toBe(`${rowMinHeight.oneLine}px`);
  fireEvent.click(screen.getByRole('button', { name: '이름순' }));
  expect(select).toHaveBeenCalledWith('name');
  expect(close).toHaveBeenCalledTimes(1);
});
