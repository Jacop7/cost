import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { Alert, Linking } from 'react-native';
import { PurchaseOptionRow } from '@/features/ingredients/components/PurchaseOptionRow';
import { PurchaseOptionScreen } from '@/features/ingredients/screens/PurchaseOptionScreen';

const mock = vi.hoisted(() => ({ params: {} as { ingredient?: string; option?: string }, textStyles: new Map<string, Record<string, unknown>>(), detail: vi.fn(), save: vi.fn(), remove: vi.fn(), saveVendor: vi.fn(), retry: vi.fn() }));
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null,
    Text: (props: React.ComponentProps<typeof rn.Text>) => {
      if (typeof props.children === 'string') mock.textStyles.set(props.children, rn.StyleSheet.flatten(props.style) as Record<string, unknown>);
      return createElement(rn.Text, props);
    } };
});
vi.mock('expo-router', () => ({ useLocalSearchParams: () => mock.params, useRouter: () => ({ push: vi.fn() }),
  router: { canGoBack: () => false, replace: vi.fn(), back: vi.fn() } }));
vi.mock('@/features/ingredients/hooks', () => ({ useIngredientDetail: mock.detail,
  useSavePurchaseOption: () => ({ mutate: mock.save, isPending: false }),
  useDeletePurchaseOption: () => ({ mutate: mock.remove, isPending: false }) }));
vi.mock('@/features/master-data/hooks', () => ({ useSettingsLists: () => ({ data: { vendors: [{ id: 'v2', name: '새 거래처' }] }, isLoading: false, error: null }),
  useSaveVendor: () => ({ mutate: mock.saveVendor, isPending: false }) }));
const options = [
  { id: 'o1', name: '대파 1kg', vendorId: 'v1', vendorName: '첫 거래처', brandName: null, volume: 1000, amount: 4000, url: 'https://example.invalid' },
  { id: 'o2', name: '대파 박스', vendorId: null, vendorName: null, brandName: '브랜드', volume: 2000, amount: 10000, url: null },
];
const state = { data: { id: 'g1', baseUnit: 'g', options }, isLoading: false, error: null, isFetched: true, refetch: mock.retry };

