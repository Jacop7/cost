import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, formatUnitPrice, unitPriceDigits, type LocaleKey } from '@costkeep/core';

/** Display precision only. Ledger values and currency minor-unit rounding stay unchanged. */
export const UnitPriceDigitsContext = createContext<number | undefined>(undefined);
export function useUnitPriceFormat() {
  const configuredDigits = useContext(UnitPriceDigitsContext);
  return useMemo(() => (value: number, unit: string, locale: LocaleKey = DEFAULT_LOCALE, digits?: number) =>
    formatUnitPrice(value, unit, locale, digits ?? configuredDigits ?? unitPriceDigits(locale)), [configuredDigits]);
}
