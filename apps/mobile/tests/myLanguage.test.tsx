/**
 * MY-08 언어 화면(검토 J) —
 *   · 서버 설정이 오기 전에는 초안이 없다(로딩·오류 게이트). 실제 언어가 en-US 면 그 줄이 선택돼 있다.
 *   · 저장은 성공 콜백에서만 화면을 떠난다. 실패는 알림, 저장 중엔 버튼이 잠긴다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  router: { canGoBack: () => true, back: vi.fn(), replace: vi.fn() },
}));
const safeBack = vi.fn();
vi.mock('@/lib/nav', () => ({ safeBack: (...a: unknown[]) => safeBack(...a) }));

const storeSettings = vi.fn();
const mutate = vi.fn();
let pending = false;
vi.mock('@/features/my/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useStoreSettings: () => storeSettings(),
  useSaveSettings: () => ({ mutate, isPending: pending }),
}));

import MyLanguageScreen from '@/features/my/screens/MyLanguageScreen';

// 단가 자릿수 3 = 명시값(en-US 기본 4 와 다름) — 언어를 바꿔도 유지돼야 한다.
const loaded = (locale: string, unitPriceDigits = 3) => ({
  data: { locale, unitPriceDigits, currency: 'USD', moneyDigits: 2 },
  isLoading: false, isError: false, refetch: vi.fn(),
});

beforeEach(() => {
  mutate.mockReset(); safeBack.mockReset(); pending = false;
  storeSettings.mockReturnValue(loaded('en-US'));
});

describe('언어 화면 게이트', () => {
  it('로딩 중엔 초안도 저장 버튼도 없다 — 기본값 ko 로 굳지 않는다', () => {
    storeSettings.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    render(<MyLanguageScreen />);
    expect(screen.getByText('불러오는 중…')).toBeTruthy();
    expect(screen.queryByLabelText('한국어')).toBeNull();
    expect(screen.queryByLabelText('저장')).toBeNull();
  });

  it('오류는 오류라고 말하고 다시 시도를 준다', () => {
    const refetch = vi.fn();
    storeSettings.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<MyLanguageScreen />);
    expect(screen.getByText('설정을 불러오지 못했어요')).toBeTruthy();
    fireEvent.click(screen.getByText('다시 시도'));
    expect(refetch).toHaveBeenCalled();
  });

  it('서버 언어(en-US)가 선택된 채 시작한다 — 저장은 잠겨 있다', () => {
    render(<MyLanguageScreen />);
    expect(screen.getByLabelText('English (US)').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('한국어').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByLabelText('저장').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('저장 흐름', () => {
  it('성공 콜백에서만 화면을 떠난다 — 요청 직후엔 안 떠난다', async () => {
    render(<MyLanguageScreen />);
    fireEvent.click(screen.getByLabelText('한국어'));
    expect(screen.getByLabelText('저장').getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(screen.getByLabelText('저장'));
    await waitFor(() => expect(screen.getByText('이렇게 보여요')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    // 언어만 보낸다 — 통화·금액 자릿수는 서버가 파생한다(0168). 단가 자릿수는 명시값(3)을 유지.
    expect(mutate.mock.calls[0]![0]).toEqual({ locale: 'ko', unitPriceDigits: 3 });
    expect(safeBack).not.toHaveBeenCalled();
    (mutate.mock.calls[0]![1] as { onSuccess: () => void }).onSuccess();
    expect(safeBack).toHaveBeenCalledWith('/my');
  });

  it('실패는 알리고 화면에 남는다', async () => {
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<MyLanguageScreen />);
    fireEvent.click(screen.getByLabelText('한국어'));
    fireEvent.click(screen.getByLabelText('저장'));
    await waitFor(() => expect(screen.getByText('이렇게 보여요')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    (mutate.mock.calls[0]![1] as { onError: (e: unknown) => void }).onError(new Error('지원하지 않는 언어예요'));
    expect(alert).toHaveBeenCalledWith('저장하지 못했어요', '지원하지 않는 언어예요');
    expect(safeBack).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('저장 중엔 확정 버튼이 잠긴다 — 연타로 두 번 보내지 않는다', async () => {
    pending = true;
    render(<MyLanguageScreen />);
    fireEvent.click(screen.getByLabelText('한국어'));
    // 바깥 저장도 저장 중엔 잠긴다.
    expect(screen.getByLabelText('저장').getAttribute('aria-disabled')).toBe('true');
  });
});