// Real shared layout/fields; mocked hooks/mutations and Modal visibility.
// Browser captures separately verify font/geometry; this suite cannot prove native touch/IME.
describe('구매 옵션 표시와 편집 계약', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.textStyles.clear(); mock.params = { ingredient: 'g1' }; mock.detail.mockReturnValue(state); });
  for (const variant of ['management', 'detail'] as const) {
    it(`${variant}: 공유 행은 긴 이름·숫자 원문과 기존 타이포 변형을 유지한다`, () => {
      const press = vi.fn(), name = '친환경 무농약 국내산 손질 대파 업소용 정기배송 특별 구성';
      render(<PurchaseOptionRow variant={variant} name={name} seller="아주 긴 거래처 이름" amount="987,654,321원" quantity="1kg" unitPrice="987,654.32원/g" badge="low" hasLink={variant === 'management'} last onPress={press} />);
      const row = screen.getByRole('button', { name: `${name} 수정` });
      fireEvent.click(row); expect(press).toHaveBeenCalledOnce();
      const visibleTitle = variant === 'management' ? '아주 긴 거래처 이름' : name;
      const title = within(row).getByText(visibleTitle);
      expect(getComputedStyle(title).textOverflow).not.toBe('ellipsis');
      // Assert Text's supplied contract, not jsdom's incomplete RNW atomic CSS cascade.
      // Actual computed font faces/sizes are recorded in the separate browser evidence.
      expect(mock.textStyles.get(visibleTitle)).toMatchObject({ fontSize: 16, fontWeight: '700' });
      expect(mock.textStyles.get('987,654,321원')?.fontSize).toBe(14);
      const seller = within(row).getByText('아주 긴 거래처 이름');
      expect(within(row).getByText('987,654,321원').previousElementSibling).toBe(variant === 'management' ? seller.parentElement : seller);
      expect(mock.textStyles.get('1kg')?.fontSize).toBe(16);
      expect(within(row).getByText('987,654.32원/g')).toBeTruthy();
      if (variant === 'management') {
        const badge = within(row).getByText('최저');
        expect(getComputedStyle(badge.parentElement!.parentElement!).height).not.toBe('18px');
      } else expect(within(row).queryByText('최저')).toBeNull();
    });
  }
  it('목록의 최저/최고와 브랜드 우선 표시는 기존 계산을 유지한다', () => {
    render(<PurchaseOptionScreen />);
    const low = within(screen.getByRole('button', { name: '대파 1kg 구매 링크 메뉴 열기' }));
    expect(low.getByText('최저')).toBeTruthy(); expect(low.getByText('4.00원/g')).toBeTruthy(); expect(low.getByText('첫 거래처')).toBeTruthy();
    const high = within(screen.getByRole('button', { name: '대파 박스 구매 링크 메뉴 열기' }));
    expect(high.getByText('최고')).toBeTruthy(); expect(high.getByText('5.00원/g')).toBeTruthy(); expect(high.getByText('브랜드')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '대파 1kg 구매 링크 메뉴 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '구매 링크 수정' }));
    expect((screen.getByLabelText('옵션 이름') as HTMLInputElement).value).toBe('대파 1kg');
    expect(screen.getAllByText('4.00원/g')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('금액'), { target: { value: '5000' } });
    expect(screen.getByText('4.00원/g')).toBeTruthy(); expect(screen.getByText('5.00원/g')).toBeTruthy();
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
  });
  it('구매처는 공용 Select 이름/펼침/선택 후 닫기를 연결한다', () => {
    mock.params.option = 'o1'; render(<PurchaseOptionScreen />);
    fireEvent.click(screen.getByRole('button', { name: '구매처 변경, 첫 거래처', expanded: false }));
    expect(screen.getByRole('button', { name: '구매처 변경, 첫 거래처', expanded: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '새 거래처' }));
    expect(screen.getByRole('button', { name: '구매처 변경, 새 거래처', expanded: false })).toBeTruthy();
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.saveVendor).not.toHaveBeenCalled();
  });
  it('카드 메뉴는 유효 HTTP(S) 링크만 열고 없는 링크는 저장 없이 안내한다', async () => {
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<PurchaseOptionScreen />);
    fireEvent.click(screen.getByRole('button', { name: '대파 1kg 구매 링크 메뉴 열기' }));
    expect(screen.getByRole('button', { name: '구매 링크 수정' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '구매 링크 열기' }));
    expect(open).toHaveBeenCalledWith('https://example.invalid');
    fireEvent.click(screen.getByRole('button', { name: '대파 박스 구매 링크 메뉴 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '구매 링크 열기' }));
    expect(open).toHaveBeenCalledOnce(); expect(alert).toHaveBeenCalled(); expect(mock.save).not.toHaveBeenCalled();
    open.mockRestore(); alert.mockRestore();
  });
  it('추가 폼은 빈 값 저장을 막고 kg 환산을 mock 저장 인자에만 전달한다', () => {
    render(<PurchaseOptionScreen />);
    fireEvent.click(screen.getByRole('button', { name: '구매 옵션 추가' }));
    expect(screen.getByRole('button', { name: '추가' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(screen.getByLabelText('옵션 이름'), { target: { value: ' 새 옵션 ' } });
    fireEvent.change(screen.getByLabelText('용량'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('금액'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: '단위 g 변경' }));
    fireEvent.click(screen.getByRole('button', { name: 'kg' }));
    expect(screen.getByText('5.00원/g')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^구매처 변경,/ }));
    fireEvent.click(screen.getByRole('button', { name: '새 거래처' }));
    for (const value of ['', 'javascript:alert(1)', 'file:///secret', 'bad-link']) {
      fireEvent.change(screen.getByLabelText('구매 링크'), { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: '추가' })); expect(mock.save).not.toHaveBeenCalled();
    }
    fireEvent.change(screen.getByLabelText('구매 링크'), { target: { value: 'https://example.invalid/shop' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(mock.save).toHaveBeenCalledWith({ ingredientId: 'g1', id: undefined, name: '새 옵션', vendorId: 'v2', volume: 2000, amount: 10000, url: 'https://example.invalid/shop' }, expect.objectContaining({ onSuccess: expect.any(Function) }));
    expect(mock.remove).not.toHaveBeenCalled();
  });
  for (const kind of ['loading', 'error', 'missing', 'empty'] as const) {
    it(`${kind}: 공용 조회 상태/빈 옵션 안내가 편집 UI를 잘못 노출하지 않는다`, () => {
      mock.detail.mockReturnValue({ ...state, isLoading: kind === 'loading', error: kind === 'error' ? new Error('fixture') : null,
        data: kind === 'missing' ? undefined : { ...state.data, options: [] } });
      render(<PurchaseOptionScreen />);
      expect(screen.getByText(kind === 'loading' ? '불러오는 중이에요' : kind === 'error' ? '정보를 불러오지 못했어요' : kind === 'missing' ? '식재료를 찾을 수 없어요' : '등록된 구매 옵션이 없어요')).toBeTruthy();
      expect(screen.queryByLabelText('옵션 이름')).toBeNull();
      if (kind === 'error') { fireEvent.click(screen.getByRole('button', { name: '다시 시도' })); expect(mock.retry).toHaveBeenCalledOnce(); }
    });
  }
  it('식재료 ID가 없으면 조회 결과와 무관하게 등록 진입을 막는다', () => {
    mock.params = {}; render(<PurchaseOptionScreen />);
    expect(screen.getByText('식재료를 먼저 저장해 주세요')).toBeTruthy(); expect(screen.queryByLabelText('옵션 이름')).toBeNull();
  });
});
