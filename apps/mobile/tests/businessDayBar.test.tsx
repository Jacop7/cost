/**
 * 영업 상태 카드(BusinessDayBar) — 상태별 표시와 전이 호출.
 *
 * 여기서 재는 것은 **화면의 판단**이다 — 상태마다 무엇을 그리고(시작 버튼 ·
 * 마감하고 시작 · 셀렉터 · 종료 pill), 셀렉터가 어느 전이를 부르는가.
 * 전이의 서버 계약(45014·감사)은 DB 스위트 30 이 잰다.
 * ⚠ RN-web 으로 그린다. 무엇을 포기하는지는 `tests/setup.ts` 머리말에 적었다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { BusinessDayState } from '@/features/sales/businessDay';
import { RpcError } from '@/lib/supabase';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));

const openMutate = vi.fn();
const breakMutate = vi.fn();
const closeMutate = vi.fn();
const staleMutate = vi.fn();
vi.mock('@/features/sales/businessDay', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOpenBusinessDay: () => ({ mutate: openMutate, isPending: false }),
  useSetBreak: () => ({ mutate: breakMutate, isPending: false }),
  useCloseBusinessDay: () => ({ mutate: closeMutate, isPending: false }),
  useCloseStaleAndOpen: () => ({ mutate: staleMutate, isPending: false }),
}));

/** 부족 확인 — 카드 시험에서는 늘 "부족 없음". 부족 흐름은 자체 시트 시험 몫이다. */
vi.mock('@/features/sales/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useCheckRecipeShortages: () => async () => ({ ingredientCount: 0, recipes: [] }),
}));

import { BusinessDayBar } from '@/features/sales/components/BusinessDayBar';

function state(over: Partial<BusinessDayState> = {}): BusinessDayState {
  return {
    today: '2026-08-26', localDate: '2026-08-26', timezone: 'Asia/Seoul',
    status: 'none', businessDayId: null, businessDate: '2026-08-26',
    openedAt: null, plannedCloseAt: null, closedAt: null, closeMethod: null,
    staleDay: false,
    hours: { openTime: '11:00:00', closeTime: '22:00:00', breakStart: null, breakEnd: null, overnight: false },
    ...over,
  };
}

beforeEach(() => {
  openMutate.mockReset(); breakMutate.mockReset(); closeMutate.mockReset(); staleMutate.mockReset();
});

describe('상태별 표시', () => {
  it('영업 전 — 시작 버튼과 영업시간', () => {
    render(<BusinessDayBar state={state()} />);
    expect(screen.getByLabelText('영업 시작')).toBeTruthy();
    expect(screen.getByText('11:00–22:00')).toBeTruthy();
  });

  it('안 닫힌 옛 날 — 같은 자리에 `마감하고 시작`', () => {
    render(<BusinessDayBar state={state({ status: 'open', staleDay: true, businessDate: '2026-08-24' })} />);
    expect(screen.getByLabelText('지난 장사 마감하고 오늘 시작')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('지난 장사 마감하고 오늘 시작'));
    expect(staleMutate).toHaveBeenCalledTimes(1);
  });

  it('영업 중 — 파란 셀렉터가 상태를 겸한다', () => {
    render(<BusinessDayBar state={state({ status: 'open', businessDayId: 'd-1' })} />);
    expect(screen.getByLabelText('영업 중 바꾸기')).toBeTruthy();
  });

  it('직접 종료 — 실제 종료 시각, `영업 종료` pill', () => {
    render(<BusinessDayBar state={state({
      status: 'closed', closeMethod: 'manual',
      closedAt: '2026-08-26T21:30:00+09:00', plannedCloseAt: '2026-08-26T22:00:00+09:00',
    })} />);
    expect(screen.getByText('영업 종료')).toBeTruthy();
    expect(screen.getByText('11:00–21:30')).toBeTruthy();
  });

  /*
   * ⚠ 자동 종료는 closedAt(기한 = 예정 + 유예 23:00)이 아니라 예정 종료(22:00)로
   *   그린다(0138) — 두 값은 뜻이 다르다. 여기가 흔들리면 §6.1 의 11:00–22:00 이 깨진다.
   */
  it('자동 종료 — 예정 종료 시각으로 그리고 `자동 영업종료`', () => {
    render(<BusinessDayBar state={state({
      status: 'closed', closeMethod: 'auto',
      closedAt: '2026-08-26T23:00:00+09:00', plannedCloseAt: '2026-08-26T22:00:00+09:00',
    })} />);
    expect(screen.getByText('자동 영업종료')).toBeTruthy();
    expect(screen.getByText('11:00–22:00')).toBeTruthy();
  });
});

