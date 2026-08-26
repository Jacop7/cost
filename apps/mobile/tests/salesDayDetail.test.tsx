/**
 * SALES-03 일 손익 상세 — §6.4 가 여기에 얹은 것 세 가지를 잰다.
 *
 *   ① `원가·손익은 현재 기준으로 계산했어요` 배지가 **언제** 뜨는가
 *   ② 기록 없는 날에 `판매 내역이 없습니다.` 만 뜨는가
 *   ③ `판매 내역 수정` · `판매 내역 추가` 가 **언제** 뜨는가
 *      ⚠ 특히 **영업 중인 날에는 안 뜬다.** 그 날은 매출관리 홈에서 저장한다 —
 *        여기로 보내면 서버가 45011 로 돌려보내고 사장님은 왜 막혔는지 모른다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SalesDay } from '@/features/sales/hooks';

const push = vi.fn();

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ date: '2026-08-20' }),
  useRouter: () => ({ push }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/features/sales/businessDay', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesBusinessDate: () => ({ date: '2026-08-26', isLoading: false, error: null, refetch: vi.fn() }),
}));

const salesDay = vi.fn();
vi.mock('@/features/sales/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesDay: () => salesDay(),
  useSalesRange: () => ({
    data: { from: '2026-08-20', to: '2026-08-20', summary: SUMMARY, daily: [], menu: [], channels: [] },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
}));

import SalesDayDetailScreen from '@/features/sales/screens/SalesDayDetailScreen';

const SUMMARY = {
  from: '2026-08-20', to: '2026-08-20', days: 1, revenue: 120000, etcRevenue: 0, qty: 10,
  materialCost: 28064, extraMaterialCost: 3000, tax: 10909, wasteLoss: 0, wasteIngredient: 0,
  wasteMenu: 0, dailyExtra: 0, fixedCost: 37560, fixedRate: 0.313, fixedRateProvisional: false,
  profit: 40466,
};

const ITEM = {
  id: 'i-1', recipeId: 'r-1', menuName: '제육볶음', unitPrice: 12000,
  unitMaterialCost: 2806.4, unitExtraCost: 300,
  qtyHall: 8, qtyDelivery: 2, qtyTakeout: 0, qtyWaste: 0, qty: 10,
};

function day(over: Partial<SalesDay> = {}): SalesDay {
  return {
    saleDate: '2026-08-20', revision: 2,
    items: [ITEM], etcItems: [], extraItems: [], etcRevenue: 0, dailyExtra: 0,
    summary: SUMMARY,
    basisQuality: 'exact', hasLedger: true, dayStatus: 'closed', editable: true,
    ...over,
  };
}
const query = (d: SalesDay) => ({ data: d, isLoading: false, error: null, refetch: vi.fn() });

beforeEach(() => { push.mockReset(); });

describe('기준 배지', () => {
  it('그날 기준으로 계산했으면 안 뜬다', () => {
    salesDay.mockReturnValue(query(day({ basisQuality: 'exact' })));
    render(<SalesDayDetailScreen />);
    expect(screen.queryByText('원가·손익은 현재 기준으로 계산했어요')).toBeNull();
  });

  /*
   * ⚠ 문구를 넓히면 안 된다. 매출과 판매 수량은 사장님이 적은 **실제 기록**이다 —
   *   `전체가 추정` 처럼 말하면 사장님이 자기 기록을 못 믿게 된다.
   */
  it('현재 기준으로 계산했으면 뜬다', () => {
    salesDay.mockReturnValue(query(day({ basisQuality: 'estimated_current' })));
    render(<SalesDayDetailScreen />);
    expect(screen.getByText('원가·손익은 현재 기준으로 계산했어요')).toBeTruthy();
  });
});

describe('기록 없는 날', () => {
  const empty = () => day({
    items: [], hasLedger: false, dayStatus: null, basisQuality: null,
    summary: { ...SUMMARY, revenue: 0, qty: 0, profit: 0 },
  });

  it('가운데 한 줄만 두고 손익 카드를 안 그린다', () => {
    salesDay.mockReturnValue(query(empty()));
    render(<SalesDayDetailScreen />);
    expect(screen.getByText('판매 내역이 없습니다.')).toBeTruthy();
    // 0원 카드를 그리면 "장사했는데 0원" 인지 "적은 게 없다" 인지 구별이 안 된다.
    expect(screen.queryByText('일 손익 계산')).toBeNull();
    expect(screen.queryByText('채널별 매출')).toBeNull();
  });

  it('하단 버튼이 `판매 내역 추가` 다', () => {
    salesDay.mockReturnValue(query(empty()));
    render(<SalesDayDetailScreen />);
    expect(screen.getByText('판매 내역 추가')).toBeTruthy();
    expect(screen.queryByText('판매 내역 수정')).toBeNull();
  });
});

describe('진입 버튼', () => {
  it('기록이 있으면 `판매 내역 수정` 이고, 누르면 그 날짜로 간다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesDayDetailScreen />);
    fireEvent.click(screen.getByText('판매 내역 수정'));
    expect(push).toHaveBeenCalledWith('/sales/past?date=2026-08-20');
  });

  /*
   * ⚠ 여기가 이 파일의 핵심이다. 영업 중인 날에 버튼을 띄우면 사장님이 눌렀을 때
   *   서버가 45011 로 돌려보낸다 — 화면은 "왜 안 되지" 가 된다.
   */
  it.each([
    ['영업 중', 'open'],
    ['브레이크 중', 'break'],
  ] as const)('%s 인 날에는 안 띄운다', (_label, status) => {
    salesDay.mockReturnValue(query(day({ dayStatus: status })));
    render(<SalesDayDetailScreen />);
    expect(screen.queryByText('판매 내역 수정')).toBeNull();
    expect(screen.queryByText('판매 내역 추가')).toBeNull();
  });

  it('허용 기간 밖이면 안 띄운다', () => {
    salesDay.mockReturnValue(query(day({ editable: false })));
    render(<SalesDayDetailScreen />);
    expect(screen.queryByText('판매 내역 수정')).toBeNull();
    expect(screen.queryByText('판매 내역 추가')).toBeNull();
  });
});
