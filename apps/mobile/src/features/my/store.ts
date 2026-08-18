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
import { DEFAULT_LOCALE, type LocaleKey, unitPriceDigits } from '@sikjae/core';
import { useSaveSettings, useStoreSettings } from './hooks';

/** 저장된 로케일 문자열이 우리가 아는 값인지 확인한다. 모르는 값이면 기본값으로 떨어진다. */
const asLocale = (v: string | undefined): LocaleKey =>
  (v && unitPriceDigits(v as LocaleKey) >= 0 ? (v as LocaleKey) : DEFAULT_LOCALE);

export interface AppSettings {
  locale: LocaleKey;
  /** 단가 소수 자릿수(명시값). null 이면 로케일 기본값을 따른다. */
  unitDigits: number | null;
  loading: boolean;
}

export function useSettings(): AppSettings {
  const q = useStoreSettings();
  const locale = asLocale(q.data?.locale);
  // 서버는 항상 숫자를 준다. 로케일 기본값과 같으면 "명시 설정 없음"으로 본다 —
  // 그래야 언어를 바꿀 때 자릿수가 따라온다.
  const stored = q.data?.unitPriceDigits;
  const isDefault = stored === undefined || stored === unitPriceDigits(locale);
  return { locale, unitDigits: isDefault ? null : stored, loading: q.isLoading };
}

/** 실제 적용될 단가 자릿수 — 명시 설정이 있으면 그 값, 없으면 로케일 기본값. */
export function useUnitDigits(): number {
  const { locale, unitDigits } = useSettings();
  return unitDigits ?? unitPriceDigits(locale);
}

/**
 * 설정 변경 — 서버에 저장한다.
 *
 * ⚠ 언어를 바꾸면 단가 자릿수의 "기본값"이 함께 바뀐다. 명시 설정이 없던 상태라면
 *   새 로케일 기본값으로 같이 저장해 화면과 저장값이 어긋나지 않게 한다.
 */
export function useSettingsActions() {
  const save = useSaveSettings();
  const { locale, unitDigits } = useSettings();

  return {
    saving: save.isPending,
    setLocale: (next: LocaleKey, onError?: (e: unknown) => void) =>
      save.mutate(
        {
          locale: next,
          // 명시 설정이 없으면 새 로케일 기본값을 따라간다.
          unitPriceDigits: unitDigits ?? unitPriceDigits(next),
        },
        { onError },
      ),
    setUnitDigits: (next: number | null, onError?: (e: unknown) => void) =>
      save.mutate({ unitPriceDigits: next ?? unitPriceDigits(locale) }, { onError }),
  };
}
