/**
 * 앱 설정 접근점 — 화면은 이 훅만 쓰고 저장 위치는 신경 쓰지 않는다.
 *
 * 값은 **서버(settings 테이블)** 에 있다. 예전에는 zustand 로컬 상태였는데,
 * 앱을 지우면 초기화되고 기기를 바꾸면 따라오지 않았다. 설정은 매장의 속성이지
 * 기기의 속성이 아니다.
 *
 * 로케일이 정하는 것(구분자·통화·금액 자릿수)과 사용자가 정하는 것(단가 자릿수)을 구분한다.
 * 단가 자릿수는 "미설정 = 로케일 기본값 따라감" 으로 두어, 언어를 바꾸면 명시 설정이 없는 한
 * 새 로케일 기본값(금액+2)으로 자연스럽게 따라간다.
 */
import { DEFAULT_LOCALE, LOCALES, type LocaleKey, unitPriceDigits } from '@margincook/core';
import { useSaveSettings, useStoreSettings, type SettingsSaveResult } from '@/features/settings/hooks';

/** 우리가 아는 언어 키인가 — LOCALES 의 키 집합으로 직접 본다. */
export const isLocaleKey = (v: unknown): v is LocaleKey =>
  typeof v === 'string' && LOCALES.some((l) => l.key === v);

/**
 * 저장된 로케일 문자열이 우리가 아는 값인지 확인한다. 모르는 값이면 기본값으로 떨어진다.
 * ⚠ 예전엔 `unitPriceDigits(v) >= 0` 으로 쟀는데 그 함수가 안에서 기본값으로 폴백해 'xx-XX' 도
 *   유효한 것처럼 통과했다(검토 지적). 키 집합으로 잰다.
 */
export const asLocale = (v: string | undefined): LocaleKey => (isLocaleKey(v) ? v : DEFAULT_LOCALE);

export interface AppSettings {
  locale: LocaleKey;
  /** 편집 시작 시점에 고정해 저장에 되돌려줄 설정 판본. */
  revision: number | null;
  /** 1차는 metric 만 허용한다. null 은 서버값을 아직 못 받은 상태다. */
  unitSystem: string | null;
  /** 서버에 저장된 1컵 용량(ml). */
  cupVolume: number | null;
  /** 단가 소수 자릿수(명시값). null 이면 로케일 기본값을 따른다. */
  unitDigits: number | null;
  loading: boolean;
  /** 서버 조회 실패 — 화면은 이걸 '설정 없음'이나 기본값으로 읽으면 안 된다. */
  error: boolean;
  /** 값이 한 번이라도 왔나. error 와 함께 참이면 **배경 재조회 실패**다 — 보여 줄 순 있지만 저장은 막는다. */
  hasData: boolean;
  /** 서버를 실제로 다시 조회한다. 성공하면 새 언어·판본, 실패하면 null — 성공 응답으로만 기준값을 바꾼다. */
  refetch: () => Promise<{
    locale: LocaleKey;
    revision: number;
    unitSystem: string;
    cupVolume: number;
  } | null>;
}

export function useSettings(): AppSettings {
  const q = useStoreSettings();
  const locale = asLocale(q.data?.locale);
  // 서버는 항상 숫자를 준다. 로케일 기본값과 같으면 "명시 설정 없음"으로 본다 —
  // 그래야 언어를 바꿀 때 자릿수가 따라온다.
  const stored = q.data?.unitPriceDigits;
  const isDefault = stored === undefined || stored === unitPriceDigits(locale);
  return {
    locale,
    revision: q.data?.revision ?? null,
    unitSystem: q.data?.unitSystem ?? null,
    cupVolume: q.data?.cupVolume ?? null,
    unitDigits: isDefault ? null : stored,
    loading: q.isLoading,
    error: q.isError,
    hasData: q.data !== undefined,
    refetch: async () => {
      // 실패는 null 로 — 던지지 않는다(호출부는 대개 fire-and-forget 이라 unhandled rejection 이 된다).
      try {
        const r = await q.refetch();
        return r?.data && !r.isError
          ? {
              locale: asLocale(r.data.locale),
              revision: r.data.revision,
              unitSystem: r.data.unitSystem,
              cupVolume: r.data.cupVolume,
            }
          : null;
      } catch {
        return null;
      }
    },
  };
}

/** 실제 적용될 단가 자릿수 — 명시 설정이 있으면 그 값, 없으면 로케일 기본값. */
export function useUnitDigits(): number {
  const { locale, unitDigits } = useSettings();
  return unitDigits ?? unitPriceDigits(locale);
}

export interface SaveCallbacks {
  onSuccess?: (result: SettingsSaveResult) => void;
  onError?: (e: unknown) => void;
}

/**
 * 설정 변경 — 서버에 저장한다.
 *
 * ⚠ 언어를 바꾸면 단가 자릿수의 "기본값"이 함께 바뀐다. 명시 설정이 없던 상태라면
 *   새 로케일 기본값으로 같이 저장해 화면과 저장값이 어긋나지 않게 한다.
 * ⚠ 화면은 **onSuccess 에서만** 이동한다 — 요청을 보내자마자 닫으면 실패를 못 본다(검토 지적).
 */
export function useSettingsActions() {
  const save = useSaveSettings();
  const { locale, unitDigits } = useSettings();

  return {
    saving: save.isPending,
    setLocale: (next: LocaleKey, baseRevision: number, cb: SaveCallbacks = {}) =>
      save.mutate(
        {
          values: {
            locale: next,
            // 통화·금액 자릿수는 **서버가 언어에서 파생**한다(0168 locale_defaults).
            unitPriceDigits: unitDigits ?? unitPriceDigits(next),
          },
          baseRevision,
        },
        { onSuccess: cb.onSuccess, onError: cb.onError },
      ),
    setUnitDigits: (next: number | null, baseRevision: number, cb: SaveCallbacks = {}) =>
      save.mutate(
        { values: { unitPriceDigits: next ?? unitPriceDigits(locale) }, baseRevision },
        { onSuccess: cb.onSuccess, onError: cb.onError },
      ),
    setCupVolume: (next: number, baseRevision: number, cb: SaveCallbacks = {}) =>
      save.mutate(
        { values: { cupVolume: next }, baseRevision },
        { onSuccess: cb.onSuccess, onError: cb.onError },
      ),
  };
}
