import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { View } from 'react-native';
import { RecipeDetailRow } from '@/features/recipes/components/RecipeDetailParts';
import { DetailRow, DetailSection, DetailSummary, SalesRow } from '@/features/sales/components/ProfitBlocks';
import { Card } from '@/components/kit';
import { COMPONENT } from '@/theme/tokens';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

it('매출관리 상세 행은 메뉴 판매 손익의 본문·보조 글자 크기를 공유한다', () => {
  render(
    <View>
      <RecipeDetailRow label="기준 항목" value="12,000원" secondary="100%" />
      <SalesRow label="손익 항목" amount="12,000원" percent="100%" />
      <DetailSummary rows={[["합계 항목", "12,000원", "100%"]]} />
      <DetailSection title="상세 항목" />
      <DetailRow name="내역 항목" sub="보조 내역" amount="12,000원" percent="100%" />
    </View>,
  );

  const bodySize = getComputedStyle(screen.getByText('기준 항목')).fontSize;
  const secondarySize = getComputedStyle(screen.getAllByText('100%')[0]!).fontSize;

  for (const text of ['손익 항목', '합계 항목', '상세 항목', '내역 항목']) {
    expect(getComputedStyle(screen.getByText(text)).fontSize).toBe(bodySize);
  }
  expect(getComputedStyle(screen.getByText('보조 내역')).fontSize).toBe(secondarySize);
  for (const node of screen.getAllByText('100%').slice(1)) {
    expect(getComputedStyle(node).fontSize).toBe(secondarySize);
  }
});

it('상세 이동이 없는 메뉴 손익 행은 날짜와 같은 우측 끝선을 사용한다', () => {
  render(<SalesRow label="판매 수량" amount="46개" reserveArrowSpace={false} />);
  expect(screen.queryByTestId('sales-row-arrow-space')).toBeNull();
});

it('화살표가 섞인 손익 카드는 모든 행에 같은 화살표 자리를 확보한다', () => {
  render(
    <View>
      <SalesRow label="매출" amount="49,000원" arrow />
      <SalesRow label="순이익" amount="10,392원" />
    </View>,
  );

  const slots = screen.getAllByTestId('sales-row-arrow-space');
  expect(slots).toHaveLength(2);
  for (const slot of slots) expect(getComputedStyle(slot).width).toBe('16px');
});

it('공통 카드의 기본 좌우 내부 여백은 16px이다', () => {
  render(<Card><View testID="card-content" /></Card>);
  const card = screen.getByTestId('card-content').parentElement;

  expect(COMPONENT.card.contentInset).toBe(16);
  expect(card).not.toBeNull();
  expect(getComputedStyle(card!).paddingLeft).toBe('16px');
  expect(getComputedStyle(card!).paddingRight).toBe('16px');
});
