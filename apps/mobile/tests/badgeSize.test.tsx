import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Badge, StatusBadge } from '@/components/kit';
import { COLOR, COMPONENT, STATUS } from '@/theme/tokens';

it('뱃지는 공통 여백과 옅은 배경을 사용하고 solid 호출도 진한 배경으로 돌아가지 않는다', () => {
  render(<><Badge sm tone="green">여유</Badge><Badge tone="red" solid>기본 뱃지</Badge></>);
  const small = screen.getByText('여유');
  expect(getComputedStyle(small.parentElement!).paddingTop).toBe(`${COMPONENT.badge.small.paddingVertical}px`);
  expect(getComputedStyle(small.parentElement!).paddingLeft).toBe(`${COMPONENT.badge.small.paddingHorizontal}px`);
  const regular = screen.getByText('기본 뱃지');
  expect(getComputedStyle(regular.parentElement!).paddingTop).toBe(`${COMPONENT.badge.regular.paddingVertical}px`);
  const probe = document.createElement('div');
  probe.style.backgroundColor = COLOR.status.negativeTint;
  document.body.appendChild(probe);
  expect(getComputedStyle(regular.parentElement!).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
  probe.remove();
  expect(getComputedStyle(regular.parentElement!).borderTopLeftRadius).toBe(`${COMPONENT.badge.borderRadius}px`);
});

it('StatusBadge도 같은 작은 뱃지 여백을 사용한다', () => {
  const status = Object.keys(STATUS)[0] as keyof typeof STATUS;
  render(<StatusBadge sm status={status} />);
  expect(getComputedStyle(screen.getByText(STATUS[status].label).parentElement!).paddingTop).toBe(`${COMPONENT.badge.small.paddingVertical}px`);
});
