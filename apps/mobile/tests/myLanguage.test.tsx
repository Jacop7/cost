/**
 * MY-08 언어 화면(검토 J·K) —
 *   · 서버 설정이 오기 전에는 초안이 없다(로딩·오류 게이트). 실제 언어가 en-US 면 그 줄이 선택돼 있다.
 *   · 저장은 성공 콜백에서만 화면을 떠난다. 실패는 **화면 안 문구**(웹에서도 보인다), 저장 중엔
 *     버튼도 배경 터치도 잠긴다. 서버 언어가 바뀌면 초안을 새로 만든다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

const checked = (label: string) => screen.getByLabelText(label).getAttribute('aria-checked');
/** RN-web 의 Pressable 은 Modal 안에서 click 만으로는 안 눌린다 — 포인터 순서로 누른다(businessDayBar 시험과 같다). */
const press = (el: Element) => { fireEvent.pointerDown(el); fireEvent.pointerUp(el); fireEvent.click(el); };
const saveDisabled = () => screen.getByLabelText('저장').getAttribute('aria-disabled') === 'true';

/** 한국어를 고르고 확인 시트까지 연다. */
async function pickKoAndOpenSheet() {
  fireEvent.click(screen.getByLabelText('한국어'));
  fireEvent.click(screen.getByLabelText('저장'));
  await waitFor(() => expect(screen.getByText('이렇게 보여요')).toBeTruthy());
}

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
    expect(checked('English (US)')).toBe('true');
    expect(checked('한국어')).toBe('false');
    expect(saveDisabled()).toBe(true);
  });

  it('열어 둔 사이 서버 언어가 바뀌면 초안을 새로 만든다 — 낡은 초안이 새 값을 덮어쓰지 않는다', () => {
    const { rerender } = render(<MyLanguageScreen />);
    fireEvent.click(screen.getByLabelText('한국어'));
    expect(checked('한국어')).toBe('true');
    storeSettings.mockReturnValue(loaded('ja'));
    rerender(<MyLanguageScreen />);
    expect(checked('日本語')).toBe('true');
    expect(checked('한국어')).toBe('false');
    expect(saveDisabled()).toBe(true);
  });
});

describe('저장 흐름', () => {
  it('성공 콜백에서만 화면을 떠난다 — 요청 직후엔 안 떠난다', async () => {
    render(<MyLanguageScreen />);
    expect(saveDisabled()).toBe(true);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    // 언어만 보낸다 — 통화·금액 자릿수는 서버가 파생한다(0168). 단가 자릿수는 명시값(3)을 유지.
    expect(mutate.mock.calls[0]![0]).toEqual({ locale: 'ko', unitPriceDigits: 3 });
    expect(safeBack).not.toHaveBeenCalled();
    (mutate.mock.calls[0]![1] as { onSuccess: () => void }).onSuccess();
    expect(safeBack).toHaveBeenCalledWith('/my');
  });

  it('실패는 화면 안에 보이고(웹에서도) 시트에 남는다', async () => {
    render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    (mutate.mock.calls[0]![1] as { onError: (e: unknown) => void }).onError(new Error('지원하지 않는 언어예요'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('지원하지 않는 언어예요'));
    expect(screen.getByText('이렇게 보여요')).toBeTruthy();
    expect(safeBack).not.toHaveBeenCalled();
    // 다시 시도하면 옛 문구는 사라진다.
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  /*
   * 배경 터치(= Android 뒤로가기의 onRequestClose)는 Sheet 의 onClose 다. RN-web Modal 은 닫혀도
   * 애니메이션 끝 이벤트가 없는 jsdom 에서 DOM 을 바로 걷지 않으므로, 닫힘은 **closeSheet 의 부수효과**
   * (오류 문구 정리)로 잰다 — 저장 중이 아니면 지워지고, 저장 중이면 남는다.
   */
  it('저장 중이 아니면 배경 터치로 닫힌다 — 아래 차단 시험의 양성 대조', async () => {
    render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    (mutate.mock.calls[0]![1] as { onError: (e: unknown) => void }).onError(new Error('x'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    press(screen.getByLabelText('닫기'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('저장 중(pending 전환)엔 확정·취소·배경 터치가 모두 막힌다', async () => {
    const { rerender } = render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    (mutate.mock.calls[0]![1] as { onError: (e: unknown) => void }).onError(new Error('x'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    // 요청이 나가 있는 상태로 전환한다.
    pending = true;
    rerender(<MyLanguageScreen />);
    expect(screen.getByLabelText('언어 저장 확정').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('취소').closest('[aria-disabled]')?.getAttribute('aria-disabled')).toBe('true');
    press(screen.getByLabelText('닫기'));   // 배경 터치(= Android 뒤로가기와 같은 onClose) — 막혀야 한다
    expect(screen.getByRole('alert')).toBeTruthy();   // closeSheet 가 돌았다면 지워졌을 문구
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    expect(mutate).toHaveBeenCalledTimes(1);          // 연타해도 두 번 보내지 않는다
    expect(saveDisabled()).toBe(true);                 // 바깥 저장도 잠긴다
  });
});
