vi.mock('@/features/changes/components/ConfigurationHistoryLink', () => ({ ConfigurationHistoryLink: () => null }));
/** INTL-1E 비활성 전환 UI — capability가 열릴 때만 새 읽기 계약을 노출한다. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const routeParams = vi.hoisted(() => ({ id: 'recipe-1', from: '2026-09-01', to: '2026-09-01' }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => routeParams,
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/business-day/businessDay', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesBusinessDate: () => ({ date: '2026-09-01', isLoading: false, error: null, refetch: vi.fn() }),
}));

const recipeDetail = vi.fn();
const recommendation = vi.fn();
vi.mock('@/features/recipes/hooks', () => ({ useRecipeDetail: () => recipeDetail() }));
vi.mock('@/features/recipes/draftPreviewQuery', () => ({ useRecipeRecommendation: () => recommendation() }));
const capabilities = vi.fn();
const internationalState = vi.fn();
const recipeState = vi.fn();
const salesTax = vi.fn();
const saveTax = vi.fn();
const saveMarket = vi.fn();
const saveMenuTax = vi.fn();
vi.mock('@/features/international-tax', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppCapabilities: () => capabilities(),
  useInternationalTaxState: () => internationalState(),
  useRecipeTaxState: () => recipeState(),
  useSalesTaxDetail: (...args: unknown[]) => salesTax(...args),
  useSaveTaxConfiguration: () => ({ ...saveTax(), mutateAsync: saveTax().mutate }),
  useSaveMarketProfile: () => ({ mutateAsync: saveMarket, isPending: false }),
  useInternationalTaxRegions: () => query([]),
}));
vi.mock('@/features/international-tax/hooks', () => ({
  useAppCapabilities: () => capabilities(),
  useRecipeTaxState: (...args: unknown[]) => recipeState(...args),
  useSaveMenuTaxOverride: () => saveMenuTax(),
}));

vi.mock('@/features/settings/hooks', () => ({
  useStoreSettings: vi.fn(),
  useSaveStoreTax: vi.fn(),
}));
vi.mock('@/features/sales/hooks', () => ({
  useTaxBreakdown: () => ({ data: { total: 100, items: [{ name: '기존 세금', amount: 100, rate: 10 }] }, isLoading: false, error: null, refetch: vi.fn() }),
  useSalesRange: () => ({ data: { summary: { revenue: 1000 } }, isLoading: false, error: null, refetch: vi.fn() }),
}));

import RecipeTaxScreen from '@/features/recipes/screens/RecipeTaxScreen';
import MyTaxScreen from '@/features/my/screens/MyTaxScreen';
import SalesTaxScreen from '@/features/sales/screens/SalesTaxScreen';
import { RecipeTaxStatusCard } from '@/features/international-tax/RecipeTaxStatusCard';

const CAP_ON = { internationalTax: { readEnabled: true, writeEnabled: false } };
const CAP_WRITE = { internationalTax: { readEnabled: true, writeEnabled: true } };
const CAP_OFF = { internationalTax: { readEnabled: false, writeEnabled: false } };
const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });

beforeEach(() => {
  recipeDetail.mockReturnValue(query(null));
  recommendation.mockReturnValue(query(null));
  capabilities.mockReset();
  internationalState.mockReset();
  recipeState.mockReset();
  salesTax.mockReset();
  saveTax.mockReset();saveMenuTax.mockReset();saveMarket.mockReset();
  routeParams.from = '2026-09-01';
  routeParams.to = '2026-09-01';
  capabilities.mockReturnValue(query(CAP_ON));
  saveTax.mockReturnValue({mutate:vi.fn(),isPending:false});saveMenuTax.mockReturnValue({mutate:vi.fn(),isPending:false});
});

describe('국제 세금 전환 화면', () => {
  it.each([['USD', 2, '1.23', '12.34'], ['KRW', 0, '1', '12']] as const)(
    'F4-6 현재 %s quote 표시와 예약 P1 저장을 함께 보존한다', (currencyCode, minorUnit, tax, net) => {
      const mutate = vi.fn(); saveMenuTax.mockReturnValue({ mutate, isPending: false });
      recipeState.mockReturnValue(query({ capabilities: CAP_WRITE,
        taxProfileId: 'reserved-p1', taxProfileRevision: 2, overrideRevision: 3,
        currencyCode: 'GBP', minorUnit: 2, priceBasis: 'tax_inclusive',
        categories: [{ code: 'reserved-category', name: '예약 분류', treatment: 'exempt' }],
        quote: { taxAmount: 1.23, netSales: 12.34 },
        quoteContext: { market: { currencyCode, minorUnit, priceBasis: 'tax_exclusive' } },
      }));
      render(<RecipeTaxStatusCard recipeId="recipe-1" />);
      expect(screen.getByText(`현재 판매가 세금 ${currencyCode} ${tax} · 순매출 ${currencyCode} ${net}`)).toBeTruthy();
      expect(screen.queryByText(/현재 판매가 세금 GBP/)).toBeNull();
      expect(mutate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '예약 분류' }));
      expect(mutate).toHaveBeenCalledWith({ taxProfileId: 'reserved-p1', taxCategory: 'reserved-category',
        treatment: null, baseRevision: 3 }, expect.any(Object));
    });

  it.each(['missing', 'null', 'error', 'pending'] as const)(
    'F4-6 context %s에서는 예약 통화로 현재 quote를 표시하지 않는다', mode => {
      recipeState.mockReturnValue({ ...query({ capabilities: CAP_WRITE, taxProfileId: 'reserved-p1',
        overrideRevision: 3, categories: [], currencyCode: 'GBP', minorUnit: 2,
        quote: { taxAmount: 1.23, netSales: 12.34 },
        quoteContext: mode === 'null' ? null : undefined }),
        isLoading: mode === 'pending', error: mode === 'error' ? new Error('failed') : null });
      render(<RecipeTaxStatusCard recipeId="recipe-1" />);
      expect(screen.queryByText(/현재 판매가 세금/)).toBeNull();
      if (mode === 'missing' || mode === 'null') expect(screen.getByRole('button', { name: '매장 기본값' })).toBeTruthy();
    });

  it('MY-02는 새 읽기가 열려도 저장을 실패 폐쇄한다', () => {
    internationalState.mockReturnValue(query({
      capabilities: CAP_ON,
      marketProfile: { countryCode: 'KR', currencyCode: 'KRW', priceBasis: 'tax_inclusive' },
      taxProfile: {
        effectiveFrom: '2026-09-02', revision: 3,
        defaultTreatment:'taxable',remittanceRules:[],categories:[],
        components: [{ id: 'c1', configKey:'primary',kind: 'primary', name: '부가세', ratePct: 10,jurisdictionLevel:'national',calculationBasis: 'primary_tax_exclusive',appliesToTreatments:['taxable'],sortOrder:0 }],
      },
    }));
    render(<MyTaxScreen />);
    expect(screen.getByText('한국')).toBeTruthy();
    expect((screen.getByLabelText('primary 세율') as HTMLInputElement).value).toBe('10');
    expect(screen.getByLabelText('국제 세금 프로필 저장').getAttribute('aria-disabled')).toBe('true');
  });

  it('MY-02는 미국 지방세 소수점 입력을 보존하고 저장할 때만 숫자로 바꾼다', () => {
    const mutate=vi.fn();
    capabilities.mockReturnValue(query(CAP_WRITE));
    saveTax.mockReturnValue({mutate,isPending:false});
    internationalState.mockReturnValue(query({
      capabilities:CAP_WRITE,
      marketProfile:{countryCode:'US',regionCode:'US-NY',currencyCode:'USD',priceBasis:'tax_exclusive'},
      taxProfile:{
        id:'11111111-1111-1111-1111-111111111111',effectiveFrom:'2026-09-02',revision:3,
        defaultTreatment:'taxable',remittanceRules:[],categories:[],
        components:[{id:'c1',configKey:'primary',kind:'primary',name:'Sales tax',ratePct:8,
          jurisdictionLevel:'state',calculationBasis:'primary_tax_exclusive',appliesToTreatments:['taxable'],sortOrder:0}],
      },
    }));
    render(<MyTaxScreen/>);
    const rate=screen.getByLabelText('primary 세율') as HTMLInputElement;
    fireEvent.change(rate,{target:{value:'8.'}});
    expect(rate.value).toBe('8.');
    fireEvent.change(rate,{target:{value:'8.875'}});
    expect(rate.value).toBe('8.875');
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ tax: expect.objectContaining({
      components:[expect.objectContaining({ratePct:8.875})],
    }) }));
  });

  it('RCP-02는 서버가 확정한 메뉴 과세 상태만 표시한다', () => {
    recipeState.mockReturnValue(query({
      capabilities: CAP_ON,
      taxProfileId:'11111111-1111-1111-1111-111111111111',taxProfileRevision:1,defaultTreatment:'taxable',overrideRevision:1,
      effectiveFrom: '2026-09-02',
      treatment: 'zero_rated',
      taxCategory: 'zero_rated',
      categories: [{ code: 'zero_rated', name: '0% 식품', treatment: 'zero_rated' }],
    }));
    render(<RecipeTaxStatusCard recipeId="recipe-1" />);
    expect(screen.getByText('0% 과세')).toBeTruthy();
    expect(screen.getByText('카테고리 0% 식품')).toBeTruthy();
    expect(screen.getByText('변경한 과세 상태는 2026-09-02부터 적용돼요.')).toBeTruthy();
  });

  it('SALES-18은 판매 시점 프로필 판본과 확정 세액을 표시한다', () => {
    salesTax.mockReturnValue(query({
      from: '2026-09-01', to: '2026-09-01',
      lines: [{
        dailySalesItemId: 'item-1', salesChannel: 'hall', menuName: '제육볶음', saleDate: '2026-09-01',
        currencyCode: 'KRW', minorUnit: 0, taxAmount: 1091,
        taxProfileRevision: 4, components: [{ name: '부가세' }],
      }],
      etcLines: [],
    }));
    render(<SalesTaxScreen />);
    expect(screen.getByText('판매 시점 국제 세금')).toBeTruthy();
    expect(screen.getByText('제육볶음 · hall')).toBeTruthy();
    expect(screen.getAllByText('KRW 1,091')).toHaveLength(2);
    expect(screen.getByText(/프로필 판본 4/)).toBeTruthy();
    expect(salesTax).toHaveBeenCalledWith('2026-09-01', '2026-09-01', true);
  });

  it('SALES-18 기간 조회는 하루로 줄이지 않고 각 판매일을 표시한다', () => {
    routeParams.from = '2026-08-31';
    salesTax.mockReturnValue(query({
      from: '2026-08-31', to: '2026-09-01',
      lines: [{
        dailySalesItemId: 'item-1', salesChannel: 'hall', menuName: '제육볶음', saleDate: '2026-08-31',
        currencyCode: 'KRW', minorUnit: 0, taxAmount: 1091,
        taxProfileRevision: 4, components: [{ name: '부가세' }],
      }],
      etcLines: [],
    }));
    render(<SalesTaxScreen />);
    expect(salesTax).toHaveBeenCalledWith('2026-08-31', '2026-09-01', true);
    expect(screen.getByText(/2026-08-31 · 프로필 판본 4/)).toBeTruthy();
  });

  it('SALES-18은 기타매출 국제 세금도 같은 판매 시점 상세에 합친다', () => {
    salesTax.mockReturnValue(query({
      from:'2026-09-01',to:'2026-09-01',lines:[],
      etcLines:[{dailySalesId:'sales-1',salesChannel:'hall',name:'음료',saleDate:'2026-09-01',currencyCode:'KRW',minorUnit:0,taxAmount:91,taxProfileRevision:4,components:[{name:'부가세'}]}],
    }));
    render(<SalesTaxScreen />);
    expect(screen.getByText('음료 · hall')).toBeTruthy();
    expect(screen.getAllByText('KRW 91').length).toBeGreaterThan(0);
    expect(screen.queryByText('기존 세금')).toBeNull();
  });

  it('capability가 꺼지면 RCP-02 국제 과세 카드를 렌더링하지 않는다', () => {
    capabilities.mockReturnValue(query(CAP_OFF));
    render(<RecipeTaxStatusCard recipeId="recipe-1" />);
    expect(screen.queryByText('국제 과세 상태')).toBeNull();
    expect(recipeState).toHaveBeenCalledWith('recipe-1', false);
  });

  it('capability가 꺼지면 SALES-18 국제 상세를 조회하지 않고 기존 세금만 보인다', () => {
    capabilities.mockReturnValue(query(CAP_OFF));
    salesTax.mockReturnValue(query({ from: '2026-09-01', to: '2026-09-01', lines: [] }));
    render(<SalesTaxScreen />);
    expect(salesTax).toHaveBeenCalledWith('2026-09-01', '2026-09-01', false);
    expect(screen.queryByText('판매 시점 국제 세금')).toBeNull();
    expect(screen.getByText('기존 세금')).toBeTruthy();
  });

  it('활성일 이전 기간은 국제 snapshot이 없으면 기존 세금 상세를 보존한다', () => {
    salesTax.mockReturnValue(query({from:'2026-08-01',to:'2026-08-01',lines:[],etcLines:[]}));
    render(<SalesTaxScreen/>);
    expect(screen.getByText('기존 세금')).toBeTruthy();
    expect(screen.getByText(/기존 세금 계약으로 기록/)).toBeTruthy();
  });
});


describe('MY-02 프로토타입 세금 편집', () => {
  const fixture = () => ({ capabilities: CAP_WRITE,
    marketProfile: { id: 'market-1', revision: 1, countryCode: 'KR', regionCode: null, currencyCode: 'KRW', priceBasis: 'tax_inclusive' },
    taxProfile: { id: 'tax-1', revision: 3, effectiveFrom: '2026-09-12', defaultTreatment: 'taxable', categories: [], remittanceRules: [],
      components: [{ id: 'c1', configKey: 'primary', kind: 'primary', name: '부가세', ratePct: 10, jurisdictionLevel: 'national', calculationBasis: 'primary_tax_exclusive', appliesToTreatments: ['taxable'], sortOrder: 0 }] },
  });
  beforeEach(() => { capabilities.mockReturnValue(query(CAP_WRITE)); internationalState.mockReturnValue(query(fixture())); });

  it.each(['immediate', 'next_business'] as const)('서버 적용 상태 %s를 저장 확인창에 표시한다', mode => {
    internationalState.mockReturnValue(query({ ...fixture(), applicationMode: mode }));
    render(<MyTaxScreen />);
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    expect(screen.getByText(mode === 'immediate'
      ? '저장하면 바로 적용돼요. 이미 마감한 매출 내역은 바뀌지 않아요.'
      : '영업 중에는 현재 영업 기준을 유지해요. 변경한 설정은 영업 종료 후 바로 적용돼요.')).toBeTruthy();
  });

  it('추가창 취소는 항목과 서버를 바꾸지 않는다', () => {
    const mutate = vi.fn(); saveTax.mockReturnValue({ mutate, isPending: false });
    render(<MyTaxScreen />);
    fireEvent.click(screen.getByRole('button', { name: '＋ 추가 세금 항목' }));
    expect(screen.getByRole('radio', { name: '부가세 미포함 금액' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.change(screen.getByPlaceholderText('예) 지역세'), { target: { value: '지역세' } });
    fireEvent.change(screen.getByLabelText('추가 세금 세율'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByText('추가 세금 항목이 없어요')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled(); expect(saveMarket).not.toHaveBeenCalled();
  });

  it('추가 항목은 선택한 기준과 소수 세율을 저장 버튼까지 초안으로 보존한다', () => {
    const mutate = vi.fn(); saveTax.mockReturnValue({ mutate, isPending: false });
    render(<MyTaxScreen />);
    fireEvent.click(screen.getByRole('button', { name: '＋ 추가 세금 항목' }));
    fireEvent.change(screen.getByPlaceholderText('예) 지역세'), { target: { value: '지역세' } });
    fireEvent.change(screen.getByLabelText('추가 세금 세율'), { target: { value: '2.125' } });
    fireEvent.click(screen.getByRole('radio', { name: '부가세 포함 금액' }));
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(screen.getByRole('button', { name: '지역세 수정' })).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ tax: expect.objectContaining({ baseProfileId: 'tax-1', baseRevision: 3,
      components: expect.arrayContaining([expect.objectContaining({ name: '지역세', ratePct: 2.125, calculationBasis: 'primary_tax_inclusive' })]) }) }));
    expect(saveMarket).not.toHaveBeenCalled();
  });

  it('법정 10%와 포함 가격 적용 요율, 면세 미리보기를 구분한다', () => {
    render(<MyTaxScreen />);
    expect(screen.getByText('모든 메뉴에 공통으로 적용되는 세금 설정이에요.')).toBeTruthy();
    expect(screen.getByText('9.0909 %')).toBeTruthy();
    expect(screen.queryByText('₩1,091')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '세금 시뮬레이션' }));
    fireEvent.change(screen.getByLabelText('시뮬레이션 판매가'), { target: { value: '12000' } });
    expect(screen.getAllByText('₩1,091').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₩10,909').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.click(screen.getByRole('radio', { name: '면세' }));
    expect(screen.getByText('0.0000 %')).toBeTruthy();
    expect(screen.queryByText('₩1,091')).toBeNull();
    expect((screen.getByLabelText('primary 세율') as HTMLInputElement).value).toBe('10');
  });

  it('총 적용 세율은 반올림된 예시 금액이나 법정 세율의 단순 합산을 쓰지 않는다', () => {
    const data = fixture();
    internationalState.mockReturnValue(query({ ...data, taxProfile: { ...data.taxProfile, components: [
      ...data.taxProfile.components,
      { id: 'c2', configKey: 'extra', kind: 'additional', name: '지역세', ratePct: 2, jurisdictionLevel: 'custom', calculationBasis: 'primary_tax_inclusive', appliesToTreatments: ['taxable'], sortOrder: 1 },
    ] } }));
    render(<MyTaxScreen />);
    expect(screen.getByText('10.8734%')).toBeTruthy();
    expect(screen.queryByText('₩12,000')).toBeNull();
  });

  it('미포함 시뮬레이션은 세금을 판매가에서 차감하지 않고 서버에 저장하지 않는다', () => {
    const mutate = vi.fn(); saveTax.mockReturnValue({ mutate, isPending: false });
    render(<MyTaxScreen />);
    fireEvent.click(screen.getByRole('radio', { name: '부가세 미포함' }));
    fireEvent.click(screen.getByRole('button', { name: '세금 시뮬레이션' }));
    expect(screen.queryByText('₩1,200')).toBeNull();
    fireEvent.change(screen.getByLabelText('시뮬레이션 판매가'), { target: { value: '12000' } });
    expect(screen.getByText('별도 부과 세금')).toBeTruthy();
    expect(screen.queryByText('(−) 세금 총액')).toBeNull();
    expect(screen.getAllByText('₩12,000')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('시뮬레이션 판매가'), { target: { value: '24000' } });
    expect(screen.getAllByText('₩2,400').length).toBeGreaterThan(0);
    expect(mutate).not.toHaveBeenCalled(); expect(saveMarket).not.toHaveBeenCalled();
  });

  it('원자 저장이 거절되면 부분 저장 없이 오류를 표시한다', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('세금 설정 변경 불가')); saveTax.mockReturnValue({ mutate, isPending: false });
    render(<MyTaxScreen />);
    fireEvent.click(screen.getByRole('radio', { name: '부가세 미포함' }));
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByText('세금 설정 변경 불가')).toBeTruthy());
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ market: expect.objectContaining({ baseProfileId: 'market-1', baseRevision: 1, priceBasis: 'tax_exclusive' }) }));
    expect(saveMarket).not.toHaveBeenCalled();
  });

  it('백그라운드 재조회는 편집 초안의 기준 판본을 바꾸지 않는다', () => {
    const mutate = vi.fn(); saveTax.mockReturnValue({ mutate, isPending: false });
    const view = render(<MyTaxScreen />);
    fireEvent.change(screen.getByLabelText('primary 세율'), { target: { value: '8.875' } });
    const next = fixture(); next.taxProfile.revision = 4;
    internationalState.mockReturnValue(query(next)); view.rerender(<MyTaxScreen />);
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ tax: expect.objectContaining({ baseRevision: 3, components: [expect.objectContaining({ ratePct: 8.875 })] }) }));
  });
  it('가격 기준과 세율은 두 기준 판본을 포함한 한 요청으로 전송한다', async () => {
    const original = fixture();
    const refreshed = { ...original, marketProfile: { ...original.marketProfile, id: 'market-2', revision: 2, priceBasis: 'tax_exclusive' }, taxProfile: null };
    internationalState.mockReturnValue({ ...query(original), refetch: vi.fn().mockResolvedValue({ data: refreshed, error: null }) });
    saveMarket.mockResolvedValue({ changed: true, profileId: 'market-2', revision: 2, effectiveFrom: '2026-09-12' });
    const mutate = vi.fn().mockRejectedValue(new Error('세금 저장 연결 오류'));
    saveTax.mockReturnValue({ mutate, isPending: false });
    render(<MyTaxScreen />);
    fireEvent.click(screen.getByRole('radio', { name: '부가세 미포함' }));
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByText('세금 저장 연결 오류')).toBeTruthy());
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      market: expect.objectContaining({ baseProfileId: 'market-1', baseRevision: 1, priceBasis: 'tax_exclusive' }),
      tax: expect.objectContaining({ baseProfileId: 'tax-1', baseRevision: 3 }),
    }));
    expect(saveMarket).not.toHaveBeenCalled();
  });

  it('혼합 납부 주체는 세율 편집만으로 통일하지 않는다', () => {
    const data = fixture();
    const remittanceRules = [{ taxComponentId: 'c1', salesChannel: 'delivery', remittanceOwner: 'marketplace' }];
    internationalState.mockReturnValue(query({ ...data, taxProfile: { ...data.taxProfile, remittanceRules } }));
    const mutate = vi.fn(); saveTax.mockReturnValue({ mutate, isPending: false });
    render(<MyTaxScreen />);
    expect(screen.getByText('항목·판매 채널별 설정을 유지하고 있어요.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('primary 세율'), { target: { value: '9' } });
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ tax: expect.objectContaining({ components: [expect.objectContaining({ remittance: { hall: 'merchant', delivery: 'marketplace', takeout: 'merchant' } })] }) }));
  });

  it('페이지 저장은 확인창만 열고 취소하면 서버에 저장하지 않는다', async () => {
    const mutate = vi.fn(); saveTax.mockReturnValue({ mutate, isPending: false });
    const data = { ...fixture(), localDate: '2026-09-11' };
    internationalState.mockReturnValue(query(data));
    render(<MyTaxScreen />);
    expect(screen.queryByText('2026-09-12부터 적용')).toBeNull();
    fireEvent.click(screen.getByLabelText('국제 세금 프로필 저장'));
    expect(screen.getByText('세금 설정을 저장할까요?')).toBeTruthy();
    expect(screen.getByText(/영업 전·영업 종료 상태에서는 바로 적용돼요/)).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByText('세금 설정을 저장할까요?')).toBeNull());
    expect(mutate).not.toHaveBeenCalled(); expect(saveMarket).not.toHaveBeenCalled();
  });

});


describe('레시피 세금 상세', () => {
  it('MY 예약 설정 대신 현재 견적과 같은 기준만 읽기 전용으로 표시한다', () => {
    internationalState.mockReturnValue(query({ localDate: '2026-09-11', marketProfile: { countryCode: 'KR', priceBasis: 'tax_exclusive' },
      taxProfile: { effectiveFrom: '2026-09-12', defaultTreatment: 'exempt', components: [{ id: 'vat', kind: 'primary', ratePct: 20, calculationBasis: 'primary_tax_exclusive', appliesToTreatments: ['taxable'] }], remittanceRules: [{ taxComponentId: 'vat', salesChannel: 'hall', remittanceOwner: 'marketplace' }] } }));
    recipeState.mockReturnValue(query({
      quoteContext: { treatment: 'taxable', market: { countryCode: 'KR', currencyCode: 'KRW', minorUnit: 0, businessLocaleCode: 'ko-KR', priceBasis: 'tax_inclusive' } },
      quote: { listedTotal: 12000, taxAmount: 1091, netSales: 10909, components: [{ taxComponentId: 'current-vat', kind: 'primary', name: '부가세', ratePct: 10, unroundedAmount: 12000 / 11, roundedAmount: 1091, remittanceOwner: 'merchant' }] },
    }));
    render(<RecipeTaxScreen />);
    expect(screen.getByText('법정 세율')).toBeTruthy();
    expect(screen.getByText('10 %')).toBeTruthy();
    expect(screen.getByText('9.0909 %')).toBeTruthy();
    expect(screen.getByText('부가세 포함')).toBeTruthy();
    expect(screen.getByText('일반 과세')).toBeTruthy();
    expect(screen.getByText('매장 직접 납부')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText('부가세 미포함')).toBeNull();
    expect(screen.queryByText('0% 과세')).toBeNull();
    expect(screen.queryByText('면세')).toBeNull();
    expect(screen.queryByText('플랫폼 대납')).toBeNull();
    expect(screen.queryByText(/MY 공통 설정 ·/)).toBeNull();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
  });
  it('현재 면세 견적에 예약된 과세 선택이나 MY 기본값을 섞지 않는다', () => {
    recipeState.mockReturnValue(query({ treatment: 'taxable', defaultTreatment: 'taxable',
      quoteContext: { treatment: 'exempt', market: { currencyCode: 'KRW', minorUnit: 0, businessLocaleCode: 'ko-KR', priceBasis: 'tax_exclusive' } },
      quote: { listedTotal: 12000, taxAmount: 0, netSales: 12000, components: [{ taxComponentId: 'vat', kind: 'primary', name: '부가세', ratePct: 10, unroundedAmount: 0, roundedAmount: 0, remittanceOwner: 'marketplace' }] },
    }));
    render(<RecipeTaxScreen />);
    expect(screen.getByText('면세')).toBeTruthy();
    expect(screen.getByText('0.0000 %')).toBeTruthy();
    expect(screen.getByText('부가세 미포함')).toBeTruthy();
    expect(screen.getByText('플랫폼 대납')).toBeTruthy();
    expect(screen.queryByText('일반 과세')).toBeNull();
  });
  it('적용일 이전에도 서버 세액으로 정해진 상세 구성을 표시한다', () => {
    recipeState.mockReturnValue(query({ quote: null }));
    recommendation.mockReturnValue(query({ status: 'unavailable', reason: 'not_active' }));
    recipeDetail.mockReturnValue(query({ price: 12000, tax: 1091, taxBreakdown: [{ name: '부가세', rate: 9.0909, amount: 1091, builtin: false }] }));
    render(<RecipeTaxScreen />);
    expect(screen.queryByText('추가 세금 항목이 없어요')).toBeNull();
    expect(screen.queryByText('추가 세금 소계')).toBeNull();
    expect(screen.getByText('세금 총액')).toBeTruthy();
    expect(screen.getByText('세금 제외 금액')).toBeTruthy();
    expect(screen.getByText('(−) 세금 총액')).toBeTruthy();
    expect(screen.getByText('₩10,909')).toBeTruthy();
    expect(screen.queryByText('결제금액')).toBeNull();
    expect(screen.getByText('9.0909 %')).toBeTruthy();
    expect(screen.queryByText('법정 세율')).toBeNull();
  });
  it('예약 통화 대신 현재 서버 견적의 금액과 통화만 표시한다', () => {
    recipeState.mockReturnValue(query({ currencyCode: 'GBP', quoteContext: { market: { currencyCode: 'KRW', minorUnit: 0, businessLocaleCode: 'ko-KR', priceBasis: 'tax_inclusive' } },
      quote: { listedTotal: 12000, taxAmount: 1091, netSales: 10909, components: [{ taxComponentId: 'vat', name: '부가세', roundedAmount: 1091 }] } }));
    render(<RecipeTaxScreen />);
    expect(screen.getByText('₩12,000')).toBeTruthy();
    expect(screen.getByText('₩10,909')).toBeTruthy();
    expect(screen.queryByText('국제 세금 프로필 저장')).toBeNull();
  });
  it('현재 견적의 시장 문맥이 없으면 예약 설정으로 금액을 표시하지 않는다', () => {
    recipeState.mockReturnValue(query({ currencyCode: 'GBP', quote: { listedTotal: 12000, taxAmount: 1091, netSales: 10909, components: [] } }));
    render(<RecipeTaxScreen />);
    expect(screen.getByText('현재 적용되는 세금 정보를 확인할 수 없어요.')).toBeTruthy();
    expect(screen.queryByText('₩12,000')).toBeNull();
  });
});
