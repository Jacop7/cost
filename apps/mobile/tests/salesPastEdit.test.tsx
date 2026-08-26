/**
 * SALES-21 과거 판매 내역 수정·추가 화면 (기획서 §6.4).
 *
 * 여기서 재는 것은 **화면의 판단**이다 — 무엇을 보여 주고, 무엇을 서버로 보내고,
 * 서버가 코드로 거절했을 때 무엇을 말하는가.
 *
 * ⚠ 서버는 안 부른다. 훅을 대신 세우고 그 자리에서 응답을 만든다 —
 *   서버 쪽 계약은 DB 스위트 27·28 이 잰다. 여기서 또 재면 느리기만 하고
 *   무엇이 깨졌는지도 흐려진다.
 * ⚠ RN-web 으로 그린다. 무엇을 포기하는지는 `tests/setup.ts` 머리말에 적었다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RpcError } from '@/lib/supabase';
import type { SalesDay } from '@/features/sales/hooks';

const push = vi.fn();
const replace = vi.fn();

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ date: '2026-07-31' }),
  useRouter: () => ({ push, replace }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));

/** 서버가 정한 오늘. 화면은 이걸 받고 나서야 본체를 그린다(0125). */
vi.mock('@/features/sales/businessDay', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesBusinessDate: () => ({ date: '2026-08-26', isLoading: false, error: null, refetch: vi.fn() }),
}));

const salesDay = vi.fn();
const amendMutate = vi.fn();
vi.mock('@/features/sales/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSalesDay: () => salesDay(),
  useAmendPastSale: () => ({ mutate: amendMutate, isPending: false }),
}));

vi.mock('@/features/recipes/hooks', () => ({
  useRecipeList: () => ({
    data: [
      { id: 'r-1', name: '제육볶음' },
      { id: 'r-2', name: '김치찌개' },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import SalesPastEditScreen from '@/features/sales/screens/SalesPastEditScreen';

const SUMMARY = {
  from: '2026-07-31', to: '2026-07-31', days: 1, revenue: 0, etcRevenue: 0, qty: 0,
  materialCost: 0, extraMaterialCost: 0, tax: 0, wasteLoss: 0, wasteIngredient: 0,
  wasteMenu: 0, dailyExtra: 0, fixedCost: 0, fixedRate: null, fixedRateProvisional: true, profit: 0,
};

/** 그날 장부 한 벌. 시험마다 필요한 곳만 덮어쓴다. */
function day(over: Partial<SalesDay> = {}): SalesDay {
  return {
    saleDate: '2026-07-31', revision: 3,
    items: [], etcItems: [], extraItems: [], etcRevenue: 0, dailyExtra: 0,
    summary: SUMMARY,
    basisQuality: null, hasLedger: false, dayStatus: null, editable: true,
    ...over,
  };
}

const query = (d: SalesDay) => ({ data: d, isLoading: false, error: null, refetch: vi.fn() });

/** 메뉴 행을 눌러 수량 시트를 연다. */
function openRow(name: string, qty: number) {
  fireEvent.click(screen.getByLabelText(`${name} 판매 수량 ${qty}개`));
}
/** 시트에서 채널 수량을 n 번 늘리고 확인한다. */
function addTo(channel: string, times: number) {
  for (let i = 0; i < times; i += 1) fireEvent.click(screen.getByLabelText(`${channel} 판매량 늘리기`));
  fireEvent.click(screen.getByText('확인'));
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  amendMutate.mockReset();
});

describe('기록 없는 날 — 판매 내역 추가', () => {
  it('저장 전에는 아무 경고도 안 띄운다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesPastEditScreen />);
    /*
     * §6.4 — "빈 화면에서 경고 카드를 먼저 노출하지 않는다."
     * 한때 파란 안내 카드를 띄웠고 검토에서 잡혔다.
     */
    expect(screen.queryByText(/영업 기록이 없어요/)).toBeNull();
    expect(screen.queryByText(/당시 기록이 없어/)).toBeNull();
  });

  it('메뉴에 판매가·재료비를 안 적는다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesPastEditScreen />);
    // 그 값은 **그날 기준**이라 지금 레시피 값을 적으면 거짓말이 된다(§6.4).
    expect(screen.queryByText(/원/)).toBeNull();
    expect(screen.getByText('제육볶음')).toBeTruthy();
  });

  it('고친 게 없으면 저장을 못 누른다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesPastEditScreen />);
    fireEvent.click(screen.getByText('저장'));
    expect(amendMutate).not.toHaveBeenCalled();
  });

  it('수량을 넣고 저장하면 **확인을 먼저** 묻고, 확인해야 보낸다', async () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesPastEditScreen />);

    openRow('제육볶음', 0);
    addTo('매장', 3);
    fireEvent.click(screen.getByText('저장'));

    // 확인창이 뜨고, 아직 아무것도 안 보냈다.
    expect(screen.getByText('당시 기록이 없어 현재 판매가와 원가를 기준으로 저장해요.')).toBeTruthy();
    expect(amendMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByText('저장')[1]!);   // 확인창의 저장
    await waitFor(() => expect(amendMutate).toHaveBeenCalledTimes(1));

    const [input] = amendMutate.mock.calls[0]!;
    expect(input.date).toBe('2026-07-31');
    expect(input.baseRevision).toBe(3);              // 화면이 받은 판본을 그대로 되보낸다
    expect(input.items).toEqual([
      { recipeId: 'r-1', qtyHall: 3, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0 },
    ]);
  });

  it('확인창에서 취소하면 안 보낸다', () => {
    salesDay.mockReturnValue(query(day()));
    render(<SalesPastEditScreen />);

    openRow('제육볶음', 0);
    addTo('매장', 1);
    fireEvent.click(screen.getByText('저장'));
    fireEvent.click(screen.getByText('취소'));

    expect(amendMutate).not.toHaveBeenCalled();
  });
});

