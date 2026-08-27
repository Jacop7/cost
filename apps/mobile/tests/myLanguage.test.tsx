/**
 * MY-08 언어 화면(검토 J·K·L) —
 *   · 서버 설정이 오기 전에는 초안이 없다(로딩·오류 게이트). 실제 언어가 en-US 면 그 줄이 선택돼 있다.
 *   · 저장은 성공 콜백에서만 화면을 떠난다. 실패는 **화면 안 문구**(웹에서도 보인다), 저장 중엔
 *     버튼도 배경 터치도 잠긴다 — 실제 생명주기 순서(요청 → pending → 콜백)로 잰다.
 *   · 서버 언어가 바뀌면: 수정 전엔 조용히 따르고, 수정·저장 중엔 초안을 지키며 알린다(새로고침으로 동기화).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RpcError } from '@/lib/supabase';

/**
 * RN-web 의 Modal 은 닫힘 애니메이션 끝(animationend)에야 DOM 을 걷는데 jsdom 엔 애니메이션이 없어
 * 닫힌 시트가 영원히 남는다. 시트의 열림/닫힘을 **DOM 으로 재기 위해** Modal 만 visible 에 따라
 * 즉시 그리거나 지우는 것으로 바꾼다(나머지 react-native 는 원본).
 */
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  const Modal = ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) => (visible ? <>{children}</> : null);
  return { ...rn, Modal };
});

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
  isLoading: false, isError: false,
  // react-query 의 refetch 처럼 결과 객체로 resolve 한다(store 가 data.locale 을 읽는다).
  refetch: vi.fn(async (): Promise<{ data: { locale: string; unitPriceDigits: number; currency: string; moneyDigits: number } | undefined; isError: boolean }> =>
    ({ data: { locale, unitPriceDigits, currency: 'USD', moneyDigits: 2 }, isError: false })),
});

const checked = (label: string) => screen.getByLabelText(label).getAttribute('aria-checked');
const disabled = (label: string) => screen.getByLabelText(label).getAttribute('aria-disabled') === 'true';
/** RN-web 의 Pressable 은 Modal 안에서 click 만으로는 안 눌린다 — 포인터 순서로 누른다(businessDayBar 시험과 같다). */
const press = (el: Element) => { fireEvent.pointerDown(el); fireEvent.pointerUp(el); fireEvent.click(el); };
const sheetOpen = () => screen.queryByText('이렇게 보여요') !== null;
const lastCallbacks = () => mutate.mock.calls.at(-1)![1] as { onSuccess: () => void; onError: (e: unknown) => void };

/** 한국어를 고르고 확인 시트까지 연다. */
async function pickKoAndOpenSheet() {
  fireEvent.click(screen.getByLabelText('한국어'));
  fireEvent.click(screen.getByLabelText('저장'));
  await waitFor(() => expect(sheetOpen()).toBe(true));
}

beforeEach(() => {
  mutate.mockReset(); safeBack.mockReset(); pending = false;
  storeSettings.mockReturnValue(loaded('en-US'));
});

describe('언어 화면 게이트', () => {
  it('로딩 중엔 초안도 저장 버튼도 없다 — 기본값 ko 로 굳지 않는다', () => {
    storeSettings.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn(async () => ({ data: undefined, isError: true })) });
    render(<MyLanguageScreen />);
    expect(screen.getByText('불러오는 중…')).toBeTruthy();
    expect(screen.queryByLabelText('한국어')).toBeNull();
    expect(screen.queryByLabelText('저장')).toBeNull();
  });

  it('오류는 오류라고 말하고 다시 시도를 준다', () => {
    const refetch = vi.fn(async () => ({ data: undefined, isError: true }));
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
    expect(disabled('저장')).toBe(true);
  });
});

