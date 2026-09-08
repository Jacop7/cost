import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { Badge, StatusBadge } from '@/components/kit';
import { COLOR, COMPONENT, STATUS } from '@/theme/tokens';

const styles = vi.hoisted(() => new Map<string, Record<string, unknown>>());
// RNW 원자 CSS의 jsdom cascade 대신 실제 Text에 전달한 계약을 검사한다.
// 브라우저의 12px/18px 및 배지 18/20px 높이는 별도로 실측한다.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Text: (props: React.ComponentProps<typeof rn.Text>) => {
    if (typeof props.children === 'string') styles.set(props.children, rn.StyleSheet.flatten(props.style) as Record<string, unknown>);
    return createElement(rn.Text, props);
  } };
});

it('뱃지는 공통 여백과 옅은 배경을 사용하고 solid 호출도 진한 배경으로 돌아가지 않는다', () => {
  render(<><Badge sm tone="green">여유</Badge><Badge tone="red" solid>기본 뱃지</Badge></>);
  const small = screen.getByText('여유');
  expect(styles.get('여유')).toMatchObject({ fontSize: 12, lineHeight: 18 });
  expect(getComputedStyle(small.parentElement!).paddingTop).toBe(`${COMPONENT.badge.small.paddingVertical}px`);
  expect(getComputedStyle(small.parentElement!).paddingLeft).toBe(`${COMPONENT.badge.small.paddingHorizontal}px`);
  const regular = screen.getByText('기본 뱃지');
  expect(styles.get('기본 뱃지')).toMatchObject({ fontSize: 12, lineHeight: 18 });
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
  expect(styles.get(STATUS[status].label)).toMatchObject({ fontSize: 12, lineHeight: 18 });
  expect(getComputedStyle(screen.getByText(STATUS[status].label).parentElement!).paddingTop).toBe(`${COMPONENT.badge.small.paddingVertical}px`);
});