describe('기록 있는 날 — 판매 내역 수정', () => {
  const withSale = () => day({
    hasLedger: true, dayStatus: 'closed', basisQuality: 'exact',
    items: [{
      id: 'i-1', recipeId: 'r-1', menuName: '제육볶음', unitPrice: 12000,
      unitMaterialCost: 2806.4, unitExtraCost: 300,
      qtyHall: 4, qtyDelivery: 1, qtyTakeout: 0, qtyWaste: 0, qty: 5,
    }],
  });

  it('현재 수량을 보여 주고, 줄인 값을 보낸다', async () => {
    salesDay.mockReturnValue(query(withSale()));
    render(<SalesPastEditScreen />);

    expect(screen.getByText('5개')).toBeTruthy();     // 매장 4 + 배달 1

    openRow('제육볶음', 5);
    fireEvent.click(screen.getByLabelText('매장 판매량 줄이기'));
    fireEvent.click(screen.getByLabelText('매장 판매량 줄이기'));
    fireEvent.click(screen.getByText('확인'));
    fireEvent.click(screen.getByText('저장'));

    // 기록이 있는 날은 확인창 없이 바로 보낸다(§6.4 — 확인은 기록 없는 날만).
    await waitFor(() => expect(amendMutate).toHaveBeenCalledTimes(1));
    expect(amendMutate.mock.calls[0]![0].items).toEqual([
      { recipeId: 'r-1', qtyHall: 2, qtyDelivery: 1, qtyTakeout: 0, qtyWaste: 0 },
    ]);
  });

  it('**안 건드린 메뉴는 안 보낸다** — 부분 저장이다(0117)', async () => {
    salesDay.mockReturnValue(query(withSale()));
    render(<SalesPastEditScreen />);

    openRow('김치찌개', 0);
    addTo('포장', 2);
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => expect(amendMutate).toHaveBeenCalledTimes(1));
    const sent = amendMutate.mock.calls[0]![0].items as { recipeId: string }[];
    expect(sent.map((i) => i.recipeId)).toEqual(['r-2']);
  });

  /*
   * 그날 판 메뉴가 **지금 판매 중지**여도 목록에 남아야 한다(0149).
   * 빼면 그 수량을 영영 못 고친다 — `useRecipeList` 에는 없고 그날 판매에만 있는 메뉴다.
   */
  it('지금 판매 중지된 과거 메뉴도 목록에 남는다', () => {
    salesDay.mockReturnValue(query(day({
      hasLedger: true, dayStatus: 'closed', basisQuality: 'exact',
      items: [{
        id: 'i-9', recipeId: 'r-99', menuName: '소불고기', unitPrice: 15000,
        unitMaterialCost: 5000, unitExtraCost: 0,
        qtyHall: 2, qtyDelivery: 0, qtyTakeout: 0, qtyWaste: 0, qty: 2,
      }],
    })));
    render(<SalesPastEditScreen />);
    expect(screen.getByText('소불고기')).toBeTruthy();
    expect(screen.getByLabelText('소불고기 판매 수량 2개')).toBeTruthy();
  });
});