describe('배경 재조회 실패', () => {
  it('값이 있으면 편집기를 없애지 않는다 — 배너로 알리고, 초안·저장 중 상태가 그대로다', async () => {
    const { rerender } = render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    pending = true;
    // 캐시는 남은 채 배경 재조회가 실패했다.
    storeSettings.mockReturnValue({ ...loaded('en-US'), isError: true });
    rerender(<MyLanguageScreen />);
    expect(sheetOpen()).toBe(true);                                    // 편집기가 살아 있다
    expect(screen.queryByText('설정을 불러오지 못했어요')).toBeNull(); // 전체 오류 화면이 아니다
    expect(screen.getByLabelText('재조회 실패').textContent).toContain('마지막으로 받은 값 기준');
    expect(checked('한국어')).toBe('true');
    expect(disabled('언어 저장 확정')).toBe(true);
    lastCallbacks().onSuccess();                                       // 완료 콜백이 그대로 온다
    expect(safeBack).toHaveBeenCalledWith('/my');
  });

  it('재조회 실패 중엔 새 저장을 막는다 — 캐시 값으로 최신 설정을 덮지 않게. 재조회가 성공하면 풀린다', async () => {
    const { rerender } = render(<MyLanguageScreen />);
    fireEvent.click(screen.getByLabelText('한국어'));
    expect(disabled('저장')).toBe(false);
    storeSettings.mockReturnValue({ ...loaded('en-US'), isError: true });
    rerender(<MyLanguageScreen />);
    expect(disabled('저장')).toBe(true);                       // 바깥 저장 잠김
    expect(checked('한국어')).toBe('true');                    // 초안은 그대로
    // 다시 시도 = 실제 refetch(초안은 건드리지 않는다). 성공 응답이 오면(오류 해제) 고른 값으로 저장이 다시 열린다.
    const stale = storeSettings.mock.results.at(-1)!.value as ReturnType<typeof loaded>;
    fireEvent.click(screen.getByLabelText('다시 시도'));
    await waitFor(() => expect(stale.refetch).toHaveBeenCalledTimes(1));
    storeSettings.mockReturnValue(loaded('en-US'));
    rerender(<MyLanguageScreen />);
    await waitFor(() => expect(disabled('저장')).toBe(false));
    expect(checked('한국어')).toBe('true');                    // 고른 값이 살아 있다
    expect(screen.queryByLabelText('재조회 실패')).toBeNull();
  });

  it('값이 한 번도 안 왔으면 오류 화면이다', () => {
    storeSettings.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn(async () => ({ data: undefined, isError: true })) });
    render(<MyLanguageScreen />);
    expect(screen.getByText('설정을 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByLabelText('한국어')).toBeNull();
  });
});

