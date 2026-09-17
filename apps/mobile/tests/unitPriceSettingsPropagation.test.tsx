import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { UnitPriceFormatProvider } from '@/features/settings/UnitPriceFormatProvider';
import { StockChangeOverview } from '@/features/ingredients/components/StockChangeOverview';
import { useUnitPriceFormat } from '@/lib/unitPriceFormat';

const state = vi.hoisted(() => ({ digits: 2 }));
vi.mock('@/features/settings/hooks', () => ({ useStoreSettings: () => ({ data: { unitPriceDigits: state.digits } }) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
beforeEach(() => { state.digits = 2; });

it('MY 자릿수 변경은 열린 재고 수정의 기준단가만 다시 표시하고 수량은 보존한다', () => {
  const page = () => <UnitPriceFormatProvider><StockChangeOverview id="i" name="재료" stock={-750} basePrice={4.71234} unit="g" mode="inbound" /></UnitPriceFormatProvider>;
  const view = render(page());
  expect(screen.getByText('4.71원/g')).toBeTruthy();
  state.digits = 0; view.rerender(page());
  expect(screen.getByText('5원/g')).toBeTruthy();
  state.digits = 4; view.rerender(page());
  expect(screen.getByText('4.7123원/g')).toBeTruthy();
  expect(screen.getByText(/750g/)).toBeTruthy();
});

it('명시된 통화와 정밀도는 보존하고 계산값을 반올림해 저장하지 않는다', () => {
  const original = 4.71234;
  function Sample() { const format = useUnitPriceFormat(); return <span>{format(original, 'g', 'en-US', 3)}</span>; }
  render(<UnitPriceFormatProvider><Sample /></UnitPriceFormatProvider>);
  expect(screen.getByText('$4.712/g')).toBeTruthy();
  expect(original).toBe(4.71234);
});
