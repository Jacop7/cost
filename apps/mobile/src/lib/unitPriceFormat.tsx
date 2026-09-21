import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, formatMarketUnitPrice, formatUnitPrice, marketMoneyInputFormat, unitPriceDigits, type LocaleKey } from '@costkeep/core';
import type { LaunchCurrencyCode } from '@costkeep/types';

/** Display precision only. Ledger values and currency minor-unit rounding stay unchanged. */
export const UnitPriceDigitsContext = createContext<number | undefined>(undefined);
export function useUnitPriceFormat() {
  const configuredDigits = useContext(UnitPriceDigitsContext);
  return useMemo(() => (value: number, unit: string, locale: LocaleKey = DEFAULT_LOCALE, digits?: number) =>
    formatUnitPrice(value, unit, locale, digits ?? configuredDigits ?? unitPriceDigits(locale)), [configuredDigits]);
}

export function useMarketUnitPriceFormat() {
  const configuredDigits = useContext(UnitPriceDigitsContext);
  return useMemo(() => (value: number, unit: string, currency: LaunchCurrencyCode, digits?: number) => {
    const defaultDigits = marketMoneyInputFormat(currency).digits + 2;
    return formatMarketUnitPrice(value, unit, currency, digits ?? configuredDigits ?? defaultDigits);
  }, [configuredDigits]);
}
