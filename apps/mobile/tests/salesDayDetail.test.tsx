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
const replace = vi.fn();
const discardDraft = vi.fn();
let feedStatus: 'completed' | 'editing' = 'completed';

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ date: '2026-08-20' }),
  useRouter: () => ({ push, replace }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/features/business-day/businessDay', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesBusinessDate: () => ({ date: '2026-08-26', isLoading: false, error: null, refetch: vi.fn() }),
}));

const salesDay = vi.fn();
vi.mock('@/features/sales/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesDay: () => salesDay(),
  useSalesRange: () => ({
    data: {
      from: '2026-08-20', to: '2026-08-20', summary: SUMMARY, daily: [], channels: [],
      menu: [{
        recipeId: 'r-1', menuName: '제육볶음', isDeleted: false,
        qty: 10, qtyHall: 8, qtyDelivery: 2, qtyTakeout: 0, qtyWaste: 0,
        revenue: 120000, unitPrice: 12000, unitMaterialCost: 2806.4, material: 28064,
        channels: [],
      }],
    },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
}));

vi.mock('@/features/sales/lifecycle', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesFeed: () => ({
    data: { items: [{ businessDate: '2026-08-20', status: feedStatus, draftId: feedStatus === 'editing' ? 'draft-1' : null, versionId: feedStatus === 'completed' ? 'v1' : null,
      sales: 120000, netSales: 109091, qty: 10, expense: 79534, profit: 40466, profitRate: 33.7,
      canEdit: true, canClassify: false, calendarRevision: 0, blockedReason: null, action: feedStatus === 'editing' ? 'resume' : 'detail' }] },
    isLoading: false, error: null, refetch: vi.fn(),
  }),
  useSalesDraft: () => ({ data: feedStatus === 'editing' ? {
    id: 'draft-1', businessDate: '2026-08-20', kind: 'initial', status: 'editing', revision: 0,
    payloadHash: 'hash', expiresAt: '2026-08-21T00:00:00Z', channels: [], items: [], etcItems: [], extraItems: [], summary: null,
  } : undefined, isLoading: false, error: null }),
  useDiscardSalesDraft: () => ({ mutateAsync: discardDraft, isPending: false, error: null }),
  useCloseSalesDraftAsHoliday: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useSetSalesCalendarDay: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
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

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  discardDraft.mockReset();
  discardDraft.mockResolvedValue({ status: 'discarded' });
  feedStatus = 'completed';
});

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
    expect(screen.queryByText('손익 계산')).toBeNull();
    expect(screen.queryByText('채널별 매출')).toBeNull();
  });

  it('하단 버튼이 `판매 내역 추가` 다', () => {
    salesDay.mockReturnValue(query(empty()));
    render(<SalesDayDetailScreen />);
    fireEvent.click(screen.getByText('판매 내역 추가'));
    expect(screen.getByText('작성 하시겠습니까?')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(push).toHaveBeenCalledWith('/sales/write?date=2026-08-20&start=1');
    expect(screen.queryByText('판매 내역 수정')).toBeNull();
  });
});

describe('매출 분석과 공통 구성', () => {
  it('손익 계산을 먼저 두고 총 지출과 채널별 매출을 같은 순서로 표시한다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesDayDetailScreen />);

    expect(screen.getByText('총 지출')).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text.indexOf('손익 계산')).toBeLessThan(text.indexOf('채널별 매출'));
    expect(text.indexOf('채널별 매출')).toBeLessThan(text.indexOf('메뉴별 판매량'));
  });

  it('메뉴별 판매량 행을 누르면 중간 팝업 없이 그날의 메뉴 손익 상세로 바로 이동한다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesDayDetailScreen />);

    fireEvent.click(screen.getByRole('button', { name: '제육볶음 손익 보기' }));

    expect(push).toHaveBeenCalledWith('/sales/menu?recipe=r-1&from=2026-08-20&to=2026-08-20');
    expect(screen.queryByRole('button', { name: '메뉴 손익 자세히 보기' })).toBeNull();
  });
});

describe('진입 버튼', () => {
  it('작성 완료 상태의 세로 메뉴에 수정·초기화·휴무 처리·닫기를 표시한다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesDayDetailScreen />);
    fireEvent.click(screen.getByRole('button', { name: '손익 계산 메뉴 열기' }));
    expect(screen.getByRole('button', { name: '수정' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '초기화' }).getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.getByRole('button', { name: '휴무 처리' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy();
  });

  it('작성 중 초기화 뒤 매출 작성 또는 매출관리 목록 이동을 선택한다', async () => {
    feedStatus = 'editing';
    salesDay.mockReturnValue(query(day({ items: [], hasLedger: false, dayStatus: null,
      summary: { ...SUMMARY, revenue: 0, qty: 0, profit: 0 } })));
    render(<SalesDayDetailScreen />);

    fireEvent.click(screen.getByRole('button', { name: '손익 계산 메뉴 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByText('초기화를 진행하시겠습니까?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    expect(await screen.findByText('초기화가 완료되었습니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '작성하기' }));
    expect(replace).toHaveBeenCalledWith('/sales/write?date=2026-08-20&start=1');
  });

  it('작성 중 초기화 뒤 나중에를 선택하면 빈 손익 화면 대신 매출관리 목록으로 이동한다', async () => {
    feedStatus = 'editing';
    salesDay.mockReturnValue(query(day({ items: [], hasLedger: false, dayStatus: null,
      summary: { ...SUMMARY, revenue: 0, qty: 0, profit: 0 } })));
    render(<SalesDayDetailScreen />);

    fireEvent.click(screen.getByRole('button', { name: '손익 계산 메뉴 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(await screen.findByText('초기화가 완료되었습니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '나중에' }));

    expect(replace).toHaveBeenCalledWith('/sales');
  });

  it('기록이 있으면 `판매 내역 수정` 이고, 누르면 그 날짜로 간다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesDayDetailScreen />);
    fireEvent.click(screen.getByText('판매 내역 수정'));
    expect(push).toHaveBeenCalledWith('/sales/write?date=2026-08-20');
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
