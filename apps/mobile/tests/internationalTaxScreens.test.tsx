/** INTL-1E 비활성 전환 UI — capability가 열릴 때만 새 읽기 계약을 노출한다. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const routeParams = vi.hoisted(() => ({ from: '2026-09-01', to: '2026-09-01' }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => routeParams,
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));
vi.mock('@/features/business-day/businessDay', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesBusinessDate: () => ({ date: '2026-09-01', isLoading: false, error: null, refetch: vi.fn() }),
}));

const capabilities = vi.fn();
const internationalState = vi.fn();
const recipeState = vi.fn();
const salesTax = vi.fn();
const saveTax = vi.fn();
const saveMenuTax = vi.fn();
vi.mock('@/features/international-tax', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAppCapabilities: () => capabilities(),
  useInternationalTaxState: () => internationalState(),
  useRecipeTaxState: () => recipeState(),
  useSalesTaxDetail: (...args: unknown[]) => salesTax(...args),
  useSaveTaxProfile: () => saveTax(),
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

import MyTaxScreen from '@/features/my/screens/MyTaxScreen';
import SalesTaxScreen from '@/features/sales/screens/SalesTaxScreen';
import { RecipeTaxStatusCard } from '@/features/international-tax/RecipeTaxStatusCard';

const CAP_ON = { internationalTax: { readEnabled: true, writeEnabled: false } };
const CAP_WRITE = { internationalTax: { readEnabled: true, writeEnabled: true } };
const CAP_OFF = { internationalTax: { readEnabled: false, writeEnabled: false } };
const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });

beforeEach(() => {
  capabilities.mockReset();
  internationalState.mockReset();
  recipeState.mockReset();
  salesTax.mockReset();
  saveTax.mockReset();saveMenuTax.mockReset();
  routeParams.from = '2026-09-01';
  routeParams.to = '2026-09-01';
  capabilities.mockReturnValue(query(CAP_ON));
  saveTax.mockReturnValue({mutate:vi.fn(),isPending:false});saveMenuTax.mockReturnValue({mutate:vi.fn(),isPending:false});
});

describe('국제 세금 전환 화면', () => {
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
    expect(screen.getByText('한국 · KRW')).toBeTruthy();
    expect((screen.getByLabelText('primary 세금 이름') as HTMLInputElement).value).toBe('부가세');
    expect((screen.getByLabelText('primary 세율') as HTMLInputElement).value).toBe('10');
    expect(screen.getByLabelText('국제 세금 프로필 저장').getAttribute('aria-disabled')).toBe('true');
  });

  it('MY-02는 미국 지방세 소수점 입력을 보존하고 저장할 때만 숫자로 바꾼다', () => {
    const mutate=vi.fn();
    capabilities.mockReturnValue(query(CAP_WRITE));
    saveTax.mockReturnValue({mutate,isPending:false});
    internationalState.mockReturnValue(query({
      capabilities:CAP_WRITE,
      marketProfile:{countryCode:'US',currencyCode:'USD',priceBasis:'tax_exclusive'},
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
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      components:[expect.objectContaining({ratePct:8.875})],
    }),expect.any(Object));
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