describe('전이 호출', () => {
  it('영업 중 셀렉터 → 브레이크 타임', () => {
    render(<BusinessDayBar state={state({ status: 'open', businessDayId: 'd-1' })} />);
    fireEvent.click(screen.getByLabelText('영업 중 바꾸기'));
    fireEvent.click(screen.getByLabelText('브레이크 타임'));
    expect(breakMutate).toHaveBeenCalledWith(true, expect.anything());
  });

  it('브레이크 셀렉터 → 영업 재개', () => {
    render(<BusinessDayBar state={state({ status: 'break', businessDayId: 'd-1' })} />);
    fireEvent.click(screen.getByLabelText('브레이크 중 바꾸기'));
    fireEvent.click(screen.getByLabelText('영업 재개'));
    expect(breakMutate).toHaveBeenCalledWith(false, expect.anything());
  });

  it('영업 종료는 확인 시트를 거친다', () => {
    render(<BusinessDayBar state={state({ status: 'open', businessDayId: 'd-1' })} />);
    fireEvent.click(screen.getByLabelText('영업 중 바꾸기'));
    fireEvent.click(screen.getByLabelText('영업 종료'));
    // 아직 안 부른다 — 확인이 먼저다.
    expect(closeMutate).not.toHaveBeenCalled();
    expect(screen.getByText('오늘 장사를 마칠까요?')).toBeTruthy();
    /*
     * ⚠ 같은 글자가 둘이다 — 보이는 확인 버튼과, 닫힌 관리 시트의 숨은 줄
     *   (RN-web Modal 은 visible=false 여도 노드를 DOM 에 남긴다).
     *   JSX 순서상 확인 시트가 관리 시트보다 앞이라 첫 번째가 보이는 쪽이다.
     */
    fireEvent.click(screen.getAllByText('영업 종료')[0]!);
    expect(closeMutate).toHaveBeenCalledTimes(1);
  });

  it('늦은 개점(45015)이면 마칠 시간을 골라 다시 연다 (0162)', async () => {
    // 첫 시도는 45015 — 규칙 종료가 지난 시각의 시작이다.
    openMutate.mockImplementationOnce((_arg: unknown, opts?: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new RpcError('오늘 영업시간이 이미 지났어요', '45015', 'LATE_OPEN'));
    });
    render(<BusinessDayBar state={state()} />);
    fireEvent.click(screen.getByLabelText('영업 시작'));
    fireEvent.click(screen.getAllByText('영업 시작').at(-1)!);   // 확인 시트
    await vi.waitFor(() => expect(screen.getByText('오늘은 몇 시까지 하실까요?')).toBeTruthy());

    /*
     * ⚠ RN-web Pressable(Modal 안)은 click 만으로는 안 눌린다 — pointer 시퀀스가
     *   필요하다(실측: click 단독은 첫 상호작용이 조용히 삼켜졌다).
     */
    /*
     * ⚠ 시트 안 슬롯 Pressable 은 이 하네스에서 **전체 실행 시** 안 눌린다 — 격리 실행은
     *   pointer 시퀀스로 눌리는데 전체 스위트에선 조용하다(RN-web 반응계의 전역 상태로
     *   추정). 슬롯 상호작용은 setup.ts 의 '안 재는 것' 목록에 속한다.
     *   여기서 재는 계약은 "45015 → 시트 → **고른 시간이 같은 전이에 실려 재전송**"이고,
     *   기본 제안값(매장 현지 지금+1h, 15분 올림)도 고른 시간이다.
     */
    const press = (el: Element) => {
      fireEvent.pointerDown(el); fireEvent.pointerUp(el); fireEvent.click(el);
    };
    await vi.waitFor(() => {
      press(screen.getByText('이 시간으로 시작'));
      expect(openMutate.mock.calls.length).toBeGreaterThan(1);
    });
    expect(openMutate).toHaveBeenLastCalledWith(
      { closeTime: expect.stringMatching(/^([01][0-9]|2[0-3]):(00|15|30|45)$/) },
      expect.anything(),
    );
  });

  it('영업 시작도 확인 시트를 거친다 — 오늘 값 굳힘 안내', async () => {
    render(<BusinessDayBar state={state()} />);
    fireEvent.click(screen.getByLabelText('영업 시작'));
    expect(screen.getByText('오늘 값을 지금으로 굳힐까요?')).toBeTruthy();
    expect(openMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByText('영업 시작').at(-1)!);
    // 부족 확인(비동기, 0건)을 지나 시작이 불린다.
    await vi.waitFor(() => expect(openMutate).toHaveBeenCalledTimes(1));
  });
});
