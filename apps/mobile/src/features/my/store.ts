// store.ts — 앱 설정 클라이언트 상태 (zustand).
// ⚠ 임시: 화면 간 즉시 반영을 위한 로컬 상태. 실제 저장은 Supabase 사용자 설정으로 교체 예정.
//
// 로케일이 정하는 것(구분자·통화·금액 자릿수)과 사용자가 정하는 것(단가 자릿수)을 한 스토어에 두되,
// 단가 자릿수는 "미설정(null) = 로케일 기본값 따라감" 으로 구분한다. 언어를 바꾸면 명시 설정이 없는 한
// 단가 자릿수도 새 로케일 기본값(금액+2)으로 자연스럽게 따라간다.
import { create } from 'zustand';
import { DEFAULT_LOCALE, type LocaleKey, unitPriceDigits } from '@sikjae/core';

interface SettingsState {
  locale: LocaleKey;
  /** 단가 소수 자릿수. null = 로케일 기본값 사용(단위 설정에서 사용자가 고르면 숫자가 들어감). */
  unitDigits: number | null;
  setLocale: (l: LocaleKey) => void;
  setUnitDigits: (d: number | null) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  locale: DEFAULT_LOCALE,
  unitDigits: null,
  setLocale: (locale) => set({ locale }),
  setUnitDigits: (unitDigits) => set({ unitDigits }),
}));

/** 실제 적용될 단가 자릿수 — 사용자 설정이 있으면 그 값, 없으면 로케일 기본값. */
export const useUnitDigits = (): number => {
  const locale = useSettings((s) => s.locale);
  const d = useSettings((s) => s.unitDigits);
  return d ?? unitPriceDigits(locale);
};
