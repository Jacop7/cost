/** MY 설정 화면의 로딩·저장·판본 충돌 흐름. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RpcError } from '@/lib/supabase';
import type { StoreSettings } from '@/features/settings/hooks';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));
vi.mock('@/lib/nav', () => ({ safeBack: vi.fn() }));

const SETTINGS: StoreSettings = {
  unitSystem: 'metric', cupVolume: 200, defaultTargetProfitRate: 40,
  locale: 'ko', currency: 'KRW', unitPriceDigits: 2, quantityDigits: 2, moneyDigits: 0,
  alertMorningSummary: true, alertInboundDelay: true, alertPriceSpike: true, alertTargetMiss: true,
  openTime: '11:00', closeTime: '22:00', breakStart: null, breakEnd: null,
  overnight: false, openMinutes: 660, taxMode: 'included', taxItems: [{ name: '부가세', rate: 9.09 }], revision: 4,
};

const settingsQuery = vi.fn();
const saveSettingsMutate = vi.fn();
const saveTaxMutate = vi.fn();
let settingsPending = false;
let taxPending = false;
vi.mock('@/features/settings/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useStoreSettings: () => settingsQuery(),
  useSaveSettings: () => ({ mutate: saveSettingsMutate, isPending: settingsPending }),
  useSaveStoreTax: () => ({ mutate: saveTaxMutate, isPending: taxPending }),
}));

const appSettings = vi.fn();
const setUnitDigits = vi.fn();
const setCupVolume = vi.fn();
let unitSaving = false;
vi.mock('@/features/my/store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSettings: () => appSettings(),
  useSettingsActions: () => ({ setUnitDigits, setCupVolume, saving: unitSaving }),
  useUnitDigits: () => 2,
}));
vi.mock('@/features/international-tax', () => ({
  useAppCapabilities: () => ({ data: { internationalTax: { readEnabled: false, writeEnabled: false } }, isLoading: false, isError: false }),
  useInternationalTaxState: vi.fn(),
}));

import MyNotificationsScreen from '@/features/my/screens/MyNotificationsScreen';
import MyTaxScreen from '@/features/my/screens/MyTaxScreen';
import MyUnitsScreen from '@/features/my/screens/MyUnitsScreen';

const query = (data: StoreSettings = SETTINGS) => ({
  data, isLoading: false, isError: false, error: null,
  refetch: vi.fn(async () => ({ data, isError: false })),
});
const unitState = (over: Record<string, unknown> = {}) => ({
  locale: 'ko', revision: 4, unitSystem: 'metric', cupVolume: 333.5,
  unitDigits: 2, loading: false, error: false, hasData: true,
  refetch: vi.fn(async () => ({ locale: 'ko', revision: 4, unitSystem: 'metric', cupVolume: 333.5 })), ...over,
});

beforeEach(() => {
  settingsPending = false; taxPending = false; unitSaving = false;
  saveSettingsMutate.mockReset(); saveTaxMutate.mockReset(); setUnitDigits.mockReset(); setCupVolume.mockReset();
  settingsQuery.mockReset(); appSettings.mockReset();
  settingsQuery.mockReturnValue(query());
  appSettings.mockReturnValue(unitState());
});

describe('알림 설정', () => {
  it('화면에 보였던 판본을 보내고, 실패를 웹에서도 보이는 문구로 알린다', async () => {
    render(<MyNotificationsScreen />);
    fireEvent.click(screen.getByLabelText('단가 급등'));
    expect(saveSettingsMutate.mock.calls[0]![0]).toEqual({ values: { alertPriceSpike: false }, baseRevision: 4 });
    const cb = saveSettingsMutate.mock.calls[0]![1] as { onError: (e: unknown) => void };
    cb.onError(new Error('네트워크 오류'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('네트워크 오류'));
  });

  it('45009면 저장을 막고 실제 재조회가 성공해야 풀린다', async () => {
    const q = query();
    const fresh = { ...SETTINGS, revision: 5, alertPriceSpike: false };
    q.refetch
      .mockResolvedValueOnce({ data: SETTINGS, isError: false })
      .mockResolvedValueOnce({ data: fresh, isError: false });
    settingsQuery.mockReturnValue(q);
    const { rerender } = render(<MyNotificationsScreen />);
    fireEvent.click(screen.getByLabelText('단가 급등'));
    const cb = saveSettingsMutate.mock.calls[0]![1] as { onError: (e: unknown) => void };
    cb.onError(new RpcError('충돌', '45009', 'REVISION_CONFLICT'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByLabelText('입고 지연').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(q.refetch).toHaveBeenCalledTimes(1));
    // 충돌에 사용한 판본(4)과 같은 늦은 응답은 최신값이 아니다. 잠금을 풀면 45009가 반복된다.
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByLabelText('입고 지연').getAttribute('aria-disabled')).toBe('true');
    await waitFor(() => expect(screen.getByLabelText('새로고침').getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(q.refetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    settingsQuery.mockReturnValue(query(fresh));
    rerender(<MyNotificationsScreen />);
    fireEvent.click(screen.getByLabelText('입고 지연'));
    expect(saveSettingsMutate.mock.calls.at(-1)![0]).toEqual({ values: { alertInboundDelay: false }, baseRevision: 5 });
  });
});

describe('단위 설정', () => {
  it('로딩·최초 오류를 데모 기본값으로 위장하지 않는다', () => {
    appSettings.mockReturnValue(unitState({ loading: true, hasData: false, revision: null }));
    const { rerender } = render(<MyUnitsScreen />);
    expect(screen.getByText('불러오는 중…')).toBeTruthy();
    appSettings.mockReturnValue(unitState({ loading: false, error: true, hasData: false, revision: null }));
    rerender(<MyUnitsScreen />);
    expect(screen.getByText('설정을 불러오지 못했어요')).toBeTruthy();
  });

  it('배경 재조회 실패의 다시 시도는 수정 중인 컵 초안을 보존한다', async () => {
    const { rerender } = render(<MyUnitsScreen />);
    fireEvent.change(screen.getByLabelText('1컵 용량'), { target: { value: '777.25' } });
    const refetch = vi.fn(async () => ({ locale: 'ko', revision: 4, unitSystem: 'metric', cupVolume: 333.5 }));
    const stale = unitState({ error: true, refetch });
    appSettings.mockReturnValue(stale);
    rerender(<MyUnitsScreen />);
    expect(screen.getByLabelText('재조회 실패')).toBeTruthy();
    expect(screen.getByLabelText('컵 용량 저장').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByLabelText('다시 시도'));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));

    appSettings.mockReturnValue(unitState());
    rerender(<MyUnitsScreen />);
    expect(screen.getByLabelText('1컵 용량').getAttribute('value')).toBe('777.25');
    expect(screen.getByLabelText('컵 용량 저장').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('45009면 초안을 지키고 새로고침 전까지 저장을 막는다', async () => {
    const freshRefetch = vi.fn()
      .mockResolvedValueOnce({ locale: 'ko', revision: 4, unitSystem: 'metric', cupVolume: 333.5 })
      .mockResolvedValueOnce({ locale: 'ko', revision: 5, unitSystem: 'metric', cupVolume: 444.25 });
    appSettings.mockReturnValue(unitState({ refetch: freshRefetch }));
    const { rerender } = render(<MyUnitsScreen />);
    fireEvent.click(screen.getByLabelText('단가 소수 3자리'));
    expect(setUnitDigits.mock.calls[0]!.slice(0, 2)).toEqual([3, 4]);
    const cb = setUnitDigits.mock.calls[0]![2] as { onError: (e: unknown) => void };
    cb.onError(new RpcError('충돌', '45009', 'REVISION_CONFLICT'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(freshRefetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(freshRefetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    appSettings.mockReturnValue(unitState({ revision: 5, cupVolume: 444.25 }));
    rerender(<MyUnitsScreen />);
    fireEvent.click(screen.getByLabelText('단가 소수 3자리'));
    expect(setUnitDigits.mock.calls.at(-1)!.slice(0, 2)).toEqual([3, 5]);
  });

  it('서버의 컵 용량을 표시하고, 바꾼 값과 화면 판본을 저장한다', async () => {
    const { rerender } = render(<MyUnitsScreen />);
    const input = screen.getByLabelText('1컵 용량');
    expect(input.getAttribute('value')).toBe('333.5');
    expect(screen.queryByText('미국식')).toBeNull();
    expect(screen.queryByText('큰스푼')).toBeNull();

    fireEvent.change(input, { target: { value: '444.25' } });
    fireEvent.click(screen.getByLabelText('컵 용량 저장'));
    expect(setCupVolume.mock.calls[0]!.slice(0, 2)).toEqual([444.25, 4]);
    const cb = setCupVolume.mock.calls[0]![2] as { onSuccess: (r: { changed: boolean; revision: number }) => void };
    cb.onSuccess({ changed: true, revision: 5 });
    // 저장보다 먼저 시작된 옛 조회(rev 4)가 늦게 와도 방금 저장한 444/rev 5를 되돌리면 안 된다.
    rerender(<MyUnitsScreen />);
    expect(screen.getByLabelText('1컵 용량').getAttribute('value')).toBe('444.25');
    await waitFor(() => expect(screen.getByLabelText('컵 용량 저장').getAttribute('aria-disabled')).toBe('true'));
    fireEvent.click(screen.getByLabelText('단가 소수 3자리'));
    expect(setUnitDigits.mock.calls[0]!.slice(0, 2)).toEqual([3, 5]);

    // 뒤이어 최신 캐시가 도착해도 같은 값·판본을 유지한다.
    appSettings.mockReturnValue(unitState({ revision: 5, cupVolume: 444.25 }));
    rerender(<MyUnitsScreen />);
    expect(screen.getByLabelText('1컵 용량').getAttribute('value')).toBe('444.25');
  });

  it('배경의 더 높은 판본은 수정 전엔 동기화하고, 수정 중엔 초안과 충돌 배너를 지킨다', async () => {
    const { rerender } = render(<MyUnitsScreen />);
    appSettings.mockReturnValue(unitState({ revision: 5, cupVolume: 444.25 }));
    rerender(<MyUnitsScreen />);
    await waitFor(() => expect(screen.getByLabelText('1컵 용량').getAttribute('value')).toBe('444.25'));
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.change(screen.getByLabelText('1컵 용량'), { target: { value: '555' } });
    appSettings.mockReturnValue(unitState({ revision: 6, cupVolume: 666 }));
    rerender(<MyUnitsScreen />);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByLabelText('1컵 용량').getAttribute('value')).toBe('555');
    expect(screen.getByLabelText('컵 용량 저장').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('세금 설정', () => {
  it('편집 시작 판본을 보내고 45009면 초안을 유지한 채 새로고침을 요구한다', async () => {
    const q = query();
    const fresh: StoreSettings = { ...SETTINGS, revision: 5, taxItems: [{ name: '새 세금', rate: 5 }] };
    q.refetch
      .mockResolvedValueOnce({ data: SETTINGS, isError: false })
      .mockResolvedValueOnce({ data: fresh, isError: false });
    settingsQuery.mockReturnValue(q);
    const { rerender } = render(<MyTaxScreen />);
    await waitFor(() => expect(screen.getByLabelText('항목 1 이름').getAttribute('value')).toBe('부가세'));
    fireEvent.click(screen.getByText('저장'));
    expect(saveTaxMutate.mock.calls[0]![0]).toEqual({ items: [{ name: '부가세', rate: 9.09 }], baseRevision: 4 });
    const cb = saveTaxMutate.mock.calls[0]![1] as { onError: (e: unknown) => void };
    cb.onError(new RpcError('충돌', '45009', 'REVISION_CONFLICT'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByLabelText('항목 1 이름').getAttribute('value')).toBe('부가세');
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(q.refetch).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByLabelText('항목 1 이름').getAttribute('value')).toBe('부가세');
    await waitFor(() => expect(screen.getByLabelText('새로고침').getAttribute('aria-disabled')).not.toBe('true'));
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(q.refetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    settingsQuery.mockReturnValue(query(fresh));
    rerender(<MyTaxScreen />);
    await waitFor(() => expect(screen.getByLabelText('항목 1 이름').getAttribute('value')).toBe('새 세금'));
    fireEvent.change(screen.getByLabelText('항목 1 요율'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('저장'));
    expect(saveTaxMutate.mock.calls.at(-1)![0]).toEqual({ items: [{ name: '새 세금', rate: 6 }], baseRevision: 5 });
  });

  it('배경 재조회 실패의 다시 시도는 세금 초안을 보존한다', async () => {
    const q = query();
    settingsQuery.mockReturnValue(q);
    const { rerender } = render(<MyTaxScreen />);
    await waitFor(() => expect(screen.getByLabelText('항목 1 요율')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('항목 1 요율'), { target: { value: '8.5' } });
    const staleRefetch = vi.fn(async () => ({ data: SETTINGS, isError: false }));
    settingsQuery.mockReturnValue({ ...q, isError: true, refetch: staleRefetch });
    rerender(<MyTaxScreen />);
    fireEvent.click(screen.getByText('다시 시도'));
    await waitFor(() => expect(staleRefetch).toHaveBeenCalledTimes(1));
    settingsQuery.mockReturnValue(query());
    rerender(<MyTaxScreen />);
    expect(screen.getByLabelText('항목 1 요율').getAttribute('value')).toBe('8.5');
    fireEvent.click(screen.getByText('저장'));
    expect(saveTaxMutate.mock.calls.at(-1)![0]).toEqual({ items: [{ name: '부가세', rate: 8.5 }], baseRevision: 4 });
  });

  it('저장 중엔 입력·추가·삭제를 다 잠그고, 일반 실패는 화면 안에 보인다', async () => {
    taxPending = true;
    const { rerender } = render(<MyTaxScreen />);
    await waitFor(() => expect(screen.getByLabelText('항목 1 이름').hasAttribute('readonly')).toBe(true));
    expect(screen.getByLabelText('세금 항목 추가').getAttribute('aria-disabled')).toBe('true');

    taxPending = false;
    rerender(<MyTaxScreen />);
    fireEvent.click(screen.getByText('저장'));
    const cb = saveTaxMutate.mock.calls[0]![1] as { onError: (e: unknown) => void };
    cb.onError(new Error('저장 실패'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('저장 실패'));
  });
});