describe('서버 언어가 바뀌면', () => {
  it('수정 전이면 조용히 따른다 — 알림 없음', () => {
    const { rerender } = render(<MyLanguageScreen />);
    storeSettings.mockReturnValue(loaded('ja'));
    rerender(<MyLanguageScreen />);
    expect(checked('日本語')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled('저장')).toBe(true);
  });

  it('수정 중이면 초안을 지키고 알린다 — 저장은 잠기고, 새로고침은 **실제 재조회 성공 뒤에만** 서버값으로 맞춘다', async () => {
    const { rerender } = render(<MyLanguageScreen />);
    fireEvent.click(screen.getByLabelText('한국어'));
    const ja = loaded('ja');
    storeSettings.mockReturnValue(ja);
    rerender(<MyLanguageScreen />);
    expect(checked('한국어')).toBe('true');           // 초안이 살아 있다
    expect(screen.getByRole('status').textContent).toContain('다른 기기에서 설정이 변경됐어요');
    expect(disabled('저장')).toBe(true);
    // 재조회가 실패하면(null) 아무것도 안 바뀐다 — 배너·초안 유지.
    ja.refetch.mockImplementationOnce(async () => ({ data: undefined, isError: true }));
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(ja.refetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(disabled('새로고침')).toBe(false));   // 재조회가 끝나 버튼이 풀렸다
    expect(checked('한국어')).toBe('true');
    expect(screen.getByRole('status')).toBeTruthy();
    // 성공 응답이 오면 그 값으로 초안·기준값을 바꾸고 충돌이 풀린다.
    fireEvent.click(screen.getByLabelText('새로고침'));
    await waitFor(() => expect(ja.refetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checked('日本語')).toBe('true'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled('저장')).toBe(true);              // 서버값과 같으니 바뀐 게 없다
  });

  it('저장 중에 바뀌어도 진행 중인 저장은 끊기지 않는다 — 완료 콜백이 그대로 온다', async () => {
    const { rerender } = render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    pending = true;
    storeSettings.mockReturnValue(loaded('ja'));
    rerender(<MyLanguageScreen />);
    expect(sheetOpen()).toBe(true);                    // 편집기가 다시 만들어지지 않았다
    expect(screen.getAllByText(/다른 기기에서 설정이 변경됐어요/).length).toBeGreaterThan(0);
    lastCallbacks().onSuccess();
    expect(safeBack).toHaveBeenCalledWith('/my');
  });
});

describe('저장 흐름', () => {
  it('성공 콜백에서만 화면을 떠난다 — 요청 직후엔 안 떠난다', async () => {
    render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    // 언어만 보낸다 — 통화·금액 자릿수는 서버가 파생한다(0168). 단가 자릿수는 명시값(3)을 유지.
    expect(mutate.mock.calls[0]![0]).toEqual({ locale: 'ko', unitPriceDigits: 3 });
    expect(safeBack).not.toHaveBeenCalled();
    lastCallbacks().onSuccess();
    expect(safeBack).toHaveBeenCalledWith('/my');
  });

  it('실제 생명주기: 요청 → 저장 중(모두 잠김·배경 터치 무시) → 실패 → 문구 표시·다시 열림', async () => {
    const { rerender } = render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));

    // ① 요청이 나가 있다(pending) — 콜백은 아직 없다.
    pending = true;
    rerender(<MyLanguageScreen />);
    expect(disabled('언어 저장 확정')).toBe(true);
    expect(screen.getByText('취소').closest('[aria-disabled]')?.getAttribute('aria-disabled')).toBe('true');
    press(screen.getByLabelText('닫기'));   // 배경 터치(= Android 뒤로가기와 같은 onClose)
    expect(sheetOpen()).toBe(true);        // 막혔다
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    expect(mutate).toHaveBeenCalledTimes(1);   // 연타해도 두 번 보내지 않는다
    expect(disabled('저장')).toBe(true);        // 바깥 저장도 잠긴다

    // ② 실패 콜백이 온다 → pending 해제.
    lastCallbacks().onError(new Error('지원하지 않는 언어예요'));
    pending = false;
    rerender(<MyLanguageScreen />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('지원하지 않는 언어예요'));
    expect(sheetOpen()).toBe(true);
    expect(disabled('언어 저장 확정')).toBe(false);
    expect(safeBack).not.toHaveBeenCalled();

    // ③ 이제는 배경 터치로 닫힌다(양성 대조) — 오류 문구도 함께 정리된다.
    press(screen.getByLabelText('닫기'));
    await waitFor(() => expect(sheetOpen()).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('45009(다른 기기가 먼저 저장) 는 실패 문구가 아니라 충돌 배너다 — 새로고침으로만 풀린다', async () => {
    render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    lastCallbacks().onError(new RpcError('다른 기기에서 설정이 변경됐어요', '45009', 'REVISION_CONFLICT'));
    await waitFor(() => expect(screen.getAllByText(/다른 기기에서 설정이 변경됐어요/).length).toBeGreaterThan(0));
    expect(screen.queryByRole('alert')).toBeNull();                 // 일반 실패 문구가 아니다
    expect(disabled('언어 저장 확정')).toBe(true);                    // 새로고침 전엔 잠긴다
    expect(safeBack).not.toHaveBeenCalled();
  });

  it('다시 시도하면 옛 실패 문구는 사라진다', async () => {
    render(<MyLanguageScreen />);
    await pickKoAndOpenSheet();
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    lastCallbacks().onError(new Error('x'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('언어 저장 확정'));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