describe('허용 기간 밖', () => {
  it('고칠 수 없다고 적고, 저장도 막는다', () => {
    salesDay.mockReturnValue(query(day({ editable: false })));
    render(<SalesPastEditScreen />);
    expect(screen.getByText('지난달 1일부터 오늘까지만 고칠 수 있어요.')).toBeTruthy();
    fireEvent.click(screen.getByText('저장'));
    expect(amendMutate).not.toHaveBeenCalled();
  });
});

/**
 * 서버가 **코드로** 거절했을 때 화면이 무엇을 말하는가(0144·0145).
 * ⚠ 문구가 아니라 SQLSTATE 로 갈라야 한다 — 문구는 바뀌고 실제로 바뀌었다.
 */
describe('결과 코드별 화면 처리', () => {
  const failWith = (code: string) => {
    amendMutate.mockImplementation((_input, opts) => {
      opts?.onError?.(new RpcError('서버 문구', code, null));
    });
  };

  /** 고친 뒤 저장까지 한 번에. */
  const editAndSave = () => {
    render(<SalesPastEditScreen />);
    openRow('제육볶음', 0);
    addTo('매장', 1);
    fireEvent.click(screen.getByText('저장'));
  };

  beforeEach(() => {
    // 기록 있는 날 — 확인창을 건너뛰고 곧장 저장이 돌게 한다.
    salesDay.mockReturnValue(query(day({ hasLedger: true, dayStatus: 'closed', basisQuality: 'exact' })));
  });

  it('45011 DAY_IS_LIVE — 판매 화면으로 안내한다', async () => {
    failWith('45011');
    editAndSave();
    const toast = await screen.findByText('아직 영업 중인 날이에요. 매출관리 화면에서 저장해 주세요.');
    // 알림을 닫으면 매출관리로 보낸다 — 사장님이 갈 곳을 알려 준다.
    fireEvent.click(toast);
    expect(replace).toHaveBeenCalledWith('/sales');
  });

  it('45010 SALE_DATE_OUT_OF_RANGE — 기간을 알려 준다', async () => {
    failWith('45010');
    editAndSave();
    expect(await screen.findByText('지난달 1일부터 오늘까지만 고칠 수 있어요.')).toBeTruthy();
  });

  it('45009 REVISION_CONFLICT — 다시 불러온다고 알린다', async () => {
    const refetch = vi.fn();
    salesDay.mockReturnValue({
      ...query(day({ hasLedger: true, dayStatus: 'closed', basisQuality: 'exact' })), refetch,
    });
    failWith('45009');
    editAndSave();
    expect(await screen.findByText('다른 기기에서 이 날의 판매가 바뀌었어요. 다시 불러올게요.')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  /*
   * 45013 BASIS_NOT_AVAILABLE 은 화면이 따로 안 가른다 — 서버 문구를 그대로 보여 준다.
   * ⚠ 그걸 여기 적어 둔다. 안 적으면 "왜 45013 만 빠졌지" 를 다음 사람이 다시 판다.
   */
  it('45013 BASIS_NOT_AVAILABLE — 서버 문구를 그대로 보여 준다', async () => {
    failWith('45013');
    editAndSave();
    expect(await screen.findByText('서버 문구')).toBeTruthy();
  });
});

describe('저장 결과', () => {
  beforeEach(() => {
    salesDay.mockReturnValue(query(day({ hasLedger: true, dayStatus: 'closed', basisQuality: 'exact' })));
  });

  it('바뀐 게 없으면 그렇게 말한다 — 오류가 아니다(0148)', async () => {
    amendMutate.mockImplementation((_i, opts) => {
      opts?.onSuccess?.({ changed: false, created: false, revision: 3, auditRevisionNo: 0, basisQuality: 'exact', shortages: [] });
    });
    render(<SalesPastEditScreen />);
    openRow('제육볶음', 0);
    addTo('매장', 1);
    fireEvent.click(screen.getByText('저장'));
    expect(await screen.findByText('바뀐 내용이 없어요.')).toBeTruthy();
  });

  it('저장에 성공하면 고친 표시를 지운다 — 두 번 보내지 않는다', async () => {
    amendMutate.mockImplementation((_i, opts) => {
      opts?.onSuccess?.({ changed: true, created: false, revision: 4, auditRevisionNo: 1, basisQuality: 'exact', shortages: [] });
    });
    render(<SalesPastEditScreen />);
    openRow('제육볶음', 0);
    addTo('매장', 1);
    fireEvent.click(screen.getByText('저장'));
    expect(await screen.findByText('저장했어요.')).toBeTruthy();

    // 다시 눌러도 안 보낸다(고친 것이 없으므로 버튼이 잠긴다).
    fireEvent.click(screen.getByText('저장'));
    expect(amendMutate).toHaveBeenCalledTimes(1);
  });
});
